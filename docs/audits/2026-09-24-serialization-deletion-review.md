# Serialization deletion — the removed-coverage diff, done

Owed since `d2218eb0` was committed unreviewed to protect another session's
work. Eleven commits were then built on top of it, so this check was overdue.

## What was deleted

4,185 lines, 20 files: the `serialization()` / `persistence()` implementation
(`serialization.ts` 1487, `storage-adapters.ts`, `constants.ts`, `index.ts`)
and 16 spec files, the largest being
`persistence-as-link-swap-0.spec.ts` (437), `persistence-commit-ordering.spec.ts`
(358) and `persistence.spec.ts` (304).

## The risk, stated precisely

Deleting code with its tests is safe. Deleting tests that were the ONLY
coverage of behaviour that SURVIVED is not. Tests passing afterwards proves
nothing, because the deleted assertions are the ones that would have failed.

## Finding: the deletion is SAFE

**1. The API is genuinely gone.** No `export function persistence` or
`export function serialization` anywhere in `packages/kernel/src`. Zero entries
in `tools/api-baseline.json`. The only two mentions in the barrel are prose —
a comment about what the config types used to be, and a line recording that
`serialization` was replaced by `stored(key, default)`.

**2. One deleted spec DID reference the surviving API**, which is what made the
check necessary: `persistence-commit-ordering.spec.ts` names `stored()` five
times. Its header explains why, and explicitly denies being subsumed:

> The same defect `stored()` had, reached through a different API. The
> mechanism differs from `stored()` and that difference is the point...
> tested here separately rather than assumed to follow from the `stored()`
> tests.

That is the strongest possible statement that its coverage was independent —
but independent OF WHAT. It tested `persistence()`'s autoSave against the
commit boundary. `persistence()` no longer exists, so the mechanism it isolated
no longer exists either. Its reference to `stored()` is comparative prose, not
`stored()` coverage.

**3. The surviving API keeps the property.** The behaviour those tests
protected — speculative state must not be persisted while a transaction is open
— is covered for `stored()` by
`packages/kernel/src/lib/persistence-decompose-0.spec.ts:122`,
"PERSISTENCE-DECOMPOSE-0 §8: speculative writes must NOT persist", with 21
`stored()` references across the lib specs and 16 spec files exercising it.

No orphaned coverage. Nothing that survived lost its only test.

## What this does NOT clear

Only the removed-spec-coverage question. `d2218eb0` remains a 192-file snapshot
committed without review, and the rest of it — the repairs to `transactions.ts`,
`source-mutation.ts`, `restoration.ts` and the adapters — has been exercised by
the full suite and by three adversarial passes on work built on top of it, but
was never reviewed as a change set in its own right.
