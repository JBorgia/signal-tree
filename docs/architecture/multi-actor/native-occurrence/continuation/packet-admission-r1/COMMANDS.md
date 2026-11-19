# Reproduction

Use Node24.15.0 from `/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin`, pinned pnpm10.17.0. Set NX_DAEMON=false NX_ISOLATE_PLUGINS=false. Source cwd `/private/tmp/st-packet-index-admission-r1/candidate`:

```sh
corepack pnpm nx test kernel --skip-nx-cache packet-admission-r1.spec.ts packet-index-adversarial.spec.ts packet-index-review.spec.ts native-admission-handoff.spec.ts native-invocation-handoff.spec.ts structural-admission-controls.spec.ts structural-admission-sequence.spec.ts entity-publication-work-lifetime.spec.ts publication-retirement-acceptance.spec.ts --maxWorkers=1
corepack pnpm nx test kernel --skip-nx-cache packet-admission-r1.spec.ts --maxWorkers=1
corepack pnpm nx test kernel --skip-nx-cache entity-granular-reactivity.spec.ts --testNamePattern='a single-entity update does not rebuild' --maxWorkers=1
corepack pnpm run typecheck:source
node tools/check-spec-types.mjs
```

Final point raw log is point-owned.log. No test ceiling was changed. For each allocation-final/baseline-b and allocation-final/optimized cwd, set ST_ALLOCATION_OUTPUT to a NEW absolute jsonl filename and run:

```sh
corepack pnpm nx test kernel --skip-nx-cache allocation-diagnostic.spec.ts --maxWorkers=1
```

Candidate instrumented point diagnostic, fresh output path:

```sh
corepack pnpm nx test kernel --skip-nx-cache ownership-point-diagnostic.spec.ts --maxWorkers=1
```

Instrumentation creation order in a fresh directory only: instrument.py, ownership-instrument.py, extra-instrument.py; then copy the unchanged `/private/tmp/st-publication-allocation-discriminator/allocation.spec.ts` into both instrumented kernel lib trees as allocation-diagnostic.spec.ts. Scripts contain absolute source/output paths: redirect output directory before reproduction; never overwrite the archived copies or append into preserved JSONLs. FINAL-IDENTITY.json is the post-instrumentation executed identity. `verify.py` checks predecessor preservation and evidence and regenerates manifests/patches; freeze already recorded, so run it only against a disposable evidence copy for further review.
