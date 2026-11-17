import { expect, it, vi } from 'vitest';

import { entityMap, signalTree, transactions } from '../index';
import { getEntityOrdinaryChanges } from './internals/entity-value-transition';
import { getPathNotifier } from './path-notifier';

type Row = { id: string; n: number };
type IndexWrite = { kind: string; subject: number; index: number };

// Observe actual Map writes rather than trusting a production work counter.
// This synchronous fixture uses plain internal mutation keys, never user proxies.
function countMutationIndexes<T>(work: () => T) {
  const writes: IndexWrite[] = [];
  const originalSet = Map.prototype.set;
  const spy = vi
    .spyOn(Map.prototype, 'set')
    .mockImplementation(function (
      this: Map<unknown, unknown>,
      key: unknown,
      value: unknown
    ) {
      if (
        key !== null &&
        typeof key === 'object' &&
        'kind' in key &&
        typeof key.kind === 'string' &&
        'subjectId' in key &&
        typeof key.subjectId === 'number' &&
        typeof value === 'number'
      ) {
        writes.push({ kind: key.kind, subject: key.subjectId, index: value });
      }
      return originalSet.call(this, key, value);
    });
  try {
    new Map<unknown, unknown>().set(
      { kind: 'create-fresh-subject', subjectId: -1 },
      0
    );
    expect(writes).toEqual([
      { kind: 'create-fresh-subject', subject: -1, index: 0 },
    ]);
    writes.length = 0;
    return { value: work(), writes };
  } finally {
    spy.mockRestore();
  }
}

it('fresh population installs every row without indexing non-replacement mutations', () => {
  const tree = signalTree({ rows: entityMap<Row, string>() });
  const input = Array.from({ length: 32 }, (_, n) => ({ id: `r${n}`, n }));
  try {
    const measured = countMutationIndexes(() => tree.$.rows.setAll(input));
    expect(tree.$.rows.all()).toEqual(input);
    expect(tree.$.rows.ids()).toEqual(input.map((row) => row.id));
    expect(tree.$.rows.count()).toBe(32);
    expect(measured.writes).toEqual([]);
  } finally {
    tree.destroy();
    getPathNotifier().flushSync();
  }
});

it('repeated replacement steps retain their own indexes and ordinary before-images', () => {
  const tree = signalTree(
    { rows: entityMap<Row, string>() },
    { enhancers: [transactions()] }
  );
  const notifier = getPathNotifier();
  const delivered = new Map<
    string,
    Array<[number | undefined, number | undefined]>
  >();
  let stop = () => undefined as void;
  let stopIntercept = () => undefined as void;
  try {
    tree.$.rows.setAll([
      { id: 'a', n: 10 },
      { id: 'b', n: 20 },
    ]);
    notifier.flushSync();
    const a = tree.$.rows.byIdOrFail('a');
    let ordinal = 0;
    stopIntercept = tree.$.rows.intercept({
      onUpdate(_id, changes, context) {
        context.transform({ ...changes, n: ++ordinal });
      },
    });
    stop = notifier.subscribe(
      'rows.*',
      (_next, _previous, path, _base, _origin, _subjects, _positions, meta) => {
        const changes = getEntityOrdinaryChanges(meta);
        if (!changes) return;
        delivered.set(
          path,
          changes.map((change) => [
            (change.before as Row | undefined)?.n,
            (change.after as Row | undefined)?.n,
          ])
        );
      }
    );
    const measured = countMutationIndexes(() =>
      tree.transact(() => {
        tree.$.rows.updateMany(['a', 'b', 'a'], { n: 99 });
      })
    );
    expect(measured.writes.map(({ kind, index }) => [kind, index])).toEqual([
      ['replace-value', 0],
      ['replace-value', 1],
      ['replace-value', 2],
    ]);
    expect(measured.writes[0].subject).toBe(measured.writes[2].subject);
    expect(measured.writes[0].subject).not.toBe(measured.writes[1].subject);
    notifier.flushSync();
    expect(tree.$.rows.all()).toEqual([
      { id: 'a', n: 3 },
      { id: 'b', n: 2 },
    ]);
    expect(delivered.get('rows.a')).toEqual([
      [10, 1],
      [1, 3],
    ]);
    expect(delivered.get('rows.b')).toEqual([[20, 2]]);
    stopIntercept();
    measured.value.rollback();
    notifier.flushSync();
    expect(tree.$.rows.all()).toEqual([
      { id: 'a', n: 10 },
      { id: 'b', n: 20 },
    ]);
    expect(tree.$.rows.byIdOrFail('a')).toBe(a);
  } finally {
    stop();
    stopIntercept();
    tree.destroy();
    notifier.flushSync();
  }
});
