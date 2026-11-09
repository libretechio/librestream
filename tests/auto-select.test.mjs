import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeCandidate, shortlistCandidates, rankMeasuredCandidates, probeCandidate, selectBestStream, runtimeSeconds, waitForSources } from '../web/autoSelect.js';

const row = (id, title, provider = 0, extra = {}) => ({ a: { index: provider, name: provider ? 'PenguPlay' : 'AIOStreams' }, stream: { url: '/api/playback/' + String(id).padStart(32, '0'), title, ...extra } });
const measured = (source, mbps, ttfbMs = 100) => ({ ...describeCandidate(source), measurement: { ok: true, mbps, ttfbMs, mimeType: 'video/mp4' } });

test('automatic ranking chooses the highest quality with bandwidth headroom, rather than lowest latency alone', () => {
  const large = measured(row(1, '2160p 60 Mbps TorBox cached'), 30, 10);
  const hd = measured(row(2, '1080p 8 Mbps', 1), 24, 120);
  assert.equal(rankMeasuredCandidates([large, hd])[0].key, hd.key);
  const uhd = measured(row(3, '2160p 25 Mbps'), 70, 180);
  assert.equal(rankMeasuredCandidates([large, hd, uhd])[0].key, uhd.key);
});

test('equal-quality sources favor responsive delivery; failed probes never rank', () => {
  const slow = measured(row(1, '1080p 5 Mbps'), 30, 1900);
  const fast = measured(row(2, '1080p 5 Mbps', 1), 30, 70);
  assert.equal(rankMeasuredCandidates([slow, fast, { ...fast, measurement: { ok: false } }])[0].key, fast.key);
  assert.equal(rankMeasuredCandidates([{ ...fast, measurement: { ok: false } }]).length, 0);
});

test('shortlist excludes uncached TorBox, unsupported codecs and unproxied URLs while sampling multiple addons', () => {
  const sources = [row(1, '2160p TorBox downloading'), row(2, '2160p HEVC'), row(3, '1080p TorBox cached'), row(4, '720p', 1), row(5, '1080p', 2, { url: 'https://untrusted.example/video.mp4' })];
  const chosen = shortlistCandidates(sources, { canPlayType: () => '', limit: 3 });
  assert.deepEqual(chosen.map(r => r.a.index).sort(), [0, 1]);
  assert.ok(chosen.every(r => r.info.cache !== 'uncached'));
});

test('bitrate estimates use file size and known runtime; unknown duration remains explicitly estimated', () => {
  assert.equal(runtimeSeconds('1h 30m'), 5400);
  assert.equal(runtimeSeconds('109 min'), 6540);
  assert.equal(runtimeSeconds(null), null);
  const candidate = describeCandidate(row(1, '1080p', 0, { behaviorHints: { videoSize: 1_000_000_000 } }), { runtime: '100 min' });
  assert.equal(candidate.bitrate, 8 / 6);
  assert.equal(candidate.bitrateEstimated, false);
  assert.equal(describeCandidate(row(2, '2160p')).bitrateEstimated, true);
});

test('sample reads are bounded and stop the upstream reader even if it ignores Range', async () => {
  let cancelled = false;
  let clock = 0;
  const measurement = await probeCandidate(describeCandidate(row(1, '1080p')), {
    sampleBytes: 65536,
    now: () => clock += 100,
    fetcher: async () => new Response(new ReadableStream({ start(c) { c.enqueue(new Uint8Array(2 * 1024 * 1024)); }, cancel() { cancelled = true; } }), { headers: { 'content-type': 'video/mp4' } })
  });
  assert.equal(measurement.ok, true);
  assert.equal(measurement.bytes, 65536);
  assert.equal(measurement.ttfbMs, 100);
  assert.equal(cancelled, true);
});

test('HLS measurement follows opaque playlist handles and samples an actual segment', async () => {
  const prefix = '/api/playback/' + '0'.repeat(31) + '1';
  const segment = prefix + '/asset/' + 'b'.repeat(24);
  const calls = [];
  const measurement = await probeCandidate(describeCandidate(row(1, '720p')), {
    fetcher: async url => {
      calls.push(url);
      return url.startsWith(segment)
        ? new Response(new Uint8Array(65536), { headers: { 'content-type': 'video/mp2t' } })
        : new Response('#EXTM3U\n#EXTINF:6,\n' + segment + '\n', { headers: { 'content-type': 'application/vnd.apple.mpegurl' } });
    }
  });
  assert.equal(measurement.mimeType, 'application/vnd.apple.mpegurl');
  assert.equal(measurement.bytes, 65536);
  assert.equal(calls.length, 2);
  const unsafe = await probeCandidate(describeCandidate(row(1, '720p')), { fetcher: async () => new Response('#EXTM3U\nhttps://other.example/private\n', { headers: { 'content-type': 'application/vnd.apple.mpegurl' } }) });
  assert.equal(unsafe.ok, false);
});

test('selection skips HTML login pages and timed-out candidates, retaining a working fallback', async () => {
  let calls = 0;
  const result = await selectBestStream([row(1, '1080p TorBox cached'), row(2, '720p', 1), row(3, '480p', 2)], {
    timeoutMs: 30,
    fetcher: async (url, options) => {
      calls++;
      if (url.includes('0001?')) return new Response('<html>login</html>', { headers: { 'content-type': 'text/html' } });
      if (url.includes('0002?')) return new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
      return new Response(new Uint8Array(65536), { headers: { 'content-type': 'video/mp4' } });
    }
  });
  assert.equal(calls, 3);
  assert.equal(result.length, 1);
  assert.equal(result[0].a.index, 2);
});

test('cancellation stops automatic probing rather than starting another source', async () => {
  const controller = new AbortController();
  let calls = 0;
  const promise = selectBestStream([row(1, '1080p'), row(2, '720p', 1)], {
    signal: controller.signal,
    fetcher: async (_, options) => { calls++; controller.abort(); throw new DOMException('Aborted', 'AbortError'); }
  });
  await assert.rejects(promise, { name: 'AbortError' });
  assert.equal(calls, 1);
});

test('save-data selection limits probes and favors the lower-resolution source', async () => {
  let calls = 0;
  const result = await selectBestStream([row(1, '2160p 25 Mbps'), row(2, '720p 3 Mbps'), row(3, '1080p 8 Mbps', 1)], {
    saveData: true,
    fetcher: async () => { calls++; return new Response(new Uint8Array(512 * 1024), { headers: { 'content-type': 'video/mp4' } }); }
  });
  assert.ok(calls <= 2);
  assert.ok(result.every(r => r.measurement.bytes <= 128 * 1024));
  assert.equal(result[0].resolution, 720);
});

test('discovery starts after a brief result window without waiting for a stuck addon', async () => {
  const sources = [row(1, '1080p')];
  const result = await waitForSources(() => ({ rows: sources, pending: 10 }), { settleMs: 1 });
  assert.equal(result.length, 1);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(waitForSources(() => ({ rows: [], pending: 1 }), { signal: controller.signal }), { name: 'AbortError' });
});

