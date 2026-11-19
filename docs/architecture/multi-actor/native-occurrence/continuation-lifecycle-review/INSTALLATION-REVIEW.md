**The per-invocation receipt and proposed installation marks are sound for the identified single-effect paths. The transaction-completion bridge remains underdefined for partial multi-unit installation.** Approve the mechanism conditionally; do not yet treat the proposal as a complete implementation contract.

The source supports these details:

- **Direct replacement:** mark after value, ordinary support and terminal-record installation, before `capture` at [entity-signal.ts:2258](/private/tmp/st-native-explicit-handoff-successor/candidate/packages/kernel/src/lib/entity-signal.ts:2258). This correctly covers equal-value support installation and errors before the physical clock advances.
- **Selected row replacement:** the proposed `installOrdinary` mark precedes `observeCommitted`. It is valid for this caller because its separate `responsibility` argument is currently `undefined`. Do not generalize that mark to frames with another terminal record: [entity-mutation-frame.ts:394](/private/tmp/st-native-explicit-handoff-successor/candidate/packages/kernel/src/lib/physical/entity-mutation-frame.ts:394) installs `responsibility` **after** `installOrdinary`.
- **Receipt lifetime:** clearing the invocation payload must leave its installation result available to the enclosing compensation attempt. A fresh retry gets fresh evidence.
- **Dispatch exit:** returned-without-installation must refuse; cleanup must not replace a primary error. Installed-then-observer-throw must retain the installed disposition.

The unresolved bridge needs **complete chosen-route accounting**, not merely a list of paired-field receipts. At [tree-realization-adapter.ts:608](/private/tmp/st-native-explicit-handoff-successor/candidate/packages/kernel/src/lib/internals/causal-runtime/tree-realization-adapter.ts:608), the route can install membership, commit a scalar/heterogeneous frame, execute multiple effects, then publish membership. Some prepared routes already carry whole-operation completion through `onCommitted`; preserve those marks rather than substituting field counts.

Before patching the bridge, specify:

1. Which required installation units the **actually selected route** contains, including units without field-endpoint payloads.
2. Where each unit records installation before callback delivery.
3. How normalization/cloning preserves the attempt association without attaching it to persistent history.
4. What the existing caller does when **some, but not all, required units installed**.

That fourth point cannot be collapsed into the current boolean without justification:

- `committed=true` after **any** receipt can falsely retire incomplete compensation.
- `committed=false` after **not all** receipts enters a branch described as “Nothing installed,” which is also false after partial progress.
- Shared clock movement cannot resolve either case.

The exact needed discriminator is:

> A real compensation attempt reaches two required units through the targeted route. The first installs its value/support/terminal record; the second refuses before installation. Record both units’ installation facts, resulting values/support, transaction lifecycle/pending authority, and behavior of a legitimate retry.

Run that against the frozen predecessor and correction. Assert the route was actually reached; a test diverted into a whole prepared frame does not qualify the per-effect bridge. For the mixed-route claim, use the same discriminator with **one non-selected unit and one selected unit**, or demonstrate from source that the relevant combination cannot reach this fallback.

Include the control where **all units install and the final observer throws**: it must retain complete compensation’s existing terminal disposition. The proposed independent-write-plus-skipped-`proceed` control separately catches false success from unrelated clock advancement.

If the predecessor discriminator exposes an already-inconsistent partial disposition, preserve that result. Do not choose a new partial-settlement policy inside this handoff patch or silently switch planners.

This remains within the authorized private handoff and prepared-operation completion scope. No new public seam is needed. The proposal correctly leaves broader structural integration unqualified. Source inspection only; no runtime edits or tests performed.
