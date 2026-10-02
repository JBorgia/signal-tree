import { describe, expect, it } from 'vitest';
import { createSignalTreeFactory } from '../../lib/signal-tree';
import { undoable } from '../../lib/undoable';
import { getPathNotifier } from '../../lib/path-notifier';
import { getTreeRealizationPort } from '../../lib/internals/causal-runtime/tree-realization-adapter';
import {
  createReactiveTestRealization,
  observeReactiveTestValue,
} from '../../reactive-test-realization';
import {
  transactions,
  peekInternalTransactionRuntime,
} from '../transactions/transactions';
import { restoration } from './restoration';

function thrownBy(run: () => void): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error('Expected operation to throw');
}

describe('v15 applied-outcome provenance', () => {
  it('does not advance redo history when validation reuses an earlier delivery error', () => {
    const tree = createSignalTreeFactory(createReactiveTestRealization())(
      { x: 0 },
      { enhancers: [restoration()] }
    );
    const error = new Error('same consumer error');
    const port = getTreeRealizationPort(tree.$)!;
    const validate = port.validateEffects;
    let armed = false;
    let deliveries = 0;
    try {
      undoable(() => tree.$.x(1));
      getPathNotifier().flushSync();
      const observer = observeReactiveTestValue(
        () => tree.$.x(),
        () => {
          if (armed) {
            deliveries++;
            throw error;
          }
        }
      );
      armed = true;
      expect(thrownBy(() => tree.undo())).toBe(error);
      armed = false;
      expect(deliveries).toBe(1);
      expect([tree.$.x(), tree.canUndo(), tree.canRedo()]).toEqual([
        0,
        false,
        true,
      ]);
      // Controlled internal fault injection: validation rejects before application.
      port.validateEffects = () => {
        throw error;
      };
      expect(thrownBy(() => tree.redo())).toBe(error);
      expect([tree.$.x(), tree.canUndo(), tree.canRedo()]).toEqual([
        0,
        false,
        true,
      ]);
      port.validateEffects = validate;
      tree.redo();
      expect([tree.$.x(), observer(), tree.canUndo(), tree.canRedo()]).toEqual([
        1,
        1,
        true,
        false,
      ]);
    } finally {
      armed = false;
      port.validateEffects = validate;
      tree.destroy();
    }
  });

  const failures = [
    new Error('delivery'),
    undefined,
    null,
    'delivery',
    17,
    false,
    Symbol('delivery'),
  ];
  it.each(failures.map((failure, index) => ({ failure, index })))(
    'preserves exact thrown value at undo/redo boundary ($index)',
    ({ failure }) => {
      const tree = createSignalTreeFactory(createReactiveTestRealization())(
        { x: 0 },
        { enhancers: [restoration()] }
      );
      let armed = false;
      try {
        undoable(() => tree.$.x(1));
        getPathNotifier().flushSync();
        observeReactiveTestValue(
          () => tree.$.x(),
          () => {
            if (armed) throw failure;
          }
        );
        armed = true;
        expect(thrownBy(() => tree.undo())).toBe(failure);
        expect([tree.$.x(), tree.canUndo(), tree.canRedo()]).toEqual([
          0,
          false,
          true,
        ]);
        expect(thrownBy(() => tree.redo())).toBe(failure);
        expect([tree.$.x(), tree.canUndo(), tree.canRedo()]).toEqual([
          1,
          true,
          false,
        ]);
      } finally {
        armed = false;
        tree.destroy();
      }
    }
  );

  describe.each([
    ['transactions first', () => [transactions(), restoration()]],
    ['restoration first', () => [restoration(), transactions()]],
  ] as const)('%s', (_name, enhancers) => {
    it.each(failures.map((failure, index) => ({ failure, index })))(
      'preserves exact rollback failure after retiring the pending turn ($index)',
      ({ failure }) => {
        const tree = createSignalTreeFactory(createReactiveTestRealization())(
          { x: 0 },
          { enhancers: enhancers() }
        );
        let armed = false;
        try {
          const pending = tree.transaction(() => undoable(() => tree.$.x(1)));
          observeReactiveTestValue(
            () => tree.$.x(),
            () => {
              if (armed) throw failure;
            }
          );
          armed = true;
          expect(thrownBy(() => pending.rollback())).toBe(failure);
          armed = false;
          expect(tree.$.x()).toBe(0);
          expect(
            peekInternalTransactionRuntime(tree)!.getPendingTurnCount()
          ).toBe(0);
          expect([tree.canUndo(), tree.canRedo()]).toEqual([false, false]);
        } finally {
          armed = false;
          tree.destroy();
        }
      }
    );
  });
});
