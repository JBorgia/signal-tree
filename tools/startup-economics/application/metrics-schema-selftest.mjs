import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { metrics } from './metrics-schema.mjs';
const [inputArg, outArg] = process.argv.slice(2); assert(inputArg && outArg);
const input = resolve(inputArg), out = resolve(outArg), runner = fileURLToPath(import.meta.url);
assert(!existsSync(out)); mkdirSync(out, { recursive: true });
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const result = read(input); assert.equal(result.mode, 'calibrate'); assert.equal(result.passed, true);
const bindings = { [input]: sha(input), [runner]: sha(runner), [join(dirname(runner), 'metrics-schema.mjs')]: sha(join(dirname(runner), 'metrics-schema.mjs')) };
const samples = result.children.map(entry => { const path = join(dirname(input), entry.path); assert.equal(sha(path), entry.sha256); bindings[path] = sha(path); const sample = read(path); metrics(sample); return sample; });
const cases = [
  ['missing-timing-context', 'timing', sample => { delete sample.context.full; }],
  ['missing-memory-context', 'memory', sample => { delete sample.context.full; }],
  ['missing-memory-startup', 'memory', sample => { delete sample.startup.factory; }],
  ['missing-memory-first-timing', 'memory', sample => { delete sample.context.full.first.totalMs; }],
  ['missing-pressure', 'memory', sample => { sample.pressure.pop(); }],
  ['missing-heap-checkpoint', 'memory', sample => { sample.heap.pop(); }],
  ['missing-cdp-category', 'timing', sample => { delete sample.browserDurationSeconds.TaskDuration; }],
  ['null-first-context', 'timing', sample => { sample.context.full.first.totalMs = null; }],
];
const checks = [];
for (const [name, kind, mutate] of cases) { const sample = structuredClone(samples.find(value => value.kind === kind)); assert(sample); mutate(sample); assert.throws(() => metrics(sample)); checks.push({ name, rejected: true }); }
writeFileSync(join(out, 'results.json'), JSON.stringify({ passed: true, positive: samples.length, negative: checks, bindings, scope: 'Shared metric schema admission only; historical input samples are controls, not fresh performance observations.' }, null, 2) + '\n', { flag: 'wx' });
