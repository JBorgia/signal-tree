# Indexed point responsibility: I1

Preserved parent: `90738bbe8a77aaf4dacad988aa3274685fed27bf`.
Exact runtime baseline: `19a5bd034d5ebef262f637c397bb41fe50a6a1e3`.
D2 and OAP publication patches are unchanged. I1 is a separate patch, not an
accepted runtime integration. No public API or assertion changed.

## The four calls

All four call `StructuralStore.activeKeysSnapshot` from
`commitAndProjectEntityMutationFrame`, introduced by D.patch's pre-install
responsibility preparation. With N initial rows and four authored point writes:

| Caller | Snapshot length | Required responsibility fact | I1 disposition |
| --- | ---: | --- | --- |
| addOne → addOneWithStructuralEffect | N | Original tail subject for fresh creation's beforeSubject | Existing tail pointer + key-to-subject index |
| changeId → prepared mutation commit | N+1 | Known subject and old/new keys; tail unused | Remove scan |
| removeOne → mutation commit | N+1 | Removed subject/value and neighbor subjects; tail unused | Remove scan; existing indexed neighbors remain |
| removeOne → reclaimRetiredSubjectsWithoutOwner → mutation commit | N | Retired-value reclamation; tail unused | Remove scan |

`updateOne` goes through the existing-subject value commit and causes none of
these four scans. An active transaction retains the removed lifetime, so the
reclamation frame is absent during the measured interval: three scans instead.
These are actual cache misses, not merely four method calls. Each structural
change invalidates the cached key list before the next call.

No full inventory fact is required. I1 checks the staged instructions for fresh
creation and reads `lastActiveKey()` only when needed, before record cloning at
the original sampling boundary. It advances the local subject tail exactly as
D2 did for subsequent fresh instructions. The initial anchor may belong to a
subject removed earlier in the same staged frame; I1 deliberately preserves that
pre-state fact. Zero and empty-string keys are handled by explicit undefined
checks. The frame search scales with touched instructions, not collection size.

## Why zero scans remains the contract

Commit `4ce48aa50877e436dcb41cd239816b5dd39ba4f0` introduced the v16 reader and
preserved the v15 point-delta tests from `012fd11d` (original work
`cf98697a` / `172a8268`). Its recorded rationale is: “the inventory is installed
on demand and deltas are computed only while a reader listens.” The reader
retains no history and installs no transaction/restoration capability.

The unchanged test `entity-membership-capture.spec.ts`,
“point deltas never scan an inventory of %s rows,” subscribes without requesting
inventory, performs the four point writes at 1,000 and 10,000 rows, requires
three events and zero snapshot calls. Baseline passed11/11; D2-derived OAP and
pre-publication T1 failed exactly these two cases in the preserved parent packet.
`06173c99` records pre-state neighbor-subject anchors; `67eadea6` records shared
cached ids and no invalidation for field-only changes. Neither requires a new
inventory scan for point responsibility preparation. No counterexample to this
requirement was found, and no replacement contract is proposed.

## Fixed-work measurement

Node24.15.0, pnpm10.17.0. Four writes at each size. Reader callbacks record deltas
without requesting inventory. Initial population, validation, confirmation and
teardown are excluded. Active mode includes transaction creation/completion,
but not settlement. A direct read outside measured work proves the field write
reached2 before removal. Full final state, ids, membership and three events are
asserted. Full source/bundle hashes and stacks are in
`measurement-evidence.json.gz`; readable counts are in `measurement-summary.json`.

| Initial rows | D2/OAP visited keys, no capture | D2/OAP visited keys, active capture | D2I/OAPI visited keys, either mode |
| ---: | ---: | ---: | ---: |
| 100 | 402 | 302 | 0 |
| 1,000 | 4,002 | 3,002 | 0 |
| 10,000 | 40,002 | 30,002 | 0 |
| 30,000 | 120,002 | 90,002 | 0 |

Baseline also has zero visits. I1 has two lastActiveKey calls and three
neighborSubjectsForKey calls at every size in either mode; these are named
counters, not every index operation. Frame commits/instructions/touched-subject
incidences remain4 without capture and3 with capture. `snapshotActiveOrder`
records zero walks. visitedKeys derives from inspected one-push-per-node
snapshot implementation on cache miss; it is not an independent instruction
counter. This establishes the targeted collection scan removal, not a timing,
package-size, settlement-cost or total-complexity claim.

## Focused verification and independent review

- Unchanged membership: D2I11/11 and OAPI11/11.
- OAPI ordering cases112/112; four-framework4d+4e72/72.
- Prior Vue selection/projection/callback cases9+13+8; kernel selection,
  structural transition, tap-read/replay-tap6+8+13+8. Total271 executed Nx cases
  across18 invocations, with32 unrelated skipped framework cases.
- All39 valid prior portable OAPI controls pass (includes D2's13).
- D2I alone passes the same13 capture/inspection/refusal/retry/reentry controls.
- New anchor probe: D2 and D2I each32/32; empty/0/empty-string tails, fresh batches,
  removed/rekeyed tail and new lifetimes, normal/injected capture, rollback and
  confirmation. Each lane executes98 injected rich-capture-failure hits.
- Independent review found no I1 semantic blocker. Root verified the source
  claims and strengthened useful-update validation as requested. See REVIEW.md.

D2 means the original capture patch chain plus the separate readonly T1 fix;
D2I adds only I1. OAP includes D2,S1,M1,A1,T1,OA,PS; OAPI adds only I1.
The runner constructs exact baseline overlays. Runtime files used by Nx are
backed up and restored byte-for-byte; source hashes are recorded.

## First results, execution errors and approval history

The prior two membership test failures remain in the prepared-selection packet.
The first measurement invocation could not bundle the internal entry point;
`point-work-first.json` preserves it. The runner alias was corrected without
changing production code. Independent review then strengthened update validation;
the initial probe/runs remain preserved. Four callback invocations used incorrect
mode spellings and failed the probe's unknown-mode assertion before execution;
`previous-controls.json` preserves these, and `callback-controls-corrected.json`
records all four correctly named runs passing. These are invocation failures,
not four runtime counterexamples.

The previous automatic approval-review rejection remains separately recorded in
`prior-approval-rejection.json`: broad OAP suites were NOT EXECUTED because the
membership gate was red. This turn's newly requested broader verification became
eligible only after that unchanged gate and prior focused controls passed.
A new approval was granted. Its results are recorded separately below.

## Replay

From this worktree, with repository Node/pnpm versions:

```sh
node docs/research/membership-point-work-0/run.mjs D2 point-work.mjs off replay
node docs/research/membership-point-work-0/run.mjs D2I point-work.mjs off replay
node docs/research/membership-point-work-0/run.mjs OAPI point-work.mjs active replay
node docs/research/membership-point-work-0/run.mjs D2I anchor-controls.mjs suite replay
```

Other measurement lanes: base,D2,D2I,OAP,OAPI; modes off,active. Use a fresh label
for each replay to preserve existing outputs. Exact focused Nx commands and
runtime manifests: nx-focused-summary.json and nx-focused-records.json. Portable
commands: previous-controls.json (correct four mode spellings via the corrected
record), d2-controls.json and anchor-summary.json. Tests are unchanged.

## Broader verification: separate D2 counterexample

Broader kernel verification exposed previously untested capture-chain failures.
The smallest reduction preserves existing assertions from absent-path-write and
branch-omission-correctness:

```ts
const tree = signalTree(
  { user: { name: 'Ada', age: 42 } },
  { enhancers: [transactions()] }
);
tree.$.user({ name: 'Ada' });
const pending = tree.transact(() => tree.$.user.age(50));
pending.rollback();
// Existing contract: keys are ['name']; held user.age() reads undefined.
```

The replay includes the existing microtask flush points and three enhancer
orders, plus the existing age-write-then-parent-omission case. It makes useful
writes and uses no fault injection. Baseline passes4/4. D2,D2I,OAP,OAPI each
fail4/4 identically. First rollback throws `SIGNALTREE_ROLLBACK_FAILED` with
“Installed operation lacks a matching settlement disposition”; the speculative
age50 remains, pending count1 and open scope remain, and retry refuses with the
same error. The other case retains speculative `{name:'Grace'}`. Assertions
are unchanged. Full outputs/source hashes: omitted-leaf-evidence.json.gz;
compact commands/results: omitted-leaf-summary.json.

The refusal originates in D's installed-operation disposition validator. D2's
scalar terminal journal plus D's comparison now rejects legitimate omission
rollback. The precise mismatched effect fields have not been traced; this is
not a proposed repair. Independent interpretation review verified the raw
results. The scalar-only trigger and five-lane comparison separate this capture
regression from I1 and the publication candidate.

This is an ordinary-input **explicit refusal with retained authority**, whereas
the original fault-injection result was **false successful settlement with lost
authority**. The original injected capture failure still has no established
ordinary-input trigger. Neither capture correctness nor full integration is
accepted. The publication repair stays separately identifiable and unchanged;
no additional capture repair is included in this membership task.

```sh
node docs/research/membership-point-work-0/run.mjs base omitted-leaf-replay.mjs suite replay
node docs/research/membership-point-work-0/run.mjs D2 omitted-leaf-replay.mjs suite replay
node docs/research/membership-point-work-0/run.mjs OAPI omitted-leaf-replay.mjs suite replay
```

Baseline exits0; the unchanged candidate acceptance assertions exit1. Exit1 is
intentional preservation of the counterexample, not a weakened expected-failure
assertion. D2I and OAP are additional comparison lanes.

The full OAPI kernel command (`NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test kernel --maxWorkers=1`) reported24 failures across10 files, then remained
busy without further output until its600-second cap. The owned process group
was terminated (exit-15). This run is **incomplete**: there is no final suite
pass count and no claim that24 is the full failure total. The stalled case was
not localized. `nx-broader-evidence.json.gz` preserves the full log, executed
script, source identities, new approval context and exact backup/restoration
hashes; `nx-broader-records.json` and the observed-failure index are readable.

A bounded Nx rerun selected exactly those24 reported failing cases, using the
same tests and assertions. Baseline passes24/24; D2I fails24/24, with185 unrelated
cases skipped in each run. Thus none of the24 observed failures are baseline
failures, and they reproduce before publication changes. Complete commands,
selected filenames/regex, raw logs and restoration hashes are in
`nx-failure-attribution-evidence.json.gz`; commands/hashes are also readable in
`nx-failure-attribution-records.json`. All temporary runtime files were restored.

Full Vue/Angular/React/Solid suites, new typecheck/spec-types/lint runs, package
and demo builds/measurements were **not executed** after this new failure. Their
status is distinct from both the actual kernel failures and the prior automatic
approval rejection. Existing focused framework results remain valid; they are
not full-suite sign-off. No ceilings, v15 code, APIs or prior candidate patches
were changed. No runtime integration, push, merge, tag or publication occurred.

Final attribution also ran the same24 cases on original D2+T1 **without I1**:
24 fail,185 skip, matching D2I and the observed OAPI set. The24 regressions
therefore predate both the scan correction and publication repair. See
`nx-original-d2-records.json` and `nx-original-d2-evidence.json.gz`. Exact runtime
restoration was verified again. The evidence commit contains only this packet;
90738bbe and all prior candidate patches remain unchanged.
