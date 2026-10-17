import {
  createReactiveTestRealization,
  observeReactiveTestValue,
} from '../reactive-test-realization';
import { createSignalTreeFactory } from './signal-tree';
import { describe, expect, it } from 'vitest';
import { signalTree, restoration } from '../index';
import { nativeOwnershipExperiment } from './internals/native-ownership-driver-experiment';
import {
  materializeMember,
  ordinaryBranch,
  registerMarkerProcessor,
} from './internals/materialize-markers';
import { getPathNotifier } from './path-notifier';
import { onTreeError } from './internals/error-reporter';
import { observeOwnerInvalidation } from '../adapter';
import { getPositionRegistry } from './internals/position-registry';
import { getOwnedPositionIds } from './internals/owned-metadata';
import { getTreeScalarSlotRuntime } from './internals/tree-scalar-slot-port';
const marker = Symbol('native-b-r1-dynamic');
registerMarkerProcessor(
  (value: unknown): value is { [marker]: true } =>
    typeof value === 'object' && value !== null && marker in value,
  () => ordinaryBranch({ seed: 0 }, { keyedLookup: true })
);
const make = () => {
  const tree = signalTree(
    { x: 0, y: 0, members: { [marker]: true as const } },
    { enhancers: [restoration()] }
  );
  const members = tree.$.members as unknown as (
    value?: Record<string, unknown>
  ) => Record<string, unknown>;
  void members();
  const b = nativeOwnershipExperiment(tree.$);
  return {
    tree,
    members,
    b,
    dispose() {
      b.destroy();
      tree.destroy();
    },
  };
};
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
type Branch = ((value?: object) => Record<string, unknown>) & {
  x: (value?: number) => number;
  y: (value?: number) => number;
};

describe('native ownership R1 installation and publication', () => {
  it('capture failure leaves new identity undiscoverable and retry succeeds', () => {
    const { members, b, dispose } = make();
    const error = new Error('prepare');
    try {
      b.fail(error);
      expect(() =>
        b.begin(() => materializeMember(members, 'new', undefined))
      ).toThrow(error);
      expect(Object.prototype.hasOwnProperty.call(members, 'new')).toBe(false);
      const index = (
        members as unknown as Record<symbol, Map<string, unknown>>
      )[Symbol.for('SignalTree:DynamicKeyIndex')];
      expect(index.has('new')).toBe(false);
      expect(b.stats()).toEqual({ pending: 0, ledgers: 0 });
      const p = b.begin(() => materializeMember(members, 'new', undefined));
      expect(Object.keys(members())).toContain('new');
      p.rollback();
      expect(Object.keys(members())).not.toContain('new');
    } finally {
      dispose();
    }
  });
  it('record replacement, deletion, and reacquisition preserve retained identity', () => {
    const { members, b, dispose } = make();
    try {
      const child = materializeMember(members, 'new', { x: 1, y: 2 }) as Branch;
      const replace = b.begin(() =>
        materializeMember(members, 'new', { x: 3, y: 4 })
      );
      replace.rollback();
      expect(child()).toEqual({ x: 1, y: 2 });
      const remove = b.begin(() => members({ seed: 0 }));
      expect(child()).toBeUndefined();
      remove.rollback();
      expect(child()).toEqual({ x: 1, y: 2 });
      members({ seed: 0 });
      const reacquire = b.begin(() =>
        materializeMember(members, 'new', { x: 1, y: 2 })
      );
      reacquire.rollback();
      expect(child()).toBeUndefined();
      expect(materializeMember(members, 'new', { x: 5, y: 6 })).toBe(child);
      expect(child()).toEqual({ x: 5, y: 6 });
    } finally {
      dispose();
    }
  });
  it.each(['older-first', 'newer-first'] as const)(
    'overlap retains hidden values and dependencies (%s)',
    (order) => {
      const { members, b, dispose } = make();
      let child!: Branch;
      try {
        const creation = b.begin(() => {
          child = materializeMember(members, 'new', { x: 1, y: 2 }) as Branch;
        });
        const update = b.begin(() => child.x(3));
        if (order === 'older-first') {
          creation.rollback();
          expect(child()).toEqual({ x: 3, y: 2 });
          update.rollback();
        } else {
          update.rollback();
          expect(child()).toEqual({ x: 1, y: 2 });
          creation.rollback();
        }
        expect(Object.keys(members())).not.toContain('new');
        expect(b.stats()).toEqual({ pending: 0, ledgers: 0 });
      } finally {
        dispose();
      }
    }
  );
  it('newer ordinary descendant truth prevents disappearing membership', () => {
    const { members, b, dispose } = make();
    let child!: Branch;
    try {
      const p = b.begin(() => {
        child = materializeMember(members, 'new', { x: 1, y: 2 }) as Branch;
      });
      child.x(3);
      p.rollback();
      expect(child()).toEqual({ x: 3, y: 2 });
      expect(Object.keys(members())).toContain('new');
      expect(b.stats()).toEqual({ pending: 0, ledgers: 0 });
    } finally {
      dispose();
    }
  });
  it('new nested branch deletion is captured before its publication', () => {
    const { members, b, dispose } = make();
    try {
      const child = materializeMember(members, 'new', { x: 1, y: 2 }) as Branch;
      const p = b.begin(() => child({ x: 3 }));
      expect(child()).toEqual({ x: 3 });
      p.rollback();
      expect(child()).toEqual({ x: 1, y: 2 });
    } finally {
      dispose();
    }
  });
  it('prepares every target before changing any scalar or membership and retry works', () => {
    const { tree, members, b, dispose } = make();
    try {
      const p = b.begin(() => {
        tree.$.x(1);
        materializeMember(members, 'new', undefined);
      });
      const descriptor = Object.getOwnPropertyDescriptor(members, 'new')!;
      // Controlled stale-handle fault; restore before retry. No partial x installation.
      Object.defineProperty(members, 'new', { ...descriptor, value: () => 99 });
      expect(() => p.rollback()).toThrow();
      expect(tree.$.x()).toBe(1);
      expect(b.stats().pending).toBe(1);
      Object.defineProperty(members, 'new', descriptor);
      p.rollback();
      expect(tree.$.x()).toBe(0);
      expect(Object.keys(members())).not.toContain('new');
    } finally {
      dispose();
    }
  });
  it('mixed native, path and owner delivery sees complete state with retired authority', async () => {
    const { tree, members, b, dispose } = make();
    const seen: unknown[] = [];
    let delivery = false;
    const off = getPathNotifier().subscribe(
      '**',
      (_v, _before, _path, _owner, _origin, _s, _p, meta) => {
        if (delivery && meta?.participation === 'realized')
          seen.push([tree.$.x(), Object.keys(members()), b.stats().pending]);
      }
    );
    const owner = observeOwnerInvalidation(tree, () => {
      if (delivery)
        seen.push([tree.$.x(), Object.keys(members()), b.stats().pending]);
    });
    try {
      const p = b.begin(() => {
        tree.$.x(1);
        materializeMember(members, 'new', undefined);
      });
      await flush();
      delivery = true;
      p.rollback();
      await flush();
      expect(seen.length).toBeGreaterThan(0);
      for (const value of seen) expect(value).toEqual([0, ['seed'], 0]);
    } finally {
      off();
      owner();
      dispose();
    }
  });
  it('path observers may author writes, ABA and nested settlement after outer terminality', async () => {
    const { tree, b, dispose } = make();
    let armed = false;
    let nested = false;
    const off = getPathNotifier().subscribe(
      'x',
      (value, _before, _path, _owner, _origin, _s, _p, meta) => {
        if (!armed || value !== 0 || meta?.participation !== 'realized') return;
        armed = false;
        expect(b.stats().pending).toBe(0);
        tree.$.x(8);
        tree.$.x(0);
        tree.$.x(9);
        const q = b.begin(() => tree.$.y(7));
        q.rollback();
        nested = true;
      }
    );
    try {
      const p = b.begin(() => tree.$.x(1));
      await flush();
      armed = true;
      p.rollback();
      await flush();
      expect(nested).toBe(true);
      expect(tree.$.x()).toBe(9);
      expect(tree.$.y()).toBe(0);
      expect(b.stats()).toEqual({ pending: 0, ledgers: 0 });
    } finally {
      off();
      dispose();
    }
  });
  it('contained path observer throws do not retain authority or block useful retry', async () => {
    const { tree, b, dispose } = make();
    const thrown = Object.freeze({ failure: true });
    const errors: unknown[] = [];
    let seen = 0;
    const errorOff = onTreeError((event) => errors.push(event.error));
    const off = getPathNotifier().subscribe(
      'x',
      (_v, _b, _p, _o, _origin, _s, _positions, meta) => {
        if (meta?.participation === 'realized') throw thrown;
      }
    );
    const other = getPathNotifier().subscribe(
      'x',
      (_v, _b, _p, _o, _origin, _s, _positions, meta) => {
        if (meta?.participation === 'realized') seen++;
      }
    );
    try {
      const p = b.begin(() => tree.$.x(1));
      await flush();
      p.rollback();
      await flush();
      p.rollback();
      expect(errors).toContain(thrown);
      expect(seen).toBe(1);
      expect(tree.$.x()).toBe(0);
      expect(b.stats()).toEqual({ pending: 0, ledgers: 0 });
    } finally {
      off();
      other();
      errorOff();
      dispose();
    }
  });
  it('realized notifications retain before/after, origin, owner and positions', async () => {
    const { tree, b, dispose } = make();
    const seen: unknown[] = [];
    const off = getPathNotifier().subscribe(
      'x',
      (after, before, _p, _o, origin, _s, positions, meta) => {
        if (meta?.participation === 'realized')
          seen.push({
            after,
            before,
            origin,
            positions,
            ownerId: meta.ownerId,
          });
      }
    );
    try {
      const p = b.begin(() => tree.$.x(1));
      await flush();
      p.rollback();
      await flush();
      expect(seen).toEqual([
        {
          after: 0,
          before: 1,
          origin: 'transaction-rollback',
          positions: getOwnedPositionIds(tree.$.x),
          ownerId: getPositionRegistry(tree.$)?.id,
        },
      ]);
    } finally {
      off();
      dispose();
    }
  });
  it('raw prepared scalar frames still reconcile pending native truth', () => {
    const { tree, b, dispose } = make();
    try {
      const p = b.begin(() => tree.$.x(1));
      const runtime = getTreeScalarSlotRuntime(tree.$)!;
      const slot = runtime.resolveScalarSlot(
        getOwnedPositionIds(tree.$.x)![0]
      )!;
      const frame = runtime.beginFrame();
      frame.set(slot, 7);
      frame.commit();
      p.rollback();
      expect(tree.$.x()).toBe(7);
    } finally {
      dispose();
    }
  });
  it('hidden restored scalar is not announced as exposed path truth', async () => {
    const tree = signalTree({ box: { x: 1 } } as { box: { x: number } }, {
      enhancers: [restoration()],
    });
    const b = nativeOwnershipExperiment(tree.$);
    const seen: unknown[] = [];
    const off = getPathNotifier().subscribe('box.x', (value) => {
      seen.push(value);
    });
    try {
      Reflect.apply(tree.$, undefined, [{}]);
      await flush();
      const p = b.begin(() => tree.$.box.x(2));
      await flush();
      seen.length = 0;
      p.rollback();
      await flush();
      expect(tree.$.box.x()).toBeUndefined();
      expect(seen).toEqual([]);
    } finally {
      off();
      b.destroy();
      tree.destroy();
    }
  });
  it('failed callback retains original precedence after abort delivery throws', () => {
    const realization = createReactiveTestRealization();
    const factory = createSignalTreeFactory(realization);
    const tree = factory({ x: 0 }, { enhancers: [restoration()] });
    const b = nativeOwnershipExperiment(tree.$);
    const original = Object.freeze(new Error('callback')),
      delivery = new Error('delivery');
    let armed = false;
    let caught: unknown;
    observeReactiveTestValue(
      () => tree.$.x(),
      (value) => {
        if (armed && value === 0) throw delivery;
      }
    );
    try {
      try {
        b.begin(() => {
          tree.$.x(1);
          armed = true;
          throw original;
        });
      } catch (error) {
        caught = error;
      }
      expect(caught).toBe(original);
      expect(tree.$.x()).toBe(0);
      expect(b.stats()).toEqual({ pending: 0, ledgers: 0 });
    } finally {
      b.destroy();
      tree.destroy();
    }
  });
  it('synchronous native delivery sees full installation and may author newer state', () => {
    const realization = createReactiveTestRealization();
    const factory = createSignalTreeFactory(realization);
    const tree = factory(
      { x: 0, box: { a: 1, b: 2 } as { a: number; b?: number } },
      { enhancers: [restoration()] }
    );
    const b = nativeOwnershipExperiment(tree.$);
    const seen: unknown[] = [];
    let armed = false;
    observeReactiveTestValue(
      () => [tree.$.x(), tree.$.box()],
      (value) => {
        if (!armed) return;
        seen.push([value, b.stats().pending]);
        if (tree.$.x() === 0) {
          armed = false;
          tree.$.x(9);
        }
      }
    );
    try {
      const p = b.begin(() => {
        tree.$.x(1);
        tree.$.box({ a: 3 });
      });
      armed = true;
      p.rollback();
      expect(seen).toEqual([[[0, { a: 1, b: 2 }], 0]]);
      expect(tree.$.x()).toBe(9);
      expect(b.stats()).toEqual({ pending: 0, ledgers: 0 });
    } finally {
      b.destroy();
      tree.destroy();
    }
  });
  it('presence-only ancestor restoration does not reactivate independently omitted sibling', () => {
    const tree = signalTree(
      { box: { a: 1, b: 2 } } as { box: { a: number; b?: number } },
      { enhancers: [restoration()] }
    );
    const b = nativeOwnershipExperiment(tree.$);
    try {
      tree.$.box({ a: 1 });
      const p = b.begin(() => Reflect.apply(tree.$, undefined, [{}]));
      p.rollback();
      expect(tree.$.box()).toEqual({ a: 1 });
      expect(tree.$.box.b!()).toBeUndefined();
    } finally {
      b.destroy();
      tree.destroy();
    }
  });
  it('fallible equality reentry remains authored while an older settlement refuses', () => {
    const initial = [0];
    const tree = signalTree(
      { values: initial, x: 0 },
      { enhancers: [restoration()] }
    );
    const b = nativeOwnershipExperiment(tree.$);
    let armed = false;
    try {
      const p = b.begin(() => tree.$.values([1]));
      const q = b.begin(() => tree.$.x(1));
      Object.defineProperty(initial, '0', {
        configurable: true,
        enumerable: true,
        get() {
          if (armed) {
            armed = false;
            tree.$.x(9);
          }
          return 0;
        },
      });
      armed = true;
      expect(() => p.rollback()).toThrow();
      expect(tree.$.values()).toEqual([1]);
      expect(tree.$.x()).toBe(9);
      expect(b.stats().pending).toBe(2);
      q.rollback();
      expect(tree.$.x()).toBe(9);
      p.rollback();
      expect(tree.$.values()).toEqual([0]);
      expect(b.stats()).toEqual({ pending: 0, ledgers: 0 });
    } finally {
      b.destroy();
      tree.destroy();
    }
  });
  it('settlement invalidates scalar frames staged against its older physical revision', () => {
    const { tree, b, dispose } = make();
    try {
      const p = b.begin(() => tree.$.x(1));
      const runtime = getTreeScalarSlotRuntime(tree.$)!;
      const frame = runtime.beginFrame();
      frame.set(
        runtime.resolveScalarSlot(getOwnedPositionIds(tree.$.x)![0])!,
        9
      );
      p.rollback();
      expect(tree.$.x()).toBe(0);
      expect(() => frame.commit()).toThrow();
      expect(tree.$.x()).toBe(0);
    } finally {
      dispose();
    }
  });
});
