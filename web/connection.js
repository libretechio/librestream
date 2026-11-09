// Connection profile and stream ranking.
//
// The connection is measured once when the app starts (ping + throughput against
// this origin) and reused, so pressing Play never starts a measurement. Stream
// lists are fetched and ranked per title as soon as a title is opened, so Play is
// instant. Nothing here probes provider URLs on demand.

import { streamInfo } from './streams.js';

const PROFILE_KEY = 'librestream:connection';
const PROFILE_TTL = 30 * 60 * 1000;
const FALLBACK_BITRATES = { 4320: 60, 2160: 25, 1440: 14, 1080: 8, 720: 4, 576: 2.5, 480: 1.5, 360: 1 };

let profile = null;
let measuring = null;

export function readStoredProfile(now = Date.now()) {
  try {
    const stored = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
    if (!stored || !stored.mbps || now - stored.at > PROFILE_TTL) return null;
    return stored;
  } catch {
    return null;
  }
}

async function timedFetch(url, signal) {
  const started = performance.now();
  const response = await fetch(url, { cache: 'no-store', signal, credentials: 'same-origin' });
  const body = await response.arrayBuffer();
  const ms = performance.now() - started;
  return { ms, bytes: body.byteLength, ok: response.ok };
}

// One ping round (best of three) and one throughput sample of 256 KB.
export async function measureConnection({ signal } = {}) {
  const pings = [];
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const { ms, ok } = await timedFetch('/health', signal);
      if (ok) pings.push(ms);
    } catch {}
  }
  let mbps = 0;
  try {
    const { ms, bytes, ok } = await timedFetch('/api/ping?bytes=262144', signal);
    if (ok && bytes > 0 && ms > 0) mbps = (bytes * 8) / ms / 1000;
  } catch {}

  const estimate = Number(navigator.connection?.downlink) || 0;
  const pingMs = pings.length ? Math.round(Math.min(...pings)) : 0;
  const measured = {
    pingMs,
    mbps: Math.round(mbps * 10) / 10,
    estimate,
    saveData: Boolean(navigator.connection?.saveData),
    at: Date.now()
  };
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(measured));
  } catch {}
  return measured;
}

export function getConnectionProfile() {
  if (profile) return profile;
  profile = readStoredProfile();
  return profile;
}

// Runs at most once per session; returns the cached profile afterwards.
export function ensureConnectionProfile() {
  const existing = getConnectionProfile();
  if (existing) return Promise.resolve(existing);
  if (measuring) return measuring;
  measuring = measureConnection()
    .then((measured) => {
      profile = measured;
      return measured;
    })
    .catch(() => {
      profile = { pingMs: 0, mbps: 0, estimate: 0, saveData: false, at: Date.now(), failed: true };
      return profile;
    })
    .finally(() => {
      measuring = null;
    });
  return measuring;
}

function runtimeSeconds(runtime) {
  if (typeof runtime === 'number') return runtime > 0 ? runtime * 60 : null;
  const text = String(runtime || '');
  const hours = Number(text.match(/(\d+(?:\.\d+)?)\s*h/i)?.[1] || 0);
  const minutes = Number(text.match(/(\d+(?:\.\d+)?)\s*m/i)?.[1] || 0);
  if (hours || minutes) return hours * 3600 + minutes * 60;
  return null;
}

function describe(row, meta) {
  const { stream, info } = row;
  const text = [stream.name, stream.title, stream.description, stream.behaviorHints?.filename]
    .filter(Boolean)
    .join(' ');
  const resolution = parseInt(info?.resolution) || 0;
  const duration = runtimeSeconds(meta?.runtime);
  const sizeMatch = text.match(/\b(\d+(?:\.\d+)?)\s*(GB|GiB|MB|MiB)\b/i);
  const size =
    Number(stream.behaviorHints?.videoSize) ||
    (sizeMatch ? Number(sizeMatch[1]) * (/g/i.test(sizeMatch[2]) ? 1024 ** 3 : 1024 ** 2) : 0);
  const explicit = text.match(/\b(\d+(?:\.\d+)?)\s*(?:mbps|mbit\/s)\b/i);
  const bitrate = explicit
    ? Number(explicit[1])
    : size && duration
      ? (size * 8) / duration / 1e6
      : FALLBACK_BITRATES[resolution] || 8;
  return { ...row, resolution, bitrate, size };
}

// Ranks by what the measured connection can actually sustain. No network calls.
export function rankByProfile(rows, { meta, profile: measured, maxResolution = 2160 } = {}) {
  const active = measured || getConnectionProfile();
  const saveData = Boolean(active?.saveData);
  const target = saveData ? Math.min(maxResolution, 720) : maxResolution;
  const mbps = active?.mbps || 0;
  const sustainable = mbps ? mbps * 0.65 : 0;

  const scored = rows
    .filter((row) => row.stream?.url)
    .map((row) => {
      const described = describe(row, meta);
      const withinCap = !described.resolution || described.resolution <= target;
      const fits = !sustainable || described.bitrate <= sustainable;
      const score =
        (withinCap ? 0 : -400) +
        (fits ? 600 : -300 * (described.bitrate / Math.max(sustainable, 0.1))) +
        (described.info?.cache === 'cached' ? 60 : 0) +
        Math.min(described.resolution || 720, target) / 5 -
        Math.max(0, (described.resolution || 0) - target) / 5 -
        Math.min(described.bitrate, 100) / 10 +
        (active?.pingMs ? -Math.min(active.pingMs, 2000) / 400 : 0);
      return { ...described, fits, score };
    })
    .sort((a, b) => b.score - a.score || a.bitrate - b.bitrate);

  // Prefer something the connection can sustain; keep the best overall as a fallback.
  const viable = scored.filter((row) => row.fits);
  return viable.length ? viable : scored.slice(0, 1);
}

/* ---------------------------- per-title cache ---------------------------- */

const rankings = new Map();
const pendingStreams = new Map();
const RANKING_TTL = 10 * 60 * 1000;

// One key shape for warming and reading: type + id, never inferred from an
// episode object that may not carry a type.
export function rankingKey(meta, videoId, type) {
  return `${type || meta?.type || 'movie'}:${videoId || meta?.id}`;
}

export function readRanking(key) {
  const entry = rankings.get(key);
  if (!entry || Date.now() - entry.at > RANKING_TTL) return null;
  return entry;
}

export function writeRanking(key, value) {
  rankings.set(key, { ...value, at: Date.now() });
}

export function clearRankings() {
  rankings.clear();
  pendingStreams.clear();
}

// Fetches stream lists from every stream addon once per title and ranks them.
export function warmTitle({ key, addons, type, videoId, meta, signal, onReady }) {
  if (readRanking(key)) return Promise.resolve(readRanking(key));
  if (pendingStreams.has(key)) return pendingStreams.get(key);

  const providers = (addons || []).filter((addon) =>
    addon.resources?.some((resource) =>
      typeof resource === 'string' ? resource === 'stream' : resource.name === 'stream'
    )
  );
  if (!providers.length) return Promise.resolve(null);

  const pending = Promise.all(
    providers.map(async (addon) => {
      try {
        const url =
          '/api/addon/' + addon.index + '/stream/' + encodeURIComponent(type) + '/' + encodeURIComponent(videoId);
        const response = await fetch(url, { credentials: 'same-origin', signal });
        if (!response.ok) return [];
        const data = await response.json();
        return (Array.isArray(data.streams) ? data.streams : []).map((stream) => ({
          a: addon,
          stream,
          info: streamInfo(addon, stream)
        }));
      } catch {
        return [];
      }
    })
  )
    .then(async (groups) => {
      const rows = groups.flat();
      if (!rows.length) return null;
      const measured = await ensureConnectionProfile();
      const ranked = rankByProfile(rows, { meta, profile: measured });
      const entry = { rows, ranked, profile: measured };
      writeRanking(key, entry);
      onReady?.(entry);
      return entry;
    })
    .finally(() => pendingStreams.delete(key));

  pendingStreams.set(key, pending);
  return pending;
}
