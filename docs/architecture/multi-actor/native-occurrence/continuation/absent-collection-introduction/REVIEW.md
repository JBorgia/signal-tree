# First absent-collection failure: introduction and shared cause

**Confirmed regression introduced by the parent-currentness proof, present in C10. Exact C8a passes the unchanged first ordinary re-add test.** The shared EntityMap snapshot wrapper keeps an absence-era cache after presence changes; direct collection reads are already correct. No runtime repair was made.

## Contract and bounded replay

The unchanged `packages/kernel/src/lib/absent-collection.spec.ts:24–29` states that held consumers follow omission and re-add, and a row-adding write re-adds the path carrying only written rows. The first reported failure is `a held consumer sees the re-adding write` at lines 269–280. It uses a reactive kernel realization, no restoration or transaction enhancer, and position/causal capabilities. It omits `a`, reads the held whole and collection consumers, then adds Z through the retained collection.

| Immutable source | Manifest | Unchanged selected test |
| --- | --- | --- |
| Exact C8a | `/private/tmp/st-native-combined-c8a/SNAPSHOT-C8a.json` | PASS: 1 passed, 91 filtered |
| Parent proof on C8 | `/private/tmp/st-parent-freshness-resumed/c8-proof/SNAPSHOT-PROOF.json` | FAIL at line 277: whole snapshot `all: []`, direct held collection `[Z]` |
| C10 promoted | `/private/tmp/st-native-combined-c10-promoted/SNAPSHOT.json` | Same FAIL at line 277 |

All manifest-listed source files were hash-verified before copying to this directory. The original absent-collection test is byte-identical across C7a, C8a, parent proof and C10 (`TEST-IDENTITY.json`). C8a versus C8 changes only three existing test expectations; the relevant runtime comparison against the C8-based parent proof is therefore valid. Review diffs are preserved here. Repository HEAD inspected: `628d302dadb082a48c58528651c9088234d0a777`; its dirty work was not used or edited. These runs use the manifest snapshots, not that HEAD.

Command in each `probe-*/runs/first-absent/COMMAND.json`:

```
corepack pnpm nx test kernel --skip-nx-cache absent-collection.spec.ts '--testNamePattern=a held consumer sees the re-adding write' --maxWorkers=1
```

Node 24.15.0, pnpm 10.17.0. Nx cache/data/temp and dependency command shims are private to these probe directories; package dependencies are read through links to the previously working dependency tree. Raw first logs preserve Nx's nonfatal historical tsconfig-extends warning and the actual test results. No expectation was weakened.

## Causal sequence, supported by source and executable cache trace

Paths/lines below reference the exact parent-proof copy, under `packages/kernel/src/lib/`.

1. `entity-signal.ts:436–443` adds `advanceInstalledRead()` to R4's existing installed revision: it also calls `markSnapshotInstalled(snapshotIdentity)`. During re-add, retained-row clear and Z insertion each advance the collection wrapper generation. Trace: generation 0 → 1 → 2, both from physical frame installs (`entity-signal.ts:1592`). The collection is still semantically absent at these points.
2. `internals/member-membership.ts:959–965` prepares ordinary membership evidence **before** flipping presence. It calls `ordinaryMemberSnapshot(child)`. The captured stack is `ordinaryMemberSnapshot` → `unwrapBranchForWriteCapture` → `unwrap` → `buildFromStore` → `snapshotMarkerNode` → `materializeSnapshotNode`.
3. `internals/materialize-markers.ts:258–274` memoizes the EntityMap processor's wrapper through the same materialized snapshot machinery. In `internals/snapshot-authority.ts:113–124`, the old observation is cached but the source generation has advanced, so the current-read fallback builds and installs **generation 2, `{value:{all:[]}}`, `pendingObservation:true`**. Empty is a valid public collection read while its ancestor remains absent; it ceases to be valid after reactivation.
4. Presence installs, but the new invalidation walk at `internals/member-membership.ts:999–1011` calls `markSnapshotInstalled(parent)` and recursively visits only `isNodeAccessor` descendants. The EntityMap marker is not a node accessor. It therefore fails to advance the collection wrapper's generation for this semantic presence change. Ancestor invalidation does not invalidate descendants: `snapshot-installation.ts:33–39` walks upward only.
5. Existing membership wake-up (`entity-signal.ts:5316–5321`) advances collection observation version. The snapshot observer runs its builder, but `snapshot-authority.ts:93–96` reuses the generation-2 early cache because `pendingObservation` is true. The cache flag becomes false while its empty value survives. Parent/root snapshots then include that stale marker wrapper.

The diagnostic instruments only the existing materialized record's generation/cache properties in a **test**, preserving their stored values. It makes no runtime source edits and does not increment generations or substitute results. Its raw assignment stack identifies the pre-presence ordinary capture as the cache writer; the trace records **no third collection-generation advance** for reactivation. A separate diagnostic without property instrumentation gives the same failure.

Observed after re-add, before additional user demand:

- Root cache: `{a:{rows:{all:[]}},count:0}`.
- EntityMap wrapper: generation 2, cache generation 2, `{value:{all:[]}}`, `pendingObservation:false`.
- Held `all()` and subsequent direct `rows.all()`: `[{id:'z',n:9}]`.
- Subsequent direct `tree.$()` remains stale too. This is not merely an app-created computed retaining its earlier result.

The failing cache is the **materialized marker wrapper**, not physical row storage or R4's direct `all` output. The missing semantic dependency is effective collection presence. The new early-cache reuse makes the omitted invalidation persistent; C8a's old ordinary observer rebuild does not preserve this early empty wrapper and the same test passes.

## Shared boundary and repair constraints for Main

Main's React raw log was inspected read-only: `/private/tmp/st-c10-promoted-framework-verification/runs/react/first.log:91–106` shows the same root `all:[]` beside direct `[Z]` and count 1. That supports the shared kernel diagnosis; React was not rerun here. No React-specific fix is indicated.

A repair needs to represent effective presence changes in the **same source-current invalidation mechanism** used by the affected cached EntityMap wrapper, including inherited absence and direct collection omission. An accessor-only descendant walk is incomplete for materialized marker snapshots. It must also keep projection currentness coherent at pre-notification reads: advancing a wrapper generation alone is not proof that every underlying presence-sensitive projection is already current. This review does not select or test an implementation.

Do not disable identity reuse globally, force native publication early, bypass ordinary capture, or repair callers. Preserve source-current callback reads, app-created native computed timing, and true no-op identities. The unchanged first test plus held wrapper/parent reads during presence installation, direct omission, restoration/rollback, and existing no-op/native timing controls are relevant successor falsifiers. None is claimed passed for an unimplemented repair.

## Run/not-run limits

Ran: exact first ordinary failure on C8a, parent proof and C10; parent diagnostic of cache state; parent diagnostic recording exact cache-assignment/generation stacks. Original replay asserts useful behavior and fails without diagnostic instrumentation. Raw failures are retained.

Not run: broad kernel suite, React suite, jump-undo-equivalence, other 25 absent-collection failures, or any proposed repair. No final totals inferred from the ongoing kernel log, and no claim that this one causal explanation covers every reported failure. C7a was source-compared/copied but not executed; C8a passing already isolates the requested introduction boundary. No runtime edits, owner-authority changes or release acceptance.
