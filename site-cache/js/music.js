import { musicFetch, musicUrl } from "/js/music/proxy.js";
import { createRecommended } from "/js/music/recommended.js";
import { renderHome } from "/js/music/home.js";
import { verified } from "/js/music/artist-name.js";
import { renderAlbums } from "/js/music/albums.js";
import { renderCards } from "/js/music/cards.js";
import { createSuggestions } from "/js/music/suggestions.js";
import { icon } from "/js/music/icons.js";
import { changeArtwork } from "/js/music/motion.js";
import { createLyrics } from "/js/music/lyrics.js";
import { createArtists } from "/js/music/artists.js";
import { api, visibleTracks } from "/js/music/api.js";
import { createDetails } from "/js/music/details.js";
import { setupSeek } from "/js/music/seek.js";
import { setupBrowse } from "/js/music/browse.js";
import { parseLyrics } from "/js/music-lyrics.js";
import { createMusicLibrary } from "/js/music-library.js";
import { trackView, trackEvent } from "/js/music/analytics.js";
const $ = (id) => document.getElementById(id);
const audio = $("music-audio");
localStorage.removeItem("truffledMusicSource");
{
  const button = document.createElement("button");
  button.id = "browse-history";
  button.setAttribute("aria-pressed", "false");
  const mark = document.createElement("span");
  mark.dataset.icon = "history";
  button.append(mark, "history");
  $("browse-queue").after(button);
}
document.querySelectorAll("[data-icon]").forEach((button) => icon(button, button.dataset.icon));
let likedTab = "songs";
const likedTabs = document.createElement("div");
likedTabs.className = "liked-tabs";
likedTabs.setAttribute("role", "group");
likedTabs.setAttribute("aria-label", "Liked");
likedTabs.hidden = true;
for (const [key, label] of [["songs", "songs"], ["albums", "albums"]]) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.tab = key;
  button.textContent = label;
  button.onclick = () => {
    likedTab = key;
    render();
  };
  likedTabs.append(button);
}
$("music-results").before(likedTabs);
const recSection = document.createElement("section");
recSection.className = "recommended";
recSection.hidden = true;
const recHeading = document.createElement("div");
recHeading.className = "music-heading";
const recTitle = document.createElement("h2");
recTitle.textContent = "recommended for you";
recHeading.append(recTitle);
const recGrid = document.createElement("div");
recGrid.className = "music-results";
const recNote = document.createElement("p");
recNote.className = "recommended-note";
const recMore = document.createElement("button");
recMore.type = "button";
recMore.className = "recommended-more";
recMore.textContent = "find more";
recSection.append(recHeading, recGrid, recNote, recMore);
$("music-results").after(recSection);
let results = [],
  queue = [],
  index = -1,
  request,
  lastVolume = 0.8;
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const library = createMusicLibrary(localStorage);
const suggestions = createSuggestions({ api, library, action, notice });
const settingsKey = "truffledMusicSettings";
const musicSettings = {
  volume: 0.8,
  quality: "high",
  autoskip: true,
};
try {
  const saved = JSON.parse(localStorage.getItem(settingsKey) || "{}");
  if (Number.isFinite(saved.volume)) musicSettings.volume = saved.volume;
  if (["off", "all", "one"].includes(saved.repeat)) musicSettings.repeat = saved.repeat;
} catch {}
musicSettings.repeat ||= "off";
if (!["high", "saver"].includes(musicSettings.quality)) musicSettings.quality = "high";
function saveSettings() {
  try {
    localStorage.setItem(settingsKey, JSON.stringify(musicSettings));
  } catch {}
}
function fmtDur(sec) {
  const total = Math.max(0, Math.round(Number(sec) || 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
function fmtPlays(count) {
  const n = Number(count) || 0;
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}
let historyPending = null;
let libraryView = "discover",
  selectedPlaylist = null,
  dialogTrack = null,
  editingPlaylist = null,
  noticeTimer;
audio.volume = Math.min(1, Math.max(0, Number(musicSettings.volume) || 0));
audio.addEventListener("volumechange", () => {
  musicSettings.volume = audio.volume;
  saveSettings();
});
function fallback(image) {
  image.onerror = () => {
    image.onerror = null;
    image.src = "/png/logo.png";
  };
  if (image.closest?.(".lyrics-album, .music-now") || ["now-cover", "lyrics-cover", "lyrics-background"].includes(image.id)) return;
  image.classList.add("img-loading");
  const done = () => image.classList.remove("img-loading");
  image.addEventListener("load", done, { once: true });
  image.addEventListener("error", done, { once: true });
  queueMicrotask(() => {
    if (image.complete && image.naturalWidth) done();
  });
}
[$("now-cover"), $("lyrics-cover"), $("lyrics-background")].forEach(fallback);
function render() {
  $("results-title").parentElement.hidden = libraryView === "playlist";
  $("music-results").classList.toggle("search-rows", libraryView === "discover" && Boolean(activeQuery));
  renderHome({
    library, fallback, heading: $("results-title").parentElement,
    show: libraryView === "discover" && !activeQuery,
    open(id) { selectedPlaylist = id; setLibraryView("playlist"); },
  });
  $("artist-results").hidden = libraryView !== "discover" || !activeQuery;
  $("load-more").hidden = !["discover", "albums"].includes(libraryView) || !nextCursor;
  if (libraryView === "albums") {
    renderAlbums({ $, activeQuery, albumResults, fallback, openAlbum });
    return;
  }
  renderLibrary();
  likedTabs.hidden = libraryView !== "liked";
  for (const button of likedTabs.children) button.setAttribute("aria-pressed", String(button.dataset.tab === likedTab));
  recSection.hidden = libraryView !== "discover" || Boolean(activeQuery);
  if (libraryView === "liked" && likedTab === "albums") {
    const albums = library.albums();
    renderAlbums({ $, activeQuery: "", albumResults: albums, fallback, openAlbum });
    $("results-title").textContent = "liked albums";
    $("track-count").textContent = String(albums.length);
    $("music-status").textContent = albums.length ? "" : "Tap the heart on an album to save it here.";
    return;
  }
  const saved = library.get();
  const list =
    libraryView === "liked"
      ? saved.likes
      : libraryView === "playlist"
        ? saved.playlists.find((item) => item.id === selectedPlaylist)?.tracks || []
        : visibleTracks(results);
  $("music-results").hidden = ["playlists", "queue", "history"].includes(libraryView);
  $("music-library").hidden = !["playlists", "queue", "playlist", "history"].includes(libraryView);
  if (["playlists", "queue", "history"].includes(libraryView)) return;
  if (libraryView !== "discover") {
    $("results-title").textContent =
      libraryView === "liked"
        ? "liked songs"
        : library.get().playlists.find((item) => item.id === selectedPlaylist)?.name || "playlist";
    $("track-count").textContent = String(list.length);
    $("music-status").textContent = list.length
      ? ""
      : libraryView === "liked"
        ? "Tap the heart on a song to save it here."
        : "Add songs using the playlist icon on a cover.";
  }
  if (libraryView === "discover" && activeQuery) {
    $("music-results").replaceChildren(songRows(list, list, true));
    return;
  }
  renderCards({ $, list, library, fallback, action, openTrack, saveLike, openPlaylistDialog,
    addQueue, libraryView, selectedPlaylist, changeLibrary,
    start(tracks, position) { queue = [...tracks]; play(position); },
  });
}
function action(name, label, callback) {
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", label);
  button.title = label;
  icon(button, name);
  button.onclick = callback;
  return button;
}
function notice(message) {
  clearTimeout(noticeTimer);
  $("music-notice").textContent = message;
  noticeTimer = setTimeout(() => {
    $("music-notice").textContent = "";
  }, 2600);
}
function changeLibrary(callback, message) {
  try {
    callback();
    updateLike();
    render();
    if (message) notice(message);
    return true;
  } catch {
    notice("Couldn’t save. Browser storage may be full or unavailable.");
    return false;
  }
}
function saveLike(track) {
  changeLibrary(() => library.toggleLike(track));
}
function updateLike() {
  for (const button of document.querySelectorAll("button[data-like-id]")) {
    const saved = library.get().likes.some(item => String(item.id) === button.dataset.likeId);
    button.setAttribute("aria-pressed", String(saved));
    const label = `${saved ? "Unlike" : "Like"} ${button.dataset.likeTitle}`;
    button.setAttribute("aria-label", label);
    button.title = label;
  }
  const track = queue[index],
    liked = track && library.isLiked(track.id);
  $("now-like").setAttribute("aria-pressed", String(Boolean(liked)));
  $("now-like").setAttribute("aria-label", liked ? "Unlike current song" : "Like current song");
}
function addQueue(track) {
  queue.push(track);
  notice("Added to queue");
  if (libraryView === "queue") render();
}
function setLibraryView(view, redraw = true) {
  if (redraw) {
    request?.abort();
    loadingPage = false;
  }
  libraryView = view;
  const viewNames = { discover: "Discover", albums: "Albums", liked: "Liked songs", playlists: "Playlists", playlist: "Playlist", queue: "Queue", history: "History" };
  trackView(viewNames[view] || view, view === "playlist" ? `/music/playlist/${selectedPlaylist}` : `/music/${view}`);
  if (!$("lyrics-view").hidden) setView(false, true);
  for (const [id, value] of [
    ["browse-trending", "discover"],
    ["browse-liked", "liked"],
    ["browse-albums", "albums"],
    ["browse-playlists", "playlists"],
    ["browse-queue", "queue"],
    ["browse-history", "history"],
  ])
    $(id).setAttribute(
      "aria-pressed",
      String(view === value || (view === "playlist" && value === "playlists")),
    );
  $("music-status").textContent = "";
  if (view === "discover") {
    $("results-title").textContent = $("music-query").value.trim()
      ? `results for “${$("music-query").value.trim()}”`
      : "all time";
    $("track-count").textContent = String(results.length);
  }
  if (redraw) render();
}
function renderLibrary() {
  document.querySelector(".playlist-suggestions")?.remove();
  const mount = $("music-library");
  mount.replaceChildren();
  if (libraryView === "playlists") {
    $("results-title").textContent = "playlists";
    const lists = library.get().playlists;
    $("track-count").textContent = String(lists.length);
    const create = document.createElement("button");
    create.className = "library-create";
    create.textContent = "+ Create playlist";
    create.onclick = () => openPlaylistDialog();
    mount.append(create);
    if (!lists.length) {
      const empty = document.createElement("p");
      empty.className = "library-empty";
      empty.textContent = "Create a playlist, then add songs from their covers.";
      mount.append(empty);
    }
    const grid = document.createElement("div");
    grid.className = "playlist-grid";
    for (const list of lists) {
      const button = document.createElement("button");
      button.className = "playlist-card";
      button.setAttribute("aria-label", `Open playlist ${list.name}`);
      const artwork = document.createElement("div");
      artwork.className = "playlist-art";
      if (list.tracks.length) {
        const covers = list.tracks.length >= 4 ? list.tracks.slice(0, 4) : list.tracks.slice(0, 1);
        artwork.classList.toggle("playlist-collage", covers.length === 4);
        for (const track of covers) {
          const img = document.createElement("img");
          img.src = track.cover || "/png/logo.png";
          img.alt = "";
          fallback(img);
          artwork.append(img);
        }
      } else icon(artwork, "playlist");
      const name = document.createElement("strong"),
        count = document.createElement("span");
      name.textContent = list.name;
      count.textContent = `${list.tracks.length} songs`;
      button.append(artwork, name, count);
      button.onclick = () => {
        selectedPlaylist = list.id;
        setLibraryView("playlist");
      };
      grid.append(button);
    }
    mount.append(grid);
  } else if (libraryView === "playlist") {
    const list = library.get().playlists.find((list) => list.id === selectedPlaylist);
    if (!list) {
      libraryView = "playlists";
      renderLibrary();
      return;
    }
    const header = document.createElement("div");
    header.className = "playlist-detail";
    const art = document.createElement("div");
    art.className = "playlist-hero-art";
    const covers = list.tracks.length >= 4 ? list.tracks.slice(0, 4) : list.tracks.slice(0, 1);
    art.classList.toggle("is-collage", covers.length === 4);
    if (!covers.length) art.textContent = list.name.trim().slice(0, 1).toUpperCase() || "♪";
    for (const track of covers) {
      const image = document.createElement("img");
      image.src = track.cover || "/png/logo.png";
      image.alt = "";
      fallback(image);
      art.append(image);
    }
    const info = document.createElement("div");
    info.className = "playlist-hero-info";
    const name = document.createElement("h2");
    name.textContent = list.name;
    const meta = document.createElement("p");
    meta.className = "playlist-meta";
    const minutes = Math.round(list.tracks.reduce((sum, track) => sum + (Number(track.duration) || 0), 0) / 60);
    meta.textContent = [
      list.description,
      `${list.tracks.length} ${list.tracks.length === 1 ? "song" : "songs"}`,
      minutes ? `${minutes} min` : "",
    ].filter(Boolean).join(", ");
    const buttons = document.createElement("div");
    buttons.className = "playlist-actions";
    const playAll = action("play", "Play playlist", () => {
      if (!list.tracks.length) return;
      queue = [...list.tracks];
      play(0);
    });
    playAll.disabled = !list.tracks.length;
    buttons.append(
      playAll,
      action("plus", "Find songs to add", () => {
        setLibraryView("discover");
        $("music-query").focus();
      }),
      action("edit", "Edit playlist", () => openPlaylistDialog(null, list)),
      action("trash", "Delete playlist", () => {
        if (confirm(`Delete “${list.name}”?`) && changeLibrary(() => library.delete(list.id), "Playlist deleted"))
          setLibraryView("playlists");
      }),
    );
    info.append(name, meta, buttons);
    header.append(art, info);
    mount.append(header);
    $("music-results").after(suggestions(list));
  } else if (libraryView === "queue") {
    $("results-title").textContent = "queue";
    $("track-count").textContent = String(Math.max(0, queue.length - Math.max(0, index)));
    if (!queue.length) {
      const empty = document.createElement("p");
      empty.className = "library-empty";
      empty.textContent = "Add songs using the queue icon on a cover.";
      mount.append(empty);
    }
    queue.forEach((track, position) => {
      if (position < index) return;
      const row = document.createElement("div");
      row.className = "queue-row";
      row.dataset.trackId = track.id;
      const image = document.createElement("img");
      image.src = track.cover || "/png/logo.png";
      image.alt = "";
      fallback(image);
      const button = document.createElement("button");
      button.className = "queue-song";
      button.setAttribute("aria-label", `Play queued ${track.title}`);
      const title = document.createElement("strong"),
        artist = document.createElement("span");
      title.textContent = track.title;
      artist.textContent = position === index ? `${track.artist}, now playing` : track.artist;
      button.append(title, artist);
      button.onclick = () => play(position);
      const move = (direction) => {
        const target = position + direction;
        if (target <= index || target < 0 || target >= queue.length) return;
        [queue[position], queue[target]] = [queue[target], queue[position]];
        render();
      };
      const up = action("up", `Move ${track.title} up`, () => move(-1));
      up.disabled = position <= Math.max(0, index + 1);
      const down = action("down", `Move ${track.title} down`, () => move(1));
      down.disabled = position === index || position === queue.length - 1;
      const remove = action("close", `Remove ${track.title} from queue`, () => {
        queue.splice(position, 1);
        render();
      });
      remove.disabled = position === index;
      row.append(image, button, up, down, remove);
      mount.append(row);
    });
  } else if (libraryView === "history") {
    renderHistory(mount);
  }
}
function historyDay(at) {
  const day = new Date(at);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const diff = Math.round((today - start) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return day.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    ...(day.getFullYear() !== today.getFullYear() && { year: "numeric" }),
  });
}
function renderHistory(mount) {
  const entries = library.history();
  $("results-title").textContent = "history";
  $("track-count").textContent = String(entries.length);
  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "library-empty";
    empty.textContent = "Songs you play show up here.";
    mount.append(empty);
    return;
  }
  const tracks = entries.map((entry) => entry.track);
  const tools = document.createElement("div");
  tools.className = "history-tools";
  const clear = document.createElement("button");
  clear.className = "history-clear";
  clear.textContent = "Clear history";
  clear.onclick = () => {
    if (confirm("Clear your listening history?")) changeLibrary(() => library.clearHistory(), "History cleared");
  };
  tools.append(clear);
  mount.append(tools);
  let day = "";
  entries.forEach((entry, position) => {
    const label = historyDay(entry.at);
    if (label !== day) {
      day = label;
      const heading = document.createElement("h3");
      heading.className = "history-day";
      heading.textContent = label;
      mount.append(heading);
    }
    const { track } = entry;
    const row = document.createElement("div");
    row.className = "queue-row history-row";
    row.dataset.trackId = track.id;
    const image = document.createElement("img");
    image.src = track.cover || "/png/logo.png";
    image.alt = "";
    image.loading = "lazy";
    fallback(image);
    const button = document.createElement("button");
    button.className = "queue-song";
    button.setAttribute("aria-label", `Play ${track.title} by ${track.artist}`);
    const title = document.createElement("strong"),
      artist = document.createElement("span");
    title.textContent = track.title;
    artist.textContent = track.artist;
    button.append(title, artist);
    button.onclick = () => {
      queue = [...tracks];
      play(position);
    };
    const time = document.createElement("time");
    time.className = "history-time";
    time.dateTime = new Date(entry.at).toISOString();
    time.textContent = new Date(entry.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    const forget = action("close", `Remove ${track.title} from history`, () =>
      changeLibrary(() => library.forgetPlay(entry.at)),
    );
    row.append(image, button, time, action("queue", `Add ${track.title} to queue`, () => addQueue(track)), forget);
    mount.append(row);
  });
}
function openPlaylistDialog(track = null, editing = null) {
  dialogTrack = track;
  editingPlaylist = editing?.id || null;
  $("playlist-dialog-title").textContent = track
    ? "Add to playlist"
    : editing
      ? "Edit playlist"
      : "Create playlist";
  $("playlist-name").value = editing?.name || "";
  $("playlist-description").value = editing?.description || "";
  $("save-playlist").textContent = editing ? "Save" : track ? "Create and add" : "Create playlist";
  $("playlist-choices").replaceChildren();
  if (track)
    for (const list of library.get().playlists) {
      const button = document.createElement("button");
      button.className = "playlist-choice";
      button.textContent = list.name;
      const exists = list.tracks.some((item) => item.id === track.id);
      button.disabled = exists;
      if (exists) button.textContent += ", added";
      button.onclick = () => {
        if (changeLibrary(() => library.add(list.id, track), `Added to ${list.name}`))
          $("playlist-dialog").close();
      };
      $("playlist-choices").append(button);
    }
  $("playlist-dialog").showModal();
}
$("playlist-form").onsubmit = (event) => {
  event.preventDefault();
  const name = $("playlist-name").value.trim();
  if (!name) return;
  const description = $("playlist-description").value;
  if (
    changeLibrary(
      () => {
        if (editingPlaylist) library.update(editingPlaylist, name, description);
        else {
          const id = library.create(name, description);
          if (dialogTrack) library.add(id, dialogTrack);
        }
      },
      editingPlaylist ? "Playlist saved" : "Playlist created",
    )
  )
    $("playlist-dialog").close();
};
$("close-playlist-dialog").onclick = () => $("playlist-dialog").close();
$("browse-trending").onclick = () => {
  $("music-query").value = "";
  load("", false, false);
};
$("browse-liked").onclick = () => setLibraryView("liked");
$("browse-playlists").onclick = () => setLibraryView("playlists");
$("browse-queue").onclick = $("open-queue").onclick = () => setLibraryView("queue");
$("browse-history").onclick = () => setLibraryView("history");
$("now-like").onclick = () => {
  if (queue[index]) saveLike(queue[index]);
};
$("now-playlist").onclick = () => {
  if (queue[index]) openPlaylistDialog(queue[index]);
};
const recommended = createRecommended({ api, library });
let nextCursor = "",
  activeQuery = "",
  loadingPage = false,
  autoPageAllowed = true;
async function load(query = "", more = false, albums = libraryView === "albums") {
  if (more && (loadingPage || !nextCursor)) return;
  if (!more) {
    setLibraryView(albums ? "albums" : "discover", false);
    request?.abort();
    activeQuery = query;
    artists.search(albums ? "" : query);
    nextCursor = "";
    autoPageAllowed = true;
    results = [];
    albumResults = [];
    render();
  }
  request = new AbortController();
  const signal = request.signal;
  loadingPage = true;
  $("load-more").disabled = true;
  $("music-status").textContent = "";
  if (!more && !activeQuery) {
    $("music-results").hidden = false;
    $("music-results").replaceChildren(
      ...Array.from({ length: 12 }, () => {
        const card = document.createElement("div");
        card.className = "music-track track-skeleton";
        card.setAttribute("aria-hidden", "true");
        card.innerHTML = '<div class="track-cover"></div><span class="skeleton-line"></span><span class="skeleton-line short"></span>';
        return card;
      }),
    );
  } else if (!more) $("music-status").textContent = "Loading music…";
  const previousCursor = nextCursor;
  $("results-title").textContent = activeQuery ? `results for “${activeQuery}”` : albums ? "albums" : "all time";
  try {
    const params = new URLSearchParams();
    if (activeQuery) params.set("q", activeQuery);
    if (more) params.set("cursor", nextCursor);
    const data = !albums && !activeQuery
      ? await api("chart", signal)
      : await api(`${albums ? "albums" : "search"}?${params}`, signal);
    if (signal.aborted) return;
    const seen = new Set(results.map((track) => track.id));
    const previousCount = albums ? albumResults.length : results.length;
    if (albums) {
      const seenAlbums = new Set(albumResults.map((album) => album.id));
      albumResults.push(...data.albums.filter((album) => !seenAlbums.has(album.id)));
    } else {
      const name = (track) => `${track.title}|${track.artist}`.toLowerCase();
      const names = new Set(results.map(name));
      results.push(...data.tracks.filter((track) => !seen.has(track.id) && !names.has(name(track)) && names.add(name(track))));
    }
    nextCursor = !albums && !activeQuery ? "" : data.nextCursor === previousCursor ? "" : data.nextCursor || "";
    autoPageAllowed = (albums ? albumResults.length : results.length) > previousCount;
    requestAnimationFrame(() => {
      const scroll = $("music-scroll");
      if (!signal.aborted && !loadingPage && autoPageAllowed && nextCursor && scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 700)
        load(activeQuery, true, albums);
    });
    render();
    if (!albums && !activeQuery && !more) loadRecommended(true);
    $("track-count").textContent = String(albums ? albumResults.length : results.length);
    $("music-status").textContent = (albums ? albumResults.length : results.length)
      ? ""
      : "No results found.";
  } catch (error) {
    if (!signal.aborted) $("music-status").textContent = error.message;
  } finally {
    if (!signal.aborted) {
      loadingPage = false;
      $("load-more").disabled = false;
      $("load-more").hidden = !nextCursor || !["discover", "albums"].includes(libraryView);
    }
  }
}
$("load-more").onclick = () => load(activeQuery, true);
function renderRecommended() {
  const list = recommended.shown();
  renderCards({
    $: (id) => (id === "music-results" ? recGrid : $(id)),
    list, library, fallback, action, openTrack, saveLike, openPlaylistDialog,
    addQueue, libraryView: "discover", selectedPlaylist, changeLibrary,
    start(tracks, position) { queue = [...tracks]; play(position); },
  });
  recNote.hidden = Boolean(list.length);
  recMore.hidden = !list.length || !recommended.canLoadMore();
}
async function loadRecommended(fresh = false) {
  if (fresh) {
    recommended.reset();
    recGrid.replaceChildren();
  }
  if (!recommended.hasSeeds()) {
    recNote.textContent = "Play a few songs and recommendations will show up here.";
    renderRecommended();
    return;
  }
  recMore.disabled = true;
  recMore.textContent = "finding songs…";
  if (fresh) {
    recNote.hidden = true;
    recGrid.replaceChildren(
      ...Array.from({ length: 6 }, () => {
        const card = document.createElement("div");
        card.className = "music-track track-skeleton";
        card.setAttribute("aria-hidden", "true");
        card.innerHTML = '<div class="track-cover"></div><span class="skeleton-line"></span><span class="skeleton-line short"></span>';
        return card;
      }),
    );
  }
  try {
    await recommended.more(12, new Set(results.map((track) => track.id)));
    recNote.textContent = "Couldn’t find recommendations right now.";
  } catch {
    recNote.textContent = "Couldn’t find recommendations right now.";
  }
  recMore.disabled = false;
  recMore.textContent = "find more";
  renderRecommended();
}
recMore.onclick = () => loadRecommended(false);
document.addEventListener("music:albums-change", () => {
  if (libraryView === "liked" && likedTab === "albums") render();
});
const pageObserver = new IntersectionObserver(
  (entries) => {
    if (
      entries.some((entry) => entry.isIntersecting) &&
      ["discover", "albums"].includes(libraryView) &&
      !loadingPage &&
      autoPageAllowed &&
      nextCursor
    )
      load(activeQuery, true);
  },
  { root: $("music-scroll"), rootMargin: "500px" },
);
const pageSentinel = document.createElement("div");
pageSentinel.style.height = "1px";
$("load-more").after(pageSentinel);
pageObserver.observe(pageSentinel);
let albumResults = [];
$("browse-albums").onclick = () => load($("music-query").value.trim(), false, true);
function repeatState() {
  const mode = musicSettings.repeat;
  const label = { off: "Repeat off", all: "Repeat all", one: "Repeat one" }[mode];
  audio.loop = false;
  icon($("repeat"), mode === "one" ? "repeatOne" : "repeat");
  $("repeat").dataset.mode = mode;
  $("repeat").setAttribute("aria-pressed", String(mode !== "off"));
  $("repeat").setAttribute("aria-label", label);
  $("repeat").title = label;
}
$("repeat").onclick = () => {
  musicSettings.repeat = { off: "all", all: "one", one: "off" }[musicSettings.repeat];
  saveSettings();
  repeatState();
  prefetched = null;
  prefetchArmed = true;
};
repeatState();
$("download-song").onclick = async () => {
  const track = queue[index];
  if (!track) return;
  $("download-song").disabled = true;
  notice("Preparing download…");
  try {
    const response = await musicFetch(`/api/music/download/${track.id}`);
    if (!response.ok) throw new Error((await response.json()).error || "Download unavailable");
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download =
      response.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ||
      `${track.title}.mp3`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    notice("Download ready");
  } catch (error) {
    notice(error.message);
  } finally {
    $("download-song").disabled = false;
  }
};
$("music-scroll").addEventListener(
  "scroll",
  () => {
    const scroll = $("music-scroll");
    if (
      ["discover", "albums"].includes(libraryView) &&
      !loadingPage &&
      nextCursor &&
      scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 700
    )
      load(activeQuery, true);
  },
  { passive: true },
);
function playbackState() {
  icon($("play-pause"), audio.paused ? "play" : "pause");
  const label = audio.paused ? "Play" : "Pause";
  $("play-pause").setAttribute("aria-label", label);
  $("play-pause").title = label;
}
let streamRequest,
  hlsPlayer,
  playbackGeneration = 0,
  playbackRetry = 0,
  autoSkips = 0,
  altAttempts = 0;
function nextPlayable(from) {
  for (let step = 0; step < queue.length; step++) {
    const i = (((from + step) % queue.length) + queue.length) % queue.length;
    if (!queue[i].unavailable) return i;
  }
  return -1;
}
function forward(from) {
  for (let i = Math.max(0, from); i < queue.length; i++) if (!queue[i].unavailable) return i;
  return -1;
}
let prefetched = null,
  prefetchArmed = false,
  extending = null;
function extendQueue() {
  if (!queue[index]) return Promise.resolve();
  const seeds = queue.slice(Math.max(0, index - 2), index + 1).reverse();
  extending ||= Promise.all(
    seeds.map((seed) => api(`recommendations?seed=${encodeURIComponent(seed.id)}`).then((data) => visibleTracks(data.tracks), () => [])),
  )
    .then((lists) => {
      const name = (track) => `${track.title}|${track.artist}`.toLowerCase();
      const have = new Set(queue.flatMap((track) => [track.id, name(track)]));
      const added = [];
      for (let i = 0; added.length < 25 && lists.some((list) => i < list.length); i++)
        for (const list of lists) {
          const track = list[i];
          if (!track || have.has(track.id) || have.has(name(track))) continue;
          have.add(track.id);
          have.add(name(track));
          added.push({ ...track, _recommended: true });
        }
      queue.push(...added.slice(0, 25));
      if (libraryView === "queue") render();
    })
    .catch(() => {})
    .finally(() => {
      extending = null;
    });
  return extending;
}
async function prefetchNext() {
  if (musicSettings.repeat === "one") return;
  const wrap = musicSettings.repeat === "all" && forward(index + 1) === -1;
  if (!wrap && forward(index + 1) === -1) await extendQueue();
  const track = queue[wrap ? forward(0) : forward(index + 1)];
  if (!track || prefetched?.track === track) return;
  try {
    const source = await api(`source/${track._sourceId || track.id}${musicSettings.quality === "saver" ? "?prefer=hls" : ""}`);
    if (source?.url && source.protocol === "progressive") {
      prefetched = { track, source, at: Date.now() };
      const file = await keepSongFile(track, source.url);
      if (file && prefetched?.track === track) prefetched.source = { protocol: "progressive", url: file };
    }
  } catch {}
}
const songFiles = new Map();
function keepSongFile(track, url) {
  if (!track || !url || url.startsWith("blob:")) return Promise.resolve(null);
  if (songFiles.has(track)) return songFiles.get(track).ready;
  const entry = { url: "" };
  entry.ready = fetch(musicUrl(url), { credentials: "same-origin" })
    .then((response) => (response.ok ? response.blob() : Promise.reject(new Error("download failed"))))
    .then((blob) => {
      if (blob.size < 50000) throw new Error("incomplete");
      entry.url = URL.createObjectURL(blob);
      return entry.url;
    })
    .catch(() => {
      songFiles.delete(track);
      return null;
    });
  songFiles.set(track, entry);
  for (const [old, file] of songFiles) {
    if (songFiles.size <= 3) break;
    if (old === queue[index] || old === prefetched?.track || old === track) continue;
    if (file.url) URL.revokeObjectURL(file.url);
    songFiles.delete(old);
  }
  return entry.ready;
}
let rescueTimer = 0;
function rescueFromFile() {
  const file = songFiles.get(queue[index])?.url;
  if (!file || audio.src === file || audio.ended || audio.paused) return;
  const at = audio.currentTime;
  audio.addEventListener("loadedmetadata", () => {
    audio.currentTime = Math.min(at, audio.duration || at);
  }, { once: true });
  audio.src = file;
  audio.play().catch(() => {});
}
for (const name of ["waiting", "stalled"])
  audio.addEventListener(name, () => {
    clearTimeout(rescueTimer);
    const check = () => {
      if (!audio.paused && !audio.seeking && audio.readyState < 3) rescueFromFile();
    };
    if (document.hidden) check();
    else rescueTimer = setTimeout(check, 1500);
  });
audio.addEventListener("playing", () => clearTimeout(rescueTimer));
function takePrefetched(track) {
  const hit = prefetched;
  if (!hit || hit.track !== track || Date.now() - hit.at > 40 * 60000) return null;
  prefetched = null;
  return hit.source;
}
audio.addEventListener("timeupdate", () => {
  if (prefetchArmed && Number.isFinite(audio.duration) && audio.duration - audio.currentTime < 45) {
    prefetchArmed = false;
    prefetchNext();
  }
});
function mediaSession(track) {
  if (!("mediaSession" in navigator) || !track) return;
  try {
    const art = new URL(track.art || track.cover || "/png/logo.png", location.href).href;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: track.album || "",
      artwork: [{ src: art, sizes: "544x544" }],
    });
  } catch {}
}
if ("mediaSession" in navigator) {
  const handlers = {
    play: () => audio.play().catch(() => {}),
    pause: () => audio.pause(),
    previoustrack: () => skipTrack(-1),
    nexttrack: () => skipTrack(1),
    seekto: (details) => {
      if (Number.isFinite(details.seekTime)) audio.currentTime = details.seekTime;
    },
  };
  for (const [name, handler] of Object.entries(handlers)) {
    try { navigator.mediaSession.setActionHandler(name, handler); } catch {}
  }
  audio.addEventListener("timeupdate", () => {
    if (!Number.isFinite(audio.duration) || !audio.duration) return;
    try {
      navigator.mediaSession.setPositionState({
        duration: audio.duration,
        playbackRate: audio.playbackRate,
        position: Math.min(audio.currentTime, audio.duration),
      });
    } catch {}
  });
}
async function startStream(track, generation, retry = 0) {
  streamRequest?.abort();
  streamRequest = new AbortController();
  const signal = streamRequest.signal;
  hlsPlayer?.destroy();
  hlsPlayer = null;
  const resumeTime = retry ? audio.currentTime : 0;
  audio.onerror = null;
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
  try {
    let source = retry ? null : takePrefetched(track);
    if (!source) try {
      source = await api(
        `source/${track._sourceId || track.id}?fresh=${retry ? 1 : 0}&choice=${retry > 1 ? 1 : 0}${musicSettings.quality === "saver" ? "&prefer=hls" : ""}`,
        signal,
      );
    } catch (error) {
      if (error.status !== 403 || signal.aborted || generation !== playbackGeneration) throw error;
      $("playback-status").textContent = "Checking available audio…";
      let alternate;
      try { alternate = await api(`alternate/${track.id}`, signal); }
      catch { throw error; }
      if (!alternate?.source || alternate.id === track.id) throw error;
      track._sourceId = alternate.id;
      source = alternate.source;
    }
    if (signal.aborted || generation !== playbackGeneration) return;
    audio.onerror = handleAudioError;
    if (resumeTime)
      audio.addEventListener(
        "loadedmetadata",
        () => {
          if (
            !signal.aborted &&
            generation === playbackGeneration &&
            Number.isFinite(audio.duration)
          )
            audio.currentTime = Math.min(resumeTime, audio.duration);
        },
        { once: true },
      );
    if (source.protocol === "hls" && window.Hls?.isSupported()) {
      const player = new window.Hls({ enableWorker: true, maxBufferLength: 30, xhrSetup(xhr, url) { xhr.open("GET", musicUrl(url), true); } });
      hlsPlayer = player;
      player.on(window.Hls.Events.ERROR, (_, data) => {
        if (
          !data.fatal ||
          signal.aborted ||
          hlsPlayer !== player ||
          generation !== playbackGeneration
        )
          return;
        if (playbackRetry < 2) startStream(track, generation, ++playbackRetry);
        else {
          player.destroy();
          hlsPlayer = null;
          audio.pause();
          audio.removeAttribute("src");
          audio.load();
          $("playback-status").textContent = "Audio stream stopped. Press play to retry.";
          playbackState();
        }
      });
      player.on(window.Hls.Events.MANIFEST_PARSED, () => {
        if (!signal.aborted && generation === playbackGeneration && hlsPlayer === player)
          audio.play().catch(() => {
            $("playback-status").textContent = "Press play to start listening.";
          });
      });
      player.loadSource(source.url);
      player.attachMedia(audio);
    } else {
      if (source.protocol === "hls" && !audio.canPlayType("application/vnd.apple.mpegurl"))
        throw new Error("Your browser cannot play this audio format.");
      audio.src = source.url;
      if (source.protocol === "progressive" && !source.url.startsWith("blob:")) keepSongFile(track, source.url);
      await audio.play();
    }
  } catch (error) {
    if (!signal.aborted && generation === playbackGeneration) {
      if (error.status !== 403 && playbackRetry < 2) {
        return startStream(track, generation, ++playbackRetry);
      }
      if (signal.aborted || generation !== playbackGeneration) return;
      if (error.status === 403) {
        markUnavailable(track);
      }
      $("playback-status").textContent = error.message || "Playback failed. Try again.";
      $("lyrics-status").textContent = error.status === 403 ? "Audio unavailable for this upload." : "Audio couldn't start. Press play to retry.";
      if (error.status === 403 && musicSettings.autoskip !== false) advance();
      else playbackState();
    }
  }
}
function albumColor() {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 16;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage($("lyrics-background"), 0, 0, 16, 16);
    const pixels = context.getImageData(0, 0, 16, 16).data;
    const color = [0, 0, 0];
    for (let i = 0; i < pixels.length; i += 4)
      for (let c = 0; c < 3; c++) color[c] += pixels[i + c] / 256;
    document.documentElement.style.setProperty(
      "--music-album-color",
      `rgb(${color.map((v) => Math.round(v * 0.45 + 12)).join(" ")})`,
    );
  } catch {
    document.documentElement.style.removeProperty("--music-album-color");
  }
}
$("lyrics-background").addEventListener("load", albumColor);
function refreshPlaying() {
  const current = queue[index]?.id;
  for (const el of document.querySelectorAll("[data-track-id]"))
    el.classList.toggle("is-playing", el.dataset.trackId === current);
  if (["queue", "playlists", "playlist"].includes(libraryView)) renderLibrary();
}
function markUnavailable(track) {
  track.unavailable = true;
  for (const item of results) if (item.id === track.id) item.unavailable = true;
  for (const item of queue) if (item.id === track.id) item.unavailable = true;
  for (const el of document.querySelectorAll(`[data-track-id="${track.id}"]`)) {
    el.classList.add("track-unavailable");
    const button = el.querySelector(".track-play, .row-play");
    if (button) {
      button.disabled = true;
      button.title = "YouTube Music restricts playback of this song";
    }
    const artist = el.querySelector(".track-artist, .row-artist");
    if (artist && !artist.textContent.includes("Unavailable"))
      artist.textContent += ", unavailable";
  }
}
function advance() {
  if (nextPlayable(index + 1) === -1) {
    $("playback-status").textContent =
      "YouTube Music restricts playback of this song. Choose another song.";
    playbackState();
    return;
  }
  if (musicSettings.autoskip !== false) play(index + 1, true);
  else {
    $("playback-status").textContent = "This upload can't play here. Choose another song.";
    playbackState();
  }
}
async function playAlternateFor(position, track) {
  if (track._altTried || altAttempts >= 5) {
    notice("YouTube Music restricts these songs. Choose another song.");
    return;
  }
  track._altTried = true;
  altAttempts++;
  notice("Checking available audio…");
  let alt = null;
  try {
    alt = await api(`alternate/${track.id}`);
  } catch {
    alt = null;
  }
  if (!alt?.id || alt.unavailable || queue[position]?.id !== track.id) {
    if (queue[position]?.id === track.id)
      notice("YouTube Music restricts these songs. Choose another song.");
    return;
  }
  track.unavailable = false;
  track._sourceId = alt.id;
  play(position);
}
function play(nextIndex, auto = false) {
  if (!queue.length) return;
  auto = auto && musicSettings.autoskip !== false;
  if (auto) {
    autoSkips++;
    if (autoSkips > Math.min(queue.length, 3)) {
      autoSkips = 0;
      notice("Nothing playable in this queue right now.");
      playbackState();
      return;
    }
  } else {
    autoSkips = 0;
    altAttempts = 0;
  }
  const wanted = ((nextIndex % queue.length) + queue.length) % queue.length;
  const candidate = nextPlayable(nextIndex);
  if (candidate === -1) {
    autoSkips = 0;
    const stuck = queue[wanted];
    if (!auto && stuck) {
      playAlternateFor(wanted, stuck);
      return;
    }
    notice("YouTube Music restricts these songs. Choose another song.");
    return;
  }
  if (candidate !== wanted) {
    if (auto) notice("Skipped an unavailable upload — playing the next song.");
    else {
      notice("This upload can't play here. Choose another song.");
      return;
    }
  }
  const track = queue[candidate];
  index = candidate;
  historyPending = track;
  if (track._recommended && !queue[candidate - 1]?._recommended) notice("Playing recommended songs");
  trackEvent("play_song", { song_id: track.id, song_title: track.title, song_artist: track.artist });
  document.querySelector(".music-player").hidden = false;
  $("music-player-shield").hidden = false;
  document.body.classList.add("has-music-player");
  for (const prefix of ["now", "lyrics"]) {
    changeArtwork($(`${prefix}-cover`), track.art || track.cover || "/png/logo.png");
    $(`${prefix}-title`).textContent = track.title;
    $(`${prefix}-artist`).textContent = track.artist;
    verified($(`${prefix}-artist`), track.artistVerified);
    const artistNode = $(`${prefix}-artist`);
    artistNode.setAttribute("role", "button");
    artistNode.tabIndex = 0;
    artistNode.setAttribute("aria-label", `Open artist ${track.artist}`);
    artistNode.onclick = async () => {
      try {
        const id = track.artistId || (await api(`tracks/${track.id}`)).artistId;
        if (id) artists.open({ id, title: track.artist });
      } catch (error) { notice(error.message); }
    };
    artistNode.onkeydown = event => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); artistNode.click(); }
    };
  }
  changeArtwork($("lyrics-background"), track.art || track.cover || "/png/logo.png");
  browsing.updateCover(track);
  updateLike();
  $("seek").disabled = true;
  $("seek").value = 0;
  $("playback-status").textContent = "Loading track…";
  playbackRetry = 0;
  const generation = ++playbackGeneration;
  refreshPlaying();
  prepareLyrics();
  audio.onplaying = () => {
    if (generation !== playbackGeneration) return;
    audio.onplaying = null;
    autoSkips = 0;
    fetchLyrics(track);
  };
  prefetchArmed = true;
  mediaSession(track);
  startStream(track, generation);
  volumeState();
}
$("music-search").onsubmit = (event) => {
  event.preventDefault();
  load($("music-query").value.trim(), false, libraryView === "albums");
};
let lastSkipAt = 0;
async function skipTrack(direction) {
  if (performance.now() - lastSkipAt < 500) return;
  lastSkipAt = performance.now();
  if (!queue.length) return;
  const current = queue[index];
  if (direction === 1 && forward(index + 1) === -1 && musicSettings.repeat !== "all") {
    await extendQueue();
    if (queue[index] !== current) return;
    const next = forward(index + 1);
    if (next !== -1) play(next);
    else notice("No recommended songs found right now.");
    return;
  }
  for (let step = 1; step < queue.length; step++) {
    const target = ((index + direction * step) % queue.length + queue.length) % queue.length;
    if (!queue[target].unavailable) { play(target); return; }
  }
  notice("No other playable songs in this queue.");
}
$("previous").onclick = () => skipTrack(-1);
$("next").onclick = () => skipTrack(1);
$("play-pause").onclick = () => {
  if (audio.paused && (audio.error || (!audio.currentSrc && !hlsPlayer))) {
    if (queue[index]) {
      playbackRetry = 0;
      startStream(queue[index], ++playbackGeneration, 1);
    }
  } else if (audio.paused)
    audio.play().catch(() => {
      $("playback-status").textContent = "Playback couldn’t start.";
    });
  else audio.pause();
};
$("open-lyrics").onclick = () => setView($("lyrics-view").hidden);
$("open-cover").onclick = () => setView(true);
$("close-lyrics").onclick = () => setView(false);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !$("lyrics-view").hidden) setView(false);
});
function volumeState() {
  icon($("mute"), audio.volume === 0 ? "muted" : "volume");
  const label = audio.volume === 0 ? "Unmute" : "Mute";
  $("mute").setAttribute("aria-label", label);
  $("mute").title = label;
  $("volume").value = audio.volume;
}
$("volume").oninput = () => {
  audio.volume = Number($("volume").value);
  if (audio.volume) lastVolume = audio.volume;
  volumeState();
};
$("mute").onclick = () => {
  audio.volume = audio.volume === 0 ? lastVolume : 0;
  volumeState();
};
audio.onloadedmetadata = () => {
  $("seek").max = Number.isFinite(audio.duration) ? audio.duration : 1;
  $("seek").disabled = !Number.isFinite(audio.duration);
};
audio.ontimeupdate = () => {
  $("seek").value = audio.currentTime;
  updateLyrics();
};
audio.onseeked = () => {
  updateLyrics();
};
audio.addEventListener("playing", () => {
  try { library.remember(queue[index]); } catch {}
  if (historyPending && historyPending === queue[index]) {
    try { library.logPlay(historyPending); } catch {}
    historyPending = null;
    if (libraryView === "history") render();
  }
});
audio.onplay = () => {
  altAttempts = 0;
  playbackState();
  $("playback-status").textContent = "";
  startClock();
};
audio.onpause = () => {
  playbackState();
  pauseClock();
  updateLyrics();
};
function handleAudioError() {
  if (queue[index] && playbackRetry < 2)
    startStream(queue[index], playbackGeneration, ++playbackRetry);
  else if (queue[index]) advance();
  else $("playback-status").textContent = "Playback failed. Press play to retry.";
  playbackState();
}
audio.onerror = handleAudioError;
audio.onended = () => {
  if (musicSettings.repeat === "one") {
    audio.currentTime = 0;
    audio.play().catch(() => play(index));
    return;
  }
  if (musicSettings.repeat === "all" && forward(index + 1) === -1 && forward(0) !== -1) {
    play(forward(0), true);
    return;
  }
  const next = forward(index + 1);
  if (next !== -1) {
    play(next, true);
    return;
  }
  extendQueue().then(() => {
    const after = forward(index + 1);
    if (after !== -1) play(after, true);
    else playbackState();
  });
};
$("playlist-dialog").addEventListener("click", (event) => {
  if (event.target === $("playlist-dialog")) $("playlist-dialog").close();
});
const { openTrack, openAlbum, closeDetail, songRows, detailHeader, textNode } = createDetails({
  getPlaybackTracks: track => {
    const saved = library.get();
    const context = libraryView === "liked" ? saved.likes
      : libraryView === "playlist" ? saved.playlists.find(item => item.id === selectedPlaylist)?.tracks || []
      : visibleTracks(results);
    return context.some(item => item.id === track.id) ? context.slice() : [track];
  },
  $,
  action,
  fallback,
  beforeOpen: () => {
    if (!$("lyrics-view").hidden) setView(false, true);
  },
  saveLike,
  library,
  api,
  fmtDur,
  fmtPlays,
  openArtist: (artist) => artists.open(artist),
  refreshPlaying,
  parseLyrics,
  openPlaylistDialog,
  addQueue,
  start: (tracks, position) => {
    queue = tracks.slice();
    play(position);
  },
});
const { setView, prepareLyrics, fetchLyrics, updateLyrics, startClock, pauseClock } = createLyrics({
  $,
  audio,
  reduced,
  api,
  getTrack: () => queue[index],
});
setupSeek($("seek"), fmtDur);
const browsing = setupBrowse({ setView, closeDetail, notice });
const artists = createArtists({
  fallback,
  $,
  api,
  action,
  detailHeader,
  textNode,
  songRows,
  openAlbum,
  closeDetail,
  start: (tracks, position) => {
    queue = tracks.slice();
    play(position);
  },
});
const artistResults = document.createElement("section");
artistResults.id = "artist-results";
$("music-results").before(artistResults);
{  
  const migration = library.migrate(api).catch(() => false);
  Promise.race([migration, new Promise((resolve) => setTimeout(resolve, 6000, "slow"))]).then((result) => {
    load();
    if (result === "slow")
      migration.then((changed) => {
        if (changed && libraryView !== "discover") renderLibrary();
      });
  });
}
document.addEventListener("music:playlist-change", ({ detail }) => {
  if (libraryView !== "playlist" || detail?.playlist !== selectedPlaylist) return;
  const list = library.get().playlists.find(item => item.id === selectedPlaylist);
  if (!list) return;
  $("track-count").textContent = String(list.tracks.length);
  $("music-status").textContent = "";
  const scroll = $("music-scroll");
  const suggestions = document.querySelector(".playlist-suggestions");
  const top = suggestions?.getBoundingClientRect().top;
  const mount = document.createElement("div");
  renderCards({
    $: id => id === "music-results" ? mount : $(id),
    list: [detail.track], library, fallback, action, openTrack, saveLike,
    openPlaylistDialog, addQueue, libraryView, selectedPlaylist, changeLibrary,
    start() {
      queue = library.get().playlists.find(item => item.id === selectedPlaylist)?.tracks || [];
      play(queue.findIndex(track => track.id === detail.track.id));
    },
  });
  $("music-results").append(...mount.childNodes);
  if (suggestions && Number.isFinite(top)) {
    scroll.scrollTop += suggestions.getBoundingClientRect().top - top;
  }
});
{
  let idleTimer = 0;
  const wake = () => {
    document.body.classList.remove("player-idle");
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      const player = document.querySelector(".music-player");
      if (document.querySelector("dialog[open]") || player?.contains(document.activeElement) || player?.matches(":hover")) return wake();
      document.body.classList.add("player-idle");
    }, 10000);
  };
  for (const name of ["pointermove", "pointerdown", "touchstart", "keydown", "wheel", "scroll"])
    addEventListener(name, wake, { passive: true, capture: true });
  wake();
}
