// Repository setup, run by `pnpm install` (the root "prepare" script).
// Points git at ci/githooks, so the commit-msg hook rejects tool attribution.
// Does nothing outside a git work tree (for example in an unpacked tarball).
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const HOOKS_PATH = 'ci/githooks';

export function setup(cwd = process.cwd()) {
  try {
    if (execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() !== 'true') return false;
  } catch {
    return false;
  }
  execFileSync('git', ['config', 'core.hooksPath', HOOKS_PATH], { cwd });
  return true;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(setup() ? `git hooks: ${HOOKS_PATH}` : 'git hooks: not a git work tree, skipped');
}
