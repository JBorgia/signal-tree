# Initialization cleanup successor — bounded freeze

Implemented and focused checks complete; independent review requested. No integration or release claim. Preserved rejected905af117 candidate is unchanged, including all3098 manifested files. Its review and raw56pass/1fail result are copied to REVIEWER-FAILURE.md and reviewer-first/. Exact reviewer fixture is copied unchanged, identity recorded in REVIEWER-FIXTURE-IDENTITY.json.

## Correction

Only transactions.ts differs at runtime from905af117. Each cleanup installed by this transaction initializer now passes through a shared owned release: clear its captured callback before invocation, remove itself from the local set, then invoke once. Normal tree cleanup uses the same release. The existing comprehensive cleanup body is text-identical (CLEANUP-BODY-EQUALITY.txt), but registers before the fatal scalar-attachment stage rather than after it. When that stage fails, unwind this initializer's owned releases in reverse order, report cleanup errors defensively, and rethrow the original attachment error. Do not destroy the caller tree. Earlier capture-registry/member/entity/journal cleanups participate through the same registration helper. The prior local traversal/provider unwind remains.

This closes the executed missing-subscription-release path; it does not redesign initialization generally or claim arbitrary resource cleanup functions cannot themselves throw. No scalar producer, source admission, public API, default activation, entity completion, facade, budget or per-unit realization changes. Link fixture correction is separate and absent here.

## Falsifiers and first failures

- Exact reviewer test unchanged: passes1/1, verifies exact thrown identity, reached fault and real notifier subscription released.
- focused-first:57pass/1fail. All original56 and exact reviewer1 pass. The added isolation test alone initially required positive enqueue registration, but actual was0. Source shows enqueue observation demand-enrolled when a pending turn exists; failed initializer has none. Original fixture and raw failure preserved in originals/ and runs/focused-first/. This was a coverage-premise error, not a suppressed subscription leak.
- Corrected added isolation test: lifecycle-final1/1. Requires positive registration and zero remaining subscribe/reset/structural/order subscriptions; explicitly requires enqueue never registered and zero active. Uses actual duplicate terminal owner on caller-owned restoration tree, then verifies scalar/member/entity providers removed, earlier leaf slot freed, existing terminal owner still invoked, useful state write, and repeated tree destruction harmless. Existing restoration tree is not destroyed to make the failure assertions pass.
- Angular, React, Vue, Solid unchanged whole-value-new-keys entire files:3/3 each, sequential.
- Source types, public types, spec-types: exit0 each; spec-types1/1 gate pass. No baseline update.

The repeated reviewer1 and corrected isolation1 are not extra counts atop overlapping runs. Original assertions were not relaxed; the new enqueue coverage mistake is separately preserved and explained. No broad suites/builds/performance tests. Existing archived-tsconfig warnings remain visible.

## Reproduction and identity

run.py uses Node24.15.0/pnpm10.17.0, explicit Nx files, maxWorkers1, isolated Nx cache/data/tmp,180s owned-group cap. Exact argv/environment/process records and raw first.log files are under runs/. Every run sourceUnchanged:true, timeout:false; RESULTS.json preserves all exits including the new fixture first failure.

Base manifest:905af11731583b81a9690e2fdaf8a2e0cc71fad4d375f0f5ec1d7a944a012816.
Final manifest:e4ab440c101fbac6cc89f22924dba0842c3670ea519ac33087f62175c74e26e3.
Runtime patch:3b3d210534b969affc9decd28585a8aa6fcae443b991f03351c76372bffd04bc.
Test patch:fd68c0e6359d8f3515822e700e4d25b24106cddf470f925df7a8dc770b3b8076.

All candidate manifest files and preserved905af117 reverified after final type gate. No remaining blocker demonstrated by this finite selection; independent cleanup ownership/order review pending. No universal leak-freedom or broader characterization acceptance.
