# Independent placement sharing review

Recommendation: integrate the final sharing delta within its existing private fixed-preparation boundary. No bounded blocker found. This is not acceptance of the initial extra-clone variant, a speed claim, a new work threshold, or qualification of a combined integration source.

## Identity and isolation

Author: `/private/tmp/st-placement-sharing-successor/candidate`; SOURCE-SHA256.json SHA256 `968c8bdeb6a2496bc273a252923214abb4383b971608ed54300d39e201739dbc`. All 2969 manifest files verified before copying to this directory's candidate. All original files still match at completion, in both author and reviewer copies (FINAL-VERIFICATION.json). No author/root/runtime source edits. One reviewer-only spec added. No git history manufactured for this manifest copy.

From-B runtime patch SHA256 `7341bf88da35302ca5e5d167d451f870aab0415662332f7c5eb37c3b9dbe4d51`; from-initial runtime patch SHA256 `e8b1e79f999c29aff20987c590e74159cb5c35abfb2f07fc6869e7e1405ecd66`. The former includes original final-stage wiring; the latter changes only capturePatch and prepareInterval.

## Source findings

- entity-placement-stage.ts:18 capturePatch takes the fresh entry array yielded by native Map iteration, replaces its row reference with a frozen spread copy, freezes that tuple, then freezes the entries array. It does not freeze or write the row stored in the Map. Keys are string/number in the actual topology consumer; adjacency is numeric and presence boolean. These own data records need no deep payload cloning.
- entity-ordinary-topology.ts:77 prepareInterval shares an after-row only for explicitly supplied entries and a frozen row. Before-rows still receive independent frozen copies. Default and mutable-input paths still clone after-rows. Equality filtering and continuity creation are unchanged. An absent-to-absent row produces no pair. Sharing changes private referential identity, not value/ordering authority.
- entity-mutation-frame.ts:146 prepares a fresh stage and completes instruction application, final-front moves, and final-order edits before returning it. The earlier staged-key scan is deliberately NOT the shared entries source.
- entity-signal.ts:1338-1391 captures that returned stage once. Add adjacency rewriting reads it; prepareOrdinaryTopology changes a separate ordinary stage and visibility overrides; physical interval construction consumes the same captured entries. No post-capture physical-stage mutation found in this path. Other physical mutations at :729 and :2119 are separate restoration/identity paths, not writes to this captured stage.
- prepared-placement-visibility.ts still reads physical.patch at sparse run edges and physical.read outside indexed runs. Therefore the supplied entries are NOT a general detached snapshot API: callers must use the exact same fixed stage, with a stable base during preparation. The current source-owned call satisfies this local condition; do not move capture before final order or cache entries across preparations when composing Main's changes.
- isFrozen is not a universal provenance/accessor validator. The current production supplier is capturePatch, which creates plain own-data rows. No claim is made for forged frozen accessors, arbitrary custom Map iterators, stale/mismatched private entries, or mutation after visibility creation.

## Independent execution

Node24.15.0, pinned pnpm via corepack; NX_DAEMON=false, NX_ISOLATE_PLUGINS=false, NX_TUI=false. Every run has exact argv/env/cwd, first.log and RESULT.json; fresh ST_PREPARED_REVIEW_OUTPUT directories. All tests through Nx, cache skipped.

- runs/focused: exit0, 53 tests / 9 files. Exact unchanged original placement work six plus lifetime control included in prepared-placement-index.spec.ts, and visibility/snapshot/sharing, structural-admission-controls, structural-completeness, collection-order-refusals, reentrant-order-bookkeeping, reentrant-order-v16-controls. Original 2*N ceiling unchanged. These tests alone undercount whole preparation work; accounting below is separate.
- runs/source-types: exit0, `corepack pnpm exec tsc --noEmit --pretty false -p tsconfig.typecheck-all.json`.
- runs/spec-types: exit2, `corepack pnpm exec tsc --noEmit --pretty false -p tsconfig.typecheck-specs.json`. Exactly the author's same202 diagnostics after absolute-root normalization, no new diagnostic from reviewer spec (SPEC-COMPARISON.json). This is baseline equivalence, NOT a green spec-types claim.
- runs/independent-final: exit0, two additional ownership/fixed-stage tests. One retains present/absent captured rows across remove/reinsert episodes. One makes every captured physical stage's mutators throw, then exercises public setAll, prependMany, another transaction setAll and rollback, asserting full restored ids/payload and three forward captures. No stage-mutation exception.
- First reviewer failures preserved: runs/independent invalid duplicate-key prepend fixture (throws before intended boundary); runs/independent-corrected all payload/ordering assertions passed but fixture incorrectly expected a fourth capture on rollback. Restoration uses a separate preparation path; corrected assertion is three forward frames. Both exact failed fixtures retained alongside logs. Neither is represented as a runtime counterexample. No original test or threshold changed.

## Accounting independently replayed

Fresh copies under counts-baseline, counts-initial, counts-sharing. Each has the author's exact instrumentation.patch, copied instrumented source, source TS manifest, and runs/counted. All three commands: `corepack pnpm nx test kernel --skip-nx-cache placement-work-accounting.spec.ts --maxWorkers=1`. All exit0, six workloads per arm, 18 total. Public complete ids and payload assertions pass. Per-phase JSON matches author's raw JSON exactly for all18 (COUNTS-COMPARISON.json), including final sharing frozen checks.

Both setAll and prependMany, N=32/128/512, B / initial / final:

|N|Row clones|Tuples|Arrays excluding tuples|Visits|Freezes|
|---|---|---|---|---|---|
|32|128/160/128|128/128/96|70/69/69|320/288/288|196/261/229|
|128|512/640/512|512/512/384|262/261/261|1280/1152/1152|772/1029/901|
|512|2048/2560/2048|2048/2048/1536|1030/1029/1029|5120/4608/4608|3076/4101/3589|

Final versus B: N fewer entry tuples, one fewer other array, N fewer counted visits, unchanged row clones, N+1 extra freezes and N extra source isFrozen checks. One seed Map and 2N+4 pair/interval/continuity objects remain unchanged. Initial variant's extra N clones remain visible, not accepted by relabeling.

Instrumentation reviewed at evaluated expressions/Map yields across key lookup, capture, physical AND ordinary intervals, and visibility seed. Counter bookkeeping itself adds calls/objects (including extra isFrozen predicate evaluations); reported source counters exclude these. Iterator protocol records, downstream visibility trees/runs, bytes, retained heap and CPU are outside scope. Parallel replay was for deterministic counts, not timing. No speed or universal allocation census inference.

## Integration limits

Keep capture after all final placement edits; pass that same snapshot only to consumers of that same fixed physical preparation; retain mutable/default defensive copies and sequential ordinary visibility updates. Re-run these focused controls on the composed source because Main's later placement changes are not in this reviewed artifact. No full suite, framework matrix, heap/GC, bundle/release gate, or broader semantic acceptance asserted.
