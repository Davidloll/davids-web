function getActiveTab() {
  return tabs.find((tab) => tab.id === activeTabId) || null;
}
function getStoredTab(tab) {
  return {
    id: tab.id,
    url: tab.url,
    backend: tab.backend,
    title: tab.title,
    icon: tab.icon,
    muted: !!tab.muted,
    pinned: !!tab.pinned,
    historyUnlocked: !!tab.historyUnlocked,
  };
}
function saveTabSession() {
  clearTimeout(tabSessionSaveTimer);
  tabSessionSaveTimer = null;
  if (!tabs.length) {
    localStorage.removeItem(proxyConfig.storage.tabSession);
    return;
  }
  try {
    localStorage.setItem(
      proxyConfig.storage.tabSession,
      JSON.stringify({
        activeTabId,
        tabs: tabs.slice(0, 50).map(getStoredTab),
      }),
    );
  } catch {}
}
function scheduleTabSessionSave() {
  clearTimeout(tabSessionSaveTimer);
  tabSessionSaveTimer = setTimeout(saveTabSession, 0);
}
function getSavedTabSession() {
  try {
    const saved = JSON.parse(localStorage.getItem(proxyConfig.storage.tabSession) || "null");
    return saved && Array.isArray(saved.tabs) ? saved : null;
  } catch {
    localStorage.removeItem(proxyConfig.storage.tabSession);
    return null;
  }
}
function restoreTabSession() {
  const saved = getSavedTabSession();
  if (!saved?.tabs.length) return false;
  const restoredTabs = [];
  const usedIds = new Set();
  let highestTabId = 0;
  for (const savedTab of saved.tabs.slice(0, 50)) {
    const rawUrl = typeof savedTab?.url === "string" ? savedTab.url : "";
    if (normalizeInternalUrl(rawUrl) === proxyConfig.internal.settings) {
      continue;
    }
    const url =
      isInternalUrl(rawUrl) || /^https?:\/\//i.test(rawUrl) ? rawUrl : proxyConfig.internal.newTab;
    let id =
      typeof savedTab?.id === "string" && /^tab\d+$/.test(savedTab.id)
        ? savedTab.id
        : `tab${nextTabId++}`;
    while (usedIds.has(id)) id = `tab${nextTabId++}`;
    usedIds.add(id);
    highestTabId = Math.max(highestTabId, Number.parseInt(id.slice(3), 10) || 0);
    const backend = isInternalUrl(url)
      ? getEffectiveProxyBackend(savedTab.backend)
      : getBackendForUrl(url, savedTab.backend || getEffectiveProxyBackend());
    const title =
      typeof savedTab.title === "string" && savedTab.title.trim()
        ? savedTab.title.trim().slice(0, 240)
        : getTabTitle(url);
    const icon = isInternalUrl(url)
      ? getTabIcon(url)
      : getSafeTabIcon(savedTab.icon) || getTabIcon(url);
    restoredTabs.push({
      id,
      url,
      backend,
      title,
      icon,
      audible: false,
      muted: !!savedTab.muted,
      pinned: !!savedTab.pinned,
      historyUnlocked: !!savedTab.historyUnlocked,
    });
  }
  if (!restoredTabs.length) return false;
  restoredTabs.sort((left, right) => Number(right.pinned) - Number(left.pinned));
  tabs = [];
  for (const tab of restoredTabs) {
    tabs.push(tab);
    createTabFrame(tab);
  }
  nextTabId = Math.max(nextTabId, highestTabId + 1);
  activeTabId = usedIds.has(saved.activeTabId) ? saved.activeTabId : tabs[0].id;
  splitViewTabIds = [];
  currentBackend = getActiveTab()?.backend || getEffectiveProxyBackend();
  setActiveFrame(getActiveTab());
  renderTabs();
  return true;
}
function getTabByFrameWindow(frameWindow) {
  return tabs.find((tab) => tab.frame?.contentWindow === frameWindow) || null;
}
function getSplitTabs() {
  return splitViewTabIds
    .map((id) => tabs.find((tab) => tab.id === id))
    .filter((tab) => tab && tab.url && !isInternalUrl(tab.url));
}
function clampSplitRatio(value) {
  return Math.min(0.8, Math.max(0.2, Number(value) || 0.5));
}
function getSavedSplitRatio() {
  return clampSplitRatio(parseFloat(localStorage.getItem(proxyConfig.storage.splitRatio) || "0.5"));
}
function notifySplitFrameResize(frame) {
  if (!frame) return;
  try {
    frame.contentWindow?.dispatchEvent(new Event("resize"));
    const innerFrame = frame.contentDocument?.getElementById("proxy-frame");
    innerFrame?.contentWindow?.dispatchEvent(new Event("resize"));
  } catch {}
}
function scheduleSplitFrameResize() {
  if (splitResizeFrame) cancelAnimationFrame(splitResizeFrame);
  splitResizeFrame = requestAnimationFrame(() => {
    splitResizeFrame = requestAnimationFrame(() => {
      splitResizeFrame = 0;
      getSplitTabs().forEach((tab) => notifySplitFrameResize(tab.frame));
    });
  });
}
function syncSplitFrameResizeObservers() {
  splitFrameResizeObserver?.disconnect();
  if (!document.body.classList.contains("split-view")) return;
  for (const tab of getSplitTabs()) {
    if (tab.frame) splitFrameResizeObserver?.observe(tab.frame);
  }
}
function applySplitRatio(value, persist = false) {
  splitRatio = clampSplitRatio(value);
  frames?.style.setProperty("--split-left", `${splitRatio * 100}%`);
  splitDivider?.setAttribute("aria-valuenow", String(Math.round(splitRatio * 100)));
  scheduleSplitFrameResize();
  if (persist) {
    localStorage.setItem(proxyConfig.storage.splitRatio, String(splitRatio));
  }
}
function resizeSplitFromPointer(clientX) {
  const bounds = frames?.getBoundingClientRect();
  if (!bounds?.width) return;
  applySplitRatio((clientX - bounds.left) / bounds.width);
}
function startSplitResize(event) {
  if (!document.body.classList.contains("split-view") || event.button !== 0) return;
  event.preventDefault();
  splitResizeState = { pointerId: event.pointerId };
  document.body.classList.add("split-resizing");
  splitDivider?.setPointerCapture?.(event.pointerId);
  resizeSplitFromPointer(event.clientX);
}
function moveSplitResize(event) {
  if (!splitResizeState || event.pointerId !== splitResizeState.pointerId) return;
  event.preventDefault();
  resizeSplitFromPointer(event.clientX);
}
function finishSplitResize(event) {
  if (
    !splitResizeState ||
    (event?.pointerId != null && event.pointerId !== splitResizeState.pointerId)
  )
    return;
  const pointerId = splitResizeState.pointerId;
  splitResizeState = null;
  document.body.classList.remove("split-resizing");
  if (splitDivider?.hasPointerCapture?.(pointerId)) {
    splitDivider.releasePointerCapture(pointerId);
  }
  applySplitRatio(splitRatio, true);
}
function handleSplitDividerKeydown(event) {
  let nextRatio = splitRatio;
  if (event.key === "ArrowLeft") nextRatio -= 0.05;
  else if (event.key === "ArrowRight") nextRatio += 0.05;
  else if (event.key === "Home") nextRatio = 0.2;
  else if (event.key === "End") nextRatio = 0.8;
  else return;
  event.preventDefault();
  applySplitRatio(nextRatio, true);
}
function clearSplitView(render = true) {
  splitViewTabIds = [];
  splitResizeState = null;
  document.body.classList.remove("split-view", "split-resizing", "split-closing");
  splitFrameResizeObserver?.disconnect();
  frames?.style.removeProperty("grid-template-columns");
  for (const tab of tabs) {
    tab.frame?.classList.remove(
      "is-split-left",
      "is-split-right",
      "is-split-closing",
      "is-split-expanding",
    );
  }
  if (render) {
    renderTabs();
  }
  updateSidebarTools();
}
function syncSplitFrames() {
  const splitTabs = getSplitTabs();
  const splitReady = splitTabs.length === 2 && splitTabs[0].id !== splitTabs[1].id;
  document.body.classList.toggle("split-view", splitReady);
  if (!splitReady) {
    document.body.classList.remove("split-view");
    splitFrameResizeObserver?.disconnect();
    for (const tab of tabs) {
      tab.frame?.classList.remove("is-split-left", "is-split-right");
    }
    updateSidebarTools();
    return false;
  }
  const [leftTab, rightTab] = splitTabs;
  applySplitRatio(splitRatio);
  for (const tab of tabs) {
    if (!tab.frame) continue;
    tab.frame.classList.toggle("is-active", false);
    tab.frame.classList.toggle("is-split-left", tab.id === leftTab.id);
    tab.frame.classList.toggle("is-split-right", tab.id === rightTab.id);
  }
  syncSplitFrameResizeObservers();
  scheduleSplitFrameResize();
  updateSidebarTools();
  return true;
}
function animateSplitTabClose(tabId) {
  const splitTabs = getSplitTabs();
  const closingTab = splitTabs.find((tab) => tab.id === tabId);
  const remainingTab = splitTabs.find((tab) => tab.id !== tabId);
  const closingFrame = closingTab?.frame;
  const remainingFrame = remainingTab?.frame;
  const bounds = frames?.getBoundingClientRect();
  if (!closingFrame || !remainingFrame || !bounds?.width) return;
  const leftFrame = splitTabs[0]?.frame;
  const rightFrame = splitTabs[1]?.frame;
  const leftWidth = leftFrame?.getBoundingClientRect().width || bounds.width * splitRatio;
  const rightWidth = rightFrame?.getBoundingClientRect().width || bounds.width - leftWidth;
  const dividerWidth = splitDivider?.getBoundingClientRect().width || 8;
  frames.style.gridTemplateColumns = `${leftWidth}px ${dividerWidth}px ${rightWidth}px`;
  frames.getBoundingClientRect();
  document.body.classList.add("split-closing");
  closingFrame.classList.add("is-split-closing");
  remainingFrame.classList.add("is-split-expanding");
  requestAnimationFrame(() => {
    frames.style.gridTemplateColumns =
      closingTab.id === splitTabs[0].id ? `0px 0px ${bounds.width}px` : `${bounds.width}px 0px 0px`;
  });
}
function updateSidebarTools() {}
function setSplitView(leftTabId, rightTabId) {
  if (!leftTabId || !rightTabId || leftTabId === rightTabId) return;
  const leftTab = tabs.find((tab) => tab.id === leftTabId);
  const rightTab = tabs.find((tab) => tab.id === rightTabId);
  if (!leftTab || !rightTab || isInternalUrl(leftTab.url) || isInternalUrl(rightTab.url)) return;
  splitViewTabIds = [leftTab.id, rightTab.id];
  setNewTabPage(false);
  setHistoryPage(false);
  setSettingsPage(false);
  createTabFrame(leftTab);
  createTabFrame(rightTab);
  syncSplitFrames();
  renderTabs();
  updateSidebarTools();
}
async function splitTabWithDuckDuckGo(tabId) {
  const leftTab = tabs.find((tab) => tab.id === tabId) || getActiveTab();
  if (!leftTab || isInternalUrl(leftTab.url)) return;
  const backend = getBackendForUrl(
    proxyConfig.splitUrl,
    leftTab.backend || currentBackend || getEffectiveProxyBackend(),
  );
  const rightTab = createTab(proxyConfig.splitUrl, backend, false);
  const previousFrame = iframe;
  const rightFrame = createTabFrame(rightTab);
  rightTab.url = normalizeInputToUrl(proxyConfig.splitUrl);
  rightTab.backend = backend;
  rightTab.title = getTabTitle(rightTab.url);
  rightTab.icon = getTabIcon(rightTab.url);
  iframe = rightFrame;
  configureIframeForBackend(backend);
  try {
    await ensureStudyingHost();
    rightFrame.contentWindow.postMessage(
      {
        type: proxyConfig.messages.hostLoad,
        url: rightTab.url,
      },
      location.origin,
    );
  } finally {
    iframe = previousFrame || leftTab.frame || iframe;
  }
  setSplitView(leftTab.id, rightTab.id);
  currentBackend = leftTab.backend || backend;
  updateSearchBars(leftTab.url);
  proxyAudio?.apply(leftTab);
  updateSidebarTools();
}
async function toggleSplitFromSidebar() {
  if (getSplitTabs().length === 2) {
    clearSplitView();
    setActiveFrame(getActiveTab());
    return;
  }
  const activeTab = getActiveTab();
  if (!activeTab || isInternalUrl(activeTab.url)) return;
  const candidates = tabs.filter(
    (tab) => tab.id !== activeTab.id && tab.url && !isInternalUrl(tab.url),
  );
  if (candidates.length) {
    setSplitView(activeTab.id, candidates[0].id);
    return;
  }
  await splitTabWithDuckDuckGo(activeTab.id);
}
function openTabContextMenu(clientX, clientY, tabId) {
  if (!tabMenu) return;
  tabMenuTargetTabId = tabId;
  const targetTab = tabs.find((tab) => tab.id === tabId);
  const activeTab = getActiveTab();
  const canSplit =
    !!targetTab &&
    !isInternalUrl(targetTab.url) &&
    (targetTab.id === activeTab?.id || (!!activeTab && !isInternalUrl(activeTab.url)));
  const splitActive = getSplitTabs().length === 2;
  if (!targetTab) return;
  tabMenuPin.hidden = false;
  tabMenuPin.querySelector("span:last-child").textContent = targetTab.pinned
    ? "Unpin tab"
    : "Pin tab";
  tabMenuSplit.hidden = !canSplit;
  tabMenuSplit.querySelector("span:last-child").textContent =
    targetTab?.id === activeTab?.id ? "Split" : "Split here";
  tabMenuUnsplit.hidden = !splitActive;
  tabMenuSwap.hidden = !splitActive;
  tabMenu.classList.add("is-open");
  tabMenu.setAttribute("aria-hidden", "false");
  const rect = tabMenu.getBoundingClientRect();
  tabMenu.style.left = `${Math.min(clientX, window.innerWidth - rect.width - 8)}px`;
  tabMenu.style.top = `${Math.min(clientY, window.innerHeight - rect.height - 8)}px`;
}
function closeTabContextMenu() {
  tabMenuTargetTabId = "";
  tabMenu?.classList.remove("is-open");
  tabMenu?.setAttribute("aria-hidden", "true");
}
