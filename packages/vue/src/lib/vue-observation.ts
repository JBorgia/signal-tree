import { shallowRef, triggerRef } from 'vue';

import type {
  ObservationAdapter,
  ObservationToken,
} from '@signal-tree/kernel/adapter';

export const VUE_OBSERVATION_ADAPTER: ObservationAdapter = {
  createToken(): ObservationToken {
    const revision = shallowRef(0);
    return {
      observe: () => void revision.value,
      invalidate: () => {
        triggerRef(revision);
      },
    };
  },

  runInvalidationGroup(run): void {
    run();
  },
};
