/**
 * `@signal-tree/vue` provides Vue observation over kernel-owned locations.
 *
 * Direct location reads participate in Vue dependency tracking while values,
 * writes, equality, subscriptions, and derived state remain kernel-owned.
 *
 * @packageDocumentation
 */
import {
  createSignalTreeFactory,
  type SignalTreeFactory,
} from '@signal-tree/kernel/adapter';

import { VUE_OBSERVATION_ADAPTER } from './lib/vue-observation.js';

/** Construct a SignalTree whose direct location reads are observable by Vue. */
export const signalTree = createSignalTreeFactory(
  VUE_OBSERVATION_ADAPTER
) as SignalTreeFactory;

export * from '@signal-tree/kernel';
