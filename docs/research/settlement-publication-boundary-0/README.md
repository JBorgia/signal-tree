# Vue collection publication boundary

Follow-up: the owner-authorized SDK experiment was tested and remains rejected;
see [P3 result](P3-RESULT.md) for its two independently reproduced counterexamples.
The original record below preserves the earlier pending decision and first results.

Runtime baseline: `19a5bd034d5ebef262f637c397bb41fe50a6a1e3`.
D2 evidence checkpoint: `9e54b3d36eaeb0ef6e37e5bcf8c981141a4bcbfc`.
D2 remains a research overlay; its patch and reviewed results are unchanged.

## Ordinary-input counterexample

`timing.mjs` runs identical assertions on baseline and D2. It creates scalar 0
and entity A with value 0, contributes scalar 1/entity 1, then rolls back. No
capture fault is armed. A synchronous Vue observer triggered during rollback
reads scalar 0, direct row 0, but `rows.all()` and its held projection still
contain 1. Two callbacks observe this mismatch before a later callback observes
all zeroes. Deferred observers and final reads observe zeroes.

The baseline and D2 first traces record sequence 67/68, `bodyDepth: 0` and
`adapterDepth: 1`: the grouped callback has finished; native invalidations are
being delivered before `rollback()` returns. This is not a callback executing
inside the grouped write. Both native application computed reads are recorded
separately. Their freshness inside grouped writes is not asserted.

`entity-signal.ts` installs backing state before `updateSignals()` stages the
collection version invalidation. Vue writable invalidation copies the current
read into its published value immediately, then queues native `triggerRef`.
The group drains these triggers serially. The scalar trigger can invoke a sync
observer before the collection trigger marks its native computed dirty. The
collection's inner version check cannot run while Vue returns that clean native
computed cache. Thus SignalTree's own collection read is stale, not only an
application-owned computed. Reordering one trigger is not a general solution
for multiple collections and dependencies.

## Governing contracts

At the checkpoint above, L13 in
`docs/research/transaction-semantics-2/LAWS.md` says:

> Accept, reject, realization and failed settlement must not expose transient
> states that violate the semantic unit being settled.

It also explicitly requires observer snapshots rather than only final reads.
The kernel README's tap contract and `entity-tap-reads.spec.ts` deliberately
preserve cached held projections until a transaction/reversal ends. History
`9cb94957` establishes that distinction. These rules do not demand that native
application computed cells refresh inside grouped bodies. The acceptance test
checks SignalTree-owned reads in actual delivered settlement observers.

## Rejected publication repairs

P refreshes readonly cells during delivery. It fixes the original trace but a
reentrant group can make a held projection fall back to its old native cache.
P2 retains the refreshed value across nested groups. It fixes that backslide and
the original trace, but blanket refresh violates native memoization: an
unrelated token causes an allocating getter to compute three times and two
consecutive reads return different objects. Exact baseline computes once and
preserves identity. The focused getter test independently records `[1,3]`
instead of `[1,2]`. Neither repair is accepted.

`P.patch` and `P2.patch` preserve these isolated Vue-only candidates. Capture
code was not expanded. The D2+P2 overlay passed 13 unchanged capture, creation,
inspection, refusal, retry, confirmation, repeated-write, preparation/reentry,
and failed-settlement controls; those results do not rescue P2's publication
regression or establish integration correctness.

The first focused test invocation had TypeScript errors in the newly written
harness, then the corrected baseline regression failed on the stale collection
snapshot. Both logs are preserved. A new observer-`throw undefined` assertion
also failed. A bare Vue `effect`/`triggerRef` control establishes that Vue itself
swallows that value; this was an invalid adapter-propagation premise, not a
repair success. The test now compares native and adapter behavior explicitly.
Body-thrown undefined must still propagate exactly, with sibling delivery.

## Review and pending decision

Independent review checked L13, held-projection timing, and the original trace;
it also supplied the allocating-getter counterexample, reproduced here against
exact baseline and P2. Another independent test pass supplied multi-collection,
reentry, ref identity, native interop, dependencies, stopped observers and
first-error controls. Review claims were checked with source and replay.

A possible narrower repair would let the kernel provide a projection freshness
predicate to native readonly realization. Ordinary derived cells would retain
native memoization; only a stale owned projection during delivery could refresh.
This requires an optional parameter on exported `ObservationAdapter`, a public
SDK change. Owner authorization is pending under AGENTS.md. No implementation
of that port or claim of its correctness is included here. It would also need
neutral/fake realization evidence, fresh first-error controls and independent
review. Application-owned native computed timing would remain native.

All four framework wrappers now have the same `4c coherent value settlement`
regression. Angular, React and Solid pass on unchanged runtime; Vue fails on
unchanged runtime and passes with rejected P2. The focused kernel tap contract
passes with P2. Full suites, integration gates, demo/package size and release
verification have not been run: the candidate does not survive focused review.
No ceiling, v15, publication, push, merge or tag changes.

## Replay

Use Node 24.15.0 and pnpm 10.17.0 dependencies. The runner loads package source
from exact baseline Git objects, independently of current working-tree edits,
and applies only the selected research patches in a temporary directory.
`ST_PROOF_DEPS` can point at an installed checkout with matching dependencies;
`ST_PROOF_OUTPUT` selects a new result root. Labels are never overwritten.

```sh
node docs/research/settlement-publication-boundary-0/run.mjs base timing.mjs suite replay
node docs/research/settlement-publication-boundary-0/run.mjs D2 timing.mjs suite replay
node docs/research/settlement-publication-boundary-0/run.mjs P owned-read-controls.mjs reentry replay
node docs/research/settlement-publication-boundary-0/run.mjs P2 timing.mjs suite replay
node docs/research/settlement-publication-boundary-0/run.mjs P2 owned-read-controls-v2.mjs reentry replay
node docs/research/settlement-publication-boundary-0/run.mjs base review-readonly-memo.mjs suite replay
node docs/research/settlement-publication-boundary-0/run.mjs P2 review-readonly-memo.mjs suite replay
```

Expected exits: 1,1,1,0,0,0,1. The same original timing assertions fail on both
baseline and D2. `first-results.json` preserves raw traces, errors, source hashes
and original bundle identities (`inputRecords` indexes `source-inputs.json`); `portable-results.json` records fresh replay.
Original full bundles remain in `/private/tmp/st-publication-boundary-20261013`.
Captured evidence includes one reviewer run named `base` which actually loaded
modified P2; it is an invocation mistake, not baseline evidence. The subsequent
`review-base` and portable baseline runs use exact original source.

Capture correctness and publication correctness remain separate claims. The
original injected capture failure still has no reproduced ordinary application
trigger. This separate ordinary-input publication failure supplies no such
trigger and does not disprove atomic responsibility capture in principle.

Independent final record review verified the raw sequence numbers, thirteen
DP2 successes and memoization rejection. Its replay-accounting correction was
applied: the portable baseline timing run is now included in the result index.

After restoring the Vue runtime, the focused Nx run passed spec typechecking
and reported 9 passing controls and 2 expected publication failures (shared
4c and multi-collection rollback). Memoization and getter controls pass on the
restored runtime. See `vue-restored-focused.log`. Runtime source has no diff
from the checkpoint; the unintegrated repair candidates exist only as patches.

The first staged whitespace check flagged CRLF in Nx log output; tracked log
line endings were normalized to LF. Original bytes remain in the temporary
evidence directory. No result or assertion was changed.
