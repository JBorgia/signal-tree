# Independent review: effective-presence successor

**GO for bounded composition of this correction. No blocker demonstrated in the reviewed source and focused falsifiers.** This is not full runtime/release acceptance; jump-undo-equivalence and broader suites remain outside this review.

## Exact source and freeze

Before reviewing runtime, read the author's `FREEZE.json` and `RESULTS.md`: both explicitly identify the source as frozen, with no further tests planned pending review. `STATUS-FINAL-CONTROLS.json` reports no running controls. No separate author confirmation was needed.

Candidate manifest SHA-256: `47e05e6216bab9fd186dfbb66b656f4e33dc1f9d98a81a1ad096ee61b12181f9`, 3,050 files. Base is the author's exact C11 **SNAPSHOT-COUNTERPARTS** manifest, `dc21671bf92e2a74bd5798bfccfbc0b02d13e58dff4fe328758fd604d9f70148`, 3,045 files; do not confuse it with the earlier C11 oracle manifest. Verified all candidate files before copying and again after runs, plus all frozen C11 counterpart files. No original scratch or runtime files changed.

The diff is exactly two runtime files plus five authored test files. Root HEAD remains `628d302dadb082a48c58528651c9088234d0a777`; its unrelated dirty work was not used or touched. Source identities, per-run commands, first logs and unchanged-source receipts are preserved here.

## Mechanism assessment

`packages/kernel/src/lib/internals/member-membership.ts:999+` now recognizes the existing presence-hook metadata, invalidates the opaque marker's wrapper via the existing snapshot installation mechanism, and returns without invoking the hook or traversing its data. Ordinary accessor traversal uses own data descriptors, excludes peer/store metadata and has an operation-local visited set. The effective-change flag is suppressed across independently omitted edges. Cold wrappers are not constructed by invalidation. No new persisted authority or graph appears.

`packages/kernel/src/lib/entity-signal.ts:444+` adds effective absence to the existing projection cache keys. It also captures the install revision before computation, rather than stamping a callback's earlier result with a later installation. Throws do not commit keys; no automatic callback retry was added. `version()` still establishes the observation edge, and native notification remains at its existing boundary. These changes directly close the previously measured absence-era wrapper reuse and underlying projection-cache gaps.

The install-revision sampling correction is substantively supported, not an unrelated refactor: the author's preserved exact-C11 Angular comparison shows successful nested-install query results incorrectly reused on the next demand (3 fail / 3 pass), while the successor's six controls assert original first result/error, exact callback counts, next-demand recovery and stable later identity. I replayed those successor controls in Angular.

## Independent execution

All runs use own copies through Nx, Node 24.15.0/pnpm 10.17.0; commands/environment and raw first failures are under `runs/` and `baseline-replay/runs/`. No diagnostic output variable was required.

| Falsifier | Independent result |
| --- | --- |
| Unchanged kernel absent-collection file | 92 passed |
| Authored kernel effective-presence controls | 17 passed |
| Authored Angular effective-presence/install-reentry controls | 13 passed |
| Added nested-omission identity plus real re-add tail | 1 passed after correcting my fixture expectation |
| Exact C11 with the 17 authored kernel controls plus my corrected discriminator | 6 failed / 12 passed |
| Source types | Passed |
| Spec types | Passed; ratchet unchanged |

The first candidate kernel command ran 110 tests: the 109 unchanged/authored tests passed and my extra fixture failed because I incorrectly omitted the already-present `keep:2` from its expected root after re-adding `inner`. Its first source and raw failure are preserved. I corrected only that expected shape, then reran the one affected test; its remaining wrapper-identity and later-dependency assertions pass. No need to repeat the other 109 unchanged tests. The corrected test fails on C11 at stale collection-wrapper content, not at the fixture's prior mistake.

My discriminator keeps the collection absent through two independently omitted edges, positively observes outer reactivation, checks held empty-array/wrapper identity before and after delivery and an equal scalar write, then actually re-adds a fresh row. It requires the new row in the root, a changed wrapper, unrelated-write stability, and a later row update becoming visible. This prevents a permanently empty reader from passing the negative half.

## Test nonvacuity and qualifications

- Completion controls require exactly one matching membership completion, actual row values across all/count/ids/map/has/where/find, old held computed inside completion, fresh computed afterward, stable early wrapper identity, and a subsequent row change. They exercise the intended source-current/native-delivery distinction.
- The final cold-wrapper test positively checks `MATERIALIZED.has(rows) === false` through bare-tree omission/re-add, then true after first root demand. The earlier tests that were warmed by ordinary preparation now say so. Their initial coldness failures are preserved, not silently credited as coverage.
- The opaque-marker case attaches cyclic payload/getter traps to a live marker. This is useful internal diagnostic instrumentation, **not** evidence of a new public contract permitting arbitrary marker mutation. It positively reaches omission/re-add and requires current root output; source inspection confirms the new walker stops at the marker. Zero getter calls alone would not prove that every payload key was unvisited.
- Presence reentry is reached in the kernel controls: actual omission, exact callback count and sentinel, and explicit next demand are asserted. Angular install-reentry is warmed and positively reaches the nested n:11 installation; it is not a cold NG0600-blocked harness. No universal sort self-reentry guarantee is inferred.

Verified hashes of the author's preserved first-failure files. Independently transpiled the five original spec-types-failure fixtures and the frozen versions: emitted JavaScript is identical for each (`FIXTURE-REPAIR-VERIFIED.json`). Thus that repair changed types rather than executable assertions. Author source/spec-type logs and cold-fixture first failures remain available unchanged.

## Scope of the verdict

Accept the bounded shared correction for Main's composition. React/Solid focused passes and broader parent/memo controls were inspected in the author's raw evidence, not independently rerun here. No full suite, jump-undo-equivalence, allocation/CPU measurement, or release qualification was performed. The incomplete earlier kernel run remains incomplete; this report supplies no replacement total.
