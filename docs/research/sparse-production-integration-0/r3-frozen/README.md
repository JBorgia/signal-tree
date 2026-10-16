# Sparse production bridge R3: indexed realization and obligation-based reclamation

Status: bounded bridge candidate; not a production integration or API acceptance. R2, its counterexamples, D2/publication work, and the completed sparse reference remain unchanged.

## Identity and scope

Start/final checkout HEAD: `774dfd7f267400dc06fe8c8ffe976f18b51d52b0`, branch `codex/structural-target-preparation-split`. Native runtime reference: `8d220643e0d4e34cbdbc6e55e6ef692b25d5e023`; historical integration baseline: `19a5bd034d5ebef262f637c397bb41fe50a6a1e3`. Candidate identity is the source/archive seal in `receipt.json`; no candidate commit is implied. Runtime source is unchanged. All implementation changes are isolated overlays and the experimental bridge. No v15/API/ceiling changes, merge, push, tag or publication.

Owner-authorized v16 ordering-before-delivery remains the R2 contract. R3 addresses native translation work and retention, without adding a second contribution disposition engine. Native causal-runtime capability supplies restoration/materialization plumbing; no incumbent transactions enhancer or TurnStore is installed.

## Traced causes and correction

R2 prepared an entire entity snapshot before filtering changed rows. Its native structural target also reconstructed collection state. R3 obtains changed lifetimes directly from the prepared ownership result. A persistent ordering index supplies neighboring lifetimes; the native delta preparer validates only touched source/key/value facts and installs through indexed lifetime lookups. Direct resolved placement avoids a linked-list predecessor scan. Binding revisions, selection policy, equal-value identity, and native publication are retained.

Fresh field-only settlement emits no membership unit. Point addition/removal/rekey reports logical structural facts through the existing observation protocol. Fresh prepend emits facts after its final placement is installed. A genuine reorder can enumerate its full before/after event output; this is explicitly different from point work. Full requested snapshots can still enumerate their requested output.

R2 declared native restoration authority, correctly disabling automatic zero-owner reclamation, but never supplied its replacement retirement policy. R3 consults the indexed sparse obligation record. A native record is eligible only after the sparse record is absent, native state is inactive, and the prepared native reclaim still passes its tombstone/revision guard. Hidden committed or pending restoration dependencies keep records alive. Reclamation removes native backing/lifetime records and strong bridge mappings; non-reused identity and externally held facades remain independent. Held references cannot retarget a replacement lifetime.

Maintenance runs after complete ordinary mutation delivery or settlement publication. A retry set retains failed maintenance work. Existing membership delivery is held through the whole settlement, including ownership terminality and native publication, so listener-authored writes cannot invalidate a partly installed prepared root. The first thrown value remains authoritative.

## First failures retained

1. The unchanged R2 size/churn workload fails its R3 acceptance assertions: field settlement enumerates 1/32/1024 entities; native retired candidates accumulate 0/32/1024. Its original passing semantic controls were not weakened.
2. Initial R3 maintenance ran before collection invalidation and callbacks. Injected reclamation failure left primed ids stale and skipped delivery. Deferred maintenance preserves publication and exact error identity; retry reclaims. First source, raw logs and independent route probes are saved. This is fault injection, not an ordinary trigger claim.
3. Initial delta realization always opened an order-diff membership unit. With an active reader, eight point cases attempted full-order snapshots. Logical facts/no field-only unit remove those scans. Fresh prepend capture independently exposed the same unnecessary order diff and was corrected without weakening position/delta assertions.
4. An ordinary membership listener authored y=2 during mixed rollback before sparse terminality. Native rollback completed but sparse install threw `Prepared sparse root is stale`, leaving the two states inconsistent. The unchanged regression fails against the preserved pre-hold bridge and passes with the existing native delivery hold. This is an ordinary callback counterexample, distinct from staged fault injection.
5. An early held-reference harness assumed the wrong subscription surface. Its source/failure is retained separately from implementation failures; final tests use real Vue subscriptions.

## Evidence and interpretation

The completed fresh replay passes unchanged ordering, callback, overlap, capture, error identity, native publication and four-facade controls, plus R3 work, retirement, maintenance and observation regressions. Raw per-test results are in the archive and fresh replay log; expected baseline red is not an ordinary pass.

- R2 entity families: 58 ordinary passes (19 mixed controls, 8 overlapping orders, 5 capture faults, 2 publication throws, 12 framework checks, 12 native callbacks).
- R3 indexed-size workload: one-field rollback at 1/32/1024 rows performs 0/0/0 model entity snapshot visits, with 101/319/584 AVL node visits. These are algorithmic counters, not total CPU or native instruction counts.
- Native scan guards cover capture and settlement, with and without row observers. Active membership tests add eight capture, eight settlement and two prepend cases at 32/1024, asserting useful mutations and exact lifetime/key/neighbor facts.
- At 0/32/1024 same-key churn cycles, native retained candidates, bridge mappings and sparse entity records are zero. A separate fixed held row/field with real Vue subscriptions remains detached from later lifetimes. These are logical retention screens, not GC or heap-byte measurements.
- Recovery tests retain native records for pending removals, failed settlement and live dependent facts, then reclaim after the final obligation retires. Ordering-index fault tests cover partially staged insertion/removal with Error and undefined; no staged failure admits unowned live state.
- Independent review supplied and root replay verifies maintenance route failure/identity checks, membership reentry, nested settlement, ABA, same-key reincarnation, listener throws, and fresh prepend neighbor facts. Review findings were corrected, not reclassified.

Differential TypeScript checking has 11 existing diagnostics in both baseline and overlay, with zero added diagnostics. This is not a successful repository-wide typecheck. The original sparse prototype's completed suite was not duplicated. R1's preserved reporting-policy mismatches and obsolete recovery-shape failure were not declared fixed.

## Limits and next boundary

This remains one collection with flat finite scalar leaves and simple entity payloads. Selection follows native policy; it is not a new sparse selection mechanism. Field omission, arbitrary nested collections, sorted collections, async callbacks, public inspection parity, links and undo are outside this bridge. Trusted native installation is not claimed to tolerate arbitrary Map/Set allocation failure. Staged faults cover the specified responsibility/index boundaries.

Vue and Solid checks use synchronous native observers. Angular checks computed reads after operations; React checks facade subscriptions, not mounted rendering. No fresh application-owned native computed values inside groups are promised.

No broad Nx suites, complete production CPU/heap comparisons or fresh package/demo sizes were run for this isolated experiment. No approval-review rejection occurred in R3; these are unexecuted checks, not failures. Production superiority and final integration acceptance remain unestablished. The bounded result removes the measured R2 whole-collection translation and accumulating native-record defects while preserving tested overlap capability; equivalent production obligations remain necessary before cost comparisons.

## Replay

Use Node 24.15.0 and the checkout's pinned dependencies. Source hashes and the native runtime diff are checked before fresh bundles are built.

```sh
mkdir /private/tmp/bridge-r3-evidence
tar -xJf evidence.tar.xz -C /private/tmp/bridge-r3-evidence
python3 replay.py --evidence /private/tmp/bridge-r3-evidence --repo /Users/jonathanborgia/.codex/worktrees/capture-point-owner/signaltree --output /private/tmp/bridge-r3-fresh --node /Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node
```

Use a fresh output directory. The runner expects the unchanged baseline ordering and preserved pre-hold membership regression to fail; ordinary candidate checks must succeed. Source generators, their R2 input files, and first variants are retained for audit; the replay builds sealed overlay sources rather than depending on temporary predecessor directories.
