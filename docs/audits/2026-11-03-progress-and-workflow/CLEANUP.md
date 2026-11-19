# Executed queue and orchestration cleanup

November 3, 2026. Owner authorized the six-step integration plan and cleanup.
This record describes changes, not release acceptance.

- One active acceptance table now lives in root RELEASE-CURRENT.md. TODO only
  routes to it. Historical implementation checkpoints are explicitly historical.
- The original 454-line controller and 5,683-line TODO are byte-preserved under
  `docs/archive/2026-11-03-active-queues/`. QUEUE-ARCHIVE.json records their hashes.
  No prior failure or decision was deleted.
- The replacement controller is 80 lines at this checkpoint; TODO is 17 lines.
  Later status edits may change those counts. The meaningful change is one source
  of current work, not a line-count target.
- The selected candidate is source manifest `8bd6920b`, derived from `0af649ba`.
  Only three reader/test paths changed. Noether owns the sole heavy-job slot;
  Main owns the ledger and read-only reviewer work runs independently.
- The cold-reader assertion helper consolidates repeated checks while adding
  immediate post-operation assertions. Both cold tests fail under dispatch
  removal, and the eleven clean tests pass. No semantic test was removed.
- Existing large tests remain intact: the two files cover distinct membership,
  inverse, jump and eviction paths. Setup consolidation is preferred to silently
  shrinking their 130,000-row obligations or merging isolated workers.

## Verification and first failure

The first link check found 70 broken links because relocated byte-identical old
documents were still scanned as live documents. The original failure is preserved
in QUEUE-FIRST-LINK-FAILURE.log. Moving those exact files to the repository's
existing historical archive class corrected the classification without changing
the checker or rewriting history.

The repeated documentation check on the existing clean documentation checkout
reported 910/910 resolving links across 198 live surfaces. This covers the queue
cleanup at that checkpoint, not final candidate consumer documentation. Both
original queue hashes verified. `git diff --check` passed.

No machine settings, security controls, runtime budgets or public semantics were
changed. Broader qualification remains in the live acceptance table.

## Validation-tool cleanup

The documentation walker now uses tracked plus nonignored untracked paths in a
Git checkout, excludes nested repositories/worktrees, and keeps filesystem
traversal for source archives. A Git inventory error fails instead of silently
changing discovery policy. Link and install checks share one path inventory per
validation phase; verdicts/content are not cached, and self-test reacquires paths
after removing its fixtures. Ignored untracked documents are intentionally outside
checkout scope; tracked files remain included regardless of ignore rules.

The earlier broad root scan and intermediate nested-only self-test were stopped
by Main after approximately 88/97 seconds. They are incomplete executions, not
passing or failing library tests. The Git-inventory self-test and final shared-
inventory self-test both passed, retaining deliberate missing-link/stale-install
checks and nested-repository negative controls. Source review is preserved in
DOC-SCANNER-FINAL-REVIEW.md. No speedup percentage is claimed.

The installed workflow harness now supports explicit manifest-bound sealed inputs
while keeping its historical default invocation. This removes duplicate package
builds from final consumer replay. Main replayed all 13 helper validation controls;
actual installed workflow execution remains a separate obligation. These helpers
validate supplied source/artifact records; the controller must additionally bind
them to a successful build receipt. See SEALED-INPUT-REVIEW.md and
SEALED-INPUT-MAIN-CHECKS.json.

## Ordinary test portability

Read-only classification found thirteen ordinary specs whose diagnostics require
historical temporary paths or environment sinks. No inspected test reads those
files as its oracle. The bounded cleanup preserves case selection, assertions,
getter/inspection evaluation and formerly unconditional serialization; only disk
persistence becomes optional. Dedicated GC receipt/control gates and opt-in timing
selection remain unchanged. The patch and its qualification are pending, not
counted as completed verification.

## Representative cost checkpoint

The selected 8bd source completed the finite seven-profile, 84-child comparison
against retained 87f6831f with no assertion failures. The report and raw evidence
are preserved in the [cost packet](../../architecture/multi-actor/native-occurrence/continuation/representative-cost/REPORT.md).
Ordinary scalar CPU and populated process heap are higher in the tested fixtures;
several timing directions remain unresolved on the busy host. This evidence does
not authorize higher ceilings or establish a production SLO. Independent interpretation verified the seven headline medians and found no
demonstrated comparison mismatch. See COST-INDEPENDENT-REVIEW.md for limits.
The four executable bundle failures remain blockers.

## Composed qualification: first outcomes

The 24-path test/document/tool composition `cae24479` changes no production
TypeScript. All 79 affected no-sink cases and four sensitive explicit-sink cases
pass; source and spec types pass. Lint correctly rejects fourteen cross-project
helper imports. The correction moves the byte-identical helper inside the kernel
project but outside production `src`, and annotates six inherited empty callbacks.
No assertion changes or lint suppression are used. Focused correction execution
is pending.

The first full-kernel invocation stopped at its preregistered 900-second outer
guard. It preserved the known absolute-work failure but did not produce a full
Vitest result, so no completed-suite pass count is credited. Owned processes were
cleaned up and source hashes stayed unchanged. This is an orchestration limit,
not a newly established runtime failure. The follow-up uses disjoint bounded
batches with individual result receipts and unchanged test/resource controls.

The updated installed Angular example and both strict installed guidance
compilations pass. Root documentation currently resolves 912/912 relative links
across 199 live surfaces (DOC-LINKS-CURRENT.log). This is checkpoint evidence, not
final release acceptance.
