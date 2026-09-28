# v15.3.1 release-readiness follow-up — 2026-09-28

Scope: the isolated `fix/15.3.1-link-rollback-and-strand` branch, starting at
`527a3eb6` with runtime repair `0faa878d`. This is preparation evidence, not
exact-commit release qualification. Publication remains on hold.

## Policy and artifact evidence

Explicit refusal retains its pending handle but releases the existing v15
commit scope/consequences. Automatic refusal before a handle returns records
surviving writes as locally committed, retains eligible designated undo,
releases consequences, and throws. Local commitment is not backend acceptance.
No new recovery API or v16 ownership model is introduced here.

The permanent installed-package fixture and comparison runner are
`tools/fixtures/v15-refusal-lifecycle.mjs` and
`tools/check-v15-refusal-lifecycle.mjs`. The published 15.3.0 baseline is pinned
by SHA512 in the runner. Results are five fixed behaviors, three preserved
controls, and two unchanged limitations, not ten green cases. Raw fixtures
continue to exit 1 for the limitations; comparison accepts only their exact
bounded evidence. It rejects missing cases, new failures, uncaught errors,
changed limitation states, and lost authority after refusal. Eighteen
classifier falsifiers pass. Source tests additionally pin compensation-port
refusal, post-callback failure reporting, synchronous consequence ordering and
actual undo/redo; the artifact case alone does not prove all of those.

The new automatic-refusal artifact control observes the original callback
error by identity, live replacement-row preservation, exactly one committed
scalar contribution, and undo availability inside the Link endpoint. Published
15.3.0 retains the same live value without the contribution or undo eligibility.

## First reds and corrections

Preserve `/private/tmp/st-1531-prerelease-gates-first.log`: 78/81 gates passed,
three failed, zero known-red. These were not sampling failures:

- `test:all`: the environment supplied pnpm 11.25.0 instead of repository-pinned
  10.17.0, which attempted an installation and aborted without a TTY. Corrected
  PATH to the existing pinned binary; frozen installation and all seven test
  projects subsequently passed.
- `history-ownership-bench`: staging the committed notifier omitted its new
  real error-reporter dependency. Added that dependency and ESM import rewrite,
  following the existing committed-dependency design. The focused gate passed;
  no benchmark threshold or assertion changed.
- `spec-types`: the new reporter assertions introduced two implicit-any
  parameters. Typed them as unknown; the 223-diagnostic per-file baseline is
  unchanged and passes.

The initial strengthened cause test also wrongly expected a post-callback
release error in `callbackError`. The existing contract reports it separately.
The corrected test asserts both the primary refusal cause and that original
release-error report; 41/41 focused tests pass. Original red is retained in
`/private/tmp/st-cause-fidelity.log`.

Independent review caught that merely listing `llms.txt` did not execute its
examples: the collector filtered out `.txt`. The collector now admits the
canonical file, requires nonzero coverage, and strictly diagnoses its complete
examples rather than suppressing errors due to missing context.

## Validation before the final candidate

- Full uncached seven-project suite passed with pnpm 10.17.0 and Node 24.15.0.
  Kernel: 2425 passed, 7 expected failures, 13 skipped, 1 TODO. Angular: 152
  passed, 3 skipped. React: 9; Vue: 33; Solid: 7; React reference: 26 passed.
  Demo: 183 passed, 4 skipped.
- Separate kernel coverage: statements 86.67%, branches 76.86%, functions
  88.49%, lines 87.79%; explicitly checked against 80/75/80/80. This is not
  whole-workspace coverage. The canonical registry does not itself enforce
  those historical targets; misleading validation documentation was corrected.
- Production demo build and 136 browser checks passed. The built root
  `llms.txt` matched its source at that build; final artifact rebuild must copy
  the later, type-resolved examples too.
- Release metadata and changelog checks pass for 15.3.1 (unreleased). All six
  manifests and generated demo versions are aligned; latest published release
  remains separately identified as 15.3.0. Frozen install changed no lockfile.
- Omitting an ordinary gate's mutation proof produces 1 unproven and exit 1.
  Full self-test verification is still required; ordinary gates do not substitute.

## Documentation and release boundary

Live READMEs, composition, persistence, undo, typing, AI and release guides now
state the failure boundaries and remaining limitations. Historical research and
released changelog entries remain historical. Canonical `llms.txt` includes all
five packages, framework write grammar and bounded failure-policy guidance;
package builds copy it and the demo explicitly serves it. Newly added policy
links use the v15 branch URL where relative paths would fail in tarballs/hosting.

Manual Validate CI now includes release-only gates and self-tests, destroys
mutation-era dist, rebuilds and checks packed consumers. It never publishes.
Unchanged v15 composition/retention issues remain explicitly scoped out; these
checks do not qualify v16 or resolve its architecture research.

Next: complete all release gates and mutation proofs on a frozen candidate,
then a clean post-mutation build, packed consumers and clean-checkout rehearsal.
Record exact-SHA local and Linux results outside the source tree after freezing.
Do not tag or publish without owner authorization.

## Corrected preflight result

`/private/tmp/st-1531-release-gates-corrected.log`: 83/83 passed, zero failed,
zero known-red, exit 0 with pinned pnpm. The registry now includes the installed
v15 comparison and its classifier proof. Five complete `llms.txt` examples are
listed by the checker; 38 examples across 27 live documents pass. Independent
bounded review found no further blocker after the `.txt` coverage correction.
The remaining source edit is JSDoc-only: remove current claims about deleted
markers from the error-reporting documentation. No runtime body changed in this
follow-up. Full exact-commit verification and post-mutation artifacts remain
separate requirements.
