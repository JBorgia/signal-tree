#!/usr/bin/env node
// Offline only. Never import a measurement driver: it launches browsers.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const self = fileURLToPath(import.meta.url);
const here = dirname(self);
const registeredArms = ['native', 'ngrx', 'tanstack', 'v15', 'v16'];
const profiles = [
  { rows: 1000, throttle: 1 },
  { rows: 1000, throttle: 4 },
  { rows: 10000, throttle: 1 },
];
const startupKeys = [
  'seed',
  'factory',
  'bootstrapToLayout',
  'navigationToLayout',
];
const actions = ['filter', 'toggle', 'membershipRename'];
const dispatchActions = [
  'assignStatus',
  'assignOwner',
  'planRequest',
  'rejectStatus',
  'acceptOwner',
  'acknowledgeProcessing',
];
const memoryNames = [
  'blank',
  'populated',
  'pending-128',
  'pending-128-preview-open',
  'settled-pruned',
  'settled-pruned-plus-100',
  'settled-pruned-plus-200',
  'before-pending-teardown',
  'after-destroy-before-late',
  'after-destroy-after-late',
];
const controlStages = {
  inventory: {
    'drop-filter': 'filter-pump',
    'stale-count': 'valid-add',
    'invalid-add': 'invalid-add',
    'stale-editor': 'retired-editor',
    'skip-destroy': 'destroy',
  },
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
};
const hashBytes = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sha = (path) => hashBytes(readFileSync(path));
const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const sameKeys = (object, keys, label) =>
  assert.deepEqual(Object.keys(object).sort(), [...keys].sort(), label);
const inside = (path, directory) => path.startsWith(directory + sep);
const finite = (value, label, signed = false) => {
  assert.ok(
    Number.isFinite(value) && (signed || value >= 0),
    `Invalid ${label}`
  );
  return value;
};
const p95 = (values) =>
  [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1];
function distribution(values) {
  assert.ok(values.length, 'Empty distribution');
  values.forEach((value) => finite(value, 'distribution value', true));
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return {
    n: sorted.length,
    min: sorted[0],
    median:
      sorted.length % 2
        ? sorted[middle]
        : (sorted[middle - 1] + sorted[middle]) / 2,
    max: sorted.at(-1),
  };
}
function bind(target, values) {
  for (const [path, hash] of Object.entries(values)) {
    assert.ok(
      isAbsolute(path) && /^[a-f0-9]{64}$/.test(hash),
      `Invalid binding ${path}`
    );
    if (Object.hasOwn(target, path))
      assert.equal(target[path], hash, `Conflicting binding ${path}`);
    target[path] = hash;
  }
}
function verify(bindings) {
  assert.ok(Object.keys(bindings).length, 'Missing file bindings');
  for (const [path, hash] of Object.entries(bindings)) {
    assert.ok(
      isAbsolute(path) && /^[a-f0-9]{64}$/.test(hash),
      `Invalid binding ${path}`
    );
    assert.equal(sha(path), hash, `Input drift: ${path}`);
  }
}
function required(bindings, path, expected = sha(path)) {
  assert.equal(bindings[path], expected, `Missing/wrong binding: ${path}`);
}
function receipt(path, receipts) {
  bind(receipts, { [path]: sha(path) });
  return read(path);
}
function files(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      assert.ok(
        !entry.isSymbolicLink(),
        `Unexpected symlink in source/served tree: ${path}`
      );
      return entry.isDirectory() ? files(path) : [path];
    })
    .sort();
}

// Reconstruct the registration independently, including stable-arm pair parity.
function expectedSchedule(arms, scenario = 'inventory') {
  const schedule = [];
  for (const profile of profiles) {
    for (let round = 0; round < 5; round++) {
      for (let position = 0; position < arms.length; position++) {
        const armIndex = (position + round) % arms.length;
        const variants =
          (round + armIndex) % 2 === 0
            ? ['before', 'after']
            : ['after', 'before'];
        for (const variant of variants)
          schedule.push({
            ...profile,
            round,
            arm: arms[armIndex],
            variant,
            control: false,
          });
      }
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
  }
  if (scenario === 'inventory') return schedule;
  assert.equal(scenario, 'dispatch');
  return schedule.flatMap(({ repeat, ...sample }, sampleIndex) =>
    ['timing', 'memory'].map((kind, index) => ({
      ...sample,
      ...(sample.control
        ? { controlPair: sample.round, controlMember: repeat }
        : {}),
      sampleIndex,
      childIndex: sampleIndex * 2 + index,
      kind,
    }))
  );
}
function metricsFor(result) {
  const metrics = {};
  const add = (name, value, unit, signed = false) => {
    metrics[name] = { value: finite(value, name, signed), unit, signed };
  };
  sameKeys(result.startup, startupKeys, 'Startup metric drift');
  for (const key of startupKeys)
    add(`startup.${key}`, result.startup[key], 'ms');
  sameKeys(
    result.milliseconds,
    actions.flatMap((name) => [name, name + 'P95']),
    'Action metric drift'
  );
  for (const name of actions) {
    const values = result.milliseconds[name];
    assert.ok(
      Array.isArray(values) && values.length === 30,
      `${name} requires exactly 30 actions`
    );
    values.forEach((value) => finite(value, name));
    const recomputed = p95(values);
    assert.equal(
      result.milliseconds[name + 'P95'],
      recomputed,
      `Wrong ${name} within-child p95`
    );
    add(`latency.${name}.withinChildP95`, recomputed, 'ms');
  }
  const h = result.heapBytes;
  sameKeys(
    h,
    ['baseline', 'populated', 'aging', 'observedPreGC', 'afterDestroy'],
    'Heap metric drift'
  );
  assert.ok(
    Array.isArray(h.aging) && h.aging.length === 2,
    'Expected two aging checkpoints'
  );
  const checkpoints = {
    blank: h.baseline,
    populated: h.populated,
    'aging-plus-200': h.aging[0],
    'aging-plus-400': h.aging[1],
    'after-destroy': h.afterDestroy,
  };
  for (const [name, value] of Object.entries(checkpoints)) {
    assert.ok(
      Number.isSafeInteger(value) && value >= 0,
      `Invalid whole-app heap ${name}`
    );
    add(`heap.${name}.postGC`, value, 'bytes');
    if (name !== 'blank')
      add(`heap.${name}.deltaFromBlank`, value - h.baseline, 'bytes', true);
  }
  add('heap.agingGrowth200To400', h.aging[1] - h.aging[0], 'bytes', true);
  add('heap.teardownDeltaFromAged', h.afterDestroy - h.aging[1], 'bytes', true);
  assert.ok(Number.isSafeInteger(h.observedPreGC) && h.observedPreGC >= 0);
  add('heap.observedPreGCHighWater', h.observedPreGC, 'bytes');
  return metrics;
}

function dispatchStages(kind) {
  if (kind === 'memory')
    return [
      'memory-blank',
      'bootstrap',
      'memory-populated',
      'memory-pending',
      'memory-awaiting-preview',
      'memory-settled-pruned',
      ...Array.from({ length: 200 }, (_, index) => `memory-aging-${index + 1}`),
      'memory-before-pending-teardown',
      'memory-destroy-pending',
      'memory-deliver-retired',
    ];
  const stages = ['bootstrap'];
  for (let round = 0; round < 20; round++) {
    stages.push(`round-${round}-assign-status`, `round-${round}-assign-owner`);
    if (round === 0) stages.push('late-preview');
    for (const name of [
      'plan-request',
      'reject-status',
      'accept-owner',
      'acknowledge-and-prune',
    ])
      stages.push(`round-${round}-${name}`);
  }
  return [...stages, 'destroy'];
}
function dispatchMetrics(result) {
  const metrics = {};
  const add = (name, value, unit, signed = false) => {
    metrics[name] = { value: finite(value, name, signed), unit, signed };
  };
  assert.ok(['timing', 'memory'].includes(result.kind));
  const stages = dispatchStages(result.kind);
  assert.deepEqual(
    result.stages,
    stages.map((name) => ({ name, passed: true })),
    'Missing/incorrect dispatch stage witnesses'
  );
  assert.equal(result.stage, stages.at(-1), 'Wrong final dispatch stage');
  if (result.kind === 'timing') {
    sameKeys(result.startup, startupKeys, 'Startup metric drift');
    for (const key of startupKeys)
      add(`startup.${key}`, result.startup[key], 'ms');
    assert.deepEqual(result.memory, []);
    assert.equal(result.retiredDelivery, undefined);
    assert.equal(result.observedPreGCHighWaterBytes, undefined);
    assert.ok(
      Array.isArray(result.workflow) && result.workflow.length === 20,
      'Exactly 20 dispatch workflow rounds required'
    );
    sameKeys(
      result.milliseconds,
      [...dispatchActions, 'latePreview'],
      'Dispatch metric drift'
    );
    for (const [round, item] of result.workflow.entries()) {
      assert.equal(item.round, round);
      assert.equal(item.statusCommand, `timing-status-${round}`);
      assert.equal(item.ownerCommand, `timing-owner-${round}`);
      assert.equal(item.intent, `timing-plan-${round}`);
      sameKeys(
        item.milliseconds,
        round === 0 ? [...dispatchActions, 'latePreview'] : dispatchActions,
        'Workflow timing drift'
      );
    }
    for (const name of dispatchActions) {
      const values = result.workflow.map((item) =>
        finite(item.milliseconds[name], name)
      );
      sameKeys(
        result.milliseconds[name],
        ['values', 'withinChildP95'],
        'Dispatch summary shape'
      );
      assert.deepEqual(
        result.milliseconds[name].values,
        values,
        'Dispatch raw values differ from workflow'
      );
      assert.equal(
        result.milliseconds[name].withinChildP95,
        p95(values),
        'Wrong dispatch within-child p95'
      );
      add(`latency.${name}.withinChildP95`, p95(values), 'ms');
    }
    assert.deepEqual(result.milliseconds.latePreview, {
      value: result.workflow[0].milliseconds.latePreview,
      observations: 1,
    });
    add(
      'latency.latePreview.singleObservation',
      result.milliseconds.latePreview.value,
      'ms'
    );
  } else {
    assert.equal(result.startup, undefined);
    assert.equal(result.milliseconds, undefined);
    assert.deepEqual(result.workflow, []);
    assert.deepEqual(
      result.memory.map((point) => point.name),
      memoryNames,
      'Missing/reordered memory checkpoints'
    );
    const blank = result.memory[0].postGCBytes;
    for (const point of result.memory) {
      for (const key of ['preGCBytes', 'postGCBytes'])
        assert.ok(
          Number.isSafeInteger(point[key]) && point[key] >= 0,
          'Invalid heap bytes'
        );
      assert.equal(
        point.deltaFromBlankBytes,
        point.postGCBytes - blank,
        'Wrong memory checkpoint delta'
      );
      add(`heap.${point.name}.preGC`, point.preGCBytes, 'bytes');
      add(`heap.${point.name}.postGC`, point.postGCBytes, 'bytes');
      if (point.name !== 'blank')
        add(
          `heap.${point.name}.deltaFromBlank`,
          point.postGCBytes - blank,
          'bytes',
          true
        );
    }
    assert.equal(
      result.observedPreGCHighWaterBytes,
      Math.max(...result.memory.map((point) => point.preGCBytes))
    );
    add(
      'heap.observedPreGCHighWater',
      result.observedPreGCHighWaterBytes,
      'bytes'
    );
    add(
      'heap.agingGrowth100To200',
      result.memory[6].postGCBytes - result.memory[5].postGCBytes,
      'bytes',
      true
    );
    add(
      'heap.teardownDeltaFromAged',
      result.memory[8].postGCBytes - result.memory[6].postGCBytes,
      'bytes',
      true
    );
    add(
      'heap.lateDeliveryDelta',
      result.memory[9].postGCBytes - result.memory[8].postGCBytes,
      'bytes',
      true
    );
    assert.deepEqual(
      result.retiredDelivery,
      { applications: 265, starts: 0, publicationAttempts: 0 },
      'Retired delivery witness failed'
    );
    const states = [
      null,
      [0, 0, 0, false, 0, 0],
      [128, 128, 0, false, 128, 0],
      [128, 128, 0, true, 128, 0],
      [0, 0, 0, true, 128, 64],
      [0, 0, 0, true, 228, 164],
      [0, 0, 0, true, 328, 264],
      [1, 1, 1, true, 329, 264],
    ];
    for (let index = 1; index < states.length; index++) {
      const state = result.memory[index].state;
      assert.deepEqual(
        [
          state.operations,
          state.unresolved,
          state.publications,
          state.previewOpen,
          state.requests,
          state.applications,
        ],
        states[index]
      );
      for (const key of [
        'publicationStarts',
        'publicationAttempts',
        'acknowledgements',
      ])
        assert.equal(state[key], 0);
      assert.equal(
        state.previewPending,
        index < 3 ? undefined : index === 3 ? 128 : index === 7 ? 1 : 0
      );
    }
    for (const index of [0, 8, 9])
      assert.equal(
        result.memory[index].state,
        undefined,
        'Retired session state retained in checkpoint'
      );
  }
  return metrics;
}
function baselineChildHash() {
  const extract = (path) => {
    const source = readFileSync(path, 'utf8');
    const start = source.indexOf('\nasync function runChild(sample) {') + 1;
    const end = source.indexOf('\n}\n', start);
    assert.ok(start > 0 && end > start, 'Missing baseline child source');
    return source.slice(start, end + 2);
  };
  const baseline = extract(join(here, 'dispatch-measure.mjs'));
  assert.equal(
    extract(join(here, 'dispatch-measure-variants.mjs')),
    baseline,
    'Variant child differs from baseline'
  );
  return hashBytes(baseline);
}

function loadMeasurements(
  packets,
  arms,
  bindings,
  directory,
  receipts,
  scenario = 'inventory'
) {
  assert.ok(
    !existsSync(join(directory, 'runner-failure.json')),
    'Runner failure receipt forbids comparison'
  );
  const preflight = receipt(join(directory, 'preflight.json'), receipts);
  const schedulePath = join(directory, 'schedule.json');
  const schedule = receipt(schedulePath, receipts);
  const aggregate = receipt(join(directory, 'results.json'), receipts);
  assert.equal(preflight.passed, true, 'Preflight did not pass');
  assert.ok(!preflight.error, 'Preflight contains an error');
  for (const document of [preflight, schedule]) {
    assert.deepEqual(document.packets, packets, 'Wrong packet paths');
    assert.deepEqual(document.arms, arms, 'Wrong selected arm order');
    assert.deepEqual(
      document.bindings,
      bindings,
      'Missing/extra/different input bindings'
    );
  }
  assert.deepEqual(aggregate.bindings, bindings, 'Aggregate binding mismatch');
  assert.equal(
    aggregate.scheduleSha256,
    sha(schedulePath),
    'Schedule hash mismatch'
  );
  if (scenario === 'inventory') {
    assert.equal(schedule.operationRoundsPerSample, 30);
    assert.deepEqual(schedule.timedOperationsPerSample, {
      filter: 30,
      toggle: 30,
      membershipRename: 30,
    });
  } else {
    assert.equal(schedule.mode, 'compare-variants');
    assert.equal(schedule.scenario, 'dispatch');
    assert.equal(preflight.childEngineSha256, baselineChildHash());
    assert.equal(schedule.childEngineSha256, preflight.childEngineSha256);
    assert.deepEqual(schedule.workload, {
      workflowRounds: 20,
      pendingCommands: 128,
      agingCheckpoints: [100, 200],
      timingOrder: [
        'assignStatus',
        'assignOwner',
        'latePreview (first round only)',
        'planRequest',
        'rejectStatus',
        'acceptOwner',
        'acknowledgeProcessing',
      ],
    });
  }
  assert.ok(
    typeof schedule.createdUTC === 'string' &&
      Number.isFinite(Date.parse(schedule.createdUTC))
  );
  for (const key of ['node', 'cpu', 'platform', 'release', 'arch'])
    assert.ok(
      typeof schedule.host?.[key] === 'string' && schedule.host[key].length,
      `Missing host ${key}`
    );
  for (const key of [
    'timing',
    'limits',
    ...(scenario === 'dispatch' ? ['memory', 'statistics'] : []),
  ])
    assert.ok(typeof schedule[key] === 'string' && schedule[key].length);
  const expected = expectedSchedule(arms, scenario);
  const processIdentities = new Set();
  if (scenario === 'dispatch')
    for (let index = 0; index < expected.length; index++) {
      const identity = schedule.schedule[index]?.processIdentity;
      assert.ok(
        typeof identity === 'string' && identity.length > 0,
        'Missing child process identity'
      );
      assert.ok(
        !processIdentities.has(identity),
        'Reused child process identity'
      );
      processIdentities.add(identity);
      expected[index].processIdentity = identity;
    }
  assert.deepEqual(
    schedule.schedule,
    expected,
    'Incomplete or unregistered schedule'
  );
  assert.equal(
    aggregate.results.length,
    expected.length,
    'Incomplete comparison'
  );
  const childNames = expected.map(
    (sample, index) =>
      `${String(index).padStart(3, '0')}-${sample.arm}-${sample.variant}${
        scenario === 'dispatch' ? '-' + sample.kind : ''
      }.json`
  );
  assert.deepEqual(
    readdirSync(directory)
      .filter((name) => /^\d+.*\.json$/.test(name))
      .sort(),
    [...childNames].sort(),
    'Missing/extra child receipts'
  );
  const pids = new Set(),
    versions = new Set();
  const samples = aggregate.results.map((result, index) => {
    const expectedSample = expected[index];
    for (const [key, value] of Object.entries(expectedSample))
      assert.deepEqual(
        result[key],
        value,
        `Wrong child ${index} identity ${key}`
      );
    if (!expectedSample.control)
      assert.equal(
        result.repeat,
        undefined,
        'Main sample marked as a control repeat'
      );
    if (scenario === 'inventory') assert.equal(result.index, index);
    else {
      assert.equal(result.process?.identity, expectedSample.processIdentity);
      assert.equal(result.repeat, undefined);
      if (!expectedSample.control) {
        assert.equal(result.controlPair, undefined);
        assert.equal(result.controlMember, undefined);
      }
    }
    assert.equal(result.passed, true, `Failed child ${index}`);
    assert.ok(!result.error, `Error in child ${index}`);
    for (const name of ['failures', 'browserErrors', 'finalizationErrors'])
      if (Object.hasOwn(result, name))
        assert.deepEqual(result[name], [], `Failure in child ${index}`);
    for (const name of ['browserPid', 'harnessPid'])
      assert.ok(
        Number.isSafeInteger(result.process?.[name]) &&
          result.process[name] > 0,
        `Missing process ${name}`
      );
    assert.ok(!pids.has(result.process.browserPid), 'Reused browser PID');
    pids.add(result.process.browserPid);
    const browserVersion =
      scenario === 'inventory' ? result.browser : result.process.browserVersion;
    assert.ok(
      typeof browserVersion === 'string' && browserVersion.length,
      'Missing browser version'
    );
    versions.add(browserVersion);
    for (const host of scenario === 'inventory'
      ? [result.host]
      : [result.hostStart, result.hostEnd]) {
      assert.ok(Array.isArray(host?.load) && host.load.length === 3);
      host.load.forEach((value) => finite(value, 'host load'));
      finite(host.freeBytes, 'host free bytes');
    }
    const path = join(directory, childNames[index]);
    assert.deepEqual(
      receipt(path, receipts),
      result,
      `Aggregate/raw child mismatch: ${path}`
    );
    return {
      result,
      receipt: { path, sha256: receipts[path] },
      metrics:
        scenario === 'inventory' ? metricsFor(result) : dispatchMetrics(result),
    };
  });
  assert.equal(versions.size, 1, 'Browser version drift');
  verify(bindings);
  return { schedule, samples, browserVersion: [...versions][0] };
}

function loadBuild(packet, plan, scenario, receipts) {
  const path = join(
    packet,
    scenario === 'inventory' ? 'build.json' : 'dispatch-build.json'
  );
  const build = receipt(path, receipts);
  assert.equal(
    build.planSha256,
    sha(join(packet, 'plan.json')),
    'Build/plan mismatch'
  );
  sameKeys(build.arms, plan.arms, 'Build arm mismatch');
  return { path, build };
}
function admitBuild(
  packet,
  plan,
  scenario,
  loaded,
  bindings,
  receipts,
  bindEvidence = false
) {
  const checker = join(here, `${scenario}-check.mjs`);
  const conformancePath = join(packet, `${scenario}-conformance/results.json`);
  const conformance = receipt(conformancePath, receipts);
  assert.equal(conformance.planSha256, loaded.build.planSha256);
  assert.equal(conformance.buildSha256, sha(loaded.path));
  assert.equal(conformance.runnerSha256, sha(checker));
  assert.deepEqual(
    conformance.controls,
    controlStages[scenario],
    'Conformance control/stage drift'
  );
  const faults = Object.keys(controlStages[scenario]);
  assert.equal(
    conformance.results.length,
    plan.arms.length * (faults.length + 1)
  );
  for (const arm of plan.arms) {
    const runs = conformance.results.filter((run) => run.arm === arm);
    assert.deepEqual(
      runs.map((run) => run.fault ?? 'baseline').sort(),
      ['baseline', ...faults].sort(),
      'Missing/duplicate conformance case'
    );
    for (const run of runs) {
      assert.equal(run.passed, true, `Conformance failed: ${arm}/${run.fault}`);
      if (run.fault === null)
        assert.ok(!run.error, 'Baseline conformance has an error');
      else {
        assert.equal(run.detectedAt, controlStages[scenario][run.fault]);
        assert.ok(
          typeof run.error === 'string' && run.error.length,
          'Planted fault not detected'
        );
        assert.deepEqual(
          run.browserErrors,
          [],
          'Browser error masquerades as detected fault'
        );
      }
      const raw = join(
        packet,
        `${scenario}-conformance/${arm}-${run.fault ?? 'baseline'}.json`
      );
      assert.deepEqual(
        receipt(raw, receipts),
        run,
        'Conformance aggregate/raw mismatch'
      );
      if (bindEvidence) bind(bindings, { [raw]: receipts[raw] });
    }
  }
  bind(bindings, {
    [checker]: sha(checker),
    [loaded.path]: sha(loaded.path),
    [conformancePath]: sha(conformancePath),
  });
  return plan.arms.map((arm) => {
    const selected = loaded.build.arms[arm],
      work = join(packet, arm);
    bind(bindings, selected.dependencies);
    bind(bindings, selected.served);
    const statsPath = join(work, 'dist', scenario, 'stats.json');
    const stats = receipt(statsPath, receipts);
    if (bindEvidence) bind(bindings, { [statsPath]: receipts[statsPath] });
    assert.equal(
      receipts[statsPath],
      selected.statsSha256,
      'Build stats mismatch'
    );
    const dependencies = {};
    for (const name of Object.keys(stats.inputs)) {
      const input = resolve(work, name);
      if (existsSync(input)) dependencies[realpathSync(input)] = sha(input);
      else
        assert.ok(
          name.startsWith('angular:'),
          `Unbound nonvirtual build input: ${name}`
        );
    }
    assert.deepEqual(
      selected.dependencies,
      dependencies,
      'Dependency closure differs from build stats'
    );
    const servedFiles = files(join(work, 'dist', scenario, 'browser'));
    assert.deepEqual(
      Object.keys(selected.served).sort(),
      servedFiles,
      'Served file inventory mismatch'
    );
    assert.deepEqual(
      selected.entryFiles.map((name) => resolve(work, name)).sort(),
      servedFiles,
      'Served entry list mismatch'
    );
    const scripts = servedFiles.filter((name) => name.endsWith('.js'));
    assert.ok(scripts.length, 'No served JavaScript');
    const rawBytes = scripts.reduce(
      (sum, name) => sum + readFileSync(name).length,
      0
    );
    const gzipBytes = scripts.reduce(
      (sum, name) => sum + gzipSync(readFileSync(name)).length,
      0
    );
    assert.equal(rawBytes, selected.jsBytes, 'Wrong recorded served JS bytes');
    assert.equal(
      gzipBytes,
      selected.jsGzipBytes,
      'Wrong recorded served JS gzip bytes'
    );
    return {
      scenario,
      arm,
      rawBytes,
      gzipBytes,
      scriptCount: scripts.length,
      scripts: scripts.map((path) => ({ path, sha256: selected.served[path] })),
      buildReceipt: { path: loaded.path, sha256: receipts[loaded.path] },
    };
  });
}

function validateVariants(
  packets,
  plans,
  baselineBuilds,
  scenario = 'inventory'
) {
  const before = plans.before,
    after = plans.after;
  assert.deepEqual(
    before.arms,
    registeredArms,
    'Unregistered baseline arm cohort'
  );
  assert.deepEqual(after.arms, before.arms);
  for (const key of ['toolchainDirectory', 'node', 'host'])
    assert.deepEqual(
      after[key],
      before[key],
      `Changed common toolchain/host ${key}`
    );
  assert.ok(!before.variant, 'BASE_PACKET must be the original baseline');
  assert.equal(
    after.variant.baselinePlanPath,
    join(packets.before, 'plan.json')
  );
  assert.equal(
    after.variant.baselinePlanSha256,
    sha(after.variant.baselinePlanPath)
  );
  const replacements = after.variant.replacements;
  assert.ok(
    Array.isArray(replacements) && replacements.length,
    'No replacements'
  );
  const changed = new Map();
  for (const item of replacements) {
    assert.ok(before.arms.includes(item.arm));
    assert.ok(['inventory', 'dispatch'].includes(item.scenario));
    const suffix = `${item.arm}/src/arms/${
      item.scenario === 'inventory' ? 'selected.ts' : 'selected-dispatch.ts'
    }`;
    assert.equal(item.destination, join(packets.after, suffix));
    assert.ok(isAbsolute(item.source) && item.source.endsWith('.ts'));
    assert.ok(!changed.has(item.destination), 'Duplicate replacement');
    changed.set(item.destination, item);
    required(before.inputs, join(packets.before, suffix), item.beforeSha256);
    required(after.inputs, item.destination, item.afterSha256);
    required(after.inputs, item.source, item.afterSha256);
    assert.notEqual(item.beforeSha256, item.afterSha256, 'No-op replacement');
  }
  // The preparer also copies build dependencies. Resolve the same /var versus
  // /private/var aliases without losing the lexical paths in the receipts.
  const originalInputs = { ...before.inputs };
  for (const { build } of Object.values(baselineBuilds))
    for (const arm of Object.values(build.arms))
      bind(originalInputs, arm.dependencies);
  const baselinePrefixes = [
    ...new Set([packets.before, realpathSync(packets.before)]),
  ];
  // Every original common/generated/runtime input remains bound. Only declared
  // selected arm files may differ; additional metadata does not waive this.
  for (const [path, hash] of Object.entries(originalInputs)) {
    const prefix = baselinePrefixes.find((candidate) =>
      inside(path, candidate)
    );
    const mapped = prefix ? join(packets.after, relative(prefix, path)) : path;
    required(after.inputs, mapped, changed.get(mapped)?.afterSha256 ?? hash);
  }
  const common = [
    'src/main.ts',
    'src/model.ts',
    'src/index.html',
    'src/arm.ts',
    'src/dispatch-main.ts',
    'src/dispatch-model.ts',
    'src/dispatch-backend.ts',
    'src/dispatch.html',
    'src/dispatch-arm.ts',
    'package.json',
    'tsconfig.json',
    'angular.json',
  ];
  for (const arm of before.arms) {
    for (const relativePath of [
      ...common,
      'src/arms/selected.ts',
      'src/arms/selected-dispatch.ts',
    ]) {
      const first = join(packets.before, arm, relativePath),
        second = join(packets.after, arm, relativePath);
      required(before.inputs, first);
      required(after.inputs, second);
      assert.equal(
        sha(second),
        changed.get(second)?.afterSha256 ?? sha(first),
        `Unregistered change: ${second}`
      );
    }
    // A new unregistered helper cannot silently enter the candidate source tree.
    const beforeFiles = files(join(packets.before, arm, 'src'));
    assert.deepEqual(
      files(join(packets.after, arm, 'src')).map((path) =>
        relative(packets.after, path)
      ),
      beforeFiles.map((path) => relative(packets.before, path)),
      'Generated source inventory changed'
    );
    for (const path of beforeFiles) {
      required(before.inputs, path);
      const mapped = join(packets.after, relative(packets.before, path));
      required(
        after.inputs,
        mapped,
        changed.get(mapped)?.afterSha256 ?? before.inputs[path]
      );
    }
  }
  sameKeys(
    after.artifacts,
    Object.keys(before.artifacts),
    'Runtime artifact set changed'
  );
  for (const [name, first] of Object.entries(before.artifacts)) {
    const second = after.artifacts[name];
    assert.deepEqual(
      { ...second, archive: first.archive },
      first,
      `Runtime identity changed: ${name}`
    );
    for (const [plan, artifact] of [
      [before, first],
      [after, second],
    ]) {
      required(plan.inputs, artifact.archive);
      assert.equal(
        'sha512-' +
          createHash('sha512')
            .update(readFileSync(artifact.archive))
            .digest('base64'),
        artifact.integrity
      );
    }
    assert.equal(
      sha(first.archive),
      sha(second.archive),
      `Runtime bytes changed: ${name}`
    );
  }
  for (const filename of ['package.json', 'package-lock.json'])
    required(before.inputs, join(before.toolchainDirectory, filename));
  const sourceFiles = [
    'lab.mjs',
    'inventory-check.mjs',
    'dispatch-check.mjs',
    'measure.mjs',
    'dispatch-measure.mjs',
    'profile.mjs',
    'model.ts',
    'inventory-main.ts',
    'dispatch-main.ts',
    'dispatch-model.ts',
    'dispatch-backend.ts',
    ...['native', 'ngrx', 'tanstack', 'signaltree'].flatMap((arm) =>
      ['inventory', 'dispatch'].map((scenario) => `arms/${arm}-${scenario}.ts`)
    ),
  ];
  for (const name of sourceFiles) required(before.inputs, join(here, name));
  required(
    before.inputs,
    resolve(
      here,
      '../../docs/audits/2026-11-11-application-comparison/PROTOCOL.md'
    )
  );
  for (const path of [
    join(here, 'prepare-variant.mjs'),
    resolve(
      here,
      '../../docs/audits/2026-11-11-application-comparison/IMPROVEMENTS.md'
    ),
    join(packets.before, 'plan.json'),
    ...Object.values(baselineBuilds).map((item) => item.path),
  ])
    required(after.inputs, path);
  const command = after.variant.command;
  assert.ok(
    Array.isArray(command) && command.length === 5,
    'Missing preparation command'
  );
  assert.equal(command[1], join(here, 'prepare-variant.mjs'));
  assert.equal(resolve(command[2]), packets.before);
  assert.equal(resolve(command[3]), packets.after);
  const selectionPath = resolve(command[4]);
  required(after.inputs, selectionPath);
  const selection = read(selectionPath);
  assert.deepEqual(
    selection.replacements.map(({ arm, scenario, source }) => ({
      arm,
      scenario,
      source: resolve(source),
    })),
    replacements.map(({ arm, scenario, source }) => ({
      arm,
      scenario,
      source,
    })),
    'Selection/plan mismatch'
  );
  const arms = before.arms.filter((arm) =>
    replacements.some((item) => item.arm === arm && item.scenario === scenario)
  );
  assert.ok(arms.length, `No ${scenario} variant to measure`);
  return {
    arms,
    replacements,
    needsDispatch: replacements.some((item) => item.scenario === 'dispatch'),
    needsInventory: replacements.some((item) => item.scenario === 'inventory'),
  };
}

function sourceInventory(packets, plans) {
  const measure = (variant, arm, name) => {
    const path = join(packets[variant], arm, 'src', name),
      content = readFileSync(path);
    required(plans[variant].inputs, path, hashBytes(content));
    const lines = content.toString('utf8').split(/\r?\n/);
    if (lines.at(-1) === '') lines.pop();
    return {
      path,
      sha256: hashBytes(content),
      utf8Bytes: content.length,
      physicalLines: lines.length,
      nonblankLines: lines.filter((line) => line.trim()).length,
    };
  };
  return Object.fromEntries(
    ['before', 'after'].map((variant) => [
      variant,
      Object.fromEntries(
        plans[variant].arms.map((arm) => [
          arm,
          {
            inventory: measure(variant, arm, 'arms/selected.ts'),
            dispatch: measure(variant, arm, 'arms/selected-dispatch.ts'),
            commonExcluded: [
              'main.ts',
              'model.ts',
              'dispatch-main.ts',
              'dispatch-model.ts',
              'dispatch-backend.ts',
            ].map((name) => measure(variant, arm, name)),
            ...(arm.startsWith('v')
              ? { facadeShim: measure(variant, arm, 'st-open.ts') }
              : {}),
          },
        ])
      ),
    ])
  );
}
function pairMetrics(pairs) {
  return Object.fromEntries(
    Object.keys(pairs[0].before.metrics).map((name) => {
      const { unit, signed } = pairs[0].before.metrics[name];
      const samples = pairs.map(({ round, before, after }) => {
        const b = before.metrics[name],
          a = after.metrics[name];
        assert.equal(a.unit, unit);
        assert.equal(b.unit, unit);
        assert.equal(a.signed, signed);
        assert.equal(b.signed, signed);
        const ratioAvailable = !signed && b.value > 0 && a.value >= 0;
        return {
          round,
          before: b.value,
          after: a.value,
          difference: a.value - b.value,
          ratioAvailable,
          ratio: ratioAvailable ? a.value / b.value : null,
          ...(!ratioAvailable
            ? {
                ratioUnavailable: signed
                  ? 'Signed checkpoint delta: use the signed difference.'
                  : 'Nonpositive denominator or negative numerator: use the difference.',
              }
            : {}),
          beforeReceipt: before.receipt,
          afterReceipt: after.receipt,
        };
      });
      const ratios = samples
        .filter((sample) => sample.ratioAvailable)
        .map((sample) => sample.ratio);
      return [
        name,
        {
          unit,
          signed,
          pairedN: pairs.length,
          before: distribution(samples.map((sample) => sample.before)),
          after: distribution(samples.map((sample) => sample.after)),
          difference: distribution(samples.map((sample) => sample.difference)),
          ratio: ratios.length ? distribution(ratios) : null,
          availableRatioN: ratios.length,
          unavailableRatioN: pairs.length - ratios.length,
          samples,
        },
      ];
    })
  );
}
function summarize(profile, arms, samples, kind = 'inventory') {
  const selected = samples.filter(
    ({ result }) =>
      result.rows === profile.rows &&
      result.throttle === profile.throttle &&
      (kind === 'inventory' || result.kind === kind)
  );
  const find = (arm, round, variant, control, repeat) => {
    const values = selected.filter(
      ({ result: r }) =>
        r.arm === arm &&
        r.round === round &&
        r.variant === variant &&
        r.control === control &&
        (kind === 'inventory' ? r.repeat : r.controlMember) === repeat
    );
    assert.equal(values.length, 1, 'Missing/duplicate paired sample');
    return values[0];
  };
  return {
    profile,
    kind,
    arms: Object.fromEntries(
      arms.map((arm) => [
        arm,
        {
          direction:
            'after / before, matched arm, profile and round; difference = after - before',
          metrics: pairMetrics(
            [0, 1, 2, 3, 4].map((round) => ({
              round,
              before: find(arm, round, 'before', false),
              after: find(arm, round, 'after', false),
            }))
          ),
        },
      ])
    ),
    sameArmControls: {
      arm: 'v15',
      variant: 'before',
      direction:
        'Second baseline duplicate / first baseline duplicate; separate two pairs, not a confidence interval',
      metrics: pairMetrics(
        [0, 1].map((round) => ({
          round,
          before: find('v15', round, 'before', true, 0),
          after: find('v15', round, 'before', true, 1),
        }))
      ),
    },
  };
}
const format = (value) => Number(value.toPrecision(6)).toString();
const display = (stat) =>
  stat
    ? `${format(stat.median)} [${format(stat.min)}, ${format(stat.max)}] (n=${
        stat.n
      })`
    : 'unavailable';
function markdown(report) {
  const lines = [
    '# Matched application variants',
    '',
    'Complete registered schedules, raw receipts, conformance, source bindings and served bytes passed offline validation. Values are median [min, max]. Repeated-stage latency uses independently recomputed child p95; late preview remains a single observation per child. Operations and timing/memory children are not pooled.',
    '',
    `Command: \`${report.command
      .map((arg) => JSON.stringify(arg))
      .join(' ')}\``,
    '',
  ];
  for (const cohort of report.cohorts) {
    lines.push(
      `## ${cohort.profile.rows} rows / CDP ${cohort.profile.throttle}× / ${cohort.kind}`,
      ''
    );
    for (const [arm, data] of [
      ...Object.entries(cohort.arms),
      ['v15 baseline A/A controls', cohort.sameArmControls],
    ]) {
      lines.push(
        `### ${arm}`,
        '',
        data.direction,
        '',
        '| Metric (unit) | Before | After | Paired difference | Paired ratio |',
        '| --- | ---: | ---: | ---: | ---: |'
      );
      for (const [name, metric] of Object.entries(data.metrics))
        lines.push(
          `| ${name} (${metric.unit}) | ${display(metric.before)} | ${display(
            metric.after
          )} | ${display(metric.difference)} | ${display(metric.ratio)} |`
        );
      lines.push('');
    }
  }
  lines.push(
    '## Served JavaScript',
    '',
    'Sum of all served .js files, default Node gzip per file; includes framework/application/dependency code. Maps, CSS and HTML are excluded from byte totals but remain hash-bound.',
    '',
    '| Variant | Scenario | Arm | Raw bytes | Gzip bytes |',
    '| --- | --- | --- | ---: | ---: |'
  );
  for (const item of report.payload)
    lines.push(
      `| ${item.variant} | ${item.scenario} | ${item.arm} | ${item.rawBytes} | ${item.gzipBytes} |`
    );
  lines.push(
    '',
    '## Limits',
    '',
    ...report.limits.map((limit) => `- ${limit}`),
    '',
    'JSON preserves individual matched values, differences, ratio availability, raw receipt hashes, host observations and source inventory.',
    ''
  );
  return lines.join('\n');
}

function analyze(
  beforePacket,
  afterPacket,
  directory,
  out,
  scenario = 'inventory'
) {
  assert.ok(['inventory', 'dispatch'].includes(scenario), 'Unknown scenario');
  assert.ok(!existsSync(out), 'Output must be new; preserve prior attempts');
  for (const parent of [
    resolve(here, '../..'),
    beforePacket,
    afterPacket,
    directory,
  ])
    assert.ok(
      out !== parent && !inside(out, parent),
      'Output must be outside source/evidence directories'
    );
  mkdirSync(out, { recursive: true });
  const write = (name, value) =>
    writeFileSync(join(out, name), value, { flag: 'wx' });
  const command = [
    process.execPath,
    self,
    beforePacket,
    afterPacket,
    directory,
    out,
    ...(scenario === 'dispatch' ? [scenario] : []),
  ];
  try {
    assert.notEqual(
      realpathSync(beforePacket),
      realpathSync(afterPacket),
      'Packets must differ'
    );
    const packets = { before: beforePacket, after: afterPacket },
      plans = {},
      builds = {};
    const measureRunner = join(
      here,
      scenario === 'inventory'
        ? 'measure-variants.mjs'
        : 'dispatch-measure-variants.mjs'
    );
    const receipts = { [self]: sha(self) };
    const bindings = { [measureRunner]: sha(measureRunner) };
    if (scenario === 'dispatch')
      bind(bindings, {
        [join(here, 'dispatch-measure.mjs')]: sha(
          join(here, 'dispatch-measure.mjs')
        ),
      });
    for (const variant of ['before', 'after']) {
      const path = join(packets[variant], 'plan.json');
      plans[variant] = receipt(path, receipts);
      bind(bindings, { ...plans[variant].inputs, [path]: sha(path) });
      builds[variant] = {};
    }
    // Preparation always binds both original builds; changed scenarios need
    // exact fresh qualification for each packet, including all raw controls.
    for (const name of ['inventory', 'dispatch'])
      builds.before[name] = loadBuild(
        packets.before,
        plans.before,
        name,
        receipts
      );
    const selection = validateVariants(packets, plans, builds.before, scenario);
    const admittedScenarios =
      scenario === 'inventory'
        ? ['inventory', ...(selection.needsDispatch ? ['dispatch'] : [])]
        : ['dispatch', ...(selection.needsInventory ? ['inventory'] : [])];
    const payload = [];
    for (const variant of ['before', 'after'])
      for (const name of admittedScenarios) {
        builds[variant][name] ??= loadBuild(
          packets[variant],
          plans[variant],
          name,
          receipts
        );
        payload.push(
          ...admitBuild(
            packets[variant],
            plans[variant],
            name,
            builds[variant][name],
            bindings,
            receipts,
            scenario === 'dispatch'
          ).map((item) => ({ ...item, variant }))
        );
      }
    verify(bindings);
    const run = loadMeasurements(
      packets,
      selection.arms,
      bindings,
      directory,
      receipts,
      scenario
    );
    assert.equal(
      run.schedule.host.node,
      plans.before.node,
      'Measurement/preparation Node identity differs'
    );
    const report = {
      schemaVersion: 1,
      scenario,
      createdUTC: new Date().toISOString(),
      command,
      analyzerSha256: receipts[self],
      analyzerNode: process.version,
      packets,
      directory,
      arms: selection.arms,
      replacements: selection.replacements,
      browserVersion: run.browserVersion,
      measurement: {
        host: run.schedule.host,
        timing: run.schedule.timing,
        limits: run.schedule.limits,
        memory: run.schedule.memory,
        statistics: run.schedule.statistics,
        childEngineSha256: run.schedule.childEngineSha256,
        reconstructedCommand: [
          process.execPath,
          measureRunner,
          beforePacket,
          afterPacket,
          directory,
        ],
        commandNote:
          'Reconstructed from validated paths and runner; original argv is not in measurement receipts. Reproduction needs a new output directory.',
        childHostObservations: run.samples.map(({ result, receipt: raw }) => ({
          index: scenario === 'inventory' ? result.index : result.childIndex,
          arm: result.arm,
          variant: result.variant,
          kind: result.kind,
          ...(scenario === 'inventory'
            ? result.host
            : { start: result.hostStart, end: result.hostEnd }),
          process: result.process,
          receipt: raw,
        })),
      },
      validation: {
        complete: true,
        comparisonRounds: 5,
        aaPairsPerProfile: 2,
        childCount: run.samples.length,
        dispatchConformanceRequired: admittedScenarios.includes('dispatch'),
        inventoryConformanceRequired: admittedScenarios.includes('inventory'),
        bindings,
        receipts,
      },
      cohorts: profiles.flatMap((profile) =>
        (scenario === 'inventory' ? ['inventory'] : ['timing', 'memory']).map(
          (kind) => summarize(profile, selection.arms, run.samples, kind)
        )
      ),
      payload,
      sourceInventory: sourceInventory(packets, plans),
      limits: [
        'Five fresh-browser children before and five after per selected arm/profile, matched by round. Min/median/max and ratios are descriptive; no significance, population tail, confidence interval or winner claim.',
        'A/A uses two separate v15 baseline pairs per profile and is not pooled with main samples. A ratio is after/before only for nonsigned metrics with a positive denominator; signed checkpoint deltas always retain differences without ratios.',
        scenario === 'inventory'
          ? 'Synthetic DOM event through Angular stabilization and forced layout is not INP. Rename input preparation is outside the timer. Initial iterations are retained; startup stages overlap and must not be added.'
          : 'Unchanged baseline dispatch child: 20 workflow rounds, repeated-stage p95 and one late-preview observation. Synthetic events/service replies/local acknowledgement through stabilization/layout are not INP or network latency. Timing and memory use separate fresh browser children; memory-child duration is not timing evidence. Startup stages overlap.',
        'Heap is whole-application JS used bytes at forced-GC checkpoints. Observed pre-GC high water is not a true peak or allocation total. Finite aging/teardown does not establish leak freedom or unlimited boundedness.',
        scenario === 'inventory'
          ? 'Both variants include the new 30-action membership rename trace. Heap/aging results are not pooled with the original inventory cohort.'
          : 'Dispatch heap includes deterministic service logs and used-ID strings. The after-destroy-before-late checkpoint retains the old backend intentionally; late delivery releases it. State/checkpoint witnesses verify no late publication, not general unlimited retention.',
        'Shared-host contention and CDP throttling are limitations; factors are not calibrated device classes. Child host observations are preserved, not corrected into fictional uncontended timings.',
        'Production served JavaScript includes bundled framework/application dependencies. Gzip uses this analyzer Node version and default per-file compression. Source inventory counts UTF-8 bytes and physical/nonblank lines including comments/types/imports; it does not measure complexity, productivity or human effort.',
        'Hash/receipt checks establish internal evidence consistency, not signed provenance or proof that every possible trace was exercised. Unrecorded intermediate states cannot be reconstructed from timings; the bound runner supplies the stage assertions.',
      ],
    };
    verify(bindings);
    verify(receipts);
    write('summary.json', JSON.stringify(report, null, 2) + '\n');
    write('summary.md', markdown(report));
    write(
      'receipt.json',
      JSON.stringify(
        {
          command,
          analyzerSha256: receipts[self],
          summarySha256: sha(join(out, 'summary.json')),
          markdownSha256: sha(join(out, 'summary.md')),
        },
        null,
        2
      ) + '\n'
    );
    console.log(
      `Validated ${run.samples.length} variant children; wrote ${out}`
    );
  } catch (error) {
    write(
      'validation-failure.json',
      JSON.stringify(
        {
          passed: false,
          command,
          analyzerSha256: sha(self),
          error: String(error.stack),
        },
        null,
        2
      ) + '\n'
    );
    throw error;
  }
}

function selfTest() {
  // Tiny synthetic receipts exercise the same loader without a browser/build.
  const root = mkdtempSync(join(tmpdir(), 'st-analyze-variants-test-'));
  try {
    const directory = join(root, 'comparison');
    mkdirSync(directory);
    const put = (path, value) =>
      writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
    const input = join(root, 'bound-input.txt');
    writeFileSync(input, 'immutable fixture');
    const bindings = { [input]: sha(input) };
    const packets = {
      before: join(root, 'before'),
      after: join(root, 'after'),
    };
    const arms = ['tanstack', 'v16'];
    const schedule = {
      createdUTC: '2026-11-11T00:00:00.000Z',
      packets,
      arms,
      bindings,
      schedule: expectedSchedule(arms),
      operationRoundsPerSample: 30,
      timedOperationsPerSample: {
        filter: 30,
        toggle: 30,
        membershipRename: 30,
      },
      host: {
        node: 'fixture',
        cpu: 'fixture',
        platform: 'fixture',
        release: 'fixture',
        arch: 'fixture',
      },
      timing: 'synthetic fixture',
      limits: 'No benchmark evidence',
    };
    const results = schedule.schedule.map((sample, index) => {
      const values = Array.from({ length: 30 }, (_, i) => i + 1);
      return {
        ...sample,
        index,
        passed: true,
        process: { browserPid: 1000 + index, harnessPid: 999 },
        browser: 'fixture',
        startup: {
          seed: 0,
          factory: 2,
          bootstrapToLayout: 3,
          navigationToLayout: 4,
        },
        milliseconds: Object.fromEntries(
          actions.flatMap((name) => [
            [name, values],
            [name + 'P95', 29],
          ])
        ),
        heapBytes: {
          baseline: 100,
          populated: 200,
          aging: [210, 220],
          observedPreGC: 300,
          afterDestroy: 90,
        },
        host: { load: [1, 2, 3], freeBytes: 1000 },
      };
    });
    const childPath = (index) =>
      join(
        directory,
        `${String(index).padStart(3, '0')}-${results[index].arm}-${
          results[index].variant
        }.json`
      );
    const save = () => {
      put(join(directory, 'preflight.json'), {
        passed: true,
        packets,
        arms,
        bindings,
      });
      put(join(directory, 'schedule.json'), schedule);
      put(join(directory, 'results.json'), {
        scheduleSha256: sha(join(directory, 'schedule.json')),
        bindings,
        results,
      });
      results.forEach((result, index) => put(childPath(index), result));
    };
    const load = () => loadMeasurements(packets, arms, bindings, directory, {});
    save();
    const valid = load();
    assert.equal(valid.samples.length, 72);
    assert.deepEqual(
      schedule.schedule.slice(0, 4).map(({ arm, variant }) => [arm, variant]),
      [
        ['tanstack', 'before'],
        ['tanstack', 'after'],
        ['v16', 'after'],
        ['v16', 'before'],
      ]
    );
    assert.deepEqual(
      schedule.schedule.slice(6, 10).map(({ arm, variant }) => [arm, variant]),
      [
        ['v16', 'before'],
        ['v16', 'after'],
        ['tanstack', 'after'],
        ['tanstack', 'before'],
      ]
    );
    assert.deepEqual(
      schedule.schedule
        .filter((sample) => sample.control)
        .map(({ throttle, rows, round, repeat }) => [
          rows,
          throttle,
          round,
          repeat,
        ]),
      profiles.flatMap(({ rows, throttle }) => [
        [rows, throttle, 0, 0],
        [rows, throttle, 0, 1],
        [rows, throttle, 1, 0],
        [rows, throttle, 1, 1],
      ])
    );
    const summary = summarize(profiles[0], arms, valid.samples);
    assert.equal(
      summary.arms.v16.metrics['latency.filter.withinChildP95'].before.n,
      5
    );
    assert.equal(
      summary.arms.v16.metrics['latency.filter.withinChildP95'].ratio.median,
      1
    );
    assert.equal(summary.arms.v16.metrics['startup.seed'].ratio, null);
    assert.equal(
      summary.arms.v16.metrics['heap.populated.deltaFromBlank'].ratio,
      null
    );
    assert.equal(summary.sameArmControls.metrics['startup.factory'].pairedN, 2);
    rmSync(childPath(0));
    assert.throws(load, /Missing\/extra child receipts/);
    save();
    const tampered = structuredClone(results[0]);
    tampered.startup.factory++;
    put(childPath(0), tampered);
    assert.throws(load, /Aggregate\/raw child mismatch/);
    save();
    const last = schedule.schedule.pop();
    save();
    assert.throws(load, /Incomplete or unregistered schedule/);
    schedule.schedule.push(last);
    save();
    const pid = results[1].process.browserPid;
    results[1].process.browserPid = results[0].process.browserPid;
    save();
    assert.throws(load, /Reused browser PID/);
    results[1].process.browserPid = pid;
    save();
    results[0].milliseconds.filterP95 = 30;
    save();
    assert.throws(load, /Wrong filter within-child p95/);
    results[0].milliseconds.filterP95 = 29;
    save();
    results[0].milliseconds.filter = [1];
    save();
    assert.throws(load, /exactly 30 actions/);
    results[0].milliseconds.filter = Array.from(
      { length: 30 },
      (_, i) => i + 1
    );
    save();
    put(join(directory, 'preflight.json'), {
      passed: true,
      packets,
      arms,
      bindings: {},
    });
    assert.throws(load, /input bindings/);
    save();
    writeFileSync(input, 'tampered');
    assert.throws(load, /Input drift/);
    console.log(
      'analyze-variants self-test passed: valid cohort, paired summaries, missing/tampered receipts, incomplete schedule, PID reuse, p95/action count and binding failures'
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function dispatchSelfTest() {
  const root = mkdtempSync(join(tmpdir(), 'st-dispatch-variants-test-'));
  try {
    const directory = join(root, 'comparison');
    mkdirSync(directory);
    const put = (path, value) =>
      writeFileSync(path, JSON.stringify(value) + '\n');
    const input = join(root, 'bound.txt');
    writeFileSync(input, 'fixture');
    const bindings = { [input]: sha(input) };
    const packets = {
        before: join(root, 'before'),
        after: join(root, 'after'),
      },
      arms = ['tanstack'];
    const childEngineSha256 = baselineChildHash();
    const schedule = {
      mode: 'compare-variants',
      scenario: 'dispatch',
      createdUTC: '2026-11-11T00:00:00.000Z',
      packets,
      arms,
      bindings,
      childEngineSha256,
      schedule: expectedSchedule(arms, 'dispatch').map((sample, index) => ({
        ...sample,
        processIdentity: `fixture-${index}`,
      })),
      workload: {
        workflowRounds: 20,
        pendingCommands: 128,
        agingCheckpoints: [100, 200],
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
      host: {
        node: 'fixture',
        cpu: 'fixture',
        platform: 'fixture',
        release: 'fixture',
        arch: 'fixture',
      },
      timing: 'Synthetic fixture only',
      limits: 'No benchmark evidence',
      memory: 'Synthetic heap checkpoints',
      statistics: 'Synthetic per-child summaries',
    };
    const memoryStates = [
      null,
      [0, 0, 0, false, 0, 0],
      [128, 128, 0, false, 128, 0],
      [128, 128, 0, true, 128, 0],
      [0, 0, 0, true, 128, 64],
      [0, 0, 0, true, 228, 164],
      [0, 0, 0, true, 328, 264],
      [1, 1, 1, true, 329, 264],
    ];
    const results = schedule.schedule.map((sample, index) => {
      const stages = dispatchStages(sample.kind);
      const result = {
        ...sample,
        passed: true,
        stage: stages.at(-1),
        stages: stages.map((name) => ({ name, passed: true })),
        browserErrors: [],
        failures: [],
        process: {
          identity: sample.processIdentity,
          browserPid: 2000 + index,
          harnessPid: 1999,
          browserVersion: 'fixture',
        },
        hostStart: { load: [1, 2, 3], freeBytes: 1000 },
        hostEnd: { load: [1, 2, 3], freeBytes: 1000 },
        workflow: [],
        memory: [],
      };
      if (sample.kind === 'timing') {
        result.startup = {
          seed: 0,
          factory: 1,
          bootstrapToLayout: 2,
          navigationToLayout: 3,
        };
        result.workflow = Array.from({ length: 20 }, (_, round) => ({
          round,
          statusCommand: `timing-status-${round}`,
          ownerCommand: `timing-owner-${round}`,
          intent: `timing-plan-${round}`,
          milliseconds: {
            ...Object.fromEntries(
              dispatchActions.map((name) => [name, round + 1])
            ),
            ...(round === 0 ? { latePreview: 3 } : {}),
          },
        }));
        result.milliseconds = Object.fromEntries(
          dispatchActions.map((name) => [
            name,
            {
              values: result.workflow.map((item) => item.milliseconds[name]),
              withinChildP95: 19,
            },
          ])
        );
        result.milliseconds.latePreview = { value: 3, observations: 1 };
      } else {
        result.memory = memoryNames.map((name, index) => {
          const point = {
            name,
            preGCBytes: 300 + index,
            postGCBytes: 100 + index,
            deltaFromBlankBytes: index,
          };
          if (memoryStates[index]) {
            const [
              operations,
              unresolved,
              publications,
              previewOpen,
              requests,
              applications,
            ] = memoryStates[index];
            point.state = {
              operations,
              unresolved,
              publications,
              previewOpen,
              requests,
              applications,
              publicationStarts: 0,
              publicationAttempts: 0,
              acknowledgements: 0,
              ...(index >= 3
                ? { previewPending: index === 3 ? 128 : index === 7 ? 1 : 0 }
                : {}),
            };
          }
          return point;
        });
        result.observedPreGCHighWaterBytes = 309;
        result.retiredDelivery = {
          applications: 265,
          starts: 0,
          publicationAttempts: 0,
        };
      }
      return result;
    });
    const childPath = (index) =>
      join(
        directory,
        `${String(index).padStart(3, '0')}-${results[index].arm}-${
          results[index].variant
        }-${results[index].kind}.json`
      );
    const save = () => {
      put(join(directory, 'preflight.json'), {
        passed: true,
        packets,
        arms,
        bindings,
        childEngineSha256,
      });
      put(join(directory, 'schedule.json'), schedule);
      put(join(directory, 'results.json'), {
        scheduleSha256: sha(join(directory, 'schedule.json')),
        bindings,
        results,
      });
      results.forEach((result, index) => put(childPath(index), result));
    };
    const load = () =>
      loadMeasurements(packets, arms, bindings, directory, {}, 'dispatch');
    save();
    const valid = load();
    assert.equal(valid.samples.length, 84);
    const timing = summarize(profiles[0], arms, valid.samples, 'timing');
    const memory = summarize(profiles[0], arms, valid.samples, 'memory');
    assert.equal(
      timing.arms.tanstack.metrics[
        'latency.acknowledgeProcessing.withinChildP95'
      ].before.n,
      5
    );
    assert.equal(
      timing.arms.tanstack.metrics[
        'latency.acknowledgeProcessing.withinChildP95'
      ].ratio.median,
      1
    );
    assert.equal(
      timing.sameArmControls.metrics['latency.latePreview.singleObservation']
        .pairedN,
      2
    );
    assert.equal(
      memory.arms.tanstack.metrics['heap.lateDeliveryDelta'].ratio,
      null
    );
    put(join(directory, 'runner-failure.json'), {
      stage: 'cohort',
      error: 'fixture failure',
    });
    assert.throws(load, /Runner failure receipt/);
    rmSync(join(directory, 'runner-failure.json'));
    rmSync(childPath(0));
    assert.throws(load, /Missing\/extra child receipts/);
    save();
    const raw = structuredClone(results[0]);
    raw.startup.factory++;
    put(childPath(0), raw);
    assert.throws(load, /Aggregate\/raw child mismatch/);
    save();
    results[0].milliseconds.acknowledgeProcessing.withinChildP95 = 20;
    save();
    assert.throws(load, /Wrong dispatch within-child p95/);
    results[0].milliseconds.acknowledgeProcessing.withinChildP95 = 19;
    save();
    const workflow = results[0].workflow.pop();
    save();
    assert.throws(load, /Exactly 20 dispatch workflow rounds/);
    results[0].workflow.push(workflow);
    save();
    results[1].retiredDelivery.starts = 1;
    save();
    assert.throws(load, /Retired delivery witness/);
    results[1].retiredDelivery.starts = 0;
    save();
    results[1].memory[9].deltaFromBlankBytes++;
    save();
    assert.throws(load, /Wrong memory checkpoint delta/);
    results[1].memory[9].deltaFromBlankBytes--;
    save();
    const stage = results[1].stages.pop();
    save();
    assert.throws(load, /dispatch stage witnesses/);
    results[1].stages.push(stage);
    save();
    const pid = results[1].process.browserPid;
    results[1].process.browserPid = results[0].process.browserPid;
    save();
    assert.throws(load, /Reused browser PID/);
    results[1].process.browserPid = pid;
    save();
    const last = results.pop();
    save();
    assert.throws(load, /Incomplete comparison/);
    results.push(last);
    save();
    schedule.schedule[0].variant = 'after';
    save();
    assert.throws(load, /Incomplete or unregistered schedule/);
    schedule.schedule[0].variant = 'before';
    save();
    writeFileSync(input, 'tampered');
    assert.throws(load, /Input drift/);
    console.log(
      'dispatch analyzer self-test passed: valid 84-child cohort, separated paired metrics, missing/tampered/incomplete receipts, p95/workflow/stage/late-response/checkpoint/PID/binding failures'
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

if (process.argv.length === 3 && process.argv[2] === '--self-test') {
  selfTest();
  dispatchSelfTest();
} else {
  assert.ok(
    process.argv.length === 6 || process.argv.length === 7,
    'analyze-variants.mjs BASE_PACKET VARIANT_PACKET COMPARISON_DIR NEW_OUT [inventory|dispatch] (or --self-test)'
  );
  analyze(
    ...process.argv.slice(2, 6).map((path) => resolve(path)),
    process.argv[6] ?? 'inventory'
  );
}
