// Freeze the actual local execution closure without launching a browser.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { closeSync, openSync, readFileSync, readSync, readdirSync, realpathSync } from 'node:fs';
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
// Resolve dependency edges from the installed Playwright package that the old
// public/HTTP runners import from this workspace. pnpm need not hoist its core.
// Exported only for this measurement tool's source/resolver probes.
export function resolveInstalledPlaywright(toolchainDirectory) {
  const workspaceRequire = createRequire(join(toolchainDirectory, 'package.json'));
  const playwrightManifest = realpathSync(workspaceRequire.resolve('playwright/package.json'));
  const ownRequire = createRequire(playwrightManifest);
  const coreManifest = realpathSync(ownRequire.resolve('playwright-core/package.json'));
  const playwright = JSON.parse(readFileSync(playwrightManifest, 'utf8'));
  const core = JSON.parse(readFileSync(coreManifest, 'utf8'));
  assert.equal(playwright.name, 'playwright'); assert.equal(core.name, 'playwright-core');
  assert.deepEqual(Object.keys(playwright.dependencies), ['playwright-core']);
  assert.equal(playwright.dependencies['playwright-core'], core.version);
  assert.deepEqual(Object.keys(playwright.optionalDependencies ?? {}), ['fsevents']);
  assert.deepEqual(Object.keys(core.dependencies ?? {}), []);
  let optional;
  try {
    const manifest = realpathSync(ownRequire.resolve('fsevents/package.json'));
    const value = JSON.parse(readFileSync(manifest, 'utf8'));
    assert.equal(value.name, 'fsevents');
    assert.equal(value.version, playwright.optionalDependencies.fsevents);
    optional = { request: 'fsevents/package.json', fromManifest: playwrightManifest, present: true, manifest, root: dirname(manifest) };
  } catch (error) {
    // Only a genuinely unresolved optional package is allowed. Broken exports,
    // unreadable files, version mismatches and other failures stay failures.
    if (error?.code !== 'MODULE_NOT_FOUND' || !String(error.message).startsWith("Cannot find module 'fsevents/package.json'")) throw error;
    let entry, entryResolutionError;
    try { entry = ownRequire.resolve('fsevents'); }
    catch (entryError) {
      if (entryError?.code !== 'MODULE_NOT_FOUND' || !String(entryError.message).startsWith("Cannot find module 'fsevents'")) throw entryError;
      entryResolutionError = { code: entryError.code, message: entryError.message };
    }
    assert.equal(entry, undefined, 'Resolvable optional fsevents entry has no verifiable package manifest');
    optional = { request: 'fsevents/package.json', fromManifest: playwrightManifest, present: false,
      searchPaths: ownRequire.resolve.paths('fsevents'), resolutionError: { code: error.code, message: error.message }, entryResolutionError };
  }
  return { playwrightManifest, coreManifest, optional };
}
function selectedBrowser(resolution) {
  const ownRequire = createRequire(resolution.playwrightManifest);
  const { registry } = ownRequire(join(dirname(resolution.coreManifest), 'lib/server/registry/index.js'));
  const selected = registry.findExecutable('chromium-headless-shell'); assert(selected);
  const directory = realpathSync(selected.directory), executable = realpathSync(selected.executablePath());
  assert(executable.startsWith(directory + '/'));
  return { directory, executable, version: selected.browserVersion };
}
export function freezeExecution(toolchainDirectory) {
  const resolution = resolveInstalledPlaywright(toolchainDirectory), packages = {};
  for (const [name, manifest] of [['playwright', resolution.playwrightManifest], ['playwright-core', resolution.coreManifest]]) {
    const root = dirname(manifest); packages[name] = { root, files: files(root) };
  }
  const optional = resolution.optional;
  if (optional.present) packages.fsevents = { root: optional.root, files: files(optional.root) };
  const selected = selectedBrowser(resolution), node = realpathSync(process.execPath);
  return { toolchainDirectory: realpathSync(toolchainDirectory), node: { executable: node, sha256: digest(node), version: process.version },
    platform: process.platform, arch: process.arch, osRelease: os.release(), resolution, packages, optional,
    browser: { ...selected, executableSha256: digest(selected.executable), files: files(selected.directory) },
    scope: 'Node executable; complete Playwright resolved by the workflow workspace, its own required core and present optional fsevents; complete selected headless-shell distribution. Absent optional dependency is explicit. OS release recorded, not a system-library supply-chain audit.' };
}
export function verifyExecution(expected, full = true) {
  const resolution = resolveInstalledPlaywright(expected.toolchainDirectory);
  assert.deepEqual(resolution, expected.resolution, 'Actual Playwright dependency resolution drift');
  for (const [name, manifest] of [['playwright', resolution.playwrightManifest], ['playwright-core', resolution.coreManifest]])
    assert.equal(dirname(manifest), expected.packages[name].root, `Resolved ${name} identity drift`);
  assert.deepEqual(resolution.optional, expected.optional, 'Optional execution dependency changed');
  if (resolution.optional.present) assert.equal(resolution.optional.root, expected.packages.fsevents.root);
  assert.equal(realpathSync(process.execPath), expected.node.executable, 'Node executable path drift');
  assert.equal(process.version, expected.node.version, 'Node version drift');
  assert.equal(digest(expected.node.executable), expected.node.sha256, 'Node executable bytes drift');
  assert.equal(process.platform, expected.platform); assert.equal(process.arch, expected.arch); assert.equal(os.release(), expected.osRelease);
  assert.deepEqual(selectedBrowser(resolution), { directory: expected.browser.directory, executable: expected.browser.executable, version: expected.browser.version }, 'Selected headless browser drift');
  assert.equal(digest(expected.browser.executable), expected.browser.executableSha256, 'Headless executable bytes drift');
  if (full) {
    for (const [name, entry] of Object.entries(expected.packages)) assert.deepEqual(files(entry.root), entry.files, `Installed ${name} closure drift`);
    assert.deepEqual(files(expected.browser.directory), expected.browser.files, 'Headless distribution drift');
  }
}
