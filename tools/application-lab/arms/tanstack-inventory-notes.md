# TanStack ordinary inventory arm

Scaffolded against the exact registry sources of `@tanstack/angular-db@0.2.12`
and its dependency `@tanstack/db@0.15.2`. Their downloaded archive SHA-512 values
match the protocol's researched registry integrity bindings. The root's second
baseline production build passed, and its inventory stages passed through the
retired-editor check before a session-teardown ownership error failed the
new-session check. Fresh conformance is required after the repair below.

The arm uses a local-only collection, TanStack count aggregates, ordered native
LIMIT, and `injectLiveQuery` for Angular observation. The viewport query returns
at most 40 application rows. The count queries each return a single aggregate
row. No all-row Angular signal is maintained merely to compute the counts.

The insertion position and nested application value are explicit stored columns.
They preserve insertion order while exposing only the common Job shape. A
replacement removes the old instance and appends the new one. An editor captures
the instance string, so its old callback cannot mutate the same ID's replacement.
Those columns and the application lifetime check count as arm-specific glue.

The case-insensitive literal substring predicate uses native `fn.where`.
TanStack's documented compiler cannot optimize that callback into a structured
query expression, but it remains in the query graph; filtering is not repeated
by every presentation read. `like`/`ilike` in this pinned version interpret `%`
and `_` as wildcards and do not implement the common literal search contract.
Counts and viewport use separate native queries; any duplicate predicate work
is part of this implementation's measured cost.

Angular query parameter changes are observed through `injectLiveQuery`'s effect.
The driver must stabilize Angular before asserting filtered presentation, just
as it must for the common rendered view. The collection's `get` supplies direct
post-write row checks. This arm does not disguise framework scheduling with a
second application-side filtered snapshot.

The host first destroys the per-session EnvironmentInjector, which synchronously
disposes the Angular query observers. The arm's later registered destroy hook
starts idempotent cleanup; the host obtains and awaits that same `destroy()`
promise. The arm awaits native query cleanup before cleaning its source jobs
collection. In the pinned source, cleanup retires local state synchronously and
settles its public promise asynchronously. Cleanup rejection is not swallowed;
the browser driver collects unhandled rejections. No timer or fixed microtask
count substitutes for either the Angular or native completion boundary.

Before changing a filter, the arm retains its outgoing count/viewport query
resources until their public `status:cleaned-up` event. Native idle GC may not
have retired a previous parameter generation when an immediate destroy occurs.
Teardown captures the current query resources too and explicitly awaits every
retained dependent before retiring jobs. Cleaned generations remove themselves
from this registry, so it is not an accumulating history of filter queries.

The preserved `application-baseline-2/inventory-conformance/tanstack-baseline.json`
reports error 152 for the old jobs collection and three live-query IDs. Pinned
DB `src/query/live/collection-config-builder.ts` identifies that error as manual
source cleanup while a live query still depends on it. The fixture had called
`jobs.cleanup()` before destroying its Angular observer scope; setting a signal
false does not dispose those observers synchronously. This repair corrects that
fixture ownership order. It neither suppresses the error nor establishes a
library-wide defect. The same ordering risk was removed from dispatch cleanup.

Source evidence: the registry archives include `src/index.ts` (Angular query
adapter), `src/local-only.ts`, `src/query/builder/index.ts`,
`src/query/builder/functions.ts`, `src/query/compiler/evaluators.ts`, and
`src/collection/lifecycle.ts` and `src/query/live/collection-config-builder.ts`
(DB implementation). The repair passed a strict no-emit TypeScript check of both
TanStack arms against the baseline's pinned dependency closure; command, source
hashes and exit status are preserved in `tanstack-lifecycle-typecheck-first`.
The repair author ran no production build or browser comparison. Source
inspection, typechecking and the earlier failure do not establish repaired
conformance or performance; fresh shared qualification remains necessary.
