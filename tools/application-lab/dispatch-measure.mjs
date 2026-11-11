#!/usr/bin/env node
// Immutable calibration/comparison cohorts. Only the driver is shared: each
// application arm still owns its coordinator and the service owns its decisions.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const [mode, suppliedPacket, suppliedOut] = process.argv.slice(2);
assert.ok(
  ['calibrate', 'compare'].includes(mode) && suppliedPacket && suppliedOut,
  'dispatch-measure.mjs calibrate|compare PACKET NEW_OUTPUT_DIRECTORY'
);
const packet = resolve(suppliedPacket),
  out = resolve(suppliedOut);
assert.ok(!existsSync(out), 'Preserve previous attempts');
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
const planPath = join(packet, 'plan.json'),
  buildPath = join(packet, 'dispatch-build.json');
const conformancePath = join(packet, 'dispatch-conformance/results.json');
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
let plan, built, bindings, chromium;
try {
  plan = read(planPath);
  built = read(buildPath);
  const conformance = read(conformancePath);
  assert.ok(Array.isArray(plan.arms) && plan.arms.length > 0);
  assert.equal(new Set(plan.arms).size, plan.arms.length);
  assert.ok(plan.arms.includes('v15'), 'Same-arm controls require v15');
  assert.deepEqual(Object.keys(built.arms).sort(), [...plan.arms].sort());
  assert.equal(built.planSha256, sha(planPath));
  assert.equal(conformance.planSha256, built.planSha256);
  assert.equal(
    conformance.buildSha256,
    sha(buildPath),
    'Conformance must bind this dispatch build'
  );
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
      `${arm}: conformance and all controls first`
    );
  }
  bindings = {
    ...plan.inputs,
    [runner]: sha(runner),
    [checker]: sha(checker),
    [planPath]: sha(planPath),
    [buildPath]: sha(buildPath),
    [conformancePath]: sha(conformancePath),
  };
  for (const arm of Object.values(built.arms))
    Object.assign(bindings, arm.dependencies, arm.served);
  for (const [path, expected] of Object.entries(bindings))
    assert.equal(sha(path), expected, `Input drift ${path}`);
  ({ chromium } = createRequire(join(plan.toolchainDirectory, 'package.json'))(
    'playwright'
  ));
  write('preflight.json', { passed: true, bindings });
} catch (error) {
  write('preflight.json', { passed: false, error: String(error.stack) });
  throw error;
}
const verify = () => {
  for (const [path, expected] of Object.entries(bindings))
    assert.equal(sha(path), expected, `Input drift ${path}`);
};
const rounds = mode === 'calibrate' ? 1 : 5;
const profiles =
  mode === 'calibrate'
    ? [{ rows: 1000, throttle: 1 }]
    : [
        { rows: 1000, throttle: 1 },
        { rows: 1000, throttle: 4 },
        { rows: 10000, throttle: 1 },
      ];
const workflowRounds = 20,
  pendingCommands = 128,
  agingCheckpoints = [100, 200];
const schedule = [];
let sampleIndex = 0;
function scheduleSample(sample) {
  // Separate fresh processes prevent timing history (including full plan payloads
  // retained by the service) from contaminating the finite memory workload.
  for (const kind of ['timing', 'memory'])
    schedule.push({
      ...sample,
      sampleIndex,
      childIndex: schedule.length,
      kind,
      processIdentity: randomUUID(),
    });
  sampleIndex++;
}
for (const profile of profiles)
  for (let round = 0; round < rounds; round++) {
    const order = plan.arms.map(
      (_, index) => plan.arms[(index + round) % plan.arms.length]
    );
    for (const arm of order)
      scheduleSample({ ...profile, round, arm, control: false });
    if (mode === 'compare' && round < 2)
      for (const member of [0, 1]) {
        scheduleSample({
          ...profile,
          round,
          arm: 'v15',
          control: true,
          controlPair: round,
          controlMember: member,
        });
      }
  }
write('schedule.json', {
  mode,
  createdUTC: new Date().toISOString(),
  bindings,
  schedule,
  workload: {
    workflowRounds,
    pendingCommands,
    agingCheckpoints,
    agingMeaning:
      'Additional completed edits since pending settlement: checkpoints at +100 and +200 total.',
    timingOrder: [
      'assignStatus',
      'assignOwner',
      'latePreview (first round only)',
      'planRequest',
      'rejectStatus',
      'acceptOwner',
      'acknowledgeProcessing',
    ],
    pendingVerdicts:
      'Even-index owner commands accepted; odd-index owner commands rejected.',
    aging:
      'Owner commands accepted sequentially, checked and pruned after every edit; rows cycle over the first 128.',
    teardown:
      'After aging, submit one owner command and a dependent plan. Check memory before destruction, after store/UI destruction while only the old backend is retained, and after late response delivery releases that backend. No late publication may start.',
  },
  timing:
    'Synthetic DOM button event, deterministic service response or local acknowledgement handling through Angular stable and forced layout. Inputs are filled outside timing. Acknowledgement processing excludes network delay. No artificial backend delay, INP, remote acknowledgement latency or sampled CPU claim.',
  statistics:
    'Raw per-round times and within-child nearest-rank p95 for repeated stages. Late preview has one observation per timing child, no p95. Never pool operation tails across children.',
  memory:
    'Separate fresh Chromium children. Whole application plus deterministic test-service live JS heap, including retained request/application/publication logs and used-ID strings. Three forced collections with host-task boundaries per checkpoint. Observed pre-GC high water is not a true peak, allocation count, library-only partition or unlimited retention proof.',
  host: {
    node: process.version,
    cpu: os.cpus()[0]?.model,
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
  },
  limits:
    'Shared host; CDP throttle is not a calibrated device. Five independent comparison samples per arm/profile and two v15 A/A pairs per profile. Memory-child elapsed time is not timing evidence. No population percentile, financial ROI or human productivity claim.',
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
try {
  await new Promise((yes, no) => {
    server.once('error', no);
    server.listen(0, '127.0.0.1', yes);
  });
} catch (error) {
  write('runner-failure.json', {
    stage: 'server-listen',
    error: String(error.stack),
  });
  throw error;
}
const url = `http://127.0.0.1:${server.address().port}`;
const quantile = (values, fraction) =>
  [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1];
const results = [];

async function runChild(sample) {
  const result = {
    ...sample,
    passed: false,
    stage: 'input-binding',
    stages: [],
    browserErrors: [],
    workflow: [],
    memory: [],
    failures: [],
    hostStart: { load: os.loadavg(), freeBytes: os.freemem() },
  };
  let browser,
    page,
    captureState,
    sessionDestroyed = false;
  const failure = (error, stage = result.stage) =>
    result.failures.push({ stage, error: String(error.stack ?? error) });
  try {
    verify();
    directory = join(packet, sample.arm, 'dist/dispatch/browser');
    result.stage = 'browser-launch';
    browser = await chromium.launch({ headless: true });
    const browserCDP = await browser.newBrowserCDPSession();
    const processes = await browserCDP.send('SystemInfo.getProcessInfo');
    result.process = {
      identity: sample.processIdentity,
      browserPid: processes.processInfo.find(
        (process) => process.type === 'browser'
      )?.id,
      browserVersion: browser.version(),
      harnessPid: process.pid,
    };
    assert.ok(
      Number.isInteger(result.process.browserPid),
      'Record actual Chromium process identity'
    );
    page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on('pageerror', (error) => result.browserErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') result.browserErrors.push(message.text());
    });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: sample.throttle });
    const call = (method, ...args) =>
      page.evaluate(async ({ method, args }) => window.lab[method](...args), {
        method,
        args,
      });
    // Do not serialize every prior full plan and preview to the harness after each
    // action. Useful assertions stay outside timing; full payload checks are below.
    const snapshot = () =>
      page.evaluate(() => {
        const s = window.lab.snapshot();
        return {
          row: s.row,
          canonical: s.canonical,
          capacity: s.capacity,
          preview: s.preview && {
            count: s.preview.rows.length,
            first: s.preview.rows[0],
            pending: s.preview.pending,
            capacity: s.preview.capacity,
          },
          operations: s.operations,
          publications: s.publications.map(({ payload, ...intent }) => ({
            ...intent,
            payloadKind: payload?.kind,
          })),
          requests: s.requests,
          applications: s.applications,
          publicationAttempts: s.publicationAttempts,
          starts: s.starts.map(({ id, payload }) => ({
            id,
            kind: payload.kind,
            count: payload.kind === 'plan' ? payload.rows.length : undefined,
            first: payload.kind === 'plan' ? payload.rows[0] : undefined,
            capacity: payload.kind === 'plan' ? payload.capacity : undefined,
          })),
          acknowledged: s.acknowledged,
          serverRow: s.serverRow,
          serverCapacity: s.serverCapacity,
        };
      });
    captureState = snapshot;
    async function renderedRow(row) {
      if (Number(row.id.slice(2)) >= 40) return;
      const dom = await page
        .locator(`[data-job="${row.id}"]`)
        .evaluate((node) => ({
          instance: node.getAttribute('data-instance'),
          owner: node.querySelector('[data-field="owner"]').textContent?.trim(),
          status: node
            .querySelector('[data-field="status"]')
            .textContent?.trim(),
          revision: node
            .querySelector('[data-field="owner-revision"]')
            .textContent?.trim(),
        }));
      assert.deepEqual(dom, {
        instance: row.instance,
        owner: row.owner,
        status: row.status,
        revision: String(row.ownerRevision),
      });
    }
    async function rendered(s) {
      const dom = await page.evaluate(() => {
        const text = (selector) =>
          document.querySelector(selector)?.textContent?.trim() ?? null;
        return {
          ids: [...document.querySelectorAll('tbody tr')].map((row) =>
            row.getAttribute('data-job')
          ),
          owner: text('[data-job="J-0"] [data-field="owner"]'),
          status: text('[data-job="J-0"] [data-field="status"]'),
          revision: text('[data-job="J-0"] [data-field="owner-revision"]'),
          capacity: text('[data-testid="capacity"]'),
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
          preview: {
            count: text('[data-testid="preview-count"]'),
            pending: text('[data-testid="preview-pending"]'),
            owner: text('[data-testid="preview-owner"]'),
            status: text('[data-testid="preview-status"]'),
            capacity: text('[data-testid="preview-capacity"]'),
          },
        };
      });
      assert.deepEqual(
        dom.ids,
        Array.from(
          { length: Math.min(40, sample.rows) },
          (_, index) => `J-${index}`
        )
      );
      assert.equal(dom.owner, s.row.owner);
      assert.equal(dom.status, s.row.status);
      assert.equal(dom.revision, String(s.row.ownerRevision));
      assert.equal(dom.capacity, String(s.capacity.value));
      assert.deepEqual(
        dom.operations,
        s.operations.map(({ id, outcome }) => ({ id, outcome }))
      );
      assert.deepEqual(
        dom.publications,
        s.publications.map(({ id, state }) => ({ id, state }))
      );
      assert.deepEqual(
        dom.preview,
        s.preview
          ? {
              count: String(s.preview.count),
              pending: String(s.preview.pending),
              owner: s.preview.first.owner,
              status: s.preview.first.status,
              capacity: String(s.preview.capacity.value),
            }
          : {
              count: null,
              pending: null,
              owner: null,
              status: null,
              capacity: null,
            }
      );
    }
    async function stage(name, work) {
      result.stage = name;
      await work();
      assert.deepEqual(result.browserErrors, [], `${name}: browser errors`);
      result.stages.push({ name, passed: true });
    }
    const operation = (s, id) => {
      const op = s.operations.find((item) => item.id === id);
      assert.ok(op, `Missing operation ${id}`);
      return op;
    };
    const publication = (s, id) => {
      const pub = s.publications.find((item) => item.id === id);
      assert.ok(pub, `Missing publication ${id}`);
      return pub;
    };
    async function checkpoint(name) {
      let state;
      if (name !== 'blank' && !sessionDestroyed) {
        const s = await snapshot();
        state = {
          row: s.row,
          operations: s.operations.length,
          unresolved: s.operations.filter((op) =>
            ['pending', 'unknown'].includes(op.outcome)
          ).length,
          publications: s.publications.length,
          previewOpen: Boolean(s.preview),
          previewPending: s.preview?.pending,
          requests: s.requests.length,
          applications: s.applications.length,
          publicationAttempts: s.publicationAttempts.length,
          publicationStarts: s.starts.length,
          acknowledgements: s.acknowledged.length,
        };
      }
      const point = {
        name,
        preGCBytes: (await cdp.send('Runtime.getHeapUsage')).usedSize,
      };
      if (state) point.state = state;
      result.memory.push(point);
      for (let attempt = 0; attempt < 3; attempt++) {
        await cdp.send('HeapProfiler.collectGarbage');
        await page.evaluate(
          () => new Promise((resolve) => setTimeout(resolve, 0))
        );
      }
      point.postGCBytes = (await cdp.send('Runtime.getHeapUsage')).usedSize;
      point.deltaFromBlankBytes =
        point.postGCBytes - result.memory[0].postGCBytes;
    }
    if (sample.kind === 'memory')
      await stage('memory-blank', () => checkpoint('blank'));
    await stage('bootstrap', async () => {
      await page.goto(`${url}/?rows=${sample.rows}`);
      await page.waitForFunction(() => window.lab?.ready, undefined, {
        timeout: 45000,
      });
      await call('stable');
      if (sample.kind === 'timing')
        result.startup = await page.evaluate(() => ({ ...window.lab.timings }));
      const s = await snapshot();
      assert.equal(s.row.owner, 'Operator 0');
      assert.equal(s.row.status, 'queued');
      assert.equal(s.row.ownerRevision, 10);
      assert.equal(s.row.statusRevision, 10);
      assert.equal(s.preview, null);
      assert.equal(s.requests.length, 0);
      assert.equal(s.starts.length, 0);
      assert.equal(s.publicationAttempts.length, 0);
      assert.equal(s.operations.length, 0);
      await rendered(s);
    });

    if (sample.kind === 'timing') {
      for (let round = 0; round < workflowRounds; round++) {
        const a = `timing-status-${round}`,
          b = `timing-owner-${round}`,
          intent = `timing-plan-${round}`;
        const owner = `Measured owner ${round}`,
          previousOwner = round ? `Measured owner ${round - 1}` : 'Operator 0';
        const item = {
          round,
          statusCommand: a,
          ownerCommand: b,
          intent,
          milliseconds: {},
        };
        result.workflow.push(item);
        async function assign(field, value, id, metric) {
          await page.getByTestId('command-id').fill(id);
          if (field === 'status')
            await page.getByTestId('status-input').selectOption(value);
          else await page.getByTestId('owner-input').fill(value);
          await call('stable');
          item.milliseconds[metric] = await call('measure', {
            kind: 'click',
            id: 'assign-' + field,
          });
        }
        await stage(`round-${round}-assign-status`, async () => {
          await assign('status', 'active', a, 'assignStatus');
          const s = await snapshot();
          assert.equal(s.requests.length, round * 2 + 1);
          assert.equal(s.requests.at(-1).id, a);
          assert.equal(operation(s, a).outcome, 'pending');
          assert.equal(s.row.status, 'active');
          assert.equal(s.row.owner, previousOwner);
          assert.equal(s.canonical.status, 'queued');
          assert.equal(s.starts.length, round);
          await rendered(s);
        });
        await stage(`round-${round}-assign-owner`, async () => {
          await assign('owner', owner, b, 'assignOwner');
          const s = await snapshot();
          assert.equal(s.requests.length, round * 2 + 2);
          assert.equal(s.requests.at(-1).id, b);
          assert.equal(operation(s, b).outcome, 'pending');
          assert.equal(s.row.owner, owner);
          assert.equal(s.row.status, 'active');
          assert.equal(s.canonical.owner, previousOwner);
          assert.equal(s.row.ownerRevision, 10 + round);
          await rendered(s);
        });
        if (round === 0)
          await stage('late-preview', async () => {
            item.milliseconds.latePreview = await call('measure', {
              kind: 'click',
              id: 'open-preview',
            });
            const s = await snapshot();
            assert.equal(s.preview.count, sample.rows);
            assert.equal(s.preview.pending, 2);
            assert.equal(s.preview.first.owner, owner);
            assert.equal(s.preview.first.status, 'active');
            await rendered(s);
          });
        await stage(`round-${round}-plan-request`, async () => {
          await page.getByTestId('intent-id').fill(intent);
          await call('stable');
          item.milliseconds.planRequest = await call('measure', {
            kind: 'click',
            id: 'publish-plan',
          });
          const s = await snapshot();
          assert.equal(publication(s, intent).state, 'waiting');
          assert.deepEqual(
            [...publication(s, intent).inputs].sort(),
            [a, b].sort()
          );
          assert.equal(s.starts.length, round);
          assert.equal(s.publicationAttempts.length, round);
          assert.equal(s.preview.pending, 2);
          await rendered(s);
        });
        await stage(`round-${round}-reject-status`, async () => {
          item.milliseconds.rejectStatus = await call('measure', {
            kind: 'response',
            id: a,
            verdict: 'reject',
          });
          const s = await snapshot();
          assert.equal(operation(s, a).outcome, 'rejected');
          assert.equal(operation(s, b).outcome, 'pending');
          assert.equal(s.row.status, 'queued');
          assert.equal(s.row.owner, owner);
          assert.equal(s.canonical.owner, previousOwner);
          assert.equal(s.preview.pending, 1);
          assert.equal(publication(s, intent).state, 'waiting');
          assert.equal(s.starts.length, round);
          assert.equal(s.publicationAttempts.length, round);
          assert.equal(s.applications.length, round);
          await rendered(s);
        });
        await stage(`round-${round}-accept-owner`, async () => {
          item.milliseconds.acceptOwner = await call('measure', {
            kind: 'response',
            id: b,
            verdict: 'accept',
          });
          const s = await snapshot();
          assert.equal(operation(s, b).outcome, 'applied');
          assert.equal(s.row.owner, owner);
          assert.equal(s.row.ownerRevision, 11 + round);
          assert.equal(s.row.status, 'queued');
          assert.equal(s.row.statusRevision, 10);
          assert.deepEqual(s.row, s.canonical);
          assert.deepEqual(s.row, s.serverRow);
          assert.equal(s.preview.pending, 0);
          assert.equal(s.applications.length, round + 1);
          assert.equal(s.applications.at(-1).id, b);
          assert.equal(s.starts.length, round + 1);
          assert.equal(s.publicationAttempts.length, round + 1);
          assert.equal(s.starts.at(-1).id, intent);
          assert.equal(publication(s, intent).state, 'started');
          assert.equal(s.acknowledged.length, round);
          assert.equal(s.starts.at(-1).kind, 'plan');
          assert.equal(s.starts.at(-1).count, sample.rows);
          assert.deepEqual(s.starts.at(-1).first, s.canonical);
          assert.deepEqual(s.starts.at(-1).capacity, s.serverCapacity);
          // Check every row of this frozen payload outside the timed response. The
          // fixture changes only J-0 owner; all other fields and ordering survive.
          const payloadFailure = await page.evaluate(
            ({ intent, owner, revision, rows }) => {
              const payload = window.lab
                .snapshot()
                .starts.find((item) => item.id === intent)?.payload;
              if (payload?.kind !== 'plan' || payload.rows.length !== rows)
                return 'Missing full plan';
              for (let index = 0; index < rows; index++) {
                const row = payload.rows[index];
                if (
                  row.id !== `J-${index}` ||
                  row.instance !== `initial-${index}` ||
                  row.status !== 'queued' ||
                  row.statusRevision !== 10 ||
                  row.owner !== (index ? `Operator ${index % 10}` : owner) ||
                  row.ownerRevision !== (index ? 10 : revision) ||
                  row.active !== (index % 2 === 0) ||
                  row.title !==
                    `Inspect ${index % 3 === 0 ? 'pump' : 'valve'} ${index}`
                )
                  return `Wrong payload row ${index}`;
              }
              return null;
            },
            { intent, owner, revision: 11 + round, rows: sample.rows }
          );
          assert.equal(payloadFailure, null);
          await rendered(s);
        });
        await stage(`round-${round}-acknowledge-and-prune`, async () => {
          item.milliseconds.acknowledgeProcessing = await call('measure', {
            kind: 'ack',
            id: intent,
          });
          let s = await snapshot();
          assert.equal(publication(s, intent).state, 'acknowledged');
          assert.equal(s.acknowledged.length, round + 1);
          assert.equal(s.acknowledged.at(-1), intent);
          await rendered(s);
          await call('dismissSettled');
          s = await snapshot();
          assert.equal(s.operations.length, 0);
          assert.equal(s.publications.length, 0);
          assert.equal(s.publicationAttempts.length, round + 1);
          await rendered(s);
        });
      }
      result.milliseconds = {};
      for (const metric of [
        'assignStatus',
        'assignOwner',
        'planRequest',
        'rejectStatus',
        'acceptOwner',
        'acknowledgeProcessing',
      ]) {
        const values = result.workflow.map((item) => item.milliseconds[metric]);
        assert.ok(
          values.length === workflowRounds &&
            values.every((value) => Number.isFinite(value) && value >= 0)
        );
        result.milliseconds[metric] = {
          values,
          withinChildP95: quantile(values, 0.95),
        };
      }
      result.milliseconds.latePreview = {
        value: result.workflow[0].milliseconds.latePreview,
        observations: 1,
      };
      assert.ok(
        Number.isFinite(result.milliseconds.latePreview.value) &&
          result.milliseconds.latePreview.value >= 0
      );
    } else {
      await stage('memory-populated', () => checkpoint('populated'));
      await stage('memory-pending', async () => {
        for (let index = 0; index < pendingCommands; index++) {
          const id = `J-${index}`,
            value = `Pending owner ${index}`,
            command = `memory-pending-${index}`;
          await call('assign', id, 'owner', value, command);
          const row = await call('row', id);
          assert.equal(row.owner, value, `Pending row ${id}`);
          await renderedRow(row);
        }
        const s = await snapshot();
        assert.equal(s.requests.length, pendingCommands);
        assert.equal(s.operations.length, pendingCommands);
        assert.ok(s.operations.every((op) => op.outcome === 'pending'));
        assert.equal(s.applications.length, 0);
        assert.equal(s.starts.length, 0);
        assert.equal(s.preview, null);
        await rendered(s);
        await checkpoint('pending-128');
      });
      await stage('memory-awaiting-preview', async () => {
        await page.getByTestId('open-preview').click();
        await call('stable');
        const s = await snapshot();
        assert.equal(s.preview.count, sample.rows);
        assert.equal(s.preview.pending, pendingCommands);
        assert.equal(s.preview.first.owner, 'Pending owner 0');
        await rendered(s);
        await checkpoint('pending-128-preview-open');
      });
      await stage('memory-settled-pruned', async () => {
        for (let index = 0; index < pendingCommands; index++) {
          const verdict = index % 2 === 0 ? 'accept' : 'reject';
          const decision = await call(
            'process',
            `memory-pending-${index}`,
            verdict
          );
          assert.equal(
            decision.outcome,
            verdict === 'accept' ? 'applied' : 'rejected'
          );
          const row = await call('row', `J-${index}`);
          assert.equal(
            row.owner,
            verdict === 'accept'
              ? `Pending owner ${index}`
              : `Operator ${index % 10}`
          );
          assert.equal(row.ownerRevision, verdict === 'accept' ? 11 : 10);
          assert.equal(row.status, 'queued');
          await renderedRow(row);
        }
        await call('dismissSettled');
        const s = await snapshot();
        assert.equal(s.operations.length, 0);
        assert.equal(s.publications.length, 0);
        assert.equal(s.preview.pending, 0);
        assert.equal(s.applications.length, pendingCommands / 2);
        assert.equal(s.requests.length, pendingCommands);
        await rendered(s);
        await checkpoint('settled-pruned');
      });
      for (let edit = 1; edit <= agingCheckpoints.at(-1); edit++) {
        await stage(`memory-aging-${edit}`, async () => {
          const id = `J-${(edit - 1) % pendingCommands}`,
            command = `memory-aging-${edit}`,
            owner = `Aged owner ${edit}`;
          const before = await call('row', id);
          await call('assign', id, 'owner', owner, command);
          assert.equal((await call('row', id)).owner, owner);
          const decision = await call('process', command, 'accept');
          assert.equal(decision.outcome, 'applied');
          const row = await call('row', id);
          assert.equal(row.owner, owner);
          assert.equal(row.ownerRevision, before.ownerRevision + 1);
          assert.equal(row.status, 'queued');
          await renderedRow(row);
          await call('dismissSettled');
          const s = await snapshot();
          assert.equal(s.operations.length, 0);
          assert.equal(s.publications.length, 0);
          assert.equal(s.preview.pending, 0);
          assert.equal(s.requests.length, pendingCommands + edit);
          assert.equal(s.applications.length, pendingCommands / 2 + edit);
          assert.equal(s.applications.at(-1).id, command);
          assert.equal(s.starts.length, 0);
          await rendered(s);
          if (agingCheckpoints.includes(edit))
            await checkpoint(`settled-pruned-plus-${edit}`);
        });
      }
      await stage('memory-before-pending-teardown', async () => {
        const before = await call('row', 'J-0');
        await call(
          'assign',
          'J-0',
          'owner',
          'Teardown proposed owner',
          'teardown-pending'
        );
        await call('publish', 'teardown-plan', 'plan');
        const s = await snapshot();
        assert.equal(
          s.requests.length,
          pendingCommands + agingCheckpoints.at(-1) + 1
        );
        assert.equal(s.operations.length, 1);
        assert.equal(operation(s, 'teardown-pending').outcome, 'pending');
        assert.equal(s.row.owner, 'Teardown proposed owner');
        assert.deepEqual(s.canonical, before);
        assert.equal(s.publications.length, 1);
        assert.equal(publication(s, 'teardown-plan').state, 'waiting');
        assert.deepEqual(publication(s, 'teardown-plan').inputs, [
          'teardown-pending',
        ]);
        assert.equal(s.preview.pending, 1);
        assert.equal(s.starts.length, 0);
        assert.equal(s.publicationAttempts.length, 0);
        assert.equal(
          s.applications.length,
          pendingCommands / 2 + agingCheckpoints.at(-1)
        );
        await rendered(s);
        await checkpoint('before-pending-teardown');
      });
      await stage('memory-destroy-pending', async () => {
        await call('destroyPending');
        sessionDestroyed = true;
        assert.equal(await page.locator('lab-dispatch main').count(), 0);
        await checkpoint('after-destroy-before-late');
      });
      await stage('memory-deliver-retired', async () => {
        result.retiredDelivery = await call(
          'deliverRetired',
          'teardown-pending'
        );
        assert.deepEqual(result.retiredDelivery, {
          applications: pendingCommands / 2 + agingCheckpoints.at(-1) + 1,
          starts: 0,
          publicationAttempts: 0,
        });
        assert.equal(await page.locator('lab-dispatch main').count(), 0);
        await checkpoint('after-destroy-after-late');
      });
    }
    if (sample.kind === 'timing')
      await stage('destroy', async () => {
        await call('destroy');
        sessionDestroyed = true;
        assert.equal(await page.locator('lab-dispatch main').count(), 0);
      });
    if (sample.kind === 'memory')
      result.observedPreGCHighWaterBytes = Math.max(
        ...result.memory.map((point) => point.preGCBytes)
      );
  } catch (error) {
    failure(error);
    if (captureState && !sessionDestroyed && result.stage !== 'destroy') {
      try {
        result.failureState = await captureState();
      } catch (captureError) {
        failure(captureError, 'failure-state-capture');
      }
    }
    if (page) {
      try {
        result.failureView = await page.evaluate(
          (destroyed) => ({
            text: document.body.innerText.slice(0, 20000),
            ready: Boolean(window.lab?.ready),
            row: destroyed ? undefined : window.lab?.row?.('J-0'),
          }),
          sessionDestroyed
        );
      } catch (captureError) {
        failure(captureError, 'failure-view-capture');
      }
    }
  } finally {
    if (browser)
      try {
        await browser.close();
      } catch (error) {
        failure(error, 'browser-close');
      }
    try {
      verify();
    } catch (error) {
      failure(error, 'input-binding-after-child');
    }
    if (result.browserErrors.length && !result.failures.length)
      failure(new Error(result.browserErrors.join('\n')), 'browser-errors');
    result.hostEnd = { load: os.loadavg(), freeBytes: os.freemem() };
    result.passed = result.failures.length === 0;
  }
  return result;
}
try {
  for (const sample of schedule) {
    const result = await runChild(sample);
    results.push(result);
    write(
      `${String(sample.childIndex).padStart(3, '0')}-${sample.arm}-${
        sample.kind
      }.json`,
      result
    );
    console.log(
      sample.childIndex,
      sample.arm,
      sample.kind,
      sample.rows,
      sample.throttle,
      result.passed ? 'passed' : `FAILED at ${result.stage}`
    );
    if (!result.passed) break;
  }
} catch (error) {
  write('runner-failure.json', { stage: 'cohort', error: String(error.stack) });
  throw error;
} finally {
  await new Promise((yes) => server.close(yes));
  write('results.json', {
    scheduleSha256: sha(join(out, 'schedule.json')),
    bindings,
    results,
  });
}
if (
  results.length !== schedule.length ||
  results.some((result) => !result.passed)
)
  process.exitCode = 1;
