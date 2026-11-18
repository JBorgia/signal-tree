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
| First feature  | `/docs?package=first-feature-v15`                                      | Executable order-edit recipe, owner lifetime, external updates and optional undo                           |
| Architecture   | `/architecture-overview`                                               | Verified ownership, authority, restoration, identity, Link, and projection boundaries                      |
| Fundamentals   | `/examples/fundamentals`                                               | Construction, callable reads, leaf writes, derived state, and transactions                                 |
| Package guides | `/docs?package=angular`, `/docs?package=kernel`, `/docs?package=react` | Framework facade and source documentation                                                                  |
| Batching       | `/batching`                                                            | Grouped publication                                                                                        |
| EntityMap      | `/entities`                                                            | Keyed identity, stable ordinary-update handles, queries, and mutation boundaries                           |
| Restoration    | `/restoration`                                                         | Explicitly designated authored turns                                                                       |
| External truth | `/external-truth`                                                      | External ingress, Link relationships, and application-owned orchestration                                  |
| DevTools       | `/devtools`                                                            | State inspection integration                                                                               |
| Deep typing    | `/deep-typing`                                                         | User-selected runtime depth backed by generated exact-leaf compiler proofs for depths 1–40                 |
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

The home story exposes user, developer and business perspectives on the same
real state changes. Its short timeline explains only the current local demo;
it is not a durable audit log. Saved-time and business outcomes are hypotheses
for the consumer's workflow, not benchmark results.

## Source identity in previews

The existing version generator also writes the ignored
`src/app/source-ref.generated.ts`. It uses `VERCEL_GIT_COMMIT_SHA` for a hosted
archive or the local Git HEAD; if both exist they must match. Demo build, test, serve, static-serve and extraction targets generate it,
and the build cache includes that identity. Documentation
links use the actual commit rather than inventing a tag for an unpublished
candidate. Run `node --test tools/demo-source-ref.test.cjs` from the repository
to check accepted identities and rejection controls.

A local dirty preview still points at its base commit. Commit the intended
source, rebuild and push that commit before treating its hosted links as exact
source evidence. Library package code and public types do not depend on this
demo-only metadata.

## Demonstration ownership and review

The architecture tutorial's tree, facade and operations belong to its component.
It is the only application consumer of that example store. Keeping its provider
in `app.config.ts` pulled tutorial dependencies into the initial site graph and
kept its data beyond the page lifetime. The lazy owner now destroys its tree;
its request subscriptions end with the owner too. Markers and DevTools also
destroy their trees, and an interrupted DevTools replay releases its delay.
Those are application examples, not changes to a package's public contract.

The frameworks page explains the current facades and opens their guides.
Historical retained-memory figures remain in their source/audit history; they
are not presented as current application costs. V15 installation examples use
the published major line rather than assuming a candidate label is published.

`route-content-audit.spec.ts` checks that the browser inventory covers every
component route, records headings/actions/links, and validates local targets.
The mobile and layout suites check the same inventory; interaction suites
exercise actual work and teardown. External destinations and the assembled
v14 archive still require deployment checks. These checks do not establish
human comprehension or AI adoption success.
