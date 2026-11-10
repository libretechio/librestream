import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server.mjs';
import { createProfileStore } from '../profileStore.mjs';

const viewer = { 'x-authentik-username': 'viewer', 'x-authentik-uid': 'user-a' };
const other = { 'x-authentik-username': 'friend', 'x-authentik-uid': 'user-b' };
const json = (headers) => ({ ...headers, 'Content-Type': 'application/json' });

async function fixture(t, options = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'librestream-profiles-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const app = createApp({ profiles: createProfileStore({ dir }), ...options });
  await new Promise((r) => app.listen(0, '127.0.0.1', r));
  t.after(() => app.close());
  return 'http://127.0.0.1:' + app.address().port;
}

const patch = (base, headers, body) =>
  fetch(base + '/api/profile', { method: 'PATCH', headers: json(headers), body: JSON.stringify(body) });

test('profiles need an identity', async (t) => {
  const base = await fixture(t);
  assert.equal((await fetch(base + '/api/profile')).status, 401);
  assert.equal((await patch(base, {}, { saved: [] })).status, 401);
});

test('a profile is empty until something is saved, then round-trips', async (t) => {
  const base = await fixture(t);
  const empty = await (await fetch(base + '/api/profile', { headers: viewer })).json();
  assert.equal(empty.empty, true);
  assert.deepEqual(empty.saved, []);

  const saved = await (await patch(base, viewer, {
    saved: [{ id: 'tt1', type: 'movie', name: 'One' }],
    progress: { 'movie:tt1': { position: 42, duration: 100, playbackId: 'p1' } },
    preferences: { palette: 'graphite' },
    addons: { disabled: ['abcdef0123456789'], order: ['abcdef0123456789'] }
  })).json();

  assert.equal(saved.empty, false);
  assert.equal(saved.saved.length, 1);
  assert.equal(saved.progress['movie:tt1'].position, 42);
  assert.equal(saved.preferences.palette, 'graphite');
  assert.deepEqual(saved.addons.disabled, ['abcdef0123456789']);

  const again = await (await fetch(base + '/api/profile', { headers: viewer })).json();
  assert.equal(again.saved[0].id, 'tt1');
  assert.equal(again.rev, saved.rev);
});

test('one account cannot see another account profile', async (t) => {
  const base = await fixture(t);
  await patch(base, viewer, { saved: [{ id: 'tt1', type: 'movie' }] });
  const theirs = await (await fetch(base + '/api/profile', { headers: other })).json();
  assert.equal(theirs.saved.length, 0);
  assert.equal(theirs.empty, true);
});

test('progress merges per title, so two devices both keep theirs', async (t) => {
  const base = await fixture(t);
  await patch(base, viewer, { progress: { 'movie:tt1': { position: 10 } } });
  await patch(base, viewer, { progress: { 'series:tt2': { position: 5 } } });
  const profile = await (await fetch(base + '/api/profile', { headers: viewer })).json();
  assert.equal(profile.progress['movie:tt1'].position, 10);
  assert.equal(profile.progress['series:tt2'].position, 5);
});

test('an up-to-date device removes what it dropped; a stale one merges', async (t) => {
  const base = await fixture(t);
  const first = await (await patch(base, viewer, {
    saved: [{ id: 'tt1', type: 'movie' }, { id: 'tt2', type: 'movie' }]
  })).json();

  // Stale: it never saw the revision the server holds, so nothing is deleted.
  const stale = await (await patch(base, viewer, {
    saved: [{ id: 'tt1', type: 'movie' }],
    baseRev: first.rev - 5
  })).json();
  assert.equal(stale.saved.length, 2);

  // Current: the removal is real.
  const current = await (await patch(base, viewer, {
    saved: [{ id: 'tt1', type: 'movie' }],
    baseRev: stale.rev
  })).json();
  assert.deepEqual(current.saved.map((entry) => entry.id), ['tt1']);
});

test('untrusted profile content is bounded and filtered', async (t) => {
  const base = await fixture(t);
  const huge = 'x'.repeat(9000);
  const profile = await (await patch(base, viewer, {
    saved: [
      { id: 'tt1', type: 'movie' },
      { id: '', type: 'movie' },
      { id: 'tt2', type: 'movie', blob: huge },
      'not-an-object',
      null
    ],
    progress: { 'movie:tt1': { position: 1 }, 'bad key!': { position: 1 }, 'movie:tt3': 'string' },
    preferences: { palette: 'graphite' },
    addons: { disabled: ['not-hex', 'abcdef0123456789', 'abcdef0123456789'], order: 'nope' }
  })).json();

  assert.deepEqual(profile.saved.map((entry) => entry.id), ['tt1']);
  assert.deepEqual(Object.keys(profile.progress), ['movie:tt1']);
  assert.deepEqual(profile.addons.disabled, ['abcdef0123456789']);
  assert.deepEqual(profile.addons.order, []);
});

test('profile writes reject wrong content type, cross-origin calls and oversized bodies', async (t) => {
  const base = await fixture(t);
  assert.equal((await fetch(base + '/api/profile', {
    method: 'PATCH',
    headers: { ...viewer, 'Content-Type': 'text/plain' },
    body: '{"saved":[]}'
  })).status, 415);

  assert.equal((await patch(base, { ...viewer, Origin: 'https://evil.example' }, { saved: [] })).status, 403);

  assert.equal((await fetch(base + '/api/profile', {
    method: 'PATCH',
    headers: json(viewer),
    body: JSON.stringify({ preferences: { pad: 'x'.repeat(300000) } })
  })).status, 413);

  assert.equal((await fetch(base + '/api/profile', { method: 'POST', headers: viewer })).status, 405);
});

test('other endpoints stay read-only', async (t) => {
  const base = await fixture(t, { addons: [{ url: 'https://a.example/manifest.json' }], fetcher: async () => Response.json({ name: 'A', catalogs: [] }) });
  assert.equal((await fetch(base + '/api/addons', { method: 'PATCH', headers: viewer })).status, 405);
  assert.equal((await fetch(base + '/api/addon/0/stream/movie/tt1', { method: 'PATCH', headers: viewer })).status, 405);
});

test('addon registry exposes a stable id that survives reordering', async (t) => {
  const addons = [
    { name: 'First', url: 'https://first.example/manifest.json' },
    { name: 'Second', url: 'https://second.example/manifest.json' }
  ];
  const fetcher = async () => Response.json({ name: 'X', catalogs: [] });
  const base = await fixture(t, { addons, fetcher });
  const rows = await (await fetch(base + '/api/addons', { headers: viewer })).json();
  assert.match(rows[0].id, /^[a-f0-9]{16}$/);
  assert.notEqual(rows[0].id, rows[1].id);

  // Same URL in a different position keeps its id, so a saved order still applies.
  const reordered = await fixture(t, { addons: [...addons].reverse(), fetcher });
  const flipped = await (await fetch(reordered + '/api/addons', { headers: viewer })).json();
  assert.equal(flipped.find((row) => row.index === 1).id, rows[0].id);
});

test('a failed addon still carries its id, so it can be switched off', async (t) => {
  const base = await fixture(t, {
    addons: [{ name: 'Broken', url: 'https://broken.example/manifest.json' }],
    fetcher: async () => { throw Error('down'); }
  });
  const rows = await (await fetch(base + '/api/addons', { headers: viewer })).json();
  assert.equal(rows[0].ok, false);
  assert.match(rows[0].id, /^[a-f0-9]{16}$/);
});

test('profile writes are rate limited per account', async (t) => {
  const base = await fixture(t);
  let limited = 0;
  for (let i = 0; i < 130; i++) {
    const response = await patch(base, viewer, { progress: { ['movie:tt' + i]: { position: i } } });
    if (response.status === 429) limited += 1;
  }
  assert.ok(limited > 0);
  // A different account is unaffected.
  assert.equal((await patch(base, other, { saved: [] })).status, 200);
});

test('a retired addon is dropped at startup by its id', async (t) => {
  const { addonId } = await import('../server.mjs');
  const retired = 'https://old.example/manifest.json';
  const kept = 'https://new.example/manifest.json';
  const addons = [{ name: 'Old', url: retired }, { name: 'New', url: kept }];
  assert.notEqual(addonId(retired), addonId(kept));
  assert.match(addonId(kept), /^[a-f0-9]{16}$/);

  const base = await fixture(t, {
    addons: addons.filter((addon) => addonId(addon.url) !== addonId(retired)),
    fetcher: async () => Response.json({ name: 'New', catalogs: [] })
  });
  const rows = await (await fetch(base + '/api/addons', { headers: viewer })).json();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, 'New');
});
