// Synthetic local playback lab. No live addon configuration or credentials are read.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { createApp } from '../server.mjs';
const media = resolve('.private/auto-media');
const calls = [];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const upstream = http.createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path === '/stats') { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify(calls)); }
  calls.push({ path, method: req.method, range: req.headers.range || '' });
  if (path === '/login') { res.setHeader('content-type', 'text/html'); return res.end('<html>Test login page</html>'); }
  const isProbe = req.headers.range === 'bytes=0-1048575';
  if (path === '/broken.mp4' && !isProbe && req.method !== 'HEAD') { res.writeHead(503); return res.end('Synthetic playback failure'); }
  const hls = /m3u8|\.ts$/.test(path);
  const file = hls ? basename(path) : 'fixture.mp4';
  try {
    const data = await readFile(resolve(media, file));
    const type = path.endsWith('m3u8') ? 'application/vnd.apple.mpegurl' : path.endsWith('.ts') ? 'video/mp2t' : 'video/mp4';
    const match = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    const start = match ? Number(match[1]) : 0;
    const end = match?.[2] ? Math.min(Number(match[2]), data.length - 1) : data.length - 1;
    const body = data.subarray(start, end + 1);
    const headers = { 'Content-Type': type, 'Content-Length': body.length, 'Accept-Ranges': 'bytes' };
    if (match) headers['Content-Range'] = `bytes ${start}-${end}/${data.length}`;
    if (path === '/slow.mp4') await pause(500);
    res.writeHead(match ? 206 : 200, headers);
    if (req.method === 'HEAD') return res.end();
    if (path === '/slow.mp4') {
      for (let i = 0; i < body.length && !res.destroyed; i += 16384) { res.write(body.subarray(i, i + 16384)); await pause(90); }
      return res.end();
    }
    res.end(body);
  } catch { res.writeHead(404); res.end('Fixture file missing'); }
});
await new Promise(resolve => upstream.listen(4176, '127.0.0.1', resolve));
await stat(resolve(media, 'fixture.mp4'));
const titles = [
  { id: 'auto-fixture', type: 'movie', name: 'Automatic selection test fixture', runtime: '24 sec', description: 'Synthetic test video. The best measured source deliberately fails at playback so the next checked source must take over.' },
  { id: 'resume-fixture', type: 'movie', name: 'Resume fallback test fixture', runtime: '24 sec', description: 'Synthetic video used to inject a playback error and check position preservation.' },
  { id: 'hls-fixture', type: 'movie', name: 'HLS selection test fixture', runtime: '24 sec', description: 'Synthetic HLS video delivered through opaque playlist and segment handles.' },
  { id: 'empty-fixture', type: 'movie', name: 'Unavailable sources test fixture', description: 'All sample sources fail or are uncached. Manual selection must remain available.' },
  { id: 'series-fixture', type: 'series', name: 'Episode selection test fixture', runtime: '24 sec', videos: [{ id: 'series-fixture:1:1', season: 1, episode: 1, title: 'First test episode' }, { id: 'series-fixture:1:2', season: 1, episode: 2, title: 'Second test episode' }] }
];
const app = createApp({ devIdentity: true, root: resolve('build'), addons: [{ url: 'https://fixture.invalid/0/manifest.json' }, { url: 'https://fixture.invalid/1/manifest.json' }], fetcher: async (url, options) => {
  if (url.startsWith('http://127.0.0.1:4176/')) return fetch(url, options);
  const provider = url.includes('/0/') ? 0 : 1;
  if (url.endsWith('manifest.json')) return Response.json({ name: provider ? '[test] HTTP CDN' : '[test] Cached CDN', resources: ['catalog', 'meta', 'stream'], types: ['movie', 'series'], catalogs: provider ? [] : [{ id: 'tests', type: 'movie', name: 'Synthetic playback lab' }] });
  if (url.includes('/catalog/')) return Response.json({ metas: titles });
  if (url.includes('/meta/')) return Response.json({ meta: titles.find(item => url.endsWith('/' + item.id + '.json')) || titles[0] });
  if (url.includes('/stream/')) {
    const hls = url.includes('hls-fixture');
    const empty = url.includes('empty-fixture');
    const resume = url.includes('resume-fixture');
    const streams = empty ? [{ title: '1080p test login failure', url: 'http://127.0.0.1:4176/login' }, { title: '2160p TorBox uncached test', url: 'http://127.0.0.1:4176/uncached.mp4' }] : hls ? [{ title: '720p test HLS', url: 'http://127.0.0.1:4176/fixture.m3u8' }] : provider ? [{ title: '720p 2 Mbps test working alternative', url: 'http://127.0.0.1:4176/good.mp4' }] : [{ title: '1080p 2 Mbps TorBox cached test playback failure', url: 'http://127.0.0.1:4176/broken.mp4' }, { title: '2160p 40 Mbps test slow CDN', url: 'http://127.0.0.1:4176/slow.mp4' }, { title: '2160p TorBox uncached test', url: 'http://127.0.0.1:4176/uncached.mp4' }];
    if (resume && !provider) { streams[0] = { title: '1080p 2 Mbps test primary', url: 'http://127.0.0.1:4176/primary.mp4' }; }
    return Response.json({ streams });
  }
  return new Response('Unknown fixture request', { status: 404 });
} });
app.listen(4175, '127.0.0.1', () => console.log('Synthetic playback lab: http://127.0.0.1:4175'));
process.on('SIGINT', () => { app.closeAllConnections(); app.close(); upstream.closeAllConnections(); upstream.close(); });
