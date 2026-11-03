# Independent admission/recurrence review

## Scope and disposition

Reviewed proposed PREPARATION.md, frozen slice-2 source, extracted fold and rollback implementation, raw probes, compiled sequence, and native reachability source/log. Read docs/review-contract.md and independent architecture protocol. Readiness HEAD is 95dbf59a0d66e1dab06b72cf756fd2afcc231ce7; its only tracked dirty files are unrelated AGENTS.md and measurement-contract.md. No production files changed.

**The proposed chronological occupancy-edit encoding cannot be fed unchanged into the incumbent fold. This is a concrete preparation/consumer incompatibility, not a demonstrated new native rollback regression, and not proof that the before/final occupancy representation is inadequate.** The exact expected inverse `rekey` assertion is stronger than necessary to prove correct final rollback under the proposed current-physical identity join. An inverse `add(oldA,a)` could relocate active oldA from d to a in that proposed compiler. Therefore do not report these two extracted failures as proof that rollback must lose oldA or produce incorrect final rows.

Nevertheless the forward removal-only record is not a truthful encoding of the operation's ordinary after-state. The mechanism must resolve this before runtime successor selection; merely showing the inverse can reach the right destination does not close capture, inspection, forward replay or dependency accounting.

## Concrete source evidence

`transactions.ts:1734–1750` deliberately keys structural contributions by lifetime to compose a NET effect. `enqueueEffect`, lines1791–1825, handles add/remove cancellation, rekey/remove, add/rekey, and rekey/rekey. A remove followed by add reaches the unconditional return at1825 without updating the first remove. This is exactly the extracted result: before A@a, final A@d becomes `remove(A,a)` with no ordinary after binding.

`pending-rollback.ts:127–175` selects dominant add/remove effects and first-address effects. Consequently simply retaining the chronological list downstream without auditing this stage is not an equivalent fix: the consumer intentionally discards/combines effects. Its source is not a chronological interpreter.

`target-transition.ts:679–719` interprets add as inactive revival and remove as deletion from the recorded source key. This physical consumer cannot itself accept the proposed ordinary inverse unchanged when a lifetime remains active. The proposed pre-validation physical join remains required regardless of normalization choice.

Other consumers demonstrate why the forward shape matters: `pending-rollback.ts:440–460` tests acquired structural resources and subject dependencies, while `reclamation-eligibility.ts:52–59` treats confirmed remove as a restoration obligation. A remove-only record describing a still-present ordinary lifetime supplies different facts to these consumers than a rekey. These are source-based consequence risks, not executed inspection/retention failures in this successor.

## Reachability and assertion strength

The provided native sequence uses supported row methods plus the established internal inspection participation harness: oldA@a and oldB@b; inspection moves oldA to c; one transaction moves oldB b→a then oldA c→d. Under the proposed bind contract the first operation displaces ordinary oldA; the second rebinds the same lifetime. Its chronological ordinary sequence is remove(A,a), rekey(B,b,a), add(A,d). This is a reachable input shape for the proposed producer, not an arbitrary impossible lifetime resurrection.

The rejected runtime itself currently rolls this sequence back successfully because its rekey preparation omits ordinary destination displacement. Its successful native output must remain preserved; it does not validate the proposed producer/old-fold combination, and the extracted failure must not be relabeled a native regression.

For same-key remove/rebind, expected empty *occupancy* contribution is appropriate only if before/final occupancy are identical and no other authored responsibility differs. Field values, placement, revisions and lifecycle cannot be erased because the key round trip cancels. The current probe keeps fields unchanged and includes no explicit placement facts, so it establishes the fold's restricted behavior, not universal no-op semantics for every remove/rebind operation.

## Viable common encodings

1. **Before/final ordinary occupancy normalization:** stage ordered changes privately, retain first ordinary before and final ordinary after per lifetime/key, and emit net add/remove/rekey into incumbent capture. Preserve separately authored value and placement transitions, displaced lifetimes, and explicit revision/reentry evidence. This fits the existing net-effect premise. However normalization must span the same composition boundary as transaction capture; normalizing each individual writer and then sending remove followed later by add to the unchanged fold reproduces the problem. Cross-operation accumulation needs a coherent common rule, not a special case in rekey.
2. **Chronological steps retained end to end:** possible in principle, but requires changes to the subject-keyed fold, inverse dominant-effect suppression, validation/target compilation, inspection/replay, and lifecycle consumers. It is a larger change than adding an operation ordinal to the preparation map. No evidence here establishes this expansion necessary.

Neither encoding is authorized to convert ordinary inverse facts into physical facts or infer ordinary payload from inspected display. Owner's physical99/ordinary7 rule remains compatible with both, provided physical realization derives separately before validation.

## Falsifiers and required next evidence

Executed `node /private/tmp/occupancy-successor-normalization/probes.mjs`; reviewer log is reviewer-fold-replay.log. It reproduces 6 passing and 2 failing extracted-fold assertions. Node execution reported the same shape mismatch. No native successor exists and no native suite, framework, collection lifecycle or publication qualification ran in this review. Native sequence and compiled-sequence logs were inspected, not rerun.

A successor must demonstrate that the real capture boundary records before A@a/final A@d through the supported sequence; same-key cancellation preserves explicit field/order work; separately displaced lifetimes survive; current-P lowering retains inspected99/O7; rejection and a subsequent transaction observe coherent authority. Original two native falsifiers remain unchanged gates. Successful final rollback alone does not qualify the forward record.

**Bounded conclusion:** the proposed producer plus unchanged fold is not admitted. A net before/final preparation mechanism remains a concrete alternative within the incumbent net-effect semantics; no new public policy question is demonstrated. This review does not establish acceptance of that alternative or clear the slice-2 recurrence gate.

## Follow-up: endpoint-table challenge (October 23)

Read the appended transaction-wide endpoint table. It addresses the specific missing forward binding at the level of representation; this is not executable survival evidence. The same-key cancellation row is only an occupancy result. It must not erase explicit ordering, field presence/value changes, observation revisions, or a dependency authored by another operation while the temporary binding was live.

Actual integration scope is broader than replacing a prose table or one `enqueueEffect` call. In `transactions.ts:2222–2256`, paired responsibility preparation folds touched prior entries into a private scratch map before installing them with an operation record. `foldOperationDisposition` at2275–2297 independently traverses the saved operation records but calls the same `enqueueEffect`. An endpoint implementation must give both paths identical truthful semantics. Today they can agree on the same wrong removal-only result; agreement between them is not an independent occupancy correctness test. The operation journal's original effects and sequence must remain available for its existing coverage/frontier checks, even when the net occupancy contribution cancels.

The concrete later-dependency predicate (`pending-rollback.ts:420–465`) reads normalized turn effects, not the full operation journal. It extracts restored source keys and acquired final keys at490–509. Therefore retaining chronological steps somewhere does not, by itself, preserve intermediate dependency semantics. Nor does the source establish that all temporary key acquisitions must remain permanent authority: existing round-trip rekey cancellation deliberately removes a net structural effect. The required distinction is a surviving authored obligation versus an intermediate observation.

A discriminating case is synchronous nested work that consumes the temporary placement/existence during an outer transaction, followed by an outer return to its starting occupancy. The endpoint table must preserve the nested work's own field/order/existence obligations through the existing admission rules, without promoting every temporary observation into authority. This is an unrun composition falsifier, not a newly demonstrated runtime defect or a reason to invent a new contract. Likewise a canceled fresh lifetime with no surviving dependent obligation should remain cancellable; retaining all temporary subjects would defeat the incumbent cancellation and reclamation contract.

What is disproven: unchanged incumbent folding faithfully encoding the proposed chronological bind/unbind inputs. What is not disproven: endpoint normalization, same-authority settlement with a separate physical compiler, or eventual correct rollback using an inverse add. What remains unknown: endpoint normalization across the real paired-capture and journal-validation paths, intermediate surviving obligations, placement realization without changing callbacks/work, publication/inspection agreement, fault atomicity and reclamation. No gate is cleared by this review.

## Bounded delta: executable endpoint feasibility (October 23)

Inspected `/private/tmp/occupancy-endpoint-feasibility/fold.mjs`, unchanged probes, compiled sequence, discriminators, payload control and first/final logs. Byte comparison confirms probes.mjs and rollback.mjs match the original normalization directory. No additional execution was needed for this review.

The replacement structural composer stores first presence/key and final presence/key per `(ownerPath, position, subject)`, checks consecutive occupancy continuity, then passes one net effect per lifetime to the incumbent fold. The recorded eight unchanged assertions and the compiled sequence now pass. This supports **structural endpoint expressibility and compatibility with the extracted incumbent inverse constructor for those inputs**. It does not prove compatibility with native capture, public inspection or physical installation.

The raw harness summary still says “extracted incumbent structural fold”; that label is stale for these runs. The actual tested composition includes the experimental endpoint composer. Preserve raw logs and annotate the scope rather than implying the unchanged incumbent fold was repaired or these were native tests.

The six additional controls prove only their narrow assertions. Explicit fields are manually appended after structural folding and then inverted; no producer has demonstrated correctly extracting those fields from remove/rebind payloads. “Nested separately-owned capture” calls two independent fold functions; it does not execute nested transactions, cross-owner invalidation or surviving intermediate dependencies. “Committed checkpoint” checks that a later independent call does not mutate an earlier result; it does not test native confirmation. Discontinuity throws are useful model validation, not evidence that already-installed native work will retain usable recovery when interruption is discovered.

The initial payload-context failure is substantive evidence against judging only key signatures: add→rekey initially lost the creation value and placement anchor. The corrected model carries the add context and the recorded control now passes. This is a bounded correction, not proof of complete placement: rekey→remove currently takes removal context from the last record while substituting the original key, and ordinary relocation may need placement distinct from that last context. The authorized successor/predecessor semantics and physical transfer planning still require their unchanged controls.

No production approval follows. Missing gates remain: real transaction-wide paired capture and journal validation; field/presence and explicit ordering extraction; surviving nested obligations and cancellation; pre-validation current-P relocation with physical99/ordinary7; preparation/reentry/fault behavior; original native recurrence falsifiers and subsequent-transaction assertions; coherent inspection/publication and obligation retirement. This finite experiment answers whether an endpoint encoding can express the lost after-binding without changing the inverse vocabulary: **yes for the tested structural cases**. It neither clears the recurrence boundary nor demonstrates that a new public semantic decision is necessary.
