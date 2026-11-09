import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, srtToVtt } from '../server.mjs';

const identity = { 'x-authentik-username': 'viewer', 'x-authentik-uid': 'user-a' };

async function fixture(t, options = {}) {
  const app = createApp(options);
  await new Promise(r => app.listen(0, '127.0.0.1', r));
  t.after(() => app.close());
  return 'http://127.0.0.1:' + app.address().port;
}

test('SRT cues become WebVTT with dots and no sequence numbers', () => {
  const srt = '1\r\n00:00:01,000 --> 00:00:03,500\r\nHello <font color="#fff">there</font>\r\n\r\n2\r\n00:00:04,000 --> 00:00:06,000\r\n{\\an8}Second line\r\n';
  const vtt = srtToVtt(srt);
  assert.ok(vtt.startsWith('WEBVTT'));
  assert.ok(vtt.includes('00:00:01.000 --> 00:00:03.500'));
  assert.ok(vtt.includes('Hello there'));
  assert.ok(vtt.includes('Second line'));
  assert.ok(!vtt.includes('\r'));
  assert.ok(!/\n1\n/.test(vtt));
});

test('invalid subtitle payloads are rejected rather than served as empty cues', () => {
  assert.equal(srtToVtt(''), null);
  assert.equal(srtToVtt('just some text'), null);
});

test('subtitle discovery rewrites upstream URLs to same-origin handles', async t => {
  let visited = '';
  const base = await fixture(t, {
    addons: [{ name: 'OpenSubtitles v3', url: 'https://subs.example/manifest.json' }],
    fetcher: async (url) => {
      if (url.includes('subtitles/')) {
        visited = url;
        return Response.json({ subtitles: [
          { id: '1', url: 'https://dl.example/a.srt', lang: 'en' },
          { id: '2', url: 'javascript:alert(1)', lang: 'en' },
          { id: '3', url: 'https://dl.example/b.vtt', lang: 'es' }
        ] });
      }
      return Response.json({ name: 'OpenSubtitles v3' });
    }
  });
  const res = await fetch(base + '/api/subtitles/list/0/series/tt1%3A1%3A2?filename=Show.S01E02.1080p.mkv', { headers: identity });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.subtitles.length, 2);
  assert.ok(data.subtitles.every(s => s.url.startsWith('/api/subtitles/')));
  assert.ok(!JSON.stringify(data).includes('dl.example'));
  assert.ok(visited.includes('filename=Show.S01E02.1080p.mkv'));
});

test('subtitle files are proxied as WebVTT and scoped to the signed-in user', async t => {
  const base = await fixture(t, {
    addons: [{ name: 'Subs', url: 'https://subs.example/manifest.json' }],
    fetcher: async (url) => {
      if (url.includes('subtitles/series')) {
        return Response.json({ subtitles: [{ id: '1', url: 'https://dl.example/a.srt', lang: 'en' }] });
      }
      if (url === 'https://dl.example/a.srt') {
        return new Response('1\n00:00:01,000 --> 00:00:02,000\nHi\n', { headers: { 'content-type': 'text/plain' } });
      }
      return Response.json({ name: 'Subs' });
    }
  });
  const list = await (await fetch(base + '/api/subtitles/list/0/series/tt1%3A1%3A2', { headers: identity })).json();
  const track = await fetch(base + list.subtitles[0].url, { headers: identity });
  assert.equal(track.status, 200);
  assert.equal(track.headers.get('content-type'), 'text/vtt; charset=utf-8');
  const body = await track.text();
  assert.ok(body.startsWith('WEBVTT'));
  assert.ok(body.includes('Hi'));

  const other = await fetch(base + list.subtitles[0].url, { headers: { ...identity, 'x-authentik-uid': 'user-b' } });
  assert.equal(other.status, 403);
});

test('subtitle proxying refuses HTML and unknown handles', async t => {
  const base = await fixture(t, {
    addons: [{ name: 'Subs', url: 'https://subs.example/manifest.json' }],
    fetcher: async (url) => {
      if (url.includes('subtitles/')) return Response.json({ subtitles: [{ id: '1', url: 'https://dl.example/a.srt', lang: 'en' }] });
      if (url === 'https://dl.example/a.srt') return new Response('<html>login</html>', { headers: { 'content-type': 'text/html' } });
      return Response.json({ name: 'Subs' });
    }
  });
  const list = await (await fetch(base + '/api/subtitles/list/0/movie/tt1', { headers: identity })).json();
  assert.equal((await fetch(base + list.subtitles[0].url, { headers: identity })).status, 502);
  assert.equal((await fetch(base + '/api/subtitles/' + 'a'.repeat(32), { headers: identity })).status, 404);
});
