# Public selected callback result

2026-10-29. These separate tests exercise public tree/transaction/tap/framework reads, unlike the preceding private raw-backing capability tests. Runtime unchanged in both exact sources. No original assertion/test weakened.

## Exact runs

Same pinned Node24.15.0/pnpm10.17.0 environment as RESULT.md. Each run through Nx:

`corepack pnpm nx test <vue|angular> --skip-nx-cache -- src/lib/selected-active-id-preparation.spec.ts -t 'public callback discriminator'`

| Source | Vue | Angular |
| --- | --- | --- |
| 75416029 successor `/private/tmp/link-authored-removal-successor` | 1failed, 1private capability case skipped; callback throws TypeError | 1failed, 1private case skipped; callback reads stale X |
| 87f6831f production control `/private/tmp/slice5-production-control` | Same TypeError | Same stale X |

All four exit1. First logs preserved separately {VUE,ANGULAR}-{PUBLIC,PRODUCTION}-FIRST.log; statuses in corresponding EXIT files. Same source test bytes across both trees; PUBLIC-{BEFORE,AFTER} and PUBLIC-PRODUCTION-{BEFORE,AFTER} show identical non-test runtime hashes per tree. Tracked git runtime diff empty. Two test-only copies remain untracked in production control; four new capability/test files untracked in successor. No application/runtime code changed.

## Angular executed behavior

Pre/pending warms pass: active selectionA, then transaction changeIdA→X/addD yields pendingX and idsX,C,D. During rollback onRemove(D), direct library reads produce:

`{activeId:'X',ids:['A','C'],all:[{id:'A',n:1},{id:'C',n:3}],directA:1}`

Expected selected callback snapshot has activeIdA with the same restored rows. Callback then choosesC. Raw log records final selectionC and coherent final watcherC in both arms. The first assertion fails on the recorded callback selection, so the final-watcher assertions are not counted as passed merely from those raw observations.

This is a concrete inherited selected callback boundary failure, not a new754-only regression and not an assertion about an app-owned computed inside a group. Storage keyA/restored lifetime exists while returned library activeId still namesX.

## Vue earlier boundary

Normal/pre/pending `.value` reads pass, but inside onRemove(D) `rows.ids.value` is undefined, causing notiterable TypeError before snapshot is recorded or callback selectsC. Same in87. The selection/finalwatcher oracle is **not executed** for Vue; do not call it a stale-selection red.

Exact source seam: entity-signal.ts:1404–1421 deliberately uses `inTap`→`fresh(read)` for uncached tap reads. That helper returns a bare callable cast to ReadableCell. Vue normal public readonly carrier supplies `.value`, but the fresh tap function lacks it. The source explicitly documents tap-fresh projection behavior (v16 8f); preserving the .value facade is a real missing realization boundary, not justification to coerce the test to kernel-call syntax or cache around it. No fix made. A separately named continuation may isolate selection later; it must not erase this public first failure.

## Contract basis and implementation implications

- `committed-entity-selected-unit.spec.ts` requires selected inverse complete before rich callback; no old installation may overwrite later callback-authored truth.
- Existing Vue `prepared-selection-publication.spec.ts` covers callbackC selection and all delivered rollback snapshots; the new test adds the missing direct read before authoringC.
- `entity-signal.ts:1404–1412` explicitly promises fresh projection reads inside taps despite grouped cached delivery; activeId getter3503 returns the cached readonly selection rather than a tap-fresh facade.
- The public sequence therefore sharpens the prepared-selection requirement: callback-visible library selection and row lookup must agree at callback time. A complete invalidation-before-rich-capture route may fix rich capture but is insufficient if onRemove executes while the selection's published readonly cache is held by a broader source group. One must map that exact group/callback ordering or expose an equivalent correctly realized source-owned direct-read view—without changing ordinary selection semantics or adding a new adapter API by assumption.

No public policy conflict established by these tests. Both failures are inherited contract/realization gaps that must be included in selected-unit design qualification. They do not authorize a runtime patch or revive rejected B. No broad suites or performance work ran.
