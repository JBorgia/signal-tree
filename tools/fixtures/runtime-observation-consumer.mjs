/** Installed-package runtime falsifiers. No source aliases or private producer hooks.
 * node tools/fixtures/runtime-observation-consumer.mjs /absolute/node_modules/@signal-tree/kernel/dist/index.js
 * Emits one JSON report; any missing producer, assertion, identity or cleanup failure exits 1.
 * This fixture is development evidence, not an RC/release certification.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const report = { fixture: 'runtime-observation-consumer', environment: {
  node: process.version, platform: process.platform, arch: process.arch,
  nodeEnv: process.env.NODE_ENV ?? null,
}, package: null, cases: [] };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function check(name, body) {
  const evidence = {};
  try { await body(evidence); report.cases.push({ name, passed: true, evidence }); }
  catch (error) {
    report.cases.push({ name, passed: false, evidence, error: {
      name: error.name, code: error.code ?? null, message: error.message,
    } });
  }
}
const required = ['transactionLifecycleReader', 'restorationReader', 'entityMembershipReader', 'linkStateReader'];
let api, readers, fingerprint;
await check('installed-package-identity-and-exports', async evidence => {
  const entry = process.argv[2];
  assert.equal(process.argv.length, 3, 'Supply exactly one absolute installed kernel entry path');
  assert.ok(entry && isAbsolute(entry), 'An explicit absolute installed entry path is required');
  const resolved = realpathSync(entry), require = createRequire(pathToFileURL(resolved));
  const manifestPath = realpathSync(require.resolve('@signal-tree/kernel/package.json'));
  const root = dirname(manifestPath), manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.name, '@signal-tree/kernel');
  assert.ok(root.split(sep).includes('node_modules'), 'Source workspace entries are not installed-package evidence');
  const publicEntry = realpathSync(require.resolve('@signal-tree/kernel'));
  const internalsEntry = realpathSync(require.resolve('@signal-tree/kernel/internals'));
  assert.equal(resolved, publicEntry, 'Input must be the installed package public root entry');
  for (const path of [publicEntry, internalsEntry]) {
    const rel = relative(root, path);
    assert.ok(rel.startsWith(`dist${sep}`) && !rel.split(sep).includes('..'), 'Entry escaped this installed package dist');
  }
  assert.equal(realpathSync(createRequire(pathToFileURL(internalsEntry)).resolve('@signal-tree/kernel')), publicEntry);
  fingerprint = () => {
    const files = [];
    const walk = directory => { for (const item of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, item.name);
      if (item.isDirectory()) walk(path);
      else if (item.isFile() && /\.(?:js|mjs)$/.test(item.name)) files.push(path);
    } };
    walk(join(root, 'dist'));
    const digest = createHash('sha256');
    for (const path of files.sort()) { const bytes = readFileSync(path); digest.update(relative(root, path)).update('\0').update(String(bytes.length)).update('\0').update(bytes); }
    return { manifestSha256: hash(readFileSync(manifestPath)), runtimeFiles: files.length, runtimeSha256: digest.digest('hex') };
  };
  report.package = { name: manifest.name, version: manifest.version, root, publicEntry, internalsEntry, ...fingerprint() };
  api = await import(pathToFileURL(publicEntry).href);
  readers = await import(pathToFileURL(internalsEntry).href);
  evidence.readers = Object.fromEntries(required.map(name => [name, typeof readers[name]]));
  for (const name of required) assert.equal(typeof readers[name], 'function', `Missing supported internals export: ${name}`);
});

if (api && readers && required.every(name => typeof readers[name] === 'function')) {
  const { signalTree, transactions, restoration, undoable, entityMap, link } = api;
  const { transactionLifecycleReader: txReader, restorationReader: historyReader,
    entityMembershipReader: entityReader, linkStateReader: linkReader } = readers;
  const need = (reader, name) => { assert.ok(reader, `${name}: public runtime producer unavailable`); return reader; };
  const tick = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
  const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
  const bounded = async (promise, name) => {
    let timer;
    try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${name}: 3000ms deadline exceeded`)), 3000); })]); }
    finally { clearTimeout(timer); }
  };
  // Reader callbacks may swallow exceptions by contract. Collect facts there;
  // perform every assertion outside delivery so a failed assertion cannot vanish.
  const mutate = fn => { try { fn(); } catch (error) { if (!(error instanceof TypeError)) throw error; } };
  const increasing = events => { for (let i = 1; i < events.length; i++) assert.ok(events[i].sequence > events[i - 1].sequence); };
  const lifecycle = events => events.map(({ kind, transactionId, sequence, reason, pendingRetained, consequencesReleased }) =>
    ({ kind, transactionId, sequence, ...(reason ? { reason, pendingRetained, consequencesReleased } : {}) }));

  await check('absence-versus-empty', async evidence => {
    const bare = signalTree({ x: 0 }), enabled = signalTree({ x: 0 }, { enhancers: [transactions(), restoration()] });
    const disabled = signalTree({ x: 0 }, { enhancers: [restoration({ enabled: false })] });
    try {
      evidence.bare = { transactions: txReader(bare) !== undefined, restoration: historyReader(bare) !== undefined, entities: entityReader(bare) !== undefined };
      assert.deepEqual(evidence.bare, { transactions: false, restoration: false, entities: false });
      assert.equal(historyReader(disabled), undefined);
      const tx = need(txReader(enabled), 'transactions'), history = need(historyReader(enabled), 'restoration');
      evidence.emptyCounts = { pending: tx.snapshot().pending.length, entries: history.snapshot().entries.length, links: linkReader(bare).snapshot().links.length };
      assert.deepEqual(evidence.emptyCounts, { pending: 0, entries: 0, links: 0 });
    } finally { bare.destroy(); enabled.destroy(); disabled.destroy(); }
  });

  await check('transaction-open-stage-refuse-confirm-and-isolation', async evidence => {
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    try {
      const reader = need(txReader(tree), 'transactions'), events = [];
      reader.subscribe(event => { mutate(() => { event.snapshot.pending[0].phase = 'corrupted'; }); });
      reader.subscribe(event => events.push(event));
      let during;
      const first = tree.transaction(() => { during = reader.snapshot(); tree.$.x(1); });
      assert.equal(during.pending[0].phase, 'opened');
      const id = during.pending[0].transactionId;
      const second = tree.transaction(() => tree.$.x(2));
      const snapshot = reader.snapshot();
      mutate(() => { snapshot.pending[0].phase = 'corrupted'; });
      assert.equal(reader.snapshot().pending.find(item => item.transactionId === id).phase, 'staged');
      assert.throws(() => first.rollback(), /later-pending-dependency/);
      const refused = events.find(event => event.kind === 'refused');
      assert.ok(refused, 'Refusal event missing');
      assert.equal(refused.transactionId, id);
      assert.equal(refused.pendingRetained, true); assert.equal(refused.consequencesReleased, true);
      evidence.afterRefusal = need(txReader(tree), 'late transaction attach').snapshot().pending;
      assert.equal(evidence.afterRefusal.find(item => item.transactionId === id).consequencesReleased, true);
      first.confirm(); second.confirm();
      evidence.events = lifecycle(events);
      assert.deepEqual(events.map(event => event.kind), ['opened', 'staged', 'opened', 'staged', 'refused', 'confirmed', 'confirmed']);
      assert.equal(events[0].snapshot.pending[0].phase, 'opened');
      assert.deepEqual(reader.snapshot().pending, []); assert.equal(tree.$.x(), 2); increasing(events);
      const late = []; const off = reader.subscribe(event => late.push(event)); off(); off();
      assert.deepEqual(late, []);
    } finally { tree.destroy(); }
  });

  for (const first of [true, false]) await check(`restoration-actual-relation-undo-redo-transactions-first-${first}`, async evidence => {
    const tree = signalTree({ x: 0, y: 0 }, { enhancers: first ? [transactions(), restoration()] : [restoration(), transactions()] });
    try {
      const reader = need(historyReader(tree), 'restoration'), tx = need(txReader(tree), 'transactions'), events = [], txEvents = [];
      reader.subscribe((event, snapshot) => events.push({ event, snapshot })); tx.subscribe(event => txEvents.push(event));
      undoable(() => tree.$.x(1)); await tick();
      assert.equal(reader.snapshot().entries.length, 1);
      assert.deepEqual(reader.snapshot().entries[0].transactionIds, []);
      const pending = tree.transaction(() => undoable(() => tree.$.y(1)));
      assert.equal(reader.snapshot().entries.length, 1, 'Pending operation invented a retained restoration entry');
      const transactionId = txEvents.find(event => event.kind === 'opened').transactionId;
      pending.confirm(); await tick();
      const before = reader.snapshot(); assert.equal(before.entries.length, 2);
      const entryId = before.entries[1].entryId;
      assert.deepEqual(before.entries[1].transactionIds, [transactionId]);
      mutate(() => { before.entries[1].transactionIds.push(999); });
      assert.deepEqual(reader.snapshot().entries[1].transactionIds, [transactionId]);
      tree.undo(); await tick();
      assert.equal(tree.$.y(), 0); assert.equal(tree.$.x(), 1);
      assert.equal(reader.snapshot().entries[1].status, 'unapplied');
      tree.redo(); await tick(); assert.equal(tree.$.y(), 1);
      const operations = events.map(item => item.event).filter(event => event.kind === 'operation');
      evidence.entries = reader.snapshot().entries; evidence.operations = operations.map(({ operation, operationId, outcome, affectedEntryIds }) => ({ operation, operationId, outcome, affectedEntryIds }));
      assert.deepEqual(operations.map(event => [event.operation, event.outcome, event.affectedEntryIds]), [['undo', 'applied', [entryId]], ['redo', 'applied', [entryId]]]);
      assert.notEqual(operations[0].operationId, operations[1].operationId); increasing(events.map(item => item.event));
    } finally { tree.destroy(); }
  });

  await check('entity-public-producer-empty', async evidence => {
    const tree = signalTree({ rows: entityMap() });
    try {
      const reader = entityReader(tree); evidence.available = reader !== undefined;
      const snapshot = need(reader, 'entityMap membership').snapshot();
      evidence.collections = snapshot.collections;
      assert.equal(snapshot.collections.length, 1); assert.deepEqual(snapshot.collections[0].members, []);
    } finally { tree.destroy(); }
  });

  await check('entity-typed-keys-literal-locations-snapshot-isolation', async evidence => {
    const tree = signalTree({ 'a.b': entityMap(), a: { b: entityMap() } });
    try {
      tree.$['a.b'].setAll([{ id: 1 }, { id: '1' }, { id: 'v1.2/::' }]);
      tree.$.a.b.addOne({ id: 1 });
      const reader = need(entityReader(tree), 'entityMap membership'), snapshot = reader.snapshot();
      const literal = snapshot.collections.find(item => item.location.length === 1 && item.location[0].key === 'a.b');
      const nested = snapshot.collections.find(item => item.location.length === 2);
      assert.ok(literal); assert.ok(nested);
      assert.deepEqual(literal.members.map(item => item.key), [1, '1', 'v1.2/::']);
      assert.notEqual(literal.collectionPosition, nested.collectionPosition);
      evidence.collections = structuredClone(snapshot.collections);
      mutate(() => { literal.members[0].key = 'corrupted'; });
      mutate(() => { literal.location[0].key = 'corrupted'; });
      assert.deepEqual(reader.snapshot().collections, evidence.collections);
    } finally { tree.destroy(); }
  });

  await check('entity-reorder-rekey-remove-readd-lifetime-and-events', async evidence => {
    const tree = signalTree({ rows: entityMap() });
    try {
      const rows = tree.$.rows; rows.setAll([{ id: 1 }, { id: '1' }, { id: 'a.b' }]);
      const reader = need(entityReader(tree), 'entityMap membership'), events = [];
      reader.subscribe(event => events.push(event));
      const before = reader.snapshot().collections[0].members;
      const lifetime = before.find(item => item.key === 1).lifetimeId;
      rows.setAll([{ id: 'a.b' }, { id: '1' }, { id: 1 }]);
      assert.deepEqual(reader.snapshot().collections[0].members, [...before].reverse());
      rows.changeId(1, 9);
      assert.equal(reader.snapshot().collections[0].members.find(item => item.key === 9).lifetimeId, lifetime);
      rows.removeOne(9); rows.addOne({ id: 9 });
      const after = reader.snapshot().collections[0].members;
      assert.notEqual(after.find(item => item.key === 9).lifetimeId, lifetime);
      const changes = events.flatMap(event => event.changes); evidence.changes = changes; evidence.members = after;
      const reorder = changes.find(change => change.kind === 'reorder');
      assert.ok(reorder, 'No actual reorder event');
      assert.deepEqual(reorder.before, before.map(item => item.lifetimeId));
      assert.deepEqual(reorder.after, [...before].reverse().map(item => item.lifetimeId));
      assert.ok(changes.some(change => change.kind === 'rekey' && change.lifetimeId === lifetime && change.beforeKey === 1 && change.afterKey === 9), 'No actual rekey event');
      assert.ok(changes.some(change => change.kind === 'remove' && change.lifetimeId === lifetime));
      assert.ok(changes.some(change => change.kind === 'add' && change.key === 9 && change.lifetimeId !== lifetime)); increasing(events);
    } finally { tree.destroy(); }
  });

  await check('link-held-inflight-isolation-dispose', async evidence => {
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] }), io = deferred(); let connection;
    try {
      const reader = linkReader(tree), events = [], sent = [];
      connection = link(tree.$.x, { set: value => { sent.push(value); return io.promise; } });
      reader.subscribe(event => events.push(event));
      const pending = tree.transaction(() => tree.$.x(1)); await tick();
      const held = reader.snapshot().links[0]; evidence.held = structuredClone(held);
      assert.equal(held.held, true); assert.equal(held.sending, false); assert.deepEqual(sent, []);
      mutate(() => { held.directions.set = false; });
      assert.equal(reader.snapshot().links[0].directions.set, true);
      pending.confirm(); await tick();
      evidence.inflight = reader.snapshot().links[0]; assert.equal(evidence.inflight.sending, true); assert.deepEqual(sent, [1]);
      const firstSend = events.findIndex(event => event.link.sending);
      assert.ok(firstSend >= 0);
      assert.equal(events.slice(0, firstSend).some(({ link: state }) => !state.dirty && !state.held && !state.queued && !state.sending && !state.retrieving), false, 'False idle before first send');
      io.resolve(); await bounded(connection.settled(), 'Link settlement');
      connection.dispose(); connection.dispose(); evidence.remaining = reader.snapshot().links.length;
      assert.equal(evidence.remaining, 0); increasing(events);
    } finally { io.resolve(); try { connection?.dispose(); } finally { tree.destroy(); } }
  });

  for (const boundary of ['dispose', 'destroy']) for (const outcome of ['resolve', 'reject']) await check(`link-late-retrieval-${boundary}-${outcome}`, async evidence => {
    const tree = signalTree({ x: 0 }), io = deferred(); let connection, retrieval;
    try {
      const reader = linkReader(tree), events = []; reader.subscribe(event => events.push(event));
      connection = link(tree.$.x, { get: () => io.promise });
      retrieval = connection.retrieve().catch(error => error.message);
      assert.equal(reader.snapshot().links[0].retrieving, 1);
      if (boundary === 'dispose') connection.dispose(); else tree.destroy();
      const count = events.length;
      if (outcome === 'resolve') io.resolve(5); else io.reject(new Error('fixture endpoint refusal'));
      await bounded(retrieval, 'late retrieval'); await tick();
      evidence.lateKinds = events.slice(count).map(event => event.kind); assert.deepEqual(evidence.lateKinds, []);
      if (boundary === 'dispose') assert.deepEqual(reader.snapshot().links, []);
      else assert.throws(() => reader.snapshot(), /destroyed/);
    } finally { io.resolve(0); try { if (retrieval) await bounded(retrieval, 'cleanup retrieval'); connection?.dispose(); } finally { tree.destroy(); } }
  });

  for (const boundary of ['dispose', 'destroy']) for (const outcome of ['resolve', 'reject']) await check(`link-late-send-${boundary}-${outcome}`, async evidence => {
    const tree = signalTree({ x: 0 }), io = deferred(); let connection;
    try {
      const reader = linkReader(tree), events = []; reader.subscribe(event => events.push(event));
      connection = link(tree.$.x, { set: () => io.promise });
      tree.$.x(1); await tick(); assert.equal(reader.snapshot().links[0].sending, true);
      if (boundary === 'dispose') connection.dispose(); else tree.destroy();
      const count = events.length;
      if (outcome === 'resolve') io.resolve(); else io.reject(new Error('fixture endpoint refusal'));
      await bounded(connection.settled(), 'late send settlement'); await tick();
      evidence.lateKinds = events.slice(count).map(event => event.kind); assert.deepEqual(evidence.lateKinds, []);
      if (boundary === 'dispose') assert.deepEqual(reader.snapshot().links, []);
      else assert.throws(() => reader.snapshot(), /destroyed/);
    } finally { io.resolve(); try { connection?.dispose(); } finally { tree.destroy(); } }
  });

  // Separate per-reader cases keep missing entity production from hiding other teardown results.
  for (const name of required) await check(`destroy-${name}`, async evidence => {
    const tree = signalTree({ x: 0, rows: entityMap() }, { enhancers: [transactions(), restoration()] });
    try {
      const reader = need(readers[name](tree), name); let delivered = 0;
      const off = reader.subscribe(() => { delivered++; });
      tree.destroy(); tree.destroy(); off(); off();
      assert.throws(() => reader.snapshot(), /destroyed/);
      assert.throws(() => reader.subscribe(() => {}), /destroyed/);
      assert.throws(() => readers[name](tree), /destroyed/);
      evidence.delivered = delivered; assert.equal(delivered, 0);
    } finally { tree.destroy(); }
  });
}
if (report.package) await check('installed-package-unchanged-during-run', async evidence => {
  const { manifestSha256, runtimeFiles, runtimeSha256 } = report.package;
  evidence.after = fingerprint();
  assert.deepEqual(evidence.after, { manifestSha256, runtimeFiles, runtimeSha256 });
});
report.passed = report.cases.filter(item => item.passed).length;
report.failed = report.cases.length - report.passed;
report.success = report.failed === 0;
console.log(JSON.stringify(report, null, 2));
if (!report.success) process.exitCode = 1;
