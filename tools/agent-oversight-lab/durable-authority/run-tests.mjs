import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
assert(process.argv[2], 'run-tests.mjs NEW_OUTPUT');
const out = resolve(process.argv[2]);
assert.equal(process.versions.node, '24.15.0', 'Use pinned Node runtime');
mkdirSync(out);
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const inputs = Object.fromEntries(
  readdirSync(here)
    .map((n) => join(here, n))
    .filter((p) => !p.endsWith('.sqlite'))
    .map((p) => [p, sha(p)])
);
const args = [
  '--test',
  '--test-concurrency=1',
  join(here, 'backend.checks.mjs'),
];
const startedUTC = new Date().toISOString();
const result = spawnSync(process.execPath, args, {
  cwd: here,
  encoding: 'utf8',
  maxBuffer: 16 * 1024 * 1024,
  env: { ...process.env, ST_AUTHORITY_EVIDENCE: out },
});
const log = join(out, 'tests.log');
writeFileSync(
  log,
  (result.stdout ?? '') +
    (result.stderr ?? '') +
    (result.error ? String(result.error) : ''),
  { flag: 'wx' }
);
for (const [p, h] of Object.entries(inputs))
  assert.equal(sha(p), h, 'Source changed during tests');
writeFileSync(
  join(out, 'receipt.json'),
  JSON.stringify(
    {
      startedUTC,
      finishedUTC: new Date().toISOString(),
      command: [process.execPath, ...args],
      cwd: here,
      node: process.version,
      inputs,
      exitCode: result.status,
      log,
      logSha256: sha(log),
      limits:
        'Local authenticated fixture identities and SQLite-owned effects; SIGKILL process durability, not power-loss or arbitrary external exactly-once guarantees.',
    },
    null,
    2
  ) + '\n'
);
console.log(log);
process.exitCode = result.status ?? 1;
