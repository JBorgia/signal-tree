#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CORE_ROOT = join(ROOT, 'packages/kernel');

function normalizeTestFile(value) {
  const normalized = value.replace(/\\/g, '/');
  return normalized.startsWith('packages/kernel/')
    ? normalized.slice('packages/kernel/'.length)
    : normalized;
}

function toVitestArgs(args) {
  const vitestArgs = ['run', '--config', 'vitest.config.ts'];

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];

    if (arg.startsWith('--testFile=')) {
      vitestArgs.push(normalizeTestFile(arg.slice('--testFile='.length)));
      continue;
    }

    if (arg === '--testFile') {
      const file = args[index + 1];
      if (file) {
        vitestArgs.push(normalizeTestFile(file));
        index++;
      }
      continue;
    }

    if (arg.startsWith('--testNamePattern=')) {
      vitestArgs.push(arg);
      continue;
    }

    if (arg === '--codeCoverage') {
      vitestArgs.push('--coverage');
      continue;
    }

    if (
      arg === '--watch=false' ||
      arg === '--skip-nx-cache' ||
      arg.startsWith('--output-style=') ||
      arg === '--verbose'
    ) {
      continue;
    }

    if (arg.startsWith(`${ROOT}/`)) {
      vitestArgs.push(relative(CORE_ROOT, arg));
      continue;
    }

    vitestArgs.push(arg);
  }

  return vitestArgs;
}

const result = spawnSync(
  'pnpm',
  ['exec', 'vitest', ...toVitestArgs(process.argv.slice(2))],
  {
    cwd: CORE_ROOT,
    stdio: 'inherit',
  }
);

process.exit(result.status ?? 1);
