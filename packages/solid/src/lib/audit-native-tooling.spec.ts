import { describe, expect, it } from 'vitest';
import { signalTree, entityMap, transactions } from '../index';
// Test current source; this package's Vitest aliases cover kernel root/adapter only.
// eslint-disable-next-line @nx/enforce-module-boundaries
import {
  treeCapabilities,
  treeRuntimeId,
  confirmedTurnReader,
  StudioTreeDestroyedError,
} from '../../../kernel/src/internals';

describe('solid audit tooling and terminal values', () => {
  it('observes tree identity and history lifetime', () => {
    const bare = signalTree({ n: 0 });
    const enhanced = signalTree({ n: 0 }, { enhancers: [transactions()] });
    try {
      expect(treeCapabilities(bare)).toEqual([]);
      expect(treeCapabilities(enhanced)).toContain('causal-runtime');
      expect(treeRuntimeId(bare)).toBeDefined();
      expect(treeRuntimeId(enhanced)).not.toBe(treeRuntimeId(bare));
      expect(confirmedTurnReader(bare)).toBeUndefined();
      const reader = confirmedTurnReader(enhanced);
      expect(reader).toBeDefined();
      expect(reader?.treeId).toBe(treeRuntimeId(enhanced));
      expect(reader?.readConfirmedTurns().turns).toEqual([]);
      enhanced.destroy();
      expect(() => reader?.readConfirmedTurns()).toThrow(
        StudioTreeDestroyedError
      );
    } finally {
      bare.destroy();
      enhanced.destroy();
    }
  });
  it('Date fields expose native carrier access', () => {
    const tree = signalTree({
      rows: entityMap<{ id: number; date: Date }, number>(),
    });
    try {
      tree.$.rows.addOne({ id: 1, date: new Date(0) });
      const field = tree.$.rows.byIdOrFail(1).date;
      expect('getTime' in field).toBe(false);
      field.set(new Date(7));
      expect(field().getTime()).toBe(7);
    } finally {
      tree.destroy();
    }
  });
});
