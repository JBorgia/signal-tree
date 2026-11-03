#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const HERE = dirname(fileURLToPath(import.meta.url));
if (process.argv.length !== 2) throw new Error('Replay runs the complete paired matrix; no filters are accepted.');
const base = join(ROOT, 'artifacts/native-publication-diagnostics');
mkdirSync(base, { recursive: true });
const output = mkdtempSync(join(base, 'run-'));
const observations = join(output, 'observations.jsonl');
const save = (name, value) => writeFileSync(join(output, name), JSON.stringify(value, null, 2) + '\n');
const sourceHashes = {};
function hashFile(file) {
  sourceHashes[relative(ROOT, file)] = createHash('sha256').update(readFileSync(file)).digest('hex');
}
function hashRuntime(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = join(dir, entry.name);
    if (entry.isDirectory()) hashRuntime(file);
    else if (entry.name.endsWith('.ts') && !/\.(spec|test)\.ts$/.test(entry.name)) hashFile(file);
  }
}
hashRuntime(join(ROOT, 'packages/kernel/src'));
for (const name of ['run.mjs', 'replay.config.ts', 'native-netzero-diagnostic.replay.ts', 'native-equal-inverse-diagnostic.replay.ts']) hashFile(join(HERE, name));
for (const name of ['.nvmrc', 'package.json', 'pnpm-lock.yaml']) hashFile(join(ROOT, name));
save('SOURCE.json', sourceHashes);
const argv = [join(ROOT, 'node_modules/vitest/vitest.mjs'), 'run', '--config', join(HERE, 'replay.config.ts')];
save('COMMAND.json', { executable: process.execPath, argv, cwd: ROOT, node: process.version, env: { ST_OBSERVATIONS: observations } });
console.log(`Diagnostic replay artifacts: ${output}`);
const run = spawnSync(process.execPath, argv, {
  cwd: ROOT, env: { ...process.env, ST_OBSERVATIONS: observations }, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
});
const raw = `${run.stdout ?? ''}${run.stderr ?? ''}`;
writeFileSync(join(output, 'first.log'), raw);
process.stdout.write(raw);
const errors = [];
if (run.error || run.signal || run.status !== 0) errors.push(run.error?.message ?? `child exit=${run.status} signal=${run.signal}`);
const expected = new Set();
for (const mode of ['netzero', 'changed-twice', 'later-confirmed', 'independent-equal', 'r-equal', 'r-independent-equal', 'r-changed'])
  for (const route of ['collection', 'root']) for (const observe of [false, true]) expected.add(JSON.stringify([mode, route, observe]));
let records = [];
try {
  records = readFileSync(observations, 'utf8').split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
  for (const record of records) {
    const key = JSON.stringify([record.mode, record.route, record.observe]);
    if (!expected.delete(key)) errors.push(`Unexpected or duplicate record: ${key}`);
  }
  if (expected.size || records.length !== 28) errors.push(`Incomplete matrix: ${records.length} records, ${expected.size} missing`);
} catch (error) { errors.push(`Observation output: ${error.message}`); }
save('RESULT.json', {
  exit: errors.length ? 1 : 0, records: records.length, uniqueCompleteMatrix: !expected.size && records.length === 28 && !errors.length,
  errors, scope: 'Setup and paired recording completeness only; recorded semantic outcomes are not adjudicated.',
});
if (errors.length) console.error(errors.join('\n'));
else console.log('28 unique paired observations recorded; no semantic acceptance verdict.');
process.exitCode = errors.length ? 1 : 0;
