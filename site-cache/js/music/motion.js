const pending = new WeakMap();
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
export function fade(element) {
  if (reduced.matches) return;
  element.getAnimations().forEach((animation) => animation.cancel());
  element.animate([{ opacity: 0.45 }, { opacity: 1 }], {
    duration: 180,
    easing: "ease-out",
  });
}
export function changeArtwork(image, source) {
  if (pending.get(image) === source) return;
  pending.set(image, source);
  if (image.getAttribute("src") === source) return;
  const preload = new Image();
  function apply(url) {
    if (pending.get(image) !== source) return;
    const changed = Boolean(image.getAttribute("src"));
    image.src = url;
    if (changed) fade(image);
  }
  preload.onload = () => apply(source);
  preload.onerror = () => apply("/png/logo.png");
  preload.src = source;
}
