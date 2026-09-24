# Correctness advisory — transaction rollback, `@signal-tree/kernel` 15.0.0–15.2.1

**Status: FIXED in 15.3.0.** Upgrade is the whole mitigation.

Three defects in `rollback()`. All three cause **silent incorrect state with no
thrown error**, or a thrown error that leaves the transaction unrecoverable.

Affected **only if you install the `transactions()` enhancer**.

    AFFECTED      @signal-tree/kernel  >=15.0.0 <=15.2.1   with transactions()
    NOT AFFECTED  @signal-tree/kernel  any version, without transactions()
    NOT AFFECTED  @signaltree/core     all versions — no transactions enhancer exists
    FIXED         @signal-tree/kernel  15.3.0

The first two were reproduced against tarballs installed from the npm registry
— 15.0.0, 15.1.2, 15.1.4 and 15.2.1, identical measurements on all four. The
evidence and the probe are in [`../research/v15-safety-audit/`](../research/v15-safety-audit/).

## Defect 1 — a failed rollback destroyed its own settlement authority

`rollback()` retired the pending turn *before* attempting compensation, so a
refusal threw from a transaction that had already given up its settlement
authority while its writes were still live.

    pending turns before      1
    rollback()                throws
    pending turns after       0        <- retired anyway
    confirmed-turn delta      0        <- and not committed
    speculative value         still live
    rollback() again          returns SUCCESSFULLY, changes nothing

The retry reporting success is the dangerous part: code that retries on failure
believed it had recovered. Discarding also discharged the retention obligation,
so a *failed* rollback evicted a confirmed turn it was still responsible for.

Reachable with ordinary writes. No internal or privileged API required.

## Defect 2 — overlapping transactions corrupted each other

With two transactions outstanding over the same location, rolling back the
**older** one reverted that location to its own captured baseline, discarding
the newer transaction's value.

    base    x=0 y=0 z=0
    T1      x=1 y=1
    T2          y=2 z=2

    rollback(T1) then confirm(T2)    expected x=0 y=2 z=2   actual x=0 y=0 z=2
    rollback(T1) then rollback(T2)   expected x=0 y=0 z=0   actual x=0 y=1 z=0

In the first case a **confirmed** transaction silently lost a field. In the
second, both were rolled back yet the location held the value of an
already-rolled-back transaction.

Rolling back the **newer** transaction first behaved correctly, so the defect
was order-dependent and easy to miss in testing.

## Defect 3 — a rollback made every earlier transaction unreversible

The dependency ledger admitted every realized write, including a rollback's own
restore half, so one completed rollback recorded a false dependency against
every earlier open transaction and none of them could be reversed again.

Found while fixing the first two, so it was never measured against a published
tarball; it is present in the same versions by inspection.

## What 15.3.0 changes

A rollback that cannot be proven safe now **refuses without changing anything**
and leaves the transaction **pending**, so `confirm()` and a retried
`rollback()` both remain available. Rolling back an older transaction while a
newer overlapping one is open refuses with
`cause.kind === 'later-pending-dependency'` rather than corrupting it.

This is deliberately *less* permissive than 15.2.1 appeared to be. Unsafe
became safely rejected. Surgical multi-writer settlement is the 16.0 ownership
model, not a patch to this line.

### Migration

Catch the refusal and settle the transaction yourself — it is still pending.
Code that rolled back an older transaction while a newer one was open was
getting a corrupt result and now gets an error instead.

## If you cannot upgrade

1. **Keep at most one transaction outstanding at a time.** Avoids defect 2.
2. **Do not treat a rollback as authoritative.** Re-fetch authoritative state
   rather than trusting local compensation.
3. **Do not retry a failed rollback.** On affected versions the retry reports
   success without reversing anything. Treat the first throw as terminal.
4. Otherwise **remove `transactions()`** and do optimistic updates in
   application code, where the rollback rule is explicit and yours.

## Root cause

All three share one: compensation was computed from a per-transaction baseline
captured against live state, with no record of which transaction currently owns
a value. **A baseline is not ownership.** 15.3.0 contains that within a refusal;
16.0 replaces the model.

## Credit

Found by internal preregistered falsification testing (R6-LIVENESS-0,
R8-OVERLAP-0), then reproduced against published npm artifacts.
