/**
 * SignalTree Markers
 *
 * Marker functions define special state types that are processed
 * during tree finalization. Markers are placeholder objects that
 * get transformed into fully functional signals with methods.
 *
 * Available markers:
 * - entityMap<T, K>() - Normalized entity collections with CRUD
 * - stored(key, default) - Auto-sync to localStorage
 *
 * Note: derived() function was removed in v6.3.1 - use computed() directly
 */

// Derived state types (derived() function removed - use computed() directly)


// Stored marker - RETIRED in v15 (STORED-RETIRE-0). Durable state is now
// application-owned: an ordinary leaf plus `link()` to a storage endpoint.

// Async-source marker - load-and-expose async primitive (v9.5)

// Async-query marker - input-driven debounced query primitive (v9.5)

// Cache-aware (single-scope) loading for entityMap (RFC 0002/0003) — the loader surface that
// `entityMap({ load, … })` attaches. `entityMap` itself is exported from ./types.
export {
  invalidateTag,
  parseDuration,
  stableStringify,
  type EntityLoader,
  type EntityLoadOptions,
  type EntityLoaderSurface,
  type EntityPersist,
  type EntityStorageAdapter,
} from './entity-loader';
