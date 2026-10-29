# Changed-semantics review: revision 2 and retirement proposal

2026-10-29. Reviewed `DESIGN-REVISION-2.md` and `RETIREMENT-MECHANISM.md` against frozen runtime75416029, specifically lifecycle owner transitions, captureNativeInput/nativeProof, declaration validation, receipt refresh, projection decision and native input acquisition. No tests/runtime/controller changes. First review remains intact. This is not approval of the undeveloped selected-unit planner.

## Disposition

Revision 2 resolves the main semantic ambiguities in the first draft: relationship baseline evidence is distinct from native evidence; contribution selection does not itself create actual input claims; authored admission and outgoing aggregate proof are separate; negative support can change without membership change; order-domain authorship is not inferred from moved indices; unknown can reach governed surviving fallback.

**No demonstrated new public-policy choice is necessary to continue the internal design.** One material equivalence qualification is still missing: terminal-W compaction must preserve historical uncertainty provenance, not merely generic `unknown:true`. General terminal-role compaction is a permissible candidate private proof extension requiring its own concrete equivalence review; its absence is a resource/implementation gate, not automatic justification to reopen the closed replacement architecture or change the product contract.

## 1. W-only compaction: conditional equivalence, missing discriminator

The frozen lifecycle supports the proposal's narrow observation argument:

- `lifecycle.ts:71–72` captures actual unresolved owners, not W members as actual inputs.
- `:82–87` preserves unknown while carrying W independently.
- `:141–146` reports conservative unknown before checking rejected actual dependencies.
- `:197–201` and `private.ts:300–306` use W only for pending/abandoned checks, while unknown denies early permission.
- Confirmed/rolled-back outcomes cannot reverse (`lifecycle.ts:24–31`). No later wake from those W members is needed.

Thus an entirely terminal W-only component can drop its terminal owner identities for **future** current-source views while preserving unknown, if it has no actual owner, validation/horizon or invalidity information to preserve. Previously issued requirements must stay untouched. Pending, abandoned or unavailable authority cannot be folded this way. Empty original W must not be turned into unknown merely because it passes the “all terminal” predicate vacuously; require an actual historical uncertain component.

However, generic unknown is not a sufficient representation for the combined planned system. Frozen `entity.ts:10` unavailable() and `private.ts:90` unavailableInput() have the same observable proof shape as the proposed compact certificate: owners empty, possible empty, unknown true, invalid false. The approved unavailable-inspection-input repair must capture a new authorship window for the former; the inherited historical W rule prohibits doing that for the latter.

Concrete discriminator: removal captures W(q); q settles; source compacts; unrelated r opens; a complete native consumer reads absence. A generic-unknown classifier could now acquire W(r), violating fixed-window nonextension. The same classifier must still acquire pending r for a genuinely new unavailable P input under the approved owner decision.

**Required correction:** retain a source-issued historical/closed-window provenance discriminator (or an equivalent distinguishable certificate identity with specified semantics) through capture, summary composition, transfer and future consumption. It must survive idempotent summary folding and remain distinct from freshly unavailable evidence. This does not require preserving q's identity or retired subject/key. Calling the object “terminal-uncertain” is not enough unless the consuming protocol actually recognizes that distinction.

The compaction claim is therefore sound against the frozen narrow consumers, but not yet proven against the required unavailable-input successor. This is a representation omission under existing policy, not an owner-policy question.

## 2. General terminal actual/validation roles: reviewable private extension

The proposal correctly refuses to turn rejected actual input into W-only unknown. `captureNativeInput` retains rolled-back actual owners; complete declarations check required inputs against declared identities, and `runDeclaration:254` disallows declaring rolled-back/abandoned owners. A generic unknown substitute could remove the required after-callback contradiction, change primary-error precedence, or change receipt reason. Abandoned authority also remains blocking, unlike successfully rolled-back W.

An identity-free terminal-unavailable role summary is not inherently a new state authority, settlement selector or public API. A0 already authorizes publication support and compact outcome evidence. The full internal-work plan permits developing and reviewing such a representation. It needs explicit algebra for transport versus consumption, declaration validation, unknown/invalid precedence, held versus surviving fallback, supersession, authentic held owner handles and error reporting. Keep identities wherever a supported operation can still distinguish them.

Minimum adversarial examples: rejected D transported untouched versus subsequently consumed as I; confirmed actual source consumed after versus before confirmation; invalid finalized horizon versus unresolved horizon; abandoned authority versus rejected authority; unknown plus rejected/invalid combinations; callback throws while contradiction also exists. A proof extension must preserve these distinctions, not just final endpoint values.

**Boundary:** continuing private mechanism design is permissible. Implementing an unspecified compression, claiming O(1) retirement for arbitrary rejected histories, or changing these observable outcomes is not. If no equivalent finite summary exists for a supported identity-sensitive operation, record that counterexample and choose an explicit bounded-resource/product response; do not assume impossibility merely because current Proof lacks a field.

## 3. Remaining mapping cautions, not new policy gaps

- **Initialization-table precedence:** the coherent inspection-derived baseline case must retain recipient baseline-safe support even though its native P certificate remains unavailable. The P≠O row must not accidentally override that approved recipient permission. Express the two layers explicitly: source provenance versus recipient permission plus preventing support. This is a table clarification, not a new baseline policy.
- **Validation/retry wording:** “retry privately or refuse atomically under existing behavior” cannot authorize a new public Link-creation refusal or replay user callbacks. Name existing validation/refusal authority at implementation mapping; otherwise use the governed unavailable outcome or stop that exact unsupported preparation path.
- **Absence summary supersession:** once retired identity/key is gone, show how the existing producer determines whether a new authored occupancy supersedes a current negative contribution. The proposal may conservatively retain genuinely current collection uncertainty; it cannot retain obsolete rejected support forever after a complete authorized replacement merely because provenance needed to subtract it was discarded. Conversely a new same-key lifetime cannot erase old held-lifetime evidence. This requires a concrete addressed-current/domain transfer rule; neither a permanent retired-key table nor blanket summary reset follows.
- **Weak-held certificate:** the token is an implementation mechanism for an already-issued lifetime domain, not a new lookup surface. Keep the held-field updater's actual before-callback behavior and refusal ordering; substituting the whole collection summary would create false dependencies from unrelated retired lifetimes.
- **Selected inverse:** the proposed phase separation is an obligation description. It does not supply or qualify the complete prepared planner, callback/error ordering or occupied-key/anchor validation. This review leaves that gate open.

## Narrow next step

Revise the terminal-W certificate protocol to preserve closed-window provenance, clarify source provenance versus recipient baseline permission, and specify current-negative supersession after transfer. Develop the terminal-role summary as a separate bounded private lifecycle proposal with the distinctions above. No public semantic concession is established; no complete runtime clearance or selected-inverse approval follows from this review.
