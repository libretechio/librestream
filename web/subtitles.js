import { supports } from './api.js';

const LANG_NAMES = {
  en: 'English', eng: 'English', es: 'Spanish', spa: 'Spanish', fr: 'French', fre: 'French',
  de: 'German', ger: 'German', it: 'Italian', ita: 'Italian', pt: 'Portuguese', por: 'Portuguese',
  'pt-br': 'Portuguese (BR)', nl: 'Dutch', pl: 'Polish', ru: 'Russian', tr: 'Turkish', ar: 'Arabic',
  hi: 'Hindi', ja: 'Japanese', jpn: 'Japanese', ko: 'Korean', kor: 'Korean', zh: 'Chinese',
  'zh-cn': 'Chinese (Simplified)', 'zh-tw': 'Chinese (Traditional)', sv: 'Swedish', no: 'Norwegian',
  da: 'Danish', fi: 'Finnish', cs: 'Czech', el: 'Greek', he: 'Hebrew', hu: 'Hungarian',
  id: 'Indonesian', ms: 'Malay', ro: 'Romanian', th: 'Thai', uk: 'Ukrainian', vi: 'Vietnamese',
  fa: 'Persian', bn: 'Bengali', ta: 'Tamil', te: 'Telugu'
};

export function languageName(code) {
  const key = String(code || '').toLowerCase();
  return LANG_NAMES[key] || LANG_NAMES[key.split(/[-_]/)[0]] || (key ? key.toUpperCase() : 'Unknown');
}

function fileHint(stream) {
  const name = stream?.behaviorHints?.filename || '';
  return String(name).slice(0, 300);
}

export function subtitleQuery(meta, stream, videoId) {
  const filename = fileHint(stream);
  const size = Number(stream?.behaviorHints?.videoSize) || 0;
  const params = new URLSearchParams();
  if (filename) params.set('filename', filename);
  if (size > 0) params.set('videoSize', String(Math.round(size)));
  return { id: videoId || meta?.id || '', params };
}

// Subtitle addons are queried with the same file hints the Stremio protocol uses.
export async function fetchSubtitles(addons, { type, videoId, stream, signal }) {
  const providers = (addons || []).filter(addon => supports(addon, 'subtitles', type));
  if (!providers.length || !videoId) return { tracks: [], providers: 0, failed: 0 };
  const { params } = subtitleQuery({}, stream, videoId);
  const results = await Promise.all(
    providers.map(async addon => {
      const url = `/api/subtitles/list/${addon.index}/${encodeURIComponent(type)}/${encodeURIComponent(videoId)}?${params.toString()}`;
      try {
        const response = await fetch(url, { credentials: 'same-origin', signal });
        if (!response.ok) throw Error('unavailable');
        const data = await response.json();
        return (Array.isArray(data.subtitles) ? data.subtitles : []).map(item => ({
          id: item.id,
          url: item.url,
          lang: String(item.lang || 'und').toLowerCase(),
          language: languageName(item.lang),
          addon: item.addon,
          kind: 'addon'
        }));
      } catch {
        return null;
      }
    })
  );
  const failed = results.filter(result => result === null).length;
  const seen = new Set();
  const tracks = results
    .filter(Boolean)
    .flat()
    .filter(track => {
      if (!track.url) return false;
      // One entry per addon and language: providers return dozens of releases per language.
      const key = `${track.addon}:${track.lang}`;
      if (seen.has(key) || seen.has(track.url)) return false;
      seen.add(key);
      seen.add(track.url);
      return true;
    })
    .sort((a, b) => {
      const rank = track => (track.lang.startsWith('en') ? 0 : 1);
      return rank(a) - rank(b) || a.language.localeCompare(b.language) || a.addon.localeCompare(b.addon);
    });
  return { tracks, providers: providers.length, failed };
}

export function mergeSubtitleTracks(...groups) {
  const seen = new Set();
  const merged = [];
  for (const group of groups) {
    for (const track of group || []) {
      const key = track.kind === 'addon' ? track.url : `${track.kind}:${track.language}:${track.index}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(track);
    }
  }
  return merged;
}
