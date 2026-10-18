import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { signalTree, transactions, useSignalTree } from './index';

const build = () =>
  signalTree(
    { rows: {} as Record<string, { n: number }> },
    { enhancers: [transactions()] }
  );
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
        rows['b']!.n(3);
      });
    });
    const held = rows['b']!;
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
