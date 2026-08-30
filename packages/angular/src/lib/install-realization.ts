import { computed, isSignal, signal, untracked } from '@angular/core';
import {
  installCellRuntime,
  installDerivedRuntime,
  installMaterializationRealization,
  installScalarLeafRealization,
  installTrackingSuppression,
} from '@signal-tree/kernel/adapter';

import { ANGULAR_SCALAR_LEAF_REALIZATION } from './scalar-leaf-realization';

/**
 * Installs the Angular realization of every kernel port.
 *
 * PHYSICAL-PACKAGE-SPLIT-0. This block lived in the kernel's `signal-tree.ts`,
 * which is what made the kernel require Angular to realize its own state. It is
 * DELETED there, not conditionalized — a kernel that can still install a
 * framework has not been split from it.
 *
 * Evaluating this module is the installation. `@signal-tree/angular`'s
 * entrypoint imports it BEFORE re-exporting anything runtime-bearing, so
 * realization is in force before an application can allocate a tree or an
 * entity. That ordering is the fix for a MEASURED defect: entity APIs used
 * without first calling `signalTree()` silently got neutral kernel cells —
 * no `isSignal`, no `asReadonly`, no dependency tracking.
 *
 *     REALIZATION IS SELECTED DURING PACKAGE INITIALIZATION, NOT MUTATED AS
 *     APPLICATION STATE.
 *
 * Which is why this package must NOT claim `sideEffects: false`.
 */
let installed = false;

/**
 * Idempotently install the Angular realization.
 *
 * ⚠️ THIS MUST BE A CALLED FUNCTION, NOT A BARE `import` FOR SIDE EFFECTS.
 *
 * The root previously did `import './lib/install-realization';`. Rollup ELIDED
 * that import entirely: the packed `index.js` contained no `installCellRuntime`
 * at all, so a clean consumer installing the tarball got neutral kernel cells —
 * `isSignal` false, no `asReadonly`, no dependency tracking. Dropping
 * `sideEffects: false` from the manifest did not prevent it, because the
 * bundler judged the module pure on its own.
 *
 * A module-scope CALL of an imported binding cannot be elided, so the guarantee
 * survives bundling — including a consumer's own production tree-shake.
 */
export function ensureAngularRealization(): void {
  if (installed) return;
  installed = true;

  installMaterializationRealization({
    isReactiveNode: (node) => isSignal(node),
    memoizeSnapshot: (_node, compute) => computed(compute),
  });

installTrackingSuppression(<T,>(fn: () => T): T => untracked(fn));

  installScalarLeafRealization(ANGULAR_SCALAR_LEAF_REALIZATION);

  installDerivedRuntime({
    createDerived: <T,>(compute: () => T) => computed(compute),
  });

  // The ordinary leaf carrier. Angular's `WritableSignal` satisfies `WritableCell`
  // STRUCTURALLY, so this hands back the native object with no wrapper — one cell
  // per leaf, in Angular's own graph (S1).
  installCellRuntime({
    createCell: <T,>(initial: T, equal?: (a: T, b: T) => boolean) =>
      signal(initial, equal ? { equal } : undefined),
  });

}
