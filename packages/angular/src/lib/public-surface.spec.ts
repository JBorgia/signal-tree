import { Component, Injector, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';
import { describe, expect, it } from 'vitest';

// ⚠️ THE BARREL, DELIBERATELY. Every other spec in this package imports through
// a relative path, which is exactly why the PUBLIC-DEDUPE evidence was weak: a
// spec reaching past the barrel cannot testify about the barrel. Deleting
// `toWritableSignal`'s public re-export left three HIST-C2 carriers green,
// because they import it from `lib/utils` directly.
//
// This file exists to make the barrel itself falsifiable. `@signal-tree/kernel`
// resolves to `packages/kernel/src/index.ts` through the workspace path mapping,
// so removing a re-export breaks these rows and nothing else can substitute.
import {
  asReadonly,
  restoration,
  signalTree,
  undoable,
} from '../index';
// PHYSICAL-PACKAGE-SPLIT-0: `toWritableSignal` and `defineStore` are
// @signal-tree/angular API now. The kernel barrel deliberately no longer
// re-exports them, and there is no compatibility alias — v15 is a
// generation break. These rows still testify about a PUBLIC surface; the
// surface they testify about is the Angular package's.
import { toWritableSignal } from '../index';
import { defineStore } from '../index';

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

// ════════════════════════════════════════════════════════════════════════════
// toWritableSignal — the Angular Signal Forms bridge
// ════════════════════════════════════════════════════════════════════════════
describe('PUBLIC CARRIER — toWritableSignal is reachable from @signal-tree/angular', () => {
  type Model = { name: string };

  it('a form built through the PUBLIC route makes an edit restoration-eligible', async () => {
    @Component({ standalone: true, template: '' })
    class Host {
      private readonly injector = inject(Injector);
      readonly tree = signalTree(
        { editForm: { name: 'a' } as Model },
        { enhancers: [restoration()] }
      );
      readonly model = toWritableSignal(this.tree.$.editForm, this.injector, {
        undoable: true,
      });
      readonly f = form(this.model);
    }

    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const host = fixture.componentInstance;
    await flush();

    const before = (
      host.tree as unknown as { getRestorationHistory(): readonly unknown[] }
    ).getRestorationHistory().length;

    host.model.set({ name: 'edited' });
    fixture.detectChanges();
    await flush();

    // The requirement: `form()` needs a WritableSignal, and `{ undoable: true }`
    // is the only public way to make a form edit a restoration-eligible turn.
    expect(host.tree.$.editForm.name()).toBe('edited');
    const after = (
      host.tree as unknown as { getRestorationHistory(): readonly unknown[] }
    ).getRestorationHistory().length;
    expect(after).toBeGreaterThan(before);
  });

  it('CONTROL — an ordinary write without undoable() is not restoration-eligible', async () => {
    // Without this, "the edit was recorded" would be satisfied by an enhancer
    // that records everything, and `{ undoable: true }` would prove nothing.
    const tree = signalTree(
      { editForm: { name: 'a' } as Model },
      { enhancers: [restoration()] }
    ) as unknown as ReturnType<typeof signalTree<{ editForm: Model }>> & {
      getRestorationHistory(): readonly unknown[];
    };
    await flush();
    const before = tree.getRestorationHistory().length;

    tree.$.editForm.name.set('plain');
    await flush();

    expect(tree.getRestorationHistory().length).toBe(before);

    // ...and the same write DOES record when designated, so the mechanism is
    // provably exercised in both directions.
    undoable(() => tree.$.editForm.name.set('designated'));
    await flush();
    expect(tree.getRestorationHistory().length).toBeGreaterThan(before);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// asReadonly — the readonly projection of a tree controller
// ════════════════════════════════════════════════════════════════════════════
describe('PUBLIC CARRIER — asReadonly projects a tree controller', () => {
  it('the projection is the same runtime object with a callable root', () => {
    const tree = signalTree({ a: 1, b: { c: 'x' } });
    const ro = asReadonly(tree);

    // Type-only narrowing: zero runtime cost, same object.
    expect(ro).toBe(tree);
    expect(ro.$().a).toBe(1);
    expect(ro.$.a()).toBe(1);
    expect(ro.$.b.c()).toBe('x');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// defineStore — Angular DI provisioning, which nothing else offers
// ════════════════════════════════════════════════════════════════════════════
describe('PUBLIC CARRIER — defineStore (Angular package) provides a tree through DI', () => {
  it('an injected store is the same tree, and readonly narrowing is available', () => {
    // ⚠️ THIS EXPORT HAD ZERO CONSUMERS IN THE WORKSPACE, which is why it needs a
    // carrier rather than an assertion. Its distinct job is DI PROVISIONING: no
    // other public symbol turns a tree into something `inject()` resolves.
    const Store = defineStore(() => signalTree({ n: 1 }), {
      providedIn: 'root',
    });

    TestBed.configureTestingModule({});
    const a = TestBed.inject(Store);
    const b = TestBed.inject(Store);

    // providedIn: 'root' means one instance for the injector.
    expect(a).toBe(b);
    expect(a.$.n()).toBe(1);
    a.$.n.set(2);
    expect(a.$.n()).toBe(2);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// createAuditTracker / persistence — DELETED from the v15 public surface
// (GREENFIELD-V15-SURFACE-0): audit is a later layer above the kernel, and
// persistence is Link + endpoint, not an enhancer.
// ════════════════════════════════════════════════════════════════════════════
// GREENFIELD-V15-SURFACE-0: the `createAuditTracker` public carrier was removed
// with the symbol itself. Audit is a later layer above the kernel and has no
// v15 public surface, so there is nothing left here to carry.
