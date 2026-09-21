# Quiet-host CPU decision — preregistration v2 (supersedes v1)

**Dated 2026-09-20. Written BEFORE any quiet-host CPU number has been observed.**
No benchmark from the three-way experiment has been run. Preregistration
integrity is intact: this amends the CANDIDATE SET, not the thresholds, and it
does so while the result space is still empty.

v1 (`CPU-DECISION-PREREGISTRATION.md`) remains valid for everything it says
about thresholds, gating, provenance and protocol. Only the candidate list and
the decision tree are superseded.

## Why amend

The rejected `bare-cell epoch` row bundled two separable facts:

```
bare-cell experiment
├─ Angular: extremely cheap physical realization (1,350 B/entity)
└─ Vue / kernel contract: BROKEN — cell.set is an inert placeholder,
   the epoch never advanced, and publication bypassed kernel grouping
```

The Vue failure proves the UNIVERSAL bare-cell implementation was invalid. It
does NOT prove that Angular's native signal realization is invalid when it is
exposed deliberately through `@signal-tree/angular` and still driven through the
kernel's publication semantics.

v1 collapsed those into one rejection, and in doing so discarded a measured
1,350 B Angular result without testing whether it was recoverable correctly.
That is the error being corrected.

The v1 fallback row also assumed the wrong thing:

```
v1:  "Angular-specific + token elsewhere" = 2,222 B   (Angular falls back to the STRONG carrier)
v2:  "Angular-native epoch + token elsewhere" = TBD    (Angular gets a CORRECT native epoch)
```

Those are different candidates and need separate rows.

## The intended architecture

```
kernel
  owns semantic publication, grouping, SubjectId/lifetime, canonical stores
          |
@signal-tree/angular
  owns the native epoch REALIZATION
          |
Angular signal
```

and explicitly NOT:

```
kernel assumes createWritableCell()'s cell is secretly writable
```

That assumption is what broke Vue. A framework package opting into its own
realization is a different thing from the kernel guessing about one.

The governing rule this sharpens:

> **The kernel standardizes semantics. Framework packages optimize physical
> realization.**

## `ANGULAR-NATIVE-EPOCH-0` — the one bounded experiment

Requirements, all mandatory:

1. Implemented in `@signal-tree/angular`, not in the kernel.
2. Kernel stays framework-neutral — no Angular import, no Angular assumption.
3. Same `EntityValueStore` / `StructuralStore` authority.
4. Same SubjectId and lifetime semantics.
5. Epoch publication still obeys kernel grouping (`publish`).
6. Vue stays on the token epoch.
7. Neutral and React stay on the token epoch.
8. Every shared semantic suite passes unchanged.
9. Angular native publication gets direct, mutation-proved coverage.
10. Angular released memory measured on the candidate branch.

## Kill rule — fixed before measuring

| measured Angular `released` | verdict |
| --------------------------- | ------- |
| `> 1,850 B/entity`          | **KILL.** Not enough prize left against universal token's 1,959. Restore the v1 three-way experiment unchanged. |
| `1,600 - 1,850 B`           | marginal; carry to CPU only if correctness is fully clean |
| `~1,400 - 1,600 B`          | **belongs in the CPU final** |

The prize being tested: 1,959 -> ~1,500 is ~459 B/entity, about 23% less
persistent Angular entity realization memory, on the order of 46 MB at 100k
realized entities.

A correctness failure kills it regardless of the number. The bare-cell result
was 1,350 B precisely BECAUSE it had deleted semantics; a repeat of that is not
a success.

## Amended candidate grid

| candidate                       | Angular realization      | others | Angular B/entity |
| ------------------------------- | ------------------------ | ------ | ---------------: |
| strong                          | strong carrier           | strong |            2,222 |
| cell epoch                      | generic writable-cell    | cell   |            2,087 |
| universal token                 | token                    | token  |            1,959 |
| **framework-specialized**       | **Angular-native epoch** | token  |          **TBD** |
| ~~bare-cell~~                   | —                        | —      | REJECTED (Vue invalidation dead, grouping bypassed) |
| ~~weak entity carrier~~         | —                        | —      | REJECTED (non-retaining observers freeze) |

## Amended decision tree

```
Is ANGULAR-NATIVE-EPOCH-0 semantically valid AND <= 1,850 B?

NO
  -> run the v1 three-way experiment unchanged
     (strong vs cell vs token, v1 thresholds)

YES
  -> run a FOUR-way quiet-host experiment:
       strong / universal token / Angular-native epoch
       (+ cell epoch only if still economically relevant)
  -> choose the efficient frontier on the v1 thresholds
```

v1's `token >5% worse -> Angular strong carrier` branch is superseded: if the
native candidate validates, the Angular fallback is the native epoch, not the
strong carrier.

## What is NOT amended

Thresholds (`byId-warm` and `updateOne` flat <=2%, tradeoff 2-5%, materially
worse >5%), the A/A rejection gate at 5%, the one-workload-per-process protocol,
both execution orders, the two-tier provenance rules, and the principle that
Angular does not subsidize the other adapters. All carry over from v1 unchanged.
