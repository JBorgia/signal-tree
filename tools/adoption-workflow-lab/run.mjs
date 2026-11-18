import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { arch, cpus, platform, release, totalmem } from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const [buildArg, outArg, mode = 'check', checksArg] = process.argv.slice(2);
assert(
  buildArg && outArg && ['check', 'measure'].includes(mode),
  'run.mjs BUILD_MANIFEST NEW_OUTPUT check | measure CHECK_MANIFEST'
);
const hash = (file) =>
  createHash('sha256').update(readFileSync(file)).digest('hex');
const buildPath = resolve(buildArg),
  output = resolve(outArg);
const build = JSON.parse(readFileSync(buildPath));
assert(build.complete);
mkdirSync(output);
const bindings = {
  [buildPath]: hash(buildPath),
  [fileURLToPath(import.meta.url)]: hash(fileURLToPath(import.meta.url)),
};
if (mode === 'measure') {
  assert(checksArg, 'A passing exact-build check manifest is required');
  const checked = JSON.parse(readFileSync(checksArg));
  assert(
    checked.passed && checked.mode === 'check' && checked.results.length === 5
  );
  for (const [path, expected] of Object.entries(bindings))
    assert.equal(checked.bindings[path], expected);
  bindings[resolve(checksArg)] = hash(checksArg);
}
for (const arm of Object.values(build.arms))
  for (const [file, expected] of Object.entries(arm.emitted)) {
    const path = join(arm.site, file);
    assert.equal(hash(path), expected);
    bindings[path] = expected;
  }
const manifest = {
  startedUTC: new Date().toISOString(),
  command: process.argv,
  bindings,
  mode,
  host: {
    platform: platform(),
    arch: arch(),
    os: release(),
    cpu: cpus()[0].model,
    logicalCpus: cpus().length,
    totalMemory: totalmem(),
    throttle: 'none configured',
    isolation:
      'fresh browser contexts, one reused Chromium process; no fresh-renderer assertion',
  },
  results: [],
  limits: [
    'Synthetic accepted-data authority, not durable server reconciliation.',
    'Timings include full result materialization; not DOM paint, INP or a universal library ranking.',
    'Forced-GC heap is Chromium retained JS heap, not mobile process memory.',
  ],
};
const save = () =>
  writeFileSync(
    join(output, 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n'
  );
save();
let browser, site;
const server = createServer((request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const file =
    pathname === '/app.js' ? 'app.js' : pathname === '/' ? 'index.html' : null;
  if (!file || !site) {
    response.writeHead(404).end();
    return;
  }
  response.setHeader(
    'Content-Type',
    file.endsWith('.js') ? 'text/javascript' : 'text/html'
  );
  response.setHeader('Cache-Control', 'no-store');
  response.end(readFileSync(join(site, file)));
});
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const base = `http://127.0.0.1:${server.address().port}`;
async function pageFor(arm, ui = false, width = 1280) {
  site = build.arms[arm].site;
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(base + (ui ? '/' : '/?lab=1'));
  await page.waitForFunction(() => Boolean(window.adoptionLab));
  assert.equal(await page.evaluate(() => window.adoptionLab.arm), arm);
  return { page, errors };
}
try {
  browser = await chromium.launch({ headless: true });
  manifest.browser = browser.version();
  if (mode === 'check') {
    for (const arm of Object.keys(build.arms)) {
      const { page, errors } = await pageFor(arm);
      const checks = await page.evaluate(() =>
        window.adoptionLab.functionalChecks()
      );
      assert.deepEqual(
        [...checks].sort(),
        [
          'independent-editors',
          'external-status-survives-rejection',
          'other-editor-stays-pending',
          'accepted-result',
          'closed-editor-unusable',
          'stale-write-rejected',
          'replacement-rejected',
          'service-rejection',
          'uncertain-stays-pending',
          'receipt-reconciliation',
          'joined-and-grouped-updates',
          'query-removal',
          'owner-teardown',
          'command-cannot-confirm-new-proposal',
          'editor-can-save-again',
          'discard-refreshes-accepted-route',
          'discard-refreshes-revision',
          'in-flight-proposal-cannot-change',
          'in-flight-captured-route',
          'close-cancels-unaccepted-save',
          'query-removal-complete',
          'query-replacement-complete',
          'query-bulk-complete',
        ].sort()
      );
      const controls = [];
      for (const fault of ['ship', 'externalRoute', 'replace', 'close']) {
        const result = await page.evaluate(async (method) => {
          const prototype = window.adoptionLab.Workspace.prototype;
          const original = prototype[method];
          prototype[method] = () => {};
          try {
            await window.adoptionLab.functionalChecks();
            return 'UNDETECTED';
          } catch (error) {
            return String(error);
          } finally {
            prototype[method] = original;
          }
        }, fault);
        const expected = {
          ship: 'external-status-survives-rejection',
          externalRoute: 'stale-write-rejected',
          replace: 'replacement-rejected',
          close: 'closed-editor-unusable',
        }[fault];
        assert(result.includes(`ORACLE:${expected}`), `${fault}: ${result}`);
        controls.push({ fault, expected, result });
      }
      const queryControl = await page.evaluate(async () => {
        try {
          await window.adoptionLab.functionalChecks('group-count');
          return 'UNDETECTED';
        } catch (error) {
          return String(error);
        }
      });
      assert(queryControl.includes('ORACLE:query-update-0'), queryControl);
      controls.push({
        fault: 'wrong-group-count',
        expected: 'query-update-0',
        result: queryControl,
      });
      assert.deepEqual(errors, []);
      await page.close();
      const layouts = [];
      for (const width of [1280, 390]) {
        const { page, errors } = await pageFor(arm, true, width);
        await page
          .getByRole('button', { name: 'Open an editor for job 0' })
          .click();
        await page
          .getByRole('button', { name: 'Open an editor for job 0' })
          .click();
        const editors = page.getByRole('article');
        await editors.nth(1).waitFor();
        assert.equal(await editors.count(), 2);
        await editors
          .nth(0)
          .getByRole('button', { name: 'Propose West' })
          .click();
        await editors
          .nth(1)
          .getByRole('button', { name: 'Propose West' })
          .click();
        await page
          .getByRole('button', { name: 'Receive shipping update' })
          .click();
        await editors
          .nth(0)
          .getByRole('button', { name: 'Discard proposal' })
          .click();
        await editors.nth(0).getByText('North', { exact: true }).waitFor();
        assert((await editors.nth(0).innerText()).includes('North'));
        assert((await editors.nth(0).innerText()).includes('Shipped'));
        assert((await editors.nth(1).innerText()).includes('West'));
        await editors
          .nth(1)
          .getByRole('button', { name: 'Ask service to accept' })
          .click();
        await page
          .getByRole('status')
          .filter({ hasText: 'Service result: applied' })
          .waitFor();
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1
        );
        assert(!overflow, `${arm} overflow at ${width}`);
        const screenshot = join(output, `${arm}-${width}.png`);
        await page.screenshot({ path: screenshot, fullPage: true });
        assert.deepEqual(errors, []);
        layouts.push({ width, screenshot, sha256: hash(screenshot) });
        await page.close();
      }
      manifest.results.push({ arm, checks, controls, layouts });
      save();
    }
  } else {
    const arms = Object.keys(build.arms);
    // Correctness preflight in separate realms. Samples use fresh page contexts,
    // not warmed JavaScript realms; browser process and network origin are shared.
    for (const arm of arms) {
      const { page } = await pageFor(arm);
      await page.evaluate(() => window.adoptionLab.functionalChecks());
      await page.close();
    }
    for (const size of [1000, 10000])
      for (let round = 0; round < 4; round++) {
        for (const arm of round === 3
          ? ['v15', 'v15']
          : round % 2
          ? [...arms].reverse()
          : arms) {
          const { page, errors } = await pageFor(arm);
          const result = await page.evaluate(async (size) => {
            const now = () => performance.now();
            const start = now(),
              workspace = new window.adoptionLab.Workspace(size);
            const constructionMs = now() - start;
            await workspace.ready;
            await workspace.read();
            const readyMs = now() - start;
            const sparse = [],
              bulk = [],
              driver = [],
              lifecycle = [];
            const routes = new Map(),
              priority = new Map(),
              regions = new Map();
            const check = () => {
              const actual = workspace.model.view();
              const expected = [],
                counts = new Map();
              for (let id = 0; id < size; id++) {
                if (!(priority.get(id) ?? id % 3 === 0)) continue;
                const driverId = id % Math.ceil(size / 20);
                const region =
                  regions.get(driverId) ??
                  ['North', 'South', 'East', 'West'][driverId % 4];
                expected.push({
                  id,
                  instance: 1,
                  driverId,
                  route: routes.get(id) ?? 'North',
                  status: 'Ready',
                  priority: true,
                  revision: 0,
                  driver: `Driver ${driverId}`,
                  region,
                });
                counts.set(region, (counts.get(region) ?? 0) + 1);
              }
              const groups = [...counts]
                .map(([region, count]) => ({ region, count }))
                .sort((a, b) => a.region.localeCompare(b.region));
              if (
                JSON.stringify(actual) !==
                JSON.stringify({ rows: expected, regions: groups })
              )
                throw new Error('Measurement query oracle');
            };
            check();
            for (let index = 0; index < 100; index++) {
              const id = (index * 37) % size,
                route = index % 2 ? 'East' : 'West';
              const begin = now();
              workspace.ingestJob(id, { route, priority: true });
              await workspace.read();
              sparse.push(now() - begin);
              routes.set(id, route);
              priority.set(id, true);
              check();
            }
            check();
            for (let batch = 0; batch < 10; batch++) {
              const changes = Array.from({ length: 100 }, (_, index) => ({
                id: (batch * 100 + index) % size,
                changes: { route: 'West', priority: index % 2 === 0 },
              }));
              const begin = now();
              workspace.ingestJobs(changes);
              await workspace.read();
              bulk.push(now() - begin);
              for (let index = 0; index < 100; index++) {
                const id = (batch * 100 + index) % size;
                routes.set(id, 'West');
                priority.set(id, index % 2 === 0);
              }
              check();
            }
            check();
            for (let index = 0; index < 10; index++) {
              const begin = now();
              workspace.model.updateDriver(index, { region: 'Changed' });
              await workspace.read();
              driver.push(now() - begin);
              regions.set(index, 'Changed');
              check();
            }
            check();
            for (let index = 0; index < 50; index++) {
              const begin = now(),
                key = workspace.open(index);
              const editor = workspace.editors()[0].editor;
              workspace.propose(key, 'East');
              const proposed = editor.read().route;
              workspace.reject(key);
              const reverted = editor.read().route;
              workspace.close(key);
              lifecycle.push(now() - begin);
              if (
                proposed !== 'East' ||
                reverted !== workspace.model.job(index)?.route ||
                workspace.editors().length
              )
                throw new Error('Measured editor lifecycle oracle');
            }
            const begin = now();
            await workspace.destroy();
            const destroyMs = now() - begin;
            return {
              constructionMs,
              readyMs,
              sparse,
              bulk,
              driver,
              lifecycle,
              destroyMs,
              checked: true,
            };
          }, size);
          assert.deepEqual(errors, []);
          await page.close();
          manifest.results.push({
            arm,
            size,
            round,
            control: round === 3,
            kind: 'cpu',
            ...result,
          });
          save();
        }
      }
    // Separate heap cohort: no collector pauses inside any CPU sample.
    for (const size of [1000, 10000])
      for (let round = 0; round < 4; round++) {
        for (const arm of round === 3
          ? ['v15', 'v15']
          : round % 2
          ? [...arms].reverse()
          : arms) {
          const { page, errors } = await pageFor(arm);
          const cdp = await page.context().newCDPSession(page);
          await cdp.send('Performance.enable');
          const heap = async () => {
            await cdp.send('HeapProfiler.collectGarbage');
            return (await cdp.send('Performance.getMetrics')).metrics.find(
              (m) => m.name === 'JSHeapUsedSize'
            ).value;
          };
          const baseline = await heap();
          await page.evaluate(async (size) => {
            window.heapOwner = new window.adoptionLab.Workspace(size);
            await window.heapOwner.read();
          }, size);
          const populated = await heap();
          await page.evaluate(() => {
            window.editorRefs = [];
            for (let i = 0; i < 30; i++) {
              const key = window.heapOwner.open(i);
              window.heapOwner.propose(key);
              window.editorRefs.push(
                new WeakRef(window.heapOwner.editors().at(-1).editor)
              );
            }
          });
          const pending = await heap();
          await page.evaluate(() => {
            for (const entry of window.heapOwner.editors())
              window.heapOwner.close(entry.key);
          });
          const closed = await heap();
          await page.evaluate(async () => {
            await window.heapOwner.destroy();
            window.heapOwner = null;
          });
          const destroyed = await heap();
          await page.evaluate(() => Promise.resolve());
          await heap();
          const retainedEditors = await page.evaluate(
            () => window.editorRefs.filter((ref) => ref.deref()).length
          );
          assert.equal(retainedEditors, 0, 'Closed editor retained');
          assert.deepEqual(errors, []);
          await page.close();
          manifest.results.push({
            arm,
            size,
            round,
            control: round === 3,
            kind: 'heap',
            baseline,
            populated,
            pending,
            closed,
            destroyed,
            retainedEditors,
          });
          save();
        }
      }
  }
  for (const [file, expected] of Object.entries(bindings))
    assert.equal(hash(file), expected, 'Artifact drift');
  manifest.passed = true;
} catch (error) {
  manifest.passed = false;
  manifest.error = String(error.stack ?? error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
  manifest.finishedUTC = new Date().toISOString();
  save();
}
console.log(
  JSON.stringify({ output, passed: manifest.passed, error: manifest.error })
);
