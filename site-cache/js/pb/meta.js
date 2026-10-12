function getTabTitle(url) {
  if (!url || url === proxyConfig.internal.newTab || url === "about:blank") return "New Tab";
  if (url === proxyConfig.internal.history) return "History";
  if (url === proxyConfig.internal.settings) return "Settings";
  try {
    return new URL(url).hostname.replace(/^www\./, "") || "New Tab";
  } catch {
    return "New Tab";
  }
}
function cleanPageTitle(title) {
  return String(title || "")
    .replace(/\s+/g, " ")
    .trim();
}
function getCleanTabTitle(url = "", rawTitle = "") {
  const title = cleanPageTitle(rawTitle);
  if (title && title !== "Browser | Truffled" && !/^https?:\/\//i.test(title)) {
    return title;
  }
  return getTabTitle(url);
}
function getFaviconServiceUrl(hostname = "") {
  const cleanHost = hostname.replace(/^www\./, "").trim();
  return shouldUseRemoteFavicon(cleanHost)
    ? `https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent(cleanHost)}`
    : "";
}
function shouldUseRemoteFavicon(hostname = "") {
  return (
    hostname && !/^(example\.(com|net|org)|localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(hostname)
  );
}
function getDuckDuckGoIconHost(parsedUrl) {
  if (parsedUrl.hostname !== "external-content.duckduckgo.com") {
    return "";
  }
  const match = parsedUrl.pathname.match(/\/ip3\/(.+?)\.ico$/i);
  return match?.[1] || "";
}
function getSafeTabIcon(iconUrl = "") {
  if (!iconUrl) return "";
  try {
    const rawUrl = new URL(iconUrl, location.href);
    const decodedUrl = decodeStudyingServiceUrl(rawUrl.href) || rawUrl.href;
    const parsedUrl = new URL(decodedUrl, location.href);
    const duckIconHost = getDuckDuckGoIconHost(parsedUrl);
    if (duckIconHost) {
      return getFaviconServiceUrl(duckIconHost);
    }
    if (parsedUrl.origin === location.origin && parsedUrl.pathname === "/png/logo.png") {
      return "";
    }
    if (parsedUrl.origin === location.origin && parsedUrl.pathname.startsWith(studyPrefix)) {
      return "";
    }
    if (parsedUrl.origin === location.origin && !parsedUrl.pathname.startsWith("/png/")) {
      return "";
    }
    return parsedUrl.href;
  } catch {
    return "";
  }
}
function isLocalLogoIcon(iconUrl = "") {
  try {
    const parsedUrl = new URL(iconUrl, location.href);
    return parsedUrl.origin === location.origin && parsedUrl.pathname === "/png/logo.png";
  } catch {
    return false;
  }
}
function applyTabMeta(tab = getActiveTab(), meta = {}) {
  if (!tab || isInternalUrl(tab.url)) return;
  const previousTitle = tab.title;
  const previousIcon = tab.icon;
  const title = getCleanTabTitle(tab.url, meta.title || tab.pageTitle);
  tab.pageTitle = title;
  tab.title = title;
  const icon = getSafeTabIcon(meta.icon);
  if (icon) {
    tab.icon = icon;
  } else {
    tab.icon = getTabIcon(tab.url);
  }
  const changed = previousTitle !== tab.title || previousIcon !== tab.icon;
  const bookmarks = getBookmarks();
  const bookmarkLocation = findBookmarkLocation(bookmarks, tab.url);
  if (bookmarkLocation) {
    const targetBookmark = bookmarkLocation.folderId
      ? bookmarks.find((entry) => entry.id === bookmarkLocation.folderId)?.children?.[
          bookmarkLocation.index
        ]
      : bookmarks[bookmarkLocation.index];
    if (targetBookmark) {
      targetBookmark.title = title;
      targetBookmark.icon = tab.icon;
    }
    localStorage.setItem(proxyConfig.storage.bookmarks, JSON.stringify(bookmarks));
    renderBookmarks();
  }
  if (changed) {
    renderTabs();
  }
  updateBookmarkToggle();
  if (tab.id === activeTabId) {
    window.addToHistory?.(tab.url, title);
  }
}
function getTabIcon(url) {
  if (url === proxyConfig.internal.settings) return "/png/gear-solid.svg";
  if (!url || isInternalUrl(url) || url === "about:blank") return "";
  try {
    const parsedUrl = new URL(url);
    if (!shouldUseRemoteFavicon(parsedUrl.hostname)) return "";
    return `https://www.google.com/s2/favicons?sz=128&domain_url=${encodeURIComponent(parsedUrl.origin)}`;
  } catch {
    return "";
  }
}
function getFallbackIconClass(url = "") {
  if (url === proxyConfig.internal.history) return "fa-solid fa-clock-rotate-left";
  if (url === proxyConfig.internal.settings) return "fa-solid fa-gear";
  if (!url || url === proxyConfig.internal.newTab || url === "about:blank")
    return "fa-regular fa-file-lines";
  return "fa-solid fa-earth-americas";
}
function createFallbackFaviconElement(url = "") {
  const fallback = document.createElement("span");
  fallback.className = "fallback-site-favicon";
  const icon = document.createElement("i");
  icon.className = getFallbackIconClass(url);
  icon.setAttribute("aria-hidden", "true");
  fallback.appendChild(icon);
  return fallback;
}
function setFallbackTabIcon(iconWrap, url) {
  iconWrap.innerHTML = "";
  iconWrap.className = "proxy-tab-icon is-fallback";
  iconWrap.appendChild(createFallbackFaviconElement(url));
}
function setFaviconTabIcon(iconWrap, tab) {
  iconWrap.innerHTML = "";
  if (isLocalLogoIcon(tab.icon)) {
    tab.icon = getTabIcon(tab.url);
  }
  iconWrap.className = "proxy-tab-icon has-favicon";
  const icon = document.createElement("img");
  icon.src = tab.icon;
  icon.alt = "";
  icon.loading = "lazy";
  icon.draggable = false;
  icon.referrerPolicy = "no-referrer";
  icon.addEventListener(
    "error",
    () => {
      const fallbackIcon = getTabIcon(tab.url);
      if (fallbackIcon && tab.icon !== fallbackIcon) {
        tab.icon = fallbackIcon;
        setFaviconTabIcon(iconWrap, tab);
        return;
      }
      setFallbackTabIcon(iconWrap, tab.url);
    },
    {
      once: true,
    },
  );
  iconWrap.appendChild(icon);
}
function makeId(prefix = "id") {
  if (window.crypto?.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function normalizeNewTabShortcutUrl(value = "") {
  let url = String(value || "").trim();
  if (!url) return "";
  if (!/^[a-z][a-z\d+.-]*:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  try {
    const parsedUrl = new URL(url);
    return ["http:", "https:"].includes(parsedUrl.protocol) ? parsedUrl.href : "";
  } catch {
    return "";
  }
}
function getNewTabShortcutKey(url = "") {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}
function getNewTabShortcuts() {
  try {
    const saved = JSON.parse(localStorage.getItem(proxyConfig.storage.newTabShortcuts) || "[]");
    if (!Array.isArray(saved)) return [];
    return saved
      .map((shortcut) => {
        const url = normalizeNewTabShortcutUrl(shortcut?.url);
        if (!url) return null;
        return {
          id: String(shortcut.id || makeId("shortcut")),
          name:
            String(shortcut.name || "")
              .trim()
              .slice(0, 40) || new URL(url).hostname.replace(/^www\./, ""),
          url,
        };
      })
      .filter(Boolean)
      .slice(0, 5);
  } catch {
    return [];
  }
}
function saveNewTabShortcuts(shortcuts) {
  localStorage.setItem(proxyConfig.storage.newTabShortcuts, JSON.stringify(shortcuts.slice(0, 5)));
  renderNewTabShortcuts();
}
function getHiddenRecentSites() {
  try {
    const saved = JSON.parse(localStorage.getItem(proxyConfig.storage.hiddenRecentSites) || "[]");
    return Array.isArray(saved) ? saved.filter((key) => typeof key === "string") : [];
  } catch {
    return [];
  }
}
function getRecentNewTabSites(shortcuts, limit) {
  const hidden = new Set(getHiddenRecentSites());
  const seen = new Set(shortcuts.map((item) => getNewTabShortcutKey(item.url)));
  const recent = [];
  for (const item of window.getHistory?.() || []) {
    const url = normalizeNewTabShortcutUrl(item?.url);
    if (!url) continue;
    const key = getNewTabShortcutKey(url);
    if (hidden.has(key) || seen.has(key)) continue;
    seen.add(key);
    const title = String(item.title || "").trim();
    recent.push({
      id: `recent-${recent.length}`,
      name:
        title && title !== item.url && !/^https?:/i.test(title)
          ? title.slice(0, 40)
          : new URL(url).hostname.replace(/^www\./, ""),
      url,
      custom: false,
    });
    if (recent.length >= Math.max(0, limit)) break;
  }
  return recent;
}
function setNewTabShortcutIcon(iconWrap, url) {
  const source = getTabIcon(url);
  if (!source) {
    const icon = document.createElement("i");
    icon.className = "fa-solid fa-earth-americas";
    iconWrap.appendChild(icon);
    return;
  }
  const icon = document.createElement("img");
  icon.src = source;
  icon.alt = "";
  icon.loading = "lazy";
  icon.referrerPolicy = "no-referrer";
  icon.addEventListener(
    "error",
    () => {
      icon.remove();
      const fallback = document.createElement("i");
      fallback.className = "fa-solid fa-earth-americas";
      iconWrap.appendChild(fallback);
    },
    { once: true },
  );
  iconWrap.appendChild(icon);
}
function closeNewTabShortcutDialog() {
  newTabShortcutDialog.classList.remove("is-open");
  newTabShortcutDialog.setAttribute("aria-hidden", "true");
  newTabShortcutForm.reset();
  newTabShortcutUrl.setCustomValidity("");
}
function openNewTabShortcutDialog() {
  newTabShortcutName.value = "";
  newTabShortcutUrl.value = "";
  newTabShortcutDialog.classList.add("is-open");
  newTabShortcutDialog.setAttribute("aria-hidden", "false");
  setTimeout(() => newTabShortcutName.focus(), 0);
}
function createNewTabShortcutTile(shortcut) {
  const tile = document.createElement("div");
  tile.className = "newtab-shortcut-tile";
  const openButton = document.createElement("button");
  openButton.type = "button";
  openButton.className = "newtab-shortcut-open";
  openButton.title = shortcut.url;
  const iconWrap = document.createElement("span");
  iconWrap.className = "newtab-shortcut-icon";
  setNewTabShortcutIcon(iconWrap, shortcut.url);
  const title = document.createElement("span");
  title.className = "newtab-shortcut-title";
  title.textContent = shortcut.name;
  openButton.append(iconWrap, title);
  openButton.addEventListener("click", () => {
    loadNewPage(shortcut.url, getEffectiveProxyBackend());
  });
  tile.appendChild(openButton);
  return tile;
}
function createAddNewTabShortcutTile() {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "newtab-shortcut-open newtab-shortcut-add";
  button.innerHTML =
    '<span class="newtab-shortcut-icon"><i class="fa-solid fa-plus"></i></span><span class="newtab-shortcut-title">Add shortcut</span>';
  button.addEventListener("click", () => openNewTabShortcutDialog());
  return button;
}
function renderNewTabShortcuts() {
  if (!newTabShortcutGrid) return;
  const saved = getNewTabShortcuts()
    .slice(0, 5)
    .map((shortcut) => ({
      ...shortcut,
      custom: true,
    }));
  const showAdd = saved.length < 5;
  const availableSites = showAdd ? 4 : 5;
  const shortcuts = [...saved, ...getRecentNewTabSites(saved, availableSites - saved.length)].slice(
    0,
    availableSites,
  );
  newTabShortcutGrid.innerHTML = "";
  shortcuts.forEach((shortcut) => {
    newTabShortcutGrid.appendChild(createNewTabShortcutTile(shortcut));
  });
  if (showAdd) {
    newTabShortcutGrid.appendChild(createAddNewTabShortcutTile());
  }
}
window.renderNewTabShortcuts = renderNewTabShortcuts;
