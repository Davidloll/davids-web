import { createPages } from "/js/music/pages.js";
export function setupBrowse({ setView, closeDetail, notice }) {
  const channel = new BroadcastChannel("truffled-music");
  let track;
  const pages = createPages({ onMusic() {}, onPage() {} });
  window.truffledNavigate = (path) => pages.open(path).catch((error) => notice(error.message));
  function publish() {
    channel.postMessage({ type: "track", track });
  }
  channel.onmessage = async ({ data }) => {
    if (data?.type === "request") publish();
    if (data?.type === "lyrics" && track) {
      await pages.open("/m");
      setView(true);
    }
  };
  document.addEventListener(
    "click",
    (event) => {
      const link = event.target.closest("a[href]");
      if (
        !link ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.button ||
        link.target === "_blank" ||
        link.hasAttribute("download")
      )
        return;
      const url = new URL(link.href, location.href);
      const allowed = [
        "/",
        "/g",
        "/a",
        "/t",
        "/s",
        "/m",
        "/music",
        "/iframe.html",
        "/unityframe.html",
        "/i",
        "/u",
        "/search.html",
      ];
      if (url.origin !== location.origin || !allowed.includes(url.pathname)) return;
      if (!track) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (pages.isMusic()) {
        setView(false, true);
        closeDetail();
      }
      pages.open(url.pathname + url.search).catch((error) => notice(error.message));
    },
    true,
  );
  window.addEventListener("pagehide", () => {
    channel.postMessage({ type: "track", track: null });
  });
  return {
    updateCover(item) {
      track = {
        title: item.title,
        artist: item.artist,
        cover: item.cover || item.art || "/png/logo.png",
      };
      publish();
    },
  };
}
