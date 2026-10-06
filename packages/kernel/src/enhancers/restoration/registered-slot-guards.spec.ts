import { afterEach, describe, expect, it } from 'vitest';
import {
  leaf,
  restoration,
  signalTree,
  transactions,
  undoable,
} from '../../index';
import { restorationReader } from '../../internals';
import { onTreeError } from '../../lib/internals/error-reporter';
import { getPositionRegistry } from '../../lib/internals/position-registry';
import { getPathNotifier } from '../../lib/path-notifier';

/**
 * v16 integration slice 8b. Restoration decides "one whole value" by the
 * registered scalar slot, not by the absence of a subject (slice 8). No v16
 * producer emits a subject-less plain record at a position without a slot,
 * so these cases notify synthetic writes directly, as
 * `lib/path-notifier-enqueue.spec.ts` does for the transactions path:
 *
 * - capture: a record at an unregistered position is still read field by
 *   field (a hostile getter is reached and reported); the same record at a
 *   registered terminal's position is one value and is never read;
 * - admission: a non-scalar value at an unregistered position is refused
 *   before validation, as an owner refusal the restoration reader counts.
 */

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
const orders = {
  'restoration alone': () => [restoration()],
  'transactions first': () => [transactions(), restoration()],
  'restoration first': () => [restoration(), transactions()],
};
const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  // Discard the synthetic deliveries after each case.
  getPathNotifier().clear();
  getPathNotifier().emitReset();
});

function make(enhancers: unknown[]) {
  const tree = signalTree(
    { bounds: leaf({ min: 0 }), x: 0 },
    { enhancers: enhancers as never }
  );
  cleanups.push(() => tree.destroy());
  const errors: string[] = [];
  cleanups.push(onTreeError((event) => errors.push(String(event.error))));
  const registry = getPositionRegistry(tree.$)!;
  const notify = (
    path: string,
    next: unknown,
    prev: unknown,
    position: number
  ) =>
    undoable(() =>
      getPathNotifier().notify(
        path,
        next,
        prev,
        path,
        undefined,
        [position],
        undefined,
        registry.id
      )
    );
  const hostile = () =>
    Object.defineProperty({}, 'v', {
      enumerable: true,
      get() {
        throw new Error('hostile record');
      },
    });
  const history = () =>
    (
      tree as unknown as {
        getRestorationHistory(): { __effects?: { path: string }[] }[];
      }
    )
      .getRestorationHistory()
      .map((turn) => (turn.__effects ?? []).map(({ path }) => path));
  const boundsPosition = (
    tree.$.bounds as unknown as { __positionIds: number[] }
  ).__positionIds[0];
  const historyTree = tree as unknown as {
    undo(): void;
    getCurrentIndex(): number;
  };
  return {
    root: tree,
    tree: historyTree,
    errors,
    notify,
    hostile,
    history,
    boundsPosition,
  };
}

describe('restoration capture: the registered slot, not the subject, decides', () => {
  for (const [order, enhancers] of Object.entries(orders)) {
    it(`a record at an unregistered position is read field by field (${order})`, async () => {
      const t = make(enhancers());
      t.notify('synthetic', t.hostile(), { v: 0 }, 999_999);
      await flush();
      // The hostile getter was reached inside restoration's capture and the
      // failure was reported, not thrown; no whole-value entry was recorded.
      expect(t.errors.some((error) => error.includes('hostile record'))).toBe(
        true
      );
      expect(t.history().flat()).not.toContain('synthetic');
    });

    it(`the same record at a registered terminal is one value and never read (${order})`, async () => {
      const t = make(enhancers());
      t.notify('bounds', t.hostile(), { min: 0 }, t.boundsPosition);
      await flush();
      expect(t.errors).toEqual([]);
      expect(t.history()).toEqual([['bounds']]);
    });
  }
});

describe('restoration admission: the registered slot, not the subject, decides', () => {
  for (const [order, enhancers] of Object.entries(orders)) {
    it(`a non-scalar value at an unregistered position is refused before validation (${order})`, async () => {
      const t = make(enhancers());
      t.notify('synthetic', [1], [0], 999_998);
      await flush();
      expect(t.history()).toEqual([['synthetic']]);
      const reader = restorationReader(t.root)!;
      const events: unknown[] = [];
      reader.subscribe((event) => events.push(event));
      const index = t.tree.getCurrentIndex();
      expect(() => t.tree.undo()).toThrow(
        /^Unsupported scoped undo effect at synthetic$/
      );
      expect(t.tree.getCurrentIndex()).toBe(index);
      expect(events.at(-1)).toMatchObject({
        kind: 'operation',
        operation: 'undo',
        outcome: 'refused',
        affectedEntryIds: [],
      });
    });
  }
});
