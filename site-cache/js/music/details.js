import { visibleTracks } from "/js/music/api.js";
import { avatar, verified } from "/js/music/artist-name.js";
import { trackView } from "/js/music/analytics.js";
export function createDetails({
  $,
  action,
  fallback,
  saveLike,
  library,
  api,
  fmtDur,
  fmtPlays,
  openArtist,
  refreshPlaying,
  openPlaylistDialog,
  addQueue,
  start,
  getPlaybackTracks,
  beforeOpen,
}) {
  let detailRequest;
  function textNode(tag, text, className = "") {
    const node = document.createElement(tag);
    node.textContent = text;
    node.className = className;
    return node;
  }
  function closeDetail() {
    detailRequest?.abort();
    $("music-detail").hidden = true;
    $("music-scroll").hidden = false;
  }
  function detailHeader(item, type) {
    trackView(`${item.title} (${type})`, `/music/${type.toLowerCase()}/${item.id}`);
    const animate = !$("lyrics-view").hidden && !matchMedia("(prefers-reduced-motion: reduce)").matches;
    beforeOpen();
    $("music-detail").onscroll = null;
    detailRequest?.abort();
    detailRequest = new AbortController();
    const mount = $("music-detail");
    mount.classList.toggle("artist-page", type === "Artist");
    mount.scrollTop = 0;
    mount.replaceChildren();
    mount.hidden = false;
    $("music-scroll").hidden = true;
    const back = action("back", "Back to browsing", closeDetail);
    const header = document.createElement("header");
    header.className = type === "Artist" ? "detail-header artist-header" : "detail-header";
    const image = type === "Artist" ? avatar(item) : document.createElement("img");
    if (type !== "Artist") {
      image.src = item.art || item.cover || "/png/logo.png";
      image.alt = "";
      fallback(image);
    }
    const info = document.createElement("div");
    info.append(textNode("p", type), textNode("h1", item.title), textNode("p", item.artist));
    if (type !== "Artist") artistLink(info.querySelector("p:last-child"), item);
    header.append(image, info);
    mount.append(back, header);
    if (animate)
      mount.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
    return { mount, info, signal: detailRequest.signal };
  }
  function artistLink(node, item) {
    const button = document.createElement("button");
    button.className = "detail-artist-link";
    button.textContent = item.artist;
    button.setAttribute("aria-label", `Open artist ${item.artist}`);
    verified(button, item.artistVerified);
    button.onclick = async () => {
      let id = item.artistId;
      if (!id) {
        const data = await api(`tracks/${item.id}`);
        id = data.artistId;
      }
      if (id) openArtist({ id, title: item.artist });
    };
    node.replaceChildren(button);
  }
  function detailLike(track) {
    const button = action("heart", `Like ${track.title}`, () => {
      saveLike(track);
      button.setAttribute("aria-pressed", String(library.isLiked(track.id)));
    });
    button.setAttribute("aria-pressed", String(library.isLiked(track.id)));
    return button;
  }
  function songRows(tracks, playback = tracks, covers = false, options = {}) {
    const list = document.createElement("div");
    list.className = "song-rows";
    tracks.forEach((track) => {
      const row = document.createElement("div");
      row.className = "song-row";
      row.dataset.trackId = track.id;
      if (covers) row.classList.add("has-cover");
      if (options.plays) row.classList.add("has-plays");
      const playButton = action("play", `Play ${track.title} by ${track.artist}`, () => {
        start(
          playback,
          playback.findIndex((item) => item.id === track.id),
        );
      });
      playButton.className = "row-play";
      playButton.disabled = Boolean(track.unavailable);
      const title = document.createElement("button");
      title.className = "row-title";
      title.setAttribute("aria-label", `Details for ${track.title}`);
      title.append(textNode("strong", track.title), textNode("span", track.artist, "row-artist"));
      verified(title.lastElementChild, track.artistVerified);
      title.onclick = () => openTrack(track);
      row.append(
        textNode(
          "span",
          String(playback.findIndex((item) => item.id === track.id) + 1),
          "row-number",
        ),
        playButton,
        title,
        textNode("span", fmtDur(track.duration), "row-duration"),
        detailLike(track),
        action("playlist", `Add ${track.title} to playlist`, () => openPlaylistDialog(track)),
      );
      if (covers) {
        const image = document.createElement("img");
        image.src = track.cover || "/png/logo.png";
        image.alt = "";
        image.loading = "lazy";
        image.className = "row-cover";
        fallback(image);
        if (options.numbers) row.insertBefore(image, title);
        else row.firstChild.replaceWith(image);
      }
      if (options.plays) {
        const plays = Number(track.plays || 0);
        const short = plays ? new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(plays) : "";
        const count = textNode("span", short && `${short} plays`, "row-plays");
        if (short) count.setAttribute("aria-label", `${short} plays`);
        row.insertBefore(count, row.querySelector(".row-duration"));
      }
      list.append(row);
    });
    return list;
  }
  async function openAlbum(album) {
    const { mount, info, signal } = detailHeader(album, "Album");
    const loading = textNode("p", "Loading album…");
    mount.append(loading);
    try {
      const data = await api(`albums/${album.id}`, signal);
      if (signal.aborted) return;
      loading.remove();
      const songs = visibleTracks(data.tracks);
      info.append(
        textNode(
          "p",
          `${songs.length} songs, ${fmtDur(songs.reduce((total, track) => total + track.duration, 0))}`,
        ),
      );
      const playAll = action("play", "Play album", () => {
        start(songs, 0);
      });
      playAll.disabled = !songs.length;
      const record = {
        ...album,
        title: data.title || album.title,
        artist: data.artist || album.artist,
        cover: album.cover || songs[0]?.cover || "",
      };
      const save = action("heart", "Save album", () => {
        const saved = library.toggleAlbum(record);
        save.setAttribute("aria-pressed", String(saved));
        save.setAttribute("aria-label", saved ? "Remove album from liked" : "Save album");
        save.title = save.getAttribute("aria-label");
        document.dispatchEvent(new CustomEvent("music:albums-change"));
      });
      const saved = library.isAlbumSaved(album.id);
      save.setAttribute("aria-pressed", String(saved));
      save.setAttribute("aria-label", saved ? "Remove album from liked" : "Save album");
      save.title = save.getAttribute("aria-label");
      const controls = document.createElement("div");
      controls.className = "detail-controls album-controls";
      controls.append(playAll, save);
      mount.append(controls, songRows(songs));
      refreshPlaying();
    } catch (error) {
      if (!signal.aborted) loading.textContent = error.message;
    }
  }
  async function openTrack(track) {
    let playback = getPlaybackTracks(track);
    const { mount, info, signal } = detailHeader(track, "Song");
    const controls = document.createElement("div");
    controls.className = "detail-controls";
    controls.dataset.trackId = track.id;
    controls.append(
      playSong(track, () => playback),
      detailLike(track),
      action("playlist", "Add to playlist", () => openPlaylistDialog(track)),
      action("queue", "Add to queue", () => addQueue(track)),
    );
    mount.append(controls);
    const description = textNode("p", "", "detail-description");
    mount.append(description);
    const related = document.createElement("section");
    mount.append(related);
    await Promise.allSettled([
      api(`tracks/${track.id}`, signal).then((data) => {
        if (signal.aborted) return;
        info.append(
          textNode(
            "p",
            [
              data.album,
              data.released?.slice(0, 4),
              fmtDur(data.duration),
              data.plays ? `${fmtPlays(data.plays)} plays` : "",
            ]
              .filter(Boolean)
              .join(", "),
          ),
        );
        description.textContent = data.description;
        track.unavailable ||= Boolean(data.unavailable);
        const button = controls.querySelector("button");
        button.disabled = Boolean(track.unavailable);
        if (data.unavailable)
          description.prepend(textNode("p", "YouTube Music restricts playback of this song."));
      }),
      api(`recommendations?seed=${track.id}`, signal).then((data) => {
        if (signal.aborted) return;
        if (playback.length < 2) playback = [track, ...visibleTracks(data.tracks).filter(item => item.id !== track.id)];
        const recs = visibleTracks(data.tracks).slice(0, 8);
        if (signal.aborted || !recs.length) return;
        related.append(
          textNode("h2", "Recommended"),
          textNode("p", "Based on this song"),
          songRows(recs, visibleTracks(data.tracks), true),
        );
      }),
    ]);
  }
  function playSong(track, getPlayback) {
    const button = action("play", `Play ${track.title}`, () => {
      const tracks = getPlayback();
      start(tracks, tracks.findIndex(item => item.id === track.id));
    });
    button.className = "row-play";
    button.disabled = Boolean(track.unavailable);
    if (track.unavailable) button.title = "YouTube Music restricts playback of this song";
    return button;
  }
  return { openTrack, openAlbum, closeDetail, songRows, detailHeader, textNode };
}
