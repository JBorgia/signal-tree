# Commands

All runtime tests used Node 24.15.0 on PATH, NX_DAEMON=false NX_ISOLATE_PLUGINS=false; pnpm is pinned at 10.17.0. Run from candidate unless stated otherwise.

```sh
corepack pnpm nx test kernel --skip-nx-cache packet-index-adversarial.spec.ts --maxWorkers=1
corepack pnpm nx test kernel --skip-nx-cache packet-index-adversarial.spec.ts native-admission-handoff.spec.ts native-invocation-handoff.spec.ts structural-admission-controls.spec.ts structural-admission-sequence.spec.ts entity-publication-work-lifetime.spec.ts publication-retirement-acceptance.spec.ts --maxWorkers=1
corepack pnpm run typecheck:source
node tools/check-spec-types.mjs
corepack pnpm nx test kernel --skip-nx-cache entity-granular-reactivity.spec.ts --testNamePattern='a single-entity update does not rebuild' --maxWorkers=1
```

Baseline structural-sequence and point tests ran from baseline-check (B runtime copied, original native file restored, no optimization). Baseline-check is not original B. Baseline final discriminators used the 23-case version before adding the final deferred-point test.

For allocation, use cwd allocation-final/baseline-b or allocation-final/optimized, with ST_ALLOCATION_OUTPUT set to a fresh absolute JSONL path:

```sh
corepack pnpm nx test kernel --skip-nx-cache allocation-diagnostic.spec.ts --maxWorkers=1
```

Never rerun generators over an existing copy. Original discrimination outputs under /private/tmp/st-publication-allocation-discriminator remain untouched.
