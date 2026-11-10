import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lockBodyScroll } from '../web/scrollLock.js';

test('overlapping dialogs restore the original overflow in either close order', () => {
  for (const reverse of [false, true]) {
    const body = { style: { overflow: 'auto' } };
    const first = lockBodyScroll(body);
    const second = lockBodyScroll(body);
    (reverse ? second : first)();
    assert.equal(body.style.overflow, 'hidden');
    (reverse ? first : second)();
    assert.equal(body.style.overflow, 'auto');
  }
});

test('releasing a lock twice does not unlock another dialog', () => {
  const body = { style: { overflow: '' } };
  const first = lockBodyScroll(body);
  const second = lockBodyScroll(body);
  first(); first();
  assert.equal(body.style.overflow, 'hidden');
  second();
  assert.equal(body.style.overflow, '');
});
