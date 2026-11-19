# Commands and raw results

Cwd candidate. Node24.15.0/pnpm10.17.0; PATH prefix `/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin`; NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_TUI=false.

```sh
corepack pnpm nx test kernel --skip-nx-cache joint-install-boundary-independent.spec.ts joint-install-validation.spec.ts joint-membership-seal-independent.spec.ts joint-readiness.spec.ts joint-mixed-seal.spec.ts --maxWorkers=1
corepack pnpm nx test kernel --skip-nx-cache joint-membership-seal-independent.spec.ts --maxWorkers=1
corepack pnpm nx test kernel --skip-nx-cache complete-structural-sequence.spec.ts joint-atomic-preparation.spec.ts --maxWorkers=1
```

First command: first.log, exit1;20 existing controls + new positive pass; member-address setup fails. Second command executed twice more: membership-corrected.log remains setup failure; membership-admitted.log is actual proof-window failure with successful ordinary membership capture. Both have1pass1fail, but only the last is runtime mechanism evidence. Third command: structure.log exit0,11pass.

Preserved initial sources: membership-first-setup.spec.ts and membership-second-setup.spec.ts. Final test: candidate/packages/kernel/src/lib/joint-membership-seal-independent.spec.ts. Nx's inherited archived-doc tsconfig warning did not prevent execution.
