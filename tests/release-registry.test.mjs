import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('public release registry contains only a credential-free public default', async () => {
  const entries = JSON.parse(await readFile(new URL('../addons.json', import.meta.url), 'utf8'));
  assert.deepEqual(entries, [{ name: 'Cinemeta', url: 'https://v3-cinemeta.strem.io/manifest.json' }]);
});
