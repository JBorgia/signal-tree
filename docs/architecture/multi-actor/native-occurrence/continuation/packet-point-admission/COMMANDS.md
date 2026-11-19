# Commands

Cwd candidate; Node24.15.0 first on PATH; NX_DAEMON=false NX_ISOLATE_PLUGINS=false; pnpm10.17.0.

```sh
corepack pnpm nx test kernel --skip-nx-cache independent-refusal-branches.spec.ts point-admission-followup.spec.ts --maxWorkers=1
corepack pnpm nx test kernel --skip-nx-cache independent-refusal-branches.spec.ts point-admission-followup.spec.ts admission-refusal.spec.ts packet-admission-r1.spec.ts packet-index-adversarial.spec.ts packet-index-review.spec.ts native-admission-handoff.spec.ts native-invocation-handoff.spec.ts structural-admission-controls.spec.ts structural-admission-sequence.spec.ts entity-publication-work-lifetime.spec.ts publication-retirement-acceptance.spec.ts --maxWorkers=1
corepack pnpm nx test kernel --skip-nx-cache entity-granular-reactivity.spec.ts --testNamePattern='a single-entity update does not rebuild' --maxWorkers=1
corepack pnpm run typecheck:source
node tools/check-spec-types.mjs
```

Logs: targeted.log, focused-first.log, point.log, source-types.log, spec-types.log. Reproduce in a disposable copy; do not overwrite archived failures.
