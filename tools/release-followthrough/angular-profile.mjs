#!/usr/bin/env node
// Actual inventory-screen AOT characterization. Each phase is explicit so the
// registered plan can be reviewed before build/run; never overwrites a cohort.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import {
  cpSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync,
  statSync, symlinkSync, writeFileSync,
} from 'node:fs';
import os from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { buildIntegrity } from '../../scripts/publish-artifact-integrity.mjs';
import { RELEASE_PACKAGES } from '../../scripts/release-plan.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const [mode, suppliedPacket, suppliedPackages, expectedSeal] = process.argv.slice(2);
assert.ok(['prepare', 'build', 'run'].includes(mode) && suppliedPacket,
  'Usage: angular-profile.mjs prepare PACKET BUILT_PACKAGES EXPECTED_SEAL | build|run PACKET');
const packet = resolve(suppliedPacket);
const out = join(packet, 'angular-profile');
const work = join(out, 'consumer');
const json = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
const sha = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const collect = (directory) => readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collect(path);
    assert.ok(entry.isFile(), `Unsupported input kind: ${path}`);
    return [path];
  });
const manifest = (directory) => Object.fromEntries(collect(directory).map((path) =>
  [relative(directory, path), { sha256: sha(path), executeBits: statSync(path).mode & 0o111 }]));
const verify = (inputs) => {
  for (const [path, digest] of Object.entries(inputs)) assert.equal(sha(path), digest, `Input drift: ${path}`);
};
const replaceOnce = (source, before, after) => {
  assert.equal(source.split(before).length, 2, `Expected one source anchor: ${before}`);
  return source.replace(before, after);
};

if (mode === 'prepare') {
  assert.ok(!existsSync(out), 'Preserve earlier attempts; prepare requires a fresh packet directory');
  mkdirSync(join(work, 'src'), { recursive: true });
  mkdirSync(join(work, 'node_modules/@signal-tree'), { recursive: true });
  const supplied = resolve(suppliedPackages ?? join(root, 'dist/packages'));
  const suppliedRoot = resolve(supplied, '../..');
  assert.equal(join(suppliedRoot, 'dist/packages'), supplied, 'Use a canonical dist/packages root');
  assert.match(expectedSeal ?? '', /^sha256-[a-f0-9]{64}$/, 'Prepare requires the independently supplied artifact seal');
  assert.equal(buildIntegrity(suppliedRoot, RELEASE_PACKAGES), expectedSeal, 'Supplied artifact is not the selected candidate');
  const artifactInputs = {};
  const copiedPackages = {};
  for (const name of RELEASE_PACKAGES) {
    for (const path of collect(join(supplied, name))) artifactInputs[path] = sha(path);
  }
  for (const name of ['kernel', 'angular']) {
    const original = join(supplied, name);
    const destination = join(work, 'node_modules/@signal-tree', name);
    assert.equal(read(join(original, 'package.json')).name, `@signal-tree/${name}`);
    cpSync(original, destination, { recursive: true });
    const originalManifest = manifest(original);
    assert.deepEqual(manifest(destination), originalManifest, `${name} copy differs from supplied files/bytes/modes`);
    copiedPackages[destination] = originalManifest;
  }
  const kernelVersion = read(join(work, 'node_modules/@signal-tree/kernel/package.json')).version;
  assert.equal(read(join(work, 'node_modules/@signal-tree/angular/package.json')).version, kernelVersion);
  // Reuse pinned dependencies without allowing @signal-tree to resolve to a
  // workspace source alias. Both library packages above are physical copies.
  for (const name of readdirSync(join(root, 'node_modules'))) {
    if (name !== '@signal-tree') symlinkSync(join(root, 'node_modules', name), join(work, 'node_modules', name));
  }
  const fromFacade = createRequire(join(work, 'node_modules/@signal-tree/angular/package.json'));
  assert.equal(realpathSync(fromFacade.resolve('@signal-tree/kernel/package.json')),
    realpathSync(join(work, 'node_modules/@signal-tree/kernel/package.json')));

  const appDirectory = join(root, 'apps/demo/src/app/examples/features/fundamentals/examples/entities');
  const appSource = join(appDirectory, 'entities-demo.component.ts');
  const globalStyles = join(root, 'apps/demo/src/styles.scss');
  let source = readFileSync(appSource, 'utf8');
  source = replaceOnce(source, 'const INITIAL_PRODUCTS: Product[] =', 'export const INITIAL_PRODUCTS: Product[] =');
  source = replaceOnce(source, 'const createInventoryTree = () => {', `const PROFILE_PRODUCTS: Product[] = Array.from({ length: 1000 }, (_, index) => {
  const product = INITIAL_PRODUCTS[index % INITIAL_PRODUCTS.length];
  return { ...product, id: index + 1, sku: index < 4 ? product.sku : product.sku + '-' + index };
});

const createInventoryTree = () => {
  performance.mark('inventory-store-start');`);
  source = replaceOnce(source,
    'tree.$.products.addMany(INITIAL_PRODUCTS.map((product) => ({ ...product })));',
    'tree.$.products.addMany(PROFILE_PRODUCTS.map((product) => ({ ...product })));');
  source = replaceOnce(source, '  return tree;',
    "  performance.measure('inventory-store-factory', 'inventory-store-start');\n  return tree;");
  source = replaceOnce(source, 'private nextProductId = 5;', 'private nextProductId = 1001;');
  writeFileSync(join(work, 'src/entities-demo.component.ts'), source);
  for (const name of ['entities-demo.component.html', 'entities-demo.component.scss']) {
    cpSync(join(appDirectory, name), join(work, 'src', name));
  }
  cpSync(globalStyles, join(work, 'src/styles.scss'));
  cpSync(join(root, 'tools/release-followthrough/angular-profile-main.ts'), join(work, 'src/main.ts'));
  cpSync(fileURLToPath(import.meta.url), join(out, 'executed-runner.mjs'));
  cpSync(join(root, 'tools/release-followthrough/angular-profile-main.ts'), join(out, 'executed-main.ts'));
  writeFileSync(join(work, 'src/index.html'), '<!doctype html><html><head><meta charset="utf-8"><title>Actual inventory AOT profile</title><link rel="icon" href="data:,"></head><body><app-entities-demo></app-entities-demo></body></html>');
  const angularVersion = read(join(root, 'node_modules/@angular/core/package.json')).version;
  json(join(work, 'package.json'), { name: 'signaltree-inventory-aot-profile', version: '0.0.0', private: true,
    type: 'module', dependencies: { '@signal-tree/angular': kernelVersion, '@angular/core': angularVersion } });
  json(join(work, 'tsconfig.json'), {
    compilerOptions: { strict: true, skipLibCheck: false, target: 'ES2022', module: 'preserve',
      moduleResolution: 'bundler', experimentalDecorators: true, useDefineForClassFields: false,
      lib: ['ES2022', 'DOM'], types: [] },
    angularCompilerOptions: { strictTemplates: true, compilationMode: 'full' }, files: ['src/main.ts'],
  });
  json(join(work, 'angular.json'), { version: 1, projects: { inventory: {
    projectType: 'application', root: '', sourceRoot: 'src', architect: { build: {
      builder: '@angular/build:application', options: {
        browser: 'src/main.ts', index: 'src/index.html', tsConfig: 'tsconfig.json', outputPath: 'dist/inventory',
        aot: true, polyfills: [], inlineStyleLanguage: 'scss', styles: ['src/styles.scss'],
      }, configurations: { production: { optimization: true, sourceMap: false, outputHashing: 'all' } },
      defaultConfiguration: 'production',
    } },
  } } });
  const sources = [appSource, globalStyles, join(appDirectory, 'entities-demo.component.html'),
    join(appDirectory, 'entities-demo.component.scss'), fileURLToPath(import.meta.url),
    join(root, 'tools/release-followthrough/angular-profile-main.ts'), join(root, 'pnpm-lock.yaml'),
    join(root, 'package.json'), join(root, '.nvmrc'), join(root, 'scripts/publish-artifact-integrity.mjs'),
    join(root, 'scripts/release-plan.mjs')];
  const copiedInputs = [...collect(join(work, 'src')), ...collect(join(work, 'node_modules/@signal-tree')),
    ...['package.json', 'tsconfig.json', 'angular.json'].map((name) => join(work, name)),
    join(out, 'executed-runner.mjs'), join(out, 'executed-main.ts')];
  const inputs = { ...artifactInputs, ...Object.fromEntries([...sources, ...copiedInputs].map((path) => [path, sha(path)])) };
  const schedule = [
    { role: 'calibration', rate: 1 }, { role: 'calibration', rate: 4 },
    { role: 'calibration', rate: 4 }, { role: 'calibration', rate: 1 },
    ...Array.from({ length: 5 }, (_, index) => (index % 2 ? [4, 1] : [1, 4])
      .map((rate) => ({ role: 'sample', rate }))).flat(),
  ];
  json(join(out, 'plan.json'), { createdUTC: new Date().toISOString(), inputs, schedule,
    artifactIdentity: { suppliedRoot, expectedSeal, copiedPackages },
    controls: ['skip-filter', 'skip-destroy'], kernelVersion, angularVersion, rows: 1000,
    viewport: { width: 1280, height: 900 }, node: process.version, host: os.cpus()[0]?.model,
    platform: os.platform(), cpuThrottling: 'CDP1x/4x;4x is emulation, not a calibrated physical device',
    scope: 'Actual inventory component/template/SCSS and demo global CSS, production AOT, zoneless. Isolated inventory screen excludes app shell/router/network/module loading/first paint/INP. Initial seed scaled to1000 and unused nextID1001; reset remains original4records. No library behavior changes.',
    metrics: { factory: 'Factory clone+population wall duration; excludes module-time seed generation and later component query/computed/hook registration.',
      usableView: 'Wall time from bootstrapApplication call after modules loaded through whenStable and forced layout; includes component initialization, Angular bootstrap/scheduling and rendering.',
      interaction: 'DOMevent handler through Angular.whenStable and forced layout; row lookup/input typing/oracle checks outside timers.6filter+4toggle warmups;30filters/20toggles/10add-remove pairs measured. Per-child nearest-rankp95 and5child medians; no pooled tail estimate.',
      lifecycle: 'App destroy invokes actual component teardown; destroyed flag and removed DOM asserted. This is not a GC proof.' },
    decision: 'Characterization only; preserve misses/distributions. No new timing ceiling or favorable retry.14serialfreshChromium processes plus2oraclecontrols. All inputs checked before/after each child.',
  });
  console.log(`Prepared ${join(out, 'plan.json')}`);
} else if (mode === 'build') {
  const plan = read(join(out, 'plan.json'));
  verify(plan.inputs);
  assert.ok(!existsSync(join(out, 'build.log')), 'Preserve first build; use a fresh packet for corrections');
  const command = [join(root, 'node_modules/@angular/cli/bin/ng.js'), 'build', '--configuration=production', '--stats-json'];
  const began = Date.now();
  try {
    const output = execFileSync(process.execPath, command, { cwd: work, encoding: 'utf8',
      env: { ...process.env, NG_BUILD_MAX_WORKERS: '1', CI: 'true' }, timeout: 300000,
      maxBuffer: 16 * 1024 * 1024 });
    writeFileSync(join(out, 'build.log'), output);
  } catch (error) {
    writeFileSync(join(out, 'build.log'), `${error.stdout ?? ''}${error.stderr ?? error.stack}`);
    json(join(out, 'build.failure.json'), { command: [process.execPath, ...command], exit: error.status,
      error: String(error), seconds: (Date.now() - began) / 1000 });
    throw error;
  }
  verify(plan.inputs);
  const stats = read(join(work, 'dist/inventory/stats.json'));
  const dependencies = {}, virtualInputs = {};
  for (const [name, metadata] of Object.entries(stats.inputs)) {
    const path = resolve(work, name);
    if (existsSync(path)) dependencies[realpathSync(path)] = sha(path);
    else {
      assert.ok(name.startsWith('angular:'), `Unbound nonvirtual build input: ${name}`);
      virtualInputs[name] = metadata;
    }
  }
  for (const name of ['kernel', 'angular']) {
    const expected = realpathSync(join(work, 'node_modules/@signal-tree', name)) + sep;
    const imported = Object.keys(dependencies).filter((path) => path.includes(`@signal-tree/${name}/`));
    assert.ok(imported.length > 0, `No actual ${name} artifact consumed`);
    assert.ok(imported.every((path) => path.startsWith(expected)), `Unexpected ${name} copy consumed`);
  }
  assert.ok(!Object.keys(dependencies).some((path) => /@angular\/compiler\//.test(path)), 'Runtime compiler bundled');
  const served = Object.fromEntries(collect(join(work, 'dist/inventory/browser')).map((path) => [path, sha(path)]));
  const planSha256 = sha(join(out, 'plan.json'));
  json(join(out, 'build.json'), { command: [process.execPath, ...command], exit: 0, planSha256,
    seconds: (Date.now() - began) / 1000, inputs: plan.inputs, dependencies, virtualInputs, served,
    statsSha256: sha(join(work, 'dist/inventory/stats.json')) });
  console.log(`Built ${Object.keys(served).length} served files from exact artifacts`);
} else {
  const plan = read(join(out, 'plan.json')), built = read(join(out, 'build.json'));
  const stats = join(work, 'dist/inventory/stats.json');
  assert.equal(sha(join(out, 'plan.json')), built.planSha256, 'Plan differs from built registration');
  assert.equal(sha(stats), built.statsSha256, 'Stats differ from verified build');
  const bindings = { ...plan.inputs, ...built.dependencies, ...built.served,
    [join(out, 'plan.json')]: built.planSha256,
    [join(out, 'build.json')]: sha(join(out, 'build.json')),
    [stats]: built.statsSha256 };
  const verifyAll = () => {
    verify(bindings);
    assert.equal(buildIntegrity(plan.artifactIdentity.suppliedRoot, RELEASE_PACKAGES),
      plan.artifactIdentity.expectedSeal, 'Selected five-package artifact changed');
    for (const [path, expected] of Object.entries(plan.artifactIdentity.copiedPackages)) {
      assert.deepEqual(manifest(path), expected, 'Copied package files/bytes/modes changed');
    }
  };
  verifyAll();
  const results = join(out, 'results');
  mkdirSync(results);
  const browserRoot = join(work, 'dist/inventory/browser');
  const server = createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const name = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
    const path = resolve(browserRoot, name);
    if (!path.startsWith(browserRoot + sep) || !existsSync(path) || !statSync(path).isFile()) {
      response.writeHead(404).end(); return;
    }
    response.setHeader('Content-Type', path.endsWith('.js') ? 'text/javascript'
      : path.endsWith('.css') ? 'text/css' : path.endsWith('.html') ? 'text/html' : 'application/octet-stream');
    response.end(readFileSync(path));
  });
  await new Promise((accept) => server.listen(0, '127.0.0.1', accept));
  const execute = async (name, row, control = 'none') => {
    verifyAll();
    const loadBefore = os.loadavg(), began = Date.now();
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: plan.viewport });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    try {
      const session = await page.context().newCDPSession(page);
      await session.send('Emulation.setCPUThrottlingRate', { rate: row.rate });
      await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'load' });
      await page.waitForFunction(() => window.angularProfile, undefined, { timeout: 15000 });
      let timer;
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Profile exceeded120second guard')), 120000);
      });
      let result;
      try {
        result = await Promise.race([page.evaluate((fault) => window.angularProfile.run(fault), control), timeout]);
      } catch (error) {
        if (control === 'none') throw error;
        assert.match(String(error), control === 'skip-filter' ? /filter available rendered expected 750 got 1000/
          : /store lifecycle destroy not observed/, 'Wrong negative-control failure');
        result = { control, rejected: true, message: String(error) };
      } finally { clearTimeout(timer); }
      if (control !== 'none') assert.equal(result.rejected, true, 'Negative control unexpectedly passed');
      assert.deepEqual(errors, [], 'Actual Angular app emitted browser errors');
      verifyAll();
      const receipt = { ...row, control, ...result, chromiumVersion: browser.version(),
        executable: chromium.executablePath(), node: process.version, host: os.cpus()[0]?.model,
        loadBefore, loadAfter: os.loadavg(), seconds: (Date.now() - began) / 1000, inputsUnchanged: true };
      json(join(results, name + '.json'), receipt);
      console.log(JSON.stringify({ name, role: row.role, rate: row.rate, control,
        storeFactoryMs: receipt.storeFactoryMs, usableViewMs: receipt.usableViewMs }));
      return receipt;
    } catch (error) {
      json(join(results, name + '.failure.json'), { ...row, control, error: String(error), stack: error.stack, errors });
      await page.screenshot({ path: join(results, name + '.failure.png'), fullPage: false }).catch(() => {});
      throw error;
    } finally { await browser.close(); }
  };
  const receipts = [];
  try {
    for (const control of plan.controls) await execute('control-' + control, { role: 'negative-control', rate: 1 }, control);
    for (const [index, row] of plan.schedule.entries()) receipts.push(await execute(String(index).padStart(2, '0'), row));
    const percentile = (values, fraction) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1];
    const distribution = (samples) => ({ samples, median: percentile(samples, .5),
      min: Math.min(...samples), max: Math.max(...samples) });
    const summary = {};
    for (const rate of [1, 4]) {
      const selected = receipts.filter((receipt) => receipt.role === 'sample' && receipt.rate === rate);
      assert.equal(selected.length, 5);
      summary[rate] = { storeFactoryMs: distribution(selected.map((receipt) => receipt.storeFactoryMs)),
        usableViewMs: distribution(selected.map((receipt) => receipt.usableViewMs)), interactionChildP95Ms: {} };
      for (const kind of ['filter', 'availability', 'add', 'remove']) {
        summary[rate].interactionChildP95Ms[kind] = distribution(selected.map((receipt) =>
          percentile(receipt.timings.filter((timing) => timing.kind === kind).map((timing) => timing.wallMs), .95)));
      }
    }
    json(join(out, 'summary.json'), summary);
    json(join(out, 'complete.json'), { children: receipts.length, negativeControls: plan.controls.length,
      inputsUnchanged: true, profileDirectory: relative(packet, out) });
  } finally { await new Promise((accept) => server.close(accept)); }
}
