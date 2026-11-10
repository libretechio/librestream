import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumePosition } from '../web/progress.js';

test('first playback without saved progress starts at zero', () => {
  assert.equal(resumePosition({}, undefined), 0);
  assert.equal(resumePosition({ playbackId: 'episode:1' }, undefined), 0);
});

test('resume uses matching episode progress and preserves fallback position', () => {
  assert.equal(resumePosition({ playbackId: 'episode:1' }, { playbackId: 'episode:1', position: 42 }), 42);
  assert.equal(resumePosition({ playbackId: 'episode:2' }, { playbackId: 'episode:1', position: 42 }), 0);
  assert.equal(resumePosition({ playbackId: 'episode:1', resumePosition: 24 }, { playbackId: 'episode:1', position: 42 }), 24);
});
