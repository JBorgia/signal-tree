import type { ISignal, SignalEnhancer } from '../../src/lib/types';

/** Convert a promise to a signal-like updater pattern */
export async function fromPromise<T>(p: Promise<T>, into: ISignal<T>) {
  try {
    into.set(await p);
  } catch (e) {
    console.error('[SignalTree] async error:', e);
  }
}

export const asyncEnhancer: SignalEnhancer = {
  id: 'async',
  priority: 2,
  apply(signal) {
    return signal;
  }, // helpers are opt-in
};
