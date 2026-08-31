# Post-RC1 target-state workstream

**Evidence bases**

```text
SignalTree      6c511755  post-RC1 development ancestry
RC1 candidate   4020b7dd  immutable artifact authority
TruckTrax v2    e704f8e78d
TruckTrax v3    d3d9dfd04
```

RC1 remains `@signal-tree/kernel` plus `@signal-tree/angular`. This workstream
does not rebuild, retag, or reinterpret RC1.

## Coordinated questions

```text
REACT-GREENFIELD-0
REACT-OBSERVATION-0
GREENFIELD-APPLICATION-PATTERNS-0
TRUCKTRAX-V2-REACT-MIGRATION-0
TRUCKTRAX-V3-MIGRATION-WEDGE-0
V15-MIGRATION-DOCS-0
LLMS-GUIDANCE-0
```

These share evidence but have separate verdicts. Their order is binding:

```text
greenfield architecture
  -> independent reference implementation
  -> target contract freeze
  -> migration toward the target
  -> documentation of what legacy ownership must change
```

Migration pressure may reveal a missing property, but it never determines the
replacement architecture. TruckTrax v2 and v3 are evidence and validation, not
design authorities. React may remain post-GA without holding v15.

## REACT-GREENFIELD-0

Frozen property:

> React observes SignalTree truth; React does not become another state
> authority.

Question:

> What is the smallest, best long-term React realization of SignalTree if React
> support is designed today with no legacy consumer?

TruckTrax dependencies, Redux idioms, migration diff size, and React Native use
in an existing application are forbidden design premises. They may later
falsify the frozen result.

### Greenfield reference application

The package contract must be earned by a new React application that exercises:

- `signalTree(initialState, { derived, enhancers })`;
- scalar, nested, entity-map, and derived reads;
- writes and coherent multi-location transactions;
- retained entity references across deletion and reactivation;
- observations shared by multiple components;
- StrictMode mount, unmount, and remount;
- subscription cleanup and adversarial render/update ordering;
- stable snapshots with no tearing, mirrored state, or duplicate reactive graph.

React Native is a second greenfield realization test only if the resulting
adapter has no DOM dependency. Existing React Native usage is not evidence for
the package design.

## REACT-OBSERVATION-0

Property:

> A greenfield React application can observe one SignalTree owner through
> coherent publication invalidation while continuing to read canonical
> SignalTree values synchronously.

### Outcomes

```text
R-A  Existing public kernel capabilities are sufficient.

R-B  One neutral owner invalidation fact is genuinely missing.

R-C  Correct React support requires a larger mechanism.
```

React's reference model is `useSyncExternalStore`: one `getSnapshot`, one
subscription, stable snapshots, and lifecycle-owned cleanup. Copying values into
`useState` is excluded.

Required controls: StrictMode, cleanup, unmount/remount, multiple observers,
held references, entity deletion/reactivation, derived reads, stable snapshots,
and no tearing. React Native compatibility is a separate runtime result, not a
compile-time inference. SSR is opened only by a real consumer requirement.

### Greenfield reference result

`apps/react-reference` is a new React 19 application with no TruckTrax, Redux,
RxJS, or React Native premise. Its local `useSignalTree` is a proof surface, not
a proposed package API.

Candidate A was falsified. With the pre-exception public kernel capabilities,
the app could read current values but could not be notified after a write.

The app-local owner-invalidation proof passes:

- scalar, nested, entity-map, and selected entity reads;
- direct writes and bulk upserts;
- five observations sharing one owner source;
- StrictMode cleanup, unmount, and remount;
- a coherent multi-location transaction with no mixed render;
- retained entity identity across removal and same-key successor creation;
- same-address writes from two owners without cross-owner loss.

One pre-implementation characterization was decisive: `setActiveId()` changed
the canonical public read while the mounted React view and invalidation count
remained unchanged. Therefore the semantic seam could not be a public alias for
`PathNotifier`; it had to cover every owner change that can alter a public
synchronous read.

Candidate B is established and implemented for the observation row only:

> An adapter can subscribe to invalidation of one owner's externally readable
> truth. One or more coherent public changes produce at least one later
> invalidation instructing the adapter to reread canonical state.

`observeOwnerInvalidation(owner, callback)` now exposes that fact only from
`@signal-tree/kernel/adapter`. Its callback carries no value, path, causal
metadata, selector, React type, or compatibility policy. Demand activation is
shared per owner, last cleanup returns observation to dormancy, destruction is
terminal, and subscribing after destruction cannot reactivate it.

The callback is invalidation, not an event. Multiple changes may coalesce;
callback count has no mutation, transaction, publication, or causal meaning.
The transaction and commit machinery remains coherence authority. The
invalidation scheduler only marks an owner dirty and later asks adapters to
reread canonical truth.

The no-subscriber cost control used the existing production-substrate report at
the pushed `72da5f2a` baseline and the implementation, three runs each. Median
compiled-write deltas across 10 to 100,000 positions were `+1.4%`, `-2.6%`,
`+14.0%`, `+16.3%`, and `+5.1%`. The existing harness records `+77%` to `+190%`
sequential A/A variance. Existing EntityMap mutation rows ranged from `-48.0%`
to `+37.5%`, with no consistent direction or scaling trend. No meaningful
steady-state tax is established. An initial always-allocated registry measured
worse and was replaced by a registry that does not exist until first demand.

After the invalidation rename and separate membership controls, one final run
of the same existing workload measured `-7.7%`, `+6.3%`, `+1.8%`, `+5.9%`, and
`+3.1%` against the three-run baseline medians. The unused capability remains
inside the established noise envelope with no directional tax.

The React reference now consumes only this adapter primitive. It does not
define or freeze a React hook. Selector-result caching is observational
memoization, not a writable state authority, but changing-selector and
abandoned-render controls remain required before a hook contract can freeze.

### SELECTOR-SNAPSHOT-COST-0 — CLOSED / PROPERTY FROZEN (`eea160b9`)

The post-root-retirement performance audit supplies a direct React design
falsifier:

```text
whole-root cached read, 10k entities              ~0.5 us
whole-root cold read after entity mutation, 10k   ~245 us
whole-root cold read after entity mutation, 50k   ~2.2 ms
entity update + selected byId() reread             ~1.2-1.6 us
```

Reproduce with `node --expose-gc
scripts/benchmarks/data-model-profile.mjs entitymap` against the `1495f713`
root-retirement build. That generator measures both paths in the same fixture
family; these are shape constraints, not portable hardware budgets.

> **SHARED OWNER INVALIDATION DOES NOT IMPLY SHARED SNAPSHOT SCOPE.**

**PRODUCT/ADAPTER AUTHORITY:** React selectors must not require whole-root
NaturalValue materialization after every owner invalidation. Owner invalidation
is the wake-up fact; a selector's `getSnapshot` rereads its selected location or
value directly. A consumer that actually selects the whole root may materialize
the whole root. This constrains the future hook substrate but freezes no hook
name, overload, equality API, cache policy, or package surface.

Semantic equality may suppress a rerender after the selected reread. The React
public API remains open: hook name, selector spelling, equality option spelling,
cache API, lifecycle ergonomics, SSR/React Native requirements, and package
surface are not decided by this row.

The reference carrier in `apps/react-reference` now proves the boundary. An
unrelated entity mutation wakes and reruns a direct `byId` selector, semantic
equality prevents a rerender, and mutation of the selected entity rerenders.
The hook does not route selector evaluation through `readCanonicalSnapshot`;
that operation remains the explicit whole-root helper. Carrier checkpoint:
`eea160b9`; validation: React 16/16, production build, both TypeScript passes,
and release ladder 66/66 with zero known-red.

The alternatives were tested separately:

- generic Observable-to-`useState` hooks create a lagging second read authority;
- `BehaviorSubject` supplies a current value but not derived dependency or
  SignalTree transaction semantics by itself;
- an adapter-installed reactive runtime is process-global, cannot retrofit a
  preexisting neutral tree, conflicts with Angular realization, and can notify
  during physical writes before a semantic transaction is coherent;
- public `link()` activates dormant observation, but it is external-authority
  synchronization: it deliberately suppresses inspection writes and rejects
  configured readonly derived cells;
- owner-wide coherent invalidation plus direct selector reads satisfies React's
  external-store contract in principle without copied state; unrelated
  publications cause snapshot rechecks, not necessarily renders.

Pinned by `packages/kernel/src/react-observation-contract.typing.spec.ts`: cells
and tree roots still expose no subscription API; only the adapter SDK exposes
owner invalidation. `packages/kernel/src/lib/owner-invalidation.spec.ts` freezes
the semantic law, and `packages/kernel/src/lib/react-link-observation-discriminator.spec.ts`
retains the negative proof that `link()` cannot substitute for observation.

Any proposed adapter export must be framework-neutral, express a semantic fact
already owned by the kernel, be required by a correct realization, and be
neither application convenience nor compatibility machinery. Per-location
subscription, paths, causal metadata, compatibility APIs, context ergonomics,
and hook names remain unopened.

### REACT-GREENFIELD-0 remains open

Observation is not the whole realization. Passing characterizations in the
reference app now pin construction-bound derived realization, coherent owner
invalidation, stable whole-root snapshots, and selected-location rereads. The
remaining open work is the React package contract: changing selectors,
abandoned renders, SSR/React Native requirements when earned, equality/cache
policy, lifecycle ergonomics, and public naming. `@signal-tree/react` remains
unfrozen until those package questions are adversarially closed.

### REACT-API-DERIVATION-0 — BEHAVIOR FROZEN / PRODUCT PRESENTATION OPEN

Product authority chooses a public `@signal-tree/react` package. Correctness
premises alone did not establish package ownership: applications can compose a
correct local boundary from public kernel adapter primitives. The package is a
product decision, recorded as such rather than misreported as derivation.

Adversarial confirmation froze the maximum ownership-neutral contract:

```text
owner                     establishes invalidation/subscription scope
stable subscription       for the same owner
owner change              cleanup old registration; subscribe to new owner
selected read             synchronous canonical truth
React snapshot            Object.is-stable while selected truth is unchanged
cleanup                    at the React ownership boundary
whole-root read            expressible, and materialized only when requested
state authority            remains SignalTree; no mirrored React state
```

Selected reads outside the supplied owner's invalidation domain are invalid.
Passing the typed root accessor to a selector improves inference and makes the
intended scope auditable, but JavaScript capture means it cannot enforce this
rule structurally.

The protocol rejected three overclaims:

- package correctness does not require one shared cross-component subscription;
- one hook versus split whole-root/selector hooks is product presentation, not
  a semantic distinction;
- custom equality is not required if selectors return Object.is-stable results.
  Equality support remains a possible convenience whose canonical-result,
  selector-change, and SSR interactions must be chosen explicitly.

Still open by product authority: selector-first versus zero-argument reader;
one selector-capable hook versus split root/selector hooks; initial custom
equality support and spelling; changing-selector cache behavior; SSR/hydration;
React Native requirements; cross-component subscription sharing; public names
and package exports. No implementation begins until the materially different
public presentations are chosen.

## CONSTRUCTION-BOUND-REALIZATION-0

Property:

> The realization used to materialize one SignalTree is determined at
> construction and remains bound to that tree; realization selection is not
> mutable process-global state.

Pre-registered outcomes:

```text
CBR-A — expected

signalTree construction can receive or bind one immutable realization bundle.
kernel construction binds neutral realization.
Angular construction binds Angular realization.
React construction binds React realization.

Multiple realization families coexist in one process. Existing trees cannot
change realization because another package loads.

-> adopt

CBR-B

A smaller construction-owned mechanism satisfies the same law without an
explicit realization-bundle public concept.

-> adopt the smaller mechanism

CBR-C

Correct construction ownership requires substantial new public framework
machinery or duplicated state authority.

-> stop and report
```

Do not assume public spelling. A package-owned factory bound to its realization
is preferable to application configuration such as `{ runtime }`. Reassess the
global installer family as one system; preserve no installer merely because it
already exists.

### FRAMEWORK-OWNERSHIP-RATCHET

During `CONSTRUCTION-BOUND-REALIZATION-0`, audit every `TreeRealization` member
and every realization-dependent kernel branch by the semantic question it
answers. Retain a kernel adapter contract only when all of these hold:

1. Its SignalTree semantic job is stated.
2. A neutral implementation exists.
3. A tiny realization importing neither Angular nor React implements it.
4. A kernel authority decides when and why it is invoked.
5. Its purpose is not framework lifecycle, diagnostics, rendering, hooks,
   dependency injection, context, scheduling behavior, framework-specific
   identity detection, or compatibility with one framework primitive.

If Angular and React disappeared, a retained contract must still describe a
meaningful SignalTree requirement or a useful port for another reactive
runtime. Solid, Vue, Preact, Svelte, or a tiny fake must be able to implement it
naturally. Vanilla need not benefit from every port; the kernel must own the
question being asked. A neutral interface may live in the kernel because
adapters implement it. Framework implementations and framework-only questions
must live in their framework packages.

The current candidates remain admitted only while their evidence stays green:

| Port                         | SignalTree semantic job                                               | Kernel invocation authority                        |
| ---------------------------- | --------------------------------------------------------------------- | -------------------------------------------------- |
| `CellRuntime`                | create readable/writable carriers for materialized state leaves       | tree construction and marker materialization       |
| `DerivedRuntime`             | realize readonly computations declared by SignalTree                  | derived merge and EntityMap computed allocation    |
| `TrackingSuppression`        | prevent kernel bookkeeping reads from becoming user dependencies      | owned mutation and snapshot bookkeeping            |
| `MaterializationRealization` | recognize caller-supplied carriers owned by this realization          | construction and derived merge admission           |
| `ScalarLeafRealization`      | expose scalar truth and deliver one commit's invalidations atomically | scalar slot creation and atomic commit publication |

Angular `computed`, `isSignal`, `untracked`, duplicate-package diagnostics, and
Angular primitive identity belong in `@signal-tree/angular`. React hooks,
`useSyncExternalStore`, StrictMode integration, and render scheduling belong in
`@signal-tree/react`. No new `TreeRealization` member is admitted merely because
one framework requests it.

### ATOMIC-OBSERVATION-DELIVERY-0 — AOD-A / CLOSED GREEN

One atomic SignalTree operation cannot become observable as a partial state.
The kernel owns the operation boundary, changed-slot selection, and publication
order. `ScalarLeafRealization.runInvalidationGroup()` supplies only the runtime
mechanism that prevents dependent consumers from observing between the grouped
invalidations.

The neutral realization executes the group directly because it has no reactive
observers. The synchronous fake defers invalidated producers, stabilizes them
before terminal observers, and discards queued delivery when grouped work
throws. Angular executes directly because its native effect scheduling already
defers external observation until the operation returns.

This capability was earned by removing Angular from the kernel test target. A
two-slot fake-realization frame observed `A2|B` before `A2|B2`; the Angular
scheduler had concealed the portability defect. Permanent controls now reject
either partial ordering while allowing any callback cardinality. The same law
is pinned for scalar frames, scalar plus rekey, restore plus subject scalar,
root scalar plus structural mutation, membership reactivation, stale frames,
and failed planning/application.

### TEST-OWNERSHIP-REATTRIBUTION-0

Authorized while CBR remains open. The first full neutral-default kernel run
produced 31 failing files and 87 failing assertions. Every assertion was read
and classified before modification:

```text
KERNEL-LAW        9 files / 29 tests
ANGULAR-LAW      19 files (16 exclusive, 3 mixed) / 45 tests
OBSOLETE          0 files / 0 tests
CBR-FALSIFIER     6 files (3 exclusive, 3 mixed) / 13 tests
SETUP/IMPORT      0 files / 0 tests
TOTAL            31 unique files / 87 tests
```

Mixed files are `e-granularity.spec.ts` (1 CBR falsifier, 1 Angular),
`entity-granular-reactivity.spec.ts` (1 CBR falsifier, 1 Angular), and
`incremental-materialization.spec.ts` (5 CBR falsifiers, 1 Angular).

The assertion ledger, frozen before reattribution:

```text
KERNEL-LAW
bind-branch-0-acquisition-turn.spec.ts                 1  mutation silence of derived allocation
declaration-extensibility-e0.spec.ts                   3  custom value preservation and snapshot
declaration-extensibility-e5-fork.spec.ts              2  noncanonical exclusion and derived composition
derived-not-state.spec.ts                              2  current derived truth and writable derived state
production-scalar-substrate.benchmark.spec.ts          1  constant logical scalar work
unwrap-symbol-keys.spec.ts                             4  symbol traversal and derived omission
write-only-marker.spec.ts                              1  realized marker diagnostic silence
enhancers/restoration/restoration.spec.ts              2  derived truth after undo
internals/derived.spec.ts                             13  nested/composed/EntityMap current derived truth

ANGULAR-LAW
benchmarks.spec.ts                                     2  Angular computed dependency memoization
c6-neutrality-invariants.spec.ts                       3  native Angular identity and graph participation
callable-contract.spec.ts                              1  Angular signal identity
demarcation-0.spec.ts                                  1  Angular effect observes speculative state
dynamic-member-reactivation.spec.ts                    2  Angular dependency invalidation/cardinality
e-active-selection.spec.ts                             1  Angular computed granularity
e-granularity.spec.ts                                  1  Angular array dependency granularity
e-hooks.spec.ts                                        1  Angular computed collection observation
e-ordering-rekey.spec.ts                               1  Angular computed order observation
entity-active-prepend-changeid.spec.ts                 1  Angular active-row recomputation
entity-granular-reactivity.spec.ts                     1  Angular absent-entity dependency tracking
entity-signal-angular-realization.spec.ts              3  native Angular entity carrier identity
incremental-materialization.spec.ts                    1  Angular computed snapshot observation
reactivity-contract.spec.ts                            4  Angular recomputation cardinality
scalar-realization-s1.spec.ts                          2  native Angular scalar identity and graph
whole-value-membership.spec.ts                         9  Angular membership dependency publication
enhancers/restoration/restoration-reactivity.spec.ts   6  Angular restoration dependency tracking
internals/tree-physical-substrate.spec.ts              2  Angular effect publication coherence
internals/causal-runtime/tree-realization-adapter.spec.ts 3 Angular effect publication coherence

CBR-FALSIFIER
e-granularity.spec.ts                                  1  unchanged-record structural identity
entity-granular-reactivity.spec.ts                     1  stable collection read identity
incremental-materialization.spec.ts                    5  snapshot sharing, no-op identity, and idle O(1)
marker-snapshot-memo.spec.ts                           4  stable independent marker wrappers
snapshot-builder.spec.ts                               1  unchanged subtree identity
enhancers/restoration/snapshot-sharing.spec.ts         1  history subtree sharing
```

`KERNEL-LAW` preserves the framework-independent claim using neutral recipes
or a tiny fake realization. `ANGULAR-LAW` preserves the assertion under
`@signal-tree/angular`; moving a file is not itself evidence that every
assertion in it is Angular-owned. A correctly owned assertion that remains red
is a `CBR-FALSIFIER` and stops this row. Ambient realization is not an
admissible repair.

Classification correction: a first pass proposed proving the 13 identity
assertions with a memoizing fake. That would only prove adapter capability while
the neutral package retained pathological full reconstruction. Focused neutral
controls failed 5/5 in `incremental-materialization.spec.ts`, including
idle-read cost and wide-grid sharing. Those failures established a kernel
performance and representation defect, not a causal theorem or public
entitlement to POJO identity. The assertions remain implementation/performance
controls unless a separate product contract earns stronger status.

Final ownership disposition:

- kernel-private publication and held-consumer laws use a framework-free fake
  realization;
- Angular computed/effect, native carrier identity, tracking suppression, and
  TransferState laws live under `packages/angular`;
- comparative raw-Angular timing lives in the Angular test target;
- kernel typing tests use only `ReadableCell` and `WritableCell`; Angular
  carrier typing remains in the Angular package;
- the kernel Vitest target has no Angular compiler, TestBed, Zone, Angular
  factory, runtime import, or type-only Angular import;
- real package coexistence is pinned in neutral, Angular, neutral, Angular
  construction order with lazy EntityMap allocations after every boundary.

Focused validation is generated by `nx test kernel`, `nx test angular`,
`npm run typecheck`, `nx lint kernel`, `nx lint angular`,
`node tools/check-kernel-neutrality.mjs`, and the `retention-gc` release gate.
The broader release ladder remains open; test ownership closure does not waive
API baseline, spec baseline, release-claim, or package-manifest gates.

### KERNEL-SNAPSHOT-AUTHORITY-0 — KSA-B / CLOSED GREEN

Snapshot correctness is kernel read semantics. Incremental materialization and
structural sharing are the current kernel-owned performance representation;
they no longer depend on adapter dependency tracking:

- ordinary branches use a small kernel-owned per-node cache with synchronous
  dirty propagation to snapshot ancestors;
- scalar-slot publication marks the owning branch dirty after both direct
  commits and causal replay, so restoration does not need cache-specific logic;
- membership transitions dirty the branch before consulting optional causal or
  observation machinery;
- EntityMap reuses its existing collection version to cache projections and its
  existing `updateSignals()` authority to dirty marker and ancestor snapshots;
- owner invalidation remains uninvolved because it is owner-wide, coalesced,
  and asynchronous.

KSA-A was sufficient for EntityMap because its collection version already
exists. Ordinary trees have no universal revision unless optional causal
capabilities are present, so KSA-B supplies the minimum additional state: one
cache record and parent edge per materialized branch, with no dependency
collection, subscribers, effects, or scheduler.

`MaterializationRealization.memoizeSnapshot` had no independent framework job
after this result and was deleted. `MaterializationRealization.isReactiveNode`
remains admitted only for recognizing caller-supplied native carriers. Direct
bare-kernel controls pin current performance behavior: root/no-op identity,
changed-path sibling reuse,
membership omission and same-value reactivation, EntityMap invalidation with
an untouched sibling, and independent marker stability. They do not make
object identity causal authority or a public compatibility promise.

Representation evidence and dispositions:

- `KSA-WRITE-COST-0` selected A. Scalar commit authority now reports its
  existing changed/no-op result through a private intrinsic-mutation channel;
  the permanent logical-work control remains one slot read, one equality check,
  and one write/publication. The proposed 1 -> 2 baseline change was reverted.
- Dirty ancestry stops at the first cached node already dirty. A partial-child-
  read interleaving control remains current. Disabling the stop measured 47.3 ->
  1060.7 ns for depth-50 dirty writes and 189.5 -> 1199.9 ns per write for
  100-write/read bursts; shallow movement (43.4 vs 41.7 ns) was noise-sized.
  On the final demand-driven representation, medians were 38.3 ns shallow,
  34.0 ns depth-50 while dirty, and 203.6 ns/write for a 100-write/read burst.
- Snapshot machinery moved from `utils.ts` to a dedicated internal authority;
  the Rollup `materialize-markers -> utils -> materialize-markers` cycle is gone.
- Public custom markers have no generic snapshot-change evidence. Their marker
  path is therefore uncached and a framework-free mutation/fresh-read control
  passes. No extension API was added. EntityMap keeps caching through its
  existing version authority.
- Ordinary parent links are allocated on first snapshot traversal rather than
  at construction. Snapshot parent links and scalar slot-to-owner links are weak. An
  `--expose-gc` gate proves a held nested accessor remains readable while its
  root backing store is collected.
- Neutral trees allocate no dependency carrier for snapshot caches; tracking
  realizations retain one only because they have an observation graph. Isolated
  10k ordinary-branch arms retain 17.87 MB when `tree()` is never read and
  22.74 MB after snapshot materialization: 4.88 MB incremental, about 511 B per
  materialized branch including cached view objects. Demand-driven ancestry
  saved about 0.56 MB from the unread arm, and neutral specialization saved a
  further 4.61 MB from the read arm. Both arms are collectable. These are
  current representation figures, not an attributable pre/post-KSA delta.
- A same-build esbuild ablation measured snapshot authority at 288 gzip bytes.
  The ablated CBR bundle was still over budget, so KSA was not the sole cause.
  Folding duplicate enhancer validation, tree-shaking subscriber-only owner
  invalidation through a tiny dispatch port, and canonicalizing NodeStore/node
  traversal recovered the remaining slice cost without weakening semantics.
  Final enforced sizes: bare 9.70/9.7 KB production and 11.87/11.9 KB
  development; EntityMap 20.28/21 KB and 22.96/23.7 KB.

Cache-authority census currently has two distinct laws: branch snapshots use
dirty ancestry; EntityMap projections use one monotonic collection version.
EntityMap already centralizes all its projections through one local helper.
There is no second revision-keyed implementation to consolidate, so a generic
`cacheByRevision` helper would add an abstraction without removing duplication.

Validation: dedicated KSA 7/7, marker snapshot 10/10, restoration sharing 5/5,
owner invalidation 21/21, one-read scalar logical work, custom-marker freshness,
held-child/root GC, Angular tracking suppression, both TypeScript passes,
kernel build without cycles, neutrality, and all four bundle budgets are green.

### SNAPSHOT-IDENTITY-CONTRACT-0 — SIC-B / CLOSED GREEN

Adversarial confirmation reopened classification after KSA closure. Frozen
causal premises establish current natural-state correctness, committed snapshot
correctness, speculative isolation, and transition/restoration authority
independent of POJO identity. They do not establish incremental subtree identity
as causal structure, kernel semantics, or public API contract.

Consumer audit:

- restoration admits turns from causal effects and uses root snapshot `===`
  only as an O(1) dedupe after admission;
- devtools uses identity to avoid repeated serialization;
- persistence no longer derives change authority from `tree() !== previous`;
- the React reference maintains adapter-local snapshot equality;
- no frozen causal workflow uses identity to decide truth, transition meaning,
  commit status, or restoration eligibility.

Disposition:

```text
A  correct natural state, no identity promise
B  stable root between natural-state changes, no subtree promise
C  incremental identity-preserving subtree sharing

causal/state correctness          A sufficient
public/kernel product contract    B
public/kernel contract for C      FUNCTION NOT ESTABLISHED
current implementation choice     C retained as measured optimization
```

Gate 2 found that B is not forced by the causal premises: A plus consumer-owned
stabilization is coherent. B is therefore recorded as a PRODUCT DECISION. It
gives every framework-independent consumer a cheap conservative root change
oracle without requiring a deep comparator or another public revision API.
That decision does not make identity causal authority and assigns no public
callable syntax to canonical materialization. `tree()` in the SIC controls is
only the incumbent carrier used to test the property before its retirement.

Direct controls establish the boundary:

- two separately committed `A -> B` and `B -> A` operations remain two causal
  turns although final natural state equals the initial state;
- one same-turn scalar `A -> B -> A` remains the already-frozen net-zero rule
  and creates no turn from its causal effects, not from snapshot identity;
- equivalent final truth written with realized participation stays classified
  as realized and creates no restoration admission;
- React's direct root path is stable while unchanged, while a selector that
  clones every entity remains correct with semantic equality;
- Angular remains correct when its computed result clones the complete root and
  every descendant, so Angular establishes no root or descendant identity law.

The causal audit also found `Object.is` checks over scalar/object leaf values in
restoration conflict detection. Those compare realized values, not materialized
natural snapshot objects, and are outside SIC-0; they must not be cited as
snapshot-identity authority or changed under this row.

Root-shape correction: SIC-B freezes the canonical materialization property,
not callable `tree()` syntax. The already-frozen greenfield root contract keeps
the controller non-callable and gives `tree.$` the ordinary callable location
grammar. Framework adapters read
the canonical snapshot through `readCanonicalSnapshot(owner)` and subscribe
through `observeOwnerInvalidation(owner, callback)`.

An adversarial absence pass proposed returning `owner.$` directly. That rival
was invalid: it silently equated the non-callable navigation facade with its
NaturalValue snapshot instead of invoking it, contradicting the frozen root premise. The adapter read
operation enters the kernel's canonical memoized materialization authority and
adds no `TreeRealization` field or public root call syntax. Owner invalidation
uses the same operation internally, removing its dependency on callable
controller compatibility.

Premise 6 (full reconstruction on every read is bad behavior) establishes an
efficient-materialization obligation, not a required consumer-observable
identity mechanism. The measured 10k-branch incremental cost remains explicit:
4.88 MB, about 511 B per materialized branch; unread snapshot surfaces avoid
that cache-materialization cost. This cost describes the current optimization
and does not justify its own contract.

Reopen C as a public/kernel product contract only if a required
framework-neutral workflow must process only changed branches using the
materialized snapshot alone, the kernel exposes no equivalent authoritative
change signal, and the workflow's correctness or required complexity therefore
depends on unchanged subtrees retaining reference identity.

Current status:

```text
OWNER-INVALIDATION-0                CLOSED GREEN — cb2a276f
CONSTRUCTION-BOUND-REALIZATION-0    CLOSED GREEN — 23c6de5a
TEST-OWNERSHIP-REATTRIBUTION-0      CLOSED GREEN — framework-free kernel target
ATOMIC-OBSERVATION-DELIVERY-0       CLOSED GREEN — narrow invalidation group
SNAPSHOT-IDENTITY-CONTRACT-0        SIC-B / CLOSED GREEN — d8ad11da
GREENFIELD-ROOT-ACCESSOR-SHAPE-0    CLOSED GREEN — 1495f713
CANONICAL-SNAPSHOT-HANDOFF-0        CLOSED GREEN — 3b572fe7
@signal-tree/react                  ROOT BLOCKER DISCHARGED — sequencing pending
TruckTrax v2 migration              BLOCKED ON REACT CONTRACT
TruckTrax v3 migration              BLOCKED ON GREENFIELD APPLICATION PATTERNS
React Native                        BLOCKED ON REACT CONTRACT
```

## GREENFIELD-APPLICATION-PATTERNS-0

Before v3 migration, establish canonical greenfield v15 application patterns
for async/server acquisition, forms, persistence, and derived state. Determine
ownership from the needs of a new consequential application, not from v3's
current loader, status, storage, or forms APIs. Validate each pattern outside
v3 before it can become a migration target.

## TruckTrax v2 wedge: Route History

**Blocked until `@signal-tree/react` is architecturally closed and its contract
is frozen from greenfield evidence.** The dirty primary checkout remains
excluded. Migration work, when opened, belongs in the clean
`migration/signaltree-react-route-history` worktree at `e704f8e78d`.

The bounded workflow contains:

- server-loaded ordered `RouteDto` entities;
- selected route IDs and hovered route state;
- seven reading components across panel, table, map, and markers;
- async request and client-side ownership annotation/filtering;
- derived selection, marker, legend, and visibility projections.

The migration asks how much work is required to move this workflow to the
already-correct SignalTree architecture. It does not preserve Redux ownership,
tee actions into a shadow tree, or introduce Redux adapters. A large rewrite is
acceptable when the old architecture is wrong.

Measure projection parity, React commits, recomputations, referential stability,
network count, cleanup after unmount, files/LOC touched, selectors/actions/
reducers removed, and test complexity. Migration pain is documented as evidence;
it does not reopen compatibility APIs.

Reject the slice if route order/selection/hover/markers diverge, SignalTree
causes more commits for selection or hover, null/empty distinctions are lost,
subscriptions survive unmount, or unrelated state must enter the boundary.

## TruckTrax v3 wedge: ScaleTrax V3 Edge catalogs

**Blocked until `GREENFIELD-APPLICATION-PATTERNS-0` establishes the target.**
Work, when opened, lives on `migration/signaltree-v15-v3edge-catalog` at
`d3d9dfd04`.

The scales and transports slice is retained as later migration evidence. Its
current concepts are questions, not presumed v15 counterparts:

| Legacy concept                         | Actual job                        |
| -------------------------------------- | --------------------------------- |
| `entityMap`                            | keyed identity and reconciliation |
| `loader`                               | request and cache orchestration   |
| loader status                          | pending, error, and freshness     |
| `staleTime`, SWR, force, single-flight | acquisition policy                |
| successful GET                         | adoption of authoritative rows    |
| `derivedFrom` aggregate                | cross-domain derived read         |

The result must look like a domain slice worth showing as a brand-new v15
application. Concepts may move or disappear. The migration record compares
before and after and explains why; it does not optimize for minimal churn.
Capture, net-weight, printing, and all frontend weight behavior remain out of
scope.

Stop if v13/v15 cannot coexist, edits escape ScaleTrax, stale responses can
overwrite newer truth, failure drops rows, UI loading/error behavior changes,
or certified-weight behavior must move.

## Continuous decision record

Every migration decision is recorded when made:

```yaml
legacy_pattern:
actual_job:
old_owner:
v15_owner:
replacement:
why:
files_touched:
behavioral_proof:
common_wrong_migration:
```

These records feed the migration, implementation, and agent guidance. They are
not reconstructed after the code lands.
