# Narrow lint correction against selected cae

Prepared for Main review only; not applied to `/private/tmp/st-v16-integration-candidate`. No tests, lint rerun, typecheck, build, optimization or Nx graph generation ran. Running qualification and the original lint failure were left untouched.

Base: composition manifest SHA-256 `cae244793913aa51ffe36848a8ba3f6e77af24185323a6141ba6c66a03a5876f`. All 15 pre-existing affected files matched that manifest before preparation and were copied to `before/`. This is a source snapshot identity, not a newly inferred Git commit.

## Patch scope

- Relocate the helper byte-for-byte from `tools/testing/optional-diagnostic.ts` to `packages/kernel/test/optional-diagnostic.ts`.
- Adjust exactly 14 imports: the 13 direct `src/lib` specs use `../../test/optional-diagnostic`; `src/lib/internals/causal-runtime/rich-source-completion-boundary.spec.ts` uses `../../../../test/optional-diagnostic`.
- Add explanatory comments to exactly six existing empty callback bodies, with no executable statement changes:
  - `independent-dynamic-enrollment`: membership completion is deliberately inert for the refusal probe.
  - `independent-prepared-boundary`: packet capture occurs during preparation, so completion has no work.
  - `recipient-window-review`: declaration connection deliberately does not record deliveries.
  - `rich-capture-getter-boundary`: opaque callable row data is deliberately inert.
  - `rich-capture-participant-boundary` and `rich-source-preparation-boundary`: fixtures observe preparation only.

No assertion, case, control, eager expression, serialization, runtime source, configuration, budget or optional-sink site changed. The helper spec body is unchanged. The patch contains 14 modified files plus a new-path addition and old-path deletion; `overlay/` has the 15 resulting files. Applying only an overlay copy would leave the obsolete helper behind: apply `lint-correction.patch`, or also honor `DELETIONS.txt`.

## Build/package exclusion verified from current configuration

- `packages/kernel/project.json` owns the `packages/kernel` project; the proposed test helper and every importing spec are inside that root. `sourceRoot: packages/kernel/src` does not define the Nx project boundary. No nested project is introduced.
- `packages/kernel/tsconfig.lib.prod.json` extends `tsconfig.lib.json`. The inherited include is exactly `src/**/*.ts`; spec/test files are excluded. Overlay-aware TypeScript configuration file enumeration in `check.cjs` confirms the helper and all specs are absent. This uses configuration parsing only, with no TypeScript Program, diagnostics campaign or emit. All enumerated production source files were checked for `optional-diagnostic` references: none.
- `packages/kernel/rollup.config.cjs` selects `src/index.ts`, `src/adapter.ts`, and `src/internals.ts`, using `tsconfig.lib.prod.json`. Its asset globs are README.md, LICENSE, NOTICE and package.json, not `test/**`.
- `packages/kernel/rollup.custom.mjs` uses that production tsconfig for runtime transpilation and names the same three `src` declaration entries. `tools/build/create-rollup-config.mjs` preserves those selected entries/modules and copies llms.txt during layout finalization; it does not scan/copy the test directory. Its output-path fallback is not an inclusion glob.
- `packages/kernel/package.json` publishes `dist/**/*.js`, `dist/**/*.d.ts`, README.md, LICENSE, NOTICE and llms.txt. The proposed source helper matches none. Public exports remain only the package root, package.json, adapter and internals.
- The secondary `packages/kernel/ng-package.json` also points at `src/index.ts` and copies only README.md.
- **Important distinction:** Nx `namedInputs.production` inherits `default`, whose `{projectRoot}/**/*` pattern does include `test/optional-diagnostic.ts` as a build-cache hash input. It is not excluded from all globs. That does not make it a compilation entry or package asset. No cache/config change is needed or included.

These checks establish source/config exclusion and lack of production references, not a newly built/packed artifact result. Main can qualify actual artifacts later within the existing workflow. The moved helper remains reachable by specs through normal imports even though the spec tsconfig's initial roots only name specs.

## Evidence and verification

`preserved-lint/` contains byte-identical copies of the classification, first.log, COMMAND.json, RESULT.json and EXIT from the first affected-lint failure. Original evidence remains at `/private/tmp/st-v16-test-doc-composition/runs/affected-lint/`. No failure was overwritten or relabeled passed: the preserved classification is 14 new module-boundary errors, six pre-existing empty-function errors and five ignored-file warnings. Warnings are untouched.

Executed cheap checks only:

- `python3 /private/tmp/st-test-sink-lint-correction/prepare.py`: verified cae identity and affected-file hashes; created before/overlay/patch and preserved lint receipts.
- `/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node /private/tmp/st-test-sink-lint-correction/check.cjs`: all 15 resulting TypeScript files parse; all 14 spec ASTs match before after normalizing only helper import paths and stripping comments; exact relative paths resolve; helper bytes match; production config enumeration excludes helper/specs.
- `git -C /private/tmp/st-test-sink-lint-correction/before apply --check /private/tmp/st-test-sink-lint-correction/lint-correction.patch`: passed without applying the patch.
- Final targeted source and lint-receipt hashes still match their preserved copies. Build-configuration evidence hashes are in HASHES.json.

Actual lint acceptance is pending Main review and a later rerun. No claim that the first lint failure has become a passing run.

## Deliverables

`lint-correction.patch`, `overlay/`, `before/`, `DELETIONS.txt`, `HASHES.json`, `CHECKS.txt`, `preserved-lint/`, and reproducible `prepare.py`/`check.cjs` are all contained in `/private/tmp/st-test-sink-lint-correction`.
