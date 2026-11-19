// packages/kernel/src/enhancers/types.ts
// Re-export all enhancer-related types from their canonical declaration sites.
// This prevents duplicate global type declarations and keeps ONE source of truth
// per type — since 15.0 that means the owner module for capability and
// diagnostic types, and `src/lib/types.ts` only for kernel/common ones.

export type {
  RestorationConfig,
  DevToolsConfig,
  EntitiesEnabled,
  Enhancer,
  EnhancerWithMeta,
  EnhancerMeta,
} from '../lib/types';

// ⚠️ THESE NOW COME FROM THEIR OWNER MODULES (TYPE-BARREL-CONVERGENCE-0). The
// header above still states the intent correctly — one source of truth per type
// — but `lib/types.ts` is no longer that source for capability and diagnostic
// method bags.
export type {
  BatchingMethods,
  BatchingConfig,
} from './batching/batching.types';
export type { RestorationMethods } from './restoration/restoration.types';
export type { DevToolsMethods } from './devtools/devtools.types';
