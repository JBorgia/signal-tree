import { describe, expect, it } from 'vitest';
import { signalTree, entityMap } from './index';
import type { ReadableCell, WritableCell } from './lib/internals/cell-runtime';

/** The kernel half of TYPE-A: neutral carriers, and no Angular promise. */
describe('kernel declares neutral carriers', () => {
  it('leaves and destroyed are neutral cells', () => {
    const tree = signalTree({ count: 0, user: { name: 'a' } });
    const leaf: WritableCell<number> = tree.$.count;
    const nested: WritableCell<string> = tree.$.user.name;
    const destroyed: ReadableCell<boolean> = tree.destroyed;
    expect([leaf, nested, destroyed].length).toBe(3);
  });

  it('entity surfaces are neutral cells', () => {
    const tree = signalTree({ users: entityMap<{ id: number; name: string }>() });
    const rows = tree.$.users;
    rows.addOne({ id: 1, name: 'Ada' });
    const empty: ReadableCell<boolean> = rows.empty;
    const field: WritableCell<string> = rows.byIdOrFail(1).name;
    expect([empty, field].length).toBe(2);
  });
});
