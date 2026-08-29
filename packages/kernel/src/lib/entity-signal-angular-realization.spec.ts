/**
 * ANGULAR REALIZATION characterization for entity signals.
 *
 * These rows moved out of `entity-signal.spec.ts` during PHYSICAL-PACKAGE-SPLIT-0.
 * They assert framework identity — `isSignal`, `asReadonly`, native `Signal` —
 * which is a property of `@signal-tree/angular`, not of the kernel. The kernel
 * suite keeps the SEMANTIC rows (values, reclamation, stable cell identity).
 *
 *     MOVE FRAMEWORK ASSERTIONS. KEEP SEMANTIC ASSERTIONS WITH THEIR OWNER.
 *
 * This file is destined for `packages/angular`. Until the entrypoint owns
 * installation structurally, it imports the binding explicitly — which is
 * itself the finding: entity APIs used WITHOUT touching `signalTree()` get no
 * Angular realization today.
 */
import { describe, expect, it } from 'vitest';
import { isSignal } from '@angular/core';
import '../lib/signal-tree'; // installs the Angular realization
import { createEntitySignal } from './entity-signal';
import { PathNotifier } from './path-notifier';

const notifier = new PathNotifier();

describe('entity signals under the Angular realization', () => {
  interface User { id: number; name: string; active: boolean }
  const makeApi = () =>
    createEntitySignal<User, number>(
      { selectId: (u: User) => u.id },
      notifier,
      'users'
    );

  // TRANSFERRED from `entity-signal.spec.ts`. The kernel suite keeps the
  // semantic half of each row (the field is callable, reads current truth,
  // `.asReadonly()` returns a reader yielding 'Alice'); these are the framework
  // -identity halves, which only @signal-tree/angular can promise.
  //
  //     TEST REATTRIBUTION IS COMPLETE ONLY WHEN THE OLD ASSERTION HAS A NEW
  //     OWNER, NOT MERELY WHEN THE OLD OWNER STOPS ASSERTING IT.

  it('an entity field property is a genuine Angular signal', () => {
    const api = makeApi();
    api.addOne({ id: 1, name: 'Alice', active: true });
    const node = api.byId(1);
    expect(node).toBeDefined();
    expect(isSignal(node!.name)).toBe(true);
  });

  it('.asReadonly() returns a genuine Angular signal', () => {
    const api = makeApi();
    api.addOne({ id: 1, name: 'Alice', active: true });
    const ro = api.byId(1)!.name.asReadonly();
    expect(isSignal(ro)).toBe(true);
    expect(ro()).toBe('Alice');
  });

  it('.empty is a genuine Angular Signal with stable identity', () => {
    const api = createEntitySignal(
      { selectId: (e: { id: number }) => e.id },
      notifier,
      'test'
    );
    expect(api.empty).toBe(api.empty);
    expect(isSignal(api.empty)).toBe(true);
  });
});
