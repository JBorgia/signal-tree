import { describe, expect, it } from 'vitest';
import { signalTree } from './signal-tree';
import { entityMap } from './markers/entity-map';
import { link } from './link';
import { restoration } from '../enhancers/restoration/restoration';
import { withWriteContext } from './write-context';
import {
  prepareDeclarativeTransitionInstallation,
  type CollectionTransitionTargetBinding,
} from './internals/causal-runtime/target-transition';
import { getMutationCaptureRuntime } from './internals/mutation-capture-runtime';
import { undoable } from './undoable';
import { transactions } from '../enhancers/transactions/transactions';

const drain = async () => {
  for (let i = 0; i < 16; i++) await Promise.resolve();
};
const initial = [
  { id: 'a', n: 0 },
  { id: 'b', n: 0 },
];
function fixture() {
  const tree = signalTree(
    { rows: entityMap<{ id: string; n: number }, string>() },
    { enhancers: [transactions()] }
  );
  tree.$.rows.addMany(initial);
  return tree;
}

describe('Link order publication after transaction rollback', () => {
  it.each([false, true])(
    'publishes restored order with forward delivery already drained=%s',
    async (delivered) => {
      const tree = fixture();
      const sent: string[][] = [];
      const connection = link(tree.$.rows, {
        set: (value) => {
          sent.push(value.map((row) => row.id));
        },
      });
      try {
        const pending = tree.transact(() =>
          tree.$.rows.setAll([...initial].reverse())
        );
        if (delivered) await drain();
        expect(sent).toEqual([]);
        pending.rollback();
        expect(tree.$.rows.ids()).toEqual(['a', 'b']);
        expect(tree.$.rows.all().map((row) => row.id)).toEqual(['a', 'b']);
        await connection.settled();
        expect(sent.length).toBeGreaterThan(0);
        expect(sent.every((order) => order.join() === 'a,b')).toBe(true);
      } finally {
        connection.dispose();
        tree.destroy();
      }
    }
  );

  it('confirms and publishes a useful order change', async () => {
    const tree = fixture();
    const sent: string[][] = [];
    const connection = link(tree.$.rows, {
      set: (value) => {
        sent.push(value.map((row) => row.id));
      },
    });
    try {
      const pending = tree.transact(() =>
        tree.$.rows.setAll([...initial].reverse())
      );
      await drain();
      expect(sent).toEqual([]);
      pending.confirm();
      await connection.settled();
      expect(sent).toEqual([['b', 'a']]);
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });

  it('does not send rejected order after an earlier endpoint request completes', async () => {
    const tree = fixture();
    const sent: string[][] = [];
    let finish!: () => void;
    const connection = link(tree.$.rows, {
      set: (value) => {
        sent.push(value.map((row) => row.id));
        if (sent.length === 1)
          return new Promise<void>((resolve) => {
            finish = resolve;
          });
      },
    });
    try {
      tree.$.rows.byIdOrFail('a').n(1);
      await drain();
      expect(sent).toEqual([['a', 'b']]);
      const pending = tree.transact(() =>
        tree.$.rows.setAll(
          [
            { id: 'b', n: 0 },
            { id: 'a', n: 1 },
          ]
        )
      );
      await drain();
      pending.rollback();
      finish();
      await connection.settled();
      expect(sent.every((order) => order.join() === 'a,b')).toBe(true);
    } finally {
      finish?.();
      connection.dispose();
      tree.destroy();
    }
  });

  it('preserves a newer order authored by the endpoint during restored delivery', async () => {
    const tree = fixture();
    const sent: string[][] = [];
    const connection = link(tree.$.rows, {
      set: (value) => {
        sent.push(value.map((row) => row.id));
        if (sent.length === 1)
          tree.$.rows.setAll([...initial].reverse());
      },
    });
    try {
      const pending = tree.transact(() =>
        tree.$.rows.setAll([...initial].reverse())
      );
      await drain();
      pending.rollback();
      await connection.settled();
      expect(sent).toEqual([
        ['a', 'b'],
        ['b', 'a'],
      ]);
      expect(tree.$.rows.ids()).toEqual(['b', 'a']);
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });
  it('sends restored order after an outdated confirmed payload already entered I/O', async () => {
    const tree = signalTree(
      { rows: entityMap<{ id: string; n: number }, string>() },
      { enhancers: [transactions(), restoration()] }
    );
    tree.$.rows.addMany(initial);
    const sent: string[][] = [];
    let finish!: () => void;
    const connection = link(tree.$.rows, {
      set: (value) => {
        sent.push(value.map((row) => row.id));
        if (sent.length === 1)
          return new Promise<void>((resolve) => {
            finish = resolve;
          });
      },
    });
    try {
      let pending!: ReturnType<typeof tree.transact>;
      undoable(() => {
        pending = tree.transact(() =>
          tree.$.rows.setAll([...initial].reverse())
        );
      });
      await drain();
      pending.confirm();
      await drain();
      expect(sent).toEqual([['b', 'a']]);
      tree.undo();
      expect(tree.$.rows.ids()).toEqual(['a', 'b']);
      finish();
      await connection.settled();
      expect(sent).toEqual([
        ['b', 'a'],
        ['a', 'b'],
      ]);
    } finally {
      finish?.();
      connection.dispose();
      tree.destroy();
    }
  });

  it('keeps newer order authored by another target callback during rollback', async () => {
    const tree = signalTree(
      {
        first: entityMap<{ id: string; n: number }, string>(),
        rows: entityMap<{ id: string; n: number }, string>(),
      },
      { enhancers: [transactions()] }
    );
    tree.$.first.addMany(initial);
    tree.$.rows.addMany(initial);
    const sent: string[][] = [];
    const connection = link(tree.$.rows, {
      set: (value) => {
        sent.push(value.map((row) => row.id));
      },
    });
    let armed = false;
    tree.$.first.tap({
      onUpdate: () => {
        if (armed) {
          armed = false;
          tree.$.rows.setAll([...initial].reverse());
        }
      },
    });
    try {
      const pending = tree.transact(() => {
        tree.$.first.setAll(
          [
            { id: 'b', n: 1 },
            { id: 'a', n: 0 },
          ]
        );
        tree.$.rows.setAll([...initial].reverse());
      });
      await drain();
      armed = true;
      pending.rollback();
      await connection.settled();
      expect(tree.$.rows.ids()).toEqual(['b', 'a']);
      expect(sent.length).toBeGreaterThan(0);
      expect(sent.at(-1)).toEqual(['b', 'a']);
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });

  it('publishes later target order even when earlier target delivery throws', async () => {
    const tree = signalTree(
      {
        first: entityMap<{ id: string; n: number }, string>(),
        rows: entityMap<{ id: string; n: number }, string>(),
      },
      { enhancers: [transactions()] }
    );
    tree.$.first.addMany(initial);
    tree.$.rows.addMany(initial);
    const sent: string[][] = [];
    const connection = link(tree.$.rows, {
      set: (value) => {
        sent.push(value.map((row) => row.id));
      },
    });
    let armed = false;
    tree.$.first.tap({
      onUpdate: () => {
        if (armed) {
          armed = false;
          throw new Error('target delivery failure');
        }
      },
    });
    try {
      const pending = tree.transact(() => {
        tree.$.first.setAll(
          [
            { id: 'b', n: 1 },
            { id: 'a', n: 0 },
          ]
        );
        tree.$.rows.setAll([...initial].reverse());
      });
      await drain();
      armed = true;
      expect(() => pending.rollback()).toThrow('target delivery failure');
      await connection.settled();
      expect(tree.$.rows.ids()).toEqual(['a', 'b']);
      expect(sent).toEqual([['a', 'b']]);
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });

  it('does not create order captures for a value-only rollback', () => {
    const tree = fixture();
    const captures: unknown[] = [];
    const runtime = getMutationCaptureRuntime(tree.$.rows)!;
    const release = runtime.activateCapture();
    const off = runtime.subscribeCollectionOrder!((capture) =>
      captures.push(capture)
    );
    try {
      const pending = tree.transact(() => tree.$.rows.byIdOrFail('a').n(1));
      pending.rollback();
      expect(captures).toEqual([]);
    } finally {
      off();
      release();
      tree.destroy();
    }
  });

  it('keeps prepared inspection order outside durable authority', async () => {
    const tree = signalTree(
      { rows: entityMap<{ id: string; n: number }, string>() },
      { enhancers: [transactions(), restoration()] }
    );
    tree.$.rows.addMany(initial);
    await drain();
    const sent: string[][] = [];
    const connection = link(tree.$.rows, {
      set: (value) => {
        sent.push(value.map((row) => row.id));
      },
    });
    try {
      const binding = (
        tree.$.rows as unknown as {
          __prepareTransitionTarget: CollectionTransitionTargetBinding;
        }
      ).__prepareTransitionTarget;
      const original = binding.readSource();
      undoable(() =>
        tree.$.rows.setAll([...initial].reverse())
      );
      await connection.settled();
      expect(sent).toEqual([['b', 'a']]);
      withWriteContext(
        { intent: 'system', origin: 'devtools', participation: 'inspection' },
        () => {
          prepareDeclarativeTransitionInstallation(
            {
              collections: new Map([[binding.owner, original]]),
              scalars: new Map(),
            },
            new Map([[binding.owner, binding]])
          ).install();
        }
      );
      expect(tree.$.rows.ids()).toEqual(['a', 'b']);
      await connection.settled();
      expect(sent).toEqual([['b', 'a']]);
      tree.$.rows.byIdOrFail('a').n(1);
      await connection.settled();
      expect(sent).toEqual([
        ['b', 'a'],
        ['b', 'a'],
      ]);
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });
  it.each([false, true])(
    'restores removed rows and survivor order with forward delivery drained=%s',
    async (delivered) => {
      const tree = fixture();
      tree.$.rows.addMany([
        { id: 'c', n: 0 },
        { id: 'd', n: 0 },
        { id: 'e', n: 0 },
      ]);
      const sent: string[][] = [];
      const connection = link(tree.$.rows, {
        set: (value) => {
          sent.push(value.map((row) => row.id));
        },
      });
      try {
        const pending = tree.transact(() =>
          tree.$.rows.setAll(
            [
              { id: 'e', n: 0 },
              { id: 'c', n: 0 },
              { id: 'a', n: 0 },
            ]
          )
        );
        if (delivered) await drain();
        pending.rollback();
        await connection.settled();
        expect(tree.$.rows.ids()).toEqual(['a', 'b', 'c', 'd', 'e']);
        expect(sent).toEqual([['a', 'b', 'c', 'd', 'e']]);
      } finally {
        connection.dispose();
        tree.destroy();
      }
    }
  );
});
