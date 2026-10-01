# Performance takeover — October 1, 2026

This is a local verification record, not release approval. Baseline public source:
`f59dba9e`, branch `fix/v15-link-settlement-diagnostics`. Raw execution evidence:
`/private/tmp/st-takeover-2026-10-01/` (machine-local, not a portable CI artifact).

## Independent review and reproduced failures

- Reentrant `setAll` reused pre-callback key/identity associations. An update
  interceptor rekeyed `a` to `b`; the outer operation returned with `has(b)` true
  but empty `ids` and zero count. `reentry-valid-red.log`: three failures across
  this and the two removal tests, fourteen controls passed.
- `removeOne` and `removeMany` sampled observer demand before their interceptors.
  Observers installed before the actual removal therefore received no write.
- A second adversarial review found selector-driven rekey without interceptors
  escaped the initial guard. `selector-red.log`: one failure, eleven controls
  passed. Final staging validation includes those callbacks too.
- The first repro setup omitted a required notifier and was invalid; it was
  corrected before drawing the membership conclusion. Two later test assertions
  incorrectly expected rekey to rewrite row data; existing key-only semantics
  were preserved and those expectations corrected. All intermediate logs remain.

The correction refuses stale outer topology staging before commit, preserves
completed callback writes, and samples removal demand after callbacks while
pre-removal neighbours remain available. The focused final suite passes 22/22.
No public export or transaction policy changes are involved.

## Scaling evidence

The old best-of-three wall-clock ratio was replaced with a deterministic guard
for the historical repeated `findIndex` neighbour search. Both 130,000-row
correctness controls remain. The guard runs plain and restoration-observed
replace/clear paths; undo proves observation is non-vacuous.

`node tools/verify-setall-neighbour-search.mjs` uses isolated source copies:
control nine passed; payload-search mutant four expected failures; staging-search
mutant eight expected failures. At 256/1,024 rows the bad searches visit
32,896/524,800 elements, exceeding the fixed 256/1,024 bounds. This is a proof
against that specific regression, not a universal complexity guarantee.

## Validation checkpoints

- Unchanged inherited source: kernel 3,205 passed; four framework suites, root
  typing/source checks, and package lint passed.
- First repair (before selector extension): kernel 3,219 passed, four framework
  suites passed, root checks and lint passed, packed strict consumer types passed.
- Spec-type gate caught a possibly-undefined reference in a new assertion;
  corrected without weakening the assertion. The corrected gate exits zero.
- Initial sandboxed package build stalled and was interrupted (exit 130).
  Serial build using the shared installed toolchain completed all five packages,
  exit zero. Do not report the interrupted run as green.
- Fresh size gate at the first repair: bare production 9.63/10.26 KB, dev
  11.75/12.45 KB; entities production **23.47/22.60 KB**, dev **26.13/25.25 KB**.
  Generator: `node tools/check-bundle-budget.mjs`. Exit one; ceilings unchanged.
  A fresh measurement after the selector extension is still required.

## Comparison evidence boundaries

The separate benchmark worktree corrects the incompatible heap measurements:
294 B/row was a multi-size net JS-heap slope; the old 120+230 B attribution was
positive-only filtered snapshot growth. They cannot be combined into a store
memory decomposition. Historical candidate-six timings are not measurements of
this optimized source. CPU throttle 4 is not a calibrated device class.

The harness now checks production-mode measured bundle behavior, preserves
artifact hashes, and marks busy/short runs as development evidence. Final packed
candidate build, fresh comparisons, full release gates, private Studio acceptance
and exact release-environment verification remain separate obligations.

## Final source checkpoint

Final selector-inclusive source: 3,220 kernel tests passed (329 files), with
seven expected failures, thirteen skips and one todo reported separately.
Spec-type ratchet and focused lint exit zero. Benchmark harness checkpoint:
`901cd45d`, fourteen selftests including stale-byte and wrong-result falsifiers.
The inherited entity-size failure remains open; this correctness checkpoint is
not an RC freeze and does not authorize release.
