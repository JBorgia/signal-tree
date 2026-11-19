# Four additional Phase A cases — three pass, one preserved failure

Test-only on unchanged frozen composition2a020da77e263693fbee66973bfba7072cb489a7cbde53bcda4336d686f820cd. Original six-case source, patch, report and results are immutable. Four additional unique cases only; one focused rerun adds getter stack observations to the failed case, not a fifth scenario. No runtime prototype, broad suite, allocation/timing experiment or new API.

## Actual results

- additional-first: **3 passed,1 failed**. A/B/D passed. C failed `expect(failure).toBeInstanceOf(Error)` because undo returned normally.
- additional-c-trace: same C assertion failed;3 other cases filtered. Output-only getter stacks added; no assertion softened.
- additional-spec-first:1 new error, invocation of optional field accessor. Fixed with `extra!`, erased at runtime; original source/log preserved. additional-spec-final passed unchanged spec gate; no ratchet change.
- Source gate was already green for unchanged production in the preceding packet; not rerun. All3102 production/baseline input hashes verified unchanged afterward.

Ten distinct cases now exist: prior six passed; additional three passed and one remains failing. Do not sum repeated runs into unique coverage. The twelve previously executed original controls retain their prior receipt; not rerun here.

## A: public hidden ancestor rollback and nested observer exposure — passed

Real transactions+restoration tree, one original row a. Pending transaction adds b; undoable whole-root omission hides g; a second tree is separately omitted. Real row `tap.onRemove` runs during pending rollback. Nested tap asserts own and foreign public byId are absent; recorded both `all()` values are empty. One tap occurred (observed, not fixed-count contract). After rollback, root still equals `{count:1}` and rows remain absent. Undo of omission re-exposes exactly original a and original sibling k/count; later row update succeeds. No private physicalRows injection in this case.

This establishes one useful public hidden compensation/observer route, not every omitted-member/reversal path. It does not establish helper callsite reach or a proposed reader's safety.

## B: public point rollback and reorder undo — endpoints pass, desired helper reach absent

Actual row update transaction rolls back to exact two original rows. Undoable reorder `[a,b]→[b,a]` undoes/redoes exact values/order. Transparent byIdOrFail spy records actual call stacks, preserving receiver/arguments/result. It captured one point-rollback call through `resolveCurrentSubjectTarget → resolveLiveScalarNode → applyEffect → prepareSelectedOperation/prepareSelectedUnit`. No captured call traversed snapshotCollectionEntityValue. Reorder undo produced no byIdOrFail call in this observation.

Therefore direct point helper :1016 and placement-rekey helper :2414 are **not reached by these public sequences**. This is not proof that no supported public route can reach them. Source transactions.ts:3887–3912 conditionally uses preparePointRealization for frontier or mixed root-scalar/entity compensation; ordinary selected field rollback can take another producer. A pure reorder can be represented without the exact rekey-helper branch. No private invocation was substituted and labeled public. These two route gaps remain.

## C: nonthrowing getter reentry — first refusal oracle fails; preserve, don't promote

Fixture seeds a row `{id:a,n:1,extra:2}`, records n7, then adds an accessor to the current physical backing. On first getter read it writes root stamp5 and returns2, without throwing. Undo returns normally; diagnostic recorded **stamp5, row n1,3 getter reads**, no error. The expectation of atomic refusal fails, and later cleanup/recovery assertions in that test are blocked. Original assertion and first log remain unchanged.

The targeted rerun shows actual getter sites:

1. entity-signal.ts:2400 `const finalUpdated = {...entity,...transformedChanges}` in updateOnePrivate, reached through writeField / applyEffect's callable invocation (:2081).
2. physical/entity-value-store.ts:69 prepareValueTransition.
3. path-notifier.ts:125 changedSubjectFieldKeys during publication.

It did **not** establish snapshot-helper deepClone preparation. Thus the fixture's “clone preparation” premise is not demonstrated, and its unconditional refusal expectation cannot be treated as proof of a snapshot-reader defect. No oracle rewrite was made. The source also has genuine clock guards in prepareSelectedOperation (:844,847), so do not generalize this result into permission to omit guards or claim all preparation reentry is harmless. The truncated getter stack does not independently establish the enclosing producer/clock lifecycle in C. Whether this exact completed nested-write behavior is a supported selected/legacy-route outcome or needs a separate causal audit is left explicit; this bounded packet does not adjudicate that broader question.

This case establishes observed later values and a failing proposed oracle; it does not close nonthrowing preparation reentry+atomic refusal coverage. It introduces no fixed getter-count contract. No nested write was silently discarded in the observation, but that alone is not an atomicity proof.

## D: foreign pending owner Link safety during another-field undo — passed

Foreign q transaction owns v7. Row Link declares dependency on q while writing row.extra from foreign.v. No outbound payload after that write. Undoable n9 also remains held; undo restores n1 while physical extra7 stays selected, still no send. Confirm q yields **exactly one** payload `[{id:a,n:1,extra:7}]`; settled plus another drain adds no duplicate. Original q remains the owner settled by confirm. Real public Link/declaration/row APIs only; no proof injection.

This is the confirm branch with one row and another-field reversal, not all foreign ownership/rollback combinations or a new source authorization rule.

## Identity, first evidence and limits

`ADDITIONAL-FIRST.spec.ts` and `ADDITIONAL-SEMANTIC-FIRST.spec.ts` preserve first fixture/assertions. `ADDITIONAL-FINAL.spec.ts` adds only the optional-accessor erased typing assertion and output-only getter stacks. `additional-tests.patch` is a separate new-file patch; prior tests.patch is unchanged. Runs have COMMAND.json/EXIT/first.log and append-only observations. All used pinned Node24.15.0/pnpm10.17.0, own caches/tmp, single Nx worker. No runtime instrumentation/config edits. Physical/current payload mutation in C is explicit test ingress, not a runtime change or native proof injection. Root and current combined source untouched.

Open: actual direct-point and placement-rekey helper routes, true guarded-preparation nonthrowing reentry/refusal, full cloning/identity and missing-capability/error behavior. A and D add positive public evidence; they do not make the reader replacement eligible on their own. Main's separate mechanism/premise review remains authoritative. No performance, retained-memory or130k/OOM conclusion.
