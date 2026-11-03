# Unknown dynamic-access typing integration

Applied to the incumbent readiness worktree from exact baseline
`16f85b6d2b46ac1404ef6b089a1e6a459c28cdc3`. The [destination receipt](destination-receipt.json)
confirms all 16 changed source/test files match the verified disposable copy.
Patch SHA256: `9937060aa8f0ec608df0b273208908dacd1e20c076fc0b518275c7045dc24566`.

The [migration guide](../../../guides/open-record-typing-v16.md) defines the
reviewed string-indexed scope. No lookup export or runtime implementation changed.
K2's original unchecked string-Record type promise is removed; never-present
recursive acquisition is not advertised as implemented. Other index-signature
forms remain outside this patch. Runtime release blockers remain open.

## Validation and provenance

The completed disposable-copy checks are reused because destination source hashes
match exactly. Full typecheck and spec-types pass; all five package builds pass;
strict NodeNext consumers against fresh five-package artifacts pass with
skipLibCheck:false. Changed-file lint has zero errors and three existing warnings.
Affected Nx runtime tests: kernel50passes; Angular3passes/3existing benchmarkskips;
Vue3passes; Solid3passes. React is covered by source and artifact typing controls.

The original positive open-key assertions are preserved with their first compiler
failure. The authorized migration now requires compiler rejection at those same
expressions. Existing runtime assertions and control flow were not weakened:
eight fixture migrations emit identical JavaScript. Production types.ts and the
demo's seeded-k0 assertion also emit identical JavaScript.

[Independent review](review/REVIEW.md) preserved two findings before correction:
implicit Function members escaped unknown indexing; the first mask weakened a
readonly hybrid child. Both are corrected and exact-unknown/readonly tests cover
all facades. The final reviewed core hash is in the report and receipt.

Initial framework invocations used an unsupported testFile flag and did not run
tests; corrected Nx args runs passed. Initial lint errors in new typing fixtures
were corrected without changing type assertions. The spec-types baseline was not
updated. Raw logs and the exact patch are retained byte-for-byte in `raw-evidence.tar.xz`;
`raw-evidence-manifest.json` records their uncompressed hashes. Extract with
`tar -xJf raw-evidence.tar.xz` in a disposable directory.

No repeated benchmark, budget increase, full release qualification or B work.
Earlier approval-review capacity failures were unexecuted infrastructure failures;
the exact patch later applied successfully. Source application was followed by
hash verification and documentation validation, not redundant suite reruns.
Destination production demo build also passes; all 573 relative documentation
links resolve. Both fresh destination logs are archived here. The preserved RESULT report
records the earlier pre-application status; this receipt records successful application.

## Replay

Use Node24.15.0 and pinned pnpm10.17.0. Run `pnpm run typecheck`,
`node tools/check-spec-types.mjs` and `pnpm run build:all` when source changes.
Kernel focused tests use `pnpm nx test kernel --testFile=src/lib/whole-value-new-keys.spec.ts --testFile=src/lib/e-membership-reachability.spec.ts --testFile=src/lib/incremental-materialization.spec.ts --testFile=src/lib/point-owner-resolution-cost.spec.ts --skip-nx-cache`.
Framework tests use Nx `--args='src/lib/whole-value-new-keys.spec.ts'`; Angular also
includes `src/lib/kernel-comparison.benchmark.spec.ts`. Consumer setup and fixture
files are archived; their absolute /private/tmp paths record the executed setup
and must be relocated explicitly for another machine.
