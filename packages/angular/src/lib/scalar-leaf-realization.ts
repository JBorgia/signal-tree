import { linkedSignal, signal } from '@angular/core';

import type {
  ObservationToken,
  ScalarLeafRealization,
  WritableCell,
} from '@signal-tree/kernel/adapter';

/**
 * The ANGULAR realization of scalar leaves. Framework mechanism only.
 *
 * SCALAR-REALIZATION-SEAM-0 = SR-A. What used to be a 200-line module owning
 * slot bookkeeping, publication rules, production accounting, membership
 * dormancy and reactivation is now this: a dependency token and a read-through
 * leaf. It imports NOTHING from the kernel but two type declarations — no
 * member-membership, no PhysicalCommitClock, no production stats, no physical
 * slot runtime, no position ids.
 *
 * That is the discriminator: a hypothetical `@signal-tree/fake-reactive` could
 * be written against this same contract with a counter and a closure.
 */
export const ANGULAR_SCALAR_LEAF_REALIZATION: ScalarLeafRealization = {
  createToken(): ObservationToken {
    // A per-slot dependency carrier. Reading it inside a computation creates
    // the edge; bumping it invalidates every reader. The kernel decides WHEN.
    const token = signal(0);
    return {
      observe: () => void token(),
      invalidate: () => token.update((value) => value + 1),
    };
  },

  createLeaf<T>(compute: () => T): WritableCell<T> {
    // `linkedSignal` gives a WRITABLE cell whose value derives from `compute`,
    // which is exactly the shape the kernel needs: it overwrites `set`/`update`
    // with its own write semantics, so this never learns what a write means.
    // S1: this IS the native Angular cell handed to consumers — no wrapper.
    return linkedSignal(compute) as unknown as WritableCell<T>;
  },

  runInvalidationGroup(run): void {
    run();
  },
};

