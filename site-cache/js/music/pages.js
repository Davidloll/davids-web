export function createPages({ onMusic, onPage }) {
  const music = document.createElement("div");
  music.style.display = "contents";
  const musicAttributes = Array.from(document.body.attributes, ({ name, value }) => [name, value]);
  const musicStyles = Array.from(
    document.querySelectorAll('link[href*="/css/music"]:not([href*="music-cover"])'),
  );
  const baseStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
  const shared = new Set([
    "theme.js",
    "title.js",
    "language.js",
    "panic.js",
    "sel.js",
    "ex.js",
    "mobile.js",
  ]);
  const pages = new Map();
  let loading = Promise.resolve();
  let current = "/m",
    request;
  function attributes(values) {
    for (const attr of Array.from(document.body.attributes))
      document.body.removeAttribute(attr.name);
    for (const [name, value] of values) document.body.setAttribute(name, value);
  }
  function remember() {
    if (current === "/m") {
      musicAttributes.splice(
        0,
        musicAttributes.length,
        ...Array.from(document.body.attributes, ({ name, value }) => [name, value]),
      );
      music.append(...Array.from(document.body.childNodes).filter((node) => node !== music));
      return;
    }
    const page = pages.get(current);
    page.attributes = Array.from(document.body.attributes, ({ name, value }) => [name, value]);
    page.fragment.append(...Array.from(document.body.childNodes).filter((node) => node !== music));
  }
  function parse(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    for (const script of doc.querySelectorAll("script[data-edu]")) {
      const encoded = Array.from(
        script.textContent.matchAll(/atob\(\s*"([A-Za-z0-9+/=]+)"/g),
        (match) => match[1],
      );
      if (encoded.length < 2) continue;
      try {
        const key = atob(encoded[0]),
          bytes = atob(encoded[1]);
        const data = JSON.parse(
          new TextDecoder().decode(
            Uint8Array.from(
              bytes,
              (char, i) => char.charCodeAt(0) ^ key.charCodeAt(i % key.length),
            ),
          ),
        );
        if (typeof data.h !== "string") continue;
        doc.body.innerHTML = data.h;
        for (const attr of Array.from(doc.body.attributes)) doc.body.removeAttribute(attr.name);
        for (const [name, value] of data.a || []) doc.body.setAttribute(name, value);
        break;
      } catch {}
    }
    return doc;
  }
  async function scripts(list) {
    const ready = [],
      original = document.addEventListener,
      listen = window.addEventListener;
    window.addEventListener = function (type, handler, options) {
      if (type === "load") ready.push(() => {
        if (typeof handler === "function") handler.call(window, new Event("load"));
        else handler.handleEvent(new Event("load"));
      });
      else listen.call(this, type, handler, options);
    };
    document.addEventListener = function (type, handler, options) {
      if (type === "DOMContentLoaded") ready.push(handler);
      else original.call(this, type, handler, options);
    };
    try {
      for (const source of list) {
        const file = source.src && new URL(source.src).pathname.split("/").pop();
        if (
          shared.has(file) &&
          !(file === "theme.js" && document.body.classList.contains("settings-page"))
        )
          continue;
        if (source.hasAttribute("data-edu") || /googletagmanager/.test(source.src)) continue;
        const script = document.createElement("script");
        for (const attr of source.attributes) script.setAttribute(attr.name, attr.value);
        if (source.src) {
          script.src = source.src;
          await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = () => reject(new Error("A page script failed to load."));
            document.body.append(script);
          });
        } else {
          script.textContent = document.body.classList.contains("settings-page")
            ? `(function () {${source.textContent}\n})();`
            : source.textContent;
          document.body.append(script);
        }
      }
    } finally {
      document.addEventListener = original;
      window.addEventListener = listen;
    }
    for (const handler of ready) {
      if (typeof handler === "function") handler.call(document, new Event("DOMContentLoaded"));
      else handler.handleEvent(new Event("DOMContentLoaded"));
    }
  }
  async function navigate(path, push = true) {
    const url = new URL(path, location.origin);
    const target = ["/m", "/music"].includes(url.pathname) ? "/m" : url.pathname + url.search;
    if (target === current) {
      if (target === "/m") onMusic();
      return;
    }
    request?.abort();
    request = new AbortController();
    const signal = request.signal;
    let page = pages.get(target),
      list = [];
    if (target !== "/m" && !page) {
      const response = await fetch(target, { signal });
      if (!response.ok) throw new Error("This page could not load. Try again.");
      const doc = parse(await response.text());
      if (signal.aborted) return;
      list = Array.from(doc.querySelectorAll("script"));
      list.forEach((script) => script.remove());
      const styles = Array.from(doc.head.querySelectorAll('link[rel="stylesheet"], style'))
        .map((node) => {
          const copy = document.importNode(node, true);
          if (copy.href)
            copy.href = new URL(node.getAttribute("href"), location.origin + target).href;
          return copy;
        })
        .filter((node) => !node.href || !baseStyles.some((link) => link.href === node.href));
      page = {
        fragment: document.createDocumentFragment(),
        attributes: Array.from(doc.body.attributes, ({ name, value }) => [name, value]),
        styles,
      };
      page.fragment.append(...Array.from(doc.body.childNodes));
      pages.set(target, page);
    }
    remember();
    document.body.replaceChildren();
    pages.forEach((saved) => saved.styles.forEach((style) => style.remove()));
    musicStyles.forEach((style) => {
      style.disabled = target !== "/m";
    });
    current = target;
    if (push) history.pushState({ musicPage: true }, "", target);
    if (target === "/m") {
      attributes(musicAttributes);
      document.body.append(...music.childNodes);
      onMusic();
      window.gtag?.("event", "page_view", { page_path: "/m" });
    } else {
      attributes(page.attributes);
      document.head.append(...page.styles);
      document.body.append(page.fragment);
      music.hidden = true;
      music.style.display = "none";
      document.body.append(music);
      if (list.length) await scripts(list);
      onPage();
      window.dispatchEvent(new Event("site:pagechange"));
      window.gtag?.("event", "page_view", { page_path: target });
    }
  }
  function open(...args) {
    loading = loading.catch(() => {}).then(() => navigate(...args));
    return loading;
  }
  window.addEventListener("popstate", () => open(location.pathname + location.search, false));
  return { open, isMusic: () => current === "/m" };
}
