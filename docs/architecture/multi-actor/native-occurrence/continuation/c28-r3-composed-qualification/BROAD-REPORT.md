# Exact composed R3 ordinary compatibility

**Selected ordinary coverage completed; not whole acceptance.** All 3,102 files verified before/after against frozen composition MANIFEST SHA256 `2a020da77e263693fbee66973bfba7072cb489a7cbde53bcda4336d686f820cd`. No source/test/oracle edits in this broad phase. One counted-work failure and affected lint failure remain; two explicit large gates were excluded and remain unqualified on this exact combined source.

| Project | Completed / selected files | Ordinary pass | Ordinary fail | Satisfied expected failure | Skip |
| --- | ---: | ---: | ---: | ---: | ---: |
| Kernel | 641 / 641 | 7079 | 1 | 5 | 12 |
| Angular | 52 / 52 | 302 | 0 | 0 | 3 |
| React | 19 / 19 | 109 | 0 | 0 | 0 |
| Vue | 34 / 34 | 223 | 0 | 0 | 0 |
| Solid | 22 / 22 | 136 | 0 | 0 | 0 |
| Total | 768 / 768 | 7849 | 1 | 5 | 15 |

Discovery: 770 ordinary files (643 kernel +127 frameworks). Exact exclusions: packages/kernel/src/lib/entity-large-batches.spec.ts and packages/kernel/src/enhancers/restoration/large-batch-restoration-v16-controls.spec.ts. Their unchanged bytes are included in identity verification but not executed. Prior indexed large passes and compound entity OOM are separate evidence, not combined-source qualification. Included entity-large-batches-v16-controls.spec.ts completed; do not conflate it with either excluded file. Five new kernel spec files from composition are included in discovery/execution. No other file excluded, no mode/assertion changes; existing five expected failures and ordinary skips remain visible. No unhandled run-end errors or unexpected files.

## Original26 reconciliation

25 current counterparts pass; one unchanged counted-work guard fails: entity-granular-reactivity.spec.ts, “a single-entity update does not rebuild the collection”, actual13000 vs unchanged <2000. No new runtime assertion failures. ORIGINAL26-RECONCILIATION.md/JSON account for every original case, source/test hash, rename and exact executed state. Nine unchanged regression cases pass (seven dynamic-admission, two realization/ABA); twelve corrected private refusal/spy fixtures pass; four approved receipt/recipient-domain oracle corrections pass. This is not a claim that all25 were runtime defects fixed. Public structural-drift behavior is not inferred from injected private preparation failures.

## Harness and gates

Sequential Nx, pinned Node24.15.0/pnpm10.17.0 and installed root deps, maxWorkers1; own cache/temp; 180s startup/no-progress and1800s absolute bounds with birth-matched owned-process cleanup. Every completed process census is empty; no watchdog fired. Frameworks ran sequentially before corrected kernel, with no overlapping heavy runs. Kernel exit1 is its assertion failure; frameworks exit0. Exact commands/environment/process identities and raw first logs are under full-runs. Required ST output directories and prior exact diagnostic filesystem mappings are recorded per command. Angular retains its target-owned --expose-gc. Ordinary retention spy diagnostics are nontransparent probes, not the dedicated GC retention gate.

First harness failures preserved: sandbox process census denied before launch, then first kernel invocation used repository-relative filters and selected zero tests. full-runs/kernel preserves that zero-test failure; full-runs/kernel-corrected removes only packages/kernel/ prefix, matching the prior continuation runner. Same641-file identity, no test rerun because the first invocation ran none. Archived tsconfig resolution warnings remain in logs; no config changes made.

Source types, public types, and unchanged spec-types ratchet all pass. Affected lint runs on27 changed TypeScript files, exit1: **23errors/20warnings**. Raw log includes18empty-function errors,4no-unsafe-finally errors,1prefer-const error. LINT-SOURCE-LINEAGE.json identifies exact lines also present in R3; that is source comparison, not a baseline lint execution or blanket inherited-error adjudication. No fixes, disables or budget changes. Gate commands/logs/identities are in gates/; no build/artifact validation.

Broad source/evidence is frozen in BROAD-FREEZE.json before the separately authorized reviewer-spec overlay. Overlay results must remain separately identified and are not additional broad-suite coverage. Main retains promotion/composition and acceptance authority.
