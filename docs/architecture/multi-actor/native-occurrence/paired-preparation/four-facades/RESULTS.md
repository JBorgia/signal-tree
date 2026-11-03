# Actual four-facade focused controls on frozen c47b

Source: `/private/tmp/st-prepared-paired-successor/candidate`, manifest c47b821c5a805f5b37d6c0f5707098d9871fdf2575d22dcc3e12f4a4c93c81db. All2934 manifest entries verified before copying and after execution in both original and disposable copy. Only four new spec files added to `/private/tmp/st-c47b-facade-controls/candidate`; no runtime/configuration/existing assertion edits.

PREREGISTERED.md records commands and acceptance assertions before runs. FIXTURE-SHA256.json records exact pre-execution fixtures, also reverified afterward. First logs are angular-first.log, vue-first.log, solid-first.log and react-first.log; each preserved without rerun or overwrite. Standalone fixture copies under fixtures/.

## Execution

Each command ran from the disposable candidate with pinned Node24.15.0, NX_DAEMON=false and NX_ISOLATE_PLUGINS=false:

- `corepack pnpm nx test angular --skip-nx-cache selected-prepared-facade.spec.ts`: exit0, 2/2 passed.
- `corepack pnpm nx test vue --skip-nx-cache selected-prepared-facade.spec.ts`: exit0, 2/2 passed.
- `corepack pnpm nx test solid --skip-nx-cache selected-prepared-facade.spec.ts`: exit0, 2/2 passed.
- `corepack pnpm nx test react --skip-nx-cache selected-prepared-facade.spec.tsx`: exit0, 2/2 passed.

Total **8 tests passed**, four real facade configurations. Vue/Solid/React existing Nx targets also ran their spec tsc before runtime; Angular target is runtime-only, so no separate Angular spec-type claim. All imported application construction/enhancers through their respective facade entrypoints. React uses actual rendered useSignalTree/useEffect and a stable primitive selector; no fake realization. Vue observes both pre and sync watch effects in its delivery test. Solid uses the configured browser/client reactive runtime, and its effects must execute non-vacuously. Angular uses TestBed/injection-context effect.

## Assertions established

Each facade uses native leaf writes for the pending x7/y11 transaction. The public onUpdate handler blocks the second inverse; both pending values survive, exactly two callbacks occur, removing the handler permits retry to0/0, and subsequent confirm refuses already-settled rollback.

Each mixed scalar3/entityx7 case reaches real framework observation after scheduler flush. Every recorded rollback-phase delivery observes scalar0/field0/own-collection0; observations are explicitly nonempty and the latest value agrees. No computed freshness is asserted inside the authored group. This matches the existing transaction-realization-contract case4c timing rather than inventing synchronous cross-framework computed semantics. Native observers/roots/trees are disposed.

## Limits and disposition

No first test failure occurred. This is finite point/mixed-value coverage, not framework-wide conformance, SDK proof integration, structural qualification or independent acceptance of c47b. No broad suites started. Frozen source remains untouched while Hume reviews.

Logs retain tool warnings (color configuration; Solid Nx discovery also reports a listener-count warning and copied historical missing audit-config extends path). These are not interpreted as production retention evidence or silently suppressed. No runtime repair performed.
