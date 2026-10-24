import { normalizePromptEvent } from './hooks.mjs';

export function createPlatformAdapter(platform) {
  if (!['codex', 'hermes', 'opencode', 'generic'].includes(platform)) throw new Error(`unsupported platform: ${platform}`);
  return { platform, normalize: (event) => normalizePromptEvent({ ...event, platform }) };
}

export const supportedPlatforms = ['codex', 'hermes', 'opencode', 'generic'];
