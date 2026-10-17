# B stale ordering authority: bounded repair

Baseline: `0054d83a28678a4a04c81640015d473ce7f79acc`.
The commit containing this record is the local repair checkpoint. B remains
rejected for integration. Placement policy and its approved repair are unchanged.

## Contract and first divergence

Owner requirement for this task: “Committed supersession removes obsolete ordering
authority”; “Pending supersession remains reversible where the contract requires
it”; “Pure order-only confirmation releases obsolete dependencies.” These settle
the pure-exact transition previously marked proposed in
`../operation-admission/LIFECYCLE-CHECK.md`; they do not resolve creator payload.

The unchanged terminal replay confirms an order C2,A,B dependent on a pending
rekey. Ordinary exact B,A then removes C2. Capture constructs the new admission,
but `retainNativeOrder=false` previously staged nothing: the older map entry
remained installed. Later rekey rollback retrieved that stale admission and
published A,B. The native replacement had succeeded; its authority retirement had
not occurred.

A second lifecycle gap: projection and dependency queries ignored facts before
committed exact order, but normalization retained them and retention still counted
their pending authors. Thus visible masking alone did not retire obsolete facts.

## Mechanism

- The private terminal record plan supports prepared map deletions. When an order
  replacement needs no retention, its previous admission is deleted in the same
  existing physical installation unit, before observer delivery. Preparation itself
  performs no deletion. Native state remains current truth.
- Order normalization discards the prefix before the latest committed exact
  contribution. Pending exact operations retain earlier contributions so rejection
  can reveal them. Partial front/append does not globally retire earlier order.
  Confirmation keeps the original sequence; late confirmation gains no precedence.
- Newer authored dependencies remain: confirming another exact order that names
  a pending-created lifetime still prevents that creator's rejection.
- Baseline/inverse provenance and outstanding owner handles/claims can remain for
  recovery. They do not acquire visible authority. Old owner index lookups without
  a contribution are harmless and retire at that owner's terminal settlement.
  This is not ordinary-churn reclamation or a new claim of bounded memory.

The prior design check rejected a deletion-only patch as an entire sparse ordering
solution. This patch addresses both exact-order authority transitions above; it
makes no claim to solve the copying/admission representation or global settlement
cost. Those limitations remain, rather than being reclassified as solved.

## Evidence

New assertions were written before the initial runtime change. Baseline first run
(new initial five cases plus unchanged terminal): **3 passed, 3 failed**. Failures:
unchanged terminal order; stale authority contaminating a subsequent pending
interval; obsolete exact contribution still retained after confirmation. Raw log
and baseline sources are preserved. First candidate: **37 passed** across initial
lifecycle, terminal, partial/composition and placement controls.

Two further discriminators were added: failure during ordinary replacement
preparation, and a newer confirmed exact retaining its own pending-lifetime
requirement. Final relevant groups: **89 passed, 1 failed (90)**. The one failure
is the unchanged creator-payload premise, an unresolved semantic assertion—not
counted here as an established implementation defect. The previously failing
stale-order terminal assertion now passes. No assertion was weakened or marked
expected-failure. Prior placement, dependency and overlap controls are unchanged.

Additional validation:

- Affected intrinsic/capture/settlement checks: **22 passed**.
- Original rekey/order replay: **4 passed**.
- Independent reviewer: **8 passed** (seven lifecycle cases plus terminal).
- `pnpm run typecheck`: passes.
- Spec-types ratchet: passes; six existing diagnostics remain; no baseline edit.
- Kernel lint: **zero errors, 15 existing warnings** in unchanged source files.

No full qualification, framework campaign, fresh artifacts or performance campaign
was run. No approval-review rejection or blocked execution occurred this turn.

## Independent review and disposition

The reviewer independently identified the skipped retirement and retained obsolete
prefix, then inspected the candidate and executed the eight tests. No bounded
blocker was reported. Root verified the claims against capture, normalization,
physical target installation and mutation-frame source. Both installers consume
the prepared record plan before callback/observer delivery. No catch was added.

Supported failure scope remains preparation failure before installation, with
plain native Map/Set operations during paired installation. This does not claim
universal recovery from process OOM or arbitrarily replaced native builtins.

Disposition: tested stale exact-order authority is repaired. Placement remains
closed within its prior scope. Payload, ordinary-churn reclamation, quadratic
admission, other integration failures and CPU/bundle costs remain separate and
unresolved. No default activation, API/export change, v15 change, merge or release.

## Exact replay

Use Node 24.15.0 and pinned pnpm 10.17.0 in this checkout:

```sh
export NX_DAEMON=false
pnpm nx test kernel --testFile=src/lib/b-order-authority-lifecycle.spec.ts --testFile=src/lib/b-operation-admission-terminal.spec.ts --testFile=src/lib/b-operation-admission.spec.ts --testFile=src/lib/b-operation-admission-review.spec.ts --testFile=src/lib/b-authored-topology-repair.spec.ts --testFile=src/lib/b-topology-dependencies.spec.ts --testFile=src/lib/b-dependency-lifecycle-audit.spec.ts --testFile=src/lib/successor-placement-policy.spec.ts --testFile=src/lib/b-placement-resolution.spec.ts --testFile=src/enhancers/restoration/restoration-missing-anchors.spec.ts --skip-nx-cache
pnpm nx test kernel --testFile=src/lib/internals/intrinsic-mutation-pay-for-use.spec.ts --testFile=src/lib/heterogeneous-atomicity.spec.ts --testFile=src/enhancers/restoration/committed-entity-capture.spec.ts --testFile=src/enhancers/transactions/settlement-inspection-terminality.spec.ts --skip-nx-cache
bash docs/research/b-native-integration/qualification/replay-counterexample.sh
pnpm run typecheck
node tools/check-spec-types.mjs
pnpm nx lint kernel --skip-nx-cache
```

The first command intentionally reports the unresolved payload assertion. Run the
replay before lint, not concurrently with its temporary fixture creation/removal.
Local PATH prepended `/private/tmp/st-b-qualification-20261016/bin` and
`/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin`.
Raw evidence: `/private/tmp/st-stale-authority/`; archive seal in `EVIDENCE.md`.
