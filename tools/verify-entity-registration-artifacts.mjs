#!/usr/bin/env node
/** Public installed/bundled replay of the source-owned 8+6+6 entity cases.
 * Consumes canonical dist; freshness belongs to verify-gates' build/seal path.
 * Setup may fetch locked peers. No builds, source aliases or private activation.
 * --self-test removes registration only in a disposable package copy.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  closeSync,
  openSync,
  cpSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertReleasePlan } from '../scripts/release-plan.mjs';
import { buildIntegrity } from '../scripts/publish-artifact-integrity.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PEERS = 'tools/fixtures/entity-registration-consumer';
const SHARED = 'packages/kernel/tests/entity-registration';
const PROBES = 'tools/experiments/entity-registration';
const names = {
  consumer: [
    'field independent useful9',
    'row independent useful9',
    'collection independent useful9',
    'field independent foreign window',
    'collection independent foreign window',
    'field dependent foreign input',
    'row dependent foreign input',
    'collection dependent foreign input',
  ],
  'lifecycle-consumer': [
    'pre-Link pending field confirm',
    'pre-Link pending field rollback',
    'pre-Link pending collection confirm',
    'pre-Link pending collection rollback',
    'late collection multiple Links confirm',
    'late collection multiple Links rollback',
  ],
  'receipt-consumer': [
    'field changed receipt / independent',
    'field changed receipt / dependent',
    'row changed receipt / independent',
    'row changed receipt / dependent',
    'collection changed receipt / independent',
    'collection changed receipt / dependent',
  ],
};
// Deliberately narrow semantic witnesses. Other errors fail the gate, but cannot
// prove the registration mutation was detected. These are unchanged fixture assertions.
const witnesses = new Set([
  'independent useful9 must deliver exactly once',
  'premature dependent publication while foreign owner pending',
  'confirmation must yield exact useful9 once',
  'must hold while actual owner pending',
  'useful terminal output exactly once',
  'changed write must not return no-write',
  'changed write must not settle as no-write',
  'dependent receipt held before confirm',
]);
const fixtureFiles = [
  ...['cases.mjs', 'lifecycle.mjs', 'receipt-cases.ts'].map(
    (f) => `${SHARED}/${f}`
  ),
  ...[...Object.keys(names), 'no-link', 'facade-imports'].map(
    (f) => `${PROBES}/${f}.mjs`
  ),
];
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sri = (bytes) =>
  'sha512-' + createHash('sha512').update(bytes).digest('base64');
const json = (path) => JSON.parse(readFileSync(path, 'utf8'));
const save = (path, value) =>
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
const within = (parent, child) => {
  const r = relative(parent, child);
  return (
    r === '' || (!isAbsolute(r) && r !== '..' && !r.startsWith('..' + sep))
  );
};
function files(root) {
  const result = {};
  function visit(path, rel) {
    const stat = lstatSync(path);
    assert(!stat.isSymbolicLink(), `symlink in package: ${path}`);
    if (stat.isDirectory()) {
      for (const name of readdirSync(path).sort())
        visit(join(path, name), rel ? `${rel}/${name}` : name);
    } else {
      assert(stat.isFile(), `special file in package: ${path}`);
      result[rel] = hash(readFileSync(path));
    }
  }
  visit(root, '');
  return result;
}
function externalGraph(lock) {
  assert.equal(lock.lockfileVersion, 3);
  return Object.fromEntries(
    Object.entries(lock.packages)
      .filter(([p]) => p && !p.startsWith('node_modules/@signal-tree/'))
      .map(([p, v]) => {
        assert(
          !v.link &&
            /^https:\/\//.test(v.resolved) &&
            /^sha512-/.test(v.integrity),
          `unlocked peer: ${p}`
        );
        assert(/^\d+\.\d+\.\d+/.test(v.version), `non-concrete peer: ${p}`);
        return [
          p,
          { version: v.version, resolved: v.resolved, integrity: v.integrity },
        ];
      })
  );
}
function classify(entry, run) {
  // A process failure or incomplete report is infrastructure unless a precise
  // assertion witness below identifies an executed behavioral failure.
  if (run.error || run.signal || ![0, 1].includes(run.status))
    return { kind: 'infrastructure', entry };
  let records;
  try {
    records = run.stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch {
    return { kind: 'infrastructure', entry };
  }
  const expected = names[entry];
  if (entry === 'receipt-consumer' && run.status === 1) {
    const error = /^Error: (.+)$/m.exec(run.stderr)?.[1];
    const prefix = records.every(
      (r, i) => r.name === expected[i] && r.pass === true
    );
    if (prefix && records.length < expected.length && witnesses.has(error)) {
      return {
        kind: 'behavior',
        entry,
        failures: [{ name: expected[records.length], message: error }],
      };
    }
    return { kind: 'infrastructure', entry };
  }
  const summary = records.pop();
  if (
    records.length !== expected.length ||
    records.some(
      (r, i) => r.name !== expected[i] || typeof r.pass !== 'boolean'
    ) ||
    summary?.total !== expected.length ||
    summary?.passed !== records.filter((r) => r.pass).length
  ) {
    return { kind: 'infrastructure', entry };
  }
  const failures = records.filter((r) => !r.pass);
  if (!failures.length && run.status === 0)
    return { kind: 'pass', entry, total: records.length };
  if (
    run.status === 1 &&
    failures.length &&
    failures.every(
      (r) =>
        r.phase !== 'setup' &&
        r.error?.name === 'Error' &&
        witnesses.has(r.error?.message)
    )
  ) {
    return {
      kind: 'behavior',
      entry,
      failures: failures.map((r) => ({
        name: r.name,
        message: r.error.message,
      })),
    };
  }
  return { kind: 'infrastructure', entry };
}
function behavioralFailures(results) {
  return results.filter((result) => result.kind === 'behavior');
}
function checkNoLink(run) {
  assert.equal(run.status, 0, 'no-Link process failed');
  assert(!run.error && !run.signal, 'no-Link process interrupted');
  assert.deepEqual(JSON.parse(run.stdout.trim()), {
    scope: 'separate production no-Link entity transactions',
    confirmed: 7,
    rolledBack: 7,
    passed: true,
  });
}
function parserTests() {
  for (const [entry, expected] of Object.entries(names)) {
    const records = expected.map((name) => ({ name, pass: true }));
    const output = (rows) => ({
      status: 0,
      stdout: [...rows, { passed: rows.length, total: rows.length }]
        .map((r) => JSON.stringify(r))
        .join('\n'),
      stderr: '',
    });
    assert.equal(classify(entry, output(records)).kind, 'pass');
    for (const rows of [
      [],
      records.slice(1),
      [...records, records[0]],
      records.map((r) => ({ ...r, name: 'wrong' })),
    ]) {
      assert.equal(classify(entry, output(rows)).kind, 'infrastructure');
    }
    assert.equal(
      classify(entry, { ...output(records), signal: 'SIGTERM' }).kind,
      'infrastructure'
    );
    assert.equal(
      classify(entry, {
        ...output(records),
        status: 1,
        stderr: 'Error: unknown',
      }).kind,
      'infrastructure'
    );
    const wrongTotal = output(records);
    wrongTotal.stdout = wrongTotal.stdout.replace(
      `"total":${records.length}`,
      '"total":0'
    );
    assert.equal(classify(entry, wrongTotal).kind, 'infrastructure');
  }
  assert.equal(
    classify('receipt-consumer', {
      status: 1,
      stdout: '',
      stderr: 'npm error ENOTFOUND',
    }).kind,
    'infrastructure'
  );
  assert.throws(() => checkNoLink({ status: 0, stdout: '{}' }));
}

// Reject an in-workspace TMPDIR before creating anything there. Walk canonical
// ancestors so a symlink or a different checkout cannot supply workspace peers.
const tempRoot = realpathSync(tmpdir());
for (let dir = tempRoot; ; dir = dirname(dir)) {
  assert(
    dir !== realpathSync(ROOT) &&
      !existsSync(join(dir, 'pnpm-workspace.yaml')) &&
      !existsSync(join(dir, '.git')),
    'TMPDIR must be outside a workspace'
  );
  if (dirname(dir) === dir) break;
}
const work = realpathSync(mkdtempSync(join(tempRoot, 'st-entity-artifact-')));
console.log(`Entity artifact evidence: ${work}`);
const report = {
  work,
  freshness: 'prebuilt artifacts; caller owns build provenance',
  runs: [],
  arms: [],
};
const env = { ...process.env };
delete env.NODE_PATH;
delete env.NODE_OPTIONS;
let serial = 0;
function command(label, argv, cwd, mustPass = true) {
  const stem = `${String(++serial).padStart(3, '0')}-${label}`;
  // File-backed descriptors preserve full Node uncaught-error diagnostics for
  // one-line minified bundles; pipe shutdown can truncate them before Error:.
  const stdout = join(work, stem + '.stdout');
  const stderr = join(work, stem + '.stderr');
  const out = openSync(stdout, 'wx');
  const err = openSync(stderr, 'wx');
  let r;
  try {
    r = spawnSync(argv[0], argv.slice(1), {
      cwd,
      env,
      stdio: ['ignore', out, err],
      timeout: 180000,
    });
  } finally {
    closeSync(out);
    closeSync(err);
  }
  r.stdout = readFileSync(stdout, 'utf8');
  r.stderr = readFileSync(stderr, 'utf8');
  const record = {
    label,
    argv,
    cwd,
    status: r.status,
    signal: r.signal,
    error: r.error?.message,
  };
  report.runs.push(record);
  save(join(work, stem + '.json'), record);
  if (r.status !== 0 || r.error || r.signal) {
    if (!existsSync(join(work, 'first-failure.json')))
      save(join(work, 'first-failure.json'), record);
    if (mustPass)
      throw new Error(`${label} failed during setup/control (see ${stem})`);
  }
  return { ...r, stdout: r.stdout || '', stderr: r.stderr || '' };
}
function pack(packages, source, label) {
  const dir = join(work, label);
  mkdirSync(dir);
  return packages.map((name) => {
    const stage = join(source, name);
    const metadata = json(join(stage, 'package.json'));
    assert.equal(metadata.name, `@signal-tree/${name}`);
    const output = JSON.parse(
      command(
        `pack-${label}-${name}`,
        [
          'npm',
          'pack',
          '--ignore-scripts',
          '--json',
          '--pack-destination',
          dir,
        ],
        stage
      ).stdout
    );
    assert.equal(output.length, 1);
    assert.equal(output[0].name, metadata.name);
    assert.equal(output[0].version, metadata.version);
    const tarball = join(dir, output[0].filename);
    const extracted = join(dir, name);
    mkdirSync(extracted);
    command(
      `extract-${label}-${name}`,
      ['tar', '-xzf', tarball, '-C', extracted],
      ROOT
    );
    const packed = files(join(extracted, 'package'));
    const built = files(stage);
    for (const [path, digest] of Object.entries(packed))
      assert.equal(digest, built[path], `packed bytes differ: ${name}/${path}`);
    return {
      name,
      version: metadata.version,
      tarball,
      integrity: sri(readFileSync(tarball)),
      files: packed,
      extracted: join(extracted, 'package'),
    };
  });
}
function graph(consumer, entry, mutant) {
  const meta = json(join(consumer, entry + '.metafile.json'));
  for (const input of Object.keys(meta.inputs)) {
    assert(
      within(consumer, realpathSync(resolve(ROOT, input))),
      `bundle escaped consumer: ${input}`
    );
  }
  const contributed = Object.values(meta.outputs).flatMap((o) =>
    Object.entries(o.inputs)
      .filter(([, v]) => v.bytesInOutput > 0)
      .map(([p]) => p.replaceAll('\\', '/'))
  );
  const modules = ['lib/link.js', 'lib/experimental-publication/entity.js'];
  const retained = modules.map((mod) =>
    contributed.some((p) => p.endsWith(`/@signal-tree/kernel/dist/${mod}`))
  );
  if (entry === 'no-link')
    assert.deepEqual(
      retained,
      [false, false],
      'no-Link retains registration modules'
    );
  else if (!mutant)
    assert.deepEqual(
      retained,
      [true, true],
      'Link/factory absent from production workload'
    );
  return {
    entry,
    retained,
    bundleSha256: hash(readFileSync(join(consumer, entry + '.production.mjs'))),
  };
}
function replay(tarballs, label, mutant = false) {
  const consumer = join(work, label);
  mkdirSync(consumer);
  for (const f of ['package.json', 'package-lock.json'])
    copyFileSync(join(ROOT, PEERS, f), join(consumer, f));
  const peerLock = json(join(consumer, 'package-lock.json'));
  const peerManifest = json(join(consumer, 'package.json'));
  assert.deepEqual(
    peerLock.packages[''].dependencies,
    peerManifest.dependencies
  );
  for (const [name, version] of Object.entries(peerManifest.dependencies)) {
    assert.equal(
      peerLock.packages[`node_modules/${name}`].version,
      version,
      `non-exact peer ${name}`
    );
  }
  const expectedPeers = externalGraph(peerLock);
  command(
    `${label}-ci`,
    ['npm', 'ci', '--ignore-scripts', '--no-audit', '--no-fund'],
    consumer
  );
  command(
    `${label}-install`,
    [
      'npm',
      'install',
      '--save-exact',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--package-lock=true',
      ...tarballs.map((t) => t.tarball),
    ],
    consumer
  );
  const lock = json(join(consumer, 'package-lock.json'));
  assert.deepEqual(
    externalGraph(lock),
    expectedPeers,
    'external dependency graph changed'
  );
  const req = createRequire(join(consumer, 'package.json'));
  for (const t of tarballs) {
    const installed = join(consumer, 'node_modules/@signal-tree', t.name);
    assert.deepEqual(
      files(installed),
      t.files,
      `installed bytes mismatch: ${t.name}`
    );
    const metadata = json(join(installed, 'package.json'));
    assert.equal(metadata.name, `@signal-tree/${t.name}`);
    assert.equal(metadata.version, t.version);
    assert.equal(
      lock.packages[`node_modules/@signal-tree/${t.name}`].integrity,
      t.integrity
    );
    assert(
      within(installed, realpathSync(req.resolve(metadata.name))),
      'public root resolves elsewhere'
    );
    const fromFacade = createRequire(join(installed, 'package.json'));
    assert.equal(
      realpathSync(fromFacade.resolve('@signal-tree/kernel')),
      realpathSync(req.resolve('@signal-tree/kernel')),
      'duplicate kernel'
    );
  }
  for (const f of fixtureFiles)
    copyFileSync(join(ROOT, f), join(consumer, f.split('/').at(-1)));
  const arm = {
    label,
    consumer,
    peerLockSha256: hash(readFileSync(join(ROOT, PEERS, 'package-lock.json'))),
    installedLockSha256: hash(
      readFileSync(join(consumer, 'package-lock.json'))
    ),
    tarballs,
    modes: {},
    graphs: [],
    blindModes: [],
  };
  report.arms.push(arm);
  try {
    const facade = command(
      `${label}-facades`,
      [process.execPath, 'facade-imports.mjs'],
      consumer
    );
    assert(
      facade.stdout.includes(
        'five facade imports share Link/error; private factory absent from public barrel'
      )
    );
    command(
      `${label}-bundle`,
      [process.execPath, join(ROOT, PROBES, 'build-consumers.mjs'), consumer],
      ROOT
    );
    for (const entry of [...Object.keys(names), 'no-link'])
      arm.graphs.push(graph(consumer, entry, mutant));
    for (const mode of ['installed', 'production']) {
      const suffix = mode === 'installed' ? '.mjs' : '.production.mjs';
      const results = Object.keys(names).map((entry) =>
        classify(
          entry,
          command(
            `${label}-${mode}-${entry}`,
            [process.execPath, entry + suffix],
            consumer,
            false
          )
        )
      );
      arm.modes[mode] = results;
      checkNoLink(
        command(
          `${label}-${mode}-no-link`,
          [process.execPath, 'no-link' + suffix],
          consumer,
          false
        )
      );
      assert(
        !results.some((r) => r.kind === 'infrastructure'),
        `${label}/${mode}: incomplete or unrecognized runtime failure`
      );
      if (mutant) {
        // Raw classified failures establish that the mutation reached behavior.
        // The independently mutated detector is tested only AFTER that fact.
        assert(
          results.some((r) => r.kind === 'behavior'),
          `${label}/${mode}: registration mutant has no behavioral witness`
        );
        if (behavioralFailures(results).length === 0) arm.blindModes.push(mode);
      } else
        assert(
          results.every((r) => r.kind === 'pass'),
          `${label}/${mode}: behavioral regression`
        );
    }
  } finally {
    for (const t of tarballs) {
      assert.equal(
        sri(readFileSync(t.tarball)),
        t.integrity,
        'tarball changed'
      );
      assert.deepEqual(
        files(join(consumer, 'node_modules/@signal-tree', t.name)),
        t.files,
        'installed package changed'
      );
    }
  }
  arm.controlsPassed = true;
  return arm;
}

let before;
let packages;
const inputPaths = [
  ...fixtureFiles,
  `${PROBES}/build-consumers.mjs`,
  `${PEERS}/package.json`,
  `${PEERS}/package-lock.json`,
  'tools/verify-entity-registration-artifacts.mjs',
  'tools/verify-gates.mjs',
  'pnpm-lock.yaml',
  'package.json',
  '.nvmrc',
];
const inputHashes = () =>
  Object.fromEntries(
    inputPaths.map((p) => [p, hash(readFileSync(join(ROOT, p)))])
  );
try {
  assert(
    process.argv.slice(2).every((a) => a === '--self-test'),
    'only --self-test is supported'
  );
  assert.equal(
    process.versions.node,
    readFileSync(join(ROOT, '.nvmrc'), 'utf8').trim(),
    'use pinned Node'
  );
  assert(
    !env.NX_WORKSPACE_ROOT_PATH || resolve(env.NX_WORKSPACE_ROOT_PATH) === ROOT,
    'Nx root points elsewhere'
  );
  packages = assertReleasePlan(ROOT);
  before = { integrity: buildIntegrity(ROOT, packages), inputs: inputHashes() };
  report.before = before;
  report.node = process.version;
  report.npm = command('npm-version', ['npm', '--version'], ROOT).stdout.trim();
  command(
    'verify-artifacts',
    [
      process.execPath,
      'scripts/prepare-publish-artifacts.mjs',
      '--verify-only',
    ],
    ROOT
  );
  const clean = pack(packages, join(ROOT, 'dist/packages'), 'clean-tarballs');
  replay(clean, 'baseline');
  if (process.argv.includes('--self-test')) {
    parserTests();
    const stage = join(work, 'mutation-stage');
    mkdirSync(stage);
    for (const t of clean)
      cpSync(t.extracted, join(stage, t.name), { recursive: true });
    const target = join(stage, 'kernel/dist/lib/link.js');
    const original = readFileSync(target, 'utf8');
    const anchor =
      'registerEntityPublicationFactory(createEntityPublicationParticipant);';
    assert.equal(
      original.split(anchor).length,
      2,
      'registration mutation requires exactly one anchor'
    );
    writeFileSync(target, original.replace(anchor, 'void 0;'));
    report.mutation = {
      file: 'kernel/dist/lib/link.js',
      anchor,
      before: hash(original),
      after: hash(readFileSync(target)),
    };
    const mutant = replay(
      pack(packages, stage, 'mutant-tarballs'),
      'mutant',
      true
    );
    replay(clean, 'recovery');
    if (mutant.blindModes.length) {
      assert.deepEqual(mutant.blindModes, ['installed', 'production']);
      report.classifierBlindness = true;
    }
  }
  report.passed = !report.classifierBlindness;
} catch (error) {
  report.passed = false;
  report.error = error.stack;
  process.exitCode = 1;
} finally {
  if (before) {
    try {
      assert.equal(
        buildIntegrity(ROOT, packages),
        before.integrity,
        'canonical artifacts changed'
      );
      assert.deepEqual(inputHashes(), before.inputs, 'gate inputs changed');
      report.inputsUnchanged = true;
    } catch (error) {
      report.passed = false;
      report.integrityError = error.stack;
      process.exitCode = 1;
    }
  }
  // A proof is emitted only after both modes AND clean recovery completed,
  // and the finally block verified the original inputs. Never infer it from
  // an error message or a generic nonzero exit (review F1).
  if (
    report.classifierBlindness &&
    report.inputsUnchanged &&
    !report.error &&
    !report.integrityError
  ) {
    report.mutationProof = {
      kind: 'entity-registration-classifier-blindness-v1',
      token: env.SIGNAL_TREE_MUTATION_PROOF_TOKEN,
      baseline: 'passed',
      mutant: 'behavioral-failures-both-modes',
      controls: 'passed',
      recovery: 'passed',
      inputs: 'unchanged',
    };
    process.exitCode = 42;
  }
  save(join(work, 'result.json'), report);
}
if (report.mutationProof) {
  console.log(
    'SIGNALTREE_MUTATION_PROOF ' + JSON.stringify(report.mutationProof)
  );
  console.error(
    'Classifier blindness identified after baseline, mutant controls and clean recovery.'
  );
} else if (report.passed)
  console.log(
    'PASS: installed + production 8+6+6, no-Link graph/control' +
      (process.argv.includes('--self-test')
        ? '; registration mutation rejected; recovery passed'
        : '')
  );
else
  console.error(
    `FAIL: ${report.error || report.integrityError}\nEvidence: ${work}`
  );
