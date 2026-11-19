# Equal-admission and inverse handoff: unchanged-source findings

**Two existing native publication proof gaps reproduced.** No runtime patch. Source `/private/tmp/st-occurrence-successor` and the private diagnostic copy retain all2918 frozen manifest hashes.

Command: Node24.15.0/pnpm10.17.0, NX_DAEMON=false NX_ISOLATE_PLUGINS=false; `corepack pnpm nx test kernel --skip-nx-cache native-equal-inverse-diagnostic.spec.ts`.

001-nx.log: **16 passed** observational fixtures. Four sequences × collection/root recipient × observers off/on. Fixture setup asserts q writes7 and no initial delivery; post-run verification checks reported proof/value/delivery outcomes and pair equivalence. Passing these observational fixtures is NOT acceptance of the observed incorrect proof. No runtime instrumentation, additional projection reads or added source behavior. Native field proofs are read through source.evidence().field and lifecycle.nativeProof; this is field support, not a claim to have inspected the private aggregate proof directly. Actual receipt/delivery is recorded separately.

## Decisive observations

D below means the native x field's destination role. q/r names map exact native OwnerCell identities within each case. All shown requirements are finalized at observation. Ordinary and physical field proof snapshots agree in these cases.

| Sequence | Native recording / physical value | Native x proof and actual delivery |
| --- | --- | --- |
| q owns7; independent equal updateOne x7 | q.inspect remains current; setter creates no new native field effect | D changes q -> empty, unknown:false; **7 is delivered while q pending**. Reject q then restores0 and delivers0. |
| q owns7; r performs equal updateOne x7 | r.inspect.changes=[]; q remains current | D becomes r; q only remains possible-window support. Reject r has no field inverse and leaves7; same requirement now names rolled-back r. Reject q restores0. |
| q owns7; independent equal updateOne inside r | r.inspect.changes=[]; q remains current | D becomes r and possible q is absent. Reject r leaves7 and the same requirement naming rolled-back r. Reject q restores0. No pre-settlement7 delivery in this case, but ownership proof is wrong. |
| q owns7; r writes11; reject r; reject q | r has current field effect; q superseded while11. Reject r restores7 and q becomes current again. Reject q restores0. | D during11 is r. The inverse creates a NEW requirement for restored7 but D still names rolled-back r, with q only possible. **It does not restore q destination proof.** No intermediate7 delivery; final0 is delivered. |

Root recipients show the same outcomes with nested root payloads; collection recipients emit row arrays. First witness is a premature independent delivery relative to retained native q ownership. The others establish nonexact role selection even when conservative guards happen to prevent delivery.

For independent equal updateOne, source ordinary packet explicitly carries fields:['x']; native responsibility tuple is7->7, but native preparation skips the equal field. Source proof replacement is therefore wrong even before fixing frame full-row footprint. This is not a new regression caused by a mask correction.

For equal writes within r, no reject-r packet is produced because r owns no field effect. Retaining the old q role at equal admission is necessary; waiting for an inverse repair cannot work. In the changed-r case, reject-r does produce an ordinary11->7 packet, participation:'realized', origin:'transaction-rollback'; the current publisher authors its proof from rollback context instead of the exact restored native selection.

## Exact source hooks

- entity-signal.ts:3732 passes explicit transformed keys to commitExistingSubjectValue(:2048). :2081-2082 publish fields:['x'] even for equal7.
- transactions.ts:2373 prepareEntityResponsibility; :2442 skips equal value/presence field effects. A plan can still contain metadata writes; r's empty inspection is not a missing packet.
- experimental-publication/entity.ts:57-64 derives the new native requirement from ambient transaction and declaration/input context. :115-119 installs that requirement into every listed field, regardless of whether native responsibility admitted a new obligation. This replaces q with no owner or with r in the equal cases.
- The inverse source packet recorded by the fixture is realized/transaction-rollback. prepareEntityResponsibility returns no authorship plan for it (:2380-2387); entity publication nevertheless gets a newly prepared requirement from the rollback context. The trace demonstrates the result, not a claim that one single inverse entrypoint covers every rollback route.
- Existing point inverse preparation (:515 preparePointValues, :536 prepareRealizationTransition, :545 publication) and complete/native realization routes need the same selected-obligation handoff. They must not reauthor inverse payload from the owner being rejected.

## Minimal native handoff required (proposal, no implementation)

1. The native preparation result identifies exact field effects actually admitted versus retained/no-effect fields. Equal authoring may replace allowed input/window proof, but it retains native destination obligations that the authority still owns. r-equal must not acquire field ownership just because r is ambient. No global index is implied.
2. A real effect records a source-issued BEFORE-selection capability beside the existing effect/baseline evidence, keyed by exact source/lifetime/field and source unit. It includes the source requirement references that are eligible to be selected if native inverse chooses that baseline. Retain only while that native effect/recovery/history can actually restore it; no separate all-history map.
3. The native inverse planner explicitly selects the applicable prior capability, or another exact source-issued selection when existing settlement rules choose a different compensation. Restoring7 in the measured sequence selects q's still-pending obligation; it is not new authorship by rejected r. Transport D as D; do not turn selection into input consumption.
4. Bind that selected requirement to the same prepared ordinary inverse payload before installation/completion. Validate source/lifetime/revision and native plan identity. If the baseline capability no longer matches the native compensation, do not infer by numeric equality or blindly pop a proof stack; require the planner's actual selection. Partial inverses, structural displacement, confirmed successors and q settling before r need their existing native rules preserved.
5. q's final inverse should select the authoritative0 baseline, not invent a new destination role for rejected q. The current trace shows new proof associated with rolled-back q even though useful0 delivery occurs; delivery fallback is not an exact proof handoff.

This proposal is deliberately not a claim that current native proof roles are trustworthy enough to retain blindly. The equal/inverse witnesses demonstrate why retaining current requirement.destination after a previous misclassification is insufficient. Source-issued effect/disposition and inverse selection must start from verified native evidence and preserve exact roles across the entire sequence.

Original foreign-window restoration remains a valid separate regression target. Wider-updater oracle conflict remains separate. No new persistent root, global obligation index or runtime successor is authorized here.
