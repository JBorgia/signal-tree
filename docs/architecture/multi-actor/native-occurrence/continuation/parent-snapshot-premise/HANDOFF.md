# Raw parent-snapshot completion evidence for Carver / Main

Prepared for independent premise review; no design verdict. No runtime edit or new execution in this handoff. R3 membership-phase correction is a separate workstream.

## Exact reproducer and observations

`raw/construction-completion-snapshot-review.spec.ts` is the final typed diagnostic. It uses ordinary whole-value rows writes, transactions, Link and an existing private membership participant. The participant completes first appearance of a; during completion it reads the parent snapshot and installed leaf, builds a nested whole assignment by spreading that parent snapshot and adding b, writes it, then throws a sentinel. Assertions outside the callback require actual completion and the original sentinel error. JSON is diagnostic output, not an acceptance oracle for freshness.

Same fixture, independently executed on both:
- a158ac53ac601c7fbe065fe09ba0057f024a9695ac58d25bce14770fa61802b6, cleanup base.
- f63ade892aa381b827f1db54986fbb2ca787cb1bde497847104bd0a40bd9dffe, shared construction.

Both raw records:
```
observed parent = {}
physical installed child a.n() = 1
nested supplied whole payload = { b: { n: 2 } }
after thrown completion = { b: { n: 2 } }
```

The nested write really omitted a; do not describe its omission as a lost installed slot or terminal receipt. Separate explicit-payload tests supply `{a:{n:1},b:{n:2}}` and preserve both identities/receipts through completion reentry+throw. Those controls do not excuse or establish correctness of the old parent read.

`raw/base-a158ac53` and `raw/shared-f63ade` contain exact manifests, COMMAND.json, RESULT.json, first.log and observations. Exact command was:
`corepack pnpm nx test kernel --skip-nx-cache construction-completion-snapshot-review.spec.ts --maxWorkers=1`
with Node24.15.0, NX_DAEMON=false, NX_ISOLATE_PLUGINS=false, NX_TUI=false, and ST_PREPARED_REVIEW_OUTPUT a fresh observations directory. Both diagnostic exits0 mean data was generated; they are NOT passing freshness assertions.

Original stronger failing receipt fixtures/logs are under raw/neutral-original-expectation and raw/angular-original-expectation. They expected `{a:{n:1},b:{n:2}}` and saw only b; downstream updates below that assertion did not run. Those historical fixtures used string completion tokens and were subsequently repaired to the private object-token type in later controls. Treat their runtime outcomes as preserved chronology; use the final typed diagnostic for a clean replay. Earlier overly broad participant also claimed existing-member visits; do not reuse its exact two-completion assertion as a contract.

## Source trace to inspect, not an approved solution

At shared source:
- internals/materialize-markers.ts: installPreparedMember installs allocation, physical child/backing store, terminal records and membership, then calls publishMembershipChange before completePreparedPublication.
- internals/snapshot-authority.ts:69 publishMembershipChange increments a membership cell, then invalidates owner metadata. materializeSnapshotNode builds a cached locations.createDerived snapshot.
- internals/location-runtime.ts: publish accumulates publishers while invalidationGroupDepth>0. Derived dependency invalidation/delivery occurs at group draining. makeNodeAccessor ordinary whole-write path supplies the surrounding group.

Therefore calling membership publication before completion does not alone establish parent snapshot recomputation inside that group. Review the proposed currentness mechanism against this exact boundary, and against scalar changes, hidden membership, nested collections and restored ordinary/physical divergence. Do not infer that every snapshot path is stale from this one witness.

## Independent review scope when design arrives

Owner constraints: bounded source-owned revision/currentness; preserve memoization and approved direct ST-current reads; preserve warmed application-native computed timing. No always-build fallback, blanket/global invalidation, physical reread that substitutes publication authority, new public API or root edits.

Questions to resolve from the design: which exact source changes advance the snapshot's read revision; when an installed image becomes available; unchanged-read object identity and build/equality counts; unrelated-branch isolation; nested/reentrant preparation and thrown completion; error recovery; held readers before/after enrollment; rollback/absence/reveal; disposal; and full demanded output versus unobserved point work. These are review questions, not added laws or an implementation proposal.

R3's operation-wide membership sealing/source-validation counterexample must remain separately identified. Fresh parent reading must not resample recipient proofs, widen participation, or move native app publication earlier.

C6 has now appeared: manifest925bd916560115e5fffd9c761e2eeca6a170f43dab0c8214aa5c7177315b69b4, composition C5 plus f63ade. This handoff does NOT claim replay on C6. R3 predecessor record names R2 manifest289e25b0aeb5ab0d936c81b7ba77bf6994929c1a081418f6c0f6996e8c198a99. Await an exact design/source packet before issuing a premise verdict. No peer verdict was supplied to this review.

RAW-SHA256.json pins the copied original evidence. Existing host task inventory did not expose a Carver handle; this shared filesystem packet is ready for Main/Carver to consume without external transmission.
