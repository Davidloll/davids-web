function moveBookmarkIntoFolder(bookmarkId, folderId) {
  if (!bookmarkId || !folderId || bookmarkId === folderId) return false;
  const bookmarks = getBookmarks();
  const bookmarkIndex = bookmarks.findIndex(
    (entry) => entry.id === bookmarkId && entry.type !== "folder",
  );
  const folder = bookmarks.find((entry) => entry.id === folderId && entry.type === "folder");
  if (bookmarkIndex === -1 || !folder) return false;
  const [bookmark] = bookmarks.splice(bookmarkIndex, 1);
  folder.children = folder.children || [];
  if (
    !folder.children.some(
      (child) => normalizeBookmarkUrl(child.url) === normalizeBookmarkUrl(bookmark.url),
    )
  ) {
    folder.children.push(bookmark);
  }
  activeBookmarkFolderId = folderId;
  saveBookmarks(bookmarks);
  renderBookmarks();
  const folderElement = getBookmarkElement(folderId);
  if (folderElement) {
    openBookmarkFolderPopover(folderId, folderElement);
  }
  return true;
}
function moveBookmarkOutOfFolder(bookmarkId, folderId, insertIndex = getBookmarks().length) {
  if (!bookmarkId || !folderId) return false;
  const bookmarks = getBookmarks();
  const folder = bookmarks.find((entry) => entry.id === folderId && entry.type === "folder");
  if (!folder) return false;
  const childIndex = (folder.children || []).findIndex((child) => child.id === bookmarkId);
  if (childIndex === -1) return false;
  const [bookmark] = folder.children.splice(childIndex, 1);
  const nextIndex = Math.max(0, Math.min(insertIndex, bookmarks.length));
  bookmarks.splice(nextIndex, 0, bookmark);
  saveBookmarks(bookmarks);
  activeBookmarkFolderId = folderId;
  renderBookmarks();
  const folderElement = getBookmarkElement(folderId);
  if (folderElement) {
    openBookmarkFolderPopover(folderId, folderElement);
  }
  return true;
}
function getBookmarkById(bookmarkId, folderId = "") {
  const bookmarks = getBookmarks();
  if (folderId) {
    const folder = bookmarks.find((entry) => entry.id === folderId && entry.type === "folder");
    return (folder?.children || []).find((child) => child.id === bookmarkId) || null;
  }
  for (const entry of bookmarks) {
    if (entry.id === bookmarkId && entry.type !== "folder") return entry;
    if (entry.type === "folder") {
      const child = (entry.children || []).find((bookmark) => bookmark.id === bookmarkId);
      if (child) return child;
    }
  }
  return null;
}
function getSideBookmarkTop() {
  const first = bookmarkList.querySelector(".bookmark-entry");
  const rect = (first || bookmarkList).getBoundingClientRect();
  return rect.top - 8;
}
function isBookmarkTabDrop(clientX, clientY) {
  if (isSideProxyBar()) {
    const rail = proxySidebarRail.getBoundingClientRect();
    return (
      clientX >= rail.left &&
      clientX <= rail.right &&
      clientY >= tabbar.getBoundingClientRect().top &&
      clientY < getSideBookmarkTop()
    );
  }
  const rect = tabbar.getBoundingClientRect();
  return (
    clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
  );
}
function isBookmarkBarDrop(clientX, clientY) {
  const tabRect = tabbar.getBoundingClientRect();
  const bookmarkRect = bookmarkbar.getBoundingClientRect();
  const topChromeDrop = {
    left: Math.min(tabRect.left, bookmarkRect.left),
    right: Math.max(tabRect.right, bookmarkRect.right),
    top: Math.min(tabRect.top, bookmarkRect.top),
    bottom: Math.max(tabRect.bottom, bookmarkRect.bottom) + 18,
  };
  const dropRects = [bookmarkRect, tabRect, topChromeDrop];
  return dropRects.some(
    (rect) =>
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom,
  );
}
function getBookmarkDropFolder(clientX, clientY) {
  const element = document.elementFromPoint(clientX, clientY)?.closest?.(".bookmark-folder");
  if (!element || element.dataset.folderId === draggingBookmarkId) return "";
  return element.dataset.folderId || "";
}
function createBookmarkFolder(name = "New folder") {
  const bookmarks = getBookmarks();
  const folder = {
    type: "folder",
    id: makeId("folder"),
    title: cleanPageTitle(name) || "New folder",
    children: [],
    createdAt: new Date().toISOString(),
  };
  bookmarks.push(folder);
  activeBookmarkFolderId = folder.id;
  saveBookmarks(bookmarks);
  renderBookmarks();
  const folderElement = getBookmarkElement(folder.id);
  if (folderElement) {
    openBookmarkFolderPopover(folder.id, folderElement);
  }
  return folder;
}
function renameBookmarkFolder(folderId, name) {
  const bookmarks = getBookmarks();
  const folder = bookmarks.find((entry) => entry.id === folderId && entry.type === "folder");
  if (!folder) return;
  folder.title = cleanPageTitle(name) || "New folder";
  saveBookmarks(bookmarks);
  renderBookmarks();
}
function deleteBookmarkFolder(folderId) {
  const bookmarks = getBookmarks();
  const index = bookmarks.findIndex((entry) => entry.id === folderId && entry.type === "folder");
  if (index === -1) return;
  bookmarks.splice(index, 1);
  if (activeBookmarkFolderId === folderId) {
    closeBookmarkFolderPopover();
  }
  saveBookmarks(bookmarks);
}
function removeBookmarkFromFolder(bookmarkId, folderId) {
  const bookmarks = getBookmarks();
  const folder = bookmarks.find((entry) => entry.id === folderId && entry.type === "folder");
  if (!folder) return;
  folder.children = (folder.children || []).filter((child) => child.id !== bookmarkId);
  saveBookmarks(bookmarks);
  const folderElement = getBookmarkElement(folderId);
  if (folderElement) {
    openBookmarkFolderPopover(folderId, folderElement);
  }
  updateBookmarkToggle();
}
function deleteBookmarkById(bookmarkId, folderId = "") {
  if (!bookmarkId) return false;
  const bookmarks = getBookmarks();
  let changed = false;
  if (folderId) {
    const folder = bookmarks.find((entry) => entry.id === folderId && entry.type === "folder");
    if (folder) {
      const nextChildren = (folder.children || []).filter((child) => child.id !== bookmarkId);
      changed = nextChildren.length !== (folder.children || []).length;
      folder.children = nextChildren;
    }
  } else {
    const nextBookmarks = bookmarks.filter((entry) => entry.id !== bookmarkId);
    changed = nextBookmarks.length !== bookmarks.length;
    if (changed) {
      saveBookmarks(nextBookmarks);
      return true;
    }
    for (const entry of bookmarks) {
      if (entry.type !== "folder") continue;
      const nextChildren = (entry.children || []).filter((child) => child.id !== bookmarkId);
      if (nextChildren.length !== (entry.children || []).length) {
        entry.children = nextChildren;
        changed = true;
        break;
      }
    }
  }
  if (!changed) return false;
  saveBookmarks(bookmarks);
  if (folderId) {
    const folderElement = getBookmarkElement(folderId);
    if (folderElement) {
      openBookmarkFolderPopover(folderId, folderElement);
    }
  }
  updateBookmarkToggle();
  return true;
}
function openBookmarkMenuTarget(inNewTab = false) {
  const bookmark = getBookmarkById(
    bookmarkMenuTargetBookmarkId,
    bookmarkMenuTargetBookmarkFolderId,
  );
  const url = normalizeBookmarkUrl(bookmark?.url || "");
  closeBookmarkContextMenu();
  if (!url) return;
  closeBookmarkFolderPopover();
  if (inNewTab) {
    createTab(url, getEffectiveProxyBackend(), true);
  } else {
    loadNewPage(url, getEffectiveProxyBackend());
  }
}
function getBookmarkInsertIndex(clientX, clientY = pendingBookmarkDragY) {
  const items = Array.from(bookmarkList.querySelectorAll(".bookmark-entry")).filter(
    (element) => element.dataset.bookmarkId !== draggingBookmarkId,
  );
  if (!items.length) return 0;
  for (let index = 0; index < items.length; index += 1) {
    const rect = items[index].getBoundingClientRect();
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
  return items.length;
}
function getBookmarkElement(bookmarkId) {
  const entries = [
    ...bookmarkList.querySelectorAll(".bookmark-entry"),
    ...bookmarkFolderPopover.querySelectorAll(".bookmark-entry"),
  ];
  return entries.find((element) => element.dataset.bookmarkId === bookmarkId) || null;
}
function updateBookmarkDragGhost(clientX, clientY = pendingBookmarkDragY) {
  if (!bookmarkDragGhost || !bookmarkDragState) return;
  const barRect = getChromeDragBounds();
  const left = Math.min(
    Math.max(clientX - bookmarkDragState.offsetX, barRect.left + 8),
    barRect.right - bookmarkDragState.width - 8,
  );
  const topMin = isSideProxyBar() ? barRect.top + 4 : 8;
  const topMax = isSideProxyBar()
    ? barRect.bottom - bookmarkDragState.height - 4
    : window.innerHeight - bookmarkDragState.height - 8;
  const top = Math.min(Math.max(clientY - bookmarkDragState.offsetY, topMin), topMax);
  bookmarkDragGhost.style.transform = `translate3d(${left}px, ${top}px, 0) scale(1.015)`;
}
function createBookmarkDragGhost(bookmarkId, clientX, clientY) {
  const source = getBookmarkElement(bookmarkId);
  if (!source) return;
  const rect = source.getBoundingClientRect();
  bookmarkDragGhost?.remove();
  bookmarkDragGhost = source.cloneNode(true);
  bookmarkDragGhost.classList.remove("is-dragging");
  bookmarkDragGhost.classList.add("bookmark-drag-ghost");
  bookmarkDragGhost.querySelector(".bookmark-folder-child-remove")?.remove();
  bookmarkDragState.offsetX = clientX - rect.left;
  bookmarkDragState.offsetY = clientY - rect.top;
  bookmarkDragState.width = rect.width;
  bookmarkDragState.height = rect.height;
  bookmarkDragState.top = rect.top;
  bookmarkDragGhost.style.width = `${rect.width}px`;
  bookmarkDragGhost.style.height = `${rect.height}px`;
  document.body.appendChild(bookmarkDragGhost);
  updateBookmarkDragGhost(clientX, clientY);
}
function startBookmarkDrag(bookmarkId, event) {
  if (!bookmarkDragState || bookmarkDragState.started) return;
  draggingBookmarkId = bookmarkId;
  didDragBookmark = true;
  bookmarkDragState.started = true;
  closeBookmarkEditor();
  createBookmarkDragGhost(bookmarkId, event.clientX, event.clientY);
  renderBookmarks();
  updateBookmarkDragGhost(event.clientX, event.clientY);
}
function scheduleBookmarkDragMove(clientX, clientY) {
  pendingBookmarkDragX = clientX;
  pendingBookmarkDragY = clientY;
  if (bookmarkDragFrame) return;
  bookmarkDragFrame = requestAnimationFrame(() => {
    bookmarkDragFrame = 0;
    if (!bookmarkDragState?.started) return;
    updateBookmarkDragGhost(pendingBookmarkDragX, pendingBookmarkDragY);
    const overTabs =
      bookmarkDragState.type === "bookmark" &&
      isBookmarkTabDrop(pendingBookmarkDragX, pendingBookmarkDragY);
    markChromeDropTarget(overTabs ? tabbar : null);
    if (overTabs) return;
    if (!bookmarkDragState.sourceFolderId) {
      moveBookmarkToIndex(
        draggingBookmarkId,
        getBookmarkInsertIndex(pendingBookmarkDragX, pendingBookmarkDragY),
      );
    }
  });
}
