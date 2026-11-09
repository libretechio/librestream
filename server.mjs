import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';

const MIME = {
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts': 'video/mp2t',
  '.mp4': 'video/mp4',
  '.mkv': 'video/x-matroska',
  '.webm': 'video/webm',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp'
};

const SUBTITLE_LIMIT = 4 * 1024 * 1024;
const CUE_TAG = /<\/?font[^>]*>|\{\\[^}]*\}/gi;

// Browsers only render WebVTT through <track>, and most subtitle addons serve SRT.
export function srtToVtt(input) {
  const text = String(input || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  if (!text) return null;
  const out = ['WEBVTT', ''];
  let cues = 0;
  for (const block of text.split(/\n{2,}/)) {
    const lines = block.split('\n');
    const first = lines[0]?.trim() || '';
    const offset = /^\d+$/.test(first) ? 1 : 0;
    const timing = lines[offset] || '';
    const match = timing.match(/^\s*(\d{1,3}:\d{2}:\d{2}[,.]\d{1,3})\s*-->\s*(\d{1,3}:\d{2}:\d{2}[,.]\d{1,3})(.*)$/);
    if (!match) continue;
    const start = match[1].replace(',', '.');
    const end = match[2].replace(',', '.');
    const settings = (match[3] || '').trim();
    const body = lines.slice(offset + 1).map(line => line.replace(CUE_TAG, '').trimEnd());
    if (!body.some(Boolean)) continue;
    out.push(`${start} --> ${end}${settings ? ' ' + settings : ''}`, ...body, '');
    cues += 1;
  }
  return cues ? out.join('\n') : null;
}

function decodeText(bytes) {
  const utf8 = new TextDecoder('utf-8').decode(bytes);
  if (!utf8.includes('\uFFFD')) return utf8;
  try {
    return new TextDecoder('windows-1252').decode(bytes);
  } catch {
    return utf8;
  }
}

export function createApp({addons=[], devIdentity=false, fetcher=fetch, root=resolve('build')}={}) {
  const cache = new Map();
  const inFlight = new Map();
  const streamHandles = new Map();
  const subtitleHandles = new Map();

  async function upstream(index, path) {
    const addon = addons[index];
    if (!addon) throw Error('Addon unavailable');
    const base = addon.url.replace(/\/manifest\.json\/?$/, '');
    const key = index + ':' + path;
    if (cache.get(key)?.until > Date.now()) return cache.get(key).value;
    if (inFlight.has(key)) return inFlight.get(key);
    const pending = (async () => {
      const response = await fetcher(base+'/'+path, {signal:AbortSignal.timeout(path==='manifest.json'?6000:18000),redirect:'follow',headers:{Accept:'application/json'}});
      if (!response.ok) throw Error('Addon unavailable');
      const body = await response.text();
      if (body.length > 8_000_000) throw Error('Addon response too large');
      const value = JSON.parse(body);
      if (cache.size > 400) cache.delete(cache.keys().next().value);
      // Stream URLs expire and may encode playback sessions. Never cache them.
      if (!path.startsWith('stream/')) cache.set(key,{until:Date.now()+120000,value});
      return value;
    })();
    inFlight.set(key,pending);
    try {return await pending;} finally {inFlight.delete(key);}
  }

  const server = http.createServer(async (req, res) => {
    const send = (status, body, type='application/json; charset=utf-8') => {
      res.writeHead(status, {'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'});
      res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
    };

    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/health') return send(200, {ok:true});

      // Client-side throughput check: a fixed, cache-free payload from this origin.
      // Read-only, no upstream call, no user data.
      if (url.pathname === '/api/ping') {
        const bytes = Math.min(Math.max(Number(url.searchParams.get('bytes')) || 262144, 1024), 1048576);
        res.writeHead(200, {
          'Content-Type': 'application/octet-stream',
          'Content-Length': String(bytes),
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff'
        });
        return res.end(Buffer.alloc(bytes));
      }

      // Production must be reachable only through the trusted Authentik proxy.
      const username = devIdentity ? 'local-preview' : req.headers['x-authentik-username'];
      const uid = devIdentity ? 'local-preview' : req.headers['x-authentik-uid'];
      if (!username || !uid) return send(401, {error:'Sign in through Authentik to continue.'});

      if (req.method !== 'GET' && req.method !== 'HEAD') return send(405, {error:'Method not allowed'});

      if (url.pathname === '/api/me') {
        return send(200, {
          id: createHash('sha256').update(String(uid)).digest('hex'),
          name: devIdentity ? 'Local preview' : String(req.headers['x-authentik-name'] || username),
          preview: devIdentity
        });
      }

      if (url.pathname === '/api/addons') {
        const pending = addons.map(async (a, index) => {
          try {
            const manifest = await upstream(index, 'manifest.json');
            return {
              index,
              name: manifest.name || a.name,
              resources: manifest.resources || [],
              types: manifest.types || [],
              catalogs: manifest.catalogs || [],
              ok: true
            };
          } catch {
            return { index, name: a.name || 'Addon', resources: [], catalogs: [], ok: false };
          }
        });

        if (url.searchParams.has('live')) {
          res.writeHead(200, {'Content-Type':'application/x-ndjson','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Accel-Buffering':'no'});
          res.flushHeaders();
          await Promise.all(pending.map(async p => {
            const addon = await p;
            if (!res.destroyed) res.write(JSON.stringify(addon) + '\n');
          }));
          return res.end();
        }
        return send(200, await Promise.all(pending));
      }

      // Playback and measurement share the same authenticated delivery path.
      const playMatch = url.pathname.match(/^\/api\/playback\/([a-f0-9]{32})(?:\/(.*))?$/);
      if (playMatch) {
        const [, handle, subpath] = playMatch;
        const entry = streamHandles.get(handle);
        if (!entry) return send(404, {error:'Stream handle expired or not found.'});
        if (entry.uid !== uid && !devIdentity) return send(403, {error:'Forbidden'});
        entry.assets ||= new Map();
        const targetUrl = subpath ? entry.assets.get(subpath.replace(/^asset\//, '')) : entry.url;
        if (subpath && (!/^asset\/[a-f0-9]{24}$/.test(subpath) || !targetUrl)) return send(404, {error:'Media resource not found.'});
        const probing = url.searchParams.has('probe');
        const limit = 1024 * 1024;
        const headers = {Accept:'*/*', 'Accept-Encoding':'identity', 'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'};
        if (probing) headers.Range = `bytes=0-${limit - 1}`;
        else if (req.headers.range) headers.Range = req.headers.range;
        if (!probing && req.headers['if-range']) headers['If-Range'] = req.headers['if-range'];
        const controller = new AbortController();
        const disconnect = () => controller.abort();
        res.on('close', disconnect);
        const timer = setTimeout(disconnect, probing ? 9000 : 20000);
        try {
          let upstreamRes = await fetcher(targetUrl, {headers, method:req.method === 'HEAD' ? 'HEAD' : 'GET', redirect:'follow', signal:controller.signal});
          if (req.method === 'HEAD' && [405, 501].includes(upstreamRes.status)) {
            await upstreamRes.body?.cancel();
            upstreamRes = await fetcher(targetUrl, {headers:{...headers, Range:'bytes=0-0'}, method:'GET', redirect:'follow', signal:controller.signal});
          }
          const ctype = (upstreamRes.headers.get('content-type') || '').toLowerCase();
          if (!upstreamRes.ok || /text\/html|application\/json/.test(ctype)) {
            await upstreamRes.body?.cancel();
            return send(502, {error:'This source did not return playable media. Choose another stream.'});
          }
          const ext = extname(new URL(targetUrl).pathname).toLowerCase();
          const fname = !subpath ? String(entry.filename || '').toLowerCase() : '';
          let finalType = ctype;
          if (!ctype || /octet-stream/.test(ctype)) {
            const types = {'.mp4':'video/mp4','.mkv':'video/x-matroska','.webm':'video/webm','.m3u8':'application/vnd.apple.mpegurl','.ts':'video/mp2t','.aac':'audio/aac','.vtt':'text/vtt','.key':'application/octet-stream'};
            finalType = types[ext] || types[extname(fname)] || (!subpath ? 'video/mp4' : 'application/octet-stream');
          }
          const isPlaylist = /mpegurl/.test(finalType) || ext === '.m3u8' || fname.endsWith('.m3u8');
          const outHeaders = {'Content-Type':isPlaylist ? 'application/vnd.apple.mpegurl' : finalType, 'Content-Disposition':'inline','Accept-Ranges':'bytes','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
          if (req.method === 'HEAD') {
            if (upstreamRes.headers.has('content-length')) outHeaders['Content-Length'] = upstreamRes.headers.get('content-length');
            await upstreamRes.body?.cancel();
            res.writeHead(upstreamRes.status, outHeaders);
            return res.end();
          }
          if (isPlaylist) {
            const reader = upstreamRes.body?.getReader();
            if (!reader) return send(502, {error:'Empty media playlist.'});
            const chunks = [];
            let size = 0;
            try {
              while (true) {
                const {value, done} = await reader.read();
                if (done) break;
                size += value.byteLength;
                if (size > limit) throw Error('Playlist too large');
                chunks.push(value);
              }
            } finally { await reader.cancel().catch(() => {}); }
            const text = Buffer.concat(chunks).toString('utf8');
            if (!text.trimStart().startsWith('#EXTM3U')) return send(502, {error:'Invalid media playlist.'});
            const resourceURL = raw => {
              const absolute = new URL(raw, upstreamRes.url || targetUrl);
              if (!['http:', 'https:'].includes(absolute.protocol)) throw Error('Invalid media resource');
              const token = createHash('sha256').update(handle + ':' + absolute.href).digest('hex').slice(0, 24);
              if (entry.assets.size >= 10000 && !entry.assets.has(token)) throw Error('Playlist too large');
              entry.assets.set(token, absolute.href);
              return '/api/playback/' + handle + '/asset/' + token;
            };
            const rewritten = text.split(/\r?\n/).map(line => {
              const trimmed = line.trim();
              if (!trimmed) return line;
              if (trimmed.startsWith('#')) return line.replace(/URI="([^"]+)"/g, (_, raw) => `URI="${resourceURL(raw)}"`);
              return resourceURL(trimmed);
            }).join('\n');
            res.writeHead(200, outHeaders);
            return res.end(rewritten);
          }
          if (upstreamRes.headers.has('content-length')) {
            const length = Number(upstreamRes.headers.get('content-length'));
            if (Number.isFinite(length)) outHeaders['Content-Length'] = String(probing ? Math.min(length, limit) : length);
          }
          if (upstreamRes.headers.has('content-range')) outHeaders['Content-Range'] = upstreamRes.headers.get('content-range');
          if (upstreamRes.headers.has('etag')) outHeaders.ETag = upstreamRes.headers.get('etag');
          res.writeHead(upstreamRes.status, outHeaders);
          if (!upstreamRes.body) return res.end();
          if (probing) {
            const reader = upstreamRes.body.getReader();
            let sent = 0;
            try {
              while (sent < limit && !res.destroyed) {
                const {value, done} = await reader.read();
                if (done) break;
                const chunk = value.subarray(0, limit - sent);
                res.write(chunk);
                sent += chunk.byteLength;
              }
            } finally { await reader.cancel().catch(() => {}); controller.abort(); }
            return res.end();
          }
          const body = Readable.fromWeb(upstreamRes.body);
          body.on('error', () => res.destroy());
          body.pipe(res);
          return;
        } catch {
          if (res.destroyed) return;
          if (res.headersSent) return res.destroy();
          return send(502, {error:'This source did not respond. Choose another stream.'});
        } finally { clearTimeout(timer); }
      }

      // Subtitle discovery: query a subtitle addon with the file hints the protocol expects.
      const subtitleList = url.pathname.match(/^\/api\/subtitles\/list\/(\d+)\/([a-z]+)\/([^/]+)$/);
      if (subtitleList) {
        const [, index, type, id] = subtitleList;
        const addon = addons[Number(index)];
        if (!addon) return send(404, {error:'Addon unavailable'});
        const extras = [];
        const videoHash = String(url.searchParams.get('videoHash') || '').replace(/[^a-f0-9]/gi, '').slice(0, 32);
        const videoSize = String(url.searchParams.get('videoSize') || '').replace(/\D/g, '').slice(0, 20);
        const filename = String(url.searchParams.get('filename') || '').slice(0, 300);
        if (videoHash) extras.push('videoHash=' + videoHash);
        if (videoSize) extras.push('videoSize=' + videoSize);
        if (filename) extras.push('filename=' + encodeURIComponent(filename));
        const path = 'subtitles/' + encodeURIComponent(type) + '/' + encodeURIComponent(id) + (extras.length ? '/' + extras.join('&') : '') + '.json';
        try {
          const data = await upstream(Number(index), path);
          const list = (Array.isArray(data?.subtitles) ? data.subtitles : []).flatMap(item => {
            if (!item?.url) return [];
            let href;
            try { href = new URL(item.url); } catch { return []; }
            if (!['http:', 'https:'].includes(href.protocol)) return [];
            const handle = createHash('sha256').update(href.href + ':' + uid + ':' + Date.now() + Math.random()).digest('hex').slice(0, 32);
            subtitleHandles.set(handle, {url: href.href, uid, created: Date.now()});
            if (subtitleHandles.size > 4000) subtitleHandles.delete(subtitleHandles.keys().next().value);
            const lang = String(item.lang || 'und').slice(0, 16);
            return [{id: handle, url: '/api/subtitles/' + handle, lang, addon: String(addon.name || 'Addon').slice(0, 60), label: String(item.id || '').slice(0, 80)}];
          });
          return send(200, {subtitles: list});
        } catch {
          return send(502, {error:'Subtitle addon did not respond.'});
        }
      }

      // Subtitle delivery: same-origin, converted to WebVTT so <track> can render it.
      const subtitleFile = url.pathname.match(/^\/api\/subtitles\/([a-f0-9]{32})$/);
      if (subtitleFile) {
        const entry = subtitleHandles.get(subtitleFile[1]);
        if (!entry) return send(404, {error:'Subtitle no longer available.'});
        if (entry.uid !== uid && !devIdentity) return send(403, {error:'Forbidden'});
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        res.on('close', () => controller.abort());
        try {
          const upstreamRes = await fetcher(entry.url, {headers:{Accept:'text/vtt,text/plain,*/*','Accept-Encoding':'identity'}, redirect:'follow', signal:controller.signal});
          const ctype = (upstreamRes.headers.get('content-type') || '').toLowerCase();
          if (!upstreamRes.ok || /text\/html|application\/json/.test(ctype)) {
            await upstreamRes.body?.cancel();
            return send(502, {error:'Subtitle file unavailable.'});
          }
          const reader = upstreamRes.body?.getReader();
          if (!reader) return send(502, {error:'Empty subtitle file.'});
          const chunks = [];
          let size = 0;
          try {
            while (true) {
              const {value, done} = await reader.read();
              if (done) break;
              size += value.byteLength;
              if (size > SUBTITLE_LIMIT) throw Error('Subtitle too large');
              chunks.push(value);
            }
          } finally { await reader.cancel().catch(() => {}); }
          const text = decodeText(Buffer.concat(chunks));
          const trimmed = text.trimStart();
          if (/^WEBVTT/.test(trimmed)) return send(200, trimmed, 'text/vtt; charset=utf-8');
          if (!trimmed.includes('-->')) return send(502, {error:'Unsupported subtitle format.'});
          const vtt = srtToVtt(text);
          if (!vtt) return send(502, {error:'Unsupported subtitle format.'});
          return send(200, vtt, 'text/vtt; charset=utf-8');
        } catch {
          return send(502, {error:'Subtitle file unavailable.'});
        } finally { clearTimeout(timer); }
      }

      // Addon routing
      const match = url.pathname.match(/^\/api\/addon\/(\d+)\/(manifest|catalog|meta|stream|subtitles)(?:\/(.*))?$/);
      if (match) {
        const [, index, resource, tail] = match;
        const segments = (tail || '').split('/');
        if ((resource !== 'manifest' && segments.length !== 2) || segments.some(s => !s || s === '.' || s === '..')) {
          if (resource !== 'manifest') return send(400, {error:'Invalid addon request'});
        }
        const extras = url.searchParams.get('search');
        const skip = url.searchParams.get('skip');
        const extra = extras ? '/search='+encodeURIComponent(extras.slice(0, 200)) : skip ? '/skip='+encodeURIComponent(skip) : '';
        const path = resource === 'manifest' ? 'manifest.json' : resource + '/' + segments.map(s => encodeURIComponent(decodeURIComponent(s))).join('/') + extra + '.json';

        try {
          const data = await upstream(Number(index), path);
          if (resource === 'stream' && data && Array.isArray(data.streams)) {
            const sanitized = data.streams.map(stream => {
              if (!stream.url) return stream;
              const handle = createHash('sha256').update(stream.url + ':' + uid + ':' + Date.now() + Math.random()).digest('hex').slice(0, 32);
              streamHandles.set(handle, {
                url: stream.url,
                uid,
                filename: stream.behaviorHints?.filename,
                created: Date.now()
              });
              if (streamHandles.size > 2000) streamHandles.delete(streamHandles.keys().next().value);
              return {
                ...stream,
                url: '/api/playback/' + handle,
                playbackUrl: '/api/playback/' + handle,
                sourceId: createHash('sha256').update(uid + ':' + stream.url).digest('hex').slice(0, 24)
              };
            });
            return send(200, { ...data, streams: sanitized });
          }
          return send(200, data);
        } catch {
          return send(502, {error:'This addon did not respond. Try another source.'});
        }
      }

      if (url.pathname.startsWith('/api/')) return send(404, {error:'Not found'});

      const file = resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
      if (!file.startsWith(root + '/')) return send(403, {error:'Forbidden'});
      try {
        return send(200, await readFile(file), MIME[extname(file)] || 'application/octet-stream');
      } catch {
        try {
          return send(200, await readFile(resolve(root, 'index.html')), MIME['.html']);
        } catch {
          return send(404, {error:'Not found'});
        }
      }
    } catch {
      send(500, {error:'Unable to complete this request.'});
    }
  });

  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = process.env.LIBRESTREAM_ADDONS_FILE;
  const addons = config ? JSON.parse(await readFile(config, 'utf8')) : [{name:'Cinemeta', url:'https://v3-cinemeta.strem.io/manifest.json'}];
  for (const a of addons) if (new URL(a.url).protocol !== 'https:') throw Error('Addon URLs must use HTTPS');
  // Static files sit next to this file, not in the process working directory.
  const root = resolve(fileURLToPath(new URL('.', import.meta.url)), 'build');
  createApp({addons, root, devIdentity:process.env.LIBRESTREAM_DEV_IDENTITY === '1'}).listen(Number(process.env.PORT || 4173), process.env.HOST || '127.0.0.1', () => console.log('LibreStream ready'));
}
