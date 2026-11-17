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
const alternatingCount = 100;
const armNames = ['baseline', 'dual', 'tail'];
const memoized = arm => arm !== 'baseline';
const windows = { alternatingFirst20: [0, 20], alternating21To40: [20, 40], alternating41To100: [40, 100], alternatingTotal100: [0, 100] };
function schedule() {
  const rows = [];
  for (const profile of profiles) for (const replicate of [0, 1]) rows.push({ group: 'AA', profile, pair: 0, replicate, arm: 'baseline' });
  for (let pair = 0; pair < 3; pair++) for (const [p, profile] of profiles.entries()) {
    const offset = (pair + p) % armNames.length, order = [...armNames.slice(offset), ...armNames.slice(0, offset)];
    for (const arm of order) rows.push({ group: 'comparison', profile, pair, arm });
  }
  return rows;
}
function controls() {
  return ['dual', 'tail'].flatMap(arm => [
    ...['missing-capture', 'swapped-requirement', 'swapped-owner'].map(fault => ({ group: 'control', profile: 'homogeneous', arm, fault })),
    { group: 'control', profile: 'no-history', arm, fault: 'missing-post-edit-invalidation' },
  ]);
}
function verifyArms(registered) {
  assert.deepEqual(Object.keys(registered.arms), armNames);
  for (const arm of armNames) verifyPackage(registered.arms[arm]);
}
function admitPlan(registered) {
  assert.equal(registered.version, 5); assert.deepEqual(registered.rows, schedule()); assert.deepEqual(registered.controls, controls());
  assert.equal(registered.captures, captures); assert.equal(registered.alternatingCount, alternatingCount);
  const protocolPath = join(dirname(self), 'native-selection-tail-protocol.json');
  assert.equal(fileHash(protocolPath), registered.protocolSha256); assert.deepEqual(JSON.parse(readFileSync(protocolPath)), registered.protocol);
}
const roles = ['owners', 'destination', 'input', 'validation', 'possible'];

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
function packageBinding(manifestPath) {
  const manifest = JSON.parse(readFileSync(manifestPath));
  assert.equal(manifest.kind, 'identified-built-kernel-v1');
  const root = manifest.root, files = packageFiles(root);
  const metadata = JSON.parse(readFileSync(join(root, 'package.json')));
  assert.equal(metadata.name, '@signal-tree/kernel');
  assert.equal(Number(metadata.version.split('.')[0]), 16);
  assert.deepEqual(Object.fromEntries(files.map(file => [file.path, file.sha256])), manifest.files);
  assert.equal(fileHash(manifest.buildReceipt), manifest.buildReceiptSha256);
  const receipt = JSON.parse(readFileSync(manifest.buildReceipt));
  assert.equal(receipt.exitCode, 0); assert.equal(receipt.sourceUnchanged, true); assert.equal(receipt.head, manifest.head);
  const bindings = { [manifestPath]: fileHash(manifestPath), [manifest.buildReceipt]: manifest.buildReceiptSha256, ...receipt.snapshots };
  assert(Object.keys(receipt.snapshots).length > 0);
  for (const [path, hash] of Object.entries(bindings)) assert.equal(fileHash(path), hash, path);
  return { root, manifestPath, files, identity: digest(JSON.stringify(files)), bindings, head: manifest.head };
}
function verifyPackage(binding) {
  for (const [path, hash] of Object.entries(binding.bindings)) assert.equal(fileHash(path), hash, path);
  assert.deepEqual(packageFiles(binding.root), binding.files, 'Package bytes drifted');
}

function admitResult(result, task, registered, planPath) {
  assert.deepEqual(result.task, task);
  assert.equal(result.node, registered.node);
  assert(Number.isInteger(result.pid) && result.pid > 0);
  assert.equal(result.planSha256, fileHash(planPath));
  assert.equal(result.generatorSha256, registered.generatorSha256);
  assert.equal(result.packageIdentity, registered.arms[task.arm].identity);
  assert.equal(result.kind, registered.mode);
  assert.equal(result.workload.captures, captures);
  assert(result.workload.uniqueRequirements > 0);
  for (const key of ['executedFactVisits', 'representedFacts', 'sourceRepresentedFacts']) assert(Number.isSafeInteger(result.counters[key]) && result.counters[key] >= 0);
  assert.equal(result.counters.representedFacts, result.counters.sourceRepresentedFacts);
  assert.deepEqual(result.verifiedArmIdentities, Object.fromEntries(armNames.map(arm => [arm, registered.arms[arm].identity])));
  assert.equal(result.alternatingVerified, task.profile === 'no-history' ? alternatingCount : 0);
  assert.equal(result.alternatingOperations.length, result.alternatingVerified);
  for (const [index, operation] of result.alternatingOperations.entries()) {
    assert.deepEqual(operation, { index, id: `live${index % 20}`, expectedValue: 20000 + index, actualValue: 20000 + index,
      executedFactVisits: 11000, representedFacts: 11000, sourceRepresentedFacts: 11000, selections: 21,
      exactOrderedReferences: true, exactOwnerReferences: true, freshFrozenCaptures: true });
  }
  if (task.profile === 'no-history') { assert.equal(result.workload.uniqueRequirements, 21); assert.equal(result.workload.activeRows, 1000); }

  for (const key of ['exactOrderedReferences', 'exactOwnerReferences', 'freshFrozenCaptures', 'expandedPositiveControl']) assert.equal(result.oracle[key], true);
  assert.equal(result.oracle.proofs.length, result.workload.uniqueRequirements);
  assert.equal(result.oracle.capturedOwners.length, result.workload.uniqueRequirements);
  if (registered.mode === 'cpu') {
    const names = ['firstCapture', 'warmCaptures19', ...(task.profile === 'no-history' ? Object.keys(windows) : [])];
    assert.deepEqual(Object.keys(result.phases), names);
    for (const value of [...Object.values(result.phases), ...result.alternatingSamples]) for (const key of ['cpuMs', 'elapsedMs']) assert(Number.isFinite(value[key]) && value[key] >= 0);
    assert.equal(result.alternatingSamples.length, task.profile === 'no-history' ? alternatingCount : 0);
    if (task.profile === 'no-history') for (const [name, [begin, end]] of Object.entries(windows)) for (const key of ['cpuMs', 'elapsedMs']) assert.equal(result.phases[name][key], result.alternatingSamples.slice(begin, end).reduce((n, value) => n + value[key], 0));
    for (const key of ['cpuMs', 'elapsedMs']) assert.equal(result[key], result.phases.firstCapture[key] + result.phases.warmCaptures19[key]);
    assert.equal(result.heap, null);
  } else {
    assert.deepEqual(result.phases, {}); assert.deepEqual(result.alternatingSamples, []);
    assert.equal(result.cpuMs, null); assert.equal(result.elapsedMs, null);
    assert.deepEqual(Object.keys(result.heap), ['before','immediateAfter','immediateDelta','afterGCWithCaptures','afterGCWithCapturesDelta','afterGCReleasedCaptures','afterGCReleasedCapturesDelta']);
    for (const value of Object.values(result.heap)) assert(Number.isFinite(value));
    for (const [a,b,c] of [['immediateAfter','before','immediateDelta'],['afterGCWithCaptures','before','afterGCWithCapturesDelta'],['afterGCReleasedCaptures','before','afterGCReleasedCapturesDelta']]) assert.equal(result.heap[a]-result.heap[b],result.heap[c]);
  }
}

function plan(baselineRoot, dualRoot, tailRoot, out, mode = 'cpu') {
  assert.ok(mode === 'cpu' || mode === 'heap');
  baselineRoot = resolve(baselineRoot); dualRoot = resolve(dualRoot); tailRoot = resolve(tailRoot); out = resolve(out);
  for (const input of [baselineRoot, dualRoot, tailRoot, dirname(self)])
    assert.ok(out !== input && !out.startsWith(input + sep), 'Output must not mutate a bound input');
  assert.ok(!existsSync(out), 'Use a new output directory; first runs are never overwritten');
  const arms = { baseline: packageBinding(baselineRoot, 'baseline'), dual: packageBinding(dualRoot, 'dual'), tail: packageBinding(tailRoot, 'tail') };
  for (const binding of Object.values(arms)) for (const input of [binding.root, ...Object.keys(binding.bindings)]) assert.ok(out !== input && !out.startsWith(input + sep) && !input.startsWith(out + sep), 'Output must not overlap bound inputs');
  const protocolPath = join(dirname(self), 'native-selection-tail-protocol.json');
  const protocol = JSON.parse(readFileSync(protocolPath, 'utf8'));
  const rows = schedule(), registeredControls = controls();
  mkdirSync(out, { recursive: false });
  mkdirSync(join(out, 'source'));
  writeFileSync(join(out, 'source', 'native-selection-tail-screen.mjs'), readFileSync(self), { flag: 'wx' });
  writeFileSync(join(out, 'source', 'native-selection-tail-protocol.json'), readFileSync(protocolPath), { flag: 'wx' });
  for (const [arm, binding] of Object.entries(arms))
    writeFileSync(join(out, 'source', `${arm}-bindings.json`), readFileSync(binding.manifestPath), { flag: 'wx' });
  const result = { version: 5, mode, generatorSha256: fileHash(self), protocolSha256: fileHash(protocolPath), protocol, captures, alternatingCount,
    node: process.version, executable: process.execPath, executableSha256: fileHash(process.execPath), platform: platform(), arch: arch(), cpu: cpus()[0]?.model,
    arms, controls: registeredControls, rows };
  admitPlan(result);
  save(join(out, 'plan.json'), result);
  console.log(JSON.stringify({ out, normalChildren: rows.length, controls: registeredControls.length, planSha256: fileHash(join(out, 'plan.json')) }));
}

async function child(planPath, index, control) {
  const planBytes = readFileSync(planPath), registered = JSON.parse(planBytes);
  assert.equal(fileHash(self), registered.generatorSha256);
  assert.equal(process.version, registered.node);
  assert.equal(fileHash(process.execPath), registered.executableSha256);
  assert.equal(typeof global.gc === 'function', registered.mode === 'heap', 'Separate CPU and heap processes');
  const task = (control ? registered.controls : registered.rows)[index];
  assert.ok(task, 'Unknown registered child');
  admitPlan(registered);
  // Every child pays the same complete three-arm verification before any import.
  // A selected-arm shortcut would give distinct filesystem/parse/GC prehistory.
  verifyArms(registered);
  const binding = registered.arms[task.arm];
  globalThis.ngDevMode = false;
  const load = path => import(pathToFileURL(join(binding.root, path)).href);
  const { signalTree, entityMap, transactions } = await load('dist/index.js');
  const { getEntityPublicationBinding } = await load('dist/lib/internals/entity-publication.js');
  const lifecycle = await load('dist/lib/experimental-publication/lifecycle.js');
  const { ExactSubjectRuns } = await load('dist/lib/internals/exact-subject-runs.js');
  const { getPathNotifier } = await load('dist/lib/path-notifier.js');
  const flush = async () => { getPathNotifier().flushSync(); for (let n = 0; n < 160; n++) await Promise.resolve(); };
  const collect = async () => { if (registered.mode !== 'heap') return null; for (let n = 0; n < 4; n++) { await new Promise(setImmediate); global.gc(); } return process.memoryUsage().heapUsed; };
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
    const phases = {};
    const measure = (name, work) => {
      if (registered.mode === 'heap') { work(); return; }
      const startCpu = process.cpuUsage(), start = performance.now(); work();
      const usage = process.cpuUsage(startCpu); phases[name] = { elapsedMs: performance.now() - start, cpuMs: (usage.user + usage.system) / 1000 };
    };
    measure('firstCapture', () => { captured[0] = source.captureInput(); });
    const afterFirst = source.inspect();
    measure('warmCaptures19', () => { for (let n = 1; n < captures; n++) if (!(task.fault === 'missing-capture' && n === captures - 1)) captured[n] = source.captureInput(); });
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
    const expectedVisitedPerCapture = reference.represented - 2 * (state.packedSubjects - state.packedRuns);
    assert.equal(afterFirst.inputFactVisits - before.inputFactVisits, expectedVisitedPerCapture, 'First measured selection must actually be cold');
    assert.equal(counters.executedFactVisits, expectedVisitedPerCapture * (memoized(task.arm) ? 1 : captures), 'executed-work admission');
    assert.equal(counters.sourceRepresentedFacts, counters.representedFacts, 'logical-coverage admission');
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
      assert.equal(expandedSubjects, 0, 'actual expanded-subject census');
      assert.equal(visitedRuns, memoized(task.arm) ? 0 : state.packedRuns, 'actual run census');
    } finally {
      ExactSubjectRuns.prototype.entries = originalEntries;
      if (originalRuns) ExactSubjectRuns.prototype.runValues = originalRuns;
    }
    captured.length = 0; arrays.clear(); inputs.clear(); ownerArrays.clear();
    const heapAfterCaptureRelease = await collect();
    // A separately labeled edit/capture stage checks the case that cannot
    // reuse selection. Exact expanded-reference oracles are outside each timer.
    let alternatingVerified = 0;
    const alternatingSamples = [], alternatingOperations = [];
    if (task.profile === 'no-history') {
      assert.equal(reference.represented, 11000);
      assert.equal(reference.requirements.length, 21);
      // Controls synthesize fresh wrappers over the pre-edit references; the
      // useful post-edit reference oracle, not only a work counter, must reject.
      const staleRequirements = task.fault === 'missing-post-edit-invalidation'
        ? source.captureInput().native.map(input => input.requirement) : undefined;
      let previousInput;
      for (let i = 0; i < alternatingCount; i++) {
        const id = `live${i % 20}`, value = 20000 + i, beforeEdit = source.inspect();
        let input;
        // i=0..19 is exactly the original timed update/capture prefix. Later
        // operations revisit the same20 IDs with fresh values, never add rows.
        measure(`alternating-${i}`, () => { rows.updateOne(`live${i % 20}`, { f0: 20000 + i }); input = source.captureInput(); });
        const afterEdit = source.inspect();
        if (staleRequirements) input = { native: Object.freeze(staleRequirements.map(lifecycle.captureNativeInput)) };
        const views = source.captureViews(), expected = [...new Set(views.map(view => view.requirement))].map(lifecycle.captureNativeInput);
        assert.equal(views.length, 11000, 'alternating represented fact count');
        assert.equal(expected.length, 21, 'alternating independent selection count');
        assert.equal(input.native.length, expected.length, 'alternating capture cardinality');
        assert.ok(Object.isFrozen(input.native));
        if (previousInput) assert.notEqual(input.native, previousInput.native, 'alternating fresh array');
        input.native.forEach((item, index) => {
          assert.equal(item.requirement, expected[index].requirement, 'alternating requirement identity');
          assert.ok(Object.isFrozen(item)); assert.ok(Object.isFrozen(item.owners));
          if (previousInput) { assert.notEqual(item, previousInput.native[index], 'alternating fresh input'); assert.notEqual(item.owners, previousInput.native[index].owners, 'alternating fresh owners'); }
          assert.equal(item.owners.length, expected[index].owners.length, 'alternating owners');
          item.owners.forEach((owner, ordinal) => assert.equal(owner, expected[index].owners[ordinal], 'alternating owner identity'));
          assert.equal(item.terminalRejectedRoles, expected[index].terminalRejectedRoles);
        });
        const actualValue = rows.byIdOrFail(id).f0();
        assert.equal(actualValue, value, 'alternating useful value');
        const executedFactVisits = afterEdit.inputFactVisits - beforeEdit.inputFactVisits;
        const sourceRepresentedFacts = afterEdit.wholeInputFactsRepresented - beforeEdit.wholeInputFactsRepresented;
        assert.equal(executedFactVisits, 11000, 'post-edit executed selection admission');
        assert.equal(sourceRepresentedFacts, 11000, 'post-edit logical coverage admission');
        alternatingOperations.push({ index: i, id, expectedValue: value, actualValue, executedFactVisits, representedFacts: views.length,
          sourceRepresentedFacts, selections: input.native.length, exactOrderedReferences: true, exactOwnerReferences: true, freshFrozenCaptures: true });
        previousInput = input; alternatingVerified++;
        if (registered.mode === 'cpu') { alternatingSamples.push(phases[`alternating-${i}`]); delete phases[`alternating-${i}`]; }
      }
      previousInput = undefined;
      for (let i = 0; i < 20; i++) assert.equal(rows.byIdOrFail(`live${i}`).f0(), 20080 + i, 'alternating final value');
      assert.equal(rows.byIdOrFail('live20').f0(), 20, 'untouched row remains useful'); assert.equal(rows.count(), 1000);
      if (registered.mode === 'cpu') for (const [name, [begin, end]] of Object.entries(windows)) {
        const samples = alternatingSamples.slice(begin, end);
        phases[name] = { cpuMs: samples.reduce((n, x) => n + x.cpuMs, 0), elapsedMs: samples.reduce((n, x) => n + x.elapsedMs, 0) };
      }
    }
    const result = { task, pid: process.pid, node: process.version, planSha256: digest(planBytes), generatorSha256: fileHash(self), packageIdentity: binding.identity,
      workload: { captures, activeRows, historicalSubjects, uniqueRequirements: reference.requirements.length, profiles: task.profile }, alternatingVerified, alternatingSamples, alternatingOperations,
      verifiedArmIdentities: Object.fromEntries(armNames.map(arm => [arm, registered.arms[arm].identity])),
      kind: registered.mode, phases, cpuMs: registered.mode === 'cpu' ? phases.firstCapture.cpuMs + phases.warmCaptures19.cpuMs : null, elapsedMs: registered.mode === 'cpu' ? phases.firstCapture.elapsedMs + phases.warmCaptures19.elapsedMs : null, counters, executionCensus: { expandedSubjects, visitedRuns }, sourceState: state,
      heap: registered.mode === 'heap' ? { before: heapBefore, immediateAfter: heapImmediate, immediateDelta: heapImmediate - heapBefore, afterGCWithCaptures: heapWithCaptures, afterGCWithCapturesDelta: heapWithCaptures - heapBefore,
        afterGCReleasedCaptures: heapAfterCaptureRelease, afterGCReleasedCapturesDelta: heapAfterCaptureRelease - heapBefore } : null,
      oracle: { capturedOwners: expectedCapturedOwners, proofs, exactOrderedReferences: true, exactOwnerReferences: true, freshFrozenCaptures: true, expandedPositiveControl: true } };
    verifyArms(registered);
    return result;
  } finally { tree.destroy(); await flush(); }
}

function run(planPath) {
  const registered = JSON.parse(readFileSync(planPath, 'utf8')), out = dirname(planPath);
  assert.equal(fileHash(self), registered.generatorSha256); admitPlan(registered); verifyArms(registered);
  assert.equal(process.version, registered.node); assert.equal(fileHash(process.execPath), registered.executableSha256);
  const results = [];
  for (const control of [true, false]) {
    const tasks = control ? registered.controls : registered.rows;
    for (let index = 0; index < tasks.length; index++) {
      const stem = `${control ? 'control' : 'run'}-${String(index).padStart(3, '0')}`;
      assert.ok(!existsSync(join(out, stem + '.stdout')), 'Never overwrite an attempted child');
      const started = Date.now();
      const command = [process.execPath, ...(registered.mode === 'heap' ? ['--expose-gc'] : []), self, 'child', planPath, String(index), control ? 'control' : 'normal'];
      const childRun = spawnSync(command[0], command.slice(1), { encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024, env: { ...process.env, NODE_ENV: 'production', NODE_OPTIONS: '' } });
      writeFileSync(join(out, stem + '.stdout'), childRun.stdout ?? '', { flag: 'wx' });
      writeFileSync(join(out, stem + '.stderr'), childRun.stderr ?? '', { flag: 'wx' });
      const receipt = { task: tasks[index], command, started, elapsedMs: Date.now() - started, status: childRun.status, signal: childRun.signal, error: childRun.error?.message,
        stdoutSha256: fileHash(join(out, stem + '.stdout')), stderrSha256: fileHash(join(out, stem + '.stderr')) };
      if (control) {
        const expected = { 'missing-capture': 'missing-capture oracle', 'swapped-requirement': 'requirement identity/order oracle', 'swapped-owner': 'owner identity oracle', 'missing-post-edit-invalidation': 'alternating requirement identity' }[tasks[index].fault];
        receipt.expectedOracleRejected = childRun.status !== 0 && !childRun.signal && !childRun.error && childRun.stderr.includes(expected);
        save(join(out, stem + '.json'), receipt);
        assert.ok(receipt.expectedOracleRejected, `Planted control did not fail its intended oracle: ${stem}`);
      } else {
        save(join(out, stem + '.receipt.json'), receipt);
        assert(!childRun.signal && !childRun.error, 'Normal child must exit cleanly');
        assert.equal(childRun.status, 0, `Child failed; preserve ${stem} before any retry`);
        const value = JSON.parse(childRun.stdout); save(join(out, stem + '.json'), value); admitResult(value, tasks[index], registered, planPath); results.push(value);
      }
      console.log(JSON.stringify({ stem, status: receipt.status, control, profile: tasks[index].profile, arm: tasks[index].arm }));
    }
  }
  assert.equal(results.length, registered.rows.length);
  assert.equal(new Set(results.map(result => result.pid)).size, results.length, 'Expected fresh sequential child processes');
  verifyArms(registered);
  save(join(out, 'results.json'), { planSha256: fileHash(planPath), children: results });
}

const [command, ...args] = process.argv.slice(2);
if (command === 'selftest') {
  const out = resolve(args[0]); assert(!existsSync(out)); mkdirSync(out);
  const task = { arm: 'baseline', profile: 'no-history' }, registered = { node: process.version, generatorSha256: fileHash(self), mode: 'cpu', arms: Object.fromEntries(armNames.map(arm => [arm, { identity: arm }])) };
  const path = join(out, 'fixture-plan.json'); save(path, registered);
  const unit = () => ({ cpuMs: 1, elapsedMs: 2 });
  const samples = Array.from({ length: alternatingCount }, unit);
  const operation = index => ({ index, id: `live${index % 20}`, expectedValue: 20000 + index, actualValue: 20000 + index, executedFactVisits: 11000, representedFacts: 11000, sourceRepresentedFacts: 11000, selections: 21, exactOrderedReferences: true, exactOwnerReferences: true, freshFrozenCaptures: true });
  const complete = { task, node: process.version, pid: process.pid, planSha256: fileHash(path), generatorSha256: fileHash(self), packageIdentity: 'baseline', kind: 'cpu', workload: { captures: 20, activeRows: 1000, uniqueRequirements: 21 },
    counters: { executedFactVisits: 220000, representedFacts: 220000, sourceRepresentedFacts: 220000 }, alternatingVerified: 100, alternatingSamples: samples, alternatingOperations: Array.from({ length: alternatingCount }, (_, i) => operation(i)),
    verifiedArmIdentities: Object.fromEntries(armNames.map(arm => [arm, arm])),
    oracle: { exactOrderedReferences: true, exactOwnerReferences: true, freshFrozenCaptures: true, expandedPositiveControl: true, proofs: Array.from({ length: 21 }, () => ({})), capturedOwners: Array.from({ length: 21 }, () => []) },
    phases: { firstCapture: unit(), warmCaptures19: unit(), ...Object.fromEntries(Object.entries(windows).map(([name, [begin, end]]) => [name, { cpuMs: end - begin, elapsedMs: 2 * (end - begin) }])) }, cpuMs: 2, elapsedMs: 4, heap: null };
  admitResult(complete, task, registered, path);
  const rejected = [];
  for (const name of Object.keys(complete.phases)) { const changed = structuredClone(complete); delete changed.phases[name]; assert.throws(() => admitResult(changed, task, registered, path)); rejected.push(name); }
  for (const [name, change] of [
    ['missing-operation', x => x.alternatingOperations.pop()], ['wrong-first20-value', x => x.alternatingOperations[19].actualValue++],
    ['wrong-late-value', x => x.alternatingOperations[99].actualValue++], ['wrong-id-revisit', x => x.alternatingOperations[20].id = 'live20'],
    ['missing-post-edit-work', x => x.alternatingOperations[0].executedFactVisits = 0], ['changed-cardinality', x => x.alternatingOperations[40].selections = 22],
    ['nonfinite', x => x.phases.firstCapture.cpuMs = NaN], ['missing-arm-verification', x => delete x.verifiedArmIdentities.tail],
  ]) { const changed = structuredClone(complete); change(changed); assert.throws(() => admitResult(changed, task, registered, path)); rejected.push(name); }
  save(join(out, 'results.json'), { passed: true, positive: 1, rejected, scope: 'Synthetic admission sensitivity only; no installed runtime execution or measurement.' });
}
else if (command === 'plan') plan(...args);
else if (command === 'run') run(resolve(args[0]));
else if (command === 'child') console.log(JSON.stringify(await child(resolve(args[0]), Number(args[1]), args[2] === 'control')));
else throw new Error('Usage: node native-selection-tail-screen.mjs plan C1_MANIFEST DUAL_MANIFEST TAIL_MANIFEST NEW_OUTPUT [cpu|heap]; node native-selection-tail-screen.mjs run OUTPUT/plan.json');
