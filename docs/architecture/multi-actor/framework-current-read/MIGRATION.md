# Native adapter migration in the bounded v16 candidate

This describes the experimental [frozen proof](proof/RESULT.md), not a published
release or an activated production change. Stable v15 is unchanged.

The candidate adds `ObservationAdapter.createCurrentReadonlyCell(readCurrent)`.
It serves SignalTree-provided reads that must consult current kernel state while
native publication is held. It does not make application-owned computeds eager.

The [subsequent owner decision](DECISION.md) requires this freshness even when
the SignalTree reader was acquired before the callback. The original proof alone
does not qualify that expanded boundary; combined implementation checks remain
in progress. Application-created native computed values keep framework timing.

## Which adapters need to change

The existing native classification remains the conjunction of
`createWritableCell`, `createWritableProjection` and `createReadonlyCell`.
An adapter supplying all three must also provide a callable
`createCurrentReadonlyCell`. Otherwise factory creation rejects it before reading
initial state or allocating the tree. An optional interface member therefore
still carries a behavioral migration for native adapters.

Neutral/token-only adapters and existing partial configurations retain their
portable routing. Adding only the new capability does not select the native
runtime. Do not add dummy factories to pass detection or silently change an
adapter's realization mode.

## Implement the capability honestly

- Return the adapter's existing readonly carrier, with stable native identity.
  A bare function cannot substitute for a promised native ref or signal.
- Create lazily. Direct reads consult the supplied current source, including
  repeated reads of one retained reader after nested writes.
- Preserve native dependency tracking, readonly behavior, cleanup and fresh error
  propagation. Metadata identity alone does not prove observation works.
- Do not flush or invalidate application computeds to make a direct read current.
  Their ordinary framework timing remains unchanged.
- Keep the ordinary cached readonly factory unchanged. This capability has a
  distinct purpose; an old cached factory must not silently satisfy it.

The kernel supplies the current source and owns when the capability is required.
The adapter owns native representation and tracking. A current reader cannot make
an arbitrary cached computation inside an application recipe current.

The proof records additional recipe execution in an Angular native-polling case:
polling evaluates the producer, then the direct wrapper read evaluates current
source. Freshness and error propagation pass; identical graph-wide computation
counts or CPU cost are not established. Performance qualification remains separate.

## Verify before claiming support

Use the [proof's controls and exact commands](proof/COMMANDS.md): held reads,
retained readers, nested writes, ABA, warmed native computeds, stable metadata,
real observers, error recovery, teardown and emitted consumer types. The
[independent review](BOUNDED-SDK-REVIEW.md) records which peers were actually
tested. Minimum-peer qualification is separate; a pass on one framework version
does not establish the whole declared range.

The proof preserves public `Signal`, `ComputedRef` and accessor carrier types.
It neither authorizes weaker types nor exposes private framework node operations.
