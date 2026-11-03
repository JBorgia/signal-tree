# Terminal-owner follow-up: whole replacement matches the existing explicit setter

**The whole-write successor matches existing exact-C16 `row.x(7)` semantics in both requested cases.** This resolves the prior characterization difference against the relevant explicit-field reference; it does not require a new terminal-outcome policy. No runtime or prior assertion changed.

Exact C16 manifest `611f7da2665e91f3c53a8aceeb32a2b878324d4db86ced489c2785e898d8e537`: all 3,061 paths verified before copying and after the run. Only one new characterization spec in own scratch. Pinned Nx run: **2 passed**, source unchanged. Raw command, first log, output and result: `runs/explicit-field-first/`. `EXPLICIT-FIELD.json` equals the previously preserved successor whole observations byte-for-value after JSON parsing; comparison asserted in `COMPARISON.json`. No broad suites or further cases run.

Common setup preserves the prior characterization: q writes x7 and confirms, independent declaration performs the equal write, and optionally local r owns sibling y1. The only operation substitution is whole-row replacement → `row.x(7)`. Existing sibling endpoint retention and r rollback result `{id:a,x:7,y:0}` assertions remain. Endpoint identity is recorded, not prescribed by a new terminal-owner expectation.

| Context after q confirms x7 | Existing C16 whole | Existing C16 x(7), newly run | Successor whole, prior frozen result |
| --- | --- | --- | --- |
| No other local pending turn | Same endpoint; D=[confirmed] | Fresh endpoint; D=[] | Fresh endpoint; D=[] |
| Separate local r owns y1 | Same endpoint; D=[confirmed] | Same endpoint; D=[confirmed] | Same endpoint; D=[confirmed] |

Source agrees with observation: `transactions.ts:2379–2397` returns before native responsibility selection when no local pending authority exists, allowing the explicit offer's proposal to be installed. When a local pending turn exists, `:2472–2483` preserves an unchanged field's prior owner-bearing endpoint. The successor did not change either branch; widening whole-field offers now reaches the same selection behavior already exercised by the explicit setter. There is no new owner-outcome query or terminal-owner guard relaxation.

Bounded conclusion: the previously recorded confirmed-owner difference from old whole replacement is expected matching of the owner-approved explicit-field semantics in these two cases, not independent evidence of new terminal-owner policy. The original actual-pending-owner controls and other qualification results remain separate evidence. This follow-up does not claim universal terminal/inverse coverage, resolve the inherited mixed rollback hold, or grant composition/release acceptance.
