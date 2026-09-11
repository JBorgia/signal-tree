import {
  existsSync,
  readFileSync,
  readdirSync,
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';

export const RELEASE_PACKAGES = Object.freeze([
  'kernel',
  'angular',
  'react',
  'vue',
  'studio-query',
  'studio-adapter',
]);

export function assertReleasePlan(root = process.cwd()) {
  if (RELEASE_PACKAGES[0] !== 'kernel') {
    throw new Error('Kernel must be first in the release package order');
  }
  const discovered = readdirSync(join(root, 'packages'), {
    withFileTypes: true,
  })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => {
      const manifestPath = join(root, 'packages', name, 'package.json');
      return (
        existsSync(manifestPath) &&
        JSON.parse(readFileSync(manifestPath, 'utf8')).private !== true
      );
    })
    .sort();
  const configured = [...RELEASE_PACKAGES].sort();
  if (JSON.stringify(discovered) !== JSON.stringify(configured)) {
    throw new Error(
      `Release package set mismatch: configured=${configured.join(
        ','
      )} actual=${discovered.join(',')}`
    );
  }
  const positions = new Map(
    RELEASE_PACKAGES.map((name, index) => [
      JSON.parse(
        readFileSync(join(root, 'packages', name, 'package.json'), 'utf8')
      ).name,
      index,
    ])
  );
  for (const [index, name] of RELEASE_PACKAGES.entries()) {
    const manifest = JSON.parse(
      readFileSync(join(root, 'packages', name, 'package.json'), 'utf8')
    );
    for (const dependency of Object.keys({
      ...manifest.dependencies,
      ...manifest.optionalDependencies,
      ...manifest.peerDependencies,
    })) {
      if (positions.has(dependency) && positions.get(dependency) >= index) {
        throw new Error(
          `Release dependency order violation: ${name} requires ${dependency} first`
        );
      }
    }
  }
  return RELEASE_PACKAGES;
}

if (process.argv[1] && import.meta.filename === resolve(process.argv[1])) {
  if (process.argv.includes('--self-test')) {
    const root = mkdtempSync(join(tmpdir(), 'st-release-plan-'));
    const write = (name, dependencies = {}) => {
      const dir = join(root, 'packages', name);
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, 'package.json'),
        JSON.stringify({ name: `@signal-tree/${name}`, dependencies })
      );
    };
    try {
      for (const name of RELEASE_PACKAGES) write(name);
      write('studio-adapter', {
        '@signal-tree/kernel': 'workspace:*',
        '@signal-tree/studio-query': 'workspace:*',
      });
      assert.deepEqual(assertReleasePlan(root), [
        'kernel',
        'angular',
        'react',
        'vue',
        'studio-query',
        'studio-adapter',
      ]);
      rmSync(join(root, 'packages', 'studio-query'), { recursive: true });
      assert.throws(() => assertReleasePlan(root), /package set mismatch/);
      write('studio-query', { '@signal-tree/studio-adapter': 'workspace:*' });
      assert.throws(
        () => assertReleasePlan(root),
        /dependency order violation/
      );
      write('studio-query');
      write('unexpected');
      assert.throws(() => assertReleasePlan(root), /package set mismatch/);
      console.log(
        'Release plan self-test passed: exact six-package set, missing/extra package rejection, dependency order.'
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
    process.exit(0);
  }
  const packages = assertReleasePlan();
  console.log(
    process.argv.includes('--json')
      ? JSON.stringify(packages)
      : packages.join('\n')
  );
}
