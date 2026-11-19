# Finalized-role normal form — hypothesis for independent review

**No accepted design or runtime authorization.** C25 derived growth motivates replacing completed composite ancestry with an equivalent role-wise proof, only after **validation AND activation readiness**, not owner settlement. Existing `combineProofs` already unions D/I/V/W OwnerCell references and rejected-role bits, preserving unavailable/historical/unknown/invalid flags (lifecycle.ts:100–110). Live cells must remain live: pending p/q, later rejection and confirmation cannot be snapshotted away. Actual input q must survive even after p confirms.

## Exact seams and unresolved proof obligations

All paths below are under candidate/packages/kernel/src/lib/experimental-publication/.

- `lifecycle.ts:124–126`: composite `proof` is a getter closing over `sources`; clearing `components` alone leaves hidden ancestry. A future closed representation must replace both component edges and getter closure with a data proof, preserving requirement identity and exact role sets. Flattening growing history is insufficient.
- `lifecycle.ts:181–208,350–375`: preparation records installed requirements in the existing horizon; finalize updates the new installation's own possible window, and finish snapshots proofs before clearing inputs/frames/known. These are the identified NativeRequirement semantic-write sites. Composites are not currently enrolled for that transition. Operation-proof rewrites elsewhere are recipient state, not permission to discard source evidence. A closed source proof appears stable apart from live OwnerCell outcomes, but exhaustive caller/alias proof of no later finalize or writable proof mutation remains a prerequisite—not an established guarantee.
- `lifecycle.ts:121–147,211–215`: readiness includes unfinished validation, activation and recursive children. Proof existence alone is insufficient. Preserve exact dependencies until ready; release local ancestry only then. Prefer the existing finish/deliver boundaries and local installed records, not a global scan or second compensation authority. A requirement already ready at construction also needs the same closed representation. Last-use-only normalization would leave idle installed chains retained.
- `lifecycle.ts:115,187`: retirementOwnWindowOnly is preparation provenance. Preserve its exact value, including absent; do not derive it from compacted roles, all-confirmed owners, or merge it into eligibility. Inherited W remains W even when also present in D/I/V.
- `private.ts:105–125,197–202,447,544`: saved views and facts alias requirements. Normalization must preserve old snapshot meaning and exact selected endpoint identity without relabeling inspection99 as ordinary7. Supersession/reentry must never reinstall the old endpoint. No callback-capable normalization in atomic stores.
- `private.ts:436,521` and `lifecycle.ts:128–147`: current invocation listeners are attached at installed completion and released on readiness/disposal. Future composite closure must not register strong roots/listeners for failed preparation, strand releases, change callback/error ordering, or notify before activation. Weak unfinished sets alone do not prove listener cleanup; proposed enrollment and every failure path require review.

## Finite gates before any successor acceptance

1. Static write/alias inventory establishes post-ready proof immutability except live cells; no getter closure, component edge or listener retains completed ancestry. Preserve exact retirement provenance and all flags.
2. Fixed p and p+q actual-input loops at 1/2/4: selected and all-root graphs bounded by live obligations/unfinished validation, then 64/256 only after safe traversal. Preserve useful final delivery and actual q after p confirmation.
3. Unfinished, nonmatching-recipient and late-enrollment cases: no early readiness; failed preparation, callback errors, supersession and reentry leave no extra roots/listeners or altered first error.
4. Replay Main13/companion, terminal possible/actual, saved-snapshot leaf/frame, unchanged scalar support/inspection/parent controls and receipt counterparts. Rejected input cannot cleanse; net-zero restores prior selected endpoint. No owner settlement prerequisite and no new recipient policy.

This is a small shared representation hypothesis, not a claim that readiness already supplies every needed installation hook. Independent premise review must resolve those hooks before C26 runtime.
