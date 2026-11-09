import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseRuntimeMinutes,
  runtimeLabel,
  isNew,
  episodeSummary,
  awardsBadge,
  certificationOf,
  languageList,
  availabilityFromStreams,
  availabilityBadges,
  posterMetaLine
} from '../web/badges.js';

test('runtime parsing covers Cinemeta strings and bare numbers', () => {
  assert.equal(parseRuntimeMinutes('109 min'), 109);
  assert.equal(parseRuntimeMinutes('1h 49m'), 109);
  assert.equal(parseRuntimeMinutes('52 min'), 52);
  assert.equal(parseRuntimeMinutes(109), 109);
  assert.equal(parseRuntimeMinutes(''), 0);
  assert.equal(runtimeLabel('109 min'), '1h 49m');
  assert.equal(runtimeLabel('52 min'), '52m');
  assert.equal(runtimeLabel('2h'), '2h');
  assert.equal(runtimeLabel(''), '');
});

test('new badge needs a real release date inside the window', () => {
  const now = Date.parse('2026-11-09T00:00:00Z');
  assert.equal(isNew({ released: '2026-10-30T08:00:00.000Z' }, now), true);
  assert.equal(isNew({ released: '2024-01-01T00:00:00Z' }, now), false);
  assert.equal(isNew({ year: '2026' }, now), false, 'a year alone is not a release date');
  assert.equal(isNew({ released: '2027-01-01T00:00:00Z' }, now), false, 'future dates are not new');
  assert.equal(isNew({}, now), false);
});

test('episode summary counts real videos only', () => {
  assert.equal(episodeSummary([]), '');
  assert.equal(episodeSummary([{ season: 1 }, { season: 1 }]), '2 eps');
  assert.equal(episodeSummary([{ season: 1 }, { season: 1 }]), '2 eps');
  assert.equal(episodeSummary([{ season: 0 }, { season: 1 }, { season: 2 }]), '2 seasons');
  assert.equal(episodeSummary([{ season: 0 }]), '');
});

test('awards badge keeps wins, falls back to nominations', () => {
  assert.equal(awardsBadge('10 wins & 13 nominations total'), '10 wins');
  assert.equal(awardsBadge('Nominated for 3 Oscars'), '3 noms');
  assert.equal(awardsBadge(''), '');
  assert.equal(awardsBadge(null), '');
});

test('certification is only shown when the provider sent one', () => {
  assert.equal(certificationOf({ certification: 'R' }), 'R');
  assert.equal(certificationOf({ ageRating: 'TV-MA' }), 'TV-MA');
  assert.equal(certificationOf({ type: 'movie' }), '');
});

test('languages come from the flags providers actually print', () => {
  const single = languageList('🗣️ 🇬🇧');
  assert.deepEqual(single.shown, ['English']);
  const multi = languageList('🗣️ 🇬🇧 / 🇮🇹 / 🇷🇺 / 🇩🇪 / 🇫🇷');
  assert.deepEqual(multi.shown, ['English', 'Italian', 'Russian', 'German']);
  assert.equal(multi.rest, 1);
  assert.equal(languageList('🗣️ 🌎').shown[0], 'Multi');
  assert.deepEqual(languageList('no flags here').shown, []);
});

test('availability reads resolutions, hdr, cache and languages from stream text', () => {
  const streams = [
    { name: '🔥4K UHD', description: 'BluRay REMUX 📺 DV | HDR10 🗣️ 🇬🇧 / 🇮🇹 ⚡Ready (TB)' },
    { name: '1080p', description: 'WEB-DL 🗣️ 🇬🇧' },
    { name: '720p', description: 'HDTV' }
  ];
  const a = availabilityFromStreams(streams);
  assert.deepEqual(a.resolutions, ['2160p', '1080p', '720p']);
  assert.equal(a.dv, true);
  assert.equal(a.hdr, true);
  assert.equal(a.remux, true);
  assert.equal(a.cached, 1);
  assert.deepEqual(a.languages, ['English', 'Italian']);
  assert.equal(a.total, 3);
});

test('availability badges stay short and never invent a quality', () => {
  const badges = availabilityBadges({
    resolutions: ['2160p'], languages: ['English', 'Italian', 'German'], hdr: true, dv: false, atmos: true, remux: true
  });
  assert.deepEqual(badges, ['4K', 'HDR', 'Atmos', 'REMUX', 'English / Italian', '+1']);
  assert.deepEqual(availabilityBadges(null), []);
  assert.deepEqual(availabilityBadges({ resolutions: [], languages: [] }), []);
});

test('poster meta line is built from present fields only', () => {
  assert.equal(posterMetaLine({ year: 2026, type: 'movie', runtime: '109 min' }), '2026 · Movie · 1h 49m');
  assert.equal(posterMetaLine({ releaseInfo: '2026–', type: 'series', videos: [{ season: 1 }] }), '2026– · 1 ep');
  assert.equal(posterMetaLine({ type: 'movie' }), 'Movie');
  assert.equal(posterMetaLine({}), '');
});
