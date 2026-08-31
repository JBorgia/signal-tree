#!/usr/bin/env node
/**
 * Rewrite pnpm `workspace:` / bare `*` specs in the DIST manifests to a real
 * semver range, then PROVE none survive.
 *
 * `npm publish` does not rewrite these. A published
 * `peerDependencies: { "@signal-tree/kernel": "workspace:*" }` is not a valid
 * semver range, so `npm install @signaltree/ng-forms` fails outright — and it
 * would ship on six of the seven packages, i.e. everything except core.
 *
 * This exists as ONE script because the rewrite was previously copy-pasted into
 * `ci-publish.sh` and `release.sh` and simply missing from `publish-all.sh` —
 * the manual path, and the one a human reaches for. Two copies and one hole is
 * the predictable end state of duplicating a publish-critical step; a single
 * caller-agnostic script is not.
 *
 * Usage:  node scripts/resolve-workspace-specs.mjs <version> <pkg> [pkg...]
 *         node scripts/resolve-workspace-specs.mjs --self-test
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  findUnresolvedWorkspaceSpecs,
  resolveWorkspaceSpecs,
} from '../tools/build/workspace-specs.mjs';

function selfTest() {
  console.log('🧪 resolve-workspace-specs --self-test\n');
  const cases = [
    {
      name: 'rewrites peerDependencies',
      m: { peerDependencies: { '@signal-tree/kernel': 'workspace:*' } },
      expectChanged: 1,
      expectLeft: 0,
      expectSpec: '^1.2.3',
    },
    {
      name: 'rewrites a bare *',
      m: { dependencies: { '@signal-tree/shared': '*' } },
      expectChanged: 1,
      expectLeft: 0,
      expectSpec: '1.2.3',
    },
    {
      name: 'leaves third-party specs alone',
      m: { peerDependencies: { rxjs: '^7.0.0', '@angular/core': '^22.0.0' } },
      expectChanged: 0,
      expectLeft: 0,
    },
    {
      name: 'DEV dependencies are not rewritten (consumers never see them)',
      m: { devDependencies: { '@signal-tree/kernel': 'workspace:*' } },
      expectChanged: 0,
      expectLeft: 0,
    },
    {
      name: 'detector fires on an unrewritten manifest',
      m: { peerDependencies: { '@signal-tree/kernel': 'workspace:*' } },
      skipRewrite: true,
      expectLeft: 1,
    },
  ];

  let ok = true;
  for (const c of cases) {
    const changed = c.skipRewrite ? 0 : resolveWorkspaceSpecs(c.m, '1.2.3');
    const left = findUnresolvedWorkspaceSpecs(c.m).length;
    const resolvedSpec = Object.values(
      c.m.dependencies ?? c.m.peerDependencies ?? {}
    )[0];
    const pass =
      (c.expectChanged === undefined || changed === c.expectChanged) &&
      left === c.expectLeft &&
      (c.expectSpec === undefined || resolvedSpec === c.expectSpec);
    if (!pass) ok = false;
    console.log(`${pass ? '✅' : '❌'} self-test: ${c.name}`);
  }
  process.exit(ok ? 0 : 1);
}

if (process.argv.includes('--self-test')) selfTest();

const [version, ...packages] = process.argv.slice(2);
if (!version || packages.length === 0) {
  console.error(
    'usage: node scripts/resolve-workspace-specs.mjs <version> <pkg> [pkg...]'
  );
  process.exit(1);
}

let totalChanged = 0;
const failures = [];

for (const pkg of packages) {
  const path = join(process.cwd(), 'dist/packages', pkg, 'package.json');
  if (!existsSync(path)) {
    // Not a skip-and-pass: an unbuilt package is one we cannot verify.
    failures.push(`${pkg}: no dist manifest at ${path} — build first`);
    continue;
  }
  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  const changed = resolveWorkspaceSpecs(manifest, version);
  if (changed) {
    writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n');
    totalChanged += changed;
  }
  const left = findUnresolvedWorkspaceSpecs(manifest);
  if (left.length) failures.push(`${pkg}: ${left.join(', ')}`);
  console.log(
    `  ${pkg.padEnd(12)} ${changed} internal spec(s) resolved for ${version}${
      left.length ? '  ❌ UNRESOLVED' : ''
    }`
  );
}

if (failures.length) {
  console.error('\n❌ Workspace specs did not resolve:');
  failures.forEach((f) => console.error(`   - ${f}`));
  console.error(
    '\nPublishing these would ship an invalid semver range and break every\n' +
      'install of the affected packages.'
  );
  process.exit(1);
}

console.log(
  `\n✅ ${packages.length} manifest(s) checked, ${totalChanged} internal spec(s) resolved for ${version}, 0 unresolved.`
);
