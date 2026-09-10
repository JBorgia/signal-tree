# OWNER-EVIDENCE-0 — correcting OWNER-SCOPE-0

> 2026-09-10. Suite:
> `packages/kernel/src/lib/internals/diagnostics/owner-evidence-0.spec.ts`

## The defect in the prior conclusion

OWNER-SCOPE-0 classified frames with:

```ts
carriesValue = next !== undefined || prev !== undefined
```

**That is not semantically safe.** `undefined` is a legitimate SignalTree state
value, so `undefined → undefined` cannot mean "this was not value evidence" —
the same class of mistake as treating equality as absence of a semantic
transition. The invariant built on it was unsound, and has been withdrawn.

## What was tested

A **positive** discriminator for the unowned collection frame, rather than an
argument from value shape.

```text
OWNED    path=rows.A  ownerPath=rows  subjectIds=[1]  positionIds=[2]
         before={id:'A',name:'Alpha'}  after={id:'A',name:'Server'}
         ownerId=2   meta=[intent,origin,participation,ownerId]

UNOWNED  path=rows    ownerPath=rows  subjectIds=[1]  positionIds=[2]
         before/after absent
         meta=[intent,origin,participation]
```

| Candidate | owned | unowned | Discriminates? |
|---|---|---|---|
| `subjectIds` present | yes | yes | **no** |
| `positionIds` present | yes | yes | **no** |
| meta has keys | yes | yes | **no** |
| `ownerPath` present | yes | yes | **no** |
| `path === ownerPath` | — | true | **no** — a scalar leaf is `total`/`total`, also true |

## Result — OUTCOME C

**No positive discriminator exists on the frame.** An unowned frame cannot be
safely classified as non-evidence.

Note the unowned frame carries the **same** `subjectIds` and `positionIds` as
the owned one, so it is plainly the same logical mutation delivered at
collection granularity — but that is an *inference about this case*, not a
general property S2 can rely on.

### Adversarial case

`external(() => value = undefined)` on a tree whose value was already
`undefined` produced **0 frames** — same-value writes are suppressed. So the old
predicate's failure mode cannot arise *through this path*; but a transition
`X → undefined` or `undefined → X` would deliver, and the predicate would still
have been reasoning from shape rather than semantics.

## The safe rule

```text
ownerId present, matches    -> attributable to this tree
ownerId present, differs    -> reject
ownerId absent              -> CANNOT ATTRIBUTE
                               count toward scopeIntegrity; never guess
```

The third branch OWNER-SCOPE-0 hoped for — *"positively identified non-evidence
invalidation → ignore"* — **cannot be satisfied**, because no positive
identification is available.

## Consequence for S2

`scopeIntegrity` **is** required after all:

```ts
scopeIntegrity: 'complete' | 'incomplete-unscoped-writes'
```

letting Studio say truthfully:

> Some observed writes could not be assigned safely to this tree. This capture
> is incomplete.

Strictly better than either cross-tree pollution or silently dropping evidence
and presenting the remainder as complete.
