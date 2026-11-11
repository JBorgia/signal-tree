#!/usr/bin/env node
// Paired private application variants; baseline measure.mjs remains frozen.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const [suppliedBefore, suppliedAfter, suppliedOut] = process.argv.slice(2);
assert.ok(
  suppliedBefore && suppliedAfter && suppliedOut,
  'measure-variants.mjs BASELINE_PACKET VARIANT_PACKET NEW_OUTPUT'
);
const packets = {
  before: resolve(suppliedBefore),
  after: resolve(suppliedAfter),
};
const out = resolve(suppliedOut);
assert.ok(!existsSync(out), 'Preserve previous attempts');
mkdirSync(out, { recursive: true });
const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const sha = (path) =>
  createHash('sha256').update(readFileSync(path)).digest('hex');
const write = (name, value) =>
  writeFileSync(join(out, name), JSON.stringify(value, null, 2) + '\n', {
    flag: 'wx',
  });
const bindings = {
  [fileURLToPath(import.meta.url)]: sha(fileURLToPath(import.meta.url)),
};
const plans = {},
  builds = {};
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
const bind = (values) => {
  for (const [path, hash] of Object.entries(values)) {
    if (Object.hasOwn(bindings, path))
      assert.equal(bindings[path], hash, `Conflicting input ${path}`);
    bindings[path] = hash;
  }
};
const verify = () => {
  for (const [path, expected] of Object.entries(bindings))
    assert.equal(sha(path), expected, `Input drift ${path}`);
};
let arms;
try {
  for (const variant of ['before', 'after']) {
    const packet = packets[variant];
    const planPath = join(packet, 'plan.json');
    const buildPath = join(packet, 'build.json');
    const conformancePath = join(packet, 'inventory-conformance/results.json');
    const plan = (plans[variant] = read(planPath));
    const build = (builds[variant] = read(buildPath));
    const conformance = read(conformancePath);
    assert.equal(new Set(plan.arms).size, plan.arms.length);
    assert.ok(plan.arms.includes('v15'));
    assert.deepEqual(Object.keys(build.arms).sort(), [...plan.arms].sort());
    assert.equal(build.planSha256, sha(planPath));
    assert.equal(conformance.planSha256, build.planSha256);
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
      const results = conformance.results.filter(
        (result) => result.arm === arm
      );
      assert.deepEqual(
        results.map((result) => result.fault ?? 'baseline').sort(),
        ['baseline', ...faults].sort()
      );
      assert.ok(results.every((result) => result.passed === true));
    }
    bind({
      ...plan.inputs,
      [checker]: sha(checker),
      [planPath]: sha(planPath),
      [buildPath]: sha(buildPath),
      [conformancePath]: sha(conformancePath),
    });
    for (const arm of Object.values(build.arms))
      bind({ ...arm.dependencies, ...arm.served });
  }
  assert.deepEqual(plans.before.arms, plans.after.arms);
  assert.equal(plans.before.toolchainDirectory, plans.after.toolchainDirectory);
  assert.equal(
    plans.after.variant.baselinePlanSha256,
    sha(join(packets.before, 'plan.json'))
  );
  if (
    plans.after.variant.replacements.some(
      (item) => item.scenario === 'dispatch'
    )
  ) {
    const dispatchChecker = fileURLToPath(
      new URL('./dispatch-check.mjs', import.meta.url)
    );
    const dispatchFaults = [
      'drop-write',
      'stale-preview',
      'premature-publication',
      'clobber-other-field',
      'blanket-block',
      'stale-editor',
      'drop-reentry',
      'skip-destroy',
      'false-rejection',
      'stale-success',
    ];
    for (const variant of ['before', 'after']) {
      const buildPath = join(packets[variant], 'dispatch-build.json');
      const conformancePath = join(
        packets[variant],
        'dispatch-conformance/results.json'
      );
      const build = read(buildPath),
        conformance = read(conformancePath);
      assert.equal(build.planSha256, sha(join(packets[variant], 'plan.json')));
      assert.deepEqual(
        Object.keys(build.arms).sort(),
        [...plans[variant].arms].sort()
      );
      assert.equal(conformance.planSha256, build.planSha256);
      assert.equal(conformance.buildSha256, sha(buildPath));
      assert.equal(conformance.runnerSha256, sha(dispatchChecker));
      assert.deepEqual(
        Object.keys(conformance.controls).sort(),
        [...dispatchFaults].sort()
      );
      assert.equal(
        conformance.results.length,
        plans[variant].arms.length * (dispatchFaults.length + 1)
      );
      for (const arm of plans[variant].arms) {
        const results = conformance.results.filter(
          (result) => result.arm === arm
        );
        assert.deepEqual(
          results.map((result) => result.fault ?? 'baseline').sort(),
          ['baseline', ...dispatchFaults].sort()
        );
        assert.ok(results.every((result) => result.passed === true));
      }
      bind({
        [buildPath]: sha(buildPath),
        [conformancePath]: sha(conformancePath),
        [dispatchChecker]: sha(dispatchChecker),
      });
      for (const arm of Object.values(build.arms))
        bind({ ...arm.dependencies, ...arm.served });
    }
  }
  arms = plans.before.arms.filter((arm) =>
    plans.after.variant.replacements.some(
      (item) => item.arm === arm && item.scenario === 'inventory'
    )
  );
  assert.ok(arms.length > 0);
  for (const arm of plans.before.arms) {
    for (const relative of [
      'src/main.ts',
      'src/model.ts',
      'src/index.html',
      'src/arm.ts',
      'package.json',
      'tsconfig.json',
      'angular.json',
    ])
      assert.equal(
        sha(join(packets.before, arm, relative)),
        sha(join(packets.after, arm, relative)),
        `Common fixture changed: ${arm}/${relative}`
      );
  }
  for (const name of Object.keys(plans.before.artifacts))
    assert.equal(
      plans.before.artifacts[name].integrity,
      plans.after.artifacts[name].integrity,
      `Runtime archive changed: ${name}`
    );
  verify();
  write('preflight.json', { passed: true, packets, arms, bindings });
} catch (error) {
  write('preflight.json', { passed: false, error: String(error.stack) });
  throw error;
}
const { chromium } = createRequire(
  join(plans.before.toolchainDirectory, 'package.json')
)('playwright');
const profiles = [
  { rows: 1000, throttle: 1 },
  { rows: 1000, throttle: 4 },
  { rows: 10000, throttle: 1 },
];
const schedule = [];
for (const profile of profiles)
  for (let round = 0; round < 5; round++) {
    const order = arms.map((_, index) => arms[(index + round) % arms.length]);
    for (const arm of order)
      for (const variant of (round + arms.indexOf(arm)) % 2
        ? ['after', 'before']
        : ['before', 'after'])
        schedule.push({ ...profile, round, arm, variant, control: false });
    if (round < 2)
      for (const repeat of [0, 1])
        schedule.push({
          ...profile,
          round,
          arm: 'v15',
          variant: 'before',
          control: true,
          repeat,
        });
  }
write('schedule.json', {
  createdUTC: new Date().toISOString(),
  packets,
  arms,
  bindings,
  schedule,
  operationRoundsPerSample: 30,
  timedOperationsPerSample: { filter: 30, toggle: 30, membershipRename: 30 },
  timing:
    'Synthetic DOM event through Angular stable and forced layout; not INP. Includes initial iterations; no discarded warm-up.',
  host: {
    node: process.version,
    cpu: os.cpus()[0]?.model,
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
  },
  limits:
    'Separate matched before/after development cohort on a shared host. CDP throttle is not a device class. No population-tail, significance, library-only heap or human-productivity claim. Added membership rename trace means heap is not pooled with original baseline cohort.',
});
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
const browserPids = new Set();
try {
  for (let index = 0; index < schedule.length; index++) {
    const sample = schedule[index];
    directory = join(
      packets[sample.variant],
      sample.arm,
      'dist/inventory/browser'
    );
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
      assert.ok(
        !browserPids.has(result.process.browserPid),
        'Reused browser process identity'
      );
      browserPids.add(result.process.browserPid);
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
      // Membership-changing edit trace; input preparation is outside the timer.
      await page.evaluate(() =>
        window.lab.measure({ kind: 'filter', value: 'pump' })
      );
      await page.evaluate(() =>
        window.lab.measure({ kind: 'click', id: 'select-J-0' })
      );
      const membershipRename = [];
      for (let operation = 0; operation < 30; operation++) {
        const included = operation % 2 !== 0;
        const title = included ? 'Inspect pump 0' : 'Inspect valve changed';
        await page.getByTestId('rename-title').fill(title);
        await page.evaluate(() => window.lab.stable());
        membershipRename.push(
          await page.evaluate(() =>
            window.lab.measure({ kind: 'click', id: 'rename' })
          )
        );
        view = await readView();
        assert.equal(view.row.title, title);
        assert.equal(
          view.matched,
          Math.ceil(sample.rows / 3) - (included ? 0 : 1)
        );
        assert.deepEqual(
          view.ids,
          Array.from(
            { length: 40 },
            (_, i) => `J-${(i + (included ? 0 : 1)) * 3}`
          )
        );
        if (included)
          assert.equal(
            await page
              .locator('[data-job="J-0"] [data-field="title"]')
              .textContent()
              .then((text) => text?.trim()),
            title
          );
        else assert.equal(await page.locator('[data-job="J-0"]').count(), 0);
      }
      await page.evaluate(() =>
        window.lab.measure({ kind: 'filter', value: '' })
      );
      view = await readView();
      assert.equal(view.matched, sample.rows);
      assert.deepEqual(
        view.ids,
        Array.from({ length: 40 }, (_, i) => `J-${i}`)
      );
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
          membershipRename,
          filterP95: quantile(filter, 0.95),
          toggleP95: quantile(toggle, 0.95),
          membershipRenameP95: quantile(membershipRename, 0.95),
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
      join(
        out,
        `${String(index).padStart(3, '0')}-${sample.arm}-${sample.variant}.json`
      ),
      JSON.stringify(result, null, 2) + '\n',
      { flag: 'wx' }
    );
    console.log(
      index,
      sample.arm,
      sample.variant,
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
