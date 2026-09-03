<div align="center">
  <img src="public/signaltree-mark-192.png" alt="SignalTree ST leaf mark" width="96" height="96" />
  <h1>SignalTree demo</h1>
  <p>Executable v15 reference for causal application state.</p>
</div>

## Purpose

This Angular application demonstrates the current `@signal-tree/*` packages.
Its copy is explanatory, not an API authority: package types, package READMEs,
and focused tests decide whether a capability or example is current.

## Current surface

| Area           | Route                                                                  | What it establishes                                                                                        |
| -------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Start          | `/`                                                                    | Evaluation path and package choice                                                                         |
| Architecture   | `/architecture-overview`                                               | Verified ownership, authority, restoration, identity, Link, and projection boundaries                      |
| Fundamentals   | `/examples/fundamentals`                                               | Construction, callable reads, leaf writes, derived state, and transactions                                 |
| Package guides | `/docs?package=angular`, `/docs?package=kernel`, `/docs?package=react` | Framework facade and source documentation                                                                  |
| Batching       | `/batching`                                                            | Grouped publication                                                                                        |
| EntityMap      | `/entities`                                                            | Keyed identity, stable ordinary-update handles, queries, and mutation boundaries                           |
| Restoration    | `/restoration`                                                         | Explicitly designated authored turns                                                                       |
| External truth | `/external-truth`                                                      | External ingress, Link relationships, and application-owned orchestration                                  |
| DevTools       | `/devtools`                                                            | State inspection integration                                                                               |
| Deep typing    | `/deep-typing`                                                         | Compile-backed exact leaf typing through one declared 15-branch path                                       |
| Migration      | `/migrate`                                                             | Concept-first migration toward v15 ownership                                                               |
| Benchmarks     | `/benchmarks`                                                          | Capability-matched recurring work; construction, density, GC, and churn remain authoritative Node concerns |

Pre-v15 release notes and retired benchmark submissions are kept under the
navigation's Archive section and are not current API guidance.

## Commands

Run from the repository root:

```bash
pnpm nx serve demo --port 4200
pnpm nx test demo
pnpm nx build demo --configuration=production
pnpm smoke:routes
pnpm audit:mobile
pnpm audit:visual
pnpm architecture:assets:check
```

The canonical browser route inventory is
[`../../scripts/playwright/demo-routes.ts`](../../scripts/playwright/demo-routes.ts).
Architecture SVGs are generated from the audited diagram specifications; do not
edit files in `public/architecture/` by hand.
