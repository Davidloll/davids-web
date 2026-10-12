import { musicFetch, musicData } from "/js/music/proxy.js";
export function visibleTracks(tracks) {
  return (tracks || []).filter((track) => track && !track.unavailable);
}
export async function api(path, signal) {
  const resolving = /^(source|alternate)\//.test(path);
  const attempts = resolving ? 1 : 3;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await musicFetch(`/api/music/${path}`, {
        signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(resolving ? 60000 : 25000)]),
      });
      const json = response.headers.get("content-type")?.includes("application/json");
      const body = json ? await response.json() : {};
      if (!response.ok) {
        const error = new Error(body.error || "Music is temporarily unavailable. Please retry.");
        error.status = response.status;
        throw error;
      }
      if (!json) throw new Error("Music needs the Truffled server.");
      return musicData(body);
    } catch (error) {
      if (
        signal?.aborted ||
        (error.status && ![408, 500, 502, 503, 504].includes(error.status)) ||
        attempt === attempts - 1
      )
        throw error;
      await new Promise((resolve, reject) => {
        const abort = () => {
          clearTimeout(timer);
          reject(signal.reason);
        };
        const timer = setTimeout(
          () => {
            signal?.removeEventListener("abort", abort);
            resolve();
          },
          350 * (attempt + 1),
        );
        signal?.addEventListener("abort", abort, { once: true });
      });
    }
  }
}
