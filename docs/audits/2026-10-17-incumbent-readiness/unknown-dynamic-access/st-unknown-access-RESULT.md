# Unknown dynamic access: reviewed type-only candidate

Baseline source16f85b6d2b46ac1404ef6b089a1e6a459c28cdc3. Candidate resides in
/private/tmp/st-unknown-access-candidate; exact changed-source hashes and patch
hash are in /private/tmp/st-unknown-access-manifest.json. Portable patch:
/private/tmp/st-unknown-access.patch. No lookup export or runtime implementation.

## Implementation

Open string-indexed Record descendants become unknown. Named/hybrid properties,
readonly modifiers, whole-value replacement/updaters and closed topology remain.
Callable native member names are explicitly masked unknown; known child types
intersect back to their actual native carriers. This correction was required by
independent review. A subsequent mutable-mask regression weakened readonly bind;
readonly masks fixed it. Both first failures are preserved under
/private/tmp/st-unknown-access-review. Final reviewed core SHA:
f4b10a8d051bc8f2a766c426c61897d5bf4f5c50349a8989deea6fd282b36b33.

Original open-key assertions remain verbatim with expected compiler errors after
authorized migration; original file and first2errors preserved separately.
Five new facade typing fixtures test exact unknown (not any), collisions,
hybrid/closed inference, readonly preservation, nested/mixed Records and whole
writes. Eight existing runtime specs gained test-local fixture types only; all
runtime assertions/controlflow emit identical JavaScript. Demo k0 assertion
states the known key populated by its existing loop, also identical emitted JS.

## Validation

- Full pnpm typecheck passes, including generated deep proofs1–40.
- Spec-types gate passes; baseline untouched. Three reported improvements are
  not silently rebaselined or attributed as new semantic fixes.
- All five package builds pass via build:all/Nx.
- Strict NodeNext consumer checks against copies of all five freshly built
  package artifacts pass with skipLibCheck:false. No source path aliases.
- Affected Nx runtime suites: kernel50pass; Angular3pass/3existingbenchmarkskips;
  Vue3pass; Solid3pass. React has new compile controls, no runtime changes.
- Changed-file ESLint: zeroerrors, three existing unused-describe warnings.
- Emitted production JS identical for types.ts and demo; eight migrated runtime
  specs likewise identical. No bundle/performance claim based on this alone.
- git apply --check succeeds against the preserved worktree.

Initial framework test invocations incorrectly supplied kernel-specific testFile
flags and failed before test execution. Corrected Nx args runs passed; both logs
remain. Initial lint25unused-expression errors in new typing fixtures were fixed
using void without changing compiler assertions. First failure logs retained.

## Separate runtime investigations

Restoration one-remove compensation token hook does not generalize: two removals
use prepared-target installation; remove+add changes the source frontier before
point restoration. Visible order restores but older history remains ineligible.
Actual prepared-target pre-install fault yields usable retry but does not repair
continuity. Preserve /private/tmp/st-restoration-interval-20261018/compensation-multi*
with hashes. Any repair belongs to complete compensation preparation/installation,
not another restore-method hook. No runtime patch was applied.

Link entity experiment exposed a public failure on BOTH baseline and candidate:
pending reorder[a,b]→[b,a], no send whilepending, rollback ids[a,b], outgoing[b,a].
Parent independently reproduced baseline. Report /private/tmp/link-entity-REPORT.md.
This is a publication/projection defect, not merely unsupported progress. Original
10/2ledger and prototype first failures remain unchanged. No repair attempted.

## Limits

This candidate addresses Record<string,V> and corresponding readonly/hybrid
string-indexed objects. Numeric-only, symbol-indexed and template-pattern Records
retain prior types; do not claim universal open-index soundness or K2closure.
No full release suite, activation, publication or B work. Exact worktree application
is separately subject to the approval service; prior attempts were unexecuted
capacity failures. Scratch checks are not claimed as checks of a committed SHA.
