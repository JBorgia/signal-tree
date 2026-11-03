# Prepared operation records: bounded mutation inventory and candidate

**Disposition: D2 survives the prior capture falsifiers and inspection control,
but does not establish the complete settlement contract. No runtime integration.**
A new focused observer assertion is red on both baseline and candidate: during
rollback a synchronous Vue effect can read a restored scalar and stale
`rows.all()` while physical storage and direct row reads are already restored.
This is an existing settlement-publication failure, not evidence that D2 loses
capture responsibility. It remains an acceptance blocker; no assertion is waived.

Baseline runtime: `19a5bd034d5ebef262f637c397bb41fe50a6a1e3`.
Starting evidence HEAD: `b5ba7629c6b4fd9ce5d446798c598cd5bf0c0005` on
`codex/atomic-capture-proof`; dedicated checkout was clean. Main checkout remains
`628d302dadb082a48c58528651c9088234d0a777`, with unrelated untracked `frontier`.
Runtime source remains unchanged. D/D2 are temporary source overlays, not
production-approved code. No v15, order/frontier, export or framework changes.

## Contract and scope

One revised hypothesis only: prepare complete operation facts before installation,
retain them independently of richer capture, and validate disposition before
settlement. This follows the [prior bounded comparison](../atomic-capture-boundary-0/README.md),
not another architecture competition.

The baseline [frozen laws](../transaction-semantics-2/LAWS.md) remain:

> Accept, reject, realization and failed settlement must not expose transient states that violate the semantic unit being settled.

> A failed settlement that preserves pending authority is either explicitly retryable or explicitly non-retryable, and may NEVER masquerade as a successful terminal settlement.

Contributor ownership and support contracts remain binding. Existing native
computed timing during authored execution does not by itself settle the distinct
question of coherent settlement publication. No new timing policy is adopted.

## Mutation-path inventory

Lines refer to baseline `packages/kernel/src/lib/entity-signal.ts`, except where
named. An independent read-only inventory confirmed these routes.

| Supported route | Physical installation | Required rollback facts |
| --- | --- | --- |
| `updateOne`2945, field facade2338, existing `upsertOne`3404 | `commitExistingSubjectValue`1365 → value store retain1370 | Collection position, lifetime subject, actual row key/path, changed fields and own presence, typed segments, intent, operation order. |
| `replaceOne`3015, callable node2297, `updateMany`3090 | Value instructions → `commitAndProjectEntityMutationFrame`691 → frame retain213 | Same field facts, including deleted fields; sequential before/after for repeated writes. |
| `addOne`1967, staged `addMany`/`prependMany` | Frame1995/1878 → frame createSubject185, retain186 | Fresh lifetime ID, key/membership, value, placement dependencies, owner/order. `addOne` clones its rollback structural payload only after installation1999. |
| `removeOne`3205, `removeMany`3276 | Tombstone frame3251/3342 → frame tombstone243 | Removed lifetime/key/value, restore eligibility, neighboring subjects and owner/order. Single removal prepares its structural payload before installation. |
| `upsertMany`3411 | Fresh membership via `commitFreshSubjects`3477 → createSubject1318; values3491 and existing replacements3515 separately | Entire mixed operation's fresh membership and field facts before the first membership install. A value-store hook is too late. |
| `clear`3604 | Direct tombstones3633 | Every removed lifetime/value/neighbors. Structural payload cloning is currently deferred until notifier delivery3685. |
| `setAll`3694 | Fresh membership3812; direct tombstones3838; values3847/3853; existing reorder3862 | Add/remove/replace facts plus existing ordering metadata/dependencies. Fresh membership precedes cloning removal payloads3825. |
| Repeated operations | Each route installs immediately | Journal of successful and failed-capture writes in authored order, not a failed-only tail appended afterward. |
| Absent collection reactivation4090–4136 | `clearRetained`4125 → prepared row write4129 → parent path reactivation4133 | Row/lifetime facts and outer collection/path existence. Row installation alone is not the outer operation. |

The primitive points are `physical/entity-value-store.ts:12` (`Map.set`),
`physical/structural-store.ts:441–448` (create membership/lifetime), and 473–490
(tombstone). Frame observers run after the whole instruction loop. Prepared
settlement target installation580–591 is separate from authored mutations;
restoration and reclamation must not become new authored contributions.

**There is no universal current boundary.** D routes the identified direct bulk
writes through the existing frame, while retaining the existing single-value
fast path and scalar installation path. Those paths implement the same prepared
record contract. Existing `setAll` ordering capture and reordering remain in
place; this experiment does not redesign ordering or frontiers.

Reentry-capable preparation includes ID selection, interceptors, property reads,
spreads and cloning. `setAll`'s deliberate topology recheck3775 and fresh backing
read3795 remain. D checks the physical revision after record preparation and
before installing a stale outer plan. The post-install clone locations above
are source-order findings, not reproduced ordinary-input capture exceptions.

## Candidate D, then bounded completion D2

D extends the frozen B3 overlay, with all D first results retained:

- Prepare field records with the actual row path, preserving `rows.A.v` in
  inspection. Prepare add/remove/rekey facts from frame instructions before the
  frame installs. Field facts preserve sibling values and own-property presence.
- Route bulk upsert, clear and replacement direct writes through prepared frames.
  Plan fresh subject IDs before installation rather than exposing empty membership.
- Install the prepared bucket entries and ordered operation journal next to
  physical state, before committed observers. Rich entity capture is no longer
  authoritative replay for covered writes; inspection/admission remain separate.
- Fold every installed entity operation in authored order. Before confirm or
  rollback, compare the expected folded effects against retained pending effects;
  mismatch raises the existing rollback failure type, leaving state and authority.

D2 adds scalar terminal-record entries to the same journal, using the existing
paired scalar installation, and compares field presence/typed segments in
addition to the other effect fields. D2 is a completion of the same hypothesis,
not another competing mechanism. Completed handle settlement removes the journal;
ordinary callback-failure compensation uses that same handle path. Failed
settlement retains it. Exact patches are [D](D.patch) and [D2](D2.patch).

The validator proves agreement only for **known journaled operations**. It cannot
independently prove that every physical route emitted a record. Inventory and
route tests remain essential. Restore/reclamation instructions are not authored
operation records. The candidate does not claim a universal instruction journal,
allocation-failure atomicity, formal coverage, or production-quality types/costs.

## Executed results and first failures

All original probes are reused byte-for-byte from the prior packet, including the
no-inspection, fault-disabled-before-rollback witness and inspection regression.
The prior eight replay commands retain their original oracles and outcomes.

D passes the unchanged original update/add capture witnesses, no-fault addition,
repeated-write composition, ordinary inspection, preparation/reentry, sibling
survival, existing-row upsert, replacement, real retry/confirmation scope checks,
and mixed inline-publisher-failure settlement. D2 reruns the capture, inspection,
repeat, reentry, lifetime-recovery, absent-collection and publisher controls with
passing results. Scalar reentry preserves the inner `7`, rejects the stale outer
write and rolls back; thrown `undefined` retains exact first-error identity.
These controls also perform successful later work.

`disposition.mjs` separately removes an entity effect from the validator's view,
without changing storage or retained authority. This additional internal seam
checks the guard, not a new public failure claim. Rollback and confirmation both
refuse with `SIGNALTREE_ROLLBACK_FAILED`, unchanged `[1,1]`, pending1, open scope
and no durable consequence. Restoring the view permits actual rollback to `[0,0]`
or confirmation with one durable consequence; terminal retry is inert.

The new `routes.mjs` covers update, replacement, add, remove, remove-many, mixed
upsert, clear, setAll, repeated writes, add/remove, add/update, remove/re-add and
prepend. **All 13 restore exact final rows/order and scalar and pass terminal
retry. Twelve then fail the settlement observer assertion**; add/remove's net
unchanged entity view passes. Those failed probes stop before their later clean
confirmation control, so they do not earn that coverage.

The same observer assertion fails on baseline and D for no-fault update/add.
`routes-observation.mjs` preserves that assertion and adds simultaneous storage
and direct-read diagnostics. Baseline, D and D2 show:

```text
synchronous Vue watchEffect during rollback:
  scalar = 0
  rows.all(): A.v = 1
  physical readSource(): A.v = 0
  direct byId('A')(): A.v = 0
final after rollback: scalar = 0, A.v = 0, pending = 0
```

Thus the observed stale projection is neither missing physical compensation nor
a trigger for the original injected capture exception. It is reproducible with
ordinary no-fault inputs, but is a **different** failure. Existing native timing
qualifications are not silently extended to waive settlement coherence. No
publication repair or broader framework work was undertaken here.

The absent-collection companion checks outer path omission, not only empty rows:
baseline no-fault, D no-fault and D/D2 injected addition all restore the omitted
parent and settle normally. The independent `review-absent.mjs` companion checks
final rows/retry only and explicitly defers observer coverage to the unchanged
red probe. It is not substituted for that probe.

## Independent review and disposition

An independent agent first inventoried routes, then reviewed/replayed D and D2
without an expected verdict. It reproduced repeated-write success and the
baseline/candidate publication red, and passed unchanged D2 inspection and
scalar preparation `undefined`/reentry controls. No new D2-specific blocker was
found in this bounded review. That is focused survival, not compatibility proof.

One review claim was rejected after source verification: ordinary callback
failure does not leak the journal by bypassing the handle. It calls
`handle.rollback()`, which deletes the journal on completed compensation. The
reviewer withdrew that claim. A separate materialization-error catch does not
clear the new journal; that path was not reproduced and remains a limitation,
not a claimed executable failure or permission to discard installed authority.

The result supports continuing the single operation-record hypothesis, while
preserving an explicit settlement-publication counterexample. It neither proves
nor disproves the ownership architecture. No broad suites, typecheck, spec-types,
lint, package/demo build or size measurement were run: the user requested focused
work only, and the full contract is not established. No runtime merge or release
claim. Preparation/cloning cost and full compatibility remain unmeasured.

## Replay and evidence

Run in this dedicated checkout with Node24.15.0 and dependencies pinned by
pnpm10.17.0. `ST_PROOF_DEPS` may name an installed workspace with matching lockfile.
The runner verifies loaded package sources against exact baseline and rebuilds
research overlays in `/private/tmp/st-operation-record-replay` (override with
`ST_PROOF_OUTPUT`). It preserves each completed run; use a fresh label.

```sh
node docs/research/operation-record-boundary-0/run.mjs D2 mixed-no-inspect.mjs capture-error replay
node docs/research/operation-record-boundary-0/run.mjs D2 mixed-add.mjs capture-error replay
node docs/research/operation-record-boundary-0/run.mjs D2 controls.mjs repeat replay
node docs/research/operation-record-boundary-0/run.mjs D2 inspection-v2.mjs control replay
node docs/research/operation-record-boundary-0/run.mjs D2 disposition.mjs rollback replay
node docs/research/operation-record-boundary-0/run.mjs D2 disposition.mjs confirm replay
node docs/research/operation-record-boundary-0/run.mjs base routes-observation.mjs update-control replay
node docs/research/operation-record-boundary-0/run.mjs D2 routes-observation.mjs update-control replay
```

Expected exits: **0,0,0,0,0,0,1,1**. The last two preserve the failing observer
assertion; they are not expected-pass tests. The prior packet's eight commands
remain runnable unchanged. Patch chain is prior scalar candidate → B → B2 → B3
→ D → D2, applied only to temporary copies. Nothing applies patches to packages.

[First results](first-results.json) preserve original stdout/stderr, exits, input
references and bundle hashes; [source inputs](source-inputs.json) retain exact
source/loaded hashes. Full original bundles remain under
`/private/tmp/st-operation-record-20261013/runs`. `inputRecords` indexes the
source-input array. All first runs and review runs are retained, including reds.

Portable verification executed all eight commands above with `portable-first`;
all expected exits and input stability checks matched. The prior eight commands
were freshly rerun unchanged with `operation-control`, again matching
1,0,1,0,1,0,0,1. [New replay results](portable-results.json) and
[unchanged prior replays](unchanged-eight-results.json) preserve exact commands.
The packet retains 58 original/review run records. Final interpretation review
found no material overclaim. Portable D2 reconstruction is byte-identical to the
tested overlay; package sources have no diff from the baseline.

The first staged whitespace check flagged one blank context line in D.patch.
Removing its context prefix preserves unified-patch meaning; reconstruction was
checked again. This packaging failure is separate from the semantic reds.
