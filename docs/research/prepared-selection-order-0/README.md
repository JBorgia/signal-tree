# Prepared selection: installation before delivery

Evidence parent: `c267fe446c37d29dccf3b80d6deb44e767abc864`.
Exact runtime baseline: `19a5bd034d5ebef262f637c397bb41fe50a6a1e3`.
Separate readonly-only source fix: `40866f1292e2f86b86bd98951db6020960fd1163`.
D2/S1/M1/A1 and every prior failing replay remain unchanged.

**The publication repair survives the focused selection, projection and callback
controls. The combined candidate is not accepted:** a separate D-chain
membership-scan regression remains. No DSK1 runtime integration or new API.

## What the trace established

`order-trace.mjs` retains the callback assertions while non-mutating source hooks
record selection preparation, the native binding's physical write, row-target
installation, completion of the whole prepared unit, callback writes, native
publication and observer execution. Only registered selection locations are
recorded. The hooks do not issue writes or refresh computed values. Manifests
retain both original and instrumented source hashes.

DSK1's observed rollback order is:

1. Prepare selection X→A.
2. Install row targets; mark prepared unit installed.
3. Run `onRemove(D)`; callback physically writes C.
4. Prepared publication physically writes saved A over C.
5. Publish the selection location; observer sees A.

Selection was omitted from physical installation even though rows and scalars
were installed. The defect is therefore a late prepared write, not stale value
comparison or an ordinary missing callback notification.

OA moves selection into each collection's physical install. The existing target
loop installs **all** collections/scalars before publishing **any** collection,
so cross-collection callbacks also run after prepared selection installation.
Observed order becomes prepare X→A, install rows and A, complete prepared unit,
callback writes C, native publication, observer sees C. No saved selection write
remains after the callback. Moving it only to the start of each collection's
publication would leave a cross-collection race; that is not OA.

OB retains deferred publication and records private per-selection write identity
through the existing `interceptLocationWrites` port. Every write attempt advances
revision, including a no-op or ABA sequence. It suppresses the stale saved write
when preparation's revision no longer matches. Its trace has no physical A write
after callback C. This is additional local bookkeeping, not reuse of a global
clock that already covers selection: existing tree/subject physical revisions
and scalar ownership do not cover this auxiliary location.

OA and OB both pass the unchanged C and C→X falsifiers. The value-equality guard
from the prior packet remains rejected. B demonstrates how to protect deferred
work; A removes this deferred selection write and needs no new revision state.
Neither result establishes all possible preparation-time reentry. Independent
review did not establish a supported ordinary-input trigger changing selection
between this preparation and installation; that remains a limitation, not a
claim that such a window is impossible.

## First throwing-callback failure and bounded correction

Both OA and OB fail the first throwing-callback controls. D2-derived publication
stops at a throwing replay tap before `updateSignals()`, leaving collection
queries speculative after physical restoration. In the independent
cross-collection reproduction, physical A is restored and X/D are absent, yet
`ids()` still reports X/C/D and `all()` retains D. Selection C and the exact
callback error survive; retry succeeds without repairing those queries.

Baseline passes that probe's final-state assertions, but still exhibits its
previously established transient serial-publication incoherence. DSK1 has the
persistent cache failure plus selection loss. These are separate claims.

PS, appended to OA as **OAP**, stages all changed subject epochs/binding
dependencies, collection invalidation and physical revision before delivering
path notifications or replay taps. Existing grouping controls native delivery.
This is required for all subject dependencies, not only collection version:
independent review supplied a case where a tap throws before a restored
subject's later publication entry. OA fails; OAP refreshes its primed readonly
field and keeps every owned query coherent.

The proposed ordering change was recorded in CONTRACT.md before implementation.
Callback order and stop-on-first-throw within a collection remain unchanged;
sibling prepared publishers still complete, as in the existing target loop.
First thrown Error and `undefined` are preserved. Native held/computed freshness
inside a grouped callback is not forced. Existing callback-read and replay-tap
suites pass; observer snapshots are asserted only when observers actually run.

The new permanent Vue spec has eight cases: C, C→X, C→A (original pretransaction
value), nested scalar/row writes, Error throw, undefined throw, selection of a
subsequently removed row, and cross-collection callback failure. It checks
callback execution, every owned observer snapshot, final state, same held
lifetime, authority/scope retirement and a successful nonmutating retry.

For these postcommit callback failures, settlement has physically completed;
existing semantics retire authority and rethrow the callback's first failure.
This differs from precommit refusal, whose pending authority must survive.
The prior refusal/recovery controls remain unchanged and pass.

## Separate readonly correction

T1 changes only `let addedSubjectIds: number[]` to
`let addedSubjectIds: readonly number[]`. It matches `planFreshSubjectIds` and
leaves indexed reads intact. No cast removes readonly guarantees. That source
annotation is the only runtime-file change committed locally in this task;
D2 and publication implementations remain experimental patches.

Before T1, React/Vue/Solid Nx invocations stopped at TS4104 before Vitest. They
remain recorded as **not executed**. With T1, all four 12-case 4e targets and the
six kernel lifetime cases actually execute and pass. Spec types also pass on
the restored baseline with the readonly annotation.

## Focused results and remaining blocker

All runs use Node24.15.0/pnpm10.17.0; exact commands, source hashes, before/after
restoration hashes and full logs are in `nx-records.json`.

| OAP check | Result |
| --- | --- |
| Four-framework unchanged 4d+4e matrix | 18 each; 72 pass |
| Vue prior selection / projection / new callback specs | 9 / 13 / 8 pass |
| Kernel selection / declarative structural transition | 6 / 8 pass |
| Kernel tap-read / replay-tap boundaries | 13 / 8 pass |
| Kernel entity membership capture | 9 pass, **2 fail** |
| Prior portable publication/capture/inspection/refusal/retry/reentry controls | 27 pass, including D2's 13 |
| Original C and ABA falsifiers | both pass |
| New callback modes | all 7 pass |
| Independent cross-collection normal/throw, diagnostic, later-subject probes | all pass on OAP |

Membership first failures: at both 1,000 and 10,000 rows, the existing test
requires zero `StructuralStore.activeKeysSnapshot` calls for point changes;
the candidate makes four. Focused attribution runs the unchanged spec:

- Exact baseline: 11 pass.
- T1 (DSK1 plus readonly correction, without OA/PS): 9 pass / same 2 failures.
- OAP: 9 pass / same 2 failures.

The regression predates this selection/publication repair. Source evidence
points to D.patch's unconditional `activeKeysSnapshot()` in `commitEntityFrame`
when preparing operation records. We did not rewrite capture, weaken the
zero-scan assertion, or raise a ceiling to pass it. These are operation-count
observations at the specified workloads, not fresh package-size or timing claims.

Automatic approval review rejected the proposed full kernel/framework suite
command because the known membership failure means the candidate has not passed
the broader-verification gate. No broad suite executed or was retried. The raw
rejection and allowed focused attribution are preserved. Full typecheck, candidate-wide spec-types acceptance, lint, package/demo
measurements and integration acceptance are not claimed by these focused
results. The restored-checkout Vue spec-type pass has its explicit command and
exit in `readonly-spec-types.json`.

## Independent review and disposition

Premise review compared the prepared target loop, ordinary rekey installation,
existing callback-write semantics, and `f2f34753`/`24bf060c` history. It identified
the cross-collection ordering requirement and absence of an applicable existing
selection revision. It also raised the unproven preparation-time window.

Correctness review independently reproduced the OA/OB throwing-callback defect
and supplied the later-subject invalidation test. Primary replays verified those
results and OAP's survival. The reviewer found no additional blocker in the
bounded OAP publication change; existing tap timing checks subsequently passed.
A final independent record review verified the 98 replay index, Nx counts,
restored runtime and membership attribution; its requested distinction between
restored-checkout spec types and candidate-wide type acceptance is incorporated.
That finding does not approve the D-chain scan regression or prove complete
responsibility capture. Original controlled capture-fault results remain
separate from these ordinary callback-input counterexamples.

The preferred publication mechanism after these tests is complete selection
installation plus complete invalidation staging before callbacks. OB remains
a comparison experiment; its first failure is preserved, not waived. No claim
is made that revision protection is generally unnecessary for other deferred
work. Selection ordering and responsibility-capture correctness remain separate.

Final checkout retains only the readonly source fix and permanent test/evidence
additions. No selection/publication/capture runtime candidate is integrated. No
API change, v15 change, merge, push, tag or publication. The final evidence SHA
is recorded in the delivery message and Git history.

## Exact replay

From the repository root with dependencies installed, choose an unused label:

```sh
node docs/research/prepared-selection-order-0/run.mjs DSK1 review-selection-reentry-mixed.mjs suite replay
node docs/research/prepared-selection-order-0/run.mjs OA callback-controls.mjs callbackthrows replay
node docs/research/prepared-selection-order-0/run.mjs OB callback-controls.mjs callbackthrows replay
node docs/research/prepared-selection-order-0/run.mjs OAP callback-controls.mjs callbackthrows replay
node docs/research/prepared-selection-order-0/run.mjs OAP review-selection-reentry-aba.mjs suite replay
node docs/research/prepared-selection-order-0/run.mjs OAP review-order-late-subject.mjs throw replay
node docs/research/prepared-selection-order-0/run.mjs OAP order-trace.mjs C replay
```

Expected exits: `1,1,1,0,0,0,0`. The runner always starts from exact baseline Git
objects in a fresh temporary overlay. `T1`, `OA`, `OB`, `PS` are distinct patches;
OAP includes D2+S1+M1+A1+T1+OA+PS, while OB substitutes its private revision guard
for OA/PS. No runner mutates checkout source. Completed labels cannot be reused.

`unchanged-first.json`, `callbacks-first.json`, `publication-staging-first.json`,
`order-first.json`, `previous-controls.json` and `independent-review-replays.json`
index 98 primary runs. `raw-replays.json` preserves stdout/stderr/manifests and
bundle hashes; `source-inputs.json` indexes original and loaded source hashes.
Raw bundles remain at the recorded temporary paths. Nx commands are retained
verbatim, for example the four-framework shared matrix uses:

```sh
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test vue transaction-realization.spec.ts --testNamePattern='4[de] ' --maxWorkers=1
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test kernel --testFile=packages/kernel/src/enhancers/restoration/entity-membership-capture.spec.ts --maxWorkers=1
```

Those commands require the corresponding isolated candidate overlay described
by their logged runtime hashes. Running them on the final checkout instead tests
the restored baseline plus readonly annotation, whose new regressions remain
intentionally red.
