import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  entityMap,
  restoration,
  signalTree,
  transactions,
  undoable,
} from '@signal-tree/kernel';
import { useSignalTree } from './use-signal-tree';

/**
 * An entity collection under an omitted member through the React adapter
 * (v16 integration slice 8e (2); kernel carrier
 * `packages/kernel/src/lib/absent-collection.spec.ts`). Read from a component
 * rendered through `useSignalTree`: the collection is absent and empty under
 * the omission, a row-adding write re-adds the path with only its rows, a
 * row-naming write refuses, and undo and rollback make it absent again.
 */

const settleKernel = async (): Promise<void> => {
  for (let index = 0; index < 8; index++) await Promise.resolve();
};
const ORDERS = [
  ['transactions first', () => [transactions(), restoration()]],
  ['restoration first', () => [restoration(), transactions()]],
] as const;

type Row = { id: string; n: number };
type Rows = {
  all(): Row[];
  count(): number;
  byId(id: string): (() => Row | undefined) | undefined;
  addOne(row: Row): string;
  updateOne(id: string, changes: Partial<Row>): void;
  tap(handlers: { onAdd?: () => void; onRemove?: () => void }): () => void;
  removeOne(id: string): void;
};
type View = {
  (): unknown;
  (value: unknown): void;
  readonly a: { readonly rows: Rows };
};
type Owner = {
  readonly $: View;
  readonly destroyed: () => boolean;
  undo(): void;
  redo(): void;
  transact(run: () => void): { rollback(): void };
  destroy(): void;
};

const A = { id: 'a', n: 0 };
const Z = { id: 'z', n: 9 };
const ABSENT = '{"count":0}|[]|0';
const READDED =
  '{"a":{"rows":{"all":[{"id":"z","n":9}]}},"count":0}|[{"id":"z","n":9}]|1';

describe.each(ORDERS)('absent collection — React (%s)', (label, enhancers) => {
  const build = () => {
    const owner = signalTree(
      { a: { rows: entityMap<Row, string>(), s: 0 }, count: 0 },
      { enhancers: enhancers() as never }
    ) as unknown as Owner;
    owner.$.a.rows.addOne(A);
    return owner;
  };

  function Collection({ owner }: { owner: Owner }) {
    const whole = useSignalTree(owner, ($) => JSON.stringify($()));
    const all = useSignalTree(owner, ($) => JSON.stringify($.a.rows.all()));
    const count = useSignalTree(owner, ($) => String($.a.rows.count()));
    return <output data-testid={label}>{`${whole}|${all}|${count}`}</output>;
  }
  const text = () => screen.getByTestId(label).textContent;
  const step = (run: () => void) =>
    act(async () => {
      run();
      await settleKernel();
    });

  it('reads it absent and empty; a row-naming write refuses', async () => {
    const owner = build();
    const view = render(<Collection owner={owner} />);
    try {
      await step(() => owner.$({ count: 0 }));
      expect(text()).toBe(ABSENT);
      expect(owner.$.a.rows.byId('a')).toBeUndefined();
      expect(() => owner.$.a.rows.updateOne('a', { n: 1 })).toThrow(
        /^Entity with id a not found$/
      );
      expect(text()).toBe(ABSENT);
    } finally {
      view.unmount();
      owner.destroy();
    }
  });

  it('a row-adding write re-adds the path with only its row; undo omits it again', async () => {
    const owner = build();
    const view = render(<Collection owner={owner} />);
    try {
      await step(() => owner.$({ count: 0 }));
      await step(() => undoable(() => owner.$.a.rows.addOne(Z)));
      expect(text()).toBe(READDED);
      await step(() => owner.undo());
      expect(text()).toBe(ABSENT);
      await step(() => owner.redo());
      expect(text()).toBe(READDED);
    } finally {
      view.unmount();
      owner.destroy();
    }
  });

  it('a root holding only collections: omission, a re-adding write, undo (v16 8e review)', async () => {
    type Pair = {
      readonly $: {
        (): unknown;
        (value: unknown): void;
        readonly users: Rows;
      };
      undo(): void;
      destroy(): void;
    };
    const owner = signalTree(
      { users: entityMap<Row, string>(), orders: entityMap<Row, string>() },
      { enhancers: enhancers() as never }
    ) as unknown as Pair;
    owner.$.users.addOne(A);
    function Users() {
      const whole = useSignalTree(owner as never, ($: Pair['$']) =>
        JSON.stringify($())
      );
      const all = useSignalTree(owner as never, ($: Pair['$']) =>
        JSON.stringify($.users.all())
      );
      return (
        <output data-testid={`${label} users`}>{`${whole}|${all}`}</output>
      );
    }
    const users = () => screen.getByTestId(`${label} users`).textContent;
    const view = render(<Users />);
    try {
      expect(users()).toBe(
        '{"users":{"all":[{"id":"a","n":0}]},"orders":{"all":[]}}|[{"id":"a","n":0}]'
      );
      await step(() => owner.$({ orders: [] }));
      expect(users()).toBe('{"orders":{"all":[]}}|[]');
      await step(() => undoable(() => owner.$.users.addOne(Z)));
      expect(users()).toBe(
        '{"users":{"all":[{"id":"z","n":9}]},"orders":{"all":[]}}|[{"id":"z","n":9}]'
      );
      await step(() => owner.undo());
      expect(users()).toBe('{"orders":{"all":[]}}|[]');
    } finally {
      view.unmount();
      owner.destroy();
    }
  });

  it('a tap inside a whole value re-adds an absent member of the same tree (v16 8f)', async () => {
    type Two = {
      readonly $: {
        (): unknown;
        (value: unknown): void;
        readonly a: { readonly rows: Rows };
        readonly b: {
          readonly rows: Rows;
          readonly s: (value?: number) => number;
        };
      };
      destroy(): void;
    };
    const owner = signalTree(
      {
        a: { rows: entityMap<Row, string>(), s: 0 },
        b: { rows: entityMap<Row, string>(), s: 0 },
        count: 0,
      },
      { enhancers: enhancers() as never }
    ) as unknown as Two;
    owner.$.a.rows.addOne(A);
    owner.$({ a: { rows: [A], s: 0 }, count: 0 });
    function Both() {
      const whole = useSignalTree(owner as never, ($: Two['$']) =>
        JSON.stringify($())
      );
      const b = useSignalTree(owner as never, ($: Two['$']) =>
        JSON.stringify($.b.rows.all())
      );
      return <output data-testid={`${label} both`}>{`${whole}|${b}`}</output>;
    }
    const both = () => screen.getByTestId(`${label} both`).textContent;
    const view = render(<Both />);
    try {
      expect(both()).toBe(
        '{"a":{"rows":{"all":[{"id":"a","n":0}]},"s":0},"count":0}|[]'
      );
      let wrote = false;
      owner.$.a.rows.tap({
        onAdd: () => {
          if (wrote) return;
          wrote = true;
          owner.$.b.rows.addOne(Z);
          owner.$.b.s(5);
        },
      });
      // Inside the whole value's own row writes: an ordinary write.
      await step(() => owner.$({ a: { rows: [A, Z], s: 0 }, count: 0 }));
      expect(wrote).toBe(true);
      expect(both()).toBe(
        '{"a":{"rows":{"all":[{"id":"a","n":0},{"id":"z","n":9}]},"s":0},"b":{"rows":{"all":[{"id":"z","n":9}]},"s":5},"count":0}|[{"id":"z","n":9}]'
      );
    } finally {
      view.unmount();
      owner.destroy();
    }
  });

  it('a tap inside transact reads the collection as it is (v16 8f)', () => {
    const tree = signalTree(
      { a: { rows: entityMap<Row, string>(), s: 0 }, count: 0 },
      { enhancers: enhancers() as never }
    ) as unknown as {
      $: { a: { rows: Rows } };
      transact(run: () => void): unknown;
      destroy(): void;
    };
    try {
      const rows = tree.$.a.rows;
      rows.addOne(A);
      rows.addOne(Z);
      rows.all();
      rows.count();
      const seen: unknown[] = [];
      rows.tap({
        onRemove: () => {
          seen.push(
            rows.all().map((row) => row.id),
            rows.count()
          );
        },
      });
      tree.transact(() => rows.removeOne('a'));
      expect(seen).toEqual([['z'], 1]);
    } finally {
      tree.destroy();
    }
  });

  it('rollback of a re-adding write makes it absent again', async () => {
    const owner = build();
    const view = render(<Collection owner={owner} />);
    try {
      await step(() => owner.$({ count: 0 }));
      let pending: { rollback(): void } | undefined;
      await step(() => {
        pending = owner.transact(() => owner.$.a.rows.addOne(Z));
      });
      expect(text()).toBe(READDED);
      await step(() => pending?.rollback());
      expect(text()).toBe(ABSENT);
    } finally {
      view.unmount();
      owner.destroy();
    }
  });
});
