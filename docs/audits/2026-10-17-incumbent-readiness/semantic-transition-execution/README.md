# Shared semantic transition migration — rejected at covered S3

October 20, 2026. Owner authorized slices0–5 at plan `f80645c8`, with recurrence
limited to an already-covered path or caller-specific exceptions, not unmigrated
writers. That condition is now reached. **Reject this experimental candidate;
stop dependent migration. No runtime integration or activation.**

## Source and artifact identities

- Plan/source base: `f80645c8e73e3a958b43b4214ffb6b6333ea332d`.
- Unchanged production runtime: `87f6831fa60cafe87508f0ace84b7638698ca3b0`.
- Historical comparison incumbent: `8d220643e0d4e34cbdbc6e55e6ef692b25d5e023`.
- Candidate was an isolated filesystem copy, not a runtime Git commit. Complete
  TypeScript source-manifest identity:
  `63e23f78349de3c8137947be09ee65b4e4e8989f47de1322570cd3442fe2b56b`.
- [Archive](evidence.tar.gz) SHA256:
  `3a7ad2110343cffeb2204a4d22927adcce9a4ee52bb67cec7dcfd3a3d89342e5`.
  [Manifest](MANIFEST.sha256) identifies all115 members. The archive contains
  `IDENTITY.json`, complete source hashes,19 changed/new TypeScript overlay files,
  frozen prerequisites, tests, logs, initial failures and independent bundles.

No rejected entity patch was installed wholesale. Scalar/projection/lifecycle
prerequisites were materialized from frozen inputs; the candidate implemented a
new typed entity transition. Their original hashes and transformations are saved.
Unrelated `AGENTS.md` and measurement-contract edits remain untouched.

## Decisive ordinary-input counterexample

1. Ordinary row `{id:'a', n:7, m:0}`; scalar x0.
2. Inspection displays n99; ordinary n remains7.
3. Transaction writes x1 and row m4.
4. Rollback restores x0/m0, leaving inspected n99 displayed.
5. A new transaction explicitly writes n99, inspects, then rolls back.

Required: step5 captures adoption and restores n7. Candidate: inspection is empty
and rollback leaves n99. The otherwise-identical entity-only first transaction
preserves the baseline and passes. No Link connection, injected fault, structural
membership change or undo API is needed.

The instrumented trace observes S3 exactly once in the mixed arm. The adapter
constructs a physical full row and overlays only m's reversal, then passes
subject/key/value without the reversal footprint. S3 calls full-row transition
preparation: ordinaryBefore n7/m4 becomes ordinaryAfter n99/m0. It then deletes
the divergence baseline. This is accidental ordinary adoption, not stale display
or a missing delivery wake. Its later no-op is a consequence of lost authority.

Independent uninstrumented reproduction and the Nx two-arm test agree.
[Final independent review](FINAL-REVIEW.md) explains the premise and source trace.
Minimal S3 discharge was explicitly included in slice1, so the unmigrated-writer
exemption does not apply. The container carries both views but this handoff still
reconstructs ordinary authority from a physical target. No patch followed discovery.

The exact incumbent control fails both arms because it lacks approved entity
adoption semantics. This is failure to implement the approved capability, not a
claim that the mixed result is newly regressed from that incumbent.

## Results and limitations

| Evidence | Result | Qualification |
| --- | --- | --- |
| Original archived A1 replay on frozen rejected overlay |9 true checks,1 no-chronology failure | Original witness retained; not incumbent capability evidence |
| Initial promoted adoption tests, production and prerequisite-only controls |7/7 fail each | Missing adoption; separate from original A1 chronology failure |
| Candidate adoption/reentry/refusal/repeated-write + designated restoration |12/12 pass | Useful endpoint convergence asserted; not general qualification |
| Existing E1/E2/E3 |39/39 pass | Update equivalence, setAll staging, inspection egress |
| Existing replay/refusal/inspection/recovery selection |22/22 pass | Four focused Nx files |
| Four-facade scalar prerequisites |16/16 pass | Set/update and Link/no-Link; not full framework timing suites |
| S3 public two-arm Nx regression |1 pass,1 fail | Entity-only passes, mixed scalar/entity fails |
| Same S3 assertions on production87f6831f |0 pass,2 fail | No prior approved adoption support |
| Newly approved structural topology cases |0 pass,3 fail | Unmigrated slice2 baselines; not recurrence evidence |
| Library typecheck after prerequisite corrections |11 diagnostics | Identical fresh control diagnostics in semantic fixtures; not clean |
| Entity collectibility |Unresolved | No new collectibility claim or repeated GC campaign |
| Full qualification, installed artifacts, fresh costs |Not run | Gated off by correctness stop |

These counts are separate runs and overlap. Do not sum them into a unique coverage
total. Original scalar historical expectations/misuse classifications remain in
the prior archive; this phase did not rerun or silently reclassify the entire A4
family or semantic matrix.

Two new restoration tests initially omitted `undoable()` and one also assumed
same-turn undo. Their original source/results remain archived as **harness-contract
mismatches**. Existing documented designation/settled-turn rules were verified
independently. The corrected designated later-action twin passes unchanged undo7 /
redo99 assertions; no runtime repair was made for those failures. Initial probe
instrumentation and invocation errors are preserved separately. An incorrectly
placed pnpm `--dir` invocation did not execute tests; the corrected cwd run did.

## Reviews and stage disposition

The initial design review caught delivery and pending-queue authority consumers
missed by an enqueue-only proposal. They were included in the shared metadata
migration; raw native tuples remained physical. The writer review then identified
S3 as unproved. A targeted probe converted that concern into the counterexample
above. Root independently reproduced it through Nx and verified the source trace;
final review independently bundled native source without instrumentation.

- Slice0: frozen provenance and initial falsifiers promoted; remaining combined
  matrix coverage is unfinished, not implicitly passed.
- Slice1: **rejected** on its explicitly covered minimal S3 path.
- Slice2: approved structural assertions preserved; no implementation.
- Slices3–5: no completion or qualification claim.

The owner separately approved restoring ordinary topology within the authored
footprint: rejection of inspection-created B's adoption removes B; rejection of a
new row in an inspected vacancy restores the prior ordinary lifetime; rejecting
ordinary-neutral removal does not resurrect inspection-created B. Unrelated
inspection remains. This resolves the specification question, not implementation
acceptance. The first three failures are retained unchanged for future evidence.

## Options at the stop boundary

1. A separately scoped successor could carry the authorized realization footprint
   and explicit ordinary target through the adapter into preparation, installation
   and publication. It must prove this same mixed test before claiming a general
   transition repair; a physical row plus an optional inferred field list is not
   automatically adequate for structure, absence or replacement. This is an option,
   not another repair authorized or implemented in this phase.
2. The owner could defer declared early publication and revisit product scope while
   retaining production's conservative hold. That would require a separate product
   decision; the current progress requirement has not been waived.

Recommendation: retain the safe production runtime and reject this candidate.
Preserve the passing mechanisms and the precise missing-footprint evidence. Do not
claim the shared approach impossible, reopen B, raise budgets or launch another
unbounded sequence of caller fixes. Entity collectibility and current artifact
blockers remain independent unresolved obligations.

## Replay

Node24.15.0 and pinned pnpm10.17.0. The standalone independent bundle is the
portable exact executed artifact; it needs no source patch or instrumentation:

```sh
mkdir -p /private/tmp/semantic-transition-replay
tar -xzf docs/audits/2026-10-17-incumbent-readiness/semantic-transition-execution/evidence.tar.gz -C /private/tmp/semantic-transition-replay
cd /private/tmp/semantic-transition-replay
node independent-final/bundle.mjs
```

It prints two cases: entity-only `pass:true`, mixed `pass:false`. The original
isolated source remains at `/private/tmp/semantic-transition-execution/candidate`.
Its unchanged asserting Nx replay is:

```sh
cd /private/tmp/semantic-transition-execution/candidate
NX_DAEMON=false NX_ISOLATE_PLUGINS=false corepack pnpm nx test kernel --testFile=entity-semantic-point-recurrence.spec.ts --skip-nx-cache
```

Expected exit is nonzero:1 failed,1 passed. Archived overlay plus base f80645c8
and source hashes preserve reconstruction; experimental helper imports use the
original isolated path, so use that path for identical source reproduction. The
standalone bundle avoids that path requirement. Other generating commands and
source identities are in the archived prerequisite/review reports and Nx logs.
