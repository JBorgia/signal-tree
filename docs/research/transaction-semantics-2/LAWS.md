# TRANSACTION-SEMANTICS-2 — the authoritative laws

Frozen 2026-09-23, before any implementation change. Supersedes
`../transaction-semantics-1/LAWS.md`, which is kept as the historical record.

## Why there is a SEMANTICS-2

SEMANTICS-1 was written, and a contribution-layer model was then claimed to
satisfy the whole R8 matrix "by construction". It does not. The claim checked
final states and skipped the projection rule.

    canonical y=0 ; P1(seq 1) -> y=1 ; P2(seq 2) -> y=2

    accept P2    canonical y=2, layers{P1->y=1}
                 naive projection shows the topmost surviving layer -> y=1   WRONG
    accept P1    canonical y=1
                 final y=1, expected y=2                                     WRONG

Case B hides the same flaw one step earlier: after `accept P2` a naive
projection shows y=1 while P1 is still pending, yet B's FINAL state is
correct, which is how the error survived review.

The missing rule is Law 6. The whiteboard was 6/8 with two silent bad
intermediates, not 8/8. This is the argument for specifying before coding,
and it cost nothing because no code had been written.

## The laws

**L1 — every visible speculative fact has an owner.**
At all times a visible fact is owned by a pending contribution, or is
committed/current truth. Never visible with no pending owner and no confirmed
owner. R6 violates this in every published 15.x.

**L2 — settlement authority is conserved.**
A pending transaction leaves the pending state only after a CONFIRM that
succeeded or a ROLLBACK that completely succeeded. Failure means it remains
settleable.

**L3 — reject removes a contribution; it does not restore an old value.**
Never specify "rollback P1 writes P1.before". Specify "remove P1's
contribution, then resolve what should now be visible from surviving truth."
This is the root law. A baseline records what a location held when a turn
wrote it, never who owns it now.

**L4 — later surviving truth is inviolate.**
base 0, P1 1, P2 2; reject P1 leaves 2.

**L5 — rejected truth cannot resurrect.**
reject P1 then reject P2 cannot expose P1's value again.

**L6 — confirmation does not reorder history.**
A contribution takes precedence by when it was AUTHORED. Settlement changes
its status, not its causal order. `accept P2` then `accept P1` must not make
P1 newer than P2. Settlement time is not contribution order.

**L7 — subject lifetime is not the business key.**
A(S1) removed, A(S2) added at the same key: no operation concerning S1 may
mutate S2 unless explicitly defined to.

**L8 — structural dependencies survive honestly.**
If P1 creates S1 and later truth modifies S1, rejecting P1 must either
preserve all dependent truth correctly, or refuse while changing nothing. It
may not erase the dependency or half-settle.

**L9 — one semantic unit settles atomically.**
A mixed transaction (scalar, scalar, rekey, field update) cannot become
partly settled.

**L10 — observation agrees with settlement.**
If `inspect()` reports a contribution as current, superseded or conflicted,
settlement must behave consistently with that classification. No
"inspect says superseded, reject corrupts or refuses for an unrelated
reason" without an honest additional status. This law is what makes a review
UI truthful, so it is load-bearing for the product thesis.

## The trichotomy that survives every architecture

Contribution layers do NOT eliminate dependency semantics. They relocate them
to where they belong. Any candidate must still distinguish:

    SUPERSESSION    later truth REPLACED this contribution
    DEPENDENCY      later truth REQUIRES this contribution to exist
    INDEPENDENCE    later truth touches the same subject but requires
                    nothing from this contribution

Today's `hasSameSubjectDependency` collapses DEPENDENCY and INDEPENDENCE into
"same subject present, refuse" — by its own admission a presence test wearing
a dependency name.

For structural state the modelled objects are therefore not just
`Position -> Value` but:

    subject lifetime
    key occupancy
    membership
    rekey mapping
    field contribution
    existence dependency

## Working hypothesis (to be killed by tests, not installed by decree)

                    COMMITTED FRONTIER
                 value + structural truth
                            |
         +------------------+------------------+
         |                  |                  |
     contribution      contribution       realization
       owner P1          owner P2          committed
         |                  |                  |
         +------------------+------------------+
                            |
                       RESOLUTION
                            |
                            v
                      VISIBLE TRUTH

Each contribution carries: owner, sequence, position, subject, operation,
status, dependencies. **Settlement changes ownership and status; it does not
perform historical-value compensation.**

For scalars this looks like layers. For entity topology it becomes a small
dependency/frontier model. It would reuse PositionId, SubjectId,
StructuralStore, mutation frames and prepared realization rather than
replacing the kernel. That is a hypothesis. The tests get to kill it.

## Discipline

    FAILURES -> LAWS -> TESTS -> MUTATION-TEST THE TESTS ->
    COMPETING ARCHITECTURES -> WINNER -> PRODUCTION IMPLEMENTATION ->
    COMPOSITION TESTS -> TARBALL TESTS -> RELEASE

Not: bug -> fix -> test -> next bug. That is the loop that produced this.

The R6 ordering fix ("do not retire authority before successful settlement")
is a universal invariant and is almost certainly true. It is still NOT kept in
production, and must not become an anchor: the winning architecture may make
the entire compensation pathway disappear. Its test is kept permanently; its
implementation lives only as a research candidate.
