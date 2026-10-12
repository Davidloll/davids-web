import { musicData, musicStored } from "/js/music/proxy.js";
export function createMusicLibrary(storage) {
  const key = "truffledMusicLibrary";
  let state = { likes: [], playlists: [], recent: [] };
  function refreshTrack(track) {
    const { unavailable, _recommended, _sourceId, _altTried, ...saved } = track;
    return saved;
  }
  try {
    const saved = musicStored(JSON.parse(storage.getItem(key) || "null"));
    if (saved && Array.isArray(saved.likes) && Array.isArray(saved.playlists)) {
      state = {
        recent: (Array.isArray(saved.recent) ? saved.recent : []).filter(track => track?.id && track.title).slice(0, 40).map(refreshTrack),
        likes: saved.likes.filter((track) => track?.id && track.title).map(refreshTrack),
        playlists: saved.playlists
          .filter((list) => list?.id && typeof list.name === "string" && Array.isArray(list.tracks))
          .map((list) => ({
            ...list,
            tracks: list.tracks.filter((track) => track?.id && track.title).map(refreshTrack),
          })),
      };
    }
  } catch {}
  const commit = (next) => {
    next = musicStored(next);
    storage.setItem(key, JSON.stringify(next));
    state = next;
  };
  const legacy = (track) => !/^[\w-]{11}$/.test(String(track?.id));
  async function migrate(api) {
    const all = [...state.recent, ...state.likes, ...state.playlists.flatMap((list) => list.tracks)];
    const pending = [...new Map(all.filter(legacy).map((track) => [String(track.id), track])).values()];
    if (!pending.length) return false;
    const found = new Map();
    const lookup = async (track) => {
      const q = `${track.title} ${track.artist || ""}`.trim().slice(0, 120);
      try {
        const { tracks } = await api(`search?q=${encodeURIComponent(q)}`);
        const norm = (value) =>
          String(value || "").toLowerCase().replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
            .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
        const title = norm(track.title);
        found.set(String(track.id), tracks.find((item) => {
          const other = norm(item.title);
          return !item.unavailable && other && title && (other.includes(title) || title.includes(other));
        }) || null);
      } catch {} 
    };
    for (let i = 0; i < Math.min(pending.length, 60); i += 3)
      await Promise.all(pending.slice(i, i + 3).map(lookup));
    if (!found.size) return false;
    const swap = (tracks) => {
      const seen = new Set();
      return tracks
        .map((track) => (found.has(String(track.id)) ? found.get(String(track.id)) : track))
        .filter((track) => track && !seen.has(track.id) && seen.add(track.id))
        .map(refreshTrack);
    };
    commit({
      recent: swap(state.recent),
      likes: swap(state.likes),
      playlists: state.playlists.map((list) => ({ ...list, tracks: swap(list.tracks) })),
    });
    return true;
  }
  const historyKey = "truffledMusicHistory";
  let history = [];
  try {
    const saved = musicStored(JSON.parse(storage.getItem(historyKey) || "[]"));
    if (Array.isArray(saved))
      history = saved
        .filter((entry) => entry?.track?.id && entry.track.title && Number.isFinite(entry.at))
        .slice(0, 500);
  } catch {}
  const saveHistory = (next) => {
    next = musicStored(next).slice(0, 500);
    storage.setItem(historyKey, JSON.stringify(next));
    history = next;
  };
  const albumsKey = "truffledMusicAlbums";
  let savedAlbums = [];
  try {
    const saved = musicStored(JSON.parse(storage.getItem(albumsKey) || "[]"));
    if (Array.isArray(saved)) savedAlbums = saved.filter((album) => album?.id && album.title);
  } catch {}
  const saveAlbums = (next) => {
    next = musicStored(next);
    storage.setItem(albumsKey, JSON.stringify(next));
    savedAlbums = next;
  };
  return {
    migrate,
    albums: () => musicData(structuredClone(savedAlbums)),
    isAlbumSaved: (id) => savedAlbums.some((album) => album.id === id),
    toggleAlbum(album) {
      if (!album?.id) return false;
      if (savedAlbums.some((item) => item.id === album.id)) {
        saveAlbums(savedAlbums.filter((item) => item.id !== album.id));
        return false;
      }
      const { id, title, artist, artistId, cover, year, type } = album;
      saveAlbums([{ id, title, artist: artist || "", artistId: artistId || "", cover: cover || "", year: year || "", type: type || "album", savedAt: Date.now() }, ...savedAlbums]);
      return true;
    },
    get: () => musicData(structuredClone(state)),
    history: () => musicData(structuredClone(history)),
    logPlay(track) {
      if (!track?.id || legacy(track)) return;
      saveHistory([{ track: refreshTrack(track), at: Date.now() }, ...history]);
    },
    forgetPlay(at) {
      saveHistory(history.filter((entry) => entry.at !== at));
    },
    clearHistory() {
      saveHistory([]);
    },
    remember(track) {
      if (!track?.id || String(state.recent[0]?.id) === String(track.id)) return;
      commit({ ...state, recent: [refreshTrack(track), ...state.recent.filter(item => String(item.id) !== String(track.id))].slice(0, 40) });
    },
    isLiked: (id) => state.likes.some((track) => track.id === id),
    toggleLike(track) {
      const liked = this.isLiked(track.id);
      commit({
        ...state,
        likes: liked ? state.likes.filter((item) => item.id !== track.id) : [...state.likes, refreshTrack(track)],
      });
      return !liked;
    },
    create(name, description = "") {
      const playlist = {
        id: crypto.randomUUID(),
        name: name.trim().slice(0, 80) || "New playlist",
        description: description.trim().slice(0, 300),
        tracks: [],
      };
      commit({ ...state, playlists: [...state.playlists, playlist] });
      return playlist.id;
    },
    update(id, name, description) {
      commit({
        ...state,
        playlists: state.playlists.map((list) =>
          list.id === id
            ? {
                ...list,
                name: name.trim().slice(0, 80) || list.name,
                description: description.trim().slice(0, 300),
              }
            : list,
        ),
      });
    },
    delete(id) {
      commit({ ...state, playlists: state.playlists.filter((list) => list.id !== id) });
    },
    add(id, track) {
      const list = state.playlists.find((list) => list.id === id);
      if (!list || list.tracks.some((item) => item.id === track.id)) return false;
      commit({
        ...state,
        playlists: state.playlists.map((item) =>
          item.id === id ? { ...item, tracks: [...item.tracks, refreshTrack(track)] } : item,
        ),
      });
      return true;
    },
    remove(id, trackId) {
      commit({
        ...state,
        playlists: state.playlists.map((list) =>
          list.id === id
            ? { ...list, tracks: list.tracks.filter((track) => track.id !== trackId) }
            : list,
        ),
      });
    },
    writePopout(data) {
      try {
        storage.setItem("truffledMusicPopout", JSON.stringify(musicStored(data)));
        return true;
      } catch {
        return false;
      }
    },
    readPopout() {
      try {
        const data = JSON.parse(storage.getItem("truffledMusicPopout") || "null");
        storage.removeItem("truffledMusicPopout");
        if (
          !data ||
          !Array.isArray(data.queue) ||
          !data.queue.every((track) => track?.id && track.title) ||
          !Number.isInteger(data.index) ||
          data.index < 0 ||
          data.index >= data.queue.length
        )
          return null;
        return {
          queue: musicData(data.queue),
          index: data.index,
          time: Number.isFinite(data.time) && data.time > 0 ? data.time : 0,
          playing: data.playing !== false,
        };
      } catch {
        return null;
      }
    },
  };
}
