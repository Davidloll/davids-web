function createTabFrame(tab) {
  const useInitialFrame =
    tabs.length === 1 && iframe && !iframe.dataset.tabId && iframe.parentElement === frames;
  const frame = tab.frame || (useInitialFrame ? iframe : document.createElement("iframe"));
  frame.classList.add("proxy-frame");
  if (window.crossOriginIsolated) frame.setAttribute("credentialless", "");
  if (frame !== iframe) {
    frame.removeAttribute("id");
  }
  frame.setAttribute("allow", "autoplay; fullscreen; gamepad; cross-origin-isolated");
  frame.setAttribute("referrerpolicy", "no-referrer");
  frame.dataset.tabId = tab.id;
  if (!frame.parentElement) {
    frames.appendChild(frame);
  }
  if (!frame.dataset.loadBound) {
    frame.dataset.loadBound = "true";
    frame.addEventListener("load", () => handleFrameLoad(frame));
  }
  proxyAudio?.watch(frame);
  tab.frame = frame;
  return frame;
}
function setActiveFrame(tab) {
  if (!tab) return;
  iframe = createTabFrame(tab);
  if (syncSplitFrames()) {
    return;
  }
  for (const entry of tabs) {
    if (entry.frame) {
      entry.frame.classList.toggle(
        "is-active",
        entry.id === tab.id && !!entry.url && !isInternalUrl(entry.url),
      );
      entry.frame.classList.remove("is-split-left", "is-split-right");
    }
  }
}
function getTabPositions() {
  const positions = new Map();
  for (const element of tabsList.querySelectorAll(".proxy-tab")) {
    const rect = element.getBoundingClientRect();
    positions.set(element.dataset.tabId, {
      left: rect.left,
      top: rect.top,
    });
  }
  return positions;
}
function animateTabShift(previousPositions) {
  if (!previousPositions?.size) return;
  for (const element of tabsList.querySelectorAll(".proxy-tab")) {
    if (element.dataset.tabId === draggingTabId) continue;
    const previous = previousPositions.get(element.dataset.tabId);
    if (!previous) continue;
    const rect = element.getBoundingClientRect();
    const deltaX = previous.left - rect.left;
    const deltaY = previous.top - rect.top;
    if (!deltaX && !deltaY) continue;
    element.getAnimations().forEach((animation) => animation.cancel());
    element.animate(
      [
        {
          transform: `translate3d(${deltaX}px, ${deltaY}px, 0)`,
        },
        {
          transform: "translate3d(0, 0, 0)",
        },
      ],
      {
        duration: 145,
        easing: "cubic-bezier(0.16, 0.95, 0.3, 1.08)",
      },
    );
  }
}
function moveTabToIndex(draggedId, insertIndex) {
  if (!draggedId) return;
  const draggedIndex = tabs.findIndex((tab) => tab.id === draggedId);
  const draggedTab = tabs[draggedIndex];
  if (!draggedTab) return;
  const pinnedCount = tabs.filter((tab) => tab.pinned).length;
  const minIndex = draggedTab.pinned ? 0 : pinnedCount;
  const maxIndex = draggedTab.pinned ? Math.max(0, pinnedCount - 1) : tabs.length - 1;
  const nextIndex = Math.max(minIndex, Math.min(insertIndex, maxIndex));
  if (draggedIndex === -1 || draggedIndex === nextIndex) return;
  const previousPositions = getTabPositions();
  const [movedTab] = tabs.splice(draggedIndex, 1);
  tabs.splice(nextIndex, 0, movedTab);
  didDragTab = true;
  renderTabs({
    animate: true,
    previousPositions,
  });
}
function toggleTabPinned(tabId) {
  const tabIndex = tabs.findIndex((tab) => tab.id === tabId);
  if (tabIndex === -1) return;
  const previousPositions = getTabPositions();
  const [tab] = tabs.splice(tabIndex, 1);
  tab.pinned = !tab.pinned;
  const insertIndex = tabs.filter((entry) => entry.pinned).length;
  tabs.splice(insertIndex, 0, tab);
  renderTabs({
    animate: true,
    previousPositions,
  });
}
function getDragInsertIndex(clientX, clientY = pendingDragClientY) {
  const tabElements = Array.from(tabsList.querySelectorAll(".proxy-tab")).filter(
    (element) => element.dataset.tabId !== draggingTabId,
  );
  if (!tabElements.length) return 0;
  for (let index = 0; index < tabElements.length; index += 1) {
    const rect = tabElements[index].getBoundingClientRect();
    if (isSideProxyBar()) {
      if (clientY < rect.top + rect.height / 2) {
        return index;
      }
      continue;
    }
    if (clientX < rect.left + rect.width / 2) {
      return index;
    }
  }
  return tabElements.length;
}
function moveDraggingTabToPointer(clientX, clientY = pendingDragClientY) {
  if (!draggingTabId) return;
  moveTabToIndex(draggingTabId, getDragInsertIndex(clientX, clientY));
}
function getTabElement(tabId) {
  return (
    Array.from(tabsList.querySelectorAll(".proxy-tab")).find(
      (element) => element.dataset.tabId === tabId,
    ) || null
  );
}
function createTabDragGhost(tabId, clientX, clientY) {
  const source = getTabElement(tabId);
  if (!source) return;
  const rect = source.getBoundingClientRect();
  tabDragGhost?.remove();
  tabDragGhost = source.cloneNode(true);
  tabDragGhost.classList.remove("is-dragging");
  tabDragGhost.classList.add("proxy-tab-drag-ghost");
  tabDragState.offsetX = clientX - rect.left;
  tabDragState.offsetY = clientY - rect.top;
  tabDragState.width = rect.width;
  tabDragState.height = rect.height;
  tabDragState.top = rect.top;
  tabDragGhost.style.width = `${rect.width}px`;
  tabDragGhost.style.height = `${rect.height}px`;
  document.body.appendChild(tabDragGhost);
  updateTabDragGhost(clientX, clientY);
}
function getChromeDragBounds() {
  const rects = [tabbar, bookmarkbar]
    .map((element) => element.getBoundingClientRect())
    .filter((rect) => rect.width && rect.height);
  return {
    left: Math.min(...rects.map((rect) => rect.left)),
    right: Math.max(...rects.map((rect) => rect.right)),
    top: Math.min(...rects.map((rect) => rect.top)),
    bottom: Math.max(...rects.map((rect) => rect.bottom)),
  };
}
function markChromeDropTarget(target) {
  for (const element of document.querySelectorAll(".is-drop-target")) {
    if (element !== target) element.classList.remove("is-drop-target");
  }
  target?.classList.add("is-drop-target");
}
function updateTabDragGhost(clientX, clientY = pendingDragClientY) {
  if (!tabDragGhost || !tabDragState) return;
  const bounds = tabbar.getBoundingClientRect();
  const left = Math.min(
    Math.max(clientX - tabDragState.offsetX, bounds.left + 8),
    bounds.right - tabDragState.width - 8,
  );
  const top = Math.min(
    Math.max(clientY - tabDragState.offsetY, bounds.top + 4),
    bounds.bottom - tabDragState.height - 4,
  );
  tabDragGhost.style.transform = `translate3d(${left}px, ${top}px, 0) scale(1.015)`;
}
function scheduleTabDragMove(clientX, clientY) {
  pendingDragClientX = clientX;
  pendingDragClientY = clientY;
  if (tabDragFrame) return;
  tabDragFrame = requestAnimationFrame(() => {
    tabDragFrame = 0;
    if (!tabDragState?.started) return;
    updateTabDragGhost(pendingDragClientX, pendingDragClientY);
    moveDraggingTabToPointer(pendingDragClientX, pendingDragClientY);
  });
}
function startTabPointerDrag(tabId, event) {
  if (!tabDragState || tabDragState.started) return;
  draggingTabId = tabId;
  didDragTab = true;
  tabDragState.started = true;
  hideTabTooltip();
  createTabDragGhost(tabId, event.clientX, event.clientY);
  renderTabs();
  updateTabDragGhost(event.clientX, event.clientY);
}
function finishTabPointerDrag() {
  if (!tabDragState) return;
  const wasDragging = tabDragState.started;
  draggingTabId = "";
  tabDragState = null;
  tabDragGhost?.remove();
  tabDragGhost = null;
  if (tabDragFrame) {
    cancelAnimationFrame(tabDragFrame);
    tabDragFrame = 0;
  }
  if (wasDragging) {
    renderTabs();
    setTimeout(() => {
      didDragTab = false;
    }, 0);
  }
}
