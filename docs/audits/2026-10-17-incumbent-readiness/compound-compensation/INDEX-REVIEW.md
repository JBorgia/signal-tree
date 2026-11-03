# Bounded index assertion review — 2026-10-18

The newly reached `getCurrentIndex() === index - 1` assertion is not an established v16 causal-undo requirement. Preserve the original archived carrier and first failure; correct the active carrier to require useful restored state, retained handles, and canUndo/canRedo authority transitions.

Independent historical evidence:
- `packages/kernel/src/enhancers/restoration/jump-undo-equivalence.spec.ts:104–105` explicitly states undo does not move getCurrentIndex. Git blame attributes this premise to commit `1dbc5e7e476138eb5f1c38fb6ab86733de833a0c` (2026-10-06), the v16 8g jump/undo equivalence repair, predating this frontier candidate.
- `packages/kernel/src/enhancers/restoration/restoration.behavior.spec.ts:22–31` requires reversed state while allowing index equality after each undo; jump navigation asserts the index at line38.
- `docs/architecture/history-positionid-lifetime-and-design-space.md:921–940` distinguishes selective causal undo from snapshot rewind and says snapshot position must not decide confirmed-history causality.
- Current `restoration.ts:1738,1765` delegates undo/redo to confirmed-turn authority. Only explicit jump navigation assigns its destination at2048; getCurrentIndex reads currentIndex at2053.
- `docs/guides/time-travel-in-production.md:233,236` still contains older snapshot-stack recipes. Those recipes are inconsistent with the later explicit v16 test premise and cannot establish that this candidate changed index semantics.

No runtime index repair is warranted by this carrier. This is a test-contract disposition, not release sign-off. Source/history inspected; no additional suite run by this reviewer.
