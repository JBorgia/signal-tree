import { describe, expect, it } from 'vitest';

import { signalTree } from '../../lib/signal-tree';
import { undoable } from '../../lib/undoable';
import { transactions } from '../transactions/transactions';
import { restoration } from './restoration';

describe.each([
  ['restoration only', () => [restoration()]],
  ['transactions first', () => [transactions(), restoration()]],
  ['restoration first', () => [restoration(), transactions()]],
] as const)(
  'whole-turn designation survives coalescing: %s',
  (_name, enhancers) => {
    it.each([true, false])('designation first=%s', async (first) => {
      const tree = signalTree({ x: 0 }, { enhancers: enhancers() });
      try {
        if (first) {
          undoable(() => tree.$.x(1));
          tree.$.x(2);
        } else {
          tree.$.x(1);
          undoable(() => tree.$.x(2));
        }
        for (let i = 0; i < 8; i++) await Promise.resolve();
        expect(tree.canUndo()).toBe(true);
        tree.undo();
        expect(tree.$.x()).toBe(0);
        tree.redo();
        expect(tree.$.x()).toBe(2);
      } finally {
        tree.destroy();
      }
    });
  }
);
