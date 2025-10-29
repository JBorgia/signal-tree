import type { ISignal, SignalEnhancer } from '@signaltree/core';

// Minimal adaptive scheduler hooks
let lastFrame = 0;

function schedule(fn: () => void) {
  const now = Date.now();
  if (now - lastFrame > 16) {
    lastFrame = now;
    queueMicrotask(fn);
  } else setTimeout(fn, 0);
}

export const enterpriseBatchEnhancer: SignalEnhancer = {
  id: 'enterprise-batch',
  priority: 3,
  apply(signal) {
    const originalSet = signal.set.bind(signal);
    return {
      ...signal,
      set(value: any) {
        schedule(() => originalSet(value));
      },
    };
  },
};
