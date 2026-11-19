# Concrete C15 implementation boundary for mechanism review

This supplements MECHANISM.md and narrows its “frame and corresponding point path” wording: **the proposed implementation changes the frame publication offer construction, not the already-explicit point-write admission path.** No runtime edit is present in this directory.

## Writer classification comes from the prepared mutation

| Prepared writer | C15 evidence | Equal-field offer under this proposal |
| --- | --- | --- |
| setAll existing-row replacement | `entity-signal.ts:5065`, `authoredFields:null` | Whole supplied own fields, through native selection |
| replaceOne / direct row replacement | `:2456–2463`, null unless mutationIntent is derive | Same whole rule |
| Existing-row replace-mode bulk add/prepend | `:3120–3126`, null | Same existing explicit-whole classification; do not add API-specific exclusions |
| Row updater | `:2462`, `'derive'` | No new whole offer; preserve captured native inputs and existing changed-field domain |
| updateOne point partial | `:2386–2391`, explicit transformed keys passed to commitExistingSubjectValue | Existing explicit point offer unchanged |
| updateMany/upsert-style partial replacement | `:4294,4664`, transformed key list | Existing partial behavior unchanged; this task does not broaden frame partial equal-field policy |
| Selected inverse / restoration / realization | `:570,2104`, `'realization'`; selected field endpoint at `:2445–2450` | Preserve certified scope and restored endpoint. A real interceptor replacement retains its existing explicit whole classification, but cannot override certified selected endpoints |
| Inspection | prepareEntityPublication `:2543` removes ordinary edits/steps | No ordinary offer |
| New subject / remove / rekey / order | Different mutation kind, no ordinary whole replace footprint | Existing structural/lifetime rules only |

The classification is taken after the existing synchronous interceptor/transform and inverse classification. Do not reevaluate user accessors, re-call interceptors, infer scope from row shape, or inspect Link declarations to classify the writer. A whole-shaped updater is still derived. An ordinary root updater can supply an explicit row replacement while its captured branch inputs still constrain the resulting native requirement; whole scope never drops those inputs.

## Exact proposed source seam

In `prepareEntityMutationFrame`'s publication packet construction at `entity-signal.ts:1587–1605`, use `authoredByStep` populated at `:1448` and the prepared `physicalValuesByStep` / ordinary `byStep` values:

1. Construct each step's ordinary `EntityPublicationEdit` once. Compute the existing ordinary value/presence diff as today.
2. If the matching prepared mutation is an ordinary nonstructural whole replacement, extend that publication offer with own enumerable supplied keys from the **already materialized row for that step and lifetime**. Only offer a supplied field where the ordinary endpoint is the admitted value/presence for that replacement. Do not read current mutable row state or a later same-subject step.
3. Retain existing diff keys for actual deletion; do not enumerate historical certificate maps to invent offers for already absent, unsupplied keys. Preserve id/key and inherited-key policies.
4. Use the same prepared ordinary edit objects/domains for `packet.ordinary` and `packet.steps[].ordinary`. Preserve source chronology and any ordinary changes not attributable to a whole step. Flatten the prepared step records only where it is exactly the existing ordered ordinary sequence; do not replace `ordinaryPlan.changes` itself or assume a subject-only join is adequate.
5. Preserve `restoredFields`, subject id, structural metadata and the pairing to that step's physical edit. The physical publication diff at `:1588` stays a value/presence diff; ordinary offered keys are not physical notifications.

This can be one private `publicationOffers` helper plus a local per-step preparation in entity-signal.ts. It is not necessary to add fields to public types or an alternate authority table. Existing `EntityPublicationEdit.fields` already represents explicit equal offers on the point path (`:2580–2582`); applying that meaning to an explicit whole frame does not create a new ownership primitive.

**Do not modify `commitExistingSubjectValue` merely for symmetry.** Its explicit partial keys already enter native selection. If a test exposes a distinct point-path defect, preserve it and review separately rather than folding it into this proposal.

## Selection and installation — unchanged authorities

`experimental-publication/entity.ts` prepares the operation's native requirement before recipients. Its `NativeFieldSelections` at `:115–133` supplies before/proposed endpoints to the existing transaction responsibility hook. Installation uses this precedence:

```
edit.restoredFields[key]
  ?? native selectedFields[subject][key]
  ?? proposed endpoint for this operation
```

- Equal unowned supplied field: no new native value effect is fabricated. Existing admission leaves the proposal available; installing that endpoint replaces old foreign-window publication evidence with the new native requirement.
- Equal field with a live pending destination claim: `transactions.ts:2472–2483` chooses the exact prior endpoint when it finds no value effect but a prior owner. Preserve its requirement AND owner identity, value and own-property presence. Do not construct a lookalike unowned endpoint or use `owner.outcome` to override this choice.
- Actual value/presence effect: existing admission binds the before/after pair and destination ownership; this task adds no equal effect to the transaction bucket.
- Inverse/net-zero: `:2626–2631` selects pair.before on a normalized no-op. `restoredFields` wins at installation. Do not widen the undo/rollback effect or erase its selected endpoint.
- The hook may legitimately return early (`:2379–2397`) for restoration/inspection or no active authority. Do not replace its full decision with a new blanket `before.owner !== undefined` check. Existing native admission decides whether a prior endpoint survives; a numeric historical owner marker is not a new independent policy.

The existing entity field loop and egress loop consume the offered keys and the **selected** evidence. A key being offered does not imply it gets the proposal. Preserve native horizon finalization, activation and source/recipient revision checks. All endpoint records install with the existing source terminal record (`entity-signal.ts:1645–1655`); no publish-then-repair sequence.

## Notifications, presence and lifetime

No extra value revision or notification is introduced for certificate-only acceptance. Keep native transition/equality results, physicallyChangedSubjectIds, scalar notifier scheduling, committed mutation effects and rich capture input unchanged. Existing equal field subscriptions must remain silent on all three Main routes. A publication proof may advance while physical values remain identical; that is the desired distinction.

The egress projection may construct an equal row from an offered domain. It must use the new selected support even if output values compare equal. Link's existing equality with its acknowledged endpoint suppresses duplicate output when nothing was held, while the held foreign-window case now sends its previously undelivered row. No Link edit or explicit dirty override is proposed here; Tesla owns the independent pending value-work boundary.

Use own-property presence, not `value===undefined`, for both offer and endpoint. An explicitly supplied `u:undefined` is present. An actual whole deletion keeps its existing diff/removal endpoint. Already absent and unsupplied historical fields are not newly authored by this rule. No old subject/lifetime can donate evidence to remove/readd at the same key; exact subject ids and existing revision validation remain binding.

Rollback behavior follows selected native endpoints: q-owned x7 still returns to x0 on q rollback; unowned x7 reauthored while foreign q owns only another tree remains7. An equal r transaction must not acquire a new ordinary x effect just for refreshing publication evidence. Inspect actual later values, native owner facts and outgoing payload, not only final receipt states.

## Decisive controls and remaining gaps

Main's unchanged six tests are mandatory: three foreign-window cases must change from fail to pass; three actual-owner cases must remain pass, preserving zero leaf notices and owner inspection, then useful rollback output. Main reports the prewritten fixture's spec-types gate passes; this plan does not claim an independent rerun. The retained-root reexposure failure is also mandatory.

The six cases do not cover: no recipient at authorship; derived/partial/inspection negative classification; own undefined versus absent historical fields; selected inverse/net-zero; duplicate subject steps or reused keys; preinstall reentry/refusal; already acknowledged equal output; multiple recipients' distinct permission basis. DISCRIMINATORS.md freezes those expectations. Source/spec types and joint scalar safety/six-progress controls follow implementation. No new suite, CPU claim or whole-system acceptance is implied.

Review question for Plato: is the publication offer-domain extension at the existing source frame seam sufficient and correctly bounded, while preserving the selected-endpoint precedence and step/lifetime mapping? A concrete mapping failure should block that narrow mechanism; it is not authorization for a new graph, global ownership model, or caller guard.
