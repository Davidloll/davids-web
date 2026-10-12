import { h } from "/js/vendor/dreamland/core.js";
const links = [
  { href: "/", src: "/png/house-solid.svg", alt: "home" },
  { href: "/g", src: "/png/gamepad-solid.svg", alt: "games" },
  { href: "/a", src: "/png/apps.svg", alt: "apps" },
  { href: "/t", src: "/png/tool.svg", alt: "tools" },
  { href: "/m", src: "/png/music.svg", alt: "music" },
  { href: "https://discord.gg/vVqY36mzvj", src: "/png/other.svg", alt: "discord" },
  { href: "/s", src: "/png/gear-solid.svg", alt: "settings" },
];
function translate(key, fallback) {
  return window.lang?.t(key, {}, fallback) || fallback;
}
function renderNavigation() {
  const mount = document.querySelector(
    "[data-navigation], .navbar-right[data-language-navigation]",
  );
  if (!mount) return;
  mount.replaceWith(
    h(
      "nav",
      {
        class: "navbar-right",
        "data-language-navigation": "",
        "aria-label": translate("nav.navigation", "Primary navigation"),
      },
      ...links.map(({ href, src, alt }) =>
        h("a", { href, "aria-label": translate(`nav.${alt}`, alt) }, h("img", { src, alt: "" })),
      ),
    ),
  );
}
renderNavigation();
window.addEventListener("site:languagechange", renderNavigation);
window.addEventListener("site:pagechange", renderNavigation);
