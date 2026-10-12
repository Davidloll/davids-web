var proxyConfig = {
  storage: {
    backend: "proxyBackend",
    versionKey: "proxyDefaultVersion",
    activeBackend: "activeProxyBackend",
    pendingUrl: "pendingProxyUrl",
    showFooter: "showProxyFooterOnLoad",
    bookmarks: "proxyBookmarks",
    barPosition: "proxyBarPosition",
    sidebarCollapsed: "proxySidebarCollapsed",
    startup: "proxyStartup",
    compactTabs: "proxyCompactTabs",
    splitRatio: "proxySplitRatio",
    tabSession: "proxyTabSession",
    devtoolsWidth: "proxyDevtoolsWidth",
    newTabShortcuts: "proxyNewTabShortcuts",
    hiddenRecentSites: "proxyHiddenRecentSites",
  },
  version: "studying-v2",
  channel: "site-settings",
  messages: {
    bridgeReady: "studying-bridge-ready",
    bridgeError: "studying-bridge-error",
    hostUrl: "studying-host-url",
    hostFrameLoaded: "studying-host-frame-loaded",
    hostMeta: "studying-host-meta",
    hostLoad: "studying-load",
    hostBack: "studying-back",
    hostForward: "studying-forward",
    hostReload: "studying-reload",
    hostNewTab: "studying-new-tab",
    devtools: "studying-devtools-message",
  },
  internal: {
    newTab: "site://new",
    history: "site://history",
    settings: "site://settings",
  },
  splitUrl: "https://duckduckgo.com/",
  tooltipDelay: 1000,
};
var proxyStyle = {
  frameScrollbar: `
html {
  scrollbar-width: thin;
  scrollbar-color: rgba(190, 216, 216, 0.74) rgba(8, 25, 25, 0.48);
}
::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
::-webkit-scrollbar-track {
  background: rgba(8, 25, 25, 0.48);
}
::-webkit-scrollbar-thumb {
  min-height: 42px;
  border: 2px solid rgba(8, 25, 25, 0.48);
  border-radius: 999px;
  background: rgba(190, 216, 216, 0.74);
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(245, 255, 255, 0.82);
}
`,
};
var settingsChannel =
  typeof BroadcastChannel === "function" ? new BroadcastChannel(proxyConfig.channel) : null;
var proxyDom = {
  iframe: document.getElementById("iframeid"),
  frames: document.getElementById("frames"),
  splitDivider: document.getElementById("split-divider"),
  footer: document.getElementById("footer"),
  footerToggle: document.getElementById("footer-toggle"),
  sideCollapseToggle: document.getElementById("side-collapse-toggle"),
  searchInputFooter: document.getElementById("teacher-setup-dialogs-container"),
  searchBox: document.getElementById("gooei"),
  tabbar: document.getElementById("tabbar"),
  tabsList: document.getElementById("tabs-list"),
  tabbarActions: document.getElementById("tabbar-actions"),
  newTabButton: document.getElementById("new-tab-button"),
  bookmarkbar: document.getElementById("bookmarkbar"),
  bookmarkList: document.getElementById("bookmark-list"),
  bookmarkbarActions: document.getElementById("bookmarkbar-actions"),
  bookmarkToggle: document.getElementById("bookmark-toggle"),
  inspectButton: document.getElementById("inspect-button"),
  bookmarkEditor: document.getElementById("bookmark-editor"),
  bookmarkEditorForm: document.getElementById("bookmark-editor-form"),
  bookmarkDeleteButton: document.getElementById("bookmark-delete"),
  bookmarkMenu: document.getElementById("bookmark-menu"),
  bookmarkMenuOpen: document.getElementById("bookmark-menu-open"),
  bookmarkMenuOpenNewTab: document.getElementById("bookmark-menu-open-new-tab"),
  bookmarkMenuAddFolder: document.getElementById("bookmark-menu-add-folder"),
  bookmarkMenuRenameFolder: document.getElementById("bookmark-menu-rename-folder"),
  bookmarkMenuDeleteFolder: document.getElementById("bookmark-menu-delete-folder"),
  bookmarkMenuDeleteBookmark: document.getElementById("bookmark-menu-delete-bookmark"),
  bookmarkFolderPopover: document.getElementById("bookmark-folder-popover"),
  bookmarkFolderDialog: document.getElementById("bookmark-folder-dialog"),
  bookmarkFolderForm: document.getElementById("bookmark-folder-form"),
  bookmarkFolderHeading: document.getElementById("bookmark-folder-heading"),
  bookmarkFolderName: document.getElementById("bookmark-folder-name"),
  bookmarkFolderCancel: document.getElementById("bookmark-folder-cancel"),
  newTabLanding: document.getElementById("newtab-landing"),
  newTabShortcutGrid: document.getElementById("newtab-shortcut-grid"),
  newTabShortcutDialog: document.getElementById("newtab-shortcut-dialog"),
  newTabShortcutForm: document.getElementById("newtab-shortcut-form"),
  newTabShortcutName: document.getElementById("newtab-shortcut-name"),
  newTabShortcutUrl: document.getElementById("newtab-shortcut-url"),
  newTabShortcutCancel: document.getElementById("newtab-shortcut-cancel"),
  historyPage: document.getElementById("history-page"),
  settingsPage: document.getElementById("settings-page"),
  loadingBar: document.getElementById("loadingbar"),
  frameLoading: document.getElementById("proxy-frame-loading"),
  tabTooltip: document.createElement("div"),
};
function createTabMenu() {
  const menu = document.createElement("div");
  menu.id = "tab-menu";
  menu.className = "tab-menu";
  menu.setAttribute("aria-hidden", "true");
  const items = [
    {
      action: "pin",
      icon: '<i class="fa-solid fa-thumbtack"></i>',
      label: "Pin tab",
    },
    {
      action: "split",
      icon: '<i class="fa-solid fa-table-columns"></i>',
      label: "Split",
    },
    {
      action: "unsplit",
      icon: '<i class="fa-solid fa-compress"></i>',
      label: "Unsplit",
    },
    {
      action: "swap",
      icon: '<i class="fa-solid fa-arrow-right-arrow-left"></i>',
      label: "Swap",
    },
  ];
  for (const item of items) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.tabAction = item.action;
    button.innerHTML = `${item.icon}<span>${item.label}</span>`;
    menu.appendChild(button);
  }
  document.body.appendChild(menu);
  return menu;
}
function createInspectPanel() {
  const panel = document.createElement("aside");
  panel.id = "inspect-panel";
  panel.setAttribute("aria-hidden", "true");
  panel.innerHTML =
    '<div class="inspect-resize-handle" role="separator" aria-label="Resize Developer Tools" aria-orientation="vertical" tabindex="0"></div><iframe class="inspect-devtools-frame" title="Developer Tools"></iframe>';
  document.body.appendChild(panel);
  return panel;
}
var tabMenu = createTabMenu();
var inspectPanel = createInspectPanel();
var proxyChrome = {
  tabMenu,
  tabMenuPin: tabMenu.querySelector("[data-tab-action='pin']"),
  tabMenuSplit: tabMenu.querySelector("[data-tab-action='split']"),
  tabMenuUnsplit: tabMenu.querySelector("[data-tab-action='unsplit']"),
  tabMenuSwap: tabMenu.querySelector("[data-tab-action='swap']"),
  inspectPanel,
  inspectResizeHandle: inspectPanel.querySelector(".inspect-resize-handle"),
  inspectDevtoolsFrame: inspectPanel.querySelector(".inspect-devtools-frame"),
};
var {
  iframe,
  frames,
  splitDivider,
  footer,
  footerToggle,
  sideCollapseToggle,
  searchInputFooter,
  searchBox,
  tabbar,
  tabsList,
  tabbarActions,
  newTabButton,
  bookmarkbar,
  bookmarkList,
  bookmarkbarActions,
  bookmarkToggle,
  inspectButton,
  bookmarkEditor,
  bookmarkEditorForm,
  bookmarkDeleteButton,
  bookmarkMenu,
  bookmarkMenuOpen,
  bookmarkMenuOpenNewTab,
  bookmarkMenuAddFolder,
  bookmarkMenuRenameFolder,
  bookmarkMenuDeleteFolder,
  bookmarkMenuDeleteBookmark,
  bookmarkFolderPopover,
  bookmarkFolderDialog,
  bookmarkFolderForm,
  bookmarkFolderHeading,
  bookmarkFolderName,
  bookmarkFolderCancel,
  newTabLanding,
  newTabShortcutGrid,
  newTabShortcutDialog,
  newTabShortcutForm,
  newTabShortcutName,
  newTabShortcutUrl,
  newTabShortcutCancel,
  historyPage,
  settingsPage,
  loadingBar,
  frameLoading,
  tabTooltip,
} = proxyDom;
var proxySidebarRail = document.createElement("div");
proxySidebarRail.id = "proxy-sidebar-rail";
tabbar.before(proxySidebarRail);
proxySidebarRail.append(footer, tabbar, bookmarkbar);
var {
  tabMenuPin,
  tabMenuSplit,
  tabMenuUnsplit,
  tabMenuSwap,
  inspectResizeHandle,
  inspectDevtoolsFrame,
} = proxyChrome;
var proxyNetwork = {
  studyPrefix: "/studying/service/",
  studyHostUrl: "/studying/frame/?mode=host",
};
var { studyPrefix, studyHostUrl } = proxyNetwork;
var lastIframeLocation = "",
  lastDecodedUrl = "",
  currentBackend = "studying",
  activeTabId = "",
  tabMenuTargetTabId = "",
  draggingTabId = "",
  tabTooltipTargetId = "",
  draggingBookmarkId = "",
  editingBookmarkId = "",
  activeBookmarkFolderId = "",
  bookmarkMenuTargetFolderId = "",
  bookmarkMenuTargetBookmarkId = "",
  bookmarkMenuTargetBookmarkFolderId = "",
  bookmarkFolderDialogMode = "new",
  bookmarkFolderDialogTargetId = "";
var studyingHostReady = false,
  settingsPageInitialized = false,
  didDragTab = false,
  didDragBookmark = false;
var studyingHostPromise = null,
  studyingHostPromiseFrame = null,
  loadingProgressTimer = null,
  loadingFallbackTimer = null,
  loadingHideTimer = null,
  tabDragState = null,
  tabDragGhost = null,
  tabTooltipTimer = null,
  bookmarkDragState = null,
  bookmarkDragGhost = null,
  tabSessionSaveTimer = null,
  inspectResizeState = null;
var nextTabId = 1,
  tabDragFrame = 0,
  splitResizeFrame = 0,
  pendingDragClientX = 0,
  pendingDragClientY = 0,
  bookmarkDragFrame = 0,
  pendingBookmarkDragX = 0,
  pendingBookmarkDragY = 0;
var tabs = [],
  splitViewTabIds = [];
var splitRatio = 0.5,
  splitResizeState = null;
  splitResizeState = null;
var splitFrameResizeObserver =
  typeof ResizeObserver === "function"
    ? new ResizeObserver((entries) => {
        for (const entry of entries) {
          notifySplitFrameResize(entry.target);
        }
      })
    : null;
var proxyAudio = null;
