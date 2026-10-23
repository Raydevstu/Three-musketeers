import { createLedger, readLedger } from './ledger.mjs';
import { readCapsule, renderCapsule } from './capsule.mjs';

const [command, filePath] = process.argv.slice(2);

if (command === 'status' && filePath) {
  const ledger = await createLedger(filePath);
  const records = await readLedger(ledger);
  console.log(JSON.stringify({ state: records.length ? 'available' : 'empty', records: records.length }));
} else if (command === 'read-capsule' && filePath) {
  console.log(renderCapsule(await readCapsule(filePath)));
} else {
  console.error('Usage: node src/cli.mjs status <ledger.jsonl> | read-capsule <capsule.json>');
  process.exitCode = 1;
}
