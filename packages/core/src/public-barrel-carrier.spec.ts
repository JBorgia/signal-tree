/* eslint-disable @nx/enforce-module-boundaries -- THE SUBJECT IS THE BARREL.
 * The rule exists so a project does not round-trip through its own package name
 * for ordinary code, and it is right. But it is also the reason this package had
 * NO test that could observe its own public export list: every spec imports
 * relatively, so deleting a re-export left them all green while breaking every
 * external consumer.
 *
 * A SPEC REACHING PAST THE BARREL CANNOT TESTIFY ABOUT THE BARREL. These two
 * files are the deliberate exception, and the only ones. */
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
// This file exists to make the barrel itself falsifiable. `@signaltree/core`
// resolves to `packages/core/src/index.ts` through the workspace path mapping,
// so removing a re-export breaks these rows and nothing else can substitute.
import {
  asReadonly,
  createAuditTracker,
  defineStore,
  restoration,
  signalTree,
  toWritableSignal,
  undoable,
} from '@signaltree/core';

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

// ════════════════════════════════════════════════════════════════════════════
// toWritableSignal — the Angular Signal Forms bridge
// ════════════════════════════════════════════════════════════════════════════
describe('PUBLIC CARRIER — toWritableSignal is reachable from the barrel', () => {
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
// asReadonly — the readonly projection of a CALLABLE tree
// ════════════════════════════════════════════════════════════════════════════
describe('PUBLIC CARRIER — asReadonly projects a callable tree', () => {
  it('the projection is the same runtime object, and stays callable', () => {
    const tree = signalTree({ a: 1, b: { c: 'x' } });
    const ro = asReadonly(tree);

    // Type-only narrowing: zero runtime cost, same object.
    expect(ro).toBe(tree);
    // The callable contract survives — this is the part the type annotation
    // cannot express (see the typing rows below).
    expect((ro as unknown as () => { a: number })().a).toBe(1);
    expect(ro.$.a()).toBe(1);
    expect(ro.$.b.c()).toBe('x');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// defineStore — Angular DI provisioning, which nothing else offers
// ════════════════════════════════════════════════════════════════════════════
describe('PUBLIC CARRIER — defineStore provides a tree through Angular DI', () => {
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
// createAuditTracker — self-attaching change log
// ════════════════════════════════════════════════════════════════════════════
describe('PUBLIC CARRIER — createAuditTracker records changes', () => {
  it('entries accumulate, and the returned stop function ends it', async () => {
    const tree = signalTree({ n: 0 });
    const log: unknown[] = [];
    // Its distinct job vs the deleted createAuditCallback: it ATTACHES ITSELF,
    // so it needs no handler signature from the caller — which is exactly what
    // made the callback form unusable against the public `subscribe`.
    // ⚠️ IT NEEDS THE CALLABLE TREE, NOT `tree.$`. The declared parameter is
    // `NodeAccessor<T>`, which `tree.$` satisfies structurally — and passing it
    // throws "tree is not a function" at runtime, because the namespace is a
    // plain object. Same class of defect as LINK-ROOT-SOURCE-0: a type admits a
    // node the implementation cannot read. Recorded here rather than silently
    // worked around.
    const stop = createAuditTracker(tree as never, log as never, {
      includePreviousValues: true,
    });

    // ⚠️ IT POLLS AT 100ms. There is no interval option, and core's tree has no
    // `subscribe`, so the tracker always takes its polling fallback — the
    // "zero-polling in Angular contexts" claim in its own doc comment holds only
    // for a tree that exposes subscribe. Pre-existing, recorded, not fixed here.
    tree.$.n.set(1);
    await new Promise((r) => setTimeout(r, 250));
    const during = log.length;

    stop();
    tree.$.n.set(2);
    await new Promise((r) => setTimeout(r, 250));

    expect(during).toBeGreaterThan(0);
    expect(log.length).toBe(during);
  });
});
