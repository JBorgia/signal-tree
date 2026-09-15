#!/usr/bin/env node
/** Compose the current public demo and the immutable v14 archive for hosting. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const archiveRepository = 'https://github.com/JBorgia/signaltree.git';
const archiveCommit = '71fe0224ce2929fbe59def5b3b1d62802ec870de';
const output = join(root, 'dist/apps/demo/browser');
const temporaryRoot = mkdtempSync(join(tmpdir(), 'signaltree-demo-archive-'));
const env = { ...process.env, NX_DAEMON: 'false', NX_CLOUD: 'false' };
// Hosting providers can set production-only dependency installation globally.
// Both demos need their pinned development toolchains during the build.
env.NODE_ENV = 'development';

function run(command, args, cwd = root) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio: 'inherit',
    timeout: 15 * 60 * 1000,
  });
  if (result.error) throw result.error;
  assert.equal(
    result.status,
    0,
    `${command} failed (${result.signal ?? result.status})`
  );
}

function verifyPage(path, base) {
  assert(existsSync(path), `Missing page: ${path}`);
  assert(
    readFileSync(path, 'utf8').includes(`<base href="${base}">`),
    `Wrong base href in ${path}`
  );
}

try {
  run('pnpm', [
    'nx',
    'build',
    'demo',
    '--configuration=production',
    '--base-href=/',
  ]);
  run(process.execPath, ['scripts/generate-spa-route-shells.mjs']);

  // Fetch only the reviewed public archive revision; never follow legacy main.
  run('git', ['init', '--quiet', temporaryRoot]);
  run(
    'git',
    ['fetch', '--depth=1', archiveRepository, archiveCommit],
    temporaryRoot
  );
  run('git', ['checkout', '--quiet', '--detach', 'FETCH_HEAD'], temporaryRoot);
  const actualCommit = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: temporaryRoot,
    encoding: 'utf8',
  });
  assert.equal(actualCommit.status, 0);
  assert.equal(actualCommit.stdout.trim(), archiveCommit);

  run(
    'pnpm',
    ['install', '--frozen-lockfile', '--ignore-scripts', '--prod=false'],
    temporaryRoot
  );
  run(
    'pnpm',
    ['nx', 'build', 'demo', '--configuration=production', '--base-href=/v14/'],
    temporaryRoot
  );
  run(
    process.execPath,
    ['scripts/generate-spa-route-shells.mjs'],
    temporaryRoot
  );

  const archiveOutput = join(output, 'v14');
  rmSync(archiveOutput, { recursive: true, force: true });
  cpSync(join(temporaryRoot, 'dist/apps/demo/browser'), archiveOutput, {
    recursive: true,
  });
  for (const metadata of ['CNAME', '.nojekyll']) {
    rmSync(join(archiveOutput, metadata), { force: true });
  }
  for (const route of ['index.html', 'why-causality/index.html']) {
    verifyPage(join(output, route), '/');
  }
  for (const route of ['index.html', 'examples/fundamentals/index.html']) {
    verifyPage(join(archiveOutput, route), '/v14/');
  }
  console.log(
    `\nDemo site verified: current / and v14 archive ${archiveCommit} at /v14/.`
  );
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
