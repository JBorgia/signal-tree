# Independent retained-source controls

Only this sidecar directory was written. No runtime edits, frozen-source edits, Main edits, or broad tests. `IDENTITY.json` records verification of all 2941 manifest files in each isolated copy after runtime tests, with zero mismatches. The extra spec is identical in both copies.

Sources: d3b cleanup predecessor (`candidate/`, manifest `BASE-SOURCE-SHA256.json`) and Main retained-source successor (`main-copy/`, manifest `MAIN-SOURCE-SHA256.json`). Full hashes are in `IDENTITY.json`. These results apply to these exact snapshots, not later Main changes.

## Results and limits

Final focused Nx: predecessor 2 failed / 4 passed; Main 6 passed. Earliest predecessor failure is hidden ancestor rollback: `Missing live leaf for owner 5 [effect-validation-failed]`. The hidden two-row refusal test also fails because no interceptor preparations are reached (0 vs required 2). Main reaches both preparations, refuses the second without installing either inverse, then succeeds on retry after detachment. Physical rows restore from 7/9 to 0/3 while public reads remain absent.

Other controls: an untouched second row survives ancestor compensation; public addOne reveal contains only the newly supplied row (no hidden-row resurrection); removed/readded same-key lifetimes remain unchanged under both omission shapes; destroyed handles cannot affect an independent same-key tree. Same-key controls deliberately accept either settlement or refusal and prove only lifetime isolation, not successful routing or a prescribed refusal kind.

Collection-only omission at the nested whole-value writer remains a later confirmed dependency on BOTH sources. Final test characterizes that existing boundary and unchanged physical rows. It does not require rollback success. No new ordering law is asserted.

Pure public reveal of the compensated retained values is NOT demonstrated: public addOne discards hidden contents by existing contract. The direct diagnostic establishes compensation independently of reveal. No supplied expected values are passed off as restoration evidence.

The internal diagnostic is explicitly `__prepareTransitionTarget.readSource().subjects[].value`, copied in shape from kernel `absent-collection.spec.ts:128`. `getEntityProjectionSeed` is absence-aware and is not a retained physical-storage diagnostic. All mutations use public methods; assertions are outside intercepted callbacks. This suite adds physical multi-row atomic refusal/retry, untouched-row, lifetime, reveal-discard and teardown controls; it does not duplicate the four existing consumer-nonexecution regressions.

## Preserved attempts

`FIRST-retained-source-public-controls.spec.ts` plus `first-*`: initial transactional omissions created later structural dependencies; 5 runtime failures / 1 pass and optional-state type errors. These are fixture errors, not evidence of runtime regression. Downstream compensation assertions did not execute.

`ORDINARY-FIRST-retained-source-public-controls.spec.ts` plus `corrected-{d3b,main}.*`: ordinary omission trial, d3b 3 fail / 3 pass, Main 1 fail / 5 pass. Shared remaining failure was collection-only later-confirmed-dependency. Ancestor expectations were unchanged. `PREREGISTRATION.md` preserves the proposed controls and subsequent explicit boundary correction, including spec hashes. Final green is not presented as all original hypotheses passing.

## Exact reproduction

Pinned Node v24.15.0 PATH, NX_DAEMON=false, NX_ISOLATE_PLUGINS=false, NX_TUI=false are set by `run.py`. It invokes installed dependencies through the shared node_modules symlink; no external review/source transfer. It refuses to overwrite a named log. Every run has `.command.json`, `.exit` and `.log` artifacts.

From any cwd, use NEW log names:

```sh
python3 /private/tmp/st-retained-source-controls/run.py rerun-d3b corepack pnpm nx test kernel --skip-nx-cache retained-source-public-controls.spec.ts
CONTROL_COPY=main-copy python3 /private/tmp/st-retained-source-controls/run.py rerun-main corepack pnpm nx test kernel --skip-nx-cache retained-source-public-controls.spec.ts
CONTROL_COPY=main-copy python3 /private/tmp/st-retained-source-controls/run.py rerun-types node tools/check-spec-types.mjs
```

The runnable spec belongs at `packages/kernel/src/lib/retained-source-public-controls.spec.ts` in each isolated source copy (relative `../index` import). Standalone top-level copy is the handoff artifact. Concrete tree inference preserves row/interceptor types; only deliberate omission writers and the labelled diagnostic use narrow `unknown` boundary casts. No public types were weakened. Ordinary spec-types is a repository ratchet; a new spec has no baseline allowance and must have zero diagnostics. No source changes require a separate source build here.

Main Nx emitted existing archived tsconfig-resolution warnings before running all six tests; logs preserve them. No warning was suppressed or configuration altered.

Type results: `corrected-spec-types` (ordinary-first spec on d3b) exit 0; `final-main-spec-types` (final spec on Main snapshot) exit 0. Both report only pre-existing improvements against the ratchet; baseline not changed. Final d3b spec-types was not separately rerun after adding the already-typed dependency error assertion.
