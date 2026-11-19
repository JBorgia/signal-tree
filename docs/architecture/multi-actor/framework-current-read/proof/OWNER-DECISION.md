# Native current-reader SDK decision

Owner approved October 29, 2026: “Approve capability and explicit native-adapter migration (recommended).” The [proposal](../SDK-PROPOSAL.md) and
[independent review](../SDK-REVIEW.md) preserve the evidence and alternatives.
The rejected existing-SDK repair is archived under [evidence](../evidence/RESULT.md).

Main recommendation: authorize a bounded proof of the distinct optional
`ObservationAdapter.createCurrentReadonlyCell(readCurrent)` capability. Require
capability support from native-carrier adapters for the repaired v16 guarantee;
reject unsupported native configurations before mutation instead of returning a
bare callable with missing native properties. Preserve neutral callable adapters.
Do not silently change existing runtime selection. Exact enforcement for partial
custom adapter configurations must be specified before implementation.

This differs from the proposal's legacy bare-callable fallback. It is an explicit
v16 adapter-SDK compatibility decision, not a stable-v15 change. A type-compatible
optional member does not make the behavioral change compatibility-free. Existing
native custom adapters require migration.

This approval authorizes the bounded implementation proof only. It does not
authorize weaker Vue/Angular carrier types, private framework machinery, altered
application-native computed timing, activation, release or new budgets. If those
prove necessary, preserve the counterexample and return that concrete decision.
Framework-only feasibility probes remain separate from public SDK changes.

Archive note: relative links were adjusted for this directory; original text is preserved in `OWNER-DECISION.original.txt.gz`.
