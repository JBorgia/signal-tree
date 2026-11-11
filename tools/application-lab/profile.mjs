#!/usr/bin/env node
// Attribution only. Instrumented browser task durations and sampled stacks must
// never be pooled with the uninstrumented comparative latency cohort.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { basename, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const [suppliedPacket, arm, scenario, suppliedOut, suppliedRows = '1000'] =
  process.argv.slice(2);
assert.ok(
  suppliedPacket && suppliedOut && ['inventory', 'dispatch'].includes(scenario)
);
const packet = resolve(suppliedPacket),
  out = resolve(suppliedOut),
  rows = Number(suppliedRows);
assert.ok(Number.isSafeInteger(rows) && rows >= 40);
assert.ok(!existsSync(out));
mkdirSync(out, { recursive: true });
const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const sha = (path) =>
  createHash('sha256').update(readFileSync(path)).digest('hex');
const planPath = join(packet, 'plan.json');
const buildPath = join(
  packet,
  scenario === 'inventory' ? 'build.json' : 'dispatch-build.json'
);
const conformancePath = join(packet, scenario + '-conformance/results.json');
const checker = fileURLToPath(
  new URL(`./${scenario}-check.mjs`, import.meta.url)
);
const faults =
  scenario === 'inventory'
    ? [
        'drop-filter',
        'stale-count',
        'invalid-add',
        'stale-editor',
        'skip-destroy',
      ]
    : [
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
let plan, build, bindings;
try {
  plan = read(planPath);
  build = read(buildPath);
  const qualified = read(conformancePath);
  assert.equal(new Set(plan.arms).size, plan.arms.length);
  assert.ok(plan.arms.includes(arm));
  assert.deepEqual(Object.keys(build.arms).sort(), [...plan.arms].sort());
  assert.equal(build.planSha256, sha(planPath));
  assert.equal(qualified.planSha256, build.planSha256);
  assert.equal(qualified.buildSha256, sha(buildPath));
  assert.equal(qualified.runnerSha256, sha(checker));
  assert.deepEqual(Object.keys(qualified.controls).sort(), [...faults].sort());
  assert.equal(
    qualified.results.length,
    plan.arms.length * (faults.length + 1)
  );
  for (const candidateArm of plan.arms) {
    const results = qualified.results.filter(
      (item) => item.arm === candidateArm
    );
    assert.deepEqual(
      results.map((item) => item.fault ?? 'baseline').sort(),
      ['baseline', ...faults].sort()
    );
    assert.ok(results.every((item) => item.passed === true));
  }
  bindings = {
    ...plan.inputs,
    ...build.arms[arm].dependencies,
    ...build.arms[arm].served,
    [fileURLToPath(import.meta.url)]: sha(fileURLToPath(import.meta.url)),
    [planPath]: sha(planPath),
    [buildPath]: sha(buildPath),
    [checker]: sha(checker),
    [conformancePath]: sha(conformancePath),
  };
  for (const [path, expected] of Object.entries(bindings))
    assert.equal(sha(path), expected, `Input drift: ${path}`);
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
    assert.equal(sha(path), expected, `Input drift: ${path}`);
};
verify();
const require = createRequire(join(plan.toolchainDirectory, 'package.json'));
let chromium, TraceMap, originalPositionFor;
const directory = join(packet, arm, 'dist', scenario, 'browser');
const server = createServer((request, response) => {
  const path = resolve(
    directory,
    '.' +
      (new URL(request.url, 'http://localhost').pathname === '/'
        ? '/index.html'
        : new URL(request.url, 'http://localhost').pathname)
  );
  if (!path.startsWith(directory + sep)) {
    response.writeHead(403).end();
    return;
  }
  try {
    response.setHeader(
      'Content-Type',
      path.endsWith('.js') ? 'text/javascript' : 'text/html'
    );
    response.end(readFileSync(path));
  } catch {
    response.writeHead(404).end();
  }
});
try {
  ({ chromium } = require('playwright'));
  ({ TraceMap, originalPositionFor } = require('@jridgewell/trace-mapping'));
  await new Promise((yes, no) => {
    server.once('error', no);
    server.listen(0, '127.0.0.1', yes);
  });
} catch (error) {
  writeFileSync(
    join(out, 'initialization.json'),
    JSON.stringify({ passed: false, error: String(error.stack) }, null, 2) +
      '\n',
    { flag: 'wx' }
  );
  throw error;
}
const url = `http://127.0.0.1:${server.address().port}`;
const result = {
  arm,
  scenario,
  rows,
  bindings,
  stages: [],
  failures: [],
  browserErrors: [],
  performanceTimeDomain: 'timeTicks',
  samplingIntervalMicroseconds: 1000,
  limits:
    'Separate instrumented attribution run, 1 ms sampling. Task/Script durations are Chromium metrics, not OS process CPU or uninstrumented comparative latency. Task, script, layout and style overlap; never sum them. Profiles include fixture checks and browser protocol evaluation. Hidden source maps identify sampled functions, not precise executed source-line cost, and are bound build outputs.',
};
let browser;
try {
  browser = await chromium.launch({ headless: true });
  result.browser = browser.version();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  page.on('pageerror', (error) => result.browserErrors.push(error.message));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Performance.enable', {
    timeDomain: result.performanceTimeDomain,
  });
  await cdp.send('Profiler.setSamplingInterval', { interval: 1000 });
  const call = (method, ...args) =>
    page.evaluate(({ method, args }) => window.lab[method](...args), {
      method,
      args,
    });
  const metricNames = [
    'TaskDuration',
    'ScriptDuration',
    'LayoutDuration',
    'RecalcStyleDuration',
  ];
  const metrics = async () => {
    const values = Object.fromEntries(
      (await cdp.send('Performance.getMetrics')).metrics
        .filter((metric) => metricNames.includes(metric.name))
        .map((metric) => [metric.name, metric.value])
    );
    for (const name of metricNames)
      assert.ok(
        Number.isFinite(values[name]) && values[name] >= 0,
        `Missing/invalid metric: ${name}`
      );
    return values;
  };
  const maps = new Map();
  function mapped(frame) {
    let path;
    try {
      path = join(directory, basename(new URL(frame.url).pathname) + '.map');
    } catch {
      return null;
    }
    if (!existsSync(path)) return null;
    if (!maps.has(path)) maps.set(path, new TraceMap(read(path)));
    return originalPositionFor(maps.get(path), {
      line: frame.lineNumber + 1,
      column: frame.columnNumber,
    });
  }
  async function profile(name, work) {
    const before = await metrics();
    await cdp.send('Profiler.start');
    let failed;
    try {
      await work();
    } catch (error) {
      failed = error;
    }
    const { profile } = await cdp.send('Profiler.stop');
    const after = await metrics();
    writeFileSync(join(out, name + '.cpuprofile'), JSON.stringify(profile), {
      flag: 'wx',
    });
    const nodes = new Map(profile.nodes.map((node) => [node.id, node]));
    const self = new Map();
    const coverage = {
      totalSamples: profile.samples?.length ?? 0,
      sourceMappedSamples: 0,
      idleSamples: 0,
      gcSamples: 0,
      unmappedSamples: 0,
    };
    for (let index = 0; index < (profile.samples?.length ?? 0); index++) {
      const id = profile.samples[index],
        delta = profile.timeDeltas?.[index];
      assert.ok(
        Number.isFinite(delta) && delta >= 0,
        'Missing/invalid sample timestamp delta'
      );
      self.set(id, (self.get(id) ?? 0) + delta);
      const frame = nodes.get(id).callFrame;
      if (frame.functionName === '(idle)') coverage.idleSamples++;
      else if (frame.functionName === '(garbage collector)')
        coverage.gcSamples++;
      else if (mapped(frame)?.source) coverage.sourceMappedSamples++;
      else coverage.unmappedSamples++;
    }
    const metricDeltasSeconds = Object.fromEntries(
      Object.entries(after).map(([key, value]) => [key, value - before[key]])
    );
    for (const [name, value] of Object.entries(metricDeltasSeconds))
      assert.ok(Number.isFinite(value) && value >= 0, `Invalid delta: ${name}`);
    result.stages.push({
      name,
      passed: !failed,
      metricsBefore: before,
      metricsAfter: after,
      metricDeltasSeconds,
      coverage,
      attributionStatus:
        coverage.sourceMappedSamples === 0
          ? 'insufficient: no mapped application/library samples'
          : 'sampled hints only; inspect counts and raw stacks before attribution',
      weightedSampledElapsedMicroseconds: [...self.values()].reduce(
        (a, b) => a + b,
        0
      ),
      sampleWeightMeaning:
        'Intervals between adjacent sample timestamps, including idle/GC/protocol; not measured per-function CPU time. Zero samples is not zero cost.',
      hottestSampledFrames: [...self]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 30)
        .map(([id, microseconds]) => ({
          weightedSampledElapsedMicroseconds: microseconds,
          frame: nodes.get(id).callFrame,
          source: mapped(nodes.get(id).callFrame),
        })),
    });
    if (failed) throw failed;
  }
  await profile('startup', async () => {
    await page.goto(`${url}/?rows=${rows}`);
    await page.waitForFunction(() => window.lab?.ready, undefined, {
      timeout: 45000,
    });
    await call('stable');
    assert.equal(await page.locator('tbody tr').count(), 40);
  });
  if (scenario === 'inventory') {
    await profile('filter-and-render', async () => {
      for (let i = 0; i < 100; i++) {
        await call('measure', { kind: 'filter', value: i % 2 ? '' : 'pump' });
        assert.equal(
          Number(
            await page
              .getByTestId('matched')
              .textContent()
              .then((value) => value?.trim() ?? null)
          ),
          i % 2 ? rows : Math.ceil(rows / 3)
        );
      }
    });
    await profile('point-and-render', async () => {
      for (let i = 0; i < 100; i++) {
        await call('measure', { kind: 'click', id: 'toggle-J-0' });
        assert.equal((await call('row', 'J-0')).active, i % 2 !== 0);
        assert.equal(
          await page
            .getByTestId('toggle-J-0')
            .textContent()
            .then((value) => value?.trim() ?? null),
          i % 2 !== 0 ? 'Active' : 'Inactive'
        );
      }
    });
  } else {
    async function checkedState(
      status,
      owner,
      outcomes,
      publicationState,
      previewPending
    ) {
      const s = await call('snapshot');
      assert.equal(s.row.status, status);
      assert.equal(s.row.owner, owner);
      assert.deepEqual(
        s.operations.map(({ id, outcome }) => ({ id, outcome })),
        outcomes.map(([id, outcome]) => ({ id, outcome }))
      );
      assert.deepEqual(
        s.publications.map(({ id, state }) => ({ id, state })),
        publicationState
          ? [{ id: 'profile-plan', state: publicationState }]
          : []
      );
      const dom = await page.evaluate(() => {
        const text = (selector) =>
          document.querySelector(selector)?.textContent?.trim() ?? null;
        return {
          owner: text('[data-job="J-0"] [data-field="owner"]'),
          status: text('[data-job="J-0"] [data-field="status"]'),
          operations: [...document.querySelectorAll('[data-operation]')].map(
            (node) => ({
              id: node.getAttribute('data-operation'),
              outcome: node
                .querySelector('[data-field="outcome"]')
                .textContent?.trim(),
            })
          ),
          publications: [
            ...document.querySelectorAll('[data-publication]'),
          ].map((node) => ({
            id: node.getAttribute('data-publication'),
            state: node
              .querySelector('[data-field="state"]')
              .textContent?.trim(),
          })),
          previewOwner: text('[data-testid="preview-owner"]'),
          previewStatus: text('[data-testid="preview-status"]'),
          previewPending: text('[data-testid="preview-pending"]'),
          previewCount: text('[data-testid="preview-count"]'),
        };
      });
      assert.equal(dom.owner, owner);
      assert.equal(dom.status, status);
      assert.deepEqual(
        dom.operations,
        s.operations.map(({ id, outcome }) => ({ id, outcome }))
      );
      assert.deepEqual(
        dom.publications,
        s.publications.map(({ id, state }) => ({ id, state }))
      );
      if (previewPending === undefined) {
        assert.equal(s.preview, null);
        assert.equal(dom.previewPending, null);
      } else {
        assert.equal(s.preview.pending, previewPending);
        assert.equal(s.preview.rows.length, rows);
        assert.equal(s.preview.rows[0].owner, owner);
        assert.equal(s.preview.rows[0].status, status);
        assert.equal(dom.previewOwner, owner);
        assert.equal(dom.previewStatus, status);
        assert.equal(dom.previewPending, String(previewPending));
        assert.equal(dom.previewCount, String(rows));
      }
      return s;
    }
    await page.getByTestId('command-id').fill('profile-A');
    await page.getByTestId('status-input').selectOption('active');
    await call('stable');
    await profile('proposal-status-and-render', () =>
      call('measure', { kind: 'click', id: 'assign-status' })
    );
    await checkedState('active', 'Operator 0', [['profile-A', 'pending']]);
    await page.getByTestId('command-id').fill('profile-B');
    await page.getByTestId('owner-input').fill('Profile owner');
    await call('stable');
    await profile('proposal-owner-and-render', () =>
      call('measure', { kind: 'click', id: 'assign-owner' })
    );
    await checkedState('active', 'Profile owner', [
      ['profile-A', 'pending'],
      ['profile-B', 'pending'],
    ]);
    await profile('late-preview-and-render', () =>
      call('measure', { kind: 'click', id: 'open-preview' })
    );
    await checkedState(
      'active',
      'Profile owner',
      [
        ['profile-A', 'pending'],
        ['profile-B', 'pending'],
      ],
      undefined,
      2
    );
    await page.getByTestId('intent-id').fill('profile-plan');
    await call('stable');
    await profile('capture-publication-inputs', () =>
      call('measure', { kind: 'click', id: 'publish-plan' })
    );
    await checkedState(
      'active',
      'Profile owner',
      [
        ['profile-A', 'pending'],
        ['profile-B', 'pending'],
      ],
      'waiting',
      2
    );
    assert.equal((await call('snapshot')).starts.length, 0);
    await profile('reject-and-render', () =>
      call('measure', { kind: 'response', id: 'profile-A', verdict: 'reject' })
    );
    await checkedState(
      'queued',
      'Profile owner',
      [
        ['profile-A', 'rejected'],
        ['profile-B', 'pending'],
      ],
      'waiting',
      1
    );
    await profile('accept-prepare-publish-and-render', () =>
      call('measure', { kind: 'response', id: 'profile-B', verdict: 'accept' })
    );
    const s = await checkedState(
      'queued',
      'Profile owner',
      [
        ['profile-A', 'rejected'],
        ['profile-B', 'applied'],
      ],
      'started',
      0
    );
    assert.equal(s.starts.length, 1);
    assert.equal(s.starts[0].payload.rows.length, rows);
    await profile('acknowledgement-and-render', () =>
      call('measure', { kind: 'ack', id: 'profile-plan' })
    );
    await checkedState(
      'queued',
      'Profile owner',
      [
        ['profile-A', 'rejected'],
        ['profile-B', 'applied'],
      ],
      'acknowledged',
      0
    );
  }
  await call('destroy');
  assert.equal(await page.locator('main').count(), 0);
  assert.deepEqual(result.browserErrors, []);
} catch (error) {
  result.failures.push(String(error.stack));
} finally {
  try {
    await browser?.close();
  } catch (error) {
    result.failures.push(String(error.stack));
  }
  await new Promise((yes) => server.close(yes));
  try {
    verify();
  } catch (error) {
    result.failures.push(String(error.stack));
  }
  result.passed = result.failures.length === 0;
  writeFileSync(
    join(out, 'result.json'),
    JSON.stringify(result, null, 2) + '\n',
    { flag: 'wx' }
  );
}
if (!result.passed) process.exitCode = 1;
