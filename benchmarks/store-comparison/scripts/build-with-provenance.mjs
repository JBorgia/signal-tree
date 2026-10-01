#!/usr/bin/env node
// Build only when explicitly invoked; normal harness selftests never invoke this script.
import { execFileSync } from 'node:child_process';
import { existsSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { candidateEvidence } from './lib/evidence.mjs';
import {
  BUILD_ARGS,
  captureBuildInputs,
  provenancePath,
  recordBuildProvenance,
} from './lib/build-provenance.mjs';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = join(appRoot, 'dist', 'browser');
// A failed attempt must never leave the previous receipt available as a successful mapping.
if (existsSync(provenancePath(root))) unlinkSync(provenancePath(root));
const candidates = Object.fromEntries(
  ['st15-candidate', 'st15-candidate-enhanced'].map((alias) => [
    alias,
    candidateEvidence(appRoot, alias),
  ])
);
for (const [alias, evidence] of Object.entries(candidates)) {
  if (evidence.installedMatchesTarballs === false)
    throw new Error(`${alias}: installed bytes do not match claimed tarballs`);
}
const before = captureBuildInputs(appRoot);
if (!before.installed || !before.source)
  throw new Error('Missing installed dependencies or app source');
const env = { ...process.env, NODE_ENV: 'production' };
for (const key of Object.keys(env))
  if (key.startsWith('NG_BUILD_')) delete env[key];
execFileSync('pnpm', BUILD_ARGS, { cwd: appRoot, env, stdio: 'inherit' });
recordBuildProvenance(appRoot, root, before, candidates);
console.log(`Build provenance: ${provenancePath(root)}`);
