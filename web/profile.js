// Client half of server-side profiles. The server holds the truth; this file
// keeps a local cache so playback reads are instant, and coalesces writes so a
// progress tick is not a request.
const NS = 'librestream:';
const DEBOUNCE = 1200;

let uid = null;
let baseRev = 0;
let timer = null;
let sending = null;
let retry = 0;
const pending = new Map();

const localKey = (name) => NS + uid + ':' + name;

function readLocal(name, fallback) {
  try {
    return JSON.parse(localStorage.getItem(localKey(name))) || fallback;
  } catch {
    return fallback;
  }
}

function writeLocal(name, value) {
  try {
    localStorage.setItem(localKey(name), JSON.stringify(value));
  } catch {}
}

function hydrate(profile) {
  if (!profile || !uid) return;
  if (Array.isArray(profile.saved)) writeLocal('saved', profile.saved);
  if (profile.progress && typeof profile.progress === 'object') writeLocal('progress', profile.progress);
  if (profile.preferences && Object.keys(profile.preferences).length) writeLocal('preferences', profile.preferences);
  if (profile.addons) writeLocal('addons', profile.addons);
}

async function send(payload) {
  const response = await fetch('/api/profile', {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (response.status === 401) throw Error('signed-out');
  if (!response.ok) throw Error('profile-unsaved');
  const profile = await response.json();
  baseRev = profile.rev ?? baseRev;
  return profile;
}

async function flush({ keepalive = false } = {}) {
  if (!uid || !pending.size || sending) return;
  const payload = Object.fromEntries(pending);
  pending.clear();
  if (payload.saved) payload.baseRev = baseRev;
  try {
    sending = send(payload);
    await sending;
    retry = 0;
  } catch (error) {
    // Put the values back so the next flush carries them, and keep a copy in
    // the browser: nothing is lost if the server is briefly unreachable.
    for (const [name, value] of Object.entries(payload)) if (!pending.has(name)) pending.set(name, value);
    retry = Math.min(retry + 1, 5);
    clearTimeout(timer);
    timer = setTimeout(() => flush(), 2000 * retry);
    if (error.message === 'signed-out') pending.clear();
  } finally {
    sending = null;
  }
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(() => flush(), DEBOUNCE);
}

// Called once at start-up. Returns the profile, hydrating the local cache so
// synchronous readers (the player's resume point) see it immediately.
export async function loadProfile(id) {
  uid = id;
  let profile;
  try {
    const response = await fetch('/api/profile', { credentials: 'same-origin' });
    if (response.status === 401) throw Error('signed-out');
    if (!response.ok) throw Error('profile-unavailable');
    profile = await response.json();
  } catch (error) {
    // Offline or server trouble: carry on from the cache.
    return {
      saved: readLocal('saved', []),
      progress: readLocal('progress', {}),
      preferences: readLocal('preferences', {}),
      addons: readLocal('addons', { disabled: [], order: [] }),
      offline: true
    };
  }
  baseRev = profile.rev || 0;
  hydrate(profile);
  if (profile.empty) {
    // First sign-in from this account: upload what this browser already has so
    // nothing a person saved is lost in the move.
    const saved = readLocal('saved', []);
    const progress = readLocal('progress', {});
    const preferences = readLocal('preferences', {});
    if (saved.length || Object.keys(progress).length || Object.keys(preferences).length) {
      try {
        const merged = await send({ saved, progress, preferences, baseRev: 0 });
        hydrate(merged);
        return merged;
      } catch {}
    }
  }
  return profile;
}

// Every existing writeState() call now lands here: cache first, then a
// coalesced server write.
export function saveState(name, value) {
  if (!uid) return;
  writeLocal(name, value);
  pending.set(name, value);
  schedule();
}

export function readState(name, fallback) {
  return readLocal(name, fallback);
}

export function savePreferences(preferences) {
  saveState('preferences', preferences);
}

export function saveAddonConfig(config) {
  saveState('addons', config);
}

// Order first, then enabled: a person's own arrangement, applied to the
// server's registry. Unknown ids are ignored, so a removed addon cannot
// resurrect itself.
export function applyAddonConfig(addons, config) {
  const order = config?.order || [];
  const disabled = new Set(config?.disabled || []);
  const rank = (addon) => {
    const at = order.indexOf(addon.id);
    return at === -1 ? order.length : at;
  };
  return addons
    .filter((addon) => !disabled.has(addon.id))
    .slice()
    .sort((a, b) => rank(a) - rank(b) || a.index - b.index);
}

export function flushNow() {
  if (!uid || !pending.size) return;
  const payload = Object.fromEntries(pending);
  pending.clear();
  if (payload.saved) payload.baseRev = baseRev;
  // Leaving the page: keepalive lets the request outlive the document.
  try {
    fetch('/api/profile', {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true
    });
  } catch {}
}
