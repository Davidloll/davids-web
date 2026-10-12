function finishBookmarkDrag() {
  if (!bookmarkDragState) return;
  const wasDragging = bookmarkDragState.started;
  const draggedId = bookmarkDragState.id;
  const draggedType = bookmarkDragState.type;
  const sourceFolderId = bookmarkDragState.sourceFolderId || "";
  const insertIndex = getBookmarkInsertIndex(pendingBookmarkDragX, pendingBookmarkDragY);
  const dropFolderId =
    wasDragging && draggedType === "bookmark"
      ? getBookmarkDropFolder(pendingBookmarkDragX, pendingBookmarkDragY)
      : "";
  const droppedOnTabbar =
    wasDragging &&
    draggedType === "bookmark" &&
    isBookmarkTabDrop(pendingBookmarkDragX, pendingBookmarkDragY);
  const droppedOnBookmarkBar =
    wasDragging && sourceFolderId && isBookmarkBarDrop(pendingBookmarkDragX, pendingBookmarkDragY);
  const draggedBookmark = getBookmarkById(draggedId, sourceFolderId);
  markChromeDropTarget(null);
  draggingBookmarkId = "";
  bookmarkDragState = null;
  bookmarkDragGhost?.remove();
  bookmarkDragGhost = null;
  if (bookmarkDragFrame) {
    cancelAnimationFrame(bookmarkDragFrame);
    bookmarkDragFrame = 0;
  }
  if (wasDragging) {
    if (droppedOnTabbar && draggedBookmark) {
      const url = normalizeBookmarkUrl(draggedBookmark.url);
      renderBookmarks();
      if (url) {
        createTab(url, getEffectiveProxyBackend(), true);
      }
      setTimeout(() => {
        didDragBookmark = false;
      }, 0);
      return;
    }
    if (sourceFolderId && dropFolderId && dropFolderId !== sourceFolderId) {
      const movedOut = moveBookmarkOutOfFolder(draggedId, sourceFolderId, getBookmarks().length);
      if (movedOut && moveBookmarkIntoFolder(draggedId, dropFolderId)) {
        setTimeout(() => {
          didDragBookmark = false;
        }, 0);
        return;
      }
    }
    if (!sourceFolderId && dropFolderId && moveBookmarkIntoFolder(draggedId, dropFolderId)) {
      setTimeout(() => {
        didDragBookmark = false;
      }, 0);
      return;
    }
    if (
      sourceFolderId &&
      droppedOnBookmarkBar &&
      moveBookmarkOutOfFolder(draggedId, sourceFolderId, insertIndex)
    ) {
      setTimeout(() => {
        didDragBookmark = false;
      }, 0);
      return;
    }
    renderBookmarks();
    setTimeout(() => {
      didDragBookmark = false;
    }, 0);
  }
}
function openBookmarkEditor(bookmarkId, clientX = window.innerWidth / 2, clientY = 72) {
  const bookmark = getBookmarks().find((entry) => entry.id === bookmarkId);
  if (!bookmark) return;
  editingBookmarkId = bookmarkId;
  bookmarkEditor.classList.add("is-open");
  bookmarkEditor.setAttribute("aria-hidden", "false");
  const width = 46;
  bookmarkEditor.style.left = `${Math.min(Math.max(clientX, 12), window.innerWidth - width - 12)}px`;
  bookmarkEditor.style.top = `${Math.min(Math.max(clientY, 58), window.innerHeight - 58)}px`;
  setTimeout(() => bookmarkDeleteButton.focus(), 0);
}
function closeBookmarkEditor() {
  editingBookmarkId = "";
  bookmarkEditor.classList.remove("is-open");
  bookmarkEditor.setAttribute("aria-hidden", "true");
}
function deleteEditedBookmark() {
  if (!editingBookmarkId) return;
  deleteBookmarkById(editingBookmarkId);
  closeBookmarkEditor();
}
function closeBookmarkContextMenu() {
  bookmarkMenuTargetFolderId = "";
  bookmarkMenuTargetBookmarkId = "";
  bookmarkMenuTargetBookmarkFolderId = "";
  bookmarkMenu.classList.remove("is-open");
  bookmarkMenu.setAttribute("aria-hidden", "true");
}
function openBookmarkContextMenu(clientX, clientY, target = {}) {
  closeBookmarkEditor();
  closeBookmarkFolderDialog();
  if (bookmarkFolderPopover.classList.contains("is-open")) {
    closeBookmarkFolderPopover();
  }
  const folderId = typeof target === "string" ? target : target.folderId || "";
  const bookmarkId = typeof target === "object" ? target.bookmarkId || "" : "";
  const sourceFolderId = typeof target === "object" ? target.sourceFolderId || "" : "";
  bookmarkMenuTargetFolderId = folderId;
  bookmarkMenuTargetBookmarkId = bookmarkId;
  bookmarkMenuTargetBookmarkFolderId = sourceFolderId;
  bookmarkMenu.classList.add("is-open");
  bookmarkMenu.setAttribute("aria-hidden", "false");
  bookmarkMenuOpen.hidden = !bookmarkId;
  bookmarkMenuOpenNewTab.hidden = !bookmarkId;
  bookmarkMenuDeleteBookmark.hidden = !bookmarkId;
  bookmarkMenuAddFolder.hidden = !!bookmarkId || !!folderId;
  bookmarkMenuRenameFolder.hidden = !folderId;
  bookmarkMenuDeleteFolder.hidden = !folderId;
  const rect = bookmarkMenu.getBoundingClientRect();
  bookmarkMenu.style.left = `${Math.min(Math.max(clientX, 8), window.innerWidth - rect.width - 8)}px`;
  bookmarkMenu.style.top = `${Math.min(Math.max(clientY, 58), window.innerHeight - rect.height - 8)}px`;
}
function openBookmarkFolderDialog(mode = "new", folderId = "") {
  bookmarkFolderDialogMode = mode;
  bookmarkFolderDialogTargetId = folderId;
  const folder = folderId
    ? getBookmarks().find((entry) => entry.id === folderId && entry.type === "folder")
    : null;
  bookmarkFolderHeading.textContent = mode === "rename" ? "Edit folder name" : "New folder";
  bookmarkFolderName.value = folder?.title || "New folder";
  bookmarkFolderDialog.classList.add("is-open");
  bookmarkFolderDialog.setAttribute("aria-hidden", "false");
  closeBookmarkContextMenu();
  setTimeout(() => {
    bookmarkFolderName.focus();
    bookmarkFolderName.select();
  }, 0);
}
function closeBookmarkFolderDialog() {
  bookmarkFolderDialog.classList.remove("is-open");
  bookmarkFolderDialog.setAttribute("aria-hidden", "true");
  bookmarkFolderDialogMode = "new";
  bookmarkFolderDialogTargetId = "";
}
function closeBookmarkFolderPopover() {
  activeBookmarkFolderId = "";
  bookmarkFolderPopover.classList.remove("is-open");
  bookmarkFolderPopover.setAttribute("aria-hidden", "true");
  bookmarkFolderPopover.innerHTML = "";
  renderBookmarks();
}
function positionBookmarkFolderPopover(folderElement) {
  const rect = folderElement.getBoundingClientRect();
  const width = Math.min(isSideProxyBar() ? 200 : 160, window.innerWidth - 16);
  bookmarkFolderPopover.style.width = `${width}px`;
  const height = bookmarkFolderPopover.offsetHeight;
  if (isSideProxyBar()) {
    const left =
      document.body.dataset.proxyBarPosition === "right" ? rect.left - width - 8 : rect.right + 8;
    const top = rect.top + rect.height / 2 - Math.min(height, rect.height) / 2;
    bookmarkFolderPopover.style.left = `${Math.min(Math.max(left, 8), window.innerWidth - width - 8)}px`;
    bookmarkFolderPopover.style.top = `${Math.min(Math.max(top, 8), window.innerHeight - height - 8)}px`;
    return;
  }
  const left = Math.min(Math.max(rect.left, 8), window.innerWidth - width - 8);
  bookmarkFolderPopover.style.left = `${left}px`;
  bookmarkFolderPopover.style.top = `${rect.bottom + 4}px`;
}
function openBookmarkFolderPopover(folderId, folderElement = getBookmarkElement(folderId)) {
  const folder = getBookmarks().find((entry) => entry.id === folderId && entry.type === "folder");
  if (!folder || !folderElement) return;
  activeBookmarkFolderId = folderId;
  bookmarkFolderPopover.innerHTML = "";
  const children = folder.children || [];
  if (!children.length) {
    const empty = document.createElement("div");
    empty.className = "bookmark-folder-empty";
    empty.textContent = "Drag a tab here";
    bookmarkFolderPopover.appendChild(empty);
  } else {
    const list = document.createElement("div");
    list.className = "bookmark-folder-list";
    for (const bookmark of children) {
      const row = renderBookmarkButton(bookmark, { child: true, folderId });
      list.appendChild(row);
    }
    bookmarkFolderPopover.appendChild(list);
  }
  bookmarkFolderPopover.classList.add("is-open");
  bookmarkFolderPopover.setAttribute("aria-hidden", "false");
  positionBookmarkFolderPopover(folderElement);
  renderBookmarks();
}
function toggleBookmarkFolderPopover(folderId, folderElement) {
  if (activeBookmarkFolderId === folderId && bookmarkFolderPopover.classList.contains("is-open")) {
    closeBookmarkFolderPopover();
    return;
  }
  openBookmarkFolderPopover(folderId, folderElement);
}
function getTabDisplayUrl(tab) {
  if (!tab?.url || tab.url === proxyConfig.internal.newTab || tab.url === "about:blank")
    return proxyConfig.internal.newTab;
  if (tab.url === proxyConfig.internal.history) return proxyConfig.internal.history;
  if (tab.url === proxyConfig.internal.settings) return proxyConfig.internal.settings;
  return canonicalizeVisibleUrl(tab.url);
}
function getTabTooltipWebsite(displayUrl = "") {
  if (!displayUrl || displayUrl === proxyConfig.internal.newTab) return "site://new";
  if (displayUrl === proxyConfig.internal.history) return "site://history";
  if (displayUrl === proxyConfig.internal.settings) return "Settings";
  try {
    const parsedUrl = new URL(displayUrl);
    return parsedUrl.hostname.replace(/^www\./, "") || displayUrl;
  } catch {
    return displayUrl;
  }
}
function setTabTooltipContent(tab) {
  const displayUrl = getTabDisplayUrl(tab);
  const tooltipTitle = tab?.title || getTabTitle(displayUrl);
  const tooltipWebsite = getTabTooltipWebsite(displayUrl);
  tabTooltip.innerHTML = "";
  const title = document.createElement("div");
  title.className = "proxy-tab-tooltip-title";
  title.textContent = tooltipTitle;
  const url = document.createElement("div");
  url.className = "proxy-tab-tooltip-url";
  url.textContent = tooltipWebsite;
  tabTooltip.appendChild(title);
  tabTooltip.appendChild(url);
  if (tab?.audible || tab?.muted) {
    const audioStatus = document.createElement("div");
    audioStatus.className = "proxy-tab-tooltip-status";
    const icon = document.createElement("i");
    icon.innerHTML = audioSvg(tab.muted);
    const label = document.createElement("span");
    label.textContent = tab.muted ? "This tab is muted" : "This tab is playing audio";
    audioStatus.appendChild(icon);
    audioStatus.appendChild(label);
    tabTooltip.appendChild(audioStatus);
  }
}
function positionTabTooltip(tabButton) {
  const rect = tabButton.getBoundingClientRect();
  const sideMode = isSideProxyBar();
  const width = sideMode
    ? Math.min(300, window.innerWidth - 28)
    : Math.min(240, window.innerWidth - 20);
  tabTooltip.style.width = `${width}px`;
  const tooltipRect = tabTooltip.getBoundingClientRect();
  if (sideMode) {
    const barRect = tabbar.getBoundingClientRect();
    const opensLeft = document.body.dataset.proxyBarPosition === "right";
    const left = opensLeft ? barRect.left - tooltipRect.width - 10 : barRect.right + 10;
    const top = Math.min(Math.max(rect.top, 10), window.innerHeight - tooltipRect.height - 10);
    tabTooltip.style.left = `${Math.min(Math.max(left, 10), window.innerWidth - tooltipRect.width - 10)}px`;
    tabTooltip.style.top = `${top}px`;
    return;
  }
  const preferredLeft = rect.left + rect.width / 2 - tooltipRect.width / 2;
  const left = Math.min(Math.max(preferredLeft, 10), window.innerWidth - tooltipRect.width - 10);
  tabTooltip.style.left = `${left}px`;
  tabTooltip.style.top = `${rect.bottom + 5}px`;
}
function showTabTooltip(tab, tabButton) {
  if (draggingTabId || !shouldShowTabTooltip(tab)) return;
  clearTimeout(tabTooltipTimer);
  const show = () => {
    if (draggingTabId || !tabButton.isConnected) return;
    setTabTooltipContent(tab);
    tabTooltipTargetId = tab?.id || "";
    tabTooltip.classList.add("is-visible");
    tabTooltip.setAttribute("aria-hidden", "false");
    positionTabTooltip(tabButton);
  };
  tabTooltipTimer = setTimeout(show, proxyConfig.tooltipDelay);
}
function hideTabTooltip() {
  clearTimeout(tabTooltipTimer);
  tabTooltipTimer = null;
  tabTooltipTargetId = "";
  tabTooltip.classList.remove("is-visible");
  tabTooltip.setAttribute("aria-hidden", "true");
}
function showTabTooltipFromElement(tabElement) {
  if (!tabElement || draggingTabId) return;
  const tabId = tabElement.dataset.tabId || "";
  const tab = tabs.find((entry) => entry.id === tabId);
  if (!shouldShowTabTooltip(tab)) return;
  if (tabTooltipTargetId === tabId && tabTooltip.classList.contains("is-visible")) {
    positionTabTooltip(tabElement);
    return;
  }
  showTabTooltip(tab, tabElement);
}
function shouldShowTabTooltip(tab) {
  return Boolean(tab?.url && !isInternalUrl(tab.url));
}
function openNewProxyTab() {
  createTab(proxyConfig.internal.newTab, getEffectiveProxyBackend());
}
function openAddressSearch(rawInput) {
  const url = normalizeInputToUrl(rawInput);
  if (!url) return;
  if (url === proxyConfig.internal.settings) {
    openSettingsView();
    return;
  }
  const activeTab = getActiveTab();
  const canReuseActiveTab =
    !activeTab?.url ||
    activeTab.url === proxyConfig.internal.newTab ||
    activeTab.url === "about:blank";
  const backend = getBackendForUrl(url, activeTab?.backend || getEffectiveProxyBackend());
  if (canReuseActiveTab) {
    loadNewPage(url, backend);
    return;
  }
  createTab(url, backend, true);
}
function handleNewTabShortcut(event) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "t") {
    event.preventDefault();
    event.stopPropagation();
    openNewProxyTab();
  }
}
function bindFrameShortcuts(frame) {
  try {
    const frameDocument = frame.contentDocument || frame.contentWindow.document;
    if (
      !frameDocument?.documentElement ||
      frameDocument.documentElement.dataset.proxyShortcutsBound === "true"
    ) {
      return;
    }
    frameDocument.documentElement.dataset.proxyShortcutsBound = "true";
    frameDocument.addEventListener("keydown", handleNewTabShortcut, true);
  } catch {}
}
function injectProxyFrameScrollbars(frame) {
  try {
    const frameDocument = frame.contentDocument || frame.contentWindow.document;
    if (
      !frameDocument?.documentElement ||
      frameDocument.getElementById("site-proxy-scrollbars")
    ) {
      return;
    }
    const style = frameDocument.createElement("style");
    style.id = "site-proxy-scrollbars";
    style.textContent = proxyStyle.frameScrollbar;
    (frameDocument.head || frameDocument.documentElement).appendChild(style);
  } catch {}
}
