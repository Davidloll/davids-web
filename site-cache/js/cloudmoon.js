let cloudmoonCss;
function cloudmoonStyles() {
  return cloudmoonCss ||= fetch("/css/cloudmoon.css", { cache: "no-cache" }).then(response => {
    if (!response.ok) throw new Error("CSS " + response.status);
    return response.text();
  }).catch(error => { cloudmoonCss = null; throw error; });
}

function cloudmoon(document, win, restart) {
  const style = document.createElement("style");
  style.id = "truffled";
  cloudmoonStyles().then(css => { style.textContent = css; }).catch(error => console.warn("[cloudmoon] styles failed", error.message));
  let reconnect;
  function disconnected() {
    return Array.from(document.querySelectorAll(".dialog")).find(dialog => /^disconnected$/i.test(dialog.querySelector("h2")?.textContent.trim() || ""));
  }
  function connect() {
    if (!restart || reconnect) return;
    const dialog = disconnected();
    if (!dialog) return;
    const body = dialog.querySelector(".dialog-body");
    if (body) body.textContent = "Reconnecting…";
    reconnect = win.setTimeout(restart, 1200);
  }
  document.addEventListener("click", (event) => {
    const dialog = disconnected();
    if (restart && dialog && event.target.closest?.(".dialog-button,.dialog-backdrop")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      connect();
      return;
    }
    if (event.target.matches(".modal-overlay,.queue-overlay")) event.stopImmediatePropagation();
  }, true);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.querySelector(".modal-overlay,.queue-overlay")) event.stopImmediatePropagation();
  }, true);
  let video;
  let resize;
  let layout;
  let played = false;
  const timer = setInterval(update, 250);
  let queued = false;
  function update() {
    queued = false;
    for (const button of document.querySelectorAll(".sidebar-panel-item")) {
      const title = button.querySelector(".sidebar-panel-title")?.textContent.replace(/\s+/g, " ").trim() || "";
      button.classList.toggle("cm-hide", /^(full screen(?: with ads)?|remove ads)$/i.test(title));
    }
    connect();
    if (!style.isConnected && document.documentElement) {
      (document.head || document.documentElement).appendChild(style);
    }
    const streaming = !!document.querySelector("#gameWrapper,#remote-video");
    document.documentElement.classList.toggle("cm-stream", streaming);
    played = streaming || Array.from(document.querySelectorAll(".modal-overlay,.queue-overlay,.dialog,#login-password")).some(el => el.getClientRects().length > 0);
    if (played) clearInterval(timer);
    document.documentElement.classList.toggle("cm-loading", !played);
    const tip = document.querySelector(".pwd-tip>div");
    const help = "Use your CloudMoon email and password. New accounts require Google or Apple sign-in first.";
    if (tip && tip.textContent !== help) tip.textContent = help;
    const email = document.getElementById("login-email");
    if (email && email.placeholder !== "Account email") {
      email.placeholder = "Account email";
      email.setAttribute("aria-label", "Account email");
    }
    const stream = document.getElementById("remote-video");
    if (stream && stream !== video) {
      video = stream;
      resize?.disconnect();
      let pending = false;
      const game = document.getElementById("gameWrapper");
      const box = document.getElementById("video-wrapper");
      const fit = () => {
        if (pending || !box || !game) return;
        pending = true;
        win.requestAnimationFrame(() => {
          pending = false;
          layout?.disconnect();
          const area = game.getBoundingClientRect();
          const width = stream.videoWidth;
          const height = stream.videoHeight;
          if (width && height && area.width && area.height) {
            const scale = Math.min(area.width / width, area.height / height);
            box.style.setProperty("--cm-width", `${width * scale}px`);
            box.style.setProperty("--cm-height", `${height * scale}px`);
          }
          layout?.observe(box, { attributes: true, attributeFilter: ["style", "class"], subtree: true });
        });
      };
      layout?.disconnect();
      layout = new win.MutationObserver(fit);
      if (box) layout.observe(box, { attributes: true, attributeFilter: ["style", "class"], subtree: true });
      if (game && win.ResizeObserver) {
        resize = new win.ResizeObserver(fit);
        resize.observe(game);
      }
      stream.addEventListener("loadedmetadata", fit);
      stream.addEventListener("resize", fit);
      win.requestAnimationFrame(fit);
    }
    for (const el of document.querySelectorAll(".queue-modal button,.queue-modal>div,.queue-info~div,.queue-modal>section")) {
      var t = el.textContent || "";
      if (/premium|\$\d|subscribe|purchase|skip the (wait|queue)/i.test(t) && !el.classList.contains("cm-promo") && !el.querySelector(".info-item,.go-button,.retry-button"))
        el.classList.add("cm-promo");
    }
    for (const el of document.querySelectorAll("div,span,p")) {
      if (!el.children.length && /^advertisement$/i.test(el.textContent.trim()))
        (el.closest(".a-div-vertical,.a-div-horizontal,.a-div-placeholder") || el).style.setProperty("display", "none", "important");
    }
    if (!document.querySelector(".game-start")) return;
    for (const button of document.querySelectorAll("button,[role=button]")) {
      if (!played && /^play$/i.test(button.textContent.trim()) && !button.disabled)
        button.click();
    }
  }
  const observer = new win.MutationObserver(() => {
    if (queued) return;
    queued = true;
    queueMicrotask(update);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  update();
  win.addEventListener("pagehide", () => { observer.disconnect(); resize?.disconnect(); layout?.disconnect(); clearInterval(timer); win.clearTimeout(reconnect); }, { once: true });
}

function createCloudmoonPlugin(navigate) {
  return new (class extends globalThis.$scramjetController.ManagedPlugin {
    constructor() {
      super("cloudmoon", []);
    }
    install(frame) {
      super.install(frame);
      let game;
      const failures = new Set();
      const hosts = new Set(["api.prod.cloudmoonapp.com", "api.cloudmoon.cloudbatata.com", "api.prod.geometry.today", "hrz5zfjq02.execute-api.us-east-1.amazonaws.com", "api.prod.viewoncloud.com"]);
      this.tap(frame.hooks.fetch.request, async (event, state) => {
        const url = new URL(String(state.url));
        if (url.protocol !== "https:" || !hosts.has(url.hostname)) return;
        const method = state.init?.method || event.request.method || "GET";
        if (!["GET", "POST"].includes(method)) return;
        const headers = Object.fromEntries(new Headers(state.init?.headers || event.request.headers));
        const body = method === "POST" && state.init?.body != null
          ? await new Response(state.init.body).text()
          : undefined;
        try {
          state.earlyResponse = await fetch("/api/cloudmoon/relay", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: url.href, method, headers, body }),
          });
          if (state.earlyResponse.status >= 500) {
            const key = url.pathname + ":" + state.earlyResponse.status;
            if (!failures.has(key)) {
              failures.add(key);
              console.warn("[cloudmoon] API unavailable", method, url.pathname, state.earlyResponse.status);
            }
          }
        } catch (error) {
          const key = url.pathname + ":" + error.name;
          if (!failures.has(key)) {
            failures.add(key);
            console.warn("[cloudmoon] relay connection failed", method, url.pathname, error.message);
          }
        }
      });
      this.tap(frame.hooks.init.post, (event) => {
        const url = new URL(event.client.url.href);
        if (url.hostname !== "web.cloudmoonapp.com") return;
        if (url.pathname.startsWith("/game/")) game = url.href;
        const win = event.window;
        win.eval('try { localStorage.setItem("newWindowLaunch", "false"); } catch {}');
        const open = win.open;
        function go(value) {
          try {
            const url = new URL(String(value || ""), event.client.url.href);
            if (url.hostname !== "web.cloudmoonapp.com") return false;
            navigate(url.href);
            return true;
          } catch {
            return false;
          }
        }
        win.open = function (url, ...args) {
          if ((!url || String(url) === "about:blank") && win.document.querySelector(".queue-overlay")) return null;
          if (url && go(url)) return win;
          return open.call(this, url, ...args);
        };
        win.document.addEventListener("click", (click) => {
          const link = click.target.closest?.("a[target]");
          if (!link || !["_blank", "_top", "_parent"].includes(link.target)) return;
          if (go(link.getAttribute("scramjet-attr-href") || link.getAttribute("href"))) {
            click.preventDefault();
            click.stopImmediatePropagation();
          }
        }, true);
        const style = () => cloudmoon(win.document, win, game ? () => go(game) : null);
        if (win.document.documentElement) style();
        else win.document.addEventListener("DOMContentLoaded", style, { once: true });
      });
    }
  })();
}
