# Public interceptor comparison: retained production and frozen experiment

The orphan/partial settlement is an inherited safety bug, not a contract to preserve. It reproduces using only public kernel APIs on exact retained production 87f6831fa60cafe87508f0ace84b7638698ca3b0 as well as the frozen explicit experiment. The fixture imports entityMap, signalTree and transactions from the package root; it uses public rows.intercept/onUpdate/context.block, row reads, handle.inspect, rollback and confirm. Vitest and node:fs are the only other imports. No experimental/internal authority imports, private counters, forged metadata or replacement planner.

Source copies:
- production: git archive of exact87f6831f, original tar retained as production-source.tar, per-file manifest PRODUCTION-SOURCE-SHA256.json.
- experiment: verified copy of frozen manifest 057c6b8f4933eca5dbb3c0c31c069612264998b66e71c9e49ddd1a933edddad3, EXPERIMENT-SOURCE-SHA256.json.
- no runtime changed in either; identical public fixture added.

## Exact results

Start x0/y0. Transaction writes x7/y11 in one of two orders. Public onUpdate blocks any inverse x0. Followups run on separate fresh trees: detach blocker and retry rollback, or detach and confirm.

| Source | Forward order | Inverse callbacks reached | After refusal | Retry | Confirm |
|---|---|---|---|---|---|
| retained87 | x then y | x only | x7/y11 | restores0/0 | succeeds, retains7/11 |
| retained87 | y then x | y then x | x7/y0 | no-op, retains7/0 | throws Cannot confirm a rolled back transaction |
| experiment | x then y | y then x | x7/y0 | no-op, retains7/0 | throws Cannot confirm a rolled back transaction |
| experiment | y then x | x only | x7/y11 | restores0/0 | succeeds, retains7/11 |

Thus the same public second-unit-block boundary is unsafe in both sources. Effect ordering differs; do not describe a same-forward-order run as an equivalent callback route. The experiment did not introduce the existence of this safety defect; this comparison does not bisect which experimental change altered ordering.

In partial cases the original block Error propagates. In pre-first-install refusals a SignalTreeRollbackError wraps the block and the handle remains usable. Public inspect().changes reports current statuses both before and after; it is not a direct pending-state API and cannot distinguish terminal lifecycle here. No private pending count was used. Successful retry/confirm versus explicit rolled-back confirm error supplies the public lifecycle evidence. Existing private-count diagnostics are separately labeled in st-native-partial-install-diagnostic.

Public callback projected field reads record x7/y11 even in the experiment's second callback after y's underlying installation. That is observed cache/group behavior, not evidence of atomic source storage and not a promised staged-prefix read. Do not infer callback read semantics from physical-install order alone.

## Preserved first failures

PUBLIC-FIXTURE.spec.ts and *-first-runtime.log / *-first-output retain the initial same-forward-order comparison. Both runs exit1: experiment fails atomic-refusal safety; production fails the initial fixture's assumption that y callback had already executed. No failure was overwritten.

PUBLIC-PERMUTATIONS.spec.ts tests both forward orders, preserving the safety assertion afterFailure.value == {x:7,y:11}. Only the unsupported universal y-before-x assertion was removed; callback sequences remain recorded and x blocking is asserted. Both sources: 2pass/2fail. Failures are the partial/refused second-unit cases. This is counterexample evidence, not acceptance. Identical fixture bytes run on both.

Commands (each source working directory), Node24.15.0, corepack pnpm:
PATH=/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:$PATH NX_DAEMON=false NX_ISOLATE_PLUGINS=false ST_PUBLIC_DIAGNOSTIC_OUTPUT=<unique absolute output directory> corepack pnpm nx test kernel --skip-nx-cache public-partial-install.spec.ts

Directories production-first-output, experiment-first-output, production-permutation-output and experiment-permutation-output are separate. No append/reuse of frozen observation files. All logs and actual thrown outcomes are retained. No source/spec gates claimed for these intentionally failing public diagnostics.

## Private/public interceptor scope audit

Frozen source package-wide rg finds interceptLocationWrites runtime use only in enhancers/batching/batching.ts:39–44 through its private WritePort; the other call sites are tests. location-runtime.ts defines it but index.ts, adapter.ts and internals.ts do not re-export it. adapter.ts exports replaceLocation, which is distinct and remains public ordinary behavior. No framework production caller of interceptLocationWrites found.

Therefore arbitrary private selected proceed(); readTarget(); throw is not a public selected-rollback contract. It is retained historical implementation evidence. The unaccepted selected lane can prepare rather than install, with new tests asserting preparation/no partial install. Public ordinary replace/derive/proceed must keep existing semantics. Built-in batching is a real production obligation: transaction-scope guard, synchronous drain, deduplication/classification order, notification scheduling, detach/destroy cleanup and outer-coalesce rejection remain required. Do not bypass batching because the helper is private.

The source-approved next direction is whole selected-unit preparation/installation, not a boolean partial-settlement rule. See PREPARED-UNIT-BOUNDARY.md. No runtime correction in these comparison copies or in lifecycle successor yet.
