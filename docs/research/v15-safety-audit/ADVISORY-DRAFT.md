# DRAFT — NOT PUBLISHED

Correctness advisory for `@signal-tree/kernel` 15.x. Wording is unreviewed and
nothing has been filed, deprecated or announced. See README.md in this
directory for the measurements this rests on.

---

## Summary

Recorded artifact probes reproduce both transaction rollback defects in
`@signal-tree/kernel` **15.0.0, 15.1.2, 15.1.4 and 15.2.1**. Defect 1 throws on
the first failed rollback, then silently reports success on retry without
reversing the surviving speculative state. Defect 2 silently produces incorrect
state in the measured overlapping-transaction cases.

## Affected scope and evidence limits

These two reproducers require the `transactions()` enhancer. The recorded
artifact checks cover the four exact versions above; a continuous affected
semver range, prereleases and a fixed release need artifact verification before
an advisory is published. See [recorded measurements](README.md).

Absence of `transactions()` excludes these two specific rollback paths; it is
not a general safety verdict for an application, version or the earlier
`@signaltree/core` packages. The September 23 source audit also found independent
serialization, link and lifecycle defects. Their affected published artifacts
and exposure are separate investigations.

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
    entity lifetime was replaced or modified by a later write.

## Mitigation without upgrading

1. **Keep at most one transaction outstanding at a time.** This avoids
   the measured overlapping-pending case, but does not establish rollback safety.
2. **Do not treat a rollback as authoritative.** After any rollback —
   successful or thrown — re-fetch authoritative state rather than trusting
   local compensation.
3. **Do not retry a failed rollback.** The retry will report success without
   reversing anything. Treat the first throw as terminal and re-fetch.
4. If neither is practical, **remove `transactions()`** and perform
   optimistic updates in application code, where the rollback rule is
   explicit and under your control.

## Fix status

**No fixed release is established by this evidence.** The earlier wording
“Fixed in 15.2.2” described an intended conservative patch as though it had
already shipped. That claim is withdrawn, not silently relabeled as complete.
The September 23 source audit at `7ade0e3e` still reproduced R6 lost settlement
authority and R8 overlapping-pending corruption. No new registry verification
was performed for this correction.

The intended safety requirement remains: a successful rollback compensates
fully; a refused rollback leaves state and pending settlement authority intact.
That requirement is not proof of an implementation or a published fix. The
same audit found refused compensation could release speculative outbound link
publication, so verification must cover publication as well as local state.

A patch version, affected range and advisory publication remain unresolved
until fixes pass the relevant composition regressions and exact published
artifacts are verified. The draft remains unpublished and release is held.

## Credit

Found by internal preregistered falsification testing (R6-LIVENESS-0,
R8-OVERLAP-0), then reproduced against published npm artifacts.
