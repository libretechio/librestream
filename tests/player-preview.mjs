// Player geometry lab: a real video, real SRT through the gateway, synthetic only.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createApp } from '../server.mjs';

const media = resolve('.private/auto-media/fixture.mp4');
const APP_PORT = 4178;
const UPSTREAM_PORT = 4177;

const SRT = [
  '1', '00:00:01,000 --> 00:00:04,000',
  'This is a deliberately long subtitle line to prove that cues stay inside the picture and never run under the control bar.',
  '',
  '2', '00:00:05,000 --> 00:00:09,000',
  'Short line one.',
  'Second line under it.',
  ''
].join('\n');

const upstream = http.createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path === '/sub.srt') {
    res.writeHead(200, { 'content-type': 'application/x-subrip' });
    return res.end(SRT);
  }
  try {
    const data = await readFile(media);
    const match = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    const start = match ? Number(match[1]) : 0;
    const end = match?.[2] ? Math.min(Number(match[2]), data.length - 1) : data.length - 1;
    const body = data.subarray(start, end + 1);
    const headers = { 'Content-Type': 'video/mp4', 'Content-Length': body.length, 'Accept-Ranges': 'bytes' };
    if (match) headers['Content-Range'] = `bytes ${start}-${end}/${data.length}`;
    res.writeHead(match ? 206 : 200, headers);
    return res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    res.writeHead(404);
    return res.end('missing fixture');
  }
});
await new Promise(done => upstream.listen(UPSTREAM_PORT, '127.0.0.1', done));

const title = {
  id: 'player-fixture',
  type: 'movie',
  name: 'Player geometry fixture',
  year: '2026',
  runtime: '10 min',
  description: 'Local 640x360 fixture used to measure subtitle placement and aspect modes.'
};

const app = createApp({
  devIdentity: true,
  root: resolve('build'),
  addons: [{ name: 'Geometry fixture', url: 'https://fixture.invalid/manifest.json' }],
  fetcher: async (url, options = {}) => {
    if (url.endsWith('manifest.json')) {
      return Response.json({
        name: 'Geometry fixture',
        resources: ['catalog', 'meta', 'stream', 'subtitles'],
        types: ['movie'],
        catalogs: [{ id: 'fixture', type: 'movie', name: 'Fixture' }]
      });
    }
    if (url.includes('/catalog/')) return Response.json({ metas: [title] });
    if (url.includes('/meta/')) return Response.json({ meta: title });
    if (url.includes('/stream/')) {
      return Response.json({
        streams: [{ name: 'Fixture 360p', title: 'Local geometry fixture · 640x360', url: `http://127.0.0.1:${UPSTREAM_PORT}/video.mp4`, behaviorHints: { filename: 'geometry.fixture.mp4' } }]
      });
    }
    if (url.includes('/subtitles/')) {
      return Response.json({
        subtitles: [
          { id: 'en', url: `http://127.0.0.1:${UPSTREAM_PORT}/sub.srt`, lang: 'en' }
        ]
      });
    }
    // Anything that is not an addon call is real media traffic for the gateway.
    return fetch(url, options);
  }
});
await new Promise(done => app.listen(APP_PORT, '127.0.0.1', done));
console.log(`Player fixture ready on http://127.0.0.1:${APP_PORT}`);
