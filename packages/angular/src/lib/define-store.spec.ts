import {
  createEnvironmentInjector,
  EnvironmentInjector,
  ErrorHandler,
  inject,
  Injectable,
  InjectionToken,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

import { asReadonly, defineStore } from '../index';
import { signalTree } from '../index';

describe('defineStore()', () => {
  it('injects the real tree with $ and full API', () => {
    const CounterStore = defineStore(() =>
      signalTree({ count: 0, user: { name: 'a' } })
    );

    TestBed.configureTestingModule({ providers: [CounterStore] });
    const store = TestBed.inject(CounterStore);

    // Reads via $
    expect(store.$.count()).toBe(0);
    expect(store.$.user.name()).toBe('a');

    // Per-leaf writes
    store.$.count.set(5);
    store.$.user.name.set('b');
    expect(store.$.count()).toBe(5);
    expect(store.$.user.name()).toBe('b');

    // The constructor returned the tree controller itself.
    expect(store.$()).toEqual({ count: 5, user: { name: 'b' } });
  });

  it('runs the factory in an injection context (inject() works inside it)', () => {
    const SEED = new InjectionToken<number>('SEED', { factory: () => 42 });
    const SeededStore = defineStore(() => signalTree({ value: inject(SEED) }));

    TestBed.configureTestingModule({ providers: [SeededStore] });
    const store = TestBed.inject(SeededStore);

    expect(store.$.value()).toBe(42);
  });

  it('ties tree.destroy() to the injector lifecycle (DestroyRef)', () => {
    const DisposableStore = defineStore(() => signalTree({ n: 1 }));

    TestBed.configureTestingModule({ providers: [DisposableStore] });
    const store = TestBed.inject(DisposableStore);
    expect(store.destroyed()).toBe(false);

    // Destroying the providing injector fires DestroyRef.onDestroy → tree.destroy()
    TestBed.resetTestingModule();
    expect(store.destroyed()).toBe(true);
  });

  it('supports providedIn: "root" as an app-wide singleton', () => {
    const RootStore = defineStore(() => signalTree({ ready: true }), {
      providedIn: 'root',
    });

    TestBed.configureTestingModule({});
    const a = TestBed.inject(RootStore);
    const b = TestBed.inject(RootStore);

    expect(a).toBe(b); // singleton
    expect(a.$.ready()).toBe(true);
  });

  it('preserves configured enhancer methods in the factory', () => {
    // A trivial enhancer that tags the tree with a method.
    const tagged = <T extends object>(tree: T): T & { tag(): string } =>
      Object.assign(tree, { tag: () => 'tagged' });

    const TaggedStore = defineStore(() =>
      signalTree({ x: 1 }, { enhancers: [tagged] })
    );

    TestBed.configureTestingModule({ providers: [TaggedStore] });
    const store = TestBed.inject(TaggedStore);

    expect(store.tag()).toBe('tagged');
    expect(store.$.x()).toBe(1);
  });
});

describe('defineStore ownership contract', () => {
  it.each([null, undefined, 42, 'store', true, BigInt(1), Symbol('store')])(
    'rejects primitive factory results at the JavaScript boundary: %s',
    (value) => {
      // JavaScript callers and erased casts must receive an actionable failure.
      const InvalidStore = defineStore(
        (() => value) as unknown as () => object
      );
      const owner = createEnvironmentInjector(
        [InvalidStore],
        TestBed.inject(EnvironmentInjector)
      );
      try {
        expect(() => owner.get(InvalidStore)).toThrow(
          '[SignalTree] defineStore factory must return an object or function.'
        );
      } finally {
        owner.destroy();
      }
    }
  );

  it('preserves supported object and callable factory results by identity', () => {
    const object = { count: 0 };
    const callable = () => 42;
    const ObjectStore = defineStore(() => object);
    const CallableStore = defineStore(() => callable);
    const owner = createEnvironmentInjector(
      [ObjectStore, CallableStore],
      TestBed.inject(EnvironmentInjector)
    );
    try {
      expect(owner.get(ObjectStore)).toBe(object);
      expect(owner.get(CallableStore)).toBe(callable);
      expect(owner.get(CallableStore)()).toBe(42);
    } finally {
      owner.destroy();
    }
  });

  it('reports teardown failures without abandoning later owned trees', () => {
    const failure = new Error('owned resource cleanup failed');
    const report = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const ResourceStore = defineStore(() => ({
      destroy() {
        throw failure;
      },
    }));
    const SiblingStore = defineStore(() => signalTree({ count: 0 }));
    const owner = createEnvironmentInjector(
      [ResourceStore, SiblingStore],
      TestBed.inject(EnvironmentInjector)
    );
    try {
      owner.get(ResourceStore);
      const sibling = owner.get(SiblingStore);
      expect(() => owner.destroy()).not.toThrow();
      expect(report).toHaveBeenCalledExactlyOnceWith('ERROR', failure);
      expect(sibling.destroyed()).toBe(true);
    } finally {
      if (!owner.destroyed) owner.destroy();
      report.mockRestore();
    }
  });

  it('allows the application ErrorHandler to depend on a diagnostic store', () => {
    const DiagnosticStore = defineStore(() => signalTree({ errors: 0 }));
    @Injectable()
    class DiagnosticHandler extends ErrorHandler {
      readonly diagnostics = inject(DiagnosticStore);
      override handleError(): void {
        this.diagnostics.$.errors.update((count) => count + 1);
      }
    }
    const owner = createEnvironmentInjector(
      [DiagnosticStore, { provide: ErrorHandler, useClass: DiagnosticHandler }],
      TestBed.inject(EnvironmentInjector)
    );
    try {
      const handler = owner.get(ErrorHandler) as DiagnosticHandler;
      const diagnostics = owner.get(DiagnosticStore);
      expect(handler.diagnostics).toBe(diagnostics);
      handler.handleError();
      expect(diagnostics.$.errors()).toBe(1);
      owner.destroy();
      expect(diagnostics.destroyed()).toBe(true);
    } finally {
      if (!owner.destroyed) owner.destroy();
    }
  });

  it('does not treat an ordinary destroy data field as a teardown method', () => {
    const Store = defineStore(() => ({ destroy: 42 }));
    const owner = createEnvironmentInjector(
      [Store],
      TestBed.inject(EnvironmentInjector)
    );
    expect(owner.get(Store).destroy).toBe(42);
    expect(() => owner.destroy()).not.toThrow();
  });

  it('preserves the receiver when invoking an owned teardown method', () => {
    const Store = defineStore(() => ({
      released: false,
      destroy() {
        this.released = true;
      },
    }));
    const owner = createEnvironmentInjector(
      [Store],
      TestBed.inject(EnvironmentInjector)
    );
    const value = owner.get(Store);
    owner.destroy();
    expect(value.released).toBe(true);
  });

  it('allows an already destroyed tree to reach its injector teardown', () => {
    const Store = defineStore(() => signalTree({ count: 0 }));
    const owner = createEnvironmentInjector(
      [Store],
      TestBed.inject(EnvironmentInjector)
    );
    const tree = owner.get(Store);
    tree.destroy();
    expect(() => owner.destroy()).not.toThrow();
    expect(tree.destroyed()).toBe(true);
  });

  it('shares one tree between readonly readers and Ops without transferring ownership', () => {
    const CounterTree = defineStore(() =>
      signalTree(
        { count: 0 },
        {
          derived: ($) => ({ doubled: () => $.count() * 2 }),
        }
      )
    );
    @Injectable()
    class CounterOps {
      private readonly tree = inject(CounterTree);
      readonly state = asReadonly(this.tree).$;
      increment() {
        this.tree.$.count.update((count) => count + 1);
      }
    }
    const COUNTER_STATE = new InjectionToken<CounterOps['state']>(
      'CounterState'
    );
    const providers = [
      CounterTree,
      CounterOps,
      {
        provide: COUNTER_STATE,
        useFactory: () => inject(CounterOps).state,
      },
    ];
    const parent = TestBed.inject(EnvironmentInjector);
    const owner = createEnvironmentInjector(providers, parent);
    const independent = createEnvironmentInjector(providers, parent);
    const consumer = createEnvironmentInjector([], owner);
    const tree = owner.get(CounterTree);
    const destroy = vi.spyOn(tree, 'destroy');
    try {
      const reads = consumer.get(COUNTER_STATE);
      const ops = consumer.get(CounterOps);
      expect(reads).toBe(ops.state);
      expect(reads).toBe(tree.$);
      expect(reads.doubled()).toBe(0);
      ops.increment();
      expect(reads.count()).toBe(1);
      expect(reads.doubled()).toBe(2);
      expect(independent.get(COUNTER_STATE).count()).toBe(0);
      consumer.destroy();
      expect(destroy).not.toHaveBeenCalled();
      expect(tree.destroyed()).toBe(false);
    } finally {
      if (!consumer.destroyed) consumer.destroy();
      independent.destroy();
      owner.destroy();
    }
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(tree.destroyed()).toBe(true);
  });
});
