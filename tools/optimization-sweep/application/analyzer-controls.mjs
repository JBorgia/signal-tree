#!/usr/bin/env node
// Exercise admission with complete real records. Rehash deliberate semantic
// mutations so rejection does not merely prove the child-file checksum check.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const [inputArg, outputArg] = process.argv.slice(2);
assert(inputArg && outputArg);
const input = resolve(inputArg), output = resolve(outputArg);
assert(!existsSync(output)); mkdirSync(output, { recursive: true });
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const write = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
const analyzer = join(dirname(fileURLToPath(import.meta.url)), 'analyze.mjs');
const sourceResult = read(join(input, 'results.json'));
assert.equal(sourceResult.passed, true); assert.equal(sourceResult.completed, 176);
const cases = [
  ['unchanged', null, null],
  ['missing-full-context', s => s.kind === 'timing', s => { delete s.context.full; }],
  ['missing-pressure-128', s => s.kind === 'timing', s => { s.pressure.pop(); }],
  ['missing-cdp', s => s.kind === 'timing', s => { delete s.browserDurationSeconds.TaskDuration; }],
  ['wrong-aa-arm', s => s.aa === true, s => { s.arm = 'native'; }],
  ['null-startup', s => s.kind === 'timing', s => { s.startup.factory = null; }],
  ['missing-memory-startup', s => s.kind === 'memory', s => { delete s.startup.factory; }],
  ['null-context', s => s.kind === 'timing', s => { s.context.full.first.totalMs = null; }],
  ['null-heap', s => s.kind === 'memory', s => { s.heap[0].usedSize = null; }],
  ['changed-child-bytes', s => s.kind === 'timing', s => { s.startup.factory += 1; }],
  ['wrong-source-identity', null, null],
  ['absent-active-frames', s => s.kind === 'timing', s => { s.interleaved.frameGapsMs = []; }],
];
const records = [];
const expectedFailures = {
  'missing-full-context': 'full', 'missing-pressure-128': '128', 'missing-cdp': 'TaskDuration',
  'wrong-aa-arm': 'Exact registered cohort', 'null-startup': 'Bad startup.factory',
  'missing-memory-startup': 'Bad startup.factory', 'null-context': 'Bad context.full.first.totalMs',
  'null-heap': 'Bad heap.blank', 'changed-child-bytes': 'Child payload mismatch',
  'wrong-source-identity': 'Actual bound planPath identity',
};
for (const [name, select, mutate] of cases) {
  const directory = join(output, name), candidate = join(directory, 'input');
  cpSync(input, candidate, { recursive: true });
  const result = read(join(candidate, 'results.json')), schedule = read(join(candidate, 'schedule.json'));
  if (select) {
    const entry = result.children.find(entry => select(read(join(candidate, entry.path)))); assert(entry);
    const path = join(candidate, entry.path), sample = read(path); mutate(sample); write(path, sample);
    if (name !== 'changed-child-bytes') entry.sha256 = sha(path);
    if (name === 'wrong-aa-arm') { schedule.schedule[entry.index].arm = sample.arm; write(join(candidate, 'schedule.json'), schedule); }
  }
  if (name === 'wrong-source-identity') result.sourceIdentity.planSha256 = '0'.repeat(64);
  write(join(candidate, 'results.json'), result);
  const analyzed = join(directory, 'analysis');
  const command = [analyzer, candidate, analyzed];
  const run = spawnSync(process.execPath, command, { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  writeFileSync(join(directory, 'stdout.log'), run.stdout ?? '');
  writeFileSync(join(directory, 'stderr.log'), run.stderr ?? '');
  const expectedSuccess = name === 'unchanged' || name === 'absent-active-frames';
  assert.equal(run.status === 0, expectedSuccess, `${name}: ${run.stderr}`);
  if (!expectedSuccess) assert(run.stderr.includes(expectedFailures[name]), `${name} missed its intended assertion: ${run.stderr}`);
  if (name === 'absent-active-frames') {
    const group = read(join(analyzed, 'summary.json')).groups.find(g => g.arm === 'native' && g.rows === 1000 && g.kind === 'timing');
    assert.equal(group.metrics['frames.active.p95Gap'].missing, 1);
    assert.equal(group.metrics['frames.active.maximumGap'].missing, 1);
  }
  records.push({ name, command: [process.execPath, ...command], expectedSuccess, exitCode: run.status, resultSha256: sha(join(candidate, 'results.json')), scheduleSha256: sha(join(candidate, 'schedule.json')), stdoutSha256: sha(join(directory, 'stdout.log')), stderrSha256: sha(join(directory, 'stderr.log')) });
}
write(join(output, 'results.json'), { passed: true, sourceResult: { path: join(input, 'results.json'), sha256: sha(join(input, 'results.json')) }, analyzer: { path: analyzer, sha256: sha(analyzer) }, runner: { path: fileURLToPath(import.meta.url), sha256: sha(fileURLToPath(import.meta.url)) }, cases: records });
console.log(JSON.stringify({ passed: true, cases: records.length }));
