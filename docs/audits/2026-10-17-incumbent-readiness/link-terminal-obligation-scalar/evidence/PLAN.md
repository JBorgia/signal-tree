# Terminal obligations: bounded scalar correction

Base440ead9f1b4d45c63f7ec8cbf50fc15944f101b2 is preserved. Owner authorizes
review followed by the reviewed correction, preserving confirmed-input failures
and all passing controls. Entities remain gated even if this scalar gate passes.
No public API, policy, budget, activation, release or B work.

## Frozen premises

Combination SPEC at readinessdabd8880:
"At a native supplied-input boundary, a source revision's unsettled D becomes an
input requirement of the consumer."
"An outcome discharges only obligations for that immutable owner identity."
"Inherited W is not subject to that normalization: its uncertainty remains even
when the same identity also appears in this installation's D, actual I, or a
validation declaration V."

The previous two public falsifiers consume a confirmed source via a native leaf
updater and branch updater. They must stop throwing and deliver8 while unrelated
q remains pending, with declared basis. Original source/tests/logs remain frozen.

## Alternatives

A. Normalize outstanding actual owners at native input capture, before user
updater execution. Historical source proof remains unchanged; successful terminal
confirmation removes only that identity from the NEW consumed-input requirement.
B. Keep historical proof and filter admission predicates. This is smaller textually
but risks allowing confirmation inside an updater or validation getter to change
whether an already-consumed pending input was declared correctly. It also touches
both native and recipient admission checks and can accidentally filter active V.

The reviewed candidate is A with an explicit capture record:
NativeInput carries the original NativeRequirement plus a frozen owner array.
Only confirmed identities are excluded at capture. Pending, rejected, abandoned
and unavailable identities remain; no general terminal filter. The source
requirement remains available for W/unknown/invalid evidence and completion of
open validation horizons. Freezing the entire source proof at consumption would
incorrectly lose later enclosing validation failure. Active V is unchanged.

NativeRequirement.inputs consumes these records. nativeProof promotes the frozen
actual owner list to I while still combining source W/unknown/invalid. Final
pre-install W normalization uses that same captured I. Horizon completion clears
input references as before. No global scans or new state authority.

## Timing controls

Already confirmed before capture: new independent consumption is permitted.
Pending at capture, confirmed inside updater: original I remains an admission
requirement; an independent claim contradicts, while dependent[p] can deliver
after p confirmation. Invalid claims retain installed writes conservatively;
possible-owner fallback includes owners pending at installation.
Confirmation during return validation cannot rehabilitate recorded contradiction.
Confirmed historical D mixed with pending I(q) must require q, not old p.
Confirmed W stays uncertainty and uses surviving fallback, not declared proof.
Confirmed explicit enclosing V retains existing nested validation semantics.
Confirmed negative membership is consumable through the same native boundary.

All original14, role2, preparation4, validation1, confirmed2 and prior combined
controls remain unchanged. First-run baseline terminal matrix is recorded before
runtime edits. Focused execution, combined scalar gate, types, then independent
implementation review; no entity resumption in this task.
