import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlatformAdapter, supportedPlatforms } from '../src/platforms.mjs';

test('platform adapters normalize Codex, Hermes, and OpenCode events', () => {
  for (const platform of supportedPlatforms.slice(0, 3)) assert.equal(createPlatformAdapter(platform).normalize({ prompt: 'hello' }).platform, platform);
});

test('platform adapters reject unknown providers', () => {
  assert.throws(() => createPlatformAdapter('unknown'), /unsupported platform/);
});
