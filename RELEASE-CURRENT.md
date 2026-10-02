# Current work — v16 integration

Updated October 1, 2026. Owner-authorized branch `integrate/v15-4-into-v16`,
baseline `628d302dadb082a48c58528651c9088234d0a777`, version **16.0.0-dev**.
The original checkout and its untracked `frontier` remain untouched.

## Prerequisite complete

V15.4.0 published from `4ceb24a2a62dc893bf28c50ad971a955190539a7`. All five
registry tarballs match verified local archives; local/Linux/tag/publisher
gates and proofs, registry regressions, strict consumers and Angular AOT pass.
The v15 release record is on `fix/v15-link-settlement-diagnostics` at `024ce69c`.

## Authorized scope

Follow [the selective integration manifest](docs/audits/2026-10-01-v16-integration/PLAN.md).
Carry fixes **with their falsifiers**, preserve v16 `transact()` spelling,
inspection, recovery authority, current-truth observation, typed identity and
existing framework realization contracts. Do not wholesale replace divergent
v16 files with v15 versions or copy v15 automatic-abort settlement policy.

1. Record exact current semantic results before production changes.
2. Integrate dependency-ordered correctness/observation/allocation slices;
   preserve first reds and destination controls.
3. Run the complete semantic matrix and explain every changed verdict.
4. Evaluate ownership-model changes only against this stronger incumbent.
5. Independently measure v16 performance and size; v15 budgets/results do not transfer.

No v16 publication or new architecture is authorized by this integration work.
V14 remains paused. Private Studio compatibility is a separate pending decision.
Use AGENTS.md and the scoped contributor/review contracts. Historical roadmaps
do not add scope. Keep all exact-SHA evidence distinct from working-tree checks.

## Progress

- Isolated branch and frozen dependency install complete.
- Baseline characterization complete at unchanged `628d302d`: scalar 25 held /
  9 violated / 1 unsupported; structural 135 / 48 / 24; composition 28 / 10 /
  133; authority 0 / 1 / 10. All four runners exit 1 with zero execution errors.
  Original 13 cases: 9 held / 1 violated / 3 unsupported; 9 adapter tests pass.
  Raw results, commands, input hashes and exit codes are preserved in
  `docs/audits/2026-10-01-v16-integration/baseline/`.
- Slice 1 committed as `042e8ede`: collection identity and own-field presence.
  Full kernel 2936 passed / 6 expected failures / 13 skipped; all-package build
  and typecheck/spec-types/lint pass. Review strengthened presence controls to
  23/23. Stale fixture declarations corrected separately in `479d449d`.
  See [the evidence record](docs/audits/2026-10-01-v16-integration/PROGRESS.md).
- Slice 2 committed as `65cf7b38`: coherent restoration outcomes after reactive
  delivery throws, with per-invocation provenance and original thrown-value
  identity. 25 focused tests, full kernel (2963 passed), all four frameworks,
  all five package builds and static gates pass. Same-tick rollback→undoable
  failure is preserved for slice 3; its fixture does not install batching.
- A reused-error provenance defect was reproduced on the published 15.4.0
  artifact under controlled validation fault injection. Its bounded v15 patch
  takes priority before continuing integration; see the evidence record.

- Slice 3a committed as `a42094b9`: compensation no longer enters ordinary
  history capture. Same-tick rollback→undoable regression closes without adding
  batching or changing v16 recovery. Kernel 2973 passed, destination controls
  75/75, static gates and kernel build pass. Remaining slice 3 work: explicit
  semantic-scope closure and plain-branch membership, each tested independently.
