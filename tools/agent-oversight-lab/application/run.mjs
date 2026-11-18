import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { runApplicationChecks } from './checks.mjs';
const [buildArg, outputArg] = process.argv.slice(2);
assert(buildArg && outputArg, 'run.mjs BUILD_MANIFEST NEW_OUTPUT');
assert.equal(process.version, 'v24.15.0');
const sha = (path) =>
  createHash('sha256').update(readFileSync(path)).digest('hex');
const buildPath = resolve(buildArg),
  build = JSON.parse(readFileSync(buildPath)),
  output = resolve(outputArg);
assert(build.complete);
mkdirSync(output);
const here = dirname(fileURLToPath(import.meta.url));
const files = (path) =>
  readdirSync(path, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(join(path, entry.name))
      : [join(path, entry.name)]
  );
const bindings = { [buildPath]: sha(buildPath) };
for (const [file, expected] of Object.entries(build.emitted)) {
  const path = join(build.work, 'site', file);
  assert.equal(sha(path), expected);
  bindings[path] = expected;
}
for (const file of [
  join(here, 'checks.mjs'),
  join(here, 'run.mjs'),
  ...files(join(here, '../durable-authority')).filter((path) =>
    path.endsWith('.mjs')
  ),
])
  bindings[file] = sha(file);
const manifest = {
  started: new Date().toISOString(),
  command: process.argv,
  buildManifest: buildPath,
  bindings,
  node: process.version,
  limits: [
    'Host-provisioned identities, not production IdP integration.',
    'Browser functional cases are not human comprehension evidence.',
    'Process restart with SQLite-owned effects is not arbitrary external exactly-once or power-loss certification.',
  ],
};
const save = () =>
  writeFileSync(
    join(output, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );
save();
let browser;
try {
  browser = await chromium.launch({ headless: true });
  manifest.browser = browser.version();
  manifest.results = await runApplicationChecks(
    browser,
    join(build.work, 'site'),
    output
  );
  for (const [path, hash] of Object.entries(bindings))
    assert.equal(sha(path), hash, 'Source/artifact drift: ' + path);
  assert(
    manifest.results.passed,
    'Application qualification failed; first failure retained'
  );
  manifest.passed = true;
} catch (error) {
  manifest.passed = false;
  manifest.error = String(error.stack ?? error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  manifest.finished = new Date().toISOString();
  save();
}
console.log(
  JSON.stringify({ output, passed: manifest.passed, error: manifest.error })
);
