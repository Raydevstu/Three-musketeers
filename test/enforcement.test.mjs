import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGovernor, retrieveFile } from '../src/enforcement.mjs';

test('retrieves only a file inside the configured root', async () => {
  const root = await mkdtemp(join(tmpdir(), 'three-musketeers-retrieval-'));
  await mkdir(join(root, 'src'));
  await writeFile(join(root, 'src', 'app.mjs'), 'export const answer = 42;');
  const result = await retrieveFile(root, 'src/app.mjs', 100);
  assert.equal(result.path, 'src/app.mjs');
  assert.match(result.content, /answer/);
});

test('rejects traversal outside the configured root', async () => {
  const root = await mkdtemp(join(tmpdir(), 'three-musketeers-retrieval-'));
  await assert.rejects(() => retrieveFile(root, '../secret.txt', 100), /outside root/);
});

test('rejects a profile when the requested budget exceeds its limit', () => {
  const governor = createGovernor({ profiles: { review: { max_output_chars: 20 } } });
  assert.throws(() => governor.checkBudget('review', 21), /budget exceeded/);
});

test('bounds retrieved output', async () => {
  const root = await mkdtemp(join(tmpdir(), 'three-musketeers-retrieval-'));
  await writeFile(join(root, 'large.txt'), '0123456789');
  await assert.rejects(() => retrieveFile(root, 'large.txt', 5), /output exceeds/);
});

test('denies symlink paths', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'three-musketeers-retrieval-'));
  await writeFile(join(root, 'secret.txt'), 'secret');
  try { await (await import('node:fs/promises')).symlink(join(root, 'secret.txt'), join(root, 'link.txt')); }
  catch { t.skip('symlinks unavailable'); return; }
  await assert.rejects(() => retrieveFile(root, 'link.txt', 100), /symlink/);
});
