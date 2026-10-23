import { readFile, writeFile } from 'node:fs/promises';
import { validateTaskCapsule } from './contracts.mjs';

export async function saveCapsule(filePath, capsule) {
  if (!validateTaskCapsule(capsule)) throw new TypeError('Invalid task capsule');
  await writeFile(filePath, `${JSON.stringify(capsule, null, 2)}\n`, 'utf8');
}

export async function readCapsule(filePath) {
  const capsule = JSON.parse(await readFile(filePath, 'utf8'));
  if (!validateTaskCapsule(capsule)) throw new TypeError('Invalid task capsule');
  return capsule;
}

export function renderCapsule(capsule) {
  if (!validateTaskCapsule(capsule)) throw new TypeError('Invalid task capsule');
  return [
    `# Task Capsule ${capsule.capsule_id}`,
    `\nIntent: ${capsule.intent}`,
    `\nNext boundary: ${capsule.exact_next_boundary}`,
    `\nFiles: ${capsule.current_state.files_touched.join(', ') || 'none'}`,
    `\nDecisions: ${capsule.decisions_made.join('; ') || 'none'}`,
    `\nOpen risks: ${capsule.open_risks_and_blockers.join('; ') || 'none'}`,
    `\nTests passed: ${capsule.test_status.passed.join('; ') || 'none'}`
  ].join('');
}
