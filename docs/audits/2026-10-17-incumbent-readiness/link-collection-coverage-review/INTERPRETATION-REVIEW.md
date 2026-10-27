# Independent collection-path interpretation review

2026-10-27. Read-only. Source: clean `75416029be1e0c1d9735ed3bdc0f4e8e6c02f775` in `/private/tmp/link-authored-removal-successor`. Approved records inspected directly at `3c8bbaff`: `link-a1-successor-design/AUTHORITY.md`, `link-a0-operation-contract/A0.md`, and `link-authored-removal-design/DESIGN.md` / `CASES.md`, all under `docs/audits/2026-10-17-incumbent-readiness/`. Read raw final-focused, final-gates, final-semantic, final-original-entity and final-scalar logs. No new premise-review verdict read. No runtime/test edits or new executions. Root owns the final design and coverage adjudication.

## Disposition and authority

The two immediate corrections—collection evidence-gate participation and composition of the collection's own native facts—are independently necessary. Their conjunction is not a sufficient qualification boundary. It would leave already-required native fact, selected-installation, retained-evidence, inspected-input and completion gates unresolved.

The isolated experiment's source coverage is already authorized. AUTHORITY.md at `3c8bbaff` says:

> The isolated experimental connection.declare surface may cover branch/root and entity collection sources.

It also says:

> Completeness covers all inputs to newly authored facts. Untouched contributing facts retain their own support: a declaration can be valid while the resulting projection and its receipt remain held.

The record expressly withholds production API acceptance, default activation, release and B reopening. Therefore the present `unsupported-source` error is absent authorized experimental coverage, not evidence that the owner has yet to choose whether collections belong. Correcting that experimental gap does not grant production/public-export authority.

Removal DESIGN already names collection/root/nested consumers of the same semantic stream and requires outgoing D/I/W/V support. CASES R10–R12 already require destination ownership, foreign obligations and useful qualified progress. A0 says:

> No fallback to the old experimental evaluator on unsupported source paths; unknown is an explicit supported outcome, not a hidden second engine.

And:

> A1 failures preserve first reds; recurrence in a claimed-covered path triggers the existing stop.

Consequently the destination-first failure belongs inside the declared design coverage. It cannot be reclassified as a new collection opt-in question or cured by silently narrowing that coverage. Under the user's recurrence instruction, preserve the stop while completing this coverage/mechanism adjudication; another runtime patch is not the next automatic step. Broader integration was never accepted, so this is a covered-contract failure, not proof that an accepted production guarantee regressed.

## What the evidence actually establishes

`final-focused.log` executed the command printed at its start against the preserved successor: the three authored-removal files plus unchanged ordinary-order-source-boundaries. It reports 24 passed / 2 failed of 26. All five original source-boundary assertions and eight independent preparation/completion controls pass. The failures are:

1. Destination-first: after p.confirm while q remains pending, the collection already sends `[A]`; line 25 expected no send. The later useful-discharge assertions in that case are unexecuted.
2. Qualified independent collection removal: declaration fails at `lifecycle.ts:239` with `unsupported-source` before its callback. No removal or useful declared-delivery behavior is exercised by that failed control.

This raw observation does not isolate every contributing defect, prove p was an empty terminal transaction, or prove native W(q) was absent. The two source findings below explain why neither a one-line source flag nor a one-line proof addition establishes the contract.

## Two independent gaps in the collection path

**Gate participation:** `link.ts:552–555` excludes collection, aggregate-with-collection and held-row sources from the supported experimental identity. `experimental-publication/private.ts:309–314` consequently bypasses fact permission in `allowed` and delegates `admit` to the original durable gate. Even a perfectly composed native W(q) cannot constrain that bypass. The original destination gate releasing on p explains the observed send without treating confirmation as discharge of q. Declaration admission also consults the same unsupported coverage at `lifecycle.ts:239`, but declaring a callback valid is distinct from authorizing its completed payload.

**Own collection proof composition:** `link.ts:567` creates an aggregate binding for a non-writable collection. The collection's own recipient supplies no field to `prepareSourceProjection` at 596; field registration at 573 is for a nested collection. `private.ts:201` therefore stores the completed revision in `completedValueFact`. The aggregate arm of `projectionSupport` at 151 combines indexed field summary, baseline structure and parent presence, but omits `completedValueFact`; `ready` at 202–203 replaces the revision proof with that aggregate result. Native contribution can disappear before delivery. Enabling the gate alone can thus enforce an incomplete proof. Conversely, adding the missing contribution while keeping the unsupported bypass does not enforce it. This is source-derived; the current runtime failure does not experimentally separate these two faults.

A correction must describe which native facts contribute to each relationship revision and use the shared completion/gate protocol. Treating the entire collection as a convenient scalar field would not itself prove native membership, lifetime, mapping and order participation. Nor may it replace the connection-relative payload with source O or final P.

## Required fact participation

| Fact/domain | Required interpretation | Current evidence and remaining gate |
| --- | --- | --- |
| Authored field/value | Replace only supplied field support; untouched contributing rows/fields retain their own D/I/W/V. Native updater inputs are lower bounds. | `entity.ts:79–94` maintains per-field requirements; `support` at 102–114 combines rows. After collection composition is corrected, independently declared y must not erase x's proof. A valid declaration may still have a held receipt. A0 aggregate discriminator 5 applies. |
| Parent member presence and absence | Payload exposure depends on its actual ancestor/member facts. Removing an entity is not omitting its whole parent branch. Hidden values can cease contributing without losing retained/recovery evidence. | `private.ts:151` includes parent presence; source-membership paths remain distinct. Require ordinary-presence/nested-absence controls and branch omission/re-add without latent sibling adoption. R9 forbids blanket deletion. |
| Entity lifetime and negative membership | Address collection identity plus lifetime; an accepted removal remains authored absence even when source O was absent. Same-key replacement cannot reuse the old identity or receipt. | Ordered supplemental removals and original early/late payload cases now pass. `entity.ts:71–75,80–82,107–108` participates in current membership proof. This does not qualify historical input preservation or retirement. R5–R7/R18–R20 remain individually scoped. |
| Key/occupancy | Membership, storage key and row `id` are not interchangeable. Rekey replaces only authored mapping support and retains unrelated value/lifetime/order proof. | Native support currently skips rekey in both P and semantic loops (`entity.ts:63,77`). A complete collection claim must identify mapping's actual proof owner/transport rather than infer it from the Row[] payload. This is a source coverage gap, not a newly executed rekey failure. A0's explicit rekey rule remains binding. |
| Placement/order | Only exact authored order domain changes proof. Omitted eligible lifetimes retain slots/support; inverse anchors are preparation evidence, not owned order. | `entity.ts:97,105` includes placements, but publication receives ordinary order after-image without the separately computed ordinary domain (`entity-signal.ts:1084–1088,1323`). Domain preservation must be traced and falsified before claiming order support correct. Payload order tests alone do not prove the permission domain. No new order failure was executed here. |
| Relationship baseline | Creation adopts the coherent current read without initial send or independence. Later work covers newly authored facts, not all baseline structure. Relevant unavailable/foreign baseline evidence remains conservative. | Existing early/late tests validate payload behavior. They do not establish mixed pending-baseline proof after collection gate activation. A0 creation/pending controls and enrollment invariance remain required. |

These are existing A0 obligations, not a request for another canonical store or a new ownership engine. A supported removal-only observation cannot certify every producer merely because all serialize to Row[].

## Existing gates that the pair of fixes cannot close

- **Selected inverse and admission.** The marker `publication:'physical'` suppresses the new supplemental removal only. Structural plans still prepare/install from inside selected installation before later selected parts finish (`tree-realization-adapter.ts:1449–1462`; `entity-signal.ts:1326–1328,1358–1372`). Raw `final-gates.log` shows the selected rich-capture control seeing right values 50/60 instead of restored 11/12. The later preservation-of-reentrant-777 assertion is unexecuted. A0 requires whole selected-domain preparation before installation, exact selected O authority, and no inverse/support commit on refusal. Gate/aggregate arithmetic cannot make that interval atomic.
- **Retirement and historical support.** Explicit forgetting at `entity-signal.ts:3283` unconditionally calls `entity.ts:119`; automatic bare forgetting at 3363–3397 omits that hook. The raw two negative-retirement failures occur at final negativePresence zero-count checks, after useful dependent delivery succeeded; they establish retained metadata, not observed premature release in those fixtures. Bare-churn separately fails presence reclamation. The explicit deletion safety problem is source-derived. Both routes need one obligation-aware rule protecting current/captured/in-flight/recovery proof and releasing obsolete records. R18 success without recipients cannot waive R19/R20. No general heap/GC theorem is required.
- **Unavailable inspected input.** Raw field/row/root input-view controls send 99 before p confirmation, failing their no-send assertion. `entity.ts` distinguishes physical views from ordinary support, but its unavailable proof carries no inherited owner window. The approved fixed possible-owner window must be acquired at the correct authorship/consumption boundary; a later independent declaration must not erase it, and later unrelated owners must not extend it. Reusing ordinary proof for inspected P or globally recapturing all pending owners is outside the contract. Collection composition/gating does not repair the native input evidence.
- **Completion, validation and receipts.** Eight independent controls establish their specific refusal/retry, enrollment/disposal, same-key reentry and undefined-field behavior. They do not establish complete collection proof-only wakeups, mixed units, validation getters/nested declarations, stale aggregate completion, or queued versus already-started sends after changing aggregate proof reduction. A0 requires private completion without public value events or a preexisting held send, one coherent immutable revision per started attempt, and terminal receipts that never revive. R14–R17 and the unchanged scalar validation/queue controls remain required.
- **Inherited semantic controls.** Raw final-semantic reports four failures: equal row/no-op admission and three structural preparation/reentry verdicts. Those retain their original assertions and status. Raw final-scalar's two historical assertion conflicts must retain their separately adjudicated status; they are not permission to edit an oracle for a green total. Full collection qualification cannot silently count either set as passed or as unrelated without a row-specific disposition.

## Finite correction and review boundary

Before any runtime successor, record a single collection-path contract with these seven closure rows, each mapped to existing producers, source facts, recipient projection and completion: (1) authorized experimental coverage and gate enforcement; (2) complete fact composition and baseline support; (3) immutable D/I/W/V/input rules; (4) complete preparation/selected inverse boundary; (5) obligation-aware evidence retention on both retirement routes; (6) private completion/validation/serialized delivery; (7) exact original-control and work-accounting disposition.

Review each row against the existing A0 source/consumer map and removal R1–R21; use the original mandatory vectors listed in CASES.md without changing assertions. Add a discriminator only for a concrete untested distinction, such as proof-domain rekey/subset order or a collection's own-versus-nested proof composition. Do not invent a Cartesian matrix or require unrelated product decisions to proceed. Preserve original first failures and clearly mark which later assertions never ran.

A future authorized implementation can close rows in bounded checkpoints, but cannot call the pair of immediate corrections “complete collection qualification.” Useful progress, held-state discrimination and retry/corrective delivery must accompany safety assertions; silence or refusal alone is not a pass. Source proof should exist without recipients, and enrollment cannot change another recipient's obligations. Test identities, source hashes, exact commands and current outcomes are required for each accepted row; broader package/framework/type and production-cost gates follow the existing controller rather than replacing these semantic gates.

Stop again if satisfying any row requires a second value authority, settlement selector, new order policy, unlisted writer family or new public export/semantics. Those are the existing A0 reopening boundaries. No caller-specific collection workaround, blanket source snapshot, synthetic ordinary capture or standalone enablement patch follows from this review.

Narrow conclusion: source coverage/completeness is already decided; present covered recurrence remains stopped. The two immediate defects are understood, but collection completeness requires the finite existing closure rows above. This review supplies interpretation and gates, not permission or runtime qualification.
