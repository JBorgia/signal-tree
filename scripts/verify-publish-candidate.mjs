#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import semver from 'semver';

import { assertReleasePlan } from './release-plan.mjs';

const root = resolve(import.meta.dirname, '..');
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const candidateRoot = join(root, '.release', 'candidates', version);
const journalPath = join(candidateRoot, 'candidate.json');
if (!existsSync(journalPath)) {
  throw new Error(`Candidate journal not found: ${journalPath}`);
}
const candidate = JSON.parse(readFileSync(journalPath, 'utf8'));
const expectedPackages = [...assertReleasePlan(root)];
const actualPackages = candidate.packages.map((artifact) => artifact.package);
if (JSON.stringify(actualPackages) !== JSON.stringify(expectedPackages)) {
  throw new Error(
    `Candidate order mismatch: expected=${expectedPackages.join(',')} actual=${actualPackages.join(',')}`
  );
}
const prerelease = semver.prerelease(version);
const expectedTag = prerelease ? String(prerelease[0]) : 'latest';
if (candidate.version !== version || candidate.tag !== expectedTag) {
  throw new Error(
    `Candidate version/tag mismatch: ${candidate.version}/${candidate.tag}, expected ${version}/${expectedTag}`
  );
}
const expectedCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: root,
  encoding: 'utf8',
}).trim();
if (candidate.commit !== expectedCommit) {
  throw new Error(`Candidate commit ${candidate.commit} does not match HEAD ${expectedCommit}`);
}
for (const artifact of candidate.packages) {
  const tarball = join(candidateRoot, artifact.tarball);
  if (!existsSync(tarball)) throw new Error(`Missing candidate tarball: ${tarball}`);
  const integrity = `sha512-${createHash('sha512')
    .update(readFileSync(tarball))
    .digest('base64')}`;
  if (integrity !== artifact.integrity) {
    throw new Error(`Candidate integrity mismatch: ${artifact.name}`);
  }
}
if (!['validated', 'dry-run', 'dry-run-complete', 'publishing', 'published'].includes(candidate.state)) {
  throw new Error(`Invalid candidate state: ${candidate.state}`);
}
if (existsSync(join(candidateRoot, '.npmrc'))) {
  throw new Error('Candidate contains temporary npm credentials');
}
console.log(
  `Candidate ${version} is complete: ${actualPackages.join(' -> ')}, tag=${candidate.tag}, state=${candidate.state}.`
);
