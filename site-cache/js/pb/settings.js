function openSettingsView() {
  if (!getActiveTab()) return;
  clearSplitView(false);
  setNewTabPage(false);
  setHistoryPage(false);
  setSettingsPage(true);
  updateSearchBars(proxyConfig.internal.settings);
  updateBookmarkToggle();
  hideLoadingBar();
}
function getSettingsElement(id) {
  return settingsPage?.querySelector(`#${id}`) || null;
}
function getProxyStartupMode(
  value = localStorage.getItem(proxyConfig.storage.startup) || "new-tab",
) {
  return value === "resume" ? "resume" : "new-tab";
}
function updateProxySearchSetting(value) {
  if (!window.searchEngines) return;
  const engine = window.searchEngines.set(value);
  updateSearchPlaceholder();
  settingsChannel?.postMessage({
    type: "search-engine-changed",
    engine: engine.id,
  });
}
function getProxyBookmarkStats() {
  const entries = getBookmarks();
  let bookmarks = 0;
  let folders = 0;
  function visit(list = []) {
    for (const entry of list) {
      if (entry?.type === "folder") {
        folders += 1;
        visit(entry.children || []);
      } else if (entry) {
        bookmarks += 1;
      }
    }
  }
  visit(entries);
  return { bookmarks, folders };
}
function syncProxySettingsSummaries() {
  const history = window.getHistory?.() || [];
  const { bookmarks, folders } = getProxyBookmarkStats();
  const profileSummary = getSettingsElement("proxyProfileSummary");
  const bookmarksSummary = getSettingsElement("proxyBookmarksSummary");
  const historySummary = getSettingsElement("settingsHistorySummary");
  const aboutSummary = getSettingsElement("settingsAboutSummary");
  const searchStatus = getSettingsElement("settingsSearchStatus");
  if (profileSummary) {
    profileSummary.textContent = `${history.length} history item${history.length === 1 ? "" : "s"} and ${bookmarks} bookmark${bookmarks === 1 ? "" : "s"} saved locally.`;
  }
  if (bookmarksSummary) {
    bookmarksSummary.textContent =
      bookmarks || folders
        ? `${bookmarks} bookmark${bookmarks === 1 ? "" : "s"} across ${folders} folder${folders === 1 ? "" : "s"}.`
        : "No proxy bookmarks saved.";
  }
  if (historySummary) {
    historySummary.textContent = history.length
      ? `${history.length} proxy history item${history.length === 1 ? "" : "s"} saved.`
      : "No proxy history saved.";
  }
  if (aboutSummary) {
    aboutSummary.textContent = "Studying is the browser engine.";
  }
  if (searchStatus && window.searchEngines) {
    const engine = window.searchEngines.get();
    searchStatus.textContent = `${engine.label} handles address bar searches.`;
  }
}
async function syncProxySettingsControls() {
  const barPositionSelect = getSettingsElement("settingsBarPosition");
  const sidebarCollapsed = getSettingsElement("settingsSidebarCollapsed");
  const startupModes = settingsPage?.querySelectorAll("input[name='settingsStartupMode']") || [];
  const adsBlocked = getSettingsElement("settingsAdsBlocked");
  const compactTabs = getSettingsElement("settingsCompactTabs");
  const searchSelect = getSettingsElement("settingsSearchEngine");
  if (barPositionSelect) barPositionSelect.value = getProxyBarPosition();
  if (sidebarCollapsed)
    sidebarCollapsed.checked =
      localStorage.getItem(proxyConfig.storage.sidebarCollapsed) === "true";
  startupModes.forEach((input) => {
    input.checked = input.value === getProxyStartupMode();
  });
  if (adsBlocked) adsBlocked.checked = localStorage.getItem("adsEnabled") === "false";
  if (compactTabs)
    compactTabs.checked = localStorage.getItem(proxyConfig.storage.compactTabs) === "true";
  if (searchSelect && window.searchEngines) {
    searchSelect.innerHTML = "";
    for (const engine of window.searchEngines.list()) {
      const option = document.createElement("option");
      option.value = engine.id;
      option.textContent = engine.label;
      searchSelect.appendChild(option);
    }
    searchSelect.value = window.searchEngines.getId();
  }
  syncProxySettingsSummaries();
}
function setActiveSettingsPanel(panelId) {
  const fallbackPanel = "profile";
  const id = settingsPage?.querySelector(
    `.settings-panel[data-settings-panel="${CSS.escape(panelId)}"]`,
  )
    ? panelId
    : fallbackPanel;
  settingsPage?.querySelectorAll(".settings-nav-item").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.settingsPanel === id);
  });
  settingsPage?.querySelectorAll(".settings-panel").forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.settingsPanel === id);
  });
}
function resetProxyPreferences() {
  [
    proxyConfig.storage.backend,
    proxyConfig.storage.versionKey,
    proxyConfig.storage.activeBackend,
    proxyConfig.storage.pendingUrl,
    proxyConfig.storage.barPosition,
    proxyConfig.storage.sidebarCollapsed,
    proxyConfig.storage.startup,
    proxyConfig.storage.compactTabs,
    proxyConfig.storage.tabSession,
    window.searchEngines?.key || "proxySearchEngine",
    "adsEnabled",
  ].forEach((key) => localStorage.removeItem(key));
  sessionStorage.removeItem(proxyConfig.storage.pendingUrl);
  sessionStorage.removeItem("encodedUrl");
  sessionStorage.removeItem(proxyConfig.storage.activeBackend);
  currentBackend = getEffectiveProxyBackend();
  clearProxyTransportCache();
  applyProxyBarPosition("bottom");
  applyCompactTabs();
  updateSearchPlaceholder();
  settingsChannel?.postMessage({
    type: "proxy-bar-position-changed",
    position: "bottom",
  });
  settingsChannel?.postMessage({ type: "search-engine-changed" });
  hydrateProxySettingsPage();
}
function clearProxyData() {
  localStorage.removeItem(proxyConfig.storage.bookmarks);
  localStorage.removeItem("browsingHistory");
  localStorage.removeItem(proxyConfig.storage.tabSession);
  sessionStorage.removeItem(proxyConfig.storage.pendingUrl);
  sessionStorage.removeItem("encodedUrl");
  sessionStorage.removeItem(proxyConfig.storage.activeBackend);
  renderBookmarks();
  updateBookmarkToggle();
  window.renderHistoryPage?.();
  syncProxySettingsSummaries();
}
function bindProxySettingsPage() {
  if (settingsPageInitialized || !settingsPage) return;
  settingsPageInitialized = true;
  settingsPage.querySelectorAll(".settings-nav-item").forEach((button) => {
    button.addEventListener("click", () =>
      setActiveSettingsPanel(button.dataset.settingsPanel || "profile"),
    );
  });
  getSettingsElement("settingsOpenHistory")?.addEventListener("click", () =>
    window.openHistoryTab?.(true),
  );
  getSettingsElement("settingsClearBookmarks")?.addEventListener("click", () => {
    if (!window.confirm("Clear all proxy bookmarks?")) return;
    localStorage.removeItem(proxyConfig.storage.bookmarks);
    renderBookmarks();
    updateBookmarkToggle();
    syncProxySettingsSummaries();
  });
  getSettingsElement("settingsBarPosition")?.addEventListener("change", (event) => {
    const position = getProxyBarPosition(event.target.value);
    localStorage.setItem(proxyConfig.storage.barPosition, position);
    applyProxyBarPosition(position);
    settingsChannel?.postMessage({
      type: "proxy-bar-position-changed",
      position,
    });
  });
  getSettingsElement("settingsSidebarCollapsed")?.addEventListener("change", (event) => {
    localStorage.setItem(
      proxyConfig.storage.sidebarCollapsed,
      event.target.checked ? "true" : "false",
    );
    applySidebarCollapsed();
  });
  getSettingsElement("settingsAdsBlocked")?.addEventListener("change", (event) => {
    const adsEnabled = !event.target.checked;
    localStorage.setItem("adsEnabled", String(adsEnabled));
    settingsChannel?.postMessage({ type: "ads-setting-changed", adsEnabled });
  });
  getSettingsElement("settingsClearHistory")?.addEventListener("click", () => {
    if (!window.confirm("Clear proxy browsing history?")) return;
    window.clearHistory?.();
    syncProxySettingsSummaries();
  });
  settingsPage.querySelectorAll("input[name='settingsStartupMode']").forEach((input) => {
    input.addEventListener("change", (event) => {
      if (!event.target.checked) return;
      localStorage.setItem(proxyConfig.storage.startup, getProxyStartupMode(event.target.value));
    });
  });
  getSettingsElement("settingsSearchEngine")?.addEventListener("change", (event) => {
    updateProxySearchSetting(event.target.value);
    syncProxySettingsSummaries();
  });
  getSettingsElement("settingsCompactTabs")?.addEventListener("change", (event) => {
    localStorage.setItem(proxyConfig.storage.compactTabs, event.target.checked ? "true" : "false");
    applyCompactTabs();
  });
  getSettingsElement("settingsReloadProxy")?.addEventListener("click", async () => {
    clearProxyTransportCache();
    forceStudyingHostReload();
    try {
      await ensureStudyingHost();
    } catch {
      console.error("studying reload failed", error);
    }
  });
  getSettingsElement("settingsResetPrefs")?.addEventListener("click", () => {
    if (!window.confirm("Reset proxy preferences?")) return;
    resetProxyPreferences();
  });
  getSettingsElement("settingsClearProxyData")?.addEventListener("click", () => {
    if (!window.confirm("Clear proxy history, bookmarks, and session data?")) return;
    clearProxyData();
  });
}
function hydrateProxySettingsPage() {
  if (!settingsPage) return;
  bindProxySettingsPage();
  syncProxySettingsControls().catch((error) => console.warn("settings hydrate failed", error));
}
function unlockHistoryTab() {
  const tab = getActiveTab();
  if (tab?.url === proxyConfig.internal.history) {
    tab.historyUnlocked = true;
  }
}
function updateActiveTabPageMeta(tab = getActiveTab(), frame = tab?.frame || iframe) {
  if (!tab || !tab.url) return;
  if (tab.backend === "studying" && frame?.dataset.studyingHost === "true") {
    return;
  }
  try {
    const frameDocument = frame.contentDocument || frame.contentWindow.document;
    const pageTitle = frameDocument.title.trim();
    const iconElement = frameDocument.querySelector(
      "link[rel~='icon'], link[rel='shortcut icon'], link[rel='apple-touch-icon']",
    );
    applyTabMeta(tab, {
      title: pageTitle,
      icon: iconElement?.href || "",
    });
    maybeFinishFrameLoad(tab, frame);
  } catch {}
}
function maybeFinishFrameLoad(tab = getActiveTab(), frame = tab?.frame || iframe) {
  if (!tab || tab.id !== activeTabId || !frame) return;
  try {
    const frameDocument = frame.contentDocument || frame.contentWindow.document;
    if (frameDocument.readyState === "interactive" || frameDocument.readyState === "complete") {
      hideLoadingBar();
    }
  } catch {}
}
function updateTabAudioStates() {
  const now = Date.now();
  let changed = false;
  for (const tab of tabs) {
    if (!tab.muted && tab.frame && proxyAudio?.hasSound(tab.frame)) tab.lastSound = now;
    const audible = !tab.muted && now - (tab.lastSound || 0) < 3000;                                     
    if (tab.audible !== audible) {
      tab.audible = audible;
      updateTabAudioElement(tab);
      changed = true;
    }
  }
  if (changed) {
    proxyAudio?.update();
  }
}
function updateTabAudioElement(tab) {
  const tabElement = getTabElement(tab.id);
  if (!tabElement) return;
  tabElement.classList.toggle("is-audible", Boolean(tab.audible));
  tabElement.classList.toggle("is-muted", Boolean(tab.muted));
  const audioIcon = tabElement.querySelector(".proxy-tab-audio");
  if (!audioIcon) return;
  setTabAudioIcon(audioIcon, tab.muted);
}
const speaker =
  '<path d="M11 4.5 6.5 8.5H4a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h2.5l4.5 4z" fill="currentColor"/>';
const audioIcons = {
  on: speaker + '<path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>',
  off: speaker + '<path d="m16 9 5 6"/><path d="m21 9-5 6"/>',
};
function setTabAudioIcon(button, muted) {
  const label = muted ? "Unmute tab" : "Mute tab";
  button.setAttribute("aria-label", label);
  button.title = label;
  button.innerHTML = audioSvg(muted);
}
function audioSvg(muted) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${muted ? audioIcons.off : audioIcons.on}</svg>`;
}
