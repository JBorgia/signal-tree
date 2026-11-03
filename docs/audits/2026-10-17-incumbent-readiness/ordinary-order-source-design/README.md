# Ordinary placement: lifecycle costs and native source-owner design

October24,2026. Evidence baseline968075ed656cbd0b4cd9ead211b837e34f27e30a.
This extends the completed representation check; it does not repeat it or select
a production representation. Native source, production87f6831f, accepted slice1,
original four failures and the recurrence/later-slice gates remain unchanged.
B stays closed. No API, activation, ceiling, merge, push or publication change.

## Result

Sparse remains the leading hypothesis for source-owned ordinary placement, with
the snapshot as a reference. Fixed-local order work and retention scale with
touched facts in the tested sparse model. Its current drain implementation does
not: a new discriminating case converges four of1,024 ordinary adjacency records,
then cleanup scans1,024 to retire those four. That scan is not justified by a
full convergence. The owner design therefore requires agreement normalization
from the complete changed-slot union, separately from indexed recovery retirement.
This requirement has not been implemented or measured in native code.

The reviewed design assigns one current ordinary presence/key/placement owner to
the source's EntityOrdinaryTopology, coordinated with StructuralStore and existing
EntityValueStore. All physical installation routes must preserve its facts before
changing physical fallback. Existing transaction/restoration authority still decides
which inverse is allowed. Link/history consume prepared source facts, never repair
missing ordinary order. The design covers both missing ordinary adjacency and
prepend's prematurely captured append-tail placement.

## Measured distinctions

Frozen model SHA256:
 bdb00609a27f104d3de837c644050741d403e1bf6c5ff138ad8463414af6edff.
Node24.15.0. Preregistrations preceded each first run.42 initial measurement rows,
24 supplemental order/held-reference rows,6 partial-convergence rows all completed
with their assertions passing. These are characterization rows, not native test
passes or a production performance ranking. No model edit or favorable resampling.

| Workload at1,024 current entities | Snapshot | Sparse |
| --- | --- | --- |
| One local physical order move and return |2,048 ordinary sequence visits,1,024 copied map entries; cleanup visits/releases1,024 |6 physical patch slots visited for preservation;3 adjacency exceptions; cleanup visits/releases3 |
| Full physical reversal then actual full convergence |Cleanup visits/releases1,024 |Cleanup visits/releases1,024 |
| Full divergence remains; local field/inverse lease drains |Cleanup visits1,024, releases0 |Cleanup visits1,024, releases0 |
| Four adjacency records converge;1,020 remain divergent |Cleanup visits1,024, releases0; whole fork retained |Cleanup visits1,024, releases4;1,020 overrides retained |
|32 local order divergence/convergence cycles |Cleanup total32,768; final ordinary storage0 |Cleanup total96; final ordinary storage0 |

The local order move is A-before-B to B-before-A and return; ordinary order remains
ABC throughout. At N16/256/1024, sparse preserves3 adjacency exceptions and scans
6 patch slots per cycle; snapshot copiesN records, visits2N ordinary sequence
entries and later scansN. Cycles1/8/32 scale with repetitions; final storage/leases
return to zero. This is a different workload from the earlier4-versus1,024 record
fixture, not an optimization from4 to3. Counters describe different operations;
zero snapshot 'preservation' events does not mean zero snapshot work.

Full divergence requiresN current facts in both concrete models. Both still retain
those records immediately after the converging install; the actual cleanup visits
and releasesN. The preregistration allowed possible sparse install release; measured
release is0 at install. No favorable interpretation replaces that raw result.

The partial-convergence control starts with disjoint middle-pair swaps in each
four-member group, so allN adjacency records differ. A local move restores only
the first group's four adjacency records. Ordinary stays original; physical keeps
the other groups swapped. This establishes1024-to-retire4 directly, with source and
independent replay. It distinguishes unavoidable full convergence from unrelated
scanning even though both can be described loosely as 'cleanup after divergence'.

## Recovery and held references

Staggered two-lease cases retain the second removed member's useful inverse after
the first lease drains. Supplemental same-key cases retire oldB and D, add freshB,
drain oldB's lease, reject stale oldB field/rekey commands without installation,
then restore D from its retained facts. FreshB777 survives; oldB remains absent;
final internal lease/fact storage is zero. Original descriptors and the final inverse
command remain externally held and are counted separately.

These are valid internal lifetime command streams. The model's privileged add
command does not implement general public restoration authorization; stale field/
rekey checks do not prove arbitrary internal commands cannot revive a lifetime.
No native collectibility or GC claim follows. Current semantic divergence may
remain after all leases drain and is not an obsolete recovery leak.

## Source ownership and all-path inventory

SOURCE-OWNER-DESIGN.md specifies one owner, preparation/install ordering, authority,
footprint, normalization and retirement requirements. SOURCE-PATHS.md maps S1–S6
and W1–W11, exact callsites and exclusions. structural-store-calls.raw retains the
lexical discovery manifest; body review, not that search alone, grounds the mapping.

Review found two important omissions in the first inventory draft, now explicitly
accounted for:

- Direct allocateSubjectId/commitFreshSubject/createSubject can install an active
  linked node outside EntityMutationFrame. Normal existing-key calls do not prove
  every invocation harmless; future source preservation must cover actual install.
  This is a source finding, not a reproduced new public defect.
- Direct preparePointValues installs realized value transitions without a frame.
  Its body changes no physical adjacency; that exclusion depends on unchanged
  lifetime/key preconditions. Necessary ordinary existence adoption must use the
  admitted structural route. Physical active-key validation alone is not a new
  proof of ordinary membership.

Frame create/restore/transfer/place/tombstone/retire/forget, direct prepend/reorder,
full target, frontier tokens, empty materialization/hydration, hidden collection
wrappers and direct value routes are listed. Actual teardown reachability and the
full physical compiler remain native qualification obligations. No low-level unused
clear method is passed off as proven tree destruction. No source finding is silently
converted into a caller-specific patch.

## Review and verification

Independent review read source, preregistrations and raw results; independently
executed cleanup discrimination and the six partial-convergence cases. It supports
measurement validity and the coherent source-owner requirement, while explicitly
withholding native qualification and cleanup-optimization acceptance. Its initial
inventory omission and subsequent recheck remain in review/REVIEW.md. No reviewer
verdict is treated as test execution of the author harness.

Root read the harnesses, checked counter attribution against frozen implementation,
verified native call bodies/import users, generated and ran the partial-convergence
falsifier, and verified all770 package TypeScript source hashes against the original
manifest. NATIVE-FREEZE-VERIFIED.json records zero mismatches. Original assertions:

- native-compound-ordinary-order-regression.spec.ts:
  6248370ec0de3fe089a4c4729b02761e162af4d2fd1b7c3ee62f493e4309a0a1
- prepend-publication-boundary.spec.ts:
  a7b70dfef8a58cc77aaba899babbdff0071c1387f1bbd90359d72c1ea0c4ff39

Native manifest remains
 d1ff7c33a380d578390879a79e142950d0655920710a818af7d49fe2a017521b.
Prior failing native results are reused at that exact identity, not rerun or
reclassified. Four required outcomes remain ordinaryABC after compound rollback
and subsequent field write; prepend redoXA; nested append redoXAY; nested prepend
redoYXA. The finite models' old representability result does not close those native
failures. The approved ordering-refusal policy retains its separate passing result.

## Limits and next gate

Selected operation counters and internal record counts are not exhaustive JS
allocation counts, CPU, heap bytes, GC, framework cost or artifacts. Counter phases
separate preparation/install, inverse command construction, cleanup, verification
and retention. The initial42-row report takes its final retention read after its
counter snapshot; that reporting scan is excluded, earlier explicit checks included.
Caller descriptors/assertions/output are excluded and external roots stated. A record
released from a map is not a collected object. No universal speed or size claim.

The native design requires complete proposed physical patches and ordinary intents
before source capture, including reciprocal neighbors and final compound placement;
atomic source/responsibility installation; changed-slot agreement normalization;
and indexed, independent recovery/history retention. These are specific native
implementation obligations. Neither frozen model is adopted unchanged. Sparse can
advance as a hypothesis; snapshot remains a semantic control. The recurrence stop
and later-slice gates remain active. No native repair was performed in this task.

## Replay

Extract evidence.tar.gz into a new directory, preserving the original raw files.
Each script resolves its included unchanged model relatively. With Node24.15.0:

    node measure/run.mjs
    node measure/order-local/run.mjs
    node root-partial-convergence.mjs
    node review/cleanup-discriminator.mjs
    node review/partial-convergence.mjs

These standalone research measurements are not package tests. First logs, exact
commands, preregistrations, source hashes, raw JSON and independent probes are
archived. Native reproduction/reconstruction remains in the preceding
order-policy-recurrence evidence; package tests use pinned pnpm10.17.0 through Nx.
No broad suite, native benchmark, build or budget gate was rerun without a runtime
change. EVIDENCE-FILES.json gives archive-member hashes before packaging.
