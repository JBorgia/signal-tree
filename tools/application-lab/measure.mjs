#!/usr/bin/env node
// Calibration and measurement are separate immutable runs. No thresholds or
// favorable reruns are chosen here. Schedule JSON is written before launch.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const [mode, suppliedPacket, suppliedOut] = process.argv.slice(2);
assert.ok(
  ['calibrate', 'compare'].includes(mode) && suppliedPacket && suppliedOut,
  'measure.mjs calibrate|compare PACKET NEW_OUTPUT_DIRECTORY'
);
const packet = resolve(suppliedPacket),
  out = resolve(suppliedOut);
assert.ok(!existsSync(out), 'Preserve previous attempts');
mkdirSync(out, { recursive: true });
const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const sha = (path) =>
  createHash('sha256').update(readFileSync(path)).digest('hex');
let plan, built, bindings;
try {
  const planPath = join(packet, 'plan.json'),
    buildPath = join(packet, 'build.json');
  const conformancePath = join(packet, 'inventory-conformance/results.json');
  plan = read(planPath);
  built = read(buildPath);
  const conformance = read(conformancePath);
  const checker = fileURLToPath(
    new URL('./inventory-check.mjs', import.meta.url)
  );
  const faults = [
    'drop-filter',
    'stale-count',
    'invalid-add',
    'stale-editor',
    'skip-destroy',
  ];
  assert.equal(new Set(plan.arms).size, plan.arms.length);
  assert.ok(plan.arms.includes('v15'));
  assert.deepEqual(Object.keys(built.arms).sort(), [...plan.arms].sort());
  assert.equal(built.planSha256, sha(planPath));
  assert.equal(conformance.planSha256, built.planSha256);
  assert.equal(conformance.buildSha256, sha(buildPath));
  assert.equal(conformance.runnerSha256, sha(checker));
  assert.deepEqual(
    Object.keys(conformance.controls).sort(),
    [...faults].sort()
  );
  assert.equal(
    conformance.results.length,
    plan.arms.length * (faults.length + 1)
  );
  for (const arm of plan.arms) {
    const results = conformance.results.filter((result) => result.arm === arm);
    assert.deepEqual(
      results.map((result) => result.fault ?? 'baseline').sort(),
      ['baseline', ...faults].sort()
    );
    assert.ok(
      results.every((result) => result.passed === true),
      'Conformance and controls first'
    );
  }
  bindings = {
    ...plan.inputs,
    [fileURLToPath(import.meta.url)]: sha(fileURLToPath(import.meta.url)),
    [checker]: sha(checker),
    [planPath]: sha(planPath),
    [buildPath]: sha(buildPath),
    [conformancePath]: sha(conformancePath),
  };
  for (const arm of Object.values(built.arms))
    Object.assign(bindings, arm.dependencies, arm.served);
  for (const [path, expected] of Object.entries(bindings))
    assert.equal(sha(path), expected, `Input drift ${path}`);
  writeFileSync(
    join(out, 'preflight.json'),
    JSON.stringify({ passed: true, bindings }, null, 2) + '\n',
    { flag: 'wx' }
  );
} catch (error) {
  writeFileSync(
    join(out, 'preflight.json'),
    JSON.stringify({ passed: false, error: String(error.stack) }, null, 2) +
      '\n',
    { flag: 'wx' }
  );
  throw error;
}
const verify = () => {
  for (const [path, expected] of Object.entries(bindings))
    assert.equal(sha(path), expected, `Input drift ${path}`);
};
const { chromium } = createRequire(
  join(plan.toolchainDirectory, 'package.json')
)('playwright');
const repeats = mode === 'calibrate' ? 1 : 5;
const scenarios =
  mode === 'calibrate'
    ? [{ rows: 1000, throttle: 1 }]
    : [
        { rows: 1000, throttle: 1 },
        { rows: 1000, throttle: 4 },
        { rows: 10000, throttle: 1 },
      ];
const schedule = [];
for (const scenario of scenarios)
  for (let round = 0; round < repeats; round++) {
    // Balanced cyclic Latin-square order; separate same-arm duplicate controls.
    const order = plan.arms.map(
      (_, index) => plan.arms[(index + round) % plan.arms.length]
    );
    for (const arm of order)
      schedule.push({ ...scenario, round, arm, control: false });
    if (mode === 'compare' && round < 2)
      for (const repeat of [0, 1])
        schedule.push({
          ...scenario,
          round,
          arm: 'v15',
          control: true,
          repeat,
        });
  }
writeFileSync(
  join(out, 'schedule.json'),
  JSON.stringify(
    {
      mode,
      createdUTC: new Date().toISOString(),
      runnerSha256: sha(fileURLToPath(import.meta.url)),
      packetPlanSha256: built.planSha256,
      schedule,
      operationRoundsPerSample: 30,
      timedOperationsPerSample: { filter: 30, toggle: 30 },
      timing:
        'synthetic DOM event through Angular stable and forced layout; not INP',
      memory:
        'finite forced-GC checkpoints and observed pre-GC high water; not unlimited retention proof',
      host: {
        node: process.version,
        cpu: os.cpus()[0]?.model,
        platform: os.platform(),
        release: os.release(),
        arch: os.arch(),
      },
      limits:
        'Shared host; CDP throttling is not a calibrated device. Five independent samples per arm/profile; no population percentile or human productivity claim.',
    },
    null,
    2
  ) + '\n',
  { flag: 'wx' }
);
let directory;
const server = createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const path = resolve(
    directory,
    '.' + (pathname === '/' ? '/index.html' : pathname)
  );
  if (!path.startsWith(directory + sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    res.setHeader(
      'Content-Type',
      path.endsWith('.js')
        ? 'text/javascript'
        : path.endsWith('.css')
        ? 'text/css'
        : 'text/html'
    );
    res.end(readFileSync(path));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((yes) => server.listen(0, '127.0.0.1', yes));
const url = `http://127.0.0.1:${server.address().port}`;
const quantile = (values, fraction) =>
  [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1];
const results = [];
try {
  for (let index = 0; index < schedule.length; index++) {
    const sample = schedule[index];
    directory = join(packet, sample.arm, 'dist/inventory/browser');
    let browser, page, cdp;
    const errors = [];
    const heap = async (gc) => {
      if (gc)
        for (let attempt = 0; attempt < 3; attempt++) {
          await cdp.send('HeapProfiler.collectGarbage');
          await page.evaluate(
            () => new Promise((resolve) => setTimeout(resolve, 0))
          );
        }
      return (await cdp.send('Runtime.getHeapUsage')).usedSize;
    };
    const readView = () =>
      page.evaluate(() => ({
        matched: Number(
          document.querySelector('[data-testid="matched"]').textContent?.trim()
        ),
        total: Number(
          document.querySelector('[data-testid="total"]').textContent?.trim()
        ),
        ids: [...document.querySelectorAll('tbody tr')].map((row) =>
          row.getAttribute('data-job')
        ),
        row: window.lab.row('J-0'),
      }));
    let result = { ...sample, index, passed: false };
    try {
      verify();
      browser = await chromium.launch({ headless: true });
      const browserSession = await browser.newBrowserCDPSession();
      const processes = await browserSession.send('SystemInfo.getProcessInfo');
      result.process = {
        browserPid: processes.processInfo.find(
          (process) => process.type === 'browser'
        )?.id,
        harnessPid: process.pid,
      };
      assert.ok(
        Number.isInteger(result.process.browserPid),
        'Record actual Chromium process identity'
      );
      await browserSession.detach();
      page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      cdp = await page.context().newCDPSession(page);
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      await cdp.send('Emulation.setCPUThrottlingRate', {
        rate: sample.throttle,
      });
      const baselineHeap = await heap(true);
      await page.goto(`${url}/?rows=${sample.rows}`);
      await page.waitForFunction(() => window.lab?.ready, undefined, {
        timeout: 45000,
      });
      await page.evaluate(() => window.lab.stable());
      const startup = await page.evaluate(() => ({ ...window.lab.timings }));
      let view = await readView();
      assert.equal(view.total, sample.rows);
      assert.equal(view.ids.length, 40);
      const populatedHeap = await heap(true);
      const filter = [],
        toggle = [];
      for (let operation = 0; operation < 30; operation++) {
        const query = operation % 2 === 0 ? 'pump' : '';
        filter.push(
          await page.evaluate(
            (value) => window.lab.measure({ kind: 'filter', value }),
            query
          )
        );
        view = await readView();
        const stride = query ? 3 : 1;
        assert.equal(
          view.matched,
          query ? Math.ceil(sample.rows / 3) : sample.rows
        );
        assert.deepEqual(
          view.ids,
          Array.from({ length: 40 }, (_, i) => `J-${i * stride}`)
        );
        toggle.push(
          await page.evaluate(() =>
            window.lab.measure({ kind: 'click', id: 'toggle-J-0' })
          )
        );
        view = await readView();
        assert.equal(view.row.active, operation % 2 !== 0);
        assert.equal(
          await page
            .getByTestId('toggle-J-0')
            .textContent()
            .then((value) => value?.trim() ?? null),
          view.row.active ? 'Active' : 'Inactive'
        );
      }
      // Untimed finite aging. Each update is checked; measured interaction samples
      // above are not pooled with this extra workload or GC instrumentation.
      let observedPreGC = await heap(false);
      const aging = [];
      for (let phase = 0; phase < 2; phase++) {
        await page.evaluate(
          async ({ phase }) => {
            for (let i = 0; i < 200; i++) {
              const id = `J-${i % 100}`;
              const title = `Aging ${phase}-${i}`;
              await window.lab.rename(id, title);
              if (window.lab.row(id).title !== title)
                throw new Error('Dropped aging write');
              if (
                i % 100 < 40 &&
                document
                  .querySelector(`[data-job="${id}"] [data-field="title"]`)
                  ?.textContent?.trim() !== title
              ) {
                throw new Error('Aging write did not reach the visible DOM');
              }
            }
          },
          { phase }
        );
        observedPreGC = Math.max(observedPreGC, await heap(false));
        aging.push(await heap(true));
      }
      await page.evaluate(() => window.lab.destroy());
      assert.equal(await page.locator('lab-inventory main').count(), 0);
      const afterDestroyHeap = await heap(true);
      assert.deepEqual(errors, []);
      result = {
        ...result,
        passed: true,
        browser: browser.version(),
        startup,
        milliseconds: {
          filter,
          toggle,
          filterP95: quantile(filter, 0.95),
          toggleP95: quantile(toggle, 0.95),
        },
        heapBytes: {
          baseline: baselineHeap,
          populated: populatedHeap,
          aging,
          observedPreGC,
          afterDestroy: afterDestroyHeap,
        },
        host: { load: os.loadavg(), freeBytes: os.freemem() },
      };
    } catch (error) {
      result = {
        ...result,
        passed: false,
        error: String(error.stack),
        browserErrors: errors,
      };
    } finally {
      const finalizationErrors = [];
      try {
        await browser?.close();
      } catch (error) {
        finalizationErrors.push(String(error.stack));
      }
      try {
        verify();
      } catch (error) {
        finalizationErrors.push(String(error.stack));
      }
      if (finalizationErrors.length)
        result = { ...result, passed: false, finalizationErrors };
    }
    results.push(result);
    writeFileSync(
      join(out, `${String(index).padStart(3, '0')}-${sample.arm}.json`),
      JSON.stringify(result, null, 2) + '\n',
      { flag: 'wx' }
    );
    console.log(
      index,
      sample.arm,
      sample.rows,
      sample.throttle,
      result.passed ? 'passed' : 'FAILED'
    );
    if (!result.passed) break; // Preserve first failed cohort; diagnose before a new one.
  }
} finally {
  await new Promise((yes) => server.close(yes));
}
writeFileSync(
  join(out, 'results.json'),
  JSON.stringify(
    { scheduleSha256: sha(join(out, 'schedule.json')), bindings, results },
    null,
    2
  ) + '\n',
  { flag: 'wx' }
);
if (
  results.length !== schedule.length ||
  results.some((result) => !result.passed)
)
  process.exitCode = 1;
