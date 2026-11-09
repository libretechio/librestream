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

export function parseStreamMeta(addon, stream, info) {
  const rawText = [stream.name, stream.title, stream.description, stream.behaviorHints?.filename]
    .filter(Boolean)
    .join(' ');
  const clean = (s = '') =>
    String(s)
      .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();

  const tags = [];
  if (/\b(dv|dolby\s*vision)\b/i.test(rawText)) tags.push('Dolby Vision');
  if (/\bhdr10\+?\b/i.test(rawText)) tags.push('HDR10');
  else if (/\bhdr\b/i.test(rawText)) tags.push('HDR');
  if (/\b(hevc|x265|h\.?265)\b/i.test(rawText)) tags.push('HEVC');
  else if (/\bav1\b/i.test(rawText)) tags.push('AV1');
  if (/\batmos\b/i.test(rawText)) tags.push('Atmos');
  else if (/\b(7\.1|5\.1)\b/.test(rawText)) tags.push(rawText.match(/\b(7\.1|5\.1)\b/)[1]);
  if (/\bremux\b/i.test(rawText)) tags.push('Remux');
  else if (/\bbluray|blu-ray\b/i.test(rawText)) tags.push('BluRay');
  else if (/\bweb-?dl\b/i.test(rawText)) tags.push('WEB-DL');

  const sizeMatch = rawText.match(/\b(\d+(?:\.\d+)?\s*(?:GB|MB))\b/i);
  const size =
    sizeMatch?.[1] ||
    (stream.behaviorHints?.videoSize
      ? `${(stream.behaviorHints.videoSize / 1073741824).toFixed(1)} GB`
      : null);

  const lines = String(stream.description || stream.title || '')
    .split('\n')
    .map(clean)
    .filter(Boolean);

  const primaryTitle =
    clean(stream.behaviorHints?.filename) ||
    lines[0] ||
    clean(stream.name) ||
    `${addon.name} Stream`;

  const secondaryLine = lines.slice(1).join(' · ') || clean(stream.name) || addon.name;

  return {
    primaryTitle,
    secondaryLine,
    size,
    tags: tags.slice(0, 4),
    resolutionLabel:
      info.resolution === '2160p'
        ? '4K UHD'
        : info.resolution === 'unknown'
        ? 'Auto'
        : info.resolution
  };
}
