# Independent retirement-predicate equivalence

**Yes, for closed source-owned requirements the exact retirement decision can be represented by a static blocker plus live qualifying-window cells, without retaining composite ancestry.** A role-wise proof alone is insufficient. Source disappearance requires a live registry-identity test at assessment, not just cached outcome. This is predicate equivalence, not approval of an installation/lifetime implementation.

Reviewed model.ts, EXTRACTION.json, main-replay.log and the actual frozen C25 lifecycle/entity source. All seven extracted chunks exactly occur in the model and match recorded hashes; both source hashes match. IDENTITY.json records checks. No author's design verdict or discriminator REVIEW.md read. No runtime edits or executions. Main replay reports the seven comparisons and two additional controls; it demonstrates naive flattening failures, not an executed implementation of the summary below.

## Exact algebra

For each FINALIZED non-composite leaf r, read its fixed proof P. Define H(r) as truth of any of:

`P.invalid || P.unavailableInput || P.terminalRejectedRoles || P.owners.length || P.destination.length || P.input.length || P.validation.length`

Optional arrays use length0. Preserve the source predicate's truthiness for flags/bits.

Classify in precisely the source order (entity.ts:251–266):

- H: summary `(B=true, Q=[])`.
- Otherwise, `!P.unknown && possible.length===0`: `(false, [])`, regardless of provenance/historicalWindow.
- Otherwise, both `r.retirementOwnWindowOnly` and `P.historicalWindow` truthy: `(false, P.possible ?? [])`.
- Otherwise: `(true, [])`.

For a composite, OR child B values and identity-union child Q cells. Do NOT classify its aggregate proof as a leaf and do not infer provenance from that proof. An empty components array is the conjunction identity `(false, [])`, matching `.every` even if the composite itself carries other fields. Multiple subject requirements use the same OR/union composition. Preserve first-encounter order if subscription/callback ordering is to remain identical.

At time t define:

`terminalOK(c) = outcome is confirmed OR rolled-back`

`livePending(c) = ownerCellCanTransition(c)`

`release(t) = ready(t) && !B && every c in Q: terminalOK(c) || livePending(c)`

`waiting(t) = {c in Q | !terminalOK(c)}` when release is true.

`retire(t) = release(t) && waiting(t).size===0`.

Expose onSettlement exactly when release is true and waiting nonempty, using the existing exact-cell observer API. Abandoned is not terminalOK. A pending cell with a missing source or mismatched registry entry fails livePending.

Proof: each leaf's first three static branches either permanently block, contribute true with no cells, or reduce to a conjunction of the listed per-cell predicates. Composite `.every` is conjunction. Conjunction associates, distributes over the component traversal, and duplicate cell predicates are idempotent. The waiting Set union is also identity-idempotent. This yields the formulas by structural induction. No outcome-dependent blocker may be frozen at construction: pending-source availability is deliberately dynamic.

Original short-circuit evaluation may populate a partial waiting Set before returning false. That local Set is not exposed by production prepareRetirement when canRelease is false; onSettlement is undefined. The model prints it diagnostically. The two-field summary need not reproduce that incidental diagnostic partial set. If exact partial waiting/order were made externally observable, B plus unordered Q would be insufficient; that is not this source API.

## Why source disappearance is preserved

lifecycle.ts:31–33 checks BOTH pending outcome and `sources.get(cell.owner)?.cells.get(cell.id)===cell`. abandonOwnerSource:67–71 notifies observers, clears cells and removes source WITHOUT changing captured outcomes. Keeping exact cell references in Q and re-evaluating this predicate reproduces the model's true-to-false release transition with unchanged proof/outcome. Do not cache livePending, infer settlement from missing storage, or hold the source registry alive to avoid disappearance.

Use existing onOwnerCellTransition:34–49: it queues callbacks, handles assessment-to-subscription terminal/disappearance races, and cancellation disables queued callbacks. The summary does not establish wake scheduling by itself; lifecycle wiring must retain that API and re-assess. Identity union retains exact cells, never merely owner/id numbers or current replacement cells.

## Limits and cheapest falsifier

The proposed B is static only after proof flags, role membership and leaf provenance are finalized. Readiness/activation cannot be replaced by it: before closure preserve existing barriers and onReady behavior. prepareRetirement's subject snapshot `current()` check must also remain unchanged. Normalizing in place must not install an older endpoint, alter saved inspection certificates, or bypass failed-preparation cleanup.

The minimal future predicate falsifier is to evaluate the summary beside the extracted recursive predicate for every existing model case, plus overlap/duplicate cells, empty composites, blocked+qualifying siblings in reversed order, mixed pending/confirmed/rolled-back/abandoned cells, and exact registry replacement/disappearance between assessment and subscription. Compare ready/canRetire/onSettlement availability and exact subscribed cell identities; preserve queued cancellation behavior in a separate lifecycle test. These summary comparisons were NOT run here. Existing raw replay already supplies decisive negative controls against naive proof flattening and provenance promotion.

The summary intentionally retains all qualifying-window identities unless a separately justified optimization removes them. Flat Q size can still track owner history, and general L15/all-root/GC bounds do not follow. Role proofs and this retirement summary have separate jobs: preserve D/I/V/W and terminal bits for publication, preserve leaf retirement classification here. No new terminal policy, owner erasure, runtime architecture or activation is authorized by this equivalence.
