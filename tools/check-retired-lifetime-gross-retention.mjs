#!/usr/bin/env node
/**
 * PROPOSED gross-retention contract, awaiting independent validation/promotion.
 * 40 MiB was selected from prior Linux characterization: healthy max 16.235 MiB,
 * intentionally held 10k-handle min 96.423 MiB. These are threshold-selection
 * observations, not independent validation or a claim about a 20 B slope.
 *
 * node tools/check-retired-lifetime-gross-retention.mjs [--arm ARM]
 * node tools/check-retired-lifetime-gross-retention.mjs --self-test
 * node tools/check-retired-lifetime-gross-retention.mjs --check-helpers
 *
 * ARM: no-history-reads (default) or no-history-node-reads. Ordinary check:
 * THREE fresh children, each width 1000 / rounds 150 / retain 0. Every raw
 * (after.quiesceHeapUsed - before.quiesceHeapUsed) / 1048576 must be <= 40.
 * No median, retry, ratio, rounding before judgement, or asymptotic claim.
 * Self-test: six fresh children, control / retain 10000 / neutralized for BOTH
 * arms. Control and neutralized must pass, intentional retention must fail the
 * numeric verdict with valid diagnostics (a crash cannot satisfy sensitivity).
 * Helpers are synthetic contract checks only; they launch no workload.
 *
 * JSONL stdout preserves the pre-run plan, each child's entire stdout/stderr,
 * parsed diagnostics, commands, actual exit/signal, and final identity receipt.
 * Redirect stdout to retain a run; records are incremental and never retried.
 * All planned children are attempted even after a child failure. A final success
 * record is required: an interrupted stream is not a pass. No artifact is written
 * or mutated; built-kernel and tool hashes must match before/after the batch.
 * Exit 0: requested check passes; 1: valid numeric expectation fails;
 * 2: malformed diagnostics, execution or provenance failure. This standalone
 * proposed ceiling does not waive any existing checker or establish promotion.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, realpathSync } from 'node:fs';
import { arch, cpus, platform, release, totalmem } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BENCH = join(ROOT, 'tools/bench-entity-churn-retention.mjs');
const ARTIFACT = join(ROOT, 'dist/packages/kernel');
const ENTRY = join(ARTIFACT, 'dist/index.js');
const ARMS = ['no-history-reads', 'no-history-node-reads'];
const WIDTH = 1000;
const ROUNDS = 150;
const HELD = 10000;
const MIB = 1024 * 1024;
export const MAX_GROWTH_MIB = 40;
const TIMEOUT_MS = 300000;
const PROTOCOL = 'retired-node-diagnostics-v1';
const SELECTION =
  'first N touches in generations 1..rounds-1; all retired at endpoint';
const GC_PROTOCOL = {
  module: 'tools/lib/heap-quiescence.mjs',
  exposedGc: true,
  collectionsPerRound: 4,
  boundary: 'setTimeout(0)',
  epsilonBytes: 64 * 1024,
  stableRounds: 3,
  maxRounds: 40,
};
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const emit = (value) => console.log(JSON.stringify(value));

// Stable anchor for a future registry blinding mutation. Validate bytes first.
export function judge(growthMiB) {
  return growthMiB <= MAX_GROWTH_MIB;
}

function nonnegative(value, label, minimum = 0) {
  assert.ok(
    Number.isSafeInteger(value) && value >= minimum,
    `Invalid ${label}`
  );
}
function numericRecord(value, keys, label) {
  assert.ok(
    value && typeof value === 'object' && !Array.isArray(value),
    `Missing ${label}`
  );
  for (const key of keys) nonnegative(value[key], `${label}.${key}`);
  // Preserve future V8 fields too; do not silently accept non-finite diagnostics.
  for (const [key, field] of Object.entries(value)) {
    assert.ok(
      typeof field === 'number' && Number.isFinite(field) && field >= 0,
      `Invalid ${label}.${key}`
    );
  }
}
const MEMORY_KEYS = [
  'rss',
  'heapTotal',
  'heapUsed',
  'external',
  'arrayBuffers',
];
const HEAP_KEYS = [
  'total_heap_size',
  'total_heap_size_executable',
  'total_physical_size',
  'total_available_size',
  'used_heap_size',
  'heap_size_limit',
  'malloced_memory',
  'peak_malloced_memory',
  'does_zap_garbage',
  'number_of_native_contexts',
  'number_of_detached_contexts',
  'total_global_handles_size',
  'used_global_handles_size',
  'external_memory',
];
function validateEndpoint(value, label, heapLimit) {
  assert.ok(value && typeof value === 'object', `Missing ${label}`);
  nonnegative(value.quiesceHeapUsed, `${label}.quiesceHeapUsed`, 1);
  nonnegative(
    value.quiesceRounds,
    `${label}.quiesceRounds`,
    GC_PROTOCOL.stableRounds
  );
  assert.ok(
    value.quiesceRounds <= GC_PROTOCOL.maxRounds,
    `${label} did not converge`
  );
  assert.ok(value.quiesceHeapUsed <= heapLimit, `${label} exceeds heap limit`);
  numericRecord(value.memoryUsage, MEMORY_KEYS, `${label}.memoryUsage`);
  numericRecord(value.heapStatistics, HEAP_KEYS, `${label}.heapStatistics`);
  assert.equal(value.heapStatistics.heap_size_limit, heapLimit);
  assert.ok(
    Array.isArray(value.heapSpaceStatistics) &&
      value.heapSpaceStatistics.length > 0,
    `Missing ${label} heap spaces`
  );
  const names = new Set();
  for (const space of value.heapSpaceStatistics) {
    assert.ok(
      typeof space.space_name === 'string' && space.space_name.length > 0
    );
    assert.ok(!names.has(space.space_name), `Duplicate ${label} heap space`);
    names.add(space.space_name);
    const { space_name, ...numbers } = space;
    numericRecord(
      numbers,
      [
        'space_size',
        'space_used_size',
        'space_available_size',
        'physical_space_size',
      ],
      `${label}.${space_name}`
    );
  }
}

function validateRaw(raw, entry, expected) {
  assert.equal(raw.status, 'ok');
  assert.equal(raw.measurementProtocol, PROTOCOL);
  assert.equal(raw.resolvedKernelEntry, expected.kernelEntry);
  assert.equal(raw.arm, entry.arm);
  assert.equal(raw.rounds, ROUNDS);
  assert.equal(raw.liveRows, WIDTH);
  assert.equal(raw.retiredSubjects, WIDTH * ROUNDS);
  assert.ok(typeof raw.label === 'string' && raw.label.length > 0);
  assert.ok(typeof raw.detail === 'string' && raw.detail.length > 0);
  assert.ok(
    typeof raw.protocolNote === 'string' && raw.protocolNote.length > 0
  );
  const runtime = raw.runtime;
  assert.ok(
    runtime && typeof runtime === 'object',
    'Missing runtime diagnostics'
  );
  for (const key of ['node', 'v8', 'platform', 'arch', 'pid', 'nodeOptions'])
    assert.equal(runtime[key], expected[key], `runtime.${key}`);
  nonnegative(runtime.pid, 'runtime.pid', 1);
  nonnegative(runtime.heapLimitBytes, 'heap limit', 1);
  assert.deepEqual(runtime.execArgv, ['--expose-gc']);
  assert.deepEqual(runtime.gcProtocol, GC_PROTOCOL);
  validateEndpoint(raw.before, 'before', runtime.heapLimitBytes);
  validateEndpoint(raw.after, 'after', runtime.heapLimitBytes);
  const held = entry.neutralize ? 0 : entry.retain;
  assert.deepEqual(
    raw.retention,
    {
      requested: entry.retain,
      neutralized: entry.neutralize,
      selection: SELECTION,
      selectedHandles: entry.retain,
      heldHandles: held,
      uniqueHeldHandles: held,
      firstSelectedGeneration: entry.retain ? 1 : null,
      lastSelectedGeneration: entry.retain
        ? Math.ceil(entry.retain / WIDTH)
        : null,
      liveGenerationHeld: 0,
      byIdCalls: WIDTH * (ROUNDS + 1),
      nodeReads:
        entry.arm === 'no-history-node-reads' ? WIDTH * (ROUNDS + 1) : 0,
      countsValidated: true,
      postconditionNodeReads: held,
      heldHandlesReadUndefined: true,
      finalGenerationValidated: true,
    },
    'Retention selection/counters/postconditions mismatch'
  );
  const bytes = raw.after.quiesceHeapUsed - raw.before.quiesceHeapUsed;
  assert.ok(Number.isSafeInteger(bytes), 'Invalid endpoint byte delta');
  const growthMiB = bytes / MIB;
  assert.ok(Number.isFinite(growthMiB));
  // Rounded convenience figures must agree, but NEVER drive the verdict.
  assert.equal(raw.growthMB, +growthMiB.toFixed(2));
  assert.equal(
    raw.bytesPerRetiredSubject,
    Math.round(bytes / (WIDTH * ROUNDS))
  );
  return { growthBytes: bytes, growthMiB, withinCeiling: judge(growthMiB) };
}

function identity() {
  const files = [];
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort(
      (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
    )) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else {
        assert.ok(entry.isFile(), `Unexpected non-file in artifact: ${path}`);
        const bytes = readFileSync(path);
        files.push({
          path: relative(ARTIFACT, path).replaceAll('\\', '/'),
          bytes: bytes.length,
          sha256: sha256(bytes),
        });
      }
    }
  }
  visit(ARTIFACT);
  assert.ok(files.some((f) => f.path === 'dist/index.js'));
  assert.ok(files.some((f) => f.path.endsWith('.d.ts')));
  const pkg = JSON.parse(readFileSync(join(ARTIFACT, 'package.json'), 'utf8'));
  assert.equal(pkg.name, '@signal-tree/kernel');
  return {
    root: realpathSync(ARTIFACT),
    kernelEntry: ENTRY,
    package: pkg.name,
    version: pkg.version,
    algorithm:
      'sha256 of ordered JSON manifest (path, byte length, content sha256)',
    sha256: sha256(JSON.stringify(files)),
    files,
    tools: Object.fromEntries(
      [
        fileURLToPath(import.meta.url),
        BENCH,
        join(ROOT, 'tools/lib/heap-quiescence.mjs'),
        join(ROOT, '.nvmrc'),
      ].map((path) => [relative(ROOT, path), sha256(readFileSync(path))])
    ),
  };
}

function childRun(args) {
  return new Promise((resolveChild) => {
    const child = spawn(process.execPath, args, {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdout = [],
      stderr = [];
    let error = null,
      timedOut = false;
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', (failure) => {
      error = String(failure);
    });
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, TIMEOUT_MS);
    child.on('close', (exitCode, signal) => {
      clearTimeout(timeout);
      resolveChild({
        pid: child.pid ?? null,
        exitCode,
        signal,
        timedOut,
        error,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      });
    });
  });
}

function options() {
  const result = { arm: ARMS[0], selfTest: false, helpers: false };
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--arm') {
      result.arm = args[++i];
      assert.ok(ARMS.includes(result.arm), 'Unsupported --arm');
    } else if (args[i] === '--self-test') result.selfTest = true;
    else if (args[i] === '--check-helpers') result.helpers = true;
    else throw new Error(`Unknown argument: ${args[i]}`);
  }
  assert.ok(
    !(result.selfTest && args.includes('--arm')),
    '--self-test always runs both arms'
  );
  assert.ok(
    !(result.helpers && (result.selfTest || args.includes('--arm'))),
    '--check-helpers cannot select a workload'
  );
  return result;
}
function planFor(config) {
  if (!config.selfTest)
    return Array.from({ length: 3 }, (_, index) => ({
      arm: config.arm,
      sample: index + 1,
      kind: 'control',
      retain: 0,
      neutralize: false,
      expectedWithinCeiling: true,
    }));
  return ARMS.flatMap((arm) => [
    {
      arm,
      kind: 'control',
      retain: 0,
      neutralize: false,
      expectedWithinCeiling: true,
    },
    {
      arm,
      kind: 'retained',
      retain: HELD,
      neutralize: false,
      expectedWithinCeiling: false,
    },
    {
      arm,
      kind: 'neutralized',
      retain: HELD,
      neutralize: true,
      expectedWithinCeiling: true,
    },
  ]);
}
function validatePairs(results) {
  for (const arm of ARMS) {
    const group = results.filter((r) => r.arm === arm);
    assert.deepEqual(
      group.map((r) => r.kind),
      ['control', 'retained', 'neutralized']
    );
    assert.ok(
      group.every((r) => r.diagnosticValidated),
      `${arm}: invalid child cannot establish sensitivity`
    );
    const [control, retained, neutralized] = group.map((r) => r.raw.retention);
    for (const key of ['byIdCalls', 'nodeReads'])
      assert.equal(retained[key], neutralized[key], `${arm}: ${key} differs`);
    assert.equal(control.byIdCalls, retained.byIdCalls);
    assert.equal(control.nodeReads, retained.nodeReads);
    assert.equal(retained.selectedHandles, HELD);
    assert.equal(neutralized.selectedHandles, HELD);
    assert.equal(retained.heldHandles, HELD);
    assert.equal(neutralized.heldHandles, 0);
  }
}

function helperChecks() {
  assert.equal(judge(40), true);
  assert.equal(judge(40 + 1 / MIB), false);
  assert.equal(judge(16.235), true);
  assert.equal(judge(96.423), false);
  const expected = {
    kernelEntry: ENTRY,
    node: process.version,
    v8: process.versions.v8,
    platform: process.platform,
    arch: process.arch,
    pid: 123,
    nodeOptions: null,
  };
  function fixture(entry, growthBytes = 40 * MIB) {
    const snapshot = (heapUsed) => ({
      quiesceHeapUsed: heapUsed,
      quiesceRounds: 3,
      memoryUsage: Object.fromEntries(MEMORY_KEYS.map((key) => [key, 1])),
      heapStatistics: {
        ...Object.fromEntries(HEAP_KEYS.map((key) => [key, 1])),
        heap_size_limit: 1024 * MIB,
      },
      heapSpaceStatistics: [
        {
          space_name: 'synthetic',
          space_size: 1,
          space_used_size: 1,
          space_available_size: 0,
          physical_space_size: 1,
        },
      ],
    });
    const held = entry.neutralize ? 0 : entry.retain;
    return {
      status: 'ok',
      measurementProtocol: PROTOCOL,
      resolvedKernelEntry: ENTRY,
      arm: entry.arm,
      rounds: ROUNDS,
      liveRows: WIDTH,
      retiredSubjects: WIDTH * ROUNDS,
      label: 'synthetic',
      detail: 'helper only',
      protocolNote: 'no workload executed',
      runtime: {
        ...expected,
        heapLimitBytes: 1024 * MIB,
        execArgv: ['--expose-gc'],
        gcProtocol: { ...GC_PROTOCOL },
      },
      before: snapshot(10 * MIB),
      after: snapshot(10 * MIB + growthBytes),
      retention: {
        requested: entry.retain,
        neutralized: entry.neutralize,
        selection: SELECTION,
        selectedHandles: entry.retain,
        heldHandles: held,
        uniqueHeldHandles: held,
        firstSelectedGeneration: entry.retain ? 1 : null,
        lastSelectedGeneration: entry.retain ? 10 : null,
        liveGenerationHeld: 0,
        byIdCalls: WIDTH * (ROUNDS + 1),
        nodeReads: entry.arm === ARMS[1] ? WIDTH * (ROUNDS + 1) : 0,
        countsValidated: true,
        postconditionNodeReads: held,
        heldHandlesReadUndefined: true,
        finalGenerationValidated: true,
      },
      growthMB: +(growthBytes / MIB).toFixed(2),
      bytesPerRetiredSubject: Math.round(growthBytes / (WIDTH * ROUNDS)),
    };
  }
  const plan = planFor({ selfTest: true });
  for (const entry of plan)
    assert.equal(
      validateRaw(fixture(entry), entry, expected).withinCeiling,
      true
    );
  const entry = plan[0],
    good = fixture(entry);
  assert.equal(
    validateRaw(fixture(entry, 40 * MIB + 1), entry, expected).withinCeiling,
    false
  );
  const corruptions = [
    (r) => {
      delete r.before;
    },
    (r) => {
      r.after.quiesceHeapUsed = null;
    },
    (r) => {
      r.before.quiesceHeapUsed = NaN;
    },
    (r) => {
      r.after.quiesceHeapUsed = Infinity;
    },
    (r) => {
      r.after.quiesceRounds = 41;
    },
    (r) => {
      r.runtime.pid++;
    },
    (r) => {
      r.runtime.execArgv = [];
    },
    (r) => {
      delete r.after.heapStatistics.heap_size_limit;
    },
    (r) => {
      r.resolvedKernelEntry = '/wrong/kernel.js';
    },
    (r) => {
      r.retention.byIdCalls--;
    },
    (r) => {
      r.retention.nodeReads++;
    },
    (r) => {
      r.retention.heldHandles++;
    },
    (r) => {
      r.retention.neutralized = true;
    },
    (r) => {
      r.retention.firstSelectedGeneration = 0;
    },
    (r) => {
      r.retention.countsValidated = false;
    },
    (r) => {
      r.growthMB = 0;
    },
    (r) => {
      r.measurementProtocol = 'old';
    },
    (r) => {
      r.retiredSubjects--;
    },
  ];
  for (const corrupt of corruptions) {
    const bad = structuredClone(good);
    corrupt(bad);
    assert.throws(() => validateRaw(bad, entry, expected));
  }
  for (const arm of ARMS)
    assert.equal(planFor({ selfTest: false, arm }).length, 3);
  assert.equal(plan.length, 6);
  emit({
    type: 'helper-checks',
    status: 'passed',
    workloadChildren: 0,
    validFixtures: plan.length,
    rejectedCorruptions: corruptions.length,
    numericBoundaryIncludesOneByteOver: true,
    independentValidation: 'not performed',
  });
}

async function main() {
  const config = options();
  if (config.helpers) {
    helperChecks();
    return;
  }
  const before = identity(),
    plan = planFor(config),
    results = [];
  emit({
    type: 'registered-plan',
    status: 'proposed-awaiting-independent-validation',
    thresholdSelection: {
      healthyMaximumMiB: 16.235,
      heldMinimumMiB: 96.423,
      source: 'prior Linux characterization; selection data, not validation',
    },
    maxGrowthMiB: MAX_GROWTH_MIB,
    width: WIDTH,
    rounds: ROUNDS,
    childTimeoutMs: TIMEOUT_MS,
    mode: config.selfTest ? 'self-test' : 'check',
    argv: process.argv.slice(2),
    plan,
    identity: before,
    runtime: {
      node: process.version,
      v8: process.versions.v8,
      execPath: process.execPath,
      execArgv: process.execArgv,
      nodeOptions: process.env.NODE_OPTIONS ?? null,
      platform: platform(),
      arch: arch(),
      osRelease: release(),
      cpuCount: cpus().length,
      cpuModels: [...new Set(cpus().map((cpu) => cpu.model))],
      totalMemoryBytes: totalmem(),
    },
  });
  let identityError = null,
    pairError = null;
  try {
    for (const entry of plan) {
      const args = [
        '--expose-gc',
        BENCH,
        '--arm',
        entry.arm,
        '--width',
        String(WIDTH),
        '--rounds',
        String(ROUNDS),
        '--retain',
        String(entry.retain),
        ...(entry.neutralize ? ['--neutralize-retention'] : []),
      ];
      const startedAt = new Date().toISOString();
      const child = await childRun(args);
      const result = {
        ...entry,
        command: [process.execPath, ...args],
        cwd: ROOT,
        kernelEntry: ENTRY,
        artifactSHA256: before.sha256,
        startedAt,
        finishedAt: new Date().toISOString(),
        ...child,
        status: 'execution-failed',
        diagnosticValidated: false,
        raw: null,
      };
      try {
        assert.equal(child.error, null);
        assert.equal(child.timedOut, false);
        assert.equal(child.signal, null);
        assert.equal(
          child.exitCode,
          0,
          'Bench must finish normally even for an expected retention failure'
        );
        result.raw = JSON.parse(child.stdout);
        result.verdict = validateRaw(result.raw, entry, {
          kernelEntry: ENTRY,
          pid: child.pid,
          node: process.version,
          v8: process.versions.v8,
          platform: process.platform,
          arch: process.arch,
          nodeOptions: process.env.NODE_OPTIONS ?? null,
        });
        result.diagnosticValidated = true;
        result.status =
          result.verdict.withinCeiling === entry.expectedWithinCeiling
            ? 'passed'
            : 'expectation-failed';
      } catch (error) {
        result.validationError = error.stack ?? String(error);
      }
      results.push(result);
      emit({ type: 'child-result', ...result });
    }
    if (config.selfTest) {
      try {
        validatePairs(results);
      } catch (error) {
        pairError = error.stack ?? String(error);
      }
    }
  } finally {
    try {
      assert.deepEqual(
        identity(),
        before,
        'Built artifact or measurement tools changed during run'
      );
    } catch (error) {
      identityError = error.stack ?? String(error);
    }
    const executionFailed =
      !!identityError ||
      !!pairError ||
      results.length !== plan.length ||
      results.some((r) => !r.diagnosticValidated);
    const expectationsFailed = results.some(
      (r) => r.status === 'expectation-failed'
    );
    process.exitCode = executionFailed ? 2 : expectationsFailed ? 1 : 0;
    emit({
      type: 'final',
      status: process.exitCode === 0 ? 'passed' : 'failed',
      exitCode: process.exitCode,
      childrenPlanned: plan.length,
      childrenCompleted: results.length,
      artifactUnchanged: !identityError,
      artifactSHA256: before.sha256,
      identityError,
      pairError,
      independentValidation:
        'required before promotion; no asymptotic or 20 B sensitivity claim',
    });
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    await main();
  } catch (error) {
    emit({
      type: 'fatal',
      status: 'execution-failed',
      error: error.stack ?? String(error),
    });
    process.exitCode = 2;
  }
}
