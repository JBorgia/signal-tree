# `setAll` bulk-population regression — attributed

**Status:** PRIMARY MECHANISM DELETED. The measured residual is an accepted
known regression for v15, not a release blocker.

The remaining roughly 7–10x constant-factor gap from 14.0.0 is intentionally
not attributed before GA. Public behavior, asymptotic shape, bundle budgets,
memory/retention gates, and the release matrix are green. Further attribution
would reopen optional representation work without a correctness or release
falsifier. Preserve the measurement as an honest tradeoff and investigate it
only from a new deterministic budget or product requirement.

The entity layer no longer derives subject positions. `deriveSubjectPositions`
and `collectOwnedPositions` are gone, along with all nine call sites and the
dead parameter and record field they fed. See "Death certificate" below.
Reproduce the A/B with two isolated builds (see "How this was measured").

## The regression

Isolated builds of `888336d1` (14.0.0, the commit that produced the published
comparison tables) and HEAD, same benchmark source, same Node 24.3, same
machine, median of 7, postcondition `count() === n` on every sample:

| n      | 14.0.0    | HEAD       | ratio | 14.0.0 µs/entity | HEAD µs/entity |
| ------ | --------- | ---------- | ----: | ---------------- | -------------- |
| 100    | 0.147 ms  | 1.100 ms   |  7.5× | 1.47             | 11.00          |
| 1,000  | 0.233 ms  | 9.964 ms   | 42.8× | 0.23             | 9.96           |
| 10,000 | 2.193 ms  | 90.436 ms  | 41.2× | 0.22             | 9.04           |
| 50,000 | 12.699 ms | 528.467 ms | 41.6× | 0.25             | 10.57          |

**Both curves are linear.** Per-entity cost is flat across a 500× size range on
both sides — 14.0.0 at ~0.23 µs/entity, HEAD at ~9–10.5. This is not an
accidental quadratic. It is a ~41× increase in constant per-member work.

## Primary mechanism

Deliberately "primary" and not "the cause": removing the mechanism below
recovers ~80% of the delta and leaves ~8.5x unexplained (see "What remains").
The profile shares do not add up to 41x and are not claimed to.

CPU profile of `5 × setAll(10k)` at HEAD, self time:

| function                | self  | share |
| ----------------------- | ----- | ----- |
| `collectOwnedPositions` | 167ms | 28.9% |
| `createEntityNode`      | 95ms  | 16.4% |
| (garbage collector)     | 99ms  | 17.2% |
| `getOrCreateNode`       | 24ms  | 4.1%  |
| `setAll` itself         | 26ms  | 4.5%  |

`setAll` is building the rich per-row facade for every row. The path is
`setAll` → per entity → `deriveSubjectPositions(id, entity)`:

```ts
function deriveSubjectPositions(id, entity) {
  const positions = new Set();
  collectOwnedPositions(api, positions);                        // walks the whole collection API
  collectOwnedPositions(getOrCreateNode(id, entity), positions); // MATERIALIZES the node, then walks it
  ...
}
```

So each of the 10,000 entities pays for:

1. `getOrCreateNode` — construction of the full per-row node: one Angular
   `computed()` per field, `set`/`update`/`asReadonly` closures per field,
   property descriptors per field, plus metadata accessors;
2. a recursive `Object.keys` walk of that node, which invokes every field getter
   it just created;
3. a second recursive walk of the entire collection `api` object, per entity.

`collectOwnedPositions` does not exist in 14.0.0. It is v15 machinery.

**The nodes are then discarded.** The node cache is weak and nothing retains
them, which is why a plain `setAll(10k)` settles at 11.26 MB rather than the
59.6 MB of the all-nodes-held case. The work is not paying for retained state;
it is built and thrown away.

This directly violates the invariant the v15 separation was meant to establish:

```text
INTENDED          member exists  ≠  node exists
ACTUAL (setAll)   member exists  →  node built, walked, discarded
```

## The function itself is on trial, and it failed for base entityMap

The question is not "can these positions be derived more cheaply". It is
**whether `setAll` needs them at all** — a representation question borrowed from
the incumbent implementation would smuggle in the premise that every
newly-established member must possess a complete position set at population
time. Nothing has independently established that.

So it was falsified directly: `deriveSubjectPositions` was stubbed to return
`undefined` and the full core suite run.

```text
1,794 tests PASS
   11 tests FAIL, in exactly two files
```

Everything that survives independently of the causal layer is unaffected:
canonical state, granular update, structural add/remove/rekey operations,
projection reads, publication/notification. The failures are entirely:

- `entity-signal.spec.ts > structural history effect delivery` (5)
- `internals/causal-runtime/greenfield-transactions.spec.ts` (6)

And the three runtime consumers agree with that: `pending-rollback.ts:244`,
`reversal-planner.ts:125` and `tree-realization-adapter.ts:175` are the only
places that read `subjectPositions`, all three inside the causal runtime, and
the first two guard on `effect.structural !== 'remove'`.

**Conclusion: plain `entityMap.setAll`, with no history or transactions
attached, does not need `subjectPositions`.** The 41x is being paid
unconditionally for a capability only the causal layer consumes — and
`deriveSubjectPositions` is not gated by `positionMetadataEnabled`, so the
user-facing position-metadata feature is not the thing requesting it.

Two open questions this does NOT settle:

1. The failing history specs assert "complete canonical structural coverage on
   **add, remove, and rekey** envelopes", which is broader than the two
   remove-guarded consumers. Whether the history layer's own contract genuinely
   needs positions on _add_ is the next trial, and it is a history-layer
   question rather than a base-entityMap one.
2. `deriveSubjectPositions` also calls `collectOwnedPositions(api, positions)` —
   a recursive walk of the whole collection API, per member. Even bounded, doing
   it once per member during population is strange, and semantically stranger:
   if the collection API owns positions, it is not obvious why they belong to
   every individual subject's position set. That may be a bad ownership
   relation rather than repeated work, and it should be settled before anything
   is optimized.

## What removing it recovers, and what remains

`setAll` with `deriveSubjectPositions` stubbed out:

| n      | 14.0.0    | HEAD       | HEAD without subjectPositions |
| ------ | --------- | ---------- | ----------------------------- |
| 1,000  | 0.233 ms  | 9.964 ms   | 1.903 ms                      |
| 10,000 | 2.193 ms  | 90.436 ms  | 18.606 ms                     |
| 50,000 | 12.699 ms | 528.467 ms | 93.123 ms                     |

**~4.9x recovered, ~8.5x still unexplained.** At 10k that is 1.86 µs/entity
against 14.0.0's 0.22. A profile of the stubbed build puts the remainder in:
GC 16.8%, an anonymous `entity-signal` closure 12.9%, `setAll` itself 10.3%,
`structuredClone` 7.9% (entity deep-cloning), then `createSubject` 2.3%,
`signal` creation 2.4% and `getSubjectStateSignal` 1.9%.

That last one matters architecturally: `getSubjectStateSignal` running during
`setAll` means a `WritableSignal` is created per subject at population time, with
no observer — the same `member existence -> Angular realization` inversion, in a
second place. It is also part of why the unobserved base collection retains
~1,176 B/member.

## What it is NOT

- **Not the metadata flags.** `positionMetadataEnabled: false` changes nothing
  (87.4 → 87.1 ms at 10k). All three metadata flags off still leaves
  7.07 µs/entity — **32× over 14.0.0**. The metadata is ~19% of the cost; the
  node materialization and traversal are the rest.
- **Not algorithmic.** Linear on both sides, confirmed at four sizes.
- **Not the kernel.** Steady-state `updateOne` remains flat as the collection
  grows (1.275 / 0.907 / 0.741 µs at 1k/10k/50k) and sub-millisecond in the
  public path. The O(1)-write thesis is unaffected.

## How this was measured

The A/B needs genuinely isolated builds, and two earlier attempts produced
silently wrong results:

1. A `git worktree` + symlinked `node_modules` — `nx` built the main tree's
   source into the main tree's `dist`, so the "old" measurement was HEAD.
2. A worktree with its own `pnpm install` — same outcome.

The cause is an environment variable: **`NX_WORKSPACE_ROOT_PATH` is set to the
main repo**, so every `nx` invocation resolves there no matter the working
directory. The historical build only worked from a `git archive` extract (no
`.git` at all), its own `node_modules`, and `env -u NX_WORKSPACE_ROOT_PATH`.
Verify isolation by asserting the main `dist` mtime is unchanged and that the
historical `dist` lacks `lib/internals/production-substrate-stats.js`.

Note the in-repo logical-work counters (`ProductionSubstrateStats`) are compiled
out of the production build — `recordProductionSubstrateStat` is a no-op in
`dist` — so counter-based attribution needs a source-mode run. The CPU profile
above was used instead.

## Two more base-path candidates, opened not answered

The residual profile named two more places where higher-layer realization
appears to attach to mere existence. Both get the same treatment — function
first, representation never:

Ordering between these two is not arbitrary. `structuredClone` may simply be an
expensive representation choice; eager `WritableSignal` creation is potentially
an ownership violation of the same class as `subjectPositions`. The ownership
question goes first.

```text
BASE-SUBJECT-STATE-SIGNAL   candidate, UNDISCHARGED — take this one first
  `getSubjectStateSignal` runs during setAll, creating an Angular
  WritableSignal per subject with no observer.
  Ask: why does a newly existing, completely unobserved subject
  require Angular state at all?

BASE-STRUCTURED-CLONE       candidate, UNDISCHARGED
  ~8% of the residual profile is structuredClone during plain setAll.
  Ask: what independently earned contract requires retaining a distinct
  copy rather than the canonical value/reference — and is it required
  without history, with history, only for reversal, only for delivery?
```

These are the same shape as the `subjectPositions` finding, which is the actual
diagnosis: a recurring tendency to let **Angular realization serve as semantic
bookkeeping**, so that existence drives representation instead of the reverse.

## Death certificate

The final falsifier removed position information from **every** entry point at
once — the entity layer's derivation stubbed AND all 15 hand-authored
`subjectPositions` sites stripped from the transaction spec, including the
`draft.capture({...})` inputs, leaving zero references in the file. Nothing else
changed: 29 of 29 `it()` blocks and 142 behavioural assertions retained.

```text
29 of 29 PASS with no position information entering a turn from anywhere
```

Covered independently, no family inheritance — REMOVE across 10 tests
(including `undoes a confirmed structural remove after the live transaction
harness is disposed` and `proves collection-owner remove coverage is sufficient
for real multi-field abort restoration`), ADD across 8, REKEY across 5.

```text
SUBJECT POSITION SET, derived by the entity layer

base entityMap        NOT REQUIRED
public timeTravel     NOT REQUIRED
transaction remove    NOT REQUIRED
transaction add       NOT REQUIRED
transaction rekey     NOT REQUIRED

DISPOSITION           DELETE — nothing replaces it
```

No replacement table, lookup, lazy derivation or kernel representation was
introduced. The chain that existed to produce the information —
`deriveSubjectPositions` -> `collectOwnedPositions(api)` ->
`getOrCreateNode` -> `createEntityNode` -> per-field computeds, closures,
descriptors, metadata accessors, recursive traversal — lost its standing with
it and was deleted rather than optimized.

### What deletion actually bought

| measure                                  | before   | after    |
| ---------------------------------------- | -------- | -------- |
| `setAll(1k)`                             | 9.964 ms | 2.426 ms |
| `setAll(10k)`                            | 90.44 ms | 19.64 ms |
| `setAll(50k)`                            | 528.5 ms | 89.54 ms |
| same-turn high-water heap, `setAll(10k)` | 59.86 MB | 15.25 MB |
| settled retention, `setAll(10k)`         | 11.35 MB | 11.28 MB |

The transient collapse matters as much as the CPU: a long synchronous job no
longer builds ~60 MB of unreclaimable graph to populate 10,000 rows. Settled
retention is unchanged, which confirms the earlier reading — those nodes were
always transient, so this was never the owner of base memory.

Still ~7-10x slower than the 14.0.0 control, which is the unattributed second
mechanism. That gap is now measured on a build with the corpse physically gone,
so it is safe to reason from.

### The transport is deleted too

The death certificate above covers **entity-derived** subject positions. An
earlier draft of this section left the carrier in place and defended it with "a
caller can still supply positions through `draft.capture`, and that path
demonstrably works". That is not survival evidence: under the methodology used
throughout this document, that a mechanism **can** be supplied and functions is
not evidence that the function is **required**.

The audit that settled it:

```text
18 files, ~130 references
EVERY production site was a type declaration, a parameter, or a forward:
    effect.subjectPositions ? [...effect.subjectPositions] : undefined
NOT ONE production site originated a value.
```

`deriveSubjectPositions` was the only originator in the codebase. Once it was
gone the field was permanently `undefined` in production, both guards
(`pending-rollback.ts`, `reversal-planner.ts`) always took their early return,
and the capability behind them — reconstructing a removed subject's non-owner
field values from the realization context during rollback or undo — was
unreachable. It survived only in specs injecting positions synthetically.

So the carrier went with it. Removed: the field from `causal-types` and
`mutation-types`; the `subjectState` field it fed; `deriveSubjectState` and
`deriveUndoSubjectState`; the three apply loops; `applySubjectState` and its
only helper; forwarding in `reapply-planner`, `realization-context`,
`reversal-planner`, `greenfield-transactions`, `transaction-capture-bridge`,
`tree-realization-adapter` and the transactions enhancer; the adapter's
positions plumbing; and a dead `turn` parameter the deletion exposed. No
replacement of any kind.

Seven tests were deleted with it. They are the only tests that exercised the
capability, and every one constructs `CausalTurn` effects by hand and feeds them
straight to a planner — no `signalTree`, no `entityMap`, unreachable from any
public API. Deleting a mechanism means deleting the tests that assert the
mechanism; keeping them would have been keeping the corpse alive through its
own test suite.

```text
SUBJECT-POSITION TRANSPORT
  production originator      NONE
  reachable in production    NO
  observable behaviour lost  none found
  disposition                DELETED, nothing replaces it
```

Post-deletion validation: `setAll(10k)` 17.86 ms and `setAll(50k)` 89.36 ms;
core 1,798 pass / 0 fail; `run-many` across core, ng-forms, shared and events
green; `typecheck-all` green; `eslint packages/core/src` clean; and the four
public undo behaviours (remove membership, remove field values, add, rekey) all
still pass.

## Two more base-path candidates, opened not answered

The residual profile named two more places where higher-layer realization
appears to attach to mere existence. Both get the same treatment — function
first, representation never:

Ordering between these two is not arbitrary. `structuredClone` may simply be an
expensive representation choice; eager `WritableSignal` creation is potentially
an ownership violation of the same class as `subjectPositions`. The ownership
question goes first.

```text
BASE-SUBJECT-STATE-SIGNAL   candidate, UNDISCHARGED — take this one first
  `getSubjectStateSignal` runs during setAll, creating an Angular
  WritableSignal per subject with no observer.
  Ask: why does a newly existing, completely unobserved subject
  require Angular state at all?

BASE-STRUCTURED-CLONE       candidate, UNDISCHARGED
  ~8% of the residual profile is structuredClone during plain setAll.
  Ask: what independently earned contract requires retaining a distinct
  copy rather than the canonical value/reference — and is it required
  without history, with history, only for reversal, only for delivery?
```

These are the same shape as the `subjectPositions` finding, which is the actual
diagnosis: a recurring tendency to let **Angular realization serve as semantic
bookkeeping**, so that existence drives representation instead of the reverse.

## Death certificate

The final falsifier removed position information from **every** entry point at
once — the entity layer's derivation stubbed AND all 15 hand-authored
`subjectPositions` sites stripped from the transaction spec, including the
`draft.capture({...})` inputs, leaving zero references in the file. Nothing else
changed: 29 of 29 `it()` blocks and 142 behavioural assertions retained.

```text
29 of 29 PASS with no position information entering a turn from anywhere
```

Covered independently, no family inheritance — REMOVE across 10 tests
(including `undoes a confirmed structural remove after the live transaction
harness is disposed` and `proves collection-owner remove coverage is sufficient
for real multi-field abort restoration`), ADD across 8, REKEY across 5.

```text
SUBJECT POSITION SET, derived by the entity layer

base entityMap        NOT REQUIRED
public timeTravel     NOT REQUIRED
transaction remove    NOT REQUIRED
transaction add       NOT REQUIRED
transaction rekey     NOT REQUIRED

DISPOSITION           DELETE — nothing replaces it
```

No replacement table, lookup, lazy derivation or kernel representation was
introduced. The chain that existed to produce the information —
`deriveSubjectPositions` -> `collectOwnedPositions(api)` ->
`getOrCreateNode` -> `createEntityNode` -> per-field computeds, closures,
descriptors, metadata accessors, recursive traversal — lost its standing with
it and was deleted rather than optimized.

### What deletion actually bought

| measure                                  | before   | after    |
| ---------------------------------------- | -------- | -------- |
| `setAll(1k)`                             | 9.964 ms | 2.426 ms |
| `setAll(10k)`                            | 90.44 ms | 19.64 ms |
| `setAll(50k)`                            | 528.5 ms | 89.54 ms |
| same-turn high-water heap, `setAll(10k)` | 59.86 MB | 15.25 MB |
| settled retention, `setAll(10k)`         | 11.35 MB | 11.28 MB |

The transient collapse matters as much as the CPU: a long synchronous job no
longer builds ~60 MB of unreclaimable graph to populate 10,000 rows. Settled
retention is unchanged, which confirms the earlier reading — those nodes were
always transient, so this was never the owner of base memory.

Still ~7-10x slower than the 14.0.0 control, which is the unattributed second
mechanism. That gap is now measured on a build with the corpse physically gone,
so it is safe to reason from.

### The remaining transport is now mechanically dead in production

The death certificate above is deliberately narrow: it covers **entity-derived**
subject positions. The carrier itself — the optional field on the effect types,
the transactions enhancer's forwarding, and the causal-runtime consumers — was
left in place. An earlier draft of this section defended that with "a caller can
still supply positions through `draft.capture`, and that path demonstrably
works". That is not survival evidence: under the methodology used throughout
this document, that a mechanism **can** be supplied and functions is not
evidence that the function is **required**.

The audit that should have accompanied the deletion:

```text
18 files, ~130 references
EVERY production site is a type declaration, a parameter, or a forward:
    effect.subjectPositions ? [...effect.subjectPositions] : undefined
NOT ONE production site originates a value.
```

`deriveSubjectPositions` was the only originator in the codebase. With it gone
the field is permanently `undefined` in production, both guards
(`pending-rollback.ts`, `reversal-planner.ts`) always take their early return,
and the capability behind them — reconstructing a removed subject's non-owner
field values from the realization context during rollback or undo — is
**unreachable**. It survives only in specs that inject positions synthetically;
`tree-realization-adapter.spec.ts` alone has 47 such references.

So the deletion has already disabled that capability. Every behavioural probe
says nothing observable depended on it — public `timeTravel()` undo of
remove/add/rekey restores membership and field values, and the transaction suite
passes 29/29 with no positions anywhere. That is consistent with the capability
having been redundant for `entityMap` subjects, whose values are restored
wholesale from the value store by another route — and `entityMap` was the only
producer, so it is the only subject shape that ever had it.

Leaving the carrier in this state is the worst of the available options: a
capability unreachable in production, still typed, still forwarded through six
modules, still asserted by five spec files.

```text
SUBJECT-POSITION TRANSPORT
  production originator      NONE (mechanically verified)
  reachable in production    NO
  observable behaviour lost  none found
  disposition                OPEN — delete, or re-provide a correct producer
```

## Evidence hygiene note

The residual `~8.5x` was measured on a build with `deriveSubjectPositions`
already stubbed out, not by subtracting an estimate from the full build. A
rejected mechanism left in place contaminates the next measurement, so the
corpse was removed before the residual was reasoned about.

## Success criterion

An unobserved `setAll` creates **zero** Angular/member observation nodes unless
an independently earned contract proves otherwise. Not "creates them faster".

Order of work, so that a representation choice is never made before the function
is established:

1. Hostile derivation of the CAUSAL REMOVE row.
2. Hostile derivation of the CAUSAL ADD row, independently.
3. Hostile derivation of the CAUSAL REKEY row, independently.
4. Physically remove the `subjectPositions` work everywhere it fails — this is
   what makes the base row execution-closed.
5. Re-measure the residual `setAll` on the cleaned build.
6. `BASE-SUBJECT-STATE-SIGNAL`: why does an unobserved subject need Angular
   state?
7. `BASE-STRUCTURED-CLONE`: what independently earned function requires the
   copy?

Separately, and at any point: settle whether collection-level positions belong
in an individual subject's position set at all.
