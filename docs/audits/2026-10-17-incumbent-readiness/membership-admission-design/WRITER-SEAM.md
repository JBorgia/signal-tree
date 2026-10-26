# Held-path preparation seam: root source verification

Read-only inspection of f01ed39a, 2026-10-26. No runtime execution or new failure count.

The current terminal-record callback is not by itself a sufficient preinstallation hook for every membership-changing write:

1. `tree-scalar-slot-runtime.ts:254–289`, `commitRecorded`, runs physical and ordinary equality, validates the physical revision, and returns before invoking `prepare` when both comparisons are equal. It calls `prepare` only when `semanticChanged` is true.
2. `tree-scalar-leaf-runtime.ts:139–144` invokes `commitRecorded`, then `liveness.absence.reAdd`, then slot publication preparation. A write equal to retained dormant storage can therefore change membership despite never calling terminal preparation.
3. `native-tree-scalar-leaf-runtime.ts:176–189` similarly commits, then invokes `capture`, then `publishChanged`; that helper re-adds the path before native publication. The derive path goes through `publishResult`, which also re-adds. Capture is outside the slot's no-callback interval; it cannot be assumed to be private preinstallation preparation.
4. `member-membership.ts:365–411` prepares path announcement only after the caller has installed the supplied value. It modifies ancestor/sibling presence and may republish before announcing. The structural-write shortcut at370 calls `reactivateOnWrite`, which directly activates membership with no publication of its own; it relies on the child's publication.
5. `signal-tree.ts:506–510` completes a whole-branch recursive write before reactivating its outer path. Entity paths also call reactivation after their source installation (`entity-signal.ts:2763,4809`). These are distinct producer families; changing the scalar equality branch alone does not cover them.

The preserved equal-retained-value re-add behavior must remain. An ordinary equal-present write stays a no-op; equality cannot suppress membership admission when an ancestor is absent. Nor can the inverse correction just force every equal write through a value revision.

A concrete successor would need a membership-aware installation plan at these existing source families, with an explicit criterion independent of `semanticChanged`. It would reserve the actual path changes and publication association before value installation and commit both before any capture/native reentry. The plan must validate after equality/updater preparation and honor nested changes. No additional user callback may be moved across physical installation as an incidental consequence.

This does not prove that a new public API or different settlement architecture is needed. It does prove that a notifier-only change or changing the late membership capture callback is not a complete implementation map. The runtime experiment must enumerate neutral scalar, native scalar replace/derive, branch, entity and prepared restoration paths rather than inherit scalar coverage from the current `prepareTerminal` callback.

Required unchanged controls include dormant descendant writes, equal retained-value re-add, ordinary equal-value no-op, semantic-slot exactly-once publication and grouped reentry. A new fault injection must fail membership-plan preparation before any value/presence installation; an earlier already-installed sibling remains governed by partial-success semantics. These controls are prerequisites, not reported passes.
