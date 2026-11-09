// Cache state is provider-reported; an unlabelled HTTP URL is not proof of a TorBox cache hit.
export function streamInfo(addon, stream) {
  const text = [stream.name, stream.title, stream.description, stream.behaviorHints?.filename]
    .filter(Boolean)
    .join(' ');
  const quality = text.match(/\b(2160|1440|1080|720|576|480|360)p?\b/i)?.[1];
  const resolution = quality
    ? quality + 'p'
    : /\b(4k|uhd)\b/i.test(text)
    ? '2160p'
    : /\b8k\b/i.test(text)
    ? '4320p'
    : /\bfhd\b/i.test(text)
    ? '1080p'
    : /\bhd\b/i.test(text)
    ? '720p'
    : /\bsd\b/i.test(text)
    ? '480p'
    : 'unknown';
  const torbox = /\btor\s?box\b|\bTB(?:\+|\b)/i.test(text);
  const negative = /\b(uncached|not cached|cache miss|download(?:ing)?|queued)\b|❌|⬇/i.test(text);
  const positive = /\bcached\b|cache hit|instant|\bTB\+|⚡|✅/i.test(text);
  return {
    resolution,
    cache: torbox ? (negative ? 'uncached' : positive ? 'cached' : 'unknown') : 'unknown',
    addon: String(addon.index)
  };
}

export function filterStreams(rows, filters) {
  return rows.filter((row) =>
    Object.entries(filters).every(([key, value]) => value === 'all' || row.info[key] === value)
  );
}
