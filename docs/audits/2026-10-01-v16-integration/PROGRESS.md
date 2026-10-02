# V16 integration evidence

## Source selection

Donor: published v15.4.0 `4ceb24a2a62dc893bf28c50ad971a955190539a7`.
Untouched destination baseline: `628d302dadb082a48c58528651c9088234d0a777`.
`baseline/` preserves all four current-runner results, original-case output,
commands, input hashes and exits. No baseline execution errors occurred.
Historical `transaction-options/current.mjs` pins a different source and was
not used as evidence for this baseline.

## Slice 1: collection identity and own-field presence

Committed as `042e8ede`; test-declaration checkpoint `479d449d`.

The initial 59 carried cases produced 17 failures: six cross-collection identity
failures and all eleven field-presence cases. Literal-dotted collection cases
already passed and remain preservation controls. Collection scoping by actual
node now passes 48/48 identity cases, plus 72/72 existing v16 recovery,
inspection, rekey and current-truth controls. V16 owner-node indexing and
`subjectFieldSegments` remain authoritative.

Presence is captured and coalesced independently from value, inverted for
reversal, retained for reapply, and applied as deletion at an absent endpoint.
Presence-only effects are not discarded as undefined-to-undefined no-ops.
The original eleven cases plus ten additional controls passed. Independent
review found no bounded runtime blocker and requested actual nested siblings
and an absent-present-absent net-effect control. Those strengthen the final
presence suite to 23 passing cases.

The added suite's first six failures were **two implementation failures and
four wrong test expectations**: v16 already refuses the queued external/ABA
whole-turn rollback. The tests preserve that refusal and test retained authority
and later confirmation; no partial-rollback policy was introduced.

Full kernel: 331 files, 2936 passed, six expected failures, thirteen skipped,
exit 0 (before two final review cases were added). All-package build exit 0.
Typecheck and lint passed initially; spec-types failed on eighteen stale type
errors in four pre-existing v16 test files. Commit `479d449d` updates only those
test declarations to the API their runtime calls already use; all assertions
are unchanged. Corrected typecheck/spec-types/lint:budget: 3/3, exit 0.
Final review controls: 23/23 presence cases, exit 0. These are working-tree
slice checks, not an exact-SHA release qualification or performance claim.

## Preserved failures for subsequent slices

The lifecycle probe now distinguishes direct subscribers (v16 isolates their
exceptions) from reactive realization delivery (which can throw). The original
probe incorrectly required direct subscriber errors to propagate, then to be
reported: those first results are fixture mistakes, not repaired runtime bugs.
The corrected twelve-case probe gives eight passes and four genuine failures:
undo/redo applies the value, realization throws, history keeps its old position.
Reentrant settlement controls already pass and must be preserved.
Source and raw runs: `/private/tmp/st-v16-integration-evidence/slice2/`.

The stronger net-presence test also exposed same-tick composition: immediately
after rollback, a new `undoable()` sequence changes the value but undo does not
restore it. Both enhancer orders fail. The complete failing fixture is retained
at `/private/tmp/st-v16-integration-evidence/slice3/same-turn-rollback-then-undoable.spec.ts`.
The slice-1 net-presence control separates turns with a flush; that is **not**
a fix or qualification of the same-tick case. Scope-drain work must restore the
original no-flush case and resolve it. No failing expectation was marked skipped.

Next: complete reversal-delivery outcome integration, then semantic-scope and
membership work. No v16 publication, ownership-model selection, or v15 budget
transfer is implied by this checkpoint.
