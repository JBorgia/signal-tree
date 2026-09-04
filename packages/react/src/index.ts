/**
 * `@signal-tree/react` - React observation plus the complete SignalTree
 * application surface.
 *
 * React observes framework-neutral SignalTree truth through
 * `useSyncExternalStore`; it does not replace the kernel's tree carrier. React
 * applications therefore construct, synchronize, and enhance trees through
 * this package, then observe them with `useSignalTree`.
 */
export * from '@signal-tree/kernel';

export { useSignalTree } from './use-signal-tree.js';
