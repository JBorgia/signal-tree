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
