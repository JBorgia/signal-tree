# Independent cancellation correction review

**Bounded acceptance of this cancellation delta.** No remaining counterexample found in the requested scope. This is not acceptance of the joint-phase integration or a fresh replay of all 126 author controls.

## Identity and scope

Reviewed the raw lifecycle source and runtime.patch before using any author verdict. Frozen source manifest SHA256 `a22a4e603e3e28c2fbcc0d99d11e79f0b8f03eb0c762028896b8897b46fecc8e`; 2,977 manifest entries. The only runtime delta against the recorded base is `packages/kernel/src/lib/experimental-publication/lifecycle.ts`, the release closure in `onOwnerCellTransition` (lines40–49). Fresh disposable copy at this directory's candidate. IDENTITY.json records freeze and exact original test hashes; VERIFICATION.json confirms author source, author freeze artifacts, and copied source unchanged after execution.

## Mechanism

The first release sets `active=false` before clearing its own callback and removing its observer. Every later release returns without touching either the captured Set or the current WeakMap index. Deleting an empty Set's index additionally requires `ownerTransitionObservers.get(cell) === observers`. An old handle therefore cannot delete a newer registration's Set. Both protections are present; the identity guard does not depend on assuming every caller releases just once.

Queued work consults `observer.callback` at execution, so cancellation suppresses already queued delivery without cancelling another observer. The queue bit and transition scheduling are unchanged. A callback that releases itself and registers a successor for a terminal cell gives the successor its own queued delivery; the released observer cannot reactivate. These are actual exact-cell controls using runtime transaction owners, not synthetic cells.

## Independent execution

- Original two falsifiers replayed unchanged: **2 pass** (the other eight intentionally filtered). This includes the real source retirement formerly stranded by a stale cancellation, not just a callback count.
- Exact original ten-control file, byte-identical to the earlier independent review: **10 pass**. Preserves late enrollment/two-owner gating, later-window exclusion, disappeared/abandoned owner retention, same-key reentry, destroy with issued metadata, and actual I/V refusal.
- Five author cancellation controls inspected and replayed: **5 pass**, including queued cancellation and reentrant self-release/successor registration.

The original failing source/logs remain at `/private/tmp/st-fixed-window-retirement-independent`; nothing was overwritten. Commands and raw logs are alongside this review. Types and the full126 selection were not independently rerun for this tiny delta; do not reattribute the author's broader result to this review.

## Joint merge boundary

This resolves the cancellation blocker in the prior REVIEW.md and JOINT-INTERFACE.md. It changes no eligibility, provenance, owner outcome, readiness, or retirement authority. Retain the earlier joint-interface obligations: original preparation provenance, installed/validated readiness separate from owner settlement, and exact source/lifetime eligibility. The joint-phase successor is a separate candidate and still requires its own review after final freeze.
