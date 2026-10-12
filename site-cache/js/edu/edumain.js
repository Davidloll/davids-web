[{ src: "/js/panic.js" }, { src: "/js/title.js" }].forEach(({ src }) => {
  const script = document.createElement("script");
  script.src = src;
  script.charset = "UTF-8";
  document.head.appendChild(script);
});
var homeProxy = Object.freeze({
  storage: {
    backend: "proxyBackend",
    versionKey: "proxyDefaultVersion",
    pendingUrl: "pendingProxyUrl",
    showFooter: "showProxyFooterOnLoad",
  },
  version: "studying-v2",
});
function isUrl(val = "") {
  return /^http(s?):\/\//.test(val) || (val.includes(".") && val.slice(0, 1) !== " ");
}
function normalizeSearchInput(value) {
  let url = value.trim();
  if (!isUrl(url)) {
    url =
      window.searchEngines?.buildUrl(url) ||
      "https://duckduckgo.com/?q=" + encodeURIComponent(url);
  } else if (!url.startsWith("https://") && !url.startsWith("http://")) {
    url = "https://" + url;
  }
  return url;
}
function showHomeSearchError(message) {
  const error = document.querySelector("#uv-error");
  const errorCode = document.querySelector("#uv-error-code");
  if (error) error.textContent = message;
  if (errorCode) errorCode.textContent = "";
}
function updateHomeSearchPlaceholder() {
  const input = document.querySelector("#uv-address");
  if (!input) return;
  const engine = window.searchEngines?.get();
  input.placeholder = `Search ${engine?.label || "DuckDuckGo"} or type an URL`;
}
function getSavedProxyBackend() {
  localStorage.setItem(homeProxy.storage.backend, "studying");
  return "studying";
}
function getEffectiveProxyBackend() {
  return getSavedProxyBackend();
}
function launchSearchFromHome(rawValue) {
  const value = typeof rawValue === "string" ? rawValue.trim() : "";
  if (!value) return;
  const url = normalizeSearchInput(value);
  const backend = getEffectiveProxyBackend();
  sessionStorage.setItem(homeProxy.storage.pendingUrl, url);
  sessionStorage.removeItem("encodedUrl");
  sessionStorage.setItem("activeProxyBackend", backend);
  sessionStorage.setItem(homeProxy.storage.showFooter, "true");
  const searchPage = new URL("search.html", location.href);
  searchPage.searchParams.set("url", url);
  if (window.truffledNavigate) window.truffledNavigate(searchPage.href);
  else location.assign(searchPage.href);
}
document.querySelector("#uv-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const rawValue = document.querySelector("#uv-address").value.trim();
  if (!rawValue) return;
  launchSearchFromHome(rawValue);
});
updateHomeSearchPlaceholder();
window.addEventListener("site:pagechange", updateHomeSearchPlaceholder);
window.addEventListener("storage", (event) => {
  if (event.key === window.searchEngines?.key) {
    updateHomeSearchPlaceholder();
  }
});
const texts = [
  "Games with your Desire!",
  "laugtherhouse? that sound awesome, i love you laugh",
  "auk.cc on tiktok",
  "the nether...",
  "Gatekeep this at all cost",
  "im a bun im a bun",
  "Join the discord for more links",
  "mttg in the works",
  "linux > macos",
  "king lebron...",
  "I need money, cashapp: $pumpedkidd",
  "Chickenbutt",
  "mario pleaseeeeeee",
  "reeeeee boiiiiiiii lol moment",
  "mexi has a good site",
  "tyler is the best artist",
  "i all i want to do is mehhhhhhhhhh",
  "sealie wants my milkshakes -frogie1",
  "i am BIGCHUNGUS BOIIII",
  "i have 32.14$ on adsterra 5/8/25",
  "highschool scares me",
  "nah nah nah call me daddy",
  "gurt: sybau",
  "teto, miku, neru",
  "gamprodev🥷",
  "hawk1: you wanna say something?",
  "hawk2: uhhhhhhhhhh",
  "my school hates me",
  "dab on the haters",
  "the f students, there my inventors",
  "nickolas",
  "greyson mess fanclub",
  "There's a sun around the bend.",
  "iis2 > nightly manor",
  "20200229 2",
  "who tryna go to 165 S Main St #100b, Harrisonburg, VA 22801",
  "shout out to corbin. rip him cuz dmca",
  "shape world",
  "frogies sybersecurity class",
  "eagler craft server soon",
  "complex.lat",
  "grigger from limbus company",
  "BABY SHLAWNG",
  "npm run fart",
  "41 minutes",
  "67 mango st",
  "windhawk is fireeeee",
  "porting games is my passion",
  "the gazebo family",
  "nick playing in recess",
  "play bogs niche items on rbx",
  "can you translate that for me mexi?",
  "scooby doo pa pa",
  "bro can we just exile this:",
  "profile system was a hell to make.",
  "w faps?",
  "l faps?",
  "trash faps?",
  "illegal faps?",
  "amazing faps?",
  "steamrip my goat <333",
  "when theres rain, theres thunder...",
  "los pollos is ass at fort 🤣",
  "bocchi the rock firee",
  "cs2 bhop back baby <33",
  "effoc",
  "barber shop",
  "steven here",
  "MEOWL",
  "truman show",
  "MEOWL",
  "MEOWL",
  "MEOWL",
  "MEOWL",
  "toma toma toma toma toma toma toma toma toma toma toma toma toma toma toma toma toma toma toma toma toma toma toma toma toma toma toma toma ",
  "you need to NERD OUT",
  "labubu?",
  "yall have a good night",
  "zack is a piggy",
  "OINK OINK OINK OINK OINK OINK",
  "jobi :eyes:",
  "AYE WASSUP COOKIE. calm down g",
  "gucci bucket gucci bucket",
  "silksong soon...",
  "tn please partner again",
  "What??? is this even possible???????????",
  "eunoia is a CLANKER",
  "ref do something",
  "peterbot word",
  "bonnie",
  "indian nick",
  "i wrap it like a jolly rancher",
  "https://discord.gg/CDd8BFcyWW",
  "people will call me a skid, js say my site is bad.",
  "i love mac demarco",
];
const selected = texts[Math.floor(Math.random() * texts.length)];
const container = document.getElementById("random-text");
if (container) {
  const textNode = document.createElement("span");
  textNode.textContent = selected;
  container.appendChild(textNode);
  if (selected === "mario pleaseeeeeee") {
    const img = document.createElement("img");
    img.src = "/extra/mario.png";
    img.alt = "pleaseeeeeee";
    img.style.display = "block";
    img.style.marginTop = "10px";
    img.style.height = "200px";
    img.onerror = () => img.remove();
    container.appendChild(img);
  }
}
(function () {
  const modal = document.getElementById("info-modal");
  const title = document.getElementById("info-title");
  const panels = {
    credits: document.getElementById("info-panel-credits"),
    dmca: document.getElementById("info-panel-dmca"),
    privacy: document.getElementById("info-panel-privacy"),
  };
  function setActivePanel(panelName) {
    const key = panels[panelName] ? panelName : "credits";
    title.textContent = window.lang?.t(`home.${key}`, {}, key) || key;
    Object.entries(panels).forEach(([name, panel]) => {
      const active = name === key;
      panel.hidden = !active;
      panel.classList.toggle("is-active", active);
    });
  }
  function openModal(panelName) {
    setActivePanel(panelName);
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  }
  function closeModal() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  }
  document.querySelectorAll(".legal-trigger").forEach((btn) => {
    btn.addEventListener("click", () => openModal(btn.dataset.infoPanel || "credits"));
  });
  document.querySelectorAll("[data-info-close]").forEach((btn) => {
    btn.addEventListener("click", closeModal);
  });
})();
