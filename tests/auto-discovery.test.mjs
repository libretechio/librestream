import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waitForSources } from '../web/autoSelect.js';
const playable = { a: { index: 0 }, stream: { url: '/api/playback/' + '1'.repeat(32), title: '720p' } };
const uncached = { a: { index: 0 }, stream: { url: '/api/playback/' + '2'.repeat(32), title: 'TorBox uncached 2160p' } };

test('torrent-only responses do not close the discovery window before an HTTP source arrives', async () => {
  const began = performance.now();
  const torrent = { a: { index: 0 }, stream: { infoHash: 'test' } };
  const result = await waitForSources(() => ({ rows: performance.now() - began > 160 ? [torrent, playable] : [torrent], pending: 1 }), { settleMs: 1, timeoutMs: 1000 });
  assert.ok(result.some(row => row.stream.url === playable.stream.url));
});

test('uncached and unsupported-only responses keep waiting for a usable source', async () => {
  const began = performance.now();
  const hevc = { a: { index: 0 }, stream: { url: '/api/playback/' + '3'.repeat(32), title: 'HEVC 2160p' } };
  const result = await waitForSources(() => ({ rows: performance.now() - began > 160 ? [uncached, hevc, playable] : [uncached, hevc], pending: 1 }), { settleMs: 1, timeoutMs: 1000, canPlayType: () => '' });
  assert.ok(result.some(row => row === playable));
});
