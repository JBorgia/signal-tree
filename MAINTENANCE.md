# SignalTree v14 maintenance line — `release/14.x`

This branch is the maintenance base for the `@signaltree/*` (no hyphen) v14
line. It is **not** the development line. Active work happens on `main` under
`@signal-tree/*` v15.

See [`docs/support-policy.md`](https://github.com/JBorgia/signal-tree/blob/main/docs/support-policy.md)
on `main` for what this line receives and for how EOL will be announced.

## What this line receives

Bug fixes and security fixes only, published as `14.1.x` patches. No new
features, no new APIs, no backports of v15 architecture. Do not `npm deprecate`
these packages — the line is supported.

Published at `14.1.3`: `core`, `ng-forms`, `events`, `schema`, `realtime`,
`guardrails`. There is no `@signaltree/angular` package; v14 Angular support
lives inside `@signaltree/core`.

## Validated maintenance base

Full validation performed on the tree at the commit below. Everything green.

```text
commit    c1c82cbc34ec1cb4f5dcfd68bac31eed83403cb4
branch    release/14.x
workspace 14.1.3
node      v24.3.0
pnpm      10.17.0
validated 2026-09-08T04:42:07Z
```

| Check | Command | Result |
| ----- | ------- | ------ |
| Install reproducibility | `pnpm install --frozen-lockfile` | PASS — no lockfile drift |
| Package builds (7) | `nx run-many -t build --projects=core,ng-forms,shared,guardrails,events,realtime,schema` | PASS |
| Package test targets (7) | `nx run-many -t test --projects=core,ng-forms,shared,guardrails,schema,events,realtime --parallel=1` | PASS |
| Core runtime suite | `npx vitest run --root packages/core` | PASS — 100 files, 1111 passed, 15 skipped |
| Lint (7) | `nx run-many -t lint --projects=…` | PASS — 0 errors, 127 warnings |
| Typecheck | `npm run typecheck` | PASS |
| Historical regression compare | — | **NOT ESTABLISHED** |

### Two things a future patcher must know

**`nx test core` swallows the vitest reporter.** A passing `nx` run prints no
test counts for most projects, so the run above looks like it tested almost
nothing. It didn't — exit code is authoritative for pass/fail, and core was
re-run directly through vitest to get real numbers. Use
`npx vitest run --root packages/core` when you need counts or a failing test
name.

**Core's spec inventory reconciles exactly**, so nothing is silently skipped:

```text
107  *.spec.ts under packages/core/src
-  5  *.typing.spec.ts        tsc-only, excluded from vitest by design
-  2  config exclusions       enhancers/typing/all-chains.spec.ts
                              enhancers/typing/all-subsets.generated.spec.ts
= 100  files run by vitest
```

### What this validation is not

It establishes **current health**, not behavioural equivalence to `14.1.1`.
`14.1.2` and `14.1.3` were intentional releases, so differences from `14.1.1`
are expected rather than suspicious. Do not treat a diff against `14.1.1` as a
regression signal.

For a future patch, the meaningful before/after baseline is **this validated
tip**, not `14.1.1`.

## Patching this line

```text
release/14.x  (validated base)
      ↓
actual defect or security fix
      ↓
re-run the full table above
      ↓
14.1.4
```

1. Branch from `release/14.x`, make the narrowly scoped fix.
2. Re-run every check in the validation table and record the new SHA here.
3. Cut the patch, then `npm dist-tag add @signaltree/<pkg>@<version> v14` for
   each published package so the `v14` tag tracks the newest 14.x.
4. Add the maintenance banner to any package README that lacks one.

Do not cut a patch merely to ship documentation. As of this writing there is no
pending v14 defect; the branch exists so that one has somewhere to land.

## Worktree

A checkout with dependencies already installed may exist at
`../signaltree-14x` (`git worktree list`). Reuse it to skip the install;
`git worktree remove` it when you are done.
