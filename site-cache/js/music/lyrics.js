import { parseLyrics, activeLine, wordProgress } from "/js/music-lyrics.js";
import { trackView } from "/js/music/analytics.js";
const LYRIC_HOSTS = new Set([
  "lrc.red",
  "lyrics-api.binimum.org",
  "lyricsplus.binimum.org",
  "lyricsplus-seven.vercel.app",
  "lyricsplus.prjktla.workers.dev",
  "lyrics-plus-backend.vercel.app",
  "lrclib.net",
  "unison.boidu.dev",
  "fetch-genius.samidy.workers.dev",
]);
const pageFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = (input, init) => {
  try {
    const url = new URL(typeof input === "string" ? input : input.url, location.href);
    if (LYRIC_HOSTS.has(url.hostname)) {
      const { headers, ...rest } = init || {};
      return pageFetch(`/api/music/lyrics-relay?url=${encodeURIComponent(url.href)}`, { ...rest, credentials: "same-origin" });
    }
  } catch {}
  return pageFetch(input, init);
};
let bare;
function bareSheet() {
  if (!bare) {
    bare = new CSSStyleSheet();
    bare.replaceSync(".lyrics-header, .lyrics-footer, .download-controls, .header-controls { display: none !important; }");
  }
  return bare;
}
let amReady;
function loadAmLyrics() {
  amReady ||= import("/api/music/am-lyrics.js").then(() => customElements.whenDefined("am-lyrics"));
  return amReady;
}
export function createLyrics({ $, audio, reduced, api, getTrack }) {
  let am = null;
  const hiddenKey = "truffledMusicLyricsHidden";
  let lyricsHidden = false;
  try { lyricsHidden = localStorage.getItem(hiddenKey) === "1"; } catch {}
  const cover = $("lyrics-cover");
  function applyHidden() {
    $("lyrics-view").classList.toggle("lyrics-collapsed", lyricsHidden);
    cover.setAttribute("aria-pressed", String(lyricsHidden));
    cover.title = lyricsHidden ? "Show lyrics" : "Hide lyrics";
  }
  let animating = false;
  async function toggleHidden() {
    if (animating) return;
    lyricsHidden = !lyricsHidden;
    try { localStorage.setItem(hiddenKey, lyricsHidden ? "1" : "0"); } catch {}
    const album = $("lyrics-view").querySelector(".lyrics-album");
    const scroll = $("lyrics-scroll");
    if (reduced.matches || $("lyrics-view").hidden || !album) {
      applyHidden();
      return;
    }
    animating = true;
    const ease = "cubic-bezier(0.2, 0.8, 0.2, 1)";
    if (lyricsHidden)
      await scroll.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateX(24px)" }], { duration: 180, easing: "ease-in" }).finished.catch(() => {});
    const before = album.getBoundingClientRect();
    applyHidden();
    const after = album.getBoundingClientRect();
    if (after.width) {
      album.animate(
        [
          { transformOrigin: "top left", transform: `translate(${before.left - after.left}px, ${before.top - after.top}px) scale(${before.width / after.width})` },
          { transformOrigin: "top left", transform: "none" },
        ],
        { duration: 440, easing: ease },
      );
    }
    if (!lyricsHidden)
      scroll.animate([{ opacity: 0, transform: "translateX(24px)" }, { opacity: 1, transform: "none" }], { duration: 320, delay: 160, easing: "ease-out", fill: "backwards" });
    setTimeout(() => {
      animating = false;
    }, 460);
  }
  cover.setAttribute("role", "button");
  cover.tabIndex = 0;
  cover.addEventListener("click", toggleHidden);
  cover.addEventListener("pointerup", () => cover.blur());
  cover.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleHidden();
    }
  });
  applyHidden();
  let lyricRequest,
    lines = [],
    lineNodes = [],
    currentLine = -1,
    followedLine = -1,
    frame = 0,
    followAfter = 0;
  let previous = "music-scroll";
  const reveal = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      entry.target.classList.add("lyric-revealed");
      reveal.unobserve(entry.target);
    }
  }, { root: $("lyrics-scroll"), threshold: 0.05 });
  function revealLines() {
    reveal.disconnect();
    $("lyrics-lines").querySelectorAll(".lyric-line, .lyric-plain").forEach((node, index) => {
      node.classList.add("lyric-reveal");
      node.style.setProperty("--reveal-delay", `${Math.min(index, 5) * 100}ms`);
      reveal.observe(node);
    });
  }
  let closing = null;
  const closeButton = $("close-lyrics");
  document.body.append(closeButton);
  closeButton.hidden = $("lyrics-view").hidden;
  function fade(element, from, to, duration) {
    return element.animate([from, to], { duration, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)", fill: "both" });
  }
  function setView(open, instant = false) {
    const view = $("lyrics-view"), backdrop = $("lyrics-backdrop");
    if (closing) {
      closing.forEach((animation) => animation.cancel());
      closing = null;
    }
    const changed = view.hidden === open;
    if (!open && !instant && !view.hidden && !reduced.matches) {
      const out = [
        fade(view, { opacity: 1 }, { opacity: 0 }, 220),
        fade(backdrop, { opacity: 1 }, { opacity: 0 }, 220),
        fade(closeButton, { opacity: 1 }, { opacity: 0 }, 220),
      ];
      closing = out;
      const finish = () => {
        if (closing !== out) return;
        closing = null;
        applyView(false);
        out.forEach((animation) => animation.cancel());
      };
      Promise.all(out.map((animation) => animation.finished)).then(finish, () => {});
      setTimeout(finish, 260);
      return;
    }
    applyView(open);
    if (changed && open && !reduced.matches) {
      fade(view, { opacity: 0 }, { opacity: 1 }, 320).finished.then((a) => a.cancel?.(), () => {});
      fade(backdrop, { opacity: 0 }, { opacity: 1 }, 320).finished.then((a) => a.cancel?.(), () => {});
      fade(closeButton, { opacity: 0 }, { opacity: 1 }, 320).finished.then((a) => a.cancel?.(), () => {});
    }
  }
  function applyView(open) {
    if (open && $("lyrics-view").hidden) {
      previous = !$("music-detail").hidden ? "music-detail" : "music-scroll";
    }
    for (const id of ["music-scroll", "music-detail"]) {
      $(id).hidden = open || id !== previous;
    }
    $("lyrics-view").hidden = !open;
    closeButton.hidden = !open;
    $("music-browse").hidden = open;
    $("open-lyrics").setAttribute("aria-expanded", String(open));
    $("lyrics-backdrop").hidden = !open;
    document.body.classList.toggle("lyrics-open", open);
    if (open) {
      const track = getTrack();
      if (track) trackView(`Lyrics: ${track.title}`, `/music/lyrics/${track.id}`);
      followAfter = 0;
      followedLine = -1;
      updateLyrics();
      $("close-lyrics").focus();
      startClock();
    } else {
      cancelAnimationFrame(frame);
      frame = 0;
      $("open-lyrics").focus();
    }
  }
  function buildLyrics(data) {
    lines = parseLyrics(
      data.synced || "",
      getTrack()?.duration || 0,
    );
    currentLine = -1;
    followedLine = -1;
    $("lyrics-lines").replaceChildren();
    lineNodes = [];
    if (!lines.length) {
      $("lyrics-status").textContent = data.instrumental
        ? "Instrumental"
        : data.plain
          ? ""
          : "Lyrics unavailable for this track.";
      for (const text of (data.plain || "").split(/\r?\n/).filter(Boolean)) {
        const p = document.createElement("p");
        p.className = "lyric-plain";
        p.textContent = text;
        $("lyrics-lines").append(p);
      }
      revealLines();
      return;
    }
    $("lyrics-status").textContent = "";
    for (const line of lines) {
      const button = document.createElement("button");
      button.className = "lyric-line";
      button.setAttribute("aria-label", line.text || "Instrumental break");
      const words = line.words.map((word) => {
        const span = document.createElement("span");
        span.className = "lyric-word";
        span.textContent = word.text;
        button.append(span, document.createTextNode(" "));
        return span;
      });
      if (!line.text) button.textContent = "···";
      button.onclick = () => {
        if (Number.isFinite(audio.duration)) {
          audio.currentTime = Math.min(audio.duration, line.start);
          followAfter = 0;
          updateLyrics();
        }
      };
      lineNodes.push({ button, words });
      $("lyrics-lines").append(button);
    }
    revealLines();
    updateLyrics();
    startClock();
  }
  function prepareLyrics() {
    lyricRequest?.abort();
    reveal.disconnect();
    dropAm();
    lines = [];
    lineNodes = [];
    currentLine = -1;
    followedLine = -1;
    $("lyrics-lines").replaceChildren();
    $("lyrics-status").textContent = "Waiting for audio…";
  }
  function dropAm() {
    am?.remove();
    am = null;
    $("lyrics-scroll").classList.remove("uses-am");
  }
  async function mountAm(track, signal) {
    await loadAmLyrics();
    if (signal.aborted) return true;
    const element = document.createElement("am-lyrics");
    element.setAttribute("song-title", track.lyricTitle || track.title);
    element.setAttribute("song-artist", String(track.artist || "").split(",")[0].trim());
    if (track.duration) element.setAttribute("song-duration", String(Math.round(track.duration * 1000)));
    element.setAttribute("highlight-color", "#ffffff");
    element.setAttribute("no-auto-alternates", "");
    element.setAttribute("font-family", getComputedStyle(document.body).fontFamily);
    element.autoScroll = true;
    element.interpolate = true;
    if (reduced.matches) element.reducedMotion = true;
    element.addEventListener("line-click", (event) => {
      const at = Number(event.detail?.timestamp) / 1000;
      if (Number.isFinite(at) && Number.isFinite(audio.duration)) audio.currentTime = Math.min(audio.duration, at);
    });
    $("lyrics-status").textContent = "";
    $("lyrics-scroll").classList.add("uses-am");
    $("lyrics-scroll").append(element);
    if (element.shadowRoot) element.shadowRoot.adoptedStyleSheets = [...element.shadowRoot.adoptedStyleSheets, bareSheet()];
    am = element;
    am.currentTime = audio.currentTime * 1000;
    return true;
  }
  async function fetchLyrics(track) {
    lyricRequest?.abort();
    reveal.disconnect();
    dropAm();
    lyricRequest = new AbortController();
    const signal = lyricRequest.signal;
    try {
      if (await mountAm(track, signal)) return;
    } catch {
      dropAm();
    }
    lines = [];
    lineNodes = [];
    currentLine = -1;
    followedLine = -1;
    $("lyrics-lines").replaceChildren();
    $("lyrics-scroll").scrollTop = 0;
    $("lyrics-status").textContent = "Loading lyrics…";
    const params = new URLSearchParams({
      artist: track.artist,
      title: track.lyricTitle || track.title,
      duration: String(track.duration),
    });
    if (track.album) params.set("album", track.album);
    try {
      const data = await api(`lyrics?${params}`, signal);
      if (!signal.aborted) buildLyrics(data);
    } catch (error) {
      if (!signal.aborted)
        $("lyrics-status").textContent = "Lyrics unavailable. Try again with another track.";
    }
  }
  function updateLyrics() {
    if (am) {
      am.currentTime = audio.currentTime * 1000;
      return;
    }
    if ($("lyrics-view").hidden || !lines.length) return;
    const active = activeLine(lines, audio.currentTime);
    const changed = active !== currentLine;
    if (changed) {
      if (currentLine >= 0) lineNodes[currentLine].button.classList.remove("active");
      currentLine = active;
      if (active >= 0) {
        lineNodes[active].button.classList.add("active");
      }
    }
    for (let i = changed ? 0 : Math.max(0, active); i <= (changed ? lineNodes.length - 1 : active); i++) {
      const node = lineNodes[i];
      node.words.forEach((span, j) => {
        const progress =
          i < active ? 1 : i === active ? wordProgress(lines[i].words[j], audio.currentTime) : 0;
        span.style.setProperty("--word-progress", `${progress * 100}%`);
      });
    }
    if (active >= 0 && active !== followedLine && performance.now() > followAfter) {
      followedLine = active;
      const container = $("lyrics-scroll"),
        button = lineNodes[active].button;
      const target = button.offsetTop - container.clientHeight * 0.38;
      if (Math.abs(container.scrollTop - target) > 45) {
        container.scrollTo({
          top: Math.max(0, target),
          behavior: reduced.matches ? "instant" : "smooth",
        });
      }
    }
  }
  function startClock() {
    if (frame || $("lyrics-view").hidden || audio.paused) return;
    const tick = () => {
      frame = 0;
      updateLyrics();
      if (!audio.paused && !$("lyrics-view").hidden) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  }
  $("seek").oninput = () => {
    if (Number.isFinite(audio.duration)) {
      audio.currentTime = Number($("seek").value);
      followAfter = 0;
      updateLyrics();
    }
  };
  for (const event of ["wheel", "touchmove", "pointerdown"]) {
    $("lyrics-scroll").addEventListener(
      event,
      () => {
        followAfter = performance.now() + 4500;
        followedLine = -1;
      },
      { passive: true },
    );
  }
  $("lyrics-scroll").addEventListener("keydown", (event) => {
    if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(event.key)) {
      followAfter = performance.now() + 4500;
      followedLine = -1;
    }
  });
  function pauseClock() {
    cancelAnimationFrame(frame);
    frame = 0;
  }
  return { setView, prepareLyrics, fetchLyrics, updateLyrics, startClock, pauseClock };
}
