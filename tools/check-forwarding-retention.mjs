#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { retentionModes, validateRetentionSample, validateRetentionMatrix } from './lib/forwarding-retention-matrix.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
if (process.argv.length !== 2) throw new Error('The forwarding retention gate requires all twelve modes; no filters are accepted.');
const base = join(ROOT, 'artifacts/forwarding-retention');
mkdirSync(base, { recursive: true });
const output = mkdtempSync(join(base, 'run-'));
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
for (const name of ['tools/check-forwarding-retention.mjs', 'tools/lib/heap-quiescence.mjs', 'tools/lib/forwarding-retention-matrix.mjs', 'packages/kernel/src/lib/held-continuation-probe.spec.ts', 'packages/kernel/src/lib/forwarding-retention-probe.spec.ts', 'packages/kernel/vitest.retention.config.ts', '.nvmrc', 'package.json', 'pnpm-lock.yaml']) hashFile(join(ROOT, name));
save('SOURCE.json', sourceHashes);
console.log(`Forwarding retention artifacts: ${output}`);
const results = [];
for (const mode of retentionModes) {
  const { name, kind, arm, scenario, file } = mode;
  const artifact = join(output, `${name}.json`);
  const env = { NODE_OPTIONS: '--expose-gc', ST_GC_ARM: arm, ST_GC_OUTPUT: artifact };
  if (scenario !== undefined) env.ST_GC_SCENARIO = scenario;
  const childEnv = { ...process.env, ...env };
  if (scenario === undefined) delete childEnv.ST_GC_SCENARIO;
  const argv = [join(ROOT, 'node_modules/vitest/vitest.mjs'), 'run', '--root', 'packages/kernel', '--config', 'vitest.retention.config.ts', file, '--maxWorkers=1'];
  save(`${name}-COMMAND.json`, { executable: process.execPath, argv, cwd: ROOT, node: process.version, env });
  const run = spawnSync(process.execPath, argv, { cwd: ROOT, env: childEnv, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  const raw = `${run.stdout ?? ''}${run.stderr ?? ''}`;
  writeFileSync(join(output, `${name}.log`), raw);
  const errors = [];
  if (run.error || run.signal || run.status !== 0) errors.push(run.error?.message ?? `child exit=${run.status} signal=${run.signal}`);
  try { validateRetentionSample(mode, JSON.parse(readFileSync(artifact, 'utf8')), process.version); }
  catch (error) { errors.push(`Sampling output: ${error.message}`); }
  results.push({ name, kind, arm, scenario, processExit: run.status, signal: run.signal, exit: errors.length ? 1 : 0, errors, artifact, log: join(output, `${name}.log`) });
  console.log(`${name}: ${errors.length ? 'FAIL' : 'PASS'}`);
  if (errors.length) process.stdout.write(raw);
}
const matrixErrors = validateRetentionMatrix(results, result => JSON.parse(readFileSync(result.artifact, 'utf8')), process.version);
const failed = matrixErrors.length !== 0;
save('RESULT.json', { exit: failed ? 1 : 0, requiredModes: retentionModes.length, executedModes: results.length, matrixErrors, results, scope: 'Original nine forwarding and three held-continuation GC fixtures, not universal reclamation or heap cost.' });
console.log(`Forwarding retention: ${results.filter(result => !result.exit).length}/${retentionModes.length} passed`);
for (const error of matrixErrors) console.error(error);
process.exitCode = failed ? 1 : 0;
