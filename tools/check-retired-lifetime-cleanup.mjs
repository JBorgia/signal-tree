#!/usr/bin/env node
/**
 * Deterministic built-kernel lifetime, revision and activation WeakRef map cleanup check.
 *
 * node tools/check-retired-lifetime-cleanup.mjs
 * node tools/check-retired-lifetime-cleanup.mjs --artifact /path/to/kernel
 * node tools/check-retired-lifetime-cleanup.mjs --self-test [--artifact DIR]
 *
 * DIR is a built package directory containing package.json and dist/index.js;
 * default: this checkout's dist/packages/kernel. No build is performed.
 * Map.prototype.set is hooked only inside a subprocess, only across first public
 * node() reads; byId() runs beforehand to exclude the separate node-cache map.
 * Discovery must find populated activation entries before checking retirement.
 * Existing internal handles identify subjects; missing lifetime inventory alone
 * cannot detect abandoned WeakRef wrappers, so cleanup uses Map.has/size/keys.
 *
 * StructuralStore.snapshotActiveOrder is separately hooked across initial setAll
 * to capture exactly one real store (the order read setAll makes beside its
 * frontier read; `activeOrderFrontier` is an instance arrow now, passed to the
 * transition binding as is, so it is no longer on the prototype to hook). Its live lifetime/revision maps must contain
 * both private handles before retirement; never cache maps that installation swaps.
 * --self-test copies the artifact and independently removes activation cleanup
 * restores historical post-forget publication, and removes the late registration
 * guard. Each mutation must fail only
 * their mechanism checks; exact restoration must pass after EACH mutation.
 * Original/copy hashes are checked, including restoration on failure. The
 * original artifact is never written. JSON receipts go to stdout; exit 0 means
 * contract passes, 1 means cleanup assertions fail, 2 means execution/discovery
 * or self-test failure. Private --child mode is used by the parent only.
 *
 * Scope: four tiny retirement cases plus late node/field/write/replacement reads
 * and a reactive undo control for a retained tombstone.
 * No forced GC, heap measurement, collection-of-targets claim, or performance
 * waiver. This does not resolve a failed memory-slope gate. The Map is deliberately
 * retained by the probe; destruction checks do not prove garbage collection.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(SCRIPT), '..');
const OPERATIONS = ['setAll', 'removeOne', 'removeMany', 'clear'];
const TARGET = 'dist/lib/entity-signal.js';
const DELETION = 'subjectStateSignals.delete(subjectId);';
const RECLAIM_START = 'function reclaimRetiredSubjectsWithoutOwner';
const RECLAIM_END = 'function retireSubjectRetainedValueBackingForTesting';
const COMMIT = 'commitAndProjectEntityMutationFrame(frame)';
const REPUBLISH =
  ';for(const subjectId of subjectIds)publishSubjectPhysicalChange(subjectId);';
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function parseArgs() {
  const options = {
    artifact: join(ROOT, 'dist/packages/kernel'),
    selfTest: false,
    child: false,
  };
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--artifact') {
      assert.ok(
        args[i + 1] && !args[i + 1].startsWith('--'),
        '--artifact requires a directory'
      );
      options.artifact = resolve(args[++i]);
    } else if (args[i] === '--self-test') options.selfTest = true;
    else if (args[i] === '--child') options.child = true;
    else throw new Error(`Unknown argument: ${args[i]}`);
  }
  assert.ok(
    !(options.selfTest && options.child),
    '--self-test and --child cannot be combined'
  );
  options.artifact = realpathSync(options.artifact);
  return options;
}

function identity(root) {
  const files = [];
  function visit(directory) {
    const entries = readdirSync(directory, { withFileTypes: true }).sort(
      (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
    );
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else {
        assert.ok(
          entry.isFile(),
          `Artifact must contain regular files, not links: ${path}`
        );
        const bytes = readFileSync(path);
        files.push({
          path: relative(root, path).replaceAll('\\', '/'),
          bytes: bytes.length,
          sha256: sha256(bytes),
        });
      }
    }
  }
  visit(root);
  assert.ok(
    files.some((f) => f.path === 'dist/index.js'),
    'Missing built dist/index.js'
  );
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.name, '@signal-tree/kernel');
  return {
    root,
    package: pkg.name,
    version: pkg.version,
    algorithm:
      'sha256 of ordered JSON manifest: relative path, byte length, content sha256',
    sha256: sha256(JSON.stringify(files)),
    files,
  };
}
const brief = ({ files, ...id }) => ({ ...id, fileCount: files.length });

async function probe(artifact) {
  const { signalTree, entityMap, restoration, undoable } = await import(
    pathToFileURL(`${artifact}/dist/index.js`)
  );
  const { StructuralStore } = await import(
    pathToFileURL(`${artifact}/dist/lib/physical/structural-store.js`)
  );
  const orderReadDescriptor = Object.getOwnPropertyDescriptor(
    StructuralStore.prototype,
    'snapshotActiveOrder'
  );
  assert.equal(
    typeof orderReadDescriptor?.value,
    'function',
    'Built StructuralStore hook unavailable'
  );
  const originalOrderRead = orderReadDescriptor.value;
  function captureInitialStore(initialize) {
    const receivers = new Set();
    Object.defineProperty(StructuralStore.prototype, 'snapshotActiveOrder', {
      ...orderReadDescriptor,
      value: function (...args) {
        receivers.add(this);
        return Reflect.apply(originalOrderRead, this, args);
      },
    });
    try {
      initialize();
    } finally {
      Object.defineProperty(
        StructuralStore.prototype,
        'snapshotActiveOrder',
        orderReadDescriptor
      );
    }
    assert.deepEqual(
      Object.getOwnPropertyDescriptor(
        StructuralStore.prototype,
        'snapshotActiveOrder'
      ),
      orderReadDescriptor
    );
    assert.equal(
      receivers.size,
      1,
      'Initial setAll must identify exactly one actual store'
    );
    return [...receivers][0];
  }
  const originalDescriptor = Object.getOwnPropertyDescriptor(
    Map.prototype,
    'set'
  );
  const originalSet = originalDescriptor.value;
  const cases = [];
  function captureFirstReads(nodes) {
    const entries = [],
      values = [];
    // No byId, assertions, await, or logging while this process-global hook is installed.
    Object.defineProperty(Map.prototype, 'set', {
      ...originalDescriptor,
      value: function (key, value) {
        const result = Reflect.apply(originalSet, this, [key, value]);
        if (Number.isSafeInteger(key) && value instanceof WeakRef) {
          entries.push({ map: this, key, wrapper: value });
        }
        return result;
      },
    });
    try {
      for (const node of nodes) values.push(node());
    } finally {
      Object.defineProperty(Map.prototype, 'set', originalDescriptor);
    }
    assert.deepEqual(
      Object.getOwnPropertyDescriptor(Map.prototype, 'set'),
      originalDescriptor
    );
    return { entries, values };
  }
  for (const operation of OPERATIONS) {
    const record = { operation, checks: [], stages: [] };
    cases.push(record);
    const check = (name, actual, expected) => {
      let passed = true;
      try {
        assert.deepEqual(actual, expected);
      } catch {
        passed = false;
      }
      record.checks.push({ name, actual, expected, passed });
    };
    const tree = signalTree({ rows: entityMap({ selectId: (row) => row.id }) });
    const rows = tree.$.rows;
    let cleanupCalls = 0;
    tree.registerCleanup(() => {
      cleanupCalls++;
    });
    let registry, store;
    // Always fetch maps from the captured store: installPreparedTarget replaces them.
    const checkStore = (phase, expectedIds, retiredIds) => {
      for (const [field, label] of [
        ['subjectStates', 'lifetime'],
        ['subjectRevisions', 'revision'],
      ]) {
        assert.ok(
          store[field] instanceof Map,
          `${field} must remain a live Map`
        );
        check(`${label}: ${phase} size`, store[field].size, expectedIds.length);
        check(
          `${label}: ${phase} keys`,
          [...store[field].keys()].sort((a, b) => a - b),
          [...expectedIds].sort((a, b) => a - b)
        );
        for (const id of expectedIds)
          check(
            `${label}: ${phase} survivor ${id} present`,
            store[field].has(id),
            true
          );
        for (const id of retiredIds)
          check(
            `${label}: ${phase} retired ${id} absent`,
            store[field].has(id),
            false
          );
      }
    };
    const stage = (name) =>
      record.stages.push({
        name,
        size: registry.size,
        keys: [...registry.keys()],
        subjectStates: [...store.subjectStates.entries()],
        subjectRevisions: [...store.subjectRevisions.entries()],
      });
    try {
      check('starts alive', tree.destroyed(), false);
      store = captureInitialStore(() =>
        rows.setAll([
          { id: 'A', name: 'old A' },
          { id: 'B', name: 'old B' },
        ])
      );
      const heldA = rows.byId('A'),
        heldB = rows.byId('B');
      assert.equal(typeof heldA, 'function');
      assert.equal(typeof heldB, 'function');
      const handleA = rows.__acquireEntityHandleForTesting('A');
      const handleB = rows.__acquireEntityHandleForTesting('B');
      const idA = handleA.subjectId,
        idB = handleB.subjectId;
      assert.ok(store instanceof StructuralStore);
      assert.ok(store.subjectStates instanceof Map);
      assert.ok(store.subjectRevisions instanceof Map);
      assert.equal(store.subjectStates.size, 2);
      assert.equal(store.subjectRevisions.size, 2);
      for (const [handle, key] of [
        [handleA, 'A'],
        [handleB, 'B'],
      ]) {
        assert.equal(Number.isSafeInteger(handle.subjectId), true);
        assert.equal(Number.isSafeInteger(handle.acquiredRevision), true);
        assert.equal(store.subjectStates.has(handle.subjectId), true);
        assert.equal(store.subjectRevisions.has(handle.subjectId), true);
        assert.deepEqual(store.subjectStates.get(handle.subjectId), {
          active: true,
          key,
          restoreAllowed: true,
        });
        assert.equal(
          store.subjectRevisions.get(handle.subjectId),
          handle.acquiredRevision
        );
      }
      assert.notEqual(idA, idB);
      assert.equal(rows.__inspectSubjectResources(idA).activationToken, false);
      assert.equal(rows.__inspectSubjectResources(idB).activationToken, false);
      const captured = captureFirstReads([heldA, heldB]);
      // Discovery assertions are fatal: an empty/ambiguous capture cannot pass cleanup.
      assert.equal(captured.entries.length, 2);
      assert.deepEqual(
        captured.entries.map((e) => e.key),
        [idA, idB]
      );
      registry = captured.entries[0].map;
      assert.equal(captured.entries[1].map, registry);
      assert.equal(registry.size, 2);
      assert.equal(registry.get(idA), captured.entries[0].wrapper);
      assert.equal(registry.get(idB), captured.entries[1].wrapper);
      assert.deepEqual(captured.values, [
        { id: 'A', name: 'old A' },
        { id: 'B', name: 'old B' },
      ]);
      record.nonvacuousPopulation = {
        entries: 2,
        registries: 1,
        structuralStores: 1,
        lifetimeEntries: store.subjectStates.size,
        revisionEntries: store.subjectRevisions.size,
        handles: [handleA, handleB],
        subjectIds: [idA, idB],
      };
      stage('populated');
      if (operation === 'setAll') rows.setAll([{ id: 'B', name: 'old B' }]);
      else if (operation === 'removeOne') rows.removeOne('A');
      else if (operation === 'removeMany') rows.removeMany(['A']);
      else rows.clear();
      const survivor = operation !== 'clear';
      stage('first retirement');
      checkStore(
        'first retirement',
        survivor ? [idB] : [],
        survivor ? [idA] : [idA, idB]
      );
      check('retired A wrapper absent', registry.has(idA), false);
      check('first retirement size', registry.size, survivor ? 1 : 0);
      check('B wrapper membership', registry.has(idB), survivor);
      if (survivor)
        check(
          'B wrapper identity preserved',
          registry.get(idB) === captured.entries[1].wrapper,
          true
        );
      check('held A retired', heldA() === undefined, true);
      check(
        'held B reads correctly',
        heldB()?.name ?? null,
        survivor ? 'old B' : null
      );
      check(
        'retired A lifetime absent (secondary control)',
        rows.__inspectSubjectResources(idA) === undefined,
        true
      );
      await Promise.resolve();
      await Promise.resolve();
      checkStore(
        'first retirement microtasks',
        survivor ? [idB] : [],
        survivor ? [idA] : [idA, idB]
      );
      rows.clear();
      stage('all retired');
      checkStore('all retired', [], [idA, idB]);
      check('all wrappers removed before destroy', registry.size, 0);
      check(
        'both held old nodes retired',
        [heldA() === undefined, heldB() === undefined],
        [true, true]
      );
      // Let queued notification delivery finish only after the global hook is restored.
      await Promise.resolve();
      await Promise.resolve();
      check('flush does not reinsert wrappers', registry.size, 0);
      checkStore('all retired microtasks', [], [idA, idB]);
      rows.addOne({ id: 'A', name: 'replacement A' });
      const fresh = rows.byId('A'); // Obtain node before reinstalling the hook.
      const freshId = rows.__acquireEntityHandleForTesting('A').subjectId;
      assert.notEqual(freshId, idA);
      const reread = captureFirstReads([fresh]);
      assert.equal(reread.entries.length, 1);
      assert.equal(reread.entries[0].map, registry);
      assert.equal(reread.entries[0].key, freshId);
      check('fresh lifetime only', [...registry.keys()], [freshId]);
      checkStore('replacement active', [freshId], [idA, idB]);
      check('replacement visible', fresh()?.name, 'replacement A');
      check('old node does not retarget', heldA() === undefined, true);
      rows.removeOne('A');
      stage('replacement retired');
      checkStore('replacement retired', [], [idA, idB, freshId]);
      await Promise.resolve();
      await Promise.resolve();
      checkStore('replacement retired microtasks', [], [idA, idB, freshId]);
      check('replacement wrapper removed', registry.has(freshId), false);
      check('empty before destruction', registry.size, 0);
      tree.destroy();
      tree.destroy();
      stage('destroyed twice');
      checkStore('destroyed twice', [], [idA, idB, freshId]);
      check('destroy flag', tree.destroyed(), true);
      check('cleanup exactly once', cleanupCalls, 1);
      check('destroy cannot mask uncleared wrappers', registry.size, 0);
      check(
        'held nodes remain isolated after destroy',
        [heldA() === undefined, heldB() === undefined, fresh() === undefined],
        [true, true, true]
      );
    } finally {
      tree.destroy();
      assert.deepEqual(
        Object.getOwnPropertyDescriptor(Map.prototype, 'set'),
        originalDescriptor
      );
      assert.deepEqual(
        Object.getOwnPropertyDescriptor(
          StructuralStore.prototype,
          'snapshotActiveOrder'
        ),
        orderReadDescriptor
      );
      record.structuralPrototypeRestored = true;
      record.prototypeRestored = true;
    }
  }
  const lateReads = [];
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
  for (const operation of [
    'node',
    'field',
    'write',
    'replacement',
    'restorable',
  ]) {
    const record = { operation, checks: [] };
    lateReads.push(record);
    const check = (name, actual, expected) => {
      let passed = true;
      try {
        assert.deepEqual(actual, expected);
      } catch {
        passed = false;
      }
      record.checks.push({ name, actual, expected, passed });
    };
    const restorable = operation === 'restorable';
    const tree = signalTree(
      { rows: entityMap({ selectId: (row) => row.id }) },
      restorable
        ? {
            enhancers: [restoration({ maxHistorySize: 20 })],
            capabilities: ['causal-runtime'],
          }
        : undefined
    );
    let unsubscribe;
    try {
      const rows = tree.$.rows;
      rows.setAll([{ id: 'A', name: 'Alpha' }]);
      if (restorable) await tick();
      const held = rows.byId('A');
      assert.equal(typeof held, 'function');
      const id = rows.__acquireEntityHandleForTesting('A').subjectId;
      assert.equal(rows.__inspectSubjectResources(id).activationToken, false);
      if (restorable) {
        undoable(() => rows.removeOne('A'));
        await tick();
      } else rows.removeOne('A');
      if (restorable)
        assert.equal(rows.__inspectSubjectResources(id).state, 'tombstoned');
      else assert.equal(rows.__inspectSubjectResources(id), undefined);
      if (operation === 'replacement')
        rows.addOne({ id: 'A', name: 'Replacement' });
      const captured = captureFirstReads([
        () => {
          if (operation === 'field' || restorable) return held.name();
          if (operation === 'write') {
            try {
              held({ id: 'A', name: 'Rejected' });
            } catch (error) {
              return error;
            }
            return 'write unexpectedly accepted';
          }
          return held();
        },
      ]);
      record.subjectId = id;
      record.insertions = captured.entries.length;
      check(
        'late: registration count',
        captured.entries.length,
        restorable ? 1 : 0
      );
      if (operation === 'write')
        check(
          'late: write rejected',
          captured.values[0] instanceof Error &&
            /not found/.test(String(captured.values[0])),
          true
        );
      else check('late: missing read', captured.values[0] === undefined, true);
      for (const entry of captured.entries) assert.equal(entry.key, id);
      await Promise.resolve();
      await Promise.resolve();
      record.afterMicrotasks = captured.entries.map(({ map, key }) => ({
        key,
        keys: [...map.keys()],
        size: map.size,
      }));
      for (const entry of captured.entries)
        check(
          'late: registry membership after microtasks',
          entry.map.has(id),
          restorable
        );
      check('late: tree remains alive', tree.destroyed(), false);
      if (operation === 'replacement') {
        check(
          'late: replacement visible',
          rows.byId('A')().name,
          'Replacement'
        );
        check(
          'late: held field stays isolated',
          held.name() === undefined,
          true
        );
      }
      if (restorable) {
        const seen = [];
        unsubscribe = held.name.subscribe(() => seen.push(held.name()));
        tree.undo();
        await tick();
        check('late: reactive undo witnessed', seen, ['Alpha']);
        check(
          'late: same lifetime restored',
          rows.__acquireEntityHandleForTesting('A').subjectId,
          id
        );
        check('late: held node restored', held(), { id: 'A', name: 'Alpha' });
      }
    } finally {
      unsubscribe?.();
      tree.destroy();
      assert.equal(Map.prototype.set, originalSet);
      record.prototypeRestored = true;
    }
  }
  const failures = [...cases, ...lateReads].flatMap((c) =>
    c.checks
      .filter((x) => !x.passed)
      .map((x) => ({ operation: c.operation, ...x }))
  );
  const result = {
    artifact,
    node: process.version,
    platform: process.platform,
    gcRequested: false,
    cases,
    lateReads,
    failureCount: failures.length,
    failures,
    prototypeRestored: Map.prototype.set === originalSet,
    structuralPrototypeRestored:
      StructuralStore.prototype.snapshotActiveOrder === originalOrderRead,
  };
  return result;
}

function runChild(artifact, expectedIdentity, label, runs) {
  const args = [SCRIPT, '--child', '--artifact', artifact];
  const child = spawnSync(process.execPath, args, {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 30000,
    maxBuffer: 4 * 1024 * 1024,
  });
  const record = {
    label,
    command: [process.execPath, ...args],
    cwd: ROOT,
    exitCode: child.status,
    signal: child.signal,
    stderr: child.stderr,
    spawnError: child.error ? String(child.error) : null,
  };
  runs.push(record);
  try {
    record.result = JSON.parse(child.stdout);
  } catch {
    record.stdout = child.stdout;
    throw new Error(`${label}: child returned no JSON receipt`);
  }
  assert.equal(record.spawnError, null, `${label}: spawn failure`);
  assert.equal(child.signal, null, `${label}: child terminated`);
  assert.ok(
    child.status === 0 || child.status === 1,
    `${label}: child execution/discovery failed`
  );
  const result = record.result;
  assert.equal(result.artifact.root, realpathSync(artifact));
  assert.equal(result.artifact.sha256, expectedIdentity.sha256);
  assert.equal(result.artifactUnchanged, true);
  assert.equal(result.probe.prototypeRestored, true);
  assert.equal(result.probe.structuralPrototypeRestored, true);
  assert.deepEqual(
    result.probe.cases.map((c) => c.operation),
    OPERATIONS
  );
  for (const c of result.probe.cases) {
    assert.equal(c.nonvacuousPopulation.entries, 2);
    assert.equal(c.nonvacuousPopulation.registries, 1);
    assert.equal(c.prototypeRestored, true);
    assert.equal(c.structuralPrototypeRestored, true);
    assert.equal(c.nonvacuousPopulation.structuralStores, 1);
    assert.equal(c.nonvacuousPopulation.lifetimeEntries, 2);
    assert.equal(c.nonvacuousPopulation.revisionEntries, 2);
    assert.ok(c.checks.length > 0);
  }
  assert.deepEqual(
    result.probe.lateReads.map((c) => c.operation),
    ['node', 'field', 'write', 'replacement', 'restorable']
  );
  for (const c of result.probe.lateReads) {
    assert.equal(c.prototypeRestored, true);
    assert.ok(c.checks.length > 0);
  }
  assert.equal(result.probe.failureCount, result.probe.failures.length);
  assert.equal(child.status, result.probe.failureCount ? 1 : 0);
  return record;
}

function selfTest(artifact, original, report) {
  const source = readFileSync(join(artifact, TARGET));
  const text = source.toString('utf8');
  const temporary = mkdtempSync(join(tmpdir(), 'st-lifetime-cleanup-'));
  const copy = join(temporary, 'kernel');
  let copied = false;
  report.mutations = [];
  try {
    cpSync(artifact, copy, { recursive: true });
    copied = true;
    assert.equal(
      identity(copy).sha256,
      original.sha256,
      'Copy must match original'
    );
    assert.equal(
      text.split(DELETION).length - 1,
      1,
      'Expected exactly one actual deletion statement'
    );
    assert.equal(
      text.split(RECLAIM_START).length - 1,
      1,
      'Expected one reclamation function'
    );
    assert.equal(
      text.split(RECLAIM_END).length - 1,
      1,
      'Expected one following retirement function'
    );
    const start = text.indexOf(RECLAIM_START),
      end = text.indexOf(RECLAIM_END, start);
    assert.ok(end > start, 'Reclamation function boundaries must be ordered');
    const scope = text.slice(start, end);
    assert.equal(
      scope.split(COMMIT).length - 1,
      1,
      'Expected exactly one commit in reclamation function'
    );
    const registrationGuard =
      /if\(resolveSubjectState\(subjectId\)!==(?:void 0|undefined)\)\{subjectStateSignals\.set\(subjectId,new WeakRef\(created\)\);?\}/g;
    const guards = [...text.matchAll(registrationGuard)];
    assert.equal(
      guards.length,
      1,
      'Expected one actual conditional carrier registration'
    );
    const mutations = [
      {
        name: 'late-registration',
        text: text.replace(
          registrationGuard,
          'subjectStateSignals.set(subjectId,new WeakRef(created));'
        ),
        removed: guards[0][0],
      },
      {
        name: 'activation-deletion',
        text: text.replace(DELETION, ''),
        removed: DELETION,
      },
      {
        name: 'revision-resurrection',
        text:
          text.slice(0, start) +
          scope.replace(COMMIT, COMMIT + REPUBLISH) +
          text.slice(end),
        inserted: REPUBLISH,
        scope: [RECLAIM_START, RECLAIM_END],
      },
    ];
    const registryChecks = new Set([
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
    for (const mutation of mutations) {
      assert.equal(
        identity(copy).sha256,
        original.sha256,
        'Each mutation starts from exact original'
      );
      const control = runChild(
        copy,
        original,
        `${mutation.name}:control-copy`,
        report.runs
      );
      assert.equal(control.exitCode, 0, 'Unmodified control must pass');
      const receipt = {
        name: mutation.name,
        target: TARGET,
        occurrences: 1,
        ...(mutation.removed
          ? { removed: mutation.removed }
          : { inserted: mutation.inserted, scope: mutation.scope }),
        originalFileSHA256: sha256(source),
        mutantFileSHA256: sha256(mutation.text),
      };
      report.mutations.push(receipt);
      try {
        writeFileSync(join(copy, TARGET), mutation.text);
        const mutant = identity(copy);
        assert.deepEqual(
          mutant.files.map((f) => f.path),
          original.files.map((f) => f.path)
        );
        assert.deepEqual(
          mutant.files
            .filter((f, i) => f.sha256 !== original.files[i].sha256)
            .map((f) => f.path),
          [TARGET]
        );
        receipt.artifact = brief(mutant);
        receipt.onlyTargetChanged = true;
        const negative = runChild(
          copy,
          mutant,
          `${mutation.name}:mutant`,
          report.runs
        );
        assert.equal(
          negative.exitCode,
          1,
          'Actual mechanism mutant must fail cleanup'
        );
        for (const c of negative.result.probe.cases) {
          const failures = c.checks.filter((x) => !x.passed);
          if (mutation.name === 'activation-deletion') {
            assert.ok(
              failures.some((x) => x.name === 'retired A wrapper absent'),
              `${c.operation}: retired activation wrapper must remain`
            );
            assert.ok(
              failures.every((x) => registryChecks.has(x.name)),
              `${c.operation}: activation mutation broke another control`
            );
          } else if (mutation.name === 'revision-resurrection') {
            const idA = c.nonvacuousPopulation.subjectIds[0];
            assert.ok(
              failures.some(
                (x) =>
                  x.name ===
                    `revision: first retirement retired ${idA} absent` &&
                  x.actual === true &&
                  x.expected === false
              ),
              `${c.operation}: retired revision must be resurrected`
            );
            assert.ok(
              failures.every((x) => x.name.startsWith('revision:')),
              `${c.operation}: revision mutation broke an unrelated control`
            );
          }
        }
        for (const c of negative.result.probe.lateReads) {
          const failures = c.checks.filter((x) => !x.passed);
          if (
            mutation.name === 'late-registration' &&
            c.operation !== 'restorable'
          ) {
            assert.ok(
              failures.some(
                (x) =>
                  x.name === 'late: registration count' &&
                  x.actual === 1 &&
                  x.expected === 0
              )
            );
            assert.ok(
              failures.every((x) =>
                [
                  'late: registration count',
                  'late: registry membership after microtasks',
                ].includes(x.name)
              )
            );
          } else
            assert.deepEqual(
              failures,
              [],
              `${mutation.name}: unrelated late-read control`
            );
        }
        if (mutation.name === 'late-registration') {
          assert.ok(
            negative.result.probe.cases.every((c) =>
              c.checks.every((x) => x.passed)
            ),
            'Late registration mutation must preserve existing cleanup controls'
          );
        }
        assert.equal(
          identity(copy).sha256,
          mutant.sha256,
          'Mutant changed during probe'
        );
      } finally {
        writeFileSync(join(copy, TARGET), source);
        const restored = identity(copy);
        receipt.restoration = {
          artifact: brief(restored),
          matchesOriginal: restored.sha256 === original.sha256,
        };
        assert.equal(
          receipt.restoration.matchesOriginal,
          true,
          'Scratch restoration must be exact'
        );
        const positive = runChild(
          copy,
          restored,
          `${mutation.name}:restored-copy`,
          report.runs
        );
        assert.equal(positive.exitCode, 0, 'Restored copy must pass');
      }
    }
  } finally {
    try {
      if (copied) {
        writeFileSync(join(copy, TARGET), source);
        assert.equal(
          identity(copy).sha256,
          original.sha256,
          'Final scratch restoration must be exact'
        );
      }
    } finally {
      rmSync(temporary, { recursive: true, force: true });
      report.temporaryCopyRemoved = true;
    }
  }
}

const report = {
  check: 'retired-lifetime-cleanup',
  status: 'execution-failed',
  toolSHA256: sha256(readFileSync(SCRIPT)),
  node: process.version,
  platform: process.platform,
  runs: [],
  scope:
    'Actual lifetime/revision Maps, existing and late-read activation entries, zero-owner retirement and reactive undo control; no GC/heap claim or measurement waiver.',
};
try {
  const options = parseArgs();
  report.mode = options.child
    ? 'child'
    : options.selfTest
    ? 'self-test'
    : 'check';
  const original = identity(options.artifact);
  report.artifact = brief(original);
  try {
    if (options.child) {
      report.probe = await probe(options.artifact);
      process.exitCode = report.probe.failureCount ? 1 : 0;
    } else if (options.selfTest) {
      selfTest(options.artifact, original, report);
      process.exitCode = 0;
    } else {
      process.exitCode = runChild(
        options.artifact,
        original,
        'artifact',
        report.runs
      ).exitCode;
    }
  } finally {
    report.artifactUnchanged =
      identity(options.artifact).sha256 === original.sha256;
    assert.equal(
      report.artifactUnchanged,
      true,
      'Original artifact changed during check'
    );
  }
  report.status = process.exitCode === 0 ? 'passed' : 'cleanup-failed';
} catch (error) {
  report.error = error.stack ?? String(error);
  process.exitCode = 2;
}
console.log(JSON.stringify(report, null, 2));
