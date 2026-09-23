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

**L9 — settlement is atomic over the DISPOSITION of every contribution.**
Not "every effect must win". Every contribution in the unit must end in a
defined state:

    committed / current
    superseded / non-effective
    rejected / removed
    conflicted / refused

The operation may not leave any contribution with no owner or an unresolved
settlement status.

The earlier wording ("a mixed transaction cannot become partly settled") was
wrong: it outlawed behaviour already decided to be correct.

    P1 proposes   name = Agent, priority = 3
    later truth   name = Server
    accept P1     name stays Server, priority = 3

That is a COMPLETE settlement in which one contribution was already
superseded. L9 forbids R6-style orphaning without forbidding this.

**L10 — observation agrees with settlement.**
If `inspect()` reports a contribution as current, superseded or conflicted,
settlement must behave consistently with that classification. No
"inspect says superseded, reject corrupts or refuses for an unrelated
reason" without an honest additional status. This law is what makes a review
UI truthful, so it is load-bearing for the product thesis.

**L11 — authoritative truth advances the canonical frontier; superseding a
pending contribution requires an established relation.**
Authoritative truth at a semantic location advances the CANONICAL FRONTIER. It
supersedes a pending contribution only when the ingress contract or supplied
authority evidence establishes that the authoritative truth is subsequent to,
incorporates, or disposes that contribution.

Advancing canonical truth does NOT inherently remove the pending overlay:

    server canonical rev10   y=0
    P1 local pending         y=1
    refetch: authoritative snapshot y=0, "this is current server truth"

    canonical advances. P1 is NOT superseded — the server has simply never
    seen it. Visible projection stays y=1, and review reports P1 as pending
    relative to the NEW canonical base.

Reading "an authoritative snapshot arrived" as "every older pending
contribution is superseded" recreates the reconciliation bug this work exists
to eliminate. Three orders stay separate:

    1 CONTRIBUTION ORDER   P1 authored before P2
    2 AUTHORITY ORDER      server rev10 before rev11
    3 SETTLEMENT RELATION  the authoritative truth explicitly accepts,
                           rejects, incorporates, or is known to follow P1

A snapshot establishes 2. It does NOT automatically establish 3. A correlated
ack does. A watermark of the form "this state includes all writes through X"
does. A snapshot fetched after a known-completed mutation does, if the ingress
contract says so. "This is current server state" alone proves nothing about
the disposition of a local pending contribution.

                    CANONICAL FRONTIER
                   server / current truth
                            |
                  pending contributions
                            |
                            v
                    visible projection

    canonical rev0   y=0
    P1 seq1          y=1  pending
    P2 seq2          y=2  pending
    committed seq3   y=3

Visible truth is 3. Both P1 and P2 are superseded for that location, and
accepting either later cannot resurrect 1 or 2.

This is a separate law from L6 on purpose. L6 alone yields a resolver that
orders P1 against P2 correctly and still gets SERVER REALIZATION wrong, which
is the ordinary case, not the exotic one.

**L12 — authority order is explicit, never inferred from arrival.**
The kernel never infers authority order from arrival order. Authority order
comes from the semantic contract of the INGRESS OPERATION, or from explicit
authority evidence.

That distinction keeps "no revision number" from meaning "SignalTree can never
consume an ordinary REST snapshot". What the caller claims is what counts:

    AUTHORITATIVE SNAPSHOT   "this is current server truth now"
                             caller asserts freshness; the canonical frontier
                             may advance
    VERSIONED EVENT          "this happened at server revision 42"
                             order by the supplied evidence
    CORRELATED ACK           "this is the disposition of contribution P1"
                             the relation to P1 is explicit
    UNORDERED EXTERNAL EVENT "here is a value, I cannot tell you how it
                             relates to pending work"
                             do NOT invent causal or authority ordering

    server canonical rev10   y=0
    request A sent
    P1 local seq1            y=1
    P2 local seq2            y=2      <- newer local intent
    STALE response to A      rev11    y=1

Treating "the realization arrived later" as "the frontier advanced past P2"
is a temporal heuristic, and rebuilds exactly the invented distributed
causality this project has refused everywhere else. There are two distinct
orders — local contribution order and authoritative revision order — plus
possibly a correlation between them. Absent evidence, the answer is UNKNOWN or
conflict, never an inferred ordering.

L11 is constrained by this law: "later committed/realized" means later in
AUTHORITY order, not later in wall-clock arrival.

**L13 — settlement publishes only coherent truth.**
Accept, reject, realization and failed settlement must not expose transient
states that violate the semantic unit being settled. A settlement that lands
on the correct final value having published an impossible half-state on the
way has still broken the law, because application effects have already reacted
to it.

Final-state assertions cannot see this, so the adapter records observer
snapshots, not only final reads.

**L14 — settlement has explicit terminality.**
A successful settlement is terminal: a subsequent settlement attempt cannot
mutate state. A failed settlement that preserves pending authority is either
explicitly retryable or explicitly non-retryable, and may NEVER masquerade as
a successful terminal settlement.

Whether a second successful call is a no-op or raises AlreadySettled is not
decided here. It must be DEFINED and non-mutating. R6 is the counterexample:
a failed rollback whose retry returned success while reversing nothing.

**L15 — correctness retention follows live responsibility.**
State retained for CORRECTNESS exists only while a live semantic obligation
requires it. Terminal transaction state may not remain in the active
correctness machinery for diagnostic purposes. Historical evidence is a
separate, explicitly bounded facility.

    pending contribution                  may retain correctness state
    accepted/rejected/superseded terminal correctness state RELEASED
    optional audit/history                separate store, explicit policy

Without this law we could repair R8 and keep an unbounded-retention
architecture. (Retention probes reporting large turn accumulation exist from
another session and have NOT been re-run here; the law stands on its own
merits and R01..R06 will measure it directly.)

**L16 — independent work makes independent progress.**
A pending contribution may delay work only where an ACTUAL semantic
dependency requires it. Unrelated state stays readable, writable, publishable
and synchronizable.

    P1 pending on  order.123.priority
    must not freeze telemetry.connected or settings.theme

This law exists because a future "contribution graph" could otherwise become
a global lock, satisfy every settlement test, and make the product unusable.

**L17 — semantic identity is lossless.**
Every semantic identity component stays typed and structurally distinct across
every correctness boundary. Human-readable paths are PRESENTATION, never
authoritative identity. Covers TreeId, PositionId, SubjectId, business key and
key type.

L7 says a business key is not a subject lifetime. L17 is what stops
`"foo.bar"`, `"foo/bar"`, `1` and `"1"` being flattened into ambiguous
path or global-key strings. It applies to EVERY candidate: the `1` vs `"1"`
collision is the same architectural smell in any encoding.

**L18 — deferral cannot change semantic classification.**
A write's semantic classification may not change because its physical
execution was deferred. A system either carries the semantic context with the
queued operation, or REJECTS the composition before scheduling it.

    external(() => write)
    coalesce(() => external(() => write))      must not differ in category

An architecture is free to declare a composition unsupported. It must say so
BEFORE quietly reclassifying the mutation.

## The constitution, grouped

    OWNERSHIP
      L1   a visible speculative fact has an owner
      L2   settlement authority is conserved
      L3   rejection removes a contribution, not a baseline value

    PRECEDENCE
      L4   later surviving truth is inviolate
      L5   rejected truth cannot resurrect
      L6   settlement time does not reorder authorship
      L11  a committed frontier supersedes older contributions
      L12  arrival order is not authority order

    IDENTITY / DEPENDENCY
      L7   subject lifetime is not the business key
      L8   structural dependencies survive honestly

    IDENTITY / DEPENDENCY (cont.)
      L17  semantic identity is lossless and typed

    SETTLEMENT
      L9   atomic disposition of every contribution
      L10  observation agrees with settlement
      L13  publication is coherent
      L14  settlement terminality and retry are explicit

    SYSTEM COMPOSITION
      L15  correctness retention follows live responsibility
      L16  independent work makes independent progress
      L18  deferral cannot alter semantic classification

**L1..L18 are FROZEN as of 2026-09-23.** No further laws are added
speculatively. Past this point more whiteboarding is its own form of
overfitting; the tests produce the evidence now.

## Dependency is not coexistence

The trichotomy below is not provable by a suite that only ever touches a
subject one way. A candidate can pass by swapping one presence test for
another unless the matrix contains a pair where the SAME subject is touched
twice and only one touch is genuinely dependent. See T02a / T06a / T06b in
MATRIX.md.

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
