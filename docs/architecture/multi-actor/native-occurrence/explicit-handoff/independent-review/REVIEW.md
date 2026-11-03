# Independent explicit-handoff implementation review

One concrete blocker remains: selected interceptor continuations are reusable and survive their originating inverse invocation, including failure. Explicit transport fixes the preserved getter-reentry counterexample, but does not yet preserve the requested single-use/closed-scope semantics. This is a source-proof review, not full native integration or release qualification.

## Exact identity

Frozen source: `/private/tmp/st-native-explicit-handoff-successor/candidate`.
Independent copy: `/private/tmp/st-explicit-independent-gj4nkv4m/candidate`.

- Source manifest SHA-256: `057c6b8f4933eca5dbb3c0c31c069612264998b66e71c9e49ddd1a933edddad3`.
- Runtime patch SHA-256: `1c4d49a827a88dbf20ef206bbdd40d664ff2d28e7e6ab4c450c25ba54b6dce2d`.
- All source-manifest entries verified against frozen candidate before copying and after review. `FREEZE.json` and `SOURCE-SHA256.json` are preserved beside this report.
- Main's `main-invocation-scope.spec.ts` is byte-identical to the root archived fixture. The predecessor and frozen successor were not edited. Only an independent spec was added to the disposable copy; runtime files were unchanged.

## Finding: closed or already-used continuation can reinstall old inverse authority

Location: `packages/kernel/src/lib/internals/location-runtime.ts:140–141`, with entry at `:91–94` and terminal projection writer at `:181–199`. Native projections share the same interception wrapper and similarly forward their explicit selection without a use/closure guard in `native-location-realization.ts:176–195`.

`wrappedSelected` hands an interceptor `() => previousSelected(value, selection)`. The closure permanently retains the selected endpoint; neither this continuation nor the root selected dispatch records consumption or closes on return/throw. Public nested writes no longer inherit selection, but invoking this retained continuation directly reuses it.

Executed independent falsifiers in `candidate/packages/kernel/src/lib/independent-explicit-continuation.spec.ts`:

1. Successful rollback: intercept and save proceed; proceed once; rollback completes; detach interceptor; write x=13; call the saved proceed. Actual: x=0, original baseline certificate restored, no error. Expected: later value/evidence unchanged by the closed continuation.
2. Failed attempt and legitimate retry: save proceed and throw from the interceptor; rollback refuses with x=7. Detach interceptor, retry the pending rollback successfully, then write x=13. Calling the first failed attempt's saved proceed again yields x=0 and baseline certificate, without error. The legitimate retry itself works; failed-attempt authority remains replayable afterward.
3. Same-invocation reuse: interceptor calls proceed once, writes x=19 through ordinary updateOne, then calls the same proceed again. Actual: x=0 and old baseline certificate restored. Expected: the already-used selected continuation cannot reinstall it.

These tests enter selection through actual public transaction rollback, not a fabricated endpoint passed to the private dispatch. Instrumentation uses the private registered location interceptor and source evidence. This demonstrates an internal handoff contract failure, not a claimed public security exploit or outgoing Link leak.

Correction direction: bind a consumed/closed state to the particular selected invocation and forward it explicitly through the existing interceptor chain. Consumption must happen before the selected kernel body can trigger getter reentry, and return/throw must close any unconsumed continuation. A new rollback retry receives its own invocation. Do not enforce this by changing ordinary public setters or by skipping interception. Do not consume once per wrapper layer: one selected operation can traverse multiple legitimate interceptor continuations.

Deferred-scope qualification: the author's `coalesce(proceed)` control passes because its queue drains synchronously within that invocation. Preserve that case. A continuation retained beyond the authorized scope must not silently install later. This review does not establish every coalescing/rollback composition or prescribe a new batching policy. The captured-closure failure is sufficient to reject the current single-use/closed-scope claim.

## Requirements that survived this bounded review

- The original getter-reentry counterexample and two lifetime/equality controls pass unchanged.
- The author’s registered-interceptor reentry, coalesced continuation, and fake-native before/write/after/observer ordering tests pass.
- The original four native-admission controls pass. The six invocation controls also pass, but one of those exercises only obsolete helpers and is not active-path evidence.
- Source inspection confirms public updateOne/replaceOne and row callables discard extra payload arguments; portable/native public replacement wrappers pass no selection. The selected path forwards only through the private writer and shared mutation bodies.
- Collection onUpdate, transforms, path notification, taps, absence replacement and post-equality active-lifetime validation remain in the common implementation. The preserved absence/undefined, interceptor throw and lifetime controls pass.
- No new selection export appears in package root, adapter or internals barrels; the package export map has no internal-source wildcard. ObservationAdapter/public carrier interfaces are unchanged by this patch. This is source inspection, not a fresh packed-declaration audit.

## Obsolete ambient helpers

No true public-test or public-contract blocker to removal was found. In package source, `withFieldEndpointInvocation` and `claimFieldEndpointInvocation` have no runtime callers. Their only test caller is `native-invocation-handoff.spec.ts:16–21`, the white-box test of the old helper itself. Neither helper is in the public barrels or API baseline.

After preserving this exact candidate, remove their runtime definitions, INVOCATION/token metadata machinery and now-unused write-context/type imports. Retain `ClaimedFieldEndpoint`, endpoint pairing and composition facilities still used by the new mechanism. Archive the old helper fixture unchanged, then replace its active-helper-specific test with actual new-path controls for wrong source/lifetime, single consumption, closure after throw and legitimate retry. Do not remove the other useful absence, collection-interceptor reentry, throw-cleanup or pair-composition assertions. Main's getter/lifetime/equality fixture should remain unchanged.

The old helper's one-claim/closed-after-throw pass must not be counted as correctness of the new continuation. This review directly demonstrates that the analogous new-path property currently fails.

## Commands, first failures, limits

Node 24.15.0; pinned bin first in PATH; `NX_DAEMON=false NX_ISOLATE_PLUGINS=false`; working directory the independent candidate.

```sh
corepack pnpm nx test kernel --skip-nx-cache main-invocation-scope.spec.ts native-explicit-handoff.spec.ts independent-explicit-continuation.spec.ts
corepack pnpm nx test kernel --skip-nx-cache main-invocation-scope.spec.ts native-explicit-handoff.spec.ts independent-explicit-continuation.spec.ts native-admission-handoff.spec.ts native-invocation-handoff.spec.ts
```

First run: exit 1, six pass/three fail. Two failures directly demonstrated reuse. The throw/retry test initially expected the raw interceptor error but received the existing SignalTreeRollbackError wrapper. Original spec and log are preserved as `independent-first.spec.ts` and `first-runtime.log`. Only that expectation was corrected to require the propagated refusal message; value/evidence assertions were unchanged.

Second run: exit 1, sixteen pass/three fail, all three failures demonstrate replayed selected authority. Raw traces and assertions are in `replay.log`. Existing unrelated historical tsconfig resolution warnings remain in the first log.

Not run: author's full 66-test selection, source/spec type gates, full facade integration, packed consumers, structural/plain-member endpoint qualification or release gates. Author-reported passes are not represented as independent runs. No tests were weakened to make this candidate pass; the new failure remains unresolved and frozen for the author.
