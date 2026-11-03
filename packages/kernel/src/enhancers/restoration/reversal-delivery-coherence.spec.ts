import { describe, expect, it, vi } from 'vitest';

import { signalTree, createSignalTreeFactory } from '../../lib/signal-tree';
import {
  createReactiveTestRealization,
  observeReactiveTestValue,
} from '../../reactive-test-realization';
import { undoable } from '../../lib/undoable';
import { getPathNotifier } from '../../lib/path-notifier';
import {
  transactions,
  peekInternalTransactionRuntime,
} from '../transactions/transactions';
import { restoration } from './restoration';
import { getTreeRealizationPort } from '../../lib/internals/causal-runtime/tree-realization-adapter';

// Behavioral companions to the v15 producer-boundary tests. These deliberately
// use v16's existing history and inspection surfaces, not the incoming readers.
describe.each([
  ['transactions first', () => [transactions(), restoration()]],
  ['restoration first', () => [restoration(), transactions()]],
] as const)('reversal delivery coherence: %s', (_label, enhancers) => {
  it.each(['confirm', 'rollback'] as const)(
    'blocks reentrant %s while rollback installs',
    (operation) => {
      const tree = signalTree({ x: 0 }, { enhancers: enhancers() });
      const reported = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      let pending: ReturnType<typeof tree.transact> | undefined;
      let attempted = false;
      let failure: unknown;
      const stop = tree.$.x.subscribe(() => {
        if (!pending || tree.$.x() !== 0 || attempted) return;
        attempted = true;
        try {
          pending[operation]();
        } catch (error) {
          failure = error;
        }
      });
      try {
        pending = tree.transact(() => undoable(() => tree.$.x(1)));
        pending.rollback();
        expect(attempted).toBe(true);
        expect(failure).toBeInstanceOf(Error);
        expect(tree.$.x()).toBe(0);
        expect(
          peekInternalTransactionRuntime(tree)!.getPendingTurnCount()
        ).toBe(0);
        expect(tree.canUndo()).toBe(false);
        expect(tree.canRedo()).toBe(false);
        tree.redo();
        expect(tree.$.x()).toBe(0);
        expect(() => pending!.confirm()).toThrow(/rolled back/);
      } finally {
        stop();
        reported.mockRestore();
        tree.destroy();
      }
    }
  );

  it.each(['undo', 'redo'] as const)(
    'records an applied %s despite throwing reactive delivery',
    (operation) => {
      const tree = signalTree({ x: 0 }, { enhancers: enhancers() });
      const reported = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      let stop: () => void = () => undefined;
      const bomb = new Error(`delivery after ${operation}`);
      let delivered = false;
      try {
        undoable(() => tree.$.x(1));
        getPathNotifier().flushSync();
        expect(tree.canUndo()).toBe(true);
        if (operation === 'redo') tree.undo();
        const target = operation === 'undo' ? 0 : 1;
        stop = tree.$.x.subscribe(() => {
          if (tree.$.x() === target) {
            delivered = true;
            throw bomb;
          }
        });
        // Direct leaf subscribers are isolated by v16's location runtime.
        tree[operation]();
        stop();
        expect(delivered).toBe(true);
        expect(tree.$.x()).toBe(target);
        expect(tree.canUndo()).toBe(operation === 'redo');
        expect(tree.canRedo()).toBe(operation === 'undo');
        tree[operation === 'undo' ? 'redo' : 'undo']();
        expect(tree.$.x()).toBe(1 - target);
      } finally {
        stop();
        reported.mockRestore();
        tree.destroy();
      }
    }
  );
  it.each(['undo', 'redo'] as const)(
    'retains history coherence when reactive realization throws after %s',
    (operation) => {
      const build = createSignalTreeFactory(createReactiveTestRealization());
      const tree = build({ x: 0 }, { enhancers: enhancers() });
      const bomb = new Error(`realization delivery after ${operation}`);
      let armed = false;
      let delivered = false;
      try {
        undoable(() => tree.$.x(1));
        getPathNotifier().flushSync();
        expect(tree.canUndo()).toBe(true);
        if (operation === 'redo') tree.undo();
        const target = operation === 'undo' ? 0 : 1;
        const observer = observeReactiveTestValue(
          () => tree.$.x(),
          (value) => {
            if (armed && value === target) {
              delivered = true;
              throw bomb;
            }
          }
        );
        armed = true;
        expect(() => tree[operation]()).toThrow(bomb);
        armed = false;
        expect(delivered).toBe(true);
        expect(tree.$.x()).toBe(target);
        expect(tree.canUndo()).toBe(operation === 'redo');
        expect(tree.canRedo()).toBe(operation === 'undo');
        tree[operation === 'undo' ? 'redo' : 'undo']();
        expect(tree.$.x()).toBe(1 - target);
        expect(observer()).toBe(1 - target);
      } finally {
        armed = false;
        tree.destroy();
      }
    }
  );

  it('does not advance redo history when validation reuses an earlier delivery error', () => {
    const tree = createSignalTreeFactory(createReactiveTestRealization())(
      { x: 0 },
      { enhancers: enhancers() }
    );
    const reused = new Error('reused delivery and validation failure');
    const port = getTreeRealizationPort(tree.$)!;
    const validate = port.validateEffects;
    let armed = false;
    try {
      undoable(() => tree.$.x(1));
      getPathNotifier().flushSync();
      const observer = observeReactiveTestValue(
        () => tree.$.x(),
        () => {
          if (armed) throw reused;
        }
      );
      armed = true;
      let first: unknown;
      try {
        tree.undo();
      } catch (error) {
        first = error;
      }
      armed = false;
      expect(first).toBe(reused);
      expect(tree.$.x()).toBe(0);
      expect(tree.canRedo()).toBe(true);
      port.validateEffects = () => {
        throw reused;
      };
      let second: unknown;
      try {
        tree.redo();
      } catch (error) {
        second = error;
      }
      expect(second).toBe(reused);
      expect(tree.$.x()).toBe(0);
      expect(tree.canRedo()).toBe(true);
      expect(tree.canUndo()).toBe(false);
      port.validateEffects = validate;
      tree.redo();
      expect(observer()).toBe(1);
    } finally {
      armed = false;
      port.validateEffects = validate;
      tree.destroy();
    }
  });

  it.each([undefined, null, 'primitive error', 7])(
    'preserves thrown value identity (%s) after applied undo',
    (failure) => {
      const tree = createSignalTreeFactory(createReactiveTestRealization())(
        { x: 0 },
        { enhancers: enhancers() }
      );
      let armed = false;
      try {
        undoable(() => tree.$.x(1));
        getPathNotifier().flushSync();
        const observer = observeReactiveTestValue(
          () => tree.$.x(),
          () => {
            if (armed) throw failure;
          }
        );
        armed = true;
        let caught = false;
        let actual: unknown;
        try {
          tree.undo();
        } catch (error) {
          caught = true;
          actual = error;
        }
        armed = false;
        expect(caught).toBe(true);
        expect(actual).toBe(failure);
        expect(tree.$.x()).toBe(0);
        expect(tree.canRedo()).toBe(true);
        tree.redo();
        expect(observer()).toBe(1);
      } finally {
        armed = false;
        tree.destroy();
      }
    }
  );
});
