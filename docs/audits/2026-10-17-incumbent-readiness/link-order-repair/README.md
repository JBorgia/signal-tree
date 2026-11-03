# Bounded Link order publication repair

Source baseline: `117f0b5416fd06f59d7e6a754b0b9a9e60ca56a5`. Runtime inherited
from the recorded incumbent checkpoint; typing migration remains unchanged.

Prepared collection targets now publish their installed order through the existing
capture channel. All targets install, then all order facts publish, then ordinary
publication delivers callbacks. Captures use prepared frontier identities, not a
live frontier potentially changed by reentry. No Link flush or public API added.

The first per-target fix failed cross-target callback reentry: physical newer order
survived but late capture overwrote outbound eligibility. That first failure and
source are preserved in the archive. The corrected phase passes the unchanged
reentry assertion. Fixture setup mistakes (in-flight staging; undo incorrectly
assumed to be inspection) are separately recorded, not runtime defects.

## Verified scope

- New public and internal controls: 12 ordinary passes, no skips/expected failures.
- Five unchanged focused Link suites: 47 ordinary passes (the archived 57-test run
  includes the first ten new cases; do not double-count those).
- Existing target/omission controls: 81 ordinary passes.
- Existing Vue settlement/projection/selection controls: 31 ordinary passes.
- Source typecheck and affected-file ESLint pass. Diff checks pass.
- [Independent review](REVIEW.md) found no public-behavior blocker. Its probe shows
  the internal capture phase is a physical-fact channel, before native projection
  refresh; it is not a public read-coherence callback. Built-in consumers use its
  payload, and public replay callbacks remain after coherent publication.

Queued and drained rejection converge to restored order; a confirmed outdated
payload already in flight is followed by restored order. Controls also cover
confirmation, endpoint and cross-target reentry, delivery errors, inspection
exclusion, unchanged ordering and mixed membership/order restoration.

This closes this bounded publication defect, not independent-Link progress or
restoration readiness. No full release suites, fresh artifacts, budgets or release
acceptance are claimed. Those remain required for a final runtime candidate.

## Replay

Use Node 24.15.0 and pnpm 10.17.0. Extract `evidence.tar.xz` in a disposable folder;
`manifest.json` verifies uncompressed bytes. The RESULTS report contains focused
commands and per-run hashes. Original logs and pre-repair sources remain intact.

```sh
NX_DAEMON=false pnpm nx test kernel --testFile=src/lib/link-order-rollback.spec.ts --skip-nx-cache
NX_DAEMON=false pnpm nx test kernel --testFile=src/lib/physical/declarative-target-binding.spec.ts --testFile=src/lib/physical/prepare-structural-target.spec.ts --testFile=src/enhancers/restoration/designated-collection-omission.spec.ts --skip-nx-cache
NX_DAEMON=false pnpm nx test vue --skip-nx-cache --args='src/lib/settlement-publication.spec.ts src/lib/entity-projection-publication.spec.ts src/lib/prepared-selection-publication.spec.ts'
pnpm run typecheck
```

## Subsequent spec-types correction

The separate ordinary-spec gate found 13 unsupported `reorder:true` arguments
in the new Link test. Public `setAll` already uses input order; that option is
not part of its contract and was ignored at runtime. Only those arguments were
removed; all assertions remain unchanged. The corrected 12 controls and spec-types
gate pass. The original spec/compiler failure and correction receipt are preserved
in `spec-types-correction.tar.xz` with an adjacent manifest. No public API or
runtime behavior changed to accommodate the test.
