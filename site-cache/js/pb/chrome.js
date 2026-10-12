window.fn_reload = function () {
  try {
    if (document.body.classList.contains("proxy-settings-page")) {
      hydrateProxySettingsPage();
      return;
    }
    if (currentBackend === "studying") {
      iframe.contentWindow.postMessage(
        {
          type: proxyConfig.messages.hostReload,
        },
        location.origin,
      );
      return;
    }
    iframe.contentWindow.location.reload();
  } catch {
    console.error("reload:", error);
  }
};
window.goback = function () {
  try {
    if (document.body.classList.contains("proxy-settings-page")) {
      activateTab(activeTabId);
      return;
    }
    if (currentBackend === "studying") {
      iframe.contentWindow.postMessage(
        {
          type: proxyConfig.messages.hostBack,
        },
        location.origin,
      );
      return;
    }
    iframe.contentWindow.history.back();
  } catch {
    console.error("failed, go back:", error);
  }
};
window.rotatetozone = function () {
  try {
    if (currentBackend === "studying") {
      iframe.contentWindow.postMessage(
        {
          type: proxyConfig.messages.hostForward,
        },
        location.origin,
      );
      return;
    }
    iframe.contentWindow.history.forward();
  } catch {
    console.error("failed, go forward:", error);
  }
};
function openInspect() {
  const isOpen = document.body.classList.toggle("inspect-panel-open");
  inspectPanel.setAttribute("aria-hidden", String(!isOpen));
  inspectButton?.classList.toggle("is-active", isOpen);
  if (isOpen && !liteConsole && !inspectDevtoolsFrame.src) {
    loadInspectFrame();
  }
  if (isOpen && liteConsole) hookLiteConsole();
}
window.toggleInspect = openInspect;
window.toggleEruda = window.toggleInspect;
inspectButton?.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  openInspect();
});
inspectResizeHandle?.addEventListener("pointerdown", startInspectResize);
inspectResizeHandle?.addEventListener("keydown", handleInspectResizeKeydown);
document.addEventListener("pointermove", moveInspectResize, { passive: false });
new ResizeObserver(() => {
  document.body.style.setProperty("--proxy-footer-height", `${footer.offsetHeight}px`);
}).observe(footer);
document.addEventListener("pointerup", finishInspectResize);
document.addEventListener("pointercancel", finishInspectResize);
footerToggle.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  toggleFooterBar();
});
sideCollapseToggle?.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  localStorage.setItem(
    proxyConfig.storage.sidebarCollapsed,
    isSidebarCollapsed() ? "false" : "true",
  );
  applySidebarCollapsed();
});
var sidebarHandle = document.createElement("div");
sidebarHandle.id = "proxy-sidebar-handle";
sidebarHandle.setAttribute("role", "separator");
sidebarHandle.setAttribute("aria-orientation", "vertical");
sidebarHandle.setAttribute("aria-label", "Drag to collapse or expand the sidebar");
proxySidebarRail.appendChild(sidebarHandle);
var sidebarDragState = null;
function measureSidebarWidth(variable) {
  const probe = document.createElement("div");
  probe.style.cssText = `position:fixed;visibility:hidden;width:var(${variable});`;
  document.body.appendChild(probe);
  const width = probe.getBoundingClientRect().width;
  probe.remove();
  return width;
}
function setSidebarDragWidth(width) {
  const state = sidebarDragState;
  const clamped = Math.min(state.full, Math.max(state.collapsed, width));
  state.width = clamped;
  document.body.style.setProperty("--proxy-side-width", `${clamped}px`);
  document.body.style.setProperty("--proxy-side-collapsed-width", `${clamped}px`);
  proxySidebarRail.style.width = `${clamped}px`;
  proxySidebarRail.style.maxWidth = `${clamped}px`;
  document.body.classList.toggle(
    "proxy-sidebar-collapsed",
    clamped < state.collapsed + (state.full - state.collapsed) * 0.5,
  );
}
function finishSidebarDrag(collapsed) {
  const panels = [
    ...document.querySelectorAll("#frames, #newtab-landing, #history-page, #settings-page"),
  ].filter((panel) => panel.getClientRects().length);
  const before = panels.map((panel) => panel.getBoundingClientRect().left);
  sidebarDragState = null;
  document.body.classList.remove("proxy-sidebar-resizing");
  void proxySidebarRail.offsetWidth;
  document.body.style.removeProperty("--proxy-side-width");
  document.body.style.removeProperty("--proxy-side-collapsed-width");
  proxySidebarRail.style.width = "";
  proxySidebarRail.style.maxWidth = "";
  document.body.classList.toggle("proxy-sidebar-collapsed", collapsed);
  localStorage.setItem(proxyConfig.storage.sidebarCollapsed, collapsed ? "true" : "false");
  panels.forEach((panel, index) => {
    const offset = before[index] - panel.getBoundingClientRect().left;
    if (!offset) return;
    panel.sidebarAnimation?.cancel();
    panel.sidebarAnimation = panel.animate(
      [{ transform: `translateX(${offset}px)` }, { transform: "translateX(0)" }],
      { duration: 240, easing: "cubic-bezier(.22, 1, .36, 1)" },
    );
  });
  applySidebarCollapsed();
}
sidebarHandle.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || !isSideProxyBar()) return;
  event.preventDefault();
  const full = measureSidebarWidth("--proxy-side-width");
  const collapsed = measureSidebarWidth("--proxy-side-collapsed-width");
  sidebarDragState = {
    startX: event.clientX,
    startWidth: proxySidebarRail.getBoundingClientRect().width,
    full,
    collapsed,
    width: proxySidebarRail.getBoundingClientRect().width,
    moved: false,
    direction: document.body.dataset.proxyBarPosition === "right" ? -1 : 1,
  };
  sidebarHandle.setPointerCapture(event.pointerId);
  hideTabTooltip();
  closeBookmarkFolderPopover();
});
sidebarHandle.addEventListener("pointermove", (event) => {
  const state = sidebarDragState;
  if (!state) return;
  const delta = (event.clientX - state.startX) * state.direction;
  if (!state.moved) {
    if (Math.abs(delta) < 3) return;
    state.moved = true;
    document.body.classList.add("proxy-sidebar-resizing");
  }
  setSidebarDragWidth(state.startWidth + delta);
});
function endSidebarDrag() {
  const state = sidebarDragState;
  if (!state) return;
  if (!state.moved) {
    sidebarDragState = null;
    return;
  }
  finishSidebarDrag(state.width < state.collapsed + (state.full - state.collapsed) * 0.5);
}
sidebarHandle.addEventListener("pointerup", endSidebarDrag);
sidebarHandle.addEventListener("pointercancel", endSidebarDrag);
sidebarHandle.addEventListener("lostpointercapture", endSidebarDrag);
sidebarHandle.addEventListener("dblclick", () => {
  if (!isSideProxyBar()) return;
  localStorage.setItem(
    proxyConfig.storage.sidebarCollapsed,
    isSidebarCollapsed() ? "false" : "true",
  );
  applySidebarCollapsed();
});
footer.addEventListener("click", (event) => {
  if (event.target === footerToggle || footerToggle.contains(event.target)) {
    return;
  }
  event.stopPropagation();
});
searchInputFooter.addEventListener("click", (event) => {
  event.stopPropagation();
  if (isSideProxyBar() && isSidebarCollapsed()) {
    event.preventDefault();
    return;
  }
  focusFooterSearch();
  searchInputFooter.select();
});
searchInputFooter.addEventListener("input", () => {
  if (searchInputFooter.value.trim()) {
    searchInputFooter.classList.remove("is-internal");
  }
});
searchInputFooter.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    openAddressSearch(searchInputFooter.value.trim());
    hideSearchBox();
  } else if (event.key === "Escape") {
    hideSearchBox();
  }
});
newTabButton.addEventListener("click", () => {
  openNewProxyTab();
});
splitDivider?.addEventListener("pointerdown", startSplitResize);
splitDivider?.addEventListener("keydown", handleSplitDividerKeydown);
frames?.addEventListener("transitionend", (event) => {
  if (event.propertyName === "grid-template-columns") {
    scheduleSplitFrameResize();
  }
});
window.addEventListener("resize", () => {
  scheduleSplitFrameResize();
  if (document.body.classList.contains("inspect-panel-open")) {
    applyInspectWidth(getInspectWidth());
  }
});
document.addEventListener("pointermove", moveSplitResize, { passive: false });
document.addEventListener("pointerup", finishSplitResize);
document.addEventListener("pointercancel", finishSplitResize);
tabMenuPin?.addEventListener("click", () => {
  if (tabMenuTargetTabId) {
    toggleTabPinned(tabMenuTargetTabId);
  }
  closeTabContextMenu();
});
tabMenuSplit?.addEventListener("click", async () => {
  const targetTab = tabs.find((tab) => tab.id === tabMenuTargetTabId);
  const activeTab = getActiveTab();
  if (targetTab && activeTab && targetTab.id !== activeTab.id) {
    setSplitView(activeTab.id, targetTab.id);
  } else if (targetTab) {
    await splitTabWithDuckDuckGo(targetTab.id);
  }
  closeTabContextMenu();
});
tabMenuUnsplit?.addEventListener("click", () => {
  clearSplitView();
  setActiveFrame(getActiveTab());
  closeTabContextMenu();
});
tabMenuSwap?.addEventListener("click", () => {
  if (splitViewTabIds.length === 2) {
    splitViewTabIds = [splitViewTabIds[1], splitViewTabIds[0]];
    syncSplitFrames();
    renderTabs();
  }
  closeTabContextMenu();
});
bookmarkToggle.addEventListener("click", () => {
  toggleActiveBookmark();
});
bookmarkbar.addEventListener("contextmenu", (event) => {
  if (event.target.closest(".bookmark-item")) return;
  event.preventDefault();
  openBookmarkContextMenu(event.clientX, event.clientY);
});
bookmarkMenuOpen.addEventListener("click", () => {
  openBookmarkMenuTarget(false);
});
bookmarkMenuOpenNewTab.addEventListener("click", () => {
  openBookmarkMenuTarget(true);
});
bookmarkMenuAddFolder.addEventListener("click", () => {
  openBookmarkFolderDialog("new");
});
bookmarkMenuRenameFolder.addEventListener("click", () => {
  if (bookmarkMenuTargetFolderId) {
    openBookmarkFolderDialog("rename", bookmarkMenuTargetFolderId);
  }
});
bookmarkMenuDeleteFolder.addEventListener("click", () => {
  if (bookmarkMenuTargetFolderId) {
    deleteBookmarkFolder(bookmarkMenuTargetFolderId);
    closeBookmarkContextMenu();
  }
});
bookmarkMenuDeleteBookmark.addEventListener("click", () => {
  if (bookmarkMenuTargetBookmarkId) {
    deleteBookmarkById(bookmarkMenuTargetBookmarkId, bookmarkMenuTargetBookmarkFolderId);
    closeBookmarkContextMenu();
  }
});
bookmarkFolderForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = bookmarkFolderName.value.trim() || "New folder";
  if (bookmarkFolderDialogMode === "rename" && bookmarkFolderDialogTargetId) {
    renameBookmarkFolder(bookmarkFolderDialogTargetId, name);
  } else {
    createBookmarkFolder(name);
  }
  closeBookmarkFolderDialog();
});
bookmarkFolderCancel.addEventListener("click", closeBookmarkFolderDialog);
newTabShortcutForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const url = normalizeNewTabShortcutUrl(newTabShortcutUrl.value);
  if (!url) {
    newTabShortcutUrl.setCustomValidity("Enter a valid website URL");
    newTabShortcutUrl.reportValidity();
    return;
  }
  const name =
    newTabShortcutName.value.trim().slice(0, 40) || new URL(url).hostname.replace(/^www\./, "");
  const shortcuts = getNewTabShortcuts();
  shortcuts.push({ id: makeId("shortcut"), name, url });
  saveNewTabShortcuts(shortcuts);
  closeNewTabShortcutDialog();
});
newTabShortcutUrl?.addEventListener("input", () => {
  newTabShortcutUrl.setCustomValidity("");
});
newTabShortcutCancel?.addEventListener("click", closeNewTabShortcutDialog);
newTabShortcutDialog?.addEventListener("pointerdown", (event) => {
  if (event.target === newTabShortcutDialog) {
    closeNewTabShortcutDialog();
  }
});
bookmarkDeleteButton.addEventListener("click", deleteEditedBookmark);
bookmarkEditorForm.addEventListener("submit", (event) => {
  event.preventDefault();
  deleteEditedBookmark();
});
document.addEventListener(
  "pointerdown",
  (event) => {
    if (!bookmarkEditor.classList.contains("is-open")) return;
    if (bookmarkEditor.contains(event.target)) return;
    closeBookmarkEditor();
  },
  true,
);
document.addEventListener(
  "pointerdown",
  (event) => {
    if (tabMenu?.classList.contains("is-open") && !tabMenu.contains(event.target)) {
      closeTabContextMenu();
    }
    if (bookmarkMenu.classList.contains("is-open") && !bookmarkMenu.contains(event.target)) {
      closeBookmarkContextMenu();
    }
    if (
      bookmarkFolderDialog.classList.contains("is-open") &&
      !bookmarkFolderDialog.contains(event.target)
    ) {
      closeBookmarkFolderDialog();
    }
    if (
      bookmarkFolderPopover.classList.contains("is-open") &&
      !bookmarkFolderPopover.contains(event.target) &&
      !bookmarkMenu.contains(event.target) &&
      !bookmarkFolderDialog.contains(event.target) &&
      !event.target.closest(".bookmark-folder")
    ) {
      closeBookmarkFolderPopover();
    }
  },
  true,
);
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (newTabShortcutDialog.classList.contains("is-open")) {
    closeNewTabShortcutDialog();
  }
});
document.addEventListener("keydown", handleNewTabShortcut, true);
document.getElementById("historyPageClearBtn").addEventListener("click", () => {
  clearHistory();
});
