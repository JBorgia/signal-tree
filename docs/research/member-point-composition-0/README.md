# Member/scalar/entity prepared composition

Integration baseline: `19a5bd034d5ebef262f637c397bb41fe50a6a1e3`.
Investigation parent: `542e20afaf6652c863ec46e1a67eec77a40b5403`.
D2, publication, indexing and subsequent composition patches remain separately
replayable; no runtime integration has been accepted.

## Mechanism and first results

`CPRA` is CPR10 plus the preserved cleanup patch. Its typecheck, spec-types and
five-package lint commands exit zero. Their 52 warnings include seven runtime
assertions beyond the 45-warning runtime-baseline/current-tests overlay. That
overlay was not exact 19a5bd03: later exact attribution finds 19 global warnings
on the baseline versus 54 on CPRF. Do not treat the 45 as historical baseline.

`CPRB` adds MP1: member presence and ordinary scalar endpoints share a final
prepared scalar frame, composed with touched-row installation before publication.
The shared frame prevents equality elision when a scalar endpoint equals its
pre-member value but differs from the member image. `CPRC` replaces formatting-
heavy MP1 with compact, semantically equivalent MP2; its member-undefined replay
preserves the same failure.

Baseline composition acceptance passes 6/10; CPRB passes 8/10. CPRB's member-token
Error and undefined faults leave physical scalar 100 but exposed native scalar
101, after rows restore and authority retires. The fault is after actual writable
token invalidation. The outer member invalidation skips shared scalar publication;
the existing P1 native scalar loop already continues individual tokens. A review
initially attributed a second failure to that native loop by reading baseline
source; exact manifest-loaded candidate inspection corrected that claim.

MP1 also retains two additional whole-collection inventories for optional-member
composition with structural writes. At N=128,1024,8192 and fixed mutation count,
rollback inventory calls are baseline add=0/remove=2/rekey=0 versus MP1 2/4/2;
confirmation is zero. These calls obtain complete source/target inventories in
`readTransitionSource` and `prepareTransitionTarget`. All exact state and retry
checks complete before the work assertion. This is measured inventory work,
not an assertion that each call is a distinct uncached walk.

`CPRD` adds MP3 to CPRA+MP2. It composes the existing heterogeneous planner's
installation/publication phases with member/scalar preparation and attempts all
sibling invalidations while preserving the exact first error, including undefined.
Structural removal/fresh-add/restore/rekey installation order and dynamic anchor
resolution remain unchanged. Collection invalidation staging remains inside the
existing group; the requirement is coherent owned reads before delivery, not
fresh application-native computeds inside the group.

CPRD passes the composition 10, optional existing-row zero inventory, structural
18 state/work controls matching baseline counts, omitted-member publisher
controls, and the existing 80-command portable verification plan. The D2 13 are
a subset of the prior 39 controls, not additional independent passes. A separate
sibling-branch/nested-collection matrix passes eight cases including reentry and
Error/undefined faults; baseline successful controls also pass.

The original operation-work journal counter misses a seam after formatting and
is invalid as a work measurement, despite successful semantic assertions. A
separate instrument version verifies exactly two source seams, journal appends
exactly equal authored operation count, and positive map/index/lookup counters;
all 36 workloads pass. The original result is preserved, not relabeled zero work.

## New independent counterexample

`composition-two-rekeys.mjs` extends the unchanged composition fixture with two
rows and two authored rekeys, A→B and D→E, each with a value update. In ordinary
`x-first` mode no fault is armed. Both exact baseline and CPRD report successful
rollback, restore both values, but retain keys A,E instead of A,D. Pending count
is zero, scope closed, and retry succeeds without fixing the key. Diagnostic
`byId('D')` is absent and `byId('E')` exists: this is physical key state, not an
ids cache explanation. The payload id D in `all()` does not mean the entity is
stored at key D. Independent review verifies that `changeId` preserves lifetime
and rollback is expected to restore the original address absent later authors.
The corresponding publisher-fault replay preserves the exact first exception
but leaves the same key. It is separate from the original injected capture fault:
this new ordinary-input case does not establish a public trigger for that fault.

The heterogeneous planner receives subject 1 value and B→A rekey effects plus
subject 2 value restoration, but no E→D rekey. Both rekeys reach the pending turn. `rollbackAddressKey` uses owner alone for
rekeys, so normalization drops the second lifetime before physical planning.
Do not attribute this missing effect to MP3's structural installation loop.

RK1 isolates that address fix: owner + subject + rekey identity, preserving
same-subject composition and existing membership/field addresses. CPRE is CPRD
plus RK1. Its six minimal counterexample variants, original no-fault/Error/undefined
variants, and additional same-subject rekey chain pass. Both permanent RK1 tests
fail on exact baseline and pass on CPRE, including numeric-versus-string subject
identity. CPRE passes 80 portable commands, 600 test executions across 21 focused
Nx invocations (overlapping batches; 217 filtered skips), typecheck and spec-types.
Lint exits zero with 55 warnings, ten more than the runtime-baseline/current-tests
overlay; not a clean warning budget or exact-baseline comparison.

CPRF adds CL2 (narrowing and preserved receivers, removing introduced assertions)
and RG1 (permanent Solid member-token publication regression). Final runtime
passes 37 focused portable commands and 36 corrected positive work measurements.
RG1 first had two pretest type failures, not executed test reds: neutral SDK
locations do not expose Solid .set types, and optional object types map to a union
location without nested .x. The corrected test uses existing SDK replaceLocation
and retains the original JavaScript omission via Reflect.apply, documenting why
strict TypeScript whole-value assignment remains unchanged. No casts or public
types were weakened. The corrected RG1 fails on unchanged baseline (two intended
coherence failures) and passes on CPRF (five tests including controls). Final
typecheck and spec-types pass. All five full Nx suites pass: kernel 5,726 passed,
12 expected failures and 12 skipped; Angular 237 passed and three skipped; React
74, Vue 172 and Solid 104 passed. These are CPRF results, not extrapolated CPRE
results. The exact 18 reviewed source/test files were committed as
`12a04f57bee4c90de1110eff7b72960fcd46059c`. Earlier
approval-review rejection and unexecuted suites remain recorded in the preceding
operation-disposition packet; no rejection was bypassed.

## Artifact attribution and acceptance limit

Fresh five-package builds, API inventories and documentation links pass on
`12a04f57`. Exact baseline and candidate builds used the same Node 24.15.0,
pnpm 10.17.0, unchanged tools/configuration and uncached Nx build commands.
Before/after hashes verify restoration of all 28 package sources and 161 candidate
artifact files after the baseline overlay.

| Measurement | Exact baseline | Candidate | Ceiling |
| --- | ---: | ---: | ---: |
| Bare production gzip KB | 11.21 | 11.64 | 10.25 |
| Bare development gzip KB | 13.54 | 13.99 | 12.45 |
| Entities production gzip KB | 25.57 | 26.78 | 22.60 |
| Entities development gzip KB | 28.36 | 29.57 | 25.25 |
| Demo initial kB | 558.06 | 565.11 | 550.00 |

Bundle fixtures measure own bundled code with peers external; demo initial bytes
are a different measurement. Both baseline and candidate fail these gates. The
candidate adds 0.43 KB bare production, 1.21 KB entities production and 7.05 kB
demo initial. Existing overages do not excuse the added cost. No ceilings changed.
The demo compilation emitted chunks but the production build exited nonzero;
this is not a successful demo validation.

Exact-baseline global lint has 19 warnings and passes its ratchet. The first
candidate has 54 warnings and fails: 35 new test non-null assertions (kernel 10,
Angular 2, React 2, Vue 21). Earlier runtime-only baseline overlays retained current
tests and cannot establish those warnings as preexisting. The original logs and
this correction remain preserved. Test-only cleanup is recorded separately.

Independent artifact review confirms the two-arm attribution and distinguishes
semantic survival from artifact acceptance. It identifies no evidence requiring
an ownership redesign. It also identifies inactive-hook preparation allocations
as a possible separate work reduction, not a measured bundle-size solution.
The unchanged artifact gates prevent accepting this candidate as fully verified.
No budget waiver or architectural victory is inferred from the semantic results.

Capture and publication remain separate claims: prepared operation responsibility
survives the tested rich-capture failures; complete physical installation and
owned-projection invalidation precede settlement delivery. Native computed timing
inside a framework group remains framework-owned. Existing structural removal
rollback retains its two baseline inventories; the eliminated scans were added
work, not a claim that all structural operations have constant cost. The earlier
class-prototype rollback counterexample and separate injected normalization fault
remain outside the repaired boundary, as recorded in the preceding packet.

## Replay

From this checkout, Node 24.15.0, pnpm 10.17.0 installed:

```sh
ST_PROOF_OUTPUT=/private/tmp/member-replay node docs/research/member-point-composition-0/run.mjs base composition-two-rekeys.mjs x-first fresh-label
ST_PROOF_OUTPUT=/private/tmp/member-replay node docs/research/member-point-composition-0/run.mjs CPRD composition-two-rekeys.mjs x-first fresh-label
ST_PROOF_OUTPUT=/private/tmp/member-replay node docs/research/member-point-composition-0/run.mjs CPRD optional-structural-work.mjs baseline-work fresh-label
ST_PROOF_OUTPUT=/private/tmp/member-replay node docs/research/member-point-composition-0/run.mjs CPRD composition-acceptance.mjs fault-member-undefined fresh-label
```

Use a fresh label per identical lane/probe/mode; the runner refuses overwrites.
Run sequentially per output root; independent concurrent runs need distinct roots.
Raw firsts, loaded-source hashes and bundles are preserved in evidence archives.
No API acceptance, ceiling change, v15 change, merge, push, tag or publication.

For committed source verification (save each full log and its exit code):

```sh
export NX_DAEMON=false NX_ISOLATE_PLUGINS=false
pnpm nx test kernel --skip-nx-cache
pnpm nx test angular --skip-nx-cache
pnpm nx test react --skip-nx-cache
pnpm nx test vue --skip-nx-cache
pnpm nx test solid --skip-nx-cache
pnpm run typecheck
node tools/check-spec-types.mjs
pnpm nx run-many -t lint --projects=kernel,angular,react,vue,solid --skip-nx-cache
pnpm nx run-many -t build --projects=kernel,angular,react,vue,solid --skip-nx-cache
node tools/api-inventory.mjs --check
node tools/api-callable-inventory.mjs --check
node tools/check-bundle-budget.mjs
node tools/size-report.mjs --json
node tools/check-lint-budget.mjs
node tools/check-doc-links.mjs
pnpm nx build demo --configuration=production --base-href=/ --skip-nx-cache
```

Bundle/demo commands above are expected to remain red at the recorded source.
Use a separate exact-baseline checkout with the same dependencies for artifact
comparison; do not measure baseline against candidate dist. Portable proof lanes
reconstruct exact sources with patches and do not change the working checkout.

## Final disposition and preserved evidence

Runtime candidate: `12a04f57bee4c90de1110eff7b72960fcd46059c`.
Test-only cleanup: `e4c6a4e2be3a2398bb5b806a33349c405d2c478b` (runtime and built artifacts unchanged).
The cleanup restores the global lint ratchet to 19/19 warnings with zero errors;
source typecheck and spec-types pass. Affected Angular 26, React 26, Solid 26 and
Vue 49 tests pass after cleanup. All expectations remain, required fixture values
now fail explicitly when missing, and adapter method receivers are preserved.
Independent review and root inspection found no assertion weakening. The complete
five-suite run belongs to the identical runtime at 12a04f57; only affected tests
were rerun for this test-only cleanup.

This is a reviewed semantic candidate, not an accepted artifact integration.
Bundle/demo budgets remain red with the measured incremental cost above. The
bounded investigation did not establish a need to change ownership architecture.
No budget waiver, API acceptance, runtime merge or publication occurred.

`integration.patch` is the package-only diff against 19a5bd03, excluding research
ancestry. D2 and publication remain separately reconstructible through the runner's
patch lanes. `lint-cleanup.patch` keeps the test-only correction identifiable.
Existing first failures are in `first-evidence.json.xz` and
`composition-evidence.json.xz`. Final semantic/build evidence is in
`CPRF-final-evidence.json.xz`; each entry contains its original path, UTF-8 text
and SHA-256. Its companion summary documents exclusions and dependencies. Those
raw historic summaries retain their original claims; the exact-baseline lint
attribution above supersedes the earlier runtime-overlay comparison.
`test-lint-evidence.json.xz` contains the subsequent cleanup checks and first lint
diagnostics. Independent reviews are saved alongside these archives.

Portable replay of the 37 final controls and 36 positively instrumented work cases:

```sh
python3 docs/research/member-point-composition-0/replay/CPRF-replay-controls.py --root "$PWD" --output /private/tmp/fresh-cprf-controls
```

This runner reconstructs CPRF runtime and original tests, independently of the
later test-only lint cleanup. Work instrumentation verifies both seam presence
and positive counts; the earlier missed seam is not treated as zero work.
For committed-source focused/full/preflight/artifact checks, use the adjacent
`CPRF-replay-gates.py` with `--root "$PWD" --expect-head` followed by the actual
checked-out SHA, `--phase focused|full|preflight|artifacts`, and a fresh `--output`.
The replay wrapper scripts were syntax-checked; their underlying recorded commands
were executed separately as shown by the logs. No fresh replay is implied by
packaging the wrappers. All artifact runs must build before measuring.

The package-only baseline diff is 28 files, +3,164/−303 lines; the runtime
candidate commit itself is 18 files, +1,059/−292. The separate evidence packet
contains rejected patches and logs and must not be mistaken for a runtime diff.
Staged whitespace checking passes for non-patch files; preserved unified patch
context includes single-space blank lines and is intentionally byte-exact.
