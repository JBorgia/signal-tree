# Independent retained-runtime replay

Main replayed the unchanged public permutation fixture against the exact retained
87f6831f source copy. Result: two passes and two failures. The y-then-x authored
case reaches y inverse before blocked x; values become x7/y0, retry changes
nothing, and confirmation reports an already rolled-back transaction. This
confirms the public safety defect; it does not qualify any repair or published v15.

Command from `/private/tmp/st-public-partial-install-comparison/production`:

```sh
PATH=/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:$PATH NX_DAEMON=false NX_ISOLATE_PLUGINS=false ST_PUBLIC_DIAGNOSTIC_OUTPUT=/private/tmp/st-public-partial-main-output corepack pnpm nx test kernel --skip-nx-cache public-partial-install.spec.ts
```

[Raw log](MAIN-REPLAY.log) and `main-production-output` retain all observations.
The fixture asserts initial atomic refusal. Followup behavior is recorded; future
acceptance tests must additionally assert useful retry and confirmation directly.
