# C23 equal-owner native preparation design

Status: source-supported proposal for independent premise review, NOT implementation acceptance. No runtime patch, tests, new execution, export change or policy expansion. Source: `/private/tmp/st-native-combined-c23/candidate`; SNAPSHOT-C23.json SHA-256 `bc8926949819af2cab3b716b71a04b6f3f97a6be5117b954bbfa236b66dec90b` (manifest identity re-read for this report; not a fresh full-tree verification).

## Governing boundary and preserved failure

EQUAL-WHOLE-AUTHORITY.md, selected contract: “Actual pending destination ownership is preserved; declaration permission never erases a transaction's claim.” Approval refreshes explicitly supplied UNOWNED evidence; it does not authorize reauthoring an owned equal destination. Inspection adoption remains separately governed.

Original evidence remains isolated in `/private/tmp/st-c23-row-react-declaration-qualification/CLASSIFICATION.md`, tests.patch and runs/{kernel,react}. React actual-owner confirm/rollback and held-dispose fail at the same early-send prefix, before their terminal operations. A pending p writes pair.x=7; independent equal pair({x:7,y:0}) sends prematurely. User reports independent confirmation; this design performs no replay. Kernel row rollback's old-receipt `started` oracle is separately too strong: rejection may supersede the ticket while a new surviving-basis evaluation sends restored output. Neither classification is changed here.

## Causal seam, not a recipient guard

C23 scalar native preparation (`lib/experimental-publication/private.ts:133–158`) derives destination authorship from the active write context. During an equal validating write it creates a new requirement and replaces nativeValues / the existing view's requirement. The unchanged route creates no compensating transaction effect (`src/enhancers/transactions/transactions.ts:4206–4305`). Active transaction q therefore is not sufficient evidence that q acquired this destination, and lack of active transaction is not evidence that the destination is unowned.

EntityMap supplies the needed separation: transactions.ts:2472–2483 chooses the before endpoint when there is no effect and before.owner !== undefined; an actual effect chooses an owner-bound proposed endpoint. publication/entity.ts:99–128 then consumes that selected endpoint, retaining its COMPLETE requirement, not just its destination list. This guard includes terminal owner-bearing endpoints; it is not permission to silently relax them to “pending only.”

Scalar needs an analogous private admission selection attached to its existing source preparation. `nativeProof(before).destination` is evidence carried by an endpoint, NOT an ownership query. It can contain historical debt and cannot distinguish a still-selected endpoint from a superseded one. Scanning all pending owners, matching values, or reading current transaction ID cannot supply the missing fact.

## Proposed prepared fact and authority

Use one immutable per-attempt fact, produced by the shared scalar admission path and consumed by native publication preparation:

- source/position and the exact selected ordinary predecessor endpoint;
- physical view identity AND its requirement identity, ordinary before/after, physical equality separately from ordinary equality, participation and intent;
- selection: retain-before, admit-proposal, or restore-selected endpoint; the selected endpoint carries its complete requirement and admission-owned owner binding;
- actual captured inputs for this invocation, including branch inputs and inherited q obligations, kept separate from destination selection;
- validation of predecessor/admission identity before installation.

This is a proposed INTERNAL seam, not an existing C23 API. Transaction admission must supply the owner binding at the same point that it admits the actual scalar effect. Store that binding with the existing source-owned ordinary publication endpoint (evolve nativeValues' record), rather than creating another owner map or reconstructing ownership from a proof. The transaction recorder remains authority for claims; native preparation carries its selected result. All writes install through the existing TerminalRecordPlan with the value/effect/evidence. No eager mirror commit.

Changed writes, replacement by a newer admitted owner, rollback/inverse selection, net-zero handling and retirement MUST update/select this endpoint through their existing authoritative admission paths. Thus a later equal write retains the CURRENT selected endpoint, not an older p endpoint merely because p occurs in some retained proof. Confirming an endpoint's owner is not itself proof that the endpoint was superseded; rejection/restoration must select the surviving endpoint. Do not delete owner metadata merely on terminal outcome, and do not resurrect an endpoint from an old transaction bucket.

Missing premise to resolve before implementation: C23 has no demonstrated scalar counterpart of EntityMap's `prepareResponsibility(fieldSelections)` spanning ordinary changes AND restoration. The terminalRecord hook is skipped for unchanged, inspection, restoration and realized writes. Extending only that callback would leave restoration selection unsound. Independent review must identify the exact existing admission/restore selection handoff for the new private port; until then this is a concrete hook requirement, not a claim that nativeProof.destination suffices. If that handoff needs a second ownership authority, reject this design.

## Selection rules and input obligations

| Prepared situation | Required selection / evidence behavior |
| --- | --- |
| Equal ordinary value, current selected endpoint owned by p | Retain the whole selected endpoint. Independent declaration cannot erase p or its inherited I/W evidence. |
| Same author p/current transaction makes equal write | Same no-effect selection; no new claim or replacement endpoint just because p is active. |
| New transaction q attempts equal write over p | Retain p: no admitted scalar effect means no acquisition by q. q may separately be an actual input if consumed. |
| q actually changed/replaced the destination after p | Select q's admitted endpoint; do not union p's superseded destination into it. A stale outer attempt must not reinstall p. |
| Explicit equal replacement of genuinely unowned selected endpoint | May admit fresh evidence under the approved rule; keep current actual inputs, unknown participation and validation. Old possible-only window is not actual ownership. |
| Observation, replay, inverse or inspection | Not fresh equal authorship. Consume the authoritative selected/restored endpoint; preserve existing participation policy. |

An owned endpoint can also carry actual input q or a historical possible window. Retaining only its D list loses these obligations. Conversely, feeding the old endpoint through `captureNativeInput` converts destination p to INPUT p and can falsely invalidate an independent declaration. Neither shortcut is valid.

Fresh callback inputs still matter on the owned no-op attempt: if an updater really consumes q and returns the same value, do not discard that capture just because the destination was retained. Preserve the retained endpoint as a selected contributor, and prepare the invocation's consumed-input / declaration validation evidence separately, with no newly invented destination claim. Existing `prepareNativeRequirement` registers current I/V validation and readiness; existing `combineNativeRequirements` combines contributors without recategorizing retained D as I. Candidate implementation must demonstrate that retaining the endpoint plus this invocation evidence preserves the current declaration's validation horizon and inherited q (including q's uncertainty), without accidentally replacing the endpoint or adding speculative dependency merely because p is pending.

This last composition is a review obligation, not authorization for a new custom validation policy: do not invent an input-free envelope that drops q, suppress existing unavailable-input/window handling, or manufacture q by enumerating pending transactions. Explicit replace with no actual q consumption differs from derive/branch preparation that captured q. Destination debt is a lower bound for output eligibility; actual input debt is a lower bound for declaration validation as well. `lifecycle.ts:152–205` already distinguishes D, I, V and W and must keep doing so.

## Shared routes and callback boundaries

Direct neutral location-runtime and native-tree-scalar-leaf-runtime both enter tree-scalar-slot-runtime.commitRecorded (:308–349), including prepareUnchanged. Branch/frame writes enter prepareSlots (:205–267), which calls prepareScalarSourcePublication for each staged slot, including equal slots. Put the selection fact in the shared scalar/source handoff; do not repair Link, React, or one leaf wrapper alone.

Inspection has separate ordinary and physical evidence. Select ownership from the ORDINARY endpoint/nativeValues, not the inspection view/nativeViews (which may be unavailable). Example: ordinary7, inspection99, ordinary write99 is an ordinary change despite physical equality; preserve the existing adoption path. Equal inspection must not refresh ordinary evidence. A physical return to ordinary7 can be ordinary-equal while physically changed. One `changed` bit without these distinctions is insufficient.

Capture actual derive inputs before the updater as today. Snapshot destination admission at commit preparation after the updater, before callback-capable equality, so a legitimate newer write during the updater is the current predecessor. Validate it after equality and preparation. Frame preparation must snapshot the affected source facts before collectSlotChanges/equality, not only when it later iterates native preparers. Preserve existing callback/read order; no retry.

Current physical revision guards do not detect support-only equal reentry. Validate the selected ordinary endpoint plus physical-view requirement identity (view objects can mutate their requirement in place). `intrinsic-mutation.ts:310–350` currently validates only preparer enrollment and does not forward nativeUnit.validate: that is an exact missing propagation hook. Carry the native fact validator through composition and existing PublicationPreparation sealing/pre-install validation. Direct immediate finalization and deferred frame installation must both reject stale facts using the existing stale-preparation policy; no new public error contract. A later owner q or support-only installation must never be overwritten by a stale outer fact. No global revision, broad graph, recipient-specific guard or automatic callback retry.

## Bounded discriminators for review / later authorized proof

Not executed in this task. Keep the original four failures intact; correct the receipt oracle only as a separately reviewed counterpart.

1. Original React owned equal branch hold, plus neutral direct leaf and frame equivalents: p remains pending, exact output withheld, no equal-value notifications; confirm sends once, rollback sends only surviving output and never revives old receipt.
2. Unowned possible-only equal replacement still progresses; same-p equal and newer-q equal do not acquire a claim. A real q replacement followed by equality does not retain superseded p. Terminal-owner cases must distinguish selected versus superseded endpoints, not assume all terminal bindings are removable.
3. Owned endpoint with inherited q input retains its complete requirement; current updater consumption of q is also validated. Independent contradiction and explicitly declared actual q must remain distinct from unrelated pending q. No guessed dependency.
4. Inspection7→99→ordinary99 adoption and return-to-ordinary7; equality/reentrant support installation before seal; both leaf and multi-slot frame with untouched owned sibling. Preserve read counts/order where semantics require, original callback errors, no retries, value notification suppression, rollback/cleanup and late-enrollment evidence.

Disposition: shared source admission selection is the required repair boundary. Ownership cannot safely be inferred from destination proof. The precise scalar restoration/selection hook and retained-endpoint/current-input composition need independent premise confirmation before any runtime patch. No broader policy, release or correctness acceptance is claimed.
