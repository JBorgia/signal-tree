# Installed artifact gate: kernel and Angular

Executed against exact active source `5727cd8fcf701128358674411400c019b137a5e4`.
This directory owns only experiment harnesses, consumers and evidence. Neither the
active source worktree nor root production source was edited.

## Results

See [machine-readable results](evidence/5727cd8f/RESULTS.json),
[kernel commands and hashes](evidence/5727cd8f/manifest.json), and
[Angular commands and hashes](evidence/5727cd8f/angular-manifest.json).

| Gate | Result |
| --- | --- |
| Fresh isolated `pnpm nx build kernel --skip-nx-cache` | Pass; 11 TS4111 build warnings retained |
| `npm pack`, offline install of kernel and local tslib tarballs | Pass; installed file bytes checked against build output |
| Strict actual package types, bundler resolution | Pass |
| Strict actual package types, node16 resolution | Pass |
| Typed coordinator/backend plus actual native transaction workflow | Pass |
| Installed direct Node execution | Six public probes, three workflows, two settlement cases pass |
| Default esbuild bundle of installed packages | Same six + three + two cases pass |
| Fresh isolated `pnpm nx build angular --skip-nx-cache` | Pass, including its kernel dependency |
| Packed Angular facade and kernel, installed offline with Angular 22.0.7 peers | Pass |
| Real standalone component, `ngc`, full AOT, strict templates and types | Pass |
| AOT component class with native Angular signals/computed | Two cases pass |

The six probes include positive assertions of limitations: inspection does not
bind input revisions, net-zero input ABA is absent from coalesced observation,
and `Link.settled()` can resolve after send failure. Passing those probes does
not turn the stronger desired contracts into supported capabilities.

The Angular reference's template compiles to a full component definition. Runtime
checks instantiate that compiled class, use facade `.set`, computed reads,
transaction confirmation/rollback and external ingress, and destroy its tree.
They do **not** bootstrap or render a DOM. No compiler import as a JIT workaround,
`skipLibCheck`, source aliases, ignored annotations or package declaration edits
were used. Installing the Angular compiler peer is not a runtime JIT import.

## Reproduce

Use Node 24.15.0 and pnpm 10.17.0. From this repository root:

```sh
node tools/experiments/multi-actor-operations/installed/run.mjs /Users/jonathanborgia/.codex/worktrees/v16-incumbent-readiness/signaltree
node tools/experiments/multi-actor-operations/installed/angular.mjs /private/tmp/st-installed-review-REPLACE_WITH_PRINTED_DIRECTORY
```

The first runner verifies active HEAD, extracts `git archive` into a fresh private
temporary directory, and runs the checked-in canonical Nx target there. Root
build dependencies are reused through a symlink because active dependencies are
broken; recorded versions are Node 24.15.0, pnpm 10.17.0, Nx 23.1.0, Rollup 4.62.2,
TypeScript 6.0.3, esbuild 0.25.12 and tslib 2.8.1. This is not a fresh lockfile
installation or dependency-reproducibility claim.

Consumer runtime dependencies are installed from packed files. Consumers have
no path to root's kernel or the active source. Runtime fixtures are transformed
from TS without bundling first, so Node resolves the real package exports. The
second arm bundles the same installed files with ordinary esbuild defaults.
Metafiles retain the resolved inputs. Angular compilation uses the root compiler
CLI tool (22.0.7) and resolves the consumer's installed facade/core declarations.
The canonical build resolves Angular's `workspace:*` kernel dependency; the
harness does not rewrite package manifests or declarations.

Strict consumers use `strict: true`, `skipLibCheck: false`, no `paths`, no ambient
package overrides and no `any`. Negative assertions cover wrong native value
types, nonexistent inspection revisions, nonexistent conditional-confirm options,
wrong lifecycle identity fields, invalid fixture field/actor types, mutation of
frozen reviews, and invented receipt/handle members. `coordinator.d.mts` and
`dispatch-fixture.d.mts` describe only the local experiment modules; they are not
published library types. Original runtime fixture files are copied unchanged and
hashed alongside the consumers.

## Pinned evidence

Final work directory: `/private/tmp/st-installed-review-6wmzqU`.
All 3,441 tracked files in its isolated source were compared with Git blob IDs
from the pinned commit: zero differences. See
[source verification](evidence/5727cd8f/source-verification.json).

| Item | SHA-256 |
| --- | --- |
| Source archive | `403d4bd222d08c74e3e4dffad5df8efb32e45ac24a91ad24a5b7635787fdc287` |
| Kernel tarball | `64cfcda4aa980a4e27322693edf28d22c9aae54905d2e1d1b0c821ad455ac019` |
| Angular tarball | `da6bf34cd1769f323ef26c43acd0cf388028e348a34a8fbbc8e976b01a800993` |

The two library tarballs are archived under `evidence/5727cd8f/artifacts/`.
Per-file build/installed hashes, dependency tarball hashes, package locks,
consumer input snapshots, AOT output and raw logs are retained. Manifest paths
refer to the preserved temporary run; their contents are copied here without
rewriting historical paths. Raw workflow stdout retains its inherited
`public-source-bundle` label; runner commands, resolved inputs and RESULTS.json
establish that this run actually used installed tarballs.

The initial pnpm `--dir` invocation failure is retained under
[first-failures](first-failures/README.md). Changing the process cwd fixed that
invocation; no source fix followed. Successful build logs retain 11 TS4111
warnings from existing `semantics-authority.ts` and `semantics-composition.ts`.
Build success is not a clean source-typecheck claim.

## Gate boundary

This closes the bounded installed kernel operation/settlement seam and minimal
Angular AOT/class-consumer checks. It does not qualify conditional Link fixes,
all facades or Angular peer versions, DOM interaction, protocol integration,
backend durability, full release gates, populated costs or lifecycle retention.
The canonical all-five-package consumer verifier was not run: this task builds
only kernel and Angular. B closure, recurrence stops, public API ownership and
private Studio remain unchanged. No publication, tag, push or merge occurred.

## Qualifying an explicitly selected candidate

The historical positional invocation above remains pinned. To test a separately
built candidate without repeating its package builds, supply all four explicit
inputs:

```sh
node tools/experiments/multi-actor-operations/installed/run.mjs \
  --candidate /absolute/candidate \
  --manifest /absolute/evidence/MANIFEST.json \
  --manifest-sha256 SELECTED_MANIFEST_SHA256 \
  --sealed-build /absolute/evidence/BUILD-SEAL.json
```

Run `angular.mjs` with the printed evidence directory first, followed by those same
four flags. This mode validates source and sealed package bytes, packs the existing
artifacts and installs isolated consumers. It never changes source aliases or
silently falls back to the historical checkout. The source identity is recorded as
an explicit manifest; it is not mislabeled as the historical Git commit.

The supplied build receipt must be bound to a successful canonical five-package
build and source-preservation evidence by the qualification controller. Matching
hashes alone cannot prove that arbitrary artifacts were produced from that source.
Partial flags, changed source or changed sealed artifacts fail. Source and build
receipt inputs must remain immutable throughout the run. Existing runtime assertions,
strict consumer checks, installed-byte comparisons and Angular AOT remain unchanged.

This reuses a verified build, not a cached passing test. Fresh consumer execution
is still required. Historical limitation probes may expose changed behavior; preserve
and adjudicate those results rather than weakening assertions automatically.
