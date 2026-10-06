import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { SignalTreeRollbackError } from '../../lib/types';
import { undoable } from '../../lib/undoable';
import { withWriteContext } from '../../lib/write-context';
import { restoration } from '../restoration/restoration';
import { transactions } from './transactions';

/**
 * A pending RENAME vacates its original key. Later work that put a DIFFERENT
 * row at that key depended on the rename having happened, so "the rename never
 * ran" is not a consistent counterfactual: rolling it back refuses as a
 * dependency (`later-confirmed-dependency`, or `later-pending-dependency`
 * while the re-occupying work is unsettled), even after the re-occupier was
 * removed again, because its own history still names the key.
 *
 * Found by the re-review of 23b750f0: the rollback was accepted (the renamed
 * row was gone, REKEY-SUPERSESSION-0), and the rejection rebase then wrote the
 * rename's original key back into a later removal, so two lifetimes held key
 * 'a' in history: getRestorationHistory() threw "duplicate keys" and undo
 * refused for good. On 15.4.3 the same rollback was accepted silently.
 *
 * While the renamed row and the occupier both still stand, this refused
 * through 15.4.3 too, as `effect-validation-failed` (the compensating rename
 * failed validation); it is now the planner's dependency refusal, before any
 * compensation is tried (restoration.spec.ts pins the new kind).
 *
 * A pending REMOVE vacates its key the same way (rollback/rebase review,
 * item 2): accepted when the re-occupier had been removed again, history
 * then threw "duplicate keys" / structural drift for good; while the occupier
 * stood it refused as `effect-validation-failed`. Both are the dependency
 * now (the second describe below; proposal-rejection-0 case 15 and the
 * refusal-lifecycle gate's `replacement` cases carry the kind change).
 */
type Row = { id: string; n: number };
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const declaration = () => ({
  x: 0,
  rows: entityMap<Row, string>({ selectId: (row) => row.id }),
});
const typed = () =>
  signalTree(declaration(), { enhancers: [transactions(), restoration()] });
type Tree = ReturnType<typeof typed>;

const configurations = [
  ['transactions()', () => [transactions()], false],
  [
    'transactions(), restoration()',
    () => [transactions(), restoration()],
    true,
  ],
  [
    'restoration(), transactions()',
    () => [restoration(), transactions()],
    true,
  ],
] as const;

const refusalKind = (run: () => void): string | undefined => {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(SignalTreeRollbackError);
    return (error as { cause?: { kind?: string } }).cause?.kind;
  }
  return undefined;
};
const state = (tree: Tree) => ({ x: tree.$.x(), rows: tree.$.rows.all() });

const reoccupying: Record<string, Array<(tree: Tree) => void>> = {
  'a new row at the old key, then the renamed row removed': [
    (tree) => tree.$.rows.addOne({ id: 'a', n: 50 }),
    (tree) => tree.$.rows.removeOne('a2'),
  ],
  'a new row at the old key, then both rows removed': [
    (tree) => tree.$.rows.addOne({ id: 'a', n: 50 }),
    (tree) => tree.$.rows.removeMany(['a2', 'a']),
  ],
  'a new row at the old key, removed again, then the renamed row removed': [
    (tree) => tree.$.rows.addOne({ id: 'a', n: 50 }),
    (tree) => tree.$.rows.removeOne('a'),
    (tree) => tree.$.rows.removeOne('a2'),
  ],
  'another row renamed onto the old key, then the renamed row removed': [
    (tree) => tree.$.rows.changeId('z', 'a'),
    (tree) => tree.$.rows.removeOne('a2'),
  ],
  'a new row at the old key while the renamed row stays': [
    (tree) => tree.$.rows.addOne({ id: 'a', n: 50 }),
  ],
};

describe.each(configurations)(
  'rollback of a rename whose old key later work re-occupied (%s)',
  (_name, enhancers, withHistory) => {
    const make = (): Tree => {
      const tree = signalTree(declaration(), {
        enhancers: enhancers() as never,
      }) as unknown as Tree;
      tree.$.rows.addOne({ id: 'z', n: 0 });
      tree.$.rows.addOne({ id: 'a', n: 1 });
      return tree;
    };
    const later = (tree: Tree, write: (tree: Tree) => void) => {
      if (withHistory) undoable(() => write(tree));
      else write(tree);
    };

    it.each(Object.keys(reoccupying))(
      '%s: refuses as a settled dependency and changes nothing',
      async (shape) => {
        const tree = make();
        try {
          await flush();
          const proposal = tree.transaction(() => {
            tree.$.x(1);
            tree.$.rows.changeId('a', 'a2');
          });
          await flush();
          for (const write of reoccupying[shape]) {
            later(tree, write);
            await flush();
          }
          const before = state(tree);
          expect(refusalKind(() => proposal.rollback())).toBe(
            'later-confirmed-dependency'
          );
          await flush();
          expect(state(tree)).toStrictEqual(before);
          if (withHistory) {
            const history = tree.getRestorationHistory();
            expect(history).toHaveLength(reoccupying[shape].length);
          }
        } finally {
          tree.destroy();
        }
      }
    );

    it('refuses as a pending dependency while the re-occupier is unsettled', async () => {
      const tree = make();
      try {
        await flush();
        const proposal = tree.transaction(() => {
          tree.$.x(1);
          tree.$.rows.changeId('a', 'a2');
        });
        await flush();
        const occupier = tree.transaction(() =>
          tree.$.rows.addOne({ id: 'a', n: 50 })
        );
        await flush();
        expect(refusalKind(() => proposal.rollback())).toBe(
          'later-pending-dependency'
        );
        occupier.confirm();
        await flush();
        expect(refusalKind(() => proposal.rollback())).toBe(
          'later-confirmed-dependency'
        );
        expect(tree.$.x()).toBe(1);
      } finally {
        tree.destroy();
      }
    });

    it('control: a new row at a DIFFERENT key does not block the rollback', async () => {
      const tree = make();
      try {
        await flush();
        const proposal = tree.transaction(() => {
          tree.$.x(1);
          tree.$.rows.changeId('a', 'a2');
        });
        await flush();
        later(tree, (t) => t.$.rows.addOne({ id: 'b', n: 50 }));
        await flush();
        later(tree, (t) => t.$.rows.removeOne('a2'));
        await flush();
        expect(refusalKind(() => proposal.rollback())).toBeUndefined();
        await flush();
        expect(state(tree)).toStrictEqual({
          x: 0,
          rows: [
            { id: 'z', n: 0 },
            { id: 'b', n: 50 },
          ],
        });
        if (withHistory) {
          expect(tree.getRestorationHistory()).toHaveLength(2);
          tree.undo();
          await flush();
          // Undo of the removal brings the row back under its ORIGINAL key:
          // the rename never happened.
          expect(tree.$.rows.all()).toStrictEqual([
            { id: 'z', n: 0 },
            { id: 'a', n: 1 },
            { id: 'b', n: 50 },
          ]);
        }
      } finally {
        tree.destroy();
      }
    });

    it('a rename chain over the new key is accepted and history stays usable', async () => {
      const tree = make();
      try {
        await flush();
        const proposal = tree.transaction(() => {
          tree.$.x(1);
          tree.$.rows.changeId('a', 'a2');
        });
        await flush();
        later(tree, (t) => t.$.rows.changeId('a2', 'a3'));
        await flush();
        later(tree, (t) => t.$.rows.removeOne('a3'));
        await flush();
        expect(refusalKind(() => proposal.rollback())).toBeUndefined();
        await flush();
        expect(state(tree)).toStrictEqual({ x: 0, rows: [{ id: 'z', n: 0 }] });
        if (withHistory) {
          expect(tree.getRestorationHistory()).toHaveLength(2);
          tree.undo();
          await flush();
          tree.undo();
          await flush();
          expect(tree.$.rows.all()).toStrictEqual([
            { id: 'z', n: 0 },
            { id: 'a', n: 1 },
          ]);
        }
      } finally {
        tree.destroy();
      }
    });
  }
);

const removalReoccupying: Record<string, Array<(tree: Tree) => void>> = {
  'a new row at the removed key, removed again (the review shape)': [
    (tree) => tree.$.rows.addOne({ id: 'a', n: 50 }),
    (tree) => tree.$.rows.removeOne('a'),
  ],
  'a new row at the removed key that stands': [
    (tree) => tree.$.rows.addOne({ id: 'a', n: 50 }),
  ],
  'another row renamed onto the removed key': [
    (tree) => tree.$.rows.changeId('z', 'a'),
  ],
};

describe.each(configurations)(
  'rollback of a removal whose key later work re-occupied (%s)',
  (_name, enhancers, withHistory) => {
    const make = (): Tree => {
      const tree = signalTree(declaration(), {
        enhancers: enhancers() as never,
      }) as unknown as Tree;
      tree.$.rows.addOne({ id: 'z', n: 0 });
      tree.$.rows.addOne({ id: 'a', n: 1 });
      return tree;
    };
    const later = (tree: Tree, write: (tree: Tree) => void) => {
      if (withHistory) undoable(() => write(tree));
      else write(tree);
    };

    it.each(Object.keys(removalReoccupying))(
      '%s: refuses as a settled dependency, changes nothing, history and undo stay usable',
      async (shape) => {
        const tree = make();
        try {
          await flush();
          const proposal = tree.transaction(() => {
            tree.$.x(1);
            tree.$.rows.removeOne('a');
          });
          await flush();
          for (const write of removalReoccupying[shape]) {
            later(tree, write);
            await flush();
          }
          const before = state(tree);
          expect(refusalKind(() => proposal.rollback())).toBe(
            'later-confirmed-dependency'
          );
          await flush();
          expect(state(tree)).toStrictEqual(before);
          if (withHistory) {
            expect(() => tree.getRestorationHistory()).not.toThrow();
            proposal.confirm();
            await flush();
            for (let at = 0; at < removalReoccupying[shape].length; at++) {
              tree.undo();
              await flush();
              expect(() => tree.getRestorationHistory()).not.toThrow();
            }
            expect(tree.$.rows.ids()).toStrictEqual(['z']);
          }
        } finally {
          tree.destroy();
        }
      }
    );

    it('refuses as a pending dependency while the re-occupier is unsettled', async () => {
      const tree = make();
      try {
        await flush();
        const proposal = tree.transaction(() => {
          tree.$.x(1);
          tree.$.rows.removeOne('a');
        });
        await flush();
        const occupier = tree.transaction(() =>
          tree.$.rows.addOne({ id: 'a', n: 50 })
        );
        await flush();
        expect(refusalKind(() => proposal.rollback())).toBe(
          'later-pending-dependency'
        );
        occupier.rollback();
        await flush();
        proposal.rollback();
        await flush();
        expect(state(tree)).toStrictEqual({
          x: 0,
          rows: [
            { id: 'z', n: 0 },
            { id: 'a', n: 1 },
          ],
        });
      } finally {
        tree.destroy();
      }
    });
  }
);

// Rollback/rebase review, item 7: authored work composes per turn, and a
// turn that adds a row at the vacated key and removes it again records
// nothing there, so the rollback was accepted; the same writes realized were
// judged write by write and refused. Observed work now composes per flush
// the same way. Writes in separate flushes, or a re-add left standing, still
// refuse whoever wrote them.
const withinFlush: Record<string, { writes: string; refused: boolean }> = {
  'added and removed again in one flush': { writes: '+-', refused: false },
  'added, removed and added again in one flush': {
    writes: '+-+',
    refused: true,
  },
  'added, then removed in the next flush': { writes: '+|-', refused: true },
};
const pendingVacating = {
  rename: (tree: Tree) => tree.$.rows.changeId('a', 'a2'),
  removal: (tree: Tree) => tree.$.rows.removeOne('a'),
};
const writers = {
  authored: (write: () => void) => write(),
  realized: (write: () => void) =>
    withWriteContext({ intent: 'system', participation: 'realized' }, write),
};

describe.each(configurations)(
  're-occupation within one flush, authored or realized (%s)',
  (_name, enhancers, withHistory) => {
    for (const [pendingName, vacate] of Object.entries(pendingVacating)) {
      for (const [shape, { writes, refused }] of Object.entries(withinFlush)) {
        it.each(Object.keys(writers))(
          `a pending ${pendingName}, the key ${shape} (%s): ${
            refused ? 'refused' : 'rolled back'
          }`,
          async (writerName) => {
            const writer = writers[writerName as keyof typeof writers];
            const tree = signalTree(declaration(), {
              enhancers: enhancers() as never,
            }) as unknown as Tree;
            try {
              tree.$.rows.addOne({ id: 'z', n: 0 });
              tree.$.rows.addOne({ id: 'a', n: 1 });
              await flush();
              const proposal = tree.transaction(() => {
                tree.$.x(1);
                vacate(tree);
              });
              await flush();
              let added = 50;
              for (const step of writes) {
                if (step === '|') await flush();
                else if (step === '+') {
                  const n = added++;
                  writer(() => tree.$.rows.addOne({ id: 'a', n }));
                } else writer(() => tree.$.rows.removeOne('a'));
              }
              await flush();
              const before = state(tree);
              expect(refusalKind(() => proposal.rollback())).toBe(
                refused ? 'later-confirmed-dependency' : undefined
              );
              await flush();
              expect(state(tree)).toStrictEqual(
                refused
                  ? before
                  : {
                      x: 0,
                      rows: [
                        { id: 'z', n: 0 },
                        { id: 'a', n: 1 },
                      ],
                    }
              );
              if (withHistory) {
                expect(() => tree.getRestorationHistory()).not.toThrow();
              }
            } finally {
              tree.destroy();
            }
          }
        );
      }
    }

    // Lifetimes are numbered per collection: a removal in ANOTHER collection
    // with the re-occupier's number is not its removal.
    it('a realized removal in another collection does not cancel the re-occupier', async () => {
      const tree = signalTree(
        {
          ...declaration(),
          other: entityMap<Row, string>({ selectId: (row) => row.id }),
        },
        { enhancers: enhancers() as never }
      );
      try {
        tree.$.rows.addOne({ id: 'z', n: 0 });
        tree.$.rows.addOne({ id: 'a', n: 1 });
        for (const id of ['p', 'q', 'r']) tree.$.other.addOne({ id, n: 0 });
        await flush();
        const proposal = tree.transaction(() => {
          tree.$.x(1);
          tree.$.rows.changeId('a', 'a2');
        });
        await flush();
        // The new row is the third lifetime in rows, 'r' the third in other.
        writers.realized(() => {
          tree.$.rows.addOne({ id: 'a', n: 50 });
          tree.$.other.removeOne('r');
        });
        await flush();
        expect(refusalKind(() => proposal.rollback())).toBe(
          'later-confirmed-dependency'
        );
      } finally {
        tree.destroy();
      }
    });
  }
);

// Rollback/rebase review, item 9 (history reads never throw): with the rows
// added by an undoable entry BEFORE the transaction opened, the history walk
// re-derives that entry against the live rows, where the open transaction has
// renamed or removed its row (and later work re-occupied the key). That add
// is contradicted by the open transaction, whose effects every history state
// shows; a read skips it rather than throwing "Subject 2 is not at its
// expected source key" / "is not active". The states are exact.
const laterAtKey: Record<string, Array<(tree: Tree) => void>> = {
  'a new row that stands': [(tree) => tree.$.rows.addOne({ id: 'a', n: 50 })],
  'a new row removed again': [
    (tree) => tree.$.rows.addOne({ id: 'a', n: 50 }),
    (tree) => tree.$.rows.removeOne('a'),
  ],
  'a second new row after that': [
    (tree) => tree.$.rows.addOne({ id: 'a', n: 50 }),
    (tree) => tree.$.rows.removeOne('a'),
    (tree) => tree.$.rows.addOne({ id: 'a', n: 60 }),
  ],
};
describe.each(configurations.filter(([, , withHistory]) => withHistory))(
  'history across an open transaction that vacated a key (%s)',
  (_name, enhancers) => {
    for (const [pendingName, vacate] of Object.entries(pendingVacating)) {
      it.each(Object.keys(laterAtKey))(
        `a pending ${pendingName}, then %s: history reads, exactly`,
        async (shape) => {
          const tree = signalTree(declaration(), {
            enhancers: enhancers() as never,
          }) as unknown as Tree;
          try {
            undoable(() => {
              tree.$.rows.addOne({ id: 'z', n: 0 });
              tree.$.rows.addOne({ id: 'a', n: 1 });
            });
            await flush();
            const proposal = tree.transaction(() => {
              tree.$.x(1);
              vacate(tree);
            });
            await flush();
            for (const write of laterAtKey[shape]) {
              undoable(() => write(tree));
              await flush();
            }
            expect(refusalKind(() => proposal.rollback())).toBe(
              'later-confirmed-dependency'
            );
            const kept = pendingName === 'rename' ? [0, 1] : [0];
            const after = laterAtKey[shape].map((_, at) =>
              at % 2 === 0 ? [...kept, at === 0 ? 50 : 60] : kept
            );
            expect(
              tree.getRestorationHistory().map((entry) => {
                const state = entry.state as unknown as {
                  x: number;
                  rows: { all: Row[] };
                };
                return [state.x, state.rows.all.map((row) => row.n)];
              })
            ).toStrictEqual([kept, ...after].map((ns) => [1, ns]));
          } finally {
            tree.destroy();
          }
        }
      );
    }
  }
);
