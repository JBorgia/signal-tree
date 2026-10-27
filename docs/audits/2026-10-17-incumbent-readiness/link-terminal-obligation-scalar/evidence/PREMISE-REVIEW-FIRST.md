# Independent terminal-obligation mechanism review

Reviewed clean HEAD `440ead9f1b4d45c63f7ec8cbf50fc15944f101b2` in `/private/tmp/link-terminal-obligation-scalar`; source hashes are in PREMISE-SOURCE.json. Governing combination contract is readiness `dabd8880:docs/audits/2026-10-17-incumbent-readiness/link-evidence-combination-review/SPEC.md`, with the392fcf46 membership contract and older link-declared-contract/SPEC.md's admission and outcome rules. Read docs/review-contract.md. No runtime or test edits/executions were made for this review. Entity work remains gated.

Recommendation: prefer A, a private consumption-boundary projection of outstanding actual input obligations, preserving the historical source proof. It is narrower than changing terminal-aware predicates across admission consumers. A is adequate only if “at consumption” is enforced at native input capture and not implemented as an unrestricted live filter inside nativeProof. B is possible in principle, but still requires the same temporal/role distinctions and offers no smaller correctness argument here. Neither option is validated implementation merely by this review.

## Contract interpretation

The current rule says a source revision's “unsettled D becomes an input requirement of the consumer.” A successfully confirmed source owner no longer provides the speculative input obligation that made an independent consumer contradictory. A new consumer may have complete empty input evidence and publish after its own remaining gates; this does not mutate the original author's proof or receipt.

The older declaration contract separately requires accumulating a known lower bound, preserving nested obligations, and validating at synchronous horizon closure. It says a complete list omitting a known owner cannot replace valid responsibility. Those requirements apply to an obligation actually encountered while unresolved, not a license to resurrect every historical confirmed owner on every future consumption. The review does not change rejected, abandoned or unavailable semantics.

A historical source proof's validation role and a current executing validation frame are distinct. When a completed source fact is consumed in a new operation, historical D/I/V reasons enter through that input boundary and successful confirmation can discharge their outstanding owner constraint there. An active enclosing frame's explicit V remains binding in its existing role: an independent nested declaration cannot erase an outer dependent[p] assertion by checking that p is now confirmed. An invalid source proof or invalid active horizon also remains invalid; terminal status is not revalidation.

W remains W even after all captured owners confirm. Its settled state permits fresh surviving-basis evaluation; it is not converted into declared proof by this projection. Inherited unknown/invalid evidence likewise cannot become clean by deleting confirmed actual owners. Rolled-back or abandoned identities, source disappearance and missing registry entries are not successful confirmation and must not use the confirmed path.

## Exact source seams and temporal requirement

Current lifecycle.ts:67–81 reads source nativeProof and promotes all input owners at line73. Contradiction is prepared at84–99 and again through prepareRevision:141–174; finish:212–228 freezes proof and completes receipt state. These are repeated evaluations, not a single consumption event.

The actual earlier source seams already exist:

- Scalar native input capture is called before the updater in location-runtime.ts:480–490 and native-tree-scalar-leaf-runtime.ts:274 onward.
- private.ts:118 captures native input requirements; nativeInputs at107–108 currently returns source requirement identities, whose owner cells remain mutable.
- Branch beginBranchInput:134–143 captures the descriptor for the supplied argument before the updater. signal-tree.ts:483,1118,2104 use that port.
- intrinsic-mutation.ts:306–320 prepares native and optional participants, then performs pure finalization before installation. This later phase updates the new unit's own possible window; it is not a replacement for the earlier input-consumption event.

Smallest counterexample to a live filter: p is pending when a native updater receives its p-authored argument. The updater or an optional preparer then confirms p. An independent declaration that omitted the actual p input must not become valid because a later nativeProof/admission invocation now sees outcome=confirmed. The current implementation retains this contradiction; a terminal repair must preserve it. Conversely, p confirmed before the input capture must not become a permanent constraint on a fresh independent consumer. A truthful dependent[p] consumer may become eligible after p confirms without a new setter.

A therefore needs a stable distinction between already-discharged source obligations at capture and obligations encountered unresolved. It need not freeze owner outcomes globally: pending owner cells must still transition for wake/eligibility. It must not freeze an unfinished source proof prematurely either. A source requirement can retain an open validation horizon; newly discovered lower bounds and invalidity from that horizon must continue to propagate. Snapshotting only the presently visible clean proof before the horizon closes would silently weaken existing shared validation. The consumed descriptor must retain the relevant source identity/horizon responsibilities while preventing later terminal transitions from rewriting the original contradiction evidence.

Preparer reentry also retains the separate installation rule: newly opened owners can belong to the current uninstalled unit's own W; previously installed sibling windows and the already supplied argument are not recaptured. No user updater or optional participant is replayed. A preparation error installs no new responsibility, while post-install failure retains existing recovery/error behavior. This terminal change should not alter those incumbent boundaries.

## A versus B

| Mechanism | Viable scope | Concrete risk to exclude |
| --- | --- | --- |
| A: consumed-input obligation view | Derive the new consumer's actual lower bound from source evidence; retain original proof, exact source revision and unsettled validation linkage | Filtering at prepare/finish instead of capture; copying a still-open horizon as complete; stripping unknown or inherited W |
| B: retain full proof, terminal-aware admission | All contradiction sites must distinguish source-input history from active V and respect captured unresolved evidence | A delivery-only fix leaves the observable declaration throw; checking live outcomes in contradiction predicates retroactively validates earlier omitted input; divergent receipt and admission predicates |

B cannot simply teach delivery to ignore confirmed p: delivery already accepts actual owners when all are confirmed, and the observed failure happens before delivery at after-callback contradiction. If B retains full proof as provenance, it still needs a separate answer to which reasons were outstanding when consumed. That is the same distinction A expresses at the source boundary, with more opportunities to apply it inconsistently.

No reason here supports global filtering of owners, rewriting historical proof/receipts, source-value taint inference, a new settlement registry, or a hidden-input independence exemption. This is a consumer projection of an authentic immutable owner identity's terminal result, within the approved source requirement machinery.

## Required prewritten discriminators and receipt expectations

These are requirements for the bounded implementation, not tests claimed executed here:

1. Preserve the two original confirmed-D failures as useful positives: same-leaf derive and cross-source native input after source confirmation, unrelated q pending; no throw, send8, started/declared.
2. Keep pending same-p D-to-I contradiction and current fourteen combination controls. Pending I remains required even when destination D has the same identity.
3. Contrast historical source V after confirmation with active enclosing V naming that same confirmed identity: fresh independent consumption can be valid in the former; nested empty declaration must preserve the existing contradiction in the latter.
4. Confirm p inside the updater and separately inside an optional preparer after input capture: an omitted pending input still contradicts. A truthful dependent[p] control remains useful, wakes appropriately, and does not become unknown solely from historical D.
5. Consumed W(p), unknown or invalid source evidence must retain their category when p is already confirmed and when it confirms during the operation. W drains to surviving basis, not declared; invalid evidence is not retrospectively blessed. Existing rejected/abandoned/unavailable behavior remains unchanged.
6. Preparation failure, owner-window reentry, no-event wake and terminal receipt stability must still hold. No broad qualification is inherited from prior focused counts.

The known two-case confirmed-input failure was already executed in the prior review on both candidate and predecessor, with original assertions preserved. This review does not rerun it or claim new runtime outcomes. The physical/ordinary cached-certificate question is a separate unresolved qualification item; terminal discharge must not conceal it by declaring missing native evidence clean. No entity change is justified until the scalar rule and its required controls survive.
