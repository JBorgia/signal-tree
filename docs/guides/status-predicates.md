# status() Predicates

The public `status()` marker was removed from SignalTree 15.0.

Use ordinary state for local loading flags, or use `entityMap({ load: loader(...) })` when a collection needs cache-aware loading. Historical versions of this guide taught `status()` predicates such as `loading()`, `loaded()`, `hasError()`, and `idle()`; those APIs are no longer part of the frozen public surface.
