#!/usr/bin/env node
// Distinct diagnostic: destroy while eight publication payloads remain unacknowledged.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import os from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const [suppliedBefore, suppliedAfter, suppliedOut, suppliedLifecycle] =
  process.argv.slice(2);
assert.ok(
  suppliedBefore &&
    suppliedAfter &&
    suppliedOut &&
    suppliedLifecycle &&
    process.argv.length === 6,
  'started-payload-teardown.mjs BASE_PACKET VARIANT_PACKET NEW_OUT PUBLICATION_LIFECYCLE_DIR'
);
const out = resolve(suppliedOut),
  lifecycle = resolve(suppliedLifecycle);
assert.ok(!existsSync(out), 'Preserve previous attempts');
mkdirSync(out, { recursive: true });
const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const sha = (path) =>
  createHash('sha256').update(readFileSync(path)).digest('hex');
const write = (name, value) => {
  const path = join(out, name);
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  return { path, sha256: sha(path) };
};
const runner = fileURLToPath(import.meta.url);
const protocol = fileURLToPath(
  new URL(
    '../../docs/audits/2026-11-11-application-comparison/STARTED-TEARDOWN.md',
    import.meta.url
  )
);
const bindings = {};
function bind(path, expected) {
  assert.match(expected, /^[a-f0-9]{64}$/, `Missing hash: ${path}`);
  if (Object.hasOwn(bindings, path))
    assert.equal(bindings[path], expected, `Conflicting binding: ${path}`);
  bindings[path] = expected;
}
function bindMap(map) {
  for (const [path, hash] of Object.entries(map)) bind(path, hash);
}
function verify() {
  for (const [path, hash] of Object.entries(bindings))
    assert.equal(sha(path), hash, `Input drift: ${path}`);
}
const packets = [
  { variant: 'before', path: resolve(suppliedBefore) },
  { variant: 'after', path: resolve(suppliedAfter) },
];
let chromium;
try {
  assert.notEqual(packets[0].path, packets[1].path);
  const resultsPath = join(lifecycle, 'results.json'),
    schedulePath = join(lifecycle, 'schedule.json'),
    preflightPath = join(lifecycle, 'preflight.json');
  const previous = read(resultsPath),
    scheduled = read(schedulePath),
    preflight = read(preflightPath);
  assert.equal(previous.passed, true);
  assert.equal(previous.mode, 'publication-payloads');
  assert.equal(scheduled.mode, previous.mode);
  assert.equal(preflight.mode, previous.mode);
  assert.equal(preflight.passed, true);
  assert.equal(previous.scheduleSha256, sha(schedulePath));
  assert.deepEqual(previous.bindings, scheduled.bindings);
  assert.deepEqual(previous.bindings, preflight.bindings);
  assert.deepEqual(
    scheduled.packets,
    Object.fromEntries(packets.map((packet) => [packet.variant, packet.path]))
  );
  assert.equal(previous.results.length, 12);
  assert.equal(scheduled.schedule.length, 12);
  const priorPids = new Set(),
    priorIdentities = new Set();
  let index = 0;
  for (const rows of [1000, 10000])
    for (let round = 0; round < 3; round++)
      for (const variant of round % 2
        ? ['after', 'before']
        : ['before', 'after']) {
        const sample = scheduled.schedule[index],
          result = previous.results[index];
        assert.deepEqual(sample, {
          index,
          mode: 'publication-payloads',
          arm: 'tanstack',
          rows,
          round,
          variant,
          processIdentity: sample.processIdentity,
        });
        for (const [key, value] of Object.entries(sample))
          assert.equal(result[key], value);
        assert.equal(result.passed, true);
        assert.deepEqual(result.browserErrors, []);
        assert.ok(!result.error && !result.finalizationErrors);
        assert.equal(result.process.identity, sample.processIdentity);
        assert.ok(
          Number.isSafeInteger(result.process.browserPid) &&
            result.process.browserPid > 0
        );
        assert.ok(
          !priorPids.has(result.process.browserPid) &&
            !priorIdentities.has(sample.processIdentity)
        );
        priorPids.add(result.process.browserPid);
        priorIdentities.add(sample.processIdentity);
        const { receipt, ...raw } = result;
        assert.deepEqual(read(receipt.path), raw);
        assert.equal(previous.receipts[receipt.path], receipt.sha256);
        bind(receipt.path, receipt.sha256);
        assert.ok(
          result.stages.length >= 22 &&
            result.stages.every((step) => step.passed)
        );
        for (const required of [
          '8-total-started-held',
          '8-total-acknowledged',
          '8-total-pruned',
          '16-total-started-held',
          '16-total-acknowledged',
          '16-total-pruned',
          'before-pending-teardown',
          'after-destroy-before-late',
          'after-destroy-after-late',
        ])
          assert.equal(
            result.stages.filter((step) => step.name === required).length,
            1
          );
        for (const step of result.stages) {
          assert.equal(result.receipts[step.receipt.path], step.receipt.sha256);
          const stage = read(step.receipt.path);
          assert.deepEqual(stage.sample, sample);
          assert.equal(stage.stage, step.name);
          assert.equal(stage.passed, true);
        }
        bindMap(result.receipts);
        index++;
      }
  bindMap(previous.bindings);
  bindMap(previous.receipts);
  for (const path of [
    resultsPath,
    schedulePath,
    preflightPath,
    runner,
    protocol,
  ])
    bind(path, sha(path));
  const lifecycleRunner = fileURLToPath(
    new URL('./lifecycle-followup.mjs', import.meta.url)
  );
  assert.equal(previous.bindings[lifecycleRunner], sha(lifecycleRunner));
  const checker = fileURLToPath(
    new URL('./dispatch-check.mjs', import.meta.url)
  );
  const faults = [
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
  for (const packet of packets) {
    const planPath = join(packet.path, 'plan.json'),
      buildPath = join(packet.path, 'dispatch-build.json'),
      conformancePath = join(packet.path, 'dispatch-conformance/results.json');
    const plan = read(planPath),
      build = read(buildPath),
      conformance = read(conformancePath);
    for (const path of [planPath, buildPath, conformancePath])
      assert.equal(previous.bindings[path], sha(path));
    assert.equal(build.planSha256, sha(planPath));
    assert.equal(conformance.planSha256, build.planSha256);
    assert.equal(conformance.buildSha256, sha(buildPath));
    assert.equal(conformance.runnerSha256, sha(checker));
    assert.deepEqual(Object.keys(build.arms).sort(), [...plan.arms].sort());
    assert.deepEqual(
      Object.keys(conformance.controls).sort(),
      [...faults].sort()
    );
    assert.equal(conformance.results.length, plan.arms.length * 11);
    for (const arm of plan.arms) {
      const admitted = conformance.results.filter((entry) => entry.arm === arm);
      assert.deepEqual(
        admitted.map((entry) => entry.fault ?? 'baseline').sort(),
        ['baseline', ...faults].sort()
      );
      assert.ok(admitted.every((entry) => entry.passed));
    }
    for (const [path, hash] of Object.entries(plan.inputs))
      assert.equal(previous.bindings[path], hash);
    for (const arm of Object.values(build.arms))
      for (const map of [arm.dependencies, arm.served])
        for (const [path, hash] of Object.entries(map))
          assert.equal(previous.bindings[path], hash);
    packet.plan = plan;
    packet.served = build.arms.tanstack.served;
    packet.directory = join(packet.path, 'tanstack/dist/dispatch/browser');
    assert.ok(
      Object.hasOwn(packet.served, join(packet.directory, 'index.html'))
    );
  }
  assert.equal(
    packets[0].plan.toolchainDirectory,
    packets[1].plan.toolchainDirectory
  );
  assert.equal(
    packets[1].plan.variant.baselinePlanSha256,
    sha(join(packets[0].path, 'plan.json'))
  );
  const payloadDirectory = scheduled.command[6];
  assert.ok(
    payloadDirectory,
    'Completed lifecycle must include payload exposure admission'
  );
  const proofPath = join(payloadDirectory, 'results.json'),
    proof = read(proofPath);
  assert.equal(previous.bindings[proofPath], sha(proofPath));
  assert.equal(proof.passed, true);
  assert.equal(proof.results.length, 4);
  assert.ok(proof.results.every((entry) => entry.passed));
  for (const map of [proof.bindings, proof.receipts])
    for (const [path, hash] of Object.entries(map))
      assert.equal(previous.bindings[path], hash);
  const require = createRequire(
    join(packets[0].plan.toolchainDirectory, 'package.json')
  );
  ({ chromium } = require('playwright'));
  for (const module of Object.values(require.cache))
    if (module.filename) bind(module.filename, sha(module.filename));
  verify();
  write('preflight.json', {
    passed: true,
    bindings,
    publicationLifecycle: { path: resultsPath, sha256: sha(resultsPath) },
  });
} catch (error) {
  write('preflight.json', {
    passed: false,
    error: String(error.stack),
    bindings,
  });
  throw error;
}

const schedule = [];
for (const rows of [1000, 10000])
  for (let round = 0; round < 3; round++)
    for (const variant of round % 2 ? ['after', 'before'] : ['before', 'after'])
      schedule.push({
        index: schedule.length,
        rows,
        round,
        variant,
        arm: 'tanstack',
        processIdentity: randomUUID(),
      });
const limits = [
  'Memory/lifetime diagnostic only; three pairs per size, no A/A, timing, significance, byte threshold or universal leak claim.',
  'Eight full plans remain started and unacknowledged at destruction. A ninth intent waits for one owner command; its late delivery must produce one backend application and no ninth publication.',
  'Only weak references and primitive digests/labels persist in the probe. Whole heap includes those diagnostic objects and the backend, including eight common payload copies, until the backend reference is released.',
  'Weak-reference liveness follows three forced collections with host-task boundaries. Heap is read immediately before liveness inspection. Current getter reads can materialize objects; public identities do not measure all internal allocations.',
  'Late command response is tested while acknowledgements remain outstanding. No late acknowledgement is delivered because the frozen bridge has no retired-acknowledgement API.',
  'Final sampled survivors trigger one heap snapshot per child for retaining-path attribution. Survival alone is not a leak verdict. A 512MiB snapshot cap and bounded stage/cleanup waits are execution limits, not acceptance budgets.',
];
write('schedule.json', {
  createdUTC: new Date().toISOString(),
  command: [process.execPath, runner, ...process.argv.slice(2)],
  packets: Object.fromEntries(
    packets.map((packet) => [packet.variant, packet.path])
  ),
  bindings,
  schedule,
  host: {
    node: process.version,
    cpu: os.cpus()[0]?.model,
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
  },
  limits,
});
let activePacket;
const server = createServer((req, res) => {
  try {
    const name = decodeURIComponent(
      new URL(req.url, 'http://localhost').pathname
    );
    const path = resolve(
      activePacket.directory,
      '.' + (name === '/' ? '/index.html' : name)
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
const bounded = (work, label, milliseconds = 300000) => {
  let timer;
  return Promise.race([
    work,
    new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`Diagnostic timeout: ${label}`)),
        milliseconds
      );
    }),
  ]).finally(() => clearTimeout(timer));
};
const results = [],
  browserPids = new Set();

async function installProbe(page, rows) {
  await page.evaluate((rows) => {
    const ensure = (value, message) => {
      if (!value) throw new Error(message);
    };
    const equal = (a, b, message) =>
      ensure(JSON.stringify(a) === JSON.stringify(b), message);
    const refs = [],
      seen = new WeakMap(),
      digests = new Map();
    const ids = Array.from({ length: 8 }, (_, index) => `held-plan-${index}`);
    const digest = async (text) =>
      Array.from(
        new Uint8Array(
          await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
        ),
        (value) => value.toString(16).padStart(2, '0')
      ).join('');
    const payloadText = (payload) => {
      equal(
        Object.keys(payload).sort(),
        ['capacity', 'kind', 'rows'],
        'Exact plan envelope'
      );
      equal(
        Object.keys(payload.capacity).sort(),
        ['instance', 'revision', 'value'],
        'Exact capacity envelope'
      );
      ensure(
        payload.kind === 'plan' && payload.rows.length === rows,
        'Complete full plan'
      );
      equal(
        [
          payload.capacity.instance,
          payload.capacity.value,
          payload.capacity.revision,
        ],
        ['capacity-1', 4, 10],
        'Canonical capacity'
      );
      const values = payload.rows.map((row, index) => {
        equal(
          Object.keys(row).sort(),
          [
            'active',
            'id',
            'instance',
            'owner',
            'ownerRevision',
            'status',
            'statusRevision',
            'title',
          ],
          'Exact job envelope'
        );
        const actual = [
          row.id,
          row.instance,
          row.title,
          row.owner,
          row.status,
          row.active,
          row.ownerRevision,
          row.statusRevision,
        ];
        equal(
          actual,
          [
            `J-${index}`,
            `initial-${index}`,
            `Inspect ${index % 3 === 0 ? 'pump' : 'valve'} ${index}`,
            `Operator ${index % 10}`,
            'queued',
            index % 2 === 0,
            10,
            10,
          ],
          `Original canonical plan row ${index}`
        );
        return actual;
      });
      return JSON.stringify([values, ['capacity-1', 4, 10]]);
    };
    const track = (value, id, phase) => {
      ensure(
        value && typeof value === 'object',
        'Actual public payload object'
      );
      if (!seen.has(value)) {
        const entry = { key: refs.length, id, phase, ref: new WeakRef(value) };
        refs.push(entry);
        seen.set(value, entry);
      }
    };
    const verifyActive = async (pending) => {
      const state = window.lab.snapshot();
      equal(
        state.starts.map((entry) => entry.id),
        ids,
        'Eight actual starts'
      );
      equal(state.publicationAttempts, ids, 'Eight actual transport attempts');
      equal(state.acknowledged, [], 'No acknowledgements delivered');
      equal(
        state.applications,
        [],
        'No owner command applied before retirement'
      );
      equal(
        state.publications.map((entry) => entry.id),
        pending ? [...ids, 'waiting-plan'] : ids,
        'Active public intents'
      );
      ensure(state.operations.length === (pending ? 1 : 0), 'Operation count');
      ensure(
        state.requests.length === (pending ? 1 : 0),
        'Actual owner request count'
      );
      for (const id of ids) {
        const publication = state.publications.find((entry) => entry.id === id),
          start = state.starts.find((entry) => entry.id === id);
        ensure(
          publication.state === 'started' &&
            Object.hasOwn(publication, 'payload'),
          'Started public payload exposed'
        );
        const text = payloadText(start.payload);
        ensure(
          payloadText(publication.payload) === text,
          'Full public/transport equality'
        );
        ensure(
          (await digest(text)) === digests.get(id),
          'Original plan digest remains unchanged'
        );
        track(publication.payload, id, pending ? 'pending-owner' : 'started');
        ensure(
          document
            .querySelector(`[data-publication="${id}"] [data-field="state"]`)
            .textContent.trim() === 'started',
          'Started intent rendered'
        );
      }
      ensure(
        state.canonical.owner === 'Operator 0' &&
          state.canonical.ownerRevision === 10,
        'Canonical owner remains original'
      );
      if (pending) {
        const publication = state.publications.find(
            (entry) => entry.id === 'waiting-plan'
          ),
          operation = state.operations[0];
        ensure(
          publication.state === 'waiting' && publication.payload === undefined,
          'Ninth plan waits without payload'
        );
        equal(
          publication.inputs,
          ['retired-owner'],
          'Ninth plan captured owner command'
        );
        ensure(
          operation.id === 'retired-owner' && operation.outcome === 'pending',
          'Unresolved owner operation'
        );
        ensure(
          state.row.owner === 'Pending owner after plans',
          'Optimistic owner remains visible'
        );
        ensure(
          document
            .querySelector(
              '[data-publication="waiting-plan"] [data-field="state"]'
            )
            .textContent.trim() === 'waiting',
          'Waiting intent rendered'
        );
      } else
        ensure(state.row.owner === 'Operator 0', 'Original owner presentation');
      ensure(
        document.querySelectorAll('[data-publication]').length ===
          (pending ? 9 : 8),
        'Rendered active intent count'
      );
      return {
        started: 8,
        waiting: pending ? 1 : 0,
        starts: 8,
        attempts: 8,
        acknowledgements: 0,
        applications: 0,
        pendingOperations: pending ? 1 : 0,
        canonicalOwner: state.canonical.owner,
        projectedOwner: state.row.owner,
        payloadDigests: Object.fromEntries(digests),
      };
    };
    window.__startedTeardownProbe = {
      async start() {
        for (const id of ids) {
          await window.lab.publish(id, 'plan');
          const state = window.lab.snapshot(),
            publication = state.publications.find((entry) => entry.id === id),
            start = state.starts.find((entry) => entry.id === id);
          ensure(
            publication?.state === 'started' && start,
            'Actual held plan start'
          );
          const text = payloadText(start.payload);
          ensure(
            payloadText(publication.payload) === text,
            'Initial public payload equality'
          );
          digests.set(id, await digest(text));
          track(publication.payload, id, 'start-observation');
        }
        return verifyActive(false);
      },
      async pending() {
        await window.lab.assign(
          'J-0',
          'owner',
          'Pending owner after plans',
          'retired-owner'
        );
        await window.lab.publish('waiting-plan', 'plan');
        const state = await verifyActive(true);
        let inspected = 0;
        for (const entry of refs) {
          const value = entry.ref.deref();
          if (!value) continue;
          ensure(
            (await digest(payloadText(value))) === digests.get(entry.id),
            'Retained public payload remains detached during optimistic owner edit'
          );
          inspected++;
        }
        return { ...state, survivingHistoricalObjectsChecked: inspected };
      },
      weakSample(live) {
        const current = new Map(),
          backend = new Map();
        if (live) {
          const state = window.lab.snapshot();
          for (const publication of state.publications)
            current.set(publication.id, publication.payload);
          for (const start of state.starts)
            backend.set(start.id, start.payload);
        }
        const survivors = [];
        for (const entry of refs) {
          const value = entry.ref.deref();
          if (!value) continue;
          survivors.push({
            key: entry.key,
            id: entry.id,
            phase: entry.phase,
            stillCurrent: live && current.get(entry.id) === value,
            transportIdentity: live && backend.get(entry.id) === value,
          });
        }
        return {
          trackedUnique: refs.length,
          alive: survivors.length,
          collected: refs.length - survivors.length,
          stillCurrent: survivors.filter((entry) => entry.stillCurrent).length,
          transportIdentity: survivors.filter(
            (entry) => entry.transportIdentity
          ).length,
          currentIdentityChecksAvailable: live,
          survivors,
        };
      },
    };
  }, rows);
}

async function run(sample, url) {
  activePacket = packets.find((packet) => packet.variant === sample.variant);
  const prefix = `${String(sample.index).padStart(3, '0')}-${sample.variant}-${
    sample.rows
  }`;
  const result = {
    ...sample,
    passed: false,
    stages: [],
    checkpoints: {},
    receipts: {},
    browserErrors: [],
    hostStart: { load: os.loadavg(), freeBytes: os.freemem() },
  };
  let browser,
    page,
    cdp,
    live = false,
    stage = 'input-verification';
  const call = (method, ...args) =>
    page.evaluate(async ({ method, args }) => window.lab[method](...args), {
      method,
      args,
    });
  const probe = (method, ...args) =>
    page.evaluate(
      async ({ method, args }) =>
        window.__startedTeardownProbe[method](...args),
      { method, args }
    );
  const boundary = () =>
    page.evaluate(() => new Promise((done) => setTimeout(done, 0)));
  const step = async (name, work) => {
    stage = name;
    const evidence = await bounded(work(), name);
    assert.deepEqual(result.browserErrors, []);
    const receipt = write(
      `${prefix}-stage-${String(result.stages.length).padStart(2, '0')}.json`,
      { sample, stage: name, passed: true, evidence }
    );
    result.receipts[receipt.path] = receipt.sha256;
    result.stages.push({ name, passed: true, receipt });
    return evidence;
  };
  const checkpoint = async (name, state, backendLifetime) => {
    const evidence = await step(name, async () => {
      for (let pass = 0; pass < 3; pass++) {
        await boundary();
        await cdp.send('HeapProfiler.collectGarbage');
        await boundary();
      }
      const heap = await cdp.send('Runtime.getHeapUsage'),
        weak = await probe('weakSample', live);
      assert.ok(Number.isFinite(heap.usedSize) && heap.usedSize > 0);
      assert.equal(weak.alive + weak.collected, weak.trackedUnique);
      return {
        state,
        heapBytes: heap.usedSize,
        weak,
        backendLifetime,
        diagnosticObjectsIncluded: true,
      };
    });
    result.checkpoints[name] = evidence;
    return evidence;
  };
  try {
    verify();
    stage = 'bootstrap';
    browser = await chromium.launch({ headless: true });
    const session = await browser.newBrowserCDPSession();
    try {
      const info = await session.send('SystemInfo.getProcessInfo');
      const browserPid = info.processInfo.find(
        (entry) => entry.type === 'browser'
      )?.id;
      assert.ok(
        Number.isSafeInteger(browserPid) &&
          browserPid > 0 &&
          !browserPids.has(browserPid)
      );
      browserPids.add(browserPid);
      result.process = {
        browserPid,
        harnessPid: process.pid,
        identity: sample.processIdentity,
        browserVersion: browser.version(),
      };
    } finally {
      await session.detach();
    }
    page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.setDefaultTimeout(120000);
    page.on('pageerror', (error) => result.browserErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') result.browserErrors.push(message.text());
    });
    cdp = await page.context().newCDPSession(page);
    await page.goto(`${url}/?rows=${sample.rows}`);
    await page.waitForFunction(() => window.lab?.ready, undefined, {
      timeout: 45000,
    });
    live = true;
    await call('stable');
    await installProbe(page, sample.rows);
    const initial = await step('initial-view', () =>
      page.evaluate(() => {
        const state = window.lab.snapshot(),
          ids = [...document.querySelectorAll('tbody tr')].map((row) =>
            row.getAttribute('data-job')
          );
        if (
          JSON.stringify(ids) !==
            JSON.stringify(
              Array.from({ length: 40 }, (_, index) => `J-${index}`)
            ) ||
          state.starts.length ||
          state.publications.length ||
          state.operations.length ||
          state.requests.length ||
          state.acknowledged.length ||
          state.row.owner !== 'Operator 0'
        )
          throw new Error('Nonvacuous initial dispatch view');
        return {
          visibleIDs: ids,
          publications: 0,
          operations: 0,
          starts: 0,
          acknowledgements: 0,
        };
      })
    );
    await checkpoint('populated', initial, 'live-service-empty-history');
    const started = await step('start-eight-held-plans', () => probe('start'));
    const active = await checkpoint(
      'eight-started-unacknowledged',
      started,
      'live-service-retains-eight-plan-copies'
    );
    assert.ok(
      active.weak.trackedUnique >= 8,
      'Nonvacuous payload identity tracking'
    );
    const pending = await step('submit-owner-and-waiting-plan', () =>
      probe('pending')
    );
    await checkpoint(
      'before-pending-teardown',
      pending,
      'live-service-retains-eight-plan-copies'
    );
    await step('destroy-pending', async () => {
      await call('destroyPending');
      live = false;
      assert.equal(await page.locator('lab-dispatch main').count(), 0);
      return {
        renderedScreens: 0,
        unacknowledgedStartsBeforeDestroy: 8,
        waitingIntentsBeforeDestroy: 1,
      };
    });
    await checkpoint(
      'after-destroy-before-late',
      { renderedScreens: 0 },
      'old-service-intentionally-retained'
    );
    const retired = await step('deliver-retired-owner', async () => {
      const evidence = await call('deliverRetired', 'retired-owner');
      assert.deepEqual(evidence, {
        applications: 1,
        starts: 8,
        publicationAttempts: 8,
      });
      assert.equal(await page.locator('lab-dispatch main').count(), 0);
      return evidence;
    });
    const final = await checkpoint(
      'after-destroy-after-late',
      retired,
      'old-service-reference-released'
    );
    result.finalWeakCounts = {
      trackedUnique: final.weak.trackedUnique,
      alive: final.weak.alive,
      collected: final.weak.collected,
    };
    if (final.weak.alive)
      await step('final-survivor-snapshot', async () => {
        await boundary();
        const path = join(out, `${prefix}-final.heapsnapshot`),
          fd = openSync(path, 'wx'),
          hash = createHash('sha256');
        let bytes = 0,
          captureError,
          writeError,
          truncated = false;
        const listener = ({ chunk }) => {
          if (writeError || truncated) return;
          const data = Buffer.from(chunk);
          if (bytes + data.length > 512 * 1024 * 1024) {
            truncated = true;
            return;
          }
          try {
            let offset = 0;
            while (offset < data.length) {
              const amount = writeSync(fd, data, offset, data.length - offset);
              assert.ok(amount > 0);
              hash.update(data.subarray(offset, offset + amount));
              offset += amount;
              bytes += amount;
            }
          } catch (error) {
            writeError = error;
          }
        };
        cdp.on('HeapProfiler.addHeapSnapshotChunk', listener);
        try {
          await bounded(
            cdp.send('HeapProfiler.takeHeapSnapshot', {
              reportProgress: false,
            }),
            'snapshot capture',
            240000
          );
        } catch (error) {
          captureError = error;
        } finally {
          cdp.off('HeapProfiler.addHeapSnapshotChunk', listener);
          closeSync(fd);
        }
        result.finalSnapshot = {
          path,
          sha256: hash.digest('hex'),
          bytes,
          complete: !captureError && !writeError && !truncated,
          survivingWeakTargetsBeforeSnapshot: final.weak.alive,
        };
        result.receipts[path] = result.finalSnapshot.sha256;
        assert.ok(
          result.finalSnapshot.complete,
          `Incomplete snapshot: ${captureError ?? writeError ?? '512MiB cap'}`
        );
        return result.finalSnapshot;
      });
    result.passed = true;
  } catch (error) {
    result.failedAt = stage;
    result.error = String(error.stack);
    const receipt = write(`${prefix}-failure.json`, {
      sample,
      stage,
      error: result.error,
      browserErrors: result.browserErrors,
    });
    result.receipts[receipt.path] = receipt.sha256;
    result.stages.push({ name: stage, passed: false, receipt });
  } finally {
    const errors = [];
    try {
      if (live) await bounded(call('destroy'), 'failure cleanup', 30000);
    } catch (error) {
      errors.push(String(error.stack));
    }
    try {
      await bounded(browser?.close(), 'browser close', 30000);
    } catch (error) {
      errors.push(String(error.stack));
    }
    try {
      verify();
    } catch (error) {
      errors.push(String(error.stack));
    }
    if (errors.length || result.browserErrors.length) {
      result.passed = false;
      result.finalizationErrors = errors;
    }
    result.hostEnd = { load: os.loadavg(), freeBytes: os.freemem() };
  }
  return result;
}

function pairedHeap() {
  const statistics = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    return {
      n: values.length,
      min: sorted[0],
      median: sorted[1],
      max: sorted[2],
    };
  };
  return [1000, 10000].map((rows) => ({
    rows,
    stages: [
      'populated',
      'eight-started-unacknowledged',
      'before-pending-teardown',
      'after-destroy-before-late',
      'after-destroy-after-late',
    ].map((stage) => {
      const samples = [0, 1, 2].map((round) => {
        const before = results.find(
          (entry) =>
            entry.rows === rows &&
            entry.round === round &&
            entry.variant === 'before'
        );
        const after = results.find(
          (entry) =>
            entry.rows === rows &&
            entry.round === round &&
            entry.variant === 'after'
        );
        const bv = before.checkpoints[stage].heapBytes,
          av = after.checkpoints[stage].heapBytes;
        return {
          round,
          before: bv,
          after: av,
          difference: av - bv,
          beforeReceipt: before.stages.find((entry) => entry.name === stage)
            .receipt,
          afterReceipt: after.stages.find((entry) => entry.name === stage)
            .receipt,
        };
      });
      return {
        stage,
        unit: 'bytes',
        samples,
        before: statistics(samples.map((entry) => entry.before)),
        after: statistics(samples.map((entry) => entry.after)),
        difference: statistics(samples.map((entry) => entry.difference)),
      };
    }),
  }));
}
try {
  await new Promise((yes, no) => {
    server.once('error', no);
    server.listen(0, '127.0.0.1', yes);
  });
  const url = `http://127.0.0.1:${server.address().port}`;
  for (const sample of schedule) {
    const result = await run(sample, url);
    const receipt = write(
      `${String(sample.index).padStart(3, '0')}-${sample.variant}-${
        sample.rows
      }.json`,
      result
    );
    results.push({ ...result, receipt });
    console.log(
      sample.rows,
      sample.round,
      sample.variant,
      result.passed ? 'passed' : `FAILED at ${result.failedAt}`
    );
    if (!result.passed) break;
  }
} catch (error) {
  write('runner-failure.json', { error: String(error.stack) });
  process.exitCode = 1;
} finally {
  if (server.listening) await new Promise((yes) => server.close(yes));
  const passed =
    results.length === 12 &&
    results.every((entry) => entry.passed) &&
    browserPids.size === 12;
  write('results.json', {
    passed,
    scheduleSha256: sha(join(out, 'schedule.json')),
    bindings,
    results,
    pairedHeap: passed ? pairedHeap() : [],
    limits,
    receipts: Object.fromEntries(
      results.flatMap((entry) => [
        [entry.receipt.path, entry.receipt.sha256],
        ...Object.entries(entry.receipts),
      ])
    ),
  });
  if (!passed) process.exitCode = 1;
}
