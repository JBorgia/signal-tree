# R2 verification

Frozen source: source-seal.json. Exact starting checkpoint22ff8969; original
comparison baseline8d220643. Final local commit is the commit containing this
record. No API/default activation or production acceptance follows.

| Check | Result | Archived evidence |
| --- | --- | --- |
| Public lifecycle | 33 ordinary passes | ROOT-final-focused.log |
| Entity semantics | 27 ordinary passes | ROOT-final-focused.log |
| Retention/recovery dependencies | 6 ordinary passes | ROOT-final-focused.log |
| Original native / R1 | 13 / 18 ordinary passes | ROOT-final-focused.log |
| Claims, including concurrent preparation | 14 ordinary passes | ROOT-final-focused.log |
| Independent same six files | 111 ordinary passes | independent-final-claims-retention.log |
| Existing affected installation/ordering/pay-for-use | 57 ordinary passes | ROOT-final-shared-installer.log |
| Actual B-enabled Angular/React/Vue/Solid observers | 5 each, 20 total | ROOT-final-framework.log |
| Unchanged neutral B model | 41 semantic,14 adversarial,1 destruction pass | ROOT-model41.json,ROOT-model14.log,ROOT-model-destroy.log |
| Preserved primitive baseline probes | 2 ordinary failures, unchanged | ROOT-preserved-baseline-red.log |
| Source typecheck | exit0 | ROOT-final-typecheck.log |
| Spec-types ratchet | pass,6 existing diagnostics remain | ROOT-final-spec-types.log |
| Five-package lint | exit0,0 errors,38 warnings | ROOT-final-lint.log |
| Diff whitespace | pass | final-diff-check.log |

Focused111 and affected57 contain no skips or expected failures. Framework
selection excludes590 other tests (reported as skipped by the name filter);
those are unexecuted, not passing coverage. R1 full-suite expected failures and
skips remain historical results, not new R2 results.

Spec-types is not clean spec compilation: six diagnostics remain in
mut-participation.spec.ts against allowance seven. No ratchets changed. Lint has
18 kernel warnings,11 Angular,3 each React/Vue/Solid: three kernel and eight
Angular warnings existed before this slice;27 new non-null assertion warnings
remain (15 kernel,12 framework tests). No lint errors remain or rules weakened.
Initial static errors are preserved separately from corrected final results.

Final checks ran on the source recorded in ROOT-final-source-seal.json. Two
existing files subsequently had unrelated formatter churn removed. Prettier
normalization of before/after source was identical, independently verified;
archived before-format-trim files preserve the tested bytes. No semantic edits
followed final tests. The repository source-seal.json records final bytes.

## Review findings

The independent review initially identified claims-index collision when two
plans are prepared before either installs. Two unchanged unit assertions
reproduced lost/orphaned claims. Actual target-transition and point-realization
paths can prepare multiple collection plans before installation; no separate
ordinary public trigger is claimed for that unit failure. The internal terminal
plan now supports keyed set additions: installation uses the current indexed
set or its prepared fallback, composing rather than overwriting. Claims and
entity owner/location indexes use the operation. All five production interpreters
use one helper. Reviewer replay and root replay pass the same111 controls.

Other reproduced review failures and their fixes are in README.md. Independent
review was supplied raw sources/logs; its conclusions are bounded to the tested
paths. Root verified source hashes, installation interpreter inventory, raw
results and final formatting equivalence. See INDEPENDENT-REVIEW.md.

## Unexecuted and limits

No full suites, builds, package/demo size, CPU or heap comparisons were run for
R2. No universal allocation/OOM claim, Link coverage, arbitrary dynamic collection
registration or complete production replacement claim is made. No approval-review
rejection occurred this slice; earlier rejected/blocked commands remain recorded
in their original checkpoint. One formatter command used an absent executable
path, then used the installed entry point; that tooling error was not a test
failure. No ceilings, v15, push, merge, tag or publication changed.

Replay from repository root with `bash docs/research/b-native-integration/r2/replay.sh`.
It requires installed Node24.15.0 and pnpm10.17.0, uses Nx, writes full logs to a
fresh temporary directory, and explicitly expects the two preserved baseline
probes to fail. Model scripts retain their documented exact-built-baseline
requirement in ../recovery/README.md. The archive includes first failures,
pre-fix source, baseline timing diagnostics and independent records; SHA256
manifest verifies its members.
