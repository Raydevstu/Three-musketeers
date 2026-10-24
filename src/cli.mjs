import { createLedger, readLedger } from './ledger.mjs';
import { readCapsule, renderCapsule } from './capsule.mjs';
import { createWorkerMesh } from './orchestration.mjs';

const [command, filePath, ...rest] = process.argv.slice(2);
const gatewayUrl = process.env.GATEWAY_URL ?? `http://127.0.0.1:${process.env.PORT ?? 8080}`;
const gatewayHeaders = { 'content-type': 'application/json', ...(process.env.GATEWAY_AUTH_TOKEN ? { authorization: `Bearer ${process.env.GATEWAY_AUTH_TOKEN}` } : {}) };
async function gatewayRequest(path, options = {}) { const response = await fetch(`${gatewayUrl}${path}`, { ...options, headers: { ...gatewayHeaders, ...(options.headers ?? {}) } }); const text = await response.text(); if (!response.ok) throw new Error(`${response.status}: ${text}`); return text; }

if (command === 'status' && filePath) {
  const ledger = await createLedger(filePath);
  const records = await readLedger(ledger);
  console.log(JSON.stringify({ state: records.length ? 'available' : 'empty', records: records.length }));
} else if (command === 'read-capsule' && filePath) {
  console.log(renderCapsule(await readCapsule(filePath)));
} else if (command === 'workers') {
  console.log(JSON.stringify({ workers: createWorkerMesh().list() }));
} else if (command === 'delegate-codex' && filePath) {
  const ledger = await createLedger(process.env.EVIDENCE_LEDGER_PATH ?? '.data/evidence.jsonl');
  const result = await createWorkerMesh({ ledger }).delegate({ task: [filePath, ...rest].join(' '), capabilities: ['codex'], budget_tokens: 20_000 });
  console.log(JSON.stringify(result));
} else if (command === 'delegate' && filePath) {
  console.log(await gatewayRequest('/orchestration/delegate', { method: 'POST', body: JSON.stringify({ task: [filePath, ...rest].join(' '), capabilities: ['codex'], budget_tokens: 20_000 }) }));
} else if (command === 'automation-list') {
  console.log(await gatewayRequest('/automation/jobs'));
} else if (command === 'automation-run' && filePath) {
  console.log(await gatewayRequest(`/automation/${encodeURIComponent(filePath)}`, { method: 'POST' }));
} else if (command === 'ingest-hook' && filePath) {
  const body = JSON.parse(filePath);
  const response = await fetch(`http://127.0.0.1:${process.env.PORT ?? 8080}/hooks/${body.platform ?? 'generic'}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(process.env.HOOK_SIGNATURE ? { 'x-governor-signature': process.env.HOOK_SIGNATURE } : {}), ...(process.env.GATEWAY_AUTH_TOKEN ? { authorization: `Bearer ${process.env.GATEWAY_AUTH_TOKEN}` } : {}) }, body: JSON.stringify(body) });
  console.log(await response.text());
  if (!response.ok) process.exitCode = 1;
} else {
  console.error('Usage: node src/cli.mjs status <ledger.jsonl> | read-capsule <capsule.json> | workers | delegate-codex <task> | delegate <task> | automation-list | automation-run <job> | ingest-hook <json>');
  process.exitCode = 1;
}
