let lastPath = "";
export function trackView(title, path) {
  if (path === lastPath) return;
  lastPath = path;
  try {
    window.gtag?.("event", "page_view", {
      page_title: `${title} - Music`,
      page_location: `${location.origin}${path}`,
      page_path: path,
    });
  } catch {}
}
export function trackEvent(name, params = {}) {
  try {
    window.gtag?.("event", name, params);
  } catch {}
}
