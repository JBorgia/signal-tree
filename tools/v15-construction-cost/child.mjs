import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { runWorkload } from './workload.mjs';

const input = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
for (const [path, hash] of Object.entries(input.bindings)) assert.equal(sha(path), hash);
const result = { sample: input.sample, node: process.version, pid: process.pid };
try {
  const clock = process.hrtime.bigint(), cpu = process.cpuUsage();
  const api = await import(pathToFileURL(input.bundle).href);
  if (input.sample.kind === 'cpu') {
    const used = process.cpuUsage(cpu);
    result.import = { wallNs: Number(process.hrtime.bigint() - clock), userUs: used.user, systemUs: used.system };
  }
  await runWorkload(api, input.sample, result);
  result.passed = true;
} catch (error) {
  result.passed = false;
  result.error = error instanceof Error ? error.message : String(error);
  result.stack = error instanceof Error ? error.stack : undefined;
  process.exitCode = 1;
}
console.log(JSON.stringify(result));
