import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { restorationReader } from '../../lib/internals/restoration-reader';
import { SignalTreeRollbackError } from '../../lib/types';
import { undoable } from '../../lib/undoable';
import { transactions } from '../transactions/transactions';
import { restoration } from './restoration';

/**
 * An ordinary later write (authored, not undoable) does not remove a turn's
 * undo eligibility, and undo restores the turn's pre-image (15.4.2): over a
 * scalar, `undoable(x(1)); x(2); undo()` gives 0 and redo gives 1.
 *
 * For a row the turn ADDED, the pre-image is "this lifetime absent". When an
 * ordinary later write already removed it, that holds, so undo leaves the row
 * as it is and reverses the rest of the turn. It threw instead, untyped,
 * "Unsupported scoped undo effect at structural-drift" (identical on 15.4.3;
 * a refused rollback then confirm reaches it too): the removal it planned
 * found no such row.
 *
 * Redo re-applies the turn's after-image, as over a scalar: it adds the row
 * back as the turn recorded it.
 *
 * (i) For a field EDIT to a row an ordinary write then removed, the pre-image
 * is the row present with the edited fields as they were: undo re-adds the
 * row as it stood when removed (ordinary edits to other fields kept) with this
 * turn's fields set back, placed by the removal's recorded anchors, else the
 * nearest surviving neighbour; redo applies the edit again. Owner decision
 * (the scalar rule, and v16's 8b plain-branch omission). It threw the same
 * untyped structural-drift.
 *
 * (ii) A reversal that would put this turn's row back at a key a NEWER
 * lifetime holds (an ordinary write re-occupied it) would displace an
 * unrelated row, as a rollback refuses to: undo or redo refuses with a typed
 * ST1034 restoration refusal naming the collection, the key and the newer
 * row, and changes nothing. Owner decision; da335eb6 had left the newer row
 * and skipped the redo instead.
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
  ['restoration()', () => [restoration()], false],
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

const read = (tree: Tree) =>
  `x=${tree.$.x()} ${tree.$.rows
    .all()
    .map((row) => `${row.id}${row.n}`)
    .join(',')}`;

type Shape = {
  turn: (tree: Tree) => void;
  later: (tree: Tree) => void;
  /** Live state after the later work, after undo, after redo, after undo. */
  states: [string, string, string, string];
};
const shapes: Record<string, Shape> = {
  'an added row, removed by an ordinary write (the review shape)': {
    turn: (tree) => tree.$.rows.addOne({ id: 'a', n: 1 }),
    later: (tree) => tree.$.rows.removeOne('a'),
    states: ['x=0 b2', 'x=0 b2', 'x=0 b2,a1', 'x=0 b2'],
  },
  'an added row and a scalar, the row removed by an ordinary write': {
    turn: (tree) => {
      tree.$.rows.addOne({ id: 'a', n: 1 });
      tree.$.x(1);
    },
    later: (tree) => tree.$.rows.removeOne('a'),
    states: ['x=1 b2', 'x=0 b2', 'x=1 b2,a1', 'x=0 b2'],
  },
  'two added rows, one removed by an ordinary write': {
    turn: (tree) =>
      tree.$.rows.addMany([
        { id: 'a', n: 1 },
        { id: 'c', n: 3 },
      ]),
    later: (tree) => tree.$.rows.removeOne('a'),
    states: ['x=0 b2,c3', 'x=0 b2', 'x=0 b2,a1,c3', 'x=0 b2'],
  },
  'a prepended row (an order change), removed by an ordinary write': {
    turn: (tree) => tree.$.rows.prependOne({ id: 'a', n: 1 }),
    later: (tree) => tree.$.rows.removeOne('a'),
    states: ['x=0 b2', 'x=0 b2', 'x=0 a1,b2', 'x=0 b2'],
  },
  'an added row edited, then removed, by ordinary writes': {
    turn: (tree) => {
      tree.$.rows.addOne({ id: 'a', n: 1 });
      tree.$.x(1);
    },
    later: (tree) => {
      tree.$.rows.updateOne('a', { n: 4 });
      tree.$.rows.removeOne('a');
    },
    states: ['x=1 b2', 'x=0 b2', 'x=1 b2,a1', 'x=0 b2'],
  },
  'an added row written again in the same turn, removed by an ordinary write': {
    turn: (tree) => {
      tree.$.rows.addOne({ id: 'a', n: 1 });
      tree.$.rows.updateOne('a', { n: 3 });
      tree.$.x(1);
    },
    later: (tree) => tree.$.rows.removeOne('a'),
    states: ['x=1 b2', 'x=0 b2', 'x=1 b2,a3', 'x=0 b2'],
  },
};

describe.each(configurations)(
  'undo of a turn whose added row an ordinary later write removed (%s)',
  (_name, enhancers) => {
    it.each(Object.keys(shapes))('%s', async (name) => {
      const shape = shapes[name];
      const tree = signalTree(declaration(), {
        enhancers: enhancers() as never,
      }) as unknown as Tree;
      try {
        tree.$.rows.addMany([{ id: 'b', n: 2 }]);
        await flush();
        undoable(() => shape.turn(tree));
        await flush();
        shape.later(tree);
        await flush();
        const seen = [read(tree)];
        tree.undo();
        await flush();
        expect(() => tree.getRestorationHistory()).not.toThrow();
        seen.push(read(tree));
        expect(tree.canUndo()).toBe(false);
        tree.redo();
        await flush();
        seen.push(read(tree));
        tree.undo();
        await flush();
        seen.push(read(tree));
        expect(seen).toStrictEqual(shape.states);
      } finally {
        tree.destroy();
      }
    });
  }
);

describe.each(
  configurations.filter(([, , withTransactions]) => withTransactions)
)(
  'a refused rollback, then confirm, then an ordinary removal (%s)',
  (_name, enhancers) => {
    it('undo reverses the rest of the turn; redo adds the row back', async () => {
      const tree = signalTree(declaration(), {
        enhancers: enhancers() as never,
      }) as unknown as Tree;
      try {
        tree.$.rows.addMany([{ id: 'b', n: 2 }]);
        await flush();
        const pending = tree.transaction(() =>
          undoable(() => {
            tree.$.rows.addOne({ id: 'a', n: 1 });
            tree.$.x(1);
          })
        );
        await flush();
        // Later work edits the created row and keeps it: a dependency.
        tree.$.rows.updateOne('a', { n: 2 });
        await flush();
        expect(() => pending.rollback()).toThrow(SignalTreeRollbackError);
        pending.confirm();
        await flush();
        tree.$.rows.removeOne('a');
        await flush();
        expect(read(tree)).toBe('x=1 b2');
        tree.undo();
        await flush();
        expect(read(tree)).toBe('x=0 b2');
        expect(() => tree.getRestorationHistory()).not.toThrow();
        tree.redo();
        await flush();
        expect(read(tree)).toBe('x=1 b2,a1');
      } finally {
        tree.destroy();
      }
    });
  }
);

type Edited = { id: string; n: number; m: number };
const editedDeclaration = () => ({
  rows: entityMap<Edited, string>({ selectId: (row) => row.id }),
});
const typedEdited = () =>
  signalTree(editedDeclaration(), {
    enhancers: [transactions(), restoration()],
  });
type EditedTree = ReturnType<typeof typedEdited>;
const readEdited = (tree: EditedTree) =>
  tree.$.rows
    .all()
    .map((row) => `${row.id}${row.n}.${row.m}`)
    .join(',');
const row = (id: string, n: number) => ({ id, n, m: n });

type EditedShape = {
  seed: string[];
  later: (tree: EditedTree) => void;
  /** After the later work, after undo, after redo, after undo. */
  states: [string, string, string, string];
};
const edited: Record<string, EditedShape> = {
  'another field edited, then the row removed (the review shape)': {
    seed: ['z', 'a', 'c'],
    later: (tree) => {
      tree.$.rows.updateOne('a', { m: 7 });
      tree.$.rows.removeOne('a');
    },
    states: ['z0.0,c3.3', 'z0.0,a1.7,c3.3', 'z0.0,a5.7,c3.3', 'z0.0,a1.7,c3.3'],
  },
  'the same field edited, then the row removed': {
    seed: ['z', 'a', 'c'],
    later: (tree) => {
      tree.$.rows.updateOne('a', { n: 8 });
      tree.$.rows.removeOne('a');
    },
    // The pre-image wins over the ordinary write, as for a scalar.
    states: ['z0.0,c3.3', 'z0.0,a1.1,c3.3', 'z0.0,a5.1,c3.3', 'z0.0,a1.1,c3.3'],
  },
  'removed, then both its neighbours removed': {
    seed: ['z', 'y', 'a', 'c', 'd'],
    later: (tree) => {
      tree.$.rows.removeOne('a');
      tree.$.rows.removeOne('y');
      tree.$.rows.removeOne('c');
    },
    // Nearest surviving neighbours: z on the left (through y), d on the right
    // (through c).
    states: ['z0.0,d4.4', 'z0.0,a1.1,d4.4', 'z0.0,a5.1,d4.4', 'z0.0,a1.1,d4.4'],
  },
};

describe.each(configurations)(
  '(i) undo of a field edit to a row an ordinary write removed (%s)',
  (_name, enhancers) => {
    it.each(Object.keys(edited))('%s', async (name) => {
      const shape = edited[name];
      const tree = signalTree(editedDeclaration(), {
        enhancers: enhancers() as never,
      }) as unknown as EditedTree;
      try {
        const n = { z: 0, y: 0, a: 1, c: 3, d: 4 } as Record<string, number>;
        tree.$.rows.addMany(shape.seed.map((id) => row(id, n[id])));
        await flush();
        undoable(() => tree.$.rows.updateOne('a', { n: 5 }));
        await flush();
        shape.later(tree);
        await flush();
        const seen = [readEdited(tree)];
        for (const step of ['undo', 'redo', 'undo'] as const) {
          tree[step]();
          await flush();
          expect(() => tree.getRestorationHistory()).not.toThrow();
          seen.push(readEdited(tree));
        }
        expect(seen).toStrictEqual(shape.states);
      } finally {
        tree.destroy();
      }
    });

    it('redo after an ordinary removal re-adds the row and applies the edit', async () => {
      const tree = signalTree(editedDeclaration(), {
        enhancers: enhancers() as never,
      }) as unknown as EditedTree;
      try {
        tree.$.rows.addMany([row('z', 0), row('a', 1), row('c', 3)]);
        await flush();
        undoable(() => tree.$.rows.updateOne('a', { n: 5 }));
        await flush();
        tree.undo();
        await flush();
        tree.$.rows.updateOne('a', { m: 7 });
        tree.$.rows.removeOne('a');
        await flush();
        tree.redo();
        await flush();
        expect(readEdited(tree)).toBe('z0.0,a5.7,c3.3');
      } finally {
        tree.destroy();
      }
    });
  }
);

/** The typed refusal (ii): nothing changes, the reader reports `refused`. */
const expectNewerRowRefusal = async (
  tree: { getCurrentIndex(): number },
  read: () => string,
  step: () => void,
  operation: 'undo' | 'redo'
) => {
  const reader = restorationReader(tree as never)!;
  const events: { kind: string; operation?: string; outcome?: string }[] = [];
  const stop = reader.subscribe((event) => events.push(event as never));
  const before = read();
  const index = tree.getCurrentIndex();
  try {
    expect(step).toThrow(
      "ST1034: restoration refused — key 'a' of 'rows' is held by a newer row"
    );
    await flush();
    expect(read()).toBe(before);
    expect(tree.getCurrentIndex()).toBe(index);
    expect(
      events.filter(({ kind }) => kind === 'operation').at(-1)
    ).toMatchObject({
      operation,
      outcome: 'refused',
    });
  } finally {
    stop();
  }
};

describe.each(configurations)(
  '(ii) a reversal that would put a row back at a key a newer row holds (%s)',
  (_name, enhancers) => {
    it('undo of a removal: refuses, typed, and changes nothing', async () => {
      const tree = signalTree(editedDeclaration(), {
        enhancers: enhancers() as never,
      }) as unknown as EditedTree;
      try {
        tree.$.rows.addMany([row('z', 0), row('a', 1)]);
        await flush();
        undoable(() => tree.$.rows.removeOne('a'));
        await flush();
        tree.$.rows.addOne(row('a', 9));
        await flush();
        await expectNewerRowRefusal(
          tree,
          () => readEdited(tree),
          () => tree.undo(),
          'undo'
        );
        expect(tree.canUndo()).toBe(true);
        // Once the newer row is gone, the undo puts the row back.
        tree.$.rows.removeOne('a');
        await flush();
        tree.undo();
        await flush();
        expect(readEdited(tree)).toBe('z0.0,a1.1');
      } finally {
        tree.destroy();
      }
    });

    it('undo of a field edit whose key a newer row took: refuses, typed', async () => {
      const tree = signalTree(editedDeclaration(), {
        enhancers: enhancers() as never,
      }) as unknown as EditedTree;
      try {
        tree.$.rows.addMany([row('z', 0), row('a', 1)]);
        await flush();
        undoable(() => tree.$.rows.updateOne('a', { n: 5 }));
        await flush();
        tree.$.rows.removeOne('a');
        tree.$.rows.addOne(row('a', 9));
        await flush();
        await expectNewerRowRefusal(
          tree,
          () => readEdited(tree),
          () => tree.undo(),
          'undo'
        );
      } finally {
        tree.destroy();
      }
    });

    it('redo of an add whose key a newer row took: undo reverses the rest, redo refuses, typed', async () => {
      const tree = signalTree(declaration(), {
        enhancers: enhancers() as never,
      }) as unknown as Tree;
      try {
        tree.$.rows.addMany([{ id: 'b', n: 2 }]);
        await flush();
        undoable(() => {
          tree.$.rows.addOne({ id: 'a', n: 1 });
          tree.$.x(1);
        });
        await flush();
        tree.$.rows.removeOne('a');
        tree.$.rows.addOne({ id: 'a', n: 9 });
        await flush();
        tree.undo();
        await flush();
        expect(read(tree)).toBe('x=0 b2,a9');
        await expectNewerRowRefusal(
          tree,
          () => read(tree),
          () => tree.redo(),
          'redo'
        );
        expect(tree.canRedo()).toBe(true);
      } finally {
        tree.destroy();
      }
    });

    it('a newer row an undoable entry added is undone first in the same operation: no refusal', async () => {
      const tree = signalTree(editedDeclaration(), {
        enhancers: enhancers() as never,
      }) as unknown as EditedTree;
      try {
        undoable(() => tree.$.rows.addMany([row('z', 0), row('a', 1)]));
        await flush();
        undoable(() => tree.$.rows.removeOne('a'));
        await flush();
        undoable(() => tree.$.rows.addOne(row('a', 9)));
        await flush();
        // One operation undoes both: the newer row goes first.
        tree.jumpTo(0);
        await flush();
        expect(readEdited(tree)).toBe('z0.0,a1.1');
      } finally {
        tree.destroy();
      }
    });
  }
);
