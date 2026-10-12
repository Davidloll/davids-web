export function createSuggestions({ api, library, action, notice }) {
  let request;
  const rounds = new Map();
  return function suggestions(list) {
    request?.abort();
    request = new AbortController();
    const signal = request.signal;
    let pool = [], busy = false;
    const section = document.createElement("section");
    section.className = "playlist-suggestions";
    const heading = document.createElement("h2");
    heading.textContent = "recommended songs";
    const rows = document.createElement("div");
    const more = document.createElement("button");
    more.textContent = "find more";
    section.append(heading, rows, more);
    function tracks() {
      return library.get().playlists.find(item => item.id === list.id)?.tracks || [];
    }
    function fill() {
      const saved = new Set(tracks().map(track => track.id));
      rows.querySelectorAll("[data-track-id]").forEach(row => saved.add(row.dataset.trackId));
      if (!rows.childElementCount) rows.replaceChildren();
      while (rows.childElementCount < 8 && pool.length) {
        const track = pool.shift();
        if (saved.has(track.id)) continue;
        saved.add(track.id);
        const row = document.createElement("div");
        row.className = "suggestion-row";
        row.dataset.trackId = track.id;
        const image = document.createElement("img");
        image.src = track.cover || "/png/logo.png";
        image.alt = "";
        const info = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = track.title;
        const artist = document.createElement("span");
        artist.textContent = track.artist;
        info.append(title, artist);
        const add = action("plus", `add ${track.title} to playlist`, () => {
          try {
            const added = library.add(list.id, track);
            row.remove();
            fill();
            if (!pool.length && rows.childElementCount < 8) load(true);
            if (added === false) return;
            notice("added to playlist");
            document.dispatchEvent(new CustomEvent("music:playlist-change", {
              detail: { playlist: list.id, track },
            }));
          } catch { notice("couldn’t save this song."); }
        });
        add.className = "suggestion-add";
        row.append(image, info, add);
        rows.append(row);
      }
    }
    async function load(append = false) {
      if (busy || signal.aborted) return;
      busy = true;
      more.disabled = true;
      const savedTracks = tracks();
      const round = rounds.get(list.id) || 0;
      const seed = savedTracks.length ? savedTracks[round % savedTracks.length] : null;
      const page = Math.floor(round / Math.max(1, savedTracks.length));
      try {
        let data, cursor = "";
        for (let i = 0; i <= Math.min(page, 5); i++) {
          const params = new URLSearchParams();
          if (seed) params.set("seed", seed.id);
          if (cursor) params.set("cursor", cursor);
          data = await api(`${seed ? "recommendations" : "chart"}?${params}`, signal);
          cursor = data.nextCursor || "";
          if (!cursor) break;
        }
        if (signal.aborted) return;
        const excluded = new Set(tracks().map(track => track.id));
        if (append) rows.querySelectorAll("[data-track-id]").forEach(row => excluded.add(row.dataset.trackId));
        const score = track => Number(Boolean(seed?.genre && track.genre === seed.genre)) * 2
          + Number(Boolean(seed && track.artist === seed.artist));
        const choices = data.tracks.filter(track => !excluded.has(track.id) && !track.unavailable)
          .sort((a, b) => score(b) - score(a));
        const offset = choices.length > 8 ? (page * 8) % choices.length : 0;
        pool = [...choices.slice(offset), ...choices.slice(0, offset)];
        if (!append) rows.replaceChildren();
        fill();
        if (!rows.childElementCount) rows.textContent = "no new matches. try find more.";
        rounds.set(list.id, round + 1);
      } catch {
        if (!signal.aborted) notice("suggestions couldn’t load. try find more.");
      } finally { busy = false; more.disabled = false; }
    }
    more.onclick = () => load();
    load();
    return section;
  };
}
