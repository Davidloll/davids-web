function isUrl(val = "") {
  return /^https?:\/\//i.test(val) || (val.includes(".") && val.slice(0, 1) !== " ");
}
function getInternalUrls() {
  return [proxyConfig.internal.newTab, proxyConfig.internal.history, proxyConfig.internal.settings];
}
function normalizeInternalUrl(url = "") {
  const raw = String(url || "");
  const internalUrl = raw.toLowerCase();
  if (/^site:\/\/exten/.test(internalUrl)) return proxyConfig.internal.newTab;
  return getInternalUrls().includes(internalUrl) ? internalUrl : "";
}
function isInternalUrl(url = "") {
  return Boolean(normalizeInternalUrl(url));
}
function getSavedProxyBackend() {
  localStorage.setItem(proxyConfig.storage.backend, "studying");
  return "studying";
}
function getEffectiveProxyBackend() {
  return getSavedProxyBackend();
}
function getBackendForUrl() {
  return "studying";
}
function getProxyBarPosition(
  value = localStorage.getItem(proxyConfig.storage.barPosition) || "bottom",
) {
  return ["left", "right", "bottom"].includes(value) ? value : "bottom";
}
function isSideProxyBar() {
  const position = document.body.dataset.proxyBarPosition || getProxyBarPosition();
  return position === "left" || position === "right";
}
function isSidebarCollapsed() {
  return localStorage.getItem(proxyConfig.storage.sidebarCollapsed) === "true";
}
function applySidebarCollapsed() {
  const collapsed = isSideProxyBar() && isSidebarCollapsed();
  const wasCollapsed = document.body.classList.contains("proxy-sidebar-collapsed");
  const animate =
    wasCollapsed !== collapsed &&
    isSideProxyBar() &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const panels = animate
    ? [
        ...document.querySelectorAll("#frames, #newtab-landing, #history-page, #settings-page"),
      ].filter((panel) => panel.getClientRects().length)
    : [];
  const positions = panels.map((panel) => panel.getBoundingClientRect().left);
  panels.forEach((panel) => panel.sidebarAnimation?.cancel());
  document.body.classList.toggle("proxy-sidebar-collapsed", collapsed);
  panels.forEach((panel, index) => {
    const offset = positions[index] - panel.getBoundingClientRect().left;
    panel.sidebarAnimation = panel.animate(
      [{ transform: `translateX(${offset}px)` }, { transform: "translateX(0)" }],
      { duration: 220, easing: "cubic-bezier(.2, .8, .2, 1)" },
    );
  });
  sideCollapseToggle?.setAttribute("aria-pressed", collapsed ? "true" : "false");
  sideCollapseToggle?.setAttribute("aria-label", collapsed ? "Expand sidebar" : "Collapse sidebar");
  sideCollapseToggle?.setAttribute("title", collapsed ? "Expand sidebar" : "Collapse sidebar");
  const collapseIcon = sideCollapseToggle?.querySelector("i");
  if (collapseIcon) {
    const pointsRight = document.body.classList.contains("proxy-bar-left") === collapsed;
    collapseIcon.className = `fa-solid fa-chevron-${pointsRight ? "right" : "left"}`;
  }
}
function applyCompactTabs() {
  document.body.classList.toggle(
    "compact-tabs",
    localStorage.getItem(proxyConfig.storage.compactTabs) === "true",
  );
}
function placeNewTabButton(position = getProxyBarPosition()) {
  if (!newTabButton || !tabbarActions || !bookmarkbarActions) return;
  if (position === "left" || position === "right") {
    if (newTabButton.parentElement !== bookmarkbarActions) {
      bookmarkbarActions.prepend(newTabButton);
    }
    bookmarkbarActions.classList.add("has-new-tab");
  } else {
    if (newTabButton.parentElement !== tabbarActions) {
      tabbarActions.appendChild(newTabButton);
    }
    bookmarkbarActions.classList.remove("has-new-tab");
  }
  tabbarActions.classList.toggle("is-empty", tabbarActions.children.length === 0);
}
function applyProxyBarPosition(value = getProxyBarPosition()) {
  const position = getProxyBarPosition(value);
  document.body.dataset.proxyBarPosition = position;
  document.body.classList.toggle("proxy-bar-left", position === "left");
  document.body.classList.toggle("proxy-bar-right", position === "right");
  document.body.classList.toggle("proxy-bar-bottom", position === "bottom");
  placeNewTabButton(position);
  if (position === "left" || position === "right") {
    document.body.classList.add("footer-open");
  }
  applySidebarCollapsed();
  if (typeof closeBookmarkFolderPopover === "function") {
    closeBookmarkFolderPopover();
  }
  if (typeof hideTabTooltip === "function") {
    hideTabTooltip();
  }
}
function getPendingProxyUrl() {
  return sessionStorage.getItem(proxyConfig.storage.pendingUrl) || "";
}
function getUrlParameter(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name) || "";
}
function getStoredEncodedUrl() {
  return sessionStorage.getItem("encodedUrl") || "";
}
function decodeStudyingServiceUrl(value = "") {
  try {
    const parsedUrl = new URL(value, location.href);
    if (parsedUrl.origin !== location.origin || !parsedUrl.pathname.startsWith(studyPrefix))
      return "";
    const encodedTarget = parsedUrl.pathname.slice(studyPrefix.length);
    if (!encodedTarget) {
      return "";
    }
    const decodedHash = parsedUrl.hash ? `#${decodeURIComponent(parsedUrl.hash.slice(1))}` : "";
    const decodedTarget = decodeURIComponent(encodedTarget) + decodedHash;
    return /^https?:\/\//i.test(decodedTarget) ? decodedTarget : "";
  } catch {
    return "";
  }
}
function isSameOriginProxyUrl(url = "") {
  try {
    const parsedUrl = new URL(url, location.href);
    if (parsedUrl.origin !== location.origin) return false;
    return parsedUrl.pathname.startsWith(studyPrefix);
  } catch {
    return false;
  }
}
function canonicalizeVisibleUrl(url = "") {
  let currentUrl = String(url || "").trim();
  for (let index = 0; index < 6; index += 1) {
    const decodedUrl = decodeStudyingServiceUrl(currentUrl);
    if (decodedUrl && decodedUrl !== currentUrl) {
      currentUrl = decodedUrl;
      continue;
    }
    if (isSameOriginProxyUrl(currentUrl)) {
      return "";
    }
    return currentUrl;
  }
  return isSameOriginProxyUrl(currentUrl) ? "" : currentUrl;
}
function normalizeInputToUrl(value) {
  let url = canonicalizeVisibleUrl(value.trim());
  if (!url) return "";
  const internalUrl = normalizeInternalUrl(url);
  if (internalUrl) return internalUrl;
  if (!isUrl(url)) {
    url = buildSearchUrl(url);
  } else if (!/^https?:\/\//i.test(url)) {
    url = "https://" + url;
  }
  return url;
}
function getLegacyProxyTarget(value = "") {
  try {
    const parsedUrl = new URL(value, location.href);
    const marker = "/---/";
    const markerIndex = parsedUrl.pathname.indexOf(marker);
    if (markerIndex === -1) {
      return "";
    }
    const encodedTarget = parsedUrl.pathname.slice(markerIndex + marker.length);
    if (!encodedTarget) {
      return "";
    }
    const targetUrl = decodeURIComponent(encodedTarget);
    const parsedTarget = new URL(targetUrl);
    return ["http:", "https:"].includes(parsedTarget.protocol) ? parsedTarget.href : "";
  } catch {
    return "";
  }
}
function buildSearchUrl(query = "") {
  return (
    window.searchEngines?.buildUrl(query) ||
    `https://duckduckgo.com/?q=${encodeURIComponent(query)}`
  );
}
function getWispUrl() {
  return (location.protocol === "https:" ? "wss" : "ws") + "://" + location.host + "/wisp/";
}
function isBrowserShellUrl(url = "") {
  try {
    const parsedUrl = new URL(url, location.href);
    return (
      parsedUrl.origin === location.origin &&
      (parsedUrl.pathname === "/search.html" ||
        parsedUrl.pathname === "/studying/frame.html" ||
        parsedUrl.pathname === "/studying/frame/")
    );
  } catch {
    return false;
  }
}
function getVisibleSearchValue(url = "") {
  url = canonicalizeVisibleUrl(url);
  if (
    !url ||
    url === "about:blank" ||
    url === proxyConfig.internal.newTab ||
    isBrowserShellUrl(url)
  ) {
    return proxyConfig.internal.newTab;
  }
  if (url === proxyConfig.internal.history) {
    return proxyConfig.internal.history;
  }
  if (url === proxyConfig.internal.settings) {
    return proxyConfig.internal.settings;
  }
  return url;
}
function updateSearchBars(url) {
  const visible = getVisibleSearchValue(url);
  if (isInternalUrl(visible)) {
    searchInputFooter.value = "";
    searchInputFooter.placeholder = visible === proxyConfig.internal.settings ? "" : visible;
    searchInputFooter.classList.add("is-internal");
    return;
  }
  searchInputFooter.classList.remove("is-internal");
  searchInputFooter.value = visible;
  updateSearchPlaceholder();
}
function updateSearchPlaceholder() {
  if (searchInputFooter.classList.contains("is-internal")) return;
  const engine = window.searchEngines?.get();
  searchInputFooter.placeholder = `Search ${engine?.label || "DuckDuckGo"} or type a URL`;
}
function setNewTabPage(active) {
  document.body.classList.toggle("new-tab-page", active);
  newTabLanding.setAttribute("aria-hidden", active ? "false" : "true");
  if (active) renderNewTabShortcuts();
}
function setHistoryPage(active) {
  document.body.classList.toggle("history-page", active);
  if (active) {
    document.body.classList.add("footer-open");
  }
  historyPage.setAttribute("aria-hidden", active ? "false" : "true");
}
function setSettingsPage(active) {
  document.body.classList.toggle("proxy-settings-page", active);
  if (active) {
    document.body.classList.add("footer-open");
    hydrateProxySettingsPage();
  }
  settingsPage?.setAttribute("aria-hidden", active ? "false" : "true");
}
