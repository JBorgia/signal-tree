import { expect, it } from 'vitest';
import { link, signalTree } from '../index';
import { observationStateForTesting as state } from './internals/observation-substrate';
import { getOwnedPositionIds } from './internals/owned-metadata';

it.each([false, true])('keeps cold registration and escaped writes across reactivation (preassigned=%s)', async preassigned => {
  const tree = signalTree({ branch: { n: 0 } }, preassigned ? { capabilities: ['position-topology'] } : undefined);
  const leaf = tree.$.branch.n, write = leaf;
  const owned = getOwnedPositionIds(leaf)?.[0];
  const sent: number[] = [];
  let connection: ReturnType<typeof link> | undefined;
  const flush = async () => { for (let i = 0; i < 120; i++) await Promise.resolve(); };
  try {
    if (preassigned) expect(owned).toBeDefined();
    expect(state(leaf)).toEqual({ claims: 0, positionId: undefined, observable: true });
    write(1); expect(leaf()).toBe(1);
    connection = link(leaf, { set: value => { sent.push(value); } });
    const identity = state(leaf).positionId;
    expect(identity).toBeDefined();
    if (owned !== undefined) expect(identity).toBe(owned);
    write(2); await flush(); await connection.settled(); expect(sent).toEqual([2]);
    connection.dispose(); expect(state(leaf).claims).toBe(0);
    write(3); await flush(); expect(sent).toEqual([2]);
    connection = link(leaf, { set: value => { sent.push(value); } });
    expect(state(leaf).positionId).toBe(identity);
    write(4); await flush(); await connection.settled(); expect(sent).toEqual([2, 4]);
  } finally { connection?.dispose(); tree.destroy(); }
});
