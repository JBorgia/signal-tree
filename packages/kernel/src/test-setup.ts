// Vitest global setup for @signal-tree/kernel.
//
// Initializes the Angular TestBed environment so specs that use
// `TestBed.runInInjectionContext()` / `inject(DestroyRef)` (e.g. the
// entity-loader and defineStore specs) have a platform to run against.
// Without this, those specs fail with "Cannot read properties of null
// (reading 'ngModule')". Wired via `setupFiles` in vitest.config.ts.
import '@angular/compiler';
import 'zone.js';
import 'zone.js/testing';

import { getTestBed } from '@angular/core/testing';
// BrowserDynamicTestingModule / platformBrowserDynamicTesting are deprecated
// but still functional in Angular 20 — the simplest cross-spec TestBed setup.
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting(),
  {
    errorOnUnknownElements: true,
    errorOnUnknownProperties: true,
  }
);

// ---------------------------------------------------------------------------
// TRANSITIONAL: install the Angular realization for this suite.
//
// PHYSICAL-PACKAGE-SPLIT-0 deleted the Angular binding from `signal-tree.ts`,
// so importing the kernel no longer realizes anything — which is the point. But
// this suite was written against an Angular-realized kernel and asserts
// framework behaviour (`isSignal`, memoized recomputation counts, native
// identity) in ~139 places. Those rows belong to `@signal-tree/angular`; until
// they are reattributed there, the suite installs what it is actually testing
// against instead of pretending a neutral kernel should satisfy them.
//
//     A TEST THAT ENCODES THE OLD ARCHITECTURE DOES NOT GET TO OVERRULE THE
//     NEW ARCHITECTURE — but it must not be silently dropped either.
//
// The NEUTRAL kernel is proven by the packed kernel consumer, which is the
// authoritative evidence and runs with Angular literally absent.
import { computed, isSignal, signal, untracked } from '@angular/core';
import {
  installCellRuntime,
  installDerivedRuntime,
  installMaterializationRealization,
  installScalarLeafRealization,
  installTrackingSuppression,
  type ObservationToken,
  type ScalarLeafRealization,
  type WritableCell,
} from './adapter';
import { linkedSignal } from '@angular/core';

const ANGULAR_SCALAR: ScalarLeafRealization = {
  createToken: (): ObservationToken => {
    const token = signal(0);
    return {
      observe: () => void token(),
      invalidate: () => token.update((v) => v + 1),
    };
  },
  createLeaf: <T,>(compute: () => T) =>
    linkedSignal(compute) as unknown as WritableCell<T>,
};

installMaterializationRealization({
  isReactiveNode: (node) => isSignal(node),
  memoizeSnapshot: (_node, compute) => computed(compute),
});
installTrackingSuppression(<T,>(fn: () => T): T => untracked(fn));
installScalarLeafRealization(ANGULAR_SCALAR);
installDerivedRuntime({ createDerived: <T,>(c: () => T) => computed(c) });
installCellRuntime({
  createCell: <T,>(i: T, eq?: (a: T, b: T) => boolean) =>
    signal(i, eq ? { equal: eq } : undefined),
});
