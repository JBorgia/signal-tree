#!/usr/bin/env node
// Native capability probes, not the completed application arm or a ranking.
// Independent fields must survive the other operation's rejection in the lab's
// business contract. A native miss identifies required app glue, not necessarily
// a defect in the library's documented whole-row transaction semantics.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const [suppliedWorkspace, suppliedOutput] = process.argv.slice(2);
assert.ok(
  suppliedWorkspace && suppliedOutput,
  'tanstack-overlap.mjs INSTALLED_WORKSPACE OUTPUT_JSON'
);
const workspace = resolve(suppliedWorkspace);
const require = createRequire(join(workspace, 'package.json'));
const {
  createCollection,
  localOnlyCollectionOptions,
  createTransaction,
} = require('@tanstack/db');
const version = require('@tanstack/db/package.json').version;
const sha = (path) =>
  createHash('sha256').update(readFileSync(path)).digest('hex');
const seed = { id: 'A', status: 'queued', owner: 'Sam' };
// get() adds TanStack metadata; compare the declared domain fields only.
const copy = (value) => ({
  id: value.id,
  status: value.status,
  owner: value.owner,
});
const deferred = () => {
  let accept, reject;
  const promise = new Promise((yes, no) => {
    accept = yes;
    reject = no;
  });
  return { promise, accept, reject };
};
const settled = (transaction) =>
  transaction.when('settled').then(
    () => ({ outcome: 'resolved', state: transaction.state }),
    (error) => ({
      outcome: 'rejected',
      state: transaction.state,
      error: String(error),
    })
  );
const traces = [];

// Healthy no-overlap control: the native wrapper persists a single accepted
// owner edit and cleanup resolves. Without this, an empty/unstarted probe fails.
{
  const hold = deferred();
  const collection = createCollection(
    localOnlyCollectionOptions({
      getKey: (row) => row.id,
      initialData: [{ ...seed }],
      onUpdate: () => hold.promise,
    })
  );
  const transaction = collection.update('A', (row) => {
    row.owner = 'Lee';
  });
  const completion = settled(transaction);
  assert.equal(transaction.state, 'persisting');
  assert.deepEqual(copy(collection.get('A')), { ...seed, owner: 'Lee' });
  hold.accept();
  assert.equal((await completion).outcome, 'resolved');
  assert.deepEqual(copy(collection.get('A')), { ...seed, owner: 'Lee' });
  await collection.cleanup();
  traces.push({ name: 'single-operation-control', passed: true });
}

// Both network mutations are already persisting. Reject the status edit while
// the independent owner edit still waits; inspect before releasing that waiter.
{
  const handlers = [];
  const collection = createCollection(
    localOnlyCollectionOptions({
      getKey: (row) => row.id,
      initialData: [{ ...seed }],
      onUpdate: () => {
        const hold = deferred();
        handlers.push(hold);
        return hold.promise;
      },
    })
  );
  const a = collection.update('A', (row) => {
    row.status = 'active';
  });
  const aDone = settled(a);
  const b = collection.update('A', (row) => {
    row.owner = 'Lee';
  });
  const bDone = settled(b);
  assert.equal(handlers.length, 2);
  assert.equal(a.state, 'persisting');
  assert.equal(b.state, 'persisting');
  assert.deepEqual(copy(collection.get('A')), {
    ...seed,
    status: 'active',
    owner: 'Lee',
  });
  handlers[0].reject(new Error('Backend rejected status edit'));
  const aResult = await aDone;
  assert.equal(aResult.outcome, 'rejected');
  assert.equal(b.state, 'persisting');
  const afterA = copy(collection.get('A'));
  const expected = { ...seed, owner: 'Lee' };
  handlers[1].accept();
  const bResult = await bDone;
  assert.equal(bResult.outcome, 'resolved');
  traces.push({
    name: 'reject-older-while-other-persists',
    beforeBSettlement: afterA,
    expectedBeforeBSettlement: expected,
    afterBSettlement: copy(collection.get('A')),
    nativeBusinessContractPass:
      JSON.stringify(afterA) === JSON.stringify(expected),
    aResult,
    bResult,
  });
  await collection.cleanup();
}

// Two explicit drafts have not entered persistence. Rollback one; the other
// draft's owner proposal must survive if the native API alone fits this task.
{
  const collection = createCollection(
    localOnlyCollectionOptions({
      getKey: (row) => row.id,
      initialData: [{ ...seed }],
    })
  );
  const a = createTransaction({
    autoCommit: false,
    mutationFn: async ({ transaction }) => {
      collection.utils.acceptMutations(transaction);
    },
  });
  const b = createTransaction({
    autoCommit: false,
    mutationFn: async ({ transaction }) => {
      collection.utils.acceptMutations(transaction);
    },
  });
  const aDone = settled(a),
    bDone = settled(b);
  a.mutate(() =>
    collection.update('A', (row) => {
      row.status = 'active';
    })
  );
  b.mutate(() =>
    collection.update('A', (row) => {
      row.owner = 'Lee';
    })
  );
  assert.equal(a.state, 'pending');
  assert.equal(b.state, 'pending');
  assert.deepEqual(copy(collection.get('A')), {
    ...seed,
    status: 'active',
    owner: 'Lee',
  });
  a.rollback();
  const afterA = copy(collection.get('A'));
  const expected = { ...seed, owner: 'Lee' };
  const bState = b.state;
  traces.push({
    name: 'rollback-one-uncommitted-draft',
    afterA,
    expected,
    bState,
    nativeBusinessContractPass:
      JSON.stringify(afterA) === JSON.stringify(expected) &&
      bState === 'pending',
  });
  if (b.state === 'pending') b.rollback();
  await Promise.all([aDone, bDone]);
  await collection.cleanup();
}
const result = {
  version,
  runnerSha256: sha(fileURLToPath(import.meta.url)),
  packageLockSha256: sha(join(workspace, 'package-lock.json')),
  registryIntegrity: JSON.parse(
    readFileSync(join(workspace, 'package-lock.json'), 'utf8')
  ).packages['node_modules/@tanstack/db'].integrity,
  loadedModuleHashes: Object.fromEntries(
    Object.keys(require.cache)
      .filter((path) =>
        path.startsWith(realpathSync(join(workspace, 'node_modules')) + '/')
      )
      .map((path) => [path, sha(path)])
  ),
  modulePath: require.resolve('@tanstack/db'),
  traces,
  limitation:
    'Node native CJS API with local-only persistence wrapper. No Angular/live-query, query-backend refetch or completed application-arm claim. Misses require app modeling/reconciliation assessment.',
};
writeFileSync(resolve(suppliedOutput), JSON.stringify(result, null, 2) + '\n', {
  flag: 'wx',
});
console.log(JSON.stringify(result, null, 2));
if (traces.some((trace) => trace.nativeBusinessContractPass === false))
  process.exitCode = 1;
