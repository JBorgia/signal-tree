import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const RELEASE_PACKAGES = Object.freeze(['kernel', 'angular', 'react']);

export function assertReleasePlan(root = process.cwd()) {
  if (RELEASE_PACKAGES[0] !== 'kernel') {
    throw new Error('Kernel must be first in the release package order');
  }
  const discovered = readdirSync(join(root, 'packages'), { withFileTypes: true })
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
      `Release package set mismatch: configured=${configured.join(',')} actual=${discovered.join(',')}`
    );
  }
  return RELEASE_PACKAGES;
}

if (process.argv[1] && import.meta.filename === resolve(process.argv[1])) {
  const packages = assertReleasePlan();
  console.log(
    process.argv.includes('--json')
      ? JSON.stringify(packages)
      : packages.join('\n')
  );
}
