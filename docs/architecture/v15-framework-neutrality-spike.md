# GREENFIELD-FRAMEWORK-NEUTRALITY-SPIKE-0

Mode: DISCOVERY FOR IMPLEMENTATION. Frozen direction assumed, not re-litigated:
**SignalTree owns truth, frameworks own observation.**

No production code changed. Spike scripts live in the session scratchpad.

## Headline

The ownership cut the frozen direction asks for **already exists in production
for scalars**, and it is load-bearing — not a prototype. What is *not* neutral is
the **type closure**, and that is caused by one import edge plus one public type
declaration, not by architecture.

Measured: the neutral kernel executes all its semantics with
**0 `@angular/*` modules loaded** (positive control: the Angular runtime loads 12).

## A. ANGULAR DEPENDENCY TABLE

245 production Angular usage sites. Census excludes `lib/internals/atomic-state/**`
(6 Angular files, **0 non-spec importers** — research prototypes, not production)
and `test-setup.ts`.

| symbol | sites | role | disposition |
|---|---|---|---|
| `Signal` | 80 | TYPE-ONLY LEAK | neutral `ReadSignal<T>` in kernel |
| `WritableSignal` | 52 | TYPE-ONLY LEAK | the public taint — see B |
| `computed` | 31 | DERIVED (memo+invalidation) | adapter-supplied `memo` |
| `isSignal` | 21 | ADAPTER-ONLY predicate | adapter |
| `signal` | 19 | **OBSERVATION/PUBLICATION** | adapter (tokens, not storage) |
| `Type` | 12 | DI | `@signaltree/angular` |
| `effect` | 8 | LIFECYCLE | adapter |
| `inject` | 8 | DI | `@signaltree/angular` |
| `untracked` | 6 | ACCIDENTAL | unnecessary once reads don't track |
| `linkedSignal` | 2 | PUBLICATION | adapter |
| `Injector` / `runInInjectionContext` | 3 | DI | `@signaltree/angular` |

**144 of 245 sites (59%) are type-level.** Runtime is 98 sites.

Already neutral, no work required: `lib/internals/causal-runtime` (20 files,
5,064 LOC), `lib/physical` (4 files, 974 LOC), `enhancers/transactions` (1,748 LOC),
`enhancers/batching`, `lib/audit`, `lib/internals/diagnostics`, `packages/shared`.

Angular is confined to **17 production files**.

## B. TYPE-CLOSURE MAP

Measured on `tree-scalar-slot-runtime.ts` (the kernel):

| closure | files | Angular-tainted |
|---|---|---|
| **runtime** (type-only imports stripped) | 2 | **0** |
| **full type** | 27 | 6 |

The entire type taint enters through **one edge**:

```
tree-scalar-slot-runtime.ts
  └─ import type { PositionId } from '../types'      ← lib/types.ts
                                                       (also declares
                                                        CallableWritableSignal)
```

`PositionId` is a neutral number alias co-located in the 1,900-line Angular-tainted
type hub that 22 files import. **Type co-location, not architecture.**

### PUBLICLY ANGULAR-TAINTED

```ts
CallableWritableSignal<T> extends WritableSignal<T>   // types.ts:1132
    ↑ TreeNode<T> maps every leaf key to it
    ↑ tree.$  — the primary public accessor
ISignalTree<T>.destroyed: Signal<boolean>
NaturalValue<S>  — pattern-matches S extends WritableSignal<infer T>
```

`toWritableSignal`, `asReadonly`, `createAuditTracker` — all reach `Signal`/`WritableSignal`.

**This taint is deliberate and load-bearing.** Two prior attempts to remove it were
reverted (read `types.ts:78-89` before touching it):

- a `declare module '@angular/core'` augmentation adding callable overloads — removed
  because it is *global*: it broke `@ngrx/signals`' `WritableStateSource<T>` invariance,
  ~30 TS2345 errors in mixed codebases.
- `@signaltree/callable-syntax` — DELETED in 14.0.0, same conflict, and its build
  transform could never run inside an Angular app.

### ⚠️ COUPLING FINDING — this is why the spike matters beyond hygiene

`types.ts:1140` states the mechanism: **"A LEAF IS A REAL ANGULAR SIGNAL. Calling one
is a READ; it returns the value and discards the argument."** Measured there:
`tree.$.count(5)` on a leaf holding `0` left it at `0`, silently.

But `tree.$.user({name:'Bob'})` **works** — "because a branch is our own accessor and
we own its call semantics."

So the reason callable-leaf/callable-root syntax died twice is *precisely* that leaves
are Angular's objects rather than SignalTree's. **Neutrality is the enabling condition
for `GREENFIELD-ROOT-ACCESSOR-SHAPE-0`**, not an orthogonal cleanup. Once the kernel
owns the leaf, `leaf(v)` can be a setter for the same reason `node({...})` already is.

## C. OWNERSHIP CUT — already implemented for scalars

`tree-scalar-slot-runtime.ts` (neutral) / `tree-scalar-slot-angular-runtime.ts` (adapter):

```
KERNEL owns truth        values[], equalities[], revision, slotByPositionId
                         createSlot/readSlot/commitSlot/updateSlot
                         beginFrame → ScalarSlotCommitResult{revision, changedSlots}
        ↓
ADAPTER owns observation AngularScalarSlotPublicationAdapter
                         tokens: WritableSignal<number>[]   ← counters, NOT values
                         publish() → token.update(v => v+1)
                         createAngularLeaf → linkedSignal(() => {
                             publication.observe(slot);
                             return kernel.readSlot(slot);   ← value comes from KERNEL
                         })
```

Angular does not store a single state value. It stores **integers that count changes.**
`ScalarSlotCommitResult` is already the `CommittedChangeSet` the frozen handoff names.

Same pattern in entities, independently: `entity-signal.ts:319` `const version = signal(0)`,
bumped once at `:1260`, and every query is
`computed(() => { version(); ...read neutral structuralStore/valueStore... })`.
Truth is in neutral `lib/physical`. Angular supplies **memo + invalidation**.

Leak points, both in the adapter's own interface: `createLeaf(): WritableSignal<T>`
and `resolveScalarLeaf(): WritableSignal<unknown>`.

## §5 SEMANTIC vs CONVENIENCE

**ANGULAR REQUIRED FOR SEMANTICS:** nothing in the kernel. One case above the handoff:
user-authored `computed(() => $.count() * 2)`. That dependency graph is Angular's by
construction; `merge-derived.ts` only *hosts* the signal (`isSignal` detection) and
never owns the graph.

**ANGULAR REQUIRED ONLY FOR OBSERVATION/PUBLICATION:** `signal` (tokens), `linkedSignal`,
`computed` (caching), `effect`.

**ANGULAR NOT REQUIRED:** `untracked` (6 sites — only needed because Angular reads track;
a kernel read doesn't), `isSignal`, all DI, all 132 `Signal`/`WritableSignal` type sites.

## §6 DERIVED — answer is C, and the split already exists

- kernel: neutral projection functions (`getProjectedEntries`, `readSlot`) — pure, exists
- adapter: memo + invalidation (`computed` + `version` token) — exists
- kernel needs **no** dependency tracker. Required primitive: `memo(dep, fn)`.
- user-authored derived stays **above** the handoff (option B).

## §7 LINK

Semantic requirement, measured (`link.ts:256, 436, 570-585`): read current value,
observe committed changes (`acquireObservation`), apply external realization. Exactly
the predicted minimum. `LinkEndpoint` (get/set/subscribe) is **already neutral**.
`WritableSignal` in `NaturalValue<S>` is a *type pattern-match* to compute the natural
value type — it does not require Angular semantics. `observation-substrate.ts` uses
`WritableSignal` as a structural `{(), set, update}` shape, `import type` only.

## §8 ENTITIES — neutral internally, confirmed independently

Storage `EntityValueStore` + `StructuralStore` (neutral). Member identity = `subjectId`
(number). Structural publication = `version` token. Field accessors = `computed` over
neutral reads. **Angular carries no semantic identity in the entity path.**

## §9 LIFECYCLE / DI

All 15 DI sites are in `define-store.ts` — an Angular DI facade (`@Injectable`,
`inject(DestroyRef).onDestroy`), adapter by definition. Plus `toWritableSignal`
(`Injector`, `runInInjectionContext`, `effect`) — a NodeAccessor→WritableSignal bridge,
also adapter by definition. **The kernel already has explicit `destroy()`; it requires
zero DI to obtain cleanup.**

## §10 DISCRIMINATOR — RESULT: PASS

Vanilla (non-Angular) publication adapter over the unmodified kernel. 7/7 semantic
assertions pass: read, write-commits-and-publishes, equality-suppresses-both,
frame-commits-atomically-with-one-revision-bump, frame-publishes-all-changed-slots,
discard-preserves-truth, resolveScalarSlot.

Module-load probe: neutral **0** `@angular` modules; Angular runtime **12** (control).

Scope honesty: this exercised **scalars only**. Entities, Link, transactions and
restoration were audited statically, not driven through a second adapter.

## §11 COST

| | raw | gzip |
|---|---|---|
| neutral kernel | 2,113 B | **925 B** |
| + Angular adapter | 3,900 B | 1,543 B |
| publication layer | | **+618 B** |

Current shipped core: prod 9.66/9.7KB, entities 20.07/21KB — green. Neutrality here
*removes* bytes from a framework-agnostic kernel rather than adding indirection: the
adapter is 40% of the scalar substrate and is the part that becomes swappable.

## D. MIGRATION PLAN — ordered, smallest-first

| # | step | sites | risk | unblocks |
|---|---|---|---|---|
| 1 | extract neutral types (`PositionId`, `SlotIndex`, commit results) out of `types.ts` into a neutral module; re-export for compatibility | 1 file split | **very low** — type-only, 22 importers unaffected | kernel **type** closure = 0 |
| 2 | add a type-closure gate to `verify-gates.mjs` asserting the kernel closure never re-imports Angular | new gate | none | prevents regression |
| 3 | delete `lib/internals/atomic-state/**` (0 production importers) | 7 files | low | −6 Angular files from census |
| 4 | move `define-store.ts` + `toWritableSignal` to `@signaltree/angular` | ~19 | low — additive package | all DI out of kernel |
| 5 | move `tree-scalar-slot-angular-runtime.ts` to `@signaltree/angular` | 12 | medium — `signal-tree.ts` imports it | scalar cut complete |
| 6 | introduce kernel `memo(dep, fn)`; adapter supplies `computed` | 31 | medium | derived cut |
| 7 | replace `untracked` with kernel reads | 6 | low | — |
| 8 | **the leaf type decision** — what is `tree.$.count`? | 132 type sites + every consumer | **HIGH** | callable root |

Steps 1–4 are mechanical and independently landable. Step 8 is the real decision and
is where `GREENFIELD-ROOT-ACCESSOR-SHAPE-0` must be answered first.

### Migration cost

- **Steps 1–2**: mechanical.
- **Step 3**: production-unreachable retirement **pending invariant-carrier
  classification** — see ATOMIC-STATE-RETIREMENT below.
- **Steps 4–5**: ~1–2 sessions. Creates `@signaltree/angular`. Public import paths move →
  **a breaking change for consumers**, but a mechanical one (import rewrite).
- **Steps 6–7**: ~1 session.
- **Step 8**: dominates the total. It re-types the primary public accessor, invalidates the
  api-baseline, and forces the interop decision below. Budget it as its own phase with its
  own gate re-run, not as a step.

The `packages/` shells for §13's shape do **not** exist yet: `authoring/` is an empty
`src/`, `events/` and `ng-forms/` contain only `node_modules`. No `kernel/`, no `angular/`.

## E. BLOCKERS

Exactly one, and it is a **decision**, not an impossibility.

**ECOSYSTEM INTEROP INVARIANT.** Today a leaf *is* a real Angular `WritableSignal`, so it
can be handed to any Angular API and to `@ngrx/signals`. If the kernel owns the leaf, that
guarantee is no longer free — and the two prior reverts show what breaks.

It is not a hard blocker: `createAngularLeaf` **already** demonstrates the adapter can mint
a genuine `WritableSignal` whose value comes from the kernel. So both can exist. The
question step 8 must answer, and which this spike cannot answer alone:

> Is `tree.$.count` typed as the **kernel callable** (callable-as-setter, requires
> `.asAngularSignal()` for interop) or as the **Angular signal view** (interop free,
> callable-setter stays impossible)?

That is the same trade the module augmentation and `@signaltree/callable-syntax` both lost.
The difference now is that the kernel would own the object, so it is winnable — but it is a
public-contract choice, not a refactor.

No frozen semantics were found that cannot be expressed neutrally.

---

# ADDENDUM — RULINGS AND EXECUTED WORK

The spike was accepted. Central finding as ruled:

> The framework handoff is not hypothetical. It already exists physically for scalar
> truth; the remaining problem is type/public-surface closure and adapter extraction.

`GREENFIELD-FRAMEWORK-HANDOFF-0` was **located, not invented.**

## CORRECTION TO THIS RECORD

"Steps 1–3 are free" was wrong and is retracted. Zero production importers proves **no
reachability**. It does not prove **no surviving invariant carrier**. Inferring
deletability from import count is the same failure mode as the reachability grep that
once called `entityMap` unreachable.

## A1 — NEUTRAL TYPE EXTRACTION: not an extraction at all

The spike said "extract neutral foundational types out of the hub." Measurement showed
that was unnecessary: the types were **already defined in neutral modules** and the
kernel was importing them from a *re-exporting hub* instead.

```
lib/mutation-types.ts    zero imports, defines `export type PositionId = number`
internals/node-shape.ts  zero Angular, defines `isTraversableNode`
```

Three one-line redirects, no new module, no compatibility shim, no runtime change:

| file | was | now |
|---|---|---|
| `internals/tree-scalar-slot-runtime.ts` | `import type { PositionId } from '../types'` | `from '../mutation-types'` |
| `internals/position-registry.ts` | `import type { PositionId } from '../types'` | `from '../mutation-types'` |
| `internals/physical-commit-clock.ts` | `import { isTraversableNode } from '../utils'` | `from './node-shape'` |

⚠️ The spike's "the taint enters through ONE edge" claim was also wrong — it was **two**.
The `PositionId` fix alone left the closure at 27 files / 6 tainted, because
`physical-commit-clock.ts → ../utils` carried the rest. Found only by re-measuring after
the first fix rather than trusting the first trace.

**Result: kernel type closure 27 files / 6 tainted → 6 files / 0 tainted.**

## A2 — NEUTRALITY GATE

`tools/check-kernel-neutrality.mjs`. Walks the transitive closure of declared-neutral
roots over **all** relative edges, type-only included, and fails on any `@angular/*`.

- gate: exit 0 over 5 neutral roots
- `--self-test`: pointed at the known-tainted Angular runtime, reports 7 tainted members
- live mutation (redirect one edge back to the hub): **exit 1**, restored: exit 0
- registered as `kernel-neutrality` + `kernel-neutrality:self`; **register is 54/54**

Runtime probes cannot see this class of defect — the runtime closure was *already* clean
while the type closure was not.

## A3 — ATOMIC-STATE-RETIREMENT: carrier disposition

Audited all 15 files / 56 test claims before deleting anything.

| subject | disposition | surviving carrier |
|---|---|---|
| PositionId ↔ SlotIndex binding | MIGRATED | `tree-scalar-slot-runtime.spec.ts` |
| single-slot commit result shape | MIGRATED | same, `SingleSlotCommitResult` assertion |
| equality-throw leaves truth intact | MIGRATED | same |
| one publication per changed slot | MIGRATED | `tree-physical-substrate.spec.ts` |
| slot-backed substrate is the default path | MIGRATED | same |
| stale frame refusal (realization) | MIGRATED | `tree-realization-adapter.spec.ts` |
| rekey / SubjectId continuity | MIGRATED | `lib/physical/structural-store` suites |
| subject reclamation, tombstones, no identity reuse | MIGRATED | `reclamation-eligibility.spec.ts`, `subject-reclamation-coordinator.spec.ts`, `never-claimed-retirement.spec.ts` (shipped 87a790eb) |
| nested path lenses / root snapshot swap | VACUOUS | design not adopted — shipped kernel is flat slots |
| native-vs-atomic benchmark timings | VACUOUS | historical measurement, no invariant |
| **"leaves are still native Angular signals with `.set()`/`.update()`"** | **CONTRADICTED** | deliberately retired — see the leaf-ownership freeze below. Recorded rather than silently dropped: this prototype asserted precisely what the greenfield now rejects. |
| **`discard` is inert / a discarded frame cannot publish later** | **ORPHANED → CARRIED** | recovered, see below |
| **multi-slot frame `changedSlots` atomicity** | **ORPHANED → CARRIED** | recovered, see below |

Two subjects survived into the shipped kernel with **no permanent carrier anywhere**.
Deleting on import count alone would have dropped them silently. Recovered as 5 specs in
`tree-scalar-slot-runtime.spec.ts`, at the boundary the claims are about (§29.7c):

```
keeps staged frame writes out of committed truth until commit
discard is inert and a discarded frame can never commit
commits a multi-slot frame atomically under one revision
omits equal slots from changedSlots and commits nothing when all are equal
refuses the second of two frames opened from the same base revision
```

Non-vacuity proven: mutating `discard()` to not close the frame turns the carrier red
(1 failed / 12 passed), restored 13/13.

`atomic-state/**` then deleted in one bounded batch — 15 files. Production files
importing Angular: 25 → **19**.

## FROZEN — GREENFIELD LEAF OWNERSHIP

```
Canonical:  SignalTree kernel owns the callable location object.
Angular:    adapter can project that location as a genuine WritableSignal.
React/Vue:  adapters observe the same kernel publication boundary.

Framework representation is a VIEW OF SignalTree truth, not SignalTree truth itself.
```

Rationale: choosing the Angular view as canonical would preserve exactly the incumbent
limitation being removed. The spike found the mechanism — leaves are currently Angular
objects, so SignalTree does not own their call semantics, which is why branch callable
writes already work and leaf ones cannot. A runtime-neutral kernel under an Angular-owned
primary public accessor is not framework-neutral type closure.

The strongest objection is answered by the incumbent itself: `createAngularLeaf` already
projects a genuine Angular `WritableSignal` backed by kernel truth. Neutrality and Angular
interop are not in tension.

**Not frozen:** the Angular bridge's spelling (`toAngularSignal` / `asAngularSignal` /
other) — that belongs to the Angular adapter surface review. What is frozen is the
direction: **Angular interop is explicit; it does not define `tree.$.count`.**

## OPEN — FUNCTION-VALUED STATE (same gate as leaf ownership)

One public-contract problem, not two. Runtime types cannot decide whether `location(fn)`
means DERIVE or REPLACE-with-function-as-data. Direction under consideration — preserve
the common grammar, add one narrow disambiguator for function-as-data only:

```
0 args                            READ
1 function                        DERIVE
1 branded function-value wrapper  REPLACE (function AS data)
1 anything else                   REPLACE
```

`valueOf` is illustrative, **not a frozen name**. Rejected: treating `() => fn` as "close
enough" to replacement — that falsely classifies a replacement as a derive, and the
replace/derive distinction is load-bearing elsewhere (transactions branch on
`mutationIntent === 'replace'`; `combineScalarMutationIntent` has replace DOMINATE derive).
Also rejected: banning function-valued state merely because the callable grammar makes it
inconvenient, unless the existing contract independently forbids functions as state.
