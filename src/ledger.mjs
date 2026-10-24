import { validateNormalizedUsage } from './contracts.mjs';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import pg from 'pg';
const { Pool } = pg;

export async function createLedger(filePath = null, databaseUrl = process.env.DATABASE_URL ?? null) {
  const ledger = { filePath, databaseUrl, pool: databaseUrl ? new Pool({ connectionString: databaseUrl }) : null, records: [], contextDiffs: [], routeDecisions: [] };
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
  if (ledger.pool) await ledger.pool.query('INSERT INTO evidence_events (event_type, occurred_at, payload, provenance) VALUES ($1, $2, $3, $4)', ['usage', record.timestamp, record, { source: 'gateway' }]);
}

export async function recordEvidenceEvent(ledger, eventType, payload, provenance = { source: 'governor' }) {
  const record = { type: eventType, timestamp: new Date().toISOString(), payload: structuredClone(payload), provenance: structuredClone(provenance) };
  if (ledger.filePath) await appendFile(ledger.filePath, `${JSON.stringify(record)}\n`, 'utf8');
  if (ledger.pool) await ledger.pool.query('INSERT INTO evidence_events (event_type, occurred_at, payload, provenance) VALUES ($1, $2, $3, $4)', [eventType, record.timestamp, record.payload, record.provenance]);
  ledger.events ??= [];
  ledger.events.push(record);
  return record;
}

export async function readEvidenceEvents(ledger, eventType = null) {
  if (ledger.pool) {
    const result = await ledger.pool.query(eventType ? 'SELECT event_type, occurred_at, payload, provenance FROM evidence_events WHERE event_type = $1 ORDER BY occurred_at' : 'SELECT event_type, occurred_at, payload, provenance FROM evidence_events ORDER BY occurred_at', eventType ? [eventType] : []);
    return result.rows.map((row) => ({ type: row.event_type, timestamp: row.occurred_at, payload: row.payload, provenance: row.provenance }));
  }
  if (ledger.filePath) return (await readFile(ledger.filePath, 'utf8')).split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)).filter((event) => !eventType || event.type === eventType);
  return structuredClone((ledger.events ?? []).filter((event) => !eventType || event.type === eventType));
}

export async function readLedger(ledger) {
  if (ledger.pool) {
    const result = await ledger.pool.query("SELECT payload FROM evidence_events WHERE event_type = 'usage' ORDER BY occurred_at");
    return result.rows.map((row) => row.payload);
  }
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

export async function checkLedgerReady(ledger) {
  if (!ledger) return { status: 'unavailable', ledger: 'unavailable' };
  if (!ledger.pool) return { status: 'ready', ledger: 'configured' };
  try {
    await ledger.pool.query('SELECT 1');
    return { status: 'ready', ledger: 'configured', database: 'ready' };
  } catch {
    return { status: 'unavailable', ledger: 'configured', database: 'unavailable' };
  }
}
