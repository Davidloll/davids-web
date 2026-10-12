function showLoadingBar() {
  clearInterval(loadingProgressTimer);
  clearTimeout(loadingHideTimer);
  loadingHideTimer = null;
  frameLoading?.classList.add("is-visible");
  frameLoading?.setAttribute("aria-hidden", "false");
  loadingBar.style.transition = "none";
  loadingBar.style.width = "0";
  loadingBar.style.opacity = "1";
  loadingBar.getBoundingClientRect();
  loadingBar.style.transition = "";
  loadingBar.style.width = "12%";
  loadingBar.style.opacity = "1";
  loadingProgressTimer = setInterval(() => {
    const currentWidth = Number.parseFloat(loadingBar.style.width) || 12;
    if (currentWidth < 82) {
      loadingBar.style.width = `${Math.min(currentWidth + Math.max(2, (86 - currentWidth) * 0.12), 86)}%`;
    }
  }, 160);
  clearTimeout(loadingFallbackTimer);
  loadingFallbackTimer = setTimeout(() => {
    hideLoadingBar();
  }, 9000);
}
function configureIframeForBackend(backend) {
  iframe.removeAttribute("referrerpolicy");
}
function hideLoadingBar() {
  clearInterval(loadingProgressTimer);
  clearTimeout(loadingFallbackTimer);
  loadingProgressTimer = null;
  loadingFallbackTimer = null;
  loadingBar.style.width = "100%";
  clearTimeout(loadingHideTimer);
  loadingHideTimer = setTimeout(() => {
    loadingBar.style.opacity = "0";
    loadingBar.style.width = "0";
    frameLoading?.classList.remove("is-visible");
    frameLoading?.setAttribute("aria-hidden", "true");
    loadingHideTimer = null;
  }, 300);
}
function rememberNavigation(url, backend) {
  sessionStorage.setItem(proxyConfig.storage.pendingUrl, url);
  sessionStorage.removeItem("encodedUrl");
  sessionStorage.setItem(proxyConfig.storage.activeBackend, backend);
  updateActiveTab(url, backend);
}
async function waitForRegistrationActivation(registration) {
  const worker = registration.installing || registration.waiting || registration.active;
  if (!worker || worker.state === "activated") {
    return registration;
  }
  await new Promise((resolve, reject) => {
    const timeoutId = setTimeout(resolve, 10000);
    worker.addEventListener("statechange", () => {
      if (worker.state === "activated") {
        clearTimeout(timeoutId);
        resolve();
      } else if (worker.state === "redundant") {
        clearTimeout(timeoutId);
        reject(new Error("Service worker became redundant during activation."));
      }
    });
  });
  return registration;
}
function clearProxyTransportCache() {
  studyingHostReady = false;
  studyingHostPromise = null;
  studyingHostPromiseFrame = null;
}
function forceStudyingHostReload() {
  studyingHostReady = false;
  studyingHostPromise = null;
  studyingHostPromiseFrame = null;
  if (iframe) {
    iframe.dataset.studyingReady = "false";
    iframe.dataset.studyingHost = "false";
    iframe.src = "about:blank";
  }
}
function getStudyingHostFrameUrl() {
  const url = new URL(studyHostUrl, location.href);
  if (window.crossOriginIsolated && window.proxyTransport) {
    url.searchParams.set("transport", window.proxyTransport.getTransport());
    url.searchParams.set("wisp", window.proxyTransport.getWisp());
  }
  return url.href;
}
function isStudyingHostFrameReady(frame = iframe) {
  return (
    frame?.dataset.studyingHost === "true" &&
    frame.dataset.studyingReady === "true" &&
    frame.src === getStudyingHostFrameUrl()
  );
}
function ensureStudyingHostIframe(forceReload = false) {
  if (
    forceReload ||
    iframe.dataset.studyingHost !== "true" ||
    iframe.src !== getStudyingHostFrameUrl()
  ) {
    studyingHostReady = false;
    studyingHostPromise = null;
    studyingHostPromiseFrame = null;
    iframe.dataset.studyingReady = "false";
    iframe.dataset.studyingHost = "true";
    iframe.src = getStudyingHostFrameUrl();
  }
}
async function ensureStudyingHost() {
  if (isStudyingHostFrameReady()) {
    studyingHostReady = true;
    return;
  }
  if (iframe.dataset.studyingHost !== "true" || iframe.src !== getStudyingHostFrameUrl()) {
    studyingHostReady = false;
    studyingHostPromise = null;
    studyingHostPromiseFrame = null;
    ensureStudyingHostIframe();
  }
  if (!studyingHostPromise || studyingHostPromiseFrame !== iframe) {
    const hostFrame = iframe;
    studyingHostPromiseFrame = hostFrame;
    studyingHostPromise = new Promise((resolve, reject) => {
      let attempts = 0;
      let timeoutId = null;
      function clearWait() {
        clearTimeout(timeoutId);
        window.removeEventListener("message", onMessage);
      }
      function fail(message) {
        studyingHostPromise = null;
        studyingHostPromiseFrame = null;
        clearWait();
        reject(new Error(message));
      }
      function waitAgain() {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          if (attempts < 2) {
            attempts += 1;
            ensureStudyingHostIframe(true);
            waitAgain();
            return;
          }
          fail("Timed out while waiting for the Studying host.");
        }, 15000);
      }
      function onMessage(event) {
        if (event.origin !== location.origin || event.source !== hostFrame.contentWindow) {
          return;
        }
        if (event.data?.type === proxyConfig.messages.bridgeReady) {
          clearWait();
          hostFrame.dataset.studyingReady = "true";
          studyingHostReady = hostFrame === iframe;
          studyingHostPromise = Promise.resolve();
          studyingHostPromiseFrame = hostFrame;
          resolve();
        } else if (event.data?.type === proxyConfig.messages.bridgeError) {
          hostFrame.dataset.studyingReady = "false";
          fail(event.data.message || "Studying host failed to initialize.");
        }
      }
      window.addEventListener("message", onMessage);
      waitAgain();
    }).catch((error) => {
      studyingHostPromise = null;
      studyingHostPromiseFrame = null;
      throw error;
    });
  }
  return studyingHostPromise;
}
function encodeStudyingUrl(url) {
  return url;
}
function decodeStudyingUrl(url) {
  return decodeStudyingServiceUrl(url) || url;
}
async function loadNewPage(rawUrl, backend = getEffectiveProxyBackend()) {
  const url = normalizeInputToUrl(rawUrl);
  if (!url) return;
  if (isInternalUrl(url)) {
    openInternalPage(url);
    return;
  }
  backend = getBackendForUrl(url, backend);
  setNewTabPage(false);
  setHistoryPage(false);
  setSettingsPage(false);
  currentBackend = backend;
  rememberNavigation(url, backend);
  updateSearchBars(url);
  configureIframeForBackend(backend);
  showLoadingBar();
  searchInputFooter.blur();
  try {
    const activeTab = getActiveTab();
    if (activeTab) {
      setActiveFrame(activeTab);
      proxyAudio?.apply(activeTab);
    }
    await ensureStudyingHost();
    proxyAudio?.apply(activeTab);
    iframe.contentWindow.postMessage(
      {
        type: proxyConfig.messages.hostLoad,
        url,
      },
      location.origin,
    );
  } catch {
    hideLoadingBar();
    console.error("proxy load error", error);
  }
}
function decodeIframeUrl(currentUrl) {
  if (currentUrl.startsWith(window.location.origin + studyPrefix)) {
    return decodeStudyingUrl(currentUrl);
  }
  return currentUrl;
}
function getRecoveredUv404Url(currentUrl) {
  return "";
}
function updateTabFromFrame(tab, frame) {
  if (!tab || tab.backend === "studying") {
    return;
  }
  try {
    const currentURL = frame.contentWindow.location.href;
    if (!currentURL || currentURL === tab.lastFrameLocation) {
      return;
    }
    const recoveredUvUrl = getRecoveredUv404Url(currentURL);
    if (recoveredUvUrl) {
      tab.lastFrameLocation = recoveredUvUrl;
      frame.src = recoveredUvUrl;
      return;
    }
    tab.lastFrameLocation = currentURL;
    const decodedValue = decodeIframeUrl(currentURL);
    if (!decodedValue || decodedValue === "about:blank" || decodedValue === tab.lastDecodedUrl) {
      return;
    }
    tab.lastDecodedUrl = decodedValue;
    tab.url = decodedValue;
    tab.title = tab.pageTitle || getTabTitle(decodedValue);
    tab.icon = tab.icon || getTabIcon(decodedValue);
    updateBookmarkToggle();
    if (tab.id === activeTabId) {
      updateSearchBars(decodedValue);
      sessionStorage.setItem(proxyConfig.storage.pendingUrl, decodedValue);
      sessionStorage.removeItem("encodedUrl");
      sessionStorage.setItem(proxyConfig.storage.activeBackend, tab.backend);
      addToHistory(decodedValue, tab.title);
    }
    updateActiveTabPageMeta(tab, frame);
  } catch {}
}
function handleFrameLoad(frame) {
  const tab = tabs.find((entry) => entry.frame === frame);
  if (!tab) return;
  bindFrameShortcuts(frame);
  injectProxyFrameScrollbars(frame);
  proxyAudio?.apply(tab);
  if (tab.id === activeTabId) {
    iframe = frame;
    hideLoadingBar();
  }
  updateTabFromFrame(tab, frame);
  updateTabAudioStates();
}
function checkIframeURL() {
  const tab = getActiveTab();
  if (!tab?.frame || tab.backend === "studying" || isInternalUrl(tab.url)) {
    return;
  }
  maybeFinishFrameLoad(tab, tab.frame);
  updateTabFromFrame(tab, tab.frame);
}
function showSearchBox() {
  searchBox.classList.remove("show");
  document.body.classList.add("footer-open");
  document.body.classList.add("search-focused");
  setTimeout(() => searchInputFooter.focus(), 50);
}
function hideSearchBox() {
  searchBox.classList.remove("show");
  document.body.classList.remove("search-focused");
}
function hideFooterBar() {
  hideSearchBox();
  document.body.classList.remove("footer-open");
}
function toggleFooterBar() {
  if (document.body.classList.contains("footer-open")) {
    hideFooterBar();
    return;
  }
  document.body.classList.add("footer-open");
}
function focusFooterSearch() {
  if (!document.body.classList.contains("footer-open")) {
    document.body.classList.add("footer-open");
  }
  showSearchBox();
}
function getInitialUrl() {
  const queryUrl = getUrlParameter("url");
  if (queryUrl) return queryUrl;
  if ((localStorage.getItem(proxyConfig.storage.startup) || "new-tab") !== "resume") {
    return "";
  }
  const pendingProxyUrl = getPendingProxyUrl();
  if (pendingProxyUrl) return pendingProxyUrl;
  return "";
}
function clearInitialUrlParameter() {
  const pageUrl = new URL(location.href);
  if (!pageUrl.searchParams.has("url")) return;
  pageUrl.searchParams.delete("url");
  history.replaceState(history.state, "", `${pageUrl.pathname}${pageUrl.search}${pageUrl.hash}`);
}
