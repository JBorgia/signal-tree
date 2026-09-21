# Quiet-host CPU decision — preregistration v2.1

**Dated 2026-09-20. Written BEFORE any quiet-host CPU number has been observed.**
Angular MEMORY for the native candidate has been seen (1,350 B/entity); CPU has
not. This amendment concerns only how the CPU candidates are constructed.
Thresholds, gating, protocol and provenance are unchanged from v1/v2.

## Why amend again

`ANGULAR-NATIVE-EPOCH-0` qualified on correctness and memory, but it introduced
TWO changes at once:

```
1. Angular-native create/advance epoch pair   (framework-specific)
2. ONE shared epoch publisher per runtime     (framework-NEUTRAL)
```

The second is not an Angular optimization. It improved Vue from 1,672 to 1,576
on the same branch, which proves it is cross-framework. So the headline

```
universal token 1,959  ->  native branch 1,350   =  609 B
```

is NOT the price of Angular specialization. It is Angular specialization PLUS a
neutral publisher change that every candidate should have. Attributing all
609 B to the native carrier would be wrong, and that figure is withdrawn from
use until the split is measured.

Removing a newly discovered confound before the metric being decided — CPU —
has been observed is not moving the goalposts. It is the reason the freeze
exists.

## The normalization

A new common base carries ONLY the framework-neutral infrastructure:

```
cpu/v2-base
  ObservationAdapter createEpoch/advanceEpoch seam
  LocationRuntime advanceEpoch contract
  shared epoch publisher
  entity-signal advancing through the runtime
  updated shared semantic tests
  NO Angular createEpoch/advanceEpoch implementation
```

Four decision candidates derive from that exact commit:

| candidate             | difference from `cpu/v2-base`                       |
| --------------------- | --------------------------------------------------- |
| `cpu/v2-token`        | none — the portable token fallback                   |
| `cpu/v2-angular-native` | Angular adapter supplies the native epoch pair     |
| `cpu/v2-cell`         | portable epoch built on `createWritableCell`         |
| `cpu/v2-strong`       | entity path uses the strong carrier instead of an epoch |

So the experiment holds constant: kernel semantics, shared publisher, adapter
API, publication path, tests, provenance fixes. **Only the carrier realization
varies.**

## The v1 branches are NOT rewritten

`cpu/strong-carrier`, `cpu/cell-epoch`, `cpu/token-epoch` and
`cpu/angular-native-epoch` are preserved exactly as they are. They are the
historical record of how these architectures were discovered, and rebasing them
would destroy that provenance. The `cpu/v2-*` family are the decision
candidates; the v1 family are controls.

## Mandatory before CPU

Memory is re-measured on all four v2 candidates and frozen into their manifests.
The question that re-measurement answers:

```
v2-token Angular  =  ?
v2-native Angular =  ~1,350
```

- If shared publication moves token to ~1,800, the Angular-specific prize is
  ~450 B, not 609 B.
- If token stays near 1,959, nearly all of the 609 B belongs to the native
  primitive.

Either outcome is useful. Neither may be assumed.

## The architectural rule this confirms

> **Shared semantic/runtime optimizations belong in the kernel. Framework-
> specific physical optimizations belong in `@signal-tree/<framework>`.**

The shared publisher is the former — multiple adapters benefit. The native
Angular signal epoch is the latter — only Angular can exploit it. This
amendment exists because the first experiment accidentally bundled one of each.

## Unchanged

Thresholds (`byId-warm` / `updateOne` flat <=2%, tradeoff 2-5%, materially
worse >5%), the 5% A/A rejection gate, one workload per process, both execution
orders, two-tier provenance, and the principle that Angular does not subsidize
the other adapters.


---

# Results — memory, frozen

Four candidates, each one realization file off `cpu/v2-base`, three
process-isolated runs per cell, two entity counts. Released B/entity:

| candidate           | angular | vue  | kernel | react | angular @20k |
| ------------------- | ------: | ---: | -----: | ----: | -----------: |
| `v2-strong`         |   2,222 | 2,687|  2,475 | 2,475 |        2,202 |
| `v2-cell`           |   1,991 | 1,656|  1,747 | 1,748 |        1,970 |
| `v2-token`          |   1,863 | 1,576|  1,747 | 1,748 |        1,842 |
| `v2-angular-native` | **1,350** | 1,576| 1,747 | 1,748 |      1,329 |

All four pass every suite identically: kernel 280 files, angular 24, vue 4, with
0 dirty files each.

## The attribution, which is why this amendment existed

```
former apparent Angular advantage      609 B
  shared publisher (neutral)            96 B   16%
  Angular-native carrier               513 B   84%
```

`v2-token` minus `v2-angular-native` is **513 B/entity (27.5%)**, and that — not
609 — is the price of Angular specialization. The headline survived
normalization mostly intact, but it had to be measured rather than assumed.

The shared publisher saves **exactly 96 B on both Angular and Vue** (1,959 ->
1,863 and 1,672 -> 1,576).

CORRECTION to how that was first written here and in `e541bcc2`: the equal
figure does NOT by itself make the publisher "provably common infrastructure".
What makes it common infrastructure is structural — the optimization lives in
the shared runtime and both adapter paths use it. What the two equal
measurements establish is narrower and still worth having: its MEMORY EFFECT
REPRODUCES across two unrelated adapters, so the saving is not an Angular
coincidence. The architectural claim and the measurement claim are different,
and the first sentence collapsed them.

## The control held

`v2-strong` measures 2,222 B — identical to `cpu/strong-carrier` on the v1 base.
The v2 infrastructure did not perturb the non-epoch entity path, which is the
check that the normalization introduced no confound of its own. Had it moved,
the grid would have been evidence about `cpu/v2-base` rather than about
carriers.

## Cell is memory-dominated

Against `v2-token`: 128 B worse on Angular, 80 B worse on Vue, same intended
semantics. It stays in the CPU run anyway, because the preregistration says a
dominance claim gets measured rather than assumed. If it buys no CPU, it can be
formally removed from the frontier afterwards.

## The question the CPU run now answers

It is no longer "is the token epoch acceptable on Angular?" but:

> **Does Angular-native keep its 27.5% memory advantage without paying enough
> CPU to invalidate it?**

A candidate 513 B/entity ahead has more room to absorb a small CPU cost than
token had against strong. **The thresholds are NOT adjusted for that.** They
stay exactly as preregistered in v1; the efficient frontier is read afterwards
using the rules already written. Widening a threshold because a candidate is
winning on the other axis is the failure this whole process exists to prevent.

## Conditional interpretation, preregistered before any CPU number

**The four-way run measures complete candidates. It does NOT independently
measure the CPU effect of the shared publisher.** Every epoch-based v2 candidate
contains it; `v2-strong` does not exercise that path at all.

So if an epoch candidate fails the >5% threshold on `byId-warm` or `updateOne`,
the correct conclusion is bounded:

> That candidate fails AS CONSTRUCTED. The regression is NOT yet attributable to
> its carrier, because carrier and publisher changed together. Mechanism
> attribution requires a bounded follow-up comparing shared versus per-epoch
> publication before an otherwise valuable carrier is abandoned.

This is written down now, before any CPU result exists, because the failure mode
it guards against is specific and this program has already committed it once: a
`+4.1%` regression was attributed to a `WeakRef.deref()` in code that provably
never executed in that benchmark. An undifferentiated regression is not a
mechanism.

No fifth candidate is added. Expanding the experiment after every result is how
a decision program never terminates; the follow-up is conditional and bounded,
and only runs if the threshold is actually failed.

## Final CPU family

```
cpu/v2-strong   cpu/v2-cell   cpu/v2-token   cpu/v2-angular-native
```

Run these four, not the original three. Manifests with frozen memory are in
`cpu-candidates/v2/`.
