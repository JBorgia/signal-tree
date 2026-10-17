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

- Slice 3b committed as `76dcaa04`: deferred classifications and cross-location
  order survive coalescing. Final source-revert proof 20 red / 21 controls,
  repaired 41/41. Destination controls 150/150; full kernel/static/build pass.
  V16 keeps refusal of transaction-inside-outer-coalesce and existing visibility.
  Direct scalar designation loss and external→new-undoable baseline uncertainty
  remain open, with original counterexamples preserved in the evidence record.

## Shared v15 blocker discovered during integration

Independent contract review identified the first external→new-undoable baseline
as a genuine defect, not a permitted baseline choice: realization is excluded
from authored history. A public-only installed-artifact probe reproduces undo 0
instead of 5 on npm 15.4.0 and the exact 15.4.1 candidate under four enhancer
configurations. Main release run `36960642038` was cancelled before npm
publication; signed tag 15.4.1 is preserved as superseded. V15.4.2 repair takes
priority, with tests carried here afterward. Euclid's membership integration
remains isolated; it must not independently invent a conflicting baseline fix.

The static scalar designation loss is separately explained by notifier metadata
coalescing and contradicts existing HIST-C2 whole-turn eligibility. Keep it in
notifier attribution controls; do not treat the plain/dynamic discrepancy as an
accepted product distinction.

## B native ownership slice (2026-10-16)

[The B experiment](docs/research/b-native-integration/README.md) corrects the
owner-approved recovery contract (41 semantic, 14 adversarial and one destruction
control pass). The subsequent internal native integration is rejected: focused
Nx and independent replay report 11 pass/2 fail. Dynamic creation remains live
after rollback, and path subscribers miss the restored scalar. A and original
failures remain separately preserved. No public API, runtime integration, release
or budget acceptance. Broader verification was not run after focused failures.

### B native boundary revision R1

The [separate R1 record](docs/research/b-native-integration/r1/README.md) preserves
the rejected checkpoint and corrects shared dynamic-membership admission and
mixed settlement publication. Independent focused replay passes original13 and
expanded18 including stale-frame protection; model recovery41/adversarial14/destruction controls remain green.
A primitive dynamic replacement baseline counterexample remains explicitly red.
See the R1 results for broader verification and limits; this is not public
transaction integration or production acceptance.

### B public lifecycle and entity slice R2

The [bounded public slice](docs/research/b-native-integration/r2/README.md) selects
B internally before incumbent construction and exercises existing public transact,
inspection, settlement, recovery and destruction, then entity lifetime/order paths.
Independent and root focused111 pass; actual B-enabled framework observers20 and
affected existing57 pass. Model41/14/destruction controls remain unchanged and pass.
Claims composition, history-eviction protection and terminal consequence projection
coherence were corrected after preserved first failures. Ordinary reclamation is
verified after capture drain. Two preserved primitive baseline probes remain red.
Typecheck/spec-types/lint outcomes and limits are recorded separately. No default
activation, API or production acceptance; full-suite and performance comparison
remain unexecuted for this slice.

### B finite qualification — rejected

[Qualification](docs/research/b-native-integration/qualification/README.md) finds
ordinary public failure to restore a rejected rekey after successful rollback, inspection
participation failures and hidden-collection delivery defects. Full B-selected
kernel output has352 ordinary failures plus2 expected-failure assertions that
now succeed; full framework qualification has9 failures after correcting harness
environment mismatches. Default authority separately exposes two shared native
regressions, alongside preserved baseline/Link counterexamples. Do not activate B.
Matched successful-subset costs favor tested settlement but penalize churn and
construction; package ceilings and the demo error ceiling fail. Full evidence,
verdict classifications, limitations and exact replay commands are preserved.
No further repair, API or architecture direction is selected by this rejection.

### B bounded authored-topology repair — rejected

[Experiment](docs/research/b-native-integration/topology-repair/README.md) repairs
the original rekey and removed-anchor counterexamples, but regresses the unchanged
creator-first explicit-order dependency control. The affected matrix is 123 pass,
1 fail. Preserve this experimental checkpoint; no activation or broader
qualification. CPU/artifact penalties remain unresolved and were not remeasured.
