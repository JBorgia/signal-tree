import { computed, linkedSignal, signal, untracked } from '@angular/core';

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

  createWritableCell: <T,>(read: () => T) => {
    const cell = signal(read());
    const publish = cell.set.bind(cell);
    return {
      cell,
      peek: read,
      token: {
        observe: () => void cell(),
        invalidate: () => publish(read()),
      },
    };
  },

  createReadonlyCell: <T,>(compute: () => T) => computed(compute),

  createWritableProjection: <T,>(compute: () => T) => {
    const cell = linkedSignal(compute);
    return {
      cell,
      peek: () => untracked(cell),
    };
  },

  runInvalidationGroup(run): void {
    run();
  },
};
