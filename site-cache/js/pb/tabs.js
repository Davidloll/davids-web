function renderTabs(options = {}) {
  tabsList.innerHTML = "";
  for (let tabIndex = 0; tabIndex < tabs.length; tabIndex += 1) {
    const tab = tabs[tabIndex];
    const hasPinSeparator = tab.pinned && tabs[tabIndex + 1] && !tabs[tabIndex + 1].pinned;
    const tabButton = document.createElement("div");
    tabButton.setAttribute("role", "button");
    tabButton.tabIndex = 0;
    tabButton.className = [
      "proxy-tab",
      tab.pinned ? "is-pinned" : "",
      hasPinSeparator ? "has-pin-separator" : "",
      splitViewTabIds[0] === tab.id ? "is-split-left-tab" : "",
      splitViewTabIds[1] === tab.id ? "is-split-right-tab" : "",
      tab.id === activeTabId ? "is-active" : "",
      tab.id === draggingTabId ? "is-dragging" : "",
      tab.audible ? "is-audible" : "",
      tab.muted ? "is-muted" : "",
    ]
      .filter(Boolean)
      .join(" ");
    tabButton.dataset.tabId = tab.id;
    tabButton.setAttribute("aria-label", tab.pinned ? `${tab.title}, pinned tab` : tab.title);
    const iconWrap = document.createElement("span");
    if (tab.icon) {
      setFaviconTabIcon(iconWrap, tab);
    } else {
      setFallbackTabIcon(iconWrap, tab.url);
    }
    const title = document.createElement("span");
    title.className = "proxy-tab-title";
    title.textContent = tab.title;
    const audioIcon = document.createElement("button");
    audioIcon.type = "button";
    audioIcon.className = "proxy-tab-audio";
    setTabAudioIcon(audioIcon, tab.muted);
    audioIcon.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      proxyAudio?.set(tab, !tab.muted);
      if (!tab.muted) {
        tab.audible = true;
        tab.lastSound = Date.now();
      }
      updateTabAudioElement(tab);
      saveTabSession();
    });
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "proxy-tab-close";
    closeButton.setAttribute("aria-label", "Close tab");
    const closeIcon = document.createElement("i");
    closeIcon.className = "fa-solid fa-xmark";
    closeButton.appendChild(closeIcon);
    closeButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeTab(tab.id);
    });
    const tabActions = document.createElement("span");
    tabActions.className = "proxy-tab-actions";
    tabActions.appendChild(closeButton);
    tabButton.appendChild(iconWrap);
    tabButton.appendChild(title);
    tabButton.appendChild(audioIcon);
    tabButton.appendChild(tabActions);
    tabButton.addEventListener("click", () => {
      if (didDragTab) {
        didDragTab = false;
        return;
      }
      activateTab(tab.id);
    });
    tabButton.addEventListener("auxclick", (event) => {
      if (event.button === 1) {
        event.preventDefault();
        closeTab(tab.id);
      }
    });
    tabButton.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      hideTabTooltip();
      openTabContextMenu(event.clientX, event.clientY, tab.id);
    });
    tabButton.addEventListener("mousedown", (event) => {
      if (event.button === 1) {
        event.preventDefault();
      }
    });
    tabButton.addEventListener("pointerenter", () => showTabTooltip(tab, tabButton));
    tabButton.addEventListener("mouseenter", () => showTabTooltip(tab, tabButton));
    tabButton.addEventListener("mousemove", () => {
      if (tabTooltip.classList.contains("is-visible")) {
        positionTabTooltip(tabButton);
      }
    });
    tabButton.addEventListener("pointerleave", hideTabTooltip);
    tabButton.addEventListener("mouseleave", hideTabTooltip);
    tabButton.addEventListener("focus", () => showTabTooltip(tab, tabButton));
    tabButton.addEventListener("blur", hideTabTooltip);
    tabButton.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.target.closest(".proxy-tab-close, .proxy-tab-audio")) return;
      hideTabTooltip();
      tabDragState = {
        id: tab.id,
        startX: event.clientX,
        startY: event.clientY,
        started: false,
      };
    });
    tabButton.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activateTab(tab.id);
      }
    });
    tabsList.appendChild(tabButton);
  }
  if (options.animate) {
    animateTabShift(options.previousPositions);
  }
  updateSidebarTools();
  scheduleTabSessionSave();
}
tabsList.addEventListener("pointerover", (event) => {
  const tabElement = event.target.closest?.(".proxy-tab");
  if (!tabElement || !tabsList.contains(tabElement) || tabElement.contains(event.relatedTarget))
    return;
  showTabTooltipFromElement(tabElement);
});
tabsList.addEventListener("mouseover", (event) => {
  const tabElement = event.target.closest?.(".proxy-tab");
  if (!tabElement || !tabsList.contains(tabElement) || tabElement.contains(event.relatedTarget))
    return;
  showTabTooltipFromElement(tabElement);
});
tabsList.addEventListener("pointerout", (event) => {
  const tabElement = event.target.closest?.(".proxy-tab");
  if (!tabElement || !tabsList.contains(tabElement) || tabElement.contains(event.relatedTarget))
    return;
  hideTabTooltip();
});
tabsList.addEventListener("mouseout", (event) => {
  const tabElement = event.target.closest?.(".proxy-tab");
  if (!tabElement || !tabsList.contains(tabElement) || tabElement.contains(event.relatedTarget))
    return;
  hideTabTooltip();
});
document.addEventListener("pointermove", (event) => {
  if (!tabDragState) return;
  if (
    !tabDragState.started &&
    Math.hypot(event.clientX - tabDragState.startX, event.clientY - tabDragState.startY) >= 6
  ) {
    startTabPointerDrag(tabDragState.id, event);
  }
  if (!tabDragState?.started) return;
  event.preventDefault();
  scheduleTabDragMove(event.clientX, event.clientY);
});
document.addEventListener("pointerup", () => {
  finishTabPointerDrag();
});
document.addEventListener("pointercancel", () => {
  finishTabPointerDrag();
});
document.addEventListener("pointermove", (event) => {
  if (!bookmarkDragState) return;
  if (
    !bookmarkDragState.started &&
    Math.hypot(
      event.clientX - bookmarkDragState.startX,
      event.clientY - bookmarkDragState.startY,
    ) >= 6
  ) {
    startBookmarkDrag(bookmarkDragState.id, event);
  }
  if (!bookmarkDragState?.started) return;
  event.preventDefault();
  scheduleBookmarkDragMove(event.clientX, event.clientY);
});
document.addEventListener("pointerup", () => {
  finishBookmarkDrag();
});
document.addEventListener("pointercancel", () => {
  finishBookmarkDrag();
});
function createTab(
  url = proxyConfig.internal.newTab,
  backend = getEffectiveProxyBackend(),
  activate = true,
) {
  if (url === proxyConfig.internal.settings) {
    const activeTab = getActiveTab();
    if (activeTab) {
      openSettingsView();
      return activeTab;
    }
    url = proxyConfig.internal.newTab;
  }
  backend = isInternalUrl(url) ? getEffectiveProxyBackend(backend) : getBackendForUrl(url, backend);
  const tab = {
    id: `tab${nextTabId++}`,
    url,
    backend,
    title: getTabTitle(url),
    icon: getTabIcon(url),
    audible: false,
    muted: false,
    pinned: false,
  };
  tabs.push(tab);
  createTabFrame(tab);
  if (activate) {
    activateTab(tab.id);
  } else {
    renderTabs();
  }
  return tab;
}
function updateActiveTab(url, backend) {
  const tab = getActiveTab();
  if (!tab) return;
  backend = isInternalUrl(url) ? getEffectiveProxyBackend(backend) : getBackendForUrl(url, backend);
  const urlChanged = tab.url !== url;
  tab.url = url;
  tab.backend = backend;
  if (urlChanged) {
    tab.pageTitle = "";
    tab.icon = getTabIcon(url);
  }
  tab.title = tab.pageTitle || getTabTitle(url);
  tab.icon = tab.icon || getTabIcon(url);
  renderTabs();
  updateBookmarkToggle();
  proxyAudio?.update();
}
function openInternalPage(url, unlocked = false) {
  if (url === proxyConfig.internal.settings) {
    openSettingsView();
    return;
  }
  const tab = getActiveTab();
  if (!tab) return;
  clearSplitView(false);
  tab.url = url;
  tab.title = getTabTitle(url);
  tab.icon = getTabIcon(url);
  if (url === proxyConfig.internal.history && unlocked) {
    tab.historyUnlocked = true;
  }
  setActiveFrame(tab);
  renderTabs();
  updateBookmarkToggle();
  proxyAudio?.update();
  updateSearchBars(url);
  hideLoadingBar();
  if (url === proxyConfig.internal.newTab) {
    tab.historyUnlocked = false;
    setHistoryPage(false);
    setSettingsPage(false);
    setNewTabPage(true);
    return;
  }
  if (url === proxyConfig.internal.history) {
    setNewTabPage(false);
    setSettingsPage(false);
    setHistoryPage(true);
    window.renderHistoryPage?.();
    return;
  }
  if (/^site:\/\/exten/.test(String(url || "").toLowerCase())) {
    tab.url = proxyConfig.internal.newTab;
    tab.title = getTabTitle(tab.url);
    tab.icon = getTabIcon(tab.url);
    renderTabs();
    updateSearchBars(tab.url);
    setNewTabPage(true);
    setHistoryPage(false);
    setSettingsPage(false);
    return;
  }
}
function openHistoryTab(unlocked = false) {
  const tab = getActiveTab();
  if (tab?.url && !isInternalUrl(tab.url) && tab.frame?.getAttribute("src")) {
    const historyTab = createTab(proxyConfig.internal.history, getEffectiveProxyBackend(), false);
    historyTab.historyUnlocked = !!unlocked;
    activateTab(historyTab.id);
    return;
  }
  openInternalPage(proxyConfig.internal.history, unlocked);
}
window.openHistoryTab = openHistoryTab;
function openSettingsTab() {
  openSettingsView();
}
window.openSettingsTab = openSettingsTab;
function activateTab(tabId, load = true) {
  const tab = tabs.find((entry) => entry.id === tabId);
  if (!tab) return;
  if (splitViewTabIds.length && !splitViewTabIds.includes(tab.id)) {
    clearSplitView(false);
  }
  activeTabId = tab.id;
  setActiveFrame(tab);
  reloadInspectPanel();
  renderTabs();
  updateBookmarkToggle();
  proxyAudio?.apply(tab);
  proxyAudio?.update();
  if (!load) return;
  if (isInternalUrl(tab.url)) {
    clearSplitView(false);
    openInternalPage(tab.url, !!tab.historyUnlocked);
    return;
  }
  if (!tab.url) {
    openInternalPage(proxyConfig.internal.newTab);
    return;
  }
  setNewTabPage(false);
  setHistoryPage(false);
  setSettingsPage(false);
  currentBackend = getBackendForUrl(tab.url, tab.backend || getEffectiveProxyBackend());
  updateSearchBars(tab.url);
  if (!tab.frame?.getAttribute("src")) {
    loadNewPage(tab.url, currentBackend);
  }
}
function closeTab(tabId, animate = true) {
  if (!tabs.some((tab) => tab.id === tabId)) return;                 
  if (tabs.length <= 1) {
    const currentTab = getActiveTab();
    currentTab?.frame?.remove();
    tabs = [];
    const tab = createTab(proxyConfig.internal.newTab, getEffectiveProxyBackend(), false);
    activeTabId = tab.id;
    setActiveFrame(tab);
    openInternalPage(proxyConfig.internal.newTab);
    renderTabs();
    return;
  }
  const tabElement = getTabElement(tabId);
  if (animate && tabElement && !tabElement.classList.contains("is-closing")) {
    tabElement.classList.add("is-closing");
    const closingSplitTab = splitViewTabIds.includes(tabId);
    if (closingSplitTab) animateSplitTabClose(tabId);
    setTimeout(() => closeTab(tabId, false), closingSplitTab ? 240 : 130);
    return;
  }
  const index = tabs.findIndex((tab) => tab.id === tabId);
  if (index === -1) return;
  const closingActiveTab = tabId === activeTabId;
  const closingSplitTab = splitViewTabIds.includes(tabId);
  const remainingSplitTab = closingSplitTab ? getSplitTabs().find((tab) => tab.id !== tabId) : null;
  tabs[index].frame?.remove();
  tabs.splice(index, 1);
  if (closingSplitTab) {
    clearSplitView(false);
    if (remainingSplitTab && tabs.some((tab) => tab.id === remainingSplitTab.id)) {
      activateTab(remainingSplitTab.id, false);
      return;
    }
  }
  if (closingActiveTab) {
    const nextTab = tabs[Math.min(index, tabs.length - 1)];
    activateTab(nextTab.id);
  } else {
    if (splitViewTabIds.length) {
      syncSplitFrames();
    }
    renderTabs();
    updateBookmarkToggle();
  }
}
