# Two bounded causal traces after qualification

Analyzed source checkpoint `aa1d76532a9d06f621631197a23419af3f2a232b`.
No runtime or test changes; no new execution, suite or measurement campaign.
Existing raw four-test replay remains two incumbent passes and two B failures.
The owner separately reports reproducing those results with Node 24.15.0 and
pinned pnpm 10.17.0. Their initial pnpm 11 startup rejection did not execute tests.

## Rekey: observed address incorrectly becomes authored membership

`entity-signal.ts:1137` stages a key transfer. Capture at lines 710–723 records
structural rekey A→A2 with identical before/after payload. The payload id remains
A throughout. The existing test at `entity-signal.spec.ts:2426` explicitly permits
storage key 42 with payload id 1 after changeId. Consequently the previous report's
explanation involving a separately rolled-back id field is incorrect. Inequality
alone is not a universal coherence violation. The decisive unchanged assertion is
that rejecting this rekey must restore key A while preserving independent n=3.

In `native-entity-ownership-experiment.ts`:

1. Rekey prepares membership ledger `owner:subject:@`: base key A, pending key A2.
2. Later updateOne(A2,{n:3}) enters capture as `structural:false`
   (`entity-signal.ts:653`). Current placement supplies key A2.
3. Line 265 stages membership whenever structural **or an existing membership
   ledger exists**. `stage` (lines 142–165) promotes this ordinary write to a newer
   base fact containing A2, the whole payload and observed placement. Observation
   of the speculative key has become authorship of that key.
4. Rejection removes the pending rekey but selects the newer base A2 (lines
   325–367). The row payload is cloned from native state, retaining id A and n3;
   there is no changed-id field ledger in this replay.
5. Native installation sees no key transfer to perform. Settlement succeeds and
   retires responsibility, leaving the rejected key A2 installed.

The correction obligation is to distinguish actual authored membership/key facts
from field value updates and their structural dependencies. Simply deleting the
`ledgers.has(membership)` branch is not yet a validated repair: independent edits
of speculatively added or removed lifetimes still need a defined disposition.
Those dependencies cannot be silently discarded to make this one replay pass.

## Ordering: captured successor does not survive the prepared settlement

Starting z,a,c, pending appends x,y then removes c. Removal capture obtains c's
neighbors a and x (`entity-signal.ts:678–691`). B retains that placement in the
membership base. This append/remove sequence does not create a full ordering
ledger under the `needsOrder` condition (native entity ownership lines 180–190).

Rejecting the transaction prepares x→absent, y→absent, c→present. C's desired
placement still names x as successor. The rank traversal (lines 438–455) assigns
dependency order but does not resolve the anchor to a surviving final location.
`prepare-entity-ownership-delta.ts:87–95` correctly rejects a target whose successor
is another delta with no after-state: `Delta successor unavailable`.

This throws during preparation, before driver installation at
`native-ownership-driver-experiment.ts:264`. The raw result retains z,a,x,y,
one pending transaction and seven ledgers. This is unavailable settlement with
retained authority, not a successful partial rollback or the rekey's false success.
The existing replay does not demonstrate a subsequent successful retry.

The correction obligation is to resolve placement against the complete prepared
survivor/dependency set. Sorting alone cannot make a removed anchor live. Merely
ignoring the guard or treating every removed anchor as the tail would lose order
in other shapes. No such repair is implemented or accepted here.

## Cost and verdict corrections retained

Bare gzip increases 210 bytes (about 1.8%). Demo initial increases 9.53 kB,
563.16→572.69 kB. Both bare and entity production/development budgets fail.
Transaction gzip +13.9% measures both selectable implementation graphs retained
in the current artifact, with only B executed; it does not predict replacement size.
COST.md already carries these figures. No fresh size claim is made in this follow-up.

The 352 ordinary failures are not 352 independent defects. Unsupported observations,
changed refusal expectations and incompletely diagnosed assertions stay distinct.
Two default-authority substrate regressions remain separate from selected B.
Three samples per workload, uncontrolled host activity, construction including
population/destruction, and excluded failing semantics bound the cost conclusions.
Reclamation observations remain post-capture-drain and do not prove universal GC.

## Independent review

A separate read-only reviewer inspected aa1d7653 source and the raw four-case log
without being given a preferred repair. The reviewer confirmed both causal chains,
explicitly rejected the separately-restored-id explanation, and verified that the
anchor error precedes installation and owner retirement. No tests were rerun by
the reviewer. Their cautions about pending-added lifetimes and unresolved target
placement are reflected above. Root verified these claims against the cited source
and the existing key/payload test.

## Disposition

The rejection stands on failed rekey retraction and the other independently proven
public defects, without imposing a new key/payload equality contract. Preserve the
ordering refusal separately. Runtime repair and architectural selection remain
paused; these traces identify classification and preparation obligations, not a
proof that a syntactic patch or broad replacement is required.
