const musicOrigin = "https://music.truffled.invalid";
const nativeFetch = globalThis.fetch.bind(globalThis);
export function musicStored(value) {
  if (typeof value === "string") {
    const match = value.match(/\/api\/music\/scramjet\/[^/]+\/[^/]+\/(.+)$/);
    if (!match) return value;
    try {
      const url = new URL(decodeURIComponent(match[1]));
      return url.origin === musicOrigin ? url.pathname + url.search : value;
    } catch { return value; }
  }
  if (Array.isArray(value)) return value.map(musicStored);
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, musicStored(item)]));
  return value;
}
export function musicUrl(value) { return musicStored(value); }
export function musicData(value) { return musicStored(value); }
export async function musicFetch(url, options) {
  return nativeFetch(musicUrl(url), { credentials: "same-origin", ...options });
}
