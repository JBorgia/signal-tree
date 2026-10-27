# Fixed possible-owner window: prewritten native contract tests

Status: draft specification/tests only; **not executed, typechecked or accepted**.
No runtime implementation is authorized by this document.

## Identity and authority

- Frozen runtime: `/private/tmp/link-evidence-scope-successor`,
  `2dacae7b9e9137018d05c4e00382ac9287bc76d4`.
- Specification source: readiness
  `75c645eb71e4a03e5c84491ce8078debfe797e19`,
  `docs/audits/2026-10-17-incumbent-readiness/link-membership-observation-design/AUTHORITY.md`
  and `POLICY-DECISION.md`.
- Draft: `possible-owner-window-contract.spec.ts` in this directory. Import paths
  are written for eventual placement in `packages/kernel/src/lib`; the draft is
  intentionally not runnable from this evidence directory without relocation.
- The frozen runtime checkout remains unchanged. No runtime, existing tests,
  controller, API export or budget was edited. B remains closed.

The owner selected a fixed possible-owner window for unobserved undeclared
inputs. This is conservative uncertainty, not proof of causal dependence. The
window contains instrumented owners pending **at authorship**, independently of
when notification, recipient preparation or delivery later occurs. A later
foreign owner cannot prolong it. Current target-local ordinary gates and real
native dependencies remain independent constraints.

## Finite expected outcomes, written before execution

There are **17 concrete cases**: the first row expands to three; the other
fourteen rows are individual tests. All use existing public source/transaction/
Link APIs, with the existing local experimental declaration cast. The only
private utilities are the established notifier drain and inspection context.
No new observation port or diagnostic API is assumed.

| Case | Setup and discriminator | Required useful outcome |
| --- | --- | --- |
| Literal / direct copy / hidden-input updater (3) | Foreign p is pending; author y7; synchronously open foreign q before any await/flush | Nothing sends before p terminality. After p confirms, send7 and settle the waiter while q remains pending/inspectable. All three expression forms receive the same unknown-origin policy. |
| Empty authored window | Author y7 with no pending owner; queue notification; open foreign q before the delivery promise runs | Send7 despite q; never capture q retroactively. |
| Several captured owners | p and r pending before y7; foreign q admitted afterward | p confirmation alone does not release; r confirmation sends7 with q still pending. |
| Rejected source, surviving target | Copy p's speculative7 ordinarily into another tree; admit late q; reject p | Source restores0; target ordinary7 survives; fresh ordinary reevaluation sends7 despite q. This is surviving-write semantics, not proof confirmation. |
| Rejected target, changed aggregate | Target p authors y7; an ordinary independent z8 survives; root Link is held | Reject p; emit exactly `{x:0,y:0,z:8}`, never the captured y7 aggregate. Surviving z8 makes this a required useful send, not redundant endpoint synchronization. |
| Inspection overlay | Ordinary y7 is held by foreign p; inspection displays99 | p confirmation sends ordinary7 and leaves physical display99; inspection must neither replace the window nor leak99. |
| Replacement window | y7 captures p; q opens; ordinary y8 replaces it | p confirmation cannot release8; q confirmation emits only8. An earlier grant cannot transfer to the replacement. |
| Qualified independent replacement | Unknown y7 is held by p; q opens; complete independent declaration authors y8 | Emit8 immediately with a started/declared receipt. Settling p/q does not revive7 or mutate the terminal receipt. |
| Qualified dependent publication | p and unrelated foreign q already pending; declare complete dependency on p and copy its7 | Hold until p confirms, then send7/declared while q stays pending. Do not inherit an unknown-origin all-owner window. |
| Endpoint reentry | y7 captures p; q admitted later; sending7 synchronously authors ordinary y8 | p confirmation sends7; reentrant8 captures q and stays held; q confirmation sends8. Endpoint order is `[7,8]`. |
| In-flight serialization | Send1 starts and waits externally; y7 captures newly pending p; foreign q opens later | p confirmation makes7 eligible but cannot race the started1. Acknowledging1 sends7 despite q. |
| Held disposal | y7 held by p; settled waiter outstanding | Dispose resolves local waiter; later p confirmation cannot send7. |
| In-flight disposal | Send1 started; y7 held/queued; settled waiter outstanding | Dispose resolves local waiter before external1 finishes. Its completion is permitted; queued7 never starts, even after p confirmation. |
| Unresolved source destruction | y7 captures pending p; source destroyed without authentic confirmation/rejection | No send and no false successful settlement from registry disappearance. Explicit connection disposal resolves the local waiter. |
| Target-local late gate | y7 captures foreign p; then target-local q authors unrelated z9 | p confirmation alone still cannot send; q confirmation releases7. Fixed foreign window does not abolish target-local ordinary gating. |

## Assertions and fixture discipline

- Each successful progress assertion checks the actual endpoint payload sequence,
  then awaits `settled()`. Holds also assert visible values; key p/q cases retain
  `inspect()` snapshots to establish that progress did not silently settle or
  alter pending transactions.
- `inspect()` snapshots are compared only when the transaction's own authored
  source facts have not been superseded. The draft does not repeat the earlier
  invalid exact-inspection assertion after an independent overwrite.
- Every tree and connection is disposed in `finally`. External deferred sends
  are also resolved there. An assertion failure cannot leave the test's unresolved
  promise retaining a tree across later cases.
- Owners q used to distinguish late admission are on a **foreign tree**. The
  explicit final control preserves the existing local-tree gate.
- Plain `target(old => source.x())` is deliberately treated as an unobserved
  hidden input. Certification of `old` cannot certify that separate read.
- Endpoint callbacks and pending owners are constructed directly; no timers,
  random scheduling, repeated sampling or new runtime hooks are used. Forty-eight
  promise drains match existing experimental fixtures; this is test scheduling,
  not a performance measurement.
- Expected positive receipt fields use the existing `started`/`declared` schema.
  Ordinary writes have no public receipt. Their payload tests do **not** claim to
  prove a private surviving-ticket identity or absence of retained wait edges.

## Risks to check before running

1. Existing `link-async-settlement.spec.ts` intentionally suppresses a duplicate
   restored value already delivered to the endpoint. Do not reinterpret such a
   no-op as missing reevaluation. The aggregate rejection fixture avoids this by
   retaining a new independent z8 that requires delivery.
2. The inspection fixture relies on the already-authorized split between
   displayed99 and ordinary7. It must not be silently changed to a normal write
   merely to simplify the window test.
3. Source destruction is distinct from connection disposal. If a helper
   implicitly rolls back or confirms on destroy, inspect its actual lifecycle
   before treating the expected hold as correct. The selected policy explicitly
   distinguishes unresolved/unavailable destruction from authentic settlement.
4. The full `Receipt.read()` terminal comparison deliberately tests immutability.
   If a delivery-only nonterminal diagnostic is documented, adjudicate that
   specific field rather than weakening terminal state or payload assertions.
5. Relative imports and generic root source typing need the ordinary spec-types
   check after an authorized copy. No compile or pass claim is made here.
6. Pending-owner capture must happen during authorship, not the test drain. The
   synchronous p/write/q cases are designed to fail any delayed reconstruction.
7. The fixed-window controls establish observable lifecycle behavior, not
   retained-memory bounds. Index size, terminal edge retirement, retained receipts
   and full lifecycle collectibility still need their own qualified controls.
8. These scalar/aggregate cases do not substitute for the preserved membership,
   same-key lifetime, native-input certificate, enrollment-invariance, ABA,
   contradictory-declaration or mixed-undo regressions. Those remain unchanged.

## Execution boundary

No tests have run. The parent may copy this draft into a separately authorized
candidate and first preserve its original source/hash and raw first results. Do
not overwrite rejected `2dacae7b` or revise an oracle from the candidate's behavior.
Any necessary oracle correction needs its governing contract and original result
preserved. This finite plan does not reopen the stopped runtime successor.

## Certified uncertainty propagation (two added cases before execution)

A source literal7 authored while foreign p is pending carries possible-window[p].
Open q later, then consume that value through the native scalar updater argument.
A complete independent declaration is not contradicted solely by possible p, but
cannot erase the input uncertainty. It stays held until p confirms, then usefully
sends7 under fresh surviving basis while q remains pending. An undeclared consuming
write additionally acquires its own p/q window and remains held until q confirms.
Neither path modifies the original source window. This follows AUTHORITY and
POLICY-DECISION at75c645eb: input uncertainty is neither known causation nor recipient
uncertainty, and qualified declarations cannot supply missing native evidence.
There are now19 cases; FIRST preserves the original17 and their raw results.

Review refinement before the final baseline: the propagation cases use the existing
same-source scalar derive input y(old=>old+1), from7 to8, rather than assuming its
argument scopes a nested different-source write. Unknown input receipts retain the
existing conservative/unknown classification until fresh started/surviving evaluation.
REVISED/sources preserves the former draft; final useful payload is8.
