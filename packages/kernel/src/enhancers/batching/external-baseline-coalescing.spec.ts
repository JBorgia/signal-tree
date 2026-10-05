// External truth as the undo baseline under coalesce and direct writes (L18).
//
// Restored in v16 integration slice 5 from
// docs/audits/2026-10-01-v16-integration/preserved/first-with-direct-control.spec.ts.txt
// (slice 3b), unchanged below this header. Slice 3b preserved it because the
// external -> undoable baseline it expects (5) failed with and without
// coalesce, and the alternative reading (0, preserved as
// pre-interpretation.spec.ts.txt) was not established either. The 15.4.2
// restoration carry settles it: restoration captures external truth for
// historical reconstruction only, so undo removes the authored contribution
// and leaves surviving external truth (L3, L4, L11), as published 15.4.2 does.
// First red on b4543600 (slice-5 part 1 head): 12/28 (every external-baseline
// case, scalar and dynamic entity field, both enhancer orders); 28/28 after.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { external } from '../../lib/external';
import { entityMap } from '../../lib/markers/entity-map';
import { getPathNotifier } from '../../lib/path-notifier';
import { signalTree } from '../../lib/signal-tree';
import { undoable } from '../../lib/undoable';
import { restoration } from '../restoration/restoration';
import { transactions } from '../transactions/transactions';
import { batching } from './batching';

const owned: Array<{ destroy(): void }> = [];
const settle = () => getPathNotifier().flushSync();
afterEach(() => {
  for (const tree of owned.splice(0)) tree.destroy();
  settle();
});

// These assertions concern final classification and reversal, not visibility
// immediately after an inner scope exits. Coalesce may defer replacement writes.
describe('coalescing preserves semantic contributions', () => {
  for (const reverse of [false, true]) {
    for (const dynamic of [false, true]) {
      const make = () => {
        const tree = signalTree(
          { x: 0, y: 0, rows: entityMap<{ id: string; x: number }>() },
          {
            enhancers: reverse
              ? [restoration(), transactions(), batching()]
              : [batching(), transactions(), restoration()],
          }
        );
        owned.push(tree);
        tree.$.rows.addOne({ id: 'r', x: 0 });
        settle();
        return {
          tree,
          field: dynamic ? tree.$.rows.byIdOrFail('r').x : tree.$.x,
        };
      };
      const label = `reverse=${reverse}, dynamic=${dynamic}`;

      it(`later ordinary replacement retains whole-turn designation (${label})`, () => {
        const { tree, field } = make();
        tree.coalesce(() => {
          tree.$.y(3);
          undoable(() => field(1));
          field(2);
        });
        settle();
        expect([field(), tree.$.y()]).toEqual([2, 3]);
        expect(tree.canUndo()).toBe(true);
        tree.undo();
        expect([field(), tree.$.y()]).toEqual([0, 0]);
        tree.redo();
        expect([field(), tree.$.y()]).toEqual([2, 3]);
      });

      it(`earlier external replacement supplies the undo baseline (${label})`, () => {
        const { tree, field } = make();
        tree.coalesce(() => {
          external(() => field(5));
          undoable(() => field(6));
        });
        settle();
        expect(field()).toBe(6);
        expect(tree.canUndo()).toBe(true);
        tree.undo();
        expect(field()).toBe(5);
        tree.redo();
        expect(field()).toBe(6);
      });

      it(`uncoalesced external then designated baseline control (${label})`, () => {
        const { tree, field } = make();
        external(() => field(5));
        undoable(() => field(6));
        settle();
        tree.undo();
        expect(field()).toBe(5);
      });

      it(`updater drains external replacement with its original authority (${label})`, () => {
        const { tree, field } = make();
        const update = vi.fn((value: number) => value + 1);
        tree.coalesce(() => {
          external(() => field(5));
          undoable(() => field(update));
        });
        settle();
        expect(update).toHaveBeenCalledExactlyOnceWith(5);
        expect(field()).toBe(6);
        tree.undo();
        expect(field()).toBe(5);
      });

      it(`external replacement never becomes authored through designation (${label})`, () => {
        const { tree, field } = make();
        undoable(() => tree.coalesce(() => external(() => field(7))));
        settle();
        expect(field()).toBe(7);
        expect(tree.canUndo()).toBe(false);
      });

      it(`body failure retains accepted designation and drains ordinary replacement (${label})`, () => {
        const { tree, field } = make();
        const failure = new Error('body failure');
        expect(() =>
          tree.coalesce(() => {
            undoable(() => field(1));
            field(2);
            throw failure;
          })
        ).toThrow(failure);
        settle();
        expect(field()).toBe(2);
        expect(tree.canUndo()).toBe(true);
        tree.undo();
        expect(field()).toBe(0);
      });

      it(`inner transaction refusal touches neither queued write nor updater (${label})`, () => {
        const { tree, field } = make();
        const update = vi.fn((value: number) => value + 1);
        tree.coalesce(() => {
          field(1);
          for (const derive of [false, true]) {
            expect(() =>
              tree.transact(() => {
                if (derive) field(update);
                else field(7);
              })
            ).toThrow(/put coalesce\(\) inside the transaction/);
            expect(field()).toBe(0);
            expect(update).not.toHaveBeenCalled();
          }
        });
        expect(field()).toBe(1);
        const pending = tree.transact(() => tree.coalesce(() => field(3)));
        pending.rollback();
        expect(field()).toBe(1);
      });
    }
  }
});
