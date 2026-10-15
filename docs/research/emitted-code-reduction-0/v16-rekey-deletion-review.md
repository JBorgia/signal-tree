# Independent narrow deletion / rekey review

**No blocking behavioral finding in the exact inspected diff.** The rekey delegation preserves the original validation, identity capture, commit and publication order. Deleting the unused numeric restore-index path is supported. The separately added integrity-helper relocation preserves all checks and both existing invocation sites.

Read-only review; no edits except this report, no test/build execution or polling. Reviewed applied files in `/private/tmp/signaltree-point-owner-experiment-20261014` against `/private/tmp/entity-reduction-audit/{entity-before,store-before}.ts`. For the spec, compared against `/Users/jonathanborgia/.codex/worktrees/capture-point-owner/signaltree/packages/kernel/src/lib/physical/structural-store.spec.ts`, since no spec snapshot was supplied. The owner's “69 tests pass” is supplied evidence, not independently verified; the later integrity/build results remain unknown here.

## Rekey behavior and callback boundaries

The entity diff is exactly replacement of the ordinary non-no-op execution block with:

```ts
return planPreparedRekey(from, to, allocateSubjectId(from), entity);
```

The ordinary planner still reads the projected entity first, throws for missing rows, handles `from === to` before destination occupancy, and throws for occupied destinations before allocation. Its no-op commit still narrows `lastSubjectIds` without physical mutation or publication. Public `changeId` still checks collection absence, prepares, commits, then publishes.

For a non-no-op, JavaScript evaluates the subject allocator before entering the helper, at the same stage as the previous local assignment. The already-read entity object is passed unchanged; there is no second projected read, clone, lookup through the public hook, or user callback inserted. The helper's repeated strict equality check cannot become true for these unchanged primitive arguments. The effect is still allocated during planning, and mutation remains deferred until `commit`.

The shared body preserves this exact sequence:

1. Stage transfer; prepare responsibility; commit the physical frame/committed observer; advance physical clock unless suppressed; emit membership facts (`commitAndProjectEntityMutationFrame`).
2. Publish changed-subject revision/state, record rekeyed identity, narrow `lastSubjectIds`.
3. Carry selected key only if it still equals `from`; synchronize destination row; update collection signals.
4. On separate `publish`, resolve ambient metadata at publication time unless overridden, then notify with the same entity for before/after and the same rekey structural fact.

Consequently synchronous observer reentry, throws from commit/invalidation/publication, and partial progress before those throws retain their current boundaries. The change does not introduce recovery, reorder notifications, add lifecycle taps, or turn rekey into remove/add. An exception in commit still prevents the ordinary caller from reaching publish. Existing exceptional behavior is preserved, not newly certified desirable.

**Keep the two preparation contracts distinct.** Direct realization callers at `lib/internals/causal-runtime/tree-realization-adapter.ts:1081–1106` may supply a subject/value from future prepared topology. They must continue to bypass ordinary current-occupancy validation. The proposed direction of delegation is correct; reversing it would not be equivalent. The ordinary path calls the lexical function, not `api.__planPreparedRekey`, so this does not create a new observable hook invocation for instrumentation that replaces that property.

History checked: `1bd52ed0` and `0e47de5c` fixed rekey claim width and no-op participation. The retained helper includes both fixes. The latter commit specifically corrected an earlier false claim that ordinary transactional tests exercised the prepared entrypoint: use the hand-composed realization tests below as separate evidence.

## Restore-index deletions

`restoreIndexForSubjects` is the only caller of `indexOfNode`. Repository source/test/tool searches, class consumer inspection and the prior introduction history identify no live external caller of the numeric-index method. Actual restoration runs through `resolveSubjectRestorePlacement` and `restoreSubjectAtResolvedPlacement`, including F's preflight preparation. Those methods remain unchanged. **Keep `nodePrecedes`**, which is still needed to choose the surviving next anchor when historical anchors have reversed order.

Expected effect is deletion of unused retained class code, not a change to linked order, restore policy, handles, or public exports. No savings measurement is asserted.

## Integrity relocation — separate from the rekey simplification

The applied store diff also deletes `__assertActiveOrderIntegrityForTesting`; the spec gains `assertActiveOrderIntegrity(store)` and changes its two calls. I mechanically compared the old/new bodies after replacing `store['field']` with `this.field` and normalizing whitespace: **identical**. All head/tail, link, duplicate-key/subject, index identity, subject-state and count assertions remain, including error strings. No test case was removed in the inspected spec diff.

Bracket access uses the actual existing TypeScript-private property types; `ActiveNode` is imported as a type. No casts, `any`, reflection API, or production hook/import was introduced. This is intentionally coupled white-box test code; a future move to ECMAScript `#private` storage would require redesign. Run the spec-types gate as well as the runtime test: test execution/build alone does not establish spec type safety. Formatting of the moved helper is uneven but not a behavior defect.

Do not include other test-only entity hooks, restore wrappers, prepared-facility splits, or physical-index changes in this candidate. The integrity relocation is independently reviewable and need not expand into those projects.

Minor bookkeeping: `tools/subject-identity-census.mjs:140,143` still lists `restoreIndexForSubjects` and `__assertActiveOrderIntegrityForTesting`. These are classification strings, not runtime calls, so not a shipping blocker. Update that inventory when maintaining the census; do not represent removed methods as current production costs.

## Exact existing validation set

Run these full files through `pnpm nx test kernel --testFile=<path>` (repeat for each file, or pass the file filters through the existing Nx wrapper). Paths below are relative to the temp repository. No new tests or benchmark are required merely to mirror the delegation.

- `packages/kernel/src/lib/entity-active-prepend-changeid.spec.ts`: ordinary missing/occupied/self validation, selected/unrelated selection, insertion order, held fields and identity, freed-key reuse.
- `packages/kernel/src/lib/entity-signal.spec.ts`: subject-backed ownership and canonical rekey facts delivered to multiple observers, including payload ID differing from storage key.
- `packages/kernel/src/enhancers/restoration/rekey-claim-width-0.spec.ts`: ordinary/no-op/rejected participation, history/redo, confirm/rollback, one-subject claim width and held identity.
- `packages/kernel/src/lib/internals/causal-runtime/tree-realization-adapter.spec.ts`: hand-composed prepared contexts, especially “realizes remove-restore-rekey-scalar as one coherent prepared topology turn,” “realizes fresh add followed by rekey and scalar against prepared future topology,” and competing occupancy rejection. This supplies coverage the transactional test title alone does not.
- `packages/kernel/src/lib/physical/structural-store.spec.ts`: moved integrity checks at both callsites, rekey ordinal/handles and all surviving/missing/reversed-anchor restore cases.
- `packages/kernel/src/lib/physical/entity-mutation-frame.spec.ts`: restore preflight failures leave earlier staged work unapplied; fresh-add/rekey final address.

Also require source typecheck and the existing **spec-types** gate for the helper relocation, plus normal affected-file formatting/lint. These recommendations are not a claim those checks have run. Existing successful runs need not be repeated if their exact changed-file identity and file coverage already match. Additional framework-wide suites are not specifically demanded by this identical-body refactor; broaden only if implementation or failures introduce a new question. Release/bundle sign-off remains separate.

Inspected applied SHA-256 identities:

- `entity-signal.ts`: `8359b43ee770bc94ec73ebd1afe1c4322b9bd0a8b60f551fec8c60af186375cb`
- `physical/structural-store.ts`: `f3652da4892991aa73c2b59c35d2c7ede962d02326a030c76e763226fb967dec`
- `physical/structural-store.spec.ts`: `7f7ae313aae72e3fa66256385fce34b3a87a816e4ab1701a6ffc791858f23ada`
