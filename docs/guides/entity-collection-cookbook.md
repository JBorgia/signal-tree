# Entity Collection Cookbook

This guide previously documented `entityMap({ load: loader(fn) })` and
`invalidateTag()` as the cache-aware collection loading surface.

Those APIs are not part of the current RC public surface. Use plain
`entityMap()` for normalized local membership, and keep HTTP caching, freshness,
request coalescing, retry, and push invalidation in application services or
framework data primitives until a v15 async/cache helper is derived from the
architecture.
