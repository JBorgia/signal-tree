# Independent commands

Cwd candidate; Node24.15.0/pnpm10.17.0. PATH prefix `/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin`; NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_TUI=false. Focused run uses ST_PREPARED_REVIEW_OUTPUT=/private/tmp/st-scalar-instrumentation-independent/output.

```sh
corepack pnpm nx test kernel --skip-nx-cache scalar-install-accounting.spec.ts tree-scalar-slot-runtime.spec.ts production-scalar-substrate.benchmark.spec.ts omission-reason-companion.spec.ts --testNamePattern='scalar slot runtime|counts|stale install|reentry counts|ordinary authority-only|recorded shadow|proves compiled scalar reads|refuses, typed, when the collection changed while omitted' --maxWorkers=1
corepack pnpm nx test kernel --skip-nx-cache scalar-accounting-independent.spec.ts --maxWorkers=1
```

focused.log:27pass78filtered exit0. independent.log:3pass exit0. Archived-doc tsconfig warnings did not prevent execution. Added test source is in candidate/packages/kernel/src/lib/internals/scalar-accounting-independent.spec.ts.
