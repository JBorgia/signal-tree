# Long-lived v15 collection projection screen

November 11, 2026. Frozen source: published v15.4.8 commit
`37ef1788f6bac61678fc312f391b180bd7a6bbd7`. The comparison is a private runtime
experiment, not publication authorization or release qualification.

The application study's v15 point-and-render sample includes `presentEntities`,
`subjectIdForKey` and `backingForSubject`. Inspection finds that value and map
projections walk ordered keys, look each key up to recover its subject, then
look up that subject's value. The structural list already carries both key and
subject. The first candidate visited that list for each projection; its raw
cohort, exact generator and built artifact are preserved separately. It improved
the first 100 edits, but regressed cumulative 5,000-edit CPU in both collection
profiles at both sizes. That candidate is rejected despite the shorter Angular
comparison's favorable aggregate stage.

The second candidate instead caches the ordered numeric subject IDs on first
value projection. Every structural/key mutator clears both key and subject
snapshots; field updates keep both valid. A value-only consumer needs only the
subject snapshot rather than the old key snapshot. Consumers reading both
`all()` and `ids()` pay for both arrays. Fresh output arrays still contain current
values and user predicates/comparers execute only after materialization.

The frozen input is the exact installed registry package used in the November
11 application study. The candidate comes from a fresh uncached Nx build of
this isolated source checkout. The generator binds every file in both package
roots, both esbuild metafiles, production bundle bytes, its own source, the Git
base and runtime diff. Both artifacts export only `signalTree` and `entityMap`
from the same production compilation settings. This is deliberately separate
from prior raw barrel-import profiles: reachable optional modules can differ
between a direct ESM barrel import and a production tree-shaken application.

Run with Node 24.15.0 and pnpm 10.17.0:

```sh
NX_DAEMON=false NX_ISOLATE_PLUGINS=false CI=true pnpm nx build kernel --skip-nx-cache
node tools/v15-projection-lab/compare.mjs compare FROZEN_PACKAGE_ROOT dist/packages/kernel NEW_OUTPUT_DIRECTORY
```

The entire schedule is saved before comparative execution. Each of eight cells
(1,000/10,000 rows crossed with projection, inventory filter, point-only control
and projection-plus-IDs) has two
frozen/frozen control pairs followed by five alternating frozen/candidate pairs.
All 112 children are fresh serial Node processes with production mode and forced
GC available. Runs do not discard any warm-up iterations. Host load and process
identities are recorded. The coordinator reserves the timing window against
other intentional benchmark/build/test work in this chat; unrelated host work
can still contend.

Each child creates and populates one six-field row store, retaining it through
100, 1,000 and 5,000 cumulative edits. Every write targets `iteration % rowCount`,
changes a numeric field and toggles a boolean. Projection reads the full array
after every edit; inventory additionally filters the full array for active rows;
point control reads only the edited row during the timed phase. Projection-plus-IDs
also reads `ids()` after every write to price demand for both cached arrays. Every timed
operation checks its written value; inventory also checks the exact match count.
Outside each phase timer, the complete array must equal an independent expected
state and repeated unchanged `all()` reads must preserve identity. Thus a
skipped write or empty view cannot improve timing by silently doing less work.

Report setup and each edit segment separately, plus cumulative setup/edit CPU
and wall time for the same child. The cumulative measure excludes the explicit
full-oracle and forced-GC checkpoints; it is not an application-session latency
or sum of percentile measurements. Report imported, populated, checkpoint and
destroyed heap, all whole-process measurements. Synchronous forced GC does not
end the current JavaScript job, so WeakRef-kept targets may remain alive through
live checkpoints. Destruction includes a `setImmediate` turn before its GC. No
checkpoint proves unlimited boundedness or collection of every resource.

Use medians and full observed ranges. A directional CPU finding requires
nonoverlapping comparison ranges and a median gap larger than the largest
observed same-arm pair gap or comparison-arm range in that endpoint. Other
differences remain unresolved. Inspect matched pairs as additional evidence;
do not recast controls as confidence intervals. Keep the point-only control
and setup endpoint visible even if they do not improve.

Correctness precedes adoption: baseline and candidate contract tests, relevant
full kernel/framework suites, types, fresh production demo build and applicable
documentation gates. The new order/lifetime/rollback contract tests were first
run on unmodified v15. One initial assertion incorrectly expected `changeId`
to rewrite the payload's `id`; the baseline failure is preserved, and corrected
assertions separately check collection keys and unchanged payload identity.
The initial Nx invocation stalled before reporting tests with isolated plugin
workers; it was interrupted and rerun with `NX_ISOLATE_PLUGINS=false`.

These measurements concern a neutral kernel collection workload. They do not
measure Angular rendering, full coordinated v16 guarantees, a different device
class, or developer productivity. Larger product comparisons remain owned by
the central application study.
