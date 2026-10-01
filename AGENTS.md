# SignalTree agent guidance

This is the default repository contract. Load task-specific references below
only when relevant. Use the current checkout's manifests and configuration;
other worktrees may implement a different release line.

## Scope and authority

- Inspect HEAD, branch and dirty files before editing. Preserve unrelated work.
- Current compatibility is defined by [support policy](docs/support-policy.md).
  Do not apply the historical greenfield reset as a license to break stable v15.
- Preserve kernel/framework ownership and the public-library/private-Studio
  boundary in [contributor contracts](docs/contributor-contracts.md). Read those
  contracts before changes to architecture, adapters or package ownership.
- Frozen semantics require a concrete counterexample before reopening. Product,
  public API/export, versioning and compatibility changes need owner authority;
  an approval already given in the task remains valid.
- User-facing documentation teaches behavior before internal machinery. Use
  “entity lifetime” in consumer material; see [the glossary](docs/glossary.md).

## Work and verification

- For deliberate or load-bearing code, inspect relevant history and tests before
  changing it. Use the commit/PR/issue evidence that exists; do not invent any.
- Make authorized progress without asking to continue after routine steps.
  Choose the cheapest meaningful falsifier, validate the changed contract, and
  inspect the diff. Do not weaken a test or a budget just to obtain green.
- Preserve first failures and distinguish run results from source inspection.
  A test must assert useful behavior, not pass vacuously when nothing happens.
- Numbers need the generating command, workload, artifact identity and limits.
  A generator citation alone does not establish freshness or correctness.
  Do not publish figures copied from ignored `artifacts/` or old instructions.
- Independent reviews are claims to verify. Delegate when independent reasoning
  or parallel work adds value, using available tools; no fixed model, file-count
  trigger or mandatory reviewer headcount. Architecture review follows
  [the scoped protocol](.github/skills/adversarial-confirmation/references/protocol.md).
- A failing test is not a reason to stop when the correction is unambiguous and
  authorized. Escalate actual semantic/product/compatibility conflicts with the
  concrete finding, viable options and a recommendation; continue independent work.
- Local conceptual commits are permitted after relevant checks and staged-diff
  review. Exclude unrelated changes. Push, tag, publish, merge and shared-history
  rewrites require explicit authorization; verification alone grants none.

## Commands and task routing

Use the Node version in `.nvmrc` and pnpm pinned in `package.json`.
Runtime source is strict TypeScript; preserve public types rather than weakening
them to accommodate an implementation shortcut.

| Task | Start here |
| --- | --- |
| Package tests | `pnpm nx test kernel` (or the affected framework project); run through Nx rather than root bare Vitest |
| Build | `pnpm run build:all` or `pnpm nx build kernel` |
| Types | `pnpm run typecheck`; ordinary spec types also have a separate `spec-types` gate |
| Gate scope | `node tools/verify-gates.mjs --list`; focused checks are not release sign-off |
| Release | [Current controller](RELEASE-CURRENT.md), then [validation](.github/VALIDATION_GUIDE.md) and [release process](RELEASE_PROCESS.md) |
| Build/package changes | [Build contract](.github/instructions/build-pipeline.instructions.md) and [declarations](.github/instructions/type-declarations-fix.md) |
| Framework work | [Contributor contracts](docs/contributor-contracts.md) and [CONTRIBUTING](CONTRIBUTING.md) |
| File placement | [Repository map](docs/repository-map.md) |
| Consumer code | Installed package types, package README, then [llms.txt](llms.txt) for checked examples |
| Measurement | [Measurement guidance](docs/performance/measurement-contract.md) and the relevant generator |

Bundle ceilings are defined only by `tools/check-bundle-budget.mjs`; measure a
fresh build. Default instructions do not carry changing size/timing tables.
Changes affecting size/performance or release-visible docs also require the
current production demo build and relevant documentation gates before sign-off.

## Application use and lifetime

Use the application's framework facade: `@signal-tree/angular`, `/react`, `/vue`
or `/solid`; use `@signal-tree/kernel` for intentionally neutral code. These are
complete facades over one kernel authority. Do not mix import roots casually.
Angular/Solid leaves write with `.set`, Vue with `.value`, React/kernel with a
call. Read exact types for the installed version.

Destroy trees owned by tests, requests, routes, components and editor sessions
at teardown. Follow this checkout's package READMEs and lifetime contract; do not
infer runtime root-slice mounting from dynamic EntityMap membership.

## Records

Decided work belongs in `TODO.md` or the current task/controller. Internal work
is not a new pending RFC: `docs/rfcs/` preserves past decisions and rejected
options. Record why a non-obvious choice was made where it belongs.
`RELEASE-1.0.md` and the architecture context record preserve history; their old
“next” lists and model choreography do not override the current controller.
