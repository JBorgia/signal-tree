import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

// This is an application-level, bounded reference, not another SignalTree
// implementation. It implements the visible contract exercised below: flat
// scalar job fields, pending optimistic owners, field-wise rollback, conservative
// publication after undeclared writes, explicitly independent publication, and
// same-key lifetime replacement. No restoration, arbitrary dependency discovery,
// framework scheduling, backend durability, or complete Link equivalence claim.
// Governing premises at 1a6225a386825c12f60d799a59db34c6341cc1e2:
// docs/architecture/multi-actor/PLAN.md: "Unknown attribution remains unknown;
// write ownership is not proof of input independence."
// "No external performance ranking before equivalent capability. Strong
// alternatives may win; account for application glue equally."
// Relevant native witnesses: integrated-late-history.spec.ts,
// link-declaration-public.spec.ts, link-overlapping-rollback.spec.ts, and
// publication-retirement-acceptance.spec.ts. Those tests establish the chosen
// scenario's expected observations; this reference derives them from its ledger.

export const COORDINATED_SCOPE = Object.freeze({
  schema: 'React reference Job: id/title/site/owner/team/priority/status',
  scenario: 'overlapping independent-field edits; late collection reader; independent field publication; foreign pending gate; confirm/rollback; same-key lifetime replacement',
  excluded: ['same-field competing writes', 'arbitrary expressions', 'restoration undo/redo', 'rekey', 'backend delivery/authentication', 'framework rendering', 'full native API equivalence'],
  flushMicrotasks: 160,
});

export const flush = async () => {
  for (let i = 0; i < COORDINATED_SCOPE.flushMicrotasks; i++) await Promise.resolve();
};

export function makeRows(count = 1000) {
  assert.ok(Number.isInteger(count) && count >= 4);
  return Array.from({ length: count }, (_, i) => ({
    id: `J-${i}`,
    title: `Inspect transfer pump ${i}`,
    site: `Plant ${i % 25}`,
    owner: `Operator ${i % 10}`,
    team: i % 2 ? 'South' : 'North',
    priority: 'routine',
    status: 'queued',
  }));
}

const clone = value => structuredClone(value);
const digest = value => createHash('sha256').update(JSON.stringify(value, (_key, item) =>
  item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]]))
    : item)).digest('hex');

const assertRows = (actual, expected, expectedDigest, label) => {
  if (expected) assert.deepEqual(actual, expected, label);
  else assert.equal(digest(actual), expectedDigest, label);
};

function makePackedFactory(kernel) {
  const { signalTree, entityMap, transactions, link } = kernel;
  return {
    create(input) {
      const tree = signalTree({ rows: entityMap({ selectId: row => row.id }) }, { enhancers: [transactions()] });
      const foreign = signalTree({ n: 0 }, { enhancers: [transactions()] });
      tree.$.rows.setAll(input);
      const connections = new Set();
      return {
        sentinels: () => [tree, foreign, tree.$.rows.byIdOrFail('J-0')],
        rows: () => tree.$.rows.all(),
        row: id => tree.$.rows.byIdOrFail(id)(),
        update: (id, patch) => tree.$.rows.updateOne(id, patch),
        begin(id, patch) {
          const handle = tree.transact(() => tree.$.rows.updateOne(id, patch));
          return handle;
        },
        beginForeign(value) {
          const handle = foreign.transact(() => foreign.$.n(value));
          return handle;
        },
        foreignValue: () => foreign.$.n(),
        connect(selection, send) {
          const source = selection.kind === 'collection'
            ? tree.$.rows
            : tree.$.rows.byIdOrFail(selection.id)[selection.field];
          const connection = link(source, { set: send });
          connections.add(connection);
          return {
            declare: (declaration, work) => connection.declare(declaration, work),
            settled: () => connection.settled(),
            dispose() { connection.dispose(); connections.delete(connection); },
          };
        },
        hold(id) {
          const handle = tree.$.rows.byIdOrFail(id);
          return { read: () => handle(), field: field => handle[field](), write: (field, value) => handle[field](value) };
        },
        remove: id => tree.$.rows.removeOne(id),
        add: row => tree.$.rows.addOne(row),
        destroy() {
          for (const connection of connections) connection.dispose();
          connections.clear();
          tree.destroy();
          foreign.destroy();
        },
      };
    },
  };
}

function makeReferenceFactory(fault) {
  // Kernel pending scopes share one process domain. The reference factory is
  // the equivalent bounded coordinator domain across its coexisting sessions.
  const pending = new Set();
  const participants = new Set();
  return {
    create(input) {
      const rows = new Map();
      const ownedPending = new Set();
      const connections = new Set();
      const changedRecords = new Set();
      let foreignValue = 0;
      let nextOwner = 1;
      let disposed = false;
      let independence = false;

      function install(value) {
        assert.ok(!rows.has(value.id));
        // The reference contract admits only flat scalar Job values, so a
        // shallow owned copy is sufficient and is cheaper than generic cloning.
        const record = { value: { ...value }, fields: undefined, live: true };
        rows.set(value.id, record);
      }
      for (const row of input) install(row);

      const get = id => {
        const record = rows.get(id);
        assert.ok(record?.live, `missing row ${id}`);
        return record;
      };
      const readRows = () => Array.from(rows.values(), record => record.value);
      function affects(connection, id, fields) {
        return connection.selection.kind === 'collection'
          || (connection.selection.id === id && fields.includes(connection.selection.field));
      }
      function blocked(connection) {
        if (!pending.size || fault === 'premature-publication') return false;
        const hasPending = versions => [...versions.at(-1).blockers].some(owner => owner.state === 'pending');
        if (connection.selection.kind === 'collection') {
          for (const record of changedRecords) for (const versions of record.fields.values()) if (hasPending(versions)) return true;
          return false;
        }
        const record = rows.get(connection.selection.id);
        const versions = record?.fields?.get(connection.selection.field);
        return versions ? hasPending(versions) : false;
      }
      function materialize(connection) {
        return connection.selection.kind === 'collection'
          ? readRows()
          : rows.get(connection.selection.id)?.value[connection.selection.field];
      }
      function queue(connection) {
        if (connection.disposed || connection.scheduled || !connection.dirty) return;
        connection.scheduled = true;
        queueMicrotask(() => {
          connection.scheduled = false;
          if (connection.disposed || !connection.dirty) return;
          if (blocked(connection)) return;
          connection.dirty = false;
          // A detached snapshot is part of the common destination contract.
          const value = materialize(connection);
          const receipt = connection.receipt;
          if (receipt) receipt.state = 'started';
          connection.send(value);
          if (!connection.dirty) {
            for (const done of connection.waiters) done();
            connection.waiters.clear();
          }
        });
      }
      function changed(id, fields) {
        for (const connection of connections) if (affects(connection, id, fields)) {
          connection.dirty = true;
          queue(connection);
        }
      }
      function write(id, patch, owner = null) {
        if (fault === 'drop-writes') return;
        const record = get(id);
        const next = { ...record.value };
        const fields = [];
        for (const [field, value] of Object.entries(patch)) {
          assert.notEqual(field, 'id');
          if (Object.is(record.value[field], value)) continue;
          const blockers = independence ? new Set() : new Set(pending);
          if (owner) blockers.add(owner);
          const entry = { value, owner, blockers };
          if (!record.fields) { record.fields = new Map(); changedRecords.add(record); }
          if (!record.fields.has(field)) record.fields.set(field, [{ value: record.value[field], owner: null, blockers: new Set() }]);
          record.fields.get(field).push(entry);
          next[field] = value;
          owner?.writes.push({ record, field, entry });
          fields.push(field);
        }
        if (fields.length) { record.value = next; changed(id, fields); }
      }
      function compact() {
        // No pending owner can refer to a prior version once this finite window
        // closes. Retained consumer snapshots already contain detached values.
        if (pending.size) return;
        for (const record of changedRecords) record.fields = undefined;
        changedRecords.clear();
      }
      function owner(work, foreignWrite) {
        const item = { id: nextOwner++, state: 'pending', writes: [], before: foreignValue, foreignWrite };
        const rollbackRows = fault === 'row-rollback' ? new Map(Array.from(rows.values(), record => [record.value.id, clone(record.value)])) : undefined;
        pending.add(item);
        ownedPending.add(item);
        work(item);
        const snapshot = item.writes.map(({ record, field, entry }) => ({ id: record.value.id, field, value: entry.value }));
        function settle(outcome) {
          assert.equal(item.state, 'pending');
          item.state = outcome;
          pending.delete(item);
          ownedPending.delete(item);
          if (outcome === 'rolled-back') {
            if (item.foreignWrite) foreignValue = item.before;
            for (const { record, field, entry } of item.writes) {
              if (!record.live) continue;
              const versions = record.fields.get(field);
              const index = versions.indexOf(entry);
              if (index >= 0) versions.splice(index, 1);
              record.value = { ...record.value, [field]: versions.at(-1).value };
              if (rollbackRows) record.value = { ...rollbackRows.get(record.value.id) };
              changed(record.value.id, [field]);
            }
          }
          // Only outstanding publication tasks retry. Settling an irrelevant
          // owner cannot synthesize a new send from an otherwise clean consumer.
          for (const participant of participants) participant.settled();
          item.writes.length = 0;
        }
        return {
          inspect: () => clone({ id: item.id, state: item.state, writes: snapshot }),
          confirm: () => settle('confirmed'),
          rollback: () => settle('rolled-back'),
        };
      }
      const participant = {
        settled() {
          for (const connection of connections) queue(connection);
          compact();
        },
      };
      participants.add(participant);
      return {
        sentinels: () => [rows, get('J-0')],
        rows: readRows,
        row: id => get(id).value,
        update: (id, patch) => write(id, patch),
        begin: (id, patch) => owner(item => write(id, patch, item), false),
        beginForeign: value => owner(() => { foreignValue = value; }, true),
        foreignValue: () => foreignValue,
        connect(selection, send) {
          const connection = { selection, send, dirty: false, scheduled: false, disposed: false, waiters: new Set(), receipt: null };
          connections.add(connection);
          return {
            declare(declaration, work) {
              assert.ok(!connection.disposed && !disposed, 'disposed');
              assert.equal(declaration.kind, 'independent');
              const state = { state: 'conservative' };
              connection.receipt = state;
              const previous = independence;
              independence = true;
              try { work(); } finally { independence = previous; }
              return { read: () => state.state === 'started' ? { state: 'started', basis: 'declared' } : { state: state.state } };
            },
            settled() {
              if (!connection.dirty || connection.disposed) return Promise.resolve();
              return new Promise(done => connection.waiters.add(done));
            },
            dispose() {
              connection.disposed = true;
              connections.delete(connection);
              for (const done of connection.waiters) done();
              connection.waiters.clear();
            },
          };
        },
        hold(id) {
          const record = get(id);
          const selected = () => fault === 'stale-lifetime' ? rows.get(id) : record.live ? record : undefined;
          return {
            read: () => selected() ? clone(selected().value) : undefined,
            field: field => selected()?.value[field],
            write: (field, value) => { assert.ok(selected()?.live, 'retired lifetime'); write(id, { [field]: value }); },
          };
        },
        remove(id) {
          const record = get(id);
          record.live = false;
          rows.delete(id);
          changed(id, Object.keys(record.value));
          record.fields = undefined;
          changedRecords.delete(record);
          record.value = undefined;
        },
        add(value) {
          install(value);
          changed(value.id, Object.keys(value));
        },
        destroy() {
          disposed = true;
          for (const connection of connections) {
            connection.disposed = true;
            for (const done of connection.waiters) done();
            connection.waiters.clear();
          }
          connections.clear();
          for (const item of ownedPending) { item.state = 'destroyed'; pending.delete(item); item.writes.length = 0; }
          ownedPending.clear();
          participants.delete(participant);
          for (const other of participants) other.settled();
          changedRecords.clear();
          rows.clear();
        },
      };
    },
  };
}

export async function loadArm(arm, kernelDirectory, { fault } = {}) {
  process.env.NODE_ENV = 'production';
  globalThis.ngDevMode = false;
  if (arm === 'reference') return makeReferenceFactory(fault);
  assert.equal(arm, 'packed');
  assert.ok(!fault, 'faults target the independent reference oracle controls only');
  const entry = pathToFileURL(resolve(kernelDirectory, 'dist/index.js')).href;
  return makePackedFactory(await import(entry));
}

// Start and every settlement are exposed separately so the outer harness can
// distinguish synchronous execution from time through the shared drain. The
// same oracle reads all rows on both arms at the same named boundaries.
export function prepareWorkflow(session, { cycle = 0, localOutcomes = { a: 'confirm', b: 'rollback' } } = {}) {
  const initial = clone(session.rows());
  const byId = new Map(initial.map(row => [row.id, row]));
  for (const id of ['J-0', 'J-1', 'J-2']) assert.ok(byId.has(id));
  for (const name of ['a', 'b']) assert.ok(['confirm', 'rollback'].includes(localOutcomes[name]));
  const values = {
    acceptedStatus: byId.get('J-0').status === 'active' ? 'done' : 'active',
    tentativeOwner: `Agent proposal ${cycle}`,
    progressStatus: byId.get('J-1').status === 'done' ? 'active' : 'done',
    priority: byId.get('J-2').priority === 'urgent' ? 'routine' : 'urgent',
  };
  const expected = initial.map(row => ({ ...row,
    ...(row.id === 'J-0' ? { status: values.acceptedStatus, owner: values.tentativeOwner } : {}),
    ...(row.id === 'J-1' ? { status: values.progressStatus } : {}),
    ...(row.id === 'J-2' ? { priority: values.priority } : {}),
  }));
  const expectedByMask = Array.from({ length: 4 }, (_, mask) => expected.map(row => row.id === 'J-0' ? {
    ...row,
    ...(mask & 1 && localOutcomes.a === 'rollback' ? { status: byId.get('J-0').status } : {}),
    ...(mask & 2 && localOutcomes.b === 'rollback' ? { owner: byId.get('J-0').owner } : {}),
  } : row));
  const replacement = { ...byId.get('J-0'), owner: `Replacement ${cycle}`, status: 'queued' };
  const expectedRetired = expectedByMask[3].filter(row => row.id !== 'J-0').concat([replacement]);
  const expectedFresh = expectedRetired.map(row => row.id === 'J-0' ? { ...row, status: 'active' } : row);
  return {
    session, cycle, initial, values, expectedByMask, localOutcomes, mask: 0,
    foreignBefore: session.foreignValue(), progressSent: [], sent: [], freshSent: [],
    replacement, expectedRetired, expectedFresh, checkpoints: [],
    rowCount: initial.length, priorTarget: { ...byId.get('J-0') },
    oracleDigests: { masks: expectedByMask.map(digest), retired: digest(expectedRetired), fresh: digest(expectedFresh) },
  };
}

// The assertions retain only fixed-size SHA-256 commitments plus the three
// edited values once a live-heap sample begins. Full expected row arrays are
// measurement scaffolding, not application state, and must not inflate either
// arm. The destination payloads remain because the application actually holds
// them. Later assertions hash actual full rows against the preread commitment.
export function releaseOracle(context) {
  for (const key of ['initial', 'expectedByMask', 'expectedRetired', 'expectedFresh', 'ownership', 'checkpoints']) delete context[key];
}

// Timed action 1: independent connection and three optimistic owners. The
// inspection between startPending and startPublication is oracle-only and must
// be outside the state timing window. Their durations can be summed as start.
export function startPending(context) {
  const { session, values } = context;
  context.progress = session.connect({ kind: 'field', id: 'J-1', field: 'status' }, value => context.progressSent.push(clone(value)));
  context.q = session.beginForeign(context.foreignBefore + 7);
  context.a = session.begin('J-0', { status: values.acceptedStatus });
  context.b = session.begin('J-0', { owner: values.tentativeOwner });
}

export function captureOwnership(context) {
  context.ownership = [context.q, context.a, context.b].map(handle => clone(handle.inspect()));
}

// Timed action 2: acquire a late collection consumer, then author two explicit
// independent edits. Destination snapshot serialization is application work and
// intentionally remains within time through the shared microtask drain.
export function startPublication(context) {
  const { session, values } = context;
  context.late = session.connect({ kind: 'collection' }, value => context.sent.push(clone(value)));
  context.late.declare({ kind: 'independent' }, () => session.update('J-2', { priority: values.priority }));
  context.progressReceipt = context.progress.declare({ kind: 'independent' }, () => session.update('J-1', { status: values.progressStatus }));
}

function check(context, name, { sentCount = 0 } = {}) {
  const expected = context.expectedByMask?.[context.mask];
  assertRows(context.session.rows(), expected, context.oracleDigests.masks[context.mask], `${name}: installed rows`);
  assert.deepEqual(context.progressSent, [context.values.progressStatus], `${name}: independent publication`);
  assert.equal(context.sent.length, sentCount, `${name}: collection publication count`);
  if (sentCount) assertRows(context.sent.at(-1), expected, context.oracleDigests.masks[context.mask], `${name}: collection publication value`);
  (context.checkpoints ??= []).push({ name, rows: context.rowCount, sent: context.sent.length, independent: context.progressSent.length });
}

export function checkPending(context) {
  check(context, 'all-pending');
  assert.ok(context.ownership, 'capture ownership before checking initial independent work');
  assert.deepEqual([context.q, context.a, context.b].map(handle => handle.inspect()), context.ownership, 'independent work cannot alter pending ownership');
  assert.deepEqual(context.progressReceipt.read(), { state: 'started', basis: 'declared' });
  assert.equal(context.session.foreignValue(), context.foreignBefore + 7);
}

// Timed action: one actual settlement. Expected-model progression is O(1), and
// no whole-row traversal or assertion executes in these action functions.
export function settleOne(context, name) {
  context[name][context.localOutcomes[name]]();
  context.mask |= name === 'a' ? 1 : 2;
}

export function checkLocalSettlement(context, name) {
  check(context, `${name}-settled-foreign-pending`);
  assert.equal(context.session.foreignValue(), context.foreignBefore + 7);
}

export function settleForeign(context, outcome = 'rollback') {
  context.q[outcome]();
  context.foreignOutcome = outcome;
}

export async function checkSettled(context) {
  check(context, 'all-settled', { sentCount: 1 });
  assert.equal(context.session.foreignValue(), context.foreignBefore + (context.foreignOutcome === 'confirm' ? 7 : 0));
  await Promise.all([context.progress.settled(), context.late.settled()]);
  const before = clone(context.sent);
  await flush();
  assert.deepEqual(context.sent, before, 'no duplicate post-settlement sends');
}

export async function settleWorkflow(context, { order = ['a', 'b'], foreignSettlement = 'rollback' } = {}) {
  assert.deepEqual([...order].sort(), ['a', 'b']);
  for (const name of order) {
    settleOne(context, name);
    await flush();
    checkLocalSettlement(context, name);
  }
  settleForeign(context, foreignSettlement);
  await flush();
  await checkSettled(context);
}

// Timed retirement action. The replacement payload and expected order were
// prepared before timing. Old-reader checks and misuse controls are separate.
export function retireWorkflow(context) {
  const { session } = context;
  context.late.dispose();
  context.progress.dispose();
  context.held = session.hold('J-0');
  session.remove('J-0');
  session.add(context.replacement);
}

export function checkRetired(context) {
  let called = false;
  assert.throws(() => context.late.declare({ kind: 'independent' }, () => { called = true; }));
  assert.equal(called, false, 'disposed declaration must not run');
  assert.equal(context.held.read(), undefined, 'old lifetime must detach after same-key reuse');
  assert.equal(context.held.field('status'), undefined, 'old field must detach after same-key reuse');
  assert.throws(() => context.held.write('status', 'done'), 'old lifetime cannot mutate replacement');
  assertRows(context.session.rows(), context.expectedRetired, context.oracleDigests.retired, 'same-key replacement preserves other rows and ordering');
  assert.equal(context.sent.length, 1, 'disposed collection receives no replacement');
}

export function publishReplacement(context) {
  context.fresh = context.session.connect({ kind: 'field', id: 'J-0', field: 'status' }, value => context.freshSent.push(clone(value)));
  context.fresh.declare({ kind: 'independent' }, () => context.session.update('J-0', { status: 'active' }));
}

export async function checkReplacement(context) {
  await context.fresh.settled();
  assert.deepEqual(context.freshSent, ['active'], 'fresh lifetime remains publishable');
  assertRows(context.session.rows(), context.expectedFresh, context.oracleDigests.fresh, 'fresh lifetime final rows');
  (context.checkpoints ??= []).push({ name: 'retired-and-replaced', rows: context.rowCount, sent: context.freshSent.length });
}

export function disposeWorkflow(context) {
  context.progress?.dispose();
  context.late?.dispose();
  context.fresh?.dispose();
}

export async function exercise(session, options = {}) {
  const context = prepareWorkflow(session, options);
  try {
    startPending(context);
    captureOwnership(context);
    startPublication(context);
    await flush();
    checkPending(context);
    await settleWorkflow(context, options);
    retireWorkflow(context);
    await flush();
    checkRetired(context);
    publishReplacement(context);
    await flush();
    await checkReplacement(context);
    return { checkpoints: context.checkpoints, finalRows: context.expectedFresh.length, finalFirst: context.expectedFresh[0], finalLast: context.expectedFresh.at(-1) };
  } finally { disposeWorkflow(context); }
}

export async function verifyReentry(factory) {
  const session = factory.create(makeRows(4));
  await flush();
  const sent = [];
  const receipts = [];
  const connection = session.connect({ kind: 'field', id: 'J-0', field: 'status' }, value => {
    sent.push(value);
    if (value === 'active') receipts.push(connection.declare({ kind: 'independent' }, () => session.update('J-0', { status: 'done' })));
  });
  try {
    receipts.push(connection.declare({ kind: 'independent' }, () => session.update('J-0', { status: 'active' })));
    await flush();
    await connection.settled();
    assert.deepEqual(sent, ['active', 'done']);
    assert.equal(session.row('J-0').status, 'done');
    const finalReceipts = receipts.map(receipt => receipt.read());
    assert.deepEqual(finalReceipts, [{ state: 'started', basis: 'declared' }, { state: 'started', basis: 'declared' }]);
    return { sends: sent, final: 'done', receipts: finalReceipts };
  } finally { connection.dispose(); session.destroy(); }
}

export async function verifyCoexisting(factory, { count = 1000, sessionCount = 8 } = {}) {
  const seed = makeRows(count);
  const sessions = Array.from({ length: sessionCount }, () => factory.create(seed));
  const contexts = [];
  try {
    // All ordinary rows exist before any pending owner is introduced. Each
    // later workflow then captures the shared earliest foreign owner q0.
    await flush();
    for (const session of sessions) {
      const context = prepareWorkflow(session);
      contexts.push(context);
      startPending(context);
      captureOwnership(context);
      startPublication(context);
      await flush();
      checkPending(context);
      releaseOracle(context);
    }
    for (const context of contexts) for (const name of ['a', 'b']) {
      settleOne(context, name);
      await flush();
      checkLocalSettlement(context, name);
    }
    for (let index = contexts.length - 1; index >= 0; index--) {
      settleForeign(contexts[index], 'rollback');
      await flush();
      if (index) {
        for (const context of contexts) {
          assert.equal(context.sent.length, 0, `q${index} released while q0 remains: collection must wait`);
          assert.deepEqual(context.progressSent, [context.values.progressStatus]);
        }
      }
    }
    for (const context of contexts) {
      await checkSettled(context);
      retireWorkflow(context);
      await flush();
      checkRetired(context);
      publishReplacement(context);
      await flush();
      await checkReplacement(context);
    }
    return { sessionCount, rowsPerSession: count, foreignReleaseOrder: 'reverse creation; q0 last', publicationCounts: contexts.map(context => context.sent.length), independentCounts: contexts.map(context => context.progressSent.length), oracleArraysReleased: true };
  } finally {
    for (const context of contexts) disposeWorkflow(context);
    for (const session of sessions) session.destroy();
  }
}

export async function selftest(kernelDirectory, count = 1000) {
  const results = [];
  for (const arm of ['reference', 'packed']) {
    const factory = await loadArm(arm, kernelDirectory);
    for (const order of [['a', 'b'], ['b', 'a']]) for (const foreignSettlement of ['confirm', 'rollback']) for (const localOutcomes of [{ a: 'confirm', b: 'rollback' }, { a: 'rollback', b: 'confirm' }]) {
      const session = factory.create(makeRows(count));
      try {
        await flush();
        const result = await exercise(session, { order, foreignSettlement, localOutcomes });
        results.push({ arm, order, foreignSettlement, localOutcomes, ...result });
      } finally { session.destroy(); }
    }
    const session = factory.create(makeRows(count));
    try {
      await flush();
      for (let cycle = 0; cycle < 10; cycle++) await exercise(session, { cycle, order: cycle % 2 ? ['b', 'a'] : ['a', 'b'], foreignSettlement: cycle % 2 ? 'confirm' : 'rollback', localOutcomes: cycle % 2 ? { a: 'rollback', b: 'confirm' } : { a: 'confirm', b: 'rollback' } });
      results.push({ arm, sustainedCycles: 10, finalRows: session.rows().length });
    } finally { session.destroy(); }
    results.push({ arm, reentry: await verifyReentry(factory) });
    results.push({ arm, coexisting: await verifyCoexisting(factory, { count }) });
  }
  const controls = [];
  for (const fault of ['premature-publication', 'row-rollback', 'stale-lifetime', 'drop-writes']) {
    const factory = await loadArm('reference', kernelDirectory, { fault });
    const session = factory.create(makeRows(4));
    let caught;
    try { await flush(); await exercise(session, { localOutcomes: { a: 'rollback', b: 'confirm' }, order: ['b', 'a'] }); } catch (error) { caught = error; }
    finally { session.destroy(); await flush(); }
    assert.ok(caught, `oracle missed planted ${fault}`);
    controls.push({ fault, killed: true, message: caught.message });
  }
  return { scope: COORDINATED_SCOPE, results, controls };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assert.equal(process.argv[2], 'selftest', 'usage: coordinated.mjs selftest /absolute/packed-kernel [row-count]');
  console.log(JSON.stringify(await selftest(process.argv[3], Number(process.argv[4] ?? 1000)), null, 2));
}
