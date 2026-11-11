#!/usr/bin/env node
// Supplemental application conformance, not a timing or heap experiment.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const [suppliedBase, suppliedVariant, suppliedOut] = process.argv.slice(2);
assert.ok(
  suppliedBase && suppliedVariant && suppliedOut && process.argv.length === 5,
  'publication-payload-check.mjs BASE_PACKET VARIANT_PACKET NEW_OUT'
);
const out = resolve(suppliedOut);
assert.ok(!existsSync(out), 'Preserve every prior attempt');
mkdirSync(out, { recursive: true });
const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const sha = (path) =>
  createHash('sha256').update(readFileSync(path)).digest('hex');
const write = (name, value) =>
  writeFileSync(join(out, name), JSON.stringify(value, null, 2) + '\n', {
    flag: 'wx',
  });
const runner = fileURLToPath(import.meta.url);
const checker = fileURLToPath(new URL('./dispatch-check.mjs', import.meta.url));
const controls = {
  'drop-write': 'overlap-proposals',
  'stale-preview': 'late-preview',
  'premature-publication': 'publish-held',
  'clobber-other-field': 'overlap-settle-first',
  'blanket-block': 'unrelated-progress',
  'stale-editor': 'retired-editor',
  'drop-reentry': 'reentrant-action',
  'skip-destroy': 'late-after-reset',
  'false-rejection': 'lost-ack-unknown',
  'stale-success': 'cas-stale-success',
};
const bindings = {};
function bind(path, expected) {
  assert.match(expected, /^[a-f0-9]{64}$/, `Missing file hash: ${path}`);
  if (Object.hasOwn(bindings, path))
    assert.equal(bindings[path], expected, `Conflicting binding: ${path}`);
  bindings[path] = expected;
}
function verify() {
  for (const [path, expected] of Object.entries(bindings))
    assert.equal(sha(path), expected, `Input drift: ${path}`);
}
let packets, chromium;
try {
  bind(runner, sha(runner));
  bind(checker, sha(checker));
  packets = [
    { label: 'baseline', path: resolve(suppliedBase) },
    { label: 'variant', path: resolve(suppliedVariant) },
  ];
  assert.notEqual(packets[0].path, packets[1].path);
  for (const packet of packets) {
    const planPath = join(packet.path, 'plan.json');
    const buildPath = join(packet.path, 'dispatch-build.json');
    const conformancePath = join(
      packet.path,
      'dispatch-conformance/results.json'
    );
    const plan = read(planPath),
      build = read(buildPath),
      conformance = read(conformancePath);
    assert.ok(Array.isArray(plan.arms) && plan.arms.includes('tanstack'));
    assert.equal(new Set(plan.arms).size, plan.arms.length);
    assert.deepEqual(Object.keys(build.arms).sort(), [...plan.arms].sort());
    assert.equal(build.planSha256, sha(planPath));
    assert.equal(conformance.planSha256, build.planSha256);
    assert.equal(conformance.buildSha256, sha(buildPath));
    assert.equal(conformance.runnerSha256, sha(checker));
    assert.deepEqual(conformance.controls, controls);
    assert.equal(conformance.results.length, plan.arms.length * 11);
    for (const arm of plan.arms) {
      const results = conformance.results.filter((entry) => entry.arm === arm);
      assert.deepEqual(
        results.map((entry) => entry.fault ?? 'baseline').sort(),
        ['baseline', ...Object.keys(controls)].sort()
      );
      for (const result of results) {
        assert.equal(
          result.passed,
          true,
          `${packet.label}/${arm}: full conformance first`
        );
        assert.ok(
          result.events.length > 0 &&
            result.events.every((event) => event.passed)
        );
        if (result.fault) {
          assert.equal(result.detectedAt, controls[result.fault]);
          assert.deepEqual(result.browserErrors, []);
        }
        const path = join(
          packet.path,
          'dispatch-conformance',
          `${arm}-${result.fault ?? 'baseline'}.json`
        );
        assert.deepEqual(
          read(path),
          result,
          'Conformance child and aggregate differ'
        );
        bind(path, sha(path));
      }
    }
    for (const [path, hash] of Object.entries(plan.inputs)) bind(path, hash);
    for (const arm of Object.values(build.arms))
      for (const collection of [arm.dependencies, arm.served])
        for (const [path, hash] of Object.entries(collection)) bind(path, hash);
    for (const path of [planPath, buildPath, conformancePath])
      bind(path, sha(path));
    packet.plan = plan;
    packet.directory = join(packet.path, 'tanstack/dist/dispatch/browser');
    packet.served = build.arms.tanstack.served;
    assert.ok(
      Object.hasOwn(packet.served, join(packet.directory, 'index.html'))
    );
  }
  assert.equal(
    packets[0].plan.toolchainDirectory,
    packets[1].plan.toolchainDirectory,
    'Use the same installed Playwright toolchain'
  );
  assert.equal(
    packets[1].plan.variant?.baselinePlanSha256,
    sha(join(packets[0].path, 'plan.json')),
    'Variant must identify this baseline'
  );
  assert.ok(
    packets[1].plan.variant.replacements.some(
      (replacement) =>
        replacement.arm === 'tanstack' &&
        replacement.scenario === 'dispatch' &&
        replacement.beforeSha256 !== replacement.afterSha256
    ),
    'Variant must include an identified TanStack dispatch source change'
  );
  const require = createRequire(
    join(packets[0].plan.toolchainDirectory, 'package.json')
  );
  bind(
    require.resolve('playwright/package.json'),
    sha(require.resolve('playwright/package.json'))
  );
  ({ chromium } = require('playwright'));
  verify();
  write('preflight.json', { passed: true, bindings });
} catch (error) {
  write('preflight.json', {
    passed: false,
    error: String(error.stack),
    bindings,
  });
  throw error;
}

const schedule = [];
for (const fault of [null, 'hide-public-payload'])
  for (const packet of packets)
    schedule.push({
      index: schedule.length,
      packet: packet.label,
      arm: 'tanstack',
      fault,
      processIdentity: randomUUID(),
    });
write('schedule.json', {
  command: [process.execPath, runner, ...process.argv.slice(2)],
  createdUTC: new Date().toISOString(),
  node: process.version,
  bindings,
  schedule,
  scope:
    '20-row supplemental TanStack publication exposure/detachment conformance for both identified packets. Fresh Chromium launch per case; no performance measurement.',
  control:
    'Harness-only snapshot wrapper omits public payload only after an actual transport start. It must fail the exact started-payload assertion. Shipping state, transport and sources are unchanged.',
  limits:
    'Public snapshot Object.isFrozen is not required. Held public references and current public values must remain detached from later accepted writes. Dismissal proves public removal, not private allocation reclamation. Existing full conformance remains required.',
});

let activePacket;
const server = createServer((req, res) => {
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, 'http://localhost').pathname
    );
    const path = resolve(
      activePacket.directory,
      '.' + (pathname === '/' ? '/index.html' : pathname)
    );
    if (
      !path.startsWith(activePacket.directory + sep) ||
      !Object.hasOwn(activePacket.served, path)
    ) {
      res.writeHead(404).end();
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
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
const results = [];
const browserPids = new Set();
const expectedRows = Array.from({ length: 20 }, (_, index) => ({
  id: `J-${index}`,
  instance: `initial-${index}`,
  title: `Inspect ${index % 3 === 0 ? 'pump' : 'valve'} ${index}`,
  owner: `Operator ${index % 10}`,
  status: 'queued',
  active: index % 2 === 0,
  ownerRevision: 10,
  statusRevision: 10,
}));
const expectedPlan = {
  kind: 'plan',
  rows: expectedRows.map((row, index) =>
    index ? row : { ...row, owner: 'Payload owner', ownerRevision: 11 }
  ),
  capacity: { instance: 'capacity-1', value: 4, revision: 10 },
};
const expectedProgress = {
  kind: 'progress',
  subject: 'J-0',
  instance: 'initial-0',
  status: 'done',
  statusRevision: 11,
};

async function check(sample, url) {
  activePacket = packets.find((packet) => packet.label === sample.packet);
  const result = { ...sample, passed: false, stages: [], browserErrors: [] };
  let browser,
    page,
    stage = 'input-verification',
    destroyed = false;
  const call = (method, ...args) =>
    page.evaluate(async ({ method, args }) => window.lab[method](...args), {
      method,
      args,
    });
  const snapshot = () => call('snapshot');
  const publication = (state, id) => {
    const values = state.publications.filter((item) => item.id === id);
    assert.equal(values.length, 1, `Exactly one public publication: ${id}`);
    return values[0];
  };
  const payload = (state, id, expectedState, expectedPayload) => {
    const starts = state.starts.filter((item) => item.id === id);
    assert.equal(starts.length, 1, `Actual transport start: ${id}`);
    assert.deepEqual(
      starts[0].payload,
      expectedPayload,
      `Transport payload: ${id}`
    );
    const value = publication(state, id);
    assert.equal(value.state, expectedState);
    assert.ok(Object.hasOwn(value, 'payload'), 'PUBLICATION_PAYLOAD_EXPOSURE');
    assert.deepEqual(
      value.payload,
      starts[0].payload,
      `Public payload equals transport: ${id}`
    );
  };
  const held = () =>
    page.evaluate(() =>
      Object.fromEntries(
        Object.entries(window.__publicationPayloadProbe.held).map(
          ([id, value]) => [id, value]
        )
      )
    );
  const retain = (id) =>
    page.evaluate((id) => {
      const publication = window.lab
        .snapshot()
        .publications.find((item) => item.id === id);
      if (!publication?.payload)
        throw new Error('Missing payload reference to retain');
      // Keep the actual in-page object, not a Playwright-serialized copy.
      window.__publicationPayloadProbe.held[id] = publication.payload;
    }, id);
  async function step(name, work) {
    stage = name;
    const evidence = await work();
    assert.deepEqual(result.browserErrors, [], 'No browser errors');
    result.stages.push({ name, passed: true, evidence });
  }
  try {
    verify();
    stage = 'bootstrap';
    browser = await chromium.launch({ headless: true });
    result.browserVersion = browser.version();
    const browserSession = await browser.newBrowserCDPSession();
    try {
      const processes = await browserSession.send('SystemInfo.getProcessInfo');
      const browserPid = processes.processInfo.find(
        (entry) => entry.type === 'browser'
      )?.id;
      result.process = {
        identity: sample.processIdentity,
        browserPid,
        browserVersion: result.browserVersion,
        harnessPid: process.pid,
      };
      assert.ok(
        Number.isSafeInteger(browserPid) && browserPid > 0,
        'Actual Chromium browser PID'
      );
      assert.ok(
        !browserPids.has(browserPid),
        'Fresh browser PID for every case'
      );
      browserPids.add(browserPid);
    } finally {
      await browserSession.detach();
    }
    page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on('pageerror', (error) => result.browserErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') result.browserErrors.push(message.text());
    });
    await page.goto(`${url}/?rows=20`);
    await page.waitForFunction(() => window.lab?.ready, undefined, {
      timeout: 20000,
    });
    await call('stable');
    await step('initial', async () => {
      const rows = await page.evaluate(() =>
        Array.from({ length: 20 }, (_, index) => window.lab.row(`J-${index}`))
      );
      assert.deepEqual(rows, expectedRows);
      const state = await snapshot();
      assert.deepEqual(state.operations, []);
      assert.deepEqual(state.publications, []);
      assert.deepEqual(state.starts, []);
      assert.equal(await page.locator('tbody tr').count(), 20);
      await page.evaluate((fault) => {
        window.__publicationPayloadProbe = { held: {}, activations: 0 };
        if (!fault) return;
        const original = window.lab.snapshot.bind(window.lab);
        window.lab.snapshot = () => {
          const state = original();
          return {
            ...state,
            publications: state.publications.map((publication) => {
              if (
                !state.starts.some((start) => start.id === publication.id) ||
                !Object.hasOwn(publication, 'payload')
              )
                return publication;
              window.__publicationPayloadProbe.activations++;
              const exposed = { ...publication };
              delete exposed.payload;
              return exposed;
            }),
          };
        };
      }, sample.fault);
      return { rows, state };
    });
    await step('waiting-payload', async () => {
      await call('reenter', 'payload-plan', 'payload-progress');
      await call('assign', 'J-0', 'owner', 'Payload owner', 'payload-owner');
      await call('publish', 'payload-plan', 'plan');
      const state = await snapshot();
      assert.equal(
        state.operations.find((item) => item.id === 'payload-owner').outcome,
        'pending'
      );
      assert.equal(publication(state, 'payload-plan').state, 'waiting');
      assert.deepEqual(publication(state, 'payload-plan').inputs, [
        'payload-owner',
      ]);
      assert.equal(publication(state, 'payload-plan').payload, undefined);
      assert.deepEqual(state.starts, []);
      return state;
    });
    await step('started-payload', async () => {
      await call('process', 'payload-owner', 'accept');
      const state = await snapshot();
      assert.deepEqual(state.publicationAttempts, ['payload-plan']);
      assert.equal(state.starts.length, 1);
      assert.equal(state.canonical.owner, 'Payload owner');
      assert.equal(state.canonical.status, 'queued');
      assert.equal(state.row.status, 'done');
      assert.deepEqual(
        state.requests.map((request) => request.id),
        ['payload-owner', 'payload-progress-edit']
      );
      assert.equal(state.requests[1].field, 'status');
      assert.equal(state.requests[1].value, 'done');
      assert.equal(
        state.operations.find((item) => item.id === 'payload-progress-edit')
          .outcome,
        'pending'
      );
      assert.equal(publication(state, 'payload-progress').state, 'waiting');
      assert.deepEqual(publication(state, 'payload-progress').inputs, [
        'payload-progress-edit',
      ]);
      payload(state, 'payload-plan', 'started', expectedPlan);
      await retain('payload-plan');
      return state;
    });
    await step('acknowledged-plan-payload', async () => {
      await call('acknowledge', 'payload-plan');
      const state = await snapshot();
      payload(state, 'payload-plan', 'acknowledged', expectedPlan);
      assert.deepEqual(state.acknowledged, ['payload-plan']);
      assert.equal(state.starts.length, 1);
      assert.deepEqual(await held(), { 'payload-plan': expectedPlan });
      return state;
    });
    await step('reentrant-progress-payload', async () => {
      await call('process', 'payload-progress-edit', 'accept');
      const state = await snapshot();
      assert.deepEqual(state.publicationAttempts, [
        'payload-plan',
        'payload-progress',
      ]);
      assert.equal(state.starts.length, 2);
      payload(state, 'payload-plan', 'acknowledged', expectedPlan);
      payload(state, 'payload-progress', 'started', expectedProgress);
      await retain('payload-progress');
      return state;
    });
    await step('acknowledged-progress-payload', async () => {
      await call('acknowledge', 'payload-progress');
      const state = await snapshot();
      payload(state, 'payload-plan', 'acknowledged', expectedPlan);
      payload(state, 'payload-progress', 'acknowledged', expectedProgress);
      assert.deepEqual(state.acknowledged, [
        'payload-plan',
        'payload-progress',
      ]);
      return state;
    });
    await step('detached-after-accepted-writes', async () => {
      await call('assign', 'J-0', 'owner', 'Later owner', 'later-owner');
      await call('process', 'later-owner', 'accept');
      await call('assign', 'J-0', 'status', 'active', 'later-status');
      await call('process', 'later-status', 'accept');
      const state = await snapshot();
      assert.equal(state.canonical.owner, 'Later owner');
      assert.equal(state.canonical.ownerRevision, 12);
      assert.equal(state.canonical.status, 'active');
      assert.equal(state.canonical.statusRevision, 12);
      assert.equal(state.applications.length, 4);
      assert.deepEqual(state.publicationAttempts, [
        'payload-plan',
        'payload-progress',
      ]);
      payload(state, 'payload-plan', 'acknowledged', expectedPlan);
      payload(state, 'payload-progress', 'acknowledged', expectedProgress);
      const references = await held();
      assert.deepEqual(references, {
        'payload-plan': expectedPlan,
        'payload-progress': expectedProgress,
      });
      return { state, retainedPublicReferences: references };
    });
    await step('dismissed-payload', async () => {
      await call('dismissSettled');
      const state = await snapshot();
      assert.deepEqual(state.publications, []);
      assert.deepEqual(state.operations, []);
      assert.equal(await page.locator('[data-publication]').count(), 0);
      assert.equal(await page.locator('[data-operation]').count(), 0);
      assert.deepEqual(state.starts, [
        { id: 'payload-plan', payload: expectedPlan },
        { id: 'payload-progress', payload: expectedProgress },
      ]);
      await page.evaluate(() => {
        window.__publicationPayloadProbe.held = {};
      });
      return state;
    });
    await step('pending-teardown', async () => {
      await call('assign', 'J-0', 'owner', 'Teardown owner', 'teardown-owner');
      await call('publish', 'teardown-plan', 'plan');
      const state = await snapshot();
      assert.equal(
        state.operations.find((item) => item.id === 'teardown-owner').outcome,
        'pending'
      );
      assert.equal(publication(state, 'teardown-plan').state, 'waiting');
      assert.equal(state.starts.length, 2);
      assert.equal(state.applications.length, 4);
      await call('destroyPending');
      destroyed = true;
      assert.equal(await page.locator('lab-dispatch main').count(), 0);
      return state;
    });
    await step('late-after-teardown', async () => {
      const delivery = await call('deliverRetired', 'teardown-owner');
      assert.deepEqual(delivery, {
        applications: 5,
        starts: 2,
        publicationAttempts: 2,
      });
      assert.equal(await page.locator('lab-dispatch main').count(), 0);
      return delivery;
    });
    assert.equal(
      sample.fault,
      null,
      'Oracle-sensitivity control was not detected'
    );
    result.passed = true;
  } catch (error) {
    result.detectedAt = stage;
    result.error = String(error.stack);
    if (page && !destroyed) {
      try {
        result.failureSnapshot = await snapshot();
      } catch (captureError) {
        result.captureError = String(captureError.stack);
      }
    }
    if (page) {
      try {
        result.faultActivations = await page.evaluate(
          () => window.__publicationPayloadProbe?.activations ?? 0
        );
      } catch {
        /* Browser failure is already recorded. */
      }
    }
    result.expectedOracleFailure = Boolean(
      sample.fault &&
        stage === 'started-payload' &&
        error.code === 'ERR_ASSERTION' &&
        error.message === 'PUBLICATION_PAYLOAD_EXPOSURE' &&
        result.faultActivations > 0 &&
        result.browserErrors.length === 0
    );
    result.passed = result.expectedOracleFailure;
    result.stages.push({
      name: stage,
      passed: false,
      expectedOracleFailure: result.expectedOracleFailure,
      error: result.error,
    });
  } finally {
    try {
      if (page && !destroyed) await call('destroy');
      if (page)
        assert.deepEqual(
          result.browserErrors,
          [],
          'No teardown browser errors'
        );
    } catch (error) {
      result.cleanupError = String(error.stack);
      result.passed = false;
    }
    try {
      await browser?.close();
    } catch (error) {
      result.browserCloseError = String(error.stack);
      result.passed = false;
    }
    try {
      verify();
    } catch (error) {
      result.bindingError = String(error.stack);
      result.passed = false;
    }
  }
  return result;
}

try {
  await new Promise((yes, no) => {
    server.once('error', no);
    server.listen(0, '127.0.0.1', yes);
  });
  const url = `http://127.0.0.1:${server.address().port}`;
  for (const sample of schedule) {
    const result = await check(sample, url);
    results.push(result);
    write(
      `${sample.index}-${sample.packet}-${sample.fault ?? 'baseline'}.json`,
      result
    );
    console.log(
      sample.packet,
      sample.fault ?? 'baseline',
      result.passed ? 'passed' : `FAILED at ${result.detectedAt}`
    );
    if (!result.passed) break;
  }
} catch (error) {
  write('runner-failure.json', { error: String(error.stack) });
  process.exitCode = 1;
} finally {
  if (server.listening) await new Promise((yes) => server.close(yes));
  const passed =
    results.length === schedule.length &&
    results.every((result) => result.passed) &&
    browserPids.size === schedule.length;
  write('results.json', {
    passed,
    scheduleSha256: sha(join(out, 'schedule.json')),
    bindings,
    results,
    receipts: Object.fromEntries(
      results.map((result) => {
        const path = join(
          out,
          `${result.index}-${result.packet}-${result.fault ?? 'baseline'}.json`
        );
        return [path, sha(path)];
      })
    ),
  });
  if (!passed) process.exitCode = 1;
}
