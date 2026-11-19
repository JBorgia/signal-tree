# Four actual facades, focused c47b controls

Source manifest c47b821c5a805f5b37d6c0f5707098d9871fdf2575d22dcc3e12f4a4c93c81db verified before test-only copy. No runtime or existing fixture edits. No SDK proof or structural routes. Native timing follows existing transaction-realization-contract case4c: no computed-freshness demand inside authored group; every actual completed rollback delivery must be coherent, and observation must be nonempty.

Per facade add one spec, two tests:
1. Create row x0/y0. Transaction writes x7 then y11 through framework-native field setters. Public onUpdate blocks the second inverse callback. Assert exactly two callbacks, rollback error, unchanged x7/y11, then remove interceptor and retry: no error, x0/y0; confirm refuses the now rolled-back transaction. Preserve first failure; no weakening.
2. Real native observer of scalar, row-field x, and own collection all().x. Transaction writes scalar3 and x7. After native scheduler flush assert speculative snapshot3/7/7. Start rollback phase, rollback, flush. Assert nonempty actual settlement observations and every observed snapshot0/0/0. No authoring-phase intermediate computed oracle. Cleanup observer/root/tree.

Angular: actual effect in TestBed injection context, .set writes, callable reads, TestBed.tick and microtasks. Vue: .value reads/writes, actual watchEffect both default/pre and sync, nextTick. Solid: .set/callable signals in createRoot, actual createEffect, configured client runtime, event-loop tick. React: public React facade construction, useSignalTree from actual rendered component, stable primitive selector and useEffect recording, callable field writes, act flush. No fake adapter.

Commands from disposable candidate with Node24.15.0, NX_DAEMON=false NX_ISOLATE_PLUGINS=false:
corepack pnpm nx test angular --skip-nx-cache selected-prepared-facade.spec.ts
corepack pnpm nx test vue --skip-nx-cache selected-prepared-facade.spec.ts
corepack pnpm nx test solid --skip-nx-cache selected-prepared-facade.spec.ts
corepack pnpm nx test react --skip-nx-cache selected-prepared-facade.spec.tsx

Use existing Nx facade targets/configuration (React includes its existing spec type gate). Save separate first logs and fixture hashes before calls. No broad suites pending independent qualification. These are new acceptance assertions using existing scope/timing, not an assertion that c47b is accepted.
