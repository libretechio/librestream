// Per-identity profiles, kept on the server so a person's watchlist, resume
// points, preferences and addon choices follow their Authentik account to any
// device. One JSON file per identity, named by a hash of the Authentik uid, so
// a filename can never be chosen by a request.
import { mkdir, readFile, rename, writeFile, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const SAVED_MAX = 400;
const PROGRESS_MAX = 2000;
const ENTRY_MAX = 4096;
const PREFERENCES_MAX = 4096;
const ADDON_LIST_MAX = 200;
const WRITES_PER_MINUTE = 120;

export const EMPTY_PROFILE = Object.freeze({
  version: 1,
  savedRev: 0,
  saved: {},
  progress: {},
  preferences: {},
  addons: { disabled: [], order: [] }
});

const key = (entry) => {
  const type = typeof entry?.type === 'string' ? entry.type.slice(0, 24) : 'movie';
  const id = typeof entry?.id === 'string' ? entry.id.slice(0, 120) : '';
  return id ? type + ':' + id : '';
};

function bounded(value, limit) {
  try {
    return JSON.stringify(value).length <= limit;
  } catch {
    return false;
  }
}

// Anything a browser sends is untrusted. Keep only the shapes the client reads,
// drop oversized values, and never let a key or an entry grow without a cap.
function cleanEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
  if (!key(entry)) return null;
  return bounded(entry, ENTRY_MAX) ? entry : null;
}

function cleanProgress(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k, value] of Object.entries(raw)) {
    if (!/^[a-z]{2,24}:[A-Za-z0-9:_-]{1,120}$/.test(k)) continue;
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    if (!bounded(value, ENTRY_MAX)) continue;
    out[k] = value;
    if (Object.keys(out).length >= PROGRESS_MAX) break;
  }
  return out;
}

function cleanPreferences(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (!bounded(raw, PREFERENCES_MAX)) return null;
  return raw;
}

function cleanAddons(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const list = (value) =>
    Array.isArray(value)
      ? [...new Set(value.filter((v) => typeof v === 'string' && /^[a-f0-9]{8,64}$/.test(v)))].slice(0, ADDON_LIST_MAX)
      : [];
  return { disabled: list(raw.disabled), order: list(raw.order) };
}

function publicProfile(record, empty) {
  return {
    saved: Object.values(record.saved)
      .filter((item) => !item.deleted)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .map((item) => item.entry),
    progress: record.progress,
    preferences: record.preferences,
    addons: record.addons,
    rev: record.savedRev,
    updatedAt: record.updatedAt || null,
    empty: Boolean(empty)
  };
}

export function createProfileStore({ dir = 'data/profiles', now = Date.now } = {}) {
  const cache = new Map();
  const writes = new Map();
  const ready = mkdir(dir, { recursive: true, mode: 0o700 });

  const pathFor = (id) => join(dir, createHash('sha256').update(String(id)).digest('hex') + '.json');

  async function load(id) {
    const hashed = createHash('sha256').update(String(id)).digest('hex');
    if (cache.has(hashed)) return cache.get(hashed);
    await ready;
    let record = null;
    try {
      const parsed = JSON.parse(await readFile(pathFor(id), 'utf8'));
      record = {
        ...EMPTY_PROFILE,
        ...parsed,
        saved: parsed?.saved && typeof parsed.saved === 'object' ? parsed.saved : {},
        progress: cleanProgress(parsed?.progress),
        preferences: cleanPreferences(parsed?.preferences) || {},
        addons: cleanAddons(parsed?.addons) || { disabled: [], order: [] }
      };
    } catch {
      record = null;
    }
    cache.set(hashed, record);
    return record;
  }

  async function persist(id, record) {
    await ready;
    const file = pathFor(id);
    const temp = file + '.' + process.pid + '.tmp';
    // Write then rename: a reader never sees half a profile.
    await writeFile(temp, JSON.stringify(record), { mode: 0o600 });
    await rename(temp, file);
  }

  function rateLimited(id) {
    const at = now();
    const entry = writes.get(id) || { count: 0, since: at };
    if (at - entry.since > 60_000) {
      entry.count = 0;
      entry.since = at;
    }
    entry.count += 1;
    writes.set(id, entry);
    if (writes.size > 5000) writes.delete(writes.keys().next().value);
    return entry.count > WRITES_PER_MINUTE;
  }

  async function read(id) {
    const record = await load(id);
    if (!record) return publicProfile({ ...EMPTY_PROFILE, saved: {}, progress: {}, preferences: {}, addons: EMPTY_PROFILE.addons }, true);
    return publicProfile(record, false);
  }

  async function update(id, patch) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw Error('Invalid profile update');
    if (rateLimited(id)) {
      const error = Error('Too many profile updates. Try again in a minute.');
      error.status = 429;
      throw error;
    }
    const at = now();
    const record = (await load(id)) || {
      ...EMPTY_PROFILE,
      saved: {},
      progress: {},
      preferences: {},
      addons: { disabled: [], order: [] }
    };

    if (Array.isArray(patch.saved)) {
      const seen = new Set();
      for (const entry of patch.saved.slice(0, SAVED_MAX)) {
        const clean = cleanEntry(entry);
        if (!clean) continue;
        const k = key(clean);
        seen.add(k);
        record.saved[k] = { entry: clean, updatedAt: at, deleted: false };
      }
      // A device that loaded the list before another device changed it cannot
      // know what was removed there, so only honour removals from a client that
      // is up to date. Otherwise merge.
      const current = Number(patch.baseRev);
      if (Number.isFinite(current) && current === record.savedRev) {
        for (const [k, item] of Object.entries(record.saved)) {
          if (!item.deleted && !seen.has(k)) record.saved[k] = { ...item, deleted: true, updatedAt: at };
        }
      }
      record.savedRev += 1;
      const keys = Object.keys(record.saved);
      if (keys.length > SAVED_MAX * 2) {
        // Drop the oldest tombstones first; live entries go last.
        keys
          .filter((k) => record.saved[k].deleted)
          .sort((a, b) => (record.saved[a].updatedAt || 0) - (record.saved[b].updatedAt || 0))
          .slice(0, keys.length - SAVED_MAX)
          .forEach((k) => delete record.saved[k]);
      }
    }

    if (patch.progress !== undefined) {
      // Per-title merge: two devices watching different titles both keep theirs.
      record.progress = { ...record.progress, ...cleanProgress(patch.progress) };
      const keys = Object.keys(record.progress);
      if (keys.length > PROGRESS_MAX) {
        keys
          .sort((a, b) => (record.progress[a]?.updatedAt || 0) - (record.progress[b]?.updatedAt || 0))
          .slice(0, keys.length - PROGRESS_MAX)
          .forEach((k) => delete record.progress[k]);
      }
    }

    if (patch.preferences !== undefined) {
      const clean = cleanPreferences(patch.preferences);
      if (clean) record.preferences = clean;
    }

    if (patch.addons !== undefined) {
      const clean = cleanAddons(patch.addons);
      if (clean) record.addons = clean;
    }

    record.updatedAt = at;
    const hashed = createHash('sha256').update(String(id)).digest('hex');
    cache.set(hashed, record);
    await persist(id, record);
    return publicProfile(record, false);
  }

  async function forget(id) {
    const hashed = createHash('sha256').update(String(id)).digest('hex');
    cache.delete(hashed);
    await ready;
    try {
      await unlink(pathFor(id));
    } catch {}
  }

  return { read, update, forget };
}
