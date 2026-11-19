# Bounded mechanism: value work transferred to Link, support selected independently

Proposal for review only; no runtime edit. Applies to the exact C15 equal-final-sibling failure. It does not change declaration permission, operation retention, native support, or source identity.

## Small state and ownership

Reuse Link's existing `dirty`, `held`, queued chain, `waitingSends`, and `knownY`. They already own work after Link adopts a projection. They cannot preserve work that never reaches Link: the demonstrated failure loses changed A in `ready()` before `researchRefresh()` ever marks dirty. The global fact serial is not an acknowledgment cursor and must not be repurposed as one.

Add one recipient-local **shared delivery cell** to Binding, retained by reference across the existing `{...b}` clones:

```
{ produced: number, taken: number, projected?: current immutable projection }
```

Initialize produced=taken=0. Move the existing projected slot into this cell (one selected projection, not history). The immutable projected receipt carries the value-work prefix it represents, alongside current fact/payload. `produced` counts completed, selected value changes; it is neither a transaction revision nor permission. `taken` records the prefix Link has adopted. No payload/proof history and no new owner scans.

A boolean alone cannot distinguish acknowledgment of an older receipt from newer work produced during reentry. Two local cursors provide that distinction. These are the only new work-lifetime fields; no new queue, retry policy, or operation retention is proposed.

## Reduction rule

- A completed, non-noop value-changing unit advances produced once when its selection is published. Preserve existing physical/ordinary participation rules: inspection does not create outbound work. Legacy accepted observations follow their existing value-work behavior.
- A support-only unit replaces current support/payload selection as it does today, but does not advance produced and does not clear outstanding value work. Its receipt carries the same produced prefix. It must never copy the previous fact's permission.
- A no-write collapse neither advances nor consumes work. Existing predecessor and receipt logic remains authoritative for no-write status.
- Replace `projected.changed = lastUnit.changed` as the consumer's work test with `receipt.workEpoch > delivery.taken`. `changed` may remain a compatibility field derived from that comparison if needed internally; it must not be the final unit's physical-change bit.
- Never reset produced/taken on a Binding clone, support recomposition, readiness callback, supersede, or terminal operation retirement. Retirement owns dependencies/receipts, not pending value work.

For A changed then equal B, B remains the selected support fact and its payload includes A; B's work prefix remains unconsumed. This schedules evaluation of **B**, not an old A send.

## Exact take/ack boundary

Keep `refreshSource` non-consuming. Existing private diagnostic readers must not steal Link's work. Add a private acknowledgment of the exact returned receipt/prefix, associated with the same recipient delivery cell.

Use one small Link-local adoption helper at `researchRefresh` and the direct `projectScalarContribution` receipt path:

1. Obtain a stable selected receipt after reduction. No handoff while its fact differs from the latest binding's current fact.
2. Assign `researchFact = receipt.fact` and `eligible = receipt.payload`.
3. If its work prefix exceeds the last acknowledged prefix, OR it into existing `dirty`; never reset dirty because the new receipt is support-only.
4. Acknowledge **that receipt's prefix**, only after those local assignments. No `observeLink`, endpoint, await, admission, or other callback between adoption and acknowledgment.

Acknowledgment advances taken only through the captured prefix; it must not clear a newer produced prefix. It verifies the recipient/cell identity, not a global serial or fact permission. A stale/disposed recipient cannot acknowledge another binding. Taking is a transfer of work ownership into Link, **not** confirmation that an endpoint received it.

Do not early-return solely because `receipt.fact === researchFact`: a direct-notification path may already have assigned the fact without acknowledging its work. Return early only when both selection and work prefix are already adopted. For direct legacy paths returning just a fact, their existing `dirty=true` retains Link work; the next refresh must still be able to acknowledge the matching receipt without rearming already-consumed work. No implicit acknowledgment inside `project()` or `ready()`.

## Clones and reentry

The delivery cell and selected receipt slot are shared across preparation-time Binding clones, just as pending/index state is shared now. This prevents a clone prepared earlier from restoring an obsolete work bit or projected slot. `current` remains the latest installed fact; a shared projected receipt is returned only if it matches the **live** Binding's current fact.

`refreshSource` must re-fetch the live binding after `ready()`, rather than returning from its pre-drain captured Binding. A reentrant installation can replace that wrapper. If its later unit is not complete, return no takeable receipt and retain the work prefix; completion will wake/reduce it. A readiness callback alone cannot acknowledge anything.

Reduction must advance a unit's value-work prefix once, even if a private callback reenters refresh during reduction. Use a recipient-local drain guard if a reentrant drain is possible; inner refresh must not expose a partially reduced receipt. The outer drain observes the shared pending sequence and latest binding before publishing/taking. Do not add a second payload reconstruction or overwrite a newer current fact using an old Binding reference. Existing completed-payload reduction remains the selection authority. If the bounded reentry control exposes a stale completed-payload clone beyond this handoff, preserve that counterexample and review it rather than silently enlarging this patch.

This is a recipient handoff cursor, not source-issued identity redesign.

## Held sends, support changes, and completion

Once Link takes A's work, producer acknowledgment is safe: `dirty` owns it. `flushOutbound` clears dirty only while creating/reusing the existing held waiter before admission. If support becomes pending, that waiter/queued send owns the work until eligibility resumes. Do not acknowledge again at admission or retain a producer flag until endpoint completion.

A support-only later receipt must update researchFact/eligible even when it contributes no new work. If a held/queued send exists, it continues under the latest support. `offResearchEligibility` already considers held work; settlement can resume it. Every actual send still uses existing admission/allowed checks for the current fact. No old declared grant is moved to the new fact.

If A was already delivered and no work remains, equal B may change support and its receipt without setting dirty. q confirmation alone must not create a duplicate send. Existing knownY/deepEqual suppression remains the final duplicate guard; it is not a substitute for acknowledging the producer's work prefix.

Endpoint or Link-observer reentry may install a newer selection. Its new value-work prefix is not cleared by acknowledging an older receipt. The existing current-ticket allowed check and latest-payload reconciliation must remain; a resumed held send must use current support and payload, not the captured old grant. This proposal does not change `admit`'s permission policy.

Disposal drops the recipient cell together with its binding and uses existing Link waiter/cancel cleanup. Late acknowledgment is a no-op; readiness or settlement after disposal cannot rearm delivery. No global cursor or shared-source acknowledgment.

## Bounded discriminators before acceptance

1. **Unchanged original:** one private scalar frame a=1, equal b=0; exact one `{a:1,b:0}` delivery. Reverse staging order and equal-only frame: correct order-independent result, no equal-only duplicate.
2. **Owner's public hold discriminator:** foreign q pending; `c.declare(independent, a(1))`, then before flush `c.declare(dependent[q], b(0))`. Live state `{1,0}`; no send while q pending; exactly `{1,0}` after confirm. This must use B's support, never A's old permission.
3. **Already delivered contrast:** deliver A first, then equal dependent B; no extra send before or after q confirms. A later genuine changed write must still send. Check that repeated refresh/eligibility wake does not leave an always-true producer flag.
4. **Take versus inspect:** refresh twice without acknowledgment retains the work; Link adoption acknowledges only its prefix. Repeated take with no new work does not rearm. Artificially delayed acknowledgment of epoch E cannot clear newly produced E+1. Label this private handoff instrumentation, not public behavior.
5. **Held/reentry:** after work is taken/held, install a newer value while a completion or endpoint callback reenters. Latest payload/support wins; old ticket cannot send; no loss or duplicate. Include a later support-only pending revision between the value change and release.
6. **Binding clone / unfinished reduction:** prepare/clone before older completed work is taken, then complete support-only sibling; work survives. Reentrant refresh during reduction cannot consume twice or expose a partial receipt. If nested installation is not complete, no takeable receipt yet; completing it eventually delivers the exact latest payload.
7. **Dispose while held:** waiter resolves/cancels and q settlement causes no endpoint call. Retention returns to baseline.

Retain unchanged scalar-frame/publication, native support, enrollment invariance and parent-invalid controls. Source/spec types after implementation. No full suites or source-identity redesign. These added cases are proposed, not executed in this design turn; original failure/source traces remain preserved in REVIEW.md.

## Review boundary

This proposal separates three lifetimes: producer-to-Link value-work handoff, current support/recipient permission, and operation retirement. It does not select a permission-lifetime fix: the demonstrated witness never reaches admission. The minimal intended edit surface is private publication selection/handoff plus Link's two receipt adoption paths. No runtime edits were made for this proposal.
