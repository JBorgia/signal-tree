# SignalTree Scripts

This directory contains release operations, validation wrappers, benchmark
entry points, deployment helpers, and older one-off tooling.

A filename is not authority. A script affects release confidence only when it
is invoked by `package.json`, a workflow, a direct publish path, or
`tools/verify-gates.mjs`.

## Start Here

Run workspace operations through the root package scripts:

```bash
pnpm start
pnpm run build:all
pnpm run test:all
pnpm run lint:all
pnpm run typecheck
```

The current package projects are:

- `kernel`
- `angular`
- `react`
- `demo` and `react-reference` (consumer applications)

Historical names such as `core`, `guardrails`, `enterprise`, `events`,
`ng-forms`, and `schema` are not current package projects. Some npm script names
retain `core` as a compatibility label, but their command targets `kernel`; for
example, `pnpm run build:core` executes `nx build kernel`.

## Validation

The comprehensive pre-publish entry point is:

```bash
pnpm run validate
```

This runs [pre-publish-validation.sh](pre-publish-validation.sh), which owns the
ordered pre-publish checks. `FAST_VALIDATE=1 pnpm run validate` skips only the
slow test, coverage, and performance stages; correctness and artifact checks
remain enabled and the skipped stages are printed.

Useful focused commands:

```bash
pnpm run quality:check
pnpm run typecheck
pnpm run validate:dist
pnpm run validate:exports
pnpm run validate:docs
pnpm run validate:version-claims
pnpm run validate:release-state
pnpm run validate:rc-surface
pnpm run validate:tarball-consumer
pnpm run validate:types
pnpm run validate:tree-shaking
pnpm run size:check
pnpm run lint:readmes
```

## Gate Harness

[`../tools/verify-gates.mjs`](../tools/verify-gates.mjs) is the gate registry.
It runs gates and, in self-test mode, mutates the exact property each gate claims
to protect and requires the gate to fail.

```bash
pnpm run gates
pnpm run gates:fast
pnpm run gates:self-test
pnpm run gates:list
node tools/verify-gates.mjs --release
node tools/verify-gates.mjs --only=<gate-name>
```

The harness reports unproven gates. A green unregistered script or a gate
without a killing mutation is evidence, not release authority.

## Release And Publish

Use only the root release scripts for versioned releases:

```bash
pnpm run release
pnpm run release:patch
pnpm run release:minor
pnpm run release:major
```

All route through [release.sh](release.sh). It validates, updates versions,
builds, tags, and publishes the manifest-defined package set. Failures before
npm publishing begins roll back local release changes. Once publishing starts,
the script preserves the release state because one or more immutable npm
versions may already exist; reconcile the published set and resume with
`--keep-version`.

Direct package publishing routes through:

```bash
pnpm run publish:all
pnpm run publish:dry-run
pnpm run publish:ci
```

The direct authorities are:

- [release.sh](release.sh)
- [publish-all.sh](publish-all.sh)
- [ci-publish.sh](ci-publish.sh)
- [pre-publish-validation.sh](pre-publish-validation.sh)
- [release-packages.sh](release-packages.sh), the shared package-order source

Do not run `nx release`, `npm version`, or package-local `npm publish` as a
substitute. Do not manually unpublish a partial release as routine recovery;
stop after publishing begins, inspect which versions exist, and follow the
repository release process.

Release prerequisites and post-publish verification are in
[`../RELEASE_PROCESS.md`](../RELEASE_PROCESS.md).

## Artifact Preparation And Verification

These scripts are on or adjacent to the publish path:

| Script                                                 | Responsibility                                                      |
| ------------------------------------------------------ | ------------------------------------------------------------------- |
| `prepare-publish-artifacts.mjs`                        | Prepare publishable manifests and artifacts                         |
| `resolve-workspace-specs.mjs`                          | Replace workspace dependency protocols and prove none remain        |
| `verify-publish-artifacts.mjs`                         | Resolve every manifest file/export entry before publish             |
| `verify-package-hygiene.js`                            | Reject source leaks, stale declarations, and invalid nested exports |
| `verify-dist.sh`                                       | Validate built distribution layout                                  |
| `verify-exports.js`                                    | Validate package export integrity                                   |
| `verify-no-broken-dts.sh`                              | Validate declaration placement and references                       |
| `verify-jsdoc-stripping.js`                            | Validate runtime JSDoc stripping behavior                           |
| `verify-production-bundle-no-perf-instrumentation.mjs` | Reject instrumentation in production bundles                        |
| `verify-tree-shaking.js` / `test-tree-shaking.js`      | Exercise consumer tree-shaking                                      |

The final package layout comes from the Nx Rollup builds. Manual post-build
source copying is not a supported packaging strategy.

## Documentation And Version Checks

```bash
node scripts/lint-readme-apis.mjs
node scripts/lint-readme-apis.mjs --self-test
bash scripts/validate-docs.sh
node scripts/verify-version-claims.js
bash scripts/verify-changelog-entry.sh
```

`lint-readme-apis.mjs` discovers built package exports from manifests and checks
current documentation imports plus retired API teaching. Historical examples
must use its explicit local or near-title evidence markers; directory placement
alone does not exempt current guidance.

## Measurement Tools

Published numeric claims must name the generator that produces them. The
canonical measurement programs live under `tools/`, including:

```bash
node tools/check-bundle-budget.mjs
node tools/size-report.mjs
node tools/bench-compare.mjs
node tools/bench-vs-signalstore.mjs
node tools/bench-depth-latency.mjs
node tools/bench-leaf-equality.mjs
node tools/bench-ssr-payload.mjs
```

The root conveniences are:

```bash
pnpm run perf:run
pnpm run analyze:bundle
pnpm run size:check
pnpm run check:devmode-foldable
```

`artifacts/` is local scratch output. Never copy published metrics from an
artifact file; rerun the named generator.

## Demo And Browser Automation

```bash
pnpm start
pnpm run build:demo
pnpm run smoke:routes
pnpm run automation:export
```

Browser automation and benchmark-export helpers live under `scripts/playwright/`.
Use their registered package scripts so configuration and output paths remain
consistent.

## Operational Helpers

- `ci-checks.js`: consolidated JSDoc and size checks used by build/publish hooks.
- `sanity-checks.js`: fast workspace consistency smoke checks.
- `finalize-changelog.mjs`: release changelog finalization.
- `deprecate-packages.sh`: explicit package deprecation workflow; use its
  `--dry-run` route first.
- `deploy-benchmark-site.sh`: benchmark-site deployment helper.
- `run-devtools-smoke.mjs`: DevTools smoke runner.
- `verify-clean-checkout-release-flow.sh`: clean-checkout release rehearsal.

## Legacy And One-Off Scripts

Some files under `scripts/`, `scripts/performance/`, and `scripts/benchmarks/`
are historical experiments or wrappers retained for evidence. Before using one:

1. Find a current caller in `package.json`, workflows, release scripts, or the
   gate registry.
2. Verify every referenced package, path, and output exists.
3. Prefer a named `tools/bench-*`, `tools/measure-*`, `tools/check-*`, or
   `tools/verify-*` program when it owns the current methodology.
4. Treat an unregistered script's output as exploratory until a current document
   and executable gate adopt it.

Do not infer current behavior from comments that still use historical package
names. Package manifests and executable release paths decide what ships.
