# DRAFT — NOT PUBLISHED

Correctness advisory for `@signal-tree/kernel` 15.x. Wording is unreviewed and
nothing has been filed, deprecated or announced. See README.md in this
directory for the measurements this rests on.

---

## Summary

`@signal-tree/kernel` versions **15.0.0 through 15.2.1** contain two
correctness defects in transaction rollback. Both cause **silent incorrect
state with no thrown error**.

Applications are affected **only if they install the `transactions()`
enhancer**. Applications that do not use `transactions()` are unaffected, as
are all versions of the earlier `@signaltree/core` (v14 and below), which ship
no transactions enhancer at all.

## Affected

    @signal-tree/kernel   >=15.0.0 <=15.2.1     with transactions() installed

## Not affected

    @signal-tree/kernel   any version, without transactions()
    @signaltree/core      all versions (no transactions enhancer exists)

## Defect 1 — a failed rollback destroys its own settlement authority

When `rollback()` cannot complete its compensation, it throws — but the
pending turn has already been retired. The transaction's speculative writes
remain live, are absent from confirmed history, and can no longer be settled.

    pending turns before rollback     1
    rollback()                        throws
    pending turns after               0
    confirmed-turn delta              0
    speculative value                 still live
    rollback() again                  returns successfully, changes nothing

The second call reporting success is the dangerous part: code that retries
on failure will believe it recovered.

Reachable with ordinary writes. No internal or privileged API is required.

## Defect 2 — overlapping transactions corrupt each other

With two transactions outstanding that write the same location, rolling back
the OLDER one reverts that location to its own captured baseline, discarding
the newer transaction's value.

    base    x=0 y=0 z=0
    T1      x=1 y=1
    T2          y=2 z=2

    rollback(T1) then confirm(T2)    expected x=0 y=2 z=2, actual x=0 y=0 z=2
    rollback(T1) then rollback(T2)   expected x=0 y=0 z=0, actual x=0 y=1 z=0

In the first case a **confirmed** transaction silently loses a field. In the
second, both transactions are rolled back yet the location holds the value of
an already-rolled-back transaction.

Rolling back the NEWER transaction first behaves correctly, so the defect is
order-dependent and easy to miss in testing.

## Are you affected?

You are at risk if you install `transactions()` AND either:

  - more than one transaction can be outstanding at the same time, and they
    can touch the same location; or
  - you roll back a transaction containing a structural add/remove whose
    subject was re-created or modified by a later write.

## Mitigation without upgrading

1. **Keep at most one transaction outstanding at a time.** This avoids
   defect 2 entirely.
2. **Do not treat a rollback as authoritative.** After any rollback —
   successful or thrown — re-fetch authoritative state rather than trusting
   local compensation.
3. **Do not retry a failed rollback.** The retry will report success without
   reversing anything. Treat the first throw as terminal and re-fetch.
4. If neither is practical, **remove `transactions()`** and perform
   optimistic updates in application code, where the rollback rule is
   explicit and under your control.

## Fix status

Fixed in **15.2.2**. The patch makes transaction settlement safe rather than
more capable:

    if a rollback can be proven safe   it completes fully
    if it cannot                       NOTHING changes, the transaction
                                       stays pending, and a refusal is thrown

This is deliberately more conservative than 15.2.1 appeared to be. Rolling
back a transaction that overlaps a newer still-pending transaction now
REFUSES where it previously appeared to succeed and corrupted state. That is
the intended direction for a patch: behaviour that was unsafe becomes safely
rejected.

Both defects share one root cause — compensation is computed from a
per-transaction baseline captured against live state, with no record of which
transaction currently owns a value. A baseline is not ownership. Solving that
properly (surgical multi-owner settlement) is an architectural change and is
out of scope for a patch release; 15.2.2 makes the unsafe paths refuse
instead of corrupt.

## Credit

Found by internal preregistered falsification testing (R6-LIVENESS-0,
R8-OVERLAP-0), then reproduced against published npm artifacts.
