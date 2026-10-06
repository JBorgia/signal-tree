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
 * Reversing a designated omission of an entity collection through the React
 * adapter (v16 integration slice 8d (b); kernel carrier
 * `packages/kernel/src/enhancers/restoration/designated-collection-omission.spec.ts`).
 * Undo, redo, jumpTo and rollback restore the collection fully, read from a
 * component rendered through `useSignalTree`. A collection whose retained
 * rows changed after it was omitted is refused, and nothing changes.
 */

const settleKernel = async (): Promise<void> => {
  for (let index = 0; index < 8; index++) await Promise.resolve();
};
const ORDERS = [
  ['transactions first', () => [transactions(), restoration()]],
  ['restoration first', () => [restoration(), transactions()]],
] as const;

type Row = { id: string; n: number };
type Leaf = { (): unknown; (value: unknown): void };
type View = {
  (): unknown;
  (value: unknown): void;
  readonly count: Leaf;
  readonly g: Leaf & {
    readonly rows: {
      addOne(row: Row): void;
      updateOne(id: string, changes: Partial<Row>): void;
    };
  };
};
type Owner = {
  readonly $: View;
  readonly destroyed: () => boolean;
  undo(): void;
  redo(): void;
  jumpTo(index: number): void;
  getCurrentIndex(): number;
  transact(run: () => void): { rollback(): void };
  destroy(): void;
};

const WITH = '{"g":{"rows":{"all":[{"id":"a","n":0}]},"k":0},"count":5}';
const WITHOUT = '{"g":{"k":0},"count":5}';

describe.each(ORDERS)(
  'designated collection omission — React (%s)',
  (label, enhancers) => {
    const build = () => {
      const owner = signalTree(
        { g: { rows: entityMap<Row, string>(), k: 0 }, count: 0 },
        { enhancers: enhancers() as never }
      ) as unknown as Owner;
      owner.$.g.rows.addOne({ id: 'a', n: 0 });
      return owner;
    };

    function Whole({ owner }: { owner: Owner }) {
      const whole = useSignalTree(owner, ($) => JSON.stringify($()));
      return <output data-testid={label}>{whole}</output>;
    }
    const text = () => screen.getByTestId(label).textContent;
    const step = (run: () => void) =>
      act(async () => {
        run();
        await settleKernel();
      });

    it('undo, redo and jumpTo restore the collection', async () => {
      const owner = build();
      const view = render(<Whole owner={owner} />);
      try {
        await step(() => undoable(() => owner.$.count(5)));
        await step(() => undoable(() => owner.$.g({ k: 0 })));
        expect(text()).toBe(WITHOUT);
        await step(() => owner.undo());
        expect(text()).toBe(WITH);
        await step(() => owner.redo());
        expect(text()).toBe(WITHOUT);
        await step(() => owner.jumpTo(owner.getCurrentIndex() - 1));
        expect(text()).toBe(WITH);
      } finally {
        view.unmount();
        owner.destroy();
      }
    });

    it('rollback restores the collection', async () => {
      const owner = build();
      const view = render(<Whole owner={owner} />);
      try {
        await step(() => owner.$.count(5));
        let pending: { rollback(): void } | undefined;
        await step(() => {
          pending = owner.transact(() => owner.$.g({ k: 0 }));
        });
        expect(text()).toBe(WITHOUT);
        await step(() => pending?.rollback());
        expect(text()).toBe(WITH);
      } finally {
        view.unmount();
        owner.destroy();
      }
    });

    it('a collection changed after its omission is refused, nothing changes', async () => {
      const owner = build();
      const view = render(<Whole owner={owner} />);
      try {
        await step(() => owner.$.count(5));
        await step(() => undoable(() => owner.$.g({ k: 0 })));
        await step(() => owner.$.g.rows.updateOne('a', { n: 7 }));
        expect(() => owner.undo()).toThrow(/'g\.rows'.*changed after that/);
        await step(() => undefined);
        expect(text()).toBe(WITHOUT);
      } finally {
        view.unmount();
        owner.destroy();
      }
    });
  }
);
