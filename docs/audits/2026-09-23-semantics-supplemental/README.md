# Supplemental transaction evidence, 2026-09-23

This is a test-only extension, not a replacement for the original thirteen
SEMANTICS-2 cases, a law verdict, an architecture selection or a release gate
pass. Frozen laws, matrix, mutations and predictions were not edited. No
production/prototype implementation was changed by this slice.

## What was added

`packages/kernel/src/enhancers/transactions/semantics-supplemental.ts` contains
35 supplemental scenarios:

| Scenarios                         | Count | Assertion scope                                                                                                                                                                                                                                                                                             |
| --------------------------------- | ----: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S11                               |     8 | Every two-writer accept/reject combination in both settlement orders; literal expected intermediate visible states and actual handle-specific pending membership. Refusal fails these successful-settlement obligations.                                                                                    |
| S12                               |     6 | All three-writer rejection orders. This is not the 48-case mixed accept/reject cross-product.                                                                                                                                                                                                               |
| S06/S08/S09                       |     3 | Middle rejection / oldest acceptance / middle acceptance with three pending writers.                                                                                                                                                                                                                        |
| S02/S13/S14                       |     6 | Ordinary-write and accepted-newer precedence, followed by older acceptance or rejection. S14 means a newer authored writer has already committed; it does not invent retroactive authorship.                                                                                                                |
| S03 refusal                       |     1 | Only after an actual refusal: unchanged complete scalar state, this handle's pending ID, the newer handle's authority, unchanged confirmed count, zero owner publication. Successful native rejection does not exercise this conditional safety case.                                                       |
| Terminal sentinels                |     4 | Each accept/reject followed by each repeated/opposite operation; later ordinary sentinel values must survive, pending membership must stay absent and owner publication must stay silent. Results are recorded without inventing a terminal classification.                                                 |
| Terminal reader                   |     1 | Explicit capability evidence; missing native terminal disposition remains unsupported.                                                                                                                                                                                                                      |
| F09/F10 and O04                   |     2 | Real public EntityMap occupied-destination refusal: retain actual authority, all state and confirmed count; no publication. Retry against unchanged conflict must not masquerade as success; removing the occupant permits a real retry. Value restoration is checked, not a held-reference lifetime proof. |
| Observation control / O01/O02/O05 |     4 | Actual owner callback delivery, disposal, multi-field accept/reject coherence and no superseded-value resurrection at that publication boundary.                                                                                                                                                            |

The original adapter was extracted into `semantics-current-adapter.ts` so both
suites use the same translation. The runtime reader receives the concrete
inferred tree; no `any`, tree-shape cast or compiler-lib widening was introduced.
`hasPendingAuthority` reads actual native pending-ID membership; absence does not
become a committed/rejected/superseded label. Unexpected native exceptions remain
execution failures rather than being classified as supported refusals.

`observeVisible` subscribes to the existing `observeOwnerInvalidation` API and
reads actual visible state inside its callbacks. There is no synthetic initial
notification, endpoint imitation, snapshot filtering, adapter coalescing or
adapter-maintained visible/canonical state. Traces clone the callback's actual
read to retain evidence. This measures native owner publication, not every
possible private notification or every framework's observers. A successful
accept may produce no callback when visible values have not changed; the
independent write/disposal control prevents a no-op observer from passing.

## Original evidence remains intact

An AST comparison against `7ade0e3e` confirmed all thirteen original case IDs and
executable bodies are unchanged. F06 retains its original assertion and has an
adjacent explanatory correction: it treats any repeated `settled` return as fresh
success, although L14/MATRIX permit a defined non-mutating no-op. A normal return
from a void native method cannot distinguish those two outcomes. Supplemental
sentinel checks measure non-mutation without fabricating `already-settled`.

The original first-red record is retained in commit `7ade0e3e` and the original
versus corrected table in `../2026-09-23-validation-instrument-corrections.md`.
`original13-first-honest-adapter.txt` preserves the earlier corrected-adapter run;
`original13-current.txt` is a separate new run. Neither is overwritten or treated
as a permanent snapshot expectation. The latest original-case report reads
9 held / 1 violated / 3 unsupported; those are partial case results, not whole
laws. S03's original refusal branch still only checks visible state. Its
supplemental companion now tests retained authority and silence separately.

## Baseline and current results

| Run                        | Held | Violated | Unsupported | Not exercised | Execution errors | Exit |
| -------------------------- | ---: | -------: | ----------: | ------------: | ---------------: | ---: |
| Frozen `7ade0e3e` baseline |   21 |       12 |           1 |             1 |                0 |    1 |
| Working-tree current       |   25 |        9 |           1 |             0 |                0 |    1 |

Both first and final reports are retained. The first runs preceded the final
runner integrity checks, portable own-property check and more precise unexpected
exception classification; their results were not erased. Final reports include
per-input SHA-256 hashes, source selection, timestamps, every assertion, native
operation traces and scope labels. `changedInputs` was empty for both final runs.
These are exact run snapshots of concurrent remediation, not a permanent claim
about later edits.

Current red successful-settlement scenarios are:

- `S11/12/RA`, `S11/12/RR`.
- `S12/reject/123`, `/132`, `/213`, `/231`, `/312`.
- `S06` and `S13/local-frontier/R`.

All nine report a refused operation where that supplemental scenario requires
successful surgical settlement. They are not relabelled as conformance because
refusal may be safe. Current `S03/refusal-authority`, F09/F10 and the measured
observer cases hold their bounded assertions. The baseline F09/F10 record the
lost native pending authority and misleading successful retry; baseline scalar
corruption remains red. Baseline S03 does not refuse, so its conditional refusal
case is **not exercised**, not held. Terminal disposition is unsupported in both
runs.

## Runner integrity and commands

The new runner reads baseline kernel source through `git show`, without checkout
or dist; the same working-tree harness runs against both candidates. It does not
run or modify any prototype. Current mode hashes the actual source it bundles.
Existing evidence paths are rejected to prevent accidental overwrites. Any
violation, unsupported operation, unexercised scenario or execution error causes
exit 1; changed inputs cause exit 2. Assertions already found red cannot be
hidden by a later unsupported result. Constructor failures, even unsupported
constructor throws, and cleanup errors are execution errors.

Seven runner integrity tests plus nine original report/adapter tests passed
(**16/16**). The seven controls cover failed construction, retained violations
before unsupported evidence, unsupported status, refusal versus surgical success,
operation/cleanup errors, assertion-free cases and a positive assertion.

```sh
node tools/run-semantics-supplemental.mjs baseline docs/audits/2026-09-23-semantics-supplemental/baseline-final.json
node tools/run-semantics-supplemental.mjs current docs/audits/2026-09-23-semantics-supplemental/current-final.json
NX_DAEMON=false NX_TUI=false SEMANTICS_REPORT=/private/tmp/semantics-original13-current-after-supplement.txt pnpm nx test kernel --testFile=semantics-current.spec.ts --testFile=semantics-supplemental-selftest.spec.ts --skip-nx-cache
node tools/check-spec-types.mjs
pnpm exec eslint packages/kernel/src/enhancers/transactions/semantics-current-adapter.ts packages/kernel/src/enhancers/transactions/semantics-supplemental.ts packages/kernel/src/enhancers/transactions/semantics-current.spec.ts packages/kernel/src/enhancers/transactions/semantics-contract.ts packages/kernel/src/enhancers/transactions/semantics-supplemental-selftest.spec.ts tools/run-semantics-supplemental.mjs
git diff --check
```

The two recorded evidence commands deliberately exited 1. For a new execution,
choose new output filenames; the runner will not overwrite the preserved ones.
Focused ESLint and whitespace checks passed. Spec-type checking reported no
errors in this slice; it still failed on concurrent `transaction-safety.spec.ts`
(3), `hydration-snapshot.typing.spec.ts` (7) and
`link-structured-address-audit.spec.ts` (1) in that check. Baseline limits were
not changed. No full kernel run, production mutation, full mutation matrix,
network operation, commit or build was performed for this test-only phase.

## Still unproved

Canonical/pending separation, authority revisions/correlation, native terminal
and per-contribution dispositions remain unavailable to this adapter. Unordered
authority is still not tested by this supplemental phase. O03 mixed structural
publication, the complete structural/dependency matrix, all composition/identity
variants, non-interference, retention and context matrices and production mutation
closure remain outstanding. The six S12 rejection permutations do not close all
three-writer settlement outcomes. Neither the red-to-safe-refusal changes nor
the observer mapping completes the executable constitution or the surgical
product contract.
