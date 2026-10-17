# B authored topology repair experiment: rejected

Start: `2645000d1e6a96019d27b3e705c1aceb0140e965`. The final local checkpoint is
the commit containing this record. Original rejected integration `aa1d7653` and
R2 `f4d6a7ac` remain separate ancestors. Default activation is unchanged.

## Bounded implementation

Only native-entity-ownership-experiment.ts changes runtime behavior. Field writes
no longer promote observed membership into authored key/existence facts. Their
surviving values are retained while pending membership makes them a live existence
dependency; incompatible removal refuses before installation. Settlement retains
settled field facts until that obligation ends, then reclaims dependency records.

Ordering preparation follows captured/native successor links through removed
lifetimes to a proposed surviving successor. Only neighbor identities are retained;
physical successor, occupancy and reentry validation remain unchanged. The candidate
does not reconstruct the whole collection. This is source evidence about these
paths, not a new measured performance or universal ordering-correctness claim.

## Decisive new regression

The unchanged prior test `b-public-entity-experiment.spec.ts`,
“preserves ordering dependencies on a created lifetime in creator-first rejection
order,” rejects this candidate:

1. Seed A,B.
2. Transaction creator appends C.
3. Independent pending transaction uses setAll to order C,A,B.
4. Reject creator.
5. Candidate succeeds and leaves A,B. Required: preserve C,A,B, or refuse atomically
   with both transactions still pending until the ordering dependency is settled.

The exact test passed the previous qualification. Removing broad membership capture
correctly stops field writes from acquiring keys, but it also exposes a missing
explicit-order existence dependency. Creator settlement checks field dependencies
only. It does not visit the other author's ordering ledger; physical placement
validation cannot determine that semantic dependency. No assertion is weakened.
This is a new regression, not one of the original failures or a fixture mismatch.

## Results and first failures

| Run | Result |
| --- | --- |
| Eight new discriminators on unchanged start | 1 pass, 7 fail |
| Original four-case replay, unchanged assertions | 4 pass on candidate |
| Eight discriminators + five independent probes | 13 pass after correction |
| Prior affected B lifecycle/entity/retention/capture controls plus new 13 | 123 pass, 1 fail |
| Relevant unchanged B-selected rekey/order groups | 15 pass, 15 fail |
| Final test-file cleanup replay: entity discriminator file plus new 13 | 38 pass, 1 fail |

No expected-failure markers or skips account for these results. All 30 relevant
group identities match previous qualification: previously 13 pass/17 fail; now two
rekey field-write cases improve, and the other 28 verdicts remain unchanged. The
15 retained failures include incumbent-specific observation expectations, refusal
reporting/semantics and reentry differences. They are not diagnosed as 15 independent
production defects. Exact assertions/errors remain in relevant-comparison.json.

The first eight-test baseline included an incorrect expected payload id after
changeId. That test-contract mismatch was explicitly corrected before runtime work;
the original eight-red log is preserved alongside the corrected seven-red baseline.
Storage-key and payload-id divergence remains allowed.

Independent review first exposed loss of a confirmed newly introduced field when
its own owner settled before its lifetime creator. The first candidate deleted the
row; baseline retained the new field but lost original fields. Retaining the settled
field ledger until membership terminality corrected the candidate failure. It also
corrected a hidden field rollback/restoration replay that had failed both baseline
and the first candidate. Their first red logs and source snapshots remain preserved.

The reviewer then found no blocker within five probes. The larger affected matrix
exposed the independent-order regression above; final independent review verified
it and superseded that earlier positive disposition. Root verified the unchanged
test, source trace and prior passing verdict. Review agreement does not override
this failure.

## Verification limits

Source typecheck passes. A new test's empty cleanup callback initially failed lint;
optional cleanup invocation corrected it without changing assertions. Final kernel
lint passes with 15 existing warnings and zero errors. No ceilings or lint rules
changed. Spec-types passes its unchanged ratchet with six existing diagnostics remaining;
this is not clean spec compilation. No ratchet was changed.
The permanent reviewer test filename changed from b-review-probe.spec.ts to
b-topology-dependencies.spec.ts; equivalent assertions were rerun after formatting
and explicit authority guards.

No full kernel/framework suites, builds, CPU, heap or artifact measurements were
rerun. Previous cost penalties remain unresolved; these semantic improvements do
not establish production superiority. No new API, v15 change, merge, push, tag or
publication. This is a preserved failed experiment, not accepted integration.

## Replay

Use Node 24.15.0 and pinned pnpm 10.17.0, including subprocess PATH. Run
`bash docs/research/b-native-integration/topology-repair/replay.sh` from this checkout.
It records expected failing gates instead of treating script completion as success.
The original minimal replay's historical comment says expected exit1; on this
candidate its unchanged four assertions pass. The explicit-order regression stays red.

Full logs, source fingerprints and first failures are in EVIDENCE.md's local archive.
