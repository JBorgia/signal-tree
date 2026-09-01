# status() Predicates

The public `status()` marker was removed from SignalTree 15.0.

Use ordinary state for local loading flags — a `'idle' | 'loading' | 'loaded' | 'error'`
leaf, or separate boolean leaves, written from an `@Injectable` Ops service that runs
the fetch. The cache-aware `entityMap({ load: loader(...) })` surface is **also** gone
in v15; `entityMap()` is normalized local membership only. Historical versions of this
guide taught status predicates for loading, loaded, error, and idle states; those APIs
are no longer part of the frozen public surface.
