# Private selected forwarding-edge cleanup — source proposal

Disposition: the clearable-edge mechanism is appropriate within existing private handoff/obligation-cleanup authority, with one required error-accounting detail: clearing failure references on fail must not erase the dispatch's first failure when an interceptor catches it. No new public policy, runtime edits or implementation acceptance. This document is a source-based proposal; all new falsifiers below are NOT RUN against an implementation.

Source identity: frozen c47b821c5a805f5b37d6c0f5707098d9871fdf2575d22dcc3e12f4a4c93c81db. Exact consulted files/hashes in IDENTITIES.json. Existing review contract read. Source remains frozen. Empirical basis is /private/tmp/st-held-continuation-review/REVIEW.md and its matched Nx drop/hold results: callback-only holding retained tree/field/binding/source/requirement; dropping it released sampled targets. No permanent leak or universal heap conclusion.

## Exact seam and retained-edge correction

selected-write-operation.ts31–33 currently returns a function capturing `next` permanently. location-runtime.ts140–145 passes previousSelected, which can be another registered interceptor wrapper or the terminal projection writer. That chain can reach neutral source/native realization and collection writer state after invocation.request is cleared. The fix belongs in this private continuation substrate and its enclosing dispatch, not in public ordinary replace/derive writers or framework internals.

Use a private forwarding edge record with a clearable downstream function. Each selectedProceed registration must:

1. Require the invocation to be open with an active request and register one edge in its invocation-owned inventory.
2. Store downstream only in edge.next, not in a second retained closure parameter/property.
3. Return a callback built by a separate module-level factory whose parameters are exactly invocation and edge. It must not close over the selectedProceed factory's original next, receiver, request, operation, selection, or dispatch outcome object.
4. Before forwarding, require open invocation and a nonempty edge.next, move the downstream function into a call-local variable, and clear edge.next BEFORE calling it. That is both single-use enforcement and early release of that edge's persistent downstream reference. Remaining forwarding work on the synchronous stack is legitimate and must not be forcibly disrupted.
5. On close/fail, mark closed first, clear every registered edge.next (including unforwarded inner edges), clear and detach the edge inventory, clear request and any callback-reachable failure/outcome references. Idempotence is required because multiple nested catch/finally paths can close the same invocation. Cleanup must not invoke downstream code or user callbacks.

Conceptual pseudocode (not a runtime patch):

```ts
function selectedProceed(invocation, next) {
  assertOpen(invocation);
  const edge = { next };
  invocation.edges.add(edge);
  return makeProceed(invocation, edge);
}
function makeProceed(invocation, edge) {
  return () => forward(invocation, edge);
}
function forward(invocation, edge) {
  if (invocation.phase !== 'open' || !edge.next)
    throw closedOrConsumedError();
  const next = edge.next;
  edge.next = undefined;
  try { next(invocation); }
  catch (error) { failSelected(invocation, error); throw error; }
}
```

The wrapper's lexical factory must not receive next separately. This avoids leaving a redundant capture that defeats the new record. Removing a forwarded edge from the inventory is optional once its next is empty; keep any inventory finite and drop it at final closure. No ambient registry, global index or WeakRef-based authority required. The standard installed interceptor chain remains owned by the live binding until normal detachment/destruction; this proposal clears invocation-created forwarding edges, not that legitimate chain.

## Failure receipt: preserve current semantics while clearing references

location-runtime.ts96 currently checks invocation.failed and throws invocation.failure after the installed chain returns. failSelected currently preserves the first failure; closeSelected finally clears it. If fail is changed to erase failure immediately without another dispatch-owned location, an interceptor that catches an inner preparation error could let the outer dispatch appear successful, or replace the original error with undefined. This is a concrete semantic hazard, not an optional heap improvement.

Recommended bounded arrangement:

- The enclosing selected dispatch owns a local outcome receipt `{ failed, error }`. Create it alongside invocation. Invocation has a temporary pointer to that receipt only while dispatch is active; callbacks do not directly capture the receipt.
- failSelected copies the first error into the receipt, then closes and clears request/edges/inventory and detaches invocation.outcome. No error object remains reachable through the invocation after fail. An explicit primitive failed/closed state may remain.
- If an inner error is caught and the interceptor returns, the enclosing dispatch reads its local receipt, sees failed and throws the original error. Later enclosing catches must not replace that first recorded error after the invocation's receipt pointer has been detached. Repeated fail is harmless.
- In the dispatch finally, close/detach again and clear the local receipt's error reference. Throwing the error before that finally still propagates the selected object to its legitimate caller; clearing the receipt does not erase the thrown completion.
- An interceptor error thrown after successful preparation still fails the enclosing selected dispatch before unit installation. The receipt remains available after consume until close/fail; consume must not perform final dispatch closure.

Do not introduce a new public error type, error swallowing rule or poisoned-duplicate policy. Existing guard errors for already-forwarded/closed callbacks remain refusals; whether an interceptor catches its own attempted duplicate is not newly defined by this cleanup. Preserve existing structured rollback failure classification and stored-first-failure priority when the chain returns normally. If an interceptor catches one error and deliberately throws a different error out of the dispatch, preserve the existing direct throw propagation; this cleanup must not invent a global first-error-wins rule. Throw undefined is still failure: the boolean distinguishes it from no failure.

The row-shaped direct path in tree-realization-adapter.ts1853–1869 has no interceptor-created forwarding edges but still owns an open/consume/finally-close lifecycle. Adapt it to the same constructor/outcome discipline without adding a second interceptor pass. Error handling and endpoint checks remain intact.

## Consumption, chains and reentry

Consumption stays at the terminal projection writer before observer-before-read, as in location-runtime.ts203/native-location-realization.ts194. It clears the request on the invocation but returns that request into the active call; the writer must be allowed to validate/stage it. An open invocation is not globally consumed merely because an outer wrapper forwards: each downstream wrapper still needs to see an open request until terminal consumption.

A chain of two interceptors has two per-invocation edge records. Forwarding outer clears only its edge before entering inner. Inner forwards once, terminal consumes, then returns; the enclosing dispatch closes all records. If inner saves and does not forward, the open-phase check refuses unprepared dispatch and finally closes both edges. If inner throws, all saved outer/inner callbacks lose their downstream references. If outer reenters its own saved callback while downstream is running, its edge is already empty and refuses before another preparation; no receiver-dependent guard is needed.

Nested ordinary writes retain normal public semantics. A genuinely separate selected invocation gets its own edge inventory/receipt. Closing/failing the outer invocation must not clear the inner one's records or reverse its committed independent write. Existing source revision/lifetime validation still decides whether the outer selected unit can install. Do not use global current invocation state to associate edges.

Synchronous coalesce(proceed) inside a selected interceptor remains valid if it forwards before the enclosing invocation returns. A truly deferred proceed remains invalid after that return. Keep ordinary public replacement/updater proceed semantics and actual batching queue/scope rules unchanged.

## Unit obligations are a different owner

prepareSelectedOperation at tree-realization-adapter.ts714–748 owns staged edits, selected endpoints, entity plans, scalar preparation and delayed deliveries. A terminal writer may successfully stage an edit and return while the enclosing complete unit still needs those references. Clearing forwarding edges/request is not cancellation of the builder. Neither closeSelected nor failSelected should directly empty an unrelated unit's plans or invoke its delivery.

The builder retains admitted facts only until its real install/delivery or abort boundary. If a later interceptor throws, the enclosing dispatch propagates refusal and existing prepareSelectedOperation abort cleanup drops the unit's temporary references; no partial install is inferred from consumption. If installation completed and a delivery throws, the operation remains terminal and delivery-finally cleanup still runs. This proposal does not change completion accounting, ordinary/physical pairing, authored scope, requirement lifetime or source admission.

Active call-stack locals and the operation builder may retain receivers during execution. That is not a failed closed-callback cleanup; sampling must occur after dispatch unwinds and required unit work settles. User-retained operation.value or row/receiver references are distinct explicit owners. Never mutate a user's value to force collection, erase transaction history still required by source semantics, or claim collection while the user holds that receiver.

## Finite falsifiers for the successor

All below are proposed, NOT RUN. Reuse exact existing controls rather than rewriting their assertions.

1. **Unchanged behavioral controls:** existing23 plus own-undefined controls, structured reentry ports and actual batching coverage. Closed callbacks still refuse; equal/absent support and complete installation unchanged.
2. **Two-edge saved chain:** save outer and inner selected callbacks, forward synchronously, complete rollback, detach/destroy. Both later calls refuse. Repeat inner skip and inner throw: neither selected value installs; fresh retry after detachment succeeds. Inner skip is especially important because an unforwarded edge still holds next until close.
3. **Caught inner failure:** inner callback throws a sentinel (also a receiver-bearing Error in the retention variant), outer interceptor catches it and returns. Dispatch must still fail with that original cause, no selected install, pending authority usable. The saved callback must not retain the failure through invocation/outcome after unwind. Also throw-before-proceed and throw-after-proceed; preserve the stored first failure when the chain returns, and existing direct throw propagation when it throws out.
4. **Reentrant same callback:** attempt outer saved proceed while its downstream is executing. It refuses before another preparation callback. Independent nested public write survives any outer stale-preparation refusal. No new assertion about caught duplicate deciding whole-unit fate.
5. **Matched GC discriminator:** use the preserved Nx probe with the same positive/negative sentinels, explicit-row arm and drop/release followup. On a successor that clears the measured next path, holding callback-only should no longer create the c47b held-vs-drop receiver retention difference after full unwind/destroy/detachment. Test both success and at least unforwarded-skip/caught-failure paths; record each actual target, not a wrapper. If a residual path remains, report it without broad heap inference. Keep c47b as the positive retention baseline.
6. **Explicit ownership control:** hold only operation.value (using a distinct object-valued inverse payload) versus callback-only; while value is held it may remain reachable. Releasing it should be sampled separately. Holding a row must continue to keep that row alive; callback cleanup must not break the live receiver or detach ordinary writers as a shortcut.

Run through an isolated Nx target with NODE_OPTIONS=--expose-gc as in the preserved probe. The standard kernel config override produces duplicate Vitest config flags; keep the existing failure as history and reuse the authorized ephemeral-target approach. No arbitrary size/time benchmark or native-framework matrix is necessary for this question.

## Claim permitted before/after verification

Before runtime proof: source proposal removes the identified persistent forwarding reference while preserving dispatch error accounting and unit ownership. No heap guarantee.

After exact-source review and successful matched discriminator: name the objects collected in that runtime/workload and the held/drop controls. Do not call it universal graph release, zero retained bytes, a native-framework guarantee or proof that user-held payloads cannot retain receivers. The narrower no-stale-installation contract remains independently testable.

No runtime changes or tests performed in this review. The only write is this proposal and its source-identity record in the independent temporary directory.
