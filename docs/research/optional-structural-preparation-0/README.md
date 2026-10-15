# Optional structural target preparation

## Disposition

Preserve the bounded structural-planner split as a development candidate. It
removes optional full-target planning from plain EntityMap bundles while the
StructuralStore remains the sole installation authority. Leave the tiny
EntityValueStore map-copy routine intact: this investigation has not established
that another access seam is worthwhile. No public API, budget, framework timing,
settlement policy or release approval changes.

Baseline: `5c29bcebe2d3e04a378b7fe1bf896091d223c833`, clean before this experiment.
Candidate runtime files and a patch against that baseline are archived below.
Original candidates remain in Git history. This is a size/placement experiment,
not a new proof of the entire capture/publication architecture.

## Mechanism and limits

`StructuralStore.prepareTarget` supplies its current lifetime/revision maps to
the trusted optional `prepareStructuralTarget` function. The function validates
and builds detached target maps and linked nodes; `installPreparedTarget` is
unchanged. Only the outer entity-target preparer imports the function at runtime.
The store's import is type-only. Values, membership, selection, callbacks,
publication and target-preparation order are unchanged.

The maps are readonly typed live views, not a runtime sandbox. The production
caller supplies normalized subject records and internal order arrays. Do not
extend equivalence to arbitrary hostile getters, replacement preparers or
subclasses overriding `subjectRevision`: the new helper captures the map views
once per preparation. No public callback/plugin seam is introduced.

Relevant frozen constraint from `docs/contributor-contracts.md` at the baseline:
“Framework packages may realize SignalTree truth for their runtime. They must
not create another state authority.” This extraction remains inside the kernel,
with no shadow authority or process-global registration.

## Fresh artifact evidence

Node 24.15.0, current repository Rollup configuration, explicit write/close build
wrapper; esbuild browser ESM, minification, explicit `ngDevMode=false`, gzip9.
The archive contains complete before/after built graphs, hashes, fixtures,
metafiles and the generating script. Baseline graph is the prior experiment's
archived candidate graph, whose matched fixture reproduces exactly here.

| Same behavioral consumer | Before gzip bytes | After gzip bytes | Change |
| --- | ---: | ---: | ---: |
| Plain EntityMap | 26,447 | 26,124 | −323 |
| Transactions + restoration | 74,292 | 74,287 | −5 |

Both fixtures assert final row, order and scalar values. The new preparation
module is absent from plain output and present in enhanced output. Its absence
by filename in the baseline is not an absence claim: its code was inline there.
The independent gate fixtures differ from these behavioral fixtures:

- Bare: 11.64 KiB production / 13.99 KiB development, unchanged.
- Entities: 25.46 KiB production / 28.22 KiB development.
- Production demo: 563.16 kB initial (prior split 563.17 kB).

**Bundle and demo gates still fail their unchanged ceilings.** No waiver is
implied. Build exit 0 retained existing TS4111 Rollup warnings in the unrelated
semantics-composition fixture; it is not a claim of warning-free compilation.

## Validation and first failures

- Five full Nx suites exit 0: kernel 5,742 ordinary passes, 12 expected failures,
  12 skips; Angular 237 passes/3 skips; React 74; Vue 172; Solid 104.
  Total 6,329 ordinary passes, 12 expected failures, 15 skips.
- Three added structural controls ran separately after the full suite started:
  inactive lifetime/revision preservation, preparation after prior installation,
  typed keys, unchanged allocation, and malformed-target refusal; 3/3 pass.
- A deliberate mutation dropped inactive records from the copied map: 1 failed,
  2 passed, exit 1. Restored implementation: 3/3, exit 0. First red preserved.
- Independent implementation reviewer ran four additional falsifiers, all pass;
  their source and report are retained. They are not counted in the full suites.
- Source types, spec types, lint, API inventory and callable inventory exit 0.
- Extra built devmode check exit 1: kernel folding passed, then absent Angular
  dist stopped facade checks. This temporary checkout built kernel only.
  Separately labelled `--source-probes` exit 0 across all frameworks; that does
  not replace built-package qualification. No source fix or retry-to-green.
- No full release gate run, packed consumer qualification, merge or publication.

## Bounded cost evidence

24 fresh Node processes: six paired rounds × before/after × rollback/confirm,
seeded ordering, 16 rows, 500 warmups and 5,000 measured operations per process.
Each operation asserts scalar, every row, order and pending count. Rollback
executes preparation 5,500 times; confirmation is a zero-preparation control.
Artifact inventories match before/after the run. Exact commands, timestamps,
exit receipts, scripts, Node/V8/platform and load readings are retained.

| Measurement (after / before) | Paired median | Paired range |
| --- | ---: | ---: |
| Rollback wall | 0.9976 | 0.9761–1.0129 |
| Rollback CPU | 0.9964 | 0.9677–1.0476 |
| Confirmation wall | 1.0005 | 0.9485–1.0513 |
| Confirmation CPU | 0.9886 | 0.9585–1.0487 |

Post-GC whole-process heap-delta medians: rollback 268,904→272,828 bytes;
confirmation 230,152→230,496 bytes. These are not journal dominator sizes or
steady-state leak bounds. Timings include assertions, reads and incidental GC;
they exclude setup, warmup, explicit GC and deferred flush. Host was not certified
quiet, no A/A calibration was run, and only one workload was measured. Results
show no clear timing regression in this workload, not universal neutrality or a
production latency claim. Nothing was pooled with the prior split's samples.

## Replay

Extract the archive into a fresh directory. Its SHA-256 is recorded below and contents manifest is
inside the archive. With current dependencies available, run:

```sh
node compare-bundles.mjs
```

The generator uses the root repository's installed esbuild and frozen archived
artifact graphs; it verifies behavior, records output/input hashes and confirms
optional module placement. Cost replay refuses to overwrite samples: copy
`cost/measure.py` and `cost/cost.mjs` to a fresh sibling directory alongside
`baseline-kernel/` and `candidate-kernel/`, then run `python3 <new>/measure.py`.
Node path is explicit in the driver. Timing outcomes are not deterministic.

For source replay, archive the baseline commit to a fresh checkout with current
pinned dependencies, apply `candidate.patch`, then use Nx:

```sh
pnpm nx test kernel --testFile=packages/kernel/src/lib/physical/prepare-structural-target.spec.ts
pnpm nx run-many --target=test --projects=kernel,angular,react,vue,solid --parallel=1
pnpm run typecheck
node tools/check-spec-types.mjs
```

The archived independent review spec can be copied into the same physical test
directory and run with Nx. `build.mjs` records the exact executed temporary-root
build; adjust its root for replay. Budget/demo commands and raw outputs remain
in the archive. The source patch does not alter ceilings.

## Retained record

Archive: `store-preparation-split-2026-10-14.tar.gz` (694,584 bytes).
SHA-256: `6bea9c8058de6c1956a70bcb61be5ab50fae4b048c33a114148fc4c4a211c569`.
All 322 manifest entries were verified by reading the completed archive back;
`manifest.json` is the additional archive entry. Source inventory found only the
two intended changed baseline files; the new planner and test are recorded in
`candidate-source/` and `candidate.patch`. Independent raw run log is included.
Review reports are also copied alongside this record for convenient inspection.

The independent interpretation review verified all 24 cost receipts, raw summary
calculations, generated bundle/input hashes and the baseline graph's equality to
the preceding experiment's candidate. Its limitations remain binding; preserving
this candidate does not approve revised ceilings or production release.
