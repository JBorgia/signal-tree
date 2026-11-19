# Reproduction and validation commands

All executions used cwd `/private/tmp/st-selected-projection-repair` unless stated.
Node was selected with:

```sh
export PATH=/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:$PATH
export NX_DAEMON=false NX_ISOLATE_PLUGINS=false
```

pnpm was invoked through `corepack pnpm` against `packageManager: pnpm@10.17.0`.
Dependencies were cloned with `cp -cR /private/tmp/slice5-production-control/node_modules ./node_modules`; no shared node_modules symlink or install was used. Copied top-level launcher NODE_PATH strings were subsequently rewritten to the isolated path.

| Command | Logs / result |
| --- | --- |
| `corepack pnpm nx test angular --skip-nx-cache -- src/lib/selected-active-id-preparation.spec.ts -t 'public callback discriminator'` | `angular-first.log`: 1; `angular-patch-1.log`: 0 |
| Same command with `vue` | `vue-first.log`: 1; `vue-patch-1.log`: 0 |
| Exact original public commands above, plus `--maxWorkers=2`, with original test bytes temporarily installed | `{angular,vue}-exact-final.log`: 0 each |
| `corepack pnpm nx test angular --skip-nx-cache -- src/lib/selected-callback-facade.spec.ts` | `angular-held-first.log`: 1 on single-cached-realization intermediate |
| Same command with `vue` | `vue-held-first.log`: 1 on intermediate |
| `corepack pnpm nx run-many -t test --projects=kernel,angular,vue,solid,react --parallel=1 --skip-nx-cache -- selected-callback-facade` | `facades-focused.log`: 0, initial five facade cases |
| `corepack pnpm nx run-many -t test --projects=kernel,angular,vue,solid,react --parallel=1 --skip-nx-cache` | `all-package-tests.log`: 0 before added metadata controls |
| `corepack pnpm run typecheck` | `typecheck.log`: 0 |
| `node tools/check-spec-types.mjs` | `spec-types.log`, `spec-types-final.log`, `spec-types-metadata.log`: 0 |
| Focused run-many command above plus `--maxWorkers=2` | `facades-final.log`: 0; `facades-newwrites.log`: 0; `facades-timing.log`: 0; final `final-acceptance.log`: **1, 18 passed / 2 metadata failures** |
| `corepack pnpm nx test angular --skip-nx-cache -- selected-callback-facade -t 'retains coherent native metadata' --maxWorkers=2` | `angular-metadata-first.log`: 1 |
| Same command with `vue` | `vue-metadata-first.log`: 1 |
| `corepack pnpm nx run-many -t build --projects=kernel,angular,vue,solid,react --parallel=1 --skip-nx-cache` | `build-packages.log`: interrupted idle process after emission; not green |
| `corepack pnpm nx build kernel --skip-nx-cache --outputStyle=stream` | `build-kernel-retry.log`: interrupted, 143; also set `NX_NATIVE_COMMAND_RUNNER=false NX_TUI=false` |
| `corepack pnpm run build:demo:prod -- --skip-nx-cache --outputStyle=stream` | `build-demo.log`: 1, invocation error preserved |
| `corepack pnpm nx build demo --configuration=production --base-href=/ --skip-nx-cache --outputStyle=stream` | `build-demo-corrected.log`: 1, no explanatory build diagnostic |
| `node scripts/lint-readme-apis.mjs` | `readme-apis.log`: 1, framework outputs missing |
| `python3 repair-evidence/source-manifest.py` | Recomputes archive identity and all archived-file comparisons |
| `python3 repair-evidence/package-result.py` | Creates exact source/test patches, hashes, exit-status inventory |
| `git apply --check /private/tmp/st-selected-projection-repair/repair-evidence/REJECTED-candidate.patch` (cwd `repair-evidence/base`) | 0; no application performed |

The intermediate `facades-final.log` name is historical, not acceptance. Its attempted conditional-C text replacement had not applied. `facades-timing.log` and the final acceptance run execute the actually strengthened conditional-C and inside-callback native computed reads. The original exact tests remain unchanged in `exact/`.
