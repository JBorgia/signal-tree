# Replays

Node24.15.0/pnpm10.17.0; PATH starts `/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin`; NX_DAEMON=false NX_ISOLATE_PLUGINS=false. Cwd candidate.

```sh
corepack pnpm nx test kernel --skip-nx-cache fixed-window-retirement.spec.ts entity-negative-publication-retirement.spec.ts publication-retirement-acceptance.spec.ts entity-publication-work-lifetime.spec.ts publication-retirement-boundaries.spec.ts entity-lifetime-ledger-null.spec.ts entity-selection-lifetime.spec.ts subject-reclamation-coordinator.spec.ts reclamation-eligibility.spec.ts publication-proof-retirement.spec.ts publication-terminal-obligation.spec.ts publication-native-provenance.spec.ts --maxWorkers=1
corepack pnpm nx test kernel --skip-nx-cache fixed-window-independent.spec.ts --maxWorkers=1
corepack pnpm run typecheck:source
node tools/check-spec-types.mjs
```

Original-replay111pass; independent-complete8pass2fail; source-types pass; spec-types-final pass. First-failure logs and first-seven.spec.ts preserved. Test diagnostic writes redirected only into this review directory. No external review CLI, author source edits, runtime mutation or author-result verdict dependence.
