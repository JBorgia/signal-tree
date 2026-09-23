# TRANSACTION-SEMANTICS-1 — the laws

Frozen 2026-09-23, BEFORE any implementation change. Derived from the
behaviour we want, not from the defects we know how to make green.

The R6 and R8 failures, and their reproduction against the published
15.0.0..15.2.1 artifacts, are EVIDENCE. They are not this specification. A law
below that no current defect exercises is still a law.

Rule for the whole program: **no implementation change until the conformance
matrix exists AND has survived mutation testing.** Tests first, architecture
second, code third.

---

## Law 1 — settlement authority cannot disappear

A pending transaction leaves the pending state only by

    confirm  succeeds        its contribution becomes committed
    rollback succeeds        its contribution is completely removed

If a rollback cannot complete, the transaction REMAINS PENDING and retains
settlement authority. A later retry, or a later confirm, must still operate on
the same transaction.

Forbidden:

    pending = false
    confirmed = false
    its speculative contribution still visible

## Law 2 — rollback removes a CONTRIBUTION, not a historical value

Wrong model:

    T1 remembers y=0 ; rollback(T1) -> write y=0

The semantic question is:

    what visible contribution belongs to T1 right now?
    what becomes visible when T1's contribution is removed?

A captured before-value records what a location held when a turn wrote it. It
does not record who owns that location now. **A baseline is not ownership.**
This law is implementation-blind: layering, ownership records, MVCC or
something else may satisfy it.

## Law 3 — later truth cannot be destroyed

    base y=0 ; T1 y=1 ; T2 y=2

`rollback(T1)` must never produce `y=0` while T2 is still live. Nor may
settling T2 afterwards lose a contribution T2 itself made.

## Law 4 — rejected truth cannot resurrect

    T1 y=1 ; T2 y=2 ; reject T1 ; reject T2   =>   y=0, never y=1

## Law 5 — settlement is order-consistent

Where operations are semantically independent, settling them in different
orders converges to the same result. Commutativity is preregistered per case
rather than assumed globally.

## Law 6 — structural identity is lifetime-based, not key-based

    A(S1) removed ; A(S2) later appears

S2 is never mistaken for S1 because the business key matches. A held reference
to a retired lifetime must not retarget onto a new one.

## Law 7 — no partial settlement

A transaction is one semantic unit. A failed rollback may not revert some of
its effects and abandon others. Partial settlement is forbidden unless the
public model explicitly exposes it, which it does not.

## Law 8 — current state and the ledger must agree

Every visible speculative contribution is

    owned by a pending transaction
    or committed/confirmed
    or realized/current external truth

never

    visible but owned by nothing

Law 8 alone would have caught R6 at the moment it was introduced.

---

## Test design constraints

### Black-box conformance is authoritative

The conformance suite observes only public behaviour: state before, the
operations, state after, pending/confirmed status, and errors raised. It must
survive a complete rewrite of `transactions.ts`, and must be runnable against
a competing prototype without modification.

Do not assert internal shapes.

    NOT   expect(subjectId).toBe(4)
    NOT   expect(transactionId 17).toBeInTheMap()

    YES   a held reference to the old lifetime does not retarget
    YES   a failed rollback retains settlement authority

Subject identity is asserted only where subject identity IS the public
semantic under test (Law 6).

### White-box invariants come LATER

Structural guards — no authority retired before settlement commits, no
string-path identity joins, no unbounded retention, no baseline compensation
without an ownership check — protect the winning implementation AFTER the
architecture is chosen. Writing them now would encode today's implementation
into tomorrow's tests.

### The suite is judged by mutation, not by being green

Once written, the suite is attacked. Every mutation below must turn at least
one test red. A surviving mutation means the suite is too weak, and the suite
is fixed before any production code is touched.

    A  retire the pending turn before compensation completes
    B  roll back to the captured before-value unconditionally
    C  ignore a later pending owner of the same location
    D  treat the same business key as the same subject lifetime
    E  skip one effect during settlement
    F  flatten typed identity to a string

---

## Architecture competition

Prototypes are built against this same suite, with no production integration:

    A  current compensation model
    B  contribution / ownership layers
    C  isolated draft / MVCC
    D  hybrid layered canonical state
    N  null -- no transaction subsystem

**Kill rule.** If the current compensation model needs increasingly complex
exceptions to satisfy the laws while a contribution-layer model satisfies them
naturally, the model is replaced rather than patched.

## Note on v15 and SemVer

A conservative refusal patch is no longer assumed to be the answer for 15.2.2.
It may turn out to be the right safe behaviour, but it has to be EARNED from
this suite.

Patch-level SemVer constrains the PUBLIC CONTRACT, not the number of internal
lines rewritten. Replacing the internals of rollback with an ownership-aware
mechanism while keeping the v15 public API intact is acceptable. Rewriting 500
internal lines once around a proved invariant is preferred over five 20-line
guards and a sixth hole next week.

## Sequence

    1. freeze published v15 failure fixtures        DONE (branch hotfix/15.2.2)
    2. write the semantic laws                      THIS DOCUMENT
    3. write the adversarial conformance matrix
    4. mutation-test the tests
    5. prototype competing architectures
    6. select the simplest that satisfies the laws
    7. port it into the v15 branch
    8. run the full composition matrix
    9. build the npm tarball
   10. run the same suite against the tarball
   11. release

No implementation change before step 4.
