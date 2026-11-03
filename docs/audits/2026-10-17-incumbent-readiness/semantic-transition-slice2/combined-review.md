# Independent combined slice2 review

Reviewed frozen first native/consumer implementation and reported structural-first20/20/typecheck evidence. No production/candidate/test edits, no concurrent Nx. One separate public-API esbuild probe executed and preserved under review/ with SHA256SUMS.

## Blocking public counterexample: ordinary destination lost through rekey

Initial ordinary rows A7,B8. Inspection removes A physically. A held reference remains tied to old A lifetime. Pending transaction rekeys B into physically vacant key A. Inspection of pending responsibility succeeds. Rollback reports success, but final IDs are only B and held old A reads undefined. Expected ordinary topology within the authored key footprint includes restored old A and B. This does not require storage key to equal payload id; it is missing ordinary destination occupancy/lifetime, not id-string mismatch.

Exact reproduction: review/rekey-vacancy.ts; frozen executable review/rekey-vacancy.mjs; result review/rekey-vacancy.log. No Link, direct public methods, no injected getter or internal effect. Result has no rollback error; ids=[b], rowB preserved, oldA absent.

Root cause: prepareOrdinaryTopology consults ordinaryTopology.atKey(afterKey) only in the add/ordinary-absent branch. The ordinary-present rekey branch emits a rekey and clears source divergence, omitting removal of displaced ordinary A. Existing inverse therefore knows only to move B back. The same-key complete-target guard cannot restore a fact never admitted. This is a missing structural authorship fact in W5, not an argument to remove the complete-target guard or retarget held references.

The passing C2 add-into-vacancy case does not cover this rekey-into-vacancy route. Treat first20/20 as true bounded results, not completed W4–W8 qualification. No repair attempted in this review.

## Source assessment beyond the falsifier

- Prepared plural/empty ordinary list travels through the existing notification metadata. ordinaryEntityEntries selects empty as affirmative no-authority and strips selection markers after expansion; committed capture does not re-expand the entire list once per member. This is the right distinction and does not by itself create another settlement engine.
- The metadata merge concatenates prepared ordinary lists before ordinary consumers select them. The ordinary-presence index is sparse, but it is only correct if every occupancy author (including rekey) supplies displacement facts and index changes atomically. The counterexample shows current coverage is incomplete.
- C2's admittedEffects target extension preserves the existing complete-target guard. It separates ordinary value edits from structural/existence subjects and clears divergence only for those supplied subjects. That is within the narrow dependency reviewed earlier; its usefulness cannot repair omitted source admission. General restoration callers intentionally lack this extension and remain outside the new claim.
- Topology divergence retains prior ordinary lifetime values/anchors and retirement checks consult retains(subject). This protects the demonstrated live C2 obligation. Final retention/GC qualification is not established here; actual absence of pending owners is insufficient to reclaim divergence.
- W4 onAdd order correction still has its narrower reviewed success. Its pre-add prepared capture/frontier versus final prepend descriptor and updateSignals-before-onAdd timing remain cross-path qualification concerns noted in w4-review.md. No additional runtime failure for those was executed here.
- Physical order frontier and ordinary existence are distinct. The implementation must not use an ordinary structural record to manufacture a physical interval. The rekey failure concerns omitted facts before frontier restoration, not proof that frontier machinery itself needs replacement.

## Disposition

Current combined slice2 is **not accepted**. Preserve the useful C1–C3 and callback controls, but the public W5 counterexample is sufficient to block the gate. It does not falsify sparse divergence or shared prepared transitions as a direction. Any authorized correction must address occupied ordinary destinations across actual structural authors, without caller-specific rekey compensation after installation or weakening the ordinary-topology requirement.
