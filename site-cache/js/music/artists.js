import { avatar, verified } from "/js/music/artist-name.js";
export function createArtists({
  fallback,
  $,
  api,
  action,
  detailHeader,
  textNode,
  songRows,
  openAlbum,
  start,
  closeDetail,
}) {
  let request;
  async function search(query) {
    request?.abort();
    request = new AbortController();
    const signal = request.signal;
    const mount = $("artist-results");
    mount.replaceChildren();
    if (!query) return;
    try {
      const data = await api(`artists/search?q=${encodeURIComponent(query)}`, signal);
      if (signal.aborted) return;
      const shown = data.artists.slice(0, 5);
      const rows = new Map();
      mount.append(
        ...shown.map((item) => {
          const button = document.createElement("button");
          button.className = "artist-result";
          button.setAttribute("aria-label", `Open artist ${item.title}`);
          const name = textNode("strong", item.title);
          const kind = textNode("span", item.audience || "Artist", "artist-kind");
          verified(name, item.verified);
          button.append(avatar(item), name, kind);
          button.onclick = () => open(item);
          rows.set(item.id, { item, name });
          return button;
        }),
      );
      const pending = shown.filter((item) => !item.verified).map((item) => item.id);
      if (!pending.length) return;
      const { official } = await api(`artists/badges?ids=${pending.join(",")}`, signal);
      if (signal.aborted) return;
      for (const id of official) {
        const row = rows.get(id);
        if (!row) continue;
        row.item.verified = true;
        verified(row.name, true);
      }
    } catch {
      if (!signal.aborted && !mount.childElementCount) mount.replaceChildren();
    }
  }
  const releaseLabel = { album: "album", single: "single", ep: "ep" };
  function releaseTile(album, artist) {
    const tile = document.createElement("button");
    tile.className = "release";
    tile.setAttribute("aria-label", `Open ${album.title}`);
    const image = document.createElement("img");
    image.src = album.cover || artist.cover || "/png/logo.png";
    image.alt = "";
    image.loading = "lazy";
    fallback(image);
    tile.append(
      image,
      textNode("strong", album.title),
      textNode("span", [album.year, releaseLabel[album.type] || "album"].filter(Boolean).join(", ")),
    );
    tile.onclick = () => openAlbum(album);
    return tile;
  }
  async function open(artist) {
    request?.abort();
    const { mount, info, signal } = detailHeader(artist, "Artist");
    const sections = {
      popular: document.createElement("section"),
      discography: document.createElement("section"),
      about: document.createElement("section"),
    };
    for (const [key, section] of Object.entries(sections)) section.className = `artist-section artist-section-${key}`;
    let tracks = [];
    const play = action("play", `Play ${artist.title}`, () => start(tracks, 0));
    play.classList.add("artist-play");
    play.disabled = true;
    const controls = document.createElement("div");
    controls.className = "artist-controls";
    const tabs = document.createElement("nav");
    tabs.className = "artist-tabs";
    tabs.setAttribute("aria-label", "Artist sections");
    for (const [label, key] of [["Popular", "popular"], ["Discography", "discography"], ["About", "about"]]) {
      const button = document.createElement("button");
      button.textContent = label;
      button.onclick = () =>
        sections[key].scrollIntoView({
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
          block: "start",
        });
      tabs.append(button);
    }
    controls.append(play, tabs);
    mount.append(controls, sections.popular, sections.discography, sections.about);
    let visibleCount = 5;
    const songs = document.createElement("div");
    const more = document.createElement("button");
    more.className = "artist-see-more";
    more.hidden = true;
    sections.popular.append(textNode("h2", "Popular"), songs, more);
    function renderPopular() {
      songs.replaceChildren(songRows(tracks.slice(0, visibleCount), tracks, true, { plays: true, numbers: true }));
      more.hidden = tracks.length <= 5;
      more.textContent = visibleCount >= tracks.length ? "Show less" : "Show more";
    }
    more.onclick = () => {
      if (!tracks.length) return loadPopular();
      visibleCount = visibleCount >= tracks.length ? 5 : Math.min(tracks.length, visibleCount + 10);
      renderPopular();
    };
    async function loadPopular() {
      more.disabled = true;
      try {
        const data = await api(`artists/${artist.id}/popular`, signal);
        if (signal.aborted) return;
        tracks = data.tracks.filter((track, index, all) => all.findIndex((item) => item.id === track.id) === index);
        play.disabled = !tracks.some((track) => !track.unavailable);
        if (tracks.length) renderPopular();
        else songs.replaceChildren(textNode("p", "No popular songs listed for this artist.", "artist-empty"));
      } catch {
        if (signal.aborted) return;
        more.hidden = false;
        more.textContent = "Retry loading songs";
      } finally {
        more.disabled = false;
      }
    }
    async function loadDiscography() {
      const heading = document.createElement("div");
      heading.className = "artist-section-heading";
      const filters = document.createElement("div");
      filters.className = "release-filters";
      filters.setAttribute("role", "group");
      filters.setAttribute("aria-label", "Release type");
      heading.append(textNode("h2", "Discography"), filters);
      const grid = document.createElement("div");
      grid.className = "artist-releases";
      sections.discography.append(heading, grid);
      let albums = [];
      try {
        albums = (await api(`artists/${artist.id}/albums`, signal)).albums;
      } catch {
        if (!signal.aborted) grid.append(textNode("p", "Releases couldn’t load.", "artist-empty"));
        return;
      }
      if (signal.aborted) return;
      if (!albums.length) {
        grid.append(textNode("p", "No releases listed for this artist.", "artist-empty"));
        return;
      }
      const groups = [
        ["all", "All", () => true],
        ["album", "Albums", (album) => album.type === "album"],
        ["single", "Singles & EPs", (album) => album.type !== "album"],
      ].filter(([, , test], index) => index === 0 || albums.some(test));
      const more = document.createElement("button");
      more.className = "artist-see-more";
      sections.discography.append(more);
      let group = "all", limit = 10;
      function show() {
        const test = groups.find(([id]) => id === group)[2];
        const list = albums.filter(test);
        grid.replaceChildren(...list.slice(0, limit).map((album) => releaseTile(album, artist)));
        more.hidden = list.length <= 10;
        more.textContent = limit >= list.length ? "Show less" : "Show more";
        for (const button of filters.children) button.setAttribute("aria-pressed", String(button.dataset.group === group));
      }
      more.onclick = () => {
        const total = albums.filter(groups.find(([id]) => id === group)[2]).length;
        limit = limit >= total ? 10 : limit + 20;
        show();
      };
      if (groups.length > 2)
        for (const [key, label] of groups) {
          const button = document.createElement("button");
          button.dataset.group = key;
          button.textContent = label;
          button.onclick = () => {
            group = key;
            limit = 10;
            show();
          };
          filters.append(button);
        }
      show();
    }
    function renderAbout(data) {
      const about = sections.about;
      about.replaceChildren(textNode("h2", "About"));
      const bio = (data.description || "").trim();
      if (bio) about.append(textNode("p", bio, "artist-about"));
      const stats = [
        data.views && `${data.views} views`,
        data.joined && `Joined ${data.joined}`,
        data.country,
      ].filter(Boolean);
      if (stats.length) about.append(textNode("p", stats.join(", "), "artist-stats"));
      const links = [...(data.links || [])];
      if (data.channelUrl) links.push({ title: "YouTube", url: data.channelUrl, host: data.handle || "youtube.com", icon: "youtube" });
      if (links.length) {
        const list = document.createElement("ul");
        list.className = "artist-links";
        for (const link of links) {
          const item = document.createElement("li");
          const anchor = document.createElement("a");
          anchor.href = link.url;
          anchor.target = "_blank";
          anchor.rel = "noopener noreferrer";
          anchor.title = link.host;
          const mark = document.createElement("span");
          mark.className = "artist-link-icon";
          mark.setAttribute("aria-hidden", "true");
          if (link.icon) mark.style.setProperty("--icon", `url("/api/music/icons/${link.icon}.svg")`);
          else mark.classList.add("is-generic");
          anchor.append(mark, textNode("span", link.title, "artist-link-name"));
          item.append(anchor);
          list.append(item);
        }
        about.append(list);
      }
      if (!bio && !stats.length && !links.length)
        about.append(textNode("p", "No bio from this artist yet.", "artist-empty"));
    }
    async function loadInfo() {
      const data = await api(`artists/${artist.id}`, signal);
      if (signal.aborted) return;
      Object.assign(artist, data);
      info.parentElement.firstElementChild.replaceWith(avatar(data));
      const name = info.querySelector("h1");
      name.textContent = data.title;
      verified(name, data.verified);
      info.querySelector("p").textContent = data.verified ? "Official artist" : "Artist";
      const subscribers = data.subscribers && `${data.subscribers} subscribers`;
      const audience = data.audience || artist.audience || "";
      const meta = [
        data.handle,
        subscribers,
        subscribers && /subscriber/i.test(audience) ? "" : audience,
      ].filter(Boolean);
      info.querySelector(".artist-meta")?.remove();
      if (meta.length) info.append(textNode("p", meta.join(", "), "artist-meta"));
      renderAbout(data);
    }
    sections.about.append(textNode("h2", "About"));
    mount.onscroll = null;
    await Promise.allSettled([loadPopular(), loadDiscography(), loadInfo()]);
  }
  return { search, open };
}
