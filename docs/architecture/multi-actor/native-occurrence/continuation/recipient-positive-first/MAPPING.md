# Original-to-positive assertion mapping for independent review

This adds one file only; both original source files remain byte-identical. It does not alter discovery, remove failing tests, or represent original failures as passes. Main must review any later promotion/archive disposition separately.

| Original | Positive counterpart | Retained and added obligations |
| --- | --- | --- |
| occurrence-successor first omission scalar × confirm/rollback | positive omission scalar × confirm/rollback | Original dependent root write and hold; explicit child initial hold and zero starts; independent root literal omission gives {other:1}; child exactly [undefined], one surviving start and no declaration permission; foreign inspection/value unchanged until settlement; both terminals retain state/output and one start; child.settled before/after. |
| first omission empty × confirm/rollback | positive omission empty × confirm/rollback | Same plus initially empty EntityMap then dependent insert; exact child [[]] rather than branch wrapper or stale row. |
| first omission collection × confirm/rollback | positive omission collection × confirm/rollback | Same plus existing row then dependent update; exact child [[]]. |
| first omission mixed × confirm/rollback | positive omission mixed × confirm/rollback | Same plus held whole branch projection; exact child [undefined], no mixed stale snapshot. |
| recipient-window-review equal undeclared recipient proof × confirm/rollback | positive recipient equal-repeat × confirm/rollback | Independent literal {x:1,y:0}; second equal declaration receipt no-write before and after settlement; left/right exactly one current payload; secondary exactly one surviving start and no declaration permission; foreign inspection/value unchanged while pending; final state/output unchanged, b.settled before/after. |
| membership omission × confirm/rollback | positive recipient membership-omission × confirm/rollback | Literal {x:1} removes y; exact current value on both recipients and in source; same secondary surviving/no-declaration and foreign-owner assertions; both terminals preserve absent y/no duplicate and b.settled. |

Only obsolete requirement changed in counterparts: missing recipient declaration must cause an otherwise complete current projection to wait for an unrelated pending owner. Original comment that root declaration does not grant child permission is enforced more directly by hasDeclaration=false on the actual secondary started fact and basis=surviving. No blanket permission is added for undeclared unknown writes or native dependent inputs.

Initial unsafe hold is explicit in all eight omission cases, which contain the original q-dependent write. The four literal pair cases do not manufacture a new dependent input: they retain original independent setup, assert no initial output, and positive current-state delivery while the unrelated owner stays pending. The original thirteen actual-input/unknown/readiness/ingress counterweights remain unchanged and are separately selected for replay.

Assertions, not diagnostics, establish counts, payload, admission basis, permission, inspection/value, receipt and settlement behavior. Spies forward normal lifecycle calls. No source implementation or policy change. Exact pending foreign value is 7; after confirmation it remains 7, after rollback it becomes 0 as expected from the foreign transaction, while local projected state/output remain unchanged. No assertion demands foreign inspection remain identical after a legitimate terminal transition.

The pair test's shared fixture types y as optional to support omission; the equal-repeat case still explicitly supplies and asserts y:0 at every stage. This does not change the runtime fixture or weaken its original complete payload assertion.
