// Poster and title badges. Every value here comes from addon metadata or stream
// text that the provider actually sent; nothing is inferred for display.

const FLAG_LANGUAGES = {
  '🇬🇧': 'English', '🇺🇸': 'English', '🇦🇺': 'English', '🇨🇦': 'English', '🇳🇿': 'English',
  '🇮🇹': 'Italian', '🇷🇺': 'Russian', '🇱🇹': 'Lithuanian', '🇩🇪': 'German', '🇫🇷': 'French',
  '🇪🇸': 'Spanish', '🇯🇵': 'Japanese', '🇰🇷': 'Korean', '🇨🇳': 'Chinese', '🇹🇼': 'Chinese',
  '🇭🇰': 'Chinese', '🇵🇹': 'Portuguese', '🇧🇷': 'Portuguese', '🇳🇱': 'Dutch', '🇵🇱': 'Polish',
  '🇹🇷': 'Turkish', '🇸🇪': 'Swedish', '🇩🇰': 'Danish', '🇳🇴': 'Norwegian', '🇫🇮': 'Finnish',
  '🇨🇿': 'Czech', '🇸🇰': 'Slovak', '🇭🇺': 'Hungarian', '🇬🇷': 'Greek', '🇮🇱': 'Hebrew',
  '🇮🇳': 'Hindi', '🇹🇭': 'Thai', '🇻🇳': 'Vietnamese', '🇺🇦': 'Ukrainian', '🇷🇴': 'Romanian',
  '🇸🇦': 'Arabic', '🇦🇪': 'Arabic', '🇮🇩': 'Indonesian', '🇲🇾': 'Malay', '🇵🇭': 'Filipino',
  '🇪🇪': 'Estonian', '🇱🇻': 'Latvian', '🇸🇮': 'Slovenian', '🇭🇷': 'Croatian', '🇷🇸': 'Serbian',
  '🇧🇬': 'Bulgarian', '🇮🇸': 'Icelandic', '🇪🇺': 'Multi'
};

const MULTI_MARKERS = /🌎|🌐|\bmulti(?:-|\s)?(?:audio|lang|subs?)\b/i;

export function parseRuntimeMinutes(runtime) {
  if (typeof runtime === 'number' && runtime > 0) return runtime;
  const text = String(runtime || '');
  const hours = Number(text.match(/(\d+)\s*h/i)?.[1] || 0);
  const minutes = Number(text.match(/(\d+)\s*m/i)?.[1] || 0);
  if (hours || minutes) return hours * 60 + minutes;
  const bare = text.match(/^(\d+)$/);
  return bare ? Number(bare[1]) : 0;
}

export function runtimeLabel(runtime) {
  const total = parseRuntimeMinutes(runtime);
  if (!total) return '';
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (!hours) return `${minutes}m`;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

// A title counts as new only when the provider sent a release date close to today.
export function isNew(meta = {}, now = Date.now(), windowDays = 45) {
  const raw = meta.released || meta.firstAired;
  if (!raw) return false;
  const at = Date.parse(raw);
  if (!Number.isFinite(at)) return false;
  const age = now - at;
  return age >= 0 && age <= windowDays * 86400000;
}

export function episodeSummary(videos = []) {
  if (!Array.isArray(videos) || !videos.length) return '';
  const seasons = [...new Set(videos.map(v => Number(v.season ?? 0)).filter(n => n > 0))].sort((a, b) => a - b);
  const episodes = videos.filter(v => Number(v.season ?? 0) > 0).length;
  if (!seasons.length) return '';
  if (seasons.length === 1) return `${episodes} ep${episodes === 1 ? '' : 's'}`;
  return `${seasons.length} seasons`;
}

// Cinemeta sends "10 wins & 13 nominations total". Keep the wins, they are the signal.
export function awardsBadge(awards) {
  const text = String(awards || '');
  const wins = text.match(/(\d+)\s+win/i);
  const noms = text.match(/(\d+)\s+nomination/i) || text.match(/nominated\s+for\s+(\d+)/i);
  if (wins && Number(wins[1]) > 0) return `${wins[1]} wins`;
  if (noms && Number(noms[1]) > 0) return `${noms[1]} noms`;
  return '';
}

export function certificationOf(meta = {}) {
  return String(meta.certification || meta.ageRating || '').trim().slice(0, 8);
}

export function languageList(text, limit = 4) {
  const source = String(text || '');
  const found = [];
  for (const [flag, name] of Object.entries(FLAG_LANGUAGES)) {
    if (source.includes(flag) && !found.includes(name)) found.push(name);
  }
  if (!found.length && MULTI_MARKERS.test(source)) found.push('Multi');
  const rest = found.length - limit;
  return { shown: found.slice(0, limit), rest: Math.max(0, rest), all: found };
}

// Reads what the providers actually claim for this title's streams.
export function availabilityFromStreams(streams = []) {
  const resolutions = new Set();
  const languages = [];
  let cached = 0;
  let hdr = false;
  let dv = false;
  let atmos = false;
  let remux = false;
  for (const stream of streams) {
    const text = [stream.name, stream.title, stream.description, stream.behaviorHints?.filename]
      .filter(Boolean)
      .join(' ');
    if (/\b(2160p?|4k|uhd)\b/i.test(text)) resolutions.add('2160p');
    else if (/\b1440p\b/i.test(text)) resolutions.add('1440p');
    else if (/\b1080p?\b|\bfhd\b/i.test(text)) resolutions.add('1080p');
    else if (/\b720p?\b|\bhd\b/i.test(text)) resolutions.add('720p');
    else if (/\b(480p|576p|sd)\b/i.test(text)) resolutions.add('480p');
    if (/\b(dv|dolby\s*vision)\b/i.test(text)) dv = true;
    if (/\bhdr(10)?\b/i.test(text)) hdr = true;
    if (/\batmos\b/i.test(text)) atmos = true;
    if (/\bremux\b/i.test(text)) remux = true;
    if (/\b(ready\s*\(tb\)|tb\+|cached|instant)\b|⚡/i.test(text)) cached += 1;
    for (const name of languageList(text, 99).all) {
      if (name !== 'Multi' && !languages.includes(name)) languages.push(name);
    }
  }
  const order = ['2160p', '1440p', '1080p', '720p', '480p'];
  return {
    resolutions: [...resolutions].sort((a, b) => order.indexOf(a) - order.indexOf(b)),
    languages,
    cached,
    hdr,
    dv,
    atmos,
    remux,
    total: streams.length
  };
}

export function availabilityBadges(availability) {
  if (!availability) return [];
  const badges = [];
  const top = availability.resolutions[0];
  if (top) badges.push(top === '2160p' ? '4K' : top.replace('p', 'p'));
  if (availability.dv) badges.push('DV');
  else if (availability.hdr) badges.push('HDR');
  if (availability.atmos) badges.push('Atmos');
  if (availability.remux) badges.push('REMUX');
  if (availability.languages?.length) {
    badges.push(availability.languages.slice(0, 2).join(' / '));
    if (availability.languages.length > 2) badges.push(`+${availability.languages.length - 2}`);
  }
  return badges;
}

// Availability is remembered per title after the user opens it: no extra requests.
const STORE_KEY = 'librestream:availability';

export function readAvailabilityStore() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || {};
  } catch {
    return {};
  }
}

export function rememberAvailability(key, availability) {
  if (!key) return;
  try {
    const store = readAvailabilityStore();
    store[key] = {
      resolutions: availability.resolutions,
      languages: availability.languages.slice(0, 8),
      cached: availability.cached,
      hdr: availability.hdr,
      dv: availability.dv,
      atmos: availability.atmos,
      remux: availability.remux,
      at: Date.now()
    };
    const keys = Object.keys(store);
    if (keys.length > 400) delete store[keys[0]];
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {}
}

export function posterMetaLine(meta = {}) {
  const bits = [];
  const year = meta.year || meta.releaseInfo;
  if (year) bits.push(String(year).slice(0, 9));
  if (meta.type === 'series') {
    const eps = episodeSummary(meta.videos);
    if (eps) bits.push(eps);
    else bits.push('Series');
  } else if (meta.type === 'movie') {
    bits.push('Movie');
  }
  const runtime = runtimeLabel(meta.runtime);
  if (runtime) bits.push(runtime);
  return bits.join(' · ');
}
