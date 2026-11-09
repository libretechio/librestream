import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankByProfile } from '../web/connection.js';

const row = (overrides = {}) => {
  const name = overrides.name || '1080p';
  return {
    a: { index: 1, name: 'Provider' },
    info: { resolution: name.includes('2160') ? '2160p' : name.includes('720') ? '720p' : '1080p', cache: 'unknown' },
    stream: {
      url: '/api/playback/abc',
      behaviorHints: { filename: 'Film.1080p.WEB-DL.mkv', videoSize: 4 * 1024 ** 3 },
      ...overrides
    }
  };
};

test('a fast connection is offered the highest bitrate that fits', () => {
  const rows = [
    row({ name: '1080p', behaviorHints: { filename: 'Film.1080p.mkv', videoSize: 4 * 1024 ** 3 } }),
    row({ name: '4K', behaviorHints: { filename: 'Film.2160p.REMUX.mkv', videoSize: 60 * 1024 ** 3 } })
  ];
  const ranked = rankByProfile(rows, { meta: { runtime: '100 min' }, profile: { mbps: 400, pingMs: 5 } });
  assert.equal(ranked.length, 2);
  assert.ok(ranked[0].resolution >= ranked[1].resolution, 'the larger encode wins on a fast line');
});

test('a slow connection gets something it can sustain, not the remux', () => {
  const rows = [
    row({ name: '4K REMUX', behaviorHints: { filename: 'Film.2160p.REMUX.mkv', videoSize: 60 * 1024 ** 3 } }),
    row({ name: '1080p', behaviorHints: { filename: 'Film.1080p.mkv', videoSize: 4 * 1024 ** 3 } })
  ];
  const ranked = rankByProfile(rows, { meta: { runtime: '100 min' }, profile: { mbps: 12, pingMs: 60 } });
  assert.equal(ranked[0].resolution, 1080, 'the 60 GB remux cannot stream at 12 Mbps');
  assert.equal(ranked[0].fits, true);
});

test('cached sources get a bonus at equal quality', () => {
  const rows = [
    { ...row({ name: '1080p' }), info: { resolution: '1080p', cache: 'uncached' } },
    { ...row({ name: '1080p' }), info: { resolution: '1080p', cache: 'cached' } }
  ];
  const ranked = rankByProfile(rows, { meta: { runtime: '100 min' }, profile: { mbps: 100 } });
  assert.equal(ranked[0].info.cache, 'cached');
});

test('an unmeasured connection still returns a pick instead of nothing', () => {
  const rows = [row(), row({ name: '720p', behaviorHints: { filename: 'Film.720p.mkv', videoSize: 1024 ** 3 } })];
  const ranked = rankByProfile(rows, { meta: {}, profile: { mbps: 0, pingMs: 0 } });
  assert.equal(ranked.length, 2);
  assert.ok(ranked[0].stream.url);
});

test('rows without a playable url are dropped', () => {
  const rows = [row(), { a: { index: 1 }, info: {}, stream: {} }];
  const ranked = rankByProfile(rows, { meta: {}, profile: { mbps: 100 } });
  assert.equal(ranked.length, 1);
});

test('save-data caps the resolution at 720p', () => {
  const rows = [
    row({ name: '4K', behaviorHints: { filename: 'Film.2160p.mkv', videoSize: 20 * 1024 ** 3 } }),
    row({ name: '720p', behaviorHints: { filename: 'Film.720p.mkv', videoSize: 1 * 1024 ** 3 } })
  ];
  const ranked = rankByProfile(rows, { meta: { runtime: '100 min' }, profile: { mbps: 500, saveData: true } });
  assert.equal(ranked[0].resolution, 720);
});
