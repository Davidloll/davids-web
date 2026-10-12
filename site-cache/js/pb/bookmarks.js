function normalizeBookmarkUrl(url = "") {
  const cleanUrl = (getLegacyProxyTarget(url) || canonicalizeVisibleUrl(url)).trim();
  if (
    !cleanUrl ||
    cleanUrl === "about:blank" ||
    isInternalUrl(cleanUrl) ||
    isBrowserShellUrl(cleanUrl)
  ) {
    return "";
  }
  return normalizeInputToUrl(cleanUrl);
}
function normalizeBookmarkEntry(entry, changedRef) {
  if (!entry || typeof entry !== "object") return null;
  if (entry.type === "folder") {
    const children = Array.isArray(entry.children)
      ? entry.children
          .map((child) => normalizeBookmarkEntry(child, changedRef))
          .filter((child) => child && child.type !== "folder")
      : [];
    const folder = {
      type: "folder",
      id: entry.id || makeId("folder"),
      title: cleanPageTitle(entry.title) || "New folder",
      children,
      createdAt: entry.createdAt || new Date().toISOString(),
    };
    if (
      folder.id !== entry.id ||
      folder.title !== entry.title ||
      folder.children.length !== (entry.children || []).length
    ) {
      changedRef.changed = true;
    }
    return folder;
  }
  if (!entry.url) return null;
  const normalizedUrl = normalizeBookmarkUrl(entry.url);
  if (!normalizedUrl) {
    changedRef.changed = true;
    return null;
  }
  const bookmark = {
    ...entry,
    type: "bookmark",
    id: entry.id || makeId("bookmark"),
    url: normalizedUrl,
    icon: getSafeTabIcon(entry.icon) || getTabIcon(normalizedUrl),
  };
  if (
    bookmark.id !== entry.id ||
    bookmark.url !== entry.url ||
    bookmark.icon !== entry.icon ||
    bookmark.type !== entry.type
  ) {
    changedRef.changed = true;
  }
  return bookmark;
}
function getBookmarks() {
  try {
    const data = JSON.parse(localStorage.getItem(proxyConfig.storage.bookmarks) || "[]");
    if (!Array.isArray(data)) return [];
    const changedRef = { changed: false };
    const bookmarks = data
      .map((entry) => normalizeBookmarkEntry(entry, changedRef))
      .filter(Boolean);
    if (changedRef.changed) {
      localStorage.setItem(proxyConfig.storage.bookmarks, JSON.stringify(bookmarks));
    }
    return bookmarks;
  } catch {
    return [];
  }
}
function saveBookmarks(bookmarks) {
  localStorage.setItem(proxyConfig.storage.bookmarks, JSON.stringify(bookmarks));
  renderBookmarks();
  updateBookmarkToggle();
}
function getActiveBookmarkUrl() {
  const tab = getActiveTab();
  return normalizeBookmarkUrl(tab?.url || "");
}
function getBookmarkIndex(url = getActiveBookmarkUrl()) {
  const normalizedUrl = normalizeBookmarkUrl(url);
  if (!normalizedUrl) return -1;
  return getBookmarks().findIndex(
    (bookmark) => normalizeBookmarkUrl(bookmark.url) === normalizedUrl,
  );
}
function findBookmarkLocation(bookmarks, url = getActiveBookmarkUrl()) {
  const normalizedUrl = normalizeBookmarkUrl(url);
  if (!normalizedUrl) return null;
  for (let index = 0; index < bookmarks.length; index += 1) {
    const entry = bookmarks[index];
    if (entry.type === "folder") {
      const childIndex = (entry.children || []).findIndex(
        (child) => normalizeBookmarkUrl(child.url) === normalizedUrl,
      );
      if (childIndex !== -1) return { folderId: entry.id, index: childIndex };
      continue;
    }
    if (normalizeBookmarkUrl(entry.url) === normalizedUrl) return { folderId: "", index };
  }
  return null;
}
function getBookmarkMetaForTab(tab = getActiveTab()) {
  const url = normalizeBookmarkUrl(tab?.url || "");
  if (!url) return null;
  return {
    id: makeId("bookmark"),
    url,
    title: getCleanTabTitle(url, tab?.pageTitle || tab?.title || ""),
    icon: getSafeTabIcon(tab?.icon || "") || getTabIcon(url),
    createdAt: new Date().toISOString(),
  };
}
function updateBookmarkToggle() {
  const icon = bookmarkToggle?.querySelector("i");
  const url = getActiveBookmarkUrl();
  const bookmarked = !!url && !!findBookmarkLocation(getBookmarks(), url);
  bookmarkToggle.disabled = !url;
  bookmarkToggle.classList.toggle("is-bookmarked", bookmarked);
  bookmarkToggle.setAttribute("aria-pressed", bookmarked ? "true" : "false");
  bookmarkToggle.title = bookmarked ? "Remove bookmark" : "Bookmark page";
  bookmarkToggle.setAttribute("aria-label", bookmarkToggle.title);
  if (icon) {
    icon.className = bookmarked ? "fa-solid fa-heart" : "fa-regular fa-heart";
  }
}
function toggleActiveBookmark() {
  const bookmark = getBookmarkMetaForTab();
  if (!bookmark) return;
  const bookmarks = getBookmarks();
  const existing = findBookmarkLocation(bookmarks, bookmark.url);
  if (!existing) {
    bookmarks.push(bookmark);
  } else if (existing.folderId) {
    const folder = bookmarks.find((entry) => entry.id === existing.folderId);
    folder.children.splice(existing.index, 1);
  } else {
    bookmarks.splice(existing.index, 1);
  }
  saveBookmarks(bookmarks);
}
function buildBookmarkIcon(bookmark, iconWrap) {
  iconWrap.innerHTML = "";
  iconWrap.className = "bookmark-item-icon has-favicon";
  const iconSource = getSafeTabIcon(bookmark.icon) || getTabIcon(bookmark.url);
  if (!iconSource) {
    iconWrap.className = "bookmark-item-icon is-fallback";
    iconWrap.appendChild(createFallbackFaviconElement(bookmark.url));
    return;
  }
  const icon = document.createElement("img");
  icon.src = iconSource;
  icon.alt = "";
  icon.loading = "lazy";
  icon.draggable = false;
  icon.referrerPolicy = "no-referrer";
  icon.addEventListener(
    "error",
    () => {
      iconWrap.innerHTML = "";
      iconWrap.className = "bookmark-item-icon is-fallback";
      iconWrap.appendChild(createFallbackFaviconElement(bookmark.url));
    },
    { once: true },
  );
  iconWrap.appendChild(icon);
}
function buildFolderIcon(iconWrap) {
  iconWrap.innerHTML = "";
  iconWrap.className = "bookmark-item-icon bookmark-folder-icon";
  const icon = document.createElement("i");
  icon.className = "fa-regular fa-folder";
  icon.setAttribute("aria-hidden", "true");
  iconWrap.appendChild(icon);
}
function renderBookmarkButton(bookmark, options = {}) {
  const item = document.createElement("button");
  item.type = "button";
  item.className = [
    "bookmark-entry",
    "bookmark-item",
    options.child ? "is-folder-child" : "",
    bookmark.id === draggingBookmarkId ? "is-dragging" : "",
  ]
    .filter(Boolean)
    .join(" ");
  item.dataset.bookmarkId = bookmark.id;
  if (options.folderId) {
    item.dataset.sourceFolderId = options.folderId;
  }
  item.title = bookmark.url;
  const iconWrap = document.createElement("span");
  buildBookmarkIcon(bookmark, iconWrap);
  const title = document.createElement("span");
  title.className = "bookmark-item-title";
  title.textContent = bookmark.title || getTabTitle(bookmark.url);
  item.appendChild(iconWrap);
  item.appendChild(title);
  item.addEventListener("click", () => {
    if (didDragBookmark) {
      didDragBookmark = false;
      return;
    }
    const url = normalizeBookmarkUrl(bookmark.url);
    if (url) {
      closeBookmarkFolderPopover();
      loadNewPage(url, getEffectiveProxyBackend());
    }
  });
  item.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    openBookmarkContextMenu(event.clientX, event.clientY, {
      bookmarkId: bookmark.id,
      sourceFolderId: options.folderId || "",
    });
  });
  item.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target.closest(".bookmark-folder-child-remove")) return;
    bookmarkDragState = {
      id: bookmark.id,
      type: "bookmark",
      sourceFolderId: options.folderId || "",
      startX: event.clientX,
      startY: event.clientY,
      started: false,
    };
  });
  return item;
}
function renderBookmarkFolder(folder) {
  const item = document.createElement("button");
  item.type = "button";
  item.className = [
    "bookmark-entry",
    "bookmark-item",
    "bookmark-folder",
    folder.id === activeBookmarkFolderId ? "is-open" : "",
    folder.id === draggingBookmarkId ? "is-dragging" : "",
  ]
    .filter(Boolean)
    .join(" ");
  item.dataset.bookmarkId = folder.id;
  item.dataset.folderId = folder.id;
  item.title = folder.title;
  const iconWrap = document.createElement("span");
  buildFolderIcon(iconWrap);
  const title = document.createElement("span");
  title.className = "bookmark-item-title";
  title.textContent = folder.title || "New folder";
  item.appendChild(iconWrap);
  item.appendChild(title);
  item.addEventListener("click", (event) => {
    if (didDragBookmark) {
      didDragBookmark = false;
      return;
    }
    toggleBookmarkFolderPopover(folder.id, item);
  });
  item.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    openBookmarkContextMenu(event.clientX, event.clientY, {
      folderId: folder.id,
    });
  });
  item.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    bookmarkDragState = {
      id: folder.id,
      type: "folder",
      startX: event.clientX,
      startY: event.clientY,
      started: false,
    };
  });
  return item;
}
function renderBookmarks(options = {}) {
  if (!bookmarkList) return;
  const bookmarks = getBookmarks();
  bookmarkbar.classList.toggle("is-empty", bookmarks.length === 0);
  bookmarkList.innerHTML = "";
  for (const entry of bookmarks) {
    bookmarkList.appendChild(
      entry.type === "folder" ? renderBookmarkFolder(entry) : renderBookmarkButton(entry),
    );
  }
  if (options.animate) {
    animateBookmarkShift(options.previousPositions);
  }
}
function getBookmarkPositions() {
  const positions = new Map();
  for (const element of bookmarkList.querySelectorAll(".bookmark-entry")) {
    const rect = element.getBoundingClientRect();
    positions.set(element.dataset.bookmarkId, {
      left: rect.left,
      top: rect.top,
    });
  }
  return positions;
}
function animateBookmarkShift(previousPositions) {
  if (!previousPositions?.size) return;
  for (const element of bookmarkList.querySelectorAll(".bookmark-entry")) {
    if (element.dataset.bookmarkId === draggingBookmarkId) continue;
    const previous = previousPositions.get(element.dataset.bookmarkId);
    if (!previous) continue;
    const rect = element.getBoundingClientRect();
    const deltaX = previous.left - rect.left;
    const deltaY = previous.top - rect.top;
    if (!deltaX && !deltaY) continue;
    element.getAnimations().forEach((animation) => animation.cancel());
    element.animate(
      [
        { transform: `translate3d(${deltaX}px, ${deltaY}px, 0)` },
        { transform: "translate3d(0, 0, 0)" },
      ],
      {
        duration: 145,
        easing: "cubic-bezier(0.16, 0.95, 0.3, 1.08)",
      },
    );
  }
}
function moveBookmarkToIndex(bookmarkId, insertIndex) {
  const bookmarks = getBookmarks();
  const currentIndex = bookmarks.findIndex((bookmark) => bookmark.id === bookmarkId);
  const nextIndex = Math.max(0, Math.min(insertIndex, bookmarks.length - 1));
  if (currentIndex === -1 || currentIndex === nextIndex) return;
  const previousPositions = getBookmarkPositions();
  const [bookmark] = bookmarks.splice(currentIndex, 1);
  bookmarks.splice(nextIndex, 0, bookmark);
  localStorage.setItem(proxyConfig.storage.bookmarks, JSON.stringify(bookmarks));
  didDragBookmark = true;
  renderBookmarks({ animate: true, previousPositions });
}
