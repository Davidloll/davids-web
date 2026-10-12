export function parseLyrics(source, duration = 0) {
  const offset = Number(source.match(/\[offset:([+-]?\d+)\]/i)?.[1] || 0) / 1000;
  const seconds = (m, s) => Number(m) * 60 + Number(s);
  const lines = [];
  for (const raw of source.split(/\r?\n/)) {
    const stamps = [...raw.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
    if (!stamps.length) continue;
    const content = raw.replace(/\[\d+:\d+(?:\.\d+)?\]/g, "").trim();
    const markers = [...content.matchAll(/<(\d+):(\d+(?:\.\d+)?)>/g)];
    const text = content.replace(/<\d+:\d+(?:\.\d+)?>/g, "").trim();
    for (const stamp of stamps) {
      const start = Math.max(0, seconds(stamp[1], stamp[2]) + offset);
      const words = [];
      if (markers.length) {
        for (let i = 0; i < markers.length; i++) {
          const marker = markers[i];
          const chunk = content
            .slice(marker.index + marker[0].length, markers[i + 1]?.index ?? content.length)
            .trim();
          if (chunk)
            words.push({
              text: chunk,
              start: seconds(marker[1], marker[2]) + offset,
              end: markers[i + 1]
                ? seconds(markers[i + 1][1], markers[i + 1][2]) + offset
                : undefined,
            });
        }
        const prefix = content.slice(0, markers[0].index).trim();
        if (prefix) words.unshift({ text: prefix, start });
      }
      lines.push({ start, text, words });
    }
  }
  lines.sort((a, b) => a.start - b.start);
  return lines.map((line, i) => {
    const end = lines[i + 1]?.start ?? (duration > line.start ? duration : line.start + 5);
    const real = line.words.length > 0;
    const words = real
      ? line.words
      : line.text
          .split(/\s+/)
          .filter(Boolean)
          .map((text) => ({ text }));
    const total = words.reduce((sum, word) => sum + word.text.length, 0) || 1;
    let progress = 0;
    const timed = words.map((word, j) => {
      const start = real ? word.start : line.start + ((end - line.start) * progress) / total;
      progress += word.text.length;
      const finish = real
        ? (word.end ?? words[j + 1]?.start ?? end)
        : line.start + ((end - line.start) * progress) / total;
      return { ...word, start, end: Math.max(start, finish) };
    });
    return { ...line, end, words: timed };
  });
}
export function activeLine(lines, time) {
  let low = 0,
    high = lines.length - 1,
    found = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (lines[middle].start <= time) {
      found = middle;
      low = middle + 1;
    } else high = middle - 1;
  }
  return found;
}
export function wordProgress(word, time) {
  return Math.min(1, Math.max(0, (time - word.start) / Math.max(0.001, word.end - word.start)));
}
