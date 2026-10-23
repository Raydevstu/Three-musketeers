import { lstat, readFile, realpath } from 'node:fs/promises';
import { isAbsolute, normalize, relative, sep } from 'node:path';

export const defaultProfiles = {
  inspect: { max_output_chars: 12000 },
  review: { max_output_chars: 4000 }
};

function safePath(root, requested) {
  if (typeof requested !== 'string' || isAbsolute(requested)) throw new Error('path must be relative');
  const rootPath = normalize(root);
  const target = normalize(`${rootPath}${sep}${requested}`);
  const distance = relative(rootPath, target);
  if (distance === '..' || distance.startsWith(`..${sep}`) || isAbsolute(distance)) throw new Error('path is outside root');
  return target;
}

export async function retrieveFile(root, requestedPath, maxOutputChars) {
  const rootReal = await realpath(root);
  const target = safePath(rootReal, requestedPath);
  const info = await lstat(target);
  if (info.isSymbolicLink()) throw new Error('symlink paths are denied');
  if (!info.isFile()) throw new Error('path is not a file');
  if (await realpath(target) !== target) throw new Error('symlink paths are denied');
  const content = await readFile(target, 'utf8');
  if (content.length > maxOutputChars) throw new Error('output exceeds budget');
  return { path: requestedPath, content, chars: content.length };
}

export function createGovernor({ profiles = defaultProfiles } = {}) {
  return {
    profiles,
    checkBudget(profileName, requestedChars) {
      const profile = profiles[profileName];
      if (!profile) throw new Error('profile denied');
      if (!Number.isInteger(requestedChars) || requestedChars < 0 || requestedChars > profile.max_output_chars) throw new Error('budget exceeded');
      return profile;
    }
  };
}
