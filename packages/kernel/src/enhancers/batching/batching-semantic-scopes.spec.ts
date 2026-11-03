import { afterEach, describe, expect, it, vi } from 'vitest';
import { external } from '../../lib/external';
import { entityMap } from '../../lib/markers/entity-map';
import { getPathNotifier } from '../../lib/path-notifier';
import { getPositionRegistry } from '../../lib/internals/position-registry';
import { isMetaDesignated } from '../../lib/internals/restoration-eligibility';
import { createSignalTreeFactory, signalTree } from '../../lib/signal-tree';
import { undoable } from '../../lib/undoable';
import { restoration } from '../restoration/restoration';
import { transactions } from '../transactions/transactions';
import { batching } from './batching';

const releases: Array<() => void> = [];
const owned: Array<{ destroy(): void }> = [];
const settle = () => getPathNotifier().flushSync();
afterEach(() => {
  for (const release of releases.splice(0)) release();
  for (const tree of owned.splice(0)) tree.destroy();
  settle();
});

// Original unresolved counterexamples (not closed by this batching repair):
// /private/tmp/st-v16-integration-evidence/scope-deferral/first-with-direct-control.spec.ts
// /private/tmp/st-v16-integration-evidence/scope-deferral/designation-control.spec.ts
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

      it(`later ordinary replacement retains designated contribution (${label})`, () => {
        const { tree, field } = make();
        const designations: boolean[] = [];
        releases.push(
          getPathNotifier().observeEnqueue(
            getPositionRegistry(tree.$)!.id,
            (entry) => {
              if (entry.path === (dynamic ? 'rows.r' : 'x'))
                designations.push(isMetaDesignated(entry.meta));
            }
          )
        );
        tree.coalesce(() => {
          tree.$.y(3);
          undoable(() => field(1));
          field(2);
        });
        settle();
        expect([field(), tree.$.y()]).toEqual([2, 3]);
        expect(designations).toEqual([true, false]);
        // Scalar history admission also fails without coalesce on this baseline;
        // its separate notifier/control evidence is outside this batching fix.
        if (dynamic) {
          expect(tree.canUndo()).toBe(true);
          tree.undo();
          expect([field(), tree.$.y()]).toEqual([0, 0]);
          tree.redo();
          expect([field(), tree.$.y()]).toEqual([2, 3]);
        }
      });

      it(`external predecessor keeps its enqueue classification (${label})`, () => {
        const { tree, field } = make();
        const seen: unknown[] = [];
        releases.push(
          getPathNotifier().observeEnqueue(
            getPositionRegistry(tree.$)!.id,
            (entry) => {
              if (entry.path !== (dynamic ? 'rows.r' : 'x')) return;
              const value = dynamic
                ? (entry.newValue as { x: number }).x
                : entry.newValue;
              seen.push([value, entry.meta?.origin, entry.meta?.participation]);
            }
          )
        );
        tree.coalesce(() => {
          external(() => field(5));
          undoable(() => field(6));
        });
        expect(seen).toEqual([
          [5, 'external', 'realized'],
          [6, undefined, undefined],
        ]);
        settle();
        expect(field()).toBe(6);
        expect(tree.canUndo()).toBe(true);
        // L18 equivalence only: the first-external/new-undoable baseline is
        // unresolved. Compare with direct writes without declaring 0 or 5 law.
        const direct = make();
        external(() => direct.field(5));
        undoable(() => direct.field(6));
        settle();
        tree.undo();
        direct.tree.undo();
        expect(field()).toBe(direct.field());
        tree.redo();
        direct.tree.redo();
        expect(field()).toBe(direct.field());
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
        // The uncoalesced undo-baseline counterexample is recorded separately.
      });

      it(`external replacement never becomes authored through designation (${label})`, () => {
        const { tree, field } = make();
        undoable(() => tree.coalesce(() => external(() => field(7))));
        settle();
        expect(field()).toBe(7);
        expect(tree.canUndo()).toBe(false);
      });

      it(`external successor does not erase designation of sibling work (${label})`, () => {
        const { tree, field } = make();
        tree.coalesce(() => {
          undoable(() => field(1));
          external(() => field(2));
          tree.$.y(3);
        });
        settle();
        expect(field()).toBe(2);
        expect(tree.canUndo()).toBe(true);
      });

      it(`ordinary same-context replacements remain deduplicated (${label})`, () => {
        const { tree, field } = make();
        const seen: unknown[] = [];
        releases.push(
          getPathNotifier().observeEnqueue(
            getPositionRegistry(tree.$)!.id,
            (entry) => {
              if (entry.path !== (dynamic ? 'rows.r' : 'x')) return;
              seen.push(
                dynamic ? (entry.newValue as { x: number }).x : entry.newValue
              );
            }
          )
        );
        tree.coalesce(() => {
          field(1);
          field(2);
          expect(field()).toBe(0);
        });
        expect(seen).toEqual([2]);
        expect(field()).toBe(2);
      });

      it(`body failure retains accepted designation and drains ordinary replacement (${label})`, () => {
        const { tree, field } = make();
        const designations: boolean[] = [];
        releases.push(
          getPathNotifier().observeEnqueue(
            getPositionRegistry(tree.$)!.id,
            (entry) => {
              if (entry.path === (dynamic ? 'rows.r' : 'x'))
                designations.push(isMetaDesignated(entry.meta));
            }
          )
        );
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
        expect(designations).toEqual([true, false]);
        if (dynamic) {
          expect(tree.canUndo()).toBe(true);
          tree.undo();
          expect(field()).toBe(0);
        }
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

// Segmenting a location's queue must retain v16's drain-all/first-error rule.
for (const failure of [new Error('delivery'), undefined]) {
  it(`drains all classified replacements after apply failure (undefined=${
    failure === undefined
  })`, () => {
    let armed = false;
    const make = createSignalTreeFactory({
      createToken: () => ({
        observe: () => undefined,
        invalidate: () => {
          if (armed) throw failure;
        },
      }),
      runInvalidationGroup: (fn) => fn(),
    });
    const tree = make({ x: 0, y: 0 }, { enhancers: [batching()] });
    owned.push(tree);
    tree.$.x();
    tree.$.y();
    armed = true;
    let caught = false;
    try {
      tree.coalesce(() => {
        undoable(() => tree.$.x(1));
        tree.$.x(2);
        undoable(() => tree.$.x(3));
        tree.$.y(4);
      });
    } catch (error) {
      caught = true;
      expect(error).toBe(failure);
    } finally {
      armed = false;
    }
    expect(caught).toBe(true);
    expect([tree.$.x(), tree.$.y()]).toEqual([3, 4]);
    tree.coalesce(() => undefined);
    expect([tree.$.x(), tree.$.y()]).toEqual([3, 4]);
  });
}

for (const derive of [false, true]) {
  it(`preserves cross-context chronology across locations (derive=${derive})`, () => {
    const tree = signalTree(
      { x: 0, y: 0 },
      { enhancers: [batching(), restoration()] }
    );
    owned.push(tree);
    const seen: unknown[] = [];
    releases.push(
      getPathNotifier().observeEnqueue(
        getPositionRegistry(tree.$)!.id,
        (entry) => {
          seen.push([entry.path, entry.newValue, entry.meta?.origin]);
        }
      )
    );
    tree.coalesce(() => {
      tree.$.x(1);
      external(() => tree.$.y(2));
      if (derive) tree.$.x((value) => value + 2);
      else tree.$.x(3);
    });
    expect(seen).toEqual([
      ['x', 1, undefined],
      ['y', 2, 'external'],
      ['x', 3, undefined],
    ]);
  });
}

it('reentrant coalesce drains its own classified writes without replaying the outer queue', () => {
  const tree = signalTree(
    { x: 0, y: 0 },
    { enhancers: [batching(), restoration()] }
  );
  owned.push(tree);
  const seen: unknown[] = [];
  releases.push(
    getPathNotifier().observeEnqueue(
      getPositionRegistry(tree.$)!.id,
      (entry) => {
        seen.push([entry.path, entry.newValue, entry.meta?.origin]);
        if (entry.path === 'x' && entry.newValue === 1) {
          tree.coalesce(() => external(() => tree.$.y(9)));
        }
      }
    )
  );
  tree.coalesce(() => {
    undoable(() => tree.$.x(1));
    tree.$.x(2);
  });
  expect(seen).toEqual([
    ['x', 1, undefined],
    ['y', 9, 'external'],
    ['x', 2, undefined],
  ]);
  expect([tree.$.x(), tree.$.y()]).toEqual([2, 9]);
  tree.coalesce(() => undefined);
  expect(seen).toHaveLength(3);
});

it('same-context updater still leaves unrelated replacements deferred', () => {
  const tree = signalTree({ x: 0, y: 0 }, { enhancers: [batching()] });
  owned.push(tree);
  tree.coalesce(() => {
    tree.$.x(1);
    tree.$.y(2);
    tree.$.x((value) => value + 2);
    expect([tree.$.x(), tree.$.y()]).toEqual([3, 0]);
  });
  expect([tree.$.x(), tree.$.y()]).toEqual([3, 2]);
});

it('retains reentrant writes during an updater-triggered earlier-context drain', () => {
  const tree = signalTree(
    { x: 0, y: 0 },
    { enhancers: [batching(), restoration()] }
  );
  owned.push(tree);
  const seen: unknown[] = [];
  releases.push(
    getPathNotifier().observeEnqueue(
      getPositionRegistry(tree.$)!.id,
      (entry) => {
        seen.push([entry.path, entry.newValue, entry.meta?.origin]);
        if (entry.path === 'x' && entry.newValue === 1) {
          tree.coalesce(() => external(() => tree.$.y(9)));
        }
      }
    )
  );
  const update = vi.fn((value: number) => {
    expect(tree.$.y()).toBe(2);
    return value + 2;
  });
  tree.coalesce(() => {
    tree.$.x(1);
    external(() => tree.$.y(2));
    tree.$.x(update);
  });
  expect(update).toHaveBeenCalledExactlyOnceWith(1);
  expect(seen).toEqual([
    ['x', 1, undefined],
    ['y', 2, 'external'],
    ['x', 3, undefined],
    ['y', 9, 'external'],
  ]);
  expect([tree.$.x(), tree.$.y()]).toEqual([3, 9]);
  tree.coalesce(() => undefined);
  expect(seen).toHaveLength(4);
});

for (const failure of [new Error('updater'), undefined]) {
  it(`throwing updater preserves predecessors and drains remaining accepted writes (undefined=${
    failure === undefined
  })`, () => {
    const tree = signalTree(
      { x: 0, y: 0, z: 0 },
      { enhancers: [batching(), restoration()] }
    );
    owned.push(tree);
    const seen: unknown[] = [];
    releases.push(
      getPathNotifier().observeEnqueue(
        getPositionRegistry(tree.$)!.id,
        (entry) => {
          seen.push([
            entry.path,
            entry.newValue,
            entry.meta?.origin,
            isMetaDesignated(entry.meta),
          ]);
        }
      )
    );
    const update = vi.fn((_value: number): number => {
      throw failure;
    });
    let caught = false;
    try {
      tree.coalesce(() => {
        undoable(() => tree.$.x(1));
        external(() => tree.$.y(2));
        tree.$.z(4);
        tree.$.x(update);
      });
    } catch (error) {
      caught = true;
      expect(error).toBe(failure);
    }
    expect(caught).toBe(true);
    expect(update).toHaveBeenCalledExactlyOnceWith(1);
    expect(seen).toEqual([
      ['x', 1, undefined, true],
      ['y', 2, 'external', false],
      ['z', 4, undefined, false],
    ]);
    expect([tree.$.x(), tree.$.y(), tree.$.z()]).toEqual([1, 2, 4]);
    tree.coalesce(() => undefined);
    expect(seen).toHaveLength(3);
  });
}
