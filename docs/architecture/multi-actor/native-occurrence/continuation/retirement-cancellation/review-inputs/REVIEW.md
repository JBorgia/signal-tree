# Independent fixed-window retirement review

**Do not accept unchanged:** exact-cell cancellation can remove a newer subscription set and strand a real source retirement. No author edits. Original111 tests replay111/111; added10 controls:8 pass/2 fail. Source types and spec-type ratchet pass. Raw source/patch, originals and logs were inspected before author conclusions; RESULTS.md was not used as review authority.

## Concrete blocker: stale cancellation deletes a newer index entry

`candidate/packages/kernel/src/lib/experimental-publication/lifecycle.ts:40–43`: cancellation closes over its original Set, deletes its own observer, then unconditionally deletes the cell's WeakMap entry when that old Set is empty. Sequence: register A; cancel A (removing its set); register B for the same still-pending native cell (creating a new set); cancel A again. The second cancellation deletes B's map entry. Confirmation does not find B, so its callback never runs.

Executed controls in fixed-window-independent.spec.ts, raw independent-first.log and independent-complete.log:

1. Exact cell obtained from a real transaction: newer callback count remains0 instead of1 after confirmation.
2. Real source retirement: cancel an old independent listener, remove an entity so retirement subscribes to that same cell, cancel old listener again, confirm. Negative presence remains1 instead of0. Its retirement request has lost the event needed to recheck. This is a source retention/liveness defect, not premature publication or invented settlement.

This uses the private cancellation interface, not a demonstrated ordinary-public-call sequence which double-cancels. The current scheduler's normal release handling usually clears its stored function after cancellation. Nevertheless the new private interface silently corrupts another subscription when an already-released handle is reused; joint consumers must not rely on that behavior. The fix is local: make release idempotent and delete the index entry only when it still points to this observer's Set. No new authority/index or publication policy is needed. No runtime repair was made in this review.

## Bounded source findings

Installed-forget authority: entity-signal.ts:1460–1492 requests retirement only after the frame installed, after attempting all completion/membership callbacks, for exact `retire-retained-value` mutations with forgetLifetime. Its eligibility closure checks exact subject absence and ordinary-topology nonretention. The no-owner path3690–3725 first respects restoration authority and stages an authorized forget. This is an internal trusted call path, not a security/authentication API. The three-file patch does not add a new inference that absence alone means forgotten.

Provenance: `prepareNativeRequirement` records retirementOwnWindowOnly before inputs/frames/known arrays can be cleared. It requires raw unknown=false, zero known owners, zero supplied inputs and zero active frames. Entity retirement recursively checks every composite constituent, refuses invalid/unavailable/rejected-role flags and every actual owners/D/I/V array, and accepts non-neutral uncertainty only with that provenance bit and historicalWindow. Only confirmed/rolled-back W cells discharge; abandoned and disappeared pending cells retain evidence. This is stricter than generic all-terminal cleanup; confirmed actual roles also remain outside the added release class. No proof/receipt is rewritten to declared or neutral by deletion.

Queue/index: subscriptions target exact existing cells; availability requires identity equality in the registered owner source, not merely matching ids/outcomes. Settlement/disappearance callbacks queue, coalesce and honor cancellation of already queued callbacks. The retirement scheduler rechecks installed-forget eligibility, source revision and exact eight-map snapshots before deletion. Source readiness and owner transition readiness remain separate. No new full source/tree scan or observer-count bypass appears. The cancellation defect above is the concrete exception to the index-lifetime claim.

Recovery/issued evidence: actual local recovery remains gated by the existing kernel lifetime mechanism. Original local rollback/lifetime tests pass. New confirmed input/validation controls remain retained and keep exact requirement objects after terminality. Late enrollment while two captured owners are pending waits for both, excludes a later unrelated owner, and produces one useful surviving delivery. Held started receipt object and issued historical proof survive source destroy unchanged. Source disposal cancels pending requests; it does not promise clearing all maps reachable through an externally held private source object. The new destroy probe confirms no delayed retire call and no rewriting of issued proof. Unavailable pending owners remain unresolved, not fabricated as settled.

## Executed evidence

- Original selected12 files:111/111 pass, original-replay.log. The three files under author's originals/ are byte-identical to candidate tests; original baseline-first.log preserves2 terminal-drain failures. Those exact tests now pass.
- Added10:8 pass/2 fail, independent-complete.log. Earlier7-case first red and8-case expanded red preserved. Passing cases: two confirm/rollback variants of late enrollment/two-owner handling; disappeared pending owner/new reader; explicit native abandoned transition; queued callback reentry creating a new lifetime at the same key; destroy after notification queueing; confirmed actual I and V retention.
- The abandoned-outcome test calls the existing private native transition function with a real cell; it is not presented as a public handle API.
- Source types pass; spec-type ratchet passes including final added tests, three inherited improvements only. No baseline edits.
- Author naive-negative-frozen.log was inspected: expected early-send failure includes delivered `{id:'b',n:2}` instead of empty sends. That mutation was NOT independently rebuilt/replayed; original pending-obligation controls were replayed unchanged.

Exact source manifest SHA25605daee5c1db9478e3cdad0bbda8216bbc7f6fd10305622d3c3f2cf895a2bd022; runtime patch SHA2560c54641f0e4b1ace74d08f9a8bea5faa322cf94db680f5e3382d6a017a35550b. See VERIFICATION.json for full source/freeze preservation. One author test's diagnostic output path was redirected in the disposable copy to avoid writing author files; no assertions changed. No cost/heap/combined-phase acceptance inferred. Main retains integration authority.
