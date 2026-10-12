document.body.classList.add("proxy-footer-hidden");
applyProxyBarPosition();
applyCompactTabs();
applySavedInspectWidth();
tabTooltip.id = "proxy-tab-tooltip";
tabTooltip.setAttribute("aria-hidden", "true");
document.body.appendChild(tabTooltip);
proxyAudio = window.siteAudio?.proxy({
  button: null,
  getActiveTab,
  isInternalUrl,
  renderTabs: () => {
    const tab = getActiveTab();
    if (tab) updateTabAudioElement(tab);
  },
});
splitRatio = getSavedSplitRatio();
window.addEventListener("message", (event) => {
  if (event.origin !== location.origin) return;
  if (event.source === inspectDevtoolsFrame.contentWindow) {
    if (typeof event.data === "string") {
      iframe.contentWindow.postMessage(
        { type: proxyConfig.messages.devtools, message: event.data },
        location.origin,
      );
    }
    return;
  }
  if (event.source !== iframe.contentWindow) return;
  if (event.data?.type === proxyConfig.messages.devtools) {
    inspectDevtoolsFrame.contentWindow?.postMessage(event.data.message, location.origin);
  } else if (event.data?.type === proxyConfig.messages.hostUrl) {
    const decodedValue = event.data.url;
    if (
      !decodedValue ||
      decodedValue === "about:blank" ||
      isBrowserShellUrl(decodedValue) ||
      decodedValue === lastDecodedUrl
    ) {
      return;
    }
    lastDecodedUrl = decodedValue;
    updateSearchBars(decodedValue);
    rememberNavigation(decodedValue, currentBackend);
    addToHistory(decodedValue, getActiveTab()?.title);
  } else if (event.data?.type === proxyConfig.messages.hostFrameLoaded) {
    hideLoadingBar();
    updateActiveTabPageMeta();
    reloadInspectPanel();
  } else if (event.data?.type === proxyConfig.messages.hostMeta) {
    applyTabMeta(getActiveTab(), {
      title: event.data.title,
      icon: event.data.icon,
    });
  } else if (event.data?.type === proxyConfig.messages.hostNewTab) {
    openNewProxyTab();
  }
});
settingsChannel?.addEventListener("message", (event) => {
  if (event.data?.type === "proxy-bar-position-changed") {
    applyProxyBarPosition(event.data.position);
    if (document.body.classList.contains("proxy-settings-page")) hydrateProxySettingsPage();
  } else if (event.data?.type === "search-engine-changed") {
    updateSearchPlaceholder();
    if (document.body.classList.contains("proxy-settings-page")) hydrateProxySettingsPage();
  } else if (event.data?.type === "browser-transport-changed") {
    clearProxyTransportCache();
    forceStudyingHostReload();
  }
});
window.addEventListener("storage", (event) => {
  if (event.key === proxyConfig.storage.barPosition) {
    applyProxyBarPosition(event.newValue || "bottom");
  } else if (event.key === proxyConfig.storage.sidebarCollapsed) {
    applySidebarCollapsed();
  } else if (event.key === proxyConfig.storage.compactTabs) {
    applyCompactTabs();
  } else if (event.key === window.searchEngines?.key) {
    updateSearchPlaceholder();
  }
  if (document.body.classList.contains("proxy-settings-page")) hydrateProxySettingsPage();
});
async function initializeSearchPage() {
  updateSearchPlaceholder();
  currentBackend = "studying";
  const hasInitialUrlParameter = new URL(location.href).searchParams.has("url");
  const initialUrl = getInitialUrl();
  clearInitialUrlParameter();
  const shouldShowFooter = sessionStorage.getItem(proxyConfig.storage.showFooter) === "true";
  if (shouldShowFooter) {
    document.body.classList.add("footer-open");
    sessionStorage.removeItem(proxyConfig.storage.showFooter);
  }
  const restoredTabSession = restoreTabSession();
  if (!tabs.length) {
    const tab = createTab(initialUrl || proxyConfig.internal.newTab, currentBackend, false);
    activeTabId = tab.id;
    renderTabs();
  } else if (restoredTabSession && initialUrl) {
    const activeTab = getActiveTab();
    const canReuseActiveTab =
      !activeTab?.url ||
      activeTab.url === proxyConfig.internal.newTab ||
      activeTab.url === "about:blank";
    const isFreshHomepageSearch = hasInitialUrlParameter;
    if (!canReuseActiveTab && isFreshHomepageSearch) {
      const backend = getBackendForUrl(initialUrl, activeTab.backend || currentBackend);
      const tab = createTab(initialUrl, backend, false);
      activeTabId = tab.id;
      setActiveFrame(tab);
      renderTabs();
    }
  }
  const targetUrl =
    restoredTabSession && !hasInitialUrlParameter
      ? getActiveTab()?.url || proxyConfig.internal.newTab
      : initialUrl || getActiveTab()?.url || proxyConfig.internal.newTab;
  currentBackend = isInternalUrl(targetUrl)
    ? getEffectiveProxyBackend(getActiveTab()?.backend)
    : getBackendForUrl(targetUrl, getActiveTab()?.backend || currentBackend);
  renderBookmarks();
  updateBookmarkToggle();
  configureIframeForBackend(currentBackend);
  if (currentBackend === "studying" && !isInternalUrl(targetUrl)) {
    ensureStudyingHost().catch((error) => {
      console.error("studying host preload error", error);
    });
  }
  if (isInternalUrl(targetUrl)) {
    if (currentBackend === "studying") warmProxy();
    openInternalPage(targetUrl);
    return;
  }
  setNewTabPage(false);
  setHistoryPage(false);
  setSettingsPage(false);
  updateSearchBars(targetUrl);
  await loadNewPage(targetUrl, currentBackend);
}
window.addEventListener("pagehide", saveTabSession);
if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    () => {
      initializeSearchPage().catch((error) => {
        console.error("search page init error", error);
      });
    },
    {
      once: true,
    },
  );
} else {
  initializeSearchPage().catch((error) => {
    console.error("search page init error", error);
  });
}
setInterval(checkIframeURL, 250);
setInterval(updateTabAudioStates, 1000);
