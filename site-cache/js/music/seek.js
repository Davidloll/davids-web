export function setupSeek(input, format) {
  const tip = document.createElement("output");
  tip.className = "seek-time";
  tip.hidden = true;
  document.body.append(tip);
  function show(event) {
    if (input.disabled) return;
    const rect = input.getBoundingClientRect();
    const ratio = event?.clientX === undefined
      ? Number(input.value) / Number(input.max)
      : Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    tip.textContent = format(ratio * Number(input.max));
    tip.style.left = `${rect.left + ratio * rect.width}px`;
    tip.style.top = `${rect.top - 28}px`;
    tip.hidden = false;
  }
  input.addEventListener("pointermove", show);
  input.addEventListener("pointerdown", show);
  input.addEventListener("input", () => show());
  input.addEventListener("focus", () => show());
  input.addEventListener("pointerleave", () => { tip.hidden = true; });
  input.addEventListener("blur", () => { tip.hidden = true; });
}
