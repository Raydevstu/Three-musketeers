import { validateNormalizedUsage } from './contracts.mjs';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function createLedger(filePath = null) {
  const ledger = { filePath, records: [] };
  if (filePath) {
    await mkdir(dirname(filePath), { recursive: true });
    await appendFile(filePath, '', 'utf8');
  }
  return ledger;
}

export async function recordUsage(ledger, usage) {
  if (!validateNormalizedUsage(usage)) throw new TypeError('Invalid normalized usage record');
  const record = structuredClone(usage);
  ledger.records.push(record);
  if (ledger.filePath) await appendFile(ledger.filePath, `${JSON.stringify(record)}\n`, 'utf8');
}

export async function readLedger(ledger) {
  if (ledger.filePath) {
    const lines = (await readFile(ledger.filePath, 'utf8')).split(/\r?\n/).filter(Boolean);
    return lines.map((line) => JSON.parse(line));
  }
  return structuredClone(ledger.records);
}

export function ledgerStatus(ledger) {
  const records = ledger.records.length;
  return { state: records ? 'available' : 'empty', records };
}
