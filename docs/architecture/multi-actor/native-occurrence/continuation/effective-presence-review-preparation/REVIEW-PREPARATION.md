# Effective-presence successor: independent test preparation

Preparation only. No successor runtime inspected, executed or modified. Await its immutable manifest before runtime review. Exact C11 oracle is `/private/tmp/st-native-combined-c11/SNAPSHOT-ORACLE.json`; its disposition says runtime is unchanged from C10 and only the whole-value-new-keys callback expectation changes. Earlier executable attribution remains `/private/tmp/st-absent-collection-introduction/REVIEW.md`. No broad run totals are assumed.

## Existing controls: what they actually establish

- `absent-collection.spec.ts:269–280` is the indispensable unchanged red: asserts actual held whole-tree and collection output after omission and re-add. The collection-only-root case around 1220 also prevents success dependent on a scalar sibling. Both reach the real re-add path. Restoration/rollback cases must assert before reversal as well as afterward so an earlier stale snapshot cannot be hidden.
- `absent-collection.spec.ts:1275+` proves hidden-row compensation actually occurs: rollback restores stored rows while the held absent collection stays empty and its consumer execution count stays unchanged. Good nonvacuous notification control. It does not prove direct-read reference identity or nested double-absence behavior.
- `parent-freshness-entity.spec.ts` positively asserts exactly one completion, fresh early root, old held derived inside the group, early/post-delivery identity, and a subsequent write changing the held result. Strong dependency/timing test, but it never changes presence and has no cold wrapper / warm projection arm.
- `marker-snapshot-memo.spec.ts` pairs identity checks with actual collection updates, so the file cannot pass merely by keeping every cache forever. It does not cover absence. Its existing fixtures lack tree teardown; new bounded fixtures should use `finally` destruction rather than copying that omission.
- `opaque-terminal-snapshot.spec.ts:68–87` really retains a cyclic payload by identity, but only during root snapshot/restore. It never exercises a presence-invalidation traversal. Terminal opacity is not proof that a materialized marker boundary is opaque.
- The preserved C7a `baseline-reentry/RESULTS.md` is characterization, not current acceptance. Cold Angular mutation callbacks often stop at NG0600 before the intended action; caught nested-cycle errors do not prove nested success. Custom marker snapshots there are volatile, not evidence for the cached EntityMap wrapper. Do not transplant those counts or label their passing harness as C11 runtime correctness.
- `ordinary-presence-discriminator.spec.ts` getter reentry concerns publication declaration validation. Its useful send/owner assertions do not exercise the changed projection-cache discriminator.

## Three additional bounded discriminators

### 1. Presence completion, independently warm projection and wrapper

Use the existing supported membership publication registration seam, filtered to the actual reactivated member. Do not use EntityMap row completion as a substitute: that can run while the ancestor is still absent.

Retain `rows.all` before omission. Warm its empty result while absent. Two arms: already-demanded marker wrapper, and wrapper genuinely not yet demanded. At the post-install/pre-notification membership completion, assert **callback count exactly one**, effective presence now true, the parent descriptor present, direct `all` contains Z, and root contains the same rows. The native/app-derived observation must have been warmed and must still hold its old value inside the controlled notification group. After release require it to update, require stable early wrapper identity, and make one further row change to prove observation dependencies survive.

Test direct collection omission and ancestor omission using the existing fixture shapes. For the cold arm, avoid root snapshots or ordinary capture during setup accidentally warming the wrapper. An internal read-only `MATERIALIZED.has(existingIdentity)` assertion immediately before the transition may certify coldness; if capture has already warmed it, classify the arm accurately instead of claiming cold coverage. No private source-method replacement.

This is the highest-priority discriminator: it fails a wrapper-only fix whose underlying projection still reuses its pre-presence empty array, and a projection-only fix whose wrapper retains the old generation.

### 2. Two omitted edges; an outer re-add leaves the collection effectively absent

Shape: `outer: {inner: {rows: entityMap()}, keep: 0}, other: 0`. Seed a row; omit `inner` from `outer`; then omit `outer` from root. Warm and retain the absent `rows.all()` result. Reactivate only `outer.keep` through its held leaf. Assert the outer edge actually became present, the inner edge is still omitted, held rows still read empty, and the previously stable absent projection remains identical. If testing wrapper identity directly, use the existing marker snapshot helper and classify that as internal cache evidence, not an extra public API.

Then perform a real row-adding write through retained rows and assert the final root includes only that newly written row. This positive tail ensures the test cannot pass through a broken reader that always returns empty. It also distinguishes an effective-presence change from a merely local descriptor change. Compare exact C11 first if any expectation is disputed; do not silently redefine an inherited baseline limitation.

### 3. Opaque marker boundary reached by the changed walk

Place a materialized marker beside the EntityMap under the ancestor that is omitted/re-added. Its payload contains a self-cycle and a property getter with a call counter/unique sentinel, armed only after construction/admission. Use an existing supported custom-marker construction seam; keep its legitimate snapshot callback independent of that payload. Assert actual ancestor transition and successful EntityMap re-add, payload identity/self-reference intact, and zero trap-property reads during the transition. A benign callback count alone is insufficient: the ancestor must actually pass through the changed invalidation path.

A `leaf(cyclicPayload)` sibling is a useful terminal control, but cannot substitute for the materialized marker boundary. A volatile custom marker can test traversal opacity but cannot qualify cached-wrapper identity. Do not assert zero normal marker snapshot invocations: ordinary capture or parent rebuilding can legitimately call its snapshot. Avoid JSON-serializing the trap payload or placing its getter in a row field that normal admission is expected to read. If a private property is added to a live marker solely as a trap, retain that as diagnostic instrumentation, not a new supported public mutation contract.

## Reentry check: one bounded action, not a universal audit

If the new projection cache commit reads absence after a comparer/predicate, inspect whether it can bless the earlier result with the later absence discriminator. The focused counterexample is a warmed present collection whose one-shot query callback omits its ancestor during computation. Arm once **before** mutation, record callback entry, successful descriptor change, first result/error and next explicit read. Do not recursively read the same query. Require the next source-current read to reflect absence without an automatic callback retry; preserve exact thrown sentinel when the callback throws. Count actions separately from sorter comparisons.

Run the identical bounded script on C11 first after the immutable successor arrives. If native admission blocks the action (e.g. NG0600), assert and report the blocked stage; it is not successful reentry coverage. Do not expand this into fixing existing sort self-reentry/cycle behavior. The mechanism can also be checked statically for capturing the absence discriminator before compute and avoiding post-callback relabeling.

## Review handoff

On freeze: verify manifest/diff; confirm changes stay at shared presence invalidation and projection cache; run the original red plus the focused discriminators that the actual diff needs. Preserve baseline first failures and exact callback/error observations. Check source/spec types through the existing gates after implementation. No successor acceptance, CPU claim, runtime edit, or full suite is part of this preparation.
