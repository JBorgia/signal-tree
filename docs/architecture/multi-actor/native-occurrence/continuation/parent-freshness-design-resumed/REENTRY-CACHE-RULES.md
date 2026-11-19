# Reentry, errors and dependency refresh: finite cache rules

Design supplement only. No implementation, tests or new product semantics. Main has reviewed DESIGN/HOOKS; independent premise review is pending. Exact input remains C7a manifest `d911ae7768e8e1a43eceb99ef5277988a6ff9e59c910337bb1e6b79db4d1b71d`. All existing packets and predecessors remain unchanged.

## Scope of the rules

These rules decide whether an attempted computation may publish a private snapshot cache entry. They do not decide a new user-visible result for a callback that mutates the tree while its own snapshot is being built. Such cases first need paired C7a characterization. Do not add retries, swallow exceptions, return an old value on error, or introduce a new cycle/reentry exception to make this design work.

Ordinary completion reads happen AFTER the enclosing physical installation; they are distinct from a marker/comparer that mutates DURING materialization. The approved completion freshness requirement is not evidence for atomic snapshot semantics across arbitrary user callbacks.

## State model

Per existing MATERIALIZED record:

- `g`: installed generation, monotonically advanced by a relevant installed source change; never advanced by reads, retries, preparation, cancellation or delivery alone.
- `cache`: absent or `{generation, value}` from a successful generation-stable build. Clean means `cache.generation === g`; an older cache may be retained but is not a valid fresh result.
- `attempt`: a local identity and captured `startG` for an active build/touch. This is a stack-scoped attempt, not a second dependency graph. Entry must not erase an older successful cache. An in-progress record must already be addressable so a first-build source hook cannot miss it.
- `trackedG`: diagnostic/proposed bookkeeping of the last generation with a successful stable observe pass. This is NOT permission to skip dependency reads when observe actually recomputes. Native/neutral dependencies and their delivered value/error remain owned by the existing runtime.

Finite states: EMPTY (no cache), DIRTY (older cache), CLEAN (current cache), BUILDING (attempt over one of those states), TOUCHING (observe pass over a clean cache). Runtime observer state is deliberately orthogonal. A CLEAN value cache can coexist with an observer still holding the previous delivered value or a runtime-cached error.

## Transition rules

| Event | Private cache transition | Observable boundary |
| --- | --- | --- |
| Relevant source unit installs | Increment `g`; preserve cache. Any active attempt with older startG is ineligible to commit. | No token delivery, user callback or output computation from this bookkeeping. |
| Preparation aborts / equal physical no-op | No change. | Preserve prior notification/no-op behavior; membership reactivation is separately a read-visible change. |
| Build starts from EMPTY/DIRTY | Capture startG and attempt identity; keep prior cache until success. | One attempt for this invocation; no retry loop. |
| Build, including freeze/finalization, succeeds with `g === startG` | Publish `{startG, result}` only if this attempt still owns its commit opportunity. | Existing freeze behavior retained. If a nested successful attempt already published at the same generation, reuse that winner instead of replacing its identity. |
| Build throws | Publish nothing from this attempt; unwind its active state in finally. Keep any separately successful nested cache. | Propagate the same thrown value; never substitute the old cache. No eager retry. Runtime error retention/retry behavior is not replaced. |
| Build returns but `g !== startG` | Discard result FOR CACHE PUBLICATION. Keep any valid newer cache installed by a nested attempt; otherwise remain EMPTY/DIRTY. Never stamp result with the ending generation. | The current invocation's return/error must be characterized against C7a. This rule alone does not authorize returning a torn result, a newer nested value or a new error. No automatic replay of user callbacks. |
| Nested read of another node completes | Its cache can commit independently under the same rules. | Outer throw must not roll back the nested write or wipe its valid cache. Parent stays dirty if its own generation changed. |
| Nested read of the SAME active node | Never expose a partial in-progress output or replace the stable observe object. | Existing cycle/reentry behavior is a characterization gate. No newly invented fallback value or guard exception. If safe behavior cannot be preserved locally, this case remains unresolved. |
| Observe recomputes while value cache is CLEAN | Capture startG; run dependency-touch under the actual runtime collector; return the same cached object only after successful stable completion. | Do not return early merely because value is clean. Runtime retains old delivered value until this recomputation succeeds. |
| Touch throws | Do not advance trackedG; do not destroy a still-current value cache. Clear active attempt in finally. | Propagate exact error through runtime; no partial success. Subsequent retry timing follows runtime and must be tested. A good value cache does not justify bypassing an observer error. |
| Touch installs a change / generation advances | Do not certify trackedG or the old cache as current. A newer nested cache is not proof this pass tracked its dependencies. | No retry or forced native invalidation. Returning successfully can let the runtime mark itself clean: this is an explicit unresolved acceptance gate, not solved by the generation comparison. |
| Observe recomputes while EMPTY/DIRTY | Use one tracked build attempt and the same commit rules. | Do not touch then blindly build a second time. Normal stable success supplies both output and dependencies. |

Attempt cleanup must release only its own stack entry. An outer finally must not reset a newer generation, overwrite a nested cache, erase the original exception, or clear a pending delivery. Generation counters must not be reused/reset while a record survives (avoids an old attempt appearing current).

## What dependency-touch must actually do

Run under the existing observe computation, touching its membership carrier, included child observe handles, terminal reactive readers, and the existing dormant-member dependencies. C7a utils.ts:369–394 explicitly reads dormant children so reactivation can wake a parent; a touch pass limited to enumerable output members is incorrect. Include supported symbol children and marker dependencies. Do not memoize the touch operation itself.

For built-in EntityMap touch the existing collection dependency without invoking `computeAll` or its sort comparer merely to reconstruct a dependency. A clean ordinary dependency walk should not execute a custom snapshot callback as a substitute for a missing touch recipe. Custom volatile markers retain their existing behavior; this optimization cannot silently make them cached or callback-free. Count output builds, dependency touches and user callback invocations separately.

C7a location-runtime.ts:635–657 clears previous dependencies before compute, sets `dirty=false` on successful return, and records computation failure on throw. Therefore failed touch does NOT imply an intact old dependency set. Native-location-realization.ts:217–222 delegates to the native readonly cell; Angular observation-adapter.ts:88 delegates to computed. No source-only claim about Angular retry/error caching is made here. A private trackedG flag cannot override either runtime's state.

## Expected bounded controls (preregistered, not run)

Use neutral and actual Angular facades, real installed handles, teardown, and counters with positive calibration. Inject builder/touch failures through test-local instrumentation or existing supported callback seams; do not add a public test API. Preserve original sentinel identity with hard assertions. Do not use fake successful reads when a callback never ran.

| Control | Sequence | Required result / explicit characterization |
| --- | --- | --- |
| E1: cold build error | First demanded build throws sentinel after at least one source read; later make callback succeed and trigger the existing retry condition. | No partial cache; same sentinel escapes; later successful stable build is reusable. First assert exact C7a retry trigger for each runtime; do not demand an unsupported immediate Angular retry. |
| E2: warmed build error | Warm V0; install change; next attempted build throws; then recover through supported notification/read path. | V0 is not served as fresh success. Successful retry returns installed value, then repeated reads preserve identity. Runtime's previous delivered value/error is not manually advanced. |
| E3: mutate then throw | During build callback install one bounded change, then throw sentinel. | Write remains installed; outer attempt cannot become clean; exact sentinel propagates. A later stable read reflects the installed change. No implicit rollback or callback replay. |
| E4: mutate then return | Callback makes exactly one changed write mid-build, then returns normally. | Instrument start/end generations: straddling attempt never commits as clean. Record C7a returned value/error separately. Next explicit stable demand must not reuse that straddling result as current. Current-call semantics remain characterization, not an invented expected snapshot. |
| E5: nested winner | Outer build callback changes a child; nested supported child read succeeds; outer then returns/throws in separate cases. | Nested child's cache and installed write survive; outer never overwrites a newer generation. For same-node recursion, record actual C7a behavior first; no assumed successful recursion. |
| E6: unstable callback is finite | A test callback would change a generation on every invocation; make only one explicit top-level read, with a bounded tripwire that fails if internally replayed. | No repair retry loop or extra callback invocations introduced by freshness logic. Compare with baseline invocation behavior; don't allow test harness recursion to count as implementation retries. |
| D1: clean observe delivery | Warm external derived/computed at V0; grouped completion directly builds V1; normal delivery recomputes observe. | Direct repeated reads and post-delivery reads return identical V1; no second snapshot output allocation. External computed stays V0 inside callback and updates on normal delivery. Count touches independently. |
| D2: dependency retention | After D1, separately change an existing child, then a newly added child, each in its own delivery; include root→child→leaf depth. | Each real change reaches held neutral derived and Angular computed. Avoid coincident sibling writes that could mask a missing edge. Assert computation counters advance and values change. |
| D3: dormant/symbol dependencies | Omit and deliver, then reactivate by retained equal-value leaf write; separate supported symbol-child change. | Correct membership/value appears; neither relies on an unrelated invalidation. Touch pass preserves dormant reactivation and symbol ancestry. |
| D4: clean touch error | Arrange V1 current via direct read; force one demanded observe touch to throw sentinel; recover through runtime-supported trigger. | Cache identity V1 remains valid absent writes, but no successful observer delivery is fabricated. Error identity preserved; later source changes still reach observer. Characterize partial-dependency recovery on each runtime. |
| D5: generation changes during touch | Controlled test seam installs a bounded change while observe touches dependencies, without synthesizing an early native notification. | No clean certification of stale generation. Then demand directly AND separately trigger an ordinary source change observed only through held computed. Both must recover without a hidden retry/forced invalidation. Failure of runtime notification recovery blocks this mechanism for the case; a direct read alone is not a pass. |
| D6: no change / unrelated sibling | Repeat clean reads; force an actual clean observe recomputation via test seam; later change unrelated sibling. | Current output identities stable; demanded observe retains dependencies; no unnecessary output allocations or user snapshot/comparer calls. A runtime skipping compute entirely does not execute the clean-touch branch and cannot count as its coverage. |

D5 is intentionally adversarial instrumentation, not a claim the normal built-in touch path necessarily executes user code. Establish reachability separately. For clean built-ins, callback-free dependency recipes may eliminate that route; this must be shown from the actual calls, not assumed because the operation is named touch.

## Disposition

Finite cache publication rules are specified. Stable-build and stable-touch expectations follow the approved freshness, identity and notification constraints. Mid-build/mid-touch mutation return semantics and runtime recovery remain explicit characterization/proof gates. No runtime changes, additional graph, public API, forced invalidation, retry budget or new exception is authorized. Preserve first failures; a failure revealing a semantic choice goes to Main with the concrete trace, not a silent behavior change.
