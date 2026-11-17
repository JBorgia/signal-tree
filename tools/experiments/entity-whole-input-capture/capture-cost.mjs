import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { cpus, platform, arch } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const self = fileURLToPath(import.meta.url);
const digest = value => createHash('sha256').update(value).digest('hex');
const fileHash = path => digest(readFileSync(path));
const save = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const profiles = ['no-history', 'homogeneous', 'mixed'];
const captures = 20;
const roles = ['owners', 'destination', 'input', 'validation', 'possible'];
const frozenCommit = '5d04ff65d2eaab1986ed1b420cbc013edc01542b';
const receiptHashes = {
  baseline: '5ee1968cb23a2c1b1c7b9cff60286f2ec169babba14d4fb1399740b4102f3c9f',
  candidate: '506f04f4e28ddb3018e59c1b175db51cc0e1f7ce0d124bb8a349dbdbe8e4898c',
};

function packageFiles(root, directory = root) {
  const result = [];
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...packageFiles(root, path));
    else {
      assert.ok(entry.isFile(), `Non-file package payload: ${path}`);
      const bytes = readFileSync(path);
      result.push({ path: relative(root, path), bytes: bytes.length, sha256: digest(bytes) });
    }
  }
  return result;
}
function packageBinding(root, arm) {
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.equal(manifest.name, '@signal-tree/kernel');
  const files = packageFiles(root);
  const receiptPath = join(dirname(root), 'bindings.json'), receiptBytes = readFileSync(receiptPath);
  assert.equal(digest(receiptBytes), receiptHashes[arm], `${arm} artifact receipt is not the reviewed version`);
  const receipt = JSON.parse(receiptBytes);
  assert.equal(arm === 'baseline' ? receipt.commit : receipt.baselineCommit, frozenCommit);
  const expected = arm === 'baseline'
    ? Object.entries(receipt.package).filter(([path]) => path.includes('/package/')).map(([path, sha256]) => ({ path: path.slice(path.indexOf('/package/') + '/package/'.length), sha256 }))
    : receipt.files.map(({ path, sha256 }) => ({ path, sha256 }));
  const ordered = entries => entries.map(({ path, sha256 }) => ({ path, sha256 })).sort((a, b) => a.path.localeCompare(b.path));
  assert.equal(expected.length, 144, 'Expected exact reviewed kernel payload inventory');
  assert.deepEqual(ordered(files), ordered(expected), `${arm} package differs from its source/build receipt`);
  return { root, version: manifest.version, files, identity: digest(JSON.stringify(files)),
    admission: { receiptPath, receiptSha256: digest(receiptBytes), baselineCommit: frozenCommit,
      source: arm === 'baseline' ? receipt.source : receipt.sourceFiles } };
}
function verifyPackage(binding) {
  assert.equal(fileHash(binding.admission.receiptPath), binding.admission.receiptSha256, 'Artifact receipt drifted');
  assert.deepEqual(packageFiles(binding.root), binding.files, 'Package bytes drifted');
}

function plan(baselineRoot, candidateRoot, out, mode = 'comparison') {
  assert.ok(mode === 'comparison' || mode === 'tiny-calibration');
  const selectedProfiles = mode === 'tiny-calibration' ? ['tiny-history'] : profiles;
  baselineRoot = resolve(baselineRoot); candidateRoot = resolve(candidateRoot); out = resolve(out);
  for (const input of [baselineRoot, candidateRoot, dirname(self)])
    assert.ok(out !== input && !out.startsWith(input + sep), 'Output must not mutate a bound input');
  assert.ok(!existsSync(out), 'Use a new output directory; first runs are never overwritten');
  const arms = { baseline: packageBinding(baselineRoot, 'baseline'), candidate: packageBinding(candidateRoot, 'candidate') };
  const protocolPath = join(dirname(self), 'protocol.json');
  const protocol = JSON.parse(readFileSync(protocolPath, 'utf8'));
  const rows = [];
  // Two same-arm pairs per profile are a descriptive variation control.
  for (const profile of selectedProfiles) for (let pair = 0; pair < 2; pair++)
    for (const replicate of [0, 1]) rows.push({ group: 'AA', profile, pair, replicate, arm: 'baseline' });
  for (let pair = 0; pair < 5; pair++) for (const profile of selectedProfiles)
    for (const arm of pair % 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate'])
      rows.push({ group: 'comparison', profile, pair, arm });
  const controls = ['missing-capture', 'swapped-requirement', 'swapped-owner'].map(fault => ({ group: 'control', profile: 'homogeneous', arm: 'candidate', fault }));
  mkdirSync(out, { recursive: false });
  mkdirSync(join(out, 'source'));
  writeFileSync(join(out, 'source', 'capture-cost.mjs'), readFileSync(self), { flag: 'wx' });
  writeFileSync(join(out, 'source', 'protocol.json'), readFileSync(protocolPath), { flag: 'wx' });
  for (const [arm, binding] of Object.entries(arms))
    writeFileSync(join(out, 'source', `${arm}-bindings.json`), readFileSync(binding.admission.receiptPath), { flag: 'wx' });
  const result = { version: 2, mode, generatorSha256: fileHash(self), protocolSha256: fileHash(protocolPath), protocol, captures,
    node: process.version, executable: process.execPath, executableSha256: fileHash(process.execPath), platform: platform(), arch: arch(), cpu: cpus()[0]?.model,
    arms, controls, rows };
  save(join(out, 'plan.json'), result);
  console.log(JSON.stringify({ out, normalChildren: rows.length, controls: controls.length, planSha256: fileHash(join(out, 'plan.json')) }));
}

async function child(planPath, index, control) {
  const planBytes = readFileSync(planPath), registered = JSON.parse(planBytes);
  assert.equal(fileHash(self), registered.generatorSha256);
  assert.equal(process.version, registered.node);
  assert.equal(fileHash(process.execPath), registered.executableSha256);
  assert.equal(typeof global.gc, 'function', 'Run child with --expose-gc');
  const task = (control ? registered.controls : registered.rows)[index];
  assert.ok(task, 'Unknown registered child');
  const binding = registered.arms[task.arm]; verifyPackage(binding);
  globalThis.ngDevMode = false;
  const load = path => import(pathToFileURL(join(binding.root, path)).href);
  const { signalTree, entityMap, transactions } = await load('dist/index.js');
  const { getEntityPublicationBinding } = await load('dist/lib/internals/entity-publication.js');
  const lifecycle = await load('dist/lib/experimental-publication/lifecycle.js');
  const { ExactSubjectRuns } = await load('dist/lib/internals/exact-subject-runs.js');
  const { getPathNotifier } = await load('dist/lib/path-notifier.js');
  const flush = async () => { getPathNotifier().flushSync(); for (let n = 0; n < 160; n++) await Promise.resolve(); };
  const collect = async () => { for (let n = 0; n < 4; n++) { await new Promise(setImmediate); global.gc(); } return process.memoryUsage().heapUsed; };
  const row = (id, value) => ({ id, f0: value, f1: 1, f2: 2, f3: 3, f4: 4, f5: 5, f6: 6, f7: 7 });
  const tree = signalTree({ rows: entityMap() }, { enhancers: [transactions()] });
  const rows = tree.$.rows, source = getEntityPublicationBinding(rows)?.source;
  assert.ok(source);
  let historicalSubjects = 0;
  try {
    const bulkRollback = async count => {
      const tx = tree.transact(() => rows.setAll(Array.from({ length: count }, (_, i) => row(String(i), i))));
      assert.equal(rows.all().length, count);
      await flush(); tx.rollback(); await flush();
      historicalSubjects += count;
      assert.deepEqual(rows.all(), []);
    };
    if (task.profile === 'homogeneous') for (let cycle = 0; cycle < 10; cycle++) await bulkRollback(1000);
    if (task.profile === 'tiny-history') await bulkRollback(2);
    if (task.profile === 'mixed') {
      for (let cycle = 0; cycle < 5; cycle++) await bulkRollback(200);
      const tx = tree.transact(() => { for (let i = 0; i < 256; i++) rows.addOne(row(`distinct${i}`, i)); });
      assert.equal(rows.all().length, 256); await flush(); tx.rollback(); await flush();
      historicalSubjects += 256; assert.deepEqual(rows.all(), []);
      assert.ok(source.inspect().unpackedSubjectFacets > 0, 'Mixed profile must exercise ordinary-map fallback');
    }
    const activeRows = task.profile === 'no-history' || task.profile === 'tiny-history' ? 1000 : task.profile === 'mixed' ? 200 : 0;
    if (activeRows) {
      rows.setAll(Array.from({ length: activeRows }, (_, i) => row(`live${i}`, i)));
      for (let i = 0; i < 20; i++) rows.updateOne(`live${i}`, { f0: i + 10000 });
      await flush();
      assert.equal(rows.all().length, activeRows);
      for (let i = 0; i < 20; i++) assert.equal(rows.byIdOrFail(`live${i}`).f0(), i + 10000);
      assert.equal(rows.byIdOrFail('live20').f0(), 20);
    }
    const profileState = source.inspect();
    if (task.profile === 'homogeneous') {
      assert.equal(profileState.packedSubjects, 10000, 'Homogeneous history must be packed');
      assert.ok(profileState.packedRuns > 0);
      assert.equal(profileState.unpackedSubjectFacets, 0);
      for (const key of ['rows', 'fields', 'viewRows', 'viewFields', 'placements']) assert.equal(profileState[key], 0, `Unexpected active ${key}`);
    } else if (task.profile === 'no-history') {
      assert.equal(profileState.packedSubjects, 0);
      assert.equal(profileState.packedRuns, 0);
    } else if (task.profile === 'tiny-history') {
      assert.equal(profileState.packedSubjects, 2);
      assert.equal(profileState.packedRuns, 1);
    } else {
      assert.ok(profileState.packedSubjects > 0, 'Mixed history must include packed facts');
      assert.ok(profileState.packedRuns > 0);
    }
    // This independently expanded route stays unchanged in the candidate.
    // Its temporary array dies before the pre-timer GC checkpoint.
    const reference = (() => {
      const views = source.captureViews();
      const requirements = [...new Set(views.map(view => view.requirement))];
      return { represented: views.length, requirements, inputs: requirements.map(lifecycle.captureNativeInput) };
    })();
    assert.ok(reference.requirements.length > 0, 'No vacuous capture workload');
    assert.equal(reference.represented, historicalSubjects * 2 + activeRows * 11);
    const ownerTokens = new WeakMap(); let nextOwner = 0;
    const ownerToken = owner => { if (!ownerTokens.has(owner)) ownerTokens.set(owner, nextOwner++); return ownerTokens.get(owner); };
    const proofSnapshot = requirement => {
      const proof = lifecycle.nativeProof(requirement);
      return { ...Object.fromEntries(roles.map(role => [role, (proof[role] ?? []).map(owner => ({ token: ownerToken(owner), outcome: owner.outcome }))])),
        unknown: proof.unknown, invalid: proof.invalid, unavailableInput: proof.unavailableInput ?? false,
        historicalWindow: proof.historicalWindow ?? false, terminalRejectedRoles: proof.terminalRejectedRoles ?? 0 };
    };
    const proofs = reference.requirements.map(proofSnapshot);
    const expectedCapturedOwners = reference.inputs.map(input => input.owners.map(ownerToken));
    const captured = new Array(captures);
    const heapBefore = await collect();
    const before = source.inspect();
    const startCpu = process.cpuUsage(), start = performance.now();
    for (let n = 0; n < captures; n++) if (!(task.fault === 'missing-capture' && n === captures - 1)) captured[n] = source.captureInput();
    const elapsedMs = performance.now() - start, cpu = process.cpuUsage(startCpu);
    const heapImmediate = process.memoryUsage().heapUsed;
    const after = source.inspect();
    // Sample the retained capture results before diagnostic Sets and iterator
    // wrappers allocate their own scaffolding. They are not library payload.
    const heapWithCaptures = await collect();
    if (task.fault === 'swapped-requirement') {
      assert.ok(captured[0].native.length > 1);
      const changed = [...captured[0].native]; [changed[0], changed[1]] = [changed[1], changed[0]];
      captured[0] = { native: Object.freeze(changed) };
    }
    if (task.fault === 'swapped-owner') {
      const changed = [...captured[0].native];
      assert.notEqual(changed[0].owners[0], changed[1].owners[0]);
      changed[0] = Object.freeze({ ...changed[0], owners: Object.freeze([...changed[1].owners]) });
      captured[0] = { native: Object.freeze(changed) };
    }
    const arrays = new Set(), inputs = new Set(), ownerArrays = new Set();
    for (const result of captured) {
      assert.ok(result, 'missing-capture oracle'); assert.ok(Object.isFrozen(result.native));
      assert.ok(!arrays.has(result.native), 'native array reused'); arrays.add(result.native);
      assert.equal(result.native.length, reference.requirements.length);
      result.native.forEach((input, index) => {
        assert.equal(input.requirement, reference.requirements[index], 'requirement identity/order oracle');
        assert.ok(Object.isFrozen(input)); assert.ok(!inputs.has(input), 'NativeInput object reused'); inputs.add(input);
        assert.ok(Object.isFrozen(input.owners)); assert.ok(!ownerArrays.has(input.owners), 'owner array reused'); ownerArrays.add(input.owners);
        assert.equal(input.owners.length, reference.inputs[index].owners.length);
        input.owners.forEach((owner, i) => assert.equal(owner, reference.inputs[index].owners[i], 'owner identity oracle'));
        assert.equal(input.terminalRejectedRoles, reference.inputs[index].terminalRejectedRoles);
        assert.deepEqual(proofSnapshot(input.requirement), proofs[index], 'proof roles/flags changed');
      });
    }
    const counters = { executedFactVisits: after.inputFactVisits - before.inputFactVisits,
      representedFacts: reference.represented * captures,
      sourceRepresentedFacts: typeof after.wholeInputFactsRepresented === 'number' ? after.wholeInputFactsRepresented - before.wholeInputFactsRepresented : null };
    const state = source.inspect();
    const expectedVisitedPerCapture = task.arm === 'candidate' ? reference.represented - 2 * (state.packedSubjects - state.packedRuns) : reference.represented;
    assert.equal(counters.executedFactVisits, expectedVisitedPerCapture * captures, 'executed-work admission');
    if (task.arm === 'candidate') assert.equal(counters.sourceRepresentedFacts, counters.representedFacts, 'logical-coverage admission');
    // Independent execution census runs AFTER timers. Restore the prototypes
    // even if a planted regression is detected; no census data is timed.
    const originalEntries = ExactSubjectRuns.prototype.entries, originalRuns = ExactSubjectRuns.prototype.runValues;
    let expandedSubjects = 0, visitedRuns = 0;
    ExactSubjectRuns.prototype.entries = function* () { for (const entry of originalEntries.call(this)) { expandedSubjects++; yield entry; } };
    if (originalRuns) ExactSubjectRuns.prototype.runValues = function* () { for (const value of originalRuns.call(this)) { visitedRuns++; yield value; } };
    try {
      assert.equal(source.captureViews().length, reference.represented);
      assert.equal(expandedSubjects, state.packedSubjects, 'expansion census positive control');
      expandedSubjects = 0; source.captureInput();
      assert.equal(expandedSubjects, task.arm === 'candidate' ? 0 : state.packedSubjects, 'actual expanded-subject census');
      assert.equal(visitedRuns, task.arm === 'candidate' ? state.packedRuns : 0, 'actual run census');
    } finally {
      ExactSubjectRuns.prototype.entries = originalEntries;
      if (originalRuns) ExactSubjectRuns.prototype.runValues = originalRuns;
    }
    captured.length = 0; arrays.clear(); inputs.clear(); ownerArrays.clear();
    const heapAfterCaptureRelease = await collect();
    const result = { task, pid: process.pid, node: process.version, planSha256: digest(planBytes), generatorSha256: fileHash(self), packageIdentity: binding.identity,
      workload: { captures, activeRows, historicalSubjects, uniqueRequirements: reference.requirements.length, profiles: task.profile },
      cpuMs: (cpu.user + cpu.system) / 1000, elapsedMs, counters, executionCensus: { expandedSubjects, visitedRuns }, sourceState: state,
      heap: { before: heapBefore, immediateAfter: heapImmediate, immediateDelta: heapImmediate - heapBefore, afterGCWithCaptures: heapWithCaptures, afterGCWithCapturesDelta: heapWithCaptures - heapBefore,
        afterGCReleasedCaptures: heapAfterCaptureRelease, afterGCReleasedCapturesDelta: heapAfterCaptureRelease - heapBefore },
      oracle: { capturedOwners: expectedCapturedOwners, proofs, exactOrderedReferences: true, exactOwnerReferences: true, freshFrozenCaptures: true, expandedPositiveControl: true } };
    verifyPackage(binding);
    return result;
  } finally { tree.destroy(); await flush(); }
}

function run(planPath) {
  const registered = JSON.parse(readFileSync(planPath, 'utf8')), out = dirname(planPath);
  assert.equal(fileHash(self), registered.generatorSha256);
  const results = [];
  for (const control of [true, false]) {
    const tasks = control ? registered.controls : registered.rows;
    for (let index = 0; index < tasks.length; index++) {
      const stem = `${control ? 'control' : 'run'}-${String(index).padStart(3, '0')}`;
      assert.ok(!existsSync(join(out, stem + '.stdout')), 'Never overwrite an attempted child');
      const started = Date.now();
      const childRun = spawnSync(process.execPath, ['--expose-gc', self, 'child', planPath, String(index), control ? 'control' : 'normal'], { encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024, env: { ...process.env, NODE_ENV: 'production' } });
      writeFileSync(join(out, stem + '.stdout'), childRun.stdout ?? '', { flag: 'wx' });
      writeFileSync(join(out, stem + '.stderr'), childRun.stderr ?? '', { flag: 'wx' });
      const receipt = { task: tasks[index], started, elapsedMs: Date.now() - started, status: childRun.status, signal: childRun.signal, error: childRun.error?.message,
        stdoutSha256: fileHash(join(out, stem + '.stdout')), stderrSha256: fileHash(join(out, stem + '.stderr')) };
      if (control) {
        const expected = { 'missing-capture': 'missing-capture oracle', 'swapped-requirement': 'requirement identity/order oracle', 'swapped-owner': 'owner identity oracle' }[tasks[index].fault];
        receipt.expectedOracleRejected = childRun.status !== 0 && !childRun.signal && !childRun.error && childRun.stderr.includes(expected);
        save(join(out, stem + '.json'), receipt);
        assert.ok(receipt.expectedOracleRejected, `Planted control did not fail its intended oracle: ${stem}`);
      } else {
        save(join(out, stem + '.receipt.json'), receipt);
        assert.equal(childRun.status, 0, `Child failed; preserve ${stem} before any retry`);
        const value = JSON.parse(childRun.stdout); save(join(out, stem + '.json'), value); results.push(value);
      }
      console.log(JSON.stringify({ stem, status: receipt.status, control, profile: tasks[index].profile, arm: tasks[index].arm }));
    }
  }
  assert.equal(results.length, registered.rows.length);
  assert.equal(new Set(results.map(result => result.pid)).size, results.length, 'Expected fresh sequential child processes');
  save(join(out, 'results.json'), { planSha256: fileHash(planPath), children: results });
}

const [command, ...args] = process.argv.slice(2);
if (command === 'plan') plan(...args);
else if (command === 'run') run(resolve(args[0]));
else if (command === 'child') console.log(JSON.stringify(await child(resolve(args[0]), Number(args[1]), args[2] === 'control')));
else throw new Error('Usage: node capture-cost.mjs plan BASELINE_PACKAGE CANDIDATE_PACKAGE NEW_OUTPUT [tiny-calibration]; node capture-cost.mjs run OUTPUT/plan.json');
