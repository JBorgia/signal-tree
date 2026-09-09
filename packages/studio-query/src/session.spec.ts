import { describe, expect, it } from 'vitest';
import { createStudioSession, effectKey, type StudioTurn } from './index';

const turn = (treeId: string, id: number): StudioTurn => ({
  treeId,
  id,
  disposition: 'committed',
  participants: [1],
  effects: [
    {
      owner: 1,
      path: 'cart.total',
      ownerPath: 'cart',
      before: 12000,
      after: 10200,
    },
  ],
});

describe('StudioSession', () => {
  it('records and reads turns back in capture order', () => {
    const session = createStudioSession();
    session.record(turn('tree-0001', 1));
    session.record(turn('tree-0001', 2));

    expect(session.turns().map((t) => t.id)).toEqual([1, 2]);
    expect(session.turn('tree-0001', 2)?.effects[0]?.path).toBe('cart.total');
  });

  /**
   * NOTIFIER-SCOPE-0 in the inspector. Position and turn ids are allocated from
   * 1 PER TREE, so two live trees both have a turn 1 whose first effect owns
   * position 1. The process-global path notifier already coalesced two trees'
   * writes by ignoring this; a lookup keyed on id alone does it again.
   */
  it('does not merge turns from different trees that share an id', () => {
    const session = createStudioSession();
    session.record(turn('tree-0001', 1));
    session.record(turn('tree-0002', 1));

    expect(session.turns()).toHaveLength(2);
    expect(session.trees()).toEqual(['tree-0001', 'tree-0002']);

    const first = session.turn('tree-0001', 1);
    const second = session.turn('tree-0002', 1);
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(first).not.toBe(second);
  });

  it('keys effects by tree AND position, never position alone', () => {
    expect(effectKey('tree-0001', 1)).not.toBe(effectKey('tree-0002', 1));
  });

  it('returns undefined for a turn id that exists only in another tree', () => {
    const session = createStudioSession();
    session.record(turn('tree-0001', 7));

    expect(session.turn('tree-0002', 7)).toBeUndefined();
  });
});
