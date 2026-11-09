import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shortlistCandidates, rankMeasuredCandidates, describeCandidate, selectBestStream, probeCandidate } from '../web/autoSelect.js';
const source = (id, title, sourceId) => ({ a: { index: id, name: 'Test addon' }, stream: { url: '/api/playback/' + String(id).padStart(32, '0'), title, sourceId } });

test('the same delivery URL reported by multiple addons is sampled once', () => {
  const result = shortlistCandidates([source(1, '1080p', 'same'), source(2, '1080p', 'same'), source(3, '720p', 'other')]);
  assert.equal(result.length, 2);
  assert.equal(new Set(result.map(r => r.stream.sourceId)).size, 2);
});

test('fixed-quality HLS cannot claim adaptive bandwidth savings', () => {
  const fixed = { ...describeCandidate(source(1, '2160p 40 Mbps')), measurement: { ok: true, mbps: 5, ttfbMs: 1, mimeType: 'application/vnd.apple.mpegurl', adaptive: false } };
  const low = { ...describeCandidate(source(2, '720p 3 Mbps')), measurement: { ok: true, mbps: 20, ttfbMs: 100, mimeType: 'video/mp4' } };
  assert.equal(rankMeasuredCandidates([fixed, low])[0].key, low.key);
});

test('adaptive HLS samples the lowest bandwidth rendition, rather than timing out on the highest first', async () => {
  const prefix = '/api/playback/' + '1'.repeat(32) + '/asset/';
  const high = prefix + 'a'.repeat(24);
  const low = prefix + 'b'.repeat(24);
  const segment = prefix + 'c'.repeat(24);
  const calls = [];
  const result = await probeCandidate(describeCandidate(source(1, '2160p')), { fetcher: async url => {
    calls.push(url.split('?')[0]);
    if (url.startsWith(low)) return new Response('#EXTM3U\n#EXTINF:4,\n' + segment, { headers: { 'content-type': 'application/vnd.apple.mpegurl' } });
    if (url.startsWith(segment)) return new Response(new Uint8Array(65536), { headers: { 'content-type': 'video/mp2t' } });
    return new Response('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=40000000\n' + high + '\n#EXT-X-STREAM-INF:BANDWIDTH=2000000\n' + low, { headers: { 'content-type': 'application/vnd.apple.mpegurl' } });
  } });
  assert.equal(result.ok, true);
  assert.equal(result.adaptive, true);
  assert.equal(calls.includes(high), false);
  assert.equal(calls.includes(low), true);
});

test('overall deadline retains an already checked source and stops probing more', async () => {
  let calls = 0;
  const ranked = await selectBestStream([source(1, '1080p'), source(2, '720p'), source(3, '480p')], { totalMs: 30, fetcher: async (_, options) => {
    calls++;
    if (calls === 1) return new Response(new Uint8Array(65536), { headers: { 'content-type': 'video/mp4' } });
    return new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
  } });
  assert.equal(ranked.length, 1);
  assert.equal(calls, 2);
});
