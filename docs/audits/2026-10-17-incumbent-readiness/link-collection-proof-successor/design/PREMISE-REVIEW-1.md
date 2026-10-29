# Premise and semantics review of DESIGN-DRAFT-1

2026-10-29. Read-only review. Runtime source inspected directly at `/private/tmp/link-authored-removal-successor`, frozen `75416029be1e0c1d9735ed3bdc0f4e8e6c02f775`; reviewed `DESIGN-DRAFT-1.md`, source map as claims, A0, aggregate authority, unavailable-input owner decision, C1–C14 and preserved raw failures. No other new reviewer verdict read, no tests run, no runtime/controller edits.

## Disposition

The shared exact-contributor direction is compatible with the existing physical/ordinary split and relationship-relative projection. It repairs the right abstraction boundary: source support is not necessarily the contributor domain of one recipient's payload. **Draft 1 is not a complete semantic handoff yet.** Initialization, adoption, negative-support lifecycle and key/order roles still need explicit transition rules. Most missing rules can be derived or mapped under existing authority; they are not grounds to request blanket new policy or weaken C1–C14.

The original failures remain meaningful: final-focused.log records C1's send after destination confirmation while the foreign possible owner remains pending, and C3's unsupported-source rejection before callback. Neither the representation proposal nor test count establishes their repair. C4–C14 include required extensions, not fourteen executed passing gates.

## Governing limits

Aggregate authority at `3c8bbaff`:

> Completeness covers all inputs to newly authored facts. Untouched contributing facts retain their own support: a declaration can be valid while the resulting projection and its receipt remain held.

A0's baseline rule at that revision includes:

> If creation occurs when the existing conservative gate permits that coherent relationship baseline and no known foreign support prevents it, its already-established facts receive baseline-safe support.

> If creation occurs while relevant pending work prevents establishing the baseline and trustworthy pre-creation support is unavailable, baseline evidence is unknown.

A0 also states:

> Preparation reads are not automatically authored facts or dependencies.

The unavailable-input owner decision applies to a complete independent declaration consuming inspection-displayed input with unavailable native evidence: capture pending owners at authorship, preserve the resulting fixed window, and evaluate fresh surviving truth after discharge. It expressly does not authorize recapturing every historical uncertain input.

## 1. Initialization needs a source-view/recipient-baseline decision table

Frozen `link.ts:360–382` adopts the creation read; `416–444` does the same for each nested collection. The seed carries lifetime, storage key, row and order, not publication proof (`internals/entity-projection-seed.ts`). `private.ts:263–295` currently invents a clean baseline and incompletely imports native facts; that implementation cannot decide the replacement rule.

Draft 1 correctly rejects source-O reseeding and confirmed-owner fabrication. It omits the affirmative A0 baseline-safe case. “Inspection-only seed facts remain distinguishable” is necessary but does not specify their recipient permission. Use at least these four cases:

| Seed situation | Required distinction |
| --- | --- |
| Inspection precedes creation, coherent conservative baseline available, no preventing foreign support | Preserve adopted row/order and recipient baseline-safe support; do not certify the physical native input as independent or send initially. Later unrelated owner cannot retroactively contaminate that baseline. |
| Exact seeded native fact has known pending support | Retain that support; creation cannot erase it. C5's pending lifetime must hold later unrelated authored changes. |
| Relevant pending work blocks baseline establishment and matching native proof is unavailable | Recipient baseline evidence remains unknown; specify its existing fallback/refresh path. This uncertainty must not enter another recipient or the native source. |
| Physical seeded value differs from ordinary fact carrying known support | Match evidence to the exact seeded view. Neither attach O7's proof as certification of P99 nor discard known structural prerequisites. State which exact view facts are unavailable and which prerequisites still apply. |

Also identify relevant negative-domain facts when the seed omits a member with a live obligation: positive row enumeration is not the complete native absence domain. The seed algorithm cannot infer clean absence solely from no row.

**Classification:** incomplete mapping under already-selected rules. A policy decision would arise only if the design wants to change the approved baseline-safe/unknown/fallback boundary. “All unknown seeds wait forever” or “all inspection seeds are clean native evidence” would be incompatible shortcuts, not engineering choices.

## 2. Partial adoption must distinguish selection, authorship and actual input consumption

`entity-egress-projection.ts:263–280` adopts a complete row when a physically present lifetime is not eligible, even when the ordinary field edit is partial. Existing eligible rows instead patch only named fields (`:257–262`). `reconcileAddress:148–156` may remove an old latent eligible lifetime while inserting the incoming lifetime. Both transitions need contributor edits from the actual reducer branch.

Draft 1 properly refuses to give every newly selected field the declaration proof for one authored field. It must now say where each selected field obtains evidence: exact retained recipient baseline, exact source O fact, matching P input certificate, or unavailable evidence. The same spelling/value is not enough to match revisions. A historical eligible field preserved after inspection must keep its historical proof; source latest proof cannot silently replace it.

Do not confuse the following: retaining a contributing fact transports its D/I/W/V roles; an actual native updater consuming it promotes actual source ownership to input support. Selecting a payload contributor is not automatically a callback input. If the existing adoption operation necessarily reuses retained source values, identify that producer boundary and capture its inputs before user code. “The reducer looked at it” alone does not establish declaration contradiction.

Concrete control: inspection creates `{id:x,a:9,b:99}` after an early connection; a complete declaration ordinarily changes only a. Confirm the selected payload, the authored a proof, b's unavailable/native evidence, lifetime/placement prerequisites, receipt result and fixed-window acquisition separately. Compare a connection created after that inspection, which already adopted b into its baseline. Their payloads can agree while baseline evidence and acquisition histories differ.

**Classification:** design-blocking evidence mapping. No new policy is necessary merely to retain known support/unknown. A proposal to label untouched reused values independent, or conversely make every incidental selection an actual input contradiction, would change semantics and needs an explicit premise review.

## 3. Drained W is not clean initial evidence

I verified the source-map claim directly. `lifecycle.ts:68–87` keeps the source requirement and its uncertainty/window while filtering already-confirmed actual owners only from a new consumed-owner list. `initialRequirement():90` has unknown false; `private.ts:300–306` distinguishes early permission from pending obligations. A terminal W can allow fresh surviving delivery without becoming declared-independent source evidence.

Draft 1 correctly refuses zero-count laundering but should close its conditional wording: **no blanket reset to initialRequirement after W drains is justified.** Example: removal captures W(q); q settles; unrelated r opens; a later complete native consumer reads the absence. Preserving old uncertainty permits surviving-basis evaluation without extending W to r. Resetting clean changes proof/receipt basis; recapturing r changes the fixed-window rule.

Compaction can remain an engineering design: transfer current uncertainty into an equivalent bounded source/domain certificate, release obsolete lifetime identity, and let old captured inputs retain immutable versions. Specify the retrieval key/domain after physical forgetting, reference roots, replacement/retirement trigger and equivalence observation. Source input absence, recipient exclusion, queued delivery and inverse recovery are distinct roots. No immortal per-lifetime record follows from preserving uncertainty.

**Classification:** existing semantic constraint plus unresolved representation/lifetime mechanism. A clean-after-drain policy would require owner authority; the current draft need not choose it.

## 4. Negative recipient proof updates cannot be limited to visible removal

The remove bullet says install negative contributor “when that removal changes the recipient's membership.” That is sufficient for C1 but not a complete support-only rule. Earlier design explicitly permits private proof bookkeeping when addressed current facts change without a payload change; Draft 1 itself requires support-only completion.

Differentiate (a) recipient never included the lifetime and has no contributing exclusion fact, (b) recipient already carries an exclusion proof being superseded by this operation, and (c) source negative fact needed only by native inputs/history. Case (a) must not acquire a send merely because another recipient changed; case (b) cannot be ignored solely because membership stayed absent; case (c) remains source-owned even without a recipient. Give a precise supersession rule, including same-key fresh lifetime and selected restoration. The payload reducer's boolean changed is insufficient to determine these dispositions.

**Classification:** engineering/contract mapping omission, not evidence for changing consumer removal semantics.

## 5. Key and order dependencies need semantic necessity, not a trace of every lookup

Rekey changes `keyOf` but not Row[] fields/order (`entity-egress-projection.ts:248–255`). Native `entity.ts:63,77` skips rekey evidence entirely. Draft 1 is right to require mapping evidence for address-sensitive operations without turning payload id into storage-key authority. A key-only publication should not automatically block unrelated Row[] fields merely because an implementation reads the key map.

`place:122–138` and `source-mutation.ts:172–188` may traverse multiple ineligible physical neighbors to choose an eligible placement. Those consulted nodes are not all newly owned order facts or actual native callback inputs. Identify the necessary existence/occupancy/selected-placement prerequisite versus an incidental search witness. Otherwise a new proof trace would turn an implementation detail into extra public holds or false independent-declaration contradictions, contrary to A0.

`reorder:203–219` preserves eligible lifetimes excluded from the source order domain. Retain their slot/order evidence. Conversely “actual placement changes” must not mean “only indices that moved”: an explicitly authored same-order operation can have a meaningful support change under the existing support-only contract. Use the authored order domain and effective support, not payload equality alone.

**Classification:** finite evidence-role map and discriminators are missing. No automatic new policy is needed. A stronger rule making every traversed neighbor a dependency, or certifying all order from the latest operation, would be a semantic change.

## 6. Enforcement must distinguish unfinished proof from governed unknown

“A missing proof or unfinished unit is held” is safe for an uninstalled/incomplete revision, but unknown is an existing supported fallback state. Once a current coherent revision has the approved unknown/fixed-window evidence, it must use its actual conservative/surviving path and wake without another setter. Do not convert missing producer coverage into a permanent substitute for C1–C14's useful progress. Do not turn a surviving recipient grant into native source certification on reseed or later consumption.

The draft's physical/ordinary, selected-inverse and ingress separations otherwise preserve the right authorities. Complete selected-unit preparation and retirement remain real dependencies, not supplied by the new contributor index. No clearance for those paths follows from this premise review.

## Finite revision requested

Add explicit transition tables for initialization, partial adoption/input roles, negative proof replacement/compaction and key/order necessity; name the source identity/revision/step that supplies every selected contributor. State fallback and disposal outcomes for unknown baseline evidence. Carry proof-only changes through the same prepared revision even when payload reduction says unchanged. Preserve all existing C1–C14 outcomes and first failures.

These are bounded completion requirements for Draft 1, not a request for broader product redesign. Once supplied, review the new concrete mappings and any genuine residual semantic choice. Test counts cannot substitute for those rules, and this review does not lift recurrence or authorize runtime implementation.
