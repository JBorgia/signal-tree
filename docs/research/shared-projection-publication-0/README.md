# Shared projection publication: S1 is incomplete

Runtime baseline: `19a5bd034d5ebef262f637c397bb41fe50a6a1e3`.
Starting evidence checkpoint: `de94a7ab277f4bf59dac3c568fba61db2ff104b1`.
D2 and P3 patches, failures and reviewed results are unchanged. This checkpoint
adds permanent regressions and evidence, not an accepted runtime or SDK change.

## Inventory and candidate

[Inventory](INVENTORY.md) was recorded before implementation and independently
checked against public declarations and runtime. It includes versioned queries,
plain derived chains (`empty`, `activeEntity`, configured slices), selection,
held rows, fields and readonly views. Application-created native computed values
remain outside this owned-projection inventory and retain native timing.

The preimplementation premise review demonstrated a possible existing boundary:
one adapter-owned publication ref, with per-token native computed selectors
returning that token's revision. S1 increments changed revisions, then triggers
publication once after the grouped callback. Vue can dirty the dependency chains
in one native batch; selector equality prevents unchanged branches from
recomputing their public projections. It uses public Vue APIs and the existing
adapter SDK. No per-projection read fallback, new SDK argument, or application
workaround was introduced. [S1.patch](S1.patch) preserves the experiment.

The first implementation retained `revision.value` in one writable token's
observer even though the new helper exposes `read()`. Typechecking and an
independent token-subscription probe both rejected it. The first patch, logs and
raw failure are retained. Correcting the property reference did not change the
hypothesis or any assertion. All results identified as corrected use the final
patch; source manifests distinguish earlier runs.

## Coherence matrix and results

Permanent tests live in the shared `transaction-realization-contract.ts`, its
four framework wrappers, and Vue's `entity-projection-publication.spec.ts`.
The original `review-empty` and `review-active` assertions were transferred
unchanged, with explicit nonempty observer checks added. Their original raw
probes remain unchanged and runnable from the earlier evidence packet.

| Dimension | Coverage / result with corrected S1 |
| --- | --- |
| all public owned projections | ids, all, count, empty, asMap, has, where, find, configured slice, activeId, activeEntity, direct row and field |
| add/remove/field restoration | six shared cases per framework, primed and first projection read during delivery |
| selection | selection-clear publication after successful settlement; separate surviving selection switch while pending |
| cache and dependency chains | primed/unprimed; sorted ids/where/find; configured computed slice; held readonly view; primed but unobserved read |
| reentry | reads inside nested authored group retain existing native cache timing; nested writes survive and confirm; multiple trees sharing one adapter |
| unchanged values | array/object identity, getter counts, unrelated branches, dynamic dependency cleanup and selected-row narrowing |
| native errors | first Error/undefined handling, sibling delivery and recovery |
| four-framework shared matrix | **each framework: 5 pass, 1 fail** — primed removal/rollback |
| strengthened dedicated Vue matrix | **12 pass, 1 fail**, same primed removal/rollback |
| prior original publication and P/P2/P3 killers | all six portable probes pass |
| D2's original thirteen controls on DS1 | **13/13 pass**, unchanged inputs/assertions |
| independent adapter/dependency probes | **8/8 pass**, primary agent replayed exact S1 overlay |
| compatibility/types | source typecheck and spec-types pass; unchanged SDK, no ratchet updates; framework spec typechecks pass |

The unchanged baseline first dedicated Vue matrix reported 8 failures/5 passes.
Its first invocation had test-type errors and never reached runtime; both logs
are preserved. Initial corrected S1 focused run reported 24 passes, but that
number included a flawed oracle in the dedicated matrix: it compared delivery
against another final derived read, allowing a persistently stale `activeEntity`
to pass. The independent shared matrix used explicit installed-state expectations
and caught it. The dedicated oracle was strengthened to explicit expected values
for every field and final reads: 12 pass/1 fail. The exact prior test file and
both results are preserved; the initial green is not acceptance evidence.

One reviewer reentry probe incorrectly demanded a particular value from a dirty
native computed first read inside a nested group. It also fails exact baseline.
Its v2 warms the held read before entering the nested body, then asserts identity
preservation. Both the failed premise and corrected baseline/candidate controls
are preserved; this does not impose fresh native computeds inside grouped work.

Concurrent test-name-only Nx commands imported unrelated spec files and slowed
the host. Completed Vue/React/Solid runs are retained; the remaining Angular
process tree was specifically identified, stopped, and replayed with filename
and one worker. The primary Vue run completed before its attempted stop; PID
verification prevented killing a different process. No unrelated process was
terminated. Full package suites were not executed. Before/after runtime hashes
for the four-framework matrix match.

## Decisive counterexamples and independent interpretation

For baseline and S1, ordinary inputs produce:

1. Create row A, select A, and prime `activeEntity` in an observer.
2. Contribute scalar 1 and removal of A; allow the observer to read the absence.
3. Roll back: scalar and row A restore, with `activeId` still A.
4. Both delivery and final reads keep **`activeEntity` undefined**.

This reproduces across Angular, React, Vue and Solid in the shared matrix.
Primary portable replay independently reproduced baseline and S1. It is a
persistent missing dependency, not just a transient Vue computed cache.

`activeEntity` reads `activeIdSignal`, then `readEntityByKey`. While the row is
absent, subject resolution fails and the fallback `presentEntity` reads physical
membership without observing a membership dependency. Re-evaluation drops the
old subject dependency. Restoring A changes neither the unchanged active-ID
location nor another remaining dependency, so the derived cache stays empty.
Shared publication cannot notify through a dependency no longer present.

**D2/DS1 have a different failure on the same replay.** Their final row and
scalar are restored, but **activeId is also undefined**. The first assertion
fails on lost selection, before the active-entity assertion. They must not be
reported as the identical missing-dependency result. This is new compatibility
evidence alongside the still-valid thirteen passing capture controls. Source
inspection identifies prepared transition selection handling as a relevant
route: it derives the post-transition selection from a currently resolved
selected subject; a missing subject yields undefined. The precise capture-route
causality has not been separately instrumented here. D2 is unchanged.

The independent reviewer caught this distinction in raw stdout; the primary
agent verified it and kept the results separate. JSON omits undefined fields;
absence of `active` or `activeId` in these traces has that meaning.

## Architectural options, without another API

The experiment establishes that one shared native publication boundary can fix
the previously reproduced serial-delivery failures, including P3's omissions.
It does **not** establish a complete repair: the projection inventory also
requires correct dependency coverage while a selected key is absent.

1. **Conditional missing-key membership dependency** is the narrow next
   hypothesis: follow the existing `byId` behavior while absent, retaining
   selected-subject dependency while present. This preserves the deliberate
   selected-row granularity and needs no new SDK port. It still requires tests
   for absence, restoration, key reuse, selection and dependency cleanup.
2. **A stable key token** could express appearance directly, but adds token
   lifetime/allocation responsibilities; there is no evidence here that it is
   necessary.
3. **Blanket collection dependency or forced recomputation** would reverse
   deliberate selected-row granularity and memoization; it is not justified by
   this counterexample.

D2's selection-preservation difference needs its own bounded disposition before
combination acceptance. No additional repair or API was added. This result does
not prove all shared boundaries impossible, falsify atomic capture in principle,
or turn original injected capture failure into an ordinary-input trigger.
Shared-root internal selector polling cost remains unmeasured.

## Replay and disposition

S1 runtime was restored after testing; only its patch remains. The permanent
regressions intentionally remain red on current runtime. No broader suites,
bundle/demo measurements, API acceptance, runtime merge, push or publication.

```sh
node docs/research/shared-projection-publication-0/run.mjs base review-active-restoration.mjs suite replay
node docs/research/shared-projection-publication-0/run.mjs S1 review-active-restoration.mjs suite replay
node docs/research/shared-projection-publication-0/run.mjs D2 review-active-restoration.mjs suite replay
node docs/research/shared-projection-publication-0/run.mjs DS1 review-active-restoration.mjs suite replay
node docs/research/shared-projection-publication-0/run.mjs S1 review-empty.mjs suite replay
node docs/research/shared-projection-publication-0/run.mjs S1 review-active.mjs suite replay
```

Expected exits: **1,1,1,1,0,0**, with the two different final-state failures above.
The runner loads exact baseline Git objects into a fresh overlay per invocation;
S1 never includes D2, DS1 explicitly does. Labels cannot overwrite completed
runs. `corrected-replays.json` supplies all 27 exact passing replay commands,
including the thirteen DS1 controls and eight independent probes.

To repeat the shared matrix with S1, apply `S1.patch` in a clean isolated checkout
of this evidence checkpoint, then run one framework at a time:

```sh
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test vue transaction-realization.spec.ts --testNamePattern='4d owned projection' --maxWorkers=1
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test angular transaction-realization.spec.ts --testNamePattern='4d owned projection' --maxWorkers=1
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test react transaction-realization.spec.tsx --testNamePattern='4d owned projection' --maxWorkers=1
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test solid transaction-realization.spec.ts --testNamePattern='4d owned projection' --maxWorkers=1
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test vue entity-projection-publication.spec.ts --testNamePattern='Vue entity projection publication' --maxWorkers=1
```

Each shared command has 5 pass/1 fail; the dedicated command has 12 pass/1 fail.
[First results](first-results.json) retain raw output and manifests;
`inputRecords` indexes [source inputs](source-inputs.json). The first temporary
review runner uses `base` for current source, so its manifests, not that label,
identify the candidate; primary portable runs use unambiguous exact lanes.
Original logs/bundles remain under the recorded temporary paths. Tracked logs
normalize line endings only. Independent premise, omission and interpretation
reviews are claims checked against these executable results and source paths.

Final independent record review verified the 27 corrected exits, restored runtime,
and separate missing-dependency/selection-loss interpretations. It found no
material overclaim. The architectural options remain hypotheses, and the next
repair is not implemented or accepted by this evidence checkpoint.

The staged check flagged whitespace in a copied whole-host process inventory.
That unrelated inventory was excluded entirely; only experiment process-control
evidence is retained. Original operational files remain in the temporary directory.
