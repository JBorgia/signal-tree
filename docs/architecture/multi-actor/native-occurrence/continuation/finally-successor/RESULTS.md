# Deferred completion-error lint successor

Frozen manifest `76dc7e600928ee36331a15674baa9a25960a78b2f97bee637dd693cac28fcb28` (3060 files). Exact predecessor: `4b48ad0640fa4b480c072f0f8c05a72898422a5c3067d90e7a9bc40ccb701e30`. One runtime function changed; one new 16-case spec. Predecessor frozen source reverified unchanged; both test copies use identical fixture bytes, with all predecessor manifest entries unchanged. No composition performed; independent review pending.

## Change

runDeclaration retains the original try/catch/finally, primary catch throws, cleanup, and secondary-report branch. Successful receipt return moves after finally. A completion failure on the non-exiting path sets a boolean and unknown value; after finally, that boolean selects throw versus receipt return. The explicit boolean preserves thrown undefined. Catch throws bypass the post-finally statements; a wake throw still overrides any pending completion. There is no flattened cleanup, ESLint suppression, API change, or new error policy.

## Evidence

- Prewritten matrix: PREWRITTEN-MATRIX.md (written before runtime change and tests).
- Exact predecessor matrix: 16/16 pass; successor identical matrix: 16/16 pass.
- Actual private lifecycle requirement/installation/readiness observer seams exercise finish errors, primary object/string/undefined, completion object/undefined, reporter throwing, validation accessor throwing, finish reentry and queued wake reentry. Each checks cleanup/continued usability. The test uses captured queueMicrotask callbacks, manually drained after checking synchronous outcomes.
- Wake scheduling throws are explicit host fault injection: the stub captures the callback then throws; this establishes precedence at the scheduling boundary, not a claim that a standard host behaves this way. No arbitrary sort or builder reentry semantics added.
- Affected lint: PASS, 0 errors / 26 inherited warnings. Source types and spec types: PASS.
- Existing six focused specs: 55 pass / 1 failure, same retained-collection restoration assertion as exact predecessor's preserved log (PREDECESSOR-SCALAR-FIRST.log). This known failure remains unresolved and is not reclassified as passing.
- Commands, environments, first logs and exit codes are under runs/. Spec types was still completing when the final focused suite launched; no timing claims rely on either execution. No broader test/release claim.

RUNTIME.patch isolates the production change. FROM-LINT-PREDECESSOR.patch includes the new assertions. All original failures retained. Runtime and test assertions from the earlier lint patch remain unchanged except the requested control-flow correction and new spec.
