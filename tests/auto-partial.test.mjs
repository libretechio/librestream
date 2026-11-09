import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeCandidate, probeCandidate } from '../web/autoSelect.js';
const candidate = describeCandidate({ a: { index: 0 }, stream: { url: '/api/playback/' + '1'.repeat(32), title: '720p' } });
function partialResponse(options) {
  return new Response(new ReadableStream({ start(controller) {
    controller.enqueue(new Uint8Array(128 * 1024));
    options.signal.addEventListener('abort', () => controller.error(new DOMException('Aborted', 'AbortError')), { once: true });
  } }), { headers: { 'content-type': 'video/mp4' } });
}
test('a slow sample retains measured media bytes at its deadline instead of rejecting an otherwise responsive source', async () => {
  const result = await probeCandidate(candidate, { timeoutMs: 40, fetcher: async (_, options) => partialResponse(options) });
  assert.equal(result.ok, true);
  assert.equal(result.bytes, 128 * 1024);
  assert.ok(result.mbps > 0 && Number.isFinite(result.mbps));
});
test('user cancellation still rejects a partial sample', async () => {
  const controller = new AbortController();
  const result = probeCandidate(candidate, { signal: controller.signal, fetcher: async (_, options) => { setTimeout(() => controller.abort(), 20); return partialResponse(options); } });
  await assert.rejects(result, { name: 'AbortError' });
});
