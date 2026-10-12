import { visibleTracks } from "/js/music/api.js";
export function createRecommended({ api, library }) {
  let seeds = [],
    next = 0,
    pool = [],
    shown = [],
    busy = null;
  const seen = new Set();
  const name = (track) => `${track.title}|${track.artist}`.toLowerCase();
  function pickSeeds() {
    const saved = library.get();
    const tracks = [...library.history().map((entry) => entry.track), ...saved.recent, ...saved.likes.slice().reverse()];
    const ids = new Set();
    return tracks.filter((track) => track?.id && !ids.has(track.id) && ids.add(track.id)).slice(0, 15);
  }
  async function fill(count, exclude) {
    while (pool.length < count && next < seeds.length) {
      const batch = seeds.slice(next, next + 3);
      next += batch.length;
      const lists = await Promise.all(
        batch.map((seed) => api(`recommendations?seed=${encodeURIComponent(seed.id)}`).then((data) => visibleTracks(data.tracks), () => [])),
      );
      for (let i = 0; lists.some((list) => i < list.length); i++)
        for (const list of lists) {
          const track = list[i];
          if (!track || seen.has(track.id) || seen.has(name(track)) || exclude.has(track.id)) continue;
          seen.add(track.id);
          seen.add(name(track));
          pool.push(track);
        }
    }
  }
  return {
    reset() {
      seeds = pickSeeds();
      next = 0;
      pool = [];
      shown = [];
      busy = null;
      seen.clear();
      for (const seed of seeds) {
        seen.add(seed.id);
        seen.add(name(seed));
      }
    },
    hasSeeds: () => seeds.length > 0,
    shown: () => shown,
    canLoadMore: () => pool.length > 0 || next < seeds.length,
    more(count, exclude = new Set()) {
      busy ||= fill(count, exclude)
        .then(() => {
          shown = [...shown, ...pool.splice(0, count)];
          return shown;
        })
        .finally(() => {
          busy = null;
        });
      return busy;
    },
  };
}
