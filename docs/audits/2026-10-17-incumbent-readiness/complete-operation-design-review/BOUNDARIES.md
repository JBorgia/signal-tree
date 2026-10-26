# Native operation, capture and history boundaries

Independent read-only source trace October26. Frozen f01ed39a /private/tmp/v16-transition-qualification; no models/tests/runtime edits. These findings are source observations and constraints, not selection of a successor representation.

## Boundaries are distinct

| Boundary | Concrete source | Meaning and limit |
| --- | --- | --- |
| Public compound entity operation | entity-signal.ts addManyInOrder; final source topology before publishOrderChange2477–2489 and emitTap2549; setAll completed membership/order before taps4230+ | One operation may involve value, membership and order. It must finish semantic facts before callbacks; public operation return is too late if callbacks run before return. |
| Physical mutation frame | physical/entity-mutation-frame.ts133–144 stages finalFront/finalOrder; commit266+ installs instructions, ordinary state and responsibility before observer publication | Installation unit, not automatically public operation or history turn. Direct field lane commitExistingSubjectValue bypasses frame; S4 target installation has another prepared unit. Callback operation gets a distinct frame even if same transaction. |
| Tap delivery / reentry | entity-signal.ts2755–2782 emitTap restores ordinary interception/reAdding behavior and executes handlers | Nested application writes are ordinary operations. They may inherit transaction ownership/designation, but must not become delayed outer-operation facts. Outer callback return cannot delimit first operation completion. |
| Transaction scope | transactions.ts4361 rejects nested transact;4429 reserves pending turn before callback;4441–4475 ambient transaction context/runInvalidationGroup;4539 materializes bucket after callback, staged lifecycle and flush | Settlement authority groups all owned callback writes. Includes multiple sequential public operations and synchronous callback reentry under same owner. Foreign realized writes can occur in same callback with different participation. End-of-transaction is not one source operation boundary. |
| History designation | lib/undoable.ts documentation lines14–38 explicitly says marks causal turn, does not create boundary; nested scope idempotent | Multiple undoable callbacks in same tick can be one history step; undesignated same-turn write can be included. Callback exit is not history closure. |
| History capture bucket | restoration.ts4378–4385 ORs designation,4432 onward merges collection order first-before/last-after plus ordinary endpoint/domain union; capture drain/flush materializes history entry | Coalescing/eligibility boundary; must compose completed source operations and membership intervals without equating an intermediate endpoint with full turn endpoint. |

Operation admission identity and chronological sequence are separate from settlement owner. transactions.ts134 captureIdentity, capture bucket source admissions and dependencyLedger804–810 explicitly protect chronology; reserved pending ID gives authority opening order. Those identifiers cannot simply identify an outer public operation when a callback authors nested work. Conversely giving each source operation an ID cannot authorize separate rejection of a single transaction's constituents.

## Two concrete discriminators

1. Preserved order-composition-readiness.spec.ts35–48: one designated callback addw then overwriteprependc. Order-before snapshot containsw; undo of whole turn removesw. A source-operation order endpoint is valid for prepend but invalid as the complete-turn inverse membership domain. Current ordinary order handoff preserves intermediate endpoint unchanged while physical boundary composer extends membership. Any design must compose that evidence across operations before selecting turn inverse; filtering missing IDs opportunistically does not prove restored order.
2. Prepend callback nested prepend: outerC installation must finishCAB before onAdd(C); callback prependsD, finalDCAB. Both writes may belong to same transaction/history authority, but outerC source facts cannot be completed using finalDCAB or later overwrite D's placement. Existing entity-semantic-structure-slice callback controls and prepend-publication-boundary.spec.ts assert completed snapshots plus nested append/prepend outcomes. Completion-before-callback is essential; 'finish at callback exit' would fold nested intent into outer.

## Constraints on any proposed complete-unit design

- Define source logical operation completion for every actual lane (direct value, frame, compound prefix/full order, S3 point, S4 target, S5 restore). One frame is not universal, but each lane must emit immutable completed facts before its first callback/publication.
- Preserve distinct P before/after and O before/after, including membership/lifetime/key/order/field footprint. Reentry is a later authored operation, even when owner and causal turn are same. No global mutable outer collector may overwrite earlier facts after delivery.
- Transaction/history composition consumes an ordered sequence of completed source facts; it composes endpoint membership/order over whole authority scope without reassigning ownership of foreign realized operations or incidental inspected topology.
- Ordinary source facts and operation observation sequence must reach capture/inspection/publication/history consistently. Already-complete source records cannot be replaced with current physical snapshots at history drain.
- Callback nested writes may remain same transaction for rollback; distinct-operation requirement does not authorize separate transaction/history APIs or change undoable's causal-turn grouping.
- User code during preparation must precede validation; reentry invalidates stale prepared units or is incorporated under existing contract. Callback errors after installation preserve installed coherent authority and existing recovery semantics.
- A pure model can test consistency of these distinctions but cannot itself lift runtime recurrence stop. Frozen public failures and native integration remain qualification targets.

Conclusion: transaction end, callback exit, frame commit and history flush are not interchangeable logical-operation boundaries. The design needs explicit mapping between them rather than selecting one existing boundary universally. This finding does not prescribe an operation journal versus another representation and does not authorize runtime repair.
