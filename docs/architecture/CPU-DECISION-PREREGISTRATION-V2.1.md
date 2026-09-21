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
