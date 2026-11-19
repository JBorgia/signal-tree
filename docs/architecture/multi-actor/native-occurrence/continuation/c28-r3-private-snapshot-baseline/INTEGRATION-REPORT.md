# Recovered private adapter baseline controls

Main inspected the executed source, preserved first fixture, Nx logs, exit records and observations after the original worker session ended. No runtime optimization or new execution is claimed by this assessment.

- First run: one pass, one failure. The failure expected `preparation reentered installation`, but the actual unchanged guard threw `Stale scalar preparation`.
- Counterpart: two passes. The only fixture change is that exact error-string expectation; every useful state, atomicity, retry and identity assertion is unchanged.
- Spec-types passes the existing ratchet.

P directly invokes private `preparePointRealization`; its real snapshot read reenters with an ordinary scalar write. Preparation refuses before entity installation; the nested scalar 7 survives. A fresh plan installs/publishes entity 0, and the held row subsequently accepts 8. Stack evidence proves the target snapshot call was reached. This is private adapter integration, not proof that public transactions choose that branch.

R establishes separate ordinary/physical membership through existing private ingress, lowers a structural add to rekey plus placement, validates and installs it. The same held lifetime moves from a to z after b, preserving payload id a and later n=8. Stack evidence reaches snapshotCollectionEntityValue from updatePreparedRealizationContext. It does not authorize removal of visibility, cloning, tracking or validation rules.

The first assertion mismatch is preserved as fixture calibration, not a corrected runtime defect. These two cases are distinct from the preceding six and additional four. Across these baseline additions there are eleven passing cases and one preserved unsupported-route/oracle failure; this is not complete reader qualification. No optimized reader, allocation improvement, OOM explanation, production activation or API change is established. Independent interpretation review confirms these bounded claims. It emphasizes that a fresh plan is not retry of the refused plan, historical inputs lack complete per-run manifests, and capability/tracking/clone/visibility/allocation gates remain. See INTEGRATION-REVIEW.md.
