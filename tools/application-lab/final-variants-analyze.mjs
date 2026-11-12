#!/usr/bin/env node
// Adapt only the original offline analyzer's registered cohort and sibling paths.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const [beforeArg, afterArg, cohortArg, outArg] = process.argv.slice(2);
assert(beforeArg && afterArg && cohortArg && outArg && process.argv.length === 6);
const self = fileURLToPath(import.meta.url), here = dirname(self);
const original = join(here, 'analyze-variants.mjs');
const sha = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const read = p => JSON.parse(readFileSync(p, 'utf8'));
assert.equal(sha(original), '798532f2593605046e28279033056a964bdd4ee1e23d6644ded67f1ad0b98a19');
const before = resolve(beforeArg), after = resolve(afterArg), cohort = resolve(cohortArg), out = resolve(outArg);
const arms = ['v15-before', 'v16-before', 'tanstack', 'v15', 'v16', 'tanstack-variant', 'native', 'ngrx'];
assert.deepEqual(read(join(before, 'plan.json')).arms, arms);
assert.deepEqual(read(join(after, 'plan.json')).arms, arms);
assert(!existsSync(out));
const sourceDirectory = out + '-source';
for (const target of [out, sourceDirectory])
  for (const parent of [resolve(here, '../..'), before, after, cohort])
    assert(target !== parent && !target.startsWith(parent + sep), 'Output must be outside source/evidence directories');
assert(!existsSync(sourceDirectory));
mkdirSync(sourceDirectory, { recursive: true });
const replacements = [
  ["const registeredArms = ['native', 'ngrx', 'tanstack', 'v15', 'v16'];", 'const registeredArms = ' + JSON.stringify(arms) + ';'],
  ['const here = dirname(self);', 'const here = ' + JSON.stringify(here) + ';'],
];
let source = readFileSync(original, 'utf8');
for (const [from, to] of replacements) {
  assert.equal(source.split(from).length, 2, 'Each exact substitution occurs once');
  source = source.replace(from, to);
}
const generated = join(sourceDirectory, 'derived-analyzer.mjs');
writeFileSync(generated, source, { flag: 'wx' });
const bindings = { [self]: sha(self), [original]: sha(original), [generated]: sha(generated) };
const commands = [];
for (const [name, args] of [['self-test', ['--self-test']], ['analysis', [before, after, cohort, out, 'inventory']]]) {
  const command = [process.execPath, generated, ...args];
  const result = spawnSync(command[0], command.slice(1), { encoding: 'utf8' });
  const log = join(sourceDirectory, name + '.log');
  writeFileSync(log, (result.stdout ?? '') + (result.stderr ?? ''), { flag: 'wx' });
  commands.push({ name, command, status: result.status, signal: result.signal, log, logSha256: sha(log) });
  if (result.status !== 0) break;
}
for (const [p, h] of Object.entries(bindings)) assert.equal(sha(p), h);
const passed = commands.length === 2 && commands.every(c => c.status === 0);
writeFileSync(join(sourceDirectory, 'derivation.json'), JSON.stringify({ passed, command: [process.execPath, ...process.argv.slice(1)], bindings, replacements, commands, limit: 'Only explicit eight-arm cohort registration and original sibling-tool resolution differ. All workload, metrics, source/build/conformance admission and42-child completeness checks remain the original implementation.' }, null, 2) + '\n', { flag: 'wx' });
if (!passed) process.exitCode = 1;
