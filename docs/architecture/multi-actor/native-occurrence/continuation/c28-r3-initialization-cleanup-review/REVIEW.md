# Independent initialization-cleanup successor review

**Bounded accept of this exact successor for composition qualification. Prior initialization-subscription blocker is closed by source and independent execution.** No root/candidate edits, no unrelated state-context patch. Exact full manifest e4ab440c101fbac6cc89f22924dba0842c3670ea519ac33087f62175c74e26e3, runtime patch3b3d210534b969affc9decd28585a8aa6fcae443b991f03351c76372bffd04bc relative preserved905af117. All manifested bytes verified before copy and after replay; IDENTITY.json pins source/logs. Final author narrative was not yet present; conclusion is about these exact source bytes and completed raw gates.

## Ownership and failure behavior

Only transactions.ts runtime changes. Existing per-initializer cleanup registrations now enter a private Set and tree cleanup registry through a shared idempotent wrapper. Each wrapper clears its callback and removes itself before invoking it. Failed attachment unwinds a reversed snapshot of those owned releases; cleanup/reporting failures are contained and original caught error is rethrown. It does not invoke tree.destroy, clear another tree's registry wholesale, or convert refusal to success. Shared scalar-provider release remains identity-checked. The old comprehensive transaction cleanup body is available and registered before notifier attachment instead of after initialization completes; its referenced state is initialized by then.

Normal destruction still uses the existing tree cleanup registry in registration order. Its comprehensive cleanup has moved before scalar-provider registration: this is a real ordering change, not byte-identical ordering. Tree destroy has already set the destroyed flag; comprehensive cleanup marks transaction destroyed before unregistering selection/canceling scopes. cancelCommitScopes clears internal sets/maps rather than delivering queued consequences. No concrete normal-lifetime regression found. Existing entity/member provider deletion logic is retained, not generalized into a new replacement-provider policy.

Failure unwind now reaches notifier subscription/reset and structural/order release before leaving initialization. Enqueue is demand-enrolled only when a pending turn exists; absence at initialization is correctly asserted as zero, not used as vacuous proof that a registered observer was released. Registration-failure paths earlier than this bounded fatal scalar stage, hostile custom tree.registerCleanup, arbitrary throwing private release monkeypatches, and generalized enhancer construction rollback are not newly solved or claimed.

## Independent replay

Own exact copy at candidate/, no overlays beyond source packet. Pinned Node24.15.0/pnpm, Nx kernel explicit8files, own cache/data/tmp, --skip-nx-cache --maxWorkers=1, owned-process120s bound. focused-first/COMMAND.json and first.log retain exact invocation/output. **58/58 across8files, exit0, no timeout.** Source manifest unchanged after execution.

This includes the original56-case selection plus both initializer tests. My exact prior failing fixture is byte-identical: reached preparation fault, exact thrown identity and real subscription registration remain asserted; active subscriptions now reach0. Caller-tree test creates an actual competing terminal owner, checks initializer registration/release counts, vacant scalar/member/entity providers, usable retained original owner and tree, and harmless repeated destroy. Original56 cases preserve initial/dynamic singleton preparation, no-provider/bare capture behavior, local attachment unwind, provisional cancellation/reentry, intent/no-op and useful rollback. These repeat earlier selections, not58 entirely new tests.

The author's first added-test premise error concerning positive enqueue registration remains preserved; corrected assertion matches demand-registration source. It does not erase a reached-subscription obligation: subscriber/reset/structural/order registrations must be positive and all active counts zero.

## Other evidence and limits

Inspected raw successor Angular/React/Vue/Solid results3/3 each and source/public/spec types exit0, sourceUnchanged true. These are author executions, not independently rerun framework/type gates. IDENTITY.json records them separately. No baseline type allowances or APIs changed. The old905af117 failure remains archived; it is not retrospectively relabeled passing.

No heap/GC measurement: idempotent release and pointer clearing do not prove universal reclamation, nor do they prove a bounded number of no-op cleanup wrappers after arbitrarily many failed initializer retries. No broad suite, builds, large gate, cost acceptance or production activation. State-context defect and disposition-index OOM remain separate. No further blocker demonstrated in the authorized initialization cleanup and dynamic attachment scope.
