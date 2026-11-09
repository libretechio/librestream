import { test } from 'node:test';
import assert from 'node:assert/strict';
import { titlesNeedingAvailability, PREFETCH_LIMIT } from '../web/badges.js';

test('prefetch targets skip titles already known and respect the cap', () => {
  const items = Array.from({ length: 20 }, (_, i) => ({ id: 'tt' + i, type: 'movie' }));
  const store = { 'movie:tt0': { resolutions: ['1080p'] } };
  const targets = titlesNeedingAvailability(items, store);
  assert.equal(targets.length, PREFETCH_LIMIT);
  assert.ok(!targets.some((t) => t.key === 'movie:tt0'), 'known title is not refetched');
  assert.equal(targets[0].key, 'movie:tt1');
});

test('prefetch targets are unique and carry the type for series', () => {
  const items = [
    { id: 'a', type: 'series' },
    { id: 'a', type: 'series' },
    { id: 'b', type: 'movie' }
  ];
  const targets = titlesNeedingAvailability(items, {});
  assert.deepEqual(targets.map((t) => t.key), ['series:a', 'movie:b']);
});

test('prefetch targets ignore entries without an id', () => {
  assert.deepEqual(titlesNeedingAvailability([{ type: 'movie' }, null], {}), []);
});
