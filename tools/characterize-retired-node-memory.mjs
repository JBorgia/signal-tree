#!/usr/bin/env node
/**
 * Raw, serial, fresh-process characterization. No threshold/median/verdict.
 * Defaults fixed before data: 30 node-read samples at each of 50/150 rounds;
 * 10 at 150 with 10,000 retained handles; 10 identical neutralized controls;
 * 10 byId-only controls at 150; 10 node-read controls at 150 against an
 * isolated activation-carrier deletion mutant. Width 1,000 (100 processes).
 *
 * node tools/characterize-retired-node-memory.mjs [--out DIRECTORY]
 * Small plumbing smoke ONLY (not the registered experiment):
 *   --samples 1 --controls 1 --width 4 --low-rounds 2 --high-rounds 3 --retain 4
 * Other flag: --timeout-ms 300000 (per child). Overrides are recorded verbatim.
 * Nonzero exit means an execution, identity or postcondition failure, never a
 * memory threshold verdict. All children are attempted and raw output retained.
 */
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
const config = {
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
const cells = [
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
const plan = cells.flatMap((cell) =>
  Array.from({ length: cell.samples }, (_, index) => ({
    cell: cell.name,
    sample: index + 1,
    arm: cell.arm,
    rounds: cell.rounds,
    retain: cell.retain,
    neutralize: cell.neutralize ?? false,
    mutant: cell.mutant ?? false,
  }))
);
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
    config,
    argv: process.argv.slice(2),
    order:
      'listed cell order; sample numbers ascending; serial fresh processes',
    plan,
    identity,
    mutantIdentity,
    measurementProtocol:
      'retired-node-diagnostics-v1; new fixed instrumentation overhead, not old heap-only measurements',
    interpretation:
      'Raw diagnostics only. No memory threshold or distribution summary; no inference from v16 measurements.',
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
      raw,
      stdout: `${prefix}.stdout.log`,
      stderr: `${prefix}.stderr.log`,
    };
    writeJson(`${prefix}.json`, result);
    results.push(result);
    // Persist incrementally: earlier results survive interruption or later failure.
    writeJson('results.json', {
      complete: false,
      identity,
      mutantIdentity,
      config,
      results,
    });
    console.log(`${index + 1}/${plan.length} ${prefix}: ${result.status}`);
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
  writeJson('results.json', {
    complete: true,
    identity,
    mutantIdentity,
    config,
    results,
    executionFailures: failures,
    identityFailure,
  });
  console.log(`Raw results: ${output}`);
  if (failures || identityFailure) process.exitCode = 1;
} finally {
  rmSync(mutantRoot, { recursive: true, force: true });
}
