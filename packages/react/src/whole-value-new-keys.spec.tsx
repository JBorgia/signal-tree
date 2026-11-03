import { act, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';

import { signalTree, transactions, useSignalTree } from './index';

const build = () =>
  signalTree(
    { rows: {} as Record<string, { n: number }> },
    { enhancers: [transactions()] }
  );
// This fixture knows the shape it explicitly installed; arbitrary Record access
// remains unknown. Check the supplied child before using its retained handle.
function assertRowHandle(value: unknown): asserts value is {
  (): { n: number } | undefined;
  n: { (): number; (next: number): void };
} {
  if (
    typeof value !== 'function' ||
    !Object.prototype.hasOwnProperty.call(value, 'n') ||
    !('n' in value) ||
    typeof value.n !== 'function'
  ) {
    throw new Error('Expected the explicitly installed row handle');
  }
}
const step = (run: () => void) =>
  act(async () => {
    run();
    for (let index = 0; index < 8; index++) await Promise.resolve();
  });

it('publishes newly supplied ordinary keys through the React facade', async () => {
  const tree = build();
  const rows = tree.$.rows;
  function View() {
    const root = useSignalTree(tree, ($) => JSON.stringify($()));
    const branch = useSignalTree(tree, ($) => JSON.stringify($.rows()));
    return <output data-testid="new-keys">{`${root}|${branch}`}</output>;
  }
  const view = render(<View />);
  const text = () => screen.getByTestId('new-keys').textContent;
  try {
    expect(text()).toBe('{"rows":{}}|{}');
    let pending!: ReturnType<typeof tree.transact>;
    await step(() => {
      pending = tree.transact(() => {
        rows({ b: { n: 2 } });
        const installed = rows['b'];
        assertRowHandle(installed);
        installed.n(3);
      });
    });
    const held = rows['b'];
    assertRowHandle(held);
    expect(tree.$()).toEqual({ rows: { b: { n: 3 } } });
    expect(rows()).toEqual({ b: { n: 3 } });
    expect(held.n()).toBe(3);
    expect(text()).toBe('{"rows":{"b":{"n":3}}}|{"b":{"n":3}}');
    await step(() => pending.rollback());
    expect(tree.$()).toEqual({ rows: {} });
    expect(rows()).toEqual({});
    expect(held()).toBeUndefined();
    expect(text()).toBe('{"rows":{}}|{}');
    await step(() => {
      const confirmed = tree.transact(() => rows({ b: { n: 4 } }));
      confirmed.confirm();
    });
    expect(rows['b']).toBe(held);
    expect(held.n()).toBe(4);
    expect(text()).toBe('{"rows":{"b":{"n":4}}}|{"b":{"n":4}}');
  } finally {
    view.unmount();
    tree.destroy();
  }
});

it.each([false, true])(
  'keeps failed transaction observations coherent (seeded=%s)',
  async (seeded) => {
    const initial: { trigger: { x: number }[]; fresh?: number } = {
      trigger: [{ x: 0 }],
    };
    if (seeded) initial.fresh = 0;
    const tree = signalTree(initial, { enhancers: [transactions()] });
    const failure = new Error('later equality failure');
    const seen: { snapshot: typeof initial; direct: number | undefined }[] = [];
    const read = () => {
      const snapshot = tree.$();
      const direct = tree.$.fresh?.();
      const frame = { snapshot, direct };
      seen.push(frame);
      return JSON.stringify(snapshot);
    };
    function View() {
      const value = useSignalTree(tree, read);
      return <output data-testid="failed-keys">{value}</output>;
    }
    const mounted = render(<View />);
    try {
      expect(screen.getByTestId('failed-keys').textContent).toBe(
        JSON.stringify(initial)
      );
      expect(seen.length).toBeGreaterThan(0);
      const fail = () => {
        expect(() =>
          tree.transact(() =>
            tree.$({
              fresh: 123,
              trigger: [
                {
                  get x(): number {
                    throw failure;
                  },
                },
              ],
            })
          )
        ).toThrow(failure);
        expect(tree.$()).toEqual(initial);
        expect(Object.prototype.hasOwnProperty.call(tree.$(), 'fresh')).toBe(
          seeded
        );
      };
      await step(fail);
      // Framework computed/render timing is only required after delivery.
      expect(screen.getByTestId('failed-keys').textContent).toBe(
        JSON.stringify(initial)
      );
      const beforeControl = seen.length;
      await step(() => tree.$({ trigger: [{ x: 1 }], fresh: 7 }));
      expect(seen.length).toBeGreaterThan(beforeControl);
      expect(screen.getByTestId('failed-keys').textContent).toBe(
        '{"trigger":[{"x":1}],"fresh":7}'
      );
      for (const frame of seen) {
        expect(frame.snapshot.fresh).toBe(frame.direct);
        expect(
          Object.prototype.hasOwnProperty.call(frame.snapshot, 'fresh')
        ).toBe(frame.direct !== undefined);
      }
    } finally {
      mounted.unmount();
      tree.destroy();
    }
  }
);
