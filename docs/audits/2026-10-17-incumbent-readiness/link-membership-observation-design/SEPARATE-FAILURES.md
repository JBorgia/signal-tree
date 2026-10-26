# Separate causal accounting

Read-only trace at rejected2dacae7b9e9137018d05c4e00382ac9287bc76d4. No tests were
rerun and no runtime changed. Execution evidence is the preserved composition
and root/predecessor runs in the previous successor archive. These findings are
not explained away by adding absence to input capture.

## Registration collisions: exclusive instrumentation port

intrinsic-mutation.ts337–349 admits exactly one membership preparer and rejects
any subsequent registration. private.ts285 now registers native preparation at
module evaluation; it no longer waits for a recipient and unregisters when the
last recipient is disposed. ordinary-member-publication-facts.spec.ts14,28,42
uses the same private registration port to observe prepared ordinary payloads or
inject a preparation failure. All three now stop at the duplicate-registration
check before their actual payload/refusal/retry assertions.

This is a source/port composition incompatibility. It proves neither lost
membership installation nor successful fault containment. It is not appropriate
to remove native preparation for the duration of a test or waive these assertions.
Any later runtime design must separate source-owned preparation from optional
observation/fault participants, define their deterministic prepare/install/complete
ordering, and compose every admitted record before installation. A throwing
preparation participant must leave state and responsibility untouched for that
unit. Releasing a participant must not unregister native preparation. No new
public port or specific registry implementation is selected here.

Acceptance keeps the three original specs untouched and requires useful retry;
adds nested registration/disposal and preparation failure before/after native
preparation, verifying participant release cannot erase source facts. This is a
separate implementation gate from absence observation.

## Mixed undo: prepared-delivery chronology

The unchanged heterogeneous-reentry-publication.spec.ts installs left structural
undo and two right live-row inverses. Useful pre-undo delivery50/60 passes. Undo
physically installs right11/12, then its first row tap writes the other row777.
Final physical all() is777/12, but final outbound is11/12 even after settled().
The previous recorded REENTRY-REVIEW already isolates this ordinary public case;
it remains reproduced in the successor's composition run.

Source reconstruction, not a new instrumented event trace:

- tree-realization-adapter.ts1440–1462 installs every prepared point before
  publication;1515 then publishes point plans individually.
- entity-signal.ts569–588 notifies with each captured row.after and immediately
  executes its onUpdate tap. The outer loop resumes an older sibling after the
  tap's newer write. It has no source-installation-sequence validation there.
- Link's ordinary projection ingests the resulting notifications. Newer physical
  state does not by itself prevent a later-delivered older after-image from
  updating outbound evidence.

The failure is ordering of facts at consumption, not an inverse that physically
erases777 and not proof of a missing membership dependency. All consumers must
respect native installation order: an older deferred delivery cannot install a
newer projection revision merely because its callback arrives later. Source
revision/footprint validation and completion obligations must handle superseded
parts while retaining untouched parts, errors and useful sends. Rereading an
entire physical row could import inspection state and is not an accepted fix.

Acceptance retains the original777 assertion and controlled invalidation tests,
plus reversed point order, field-disjoint reentry, callback throw and queued /
in-flight serialization. No patch is proposed or executed in this investigation.

## Predecessor hold without progress

At82127362 private.ts225–229, project() puts pending owner cells in fact.blockers,
but never calls prepareRevision or otherwise registers an operation referencing
those blockers. lifecycle.ts ownerWake only wakes cell.dependents. The target's
ordinary local scope has no reason to settle when the foreign tree confirms;
Link's eligibility callback therefore lacks the required foreign trigger. This
explains the fresh recorded failure after confirmation. It is a source-derived
causal explanation supported by that output, not fresh instrumented chronology.

At2dacae7b project() uses no blockers, so admit() reaches the local gate and sends
before confirmation. Deleting the wait avoids the stranded work by losing safety.
A future hold must have its own revision-bound wake registration and cleanup;
known dependencies and conservative possible blockers must not be conflated.
