# Scalar role implementation: frozen review handoff

Base: `9f819662775da6a129e4cf7699e5bc5907e5588f`. Runtime diff: only
`experimental-publication/lifecycle.ts` and `private.ts`. Exact hashes are in
`006-source-identity.json`; `001-roles.patch` and `002-after.patch` compare equal.
No runtime edits occurred between runs. Root owns added audit specs.

## Mechanism

Proofs retain destination authorship D, actual input I, validation V and
possible-owner uncertainty W separately. `owners` remains the union used for
wake/delivery indexes. Recipient coverage R remains operation-local.

Native input consumption promotes a source's actual owners (including D) into I.
Declaration contradiction checks I/V, not the destination D. Installation
captures a candidate possible-owner window after callback-capable preparation;
only this newly acquired window is normalized against D and actual I. Inherited
W is never subtracted. Complete declarations do not apply their candidate W,
but preserve it for validation failure without sampling later owners.

Projection summaries and equality checks retain roles independently. This avoids
losing a role change when the owner identity set is unchanged. Existing reverse
wake edges and retirement consume unioned actual plus possible owners; no new
canonical value store or entity mechanism is introduced.

## Executed evidence

- `001-first-roles.log`: 20/20 pass: combination14, role overlap2, preparation4.
- `002-combined-scalar.log`: 211 pass / 2 failed, 213 total. The two unchanged
  historical assertions are aggregate-installed-publication:131 (unrelated
  foreign-owner ordinary fallback) and aggregate-native-input-independent:14
  (native observed input now rejects contradictory independent declaration).
  These remain failed assertions, not safety passes. Prior adjudication is in
  scope-design DESIGN-REVIEW:45–51 and scope-successor RUNTIME-REVIEW:50.
- `003-registration-reentry.log`: 2 pass / 4 skipped. Only scalar membership
  registration/reentry selected; skipped entity cases are not qualified.
- `004-kernel-types.log`: exit2, 11 TS4111 diagnostics in unchanged transaction
  semantics-authority/composition. No role-file diagnostic, not a clean typecheck.
- `005-validation-window-audit.log`: 1 fail. Publication checks pass but final
  late-tree x9 assertion receives0. The fixture attempts nested transact inside
  target p callback: transactions.ts4546–4552 refuses before opening a later
  owner; write-context.ts49–80 is ambient across trees. `later` remains undefined,
  so optional inspection equality was vacuous. Root adjudication is required;
  no assertion/runtime edit made by worker.

All Nx logs preserve full expanded generating commands. Node24.15.0 and pinned
pnpm10.17.0 via PATH=/private/tmp/link-membership-pinned-bin:$PATH;
NX_DAEMON=false; Nx --skip-nx-cache. Scoped types command:
`corepack pnpm exec tsc --noEmit -p packages/kernel/tsconfig.lib.json`.
`git diff --check` passes.

Independent review remains active. No entity work, broad qualification, costs,
GC/retention claim, commit or integration acceptance follows from these results.
