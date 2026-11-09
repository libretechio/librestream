import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchSubtitles, languageName, mergeSubtitleTracks } from '../web/subtitles.js';

const addon = (index, name) => ({ index, name, resources: [{ name: 'subtitles', types: ['movie', 'series'] }] });

test('language codes resolve to readable names for the track list', () => {
  assert.equal(languageName('eng'), 'English');
  assert.equal(languageName('EN'), 'English');
  assert.equal(languageName('pt-BR'), 'Portuguese (BR)');
  assert.equal(languageName('xx'), 'XX');
  assert.equal(languageName(''), 'Unknown');
});

test('subtitle discovery keeps one track per addon and language', async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async (url) => {
    if (url.includes('/1/')) {
      return Response.json({ subtitles: [
        { id: 'a', url: '/api/subtitles/a', lang: 'eng', addon: 'OpenSubtitles' },
        { id: 'b', url: '/api/subtitles/b', lang: 'eng', addon: 'OpenSubtitles' },
        { id: 'c', url: '/api/subtitles/c', lang: 'fre', addon: 'OpenSubtitles' }
      ] });
    }
    return Response.json({ subtitles: [{ id: 'd', url: '/api/subtitles/d', lang: 'eng', addon: 'Community' }] });
  };
  const result = await fetchSubtitles([addon(1, 'OpenSubtitles'), addon(2, 'Community')], {
    type: 'movie',
    videoId: 'tt1',
    stream: { behaviorHints: { filename: 'Film.2024.mkv' } }
  });
  assert.equal(result.tracks.length, 3);
  assert.equal(result.tracks.filter(track => track.lang === 'eng').length, 2);
  assert.equal(result.tracks[0].language, 'English');
  assert.ok(result.tracks.every(track => track.kind === 'addon'));
});

test('a failing subtitle addon does not hide the working ones', async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async (url) => {
    if (url.includes('/1/')) throw Error('offline');
    return Response.json({ subtitles: [{ id: 'd', url: '/api/subtitles/d', lang: 'eng', addon: 'Working' }] });
  };
  const result = await fetchSubtitles([addon(1, 'Broken'), addon(2, 'Working')], { type: 'movie', videoId: 'tt1', stream: {} });
  assert.equal(result.tracks.length, 1);
  assert.equal(result.failed, 1);
});

test('embedded and addon tracks merge without duplicating entries', () => {
  const merged = mergeSubtitleTracks(
    [{ kind: 'builtin', index: 0, lang: 'en', language: 'English' }],
    [
      { kind: 'addon', id: 'x', url: '/api/subtitles/x', lang: 'en', language: 'English' },
      { kind: 'addon', id: 'x', url: '/api/subtitles/x', lang: 'en', language: 'English' }
    ]
  );
  assert.equal(merged.length, 2);
  assert.equal(merged[0].kind, 'builtin');
});
