#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';

const expectedFiles = new Map([
  [
    'scripts/release.sh',
    '#!/usr/bin/env bash\nset -euo pipefail\ncd "$(dirname "$0")/.."\nexec node scripts/prepare-release.mjs "$@"\n',
  ],
  [
    'scripts/publish-all.sh',
    '#!/usr/bin/env bash\nset -euo pipefail\ncd "$(dirname "$0")/.."\nexec node scripts/publish-candidate.mjs "$@"\n',
  ],
  [
    'scripts/ci-publish.sh',
    '#!/usr/bin/env bash\nset -euo pipefail\ncd "$(dirname "$0")/.."\nexec node scripts/publish-candidate.mjs --ci --prebuilt "$@"\n',
  ],
]);
const expectedScripts = {
  publish: 'node scripts/publish-candidate.mjs',
  'publish:all': 'node scripts/publish-candidate.mjs',
  'publish:dry-run': 'node scripts/publish-candidate.mjs --dry-run',
  'publish:ci': 'bash scripts/ci-publish.sh',
  release: './scripts/release.sh patch',
  'release:patch': './scripts/release.sh patch',
  'release:minor': './scripts/release.sh minor',
  'release:major': './scripts/release.sh major',
};
const violations = [];

for (const [file, expected] of expectedFiles) {
  if (readFileSync(file, 'utf8') !== expected) violations.push(file);
}

const packageScripts = JSON.parse(readFileSync('package.json', 'utf8')).scripts;
for (const [name, expected] of Object.entries(expectedScripts)) {
  if (packageScripts[name] !== expected) violations.push(`package.json#${name}`);
}

const workflow = readFileSync('.github/workflows/publish.yml', 'utf8');
const workflowPublishCommands = workflow
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => /^run:.*\b(?:npm|pnpm|yarn|node)\b.*\bpublish\b/.test(line));
if (
  workflowPublishCommands.length !== 1 ||
  workflowPublishCommands[0] !==
    'run: node scripts/publish-candidate.mjs --ci --prebuilt'
) {
  violations.push('.github/workflows/publish.yml');
}

for (const file of [
  ...globSync('scripts/**/*.sh'),
  ...globSync('.github/workflows/*.{yml,yaml}'),
]) {
  if (
    file === 'scripts/publish-candidate.mjs' ||
    file === 'scripts/verify-publish-architecture.mjs' ||
    expectedFiles.has(file) ||
    file === '.github/workflows/publish.yml'
  ) {
    continue;
  }
  const executableText = readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n');
  if (/\b(?:npm|pnpm|yarn)(?:\s+--?[^\s]+)*\s+publish\b/.test(executableText)) {
    violations.push(file);
  }
}

if (violations.length > 0) {
  console.error(
    `Publication bypasses canonical engine: ${[...new Set(violations)].join(', ')}`
  );
  process.exit(1);
}
console.log('Every registry publication path uses publish-candidate.mjs.');
