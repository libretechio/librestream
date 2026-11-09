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

export function createApp({addons=[], devIdentity=false, fetcher=fetch, root=resolve('build')}={}) {
  const cache = new Map();
  const inFlight = new Map();
  const streamHandles = new Map();

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

      // Playback streaming proxy
      const playMatch = url.pathname.match(/^\/api\/playback\/([a-f0-9]{32})(?:\/(.*))?$/);
      if (playMatch) {
        const [, handle, subpath] = playMatch;
        const entry = streamHandles.get(handle);
        if (!entry) return send(404, {error:'Stream handle expired or not found.'});
        if (entry.uid !== uid && !devIdentity) return send(403, {error:'Forbidden'});

        let targetUrl = entry.url;
        if (subpath === 'sub' && url.searchParams.has('url')) {
          try {
            const sub = new URL(url.searchParams.get('url'));
            if (sub.protocol === 'http:' || sub.protocol === 'https:') targetUrl = sub.href;
          } catch {}
        } else if (subpath) {
          try {
            targetUrl = new URL(subpath, entry.url).href;
          } catch {}
        }

        const headers = {
          'Accept': '*/*',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
        };
        if (req.headers.range) headers['Range'] = req.headers.range;
        if (req.headers['if-range']) headers['If-Range'] = req.headers['if-range'];

        const controller = new AbortController();
        req.on('close', () => controller.abort());

        let upstreamRes;
        try {
          upstreamRes = await fetcher(targetUrl, {
            headers,
            redirect: 'follow',
            signal: controller.signal
          });
        } catch (err) {
          if (controller.signal.aborted) return;
          return send(502, {error:'Upstream stream connection failed.'});
        }

        const ctype = (upstreamRes.headers.get('content-type') || '').toLowerCase();
        if (ctype.includes('text/html') || (ctype.includes('application/json') && upstreamRes.status >= 400)) {
          const sample = await upstreamRes.text();
          if (sample.includes('authentik') || sample.includes('challenge') || sample.includes('Sign In') || upstreamRes.status === 403 || upstreamRes.status === 401) {
            return send(502, {error:'Stream source requires external authentication or returned an error page.'});
          }
        }

        const outHeaders = {
          'Accept-Ranges': 'bytes',
          'Content-Disposition': 'inline',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache'
        };

        let finalType = ctype;
        const ext = extname(new URL(targetUrl).pathname.split('?')[0]).toLowerCase();
        const fname = (entry.filename || '').toLowerCase();
        if (!ctype || ctype === 'application/octet-stream') {
          if (ext === '.mp4' || fname.endsWith('.mp4')) finalType = 'video/mp4';
          else if (ext === '.mkv' || fname.endsWith('.mkv')) finalType = 'video/x-matroska';
          else if (ext === '.webm' || fname.endsWith('.webm')) finalType = 'video/webm';
          else if (ext === '.m3u8' || fname.endsWith('.m3u8')) finalType = 'application/vnd.apple.mpegurl';
          else if (ext === '.ts' || fname.endsWith('.ts')) finalType = 'video/mp2t';
          else finalType = 'video/mp4';
        }
        outHeaders['Content-Type'] = finalType;

        if (finalType.includes('mpegurl') || targetUrl.includes('.m3u8')) {
          const m3u8Text = await upstreamRes.text();
          const rewritten = m3u8Text.split('\n').map(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return line;
            try {
              const abs = new URL(trimmed, targetUrl).href;
              return '/api/playback/' + handle + '/sub?url=' + encodeURIComponent(abs);
            } catch {
              return line;
            }
          }).join('\n');
          res.writeHead(200, {
            'Content-Type': 'application/vnd.apple.mpegurl',
            'Content-Disposition': 'inline',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache'
          });
          return res.end(rewritten);
        }

        if (upstreamRes.headers.has('content-length')) outHeaders['Content-Length'] = upstreamRes.headers.get('content-length');
        if (upstreamRes.headers.has('content-range')) outHeaders['Content-Range'] = upstreamRes.headers.get('content-range');
        if (upstreamRes.headers.has('etag')) outHeaders['ETag'] = upstreamRes.headers.get('etag');

        res.writeHead(upstreamRes.status, outHeaders);
        if (req.method === 'HEAD') return res.end();

        if (upstreamRes.body) {
          Readable.fromWeb(upstreamRes.body).pipe(res);
        } else {
          res.end();
        }
        return;
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
                playbackUrl: '/api/playback/' + handle
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
