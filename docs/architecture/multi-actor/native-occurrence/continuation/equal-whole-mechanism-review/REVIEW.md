# Equal-whole native-admission mechanism review

**GO for bounded implementation/proof of the frame offer-domain extension, not implementation acceptance.** The existing admission/installation boundary supports the approved unowned-field rule without a new ownership authority or Link bypass. One source premise must be corrected: explicit whole input is not necessarily already materialized data. Getter/read/reentry behavior requires a concrete control below. No speculative compound-step blocker is asserted. No runtime edits or new executions in this review.

Reviewed plan SHA-256: 728447bda09e22c8d34bc90f2646bc010580b6e7cfa27850ce28f3079e6b638d; every packet entry verified. Inspected source files match copied exact C15 manifest 02aba88c81c413700ef4af2f9bf8facc422cabf01fddf6a31b4ec2d777b16568. Authority and six original tests/failures are preserved in this packet and the preceding test review.

## Consumers: offered metadata versus native value effects

Audited runtime references to EntityPublicationEdit/Packet, entityPublicationOrdinary, publication subscribers and the native factory. The current kernel consumers are:

| Consumer | Meaning/effect of widened ordinary fields |
|---|---|
| internals/entity-publication.ts:27–32,58–94,226–269 | Ordered step/tombstone extraction, immutable metadata admission, native-first then recipient preparation, terminal-record installation/completion. Does not turn keys into value mutations. Preserve edit identity and step ordering. |
| experimental-publication/entity.ts:115–134,175–205 | Offers/chooses/installs native field endpoints and per-edit support. Uses restored > selected > proposed precedence. Its physical field loop at160 consumes packet.physical, which must remain unchanged. Support view requirements may update even when physical values are equal; that is not a value write. |
| internals/entity-egress-projection.ts:41–62,208–218,232–244,332–336 | Reconstructs recipient rows and transports selected support for offered keys. A nonempty equal domain can allocate a row and mark projection changed. This is recipient work, not proof of a native value delta. Preserve evidence.forEdit identity. |
| link.ts:582–611 | Uses offered keys for scalar/row selection, affectedness, support preparation and dirty eligibility. Thus widening DOES cause Link work. Acknowledged-value equality at866 suppresses redundant outbound delivery; original held work must still send. Do not claim these consumers ignore offered equal keys. |

Native transaction effects remain based on capture.changes (transactions.ts:2406 onward), not publication edit.fields. entity-signal.ts:1605 passes unchanged ordinaryPlan.changes into responsibility capture; :1645–1655 commits original frame/valueTransitions and ordinary topology with the publication terminal record. Keeping packet.physical fields, ordinaryPlan.changes, frame mutations and transition equality unchanged avoids inventing owner effects or native value notifications from the new offer domain. Static separation supports the proposal, but notification/inspection assertions remain mandatory execution evidence. No broader notification guarantee is claimed before proof.

## Supplied domain and the accessor correction

For an ordinary nonstructural whole replacement, entity-signal.ts:1407–1413 prepares a transition for that mutation; :1448 captures its authored scope. EntityValueStore.prepareValueTransition:62–80 uses physicalAfter as ordinaryAfter for explicit whole (null scope), except inspection, whose ordinary edits are removed. prepareOrdinaryTopology:1286–1288 preserves change.after for the same nonstructural step; byStep and changes are completed from the same ordered groups at1361–1369. Therefore the matched effect.after is a valid step-local supplied whole row for this case; it is not permission to enumerate retained historical certificates, a later current row, or a merged partial result. Structural adoption/rekey/removal and inspection require their existing paths.

However, direct replacement passes nextValue:next at2460, and setAll keeps transformed input rows. EntityValueStore's accessor-to-data staging at23–49 is specific to derive, not explicit whole. Thus “already materialized row” is not universally true. Object.keys itself does not call getters, but proposed endpoint fieldValue and projectEntityFields read the offered values. Previously equal empty domains did not make those reads. Preserve getter counts/errors/reentry explicitly; do not silently add deepClone/eager staging or a new input restriction to make this premise true.

Concrete additional control: equal ordinary row supplied with an own enumerable getter for x; record getter calls and first thrown identity, then make a later getter call reenter an independent write. Compare exact predecessor and candidate. Require coherent selected payload/support and existing stale-outer refusal without losing inner work. This is a source-grounded qualification gap, not evidence that data-property whole offers are invalid. If resolving it needs a different staging contract, preserve the failure and stop for review.

## Ownership and compound-step interpretation

The hook's no-effect branch preserves ANY before.owner!==undefined endpoint when the hook runs (transactions.ts:2472–2483), not just owners currently pending. An owner marker can outlive pending status; hook early returns at2379–2397 also affect whether selection runs. The plan correctly leaves this existing policy intact. The claim is fresh evidence for selected unowned fields plus preservation of actual pending claims, NOT universal reauthoring of terminal-owner fields. Do not query outcome and relax this guard in this patch. A confirmed-owner control with another pending turn can record whether the exact predecessor retains that endpoint; compare successor identity/outcome without inventing a required refresh. Existing later-confirmed rejection controls remain binding.

C15's lastOrdinaryBySubject proposal and selectedFields are intentionally atomic-unit/final-subject selections. packet-index-adversarial.spec.ts explicitly expects the last duplicate proposal and separately enforces per-edit restoredFields/forEdit identity. Keep these assertions. “Step-local” applies to where supplied keys, ordinary edits, physical pairing and explicit restored evidence originate; it does not authorize changing the native proposal oracle to an earlier row. Existing setAll and addMany overwrite producers deduplicate keys before staging (first position/last value). There is no demonstrated production collapse counterexample here.

Concrete compound discriminator: replay the existing duplicate-subject and remove/restore packets with an equal whole step followed by the later step, preserving final proposal selection and per-edit restored overrides; also use the real deduplicating whole writer and assert final value, endpoint, ownership and inverse outcome. A mismatch must identify the changed selected endpoint or lifecycle, not merely observe that a final proposal is shared.

## Proof boundary and test maintenance

Keep Main's six assertions unchanged, plus retained-root reexposure, actual equal/inverse/net-zero ownership and original rejection controls. The listed partial/derive, absence/undefined, no-recipient, already-acknowledged output and reentry/refusal discriminators are appropriate; they are not claimed executed. One mixed owned/unowned row must show only the unowned held field refreshes while the owned field and whole outgoing projection remain held until legitimate settlement.

The old native-authored-footprint assertion fields=[] encodes the pre-approval offer boundary. Under this specific implementation it requires explicit reviewed maintenance to the supplied own-key offer, retaining all writer-classification assertions and unchanged physical-diff/capture controls. This narrowly qualifies my earlier request to keep that fixture unchanged: preserve its original source, do not delete it or weaken scope assertions.

Conclusion is mechanism viability for bounded proof only. The accessor premise, selected endpoint/notification/refusal controls, and owner-marker qualification must travel with implementation. C15's separate scalar pending-value-work defect remains separate; no inference that these offers fix it. No public surface, policy, budget or runtime changes made here.
