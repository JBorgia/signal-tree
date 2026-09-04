import { signal } from '@angular/core';

import type {
  ObservationAdapter,
  ObservationToken,
} from '@signal-tree/kernel/adapter';

/** Angular dependency tracking for kernel-owned locations. */
export const ANGULAR_OBSERVATION_ADAPTER: ObservationAdapter = {
  createToken(): ObservationToken {
    const revision = signal(0);
    return {
      observe: () => void revision(),
      invalidate: () => revision.update((value) => value + 1),
    };
  },

  runInvalidationGroup(run): void {
    run();
  },
};