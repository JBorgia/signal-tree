# Nested missing-parent realization contract

Read-only at `6c87ddaf88aab3784001e62f5c214596e721159a`. No runtime edits or test execution. The top-level ordered-edit successor remains independently authorized; this report concerns only nested edits whose ordinary parent is absent or nontraversable.

## Result

No existing test or decision found that selects construction versus refusal for an ordinary-missing parent that exists only in physical inspection display. Existing code contains competing behaviors in different realization helpers; those are not interchangeable product authority. Do not import either behavior into this newly separated ordinary target solely because it is convenient.

## Governing evidence and limits

- `packages/kernel/src/lib/audit-structured-realization.spec.ts:12–58` requires exact literal segments (including `['a','b']`) through the realization adapter. Both ordinary and physical source already contain traversable `a:{b:9}`. It does not test absent/nonrecord parents. Lines62–88 specify empty segments as whole-row replacement. Lines91–122 test literal dotted keys in declarative target, also with present source structure.
- Test history: introduction `dd2218eb0` (“wip: protective snapshot of the in-flight repair tree”) supplies no separate missing-parent disposition in the tested assertions.
- `lib/internals/causal-runtime/tree-realization-adapter.ts:1973–2000` `assignPreparedSubjectValue` returns silently if a traversed parent is absent/nontraversable. The function neither constructs parents nor reports a refused realization. Reusing it could silently omit an edit in the ordinary view. Existing successful traversable-path tests cannot authorize that omission.
- `lib/internals/causal-runtime/target-transition.ts:1032–1045` `setValueAtPath` instead replaces a nonrecord source with `{}` and recursively constructs missing path parents. This demonstrates that source helpers do not express one uniform missing-parent policy. It is used for complete target derivation, not an owner decision about minimal point realization over split inspection/ordinary topology.
- Deletion differs: `tree-realization-adapter.ts:2336–2348` leaves absent/nontraversable parent unchanged when removing a descendant. There is no need to invent a parent simply to preserve absence. Present-undefined versus absence at the actual terminal still requires exact fieldPresence handling.
- `lib/nested-absence-independent.spec.ts` concerns ordinary SignalTree branch handles and ancestor omission, not nested data inside an entity row and not dual ordinary/physical inspection targets. Its comments explicitly describe initial measured expectations, so it is not a blanket license to construct entity parent objects.
- `lib/entity-own-property-audit.spec.ts:70` permits a top-level missing entity field write to produce an own field. That is a leaf existence rule, not a promise to reconstruct an absent nested parent during inverse realization.
- Authorized ordinary-topology restoration within the authored footprint establishes which existing ordinary facts a correction may restore. It does not, by itself, establish whether a nested field effect includes ancestor construction, ancestor kind replacement, or an atomic refusal where such a fact was never captured.

## Exact discriminating input

Use an existing entity lifetime, unchanged key/order. Ordinary row `{id:'a'}` has no `box`; physical inspection displays `{id:'a',box:{value:99,other:88}}`. A prepared realized edit has segments `['box','value']`, target own-present value7. Its physical target is `{id:'a',box:{value:7,other:88}}`.

Possible ordinary outcomes are materially different:

1. Construct minimal ordinary `{id:'a',box:{value:7}}`, adopting necessary parent structure but not `other`.
2. Refuse preparation atomically because the effect does not carry authority to create `box`; no scalar/member/row installation occurs.
3. Leave ordinary `box` absent — only valid if a governing rule defines this edit as ordinary-no-op, not as accidental silent traversal failure.

No existing evidence above selects among them. The input is an internal mechanism discriminator, not yet a proven ordinary public transaction sequence. Before escalating product scope, identify whether supported public operation capture can produce this exact nested effect rather than a whole `box` replacement that already carries the parent. A value-only synthetic effect must not force a product decision for an unreachable public case.

Also distinguish ordinary `box:null`, present `box:undefined`, and primitive `box:3`; recursive `{}` construction would replace an existing ordinary kind, a stronger action than adding a missing property. Literal key `['box.value']` is a one-segment leaf and does not have this ambiguity.

## Bounded action disposition

Continue top-level field/whole-row and nested traversable-parent controls. Preserve this case as a specification hold if public capture proves it reachable. If no governing rule is found for a supported occurrence, present one owner decision between explicitly scoped minimal ancestor construction and atomic preparation refusal, with exact physical/ordinary targets and capability consequence. Do not choose a runtime behavior or claim success for a silently omitted edit. No new API or broader structural migration follows from this report.

## Bounded producer/reachability follow-up

Source constructors distinguish transaction and restoration paths:

- `enhancers/transactions/transactions.ts:1903–1926` decomposes entity row diff one level only and creates `subjectFieldSegments:[key]`. Its prepared entity responsibility construction2151 and queued-effect reconstruction3604 also create `[key]`; structural whole-row evidence2021 uses `[]`. Other occurrences copy an existing effect unchanged. No supported transaction capture constructor producing length>1 was found in this bounded audit.
- `enhancers/restoration/restoration.ts:4177–4208` **does** recursively decompose record-to-record differences, appending segments. A public `undoable(()=>rows.updateOne('a',{box:{value:2}}))` with existing ordinary box object can create `['box','value']` without any deep entity handle. Thus nested entity reversal is not globally internal-only. When the ordinary prior box is absent/nonrecord, recursion stops at that parent and records `['box']`, not its child.
- `lib/types.ts:770–783` declares deep EntityNodeOf access, but native field facade implementation delegates top-level property through updateOne; this audit does not rely on a disputed deep-handle runtime promise to establish restoration reachability.
- The **only non-test direct caller** of `preparePointRealization` is transactions.ts3067. It receives normalized pending rollback effects from that transaction authority; reversal/pending planners copy segment arrays rather than deepen them. Restoration invokes its own declarative target or realizationPort pathways (restoration.ts3074–3120,3315), not this point optimization. This supports a narrow finding: nested length>1 is not shown reachable from current supported transaction producer into the point optimization, despite being supported elsewhere.

Point admissibility is explicitly partial: `tree-realization-adapter.ts:648–656` says undefined means the existing structural/member planner is required. transactions.ts3072–3094 handles undefined by target fallback when frontier/membership requires it, otherwise `realizationPort.applyAtomically`. Existing code already declines unsupported shapes during preparation. This is a capability decline, not a new public refusal contract.

However, this does **not** prove that declining the newly separated ordinary-parent case to an old fallback preserves the approved ordinary-authority contract. The fallback's behavior and atomicity must be verified for that exact input; a safe-looking decline cannot authorize a wider full-row adoption or silently omitted nested write. Do not call fallback safe by analogy.

Conclusion for implementation scope: top-level/whole-row transaction point effects cover all observed current public producers. Nested present-parent internal controls can characterize representation generality separately. No owner decision is presently justified solely by an unproven synthetic missing-parent input to that optimization. If implementation wants to claim nested optimization support, its missing-parent admission behavior still needs a governing rule or proven contract-preserving fallback. Restoration's genuine nested public path remains a separate retained obligation; do not erase or narrow its supported behavior.
