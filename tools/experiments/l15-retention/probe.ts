/** Non-shipping, read-only observations. The runner injects count-only lenses in memory. */
import { signalTree } from '../../../packages/kernel/src/lib/signal-tree';
import {
  transactions,
  peekInternalTransactionRuntime,
} from '../../../packages/kernel/src/enhancers/transactions/transactions';
import { entityMap } from '../../../packages/kernel/src/lib/markers/entity-map';
import { external } from '../../../packages/kernel/src/lib/external';
import { confirmedTurnReader } from '../../../packages/kernel/src/internals';
import { getPathNotifier } from '../../../packages/kernel/src/lib/path-notifier';
import { getSubjectRestorationClaims } from '../../../packages/kernel/src/lib/internals/subject-restoration-claims';
import { hasOpenCommitScope } from '../../../packages/kernel/src/lib/internals/commit-consequence';
import { createDiagnosticJournal } from '../../../packages/kernel/src/lib/internals/diagnostics/diagnostic-journal';

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
const gc = () => {
  globalThis.gc?.();
  globalThis.gc?.();
  return process.memoryUsage().heapUsed;
};
const SCALE = 50_000;
type Counts = Record<string, number | null>;
// This shape describes only the runner's audited, virtual instrumentation.
function lens(runtime: object): Counts {
  const property = Object.getOwnPropertyDescriptor(
    runtime,
    '__l15Counts'
  )?.value;
  if (typeof property !== 'function')
    throw new Error('Missing count-only instrumentation');
  return property();
}
const make = () =>
  signalTree(
    { x: 0, y: 0, rows: entityMap<{ id: string; v: number }, string>() },
    { enhancers: [transactions()] }
  );
type Tree = ReturnType<typeof make>;
function sample(tree: Tree, phase: string) {
  const runtime = peekInternalTransactionRuntime(tree);
  if (!runtime) throw new Error('Missing actual transaction runtime');
  return {
    phase,
    heapUsedAfterGC: gc(),
    counts: lens(runtime),
    pending: runtime.getPendingTurnCount(),
    confirmed: runtime.getConfirmedTurnCount(),
    claims: getSubjectRestorationClaims(tree)?.snapshot() ?? null,
    openCommitScope: hasOpenCommitScope(tree),
  };
}
function requireThat(condition: boolean, message: string, findings: string[]) {
  if (!condition) findings.push(message);
}
function requireQuiet(
  observation: ReturnType<typeof sample>,
  findings: string[]
) {
  for (const key of [
    'pendingTurns',
    'pendingOpened',
    'dependencyEffects',
    'pendingCaptureBuckets',
    'pendingOrders',
    'captureEffects',
  ]) {
    requireThat(
      observation.counts[key] === 0,
      `${observation.phase}: ${key}=${observation.counts[key]}`,
      findings
    );
  }
  if (observation.counts.queuedBuckets !== null)
    requireThat(
      observation.counts.queuedBuckets === 0,
      `${observation.phase}: queued evidence survives`,
      findings
    );
  requireThat(
    !observation.openCommitScope,
    `${observation.phase}: commit scope open`,
    findings
  );
}

export async function runCase(id: string, diagnostics: boolean) {
  const findings: string[] = [];
  const samples: ReturnType<typeof sample>[] = [];
  const outcomes: unknown[] = [];
  const tree = make();
  const runtime = peekInternalTransactionRuntime(tree)!;
  const journal = diagnostics ? createDiagnosticJournal(tree) : undefined;
  const reader = confirmedTurnReader(tree);
  const take = (phase: string) => {
    const point = sample(tree, phase);
    samples.push(point);
    return point;
  };
  let diagnosticCount = 0;
  try {
    take('constructed-live');
    if (id === 'R01' || id === 'R02') {
      for (let i = 1; i <= SCALE; i++) {
        const pending = tree.transact(() => tree.$.x(i));
        if (id === 'R01') pending.confirm();
        else pending.rollback();
        await flush();
        if ([1, 1000, 10000, SCALE].includes(i)) take(`live-${i}`);
      }
      requireThat(
        tree.$.x() === (id === 'R01' ? SCALE : 0),
        'final scalar state differs',
        findings
      );
      requireThat(
        runtime.getConfirmedTurnCount() === (id === 'R01' ? SCALE : 0),
        'confirmed count differs',
        findings
      );
      requireQuiet(take('terminal-live'), findings);
      // Exercise the actual supported diagnostic reader, only after churn.
      diagnosticCount = reader?.readConfirmedTurns().turns.length ?? -1;
      requireThat(
        diagnosticCount === runtime.getConfirmedTurnCount(),
        'reader differs from retained record count',
        findings
      );
    } else if (id === 'R03') {
      tree.$.rows.addOne({ id: 'A', v: 0 });
      await flush();
      const pending = tree.transact(() => {
        tree.$.x(1);
        tree.$.rows.removeOne('A');
      });
      external(() => tree.$.rows.addOne({ id: 'A', v: 2 }));
      await flush();
      const before = take('before-refusal');
      let refusals = 0;
      for (let i = 0; i < 1000; i++) {
        try {
          pending.rollback();
        } catch {
          refusals++;
        }
        await flush();
      }
      const after = take('after-1000-refusals');
      requireThat(
        refusals === 1000,
        `expected1000 refusals, got${refusals}`,
        findings
      );
      requireThat(
        JSON.stringify(before.counts) === JSON.stringify(after.counts),
        'refused attempts change retained counts',
        findings
      );
      requireThat(
        tree.$.x() === 1 && tree.$.rows.byIdOrFail('A')().v === 2,
        'refusal changed state',
        findings
      );
      requireThat(
        runtime.getPendingTurnCount() === 1,
        'refusal lost pending authority',
        findings
      );
      external(() => tree.$.rows.removeOne('A'));
      await flush();
      try {
        pending.rollback();
        outcomes.push('retry-restored');
      } catch (error) {
        outcomes.push(String(error));
        findings.push('retry after conflict removal failed');
      }
      await flush();
      requireThat(
        tree.$.x() === 0 && tree.$.rows.byIdOrFail('A')().v === 0,
        'retry did not restore baseline',
        findings
      );
      requireQuiet(take('after-retry'), findings);
    } else if (id === 'R04') {
      const older = tree.transact(() => tree.$.x(1));
      for (let i = 2; i <= SCALE + 1; i++) {
        tree.transact(() => tree.$.x(i)).confirm();
        await flush();
        if ([2, 1001, 10001, SCALE + 1].includes(i))
          take(`one-pending-${i - 1}-accepted`);
      }
      const live = take('oldest-pending-live');
      requireThat(
        runtime.getPendingTurnCount() === 1,
        'accepted terminal turns remain active',
        findings
      );
      if (live.counts.inspectionFootprints !== null)
        requireThat(
          live.counts.inspectionFootprints === 2 &&
            live.counts.inspectionWriters === 2,
          'same-field inspection evidence did not compact to two contributors',
          findings
        );
      older.rollback();
      await flush();
      requireThat(
        tree.$.x() === SCALE + 1,
        'older rollback removed newer authority',
        findings
      );
      requireQuiet(take('older-settled-live'), findings);
    } else if (id === 'R05') {
      tree.$.rows.addOne({ id: 'A', v: 0 });
      await flush();
      const pending = tree.transact(() => {
        tree.$.rows.removeOne('A');
        tree.$.x(1);
      });
      external(() => tree.$.y(2));
      await flush();
      take('pending-before-destroy');
      tree.destroy();
      await flush();
      requireQuiet(take('destroyed-with-runtime-and-handle-held'), findings);
      let settledAfterDestroy = false;
      try {
        pending.confirm();
        settledAfterDestroy = true;
      } catch {
        outcomes.push('confirm-after-destroy-refused');
      }
      requireThat(!settledAfterDestroy, 'confirmed after destroy', findings);
      requireThat(
        getSubjectRestorationClaims(tree)?.snapshot().owners === 0,
        'destroy retained restoration claims',
        findings
      );
      let readable = false;
      try {
        reader?.readConfirmedTurns();
        readable = true;
      } catch {
        outcomes.push('reader-after-destroy-refused');
      }
      requireThat(!readable, 'reader still usable after destroy', findings);
    } else if (id === 'R06') {
      const earlier = tree.transact(() => tree.$.x(1));
      tree.transact(() => tree.$.x(2)).confirm();
      await flush();
      earlier.rollback();
      await flush();
      outcomes.push({
        name: 'newer-confirmed',
        value: tree.$.x(),
        pending: runtime.getPendingTurnCount(),
      });
      const realized = tree.transact(() => tree.$.y(1));
      external(() => tree.$.y(2));
      external(() => tree.$.y(1));
      try {
        realized.rollback();
        outcomes.push({
          name: 'realized-ABA',
          result: 'settled',
          value: tree.$.y(),
        });
      } catch {
        outcomes.push({
          name: 'realized-ABA',
          result: 'refused',
          value: tree.$.y(),
        });
        realized.confirm();
      }
      await flush();
      tree.$.rows.addOne({ id: 'A', v: 0 });
      await flush();
      const conflict = tree.transact(() => tree.$.rows.removeOne('A'));
      external(() => tree.$.rows.addOne({ id: 'A', v: 2 }));
      await flush();
      let refused = false;
      try {
        conflict.rollback();
      } catch {
        refused = true;
      }
      outcomes.push({
        name: 'occupied-identity',
        refused,
        value: tree.$.rows.byIdOrFail('A')().v,
        pending: runtime.getPendingTurnCount(),
      });
      take('diagnostic-comparison-live');
    } else {
      throw new Error(`Unregistered frozen case ${id}`);
    }
    const diagnosticJournal = journal
      ? {
          turns: journal.turns().length,
          events: journal.transactionEvents().length,
        }
      : null;
    if (!tree.destroyed()) tree.destroy();
    await flush();
    const afterDestroy = take('after-destroy');
    return {
      id,
      diagnostics,
      status: findings.length ? 'violated' : 'held',
      findings,
      samples,
      outcomes,
      diagnosticReaderCount: diagnosticCount,
      diagnosticJournal,
      afterDestroy,
      scope:
        'Record counts and fresh-process live heap; no cap verdict or complete heap reachability proof.',
    };
  } finally {
    journal?.dispose();
    if (!tree.destroyed()) tree.destroy();
    getPathNotifier().flushSync();
  }
}
