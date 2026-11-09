import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pictureRect } from '../web/picture.js';

test('fit letterboxes a wide film on a phone and keeps the picture centred', () => {
  const rect = pictureRect(390, 844, 1920, 1080, 'fit');
  assert.equal(Math.round(rect.width), 390);
  assert.equal(Math.round(rect.height), 219);
  assert.equal(Math.round(rect.top), 312);
  assert.equal(rect.left, 0);
});

test('fit pillarboxes a 4:3 source on a wide screen', () => {
  const rect = pictureRect(1440, 900, 1440, 1080, 'fit');
  assert.equal(Math.round(rect.width), 1200);
  assert.equal(Math.round(rect.height), 900);
  assert.equal(Math.round(rect.left), 120);
});

test('fill crops and never reports a box larger than the stage', () => {
  const rect = pictureRect(390, 844, 1920, 1080, 'fill');
  assert.equal(rect.width, 390);
  assert.equal(rect.height, 844);
  assert.equal(rect.left, 0);
  assert.equal(rect.top, 0);
});

test('stretch uses the whole stage', () => {
  assert.deepEqual(pictureRect(800, 600, 1920, 1080, 'stretch'), { left: 0, top: 0, width: 800, height: 600 });
});

test('zoom shrinks the visible box from the centre', () => {
  const rect = pictureRect(1000, 1000, 1000, 1000, 'fit', 1.25);
  assert.equal(Math.round(rect.width), 1000);
  assert.equal(rect.left, 0);
  const half = pictureRect(1000, 1000, 2000, 1000, 'fit', 1);
  assert.equal(Math.round(half.width), 1000);
  const zoomed = pictureRect(1000, 1000, 2000, 1000, 'fit', 1.5);
  assert.equal(Math.round(zoomed.width), 1000);
  assert.equal(Math.round(zoomed.left), 0);
});

test('missing metadata falls back to the whole stage instead of zero', () => {
  assert.deepEqual(pictureRect(500, 400, 0, 0, 'fit'), { left: 0, top: 0, width: 500, height: 400 });
  assert.deepEqual(pictureRect(0, 0, 1920, 1080, 'fit'), { left: 0, top: 0, width: 0, height: 0 });
});
