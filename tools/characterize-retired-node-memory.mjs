#!/usr/bin/env node
/**
 * Serial fresh-process characterization, plus separately frozen validation.
 * Characterization remains raw: no threshold/median/verdict.
 * Defaults fixed before data: 30 node-read samples at each of 50/150 rounds;
 * 10 at 150 with 10,000 retained handles; 10 identical neutralized controls;
 * 10 byId-only controls at 150; 10 node-read controls at 150 against an
 * isolated activation-carrier deletion mutant. Width 1,000 (100 processes).
 *
 * node tools/characterize-retired-node-memory.mjs [--out DIRECTORY]
 * Small plumbing smoke ONLY (not the registered experiment):
 *   --samples 1 --controls 1 --width 4 --low-rounds 2 --high-rounds 3 --retain 4
 * Other flag: --timeout-ms 300000 (per child). Overrides are recorded verbatim.
 * --validation: fixed 150-process interleaved plan, 40 MiB unrounded growth
 * ceiling; control/neutral cells must pass, retained cells must fail. Cleanup
 * mutant heap verdict is descriptive; standalone deterministic guard runs on
 * original and isolated mutant after the heap samples.
 * Only --out is configurable in validation. --plumbing-smoke uses nine tiny
 * cells and NEVER qualifies the heap contract or enforces expected separation.
 * Characterization nonzero exit means execution/identity/postcondition failure.
 * Validation additionally fails on a mismatched heap expectation. Every child
 * is attempted and all raw output retained. No v16-derived ceiling or claim.
 */
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
};
const integer = (name, fallback, minimum = 1) => {
  const value = Number(arg(name, fallback));
  if (!Number.isSafeInteger(value) || value < minimum)
    throw new Error(`${name} must be an integer >= ${minimum}`);
  return value;
};
const VALIDATION = process.argv.includes('--validation');
const PLUMBING_SMOKE = process.argv.includes('--plumbing-smoke');
if (PLUMBING_SMOKE && !VALIDATION)
  throw new Error(
    '--plumbing-smoke requires --validation; characterization keeps its original override flags'
  );
if (VALIDATION) {
  for (let i = 2; i < process.argv.length; i++) {
    const flag = process.argv[i];
    if (flag === '--out') {
      if (!process.argv[++i] || process.argv[i].startsWith('--'))
        throw new Error('--out requires a directory');
    } else if (!['--validation', '--plumbing-smoke'].includes(flag)) {
      throw new Error(
        `Validation protocol is frozen; unsupported override: ${flag}`
      );
    }
  }
}
const GROSS_TOOL = 'tools/check-retired-lifetime-gross-retention.mjs';
const { judge, MAX_GROWTH_MIB } = VALIDATION
  ? await import('./check-retired-lifetime-gross-retention.mjs')
  : {};
if (VALIDATION && MAX_GROWTH_MIB !== 40)
  throw new Error('Preregistered ceiling changed');
const HEAP_CEILING_BYTES = MAX_GROWTH_MIB * 1024 * 1024;
const CLEANUP_TOOL = 'tools/check-retired-lifetime-cleanup.mjs';
const config = VALIDATION
  ? {
      width: PLUMBING_SMOKE ? 4 : 1000,
      lowRounds: PLUMBING_SMOKE ? 2 : 50,
      highRounds: PLUMBING_SMOKE ? 3 : 150,
      lowSamples: PLUMBING_SMOKE ? 1 : 20,
      highSamples: PLUMBING_SMOKE ? 1 : 30,
      controls: PLUMBING_SMOKE ? 1 : 10,
      retain: PLUMBING_SMOKE ? 4 : 10000,
      timeoutMs: 300000,
    }
  : {
      samples: integer('--samples', 30),
      controls: integer('--controls', 10),
      width: integer('--width', 1000),
      lowRounds: integer('--low-rounds', 50),
      highRounds: integer('--high-rounds', 150),
      retain: integer('--retain', 10000, 0),
      timeoutMs: integer('--timeout-ms', 300000),
    };
if (
  config.lowRounds >= config.highRounds ||
  config.retain > config.width * (config.highRounds - 1)
) {
  throw new Error(
    'Require low-rounds < high-rounds and retain within retired-generation capacity'
  );
}
const output = resolve(
  arg(
    '--out',
    join(
      ROOT,
      'artifacts',
      `retention-characterization-${new Date()
        .toISOString()
        .replace(/[:.]/g, '-')}-${process.pid}`
    )
  )
);
if (existsSync(output))
  throw new Error(`Refusing to overwrite results: ${output}`);
mkdirSync(output, { recursive: true });
const writeJson = (name, value) =>
  writeFileSync(join(output, name), `${JSON.stringify(value, null, 2)}\n`);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const git = (...args) =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const artifactRoot = join(ROOT, 'dist/packages/kernel');
function artifactIdentity(base = artifactRoot) {
  const files = [];
  const visit = (directory) => {
    for (const item of readdirSync(directory, { withFileTypes: true }).sort(
      (a, b) => a.name.localeCompare(b.name)
    )) {
      const path = join(directory, item.name);
      if (item.isDirectory()) visit(path);
      else if (item.isFile()) {
        const bytes = readFileSync(path);
        files.push({
          path: relative(base, path).replaceAll('\\', '/'),
          bytes: bytes.length,
          sha256: sha256(bytes),
        });
      } else throw new Error(`Unexpected non-file in built kernel: ${path}`);
    }
  };
  visit(base);
  if (
    !files.some((file) => file.path === 'dist/index.js') ||
    !files.some((file) => file.path.endsWith('.d.ts'))
  ) {
    throw new Error('Built kernel runtime and declaration files are required');
  }
  return {
    root: 'dist/packages/kernel',
    algorithm:
      'sha256 of JSON file manifest: relative path, byte length, content sha256',
    sha256: sha256(JSON.stringify(files)),
    files,
  };
}
const characterizationCells = [
  {
    name: 'node-reads-low',
    arm: 'no-history-node-reads',
    rounds: config.lowRounds,
    retain: 0,
    samples: config.samples,
  },
  {
    name: 'node-reads-high',
    arm: 'no-history-node-reads',
    rounds: config.highRounds,
    retain: 0,
    samples: config.samples,
  },
  {
    name: 'node-reads-retained',
    arm: 'no-history-node-reads',
    rounds: config.highRounds,
    retain: config.retain,
    samples: config.controls,
  },
  {
    name: 'node-reads-neutralized',
    arm: 'no-history-node-reads',
    rounds: config.highRounds,
    retain: config.retain,
    neutralize: true,
    samples: config.controls,
  },
  {
    name: 'byid-only-control',
    arm: 'no-history-reads',
    rounds: config.highRounds,
    retain: 0,
    samples: config.controls,
  },
  {
    name: 'carrier-deletion-mutant',
    arm: 'no-history-node-reads',
    rounds: config.highRounds,
    retain: 0,
    samples: config.controls,
    mutant: true,
  },
];
const validationCells = [
  ['node-reads-low', 'no-history-node-reads', 'low'],
  ['node-reads-high', 'no-history-node-reads', 'high'],
  ['byid-only-low', 'no-history-reads', 'low'],
  ['byid-only-high', 'no-history-reads', 'high'],
  ['node-reads-retained', 'no-history-node-reads', 'retained'],
  ['byid-only-retained', 'no-history-reads', 'retained'],
  ['node-reads-neutralized', 'no-history-node-reads', 'neutralized'],
  ['byid-only-neutralized', 'no-history-reads', 'neutralized'],
].map(([name, arm, kind]) => ({
  name,
  arm,
  rounds: kind === 'low' ? config.lowRounds : config.highRounds,
  retain: ['retained', 'neutralized'].includes(kind) ? config.retain : 0,
  samples:
    kind === 'low'
      ? config.lowSamples
      : kind === 'high'
      ? config.highSamples
      : config.controls,
  neutralize: kind === 'neutralized',
  expectedHeap: kind === 'retained' ? 'fail' : 'pass',
}));
validationCells.push({
  name: 'carrier-deletion-mutant',
  arm: 'no-history-node-reads',
  rounds: config.highRounds,
  retain: 0,
  samples: config.controls,
  mutant: true,
  expectedHeap: 'descriptive',
});
const cells = VALIDATION ? validationCells : characterizationCells;
const plan = cells.flatMap((cell, cellIndex) =>
  Array.from({ length: cell.samples }, (_, index) => ({
    cell: cell.name,
    sample: index + 1,
    arm: cell.arm,
    rounds: cell.rounds,
    retain: cell.retain,
    neutralize: cell.neutralize ?? false,
    mutant: cell.mutant ?? false,
    ...(VALIDATION ? { cellIndex, expectedHeap: cell.expectedHeap } : {}),
  }))
);
if (VALIDATION) {
  plan.sort((a, b) => a.sample - b.sample || a.cellIndex - b.cellIndex);
  if (plan.length !== (PLUMBING_SMOKE ? 9 : 150))
    throw new Error('Invalid validation plan count');
}
function assessHeap(deltaBytes, expected) {
  if (!Number.isSafeInteger(deltaBytes))
    throw new Error('Invalid raw heap delta');
  const passed = judge(deltaBytes / (1024 * 1024));
  if (typeof passed !== 'boolean') throw new Error('Invalid shared verdict');
  return {
    deltaBytes,
    ceilingBytes: HEAP_CEILING_BYTES,
    passed,
    expected,
    expectationMatched:
      expected === 'descriptive' ? null : passed === (expected === 'pass'),
  };
}
const protocol = {
  mode: VALIDATION ? 'validation' : 'characterization',
  qualification: PLUMBING_SMOKE
    ? 'NOT_QUALIFICATION_PLUMBING_SMOKE'
    : 'full-protocol',
  ...(VALIDATION
    ? {
        heapCeilingBytes: HEAP_CEILING_BYTES,
        compare:
          'after.quiesceHeapUsed - before.quiesceHeapUsed <= ceiling, unrounded',
        orderAlgorithm:
          'Round-robin listed cell order by ascending sample index; exhausted cells omitted',
        ceilingBasis:
          'Frozen v15 engineering margin: 16.235 MiB observed healthy maximum + 23.765 MiB headroom; 96.423 MiB gross-retention minimum - 56.423 MiB margin. Not transferred from v16.',
        cleanupGuard:
          'Run standalone guard once on original and once on isolated activation-cleanup mutant; require 0/passed and 1/cleanup-failed with only carrier-map failures across all four cases; also run original --self-test requiring all three registered mutants and exact restorations.',
      }
    : {}),
};

let identity;
let mutantRoot;
let mutantIdentity;
try {
  identity = {
    recordedBeforeWork: new Date().toISOString(),
    sourceSHA: git('rev-parse', 'HEAD'),
    worktreeStatus: git('status', '--porcelain'),
    trackedDiffSHA256: sha256(
      execFileSync('git', ['diff', 'HEAD', '--binary'], { cwd: ROOT })
    ),
    toolFiles: Object.fromEntries(
      [
        'tools/bench-entity-churn-retention.mjs',
        'tools/characterize-retired-node-memory.mjs',
        'tools/lib/heap-quiescence.mjs',
        ...(VALIDATION ? [CLEANUP_TOOL, GROSS_TOOL] : []),
        '.github/workflows/retention-characterization.yml',
        '.nvmrc',
        'pnpm-lock.yaml',
      ].map((path) => [path, sha256(readFileSync(join(ROOT, path)))])
    ),
    artifact: artifactIdentity(),
  };
  mutantRoot = mkdtempSync(join(tmpdir(), 'signaltree-retired-carrier-'));
  mkdirSync(join(mutantRoot, 'dist'), { recursive: true });
  cpSync(join(ROOT, 'dist/packages'), join(mutantRoot, 'dist/packages'), {
    recursive: true,
  });
  symlinkSync(
    join(ROOT, 'node_modules'),
    join(mutantRoot, 'node_modules'),
    'dir'
  );
  const copiedKernel = join(mutantRoot, 'dist/packages/kernel');
  if (artifactIdentity(copiedKernel).sha256 !== identity.artifact.sha256)
    throw new Error('Isolated kernel copy differs before mutation');
  const target = 'dist/lib/entity-signal.js';
  const originalPath = join(artifactRoot, target);
  const mutantPath = join(copiedKernel, target);
  const original = readFileSync(mutantPath, 'utf8');
  const anchor = 'subjectStateSignals.delete(subjectId);';
  if (original.split(anchor).length - 1 !== 1)
    throw new Error(
      'Carrier deletion mutation requires exactly one built-source anchor'
    );
  const mutated = original.replace(anchor, '');
  writeFileSync(mutantPath, mutated);
  const patch = spawnSync(
    'git',
    ['diff', '--no-index', '--', originalPath, mutantPath],
    { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }
  );
  if (patch.status !== 1)
    throw new Error('Could not record exact isolated mutation patch');
  writeFileSync(join(output, 'carrier-deletion.patch'), patch.stdout);
  mutantIdentity = {
    patch: 'carrier-deletion.patch',
    target,
    anchor,
    replacement: '',
    originalFileSHA256: sha256(original),
    mutantFileSHA256: sha256(mutated),
    originalArtifactSHA256: identity.artifact.sha256,
    artifact: artifactIdentity(copiedKernel),
    copiedPackages: readdirSync(join(mutantRoot, 'dist/packages')).sort(),
    externalDependencies:
      'installed node_modules; complete built package set copied',
  };
  writeJson('mutation.json', mutantIdentity);
  writeJson('manifest.json', {
    status: 'registered-before-work',
    protocol,
    config,
    argv: process.argv.slice(2),
    order: VALIDATION
      ? 'round-robin listed cell order by sample index; serial fresh processes; exact order below'
      : 'listed cell order; sample numbers ascending; serial fresh processes',
    plan,
    ...(VALIDATION
      ? {
          cleanupPlan: [
            'original',
            'carrier-deletion-mutant',
            'original-self-test',
          ],
          cleanupTool: CLEANUP_TOOL,
        }
      : {}),
    identity,
    mutantIdentity,
    measurementProtocol:
      'retired-node-diagnostics-v1; diagnostic allocation/timing overhead; constancy not established; not old heap-only measurements',
    interpretation: VALIDATION
      ? 'Independent test of the frozen v15 gross-heap contract; no slope or leak-freedom claim. Plumbing smoke cannot qualify it.'
      : 'Raw diagnostics only. No memory threshold or distribution summary; no inference from v16 measurements.',
  });
} catch (error) {
  writeJson('failure.json', {
    phase: 'identity-before-work',
    error: String(error),
    config,
    plan,
  });
  if (mutantRoot) rmSync(mutantRoot, { recursive: true, force: true });
  throw error;
}
const results = [];
const cleanupResults = [];
try {
  for (const [index, entry] of plan.entries()) {
    const prefix = `${String(index + 1).padStart(3, '0')}-${entry.cell}-${
      entry.sample
    }`;
    const args = [
      '--expose-gc',
      join(ROOT, 'tools/bench-entity-churn-retention.mjs'),
      '--arm',
      entry.arm,
      '--width',
      String(config.width),
      '--rounds',
      String(entry.rounds),
      '--retain',
      String(entry.retain),
      ...(entry.neutralize ? ['--neutralize-retention'] : []),
    ];
    const childCwd = realpathSync(entry.mutant ? mutantRoot : ROOT);
    const startedAt = new Date().toISOString();
    const child = spawnSync(process.execPath, args, {
      cwd: childCwd,
      encoding: 'utf8',
      timeout: config.timeoutMs,
      maxBuffer: 16 * 1024 * 1024,
    });
    writeFileSync(join(output, `${prefix}.stdout.log`), child.stdout ?? '');
    writeFileSync(join(output, `${prefix}.stderr.log`), child.stderr ?? '');
    let raw = null;
    let error = child.error ? String(child.error) : null;
    let heapRule = null;
    try {
      if (child.status !== 0)
        throw new Error(`Child exit ${child.status}; signal ${child.signal}`);
      raw = JSON.parse(child.stdout.trim());
      const expectedTouches = config.width * (entry.rounds + 1);
      if (
        raw.resolvedKernelEntry !==
          join(childCwd, 'dist/packages/kernel/dist/index.js') ||
        raw.arm !== entry.arm ||
        raw.rounds !== entry.rounds ||
        raw.liveRows !== config.width ||
        raw.retiredSubjects !== config.width * entry.rounds ||
        !raw.retention?.countsValidated ||
        !raw.retention.finalGenerationValidated ||
        !raw.retention.heldHandlesReadUndefined ||
        raw.retention.selectedHandles !== entry.retain ||
        raw.retention.heldHandles !== (entry.neutralize ? 0 : entry.retain) ||
        raw.retention.byIdCalls !== expectedTouches ||
        raw.retention.nodeReads !==
          (entry.arm === 'no-history-node-reads' ? expectedTouches : 0)
      ) {
        throw new Error('Child configuration/count postcondition mismatch');
      }
      if (VALIDATION) {
        if (
          ![raw.after?.quiesceHeapUsed, raw.before?.quiesceHeapUsed].every(
            (value) => Number.isSafeInteger(value) && value >= 0
          )
        )
          throw new Error('Invalid raw heap snapshots');
        heapRule = assessHeap(
          raw.after.quiesceHeapUsed - raw.before.quiesceHeapUsed,
          entry.expectedHeap
        );
      }
    } catch (failure) {
      error = [error, String(failure)].filter(Boolean).join('; ');
    }
    const result = {
      ...entry,
      startedAt,
      finishedAt: new Date().toISOString(),
      sourceSHA: identity.sourceSHA,
      artifactSHA256: entry.mutant
        ? mutantIdentity.artifact.sha256
        : identity.artifact.sha256,
      command: [process.execPath, ...args],
      cwd: childCwd,
      status: error ? 'execution-failed' : 'ok',
      exitCode: child.status,
      signal: child.signal,
      error,
      ...(VALIDATION ? { heapRule } : {}),
      raw,
      stdout: `${prefix}.stdout.log`,
      stderr: `${prefix}.stderr.log`,
    };
    writeJson(`${prefix}.json`, result);
    results.push(result);
    // Persist incrementally: earlier results survive interruption or later failure.
    writeJson('results.json', {
      complete: false,
      protocol,
      identity,
      mutantIdentity,
      config,
      results,
    });
    console.log(`${index + 1}/${plan.length} ${prefix}: ${result.status}`);
  }
  if (VALIDATION) {
    const carrierChecks = new Set([
      'retired A wrapper absent',
      'first retirement size',
      'B wrapper membership',
      'all wrappers removed before destroy',
      'flush does not reinsert wrappers',
      'fresh lifetime only',
      'replacement wrapper removed',
      'empty before destruction',
      'destroy cannot mask uncleared wrappers',
    ]);
    function validateProbe(run, mutation = null) {
      assert.equal(run.exitCode, mutation ? 1 : 0);
      assert.equal(run.signal, null);
      assert.equal(run.spawnError, null);
      const receipt = run.result;
      assert.equal(receipt.status, mutation ? 'cleanup-failed' : 'passed');
      assert.equal(receipt.toolSHA256, identity.toolFiles[CLEANUP_TOOL]);
      assert.equal(receipt.artifactUnchanged, true);
      const probe = receipt.probe;
      assert.equal(probe.prototypeRestored, true);
      assert.equal(probe.structuralPrototypeRestored, true);
      assert.deepEqual(
        probe.cases.map((c) => c.operation),
        ['setAll', 'removeOne', 'removeMany', 'clear']
      );
      assert.deepEqual(
        probe.lateReads.map((c) => c.operation),
        ['node', 'field', 'write', 'replacement', 'restorable']
      );
      const failures = [...probe.cases, ...probe.lateReads].flatMap((c) =>
        c.checks.filter((check) => !check.passed)
      );
      assert.equal(failures.length, probe.failureCount);
      assert.equal(failures.length, probe.failures.length);
      assert.ok(mutation ? failures.length > 0 : failures.length === 0);
      for (const c of probe.cases) {
        assert.equal(c.nonvacuousPopulation.entries, 2);
        assert.equal(c.nonvacuousPopulation.registries, 1);
        assert.equal(c.nonvacuousPopulation.structuralStores, 1);
        assert.equal(c.nonvacuousPopulation.lifetimeEntries, 2);
        assert.equal(c.nonvacuousPopulation.revisionEntries, 2);
        assert.equal(c.prototypeRestored, true);
        assert.equal(c.structuralPrototypeRestored, true);
        assert.ok(
          c.checks.length > 0 &&
            c.checks.every((check) => typeof check.passed === 'boolean')
        );
        const failed = c.checks.filter((check) => !check.passed);
        if (mutation === 'activation-deletion') {
          assert.ok(
            failed.some((check) => check.name === 'retired A wrapper absent')
          );
          assert.ok(
            failed.every((check) => carrierChecks.has(check.name)),
            'Unrelated ledger/behavior control failed'
          );
        } else if (mutation === 'revision-resurrection') {
          const id = c.nonvacuousPopulation.subjectIds[0];
          assert.ok(
            failed.some(
              (check) =>
                check.name ===
                  `revision: first retirement retired ${id} absent` &&
                check.actual === true &&
                check.expected === false
            )
          );
          assert.ok(
            failed.every((check) => check.name.startsWith('revision:')),
            'Unrelated carrier/lifetime control failed'
          );
        } else if (mutation === 'late-registration') {
          assert.deepEqual(
            failed,
            [],
            'Late registration mutation broke existing cleanup'
          );
        }
      }
      for (const c of probe.lateReads) {
        assert.equal(c.prototypeRestored, true);
        assert.ok(
          c.checks.length > 0 &&
            c.checks.every((check) => typeof check.passed === 'boolean')
        );
        const failed = c.checks.filter((check) => !check.passed);
        if (mutation === 'late-registration' && c.operation !== 'restorable') {
          assert.ok(
            failed.some(
              (check) =>
                check.name === 'late: registration count' &&
                check.actual === 1 &&
                check.expected === 0
            )
          );
          assert.ok(
            failed.every((check) =>
              [
                'late: registration count',
                'late: registry membership after microtasks',
              ].includes(check.name)
            ),
            'Unrelated late-read behavior failed'
          );
        } else {
          assert.deepEqual(
            failed,
            [],
            'Unrelated late-read/restore control failed'
          );
        }
        if (c.operation === 'restorable') {
          assert.ok(
            c.checks.some(
              (check) =>
                check.name === 'late: reactive undo witnessed' && check.passed
            )
          );
        }
      }
    }
    for (const label of [
      'original',
      'carrier-deletion-mutant',
      'original-self-test',
    ]) {
      const mutant = label === 'carrier-deletion-mutant';
      const selfTest = label === 'original-self-test';
      const artifact = realpathSync(
        mutant ? join(mutantRoot, 'dist/packages/kernel') : artifactRoot
      );
      const args = [
        join(ROOT, CLEANUP_TOOL),
        '--artifact',
        artifact,
        ...(selfTest ? ['--self-test'] : []),
      ];
      const child = spawnSync(process.execPath, args, {
        cwd: ROOT,
        encoding: 'utf8',
        timeout: 300000,
        maxBuffer: 16 * 1024 * 1024,
      });
      const prefix = `cleanup-${label}`;
      writeFileSync(join(output, `${prefix}.stdout.log`), child.stdout ?? '');
      writeFileSync(join(output, `${prefix}.stderr.log`), child.stderr ?? '');
      let raw = null;
      let error = null;
      try {
        assert.equal(child.error, undefined);
        assert.equal(child.signal, null);
        assert.equal(child.status, mutant ? 1 : 0);
        raw = JSON.parse(child.stdout);
        assert.equal(raw.status, mutant ? 'cleanup-failed' : 'passed');
        assert.equal(raw.toolSHA256, identity.toolFiles[CLEANUP_TOOL]);
        assert.equal(raw.artifact.root, artifact);
        assert.equal(raw.artifactUnchanged, true);
        if (selfTest) {
          const names = [
            'late-registration',
            'activation-deletion',
            'revision-resurrection',
          ];
          assert.equal(raw.mode, 'self-test');
          assert.equal(raw.temporaryCopyRemoved, true);
          assert.deepEqual(
            raw.mutations.map((mutation) => mutation.name),
            names
          );
          assert.deepEqual(
            raw.runs.map((run) => run.label),
            names.flatMap((name) => [
              `${name}:control-copy`,
              `${name}:mutant`,
              `${name}:restored-copy`,
            ])
          );
          for (const [i, mutation] of raw.mutations.entries()) {
            assert.equal(mutation.onlyTargetChanged, true);
            assert.equal(mutation.restoration.matchesOriginal, true);
            assert.equal(
              mutation.restoration.artifact.sha256,
              raw.artifact.sha256
            );
            for (let j = 0; j < 3; j++) {
              const run = raw.runs[i * 3 + j];
              validateProbe(run, j === 1 ? mutation.name : null);
              assert.equal(
                run.result.artifact.sha256,
                j === 1 ? mutation.artifact.sha256 : raw.artifact.sha256
              );
            }
          }
        } else {
          assert.equal(raw.mode, 'check');
          assert.equal(raw.runs.length, 1);
          validateProbe(raw.runs[0], mutant ? 'activation-deletion' : null);
          assert.equal(raw.runs[0].result.artifact.sha256, raw.artifact.sha256);
        }
      } catch (failure) {
        error = String(failure);
      }
      const record = {
        label,
        command: [process.execPath, ...args],
        exitCode: child.status,
        signal: child.signal,
        status: error ? 'execution-failed' : 'expected-result',
        error,
        raw,
        stdout: `${prefix}.stdout.log`,
        stderr: `${prefix}.stderr.log`,
      };
      cleanupResults.push(record);
      writeJson(`${prefix}.json`, record);
      writeJson('results.json', {
        complete: false,
        qualified: false,
        protocol,
        identity,
        mutantIdentity,
        config,
        results,
        cleanupResults,
      });
    }
  }
  let identityFailure = null;
  try {
    if (
      artifactIdentity().sha256 !== identity.artifact.sha256 ||
      artifactIdentity(join(mutantRoot, 'dist/packages/kernel')).sha256 !==
        mutantIdentity.artifact.sha256 ||
      git('rev-parse', 'HEAD') !== identity.sourceSHA ||
      sha256(
        execFileSync('git', ['diff', 'HEAD', '--binary'], { cwd: ROOT })
      ) !== identity.trackedDiffSHA256 ||
      Object.entries(identity.toolFiles).some(
        ([path, hash]) => sha256(readFileSync(join(ROOT, path))) !== hash
      )
    ) {
      throw new Error(
        'Source HEAD/tools/tracked diff, original artifact or isolated mutant changed during characterization'
      );
    }
  } catch (error) {
    identityFailure = String(error);
  }
  const failures = results.filter((result) => result.status !== 'ok').length;
  const mismatches = results.filter(
    (result) => result.heapRule?.expectationMatched === false
  ).length;
  const completenessFailure =
    results.length !== plan.length ||
    (VALIDATION &&
      (results.length !== (PLUMBING_SMOKE ? 9 : 150) ||
        results.some((result) => !result.heapRule)))
      ? 'Missing planned samples or heap verdicts'
      : null;
  const cleanupFailures = cleanupResults.filter(
    (result) => result.error
  ).length;
  const validationFailed =
    VALIDATION &&
    ((!PLUMBING_SMOKE && mismatches > 0) ||
      cleanupFailures > 0 ||
      cleanupResults.length !== 3);
  const qualified =
    VALIDATION &&
    !PLUMBING_SMOKE &&
    !failures &&
    !identityFailure &&
    !completenessFailure &&
    !validationFailed;
  writeJson('results.json', {
    complete: true,
    protocol,
    qualified,
    completenessFailure,
    ...(VALIDATION
      ? {
          cleanupResults,
          cleanupFailures,
          heapExpectationMismatches: mismatches,
          validationOutcome: PLUMBING_SMOKE
            ? 'NOT_QUALIFICATION_PLUMBING_SMOKE'
            : qualified
            ? 'validated'
            : 'failed',
          cleanupGuardOutcome:
            cleanupFailures || cleanupResults.length !== 3
              ? 'failed'
              : 'original-passed-mutant-cleanup-failed-all-three-self-test-mutations-verified',
        }
      : {}),
    identity,
    mutantIdentity,
    config,
    results,
    executionFailures: failures,
    identityFailure,
  });
  console.log(`Raw results: ${output}`);
  if (failures || identityFailure || completenessFailure || validationFailed)
    process.exitCode = 1;
} finally {
  rmSync(mutantRoot, { recursive: true, force: true });
}
