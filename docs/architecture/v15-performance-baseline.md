# 15.0 performance baseline

**Status:** MEASURED at `87a790eb`, on a quiet machine, after declarative
construction and zero-owner reclamation. This is the reference point later work
is compared against, not a claim about any other machine.

Every table names the tool that produces it. Re-run the tool before trusting a
number here; nothing in this file is hand-copied from a scratch run.

> ## RE-BASELINED 2026-09-17 — the tables below predate the native leaf carriers
>
> Every table below was taken at `87a790eb` on **2026-08-22**. Framework-native
> leaf carriers landed at `7ab2e82d` on **2026-09-05**
> ([framework-native-leaves.md](../performance/framework-native-leaves.md)),
> which replaced universal kernel locations with the framework's own primitives
> as the public leaf. That is the largest representation change since this
> baseline was taken, and no entity, collection, or competitive measurement has
> been re-run against it. The only artifacts dated `09-05` are the four
> leaf/carrier files in `apps/demo/public/benchmarks/`.
>
> **Consequence:** any argument comparing 15.x entity economics against v14,
> `@ngrx/signals`, or an earlier 15.x is using pre-carrier inputs. That includes
> the per-entity and collection-throughput rows in
> [real-implementations.md](../compare/real-implementations.md), last touched
> `2026-09-03`.
>
> ### First re-measurement at HEAD — 2026-09-17
>
> `tools/bench-public-collection-layers.mjs --samples 9` and
> `tools/bench-entity-layers.mjs`, single run each, after `nx build kernel`.
> `tools/bench-entity-layers.mjs` has changed once since the baseline
> (`dbf958ad`) and that change was the `core` -> `kernel` dist path only, so the
> measurement logic is comparable.
>
> | arm                        | `87a790eb` |     HEAD | reading                     |
> | -------------------------- | ---------: | -------: | --------------------------- |
> | `entitymap-setAll`         |   18.16 ms | 19.28 ms | inside documented spread    |
> | `entitymap-updateOne`      |    0.19 ms |  0.16 ms | inside documented spread    |
> | `entitymap-projection-all` |    1.28 ms |  1.27 ms | inside documented spread    |
> | `L1-physical-stores`       |      455 B |    455 B | reproduces                  |
> | `L4-public-entitymap`      |      487 B |    488 B | reproduces                  |
> | `L5t-nodes-transient`      |    1,055 B |  2,283 B | **2.2x — attributed below** |
> | `L5-nodes-held`            |    3,859 B |  9,527 B | **2.5x — attributed below** |
>
> Operation cost and the public retention baseline both reproduce. The physical
> stores are flat. **Only node/field realization moved**, and it moved in the
> term a full-collection read lands in — which is the term the competitive
> comparison measures.
>
> ### CONFIRMED and ATTRIBUTED — `REALIZATION-DENSITY-REGRESSION-0`
>
> The machine was ruled out first. `87a790eb` was rebuilt in a detached worktree
> and measured on the same machine in the same session: it returns 120 / 455 /
> 481 / 481 / 487 / **1,055** / **3,859** / 3,854 B — every arm within 1 B of the
> table below. The old build reproduces the old numbers, so the difference is in
> the code.
>
> `tools/bench-entity-layers.mjs --arm L5-nodes-held`, one build per commit:
>
> | commit     |  date | B/entity |  delta | what landed                       |
> | ---------- | ----: | -------: | -----: | --------------------------------- |
> | `87a790eb` | 08-22 |    3,859 |      — | this file's baseline              |
> | `851f496e` | 09-03 |    3,086 |   -773 | historical native-leaf comparator |
> | `5efeb7f5` | 09-04 |    7,675 | +4,589 | **universal locations (2.49x)**   |
> | `81780c4e` | 09-04 |    9,526 | +1,851 | **callable location grammar**     |
> | `7ab2e82d` | 09-05 |    9,527 |     +1 | native leaf carriers — flat       |
> | HEAD       | 09-17 |    9,527 |      0 | flat since                        |
>
> `tools/bench-entity-layers.mjs` was last touched at `dbf958ad`, before every
> point from `851f496e` on, so the arms are identical across the whole bisect.
>
> **The native carriers are exonerated: +1 B/entity.** The cost arrived in the two
> commits before them. `5efeb7f5` is recorded in
> [RELEASE-1.0.md](../../RELEASE-1.0.md) as "framework identity superseded by
> `7ab2e82d`" — its claim that every facade should expose the same nominal
> location "did not survive the native-carrier falsifiers". That supersession
> reverted the **public identity** decision and recovered **none** of the
> 6,440 B/entity it and `81780c4e` added to held realization.
>
> Nothing caught it because the carrier decision's memory arm
> ([framework-native-leaves.md](../performance/framework-native-leaves.md))
> measures **scalar leaves** — 100k leaves at 1,934 B/leaf, universal and native
> within 0 B — and there is no entity-realization arm in that comparison at all.
> A scalar-leaf density gate cannot see entity node/field realization.
>
> Scope, stated narrowly: `L4-public-entitymap` is flat at 488 B, so **having**
> entities did not get more expensive. The regression is in **holding** per-row
> nodes (L5) and in the residue of a full read (L5t, 1,055 -> 2,283 B). An
> application that binds a few fields per visible row is affected; one that never
> realizes nodes is not.
>
> Do not reopen `ENTITY-PHYSICAL-DENSITY-0` for this — the physical stores are
> flat at 455 B and are not implicated.
>
> ### What the 6,441 B buys — mechanism located
>
> The per-field construction inside `createEntityNode` changed. At `851f496e`:
>
> ```js
> const fieldSignal = derivedRuntime.createDerived(() => entitySig()?.[fieldKey]);
> Object.assign(fieldSignal, { set, update, asReadonly /* ... */ });
> ```
>
> a `computed` with write methods assigned onto it. At HEAD it is
> `locations.createWritableProjection(compute, write)`.
>
> **WHICH runtime answers that call is the whole question, and this benchmark
> answers it with the neutral one.** `createEntitySignal` resolves
> `options?.locationRuntime ?? NEUTRAL_LOCATION_RUNTIME`
> (`entity-signal.ts:310`), and `tools/bench-entity-layers.mjs` imports only from
> `dist/packages/kernel` — it never loads Angular or binds an observation
> adapter. So every number in the bisect above is the **framework-neutral**
> projection in `internals/location-runtime.ts:130`: a callable location, a
> binding object with three closures, an intrinsic-mutation-source registry
> entry, and `markTreeCell`.
>
> The fixture holds 3 fields per entity, so 6,441 B/entity is about
> **2,147 B per field** on the neutral path.
>
> **VERIFIED:**
>
> - The kernel has no framework imports at HEAD; `tools/check-kernel-neutrality.mjs`
>   passes on all production source and build artifacts. The note in
>   `bench-entity-layers.mjs` that "Angular has already entered by L2" is
>   **stale** — it was written when this package was `core`, pre-reslice.
> - Under a real Angular adapter, an entity node field IS a framework carrier:
>   probe against HEAD returns `isSignal` true, a real `.set`, and callable. The
>   Angular adapter answers `createWritableProjection` with `linkedSignal`
>   (`packages/angular/src/lib/observation-adapter.ts:33`).
>
> A prior draft of this section attributed the regression to `linkedSignal`.
> That was wrong — Angular is never loaded here. **Do not quote 2,147 B/field as
> an Angular cost.**
>
> ### MEASURED — the per-framework matrix
>
> `node --expose-gc tools/bench-entity-realization-matrix.mjs`. Same fixture,
> same arms, same quiescence protocol as `bench-entity-layers.mjs`; only the
> package supplying `signalTree` — that is, the runtime answering the
> realization seam — differs.
>
> | row       | untouched | field realized | nodes held | vs control | realization supplied by        |
> | --------- | --------: | -------------: | ---------: | ---------: | ------------------------------ |
> | `kernel`  |     488 B |        3,921 B |    9,527 B |          — | neutral control                |
> | `angular` |     488 B |        3,799 B |  **6,396** |   **-33%** | Angular adapter                |
> | `vue`     |     490 B |        4,743 B |  **7,538** |   **-21%** | Vue adapter                    |
> | `react`   |     488 B |        3,920 B |    9,527 B |        ±0% | no adapter, by design          |
> | `v14`     | **131 B** |      **699 B** |  **3,382** |   **-65%** | v14 Angular-native — see below |
>
> The `kernel` row reproduces `bench-entity-layers.mjs` (488 / 9,527), which is
> what validates the harness.
>
> **The neutral fallback is the most expensive realization, not the cheapest.**
> Every historical entity-density number in this repository — including the
> bisect above — is that worst case. Angular consumers pay **33% less** than the
> figure the regression was written up with.
>
> **React is byte-identical to the control because it has no adapter.** > `packages/react/src/index.ts` re-exports the kernel verbatim and adds only
> `useSignalTree`; React observes through `useSyncExternalStore` and
> deliberately does not replace the tree carrier. That is intended architecture,
> but its consequence had never been measured: React entity realization costs
> 49% more than Angular's for identical semantics. Any per-framework claim must
> now say which row it means.
>
> `untouched` is 488-490 B across all four rows: **an unrealized entity costs
> the same everywhere.** The adapter only shows up once realization happens,
> which is the pay-for-use law behaving correctly at this boundary.
>
> ### The v14 control — sourced at last
>
> `@signaltree/core@14.1.3`, built from the `release/14.x` worktree and measured
> through the identical fixture, arms and quiescence protocol. Run it with
> `--v14-root <path>`; the row is skipped, not fatal, when that build is absent.
>
> **This is the first v14 arm that has ever existed in this repository.** Every
> v14 figure quoted in the architecture discussion was unsourced, because
> `release/14.x` has no `bench-entity-layers.mjs` and never did.
>
> The long-quoted "~132 B/entity" **reproduces at 131 B** — for the `untouched`
> arm specifically. That also reconciles the contradiction in
> [real-implementations.md](../compare/real-implementations.md), which retracted
> a 136 B figure as "measured before the heap had settled" and replaced it with
> 1,172 B. Both were right about different arms: ~131-136 B is having entities,
> and the four-digit figure is realizing them. One number was never wrong; two
> different arms were being given one name.
>
> | ratio to v14 | untouched | realized |      held |
> | ------------ | --------: | -------: | --------: |
> | `angular`    |     3.73x |    5.44x | **1.89x** |
> | `vue`        |     3.74x |    6.79x |     2.23x |
> | `react`      |     3.73x |    5.61x |     2.82x |
>
> Two things this says, and one it does not.
>
> **The gap is widest where least is realized.** Merely having 10k entities costs
> 3.7x v14; holding every node costs 1.89x. The fixed semantic representation —
> SubjectId, lifetime, revision, ordering, indexes — dominates the small number
> and is amortized into the large one. That is consistent with E0 in
> [entity-physical-density.md](./entity-physical-density.md): a conventional
> `Map<key, entity>` with this payload measures 108 B/entity against a 394 B
> production marginal slope, and 286 B of the difference is named semantic
> authority.
>
> **The `realized` column is the outlier and the opportunity.** v14 adds 568 B
> per row on first read; Angular adds 3,311 B — about 6x. E4 already attributed
> roughly 712 B of that to two strong cells (`entitySignals` plus
> `subjectStateSignals` and their activation cells). The rest is unattributed and
> is the best-value target on this page, because it is the cost of the ordinary
> act of reading a list once.
>
> **What it does not say: that 1.89x is a defect.** v14 keys ARE identity. Remove
> and re-add key 42 in v14 and a held node follows the new occupant; v15
> guarantees it does not. That guarantee is most of the fixed difference. This
> row is a floor, not a target, and the ratio must never be quoted without that
> sentence.
>
> ### CPU — `tools/bench-v14-v15-control.mjs`
>
> Shipped `@signaltree/core@14.1.3` against current `@signal-tree/angular@15.1.4`.
> Angular-native on both sides, which is the only fair comparison. Both arms are
> driven by the same workload source with no compatibility shim — the APIs were
> probed and are identical for read, `.set()`, `byId().field()`, `updateOne`,
> `setAll` and `destroy()`.
>
> Arms are interleaved in one process with the order flipped every round, and an
> **A/A control runs v15 against itself through the same path** so protocol noise
> is measured rather than assumed. 9 rounds, Node v24.3.0, darwin/arm64, Apple M4.
>
> | workload                 |       v15 |       v14 |     ratio |    A/A |
> | ------------------------ | --------: | --------: | --------: | -----: |
> | `scalar-read`            |    8.0 ns |    8.3 ns | **0.96x** |  ±4.1% |
> | `scalar-set`             |   26.0 ns |   10.0 ns |     2.59x |  ±2.2% |
> | `construct-100`          | 256.67 us |  87.83 us |     2.92x | ±14.2% |
> | `construct-1000`         |   2.52 ms | 767.53 us |     3.29x |  ±6.2% |
> | `entity-setAll-10k`      |  15.83 ms |   1.80 ms | **8.77x** |  ±1.7% |
> | `entity-updateOne-10k`   |  448.9 ns |  167.2 ns |     2.68x |  ±3.8% |
> | `entity-byId-field-read` |  414.8 ns |  261.2 ns |     1.59x | ±13.0% |
>
> Every ratio is outside its A/A band, so all seven are results. Across three
> protocol variants during development the directions never changed
> (`scalar-read` 0.64-0.79x, `setAll` 7.06-10.25x); the magnitudes did, so quote
> the shape and re-run before quoting a decimal.
>
> **`scalar-read` is the first measured case of v15 beating v14 on a common
> operation** — 7.4 ns against 9.4 ns. That is the native-carrier decision
> (`7ab2e82d`) paying off: the Angular leaf is an Angular signal, so the read is
> Angular's own cached read with no SignalTree frame in it.
>
> **`entity-setAll-10k` at 9.39x is the largest gap on this page** and it has the
> tightest claim: v14 does the same public work in 1.90 ms. Note that the
> long-quoted unsourced "v14 setAll ~2.19 ms" was approximately right, like the
> "~132 B/entity" figure — the arguments were using roughly correct numbers with
> no way to regenerate them.
>
> Construction is 2.92-3.29x and remains the ceiling both prior closures named.
> It is a one-time cost on a store that lives for hours; treat it as a regression
> guard, not a roadmap objective, unless a fix also improves steady state.
>
> ### First bare-path deletion — observation is now pay-for-use
>
> `--cpu-prof` on 20M Angular scalar writes attributed 54.7% of samples to four
> functions, and two of them were work a bare tree should not do:
>
> | self time | function                                              |
> | --------: | ----------------------------------------------------- |
> |     28.9% | `replace` (`native-tree-scalar-leaf-runtime.ts`)      |
> |     15.9% | `commitSlot` (`tree-scalar-slot-runtime.ts`)          |
> |      5.7% | `getIntrinsicMutationObserver` (`intrinsic-mutation`) |
> |      4.2% | `equalsInner` (`utilities/deep-equal`)                |
>
> `replace` called `getIntrinsicMutationObserver(leaf)` on **every** write: a
> WeakMap probe plus a `Set.size` test against a set that stays empty for the
> whole process unless inspection, capture or Studio is attached.
>
> The fix went through two designs, and the second is the one to keep.
>
> A process-wide installed-observer count measured well but is the wrong
> ownership boundary: **one observer installed anywhere puts the probe back on
> every unrelated tree in the process.** Replaced by per-source state.
> `registerIntrinsicMutationSource` now returns the handle the mutating closure
> holds, so the hot path is one field read and one branch and never touches the
> WeakMap. The composed observer is rebuilt on install/release rather than per
> mutation, which also removes a closure allocation and an array spread that the
> original performed on every mutation of an _observed_ leaf.
>
> > **Pay for use at the smallest practical ownership boundary, not process-wide.**
>
> **Three honest numbers, because they disagree.** An isolated monomorphic loop
> measured 23.07 -> 17.93 ns/op (-22.3%). The `bench-v14-v15-control` harness —
> both arms loaded, workloads interleaved — measured the global-count version at
> 26.0/21.9/26.4 ns and the localized version at 23.6/28.6/26.6 ns, against a
> 27.9 ns pre-change baseline. So the real win is **roughly 1-3 ns**, the two
> designs are indistinguishable on speed, and **localization is free**. Quote the
> control: a monomorphic loop lets V8 optimise in ways a real application will
> not, and it overstated this by ~4x.
>
> Validation: kernel suite `276` files / `2323` passing. A new
> `intrinsic-mutation-pay-for-use.spec.ts` pins the case a naive version breaks —
> an observer attached AFTER unobserved writes — plus release/re-attach,
> cross-leaf isolation, partial release and double release. Existing coverage
> installed its observers _before_ writing and so could not have caught it.
> Mutation-proved against both designs: neutering the short-circuit fails 5 of 6.
>
> ### Equality: measured before building, and not worth it yet
>
> `equalsInner` looked like the next target at 4.2% of samples. It is worth
> **1.37 ns**, measured without writing anything: `useShallowComparison: true`
> already swaps `deepEqual` for `Object.is`, so the ceiling is the difference
> between those two configs on the same write — 39.22 vs 37.85 ns/op.
>
> That is 8.5% of the ~16 ns gap, and it carries a real correctness trap.
> `createEqualityFn` returns `Object.is` (SameValue) or `deepEqual`, and
> `deepEqual` on primitives implements **SameValueZero** — `deepEqual(+0, -0)` is
> `true` where `Object.is(+0, -0)` is `false`. Specializing primitive leaves to
> `Object.is` would silently change publication behaviour on `-0`. The correct
> specialization is `a === b || (a !== a && b !== b)`, and it must still honour a
> configured `useShallowComparison`.
>
> Deferred: 1.37 ns does not justify that risk while `replace` (28.9%) and
> `commitSlot` (15.9%) — **44.8% together, roughly 11 ns** — are untouched. Equality
> itself must stay; suppressing redundant publication is a reactivity
> requirement, and the goal is to make the correct check nearly free, not to
> remove it.
>
> `ngDevMode` was ruled out as a factor — forcing it false moved the ratio
> 2.04x to 2.04x.
>
> ### Revision consumer audit, and EXPERIMENT A
>
> Run before deleting anything, because `commitSlot` does two separable things:
> it returns `{ revision, changed, slot }` and it advances a counter.
>
> | consumer                                   | reads                    | class              |
> | ------------------------------------------ | ------------------------ | ------------------ |
> | `publishSlot`                              | `changed`, `slot` only   | ALWAYS REQUIRED    |
> | `replace` / `derive` observer notification | `changed` only           | ALWAYS REQUIRED    |
> | `signal-tree.ts:870` `publishPrepared`     | `runtime.revision()`     | batch publish path |
> | `tree-realization-adapter.ts:647,868`      | `runtime.revision()`     | OPTIONAL — causal  |
> | `ScalarSlotMutationFrameImpl.commit`       | `getCommittedRevision()` | frame staleness    |
>
> **`SingleSlotCommitResult.revision` has no consumer at all.** Every caller of
> `commitSlot` feeds the result to `publishSlot`, which reads `changed` and
> `slot`. The counter is separate and does have real consumers, so the two
> experiments are genuinely independent.
>
> **EXPERIMENT A — remove the result object, revision behaviour untouched.** > `commitSlotFast(slotIndex, value): boolean` performs the identical commit,
> including `advanceRevision()`, and answers `changed` directly.
>
> Verdict: **KEEP**, worth about **2 ns**. Individual control runs spread wider
> than the effect, so this was decided by pairing — both kernels built, the
> control alternated between them with the order flipped each round:
>
> | pair |   pre-A |           A |
> | ---- | ------: | ----------: |
> | 1    | 26.2 ns | **24.0 ns** |
> | 2    | 24.8 ns | **23.0 ns** |
> | 3    | 24.7 ns | **23.5 ns** |
> | 4    | 24.5 ns | **21.6 ns** |
>
> A wins 4/4. Medians 24.75 -> 23.25 ns. V8 did not scalar-replace the object,
> which was the hypothesis worth falsifying before touching anything.
>
> Kernel suite `276` files / `2323` passing, unchanged.
>
> Refactored afterwards so the two algorithms cannot drift: `commitSlotValue` is
> now THE authoritative commit — validation, equality, write, revision, stats —
> and `commitSlot` is a thin wrapper that adds the descriptive result for the
> callers that want it. The cheap path is the primitive, not a side door.
>
> ### EXPERIMENT B and the slot assertion — both NEGATIVE
>
> Same paired protocol: two kernels built, the control alternated between them
> with the order flipped each round.
>
> **`assertSlotIndex` on the commit path — NOT a measurable cost.**
>
> | pair | with assert | without |
> | ---- | ----------: | ------: |
> | 1    |     22.7 ns | 24.7 ns |
> | 2    |     26.0 ns | 21.9 ns |
> | 3    |     21.8 ns | 23.0 ns |
> | 4    |     25.7 ns | 22.0 ns |
>
> 2/2 split with the pairs disagreeing in direction — noise, not signal, unlike
> Experiment A's 4/4. Kept. The bounds check is real safety on an interface that
> accepts externally supplied indices (`resolveScalarSlot` hands them out), and
> there is no win to trade for it.
>
> **Revision advancement — ceiling is ~0, so the specialization is not built.**
>
> | pair | revisioned | no revision |
> | ---- | ---------: | ----------: |
> | 1    |    23.0 ns |     24.0 ns |
> | 2    |    24.7 ns |     22.6 ns |
> | 3    |    23.9 ns |     24.0 ns |
> | 4    |    23.2 ns |     21.9 ns |
>
> Medians 23.55 vs 23.30 — **0.25 ns**, another 2/2 directional split. The audit
> had cleared the way (`publish()` reads only `changedSlots`; `publishSlot` only
> `changed`/`slot`; so the only consumers of the ADVANCING counter are frame
> staleness and the causal adapter, neither present on a bare tree). The
> architecture was admissible and the prize is not there, so construction-selected
> commit implementations are **not** worth building for revision. Recorded as
> closed negative evidence rather than left as an open idea.
>
> ### Where the scalar write actually stands
>
> Isolated profile, same harness across the session: **22.47 -> 13.96 ns/op**.
> `commitSlot` has left the profile entirely. What remains:
>
> | self time | function                            |
> | --------: | ----------------------------------- |
> |     22.7% | `replace` (ours)                    |
> | **16.0%** | **`signalSetFn` (`@angular/core`)** |
> |      3.6% | `equalsInner`                       |
> |      2.3% | `set` (`@angular/core`)             |
>
> **18.3% is now Angular's own signal machinery**, which v14 pays too and which
> no SignalTree change can remove. Four suspected costs have now been measured:
> two were real and are fixed (observer lookup, result object), two are duds
> (slot assertion, revision).
>
> ### `NATIVE-STORAGE-0` — the remaining gap is DUPLICATE STORAGE, not semantics
>
> An earlier version of this section called the residue "the architectural price
> of kernel-owned truth behind a framework carrier". That was an assumption
> wearing a conclusion's clothes, and it is **falsified**. It assumed
>
> > kernel semantic authority ⇒ kernel physical-value ownership
>
> which nothing had tested. Semantic authority and physical storage authority are
> separable.
>
> Today every scalar write stores the value **twice**:
>
> ```js
> // packages/angular/src/lib/observation-adapter.ts
> createWritableCell: (read) => {
>   const cell = signal(read()); // copy #2, seeded from kernel
>   token: {
>     invalidate: () => publish(read());
>   } // re-reads kernel, sets signal
> };
> ```
>
> so a write is `values[slot] = next`, then `invalidate()` -> `read()` the array
> -> `set()` the signal. Two stores and a read, where v14 does one store.
>
> Ceiling measured before building anything, all arms in one process, five
> order-alternated rounds:
>
> | arm                                | ns/op |    vs v14 |
> | ---------------------------------- | ----: | --------: |
> | raw Angular `signal.set`           |  9.48 |     0.48x |
> | **native-storage, full semantics** | 17.08 | **0.86x** |
> | v14.1.3                            | 19.88 |     1.00x |
> | v15 current                        | 42.54 |     2.14x |
>
> The native-storage arm is not a toy: it pays the observer check, the
> transaction branch, equality, revision, reactivation and observer
> notification. Adding all of that to the minimal version cost **1.7 ns**
> (15.36 -> 17.08). **The semantics are cheap. The second copy is not.**
>
> If this holds in production it takes scalar writes from 2.1x v14 to roughly
> 0.86x — from losing to winning — with no semantic concession.
>
> The change surface is small: only 10 kernel sites read `values[slot]` or call
> `readSlot(`. The adapter contract needs a cell that can be COMMITTED
> (`commit(next)`) rather than one that is invalidated and re-pulls, and the
> neutral kernel keeps its own array because plain TypeScript still needs
> somewhere to put state.
>
> Preregistered requirements before any of this ships:
>
> 1. no duplicate committed scalar value — the native signal IS the cell;
> 2. public writes still route through authorship, transactions, restoration and
>    equality; `.set()` cannot bypass them;
> 3. transactions stay atomic — staged values live outside the carrier until
>    commit, and observers never see intermediate state;
> 4. every semantic suite stays green: authored/realized, restoration,
>    transactions, snapshots, external ingress, observer installation, destroy,
>    derived, no-op equality;
> 5. verdict from `bench-v14-v15-control`, never the monomorphic loop.
>
> #### Go/no-go evidence gathered before touching the commit path
>
> **Atomic multi-slot publication — NOT yet established. State this carefully.**
>
> Two native cells standing in for two slots, a `computed` over both, 1,000
> transaction turns staging outside the cells then committing both with no read
> between: **0 partial observations**. The probe is self-validating — an
> adversarial arm that deliberately reads between the two writes reports
> **100/100 partial**.
>
> What that proves is narrow: **if nothing executes between the two `set()`
> calls, nothing observes the intermediate value.** Its own adversarial arm
> proves the converse — an intermediate read DOES see partial state. It does not
> prove that nothing can execute in between.
>
> The production question is therefore re-entrancy, not glitch-freedom: **can any
> supported consumer run during a native commit?** Candidates are SignalTree's own
> observation/capture hooks, Angular effects in a zoneless fixture, computed and
> template observation, and any synchronous framework hook reachable from
> `signal.set()`. JavaScript being single-threaded and Angular effects being
> scheduled rather than inline makes this plausible, not proven.
>
> #### But the transaction premise behind that worry is WRONG
>
> The design sketch this experiment started from assumed:
>
> ```text
> ACTIVE TRANSACTION
>   native cell    = previous committed truth
>   frame          = staged proposed value
> ```
>
> **That is not this product's transaction model.** > `packages/angular/src/lib/demarcation.spec.ts` asserts the opposite, by name:
>
> ```ts
> it('an Angular effect observes speculative transaction state', ...)
>   const pending = tree.transaction(() => tree.$.theme.set('speculative'));
>   expect(seen).toContain('speculative');   // BEFORE any commit
>   pending.rollback();
>   expect(seen[seen.length - 1]).toBe('light');
> ```
>
> SignalTree transactions are **optimistic**: writes are immediately visible to
> observers and rollback compensates. `RELEASE-1.0.md` states the same — a
> "speculative lifecycle projection", "speculative rollback", and "successful
> compensation DISCARDS speculative consequences".
>
> Two consequences, and they point in opposite directions:
>
> 1. **Staging outside the carrier would be a semantic regression**, not a safety
>    measure. It would change transactions from optimistic to
>    isolated-until-commit and break the shipped contract.
> 2. **`NATIVE-STORAGE-0` gets easier.** The native cell is already permitted to
>    hold speculative state, so there is no stage-outside requirement and no
>    "no consumer may see partial transaction state" obligation to engineer
>    around. Rollback re-commits the prior value into the same cell.
>
> What still needs proving is narrower: coherent publication for a **single**
> operation that touches several positions (a branch write), which is a
> different guarantee from transaction isolation and must not be conflated
> with it.
>
> **Change surface, measured rather than guessed:** `values[]` is touched in 7
> places, all inside `tree-scalar-slot-runtime.ts`, and `readSlot` has exactly
> two consumers (`native-tree-scalar-leaf-runtime.ts:109`,
> `tree-scalar-leaf-runtime.ts:124`). The transaction frame path is the wide
> part: `ScalarSlotMutationFrameImpl` stages into a `Map` and commits through
> `commitSlots`, which reads and writes `values[]` directly, so it has to move to
> the cell contract with the rest.
>
> One design warning from the surface audit: storing per-slot `read`/`write`
> closures in parallel arrays would replace a direct `values[slotIndex]` access
> with an indirect call and could eat the win. The shape that matches the ceiling
> probe is a leaf that owns its own cell and performs equality and commit against
> it directly, with the slot runtime retained for cross-slot coordination.
>
> ### `UPDATEONE-FAST-0` — SHIPPED
>
> Profiling entities under the REAL Angular adapter overturned the expectation
> that the scalar lesson would transfer. The pull-back pattern does exist one
> layer up (`native-location-realization.ts`: `notify()` -> `token.invalidate()`
> -> `read()`), but it is only **7.6%** of `updateOne`. Entity FIELDS do not have
> it at all — the Angular adapter answers `createWritableProjection` with
> `linkedSignal`, which recomputes lazily from the entity version signal.
>
> `updateOne` at 378 ns/op, self time:
>
> | share | frame                                    |
> | ----: | ---------------------------------------- |
> | 20.3% | `entity-mutation-frame.commit`           |
> | 11.8% | `updateOne`                              |
> |  9.4% | garbage collector                        |
> |  8.9% | `updateSignals`                          |
> |  7.6% | `native-location-realization` (3 frames) |
>
> `commit()` allocates per mutation regardless of size — a prepared-instruction
> array from `.map`, a `Set`, an id array — plus `rememberSubjectIds([id])`
> allocating twice for one id. For a one-field update that machinery IS the
> mutation. The rule is not "push instead of pull"; it is the one underneath:
> **do not construct general machinery for the specific case.**
>
> `updateOne` now calls `commitExistingSubjectValue` directly. That is
> admissible because `updateOne` is the admissible case by construction — it
> stages exactly one `replace-value` and nothing structural.
>
> | pair |    frame |         fast |
> | ---- | -------: | -----------: |
> | 1    | 417.1 ns | **387.9 ns** |
> | 2    | 420.7 ns | **373.1 ns** |
> | 3    | 419.7 ns | **374.7 ns** |
> | 4    | 413.6 ns | **363.9 ns** |
>
> 4/4, about **44 ns (-10.6%)**, and **GC events over a 3M-op window fall from
> 108/107 to 84/81 (-23%)**. Both moved, which was the preregistered condition
> for keeping the complexity.
>
> A first GC attempt measured `heapUsed` delta and reported the fast path
> allocating MORE. That measurement was invalid — GC ran inside the window, so
> the delta was residual rather than churn, and the `PerformanceObserver` gc
> hook never fired (`gcEvents: 0` in every arm). `--trace-gc` counting is the
> number to trust.
>
> Equivalence is pinned by `entity-update-one-equivalence.spec.ts`: 11
> assertions covering value, held-node identity, subject lifetime versus
> remove/re-add, row and field invalidation, whole-collection projections,
> no-op patches, unknown-id throw, undo, authored-vs-realized refusal, and
> transaction rollback with a held node. **All 11 were run against the frame
> implementation as well as the fast path** — a suite that only described the
> new behaviour could not have detected divergence.
>
> `entity-updateOne` against v14: **2.54x -> 2.27x**. The 7.6% publication
> residue is deliberately NOT included here so the two remain attributable.
>
> ### `SUBJECT-STATE-MINIMAL-0` — negative for the milestone; 121 B/entity landed
>
> `subjectStateSignals` holds `locations.createCell(0)`, a full writable
> `Location<number>` used only as an internal version counter and bumped through
> `deriveLocation`. After the lazy-`Set` fix it still costs ~1,409 B/entity,
> while v14 adds nothing at the analogous transition. The question was whether a
> minimal internal cell could be dramatically smaller.
>
> Each wrapper layer measured cumulatively, 100k each, quiesced, replicating
> what `createWritable` adds in the order it adds it:
>
> | layer                               | B each | delta |
> | ----------------------------------- | -----: | ----: |
> | L0 closure over `value`             |    153 |     — |
> | L1 + Angular signal                 |    386 |  +233 |
> | L2 + token, 2 closures              |    634 |  +248 |
> | L3 + `SourceRecord` + WeakMap entry |    724 |   +90 |
> | L4 + binding, 3 closures            |    956 |  +232 |
> | L5 + binding registry entry         |    998 |   +42 |
>
> **The remaining ~1 KB is several small costs, not one dominant object.** No
> layer exceeds 248 B. The simulation accounts for 998 B of the measured
> ~1,409 B; the unattributed ~411 B is `markTreeCell`, the `Location` wrapper
> itself and the owning `Map` entry, and is not broken down further here.
>
> Then each layer was checked against its callers:
>
> | layer          | removable for an internal cell?   | why                                             |
> | -------------- | --------------------------------- | ----------------------------------------------- |
> | Angular signal | no                                | it is the reactive carrier                      |
> | token          | no                                | how observers subscribe                         |
> | binding        | no                                | `deriveLocation` resolves through it            |
> | registry entry | no                                | `WRITABLE_LOCATION_BINDINGS` is that resolution |
> | `SourceRecord` | **only if provably unobservable** | 90 B                                            |
>
> `bumpSubjectStateSignal` calls `deriveLocation`, which looks the binding up in
> `WRITABLE_LOCATION_BINDINGS` — so the binding and its registry entry are load
> bearing, not incidental. The only candidate is the `SourceRecord` at 90 B per
> cell, roughly 180 B/entity across both registries, against a 2,830 B residue.
>
> **Verdict (SUPERSEDED — see the amendment below): specializing the internal
> cell is not worth it.** The residue is
> structurally two full `Location`s per realized subject, and every layer has a
> real caller. Wrapper-slimming cannot reach the <2,000 B milestone.
>
> That redirects the question rather than closing it. Getting materially below
> 2,000 B/entity means not creating a full `Location` per subject at all — a
> tiny durable semantic record, with a native carrier materialized only while
> observation requires one. That is the deferred architecture, and this result is
> the argument for it: the cost is not waste inside the cell, it is that there
> are two permanent cells.
>
> #### AMENDMENT — built anyway, and it pays 121 B/entity
>
> The verdict above priced a hypothetical: specializing the internal cell into a
> distinct minimal type. What the ceiling probe actually required was one
> boolean parameter on `createWritable` plus one frozen shared
> `UNOBSERVABLE_SOURCE`, so `createCell` skips per-source registration entirely.
> The cost side of the trade was much smaller than the thing I had priced, so
> the verdict flips. The benefit side also came in BELOW my own prediction —
> 121 B/entity measured against ~180 B predicted from the 90 B-per-cell layer
> table — so this is a smaller win reached by a much cheaper route, not a
> vindication of the estimate.
>
> Two builds, differing only in that parameter, five interleaved repetitions
> each. Nothing is held; what is measured is registry residue:
>
> | stage         | base | min  | delta | base spread | min spread |
> | ------------- | ---: | ---: | ----: | ----------: | ---------: |
> | untouched     |  488 |  488 |     0 |           0 |          0 |
> | `byId` only   | 2043 | 2035 |    -8 |           1 |          0 |
> | node called   | 3587 | 3467 |  -120 |           1 |          0 |
> | + all fields  | 3591 | 3470 |  -121 |           0 |          2 |
>
> The harness is effectively deterministic at this size — spread is at most 2 B
> across five runs — so both deltas are signal, including the small one.
>
> **The saving is not a threshold artifact.** Re-run at N = 5,000 / 10,000 /
> 20,000 the per-entity saving is 120 / 121 / 121 at full realization and
> 10 / 8 / 8 at `byId` only. A `SOURCES` WeakMap crossing a table-doubling
> boundary would swing with N; these do not.
>
> **What the registration counts show.** Counting `createCell` and
> `registerIntrinsicMutationSource` in an instrumented copy of the base build:
>
> | stage       | `createCell` / entity | registrations / entity |
> | ----------- | --------------------: | ---------------------: |
> | `byId` only |                     1 |                      4 |
> | node called |                     2 |                      5 |
>
> So `byId` alone registers four mutation sources per entity and only one of
> them is a `createCell`; invoking the node adds a fifth. At full realization
> `min` removes two of five, which at ~60 B per retained registration accounts
> for the measured 120 B exactly.
>
> **That mechanism does not explain the `byId` row, and I am not going to
> pretend it does.** Removing one of four registrations should save ~60 B by the
> same arithmetic; it saves 8. Three candidate explanations were tested and
> killed: it is not cell count (counted: 1 per entity), it is not a transient
> uncached cell from the `subjectId === undefined` branch (counted: zero
> transient — every entity cell is cached and retained), and it is not WeakMap
> table doubling (stable across three sizes). The 8 B is real, reproducible and
> unattributed.
>
> **This does not reach the milestone and does not revive wrapper-slimming.**
> Residue at full realization moves 2,831 -> 2,709 B/entity against a <2,000 B
> target. The paragraph above still stands: the cost is that there are two
> permanent cells per realized subject, and the deferred architecture is still
> the only route below 2,000 B.
>
> CPU is unchanged — `entity-updateOne-10k` 2.02x both sides, `scalar-set`
> 1.40x -> 1.36x against an A/A band of +-2.1%, which is at best marginal and is
> not claimed as an improvement.
>
> The contract that makes this safe is pinned in
> `intrinsic-mutation-pay-for-use.spec.ts`: the unobservable source is SHARED,
> so it is frozen and an attempt to install an observer on it throws rather than
> silently wiring every internal cell in the process to one callback. There is
> no test that observes a cell directly, because no caller can reach one — that
> unreachability is precisely what licenses the optimization.
>

> ### `FIELD-SOURCE-PAYFORUSE` — real ceiling, NOT shippable as a deletion
>
> Instrumenting registration call sites answered a question the byte totals
> could not. Per entity, `byId` alone registers FOUR mutation sources, and only
> one is a `createCell`:
>
> | source                                     | count / entity | created at |
> | ------------------------------------------ | -------------: | ---------- |
> | field carrier (`createWritableProjection`) |    1 per field | `byId`     |
> | entity value cell (`createCell`)           |              1 | `byId`     |
> | subject activation cell (`createCell`)     |              1 | node call  |
>
> The field carriers are created EAGERLY — every field of every row `byId`
> touches, read or not. Reading all fields afterwards adds 3 B/entity
> (3,467 -> 3,470), which is the measurement that proves they already existed.
>
> A ceiling probe made projections unobservable and measured `byId`-only
> residue against field count:
>
> | fields |  min | ceiling | delta | per field |
> | -----: | ---: | ------: | ----: | --------: |
> |      1 | 2007 |    1954 |   -53 |       -53 |
> |      3 | 2212 |    2106 |  -106 |       -35 |
> |      6 | 2412 |    2202 |  -210 |       -35 |
> |     12 | 3024 |    2604 |  -420 |       -35 |
>
> So ~35 B per field, linear, and it scales with entity WIDTH rather than with
> entity count — ~420 B/entity on a twelve-field row.
>
> **It cannot be taken as a deletion. The capability is live.** A direct
> `field.set(...)` notifies the field's intrinsic observer, confirmed through a
> real Angular adapter and now pinned by
> `native-projection-observability.spec.ts`.
>
> **The dangerous part is how nearly this shipped.** Under the ceiling probe the
> entire kernel suite passed — 278 files, 2,346 tests — because a kernel tree
> built through `signalTree` falls through to `NEUTRAL_LOCATION_RUNTIME`. Before
> that spec, NO test in this repository executed
> `native-location-realization.ts`; the file every framework realization depends
> on had zero direct coverage, so removing a live capability from it was silent.
> That is the same neutral-fallback trap that invalidated `bench-entity-layers`,
> reappearing as a test-coverage hole rather than a benchmark hole.
>
> An interim probe reported the observer NOT firing and briefly looked like
> evidence the registration was dead. That was the probe's error, not the
> product's: Angular `WritableSignal`s are written with `.set(v)`, and calling
> `field('v')` is a READ that returns the old value. Recorded because the wrong
> version of that probe would have justified the deletion.
>
> **Open question, deliberately not asserted as a defect.** `updateOne` and
> `setAll` change a field's value WITHOUT notifying that field's intrinsic
> observer, while a direct `set` does. That may be correct by design — those
> writes are captured at entity granularity — but it has not been verified
> against the capture contract, so it is recorded as a question.
>
> **Route, not taken here.** Capturing the 35 B/field means registering lazily,
> on first observation, instead of at creation. The write path currently reads
> `mutationSource.observer` from a captured object; any lazy scheme must let an
> already-built closure see a source created later, which costs an indirection
> on EVERY write — the exact cost the source-holding design was adopted to
> remove. That is a CPU/memory trade needing its own measurement, and it is not
> attempted here.
>

> ### `SUBJECT-STATE-SEMANTIC-0` — the activation carrier is now held weakly
>
> #### First, a correction to the anchor above
>
> The residue figures published as `2,831 -> 2,709 B/entity` DO NOT REPRODUCE on
> `tools/bench-entity-realization-matrix.mjs`. Measured there, the angular
> `released` column is **3,591 B/entity before `SUBJECT-STATE-MINIMAL-0` and
> 3,470 after**. The -121 B delta was right; the absolute anchor was not, and
> everything below is quoted on the matrix scale. Two independent harnesses
> agree on it (an ad-hoc probe and the matrix both return 2,222 for this
> change), so the matrix scale is the one to trust. Where the earlier 2,830
> figure came from could not be reconstructed.
>
> #### What it does
>
> `subjectStateSignals` holds a `WeakRef<Location<number>>` instead of the
> `Location` itself, and the node closure captures its own carrier on first read
> and becomes the strong retainer.
>
> The reason this is safe is narrower than "weak realization works": **this
> carrier has no durable semantic value.** Its number is a nonce. Nothing reads
> it; `currentKey` only subscribes to it, and the durable truth it stands for is
> `structuralStore.subjectRevision`, which already existed and was already paid
> for. So there is no state to persist and nothing to restore — only a carrier
> to FIND while something is still listening. A replacement can start back at 0
> precisely because no observer survives that could compare against the old
> count.
>
> #### Measured — matrix `released`, matched builds, same session
>
> | row               | before |   SS0 | delta  |
> | ----------------- | -----: | ----: | ------ |
> | angular           |   3470 |  2222 | -1,248 |
> | vue               |   4399 |  2687 | -1,712 |
> | kernel (neutral)  |   3715 |  2475 | -1,240 |
>
> Deterministic: three repetitions per arm, spread of at most 1 B. The absolute
> floor — the registry made entirely free, semantics broken — is 2,036 B, so the
> `WeakRef` plus its `Map` entry cost 183 B/entity over that floor.
>
> #### CPU — RETRACTED: there is no regression
>
> This section previously reported `updateOne` +4.1% "no overlap", attributed to
> an extra `WeakRef.deref()` per mutation. **Both halves of that were wrong.**
>
> The mechanism claim was false on inspection: `updateOne` takes the
> `commitExistingSubjectValue` fast path, which calls neither
> `publishSubjectPhysicalChange` nor `bumpSubjectStateSignal`, and the benchmark
> arm realizes no nodes, so `subjectStateSignals` is EMPTY throughout. Counters
> in an instrumented build confirm it: over 200,000 `updateOne` calls,
> `bumpSubjectStateSignal` runs 0 times and `getSubjectStateSignal` runs 0
> times. The changed code never executes in that arm.
>
> The number was an artifact of the harness, not of the change. Re-measured as
> a focused paired test — one workload per process, 20 pairs, run in BOTH orders
> to control for ordering:
>
> | build | median | mean  | min   | max   |
> | ----- | -----: | ----: | ----: | ----: |
> | base  |  291.0 | 294.5 | 284.6 | 380.7 |
> | SS0   |  290.7 | 291.6 | 282.2 | 310.7 |
>
> Median delta **-0.3 ns (-0.1%)**, ranges fully overlapping, and SS0 is
> marginally ahead in both orderings.
>
> The lesson is about the protocol, not this change. The original A/B rebuilt
> between arms and ran every workload in a single process, so what looked like
> clean separation — base readings 0.1% apart, ranges not overlapping — was
> cross-run state, not a property of the code. Non-overlapping ranges across two
> runs of a multi-workload harness are NOT a paired measurement, and this is the
> second time in this program that an apparently tight band came from comparing
> arms that were not measured under the same conditions.
>
> So the memory win carries no CPU cost. `scalar-set` and `setAll-10k` were
> flat in the original A/B and nothing here disturbs that.
>
> #### The tests, and what they could NOT prove
>
> Ten tests in `subject-state-weak-realization.spec.ts`, under the real Angular
> adapter with forced GC (`--expose-gc` is now on the angular test target,
> because a weakly held carrier has no observable behaviour without a real
> collection). A CONTROL test asserts an unreferenced carrier is actually
> reclaimed — without it every other test could pass vacuously.
>
> Covered: held node still updates; held field carrier still updates; a live
> reactive observer prevents collection and never goes stale; a re-added key
> does not retarget a held reference; `field.set` authors through a recreated
> carrier; mutations made while nothing is realized are visible on re-
> realization; optimistic transaction state stays visible across a collection;
> rollback compensates through the same held carrier.
>
> **Mutation proof, and its limit.** Against the old STRONG map, three tests
> fail — the reclamation claims are real. Against a NAIVE weak variant that
> mints a replacement without checking liveness — the stale-realization trap
> this design was supposed to guard against — **all ten tests pass.** Two
> separate discriminating constructions were attempted and neither separated
> them.
>
> The likely reason is structural, and it is stated here as reasoning, NOT as a
> proven property: no public observer depends on the activation carrier alone.
> Reading a node evaluates `currentKey` AND the entity value cell, so a
> structural bump delivered to the wrong carrier is masked by the value cell's
> own invalidation. If that is right, the liveness check is defensive rather
> than load bearing. It is kept regardless — it costs nothing and it stops the
> registry minting a fresh `Location` per node — but nobody should believe the
> test suite has proved it.
>
> #### Against the preregistered criteria
>
> `<2,000 B/entity` was the "worth pursuing" gate and this lands at **2,222 B**,
> so on the literal number it falls short. On the other stated criterion —
> "removes 700-1,500+ B/entity means the correct physical model" — -1,248 B is
> inside the band, and the shape of the result supports the thesis: the cost was
> fixed per realized subject, not proportional to field count.
>
> `entitySignals` is untouched and is the next candidate; it is the same
> `createCell` shape, but unlike this one it DOES carry a durable value, so the
> same trick does not transfer unchanged.
>

> ### `ENTITY-SIGNAL-SEMANTIC-0` — NEGATIVE: reverted, and it qualifies the win above
>
> The prize was real and large. Held weakly, `entitySignals` measures
> **974 B/entity** released, down from 2,222 — another **-1,248 B**, and below
> the 1 KB "excellent" mark. The absolute floor with neither registry retaining
> anything is 819 B, so two weak registries cost 155 B/entity over ideal; a
> single bundled per-subject handle could recover at most that 155 B and
> realistically about half, which is the bound on that idea and the reason it
> was not built.
>
> The audit that motivated it holds up: `getEntitySignal` already seeds every
> cell from `valueStore.backingForSubject(subjectId)`, so the carrier was always
> a realization of `EntityValueStore` and never the durable record. Nothing
> needed a new semantic record.
>
> **It is reverted anyway, because the retention assumption is false.**
>
> Weakly held, four tests failed: a held field carrier stopped updating, a live
> observer went stale, rollback compensated into the wrong carrier. Adding a
> strong retainer in the node closure — the carrier pinned by whichever node or
> field holds it — fixed three. The fourth is not fixable this way.
>
> Measured directly, three holder shapes across a forced GC:
>
> | holder                              | carrier survives? |
> | ----------------------------------- | ----------------- |
> | nothing held                        | no (as designed)  |
> | computed CLOSING OVER the node      | yes               |
> | computed re-resolving via `byId`    | **NO**            |
>
> **A non-live Angular `computed` does not retain its producers.** So an
> observer can depend on a carrier, the carrier can be collected anyway, a
> replacement is minted from canonical truth, writes land in the replacement,
> and the original observer is orphaned — reading a value frozen at the instant
> of collection, with no way to reach it and invalidate it.
>
> That breaks the premise the whole approach rested on. The earlier claim that
> "a live Angular consumer retains its producers, so a carrier anything still
> observes is still reachable" is TRUE only for a consumer that retains the
> node. It is false for the plain `computed(() => rows.byId(k)?.()?.x)` shape,
> which is ordinary application code.
>
> Any reclamation of this carrier changes reactive behaviour for that shape, so
> it is a semantics decision rather than an optimization, and it is not taken
> unilaterally.
>
> #### This qualifies `SUBJECT-STATE-SEMANTIC-0`
>
> That change is safe **only while `entitySignals` stays STRONG.** The activation
> carrier has the same reachability hole, but a structural change reaches a
> non-retaining observer through the entity VALUE cell — `tombstoneSubjectSignal`
> publishes `undefined` into it — and that cell is permanent. Remove that path
> and both carriers go stale together, which is exactly what the four failures
> showed.
>
> The coupling is load bearing and non-obvious, so it is pinned: "a re-
> realization reuses the carrier a live observer depends on" in
> `subject-state-weak-realization.spec.ts` fails the moment `entitySignals`
> becomes weak. That test does NOT discriminate the naive weak subject-state
> variant it was written for; catching this is what it is actually for.
>
> ### Registry mapping PROVEN, and one pay-for-use fix shipped
>
> The mapping is now measurement rather than inference. Counting entries per
> stage, 1,000 entities:
>
> | stage             | `entitySignals` | `subjectStateSignals` |
> | ----------------- | --------------: | --------------------: |
> | after `setAll`    |               0 |                     0 |
> | after `byId` only |       **1,000** |                     0 |
> | after node called |           1,000 |             **1,000** |
> | after field read  |           1,000 |                 1,000 |
>
> So `entitySignals` is the +1,570 B step and `subjectStateSignals` the
> +1,561 B step, confirmed by which map gains entries at which call.
>
> **What a Location costs against what it wraps** (100k each, quiesced):
>
> | primitive                 | B each |
> | ------------------------- | -----: |
> | raw Angular `signal()`    |    386 |
> | signal + strong Map entry |    413 |
> | `computed()`              |    674 |
> | **empty `Set()`**         |    161 |
>
> A Location is ~1,570 B against a 386 B signal — about 1,184 B of wrapper per
> cell: token object and its two closures, the binding and its three, a WeakMap
> entry, a `SourceRecord`, and an empty `Set`.
>
> **The `Set` was the reachable part.** `registerIntrinsicMutationSource`
> allocated one eagerly per source, and a realized entity registers two sources,
> so a bare tree paid 2 x 161 B for sets that never receive an observer. Made
> lazy — created on first `observeIntrinsicMutations`:
>
> | arm (released) |  before |   after |
> | -------------- | ------: | ------: |
> | untouched      |   489 B |   489 B |
> | `byId` only    | 2,059 B | 1,907 B |
> | node called    | 3,620 B | 3,316 B |
> | all fields     | 3,623 B | 3,319 B |
>
> **-304 B/entity**, exactly 2 x 152, matching two sources per entity. Durable
> residue 3,134 -> 2,830 B above untouched, a 9.7% cut. `scalar-set` unchanged
> at 1.42x with a ±0.3% A/A band, so nothing moved on CPU — the lazy check is on
> the install path, and the hot path still reads one field.
>
> Remaining per cell: the Angular signal itself (386 B) plus ~1,000 B of
> token/binding/registry wrapper. That wrapper is the next target, and unlike
> the `Set` it is not obviously removable — each piece has a caller.
>
> The 386 B is a **lower bound for the current permanent-native-carrier design,
> not an absolute floor.** An architecture that kept a tiny durable semantic
> record and materialized a native carrier only while observation required one
> would not pay it per subject. That is a separate, later experiment; do not
> fold it into wrapper-slimming.
>
> ### Released-memory attribution, adapter-bound — the residue is TWO registries
>
> Every arm below drops all node references before measuring. What differs is
> how far realization got first, so each step's increment is what SURVIVES
> release rather than what it costs while held.
>
> | arm (released)   |            v14 |      v15 Angular |       v15 kernel |
> | ---------------- | -------------: | ---------------: | ---------------: |
> | untouched        |          131 B |            489 B |            488 B |
> | `byId` only      |   560 B (+429) | 2,059 B (+1,570) | 2,332 B (+1,844) |
> | node called once | 560 B (**+0**) | 3,620 B (+1,561) | 4,166 B (+1,834) |
> | one field        |          562 B |          3,622 B |                — |
> | all three fields |          562 B |          3,623 B |                — |
>
> **Field carriers leave nothing durable: +2 B and +1 B.** The whole residue is
> two per-subject registrations, and they are the two strong `Map`s at
> `entity-signal.ts:627` and `:630`:
>
> ```ts
> const entitySignals = new Map<number, Location<E | undefined>>();
> const subjectStateSignals = new Map<number, Location<number>>();
> ```
>
> Keyed by SubjectId and strongly held, while the node itself is a `WeakRef`:
> the node becomes collectable, the realization state does not.
>
> **NOT yet proven: which increment belongs to which registry.** The two steps
> line up with the two maps, but that is inference from the order realization
> happens in, not measurement. Pin it by counting map entries per arm and by
> suppressing each registration independently.
>
> **Also NOT established: that this explains the zero WeakRef misses.** An
> earlier draft said so. It does not follow — the public node is still weakly
> held, and these maps retain their own realization objects rather than the node.
> Zero reconstruction in the tight loop may simply mean GC never reclaimed the
> weak node during that workload. Two separate findings; keep them separate.
>
> **v14 adds ZERO durable bytes on first node invocation (560 -> 560).** The
> activation cell is a v15 structure with no v14 counterpart, and it costs
> 1,561 B/entity permanently. Total durable residue: v15 3,134 B against v14
> 431 B per entity, 7.3x.
>
> **E4 no longer reproduces under the current harness and build.** It puts these
> two cells at about 356 B each, roughly 712 B/realized subject. Measured here:
> 1,570 + 1,561 = 3,131 B adapter-bound and 1,844 + 1,834 = 3,678 B on the
> neutral path E4 itself used. Stated as staleness, not as historical error —
> implementation or protocol may have changed since E4, and establishing which
> needs its original fixture re-run against this commit. Either way its numbers
> should not be quoted until reproduced.
>
> No optimization attempted. Note before one is: E4 explicitly tested naive
> `WeakRef`s for these cells and REJECTED them after forced GC produced stale
> UI, and the forced-GC durability laws in that document remain binding. The
> question worth asking is not "can these be weak" — that is answered — but
> whether 1,561 B is the true cost of an activation cell or whether the cell is
> retaining more than its semantic job requires.
>
> ### `setAll` as amplifier — it found a pay-for-use violation
>
> First, the arm was measuring the wrong thing, the same defect as the
> field-read arm: `entity-setAll-10k` creates AND destroys a tree per op.
>
> | arm                       |      v15 |     v14 |    ratio |
> | ------------------------- | -------: | ------: | -------: |
> | construct + destroy only  |  0.02 ms | 0.00 ms |        — |
> | create + setAll + destroy | 11.29 ms | 1.30 ms |     8.7x |
> | **setAll only, reused**   |  4.49 ms | 1.22 ms | **3.7x** |
>
> Construction is free. The gap is between populating a FRESH collection and
> replacing entities that already exist — v15 pays 2.5x more for the first
> population, while v14 barely distinguishes them (1.30 vs 1.22).
>
> Profiling the two separately:
>
> |                   |     fresh | reused |
> | ----------------- | --------: | -----: |
> | ms/op             |     15.35 |   4.95 |
> | `structuredClone` | **25.6%** | absent |
> | `setAll` self     |     16.4% |  51.5% |
>
> Instrumenting `deepClone` gives the mechanism exactly: **10,000 clones on the
> first `setAll`, 0 on the second, 0 on destroy** — one per entity, from
> `setAll`'s own `map`. The call site is `entity-signal.ts:3358`, building a
> causal `kind: 'add'` effect with `value: deepClone(entity)`. A second site at
> `:3250` does the same for `kind: 'remove'`. First population is all adds;
> repopulation is replacements, which build neither.
>
> **The benchmark tree has no enhancers configured.** No restoration, no
> transactions, no causal retention, no Studio. Those 10,000 deep clones build
> effects nothing retains — the same pay-for-use violation as the per-write
> observer probe fixed earlier, at 25.6% of a bulk load instead of 5.7% of a
> write.
>
> #### `EFFECT-VALUE-PAYFORUSE` — ATTEMPTED AND REVERTED
>
> The mechanism works; the capability gate was wrong, and the wrong gate is the
> whole finding.
>
> Consumer audit found five clone sites, all genuine `add`/`remove` structural
> effects (two in `setAll`, the rest in `addOne`/`removeOne`), and these
> readers:
>
> | consumer                                     | reads `.value`         | exists when              |
> | -------------------------------------------- | ---------------------- | ------------------------ |
> | `tree-realization-adapter.ts:1270,:1488`     | YES                    | restoration/transactions |
> | `restoration.ts:3151`, `transactions.ts:945` | in-enhancer            | mutation-capture         |
> | `path-notifier.ts` (runs on EVERY tree)      | no — kind/subject only | always                   |
>
> That argued for gating on `mutation-capture`. Implemented as a
> construction-time choice (`captureEffectValue`, resolved once, effect still
> built and only its payload withheld), it type-checked and passed 2,342 of
> 2,343 tests.
>
> **The failure is the useful part.** `marker-location-grammar.spec.ts`
> "persistence() — the durable path the stored leak actually reached" serialized
> `[{'§u': true}]` — an undefined placeholder — where the entity belonged. So a
> `persistence()` tree, which has no `mutation-capture`, DOES depend on those
> payloads. Forcing the option back to `true` makes it pass, which isolates the
> gate VALUE as wrong rather than the mechanism.
>
> The path is not yet understood: `serialization.ts` never references
> `structuralEffect` and does not subscribe to structural notifications, so the
> dependency is indirect. Reverted rather than shipped behind a gate that cannot
> be explained.
>
> To finish it: bisect the five sites to find which one persistence depends on,
> trace how a payload reaches the durable snapshot, then gate on a capability
> that actually covers every consumer — or move the clone to the consumer, which
> would make the question moot. The prize is unchanged: 25.6% of a fresh bulk
> load, and `addOne` is on the same path.
>
> ### Realized entity memory, attributed by stage — Angular vs v14
>
> Same fixture and quiescence protocol as the realization matrix, 10k entities,
> 3 fields, one process per arm, every arm WeakRef-collectable.
>
> | stage                 |     v14 |     v15 | v15 increment |
> | --------------------- | ------: | ------: | ------------: |
> | untouched             |   131 B |   489 B |             — |
> | node created and held | 2,838 B | 6,093 B |    **+5,604** |
> | + first field read    | 2,987 B | 7,885 B |    **+1,792** |
> | + two more fields     | 3,277 B | 8,335 B | +450 (225 ea) |
> | nodes released        |   562 B | 3,624 B |             — |
>
> **The node object dominates, not the field carriers.** Holding a row costs
> +5,604 B/entity before a single field is read — 2.07x v14's +2,707 B.
>
> **The FIRST field read costs 1,792 B; the next two cost 225 B each.** v14's
> first field costs 149 B. That 12x gap on field one against 1.55x on fields two
> and three says the cost is one-time per node, not per field: something
> expensive is realized on first access and then amortized.
>
> **The residue after releasing every node is the number that matters for a
> scrolling grid: 3,624 B vs v14's 562 B.** Dropping all row references leaves
> v15 holding **3,135 B/entity above its own untouched baseline**, against v14's
> 431 B — 6.45x. A long-lived list that scrolls through rows accumulates this,
> and it is invisible to any arm that only measures held nodes.
>
> That figure also does not match the recorded attribution. `E4` in
> [entity-physical-density.md](./entity-physical-density.md) puts the
> released-realization residual at about 356 B for the `entitySignals` entry plus
> 356 B for the `subjectStateSignals` activation cell — roughly 712 B/realized
> subject. Measured here at 3,135 B, 4.4x that. The likely reason is the same one
> that invalidated the entity density bisect: **E4 ran on the neutral kernel
> path**, and these arms run through the Angular adapter. E4's attribution should
> be re-run adapter-bound before it is quoted for any framework.
>
> ### Entity field read — the arm was measuring the wrong thing
>
> `entity-byId-field-read` conflated three different economic questions:
> `byId` key lookup, node realization, and the field read itself. Profiling it
> showed `get` 26.1%, `getOrCreateNode` 10.3%, `byId` 9.3% — acquisition, not
> field access — and `registerIntrinsicMutationSource` appearing inside a READ
> loop. Calling that composite "field read" attributed a gap to field access.
>
> Split into `entity-field-read-held` (the real hot UI read, row already held)
> and `entity-byId-warm` (lookup with every node retained so the cache cannot
> miss).
>
> **A third hypothesis was falsified by counters.** Both the composite arm and
> its profile suggested nodes were being reconstructed. Instrumenting the node
> cache says otherwise: over 2,000,000 reads with nothing retained,
> **0 reconstructions, 0 WeakRef misses, 2,000,000 hits.** The WeakRefs never
> clear inside a tight loop, so that arm does not measure churn either. The
> counter was self-tested — after a forced collection `built` rises 1 -> 2 — so
> the zero is real and not a dead probe.
>
> So "entity field reads are slow" and "entity node reacquisition is slow" are
> BOTH currently unsupported.
>
> **The new arms are not yet trustworthy.** Their A/A bands are ±31.5% and
> ±26.7%, well outside this harness's own "if the ranges overlap there is no
> result" rule, and they disagree with a sandbox measurement of the same
> decomposition (held read 1.19x and warm byId 1.22x there, 2.85x and 1.07x
> here). The machine had been under sustained benchmark load for hours. Re-run
> both on a quiet machine before quoting either.
>
> **Do NOT make the node cache strong on this evidence.** There is none that
> reconstruction is happening, and Angular held entity nodes measure ~6,396
> B/entity — a strong cache would trade nanoseconds for megabytes. If a real
> churn workload later shows reconstruction cost, the interesting shape is a
> cheap durable identity shell with field carriers still lazy, not whole-node
> retention.
>
> ### Entity publication residue — NEGATIVE / NOT TAKEN
>
> The 7.6% `native-location-realization` slice was ceiling-probed and is not
> worth building.
>
> **Direct-publish on the entity location: ~0-3 ns.** Replacing
> `publish([binding])` with `realized.commit(next)` measured 365.9 vs 363.6 ns
> median, 2/2 directional split, one arm a 407.9 outlier. The reason it cannot
> help is structural: `updateOne` calls `replaceLocation` INSIDE
> `locations.runInvalidationGroup`, so `publish` already takes the
> `invalidationGroupDepth > 0` branch and defers rather than reading back. The
> read-back the scalar work removed is not on this path at write time.
>
> That probe also bypassed grouping to get its number, which a shippable version
> could not do. **Do not copy the scalar direct-publish shape here**: the
> requirement is to push at DELIVERY time, not at write time, or coherent
> grouping is lost.
>
> **Lazy `errors[]` in `deliver`: no measurable signal.** 2/2 split, and that
> run was far noisier than its neighbours (356-469 ns against a 334-403 ns
> cluster elsewhere). Recorded as below noise rather than as a win.
>
> **The pending-snapshot copy in `updateSignals` is NOT taken, deliberately.**
> A combined probe removing both allocations measured ~24 ns across 4/4 pairs,
> so a prize plausibly exists there. But the probe iterated
> `pendingEntitySignalValues` live, and that is not a safe replacement for
> `[...pending]` + `clear()`. The copy is a SNAPSHOT: `replaceLocation` notifies
> intrinsic mutation observers, an observer can call back into the tree, and a
> callback reaching `syncEntitySignal` enqueues into the same map. Live
> iteration would process a reentrant enqueue in the same turn, or clear one
> that should have survived to the next.
>
> Every safe snapshot design considered trades the array allocation for a `Map`
> allocation — swap-and-replace, double buffer — so the measured prize may not
> survive the safe implementation. Combined with a machine too noisy to resolve
> 20 ns today, this is left open rather than shipped. **Do not trade the
> publication snapshot boundary for an unmeasured allocation saving.**
>
> ### `DIRECT-PUBLISH-0` — SHIPPED (groundwork, NOT `NATIVE-STORAGE-0`)
>
> Named apart from `NATIVE-STORAGE-0` on purpose. This removes the redundant
> READ between the two stores; the second physical copy of a committed scalar
> still exists. A later reader must not conclude single-storage was evaluated
> and shipped.
>
> The general rule it establishes, which entity realization should inherit:
>
> > **Do not invalidate a native carrier just so it can pull back a value
> > SignalTree already holds. Push the committed value directly wherever
> > semantics allow.**
>
> A scalar write used to store twice and read once in between: the kernel
> assigned its slot, then `token.invalidate()` called the cell's `read()`
> closure — dormancy check, `assertSlotIndex`, stats, array read — to fetch the
> value the caller already had, and assigned the framework cell. The adapter
> contract now carries an optional `commit(next)`; Angular supplies it, and the
> `replace` path publishes the committed value directly.
>
> Paired against the pre-change build, control alternated, order flipped:
>
> | pair |  before |       after |
> | ---- | ------: | ----------: |
> | 1    | 28.4 ns | **16.0 ns** |
> | 2    | 24.4 ns | **15.3 ns** |
> | 3    | 23.4 ns | **15.8 ns** |
> | 4    | 22.3 ns | **14.5 ns** |
>
> 4/4, about **8.4 ns — a 35% cut**, and slightly past the 17.08 ns simulated
> ceiling.
>
> | workload      |     v15 |     v14 |     ratio |
> | ------------- | ------: | ------: | --------: |
> | `scalar-read` |  7.7 ns | 10.5 ns | **0.74x** |
> | `scalar-set`  | 14.5 ns | 10.3 ns | **1.41x** |
>
> `scalar-set` across the session: **2.77x -> 2.15x -> 1.41x**. `scalar-read`
> beats v14. Entity arms are unchanged, as expected — this touched scalar leaves
> only.
>
> **Cost, stated:** +16 B/leaf (1,801 -> 1,817 at 100k leaves, quiesced). The
> adapter must capture `cell.set` BEFORE the leaf replaces it with the
> intercepted write, so each leaf holds the pre-interception setter. Calling
> `cell.set` instead would re-enter the interception. 8.4 ns per write against
> 16 B per leaf is the trade.
>
> **The second copy still exists.** The kernel continues to own `values[slot]`;
> only the redundant read was removed. Eliminating the copy means the kernel no
> longer owning scalar truth, which reaches frames, snapshots, restoration
> replay and transactions — a large refactor whose remaining measured prize is
> the ~4.3 ns between 14.4 and v14's 10.1, minus whatever equality against the
> cell costs in place of equality against the array. Recorded as available, not
> as obviously worth it.
>
> **1.43x is not a failure state.** v14 is the economic floor and carries weaker
> semantics — its keys ARE identity. The residual is worth understanding, but it
> does not outrank `entity-updateOne` at 2.56x or `entity-setAll` at 10.25x.
>
> Validation: kernel `277` files / `2332`, Angular `22` / `129`, gates green.
> The `native-storage-0-contract` and `compensation-provenance` specs pin the
> semantics this had to preserve.

> Still open: against a rebuilt `851f496e`, whether the old
> `Object.assign(computed, { set })` was a true writable carrier. That decides
> whether the neutral-path spend is a purchase (real writable identity) or an
> accident. The matrix does not answer it — every historical point is
> neutral-path, so no framework row exists before `5efeb7f5`.

## Read this before comparing anything to anything

**Machine load moves these numbers more than most code changes do.** In one
session, on a single unchanged build, `entitymap-setAll` measured 17.5 ms,
18.6 ms, 27.1 ms, 30.2 ms, 49.6 ms and 66.1 ms — a 3.8x spread with no code
between the runs. Two consequences, both learned the expensive way here:

1. **Never compare two builds measured at different times.** A sequential
   before/after produced an apparent 21% `setAll` regression and a 50%
   `updateOne` regression that both vanished under interleaving; the same
   method later produced an apparent 30% _improvement_ in the other direction.
   Interleave the arms — build A, build B, build A, build B — in one run.
2. **Quote the absolute and the spread, never the ratio alone.** A ratio of two
   sub-millisecond medians is a statement about the load at that moment.

`tools/bench-public-collection-layers.mjs` and `tools/bench-vs-signalstore.mjs`
both report min/max alongside the median for this reason. If the ranges overlap,
there is no result.

## Operation cost — `tools/bench-public-collection-layers.mjs --samples 9`

n = 10,000 entities, one child process per arm, median of 9.

| arm                                  |   median | what it is                        |
| ------------------------------------ | -------: | --------------------------------- |
| `plain-array-construct`              |  1.60 ms | 10k rows as a plain array leaf    |
| `entitymap-declare`                  |  0.72 ms | declaration, no population        |
| `entitymap-setAll`                   | 18.16 ms | initial population                |
| `entitymap-addMany`                  | 18.14 ms | initial population                |
| `entitymap-updateOne`                |  0.19 ms | one field of one row of 10k       |
| `entitymap-updateOne-dependent-read` |  0.33 ms | update plus a dependent read      |
| `entitymap-addOne`                   |  0.19 ms | structural                        |
| `entitymap-removeOne`                |  0.31 ms | structural (includes reclamation) |
| `entitymap-changeId`                 |  0.24 ms | structural                        |
| `entitymap-projection-all`           |  1.28 ms | full projection read              |
| `entitymap-projection-ids`           |  0.30 ms | id projection                     |
| `entitymap-projection-asMap`         |  1.46 ms | map projection                    |

`setAll` is consistent with the 17.86-19.64 ms recorded in
[setall-regression.md](./setall-regression.md) after the subject-position
transport deletion. `removeOne` includes zero-owner reclamation on this fixture
(no enhancers configured) and is unchanged from before it — see
[retired-subject-churn.md](./retired-subject-churn.md), "RESOLUTION".

## Live retention — `tools/bench-entity-layers.mjs`

10,000 entities, 3 fields each, quiesced per `tools/lib/heap-quiescence.mjs`,
one process per arm.

| arm                          | retained | per entity | what it isolates                      |
| ---------------------------- | -------: | ---------: | ------------------------------------- |
| `L0-payload`                 |  1.14 MB |      120 B | payload floor, no library             |
| `L1-physical-stores`         |  4.34 MB |      455 B | physical entity stores only           |
| `L2-entity-semantics-nometa` |  4.59 MB |      481 B | entity realization, incl. Angular     |
| `L3-entity-semantics`        |  4.59 MB |      481 B | metadata flags before any node exists |
| `L4-public-entitymap`        |  4.64 MB |      487 B | **the public baseline**               |
| `L5t-nodes-transient`        | 10.06 MB |    1,055 B | residue of a full read, not held      |
| `L5-nodes-held`              | 36.80 MB |    3,859 B | every row node/fields held            |
| `L5m-nodes-held-nometa`      | 36.75 MB |    3,853 B | control for L5                        |

L5 minus L5m is **6-7 B/entity** across runs. The metadata accessors are not a
memory opportunity; see the AMENDMENT in
[capability-authority-audit.md](./capability-authority-audit.md), which
supersedes an earlier ~1,710 B/entity figure.

## Churn retention — `tools/bench-entity-churn-retention.mjs`

1,000 live rows held constant, 50 full key generations.

| arm                 | per retired | note                                   |
| ------------------- | ----------: | -------------------------------------- |
| `no-history`        |         6 B | zero-owner retirement forgets it all   |
| `no-history-reads`  |         6 B | observation costs nothing once retired |
| `time-travel`       |     1,310 B | a restorer exists                      |
| `time-travel-reads` |     1,859 B | restorer plus observation              |

At 150 rounds the two `no-history` arms read **-6 B/retired** — the quiescence
noise floor, not memory being created. Tripling the retirements does not scale
the total, so retention is no longer linear in retired subjects and the
pre-registered criterion in
[entity-churn-retention.md](./entity-churn-retention.md) is MET.

**Do not treat 6 B as the budget.** The claim is the asymptote, and
`tools/check-retired-subject-slope.mjs` gates it by measuring at two subject
counts — 117 B/retired would pass any byte budget stable enough to keep, and
117 B/retired is unbounded growth.

The owned arms are untouched and still grow: 1,310 B/retired at 50 rounds,
1,407 B at 150. History-aware eligibility is a separate problem.

## Workload classes — `tools/bench-workload-classes.mjs`

Counts are ASSUMPTIONS, pre-registered in
[workload-assumptions.md](./workload-assumptions.md); the plus/minus is max-min
across samples, and a delta inside the spread is not a result.

| class              |       N | construct (ms) | steady (ms)   | B/entity |
| ------------------ | ------: | -------------: | ------------- | -------: |
| `POINT_HEAVY`      |  10,000 |     18.23±7.57 | 45.18±37.38   |      468 |
| `PROJECTION_HEAVY` |  10,000 |     14.49±2.80 | 477.44±26.58  |      464 |
| `REACTIVE_FANOUT`  |  10,000 |    14.80±14.31 | 221.24±13.88  |      465 |
| `BULK_LOAD`        | 100,000 |   159.32±24.88 | 283.88±44.02  |      406 |
| `REALTIME`         |  10,000 |     13.73±3.45 | 850.50±252.08 |      466 |

Construct and steady are reported separately on purpose: a read-path change
cannot move construction, so summing them lets construction variance impersonate
a steady-state win.

## Against @ngrx/signals — `tools/bench-vs-signalstore.mjs`

Interleaved arms, median of 9. @ngrx/signals 21.1.1.

| task                                 | SignalTree | SignalStore |
| ------------------------------------ | ---------: | ----------: |
| write one field 10 levels deep       |   0.011 us |    1.109 us |
| update 1 row of 50k + dependent read |   1.075 us |  795.337 us |
| write, then read whole state 10x     |   0.744 us |    2.596 us |
| 50 writes with undo history          |   1.046 us |  311.071 us |

Single-entity update as the collection grows — **the architectural claim**:

| collection | SignalStore | SignalTree |
| ---------: | ----------: | ---------: |
|      1,000 |    13.57 us |   1.331 us |
|     10,000 |    51.47 us |   0.469 us |
|     50,000 |   870.45 us |   0.574 us |

SignalStore is LINEAR in collection size; SignalTree is FLAT. **Quote the shape,
never a multiplier** — the multiplier is a function of n (~10x at 1k, ~1,500x at
50k), so any single value describes the fixture rather than either library.

## Against @ngrx/signals and raw signals — `tools/bench-compare.mjs --n 200`

Each arm implements the same capability with that library own entity API.

| arm            | collection | undo/redo | history     |
| -------------- | ---------: | --------: | ----------- |
| `raw-signals`  |    0.11 ms |   6.76 ms | hand-rolled |
| `ngrx-signals` |    0.63 ms |   4.17 ms | hand-rolled |
| `signaltree`   |    1.22 ms |   1.62 ms | BUILT-IN    |

The collection row includes population, updates, and a complete read, so it is
not a point-update result. SignalTree's built-in restoration is separately
visible from the snapshot histories required by the other two arms. Quote the
shape and absolute values, not one ratio from the smoke size.

## Bundle — `tools/check-bundle-budget.mjs`, `tools/size-report.mjs`

| target                | prod gzip |  budget |
| --------------------- | --------: | ------: |
| `signaltree-bare`     |   9.95 KB | 10.0 KB |
| `signaltree-entities` |  22.01 KB | 22.1 KB |

Bare grew 0.47 KB in 15.0 and it is a design cost, not a diagnostic: declaring
enhancers puts the resolver and the configuration validator on every tree
mandatory construction path. Full attribution is on `signaltree-bare` in
`tools/check-bundle-budget.mjs`. This is **not** a small bundle relative to the
field; do not sell it as one.
