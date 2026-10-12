const paths = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  repeat: '<path d="m17 2 4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4M21 13v3a2 2 0 0 1-2 2H3"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',
  previous: '<path d="M5 5v14M19 5 7 12l12 7Z"/>',
  next: '<path d="M19 5v14M5 5l12 7-12 7Z"/>',
  play: '<path d="m8 5 11 7-11 7Z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  volume: '<path d="m11 5-6 4H2v6h3l6 4ZM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/>',
  muted: '<path d="m11 5-6 4H2v6h3l6 4ZM16 9l6 6M22 9l-6 6"/>',
  lyrics: '<path d="m11 7.601-5.994 8.19a1 1 0 0 0 .1 1.298l.817.818a1 1 0 0 0 1.314.087L15.09 12"/><path d="M16.5 21.174C15.5 20.5 14.372 20 13 20c-2.058 0-3.928 2.356-6 2-2.072-.356-2.775-3.369-1.5-4.5"/><circle cx="16" cy="7" r="5"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  heart:
    '<path d="M20.8 4.6a5.4 5.4 0 0 0-7.6 0L12 5.8l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 21l8.8-8.8a5.4 5.4 0 0 0 0-7.6Z"/>',
  playlist: '<path d="M4 5h12M4 10h12M4 15h7M17 13v8M13 17h8"/>',
  queue: '<path d="M4 5h16M4 10h16M4 15h7M15 14l6 4-6 4Z"/>',
  edit: '<path d="m15 4 5 5M4 20l4-1L20 7a3 3 0 0 0-4-4L4 15Z"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',
  up: '<path d="m6 14 6-6 6 6"/>',
  down: '<path d="m6 10 6 6 6-6"/>',
  back: '<path d="M19 12H5m6-7-7 7 7 7"/>',
  external: '<path d="M14 4h6v6M20 4 10 14M18 13v7H4V6h7"/>',
  repeatOne: '<path d="m17 2 4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4M21 13v3a2 2 0 0 1-2 2H3"/><path d="M11 10h1v5"/>',
  history:'<path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5M12 7v5l3 3"/>',
};
export function icon(button, name) {
  button.innerHTML = `<svg data-icon="${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${name === "lyrics" ? 2 : 1.8}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
}
