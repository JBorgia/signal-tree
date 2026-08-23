/**
 * Storage adapter implementations for the serialization and persistence
 * enhancers. Split out of serialization.ts so '@signaltree/core/storage' can
 * expose the adapters without pulling in the full enhancer module.
 */

/**
 * Storage adapter interface for persistence
 */
export interface StorageAdapter {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

/**
 * Create a custom storage adapter
 */

// TOMBSTONE: `createStorageAdapter()` and `createIndexedDBAdapter()`.
//
// PER-0: their only consumers were this package's own specs — no application,
// no demo, no package. Generic key/value plumbing with no SignalTree semantics
// of any kind, and `localStorage` already satisfies `StorageAdapter` without a
// factory. An IndexedDB adapter is a thing an application writes once against a
// three-method interface.
//
// The CONTRACT survives because a durability capability needs a storage
// abstraction. The implementations did not, and NGF-0's rule applies: useful
// code with no demonstrated consumer and no ownership claim is deleted, not
// re-homed.
