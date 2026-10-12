function getInspectBounds() {
  const railRect = isSideProxyBar() ? proxySidebarRail.getBoundingClientRect() : null;
  const barPosition = document.body.dataset.proxyBarPosition;
  const leftEdge = barPosition === "left" && railRect ? railRect.right : 0;
  const rightEdge = barPosition === "right" && railRect ? railRect.left : window.innerWidth;
  return {
    min: 280,
    max: Math.max(280, rightEdge - leftEdge - 240),
  };
}
function getInspectWidth() {
  const width = Number.parseFloat(getComputedStyle(inspectPanel).width);
  return Number.isFinite(width) ? width : window.innerWidth / 2;
}
function applyInspectWidth(width, save = false) {
  const bounds = getInspectBounds();
  const nextWidth = Math.min(bounds.max, Math.max(bounds.min, width));
  document.body.style.setProperty("--inspect-panel-width", `${nextWidth}px`);
  inspectResizeHandle?.setAttribute("aria-valuemin", String(bounds.min));
  inspectResizeHandle?.setAttribute("aria-valuemax", String(bounds.max));
  inspectResizeHandle?.setAttribute("aria-valuenow", String(Math.round(nextWidth)));
  if (save) {
    localStorage.setItem(proxyConfig.storage.devtoolsWidth, String(nextWidth));
  }
}
function applySavedInspectWidth() {
  const savedWidth = Number(localStorage.getItem(proxyConfig.storage.devtoolsWidth));
  if (Number.isFinite(savedWidth) && savedWidth > 0) {
    applyInspectWidth(savedWidth);
  }
}
function resizeInspectFromPointer(clientX) {
  const panelRight = inspectPanel.getBoundingClientRect().right;
  applyInspectWidth(panelRight - clientX);
}
function startInspectResize(event) {
  if (event.button !== 0) return;
  event.preventDefault();
  inspectResizeState = { pointerId: event.pointerId };
  document.body.classList.add("inspect-resizing");
  inspectResizeHandle.setPointerCapture?.(event.pointerId);
  resizeInspectFromPointer(event.clientX);
}
function moveInspectResize(event) {
  if (!inspectResizeState || event.pointerId !== inspectResizeState.pointerId) {
    return;
  }
  event.preventDefault();
  resizeInspectFromPointer(event.clientX);
}
function finishInspectResize(event) {
  if (!inspectResizeState || event.pointerId !== inspectResizeState.pointerId) {
    return;
  }
  if (inspectResizeHandle.hasPointerCapture?.(event.pointerId)) {
    inspectResizeHandle.releasePointerCapture(event.pointerId);
  }
  inspectResizeState = null;
  document.body.classList.remove("inspect-resizing");
  applyInspectWidth(getInspectWidth(), true);
}
function handleInspectResizeKeydown(event) {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  const change = event.key === "ArrowLeft" ? 24 : -24;
  applyInspectWidth(getInspectWidth() + change, true);
}
function reloadInspectPanel() {
  if (!document.body.classList.contains("inspect-panel-open")) return;
  if (liteConsole) {
    hookLiteConsole();
    return;
  }
  if (!inspectDevtoolsFrame.src) return;
  inspectDevtoolsFrame.contentWindow?.location.reload();
}
var liteConsole = null;
function getInspectTarget() {
  try {
    return iframe?.contentDocument?.getElementById("proxy-frame")?.contentWindow || null;
  } catch {
    return null;
  }
}
function formatLite(value) {
  if (typeof value === "string") return value;
  if (value === undefined) return "undefined";
  if (typeof value === "function") return String(value).slice(0, 500);
  if (value && typeof value === "object") {
    if (typeof value.stack === "string" && "message" in value) {
      return String(value);
    }
    if (typeof value.outerHTML === "string") {
      return value.outerHTML.slice(0, 500);
    }
  }
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}
function writeLite(level, args) {
  if (!liteConsole) return;
  const { log } = liteConsole;
  const row = document.createElement("div");
  row.className = `lite-console-row is-${level}`;
  row.textContent = args.map(formatLite).join(" ");
  const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 24;
  log.appendChild(row);
  if (log.childElementCount > 500) log.firstElementChild.remove();
  if (atBottom) log.scrollTop = log.scrollHeight;
}
function hookLiteConsole() {
  const target = getInspectTarget();
  if (!target || !liteConsole) return;
  try {
    if (liteConsole.hooked.has(target.console)) return;
    liteConsole.hooked.add(target.console);
    for (const level of ["log", "info", "warn", "error", "debug"]) {
      const original = target.console[level];
      target.console[level] = function (...args) {
        writeLite(level, args);
        return original.apply(this, args);
      };
    }
    target.addEventListener("error", (event) => {
      writeLite("error", [event.error || event.message]);
    });
    target.addEventListener("unhandledrejection", (event) => {
      writeLite("error", [event.reason]);
    });
  } catch {}
}
function useLiteConsole() {
  if (liteConsole) return;
  inspectDevtoolsFrame.style.display = "none";
  inspectDevtoolsFrame.removeAttribute("src");
  const box = document.createElement("div");
  box.className = "lite-console";
  box.innerHTML =
    '<div class="lite-console-bar"><span>console</span><button type="button">clear</button></div><div class="lite-console-log"></div><form class="lite-console-input"><span>&gt;</span><input type="text" spellcheck="false" autocomplete="off" aria-label="run javascript" /></form>';
  inspectPanel.appendChild(box);
  const input = box.querySelector("input");
  liteConsole = {
    log: box.querySelector(".lite-console-log"),
    hooked: new WeakSet(),
    history: [],
    spot: 0,
  };
  box.querySelector("button").addEventListener("click", () => {
    liteConsole.log.replaceChildren();
  });
  box.querySelector("form").addEventListener("submit", (event) => {
    event.preventDefault();
    const code = input.value;
    if (!code.trim()) return;
    input.value = "";
    liteConsole.history.push(code);
    liteConsole.spot = liteConsole.history.length;
    writeLite("input", [code]);
    const target = getInspectTarget();
    if (!target) {
      writeLite("error", ["open a page first"]);
      return;
    }
    hookLiteConsole();
    try {
      writeLite("result", [target.eval(code)]);
    } catch {
      writeLite("error", [error]);
    }
  });
  input.addEventListener("keydown", (event) => {
    const { history } = liteConsole;
    if (event.key === "ArrowUp" && liteConsole.spot > 0) {
      event.preventDefault();
      liteConsole.spot -= 1;
      input.value = history[liteConsole.spot];
    } else if (event.key === "ArrowDown" && liteConsole.spot < history.length) {
      event.preventDefault();
      liteConsole.spot += 1;
      input.value = history[liteConsole.spot] || "";
    }
  });
  hookLiteConsole();
  setInterval(() => {
    if (document.body.classList.contains("inspect-panel-open")) {
      hookLiteConsole();
    }
  }, 1000);
  input.focus();
}
function loadInspectFrame() {
  let done = false;
  const fail = () => {
    if (done) return;
    done = true;
    useLiteConsole();
  };
  const timer = setTimeout(fail, 10000);
  inspectDevtoolsFrame.addEventListener(
    "load",
    () => {
      clearTimeout(timer);
      let works = false;
      try {
        works =
          inspectDevtoolsFrame.contentWindow.location.pathname.startsWith("/studying/dt/") &&
          inspectDevtoolsFrame.contentDocument.title.startsWith("DevTools");
      } catch {}
      if (works) done = true;
      else fail();
    },
    { once: true },
  );
  inspectDevtoolsFrame.src = `/studying/dt/chii_app.html#?embedded=${location.origin}`;
}
function warmProxy() {
  const run = () => {
    navigator.serviceWorker
      ?.register("/study.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {});
    const files = [
      "/studying/lesson.js",
      "/studying/lesson.wasm",
      "/studying/session.js",
      "/studying/page.js",
      window.proxyTransport?.getModule() || "/epoxy/index.mjs",
      "/epoxy/epoxy.wasm",
    ];
    for (const file of files) fetch(file).catch(() => {});
  };
  if (window.requestIdleCallback) requestIdleCallback(run, { timeout: 2000 });
  else setTimeout(run, 500);
}
