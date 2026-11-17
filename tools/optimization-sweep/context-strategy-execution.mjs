// Freeze the actual local execution closure without launching a browser.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, openSync, readFileSync, readSync, readdirSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import os from 'node:os';

function digest(path) {
  const hash = createHash('sha256'), buffer = Buffer.allocUnsafe(1024 * 1024), descriptor = openSync(path, 'r');
  try { let bytes; while ((bytes = readSync(descriptor, buffer, 0, buffer.length, null)) !== 0) hash.update(buffer.subarray(0, bytes)); }
  finally { closeSync(descriptor); }
  return hash.digest('hex');
}
function files(root) {
  const output = {};
  const visit = (directory, relative = '') => {
    for (const item of readdirSync(directory, { withFileTypes: true })) {
      assert(!item.isSymbolicLink(), `Unexpected execution-closure alias: ${join(directory, item.name)}`);
      const path = join(directory, item.name), key = relative + item.name;
      if (item.isDirectory()) visit(path, key + '/');
      else { assert(item.isFile()); output[key] = digest(path); }
    }
  };
  visit(root); return Object.fromEntries(Object.entries(output).sort(([a], [b]) => a.localeCompare(b)));
}
export function freezeExecution(toolchainDirectory) {
  const require = createRequire(join(toolchainDirectory, 'package.json'));
  const packages = {};
  for (const name of ['playwright', 'playwright-core']) {
    const root = realpathSync(dirname(require.resolve(name + '/package.json')));
    packages[name] = { root, files: files(root) };
  }
  const optionalPath = join(toolchainDirectory, 'node_modules/fsevents');
  const optional = { path: optionalPath, present: existsSync(optionalPath) };
  if (optional.present) {
    const root = realpathSync(optionalPath); packages.fsevents = { root, files: files(root) };
  }
  // Pin the headless shell chosen by this installed Playwright, rather than
  // chromium.executablePath(), which normally identifies the headed browser.
  const { registry } = require(join(packages['playwright-core'].root, 'lib/server/registry/index.js'));
  const selected = registry.findExecutable('chromium-headless-shell'); assert(selected);
  const directory = realpathSync(selected.directory), executable = realpathSync(selected.executablePath());
  assert(executable.startsWith(directory + '/'));
  const browserFiles = files(directory), node = realpathSync(process.execPath);
  const coreManifest = JSON.parse(readFileSync(join(packages['playwright-core'].root, 'package.json'), 'utf8'));
  const playwrightManifest = JSON.parse(readFileSync(join(packages.playwright.root, 'package.json'), 'utf8'));
  assert.equal(playwrightManifest.dependencies['playwright-core'], coreManifest.version);
  assert.deepEqual(Object.keys(playwrightManifest.dependencies), ['playwright-core']);
  assert.deepEqual(Object.keys(playwrightManifest.optionalDependencies ?? {}), ['fsevents']);
  assert.deepEqual(Object.keys(coreManifest.dependencies ?? {}), []);
  return { toolchainDirectory: realpathSync(toolchainDirectory), node: { executable: node, sha256: digest(node), version: process.version }, platform: process.platform, arch: process.arch, osRelease: os.release(), packages, optional, browser: { directory, executable, executableSha256: digest(executable), version: selected.browserVersion, files: browserFiles }, scope: 'Node executable; complete installed Playwright/playwright-core and present optional fsevents package files; complete selected headless-shell distribution. OS release recorded, not a system-library supply-chain audit.' };
}
export function verifyExecution(expected, full = true) {
  const require = createRequire(join(expected.toolchainDirectory, 'package.json'));
  for (const name of ['playwright', 'playwright-core']) assert.equal(realpathSync(dirname(require.resolve(name + '/package.json'))), expected.packages[name].root, `Resolved ${name} identity drift`);
  assert.equal(realpathSync(process.execPath), expected.node.executable, 'Node executable path drift');
  assert.equal(process.version, expected.node.version, 'Node version drift');
  assert.equal(digest(expected.node.executable), expected.node.sha256, 'Node executable bytes drift');
  assert.equal(process.platform, expected.platform); assert.equal(process.arch, expected.arch); assert.equal(os.release(), expected.osRelease);
  assert.equal(existsSync(expected.optional.path), expected.optional.present, 'Optional execution dependency changed');
  if (expected.optional.present) assert.equal(realpathSync(expected.optional.path), expected.packages.fsevents.root);
  assert.equal(realpathSync(expected.browser.executable), expected.browser.executable);
  assert.equal(digest(expected.browser.executable), expected.browser.executableSha256, 'Headless executable bytes drift');
  if (full) {
    for (const [name, entry] of Object.entries(expected.packages)) assert.deepEqual(files(entry.root), entry.files, `Installed ${name} closure drift`);
    assert.deepEqual(files(expected.browser.directory), expected.browser.files, 'Headless distribution drift');
  }
}
