# TruckTrax × 15.0.0-rc.1 — production gap model, pass 1 (migration correctness)

Candidate A: the pristine-built tarballs from `a4c0b747`, installed into an
isolated worktree of `calportland/truck-trax` (`wip/signaltree-15-rc1-eval`).
Angular 22, pnpm 11, 22 workspace projects. The consumer's checkout was not
touched.

TruckTrax answers a different question from Step 8. Step 8 asked whether
SignalTree's internal guarantees are true. This asks whether the SHIPPED
PRODUCT is fit for a real application — so every finding below is about the
public surface, not the kernel.

## Result: the app cannot compile. 212 errors, and they are not spread thin

TruckTrax is on `@signaltree/core@13.3.0`, imports **only** that package, and
uses **12 distinct symbols** across 29 files. Seven of the twelve are gone from
the RC's public surface.

| symbol | v3 import sites | status in 15.0.0-rc.1 | still implemented? |
| --- | ---: | --- | --- |
| `signalTree` | 9 | present | — |
| `entityMap` | 7 | present | — |
| `derivedFrom` | 5 | present | — |
| `timeTravel` | 4 | present | — |
| `status` | 6 | **deleted** (`4decd287`) | no |
| `loader` | 6 | **withheld** — "UNRESOLVED cache-policy carrier" | **yes** |
| `stored` | 2 | **withheld** — "NOT EARNED as RC public API" | **yes** |
| `flushAllStoredSignals` | 2 | **withheld** | **yes** |
| `asyncSource` | 2 | **deleted** — "named carrier removed" | no |
| `form` | 1 | **deleted** (`b57ba293`, FORM-DEL) | no |
| `history` | 1 | gone in an earlier major | no |
| `WithDerived` | 2 | gone in an earlier major | no |

The RC ships **34 public names total** — 26 from `.`, 6 from `./security`, 2
from `./storage`. `check-rc-public-dispositions.mjs` withholds **57 symbols**.

> **CORRECTION.** The "import sites" column counts import statements, not call
> sites. `loader` has **19** call sites, not 6. The per-capability numbers in
> [`v15-production-surface-audit.md`](v15-production-surface-audit.md) are the
> ones to use; these undercount every capability that is configured more than
> once per file.

## The distinction that matters: deleted vs withheld

Four of the seven — `loader`, `stored`, `flushAllStoredSignals`, `asyncSource`
in part — are **implemented in the shipped tarball and unreachable from it**.
The dispositions say so plainly: "UNRESOLVED", "NOT EARNED", "UNPLACED",
"survival requires independent authority". Those are statements about what the
project had time to justify, not about what applications need.

That is the same shape as the `lazy` incident: a capability that exists, is
built, ships in the bundle, and cannot be imported. The difference is that
`lazy` had no consumers and these have a production one.

**Deleted** symbols (`status`, `form`, `asyncSource`, `history`, `WithDerived`)
are ordinary major-version migration. They need a documented replacement, and
the consumer changes. That is TruckTrax's work.

**Withheld** symbols are SignalTree's work: either restore the export, or decide
the capability is not shipping and delete the implementation so the surface and
the bundle agree.

## The 212 errors, by root cause

| cause | errors | category | owner |
| --- | ---: | --- | --- |
| `status` / `StatusSignal` / `StatusMarker` absent | 36 | migration + product gap | both |
| `loader` / `EntityLoaderSurface` / `LoadingEntityMapMarker` absent | 21 | **withheld surface** | SignalTree |
| `form` / `FormSignal` absent | 14 | migration | TruckTrax |
| `@signaltree/ng-forms/signals` subpath absent | 7 | packaging/migration | SignalTree |
| `history` absent | 7 | migration | TruckTrax |
| `.with()` removed | 5 | migration (deliberate, 15.0) | TruckTrax |
| `EntitySignal.map` removed | 8 | migration | TruckTrax |
| `DevToolsConfig.treeName` removed in 14.1.1 | 5 | migration | TruckTrax |
| implicit-any cascade (`TS7006`/`TS7031`) | ~60 | consequence of the above | — |
| remaining assorted | ~49 | to classify in pass 2 | — |

The implicit-any errors are not independent findings. When an import fails, the
symbol becomes an error type and inference collapses downstream — they will
disappear when the imports resolve.

## What this does NOT yet tell us

Pass 1 stops at the compiler. It says nothing about application semantics,
performance, memory under real workloads, or whether the surviving APIs are
pleasant. Those are passes 2 and 3, and they are **blocked** until the app
compiles — which is blocked on the surface decision above, not on any code
TruckTrax could write.

## Ledger

```text
P0  — none found in this pass
      (the coalesced-turn reversal defect is carried from the rehearsal and
       was not encountered here, because the app does not compile yet)

P1  — RC public surface does not cover a real consumer's needs
      loader / stored / flushAllStoredSignals implemented but unexported
      owner: SignalTree     blocks: GA, and pass 2 of this evaluation

P1  — `status` has no documented replacement
      36 errors, 6 import sites, deleted with no migration note found
      owner: SignalTree (docs) + TruckTrax (code)

P2  — `@signaltree/ng-forms/signals` subpath removed without a note
      owner: SignalTree (docs)

P2  — migration guide for 13 -> 15 does not exist for these symbols
      form, history, WithDerived, EntitySignal.map, DevToolsConfig.treeName,
      .with()
      owner: SignalTree (docs)

P3  — pnpm catalogs cannot reference a local tarball
      (ERR_PNPM_CATALOG_ENTRY_INVALID_SPEC), so pre-release validation must
      rewrite app manifests instead. Not a SignalTree defect; friction in this
      loop only.
      owner: process
```

## Reproducing

```bash
git worktree add -b wip/signaltree-15-rc1-eval <path> # in the consumer repo
# point every @signaltree specifier at the tarballs (catalog: does not accept file:)
pnpm install --no-frozen-lockfile
npm run typecheck
```

## Superseded by the capability audit

This page stays as the pass-1 record. The decision work moved to
[`v15-production-surface-audit.md`](v15-production-surface-audit.md), because
the symbol-level framing here — "restore the export or delete the
implementation" — is the wrong unit. Six `loader` imports are evidence about
remote acquisition; they are not a vote to re-export `loader()`. The audit
starts from the business job and evaluates every API placement, with the
historical spelling ranked as the weakest evidence available.
