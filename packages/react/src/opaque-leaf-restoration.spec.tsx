import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  external,
  leaf,
  restoration,
  signalTree,
  transactions,
  undoable,
} from '@signal-tree/kernel';
import { useSignalTree } from './use-signal-tree';

/**
 * Registered-terminal reversal through the React adapter (v16 integration
 * slice 8b). Mirrors `packages/vue/src/lib/opaque-leaf-restoration.spec.ts`
 * (v15 2892b650, slice 8): an object terminal and a Date terminal undo and
 * redo as whole values, an external `undefined` refuses, and an ordinary
 * omission is re-added by undo (slice 8b). Each result is read from a
 * component rendered through `useSignalTree`.
 */

const settleKernel = async (): Promise<void> => {
  for (let index = 0; index < 8; index++) await Promise.resolve();
};
const ORDERS = [
  ['transactions first', () => [transactions(), restoration()]],
  ['restoration first', () => [restoration(), transactions()]],
] as const;

type Bounds = { min: number; max: number } | undefined;
type View = {
  (): Record<string, unknown>;
  (value: unknown): void;
  readonly bounds: { (): Bounds; (value: Bounds): void };
  readonly when: { (): Date; (value: Date): void };
  readonly count: { (): number; (value: number): void };
};
type Owner = {
  readonly $: View;
  readonly destroyed: () => boolean;
  undo(): void;
  redo(): void;
  destroy(): void;
};

describe.each(ORDERS)(
  'registered terminals — React (%s)',
  (label, enhancers) => {
    const build = () =>
      signalTree(
        {
          bounds: leaf<Bounds>({ min: 0, max: 10 }),
          when: new Date('2021-01-01T00:00:00.000Z'),
          count: 0,
        },
        { enhancers: enhancers() as never }
      ) as unknown as Owner;

    function Terminals({ owner }: { owner: Owner }) {
      const bounds = useSignalTree(owner, ($) => JSON.stringify($.bounds()));
      const when = useSignalTree(owner, ($) => $.when().toISOString());
      const keys = useSignalTree(owner, ($) => Object.keys($()).join(','));
      const count = useSignalTree(owner, ($) => String($.count()));
      return (
        <output
          data-testid={label}
        >{`${bounds}|${when}|${keys}|${count}`}</output>
      );
    }
    const text = () => screen.getByTestId(label).textContent;
    const initial =
      '{"min":0,"max":10}|2021-01-01T00:00:00.000Z|bounds,when,count|0';

    it('undo and redo replace object and Date terminals as one value', async () => {
      const tree = build();
      try {
        render(<Terminals owner={tree} />);
        expect(text()).toBe(initial);
        await act(async () => {
          undoable(() => {
            tree.$.bounds({ min: 1, max: 9 });
            tree.$.when(new Date('2022-01-01T00:00:00.000Z'));
          });
          await settleKernel();
        });
        const changed =
          '{"min":1,"max":9}|2022-01-01T00:00:00.000Z|bounds,when,count|0';
        expect(text()).toBe(changed);
        await act(async () => {
          tree.undo();
          await settleKernel();
        });
        expect(text()).toBe(initial);
        await act(async () => {
          tree.redo();
          await settleKernel();
        });
        expect(text()).toBe(changed);
      } finally {
        tree.destroy();
      }
    });

    it('external undefined refuses the whole undo and nothing changes', async () => {
      const tree = build();
      try {
        render(<Terminals owner={tree} />);
        await act(async () => {
          undoable(() => {
            tree.$.bounds({ min: 1, max: 9 });
            tree.$.count(1);
          });
          await settleKernel();
          external(() => tree.$.bounds(undefined));
          await settleKernel();
        });
        const refused = text();
        expect(refused).toBe(
          'undefined|2021-01-01T00:00:00.000Z|bounds,when,count|1'
        );
        await act(async () => {
          expect(() => tree.undo()).toThrow(/ST1034/);
          await settleKernel();
        });
        expect(text()).toBe(refused);
      } finally {
        tree.destroy();
      }
    });

    it('undo re-adds an ordinarily omitted terminal with its pre-image', async () => {
      const tree = build();
      try {
        render(<Terminals owner={tree} />);
        await act(async () => {
          undoable(() => {
            tree.$.bounds({ min: 1, max: 9 });
            tree.$.count(1);
          });
          await settleKernel();
          tree.$({ when: new Date('2021-01-01T00:00:00.000Z'), count: 1 });
          await settleKernel();
        });
        expect(text()).toBe('undefined|2021-01-01T00:00:00.000Z|when,count|1');
        await act(async () => {
          tree.undo();
          await settleKernel();
        });
        expect(text()).toBe(initial);
      } finally {
        tree.destroy();
      }
    });
  }
);
