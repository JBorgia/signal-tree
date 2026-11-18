# EntityMap method extraction experiment

`entity-query-separation.mjs MANIFEST SHA TOOLCHAIN NEW_OUTPUT` tests one concrete
internal decomposition without changing stable public exports. It copies the
admitted canonical baseline package, parses the built EntityMap implementation,
and extracts the actual `has`, `where` and `find` method bodies to an internal
factory module. The copied runtime retains every public property in its original
position. Function names, arity and property descriptors must remain equivalent.
Neither the canonical package nor production source is modified.

Baseline and derived packages each execute equivalent CRUD and query fixtures,
including sorted and unsorted results, predicate-cache identity, detached method
use, update/removal/re-addition, held snapshots and stale entity handles. Each
fixture must succeed before its output is admitted for equality comparison.
Production bundles bind the Node, TypeScript, esbuild JavaScript/platform binary,
lockfile, source payloads, transformation, output and emitted input identities.
Record whole fixture bytes/gzip and the helper's emitted contribution in both
CRUD-only and query fixtures. These are consumer fixture results, not canonical
bundle-budget numbers or CPU/heap measurements.

A positive helper contribution in CRUD means this extraction still retains the
query implementation with the complete returned API. A larger equivalent bundle
provides a concrete reason to reject this particular split. It does not prove
that all possible internal decompositions are unhelpful, and does not authorize
removing methods or inventing breaking exports to make tree-shaking work.
