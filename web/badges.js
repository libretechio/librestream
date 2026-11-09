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
  const extras = meta.app_extras || {};
  return String(
    meta.certification || meta.ageRating || extras.certification || ''
  ).trim().slice(0, 8);
}

// A Rotten Tomatoes score is only shown when the provider actually sent one.
export function rottenTomatoesOf(meta = {}) {
  const extras = meta.app_extras || {};
  const raw =
    meta.rtRating || meta.rottenTomatoes || meta.tomatoMeter ||
    meta.tomatoMeterRating || extras.rtRating || extras.tomatoMeter || extras.rottenTomatoes;
  if (raw === undefined || raw === null || raw === '') return null;
  const value = typeof raw === 'object' ? raw.score ?? raw.value ?? raw.rating : raw;
  const score = Number(String(value).replace('%', ''));
  if (!Number.isFinite(score) || score < 0 || score > 100) return null;
  const certified = Boolean(
    (typeof raw === 'object' && raw.certified) || meta.rtCertified || extras.rtCertified
  );
  return { score, certified };
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
  let largest = 0;
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
    const size = Number(stream.behaviorHints?.videoSize) ||
      (text.match(/\b(\d+(?:\.\d+)?)\s*(GB|GiB|MB|MiB)\b/i)
        ? Number(RegExp.$1) * (/g/i.test(RegExp.$2) ? 1024 ** 3 : 1024 ** 2)
        : 0);
    if (size > largest) largest = size;
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
    size: largest,
    total: streams.length
  };
}

export function availabilityBadges(availability) {
  if (!availability) return [];
  const badges = [];
  const top = (availability.resolutions || [])[0];
  if (top) badges.push(top === '2160p' ? '4K' : top);
  if (availability.dv) badges.push('DV');
  else if (availability.hdr) badges.push('HDR');
  if (availability.atmos) badges.push('Atmos');
  if (availability.remux) badges.push('REMUX');
  if (availability.languages?.length) {
    badges.push(`${availability.languages.length} lang`);
  }
  return badges;
}

export function formatSize(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return '';
  const gb = value / 1024 ** 3;
  if (gb >= 1) return `${gb >= 10 ? Math.round(gb) : gb.toFixed(1)} GB`;
  const mb = value / 1024 ** 2;
  return mb >= 1 ? `${Math.round(mb)} MB` : '';
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

// Certification and a Rotten Tomatoes score only arrive with the full metadata,
// so they are remembered per title after it has been opened once.
export function rememberTitleMeta(key, { cert, rt } = {}) {
  if (!key) return;
  try {
    const store = readAvailabilityStore();
    const entry = store[key] || {};
    if (cert) entry.cert = cert;
    if (rt && rt.score) entry.rt = rt.score;
    if (!Object.keys(entry).length) return;
    store[key] = entry;
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {}
}

export function rememberAvailability(key, availability) {
  if (!key) return;
  try {
    const store = readAvailabilityStore();
    // Merge: certification and the RT score arrive from metadata and must survive.
    store[key] = {
      ...store[key],
      resolutions: availability.resolutions || [],
      languages: (availability.languages || []).slice(0, 8),
      cached: availability.cached,
      hdr: availability.hdr,
      dv: availability.dv,
      atmos: availability.atmos,
      remux: availability.remux,
      size: availability.size || 0,
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

// Bounded background read of the streams for a handful of visible titles, so the
// poster strips have real data without the user opening every card.
export const PREFETCH_LIMIT = 12;

export function titlesNeedingAvailability(items, store, limit = PREFETCH_LIMIT) {
  const out = [];
  const seen = new Set();
  for (const item of items) {
    if (!item) continue;
    const type = item.type || 'movie';
    const key = type + ':' + item.id;
    if (!item.id || seen.has(key) || store[key]) continue;
    seen.add(key);
    out.push({ key, type, id: item.id });
    if (out.length >= limit) break;
  }
  return out;
}

export async function prefetchAvailability(targets, { addons, signal, onResult, concurrency = 2, timeoutMs = 7000 } = {}) {
  const queue = [...targets];
  const providers = (addons || []).filter(addon =>
    addon.resources?.some(resource =>
      typeof resource === 'string' ? resource === 'stream' : resource.name === 'stream'
    )
  );
  if (!providers.length) return 0;

  const readOne = async (target) => {
    const results = await Promise.all(
      providers.map(async (addon) => {
        const url =
          '/api/addon/' + addon.index + '/stream/' + encodeURIComponent(target.type) + '/' + encodeURIComponent(target.id);
        const timer = setTimeout(() => {}, 0);
        try {
          const response = await fetch(url, { credentials: 'same-origin', signal });
          if (!response.ok) return null;
          const data = await response.json();
          return Array.isArray(data.streams) ? data.streams : null;
        } catch {
          return null;
        } finally {
          clearTimeout(timer);
        }
      })
    );
    const streams = results.filter(Boolean).flat();
    if (!streams.length) return false;
    const availability = availabilityFromStreams(streams);
    if (!availability.total) return false;
    rememberAvailability(target.key, availability);
    onResult?.(target.key, availability);
    return true;
  };

  let done = 0;
  const worker = async () => {
    while (queue.length) {
      if (signal?.aborted) return;
      const target = queue.shift();
      try {
        if (await readOne(target)) done += 1;
      } catch {}
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, worker));
  return done;
}
