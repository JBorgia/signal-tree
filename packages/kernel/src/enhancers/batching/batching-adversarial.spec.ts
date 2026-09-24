import { afterEach, describe, expect, it, vi } from 'vitest';
import { entityMap } from '../../lib/markers/entity-map';
import { createSignalTreeFactory, signalTree } from '../../lib/signal-tree';
import { getPathNotifier } from '../../lib/path-notifier';
import { transactions } from '../transactions/transactions';
import { batching } from './batching';

const owned: Array<{ destroy(): void }> = [];
afterEach(() => {
  for (const tree of owned.splice(0)) tree.destroy();
  getPathNotifier()?.flushSync();
});

describe('coalesce exception and transaction boundaries', () => {
  for (const dynamic of [false, true]) {
    for (const failure of [new Error('first observer'), undefined]) {
      it(`drains every accepted write before rethrowing first failure (dynamic=${dynamic}, undefined=${
        failure === undefined
      })`, () => {
        let armed = false;
        const errors: unknown[] = [];
        const make = createSignalTreeFactory({
          createToken: () => ({
            observe: () => undefined,
            invalidate() {
              if (!armed) return;
              const error =
                errors.length === 0 ? failure : new Error('later observer');
              errors.push(error);
              throw error;
            },
          }),
          runInvalidationGroup: (fn) => fn(),
        });
        const tree = make(
          {
            a: 0,
            b: 0,
            rows: entityMap<{ id: string; a: number; b: number }>(),
          },
          { enhancers: [batching()] }
        );
        owned.push(tree);
        tree.$.rows.addOne({ id: 'r', a: 0, b: 0 });
        getPathNotifier()?.flushSync();
        const fields = dynamic ? tree.$.rows.byIdOrFail('r') : tree.$;
        fields.a();
        fields.b();
        let caught = false;
        let bodyCompleted = false;
        armed = true;
        try {
          tree.coalesce(() => {
            fields.a(1);
            fields.b(2);
            fields.b(3);
            bodyCompleted = true;
          });
        } catch (error) {
          caught = true;
          expect(error).toBe(failure);
        } finally {
          armed = false;
        }
        expect(caught).toBe(true);
        expect(bodyCompleted).toBe(true);
        expect([fields.a(), fields.b()]).toEqual([1, 3]);
        expect(errors.length).toBeGreaterThanOrEqual(2);
        tree.coalesce(() => undefined);
        expect([fields.a(), fields.b()]).toEqual([1, 3]);
        tree.coalesce(() => {
          fields.a(4);
          fields.b(5);
        });
        expect([fields.a(), fields.b()]).toEqual([4, 5]);
      });
    }
    for (const reverse of [false, true]) {
      for (const intent of ['replace', 'derive'] as const) {
        it(`refuses inner transaction before touching pending write (dynamic=${dynamic}, reverse=${reverse}, ${intent})`, () => {
          const tree = signalTree(
            { x: 0, rows: entityMap<{ id: string; x: number }>() },
            {
              enhancers: reverse
                ? [transactions(), batching()]
                : [batching(), transactions()],
            }
          );
          owned.push(tree);
          tree.$.rows.addOne({ id: 'r', x: 0 });
          getPathNotifier()?.flushSync();
          const field = dynamic ? tree.$.rows.byIdOrFail('r').x : tree.$.x;
          const derive = vi.fn((x: number) => x + 1);
          tree.coalesce(() => {
            field(1);
            expect(() =>
              tree.transact(() => {
                if (intent === 'derive') field(derive);
                else field(7);
              })
            ).toThrow(/put coalesce\(\) inside the transaction/);
            expect(field()).toBe(0);
            expect(derive).not.toHaveBeenCalled();
          });
          expect(field()).toBe(1);
          const pending = tree.transact(() =>
            tree.coalesce(() => {
              field(3);
              field((x) => x + 1);
              field(5);
            })
          );
          expect(field()).toBe(5);
          pending.rollback();
          expect(field()).toBe(1);
        });
      }
    }
  }
});
