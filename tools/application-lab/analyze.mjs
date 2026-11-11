#!/usr/bin/env node
// Offline analysis only. A complete immutable comparison is required; calibration,
// partial cohorts and expected future results are never promoted to evidence.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const self = fileURLToPath(import.meta.url);
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
const dispatchLatency = [
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
const controls = {
  inventory: [
    'drop-filter',
    'stale-count',
    'invalid-add',
    'stale-editor',
    'skip-destroy',
  ],
  dispatch: [
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
  ],
};
const sha = (path) =>
  createHash('sha256').update(readFileSync(path)).digest('hex');
const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const sameKeys = (actual, expected, label) =>
  assert.deepEqual(Object.keys(actual).sort(), [...expected].sort(), label);
const finite = (value, label, negative = false) => {
  assert.ok(
    Number.isFinite(value) && (negative || value >= 0),
    `Invalid ${label}: ${value}`
  );
  return value;
};
const nearestP95 = (values) =>
  [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1];
const distribution = (values) => {
  assert.ok(values.length > 0, 'Empty distribution');
  values.forEach((value) => finite(value, 'distribution value', true));
  const sorted = [...values].sort((a, b) => a - b),
    middle = Math.floor(sorted.length / 2);
  return {
    n: values.length,
    min: sorted[0],
    median:
      sorted.length % 2
        ? sorted[middle]
        : (sorted[middle - 1] + sorted[middle]) / 2,
    max: sorted.at(-1),
  };
};
function verifyBindings(bindings) {
  assert.ok(bindings && Object.keys(bindings).length > 0, 'Missing bindings');
  for (const [path, expected] of Object.entries(bindings)) {
    assert.ok(
      isAbsolute(path) && /^[a-f0-9]{64}$/.test(expected),
      `Invalid binding ${path}`
    );
    assert.equal(sha(path), expected, `Input drift: ${path}`);
  }
}
function expectedSchedule(scenario, arms) {
  const expected = [];
  let sampleIndex = 0;
  const add = (sample) => {
    if (scenario === 'inventory') expected.push(sample);
    else {
      for (const kind of ['timing', 'memory'])
        expected.push({
          ...sample,
          sampleIndex,
          childIndex: expected.length,
          kind,
        });
      sampleIndex++;
    }
  };
  for (const profile of profiles)
    for (let round = 0; round < 5; round++) {
      for (let index = 0; index < arms.length; index++)
        add({
          ...profile,
          round,
          arm: arms[(index + round) % arms.length],
          control: false,
        });
      if (round < 2)
        for (const member of [0, 1])
          add({
            ...profile,
            round,
            arm: 'v15',
            control: true,
            ...(scenario === 'inventory'
              ? { repeat: member }
              : { controlPair: round, controlMember: member }),
          });
    }
  return expected;
}
function validateSchedule(scenario, arms, schedule, results) {
  const expected = expectedSchedule(scenario, arms);
  assert.equal(
    schedule.length,
    expected.length,
    `${scenario}: incomplete schedule`
  );
  assert.equal(
    results.length,
    expected.length,
    `${scenario}: incomplete results`
  );
  const identities = new Set();
  for (let index = 0; index < expected.length; index++) {
    const entry = schedule[index],
      result = results[index];
    if (scenario === 'dispatch') {
      assert.ok(
        typeof entry.processIdentity === 'string' &&
          entry.processIdentity.length > 0
      );
      assert.ok(
        !identities.has(entry.processIdentity),
        'Reused dispatch child identity'
      );
      identities.add(entry.processIdentity);
      assert.deepEqual(
        entry,
        { ...expected[index], processIdentity: entry.processIdentity },
        `Wrong ${scenario} schedule entry ${index}`
      );
    } else
      assert.deepEqual(
        entry,
        expected[index],
        `Wrong ${scenario} schedule entry ${index}`
      );
    for (const [key, value] of Object.entries(entry))
      assert.deepEqual(
        result[key],
        value,
        `Mismatched ${scenario} child ${index}: ${key}`
      );
    if (scenario === 'inventory') assert.equal(result.index, index);
    else assert.equal(result.process?.identity, entry.processIdentity);
    assert.equal(result.passed, true, `${scenario} child ${index} failed`);
    assert.ok(!result.error, `${scenario} child ${index} has an error`);
    for (const key of ['failures', 'browserErrors', 'finalizationErrors'])
      if (result[key]) assert.deepEqual(result[key], []);
    assert.ok(
      Number.isInteger(result.process?.browserPid) &&
        result.process.browserPid > 0,
      'Missing browser process identity'
    );
    assert.ok(
      Number.isInteger(result.process?.harnessPid) &&
        result.process.harnessPid > 0,
      'Missing harness process identity'
    );
  }
}
function metricsFor(scenario, result) {
  const metrics = {};
  const add = (name, value, unit, allowNegative = false) => {
    metrics[name] = { value: finite(value, name, allowNegative), unit };
  };
  if (scenario === 'inventory' || result.kind === 'timing') {
    sameKeys(result.startup, startupKeys, 'Startup metric drift');
    for (const key of startupKeys)
      add(`startup.${key}`, result.startup[key], 'ms');
  }
  if (scenario === 'inventory') {
    for (const name of ['filter', 'toggle']) {
      const values = result.milliseconds[name];
      assert.equal(values.length, 30);
      values.forEach((value) => finite(value, name));
      assert.equal(
        result.milliseconds[name + 'P95'],
        nearestP95(values),
        'Wrong recorded within-child p95'
      );
      add(
        `latency.${name}.withinChildP95`,
        result.milliseconds[name + 'P95'],
        'ms'
      );
    }
    const h = result.heapBytes;
    assert.equal(h.aging.length, 2);
    const phases = {
      blank: h.baseline,
      populated: h.populated,
      'aging-plus-200': h.aging[0],
      'aging-plus-400': h.aging[1],
      'after-destroy': h.afterDestroy,
    };
    for (const [name, value] of Object.entries(phases)) {
      add(`heap.${name}.postGC`, value, 'bytes');
      if (name !== 'blank')
        add(`heap.${name}.deltaFromBlank`, value - h.baseline, 'bytes', true);
    }
    add('heap.agingGrowth200To400', h.aging[1] - h.aging[0], 'bytes', true);
    add('heap.observedPreGCHighWater', h.observedPreGC, 'bytes');
  } else if (result.kind === 'timing') {
    assert.equal(result.workflow.length, 20);
    assert.deepEqual(result.memory, []);
    for (const [index, item] of result.workflow.entries()) {
      assert.equal(item.round, index);
      assert.equal(item.statusCommand, `timing-status-${index}`);
      assert.equal(item.ownerCommand, `timing-owner-${index}`);
      assert.equal(item.intent, `timing-plan-${index}`);
      sameKeys(
        item.milliseconds,
        index ? dispatchLatency : [...dispatchLatency, 'latePreview'],
        'Workflow timing drift'
      );
    }
    for (const name of dispatchLatency) {
      const measurement = result.milliseconds[name],
        values = result.workflow.map((item) => item.milliseconds[name]);
      values.forEach((value) => finite(value, name));
      assert.deepEqual(measurement.values, values);
      assert.equal(measurement.withinChildP95, nearestP95(values));
      add(`latency.${name}.withinChildP95`, measurement.withinChildP95, 'ms');
    }
    assert.equal(result.milliseconds.latePreview.observations, 1);
    assert.equal(
      result.milliseconds.latePreview.value,
      result.workflow[0].milliseconds.latePreview
    );
    add(
      'latency.latePreview.singleObservation',
      result.milliseconds.latePreview.value,
      'ms'
    );
    const stages = ['bootstrap'];
    for (let round = 0; round < 20; round++) {
      stages.push(
        `round-${round}-assign-status`,
        `round-${round}-assign-owner`
      );
      if (!round) stages.push('late-preview');
      for (const action of [
        'plan-request',
        'reject-status',
        'accept-owner',
        'acknowledge-and-prune',
      ])
        stages.push(`round-${round}-${action}`);
    }
    stages.push('destroy');
    assert.deepEqual(
      result.stages,
      stages.map((name) => ({ name, passed: true }))
    );
  } else {
    assert.equal(result.kind, 'memory');
    assert.deepEqual(result.workflow, []);
    assert.equal(result.startup, undefined);
    assert.equal(result.milliseconds, undefined);
    assert.deepEqual(
      result.memory.map((point) => point.name),
      memoryNames
    );
    const baseline = result.memory[0].postGCBytes;
    for (const point of result.memory) {
      add(`heap.${point.name}.preGC`, point.preGCBytes, 'bytes');
      add(`heap.${point.name}.postGC`, point.postGCBytes, 'bytes');
      assert.equal(point.deltaFromBlankBytes, point.postGCBytes - baseline);
      if (point.name !== 'blank')
        add(
          `heap.${point.name}.deltaFromBlank`,
          point.deltaFromBlankBytes,
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
    assert.deepEqual(result.retiredDelivery, {
      applications: 265,
      starts: 0,
      publicationAttempts: 0,
    });
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
      const s = result.memory[index].state;
      assert.deepEqual(
        [
          s.operations,
          s.unresolved,
          s.publications,
          s.previewOpen,
          s.requests,
          s.applications,
        ],
        states[index]
      );
      assert.equal(s.publicationStarts, 0);
      assert.equal(s.publicationAttempts, 0);
      assert.equal(s.acknowledgements, 0);
    }
    const stages = [
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
    assert.deepEqual(
      result.stages,
      stages.map((name) => ({ name, passed: true }))
    );
  }
  return metrics;
}
function pairsSummary(pairs, metricNames) {
  return Object.fromEntries(
    metricNames.map((name) => {
      const samples = pairs.map(({ round, numerator, denominator }) => {
        const a = numerator.metrics[name],
          b = denominator.metrics[name];
        assert.equal(a.unit, b.unit);
        // A negative heap delta has a useful signed difference, but its ratio has
        // no useful cost interpretation. Zero denominators also stay explicit.
        const validRatio = a.value >= 0 && b.value > 0;
        return {
          round,
          numerator: a.value,
          denominator: b.value,
          difference: a.value - b.value,
          ratioAvailable: validRatio,
          ratio: validRatio ? a.value / b.value : null,
          ...(validRatio
            ? {}
            : {
                ratioUnavailable:
                  b.value === 0
                    ? 'Zero denominator: ratio unavailable; inspect signed difference.'
                    : 'Negative numerator or denominator: ratio unavailable; inspect signed difference.',
              }),
          numeratorReceipt: numerator.receipt,
          denominatorReceipt: denominator.receipt,
        };
      });
      const ratios = samples.flatMap((sample) =>
        sample.ratio === null ? [] : [sample.ratio]
      );
      return [
        name,
        {
          unit: pairs[0].numerator.metrics[name].unit,
          ratioUnit: 'dimensionless',
          pairedN: samples.length,
          availableRatioN: ratios.length,
          unavailableRatioN: samples.length - ratios.length,
          samples,
          difference: distribution(samples.map((sample) => sample.difference)),
          ratio: ratios.length ? distribution(ratios) : null,
        },
      ];
    })
  );
}
function summarizeCohort(scenario, kind, profile, arms, samples) {
  const selected = samples.filter(
    (sample) =>
      sample.result.rows === profile.rows &&
      sample.result.throttle === profile.throttle &&
      (scenario === 'inventory' || sample.result.kind === kind)
  );
  const main = selected.filter((sample) => !sample.result.control),
    control = selected.filter((sample) => sample.result.control);
  assert.equal(main.length, arms.length * 5);
  assert.equal(control.length, 4);
  const metricNames = Object.keys(main[0].metrics);
  for (const sample of selected)
    sameKeys(sample.metrics, metricNames, 'Unequal metric sets');
  const byArm = {};
  for (const arm of arms) {
    const values = main
      .filter((sample) => sample.result.arm === arm)
      .sort((a, b) => a.result.round - b.result.round);
    assert.deepEqual(
      values.map((sample) => sample.result.round),
      [0, 1, 2, 3, 4],
      `Missing/duplicate rounds for ${arm}`
    );
    byArm[arm] = {
      n: 5,
      metrics: Object.fromEntries(
        metricNames.map((name) => [
          name,
          {
            unit: values[0].metrics[name].unit,
            ...distribution(values.map((sample) => sample.metrics[name].value)),
            samples: values.map((sample) => ({
              round: sample.result.round,
              value: sample.metrics[name].value,
              receipt: sample.receipt,
            })),
          },
        ])
      ),
    };
  }
  const paired = [0, 1, 2, 3, 4].map((round) => ({
    round,
    numerator: main.find(
      (sample) => sample.result.arm === 'v16' && sample.result.round === round
    ),
    denominator: main.find(
      (sample) => sample.result.arm === 'v15' && sample.result.round === round
    ),
  }));
  const aa = [0, 1].map((round) => {
    const duplicates = control.filter(
      (sample) => sample.result.round === round
    );
    const member = (sample) =>
      scenario === 'inventory'
        ? sample.result.repeat
        : sample.result.controlMember;
    assert.deepEqual(duplicates.map(member).sort(), [0, 1]);
    assert.ok(duplicates.every((sample) => sample.result.arm === 'v15'));
    return {
      round,
      numerator: duplicates.find((sample) => member(sample) === 1),
      denominator: duplicates.find((sample) => member(sample) === 0),
    };
  });
  return {
    scenario,
    kind,
    profile,
    arms: byArm,
    pairedV16OverV15: {
      direction: 'v16 / v15, matched scenario, profile, child kind and round',
      metrics: pairsSummary(paired, metricNames),
    },
    sameArmControls: {
      direction:
        'v15 second duplicate / first duplicate within each of two control pairs; separate from main samples',
      metrics: pairsSummary(aa, metricNames),
    },
  };
}

function loadComparison(scenario, packet, directory, plan, receipts) {
  const receipt = (path) => {
    receipts[path] = sha(path);
    return read(path);
  };
  const requiredBinding = (bindings, path, hash = sha(path)) =>
    assert.equal(bindings[path], hash, `Unbound ${path}`);
  const schedulePath = join(directory, 'schedule.json'),
    resultPath = join(directory, 'results.json');
  const schedule = receipt(schedulePath),
    aggregate = receipt(resultPath),
    preflight = receipt(join(directory, 'preflight.json'));
  assert.equal(
    schedule.mode,
    'compare',
    'Only complete compare-mode cohorts are admissible'
  );
  assert.equal(aggregate.scheduleSha256, sha(schedulePath));
  assert.equal(preflight.passed, true);
  assert.deepEqual(preflight.bindings, aggregate.bindings);
  verifyBindings(aggregate.bindings);
  const runner = join(
    dirname(self),
    scenario === 'inventory' ? 'measure.mjs' : 'dispatch-measure.mjs'
  );
  const checker = join(
    dirname(self),
    scenario === 'inventory' ? 'inventory-check.mjs' : 'dispatch-check.mjs'
  );
  const planPath = join(packet, 'plan.json'),
    buildPath = join(
      packet,
      scenario === 'inventory' ? 'build.json' : 'dispatch-build.json'
    );
  const conformancePath = join(packet, `${scenario}-conformance/results.json`);
  for (const path of [runner, checker, planPath, buildPath, conformancePath])
    requiredBinding(aggregate.bindings, path);
  const build = receipt(buildPath),
    conformance = receipt(conformancePath);
  assert.equal(build.planSha256, sha(planPath));
  assert.equal(conformance.planSha256, build.planSha256);
  assert.equal(conformance.buildSha256, sha(buildPath));
  assert.equal(conformance.runnerSha256, sha(checker));
  sameKeys(build.arms, plan.arms, 'Build arm mismatch');
  sameKeys(
    conformance.controls,
    controls[scenario],
    'Conformance control mismatch'
  );
  assert.equal(
    conformance.results.length,
    plan.arms.length * (controls[scenario].length + 1)
  );
  for (const arm of plan.arms) {
    const runs = conformance.results.filter((result) => result.arm === arm);
    assert.deepEqual(
      runs.map((result) => result.fault ?? 'baseline').sort(),
      ['baseline', ...controls[scenario]].sort()
    );
    assert.ok(runs.every((result) => result.passed === true));
    for (const result of runs) {
      const path = join(
        packet,
        `${scenario}-conformance`,
        `${arm}-${result.fault ?? 'baseline'}.json`
      );
      assert.deepEqual(
        receipt(path),
        result,
        'Conformance aggregate/raw receipt mismatch'
      );
    }
  }
  for (const [path, hash] of Object.entries(plan.inputs))
    requiredBinding(aggregate.bindings, path, hash);
  if (scenario === 'inventory') {
    assert.equal(schedule.packetPlanSha256, sha(planPath));
    assert.equal(schedule.runnerSha256, sha(runner));
    assert.equal(schedule.operationRoundsPerSample, 30);
    assert.deepEqual(schedule.timedOperationsPerSample, {
      filter: 30,
      toggle: 30,
    });
  } else {
    assert.deepEqual(schedule.bindings, aggregate.bindings);
    assert.equal(schedule.workload.workflowRounds, 20);
    assert.equal(schedule.workload.pendingCommands, 128);
    assert.deepEqual(schedule.workload.agingCheckpoints, [100, 200]);
  }
  validateSchedule(scenario, plan.arms, schedule.schedule, aggregate.results);
  const samples = aggregate.results.map((result, index) => {
    const name = `${String(index).padStart(3, '0')}-${result.arm}${
      scenario === 'dispatch' ? '-' + result.kind : ''
    }.json`;
    const path = join(directory, name);
    assert.deepEqual(
      receipt(path),
      result,
      'Aggregate/raw child receipt mismatch'
    );
    return {
      result,
      receipt: { path, sha256: receipts[path] },
      metrics: metricsFor(scenario, result),
    };
  });
  const payload = plan.arms.map((arm) => {
    const selected = build.arms[arm];
    for (const [path, hash] of Object.entries({
      ...selected.dependencies,
      ...selected.served,
    }))
      requiredBinding(aggregate.bindings, path, hash);
    const stats = join(packet, arm, 'dist', scenario, 'stats.json');
    receipts[stats] = sha(stats);
    assert.equal(receipts[stats], selected.statsSha256);
    assert.deepEqual(
      selected.entryFiles.map((path) => resolve(packet, arm, path)).sort(),
      Object.keys(selected.served).sort()
    );
    const scripts = Object.keys(selected.served).filter((path) =>
      path.endsWith('.js')
    );
    assert.ok(scripts.length > 0);
    const bytes = scripts.map((path) => readFileSync(path));
    const rawBytes = bytes.reduce((sum, content) => sum + content.length, 0);
    const gzipBytes = bytes.reduce(
      (sum, content) => sum + gzipSync(content).length,
      0
    );
    assert.equal(rawBytes, selected.jsBytes);
    assert.equal(gzipBytes, selected.jsGzipBytes);
    return {
      scenario,
      arm,
      scriptCount: scripts.length,
      rawBytes,
      gzipBytes,
      gzipMethod:
        'Sum of default Node gzip per served .js file; recomputed from hash-verified bytes.',
      buildReceipt: { path: buildPath, sha256: receipts[buildPath] },
    };
  });
  const versions = new Set(
    samples.map((sample) =>
      scenario === 'inventory'
        ? sample.result.browser
        : sample.result.process.browserVersion
    )
  );
  assert.equal(versions.size, 1, 'Browser version drift within cohort');
  const browserVersion = [...versions][0];
  assert.ok(typeof browserVersion === 'string' && browserVersion.length > 0);
  return {
    scenario,
    directory,
    schedule,
    bindings: aggregate.bindings,
    browserVersion,
    samples,
    payload,
  };
}

const compact = (value) => Number(value.toPrecision(5)).toString();
function display(stat, unit = stat?.unit) {
  if (!stat) return 'unavailable';
  const scale = unit === 'bytes' ? 1048576 : 1;
  return `${compact(stat.median / scale)} [${compact(
    stat.min / scale
  )}, ${compact(stat.max / scale)}]`;
}
function markdown(report) {
  const lines = [
    '# Application comparison',
    '',
    'All admitted schedules, conformance receipts, child results and recorded file bindings passed offline validation. These are descriptive measurements, not significance tests.',
    '',
    'Cells show median [minimum, maximum] across five independent children. Heap table values are MiB (1,048,576 bytes); JSON preserves exact bytes and all metrics. Latency entries summarize each child’s own p95; operations are never pooled across children.',
    '',
    `Command: \`${report.command
      .map((arg) => JSON.stringify(arg))
      .join(' ')}\``,
    '',
  ];
  for (const cohort of report.cohorts) {
    const p = cohort.profile;
    lines.push(
      `## ${cohort.scenario} / ${cohort.kind} — ${p.rows} rows, CDP ${p.throttle}×`,
      ''
    );
    const selected =
      cohort.scenario === 'inventory'
        ? [
            ['Navigation (ms)', 'startup.navigationToLayout'],
            ['Filter p95 (ms)', 'latency.filter.withinChildP95'],
            ['Toggle p95 (ms)', 'latency.toggle.withinChildP95'],
            ['Populated (MiB)', 'heap.populated.postGC'],
            ['After destroy (MiB)', 'heap.after-destroy.postGC'],
          ]
        : cohort.kind === 'timing'
        ? [
            ['Navigation (ms)', 'startup.navigationToLayout'],
            ['Assign owner p95 (ms)', 'latency.assignOwner.withinChildP95'],
            ['Reject status p95 (ms)', 'latency.rejectStatus.withinChildP95'],
            ['Accept owner p95 (ms)', 'latency.acceptOwner.withinChildP95'],
            [
              'Ack processing p95 (ms)',
              'latency.acknowledgeProcessing.withinChildP95',
            ],
          ]
        : [
            ['Populated (MiB)', 'heap.populated.postGC'],
            ['Pending (MiB)', 'heap.pending-128.postGC'],
            ['Preview (MiB)', 'heap.pending-128-preview-open.postGC'],
            ['After late reply (MiB)', 'heap.after-destroy-after-late.postGC'],
            ['Growth +100→+200 (MiB)', 'heap.agingGrowth100To200'],
          ];
    lines.push(
      `| Arm | ${selected.map(([label]) => label).join(' | ')} |`,
      `| --- | ${selected.map(() => '---:').join(' | ')} |`
    );
    for (const [arm, data] of Object.entries(cohort.arms))
      lines.push(
        `| ${arm} | ${selected
          .map(([, key]) => display(data.metrics[key]))
          .join(' | ')} |`
      );
    lines.push(
      '',
      'Ratios below are descriptive. v16/v15 pairs share the scenario, profile and round. A/A uses the second v15 duplicate divided by the first in two separate control pairs; it is not a confidence interval.',
      '',
      '| Metric | v16/v15, five pairs | v15 A/A, two pairs |',
      '| --- | ---: | ---: |'
    );
    for (const [label, key] of selected) {
      const pair = cohort.pairedV16OverV15.metrics[key],
        aa = cohort.sameArmControls.metrics[key];
      const ratioText = (metric) =>
        `${display(metric.ratio, 'ratio')} (valid n=${metric.ratio?.n ?? 0}/${
          metric.pairedN
        })`;
      lines.push(`| ${label} | ${ratioText(pair)} | ${ratioText(aa)} |`);
    }
    lines.push('');
  }
  lines.push(
    '## Served JavaScript',
    '',
    'Full served application JavaScript, including bundled dependencies. CSS/HTML and a library-only partition are excluded. Gzip is summed per file.',
    '',
    '| Scenario | Arm | Raw bytes | Gzip bytes |',
    '| --- | --- | ---: | ---: |'
  );
  for (const item of report.payload)
    lines.push(
      `| ${item.scenario} | ${item.arm} | ${item.rawBytes} | ${item.gzipBytes} |`
    );
  lines.push(
    '',
    '## Limits',
    '',
    ...report.limits.map((limit) => `- ${limit}`),
    '',
    'The JSON contains every startup stage, heap checkpoint/delta, raw child references, paired values/differences and A/A ratios. No aggregate winner is selected.',
    ''
  );
  return lines.join('\n');
}

function analyze(packet, inventoryDirectory, dispatchDirectory, out) {
  assert.ok(
    !existsSync(out),
    'Output directory must be new; preserve prior analysis'
  );
  for (const directory of [
    resolve(dirname(self), '../..'),
    packet,
    inventoryDirectory,
    dispatchDirectory,
  ]) {
    assert.ok(
      out !== directory && !out.startsWith(directory + sep),
      'Output must be external to the checkout and evidence directories'
    );
  }
  mkdirSync(out, { recursive: true });
  const write = (name, value) =>
    writeFileSync(join(out, name), value, { flag: 'wx' });
  try {
    const receipts = {
      [self]: sha(self),
      [join(packet, 'plan.json')]: sha(join(packet, 'plan.json')),
    };
    const plan = read(join(packet, 'plan.json'));
    assert.ok(
      Array.isArray(plan.arms) &&
        plan.arms.includes('v15') &&
        plan.arms.includes('v16')
    );
    assert.equal(new Set(plan.arms).size, plan.arms.length);
    assert.ok(plan.arms.every((arm) => /^[a-z0-9-]+$/.test(arm)));
    const runs = [
      loadComparison('inventory', packet, inventoryDirectory, plan, receipts),
      loadComparison('dispatch', packet, dispatchDirectory, plan, receipts),
    ];
    assert.deepEqual(
      runs[0].schedule.host,
      runs[1].schedule.host,
      'Host/toolchain identity differs across scenarios'
    );
    assert.equal(
      runs[0].browserVersion,
      runs[1].browserVersion,
      'Browser identity differs across scenarios'
    );
    const cohorts = runs.flatMap((run) =>
      profiles.flatMap((profile) =>
        (run.scenario === 'inventory'
          ? ['combined']
          : ['timing', 'memory']
        ).map((kind) =>
          summarizeCohort(run.scenario, kind, profile, plan.arms, run.samples)
        )
      )
    );
    const bindings = {};
    for (const run of runs)
      for (const [path, hash] of Object.entries(run.bindings)) {
        if (bindings[path])
          assert.equal(
            bindings[path],
            hash,
            `Cross-scenario input mismatch: ${path}`
          );
        bindings[path] = hash;
      }
    verifyBindings(bindings);
    verifyBindings(receipts);
    const report = {
      schemaVersion: 1,
      createdUTC: new Date().toISOString(),
      command: [
        process.execPath,
        self,
        packet,
        inventoryDirectory,
        dispatchDirectory,
        out,
      ],
      analyzerSha256: receipts[self],
      node: process.version,
      packet,
      arms: plan.arms,
      browserVersion: runs[0].browserVersion,
      sourceRuns: runs.map((run) => ({
        scenario: run.scenario,
        directory: run.directory,
        host: run.schedule.host,
        scheduleReceipt: {
          path: join(run.directory, 'schedule.json'),
          sha256: receipts[join(run.directory, 'schedule.json')],
        },
        reconstructedMeasurementCommand: [
          process.execPath,
          join(
            dirname(self),
            run.scenario === 'inventory'
              ? 'measure.mjs'
              : 'dispatch-measure.mjs'
          ),
          'compare',
          packet,
          run.directory,
        ],
        commandNote:
          'Reconstructed from the validated runner, mode and paths; measurement receipts do not record the original argv. Reproduction requires a new output directory.',
        timing: run.schedule.timing,
        memory: run.schedule.memory,
        limits: run.schedule.limits,
      })),
      validation: {
        complete: true,
        comparisonRounds: 5,
        aaPairsPerProfile: 2,
        bindings,
        receipts,
      },
      cohorts,
      payload: runs.flatMap((run) => run.payload),
      limits: [
        'Five independent main samples per arm/profile; extrema and medians are descriptive. Within-child p95 is not a population tail. No significance or confidence-interval claim.',
        'v16/v15 ratios use matched rounds, not ratios of pooled operations. A/A duplicate ratios are separate observations of repeatability, not a confidence interval. Non-positive denominators or negative heap-delta numerators have no ratio; signed differences remain available.',
        'Synthetic event/response to Angular stabilization and forced layout is not INP. Local acknowledgement processing excludes network delay. Startup stages can overlap and must not be added together.',
        'Shared host and CDP throttling do not establish calibrated-device performance. Timing and memory are separate dispatch children; memory-child elapsed time supplies no latency evidence.',
        'Heap checkpoints use forced GC. Observed pre-GC high water is not a true peak or allocation measurement. Finite aging does not prove unlimited boundedness; signed heap growth alone does not establish a leak.',
        'Dispatch heap includes the application and deterministic service request/application/publication logs plus reserved command/intent IDs. The before-late teardown checkpoint intentionally retains the old backend; it is released after late delivery. This is not library-only retained memory.',
        'Payload totals cover served JavaScript, including framework/application dependencies, and gzip each file separately. Hash checks bind recorded files and receipts; they are not signed provenance or proof of real-world backend behavior.',
        'No human productivity, comprehension, adoption or financial ROI measurement. No workload-independent winner or production SLO is inferred.',
      ],
    };
    write('summary.json', JSON.stringify(report, null, 2) + '\n');
    write('summary.md', markdown(report));
    write(
      'receipt.json',
      JSON.stringify(
        {
          summarySha256: sha(join(out, 'summary.json')),
          markdownSha256: sha(join(out, 'summary.md')),
          analyzerSha256: receipts[self],
          command: report.command,
        },
        null,
        2
      ) + '\n'
    );
    console.log(
      `Validated ${runs.reduce(
        (sum, run) => sum + run.samples.length,
        0
      )} children; wrote ${out}`
    );
  } catch (error) {
    write(
      'validation-failure.json',
      JSON.stringify(
        {
          passed: false,
          command: [
            process.execPath,
            self,
            packet,
            inventoryDirectory,
            dispatchDirectory,
            out,
          ],
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
  // Synthetic observations exercise validation only. They are never written as
  // comparison evidence and cannot be mistaken for pending browser results.
  const arms = ['v15', 'v16', 'native', 'ngrx', 'tanstack'];
  for (const scenario of ['inventory', 'dispatch']) {
    const schedule = expectedSchedule(scenario, arms).map((entry, index) =>
      scenario === 'dispatch'
        ? { ...entry, processIdentity: `synthetic-${index}` }
        : entry
    );
    const results = schedule.map((entry, index) => ({
      ...entry,
      ...(scenario === 'inventory' ? { index } : {}),
      passed: true,
      process: {
        identity: entry.processIdentity,
        browserPid: index + 1,
        harnessPid: 1,
      },
    }));
    validateSchedule(scenario, arms, schedule, results);
    assert.throws(
      () => validateSchedule(scenario, arms, schedule, results.slice(1)),
      /incomplete results/
    );
    const wrong = structuredClone(results);
    wrong[1].arm = 'wrong';
    assert.throws(
      () => validateSchedule(scenario, arms, schedule, wrong),
      /Mismatched/
    );
    const failed = structuredClone(results);
    failed[0].passed = false;
    assert.throws(
      () => validateSchedule(scenario, arms, schedule, failed),
      /failed/
    );
    const samples = results.map((result, index) => ({
      result,
      receipt: { path: `synthetic-${index}`, sha256: 'synthetic-only' },
      metrics: {
        synthetic: {
          value: result.control
            ? (result.repeat ?? result.controlMember) + 10
            : (result.round + 1) * (result.arm === 'v16' ? 2 : 1),
          unit: 'ms',
        },
      },
    }));
    const cohort = summarizeCohort(
      scenario,
      scenario === 'dispatch' ? 'timing' : 'combined',
      profiles[0],
      arms,
      samples
    );
    assert.deepEqual(cohort.pairedV16OverV15.metrics.synthetic.ratio, {
      n: 5,
      min: 2,
      median: 2,
      max: 2,
    });
    assert.deepEqual(
      cohort.arms.v15.metrics.synthetic.samples.map((item) => item.value),
      [1, 2, 3, 4, 5]
    );
    assert.equal(cohort.sameArmControls.metrics.synthetic.ratio.n, 2);
    assert.equal(cohort.sameArmControls.metrics.synthetic.ratio.median, 1.1);
    const unpaired = samples.filter(
      (sample) =>
        !(
          sample.result.arm === 'v16' &&
          sample.result.round === 4 &&
          !sample.result.control
        )
    );
    assert.throws(() =>
      summarizeCohort(
        scenario,
        scenario === 'dispatch' ? 'timing' : 'combined',
        profiles[0],
        arms,
        unpaired
      )
    );
  }
  const inventory = {
    startup: Object.fromEntries(startupKeys.map((key) => [key, 1])),
    milliseconds: {
      filter: Array(30).fill(2),
      toggle: Array(30).fill(3),
      filterP95: 2,
      toggleP95: 3,
    },
    heapBytes: {
      baseline: 100,
      populated: 1000,
      aging: [1100, 1200],
      observedPreGC: 1500,
      afterDestroy: 200,
    },
  };
  assert.equal(
    metricsFor('inventory', inventory)['heap.agingGrowth200To400'].value,
    100
  );
  assert.throws(
    () =>
      metricsFor('inventory', {
        ...inventory,
        milliseconds: { ...inventory.milliseconds, filterP95: 99 },
      }),
    /Wrong recorded/
  );
  const syntheticValue = (value) => ({
    receipt: { path: 'synthetic-only' },
    metrics: { value: { value, unit: 'ms' } },
  });
  const zeros = pairsSummary(
    [
      {
        round: 0,
        numerator: syntheticValue(1),
        denominator: syntheticValue(0),
      },
      {
        round: 1,
        numerator: syntheticValue(0),
        denominator: syntheticValue(0),
      },
    ],
    ['value']
  ).value;
  assert.equal(zeros.ratio, null);
  assert.equal(zeros.availableRatioN, 0);
  assert.equal(zeros.unavailableRatioN, 2);
  for (const sample of zeros.samples) {
    assert.equal(sample.ratioAvailable, false);
    assert.equal(sample.ratio, null);
    assert.match(sample.ratioUnavailable, /Zero denominator/);
  }
  assert.equal(display(zeros.ratio, 'ratio'), 'unavailable');
  assert.ok(!JSON.stringify(zeros).includes('Infinity'));
  const temporary = mkdtempSync(
    join(tmpdir(), 'application-analysis-self-test-')
  );
  try {
    const path = join(temporary, 'binding.txt');
    writeFileSync(path, 'synthetic fixture');
    const bindings = { [path]: sha(path) };
    verifyBindings(bindings);
    writeFileSync(path, 'changed fixture');
    assert.throws(() => verifyBindings(bindings), /Input drift/);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
  console.log(
    'PASS: synthetic schedule completeness, identity/pass rejection, five-round pairing, A/A isolation, p95 recomputation, explicit unavailable zero-denominator ratios and binding-drift detection. No browser measurements performed.'
  );
}

if (process.argv[2] === '--self-test') {
  assert.equal(process.argv.length, 3);
  selfTest();
} else {
  assert.equal(
    process.argv.length,
    6,
    'analyze.mjs PACKET INVENTORY_COMPARISON_DIR DISPATCH_COMPARISON_DIR NEW_OUTPUT_DIRECTORY (or --self-test)'
  );
  analyze(...process.argv.slice(2).map((path) => resolve(path)));
}
