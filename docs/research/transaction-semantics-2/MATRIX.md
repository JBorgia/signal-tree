# TRANSACTION-SEMANTICS-2 — adversarial conformance matrix

Preregistered before any prototype runs. Expected states are recorded per case
in the contract module before execution.

## The adapter is SEMANTIC, not API-shaped

The contract module must not assume a candidate exposes
`transaction()` / `confirm()` / `rollback()`. An MVCC/draft candidate
naturally exposes `draft()` / `merge()` / `discard()`; a contribution-layer
candidate exposes something else again. Binding the harness to today's method
names would privilege the current architecture and quietly decide the
competition.

The adapter expresses semantic operations only:

    beginContribution(...)      open a speculative unit
    settleAccept(...)           make its surviving contributions current
    settleReject(...)           remove its contributions
    readVisible(...)            resolved visible truth
    readSettlementState(...)    disposition of each contribution + ownership

Each candidate maps its own mechanism onto that contract.

The suite is BLACK-BOX. It observes only: state before, the operations, state
after, pending/confirmed status, and errors raised. It must know nothing about
`classifyLaterOverlap`, `hasSameSubjectDependency`, compensation, layers,
MVCC or TurnStore — those are implementation choices. It must survive a total
rewrite of `transactions.ts` and run unmodified against every candidate.

Assert semantics, never internal shape:

    NOT   expect(subjectId).toBe(4)
    NOT   expect(transactionId 17).toBeInTheMap()
    YES   a held reference to the old lifetime does not retarget
    YES   a failed rollback retains settlement authority

## Scalar ownership

    S01  one pending writer
    S02  pending + later ordinary write
    S03  two pending, same location
    S04  THREE pending, same location
    S05  reject oldest                                    <- R8/A
    S06  reject middle
    S07  reject newest                                    <- R8/C control
    S08  accept oldest
    S09  accept middle
    S10  accept newest
    S11  every two-writer accept/reject permutation       <- R8/A..H
    S12  every three-writer removal ordering
    S13  pending -> committed newer -> settle older
    S14  committed newer -> pending older settlement

THREE writers is required. A two-layer algorithm can pass every two-writer
case and still be conceptually wrong; S04/S12 are what catch that.

## Structural lifetime — where candidates live or die

    T01  pending add -> reject
    T02  pending add -> later field write                 DEPENDENCY
    T03  pending add -> later remove                      SUPERSESSION
    T04  pending add -> later remove/re-add same key
    T05  pending remove -> later same-key NEW subject     <- R6
    T06  pending rekey -> later field write               INDEPENDENCE
    T07  pending rekey -> later remove
    T08  pending rekey -> later re-add at destination
    T09  two pending adds/rekeys touching same topology
    T10  three pending structural writers
    T11  held ref across remove/re-add                    L7
    T12  dependent field write on pending-created subject L8
    T13  server realization against pending-created subject
    T14  mixed structural + scalar transaction            L9

### Dependency vs coexistence — the discriminating triple

T02/T03/T06 alone do not prove a candidate can RECOGNISE dependency; they can
be passed by replacing one presence test with another. These three must be
distinguished from each other:

    T02a  P1 adds A(S1); later writes A(S1).name; reject P1
          DEPENDENCY  — the later fact requires S1 to exist, so existence
                        cannot simply be removed

    T06a  P1 rekeys A(S1) -> B; later writes A(S1).name; reject P1
          INDEPENDENCE — a key change and a field change do not contend:
                        reverse the key, preserve the name

    T06b  P1 rekeys A(S1) -> B; later creates something whose identity or
          relationship REQUIRES key B; reject P1
          DEPENDENCY  — a real rekey dependency

T06b is the case that matters most. Without it, "rekey + later field write"
proves independence but the suite never proves it can recognise a genuine
rekey dependency — so a candidate that calls every rekey independent passes.

### Committed-frontier precedence (L11)

    T15  canonical y=0; P1 seq1 y=1 pending; P2 seq2 y=2 pending;
         committed/realized seq3 y=3
         visible is 3; accepting P1 or P2 later cannot resurrect 1 or 2
    T16  same, with the committed write landing between the two proposals
    T17  committed frontier advances a STRUCTURAL location while a pending
         structural contribution targets it

## Composition

The 2359 currently-green kernel tests are evidence that isolated correctness
is insufficient: not one of them exercises two overlapping pending
transactions, which is why R8 shipped from 15.0.0. Every case above runs
under:

    transactions
    transactions x entityMap
    transactions x link
    transactions x batching
    transactions x restoration
    transactions x entityMap x link
    transactions x batching x external
    transactions x restoration x link
    transactions x entityMap x link x batching

The last is the system developers actually run.

## Identity

Semantic identity may never be ambiguous string flattening. Every keyed case
additionally runs with:

    "a.b"      "a/b"      "a::b"
    "jo.doe@example.com"
    "1.2.3"
    1          "1"          <- different keys, must NOT collide
    same business key, different subject lifetime

Expected semantics must hold regardless of any delimiter chosen internally.
This is deliberately designed to force structured identity rather than another
escaping scheme.

## Context propagation

Written BEFORE deciding how `coalesce()` should behave, so the answer comes
from results:

    external(() => write)
    coalesce(() => external(() => write))
    undoable(() => write)
    coalesce(() => undoable(() => write))
    transaction(() => coalesce(write))
    coalesce(() => transaction(write))

The tests state the semantic expectation. Whether the remedy is "queued
mutation carries the context captured when it was queued" or "coalesce refuses
certain compositions" is then a finding, not a premise.

## Settlement failure

    F1  compensation validation fails
    F2  structural destination occupied                   <- R6
    F3  subject no longer exists
    F4  later PENDING dependency
    F5  later CONFIRMED dependency

For every F case: state unchanged, pending authority retained, no confirmed
record created, retry semantics explicit.
