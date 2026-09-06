#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertReleasePlan } from '../scripts/release-plan.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const REQUIRED = [
  ['positioning', /IS NOT: primarily an undo library, event log, query library, sync engine, or\s+persistence framework/],
  ['Angular facade', /Angular\s+code imports `signalTree` and all other SignalTree APIs from here/],
  ['React facade', /React code\s+imports `signalTree`, markers, enhancers, and `useSignalTree/],
  ['Vue facade', /Vue code\s+imports\s+`signalTree` and all other SignalTree APIs from here/],
  ['neutral facade', /Use `@signal-tree\/kernel` directly only for framework-neutral TypeScript/],
  ['link relationship', /persistent relationship with an external authority \(`link\(\)`'s three/],
  ['persistence composition', /`link\(\)`-as-storage specialization/],
  ['external authority', /external write is not automatically a retained causal-history turn/],
  ['causal projection', /does not store\s+prose, actor names, or timestamps/],
];

const PACKAGES = assertReleasePlan(ROOT);
const STALE_CLAIMS = [
  'current guidance comes\n  from package types and READMEs while a replacement is derived',
  'those artifacts are historical and are not shipped by the\ncurrent release',
];

function text(file) {
  return readFileSync(join(ROOT, file), 'utf8');
}

function inspect(manifest, readmes, rootReadme) {
  const problems = REQUIRED.filter(([, pattern]) => !pattern.test(manifest)).map(
    ([name]) => `canonical manifest omits ${name}`
  );
  for (const pkg of PACKAGES) {
    if (!/\[llms\.txt\]\(llms\.txt\)/.test(readmes[pkg]))
      problems.push(`${pkg} README does not link its co-packed llms.txt`);
  }
  for (const claim of STALE_CLAIMS) {
    if (rootReadme.includes(claim))
      problems.push(`root README retains stale guidance claim: ${claim}`);
  }
  return problems;
}

function current() {
  return inspect(
    text('llms.txt'),
    Object.fromEntries(PACKAGES.map((pkg) => [pkg, text(`packages/${pkg}/README.md`)])),
    text('README.md')
  );
}

if (process.argv.includes('--self-test')) {
  const manifest = `
IS NOT: primarily an undo library, event log, query library, sync engine, or
      persistence framework
Angular code imports \`signalTree\` and all other SignalTree APIs from here
React code imports \`signalTree\`, markers, enhancers, and \`useSignalTree
Vue code imports \`signalTree\` and all other SignalTree APIs from here
Use \`@signal-tree/kernel\` directly only for framework-neutral TypeScript
persistent relationship with an external authority (\`link()\`'s three
\`link()\`-as-storage specialization
external write is not automatically a retained causal-history turn
does not store prose, actor names, or timestamps
`;
  const readmes = Object.fromEntries(
    PACKAGES.map((pkg) => [pkg, '[llms.txt](llms.txt)'])
  );
  const baseline = inspect(manifest, readmes, '');
  const missing = inspect(manifest.replace('timestamps', 'dates'), readmes, '');
  const passes = baseline.length === 0 && missing.length === 1;
  console.log(
    passes
      ? '✅ self-test: the checker accepts complete guidance and rejects a missing causal-projection rule.'
      : '❌ self-test FAILED — semantic guidance assertions are not discriminating.'
  );
  process.exit(passes ? 0 : 1);
}

const problems = current();
if (problems.length === 0) {
  console.log('✅ semantic discoverability: canonical guidance and package reachability are complete.');
  process.exit(0);
}

console.error('❌ semantic discoverability gaps:\n');
for (const problem of problems) console.error(`   - ${problem}`);
process.exit(1);
