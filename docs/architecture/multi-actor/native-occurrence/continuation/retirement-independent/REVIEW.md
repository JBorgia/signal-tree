# Independent publication-retirement review

Disposition: no blocking defect found in the **bounded owner-free, neutral, exact-subject retirement mechanism**. This is not native integration acceptance, universal GC qualification, or a promise of reclamation after owners settle. Frozen source was not modified. Executions used a separate copy at `/private/tmp/st-publication-retirement-independent/candidate`.

## Identity and executions

Verified all 2,945 manifest entries against both frozen source and isolated copy: zero mismatches (`IDENTITY.json`). Frozen manifest SHA256 `3be20bcf4550cd79eeb36cabd6842f5a025365665d651625b05ee5b32b8ed9f9`; runtime patch `97a4362ccc2dd08fdb6501eeb48838284fe9506a53ed81c8b74e4406dfb31c11`; source patch `8227635d7fc025f7e55115b27ba18b77a0d1b5be4b71d9cd861858e19f9c49b6`. Reviewed RESULTS, REVIEW-REQUEST, runtime/source patches and `/private/tmp/st-retirement-mechanism-review.md` against actual source. The frozen directory is a copied source tree, not a Git checkout; manifest identity is the applicable identity.

All commands below ran from the independent candidate, with:

```sh
export PATH=/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:$PATH
export NX_DAEMON=false NX_ISOLATE_PLUGINS=false
corepack pnpm nx test kernel --skip-nx-cache publication-retirement-acceptance.spec.ts entity-publication-work-lifetime.spec.ts publication-retirement-boundaries.spec.ts
ST_RETIREMENT_FAULT=naive-retire corepack pnpm nx test kernel --skip-nx-cache publication-retirement-acceptance.spec.ts --testNamePattern='foreign pending exclusion'
corepack pnpm nx test kernel --skip-nx-cache publication-retirement-independent.spec.ts
node tools/check-spec-types.mjs
```

- Unchanged supplied controls: **22/22 pass**, exit 0, `controls.log`.
- Naive mutation: **expected 1 failure / 8 skipped**, exit 1, `naive-mutation.log`. Actual publication `[[{id:'b',n:2}]]` violates the preserved empty-send assertion while the foreign owner is pending. This is useful publication, not a vacuous silence control.
- Added independent controls: **2/2 pass**, exit 0, `independent-final.log`: exact non-Error first throw survives later source-completion and internal membership throws, both later callbacks execute and cleanup drains; captured ordinary/physical membership, field, placement and key requirement objects retain their property descriptors across deletion.
- Spec-type gate: exit 0, `spec-types-final.log`. This is the repository ratcheted spec gate, not a claim of zero inherited spec diagnostics or a fresh full source-type run. No ratchet changes.

The new test exists only in the independent copy; `independent-tests.patch` records it. No runtime instrumentation or repair was used. Author-reported 125 tests, GC tests and source types were read, not independently rerun here.

## Mechanism findings

1. **All eight maps accounted for.** `experimental-publication/entity.ts:178–210` snapshots fields, members, placements, views, visible, placementViews, mappings and mappingViews. It gathers only requirements present in those entries, checks recursive readiness and every forbidden proof bit/actual role/possible-owner list, then deletes all eight entries. Historical-window presence alone does not veto neutral ordinary churn. Both key counters are exposed at :56; the boundary control additionally checks changed key-evidence identities. Retirement does not mutate held requirements. Row-map construction uses copies (:95–96); the existing in-place physical-view requirement assignment (:136) occurs inside an installed publication record and changes the source revision. There is no callback between the final revision/identity checks and deletion in this implementation.

2. **Installed errors and exact lifetime.** `entity-signal.ts:1408–1448` sets installed only after ordinary and native record installation. It attempts every source completion, then the internal membership callback, then requests retirement for actual forget instructions and attempts existing no-owner reclamation. `EntityPublicationSource.complete`, `internals/entity-publication.ts:203–211`, attempts all participants and preserves the exact first thrown value. Abort-before-install cannot request retirement. Same-key reentry allocates another subject; preserved controls verify fresh value 99 survives while old evidence drains. The eligibility closure rechecks absence plus no ordinary topology retention and is admitted only by an installed forget instruction, not arbitrary missing membership.

3. **Ready callback and revision boundaries are appropriately narrow.** `internals/entity-publication.ts:89–137` queues only an exact request; synchronous requirement readiness never deletes during finalize or outer completion. A ready non-neutral request is cancelled while facts remain. Subscriptions cancel on readiness, replacement, or disposal. `prepare/finalize` at :164–197 checks retirement/recipient revisions before and after callbacks and full source revision across callback execution. Actual retirement invalidates prepared readers; supplied controls demonstrate refusal and callback-reentry refusal without undoing the nested write. The dedicated retirement revision permits intentional physical/ordinary sequential compensation. It does **not** implement general optimistic validation of every ordinary revision between arbitrary prepare and finalize calls; do not describe it that way. The preserved rollback lifetime control exercises the sequence that the author's first full-revision attempt incorrectly rejected.

4. **Held state and negative proof survive appropriately.** Useful churn sends, retained receipts/handles, the pending local inverse rollback, source fact identity after foreign confirm/rollback and the naive mutation all replay successfully/as expected. Source deletion is distinct from a later relationship-local baseline. The revised foreign-terminal tests establish exact unknown exclusion retention; they do not establish that every newly acquired Link must remain blocked after foreign terminality. Earlier stronger late-Link expectations and predecessor failures remain preserved in the supplied packet. No new baseline/supersession policy is justified here.

5. **Disposal and limits.** Root materialization owns source disposal (`materialize-markers.ts:150–164`, `entity-signal.ts:1619`, `signal-tree.ts:2028`). Disposal cancels retirement requests; it does not prove all source maps empty. Mocked readiness tests are cancellation tests, not owner-transition tests. No owner-settlement listener exists in this change. Unknown, rejected, unavailable, possible-owner, or actual-role evidence can remain retained indefinitely under the deliberately narrow predicate. This does not violate the reviewed scope and must remain explicit.

## Preserved independent first failure

`independent-first.spec.ts` and `independent-first.log` preserve my original additional fixture and its 1-fail/1-pass run. I incorrectly used public `rows.tap().onRemove` as the internal membership callback. Public onRemove is later in `removeOne` (`entity-signal.ts:4155`), after the shared commit returns, and is skipped when source completion throws. The shared-boundary requirement concerns `membershipTap(MEMBERSHIP_FACTS, ...)` at :1430. The corrected fixture attaches the actual existing internal membership source, keeps the exact first-error and later-callback assertions, and passes. This is not evidence that public onRemove is guaranteed after a source completion error; no such guarantee is established by this patch. The captured-requirement control passed unchanged in both runs.

No frozen assertions were changed, no runtime source was changed, and no recommendation to broaden retirement policy follows from this review.
