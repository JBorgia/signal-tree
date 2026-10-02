# V15 operation outcome provenance

Scope: patch the published 15.4.0 behavior without changing transaction refusal
policy, public API, or arbitrary partial-application recovery. The v16 selective
integration discovered this defect while carrying applied-delivery bookkeeping.

## Published-artifact counterexample

Source release: `4ceb24a2a62dc893bf28c50ad971a955190539a7`. Kernel npm integrity:

`sha512-lTNXN9Whnl7JqYyWP4bPDbmBKcxEO8TeEzUXugejfipspV5n/TnIiTuPT0gK69QkzTYrIl1+AIgRhxiwg8yVGw==`

The reproduction uses the public neutral factory and restoration APIs, then
controlled fault injection at the installed artifact's internal validation port.
An undo applies, reactive delivery throws a consumer Error, and history correctly
advances to the redo position. A later redo validation throws the same Error
before application. Version 15.4.0 incorrectly advances history while the value
remains unchanged. This does not establish a common natural application trigger.

First result (exit 1): after undo, x=0 / canUndo=false / canRedo=true; after
failed redo, x=0 / canUndo=true / canRedo=false. Both throws preserve the same
Error identity. Raw probe and JSON: `/private/tmp/st-v15-published-outcome-probe/`.

## Repair and controls

A persistent WeakSet previously marked consumer Error objects as following a
completed application. Error identity outlives an operation, so that mark could
misclassify a later failure. The repair uses a private receipt for this invocation
only, carries it through bookkeeping, and unwraps at public exits. Original
errors and primitive throws retain their identity/value. An incomplete outer
application cannot inherit an inner receipt's completion.

Two permanent suites cover reused errors, nested same-tree delivery, incomplete
outer application, successful retry after refused validation, and exact public
throws for undo/redo and explicit rollback under both enhancer orders.
Against the unmodified release source: 3 passed, 22 failed, exit 1. With the
repair: 25 passed, zero failed, exit 0. The many primitive failures reflect the
old error-wrapper behavior; they are not 22 separate lifecycle defects.

Independent read-only review traced all three production helper callers and
found no additional blocker or public receipt escape. Automatic transaction
abort remains under its existing outer invalidation grouping. An application
callback that partially changes state and then throws is still not certified
as fully applied; this patch does not promise recovery from that condition.

Full kernel and typecheck/spec-types/kernel lint pass. Exact commands, test
counts and source hashes: `/private/tmp/st-v15-outcome-repair-evidence/`.
Build, installed-artifact and exact-candidate release results are recorded
separately; focused/source evidence is not publication qualification.

## Working-tree artifact verification

All five host builds pass; the first sandbox build stalled and was terminated
(exit -15), then the unchanged-source host build completed (exit 0). Full kernel:
3320 ordinary passes plus seven expected failures, thirteen skips and one TODO.
Fresh own-code bundle budgets pass without changing ceilings.

Packing and extracting the repaired kernel reproduces the same initial applied
undo/delivery throw, but failed redo now keeps x=0 / canUndo=false / canRedo=true,
exit 0. Original consumer error identity is preserved. The only probe changes
are artifact path and evidence label; the behavior assertions are unchanged.
Archive SHA-512: `sha512-Frs63wfMsxKxrFHV2G9RuMt5GCzO4kFnPhv4jP1t7eM0HEHLSWQzRTgfvb76wuSjZOlPWYXYD+M37/qIBZPBQA==`.
This archive still carries the pre-preparation version 15.4.0 and is explicitly
a local working-tree artifact, not an npm release. Evidence:
`/private/tmp/st-v15-repaired-outcome-probe/result.json`. Exact 15.4.1 qualification
follows after version preparation and candidate freeze.
