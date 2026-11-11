#!/usr/bin/env node
// Private matched dispatch variants. The frozen baseline child is copied exactly;
// packet selection, scheduling and evidence admission live outside that child.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const runner = fileURLToPath(import.meta.url),
  here = dirname(runner);
const baselineRunner = join(here, 'dispatch-measure.mjs');
const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const hashBytes = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sha = (path) => hashBytes(readFileSync(path));
const profiles = [
  { rows: 1000, throttle: 1 },
  { rows: 1000, throttle: 4 },
  { rows: 10000, throttle: 1 },
];
const workflowRounds = 20,
  pendingCommands = 128,
  agingCheckpoints = [100, 200];
const quantile = (values, fraction) =>
  [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1];
const controls = {
  dispatch: {
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
  },
  inventory: {
    'drop-filter': 'filter-pump',
    'stale-count': 'valid-add',
    'invalid-add': 'invalid-add',
    'stale-editor': 'retired-editor',
    'skip-destroy': 'destroy',
  },
};
let bindings, chromium, packet, directory, url;
const verify = () => {
  for (const [path, expected] of Object.entries(bindings))
    assert.equal(sha(path), expected, `Input drift ${path}`);
};
function bind(values) {
  for (const [path, hash] of Object.entries(values)) {
    if (Object.hasOwn(bindings, path))
      assert.equal(bindings[path], hash, `Conflicting input ${path}`);
    bindings[path] = hash;
  }
}
function childSource(source) {
  const start = source.indexOf('async function runChild(sample) {');
  const end = source.indexOf('\n}\n', start);
  assert.ok(start >= 0 && end > start, 'Cannot identify baseline runChild');
  return source.slice(start, end + 2);
}
function assertBaselineChild() {
  const original = childSource(readFileSync(baselineRunner, 'utf8'));
  assert.equal(
    runChild.toString(),
    original,
    'Baseline child behavior changed'
  );
  return hashBytes(original);
}
function files(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      assert.ok(!entry.isSymbolicLink(), `Unexpected served symlink ${path}`);
      return entry.isDirectory() ? files(path) : [path];
    })
    .sort();
}
function makeSchedule(arms, identity = randomUUID) {
  assert.ok(arms.length > 0 && new Set(arms).size === arms.length);
  const schedule = [];
  let sampleIndex = 0;
  const add = (sample) => {
    for (const kind of ['timing', 'memory'])
      schedule.push({
        ...sample,
        sampleIndex,
        childIndex: schedule.length,
        kind,
        processIdentity: identity(),
      });
    sampleIndex++;
  };
  for (const profile of profiles)
    for (let round = 0; round < 5; round++) {
      const order = arms.map((_, index) => arms[(index + round) % arms.length]);
      for (const arm of order)
        for (const variant of (round + arms.indexOf(arm)) % 2
          ? ['after', 'before']
          : ['before', 'after'])
          add({ ...profile, round, arm, variant, control: false });
      if (round < 2)
        for (const controlMember of [0, 1])
          add({
            ...profile,
            round,
            arm: 'v15',
            variant: 'before',
            control: true,
            controlPair: round,
            controlMember,
          });
    }
  return schedule;
}
function admit(packetPath, plan, scenario) {
  const checker = join(here, `${scenario}-check.mjs`);
  const buildPath = join(
    packetPath,
    scenario === 'dispatch' ? 'dispatch-build.json' : 'build.json'
  );
  const conformancePath = join(
    packetPath,
    `${scenario}-conformance/results.json`
  );
  const build = read(buildPath),
    conformance = read(conformancePath);
  assert.deepEqual(Object.keys(build.arms).sort(), [...plan.arms].sort());
  assert.equal(build.planSha256, sha(join(packetPath, 'plan.json')));
  assert.equal(conformance.planSha256, build.planSha256);
  assert.equal(conformance.buildSha256, sha(buildPath));
  assert.equal(conformance.runnerSha256, sha(checker));
  assert.deepEqual(conformance.controls, controls[scenario]);
  const faults = Object.keys(controls[scenario]);
  assert.equal(
    conformance.results.length,
    plan.arms.length * (faults.length + 1)
  );
  for (const arm of plan.arms) {
    const runs = conformance.results.filter((result) => result.arm === arm);
    assert.deepEqual(
      runs.map((result) => result.fault ?? 'baseline').sort(),
      ['baseline', ...faults].sort()
    );
    for (const result of runs) {
      assert.equal(result.passed, true);
      if (result.fault === null) assert.ok(!result.error);
      else {
        assert.equal(result.detectedAt, controls[scenario][result.fault]);
        assert.ok(typeof result.error === 'string' && result.error.length);
        assert.deepEqual(result.browserErrors, []);
      }
      const rawPath = join(
        packetPath,
        `${scenario}-conformance/${arm}-${result.fault ?? 'baseline'}.json`
      );
      assert.deepEqual(
        read(rawPath),
        result,
        'Conformance aggregate/raw mismatch'
      );
      bind({ [rawPath]: sha(rawPath) });
    }
    const selected = build.arms[arm];
    const statsPath = join(packetPath, arm, 'dist', scenario, 'stats.json');
    assert.equal(sha(statsPath), selected.statsSha256);
    const dependencies = {},
      work = join(packetPath, arm);
    for (const path of Object.keys(read(statsPath).inputs)) {
      const input = resolve(work, path);
      if (existsSync(input)) dependencies[realpathSync(input)] = sha(input);
      else
        assert.ok(
          path.startsWith('angular:'),
          `Unbound nonvirtual input ${path}`
        );
    }
    assert.deepEqual(
      selected.dependencies,
      dependencies,
      'Build dependency closure differs from stats'
    );
    const served = files(join(work, 'dist', scenario, 'browser'));
    assert.deepEqual(
      Object.keys(selected.served).sort(),
      served,
      'Served file inventory differs'
    );
    assert.deepEqual(
      selected.entryFiles.map((path) => resolve(work, path)).sort(),
      served
    );
    bind({
      ...selected.dependencies,
      ...selected.served,
      [statsPath]: selected.statsSha256,
    });
  }
  bind({
    [checker]: sha(checker),
    [buildPath]: sha(buildPath),
    [conformancePath]: sha(conformancePath),
  });
}
async function main(before, after, out) {
  assert.ok(!existsSync(out), 'Preserve previous attempts');
  mkdirSync(out, { recursive: true });
  const write = (name, value) =>
    writeFileSync(join(out, name), JSON.stringify(value, null, 2) + '\n', {
      flag: 'wx',
    });
  const packets = { before, after },
    plans = {};
  bindings = { [runner]: sha(runner), [baselineRunner]: sha(baselineRunner) };
  let arms, childEngineSha256;
  try {
    childEngineSha256 = assertBaselineChild();
    assert.notEqual(realpathSync(before), realpathSync(after));
    for (const variant of ['before', 'after']) {
      const path = join(packets[variant], 'plan.json');
      plans[variant] = read(path);
      assert.deepEqual(plans[variant].arms, [
        'native',
        'ngrx',
        'tanstack',
        'v15',
        'v16',
      ]);
      bind({ ...plans[variant].inputs, [path]: sha(path) });
    }
    assert.equal(plans.before.variant, undefined);
    assert.equal(
      plans.after.variant.baselinePlanPath,
      join(before, 'plan.json')
    );
    assert.equal(
      plans.after.variant.baselinePlanSha256,
      sha(join(before, 'plan.json'))
    );
    for (const key of ['toolchainDirectory', 'node', 'host'])
      assert.deepEqual(
        plans.before[key],
        plans.after[key],
        `Common identity changed: ${key}`
      );
    const replacements = plans.after.variant.replacements;
    assert.ok(Array.isArray(replacements) && replacements.length);
    const changed = new Map();
    for (const item of replacements) {
      assert.ok(plans.before.arms.includes(item.arm));
      assert.ok(['inventory', 'dispatch'].includes(item.scenario));
      const suffix = join(
        item.arm,
        'src/arms',
        item.scenario === 'inventory' ? 'selected.ts' : 'selected-dispatch.ts'
      );
      assert.equal(item.destination, join(after, suffix));
      assert.ok(!changed.has(item.destination));
      changed.set(item.destination, item);
      assert.equal(
        plans.before.inputs[join(before, suffix)],
        item.beforeSha256
      );
      assert.equal(plans.after.inputs[item.destination], item.afterSha256);
      assert.equal(plans.after.inputs[item.source], item.afterSha256);
      assert.notEqual(item.beforeSha256, item.afterSha256);
    }
    // Preserve every original common UI/model/backend/config/runtime input and
    // inherited dependency, including macOS realpath aliases.
    const originals = { ...plans.before.inputs };
    for (const name of ['build.json', 'dispatch-build.json']) {
      const path = join(before, name),
        build = read(path);
      assert.equal(build.planSha256, sha(join(before, 'plan.json')));
      assert.equal(plans.after.inputs[path], sha(path));
      for (const arm of Object.values(build.arms))
        for (const [path, hash] of Object.entries(arm.dependencies)) {
          if (Object.hasOwn(originals, path))
            assert.equal(originals[path], hash);
          originals[path] = hash;
        }
    }
    const prefixes = [...new Set([before, realpathSync(before)])];
    for (const [path, hash] of Object.entries(originals)) {
      const prefix = prefixes.find((item) => path.startsWith(item + sep));
      const mapped = prefix ? join(after, relative(prefix, path)) : path;
      assert.equal(
        plans.after.inputs[mapped],
        changed.get(mapped)?.afterSha256 ?? hash,
        `Common input changed: ${mapped}`
      );
    }
    for (const arm of plans.before.arms) {
      for (const name of [
        'src/main.ts',
        'src/model.ts',
        'src/index.html',
        'src/arm.ts',
        'src/dispatch-main.ts',
        'src/dispatch-model.ts',
        'src/dispatch-backend.ts',
        'src/dispatch.html',
        'src/dispatch-arm.ts',
        'src/arms/selected.ts',
        'src/arms/selected-dispatch.ts',
        'package.json',
        'tsconfig.json',
        'angular.json',
      ]) {
        const first = join(before, arm, name),
          second = join(after, arm, name);
        assert.equal(
          plans.before.inputs[first],
          sha(first),
          `Missing baseline source binding ${first}`
        );
        assert.equal(
          plans.after.inputs[second],
          sha(second),
          `Missing candidate source binding ${second}`
        );
        assert.equal(
          sha(second),
          changed.get(second)?.afterSha256 ?? sha(first)
        );
      }
    }
    assert.deepEqual(
      Object.keys(plans.before.artifacts).sort(),
      Object.keys(plans.after.artifacts).sort()
    );
    for (const [name, artifact] of Object.entries(plans.before.artifacts)) {
      const candidate = plans.after.artifacts[name];
      assert.deepEqual({ ...candidate, archive: artifact.archive }, artifact);
      assert.equal(sha(candidate.archive), sha(artifact.archive));
      for (const value of [artifact, candidate])
        assert.equal(
          'sha512-' +
            createHash('sha512')
              .update(readFileSync(value.archive))
              .digest('base64'),
          value.integrity
        );
    }
    arms = plans.before.arms.filter((arm) =>
      replacements.some(
        (item) => item.arm === arm && item.scenario === 'dispatch'
      )
    );
    assert.ok(arms.length, 'No declared dispatch variant');
    for (const variant of ['before', 'after']) {
      admit(packets[variant], plans[variant], 'dispatch');
      if (replacements.some((item) => item.scenario === 'inventory'))
        admit(packets[variant], plans[variant], 'inventory');
    }
    verify();
    write('preflight.json', {
      passed: true,
      packets,
      arms,
      bindings,
      childEngineSha256,
    });
  } catch (error) {
    write('preflight.json', { passed: false, error: String(error.stack) });
    throw error;
  }
  const schedule = makeSchedule(arms);
  assert.equal(
    new Set(schedule.map((sample) => sample.processIdentity)).size,
    schedule.length
  );
  write('schedule.json', {
    mode: 'compare-variants',
    scenario: 'dispatch',
    createdUTC: new Date().toISOString(),
    packets,
    arms,
    bindings,
    childEngineSha256,
    schedule,
    workload: {
      workflowRounds,
      pendingCommands,
      agingCheckpoints,
      timingOrder: [
        'assignStatus',
        'assignOwner',
        'latePreview (first round only)',
        'planRequest',
        'rejectStatus',
        'acceptOwner',
        'acknowledgeProcessing',
      ],
    },
    timing:
      'Unchanged baseline runChild: synthetic DOM/service response/local acknowledgement through Angular stable and forced layout. Inputs outside timing; no artificial network delay or INP claim.',
    statistics:
      '20 workflow rounds; within-child nearest-rank p95 per repeated stage; one late-preview observation. No pooled child tails.',
    memory:
      'Separate fresh Chromium children. Whole application plus deterministic service/logs/used IDs; 128 pending commands, +100/+200 settled edits, pending teardown before and after late response. Three forced collections per checkpoint.',
    host: {
      node: process.version,
      cpu: os.cpus()[0]?.model,
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
    },
    limits:
      'Five matched before/after pairs per affected arm/profile/kind, two separate baseline-v15 A/A pairs per profile/kind. Shared host and uncalibrated CDP throttle; no population tail, significance, winner, exact CPU or human-productivity claim. Memory-child time is not timing evidence.',
  });
  try {
    ({ chromium } = createRequire(
      join(plans.before.toolchainDirectory, 'package.json')
    )('playwright'));
  } catch (error) {
    write('runner-failure.json', {
      stage: 'browser-toolchain-load',
      error: String(error.stack),
    });
    throw error;
  }
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
  const results = [],
    pids = new Set();
  try {
    await new Promise((yes, no) => {
      server.once('error', no);
      server.listen(0, '127.0.0.1', yes);
    });
    url = `http://127.0.0.1:${server.address().port}`;
    for (const sample of schedule) {
      packet = packets[sample.variant];
      const result = await runChild(sample);
      if (result.process?.browserPid !== undefined) {
        if (pids.has(result.process.browserPid)) {
          result.failures.push({
            stage: 'fresh-process',
            error: 'Reused browser PID',
          });
          result.passed = false;
        }
        pids.add(result.process.browserPid);
      }
      results.push(result);
      write(
        `${String(sample.childIndex).padStart(3, '0')}-${sample.arm}-${
          sample.variant
        }-${sample.kind}.json`,
        result
      );
      console.log(
        sample.childIndex,
        sample.arm,
        sample.variant,
        sample.kind,
        sample.rows,
        sample.throttle,
        result.passed ? 'passed' : `FAILED at ${result.stage}`
      );
      if (!result.passed) break;
    }
  } catch (error) {
    write('runner-failure.json', {
      stage: 'cohort',
      error: String(error.stack),
    });
    throw error;
  } finally {
    if (server.listening) await new Promise((yes) => server.close(yes));
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
}

function selfTest() {
  assertBaselineChild();
  let counter = 0;
  const schedule = makeSchedule(
    ['tanstack', 'v16'],
    () => `fixture-${counter++}`
  );
  assert.equal(schedule.length, 144);
  assert.equal(new Set(schedule.map((item) => item.processIdentity)).size, 144);
  assert.deepEqual(
    schedule.slice(0, 8).map(({ arm, variant, kind }) => [arm, variant, kind]),
    [
      ['tanstack', 'before', 'timing'],
      ['tanstack', 'before', 'memory'],
      ['tanstack', 'after', 'timing'],
      ['tanstack', 'after', 'memory'],
      ['v16', 'after', 'timing'],
      ['v16', 'after', 'memory'],
      ['v16', 'before', 'timing'],
      ['v16', 'before', 'memory'],
    ]
  );
  assert.deepEqual(
    schedule
      .slice(12, 16)
      .map(({ arm, variant, kind }) => [arm, variant, kind]),
    [
      ['v16', 'before', 'timing'],
      ['v16', 'before', 'memory'],
      ['v16', 'after', 'timing'],
      ['v16', 'after', 'memory'],
    ]
  );
  assert.equal(schedule.filter((item) => item.control).length, 24);
  for (const [index, item] of schedule.entries()) {
    assert.equal(item.childIndex, index);
    assert.equal(item.sampleIndex, Math.floor(index / 2));
    assert.equal(item.kind, index % 2 ? 'memory' : 'timing');
  }
  assert.equal(makeSchedule(['tanstack']).length, 84);
  assert.throws(() => makeSchedule([]));
  assert.throws(() => makeSchedule(['tanstack', 'tanstack']));
  assert.notEqual(
    hashBytes(
      childSource(readFileSync(baselineRunner, 'utf8')).replace(
        'workflowRounds',
        '21'
      )
    ),
    assertBaselineChild()
  );
  console.log(
    'dispatch-measure-variants self-test passed: exact baseline child, 84/144-child schedules, stable pair parity, separate kinds, unique identities and controls'
  );
}

// BASELINE_CHILD_START — copied byte-for-byte; do not alter its workload.
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
// BASELINE_CHILD_END
if (process.argv.length === 3 && process.argv[2] === '--self-test') selfTest();
else {
  assert.equal(
    process.argv.length,
    5,
    'dispatch-measure-variants.mjs BASE_PACKET VARIANT_PACKET NEW_OUT (or --self-test)'
  );
  await main(...process.argv.slice(2).map((path) => resolve(path)));
}
