import assert from 'node:assert/strict';
import { signalTree, restoration, transactions } from '@signal-tree/kernel';
import { peekInternalTransactionRuntime } from '@proof/packages/kernel/src/enhancers/transactions/transactions.ts';
import { hasOpenCommitScope } from '@proof/packages/kernel/src/lib/internals/commit-consequence.ts';

// Ordinary public writes copied from unchanged kernel acceptance tests:
// absent-path-write.spec.ts:833 (all three enhancer orders), and
// branch-omission-correctness.spec.ts:523 (original scalar baseline).
// No capture fault, state corruption, or implementation hook is installed.
const control = process.argv[2] ?? 'suite';
assert.equal(control, 'suite');
const orders = [
  ['transactions alone', () => [transactions()]],
  ['transactions first', () => [transactions(), restoration()]],
  ['restoration first', () => [restoration(), transactions()]],
];
const output = { control, faultInjection: false, results: [] };
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const attempt = (run) => {
  try { run(); return { threw: false }; }
  catch (error) { return { threw: true, code: error?.code, name: error?.name, message: error?.message, undefined: error === undefined }; }
};
const check = (trace, name, run) => {
  try { run(); trace.checks.push({ name, pass: true }); }
  catch (error) { trace.checks.push({ name, pass: false, error: error.stack }); process.exitCode = 1; }
};
for (const [order, enhancers] of orders) {
  const trace = { scenario: 'directly omitted leaf', order, checks: [] };
  output.results.push(trace);
  let tree;
  try {
    tree = signalTree({ user: { name: 'Ada', age: 42 } }, { enhancers: enhancers() });
    const branch = tree.$.user;
    const age = branch.age;
    const state = () => ({ value: { ...branch() }, keys: Object.keys(branch()), age: age(), pending: peekInternalTransactionRuntime(tree).getPendingTurnCount(), scope: hasOpenCommitScope(tree) });
    branch({ name: 'Ada' });
    await flush();
    trace.before = state();
    check(trace, 'ordinary omission actually removed the member', () => {
      assert.deepEqual(trace.before.value, { name: 'Ada' });
      assert.deepEqual(trace.before.keys, ['name']);
      assert.equal(trace.before.age, undefined);
    });
    const pending = tree.transact(() => branch.age(50));
    await flush();
    trace.speculative = state();
    check(trace, 'useful re-adding write', () => {
      assert.deepEqual(trace.speculative.value, { name: 'Ada', age: 50 });
      assert.equal(trace.speculative.age, 50);
      assert.equal(trace.speculative.pending, 1);
    });
    trace.rollback = attempt(() => pending.rollback());
    await flush();
    trace.after = state();
    // Preserve both original assertions without deriving expected from a read.
    check(trace, 'original member-absence assertion', () => assert.deepEqual(Object.keys(branch()), ['name']));
    check(trace, 'original leaf-read assertion', () => assert.equal(age(), undefined));
    check(trace, 'successful settlement is complete and terminal', () => {
      assert.equal(trace.rollback.threw, false);
      assert.deepEqual(trace.after.value, { name: 'Ada' });
      assert.equal(trace.after.pending, 0);
      assert.equal(trace.after.scope, false);
    });
    trace.retry = attempt(() => pending.rollback());
    await flush();
    trace.afterRetry = state();
    check(trace, 'terminal retry is nonmutating', () => {
      assert.equal(trace.retry.threw, false);
      assert.deepEqual(trace.afterRetry, trace.after);
    });
    trace.status = trace.checks.every((item) => item.pass) ? 'pass' : 'fail';
  } catch (error) { trace.status = 'fixture-error'; trace.error = error?.stack ?? String(error); process.exitCode = 1; }
  finally { tree?.destroy(); }
}
{
  const trace = { scenario: 'original scalar baseline before later omission', order: 'transactions alone', checks: [] };
  output.results.push(trace);
  let tree;
  try {
    const initial = { name: 'Ada', age: 42 };
    tree = signalTree({ profile: { ...initial } }, { enhancers: [transactions()] });
    const state = () => ({ value: { ...tree.$.profile() }, keys: Object.keys(tree.$.profile()), age: tree.$.profile.age(), pending: peekInternalTransactionRuntime(tree).getPendingTurnCount(), scope: hasOpenCommitScope(tree) });
    let authoredAge;
    const pending = tree.transact(() => {
      tree.$.profile.age(8);
      authoredAge = tree.$.profile.age();
      tree.$.profile({ name: 'Grace' });
    });
    trace.speculative = state();
    trace.authoredAge = authoredAge;
    check(trace, 'useful scalar write followed by omission', () => {
      assert.equal(authoredAge, 8);
      assert.deepEqual(trace.speculative.value, { name: 'Grace' });
      assert.equal(trace.speculative.pending, 1);
    });
    trace.rollback = attempt(() => pending.rollback());
    trace.after = state();
    check(trace, 'original full-baseline assertion', () => assert.deepEqual(tree.$.profile(), initial));
    check(trace, 'successful settlement is complete and terminal', () => {
      assert.equal(trace.rollback.threw, false);
      assert.equal(trace.after.pending, 0);
      assert.equal(trace.after.scope, false);
    });
    trace.retry = attempt(() => pending.rollback());
    trace.afterRetry = state();
    check(trace, 'terminal retry is nonmutating', () => { assert.equal(trace.retry.threw, false); assert.deepEqual(trace.afterRetry, trace.after); });
    trace.status = trace.checks.every((item) => item.pass) ? 'pass' : 'fail';
  } catch (error) { trace.status = 'fixture-error'; trace.error = error?.stack ?? String(error); process.exitCode = 1; }
  finally { tree?.destroy(); }
}
console.log(JSON.stringify(output, (_key, value) => value === undefined ? { diagnosticUndefined: true } : value, 2));
