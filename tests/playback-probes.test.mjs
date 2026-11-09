import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server.mjs';
const identity = { 'x-authentik-username': 'viewer', 'x-authentik-uid': 'viewer-a' };
async function fixture(t, fetcher) {
  const app = createApp({ addons: [{ url: 'https://addon.example/manifest.json' }], fetcher });
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  t.after(() => { app.closeAllConnections(); app.close(); });
  const base = 'http://127.0.0.1:' + app.address().port;
  const result = await (await fetch(base + '/api/addon/0/stream/movie/test', { headers: identity })).json();
  return { base, path: result.streams[0].url };
}

test('gateway caps probing bytes, sends a bounded Range and cancels a range-ignoring CDN', async t => {
  let cancelled = false;
  let range = '';
  const { base, path } = await fixture(t, async (url, options) => {
    if (url.includes('/stream/')) return Response.json({ streams: [{ url: 'https://cdn.example/private/video.mp4' }] });
    range = options.headers.Range;
    return new Response(new ReadableStream({ pull(c) { c.enqueue(new Uint8Array(64 * 1024)); }, cancel() { cancelled = true; } }), { headers: { 'content-type': 'video/mp4', 'content-length': String(50 * 1024 * 1024) } });
  });
  const response = await fetch(base + path + '?probe=1', { headers: identity });
  assert.equal(range, 'bytes=0-1048575');
  assert.equal(Number(response.headers.get('content-length')), 1024 * 1024);
  assert.equal((await response.arrayBuffer()).byteLength, 1024 * 1024);
  assert.equal(cancelled, true);
});

test('probes require the same user as playback and do not expose provider credentials', async t => {
  let calls = 0;
  const { base, path } = await fixture(t, async url => {
    calls++;
    return Response.json({ streams: [{ url: 'https://cdn.example/private-token/video.mp4' }] });
  });
  assert.equal((await fetch(base + path + '?probe=1')).status, 401);
  assert.equal((await fetch(base + path + '?probe=1', { headers: { ...identity, 'x-authentik-uid': 'viewer-b' } })).status, 403);
  assert.equal(calls, 1);
});

test('HLS child playlists, segments and encryption keys use opaque handles; arbitrary child URLs are refused', async t => {
  const visited = [];
  const { base, path } = await fixture(t, async (url, options) => {
    visited.push(url);
    if (url.includes('/stream/')) return Response.json({ streams: [{ url: 'https://cdn.example/private-token/master.m3u8', behaviorHints: { filename: 'master.m3u8' } }] });
    if (url.endsWith('master.m3u8')) return new Response('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=8000000\nmedia.m3u8\n', { headers: { 'content-type': 'application/vnd.apple.mpegurl' } });
    if (url.endsWith('media.m3u8')) return new Response('#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key.bin"\n#EXT-X-MAP:URI="init.mp4"\n#EXTINF:6,\nsegment.ts\n#EXT-X-ENDLIST\n', { headers: { 'content-type': 'application/vnd.apple.mpegurl' } });
    return new Response(new Uint8Array(1024), { headers: { 'content-type': url.endsWith('.ts') ? 'video/mp2t' : 'application/octet-stream' } });
  });
  const master = await (await fetch(base + path, { headers: identity })).text();
  const mediaPath = master.split('\n').find(line => line.startsWith('/api/'));
  assert.ok(mediaPath);
  assert.ok(!master.includes('private-token'));
  const playlist = await (await fetch(base + mediaPath, { headers: identity })).text();
  assert.ok(!playlist.includes('cdn.example') && !playlist.includes('private-token'));
  const keyPath = playlist.match(/URI="([^"]+)"/)[1];
  assert.match(keyPath, /\/asset\/[a-f0-9]{24}$/);
  assert.equal((await fetch(base + keyPath, { headers: identity })).status, 200);
  const segmentPath = playlist.split('\n').find(line => line.startsWith('/api/'));
  const segment = await fetch(base + segmentPath + '?probe=1', { headers: identity });
  assert.equal(segment.headers.get('content-type'), 'video/mp2t');
  assert.equal((await segment.arrayBuffer()).byteLength, 1024);
  const count = visited.length;
  assert.equal((await fetch(base + path + '/sub?url=https://internal.invalid', { headers: identity })).status, 404);
  assert.equal(visited.length, count);
});

test('media type discovery handles CDNs that reject HEAD using a one-byte GET', async t => {
  const requests = [];
  const { base, path } = await fixture(t, async (url, options) => {
    if (url.includes('/stream/')) return Response.json({ streams: [{ url: 'https://cdn.example/play' }] });
    requests.push({method: options.method, range: options.headers.Range});
    if (options.method === 'HEAD') return new Response(null, {status:405});
    return new Response('x', {status:206, headers:{'content-type':'application/vnd.apple.mpegurl','content-length':'1'}});
  });
  const response = await fetch(base + path, {method:'HEAD', headers:identity});
  assert.match(response.headers.get('content-type'), /mpegurl/);
  assert.equal(requests[0].method, 'HEAD');
  assert.deepEqual(requests[1], {method:'GET', range:'bytes=0-0'});
  assert.equal((await response.arrayBuffer()).byteLength, 0);
});

test('HEAD identifies media without starting a full playback download', async t => {
  let method;
  const { base, path } = await fixture(t, async (url, options) => {
    if (url.includes('/stream/')) return Response.json({ streams: [{ url: 'https://cdn.example/play' }] });
    method = options.method;
    return new Response(null, { headers: { 'content-type': 'application/vnd.apple.mpegurl' } });
  });
  const response = await fetch(base + path, { method: 'HEAD', headers: identity });
  assert.equal(method, 'HEAD');
  assert.match(response.headers.get('content-type'), /mpegurl/);
  assert.equal((await response.arrayBuffer()).byteLength, 0);
});
