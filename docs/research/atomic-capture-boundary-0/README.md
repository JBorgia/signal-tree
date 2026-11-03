# Atomic capture boundary investigation

Disposition: **reviewed, reproducible counterexamples; no runtime integration**.
None of these prototypes establishes complete scalar/entity responsibility.
A prevents the original faulted update before installation; B covers several
existing-row routes but misses creation and changes inspection paths; C recovers
one lost write but composes repeated writes incorrectly. These results reject
these implementations, not the three architectural possibilities in general.

## Artifact and ancestry

Integration baseline: `19a5bd034d5ebef262f637c397bb41fe50a6a1e3`.
Evidence starting point: `742c9bd3ec9dc5c260e5da8d50a56b7cc423a499`, whose sole
parent is that baseline, on `codex/atomic-capture-proof`. The dedicated checkout
was clean. The main checkout remains on `fix/d1-d2-forward-port` at
`628d302dadb082a48c58528651c9088234d0a777`, with unrelated untracked `frontier`.
No package files are changed by this investigation.

The UI's +142,711 / -5,453 is reproduced exactly by:

```sh
git diff --shortstat origin/main...742c9bd3
# 473 files changed, 142711 insertions(+), 5453 deletions(-)
git diff --shortstat 742c9bd3^ 742c9bd3
git diff --shortstat 19a5bd03 742c9bd3
# both: 88 files changed, 4505 insertions(+)
```

At measurement, `origin/main` and the merge base were
`6ae860c8202d174ccf3bf48d2314374a6f2caf10`; local `main` was
`3aa64106d74762f39d9237f44b3c25131a8fee6c`. The displayed size is accumulated
branch ancestry, not the evidence commit's actual diff. That evidence commit
adds the prior proof packet and 11 TODO lines; it has no runtime diff.

## Premise and exact boundary

Frozen premises at the baseline, from
[transaction laws](../transaction-semantics-2/LAWS.md):

> Accept, reject, realization and failed settlement must not expose transient states that violate the semantic unit being settled.

> A failed settlement that preserves pending authority is either explicitly retryable or explicitly non-retryable, and may NEVER masquerade as a successful terminal settlement.

Applicable contributor/support contracts and the scoped architecture review
protocol remain binding. No frozen semantics are reopened or weakened.

For the unchanged mixed update witness, baseline source order is:

1. `entity-signal.ts:2945` (`updateOne`) constructs the next row, then calls
   `commitExistingSubjectValue` at 2979. That function calls
   `valueStore.retainSubjectValue(subjectId, nextValue)` at 1370.
   `physical/entity-value-store.ts:12` performs `retainedEntities.set`: the new
   entity value is physically live here, before committed capture and notifier
   replay capture. No authoritative rollback field effect has yet been paired
   with this installation. The scalar has its own recorded responsibility.
2. `transactions.ts:1818` (`captureEffects`) decomposes row endpoints into field
   effects: keys, values, presence, typed field segments, subject identity and
   intent. Injection throws at its entrance, before any such effects exist.
3. The three consumers are different. The committed source listener at
   1964–2012 fills `entityFootprints` for admission; the enqueue recorder at
   2633–2690 captures inspection chronology; the deferred subscriber at
   2799–2811 calls `captureIntoBucket` to fill rollback `bucket.effects`.
   They are not three redundant complete rollback journals.
4. Committed listeners are contained/reported by
   `internals/mutation-capture-runtime.ts:68–82`; deferred subscriber exceptions
   are contained/reported by `path-notifier.ts:426–466`. The inspection recorder
   sets `inspectionUnavailable`. Capture loss does not mark the pending turn's
   rollback responsibility incomplete.
5. `drainCaptureBucket` at 1616 clears admission footprints and materializes
   only known effects. Pending materialization at 2150 accepts that incomplete
   set. Rollback applies the scalar-only plan and sets `installed = true` at
   3469. It changes lifecycle to rejected, deletes inspection state, calls
   `authority.discardPending` at 3514 and settles the commit scope. Retry returns
   normally because the handle is already terminal. Completion of the known
   plan is mistaken for completeness of responsibility.

History matters: `c1553346` deliberately made committed entity footprints
admission-only, without baseline payloads. `5cd573d9` introduced isolated
committed capture. The deferred subscriber isolation prevents observer errors
from stranding scopes/handles. Reversing those decisions or blanket-refusing
settlement when inspection is unavailable would violate existing behavior:
`path-notifier-enqueue.spec.ts:255` permits confirmation after hostile diagnostic
chronology. Diagnostic failure and lost rollback responsibility differ.

**Fault qualification:** this is a controlled failure at an actual fallible,
contained capture boundary. It does not mutate pending authority, invent a
corrupt subject identity, or alter physical storage directly. Thus it is a
meaningful robustness falsifier for the proposed capture guarantee. Existing
containment promises error isolation; it does not itself supply recovery from
missing effects. We have not reproduced a normal public input that makes this
numeric row decomposition throw. The robustness counterexample must not be
presented as such a public trigger.

## Same falsifier and bounded comparisons

`mixed-no-inspect.mjs` is byte-identical to the prior packet. It omits inspection,
disables the fault before rollback, and reads physical storage before demanded
reads. Base/old return success with scalar restored, entity speculative, pending
zero, and successful no-op retry. The original tests and their assertions are
unchanged. `mixed.mjs`, scalar preparation/reentry, and failed-settlement probes
also retain the prior source.

| Prototype | Mechanism and useful result | First blocker / limitation |
| --- | --- | --- |
| A | Run rich field capture into prepared storage before `updateOne` installs; install prepared map/set entries next to value. Exact capture exception propagates, entity never installs, scalar prefix compensates to `[0,0]`, pending zero. | Original returned-handle fixture exits red because no handle is returned; companion controls establish prevention, not downstream rollback coverage. `replaceOne` bypasses this preparation and reproduces partial successful rollback. |
| B | Prepare field-specific owner/subject/before/after/presence/intent facts; install map/set entries immediately after backing value, before rich observers. Original update witness, sibling-survival, repeated-write and reentry controls pass. | Replacement frame bypasses the prepared record; same false terminal success. |
| B2 | Add prepared responsibility to value-only frame commits, before committed observers. | Replacement now passes; direct existing-row `upsertMany` still bypasses the boundary and fails. |
| B3 | Route existing-row `upsertMany`/`setAll` replacements through the prepared value helper. | Existing-row upsert passes. `addOne` creates a live subject outside the value-only frame guard; failure leaves `[0,1]`, pending zero, retry no-op. No-fault addition restores `[0,null]`. |
| C | Journal failed capture envelopes, retain authority, repair capture before rollback/confirm. Persistent failure refuses unchanged; disarming it permits actual rollback/confirmation and scope/consequence cleanup. | A failed `0→1` followed by successful `1→2` in one contribution is replayed in the wrong order. Successful settlement leaves `[0,1]`, pending zero; synchronous Vue observers see `[0,1]`. |

The C repeated-write witness explicitly flushes the notifier inside the callback
to force the first failed replay before the second write. This internal seam is
part of the test, not a claimed ordinary public-input trigger. Repair seeds from
the captured `1→2` effect then appends missing `0→1`; merge retains before `1`
and changes after to `1`. Keeping a turn ID is insufficient to preserve authored
order within that turn.

B also introduces an ordinary-input **inspection regression**: healthy updates
report `rows.v` instead of `rows.A.v`. `inspection-v2.mjs` passes on old and fails
on B2/B3. Prepared effects omit the row key; later merging preserves the first
path. Typed subject/address remain correct. This is a public-input regression
in the prototype, distinct from the injected capture failures. It is preserved
as another integration blocker, not silently corrected in the negative artifact.

Every admitted write must retain enough responsibility to prevent false terminal
settlement. The tested prevention approaches require coverage of each physical
installation route; recoverable capture must preserve complete evidence and
authored order across successful and failed captures. These probes do not
establish a unique required placement or mechanism. No production mechanism is
selected here.

## Controls, first failures and limits

Full original stdout/stderr, exit status, bundle hash and input references are
saved in [first-results.json](first-results.json); exact source/loaded hashes are
in [source-inputs.json](source-inputs.json). These include original failures and
independent replays, not just a chosen green subset. Full bundles remain in
`/private/tmp/st-capture-boundary-20261013/runs`. Node was 24.15.0; dependencies
came from the unchanged main checkout with workspace pnpm 10.17.0.

Successful controls include real clean writes/confirmation, field sibling
survival, preparation failure and reentry, original mixed publisher-failure
settlement, actual retry after capture repair, and confirmation. `recovery.mjs`
checks open commit scope and scheduled durable consequences: refusal keeps both
pending; rollback discards consequences; confirmation delivers once and closes
the scope. B2 and C pass these single-write controls. Lifetime replacement may
legitimately refuse rollback unchanged; explicit confirmation then preserves the
new lifetime. `recovery-healthy.mjs` reproduces that baseline contract without
injection. No blanket refusal is accepted as successful recovery.

First fixture failures are retained too: the original lifetime watcher used
`byIdOrFail` across deliberate absence; v2 failed to optional-call the absent
signal; v3 reached a legitimate lifetime refusal but demanded successful
rollback. The companion recovery fixture checks allowed refusal **and useful
confirmation**, against the healthy baseline. Original inspection cleanup called
an absent `dispose`; v2 changes only cleanup to optional disposal and exposes
the actual path regression. C has no preparation hook, so its preparation-mode
zero-hit failures provide no prevention coverage. A faulted early-abort rows do
not test their skipped later-write branches. None of these reds is erased or
counted as a runtime pass.

These are source-bundled focused experiments, not production-quality patches.
The B preparation clone cost is unmeasured; prototype types/hooks are not an
approved API. Inherited scalar/native timing evidence is reused from the prior
packet. Vue observer checks and Solid settlement probes do not prove all native
framework timings. No survivor qualified for package/framework suites,
typecheck, spec-types, lint or fresh package/demo size gates. Those were not run;
there is no release sign-off and no new size/performance claim.

## Independent review

The independent reviewer first challenged fault-model framing and identified
the three non-redundant consumers, then separately replayed candidate behavior.
It reproduced B replacement, C repeated-write and retry, and later B3 addition
and healthy inspection against old controls. It confirmed the addition witness
handles legitimate absence, reaches physical storage before demanded reads, and
has a passing no-fault control. It traced B3's `every(replace-value)` guard and
the path-preserving merge responsible for the inspection regression. Root
verification checked those source predicates and raw traces. The review's
limits are retained: no public capture-fault trigger and no general impossibility
proof for A/B/C. Structural architecture work is unnecessary to establish these
counterexamples. No runtime integration is approved.

## Replay

Use this dedicated branch with package sources matching the exact baseline.
`ST_PROOF_DEPS` may point to an installed workspace with matching lockfile.
The runner checks loaded package source against the baseline, reconstructs only
temporary overlays, saves bundles/hashes, and refuses to overwrite completed
results. Choose a fresh final label. Run sequentially.

```sh
node docs/research/atomic-capture-boundary-0/run.mjs old mixed-no-inspect.mjs capture-error replay
node docs/research/atomic-capture-boundary-0/run.mjs B3 mixed-no-inspect.mjs capture-error replay
node docs/research/atomic-capture-boundary-0/run.mjs B3 mixed-add.mjs capture-error replay
node docs/research/atomic-capture-boundary-0/run.mjs B3 mixed-add.mjs control replay
node docs/research/atomic-capture-boundary-0/run.mjs C controls.mjs repeat replay
node docs/research/atomic-capture-boundary-0/run.mjs C recovery.mjs rollback replay
node docs/research/atomic-capture-boundary-0/run.mjs old inspection-v2.mjs control replay
node docs/research/atomic-capture-boundary-0/run.mjs B3 inspection-v2.mjs control replay
```

Expected exits: **1, 0, 1, 0, 1, 0, 0, 1**. Exit 1 preserves the original
correctness assertion failure; it is not converted to an expected-pass test.
Additional comparison: `A controls.mjs prepare-error`, `B3 controls.mjs
prepare-reentry`, and `C recovery.mjs confirm` / `lifetime`, with a fresh label.
`ST_PROOF_OUTPUT` defaults to `/private/tmp/st-capture-boundary-replay`.
Patch chain: prior `candidate.patch` → A or B or C; B → B2 → B3. These are
isolated research overlays, never applied to the checkout's runtime source.

Portable verification executed all eight listed commands with label
`portable-first`; all exits matched the listed sequence and every input stability
check passed. [Command results](portable-results.json) retain the invocation
outputs. The independent interpretation review rejected a draft claim that
preinstallation placement was universally necessary: successful single-write C
recovery supports an alternative. That overclaim was removed; completeness and
ordering, rather than unique placement, are the supported requirements.
