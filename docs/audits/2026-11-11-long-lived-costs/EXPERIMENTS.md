# Preserved experiments and controls

This record distinguishes failed hypotheses from runtime defects. Final adoption
and exact validated artifacts belong in the execution record.

## Ordinary consumer harness

The first pilot directly imported full installed ESM barrels. It passed its
oracles but included otherwise-unused Link registration; it is excluded from the
selective production-consumer comparison. Subsequent bundles use named exports,
production defines and metafile assertions that unused Link/native participant
implementation is absent. The second pilot retained an aggregate computed at
teardown. Dropping that fixture reader corrected the cleanup measurement; its
older retained-heap endpoint was not a library leak. Original source versions
were recovered and checked against their recorded hashes.

The completed baseline uses 100 fresh processes, including v15 A/A repeats. The
skipped-write controls fail on the actual write/read oracle. All iteration and
phase results remain in the original packets, including shared-host observations.

## v15 collection projection

Attempt 1 walked the structural linked list directly and removed a key-to-subject
lookup without a second cache. Focused behavior tests passed. Forty paired Angular
children showed an aggregate-stage improvement, but the 84-child neutral retained
store study exposed a warm-path regression at 5,000 edits. This candidate is
rejected despite its favorable short-run result. Its exact kernel archive, patch,
generator and raw results are preserved.

Attempt 2 uses a demand-created contiguous ordered subject-ID snapshot. It avoids
the lookup while retaining fast array iteration. Every existing key/order snapshot
invalidation also clears this snapshot. A mutant removing those invalidations
fails seven of the nine new projection tests. The 112-child study adds a combined
`ids()` + `all()` workload to price both arrays instead of hiding its extra memory.
The final Angular pairing and validation determine adoption.

One initial test incorrectly expected `changeId` to modify the entity's stored ID
property. The published baseline disproved that assumption: it changes the
collection key. The corrected test explicitly checks both identities; the first
failure is preserved rather than changing runtime behavior to fit it.

## v16 active-recipient bulk preparation

Activation probes exposed expensive population when a collection Link is attached
before `setAll`. Source-count evidence charges the original `removeSupport`
implementation's unrelated contributor-key visits: doubling fresh rows from 200
to 400 increases visits from 218,900 to 877,800. The incoming-key/negative-support
rules disprove a shortcut based solely on membership-slot presence.

The first prototype indexes exact contributor keys by entity lifetime. All paired
active-Link population samples improve, but the index adds live heap and some
point-write maintenance. That tradeoff is preserved and motivated a second
prototype: build the index only when lifetime deletion first needs it, and reset
it on clear. Normal native structural preparation indexes a temporary draft;
installation copies into the live, unindexed map. Direct fallback apply paths
still build and maintain the index correctly when they use it. This is an internal
representation choice, not a public configuration flag or relaxed contract.

An initial packaging attempt failed because the default npm cache was outside the
sandbox's writable roots. A fresh attempt used an output-local cache. No runtime
or semantic failure was hidden by that retry.

## Coordination episodes

Five pilot versions preserve expanded coverage and first failures. The automatic
refusal fixture initially subscribed before draining its own reset write. That
observer therefore ran on reset rather than on the intended transaction. Draining
the reset before arming the observer fixed the fixture; it did not require a
runtime change. The completed retained-store cohort checks 100 episodes per child
across dependent publication, independent progress, rollback refusal, retirement,
pre-enrollment history and automatic recovery, followed by 128 simultaneous pending
transactions and a full drain. A deliberately early publication is rejected by
the pending-state output oracle.

Source suites cover the broader guarantee matrix, including declaration
contradiction/uncertainty, current native readers, restoration and reentry. A finite
repeat trace is not a proof of all histories. The unchanged original point counter
must also be checked by a wrapper that asserts the emitted numeric bound; its
exit status alone does not assert that bound.

## Settled bulk rollback on a retained tree

The pending-memory screen left a substantial empty-store endpoint after rollback.
A separate ten-cycle aging probe therefore repeats 1,000-row population and
rollback on the same transaction-enabled tree, with an already-active Link.
The cycle helper returns before job-separated GC; transaction handles and input
locals are dropped. Both reused-key and fresh-key cohorts retain exactly another
1,000 entity-lifetime records and value backings per cycle, reaching 10,000.
The sampled transaction handles collect while sampled row payloads remain alive.
Destroying the tree and returning from the helper releases those payloads.

This is tree-local retired backing growth, not a process-global leak or merely a
noisy heap endpoint. A small follow-up reads the existing claim-registry
diagnostic: each pending population has one owner and ten claimed subjects; every
settled endpoint has zero owners/claims while retained candidates rise 10/20/30.
An initial diagnostic incorrectly awaited Link settlement while its transaction
was still pending; that fixture deadlock and its corrected flush separation are
preserved separately.

Source inspection identifies a deliberate safety boundary: transaction claim
release does not immediately reclaim, because restoration's notifier capture may
not yet have claimed the same subjects. Restoration-history eviction drives the
claim-aware sink later. A tree using transactions without restoration has no such
eviction event. The repair must supply a safe post-capture trigger and retain
shared claim/physical freshness checks; deleting the restoration-authority guard
would violate the existing never-claimed-retirement counterexample.

The complete v15 suite exposed three older ownership-null fixtures whose manual
value deletion ran after the new automatic queue had already forgotten the
unowned lifetime. The correction moves that deliberate deletion before deferred
full reclamation, retaining the subsequent behavior assertions and the pending/
history controls. It does not skip the null experiment or change runtime cleanup
to preserve the old retained-memory condition. The v16 counterpart receives the
same test-only correction; initial failures and focused reruns are preserved.

One v15 fault-injection fixture also exposed its existing distinction from v16:
it manually disables notifier batching, so an observer error can occur before the
apply callback returns and v15 classifies compensation as refused. Source/history
inspection found no production caller selecting this mode. The port preserves
the pending claim until explicit confirmation and does not import v16 settlement
semantics based on that internal fixture.

The final v15 production aging attempt could not use the v16 fixture's
`__acquireEntityHandleForTesting`: v15 correctly removes that diagnostic under
production defines. The first control therefore fails setup, not the planted
publication fault. Its corrected, separately identified v15 runner obtains and
checks ordered identities using the existing production subject-ID/key lookup
instead. It does not enable development code or acquire consumer field facades.
Only the later control that reaches and rejects the planted early send counts
as sensitivity evidence.

## Cost of the cleanup itself

The new coordinator must not turn settled active rows into a wide-row scan.
A deterministic probe found that preparing reclamation for an active 64-field
row enumerated 65 metadata keys before the old planner rejected its active state.
The same enumeration occurred during a real field transaction's confirmation
and async drain on both lines. The planner already categorically rejects active
or missing subjects, so the correction performs that structural check before
building the diagnostic inventory. Original and fixed package bytes are bound
separately. Independent executed controls verify active/cold/missing cases do no
inventory walk, while a retired pending row still visits 65 keys, yields a valid
plan, and restores its held field. This is an operation-count result; full-drain
CPU and heap are priced in separate cohorts.

## Residual activation-index growth

The first physical reclamation repair releases every sampled row payload and
transaction handle, and its lifetime/backing inventories are zero. Whole-process
heap still rises. A preregistered eight-child, 30-cycle intervention removes the
accumulating numeric test-ID list and separately removes the active Link recipient
while retaining the same production bundle. Growth survives both changes; claims
and descriptor submaps remain empty and position-registry counts stay fixed. The
numeric oracle has a measurable cost but does not explain the residual. An active
Link is not a necessary cause.

A diagnostic-only `Map.prototype.set` census then records a weak reference and
one stack when a map first exceeds the 1,000-row live-work bound. After the helper
returns and GC runs, a surviving numeric-key map has 2,000/10,000/20,000/30,000
entries. Its values are weak references to activation cells; the stack identifies
`getSubjectStateSignal`, invoked by rollback validation's held-row lookup. The
row objects can collect while these weak-reference wrapper entries remain.
No timing or heap figure is attributed from this instrumented run.

The source distinction is concrete: v15's immediate no-owner path already drops
these activation-index slots, but the prepared coordinator path does not. v16
also lacks the earlier v15 late-registration guard and bare-retirement deletion.
The narrow repair must remove a slot only after its entire lifetime is actually
forgotten, preserve value-only retirement and legal history/pending owners, and
keep a late read of an already-forgotten lifetime from reinterning a tree-owned
entry. New exact-map controls and held/late native-handle traces precede final
aging and cost comparisons.


## Final source validation and environment retries

The first integrating build passed framework suites, but three kernel fixtures
still used the ownership-null injection timing described above. Their original
failures are retained; correcting only the fixture timing precedes final source
validation. A later parallel framework build stopped making progress after kernel
emission; sampled workers were idle. Its process tree was terminated and a serial
canonical Nx build succeeded. The cause of that stall is not established.

Demo Jest used an equivalent preserved configuration with Watchman disabled
because the sandbox blocked Watchman's directory permission operation. An initial
incorrect absolute-preset workaround is preserved. Tests and the repository
configuration are unchanged. Packed-consumer checks initially failed because the
default npm cache was unwritable, then because sandbox DNS blocked fetching the
locked peers into a task-local cache. Authorized network access resolved those
environment failures; both packed checks pass again in final validation.

Final v16 validation binds runtime `a35ed7534996a80a77d0038ac61cb374fa5a1403`
and all five package outputs. It passes 7,252 kernel tests, all five framework/
reference suites, demo tests, source types, built witnesses and 18 of 19 affected
gates. Bundle budgets and strict demo size remain numerical failures; no ceiling
was relaxed. Details and seals are in [the validation record](VALIDATION.md).


## Remaining v16 growth after the two cleanup repairs

The first fully integrated runtime `a35ed7534` passes the full source suites and
all pending/coordination outcomes, and its 14-child aging cohort has zero retained
lifetime/backing records and zero sampled payload/transaction survivors at every
settled cycle. Nevertheless, whole-process heap above the empty-store checkpoint
rises from a median 4.246 to 11.889 MiB across ten 1,000-row rollbacks with reused
keys. Fresh keys show the same growth. The cycle-five-to-ten increment is about
4.10 MiB. This is a separate unresolved residual, not evidence of a heap plateau.
Those earlier physical cleanup successes are retained, but cannot close all
long-lived retention by themselves.

A separately registered 30-cycle intervention varies recipient activation and
whether the oracle retains cumulative or only current-cycle numeric IDs, using
identical final production bundles. Its purpose is to distinguish maximum-size
working capacity from per-lifetime accumulation, then identify surviving owners.
No earlier timing or physical inventory receipt is relabeled to pass this new
question, and no remaining heap is assumed to be the unavoidable price of a
v16 guarantee.


The residual intervention preserves one original first-cycle WeakRef assertion
failure. Separate preregistered diagnostics reproduced transient payload and tree
collection delays: natural survivors disappeared after additional job-separated
GC without mutating or destroying the still-live store. Planted pins stayed
alive through twenty extra passes and collected after explicit release. Original
three-pass assertions remain failed; later observations are not pooled into a
retroactive green cohort. The exact engine rooting cause of the original sample
is not established. This is distinct from deterministic publication-map growth;
see [the bound diagnostic](v16-delayed-collection-review.json).

The [retired-fact representation record](TERMINAL-FACTS.md) preserves the concrete
five-map census, rejected erasure/aggregation shortcuts, exact-reference identity
probe, independent premise review and subsequent source-stage results.
