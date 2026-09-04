/** Angular observation plus the complete SignalTree application surface. */
import { ANGULAR_OBSERVATION_ADAPTER } from './lib/observation-adapter.js';
import { createSignalTreeFactory } from '@signal-tree/kernel/adapter';
import type { SignalTreeFactory } from '@signal-tree/kernel/adapter';

export const signalTree =
  createSignalTreeFactory(ANGULAR_OBSERVATION_ADAPTER) as SignalTreeFactory;

export * from '@signal-tree/kernel';

// Angular-owned API, which the kernel deliberately does not export.
export { defineStore, type DefineStoreConfig } from './lib/define-store.js';
export { toWritableSignal } from './lib/to-writable-signal.js';
