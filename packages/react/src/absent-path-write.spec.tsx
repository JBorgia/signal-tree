import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  restoration,
  signalTree,
  transactions,
  undoable,
} from '@signal-tree/kernel';
import { useSignalTree } from './use-signal-tree';

/**
 * Reads and writes under an omitted member through the React adapter (v16
 * integration slice 8d (a); kernel carrier
 * `packages/kernel/src/lib/absent-path-write.spec.ts`). A component's
 * selectors under an omitted branch read absent, never retained storage. A
 * write through a held handle re-adds its path and leaves the branch's other
 * members absent. Undo, redo, jumpTo and rollback of that write make the
 * branch absent again.
 */

const settleKernel = async (): Promise<void> => {
  for (let index = 0; index < 8; index++) await Promise.resolve();
};
const ORDERS = [
  ['transactions first', () => [transactions(), restoration()]],
  ['restoration first', () => [restoration(), transactions()]],
] as const;

type Leaf = { (): unknown; (value: unknown): void };
type View = {
  (): unknown;
  (value: unknown): void;
  readonly count: Leaf;
  readonly a: {
    (): unknown;
    readonly b: Leaf & { readonly keep: Leaf };
    readonly side: Leaf;
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

const ABSENT = '{"count":0}|undefined|undefined|undefined';
const READDED = '{"a":{"b":{"keep":9}},"count":0}|{"keep":9}|9|undefined';

describe.each(ORDERS)('absent-path writes — React (%s)', (label, enhancers) => {
  const build = () =>
    signalTree(
      { a: { b: { value: 0, keep: 0 }, side: 0 }, count: 0 } as {
        a?: { b: { value: number; keep: number }; side: number };
        count: number;
      },
      { enhancers: enhancers() as never }
    ) as unknown as Owner;

  function Absent({ owner }: { owner: Owner }) {
    const whole = useSignalTree(owner, ($) => JSON.stringify($()));
    const b = useSignalTree(owner, ($) => String(JSON.stringify($.a.b())));
    const keep = useSignalTree(owner, ($) => String($.a.b.keep()));
    const side = useSignalTree(owner, ($) => String($.a.side()));
    return <output data-testid={label}>{`${whole}|${b}|${keep}|${side}`}</output>;
  }
  const text = () => screen.getByTestId(label).textContent;
  const step = (run: () => void) =>
    act(async () => {
      run();
      await settleKernel();
    });

  it('selectors read absent; a held leaf write re-adds only its path', async () => {
    const owner = build();
    const { a } = owner.$;
    const view = render(<Absent owner={owner} />);
    try {
      expect(text()).toBe(
        '{"a":{"b":{"value":0,"keep":0},"side":0},"count":0}|{"value":0,"keep":0}|0|0'
      );
      // An earlier designated turn, so jumpTo has a position before the write.
      await step(() => undoable(() => owner.$.count(1)));
      await step(() => owner.$({ count: 0 }));
      expect(text()).toBe(ABSENT);
      await step(() => undoable(() => a.b.keep(9)));
      expect(text()).toBe(READDED);
      await step(() => owner.undo());
      expect(text()).toBe(ABSENT);
      await step(() => owner.redo());
      expect(text()).toBe(READDED);
      await step(() => owner.jumpTo(owner.getCurrentIndex() - 1));
      expect(text()).toBe(ABSENT);
    } finally {
      view.unmount();
      owner.destroy();
    }
  });

  it('a held branch write re-adds with its whole value; undo omits it again', async () => {
    const owner = build();
    const { a } = owner.$;
    const view = render(<Absent owner={owner} />);
    try {
      await step(() => owner.$({ count: 0 }));
      await step(() => undoable(() => a.b({ keep: 9 })));
      expect(text()).toBe(READDED);
      await step(() => owner.undo());
      expect(text()).toBe(ABSENT);
    } finally {
      view.unmount();
      owner.destroy();
    }
  });

  it('undo of a designated omission brings back every selector below it', async () => {
    const owner = build();
    const view = render(<Absent owner={owner} />);
    try {
      const present = text();
      await step(() => undoable(() => owner.$({ count: 0 })));
      expect(text()).toBe(ABSENT);
      await step(() => owner.undo());
      expect(text()).toBe(present);
    } finally {
      view.unmount();
      owner.destroy();
    }
  });

  it('rollback of a re-adding write makes the branch absent again', async () => {
    const owner = build();
    const { a } = owner.$;
    const view = render(<Absent owner={owner} />);
    try {
      await step(() => owner.$({ count: 0 }));
      let pending: { rollback(): void } | undefined;
      await step(() => {
        pending = owner.transact(() => a.b.keep(9));
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
