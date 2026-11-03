# Private packet index successor — bounded result, not acceptance

Built only in this directory from frozen combined B. One runtime file changes: `candidate/packages/kernel/src/lib/experimental-publication/entity.ts`; one adversarial spec is added. Combined A/B and the root checkout were not edited. No public exports, policies, bundle ceilings, test budgets or timeouts were changed.

**Batch construction improves, but point-work regresses.** The unchanged finite allocation suite passes on B and the successor with identical retention checkpoints. The unchanged point counter rises from 14,400 to **27,600 visits** for 200 updates, still equal at 2k/20k rows and still failing `<2000`. This is not an overall green result or acceptance of the guard overhead. Preserve and review this tradeoff before integration.

## Frozen baseline and implementation

Before copying/editing, hashed all 2,967 regular source-tree files, excluding `.git`, dependencies, Nx cache, dist and coverage. Full manifest: `BASE-SOURCE-SHA256.json`, SHA-256 `6630a74c965b1f414eae5105c3eb3bb3ea09ba9b89f57f81149eee52086af1fd`. This is a snapshot without .git, so no snapshot HEAD/branch exists. `verify.py` rechecked every baseline file in original combined B unchanged and every inherited candidate file; only the stated runtime file differs. Final candidate identity and exact patch are in `SOURCE-SHA256.json`, `runtime.patch`, `tests.patch`, `VERIFICATION.json`, and `FREEZE.json`.

The native participant obtains ordered ordinary edits once per final `prepare`, then builds a local subject→last-edit lookup. Sequence order, duplicate edits, empty steps, authoredRemoval same-step deduplication, and original edit identities remain. The full ordinary loop and step-local physical pairing remain intact. The lookup selects the last edit even if it is removal, rekey or partial; per-edit restoredFields still outrank selected endpoints, which outrank proposals. No per-field reverse/find array is constructed, no global cache is introduced, and native evidence still exists without recipients.

Responsibility runs against selections before any record is installed. Its record stays combined with native source records in the existing atomic prepared install. Existing source/revision/finalization checks remain. Tests cover failed responsibility, failed recipient preparation, source reentry, payload-getter reentry and final deferred point aggregation with repeated ordinals.

## Premise review and explicit private boundary

Read `/private/tmp/st-packet-index-premise-review.md` before finalizing. The first index-only patch is preserved as `first-index-before-structure-guard.ts`; its allocation replay is preserved under `allocation/`. It is not the final candidate.

Readonly was insufficient. Final code captures source-owned admission structure: step identities/order, ordinary/physical array identities and members, authoredRemoval identities, edit subjects, structural references/kinds. It compares that structure after responsibility preparation, before returning a native unit, and before/after native finalization. Mutation refuses before installation. It does not freeze caller payloads, clone edits, clone requirement cells, or claim general deep immutability. Caller payload field reads and edit-specific endpoint references remain live under the existing semantics. The guard protects the index's structural assumptions, not arbitrary hostile JavaScript.

This deliberately strengthens **private** packet handling: previously a private callback could mutate packet admission structure and have later enumeration see it; now such mutation invalidates the preparation. Actual source responsibility receives selections/capture rather than the packet, and normal producers do not mutate that admitted structure. Private recipients receive the packet but cannot change its admission structure and then install the stale prepared record. These claims are bounded to source-produced packets and the tested private seam; no public mutable-packet contract is asserted.

Delayed native support deliberately uses the captured subject list from that preparation, not later re-enumeration of a caller-mutated packet array. It continues combining the existing prepared overlays and source facts; it is not a persistent support cache. The held-support test retires the source subject then mutates the private array after installation and verifies the original unknown support survives. This is an explicit source-unit capture boundary, not a claim of byte-for-byte behavior equivalence for unsupported private mutation.

The unmodified B copy runs 18/23 of the final-at-that-point adversarial assertions successfully and fails exactly the five new private-boundary assertions (three mutation refusals, recipient mutation at finalize, delayed subject capture). Raw results: `baseline-final-discriminators.log`. Those five differences are intentional and must be reviewed as such. One later deferred-point aggregation control brings the final successor suite to 24; it was separately executed on the successor.

## Execution results

Node 24.15.0 / pnpm 10.17.0 / Vitest 4.1.9. No large 130k replay, heap raise, timing claim or CPU benchmark.

- Initial ten compatibility controls before runtime edit: **10 pass**, `baseline-adversarial.log`.
- Final adversarial controls: **24 pass**, `adversarial-final.log`.
- Final focused run: **56 pass, 3 fail**, `focused-final.log`. Three failures are the unchanged structural-admission-sequence cases (remove→rekey vacancy, removal before physical omission, numeric/string keys), all reporting structural-drift instead of undefined. Unmodified B independently reproduces exactly those **3 fail / 5 pass**, `baseline-sequence.log`. They remain failures, not waived semantics. The accidental successor repeat before the proper baseline replay is explicitly named `successor-sequence-repeat.log`.
- Strict runtime source types pass: `source-types-final.log`. Spec types pass: `spec-types-final-2.log`; no ratchet/baseline edits.
- Exact preserved allocation spec: **10 pass on B and 10 pass on successor**, `allocation-final/{baseline-b,optimized}.log`. Its SHA matches `/private/tmp/st-publication-allocation-discriminator/allocation.spec.ts` exactly.
- Original granular point-work control: B **14,400**, successor **27,600**, both fail unchanged `<2000`; logs `baseline-check-point.log`, `candidate-point.log`. No assertion was softened. The earlier stack histogram's 22 setup-only visits remain unrelated to these uninstrumented counts.

## Allocation replay, including added guard cost

Copies under `allocation-final/` contain counting instrumentation only. Original frozen B and the actual successor candidate do not contain counters. Source-site Map instrumentation counts the replacement index and guard Map; added source counters cover guard array copies, descriptors, removal list, captured subjects and no-steps ordinary copy, as well as the original flatMap/spread sites. Exact patches, instrumented hashes and raw JSONL are retained. `instrument.py` followed by `instrument-guard.py` reconstructs instrumentation in fresh copies; copy the preserved allocation spec before running.

For bare population of N two-field rows (also identical before receipt/foreign work in the other modes):

| N | B measured array entries | Successor measured array entries | B / successor Map constructors |
| ---: | ---: | ---: | ---: |
| 32 | 4,128 | 322 | 180 / 182 |
| 128 | 65,664 | 1,282 | 660 / 662 |
| 1024 | 4,195,328 | 10,242 | 5,140 / 5,142 |

B is 4N²+N; successor is 10N+2 at the counted sites. Ordinary flatMap becomes one result per prepare, and proposal-copy arrays disappear. Map set calls and absent-key insertion counts rise from 29N to 33N; Map iterable copies remain 6N. These are real additional guard/index costs, not free lookup storage. Counters cover named construction sites, not every object, byte or simultaneous live heap entry. The guard also adds comparison work, reflected in the failed point counter.

All retention dictionaries match B exactly at every phase in all nine workloads: population return/drain, removal return/drain, held receipt, foreign useful edit/confirmation, recipient disposal and destroy. The foreign useful declared edit remains conservative/unknown with no send; held delivered receipts remain unchanged. These finite observations do not establish OOM resolution or universal retention correctness.

## Review handoff

No broader implementation acceptance is claimed. The main review questions are (1) the explicit private admission-stability boundary and delayed subject capture, (2) exact identity/ordering/endpoint equivalence on legitimate source packets, and (3) whether the guarded batch improvement justifies or requires correcting the newly measured point overhead. No global no-observer bypass or persistent cache is proposed as an escape. Original failures, first patch, intermediate runs and final artifacts are preserved.
