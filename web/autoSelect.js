import { streamInfo } from './streams.js';

export const AUTO_LIMITS = Object.freeze({ samples: 4, sampleBytes: 1024 * 1024, probeMs: 3500, totalMs: 12000 });
const FALLBACK_BITRATES = { 4320: 60, 2160: 25, 1440: 14, 1080: 8, 720: 4, 576: 2.5, 480: 1.5, 360: 1 };
const abortError = () => new DOMException('Selection cancelled', 'AbortError');

export function runtimeSeconds(runtime) {
  if (typeof runtime === 'number') return runtime > 0 ? runtime * 60 : null;
  const text = String(runtime || '').trim();
  const hours = text.match(/(\d+(?:\.\d+)?)\s*(?:h|hours?)/i);
  const minutes = text.match(/(\d+(?:\.\d+)?)\s*(?:m|min|minutes?)/i);
  const seconds = text.match(/(\d+(?:\.\d+)?)\s*(?:s|sec|seconds?)/i);
  const result = Number(hours?.[1] || 0) * 3600 + Number(minutes?.[1] || 0) * 60 + Number(seconds?.[1] || 0);
  return result || (/^\d+(?:\.\d+)?$/.test(text) ? Number(text) * 60 : null);
}

export function describeCandidate(row, meta = {}, canPlayType = () => 'maybe') {
  const { stream, a } = row;
  const info = row.info || streamInfo(a, stream);
  const text = [stream.name, stream.title, stream.description, stream.behaviorHints?.filename].filter(Boolean).join(' ');
  const resolution = parseInt(info.resolution) || 0;
  const duration = runtimeSeconds(meta.runtime);
  const sizeMatch = text.match(/\b(\d+(?:\.\d+)?)\s*(GB|GiB|MB|MiB)\b/i);
  const size = Number(stream.behaviorHints?.videoSize) || (sizeMatch ? Number(sizeMatch[1]) * (/g/i.test(sizeMatch[2]) ? 1024 ** 3 : 1024 ** 2) : 0);
  const explicitBitrate = text.match(/\b(\d+(?:\.\d+)?)\s*(?:mbps|mbit\/s)\b/i);
  const bitrate = explicitBitrate ? Number(explicitBitrate[1]) : size && duration ? size * 8 / duration / 1e6 : FALLBACK_BITRATES[resolution] || 8;
  const videoCodec = /\b(av1|av01)\b/i.test(text) ? 'av01.0.08M.08' : /\b(hevc|x265|h[ .]?265)\b/i.test(text) ? 'hvc1.1.6.L120.B0' : /\b(avc|x264|h[ .]?264)\b/i.test(text) ? 'avc1.640028' : null;
  const audioCodec = /\b(truehd|dts(?:-hd)?)\b/i.test(text) ? 'unsupported' : /\b(eac3|e-ac-3|ddp)\b/i.test(text) ? 'ec-3' : /\bac3|ac-3\b/i.test(text) ? 'ac-3' : null;
  const compatible = (!videoCodec || Boolean(canPlayType(`video/mp4; codecs="${videoCodec}"`))) && audioCodec !== 'unsupported' && (!audioCodec || Boolean(canPlayType(`audio/mp4; codecs="${audioCodec}"`)));
  const key = stream.url;
  return { ...row, info, key, resolution, bitrate, compatible, bitrateEstimated: !explicitBitrate && !(size && duration) };
}

export function shortlistCandidates(rows, options = {}) {
  const { meta, canPlayType, maxResolution = 2160, saveData = false, limit = AUTO_LIMITS.samples } = options;
  const seen = new Set();
  const candidates = rows.map(row => describeCandidate(row, meta, canPlayType)).filter(row => {
    const identity = row.stream.sourceId || row.key;
    if (!/^\/api\/playback\/[a-f0-9]{32}$/.test(row.key || '') || seen.has(identity) || row.info.cache === 'uncached' || !row.compatible) return false;
    seen.add(identity);
    return true;
  });
  const target = saveData ? Math.min(maxResolution, 720) : maxResolution;
  candidates.sort((a, b) => {
    const utility = r => (r.info.cache === 'cached' ? 20 : 0) + Math.min(r.resolution || 720, target) / 100 - Math.max(0, r.resolution - target) / 100 - r.bitrate / 20;
    return utility(b) - utility(a) || a.a.index - b.a.index;
  });
  // Include provider diversity and a lower-bitrate alternative before sampling additional large encodes.
  const selected = [];
  const add = row => { if (row && !selected.some(r => r.key === row.key)) selected.push(row); };
  const providers = [...new Set(candidates.map(r => r.a.index))];
  for (const provider of providers.slice(0, Math.max(1, limit - 1))) add(candidates.find(r => r.a.index === provider));
  add([...candidates].sort((a, b) => a.bitrate - b.bitrate || b.resolution - a.resolution)[0]);
  for (const row of candidates) { if (selected.length >= limit) break; add(row); }
  return selected.slice(0, limit);
}

export function rankMeasuredCandidates(rows, { maxResolution = 2160, saveData = false } = {}) {
  const target = saveData ? Math.min(maxResolution, 720) : maxResolution;
  return rows.filter(r => r.measurement?.ok).map(row => {
    const m = row.measurement;
    const sustainable = m.mbps * 0.65;
    const adaptive = m.adaptive === true;
    const fits = adaptive || row.bitrate <= sustainable;
    const quality = Math.min(row.resolution || 720, target);
    const score = (fits ? 1000 : -500 * row.bitrate / Math.max(sustainable, 0.1)) + quality / 5 - Math.max(0, row.resolution - target) / 5 + (row.info.cache === 'cached' ? 15 : 0) - Math.min(m.ttfbMs, 10000) / 100;
    return { ...row, score, fits, stream: { ...row.stream, mimeType: m.mimeType } };
  }).sort((a, b) => b.score - a.score || a.bitrate - b.bitrate);
}

async function readSample(response, limit, signal) {
  if (!response.ok || !response.body) throw Error('Source unavailable');
  const reader = response.body.getReader();
  let bytes = 0;
  const chunks = [];
  try {
    while (bytes < limit) {
      if (signal.aborted) throw abortError();
      const { value, done } = await reader.read();
      if (done) break;
      const part = value.subarray(0, limit - bytes);
      chunks.push(part);
      bytes += part.byteLength;
    }
  } catch (error) {
    if (!signal.aborted || bytes < 65536) throw error;
  } finally { await reader.cancel().catch(() => {}); }
  return { bytes, chunks };
}

export async function probeCandidate(candidate, { fetcher = fetch, signal, sampleBytes = AUTO_LIMITS.sampleBytes, timeoutMs = AUTO_LIMITS.probeMs, now = () => performance.now() } = {}) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(cancel, timeoutMs);
  try {
    let url = candidate.stream.url;
    let mimeType = '';
    let adaptive = false;
    let ttfbMs = 0;
    for (let depth = 0; depth < 4; depth++) {
      if (controller.signal.aborted) throw abortError();
      const started = now();
      const response = await fetcher(url + (url.includes('?') ? '&' : '?') + 'probe=1', { signal: controller.signal, credentials: 'same-origin', cache: 'no-store' });
      const headersAt = now();
      const type = (response.headers.get('content-type') || '').toLowerCase();
      if (!response.ok || /html|json/.test(type)) { await response.body?.cancel(); throw Error('Not playable media'); }
      const playlist = /mpegurl/.test(type);
      const sample = await readSample(response, playlist ? 128 * 1024 : sampleBytes, controller.signal);
      if (signal?.aborted) throw abortError();
      if (playlist) {
        mimeType = 'application/vnd.apple.mpegurl';
        const text = new TextDecoder().decode(await new Blob(sample.chunks).arrayBuffer());
        if (!text.trimStart().startsWith('#EXTM3U')) throw Error('Invalid playlist');
        const lines = text.split(/\r?\n/).map(s => s.trim());
        const variants = lines.flatMap((line, index) => line.startsWith('#EXT-X-STREAM-INF:') && lines[index + 1] && !lines[index + 1].startsWith('#') ? [{ url: lines[index + 1], bandwidth: Number(line.match(/(?:^|[, :])BANDWIDTH=(\d+)/)?.[1]) || Infinity }] : []);
        adaptive ||= variants.length > 1;
        const next = variants.length ? variants.sort((a, b) => a.bandwidth - b.bandwidth)[0].url : lines.find(s => s && !s.startsWith('#'));
        // Only gateway-issued resource handles are eligible; never fetch arbitrary URLs from a playlist.
        if (!next || !/^\/api\/playback\/[a-f0-9]{32}\/asset\/[a-f0-9]{24}$/.test(next)) throw Error('No playable segment');
        url = next;
        continue;
      }
      if (!sample.bytes || (!/^video\//.test(type) && !/octet-stream/.test(type))) throw Error('Not playable media');
      ttfbMs = headersAt - started;
      return { ok: true, bytes: sample.bytes, ttfbMs, mbps: sample.bytes * 8 / Math.max(now() - started, 1) / 1000, mimeType: mimeType || type, adaptive };
    }
    throw Error('Playlist nesting is too deep');
  } catch {
    if (signal?.aborted) throw abortError();
    return { ok: false };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
    controller.abort();
  }
}

export async function selectBestStream(rows, { signal, onStatus = () => {}, ...options } = {}) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(cancel, options.totalMs || AUTO_LIMITS.totalMs);
  const candidates = shortlistCandidates(rows, { ...options, limit: options.saveData ? 2 : AUTO_LIMITS.samples });
  const measured = [];
  try {
    for (const [index, candidate] of candidates.entries()) {
      if (controller.signal.aborted) break;
      onStatus(`Checking source ${index + 1} of ${candidates.length}…`);
      const measurement = await probeCandidate(candidate, { ...options, signal: controller.signal, timeoutMs: options.timeoutMs || (candidates.length === 1 ? 8000 : AUTO_LIMITS.probeMs), sampleBytes: options.saveData ? 128 * 1024 : AUTO_LIMITS.sampleBytes });
      measured.push({ ...candidate, measurement });
    }
  } catch (error) { if (signal?.aborted) throw error; }
  finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
  if (signal?.aborted) throw abortError();
  return rankMeasuredCandidates(measured, options);
}

export async function waitForSources(read, { signal, timeoutMs = 19000, settleMs = 1000, canPlayType } = {}) {
  const started = performance.now();
  let first = null;
  while (true) {
    if (signal?.aborted) throw abortError();
    const state = read();
    const now = performance.now();
    const eligible = shortlistCandidates(state.rows, { meta: state.meta, canPlayType }).length > 0;
    if (eligible && first === null) first = now;
    if (now - started >= timeoutMs || (state.pending === 0 && now > started + 50) || (first !== null && now - first >= settleMs)) return [...state.rows];
    await new Promise(resolve => setTimeout(resolve, 80));
  }
}

