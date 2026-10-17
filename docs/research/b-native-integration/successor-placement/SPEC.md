# v16 successor-placement policy: bounded acceptance specification

Baseline: `cfe5884d7e82dd8b95c0d32f460b244144595610`.
Owner approval: October 17, 2026, “proceed with recommendation”, responding to
preserving successor placement as v16 policy direction, specification/focused
tests next, and no B adaptation yet. This does not accept B or authorize changing
stable v15. Bracket refusal and chronological replay remain unselected alternatives.

Written before the new boundary tests execute. Scope: restore removed entity
lifetimes under transactions, including mixed scalar responsibility. Resolve
anchors by lifetime identity, never a reused storage key. The cases below are
acceptance outcomes, not descriptions inferred from the new test results.

1. For an admitted singleton restore on the existing physical placement path,
   a surviving captured successor determines placement immediately before that
   successor at its current location, even if its old predecessor is now after it.
   Other surviving rows keep their relative order.
2. If that successor lifetime is gone, a surviving captured predecessor supplies
   placement immediately after it. A fresh same-key successor is not an anchor.
3. If neither recorded lifetime survives and the settlement has no retained
   same-target placement proof, refuse atomically and retain usable authority.
   Do not silently append merely because the key or an unrelated row exists.
4. If the removal originally had no neighbors, append restoration at the tail;
   this is distinct from losing previously recorded anchors.
5. Anchors restored within the same settlement may establish placement. A
   temporary anchor removed by that settlement may inform preparation, but must
   not remain in the final order. Resolve against the complete proposed topology;
   do not require every intermediate anchor to survive or invent a replacement.
6. A successful rollback is terminal. Subsequent independent placement survives
   repeated rollback, which is a no-op. Failure preserves scalar, membership,
   order, lifetime identity and pending authority; explicit confirmation remains
   useful. These ordering rules do not alter error/recovery or observer contracts.

These are bounded preservation requirements, not a promise that arbitrary
contradictory multi-row constraints always succeed. Complete-target contradictory-anchor refusal is not replaced by singleton
successor priority. Additional cases need their own complete target proof; the declaration does not bypass existing validation.

## Prewritten concrete cases

| Case | Initial / authored sequence | Expected rollback outcome |
| --- | --- | --- |
| Successor moved across predecessor | A,B,C; pending remove B; prepend C | B,C,A, same B lifetime; move A then repeated rollback preserves A,B,C |
| Successor moved farther | A,B,C,D; pending remove B; reorder survivors D,C,A | D,B,C,A |
| Successor removed | A,B,C; pending remove B; remove C | A,B, old C remains detached |
| Successor replaced and moved | A,B,C; pending remove B; remove C; fresh C prepended | fresh C,A,B; original C remains detached |
| Successor rekeyed | A,B,C; pending remove B; rekey C to C2 | A,B,C2, same C lifetime |
| Both anchors removed/replaced | A,B,C; pending remove B and scalar=1; remove A,C; fresh C | Atomic refusal, only fresh C and scalar=1 remain; repeated refusal same; confirm ends pending |
| Successor restored by same settlement | A,B,C; pending remove B then C | A,B,C, both original lifetimes |
| Temporary successor removed by same settlement | A,B; pending append X then remove B | A,B; X gone, B restored |
| Several temporary successors | A,B,C; pending append X,Y then remove B,C | A,B,C; X,Y gone |
| Originally neighborless | B; pending remove B; independent append Z | Z,B |

The first refusal policy from the rejected ordering model is not imported. Its
EXPECTED.md and failures stay unchanged as evidence about a different policy.
Reclamation remains a separate known model cleanup defect; no cleanup fix is part
of this specification or its tests.

Evidence before execution: public compatibility and missing-anchor tests in
`packages/kernel/src/enhancers/restoration/restoration-missing-anchors.spec.ts`,
physical successor-priority tests, original rekey/order counterexamples and
`b-authored-topology-repair.spec.ts`; public diagnostic at cfe5884d observes first
rollback B,C,A. Existing assertions are preserved. New tests run both the incumbent
and the selected B experiment to expose differences without modifying either.
