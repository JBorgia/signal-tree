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

---

# GREENFIELD-ROOT-ACCESSOR-SHAPE-0 — B1 FROZEN

## FUNCTION-AS-STATE-0 — disposition: FNS-A (ADMITTED)

Function-valued state is a surviving, admitted, **defect-driven** requirement.

| dimension | finding |
|---|---|
| public typing | `TreeNode<T>` has an explicit arm grouping `((...args) => unknown)` with `Date \| RegExp \| Map \| Set \| Error` as "Built-in objects → treat as atomic values" (`types.ts:204`). Load-bearing: without it a function matches `extends object` and becomes a traversed branch. |
| runtime | probed 5/5 — leaf; read returns the same function identity; `.set()` replaces; `.update()` receives it as current value; survives `tree()` snapshot egress with identity intact |
| permanent tests | `change-reporting.spec.ts:242-292`, four of them, each encoding a fixed defect |
| docs | none teach it |
| real consumers | none in `apps/` (matches were marker config callbacks, not state) |
| serialization | no function-as-data handling — a function in state is not JSON-representable |

The tests are the decisive evidence, and they are regression tests, not examples:

```
stores a handler assigned to a callback leaf sitting at null   onConfirm: null | (() => void)
                                                               — and assigning must never RUN it
survives the clear-then-reassign cycle
stores a class constructor without invoking it                 invoking one threw mid-loop, leaving
                                                               `a` written, `b` unwritten, nothing reported
still lets a leaf that HOLDS a function be replaced
```

⚠️ Nearly ruled FNS-B. The first sweep's grep shape found no tests and the disposition
was about to be "technically representable, not admitted." Two real carriers existed.

## THE PRECEDENT THAT GOVERNS B — `change-reporting.spec.ts:233`

> **A leaf NEVER invokes a function value.** Updaters are a branch/root form;
> `tree.$.count.update(fn)` is the leaf form […] A revision of this suite once
> asserted the opposite — that a function at a leaf is resolved as an updater —
> guarded on *"the current value is not a function"*. **That predicate is unknowable
> at runtime**, and the tests below are the states it got wrong.

This is B's question, already asked and answered **against inference**. Three consequences:

1. Every value-inspecting heuristic is **pre-rejected** — implemented, shipped, reverted,
   with the broken states enumerated. Not a fresh design space; a reopened one.
2. The incumbent resolved the ambiguity by making leaves **non-callable** — `.update(fn)`
   is an explicit method, so no ambiguity can arise. Greenfield removes exactly that, so
   `location(fn)` ⇒ DERIVE **reintroduces a settled defect** unless disambiguation is
   explicit and static.
3. The ambiguity already exists at branch level and is only *diagnosed*, not solved:
   `tree.updateAndReport({ user: () => null })` returns `[]` and logs `console.error`.

### FROZEN RULE

> **FUNCTION INTENT MAY NOT BE INFERRED FROM CURRENT STATE.**
>
> Not from the current value, the previous value, function shape, arity, or the
> class/function distinction. **THE ARGUMENT SHAPE DECIDES.**

## FROZEN — CANONICAL LOCATION GRAMMAR

```
location()                              READ
location(updaterFunction)               DERIVE
location(functionValueMarker(callable)) REPLACE callable AS DATA

tree.$() / tree.$(updater) / tree.$(marker(callable))
    the root is the SAME location grammar
tree                                    controller, NOT callable
```

⚠️ DELIBERATELY NARROWER THAN IT FIRST READ. An earlier draft of this section
froze `location(nonCallableValue) => REPLACE` for every location shape. That
overreaches: it would silently settle **branch object write semantics** — whether
`tree.$.user({name:'Bob'})` merges or replaces — which FUNCTION-AS-STATE-0 has no
authority to decide. Function disambiguation only needs to establish what a
CALLABLE argument means. The non-callable value case is left open below.
Ownership: the canonical location object belongs to the kernel; an Angular
`WritableSignal` is an adapter view.

### The marker is EPHEMERAL

**AN AMBIGUITY MARKER CLASSIFIES THE INVOCATION; IT IS NOT PART OF THE VALUE.**

```
callback(marker(fn))  →  classify REPLACE  →  unwrap at the boundary  →  kernel stores raw fn
```

so `callback(marker(handler))` is immediately followed by `callback() === handler`.

The marker MUST NOT enter state, snapshots, Link values, persistence, serialization,
restoration facts or causal payloads. Conceptual internal shape (public name NOT frozen):

```ts
interface FunctionValue<T extends Function> {
  readonly /* private brand */: true;
  readonly value: T;
}
```

⚠️ A "does the wrapper survive persistence/Link?" experiment was proposed and is
**wrong by construction** — there is no wrapper to survive. Only *authored callable
invocation* carries the ambiguity; Link acquisition, restoration and deserialization are
distinct causal operations and need no marker at all. Do not infect every value channel
with a solution to a syntax-only problem.

### Why FN-A over FN-B

FN-B's only claimed advantage was that it never touches the value — but a correctly
designed FN-A does not either. REPLACE already has an authoritative spelling,
`location(value)`; only the callable subset collides syntactically with DERIVE. That
calls for an argument disambiguator, not a second mutation API.
(ONE SEMANTIC JOB, ONE AUTHORITATIVE PUBLIC SURFACE; SPECIALIZE THE RARE CASE BEFORE
TAXING THE COMMON CASE.) **FN-C is dead** — excluding function state would re-break
`onConfirm` and class-constructor fields.

## B1 DISCRIMINATOR — RESULT: PASS

Boundary-consumption discriminator over the **real neutral kernel**, zero Angular.
19/19 assertions across the seven required cases:

```
C1 n(5)                       replace, stored 5
C2 n(c => c + 1)              derive, stored 2
C3 null → marker(handler)     NOT invoked; replace; cb() === handler
C4 fn → marker(handlerB)      replace; cb() === handlerB; neither invoked
C5 marker(class Thing)        NOT instantiated; replace; ctor() === Thing
C6 derive on a fn location    derive; updater receives the RAW stored fn
C7 marker does not leak       kernel stores the raw fn; no marker object retained;
                              no brand symbol on the stored value; observation and
                              read both see the raw fn
```

### The falsifier

Reintroducing the reverted heuristic — *"if the current value is a function, the argument
must be data"* — turns **C6 red** (3 assertions). Under that heuristic a function-valued
location can never be DERIVED at all: every callable argument is swallowed as data. That
is the historical defect reproduced on demand, and it is the mutation B must carry.

### Typing carrier

`NotFn<T>` — currently exported from the barrel with **no live consumer**, residue of the
incumbent's own attempt at this disambiguation — turns out to be exactly the right tool.
It is distributive, so `NotFn<null | (() => void)>` = `null`.

```ts
type Loc<T> = {
  (): T;
  (next: NotFn<T>): void;             // REPLACE a non-callable
  (marker: FunctionValue<T>): void;   // REPLACE a callable AS DATA
  (updater: (current: T) => T): void; // DERIVE
};
```

For `State = { onConfirm: null | (() => void) }` — all compile: `$.onConfirm()`,
`$.onConfirm(null)`, `$.onConfirm(mark(handler))`, `$.onConfirm(c => c)`. Correctly
**rejected**: `$.onConfirm(handler)` — a naked callable is DERIVE, and `() => void` is not
a valid updater for that type. Verified by positive control (breaking a MUST-COMPILE line
→ tsc exit 2; restored → 0; every `@ts-expect-error` fires, since an unused directive is
itself an error).

Adversarial case — a location whose value is **itself updater-shaped**
(`transform: (n: number) => number`) — also resolves: `$.transform(double)` is rejected,
`$.transform(c => n => c(n) + 1)` derives, `$.transform(mark(double))` replaces. Even
`$.transform(c => c)` is unambiguously DERIVE (returns the stored fn unchanged); storing
the identity function as data requires the marker. **The argument shape decides, never the
stored value.**

## STILL OPEN

- the marker's public name — deferred to the public API naming review
- branch/root deep-merge vs replace: the incumbent's `NodeAccessor` deep-merges
  (`tree.$.user({name:'Bob'})` preserves `age`). The frozen greenfield operation is
  REPLACE. **The incumbent branch callable is evidence about old behaviour, not veto
  power** — this must be decided explicitly, not inherited.

## FROZEN — NON-AUTHORED ENTRANCES

> **AN OPERATION THAT ALREADY KNOWS ITS MUTATION SEMANTICS MUST NOT RE-ENTER
> THROUGH SYNTAX WHOSE JOB IS TO INFER THOSE SEMANTICS.**

```
AUTHORED CALLABLE ENTRANCE          REALIZATION / RESTORE / HYDRATE / LINK ACQUISITION

location(mark(fn))                  operation already knows its causal class
  → classify as DATA                  → install the raw value directly
  → mutationIntent = REPLACE          → do NOT reinterpret through authored
  → unwrap to fn                        callable syntax
  → marker dies
location(fn)  → DERIVE
```

Generalizes beyond functions. If Link realization ever implemented function ingress by
internally calling `location(rawFunction)`, the defect would not be "the marker got lost"
— it would be that **realization crossed the wrong authority entrance**.

### C8 — non-authored raw-function ingress (added, PASS)

```
realization acquires a raw fn   → raw fn stored; fn NOT invoked; no marker required;
                                  causal class stays 'realized'; read returns the raw fn
```

Falsifier: routing ingress through the authored callable entrance turns C8 red —
`ran=1`, the incoming function is **invoked as an updater** and its return value
`'from-server'` is stored in place of the function itself.

**Discriminator total: 24/24 across 8 cases, two independent falsifiers proven.**

## ⚠️ TYPING DEFECT FOUND — `NotFn` IS INSUFFICIENT

A class constructor is `typeof === 'function'` at runtime but is **not callable without
`new`**, so `typeof Thing` does NOT extend `(...args: never[]) => unknown`. The exported
`NotFn` therefore lets a bare class through the *value* overload:

```ts
$.ctor(Thing);   // COMPILES as REPLACE under the shipped NotFn
```

while the runtime classifies it DERIVE and invokes it. Measured:

```
RUNTIME THREW: Class constructor Thing cannot be invoked without 'new'
```

That is the same failure `change-reporting.spec.ts` already fixed once — "invoking one
throws, which used to escape mid-loop leaving `a` written, `b` unwritten and nothing
reported." A runtime/type divergence, and the type is the wrong half.

Required widening (verified: rejects a bare class AND a bare callable, while
`mark(Thing)`, `null` and updaters all still compile):

```ts
type AnyCallable =
  | ((...args: never[]) => unknown)
  | (abstract new (...args: never[]) => unknown);
type NotFn<T> = T extends AnyCallable ? never : T;
```

### ⚠️ DO NOT CARRY "WIDEN PUBLIC `NotFn`" AS THE PRESUMED FIX

The measured finding is that the greenfield overloads need a type meaning
**non-callable AND non-constructable value**. It is NOT that the public `NotFn` export
must acquire that meaning. `NotFn` currently has **no live consumer** — it is residue of
an earlier disambiguation attempt — so reusing it would take a currently-unused public
type and make it load-bearing merely because the implementation can.

> **INTERNAL IMPLEMENTATION NEED DOES NOT MANUFACTURE PUBLIC API VALUE.**

```text
NOTFN-GREENFIELD-DISPOSITION            (required in §C)

Does `NotFn` have an independent AUTHOR-FACING semantic job?

NO   delete it from the greenfield public surface;
     use an internal type for the callable-location overloads
YES  prove the public consumer/job, then decide whether its contract widens
```

Expectation is DELETE, with something internal such as `CallableLike` /
`NonCallableValue<T>` (exact names irrelevant).

**The constructor invariant survives independently of `NotFn`:**

> **ANYTHING THE RUNTIME CLASSIFIES AS CALLABLE SYNTAX MUST BE EXCLUDED FROM THE
> ORDINARY-VALUE OVERLOAD UNLESS EXPLICITLY MARKED AS DATA** — ordinary functions and
> constructors alike.

### Why the discriminator stays in the scratchpad

The subject — the real greenfield callable location — does not exist yet. Building a
permanent fake location implementation to carry a future invariant would repeat exactly
the prototype-retirement problem ATOMIC-STATE-RETIREMENT just cleaned up. The evidence
lives in this record; when §C creates the real callable, the eight cases move onto that
real subject immediately.

## FUNCTION-AS-STATE-0 — CLOSED (FNS-A)

```
FROZEN
    function-valued state is admitted
    intent may NOT depend on: current value, previous value,
                              function arity, function/class distinction
    authored naked callable            => DERIVE
    authored explicitly marked callable => REPLACE
    marker is invocation-only encoding; it dies before kernel mutation
    stored values are raw functions
    non-authored entrances receive raw values directly, retain their
      already-known causal classification, and MUST NOT route through
      authored callable interpretation

OPEN
    public marker/helper name
    exact TS overloads (NotFn must be widened for constructors — see above)
    branch object write semantics (merge vs replace) — NOT settled here
```

The conceptual error in the first FN-A objection was treating an **ambiguity escape** as a
**value wrapper**. Once the marker is understood as command encoding rather than data
representation, FN-A is the cleaner option and FN-B loses most of its justification.

---

# GREENFIELD-BRANCH-WRITE-0 — ARTIFACT AUDIT (open, not ruled)

> What does `location(objectValue)` mean at a branch/root?
> BR-A REPLACE · BR-B MERGE · BR-C canonical REPLACE + merge as a separate operation

## Measured current behaviour

```
state = { user: { name: 'Ada', age: 40 } };  tree.$.user({ name: 'Grace' })

plain branch   {"name":"Grace","age":40}     MERGE
nested         {"b":{"x":9,"y":2}}           MERGE, deep
root           {"p":1,"q":{"r":9,"s":3}}     MERGE, deep
entity node    {"id":1,"name":"b"}           REPLACE — `note` dropped
```

## ⚠️ THE INCUMBENT IS ALREADY INTERNALLY INCONSISTENT

The same callable grammar means MERGE at a plain branch and REPLACE at an entity node.
The entity path did not drift there — it moved deliberately, and recorded why
(`entity-signal.spec.ts:2399`):

> *"The updater form is the argument for replace: it returns a full `E`, so **under merge
> semantics removing a key was silently impossible**."*

with two permanent carriers: `node(updater) REPLACES, so an updater that drops a key
drops it` and `node(value) REPLACES rather than merging`.

So one half of the public grammar already chose BR-A, **because merge was a defect there**.
That is not an aesthetic prior for BR-A; it is an artifact precedent, and it violates
ONE SEMANTIC JOB, ONE AUTHORITATIVE PUBLIC SURFACE as it stands.

## Requirement evidence for MERGE

| dimension | finding |
|---|---|
| causal class | **`MutationKind` has NO `merge`** — `set \| update \| insert \| remove \| move \| rekey \| replace`. Merge decomposes into per-leaf writes; it is a surface convenience, not a semantic primitive. |
| permanent tests whose SUBJECT is merge | **one** — `callable-contract.spec.ts:38` "a BRANCH called with an object merges it" |
| docs | none teach merge-vs-replace as a contract |
| real consumers | none found in `apps/` |
| entity path | actively moved AWAY from merge, with a recorded defect as the reason |

## Blast radius — measured, not estimated

Flipping the plain-branch object call to REPLACE (unpassed keys cleared) and running the
full suite:

```
14 failed / 1936 passed  (7 of 239 files)   =  0.7% of the suite
```

518 branch/root object call sites exist across 97 spec files, so **the vast majority are
already insensitive to the distinction** — they pass complete values.

### Classification of the 14 — NOW FULLY VERIFIED

Every failing fixture was completed and re-run under BR-A. **14 → 5.**

| # | tests | class | evidence |
|---|---|---|---|
| 8 | 3 `auto-batching`, 4 `egress-1`, 1 `angular-validation-null` | **FIXTURE-DEPENDENT** | pass unchanged once given complete values; their subjects (batching, observer firing, computed invalidation) are untouched by the rule |
| 1 | `mut-participation > BRANCH call form` | **FIXTURE-DEPENDENT** | `{a:{n:1,s:'x'}}` written with `{n:3}`; completing to `{n:3,s:'x'}` passes |
| 1 | `traversal-diagnostics > DIFFERENT namespace` | **ARTIFACT OF THE PROBE** | `expected 0 to be 2` — my `full` construction builds from `Object.keys(store)` and so DISCARDS the unknown key before `recursiveUpdate` sees it, suppressing the very diagnostic under test. A real BR-A must still diagnose unknown keys. Not a merge dependency. |
| 1 | `callable-contract > a BRANCH called with an object merges it` | **GENUINE BR-B CARRIER** | its subject IS merge |
| **3** | `bind-branch-0-acquisition-turn` | **GENUINE SEMANTIC DEPENDENCY — and the real finding** | see below |

### ⚠️ THE FINDING: partial writes have a surviving job, but NOT in authored syntax

`bind-branch-0-acquisition-turn.spec.ts` cannot be fixed by completing its fixture,
because the partiality **is** the subject:

```ts
/** What Y actually supplied. `distancePrecision` is deliberately NOT in it. */
const PAYLOAD = { theme: 'dark', units: 'metric' };

external(() => tree.$.settings(PAYLOAD));

// Both payload members are individually VISIBLE — the acquisition is not an
// opaque blob. That is what lets a debugger say which values storage supplied.
expect(effects.map((e) => e.path).sort()).toEqual([
  'settings.theme',
  'settings.units',
]);
```

Under BR-A, clearing `distancePrecision` emits a THIRD effect, and the claim "the effects
are exactly what storage supplied" is false. **An external system supplying a subset of
fields is a real, admitted requirement.**

But look at how it is spelled: `external(() => tree.$.settings(PAYLOAD))` — a non-authored
acquisition **re-entering through the authored callable**. That is precisely what B1 froze
against:

> AN OPERATION THAT ALREADY KNOWS ITS MUTATION SEMANTICS MUST NOT RE-ENTER THROUGH SYNTAX
> WHOSE JOB IS TO INFER THOSE SEMANTICS.

So BR-A does not destroy this requirement — **it relocates it.** Partial application is an
INGRESS concern (external acquisition, hydrate, Link realization, restoration), and those
entrances already know their causal class. They need an ingress operation that installs
exactly the supplied keys, not a borrowed authored-merge.

This answers the question the audit was posed to answer:

> If MERGE proves a distinct surviving job, does it belong in the canonical callable?

**It has a job. The job is not authored syntax.**

### Corrected blast radius for BR-A

```
authored-syntax cost      1 test  (callable-contract) + 9 fixture completions
probe artifact            1 test  (would not occur in a real BR-A)
relocation required       3 tests (bind-branch-0) — partial EXTERNAL acquisition
                                   needs its own ingress spelling
```

### Superseded classification (kept for the record)

- **1 genuine BR-B carrier**: `callable-contract.spec.ts` — its subject IS merge.
- **13 appear fixture-dependent**: their subjects are batching, notifier reach, external
  acquisition classification and observation — not merge. They pass partial objects
  because the incumbent permits it.

Mechanism verified on ONE case (`mut-participation.spec.ts > BRANCH call form`):
`expected ['a.n','a.s'] to deeply equal ['a.n']` — clearing the unpassed `a.s` emitted an
extra mutation event. Under BR-A with correct typing, a partial object at a branch would
not compile at all; these call sites would be given complete values.

⚠️ I did NOT individually re-run all 13 with completed fixtures. The class is inferred
from one verified example. **FIXTURE DEPENDENCY IS NOT SEMANTIC DEPENDENCY** — but that
rule is being applied here by inference, and the remaining 12 should be confirmed before
BR-A is ruled, not after.

## Where this points (NOT a ruling)

BR-A is supported by: no causal class, one subject-level carrier, no docs, no consumers,
0.7% blast radius, and an existing half of the grammar that already chose it for cause.
BR-C remains live if merge proves an independent job — but nothing found so far gives it
one, and `tree.$.user({name:'Bob'})` merging while `byId(1)({...})` replaces is the strongest
argument against keeping both meanings on the same spelling.

⚠️ NOT DECIDED HERE. The 12 unverified fixtures must be confirmed first.

## PER-ROW CLASSIFICATION — all 14 closed

| test | subject | class |
|---|---|---|
| `auto-batching > auto-batch partial object updates` | batching | FIXTURE-ONLY |
| `auto-batching > handle nested partial updates` | batching | FIXTURE-ONLY |
| `auto-batching > batchScope called for object partial updates` | batching | FIXTURE-ONLY |
| `egress-1 > CONTROL — an authored write fires it` | observer firing | FIXTURE-ONLY |
| `egress-1 > an EXTERNAL acquisition fires it too` | observer firing | FIXTURE-ONLY |
| `egress-1 > an UNDO fires it — twice` | observer firing | FIXTURE-ONLY |
| `egress-1 > repeated A→B→A→B fires four times` | observer firing | FIXTURE-ONLY |
| `angular-validation-null > branch read invalidates on a BRANCH call-form write` | computed invalidation | FIXTURE-ONLY |
| `mut-participation > BRANCH call form` | notifier reach | FIXTURE-ONLY |
| `traversal-diagnostics > DIFFERENT namespace` | unknown-key diagnostics | **MIS-SPECIFIED PROBE** — my `full` construction discarded the unknown key before `recursiveUpdate` saw it, suppressing the diagnostic under test. Not a merge dependency; a defect in the experiment. |
| `callable-contract > a BRANCH called with an object merges it` | **merge itself** | MERGE-DEPENDENT (the explicit BR-B carrier — not to be "fixed") |
| `bind-branch-0 > every value the payload supplied is materialized and classified external` | partial EXTERNAL acquisition | MERGE-DEPENDENT → **RELOCATE** |
| `bind-branch-0 > CONTROL — the same branch write WITHOUT external() is authored` | same, control arm | MERGE-DEPENDENT → **RELOCATE** |
| `bind-branch-0 > a DERIVATION produces no mutation event at all` | same fixture | MERGE-DEPENDENT → **RELOCATE** |

### Positive control (required, executed)

Runtime held constant at BR-A; only the fixture changed:

```
arm A  partial fixture   → 3 failed
arm B  complete fixture  → 9 passed      ⚠️ ASSERTIONS UNCHANGED
arm C  revert to partial → 3 failed again
```

Arm B is the strongest row in the audit: `expect(tree.$.user()).toEqual({name:'Bob', age:30})`
still holds under REPLACE once the call supplies the complete value. **The assertion never
encoded merge — only the final state**, which is identical under either rule when the
caller passes what they mean.

## ⚠️ THE INCONSISTENCY IS DEEPER THAN FIRST REPORTED

`NodeAccessor<T>` (node-accessor.ts:5):

```ts
/** Write: deep partial merge — keys not present are preserved. */
(value: Partial<T>): void;
/** Write: receives the current unwrapped value; the result is merged. */
(updater: (current: T) => T): void;
```

**Both forms merge** at a plain branch. At an entity node **both replace** —
`node(updater) REPLACES, so an updater that drops a key drops it`. The earlier entry in
this record said the split was in the value form; it is in the value form AND the updater
form. Two callable spellings, each meaning opposite things depending on which half of the
tree you are in.

The type is also the wrong half under BR-A: `Partial<T>` actively *invites* merge-style
calls. A BR-A branch write must require a complete `T`, or the runtime replaces while the
type encourages partials — the same runtime/type divergence found in the `NotFn`
constructor case.

```ts
location(fullValue: T): void              // REPLACE
location(updater: (current: T) => T): void // DERIVE
```

## DISPOSITION — BR-A EARNED, one relocation required

13 of 14 rows are fixture-only or a mis-specified probe. The lone authored-syntax merge
carrier is `callable-contract`, whose claim is contradicted by the entity half of the same
grammar and by `MutationKind` having no `merge`.

The three `bind-branch-0` rows do NOT block BR-A. They prove partial application is real,
and that it is currently mis-spelled: a non-authored acquisition re-entering through
authored callable syntax, which B1 already froze against. BR-A + an explicit ingress
operation preserves the requirement and removes the double meaning.

⚠️ STILL THE REVIEWER'S RULING. Recorded as earned, not as decided.

---

# GREENFIELD-BRANCH-WRITE-0 — RULED

Not "REPLACE beats MERGE." The ruling is about **who owns strictness**:

> **THE LOCATION TYPE DEFINES WHAT CONSTITUTES A COMPLETE VALUE.
> THE MUTATION SURFACE MUST NOT IMPLICITLY WEAKEN IT.**

```
T             describes what values this location is allowed to contain
Partial<T>    describes a mutation convenience that WEAKENS that contract
```

If every object call accepts `Partial<T>`, the API has said *"for writes through this
surface you need not satisfy `T`"* — and the state author's declaration stops protecting
the operation. Recovering that later with a stricter second operation
(`location.replace(fullValue)`) would be backwards: the primary API would have discarded
the safety the secondary API exists to restore.

## FROZEN

```ts
type Location<T> = {
  (): T;
  (value: NonCallableValue<T>): void;   // a WHOLE value of T
  (updater: (current: T) => T): void;   // DERIVE the whole next T
  (marked: FunctionValue<T>): void;     // a callable T as a whole value
};
```

The state author keeps authority in every direction, and SignalTree second-guesses none
of it:

| author writes | callable requires |
|---|---|
| `user: User` | a complete `User` |
| `user: Partial<User>` | any partial — that IS a complete value of this location's type |
| `user: { name: string; age?: number }` | `name`; `age` optional |
| `user: DeepPartial<User>` | whatever that type defines |

Verified (tsc exit 0 — every allowed form compiles and every rejection fires):

```ts
A.user({ name: 'Dave', age: 42 });   // strict T = User      ✓
A.user({ name: 'Dave' });            // strict T = User      ✗ rejected
B.user({ name: 'Dave' });            // T = Partial<User>    ✓
C.user({ name: 'Dave' });            // age? optional        ✓
C.user({ age: 42 });                 // name required        ✗ rejected
D.byId(1)({ id: 1, name: 'b' });     // entity parity        ✓
D.byId(1)({ name: 'b' });            // partial Row          ✗ rejected
```

### Positive control — the cost of `Partial<T>`, measured

Weakening only the value overload to `Partial<NonCallableValue<T>>` produces **3 unused
`@ts-expect-error` directives**: every strictness rejection stops firing.

The third is the sharpest. Under `Partial<T>`, the author's own type
`{ name: string; age?: number }` — where they deliberately marked `age` optional and
`name` required — loses the `name` requirement too. `Partial<T>` does not merely add
convenience; **it erases a distinction the author explicitly drew.**

## Consequences

**Patching keeps an accurate spelling** — it is a DERIVE, because the result depends on
current state:

```ts
$.user((current) => ({ ...current, name: 'Dave' }));
```

If that proves common enough to be annoying, a dedicated convenience can earn its
existence later (`patch($.user, { name: 'Dave' })`, spelling unfrozen). It would say
PATCH explicitly rather than silently weakening the canonical assignment.

**Entity parity falls out for free** — the special case disappears instead of being
carried forward:

```ts
$.user(fullUser);         // whole-location assignment
$.rows.byId(1)(fullRow);  // whole-location assignment — same grammar, same meaning
```

**Dispositions:**

- `callable-contract > a BRANCH called with an object merges it` — RETIRED as a
  contradicted incumbent contract.
- `NodeAccessor<T>`'s `(value: Partial<T>)` and merging updater — replaced by the frozen
  `Location<T>`.
- `bind-branch-0`'s three rows — RELOCATE. Partial external acquisition remains admitted
  and becomes an explicit ingress capability in §C; it does not survive as a second
  meaning on the authored callable.

---

# GREENFIELD-BRANCH-WRITE-0 — CLOSED (BR-A)

## ⚠️ VOCABULARY CORRECTION — "REPLACE" IS NOT THE PUBLIC CONTRACT WORD

This record used REPLACE throughout. That biases the reading toward an implementation
interpretation, and it collides with vocabulary that already exists — in **two** places,
not one (`mutation-types.ts`):

```ts
export type MutationKind = … | 'replace';        // :37   a causal KIND
mutationIntent?: 'replace' | 'derive';           // :126  a causal INTENT
```

So `replace` is already spoken for twice internally. The public contract word is
**whole-value assignment** (or whole-value SET). The layers are distinct and the mapping
is one-way:

```
PUBLIC GRAMMAR                     INTERNAL CAUSALITY
location(value)                →   mutationIntent 'replace'
location(updater)              →   mutationIntent 'derive'
location(mark(callable))       →   mutationIntent 'replace'
```

`mutationIntent: 'replace'` from B1 stays correct — it is the internal causal term and
was never the public word. Read every earlier "REPLACE" in this record as **whole-value
assignment** where it describes the public grammar.

## FROZEN

> **A VALUE-FORM LOCATION CALL SUPPLIES THE NEXT VALUE OF THAT LOCATION.**
>
> **THE STATE TYPE DEFINES ITS OWN STRICTNESS. THE MUTATION API MUST NOT WEAKEN IT.**

```
location(value)     authored WHOLE-VALUE assignment    value parameter is T, NOT Partial<T>
location(updater)   authored derivation                current T -> whole next T
```

The incumbent's split disappears rather than being reconciled:

```
                       INCUMBENT                GREENFIELD
plain branch value     MERGE                    whole next T
plain branch updater   MERGE                    current T -> whole next T
entity node value      whole-value assignment   whole next T
entity node updater    whole-value assignment   current T -> whole next T
```

## DISPOSITIONS

**`callable-contract > a BRANCH called with an object merges it` — CONTRADICTED.**
Explicitly NOT vacuous: the subject survives, and the architecture deliberately chooses
the opposite behaviour. Reason of record — incumbent plain-branch callable semantics
conflict with the frozen whole-location assignment contract AND with the entity half of
the same callable grammar.

**`bind-branch-0` ×3 — RELOCATE.** They prove *partial external acquisition*. They do NOT
prove that authored `location(value)` must mean patch. Governed by B1: an operation that
already knows its mutation semantics must not re-enter through syntax whose job is to
infer them.

```
AUTHORED                              NON-AUTHORED ACQUISITION
$.settings(fullSettings)              acquire the payload through its own
$.settings(cur => nextSettings)       realization path, which may apply a
                                      partial external projection
                                      NOT: $.settings(partialPayload)
```

**Patch** keeps an accurate authored spelling — `$.user(cur => ({...cur, name:'Dave'}))`
is a derivation, because the result depends on current state. A dedicated `patch()`
convenience may earn its own spelling later; it would say PATCH rather than silently
weakening canonical assignment.

## §C OBLIGATIONS

```text
1. callable value overload uses T, not Partial<T>
2. callable updater returns T, not Partial<T>
3. functions/constructors excluded from the ordinary-value overload unless
   explicitly marked as data
4. the 9 FIXTURE-ONLY tests migrate to complete values, ASSERTIONS UNCHANGED
5. the 1 MERGE-DEPENDENT carrier retires as CONTRADICTED
6. the 1 MIS-SPECIFIED probe contributes NO semantic evidence
7. the 3 RELOCATE cases move to an explicit non-authored partial-ingress carrier
8. TYPE CARRIER    User requires name+age; $.user({name:'Dave'}) MUST NOT compile
                   control: Partial<User> state allows it
9. RUNTIME CARRIER omitted keys are ACTUALLY ABSENT after whole-value assignment,
                   not silently preserved
```

Obligation 9 is the one with no evidence yet. Every measurement so far probed the
*authored-call* side; nothing has confirmed that a real implementation leaves omitted keys
absent rather than preserved. The BR-A probe wrote `undefined` into them, which is not the
same thing — and that probe also mis-specified the unknown-key diagnostic. It must be
proven on the real implementation, not inherited from the spike.

## ⚠️ IMPLEMENTATION RULE — THE MECHANISM IS NOT THE PROBE

> **WHOLE-VALUE ASSIGNMENT MUST NOT BE IMPLEMENTED AS
> "PARTIAL WRITE WITH OMITTED KEYS CLEARED."**

The BR-A discriminator built its next value as
`Object.fromEntries(Object.keys(store).map(k => [k, arg[k]]))`, manufacturing `undefined`
writes for every omitted descendant. That was a serviceable way to *measure* which tests
depended on merge. It is **not** the target mechanism, and it visibly misbehaved in two
ways that would be defects in production:

- it emitted a spurious mutation event for each omitted key (`['a.n','a.s']` where the
  claim was `['a.n']`)
- it discarded unknown keys before `recursiveUpdate` saw them, suppressing the
  unknown-key diagnostic entirely (`expected 0 to be 2`)

The kernel must install the complete `T` as the location's next value. The distinction is
load-bearing for notifications, causal events, structural deletion, entity-containing
branches, and diagnostics — every one of which the probe got wrong.

This supersedes the weaker phrasing of obligation 9: it is not only that omitted keys must
end up absent, but that they must never be *written* to get there.

---

# §C PROGRESS — C1 AND C2

## C1 — the real `Location<T>` exists

`packages/core/src/lib/internals/tree-location.ts`, built over the neutral scalar runtime.
Neutral: no `@angular/*` in the file or its closure.

```ts
location()                 READ
location(value)            authored WHOLE-VALUE assignment
location(updater)          authored DERIVE
location(mark(callable))   whole-value assignment of the raw callable
```

The marker is consumed in the dispatcher; the kernel only ever receives the raw function.
`acquireScalarLocation` is the non-authored ingress seam (C4 owns its full form) and is
deliberately not exported publicly.

**The §B discriminator moved onto the real subject and the scratchpad prototype was not
kept** — a permanent fake implementation carrying a real invariant is the
prototype-retirement problem again. `tree-location.spec.ts`: **9/9**, cases 1–8 plus a new
row, *classification never consults the stored value*, which pins the rule directly rather
than through a symptom.

Both falsifiers re-proven on the real subject:

```
reintroduce inference-from-current-state   → 2 failed  (C6 + the classification row)
route ingress through authored callable    → 1 failed  (C8)
restored                                   → 9 passed
```

## C2 — the type contract holds, and is non-vacuous

`tree-location.typing.spec.ts` (typechecked, not executed — the repo convention, covered
by the `spec-types` gate). Every allowed form compiles; every `@ts-expect-error` fires.

```
Location<User>                      { name, age } ✓      { name } ✗
Location<Partial<User>>             { name } ✓           {} ✓
Location<{name; age?}>              { name } ✓           { age } ✗
Location<Row>                       whole Row ✓          partial ✗
Location<null | (() => void)>       mark(handler) ✓      naked handler ✗
Location<typeof Thing | null>       mark(Thing) ✓        bare class ✗
Location<(n:number)=>number>        updater-shaped value resolves by ARGUMENT SHAPE
```

Control: weakening only the value overload to `Partial<NonCallableValue<T>>` produces
**3 unused `@ts-expect-error` directives** — every strictness rejection stops firing.
Restored: 0 errors.

## NOTFN-GREENFIELD-DISPOSITION — DELETE (earned, execution deferred to C8)

Repo-wide, `NotFn` has **zero type positions**. Every reference is inert:

```
types.ts:76        its own definition
index.ts:63        its barrel export
api-baseline.json  a record OF the export
types.ts:1137      inside a commented-out overload
callable-contract.spec.ts:21, CHANGELOG, docs/archive, docs/audits   prose
```

Control: the same search shape returns 58 references for `CallableWritableSignal`.

**No independent author-facing job. Verdict: DELETE from the greenfield public surface**,
with the internal `NonCallableValue<T>` in `tree-location.ts` carrying the job instead.
Internal implementation need does not manufacture public API value.

⚠️ EXECUTION DEFERRED, not softened. The `api-baseline` gate covers "no undeclared export
added **or removed**", so removing the export fails it until the baseline is regenerated —
and C8 regenerates the baseline once, for the whole greenfield surface, after the surface
review. Deleting it now would mean either a premature baseline regen or a worked-around
gate. It lands with the coordinated change.

⚠️ A probe that "confirmed" this by running `tools/check-api-baseline.mjs` was INVALID —
that file does not exist, and the run returned exit 1 in BOTH the mutated and restored
arms. The real gate is `tools/api-inventory.mjs --check` with `needsBuild: true`. Recorded
because the failing arm looked like evidence and was not; only the restored-arm control
exposed it.

## C2 CORRECTIONS

**The marker was broader than the frozen contract.** `FunctionValue<T>` and its factory
accepted any `T`, so `asValue(42)` was conceptually admitted — a second spelling for
something `location(42)` already says unambiguously.

> **AN AMBIGUITY ESCAPE MUST NOT ACCEPT VALUES THAT ARE NOT AMBIGUOUS.**

Narrowed: the escape is bounded to exactly the values the runtime would misread.

```ts
export type CallableSyntax =
  | ((...args: never[]) => unknown)
  | (abstract new (...args: never[]) => unknown);
export type CallablePart<T> = Extract<T, CallableSyntax>;

export interface FunctionValue<T extends CallableSyntax> { … }
export function asValue<T extends CallableSyntax>(value: T): FunctionValue<T>;

interface Location<T> { …; (marked: FunctionValue<CallablePart<T>>): void; }
```

Carrier added — `asValue(handler)` and `asValue(Thing)` compile; `asValue(42)`,
`asValue({x:1})` and `asValue('nope')` are rejected. Control: widening the parameter back
to `unknown` makes **3 rejections stop firing**.

### ⚠️ EVIDENCE CORRECTION — A PIPED TSC EXIT IS NOT A COMPILER EXIT

C1/C2 were reported with `npx tsc … | head -5; echo "tsc exit=$?"`, which prints **`head`'s**
status. It printed `tsc exit=0` while TS6305 errors were visible in the same output. That
is the recorded rule — VERIFY BY EXIT CODE, NOT BY PIPELINE — broken in the act of
claiming verification.

Re-run unpiped, and the honest result is more interesting than a green tick:

```
npx tsc --noEmit -p packages/core/tsconfig.spec.json > /tmp/c2.out 2>&1   →  exit 2
                                                        340 errors
grep -c "tree-location" /tmp/c2.out                                       →  0
node tools/check-spec-types.mjs                                           →  exit 0
```

**The raw spec typecheck is non-zero BY DESIGN** — 340 pre-existing errors are what the
`spec-types` ratchet exists to hold down. So a bare `tsc` exit could never have been the
evidence here. The valid evidence is: zero `tree-location` errors in the output, and the
ratchet gate green with no new baseline entry. Recorded so the next reader does not
"fix" a red raw exit that is the baseline working as intended.

## C3 — MARKER SPELLING FROZEN: `asValue(callable)`

> Treat this otherwise-callable argument as the value being assigned by this invocation.

Rejected: `markFunctionValue` (exposes architecture vocabulary), `value` (too generic, and
visually resembles another mutation operation), `literal` (a constructor is not naturally
a literal).

Implemented internally. **NOT barrel-exported** — the public surface flips once, at C8,
with the coordinated baseline regeneration.

## C4-INGRESS-CONTRACT — derived from the three carriers, nothing assumed

Fixture: `settings: { theme, units, distancePrecision }` — **one flat branch of scalar
leaves**. `PAYLOAD = { theme, units }` deliberately omits `distancePrecision`.

| # | question | answer | proven by |
|---|---|---|---|
| 1 | omitted descendants | **UNTOUCHED — no claim, no write.** And a later authored write to the omitted key does NOT inherit external provenance, even in the SAME tick | "⚠️ THE BOUNDARY": `byPath['settings.distancePrecision'].origin` is `undefined` after `external(...)` then `.set(1)` |
| 2 | supplied descendants | **REALIZED, per subject** — `origin: 'external'`, `participation: 'realized'`, one effect per supplied leaf (`settings.theme`, `settings.units`), never one opaque branch effect | "every value the payload supplied…" |
| 3 | one causal turn / transaction? | **NO.** `transactionId` is `undefined` on every effect; restoration history gains **0**; `canUndo()` is `false`. Acquiring durable truth is not authored work and earns no undo | same |
| 4 | unknown keys | **NOT PROVEN HERE.** No carrier in this file covers them; `traversal-diagnostics` owns that contract. Preserve it, do not guess | absence |
| 5 | function-valued supplied leaves | **NOT PROVEN HERE.** Governed by the B1 freeze — raw install, never authored-dispatched — and carried by `tree-location.spec.ts` C8 | absence |
| 6 | nested branches / entities | **NOT PROVEN.** The fixture has no nested branch and no `entityMap` (grep: 0). Admit only what the carriers prove | absence |

### The rule this yields

> **OMISSION IN A WHOLE VALUE IS VALUE SEMANTICS.
> OMISSION IN AN ACQUISITION PROJECTION IS SCOPE.**

and, from question 1's boundary test:

> **PROVENANCE FOLLOWS SUPPLIED INFORMATION, NOT DOWNSTREAM CAUSATION.**

So C4 must NOT be modelled as `acquire(branch, payload as Partial<T>)` — that reintroduces
the weakening just removed from authored syntax. The shape the artifacts support is a
projection walk that realizes exactly the supplied subjects and makes **no claim** on the
rest:

```
acquireProjection(branch, payload, causalClass)
    traverse the SUPPLIED projection only
    realize each supplied subject, per subject
    omitted ⇒ NO CLAIM / NO WRITE
    scope is limited to flat scalar leaves until a carrier proves more
```

⚠️ Questions 4–6 are open by ABSENCE of evidence, not by evidence of absence. C4
implements the smallest ingress satisfying 1–3 and does not generalize past it.

## C4 — NON-AUTHORED FLAT-SCALAR INGRESS: IMPLEMENTED

`packages/core/src/lib/internals/acquire-projection.ts`. Angular-free, not barrel-exported.

### ⚠️ THE ARTIFACT READ CHANGED THE IMPLEMENTATION

`external()` is **ambient** — `withWriteContext(meta, operation)` around a caller-supplied
callback. The existing boundary carrier only passes because that scope is the SYNCHRONOUS
CALLBACK, not the tick: `external(() => …)` followed by `.set(1)` puts the second write
outside the frame.

C4 takes a payload, not a callback, so it does not need ambience at all. Provenance is
attached **per subject** — one `withWriteContext` opened and closed around each single
write — so it cannot outlive the subject it describes:

```
for each SUPPLIED key
    resolve the subject
    withWriteContext(EXTERNAL_ACQUISITION, () => subject.set(value))   ← closes here
omitted keys
    nothing happens at all
```

### Carriers

The three `bind-branch-0` rows now exercise the real ingress instead of
`external(() => tree.$.settings(PAYLOAD))`. **Assertions untouched; 6/6.** The CONTROL arm
deliberately still uses the authored callable — it is the contrast that makes the others
mean anything, and C5 migrates it to a complete value.

New direct carriers (`acquire-projection.spec.ts`, 3/3):

```
realizes exactly the supplied subjects, omitted untouched
    realized === ['a','c']            per-subject INVENTORY, not just final values
    effects  === ['box.a','box.c']
    box.b unchanged                   no write, no claim

acquisition is not authored work
    restoration history +0 · canUndo() false

⚠️ THE BOUNDARY
    ingress { a: 1 }  then SAME TICK  tree.$.box.b.set(2)
    box.a external/realized · box.b origin and participation BOTH undefined
```

### Falsifiers — both required, both proven

```
1  provenance broadened from per-subject to an ambient TICK scope
       → THE BOUNDARY red: "expected 'external' to be undefined"
         the omitted sibling's authored write inherited external provenance

2  acquisition collapsed into one opaque branch realization
       → inventory red: "expected [ 'box' ] to deeply equal [ 'a', 'c' ]"
         right final state, causal information destroyed
```

Falsifier 1 is the novel one. Merely writing omitted keys was already known to be wrong;
the invariant this pins is isolation:

> **PROVENANCE FOLLOWS SUPPLIED INFORMATION, NOT EXECUTION PROXIMITY.**

### Deliberately not decided

**Atomicity.** Two supplied leaves produce two realized subjects; how many physical commit
frames carry them is private representation. No carrier freezes either "one atomic
multi-leaf acquisition" or "independent commits", and none was written.

**Unknown / non-scalar keys** are skipped with no throw, no diagnostic and no recursion —
adding any would invent a contract the carriers do not prove and would collide with the
unknown-key diagnostics `traversal-diagnostics` owns. Still OPEN.

Scope stayed flat: the only `nested|entities|recurse|deep` match in the file is the comment
naming what remains unproven.

### C4 close conditions

```
[x] real flat-scalar ingress exists
[x] three relocated bind-branch carriers pass on it (6/6, assertions unchanged)
[x] omitted subject gets no write / no claim
[x] supplied leaves appear as separate realized subjects
[x] no transaction / authored turn / restoration entry
[x] same-tick omitted authored write stays authored
[x] ambient-provenance mutation turns red
[x] opaque-branch-effect mutation turns red
[x] no nested / entity / general projection API introduced
[x] core 1961 passed · register 55/55
```

## C5 (first half) — WHOLE-VALUE ASSIGNMENT LANDED

### ⚠️ THE RUNTIME DID NOT NEED CHANGING. THE CONTRACT DID.

Both the object path and the updater path already call `recursiveUpdate`, which writes
exactly the keys it is handed. Given a complete `T` that **is** whole-value assignment:
merge was a consequence of ACCEPTING `Partial<T>`, never a separate merging mechanism.

So C5's runtime change is *nothing*, which is precisely what the implementation rule
demanded — the kernel installs the complete `T` and nothing manufactures `undefined`
writes for omitted descendants. The BR-A probe DID manufacture them and misbehaved twice
as a result; the real path never had that defect because it never had that mechanism.

### ⚠️ THE STRICTNESS HAD NO FALSIFIER AND WAS SILENTLY REVERSIBLE

Reverting `NodeAccessor` to `Partial<T>` failed **nothing**: `Partial<T>` is LOOSER, so
every completed call site still compiled and the whole suite stayed green. Nothing would
have stopped a future change from re-widening it — including a well-meaning one, since
widening a parameter never breaks callers.

Added a `@ts-expect-error` row on a partial branch call in
`callable-contract.typing.spec.ts`. An unused directive is itself a compile error, so
widening now turns `spec-types` red with `Unused '@ts-expect-error' directive`. Proven in
both directions.

Same class as the C4 falsifier: the invariant needing a pin was not the visible behaviour,
it was the thing that could quietly disappear.

### Migration — 47 sites, 16 files

Every completed fixture kept its assertions VERBATIM, which is the empirical confirmation
of the FIXTURE-ONLY classification made during the audit. Two judgment calls:

- **`bind-branch-0` CONTROL arm** completes to `distancePrecision: 2` — its current value —
  so only theme and units change and `effects.length === 2` survives untouched.
- **The CONTRADICTED merge carrier was RETIRED, not converted**, with the reason of record
  inline. Replaced by three carriers: whole-value assignment, re-supplying a key unchanged,
  and patch-as-DERIVE.

Benchmark scaffolding casts widened, noted as measuring throughput rather than typing.

### ⚠️ I UNDER-SCOPED THE MIGRATION; THE REGISTER CAUGHT IT

"Production: zero real breakage" was asserted after checking `packages/core` ONLY. The
`typecheck` gate — which compiles BOTH projects strictly, unlike the `spec-types` ratchet —
failed on `apps/demo/src/app/sanity-checks/standard-syntax-examples.ts:208`.

The repo-wide `NodeAccessor` count (151) had already been measured and reported. The right
number was in hand and the migration was scoped to the wrong one.

That file did not merely USE a partial write, it **taught** one:

```
// Branch — PARTIAL write; unlisted keys are left alone
// Root — callable too, and merges the same way
```

Four live teaching surfaces corrected: `standard-syntax-examples.ts`,
`start-here.component.ts`, `packages/core/README.md`, `migration-v14-v15.md`.

`docs/guides/migration-v13-v14.md` says *"still a deep partial merge"*, which was TRUE FOR
14.0. It is live instruction rather than archive, so it was annotated forward — the
historical claim stays accurate for the step it documents, with a pointer to 15.0.

### ⚠️ DOC-GATE GAP FOUND

`readme-apis` passed BEFORE those corrections. The teaching-region lint catches retired
*symbols*, not prose describing retired *semantics* — "merges partial values" names no dead
API while teaching a dead contract. Raised for C8; not patched mid-migration.

### Still open in C5

Retiring incumbent `tree()` and migrating the root to `tree.$`.

## TYPE-SURFACE-PROTECTION-0 — FROZEN PROCESS RULE

> **RUNTIME FAILURE DOES NOT AUTHORIZE A PUBLIC TYPE CHANGE.**
> **First attempt to make the runtime satisfy the existing type contract.**

Through the C8 public-surface review, no change to `TreeNode<T>`, recursive branch
inference, `EntitySignal` inference, readonly inference, callable/state overload
resolution, public generic constraints, or public barrel type exports without ALL of:

```
1. the exact type contract claimed wrong
2. the frozen semantic requirement that demands the change
3. a current compile-time reproduction
4. a positive control proving the type test can observe the property
5. blast-radius measured BEFORE implementation
6. explicit disposition of the fallout
7. approval BEFORE editing the public type expression
```

⚠️ THE DISTINCTION THAT MATTERS:

```
TYPE MUTATION AS FALSIFIER                    ENCOURAGED
PUBLIC TYPE CHANGE AS FIX FOR A RUNTIME BUG   PROHIBITED without a ruling
```

Deliberately widening a type to prove a gate can see the property — then restoring it
immediately — is good evidence infrastructure and should not be discouraged. What is
prohibited is *keeping* a type change because the runtime could not carry the contract.

### The excursion this rule exists to prevent

`OPEN-B1` was implemented as `string extends keyof T ? Record<never, never> : {…}`.
It compiled, production was clean, and it silently stripped child topology from every
`Record<string, V>` state and every `interface X extends Record<string, unknown>` —
**23 sites, most using that `extends` as a generic CONSTRAINT rather than open-key
intent**. It survived one tool call and was reverted; `TreeNode<T>` was then verified
**byte-identical to HEAD**.

### Tripwire

`type-surface-protection.typing.spec.ts` pins four properties while the runtime changes:
recursive known-key inference, recursive open-key inference, hybrid named-key inference,
closed arbitrary-key rejection. Mutation-proven: reintroducing the `string extends keyof T`
special case yields **4 errors**; restored, 0.

### Wording correction

`NodeAccessor<T>`'s JSDoc said *"an author who wants partial writes declares the location
`Partial<T>`"* — which resurrects the semantics BR-A removed. Corrected and frozen:

> **`Partial<T>` DESCRIBES THE SHAPE OF STATE. IT DOES NOT MEAN PARTIAL-WRITE SEMANTICS.**

### Why `Partial<T>` → `T` is justified

NOT "narrower is safe" — narrowing a public API can break legitimate callers. It is
justified because: BR-A froze whole-value authored assignment; `Partial<T>` weakened the
author's declared `T`; the strictness mutation control proves widening reintroduces the
defect; the fallout was inventoried and classified (47 sites, 16 files); production
required zero accommodation; typecheck and spec-types are green.

---

# ⚠️ MARKER-SHAPE-0 — RETRACTED. THE FINDING DOES NOT EXIST.

An earlier revision of this record reported that marker-hosting structures pay a
1.3–1.9× penalty on ordinary property traversal, reproduced on incumbent
`entityMap`, and flagged it as a production issue affecting every marker.

**That was a construction-order artifact, not a property of markers.**

Swapping which tree is built first inverts the result:

```
plain built first     root.other 1.278   sibling.a 1.791
marker built first    root.other 0.785   sibling.a 0.523
```

The same inversion appears in the Step C traversal comparison:

```
static built first    named_full_traversal 3.03 / 3.08
dynamic built first   named_full_traversal 0.48 / 0.50
```

Both stable across repeats. In every case **whichever tree is constructed SECOND
measures slower**, regardless of which hosts the marker. There is no evidence of a
marker-specific traversal cost, and Step C's "dynamic traversal is 3× slower"
result is withdrawn with it.

## The real finding is methodological

> **CROSS-TREE PROPERTY-ACCESS MICRO-BENCHMARKS IN THIS HARNESS ARE DOMINATED BY
> CONSTRUCTION ORDER, NOT BY THE PROPERTY UNDER TEST.**

Two independently constructed trees do not produce comparable property-access
sites. Only WITHIN-TREE comparisons are admissible for this class of measurement —
which is exactly why the named-vs-keyed comparison was specified that way, and it
held at ~1.25–1.30 under BOTH construction orders.

Results that came out near 1.0 (cached leaf read 0.986, cached leaf write 0.940)
appear unaffected: the artifact hits property LOOKUP CHAINS, and a cached leaf
call performs none. `alice.name` at 1.032 is consistent with that.

⚠️ RECORDED AS AN ERROR, NOT TRIMMED AWAY. It was written into this document as an
incumbent production defect affecting `entityMap`, `stored`, `form` and
`asyncSource`, on a single-order measurement with no order control. The
positive-control discipline that caught the wall-clock construction harness was
not applied here, and a confident write-up nearly turned it into history.

# ⚠️ STEP C CLASSIFICATION RETRACTED — NOT YET APPLICABLE

The run reported as "C-B (viable)" could not classify a dynamic representation,
because `ordinaryBranch(seed)` resolves the marker into a COMPLETELY ORDINARY
branch. There is no dynamic index, no lookup structure, no lifecycle machinery
and no retained dynamic state to measure. The C-A/B/C scale does not apply.

What that run legitimately closed is narrower and still valuable:

```
DYN-SEEDED-CANONICAL-0 — PASS

dynamic authoring marker  →  ordinary canonical branch

users                  ordinary NodeAccessor
users.alice            ordinary NodeAccessor
users.alice.name       ordinary leaf
position topology      users -> alice -> name
registry               same as containing tree
natural snapshot       seed value, marker absent
write-through          correct in both directions
seeded named property  own data property, no getter, no Map lookup

cached leaf read       0.986   authored provenance does not infect the leaf
cached leaf write      0.940
```

The first legitimate C-A/B/C classification requires a branch-local dynamic index
to exist — Step D.

## DYN-EXISTING-KEY-0 — PROTOTYPE PASS

```
named === keyed                  YES, exact reference
same PositionId                  YES
same registry                    YES
same NodeAccessor                YES
writes converge                  YES

INDEX ROLE      locates canonical Locations · owns no state

PROTOTYPE RETENTION
  per dynamic branch   1 Map · 1 keyed-location operation
  per seeded child     1 Map entry -> existing canonical Location
  no duplicate child Location · no duplicate PositionId · no second authority
```

⚠️ PROTOTYPE, not integrated: the index was installed by a TEST HELPER
(`installIndex(dt.$.users)`), not by the marker/materialization path. The
representation is proven viable; production construction does not yet own it.

⚠️ COST STATED CORRECTLY: **existing-key dynamic selection costs ~1.25–1.30×
versus named selection in this probe.** NOT "a Map.get costs 28%" — the measured
expression is the whole keyed-location operation (property lookup of the
accessor, invocation, map lookup, return) plus the common descendant traversal.
Stable across both construction orders.

## THE DURABLE METHODOLOGICAL RULE

> **A MICROBENCHMARK COMPARISON NEEDS A CONTROL FOR EXECUTION-SITE AND
> CONSTRUCTION-ORDER ASYMMETRY.**

Deliberately narrower than "cross-tree benchmarks are forbidden" — that is broader
than what was demonstrated. What WAS demonstrated: nanosecond property-access
comparisons across separately constructed trees are inadmissible without such a
control, because role reversal inverted every one of them.

## DYN-MATERIALIZE-REACTIVATION-0 — G-C REPAIRED

Step G's four-arm churn matrix classified **G-C**: the disjoint arms were clean
and linear, but 1,000 SAME-KEY add/remove cycles allocated 4,000 PositionIds
and — once a consumer was held — 2,000 membership carriers and 2,000 memos.

The defect was narrower than "retention". `materializeMember` called the
owner-bound constructor unconditionally, so every re-add of a removed key built
a brand new canonical Location and discarded the previous one. Membership stayed
correct and nothing accumulated in the branch; what grew was redundant
CONSTRUCTION.

The deeper problem was convergence, not cost. **One subject had two
behaviours**: reactivation through whole-value assignment preserved identity
(which is what F-A proved), while reactivation through `materializeMember` did
not. Two paths to the same semantic act disagreed about whether the member was
the same member.

### The rules this freezes

```text
ACQUISITION IS CREATE-IF-NEVER-SEEN, REACTIVATE-IF-DORMANT, REUSE-IF-ACTIVE
IDENTITY DISCOVERY PRECEDES IDENTITY ACQUISITION
```

`materializeMember` now consults the dynamic index BEFORE reaching for the
construction authority. The index answers "have we ever established canonical
identity for this key"; the parent still answers "is that identity semantically
present now" — THE DYNAMIC INDEX DISCOVERS CANONICAL MEMBERS; IT DOES NOT DEFINE
THEIR EXISTENCE. Construction still runs before anything becomes discoverable,
so DISCOVERABILITY MUST FOLLOW SUCCESSFUL AUTHORITY ACQUISITION is preserved and
a throwing materialization still leaves no phantom.

### ME-A, and why the choice was free

Characterization first: `materializeMember` had **zero production callers** —
only internal and probe usage. No incumbent contract constrained the ruling, so
ME-A was adopted on its merits rather than by compatibility.

```text
never seen   ->  create + value
dormant      ->  reactivate + value
active       ->  existing identity + value
```

One coherent operation. The alternative (ME-B, acquisition-only) would have left
the dormant case needing a second call to supply the value that the dormant
member unquestionably has to receive, and MEMBERSHIP ACTIVATION IS NEVER A
STANDALONE OPERATION.

Reactivation does NOT re-enter the public whole-value branch syntax. This
operation already knows its subject and its intent, and AN OPERATION THAT
ALREADY KNOWS ITS MUTATION SEMANTICS MUST NOT RE-ENTER THROUGH SYNTAX WHOSE JOB
IS TO INFER THOSE SEMANTICS.

### ⚠️ THE ACCESSOR/STORE SPLIT BIT A THIRD TIME

The first repair activated membership on the accessor only. Identity carriers
passed; the three OBSERVATION carriers failed, because a node accessor copies
its store's properties but closes over the original store — so the member had
the right identity and the right value and was still permanently absent from
`branch()` and every snapshot. Activation now lands on both, exactly as
`materializeMember`'s property definition already did. This is the same defect
shape as the earlier dual-write bug and the earlier dormancy-check bug; the
lesson that keeps failing to generalize is that ANY membership transition must
address both objects, not just the one in hand.

### Carriers — 8, all mutation-proven

`packages/core/src/lib/dynamic-member-reactivation.spec.ts`

| # | carrier |
|---|---|
| 1 | dormant re-add returns the identical Location object |
| 2 | reacquired member keeps its original PositionId |
| 3 | index entry is reused, not rewritten (same Map, same size, same value) |
| 4 | the supplied value wins over the retained one |
| 5 | same-value reactivation wakes an already-held consumer |
| 6 | reacquisition publishes membership exactly once |
| 7 | reacquisition never re-enters the owner-bound constructor |
| 8 | ME-A: an ACTIVE key reuses identity and takes the supplied value |

Mutation controls, each killing its intended carriers and no others:

| mutation | carriers killed |
|---|---|
| bypass the dormant lookup (always construct) | 1, 2, 3, 7, 8 |
| skip the value write (retained value wins) | 4, 8 |
| rewrite the index entry with a wrapper | 1, 2, 3, 8 |
| omit the membership publication | 5, 6 |
| activate the accessor but not the backing store | 4, 5, 6 |

Carrier 5 is held-consumer, not fresh-read: a fresh `users()` rebuilds from
current membership and passes even when the memo is stale, which is how three
earlier membership carriers went vacuous. REACTIVITY CONTRACTS MUST BE TESTED
THROUGH A HELD CONSUMER.

### ⚠️ THE FIRST MEASUREMENT WAS A DEAD INSTRUMENT

The post-repair churn rerun printed `pos=0 carriers=0 memos=0` for ALL FOUR
arms, including the disjoint arms that genuinely construct 1,000 members. That
was not a repair — the `G_pos`/`G_carrier`/`G_memo` counters are hand-injected
instrumentation that had been reverted, so every arm read zero. Reading it as
success would have "proved" that a defect in an unmeasured path was fixed.

Re-injected, the disjoint arms reproduced their pre-repair numbers EXACTLY
(4,000 / 2,000 / 2,000 at n=1000; 40,000 / 20,000 / 20,000 at n=10,000), which
is the known-positive control that makes the same-key zeros meaningful.

Carrier 7 was then rewritten to stop depending on that instrumentation at all.
It now wraps the branch's own `MEMBER_MATERIALIZER` and carries its own positive
control — a genuinely new key must still count 1 — so it cannot silently read
zero in an uninstrumented build. A BASELINE NOTHING VERIFIES IS A MEMO, NOT A
GATE.

### Result — allocation plateau

Same-key churn, instrumented, cold and held:

```text
arm                   n=1    n=10   n=100  n=1000  n=10000   index  ownKeys
A same-key cold       4/0/0  4/0/0  4/0/0  4/0/0   4/0/0         2        7
B same-key held       4/2/2  4/2/2  4/2/2  4/2/2   4/2/2         2        7
C disjoint cold       4/0/0  40/..  400/.. 4000/.. 40000/..  10001    10006
D disjoint held       4/2/2  40/20  400/2c 4000/2k 40000/20k 10001    10006
                      (positions / carriers / memos)
```

Flat from n=1 to n=10,000. Not "grows slowly" — **identical**. The first cycle
pays construction and every later cycle pays none, which is the plateau G-A
required. Arms C/D remain linear, as they must: 10,000 distinct keys are 10,000
distinct members. Membership publications continue linearly in all arms, which
is correct — each add/remove IS a membership event.

`DYN-CHURN-RETENTION-0` → **G-A / CLOSED**. Step H is unblocked.

### Fallout, and one thing NOT closed

`keyedLocation` became unreachable — its job (resolve an existing key to its
canonical Location) is now the first thing `materializeMember` does. Deleted;
the dead-export gate is green again.

**The bundle budget is RED and I have not attributed it.** `signaltree-bare`
measures prod 10.55 / 9.7 KB and dev 12.71 / 11.9 KB. This document recorded
prod 9.66 / 9.7 KB at the start of the neutrality work, so roughly 0.9 KB has
accumulated across the session's uncommitted dynamic-branch work — this repair
is part of it, but I have NOT measured its individual share. A clean-HEAD
comparison needs the working tree reverted, which is not mine to do. Per-feature
attribution and the raise-or-shrink decision are open and belong to a ruling,
not to this row.

## ACCESSOR/STORE COHERENCE — ONE MUTATION OWNER

Frozen after the third occurrence:

```text
ACCESSOR/STORE COHERENCE MUST HAVE ONE MUTATION OWNER
```

A branch is ONE semantic object and TWO physical ones — the `NodeAccessor`
consumers hold, and the backing store its call path closes over. Both carry a
descriptor per member, and **both are observable**:

```text
store      branch(), every snapshot, every memo
accessor   Object.keys(branch), 'k' in branch, { ...branch }
```

### ⚠️ THE CHARACTERIZATION FOUND A LIVE DEFECT, NOT JUST FRAGILITY

This row was scoped as solidification — make a three-time bug structurally
harder to repeat. Measuring the three transition paths before extracting the
helper found something worse: **no deactivation path had ever touched the
accessor at all.**

```text
CONV static: after removal      accessor=true   store=false   <<< DIVERGED
CONV dyn:    after removal      accessor=true   store=false   <<< DIVERGED
CONV leaf:   dormant            accessor=true   store=false   <<< DIVERGED
```

Observable consequence, after `user({ name: 'A' })` removed `age`:

```text
snapshot keys   ["name"]          correct
Object.keys     ["age","name"]    WRONG
{ ...user }     ["age","name"]    WRONG
```

That is the second observable state the architecture forbids — PHYSICAL
RETENTION MUST NOT CREATE A SECOND OBSERVABLE STATE. It had been invisible
because every existing carrier asserted through `branch()`, which reads the
store. My own dual-activation repair in the previous row was converging a state
only one side had ever left.

### The helper

`setMemberPresence(branch, key, 'active' | 'dormant')` owns both physical halves
and returns ONE semantic result. `activateMember` / `deactivateMember` are no
longer exported, so `activateMember(accessor, key)` — which compiles, looks
plausible, and is semantically incomplete — is unwritable at a call site.

Peer resolution works in BOTH directions, because the callers legitimately hold
different halves: `recursiveUpdate` reconciles over the store, dynamic
reacquisition arrives at the accessor. A `NodeAccessorPeer` back-link was added
beside the existing store link.

**NO NEW MEMBERSHIP STATE.** Enumerability remains the sole authority; this
changes only where it is written. The two halves agreeing is precisely what
makes enumerability *one* answer instead of two.

### ⚠️ I REPRODUCED THE EXACT BUG THE LINT RULE EXISTS TO PREVENT

The first extraction changed nothing — all three divergences survived. The cause
was inside the new helper:

```ts
typeof peer === 'object'   // a NodeAccessor is CALLABLE
```

so every accessor peer was silently discarded while the store side still
reported `changed === true`. The repo has a lint rule against hand-rolled
object-or-function guards for exactly this reason, and I wrote one anyway, in
the helper whose entire purpose was to make this class of bug structural.
`isTraversableNode` fixes it.

Worth recording that the first hypothesis — `??` short-circuiting past the peer
symbol — was WRONG, and a direct measurement said so before any code changed.

### Carriers — 5, mutation-proven

`packages/core/src/lib/accessor-store-coherence.spec.ts`, asserting through the
OBSERVABLE surfaces rather than the descriptors, because the descriptors are the
mechanism and the surfaces are the contract:

| carrier | |
|---|---|
| static branch agrees across removal and re-add | |
| the retained Location survives removal WITHOUT being a member (`'age' in user` stays true; it is still a Location) | |
| dynamic branch agrees across materialize, removal, reacquisition | |
| a leaf waking through its own `set()` agrees on both halves | |
| the single-object primitives are not reachable (with a positive control on `setMemberPresence`) | |

| mutation | carriers killed |
|---|---|
| helper skips the peer (the original three-time bug) | 4 |
| `peerOf` reverts to the object-only guard | 4 |
| re-export a single-object primitive | 1 |

### Status

```text
core                    1997 passed | 3 expected fail
lint / typecheck        PASS
spec-types              PASS
kernel-neutrality       PASS (self-test live)
dead-exports            PASS (green since keyedLocation was deleted)
full gate register      53/55

v9-budgets              RED   — no ratchet, blocked on H
bundle-budget           RED   — no ratchet, blocked on H
test:all                INTERMITTENT — red in one register run, green in the
                        next and in two standalone uncached runs. NOT
                        diagnosed, NOT claimed fixed.
```

## Budget disposition — deferred to Step H

```text
REPLACEMENT ARCHITECTURE IS JUDGED ON NET SUBSTITUTION COST,
NOT TRANSIENT COEXISTENCE COST
```

The working tree currently pays for BOTH architectures at once, which makes
today the worst possible accounting point. Measuring dynamic's +0.9 KB in
isolation would optimize the wrong quantity if `entityMap` is about to be
retired: the meaningful number is

```text
  generic + dynamic − entityMap − everything entityMap alone justifies
```

per SUBSYSTEM COST INCLUDES DEPENDENCIES IT ALONE JUSTIFIES. So the budget stays
RED and unratcheted, and Step H runs first as an OWNERSHIP DISCRIMINATOR with
deletion economics attached — H-A retire / H-B retain / H-C partial, where H-C
must SPECIALIZE THE RARE CASE BEFORE TAXING THE COMMON CASE rather than
preserving the whole subsystem for one edge invariant.

## DYN-ENTITY-OWNERSHIP-0 — H-B, ENTITYMAP RETAINED

**Question.** After Steps D–G, does `entityMap` still own any semantic
capability that generic explicit dynamic topology cannot carry without
specialized representation?

**Ruling: H-B.** It does, and the reason is structural rather than a missing
feature — which is why this is not an H-C "narrow rare case" either.

### The discriminator

A dynamic branch expresses membership as OBJECT PROPERTY KEYS. JavaScript fixes
two things about those that no implementation can opt out of:

```text
every key is a STRING
integer-like keys enumerate FIRST, in ascending numeric order
```

Measured on a real dynamic branch:

```text
inserted           30, 10, 20
enumerated         10, 20, 30        insertion order DESTROYED
key typeof         string            `7` acquired as "7"; (key === 7) is false
prepend            impossible        acquisition always appends
control            c30, c10, c20 kept order — order is lost only for the
                   integer-like keys that entity ids overwhelmingly are
```

`entityMap` ships `entityMap<User, number>` as its **documented primary form**
— it is the first example in `packages/core/README.md` and in the `index.ts`
overview — and it carries order as a contract: `all`, `ids`, `prependOne`,
`prependMany`, `sortComparer`, and a dedicated order carrier spec. Neither the
numeric key nor the order survives translation to property keys.

Frozen:

```text
ORDER-BEARING TYPED-KEY IDENTITY IS NOT OBJECT-KEY MEMBERSHIP
```

### Why not H-C

H-C would apply if most of `entityMap` collapsed into ordinary dynamic topology
with one narrow invariant left to specialize. What generic dynamic converged on
is the SUBSTRATE — identity acquisition, membership, reuse, churn. What it
cannot carry is not one edge case but a coherent cluster:

```text
typed (numeric) key identity
insertion / explicit ordering, prepend, sortComparer
changeId — identity mutation
activeId / activeEntity selection state
bulk operations with granular per-entity reactivity
tap / intercept lifecycle
```

Ordering is not rare for entity collections — it is what a rendered list is.
SPECIALIZE THE RARE CASE BEFORE TAXING THE COMMON CASE does not license
retiring the common case.

The convergence is still real and still worth what it cost: dynamic topology
now provides the substrate, and `entityMap` is the ordered, typed-key
specialization on top of a domain it no longer has to invent from scratch. That
is a better factoring than either owning both jobs.

### Pinned

`packages/core/src/lib/dynamic-vs-entitymap-domain.spec.ts` — 4 carriers
asserting what dynamic topology does NOT do, with a positive control proving
order is not lost in general. They are expected to keep passing; a failure means
the domain boundary moved and retirement is genuinely reopened.

### Consequence for the budget

Per the preregistration, H-B means the substitution arm is off the table: there
is no `entityMap` deletion to bank against dynamic's cost. So

```text
dynamic's incremental representation must justify itself INDEPENDENTLY
```

and `DYN-SIZE-ATTRIBUTION-0` is now the blocking work, with no net-substitution
credit available. REPLACEMENT ARCHITECTURE IS JUDGED ON NET SUBSTITUTION COST
still holds — it simply resolves here to "there is no replacement", so the
transient-coexistence argument for deferring the budget expires with it.

```text
DYN-ENTITY-OWNERSHIP-0

semantic disposition                    H-B / CLOSED
entityMap public/domain semantics       RETAINED
generic dynamic                         canonical dynamic-topology substrate
entity-specific specialization          ordered typed-key collection semantics
incumbent entity implementation         NOT FROZEN BY H

bundle-budget                           RED — still no ratchet
v9-budgets                              RED — still no ratchet
next                                    DYN-SIZE-ATTRIBUTION-0
```

### ⚠️ H-B RETAINS THE SEMANTICS, NOT THE INCUMBENT REPRESENTATION

```text
SEMANTIC SPECIALIZATION DOES NOT JUSTIFY DUPLICATE SUBSTRATE
```

H-B must NOT be read as "keep `entity-signal.ts` and its architecture
untouched". What it settles is the DOMAIN:

```text
public/domain specialization        RETAIN
typed-key identity                  RETAIN
ordered collection semantics        RETAIN
entity-specific operations          RETAIN

duplicate substrate already supplied
by dynamic/kernel                   NOT automatically retained
incumbent entity representation     still subject to convergence/deletion
```

The 3,244-line `entity-signal.ts` is not architecture-authoritative merely
because H-B won. If its identity, membership, lifecycle and observation
machinery duplicate what the generic substrate now supplies, that
implementation can still collapse to a thin ordered typed-key specialization
while the `entityMap` API and semantics remain untouched. That question is
`ENTITY-REPRESENTATION-OWNERSHIP-0`, and it is open.

### The substitution credit splits three ways

```text
PUBLIC ENTITYMAP DELETION CREDIT     off the table — H-B proved this
ENTITY IMPLEMENTATION CONVERGENCE    still possible — representation open
CREDIT AGAINST signaltree-bare       ONLY if attribution proves those bytes
                                     actually reach the bare bundle
```

⚠️ The third line is the one that constrains the immediate work. If `entityMap`
already tree-shakes completely out of `signalTree`-only use, deleting 2 KB of
entity internals returns exactly ZERO bytes on the 10.55 KB bare measurement.
Entity machinery's presence in bare is bucket E of the attribution and MUST BE
MEASURED, NOT ASSUMED.

## DYN-SIZE-ATTRIBUTION-0 — PARTIAL. SIZE-B IS EXCLUDED; SIZE-A LEADS

Attribution of the `signaltree-bare` production bundle by esbuild metafile
(per-module `bytesInOutput`), plus controlled reachability stubs applied to the
BUILD ARTIFACT — never to the source tree.

### Bucket E — entity machinery in bare: ZERO

```text
signaltree-bare       entity modules present: 0        bytes: 0
signaltree-entities   entity modules present: 7        bytes: 30,812
                        entity-signal.js 26,940 · entity-mutation-frame.js 1,804
                        entity-map.js 1,253 · +4 smaller
```

`entityMap` tree-shakes COMPLETELY out of `signalTree`-only use. The caveat was
right and it resolves hard: **entity-implementation convergence cannot return a
single byte against the bare budget.** Whatever `ENTITY-REPRESENTATION-OWNERSHIP-0`
later reclaims, it will show up in `signaltree-entities` (21 KB budget), never
here.

### Bucket B — optional dynamic reachability: 0.083 KB. SIZE-B EXCLUDED

Dynamic machinery IS statically reachable from a bare `signalTree` — the bundle
contains `DynamicKeyIndex` and `MemberMaterializer` for a consumer who never
creates a dynamic branch, with a bogus-symbol negative control and a
`NodeStore` positive control both behaving. So ZERO-RUNTIME COST IS NOT
ZERO-BUNDLE COST holds qualitatively.

But the magnitude refutes acting on it:

```text
ARM-1 current            gzip 10.650 KB   raw 33.70 KB
ARM-2 dynamic-stub       gzip 10.567 KB   raw 33.36 KB
                         delta 0.083 KB gzip (555 raw bytes)
```

`ordinaryBranch` and `materializeMember` are ALREADY absent from dist — nothing
on core's public path imports them, only specs do, so they tree-shake entirely.
What reaches bare is only the keyed-index seam `materializeMarkers` calls
(`attachKeyIndex`, `materializeKeyedAware`, two symbol constants). Moving
dynamic behind an injected feature or subpath would buy **83 bytes**. Not worth
the surface change.

### Bucket A — required common semantics: 0.28 KB measured so far

```text
ARM-1 current            gzip 10.650 KB
ARM-3 membership-stub    gzip 10.370 KB
                         delta 0.280 KB gzip
```

`member-membership.js` (1,317 B in-bundle) is the C5 membership substrate —
dormancy, the dormant binding, `setMemberPresence`, accessor/store coherence.
This is NOT dynamic-only: whole-value absence and reactivation are static-branch
semantics, carried by the `whole-value-membership` and
`accessor-store-coherence` specs on plain trees.

### ⚠️ THE BASELINE IS STILL NOT REPRODUCED — THE DELTA IS UNVERIFIED

Two attempts to build clean HEAD in a detached worktree BOTH compiled the
CURRENT source and wrote into the MAIN `dist`. nx resolves the workspace root
back through the symlinked `node_modules` to the main repo, so the worktree was
ignored entirely — and the first run "passed" its verification only because my
control grepped `dist/packages/core/dist/*.js`, which matches just `index.js`.
A recursive grep showed the current symbols present in what I had labelled HEAD.

Arms A and B were therefore byte-identical because **they were the same build**.
A SIZE COMPARISON IS ADMISSIBLE ONLY IF BOTH ARMS COMPLETE THE SAME BUILD
PIPELINE AND THE EXPECTED ARTIFACT IS VERIFIED TO EXIST — and a build that
writes the wrong source to the right path passes a naive existence check.

So the ~0.89 KB session delta rests on this document's earlier recorded
`prod 9.66 / 9.7 KB`, measured by the same gate, NOT on a rebuilt baseline.

```text
measured   entity machinery in bare               0.000 KB   decisive
measured   dynamic reachability                   0.083 KB   decisive
measured   C5 membership substrate                0.280 KB   decisive
UNATTRIBUTED                                     ~0.530 KB   signal-tree.js and
                                                             utils.js changes,
                                                             mixed old/new — not
                                                             separable by module
                                                             stub
baseline   reproduced from a HEAD build?          NO
```

### Disposition

```text
SIZE-B   EXCLUDED — dynamic reachability is 83 bytes
SIZE-A   LEADING  — what is attributed is required common membership semantics
SIZE-C   not excluded for the unattributed ~0.53 KB
ruling   NOT YET — no ratchet, no shrink, until the baseline is reproduced and
         the remaining ~0.53 KB is attributed
```

Next: reproduce HEAD without nx workspace-root leakage (a full copy with its own
`node_modules`, or a direct ng-packagr invocation with an explicit root), then
attribute the residual between `signal-tree.js` and `utils.js`.

## SIZE-BASELINE-PROVENANCE-0 — BASE-C. NO HISTORICAL ATTRIBUTION

Both preregistered paths to a trustworthy HEAD artifact are exhausted. Per the
preregistration this is **BASE-C: STOP — no historical attribution.** The three
directly measured buckets stand on their own; the historical delta does not.

### ⚠️ ROOT CAUSE OF EVERY FAILED HEAD ARM

```text
NX_WORKSPACE_ROOT_PATH=/Users/jonathanborgia/code/signaltree
```

is set in the AMBIENT ENVIRONMENT. Every worktree and isolated-root build was
silently redirected to compile the main repository's source, no matter what
directory it ran from, what its `nx.json` said, or whether its `node_modules`
was a symlink, a hard-link copy, or a genuine install. It even survived
`NX_DAEMON=false`.

That is why the first "HEAD" arm came back byte-identical to current: it WAS
current. Freeze:

```text
ARTIFACT PATH CORRECTNESS DOES NOT PROVE SOURCE PROVENANCE
EVERY HISTORICAL BUILD COMPARISON NEEDS A BIDIRECTIONAL SOURCE-PROVENANCE
CONTROL
```

The control that finally worked was neither grep direction alone but an injected
marker: append a unique export to the ISOLATED source, build, and require it to
appear in the isolated artifact and NOT in the main one. A build can report
success, write to the right relative path, and still have read the wrong tree.

### BASE-A — isolated nx build: FAILED

With the env var corrected the build finally read
`/private/tmp/st-head-iso/packages/shared/src/index.ts`, but then died in
`@nx/rollup`'s babel plugin on ordinary TypeScript (`as const`, then a type
annotation). No babel config exists anywhere in the repo — `withNx` supplies the
TypeScript preset itself, and it does not resolve outside the real workspace
root. Same failure with a genuine `pnpm install` AND with the main repo's exact
hard-linked toolchain, so this is not a dependency-version artifact.

### ⚠️ HEAD IS NOT REPRODUCIBLY INSTALLABLE

```text
pnpm install --frozen-lockfile   at 97e304cf
  specifiers in the lockfile don't match specifiers in package.json:
  * 1 dependencies were removed: rxjs@^7.0.0
```

`pnpm-lock.yaml` is out of sync with `package.json` at HEAD. A clean install of
HEAD is impossible without relaxing the lockfile, which resolves a different
toolchain and therefore a different pipeline. Worth fixing on its own merits —
it blocks any future historical build comparison, not just this one.

### BASE-B — direct build: NOT ADMISSIBLE

`packages/shared/rollup.config.cjs` is `withNx(...)`; invoking rollup directly
throws inside the nx plugin. Reimplementing the pipeline would be a NEW
measurement method compared against an old number — precisely the uncertainty
BASE-B exists to avoid.

### ⚠️ I ACCUSED THE BUDGET GATE OF A DEFECT IT DOES NOT HAVE — RETRACTED

Reconciling `10.55` against `10.650`, I recorded that
`check-bundle-budget.mjs` measures a stale `dist` because `ensureBuilt()` runs
a CACHED `nx build`, and called it a release-blocking gate defect. **That is
wrong and is retracted.**

Mutation-tested directly: corrupt `dist/packages/core/dist/index.js` with 3,000
bytes WITHOUT touching source, then run the gate. The injected probe was GONE
from `dist` afterwards — `ensureBuilt()` regenerated the artifact rather than
measuring what it found. The gate's own header documents this failure mode and
the fix that was already made for it; I re-reported a bug that had already been
fixed.

The real explanation for `10.55` -> `10.650` is ordinary: the two readings
straddle the accessor/store coherence work. `10.55` was measured during the
reactivation row; `setMemberPresence`, the `NodeAccessorPeer` back-link and the
coherence carriers landed afterwards. Roughly 100 gzip bytes of real growth,
consistent with the ~300 raw bytes that change added to `member-membership.js`.

⚠️ THE REASONING ERROR IS WORTH MORE THAN THE NUMBER. I had just spent an hour
proving that my own HEAD arms were provenance-invalid, and carried that
suspicion straight into a component that had already solved the problem —
attributing a discrepancy to the failure mode freshest in my mind instead of to
the change I had made in between. A discrepancy between two measurements taken
at different times is explained by the code that changed between them BEFORE it
is explained by an instrument defect.

`BUNDLE-GATE-PROVENANCE-0` is therefore WITHDRAWN. There is no gate defect to
fix.

### Canonical measurement

```text
artifact     dist/packages/core/dist/index.js, rebuilt with --skip-nx-cache
             and provenance-checked for a current-only symbol
bundler      esbuild, bundle+minify, format esm, platform browser,
             treeShaking, external @angular/* rxjs rxjs/* tslib
prod define  ngDevMode: false        dev define: none
gzip         node:zlib gzipSync level 9, bytes / 1024
```

Both the gate and the attribution harness use exactly this and now agree.

### Standing result

```text
E entity machinery in bare              0 B gzip     CLOSED
B dynamic optional reachability        83 B gzip     CLOSED — SIZE-B rejected
A membership substrate                280 B gzip     MEASURED

historical growth envelope        ~0.89 KB   NOT REPRODUCIBLE — BASE-C
derived residual                  ~0.53 KB   WITHDRAWN — it was
                                             (historical delta − known buckets)
                                             and inherits a baseline that
                                             cannot be rebuilt

SIZE-A   leading        SIZE-C   still open
budget ratchet          FORBIDDEN
shrink directive        PREMATURE
```

The residual figure is withdrawn rather than carried as provisional: it was
arithmetic on a number that no longer has a reproducible arm behind it.

To make historical size attribution possible at all, the prerequisites are
(a) resync `pnpm-lock.yaml`, and (b) stop `NX_WORKSPACE_ROOT_PATH` from being
ambient. Neither is release work, and neither is mine to do unasked.

## CURRENT-SIZE-OWNERSHIP-0 — COMBINED ARM, AND THE GAP THAT SURVIVES IT

Historical attribution is abandoned (BASE-C). The answerable question is
current-only: **does every byte above the budget have an owner that deserves to
ship?**

### Additivity was not assumed

```text
GZIP ATTRIBUTION ARMS ARE NOT ADDITIVE UNTIL A COMBINED ARM PROVES THEM ADDITIVE
```

```text
current                          10.650 KB gzip     raw 33.70 KB
  − dynamic reachable seam       10.567             raw 33.36
  − membership substrate         10.370             raw 32.45
  − BOTH                         10.296             raw 32.11

predicted from the two singles   10.287
actual combined                  10.296
divergence                        0.009 KB  (9 bytes)
```

Additive within 9 bytes, so the two arms may be treated as independent — now
demonstrated rather than assumed.

### The gap that survives

```text
current                          10.650
budget                            9.700
gap                               0.950 KB

both known jobs removed          10.296
gap                               0.596 KB
```

```text
A BUDGET GAP IS NOT AN ATTRIBUTION BUCKET
```

⚠️ THE 0.596 KB IS NOT A THIRD BUCKET WITH AN UNKNOWN OWNER. Reading it that way
still treats the budget as a semantic baseline. What is actually proven is
narrower and entirely negative:

```text
with BOTH measured mechanisms removed, the bundle is still 10.296 KB
the budget is 9.700 KB
therefore those two mechanisms alone cannot restore compliance
```

That is evidence about the CEILING, not about a missing owner: the 9.7 KB budget
is constraining considerably more than the two recent mechanisms. `9.7 is still
the correct architectural ceiling` is now a hypothesis that has to earn itself
too — a budget is a carrier, not architecture authority.

### ⚠️ A GAP CANNOT BE PARTITIONED BY OWNER; ONLY A BUNDLE CAN

The next step was framed as "partition the current gap by reachable semantic
owner". Strictly that is not measurable: a gap is the distance to a BUDGET
NUMBER, not to a measured artifact, so no module "owns" a share of it without a
baseline — and the baseline is exactly what BASE-C established is unobtainable.

What IS measurable, and answers the same release question, is auditing the
current bundle's reachable owners and pricing each by controlled stub:

```text
signal-tree.js                    8,419 B in-bundle
path-notifier.js                  5,665 B
utils.js                          2,034 B
materialize-markers.js            1,941 B
tree-scalar-slot-runtime.js       1,889 B
owned-mutation.js                 1,833 B
constants.js                      1,669 B
tree-scalar-slot-angular-runtime  1,533 B
deep-equal.js                     1,515 B
member-membership.js              1,317 B   PRICED: 280 B gzip
```

The question per owner is not "when did this enter" but "REQUIRED JOB with
compact representation / REQUIRED JOB with optimizable representation /
duplicate / optional reachability".

### Entities is separately red

```text
signaltree-entities   prod 21.09 / 21.0     dev 23.76 / 23.7
```

Over by 0.09 prod / 0.06 dev — near noise, still red, and INDEPENDENT of bare:
entity machinery contributes 0 B to bare and ~30.8 KB to this bundle. A
bare-core cleanup will not clear it, and future
`ENTITY-REPRESENTATION-OWNERSHIP-0` savings MUST NOT be spent against today's
entity budget.

### DYNAMIC-BARE-REACHABILITY — CLOSED / ACCEPT

```text
measured idle tax    83 B gzip
semantic value       explicit dynamic topology
surgery to remove    an injected-feature or subpath mechanism
DISPOSITION          ACCEPT — no further size work
```

83 bytes does not justify a public-surface mechanism unless that mechanism is
independently useful. Dynamic is closed for size purposes.

## CURRENT-BARE-OWNERSHIP-0 — SIZE-D. THE NOTIFIER IS THE COST

The ownership audit was expected to find a few hundred bytes of representation
waste. It found something an order of magnitude larger, at a seam nobody had
priced.

### `path-notifier.js` — 1.42 KB gzip of reachable-but-idle machinery

```text
current                    10.650 KB gzip     raw 33.70 KB
notifier fully stubbed      9.139              raw 28.22     ceiling, −1.511
delivery-only stubbed       9.230              raw 28.65     realistic, −1.420
```

The realistic arm keeps the subscription REGISTRY, `hasObservers()`, the guard
and the public class shape, and removes only the DELIVERY machinery — pattern
matching, batching, microtask flush, envelope interception. That machinery is
1.42 KB gzip, four times the cost of the membership substrate and dynamic seam
combined, and:

```text
EVERY SUBSCRIBER IS OPTIONAL

restoration          enhancer
devtools             enhancer
transactions         enhancer
diagnostic-journal   diagnostics
link()               opt-in public API
```

A bare `signalTree({ count: 0 })` with no enhancers has **zero** subscribers,
and `owned-mutation.ts:182` ALREADY guards `if (!notifier.hasObservers()) return`
— so at runtime the machinery is skipped on every write. It is linked, not
executed.

```text
ZERO-RUNTIME COST IS NOT ZERO-BUNDLE COST
```

The rule was frozen when the dynamic seam turned out to be worth 83 bytes and
not worth acting on. At this seam the same rule is worth 1.42 KB.

### What this does to the budget question

```text
current                                    10.650    0.950 over
membership + dynamic removed               10.296    0.596 over
delivery machinery made subscriber-installed  9.230    0.470 UNDER
```

The kernel WITHOUT statically-linked delivery machinery fits the existing 9.7 KB
budget with headroom to spare — without weakening a single frozen semantic,
without touching membership correctness, and without the dynamic surgery already
rejected at 83 bytes.

⚠️ SO THE BUDGET IS PROBABLY NOT OBSOLETE — BUT THIS IS NOT YET A FALSIFICATION.
The hypothesis forming in the previous row, that 9.7 KB encodes an earlier
architecture and should be rebased, is now STRONGLY DISFAVOURED rather than
disproven. The stub is a price, not a design: 9.230 KB proves enough optional
reachability EXISTS to solve the budget without weakening semantics, IF that
reachability can actually be separated. Until a real synchronous,
tree-shakeable implementation recovers those bytes, 9.7 is neither ratcheted nor
permanently vindicated. `CURRENT-SIZE-A` is out;
**`CURRENT-SIZE-D`** is the classification: one major common owner contains
substantial optional reachability, and it should be split before any ratchet is
considered.

### ⚠️ THE STUB IS A PRICE, NOT A DESIGN

These arms delete delivery outright, which a real implementation cannot do —
enhancers and `link()` must keep working when present. The measurement bounds
the opportunity; it does not demonstrate an implementation. The obvious shape is
to install the delivery implementation on FIRST SUBSCRIPTION, since
`subscribe()` and `intercept()` are the only ways an observer can come to exist,
and the repo already has the injected-feature convention the bundle-budget
header recommends for exactly this. That design is not yet validated and is not
mine to freeze.

### Not pursued, and why

```text
membership representation   280 B — compactness discriminator deferred; the
                            notifier finding is 5x larger and should be resolved
                            first, since it may change what headroom is even
                            needed
signal-tree.js              8,419 B — not inventoried; deferred behind the
                            notifier for the same reason
utils.js                    2,034 B — not audited
```

Stopping here rather than continuing the sweep is deliberate: the stopping rule
asked for ~200–300 B of clearly optional representation before further
optimization was justified. 1,420 B was found in the first place examined, which
satisfies the rule several times over and makes the remaining sweep lower
priority than acting on this.

## PATH-NOTIFIER-DELIVERY-OWNERSHIP-0 — PN-A / CLOSED

```text
PRODUCERS MUST NOT STATICALLY OWN OPTIONAL DELIVERY MACHINERY
OPTIONAL OBSERVERS INSTALL DELIVERY AUTHORITY; THE CORE DEPENDS ONLY ON ITS
NULLABLE PORT
```

### The census made the split easy

`PathNotifier` and `getPathNotifier` are **not published**. The core barrel's
only mention is a comment saying `getPathNotifier` is not root app API, and the
BUILT barrel exports zero notifier symbols. Installation authority is entirely
internal, so no public contract constrains the seam.

The producer surface turned out to be three methods:

```text
core (bare)        hasObservers · emitMutation · setBatchingEnabled
optional consumer  subscribe · intercept · onFlush · onReset · notify · flushSync
```

### The design

`internals/path-observation-port.ts` — bare-reachable, TYPE-ONLY imports of
`path-notifier`, so nothing links the engine. `getPathNotifier()` installs the
singleton into the port as a side effect of being asked for it, which means
every optional consumer installs delivery without knowing the port exists, and
the bare kernel — which never imports that module — cannot.

No dynamic `import()`. Interception is synchronous and authoritative
(mutation → interceptor → block/transform → commit), so the engine must be
statically present for the consumer that needs it and absent for the one that
does not. That is a tree-shaking problem, not a loading problem.

### ⚠️ THE FIRST DESIGN WAS A SNAPSHOT AND 32 TESTS SAID SO

The port initially handed out an INERT object whenever no runtime was installed.
Thirty-two entity, link and undo tests failed immediately, because a marker
processor CAPTURES the notifier it is constructed with: an `entityMap`
materialized before an enhancer installed delivery kept its inert copy forever
and every entity mutation vanished into it. Resolving per call at the
`materializeMarkers` seam did not help — the capture happens one level further
in, inside the processor.

The fix is that the port hands out a STABLE FACADE: allocated once, holding no
state, reading `runtime` on every invocation. A holder acquired during
construction observes an engine installed later.

### Result — both budgets green, first time this release

```text
                    before          after      budget
bare      prod      10.65           9.22        9.7    ✅
bare      dev       12.81          11.36       11.9    ✅
entities  prod      21.09          19.67       21.0    ✅
entities  dev       23.76          22.27       23.7    ✅
```

Recovered 1.426 KB on bare against a 1.420 KB prediction. `entityMap` alone
dropped 1.42 KB too — a plain collection with no enhancers has no subscriber
either, so it stops shipping delivery as well. **The 9.7 KB budget was never
obsolete; the kernel was paying an ownership error.**

### Bundle carriers — both directions, with working positive controls

```text
bare (no subscriber)         delivery ABSENT    PASS
link()                       delivery PRESENT   PASS  positive control
entityMap alone              delivery ABSENT    PASS  no subscriber either
restoration() enhancer       delivery PRESENT   PASS  positive control
```

⚠️ `devTools` was the first choice for the enhancer control and it FAILED —
its impl is gated behind `ngDevMode` and tree-shakes entirely under a
production define, so it links nothing. That would have been a vacuous control
passing for the opposite reason. `restoration` is not dev-gated.

### Semantic carriers — 6, in `path-delivery-ownership.spec.ts`

uninstalled port blocks nothing · bare tree mutates correctly with no runtime ·
asking for the engine installs it · **a facade captured BEFORE installation
observes an engine installed after** · several consumers share one authority ·
installation is idempotent, not additive.

| mutation | effect |
|---|---|
| `getPathNotifier` stops installing | 3 carriers fail |
| duplicate runtime per ask | 1 carrier fails (uniqueness) |
| facade captures `runtime` at module load — THE ORIGINAL BUG | 4 carriers fail, **266 tests fail** in the full suite |

A first attempt at the capture mutation (`return runtime ?? PORT`) killed
nothing, because returning the live engine is also correct; the faithful
injection is capturing at build time, and it is the one that reproduces the
original 266-test failure.

### ⚠️ THE SPLIT DROPPED CONFIGURATION, AND 55/55 DID NOT NOTICE

`PATH-NOTIFIER-PREINSTALL-CONTROL-0`. The stable facade solved late installation
for OPERATIONS. It did not solve it for CONFIGURATION, and the first closure
attempt was premature.

`signalTree()` applies the public `batchUpdates` option during CORE
construction — before any optional consumer exists — and the port forwarded that
call to a runtime that was not there yet. Reproduced:

```text
signalTree({count:0}, { batchUpdates: false })   no runtime installed

port.isBatchingEnabled()   before install    true    expected false
runtime.isBatchingEnabled() after install    true    expected false
port.isBatchingEnabled()   after install     true    expected false

control: runtime installed FIRST, then configured -> false    correct
```

The control matters: the setter was never broken. Only the pre-install path
discarded the value, and an enhancer installing an engine moments later got its
own default of `true`. A tree explicitly configured `batchUpdates: false` would
have delivered batched.

```text
A NULLABLE PORT MAY DROP DELIVERY WHEN NO CONSUMER EXISTS; IT MUST NOT DROP
AUTHORITATIVE CONFIGURATION THAT A FUTURE CONSUMER MUST INHERIT

CONFIGURATION AUTHORITY FOLLOWS THE PRODUCER SCOPE;
DELIVERY AUTHORITY FOLLOWS THE OPTIONAL CONSUMER
```

The distinction the port has to make between the two things `path-notifier` had
bundled together:

```text
notify with nobody listening        safe to discard
emitMutation with no interceptors   identity result is sufficient
setBatchingEnabled(false)           NOT safe to discard — it governs how a
                                    future consumer must deliver
```

The port now retains the desired value and `installPathDeliveryRuntime` applies
it before the new runtime can deliver. This is NOT a second delivery authority:
the port holds configuration, the engine remains the only thing that batches,
matches, queues or flushes.

Four more carriers, two mutations:

| carrier | |
|---|---|
| `false` before install survives installation | |
| the `true`/default direction is preserved (so the fix cannot pass by hardcoding) | |
| a REAL optional consumer — `restoration()` reaching `getPathNotifier()` itself — inherits it | |
| positive control: an already-installed runtime changes immediately | |

| mutation | carriers killed |
|---|---|
| `setBatchingEnabled` forwards only, retains nothing | 2 |
| config retained but never applied on install | 2 |

### Status

```text
core                 2011 passed | 3 expected fail
full gate register   55/55 — no reds, no known-red
bare                  9.24 / 9.7      dev 11.37 / 11.9
entities             19.68 / 21.0     dev 22.28 / 23.7
```

The repair cost ~20 bytes; headroom is unaffected.

```text
PN-A                        CLOSED
CURRENT-SIZE-D              CLOSED — the optional reachability was real and split
DYNAMIC-BARE-REACHABILITY   CLOSED / ACCEPT at 83 B
MEMBERSHIP SUBSTRATE        280 B accepted; compactness audit no longer needed
bare budget                 9.7 KB HELD — no ratchet, none required
entities budget             21.0 KB HELD — cleared as a side effect
```

`signal-tree.js` and `utils.js` were never audited. They no longer need to be
for budget purposes.

## CENSUS-OBSERVABILITY-CONTROL-0 — CLOSED

```text
CATEGORY ACCOUNTING PROVES THAT DISCOVERED SUBJECTS WERE NOT DROPPED; IT DOES
NOT PROVE THAT THE DISCOVERY MECHANISM CAN OBSERVE EVERY SUBJECT IT CLAIMS TO
FIND
```

The census's self-check proved *discovered → gated*. It said nothing about
*exists → discovered*, and this tool had already suffered three parser failures,
two of which returned EMPTY or WRONG results that read as facts about the
repository.

The detectors are now extracted to `tools/census-detectors.mjs` as pure
functions over source text, with a fixture carrying one planted instance of each
shape. **The census imports them**, rather than keeping a private copy — a
duplicate would mean the controls prove one parser while the census runs
another, which is the same parallel-source-of-truth mistake the checker already
made once. Census output is byte-identical after the rewiring (255 subjects).

```text
15 positive controls    every shape the detectors must find
 4 negative controls    shapes they must NOT report
```

Negative controls matter because the barrel parser's first bug was
**over**-matching, not under-matching: a detector that finds everything is as
useless as one that finds nothing.

### ⚠️ THE FIRST CONTROL SET MISSED THE BUG THAT ACTUALLY HAPPENED

Reversing the comment-stripping order — the exact defect that deleted
`MutationEnvelope` from the census — **killed nothing**, because the fixture
contained no line comment carrying `/*`. The control was decorative for its own
motivating failure. The fixture now plants `packages/*/src/**` inside a line
comment, and that mutation kills two controls.

| mutation | controls killed |
|---|---|
| public value export detector | 2 |
| public type export detector | 2 |
| interface field detector | 2 |
| module state — uninitialised `let` | 1 |
| structural symbol detector | 1 |
| comment-stripping order (the historical bug) | 2 |

`check-kernel-ownership.mjs` now runs `--self-test` FIRST and refuses to certify
anything if an observer control fails — proven by breaking a detector and
watching the gate reject rather than report.

### Standing state of the ownership controller

```text
subjects discovered                 255
subjects with an explicit owner       56
subjects awaiting an owner ruling    199
known owner, unresolved action         8

observer controls                  19/19
MISSING                                0
STALE                                  0

Phase 3E                         BLOCKED
```

Not wired into `npm run gates`: it exits non-zero, and admitting it as known-red
would normalise an intentionally incomplete inventory. Red here means *the
architecture derivation is unfinished*, which is a project phase, not a defect.

Ordering for the burn-down — deliberately most-likely-to-reveal-a-second-authority
first, not easiest-first:

```text
1  MODULE-STATE-OWNERSHIP-0        29  hidden mutable authority — where
                                       batchUpdates was lost
2  MUTATION-ENVELOPE-OWNERSHIP-0   10  incl. subjectId, still OPEN
3  PIPELINE-OWNERSHIP-0            21  behavioural units, not files
4  FRAMEWORK-DEPENDENCY / C6       19
5  config / capability / marker     22
6  public values + types           62
7  structural symbols              20
8  bare modules                    29  LAST — a physical cross-check
9  orphan / same-file cleanup       44
```

```text
MUTABLE STORAGE DOES NOT CHOOSE ITS OWNER; THE FACT IT RETAINS DOES
A MODULE'S OWNER IS THE RESULT OF THE JOBS INSIDE IT; MODULE REACHABILITY
CANNOT DERIVE THOSE JOBS
EVERY BARE-REACHABLE MODULE MUST HAVE AT LEAST ONE BARE-REQUIRED SURVIVING JOB
```

## CENSUS-OBSERVABILITY-CONTROL-0.1 — the "29" was a regex artefact

Two evidence defects, both correctly refused before `MODULE-STATE-OWNERSHIP-0`
was allowed to start.

### ⚠️ THE GATE-REJECTION PROOF WAS PIPELINE-CONTAMINATED

```bash
node tools/check-kernel-ownership.mjs 2>&1 | head -3
echo $?          # <- head's status, not the checker's
```

I reported `gate exit=0` beside an observer-failure message and called it proof
that the gate refuses. The message was observed; the process status was not.
`VERIFY BY EXIT CODE, NOT BY PIPELINE` — a rule this repository already had.

Redone unpiped, with distinct codes so a broken INSTRUMENT is distinguishable
from a red REPOSITORY:

```text
exit 0   every subject owned and converged
exit 1   MISSING / STALE — census and ledger disagree
exit 2   complete census, undecided rulings
exit 3   observer controls failed — the instrument, not the repository

baseline                            exit 2
binding detector broken             exit 3   ✅ refused
restored                            exit 2
```

### ⚠️ "29 MODULE-STATE SUBJECTS" WAS NEVER A DISCOVERY RESULT

The detector matched three initializer shapes and was blind to
`let x = true`, `= 0`, `= null`, `= factory()`, `= []`, `const x = signal()`,
`const x = []` — all ordinary module authority. Replaced with a TypeScript AST
walk over every top-level binding:

```text
29 -> 110 bindings, + 16 declined immutable primitives
```

**It had been seeing 29 of 126.** Had this not been caught,
`MODULE-STATE-OWNERSHIP-0` would have audited 23% of the hidden authority and
reported the set complete — in the audit whose entire purpose is finding the
next `batchUpdates`.

```text
FOR HIDDEN AUTHORITY DISCOVERY, OVER-INCLUSION IS CHEAPER THAN SILENT EXCLUSION.
A MODULE BINDING MAY BE DECLINED AFTER DISCOVERY; IT MUST NOT DISAPPEAR BECAUSE
ITS INITIALIZER SHAPE WAS UNEXPECTED.
```

Discovery no longer inspects initializers. A `const` bound to a literal
primitive is discovered, then declined on the record via `census.nonSubjects`.

### Families, not a flat list of six mutations

```text
13 discovery families
30 positive controls
15 negative controls
```

Previously four declared subject categories had NO observation control at all —
subpath, marker factory, marker registration, bare reachability — while the
prose claimed "every shape the detectors must find", and six mutations were
described as "mutation-proving each detector". Each family now carries its own
positives, negatives and killing mutation.

Two families are not source-text parsers and are given the control their
evidence actually admits rather than a fixture pretending otherwise:

```text
markerFactory       a PATH control — factories are discovered by living under
                    lib/markers/
bareReachability    bidirectional against the built artifact — the module list
                    must CONTAIN signal-tree.js and must NOT contain
                    entity-signal.js. One direction alone is vacuous: an empty
                    list passes "does not contain entity-signal".
```

### Standing state

```text
subjects discovered              336   (was 255)
declined, on the record           16
explicit owner                    56
awaiting owner ruling            280
known owner, unresolved action     8
observer controls               45/45 across 13 families
MISSING / STALE                    0
Phase 3E                     BLOCKED
```

`MODULE-STATE-OWNERSHIP-0` now has a real denominator: **110**, not 29.

## CENSUS-OBSERVABILITY-CONTROL-0.2 — CLOSED

Three more evidence defects, all of them the same species: **a claim stronger
than its executable evidence.**

### ⚠️ TWO NEW CONTROLS PROVED SURROGATES — THE MISTAKE LINT HAD ALREADY CAUGHT ONCE

`detectSubpathExports` and `detectMarkerFactoryPaths` existed only in their own
controls. The census ran inline equivalents. And they were not even equivalent:

```text
control proved      p.includes('/lib/markers/')
census ran          f.includes('/markers/')
```

```text
AN OBSERVER CONTROL IS ADMISSIBLE ONLY IF THE PRODUCTION CENSUS INVOKES THE
OBSERVER BEING CONTROLLED.
```

Both are now wired into the census.

### ⚠️ AUTO-DECLINING THE 16 CONSTANTS

Immutable, therefore no changing authority, therefore not a subject — the third
step does not follow. `const DEFAULT_BATCHING = true` is not mutable and still
decides something.

```text
IMMUTABILITY PROVES ABSENCE OF MUTABLE STATE; IT DOES NOT PROVE ABSENCE OF
SEMANTIC AUTHORITY.
```

All 126 bindings retained, annotated `mutableCandidate`. Two denominators, kept
distinct: **126** top-level bindings, **110** mutable-authority candidates.

### ⚠️ "EACH FAMILY CARRIES ITS OWN KILLING MUTATION" WAS A COMMENT, NOT A RUNNER

The `FAMILIES` objects held positives and negatives; the mutations were shell
commands I had typed by hand, for six of thirteen families. `mutate` is now a
declared field and `tools/census-mutation-proof.mjs` loops all thirteen:
baseline clean → patch that family's detector → require ≥1 control to die →
restore → require clean again, so a "death" cannot be an import failure.

**All 13 families mutation-proven**, including the two that are not source-text
parsers: `markerFactory` (a path control) and `bareReachability` (break the
lister, require the self-test to refuse an empty module list — a control that is
vacuous in one direction, since an empty list trivially satisfies "does not
contain entity-signal").

⚠️ THE RUNNER'S FIRST PASS PATCHED ITS OWN DECLARATIONS. My patterns carried
doubled backslashes, so `find` did not occur in the detector — but it DID occur
inside its own `mutate:` line. The mutation rewrote the declaration, left the
detector untouched, and every control survived. The report "killed NOTHING" was
true and entirely misleading about why. The runner now searches only the source
ABOVE the `FAMILIES` table and refuses an ambiguous or absent pattern.

### `exportedPipelineCandidates`, not "21 pipelines"

The detector finds exported functions whose NAME contains a verb. It cannot see
`applyWrite`, `const flush = () => {}`, class methods, or non-exported
convergence functions. Renamed so today's `21` cannot become tomorrow's `29`.

### Closing state

```text
subjects discovered                    352
top-level bindings                     126   (110 mutable candidates)
explicit owner                          56
awaiting owner ruling                  296
known owner, unresolved action           8

observer controls                    45/45 across 13 families
family mutation proof                13/13
gate exit codes                0 / 1 / 2 / 3, verified unpiped
MISSING / STALE                          0
Phase 3E                           BLOCKED
```

`CENSUS-OBSERVABILITY-CONTROL-0` is CLOSED. The instrument now refuses to
certify the repository when the instrument itself is broken, and says so with a
distinct exit code.

`MODULE-STATE-OWNERSHIP-0` is unblocked with an honest denominator: **110
mutable candidates**, then 16 constants under `MODULE-CONSTANT-POLICY-0`.

## MODULE-STATE-OWNERSHIP-0 — PASS A OPENED, FIRST DEFECT FOUND

```text
STATE LIFETIME IS PART OF OWNERSHIP
```

`tools/module-state-evidence.mjs` collects, per binding: retained fact, writers
(AST assignment/update targets, with the enclosing function), readers, export
reachability, mutating method calls, and spec reachability. It assigns no owner.

### ⚠️ TWO EVIDENCE DEFECTS FIXED BEFORE ANY RULING

**`ngDevMode` appeared seven times as "module state".** Those are ambient
`declare` statements — a compile-time flag and two `unique symbol` type brands,
emitting nothing. Nine ambient bindings total. They are still DISCOVERED
(silence is how subjects vanish) and now ANNOTATED, so one ruling dismisses them
instead of seven copies masquerading as authority.

**Cross-file reference counts were noise.** A module-private `let runtime`
reported 32 other production files and 85 specs — every occurrence of the WORD
"runtime" anywhere in the repository. A private binding cannot be referenced
elsewhere at all. Counts are now computed only for exported bindings; ruling
ownership on the earlier numbers would have been ruling on grep hits.

```text
126 top-level bindings
  9 ambient (declare)
110 mutable candidates
101 mutable AND non-ambient   <- the real Pass A denominator
```

### Clusters, by semantic role

```text
16  REASSIGNED AUTHORITY      uninitialised or reassigned `let`
20  MUTABLE COLLECTION        Map / WeakMap / Set / array
36  FACTORY RESULT            createX() / getX()
14  CALLBACK / POLICY         installed functions
 7  OBJECT LITERAL
 8  OTHER
```

### ⚠️ FIRST DEFECT: `TreeConfig.batchUpdates` IS TYPED PER-TREE AND STORED PACKAGE-GLOBAL

```text
resetPathDeliveryRuntime();
signalTree({ a: 0 }, { batchUpdates: false })   -> batching false
signalTree({ b: 0 }, { batchUpdates: true })    -> batching TRUE

tree A now delivers BATCHED, having explicitly asked not to.
```

Constructing a second tree silently reconfigures the first. `batchUpdates` is a
`TreeConfig` field — its public spelling promises per-tree configuration — and
its storage is one module-global value. **Last tree constructed wins.**

**This is INCUMBENT, not introduced by the delivery split.** Confirmed by
inspection rather than assumed: `batchingEnabled` is an instance field on
`PathNotifier` (line 101) and `globalPathNotifier` is a module singleton (line
693), so the incumbent's `getPathNotifier().setBatchingEnabled(...)` wrote to
exactly the same shared object. The port reproduced the lifetime faithfully,
including the bug — which is precisely why lifetime had to become part of the
census rather than being assumed correct because behaviour was preserved.

Note what this means about the earlier row: `PATH-NOTIFIER-PREINSTALL-CONTROL-0`
made the value survive installation ORDER. It did not make it survive a second
TREE, because nobody had asked what the value's lifetime was.

```text
subject         state:lib/internals/path-observation-port.ts:batchingEnabled
retained fact   desired delivery batching policy
writers         setBatchingEnabled (from signalTree construction), reset
readers         the producer facade
DECLARED LIFETIME    per tree — it is a TreeConfig field
ACTUAL LIFETIME      package-global
owner           OBSERVATION POLICY — amended, see below
action          REVIEW — survival open, not merely lifetime

⚠️ "PRODUCER-OWNED CONFIGURATION" WAS TOO GENEROUS. `batchUpdates` schedules
OBSERVER DELIVERY. It carries no kernel truth semantics at all, so the question
is not where to store it but whether it survives.

```text
DELIVERY POLICY IS NOT TREE TRUTH
REMOVE A REDUNDANT POLICY KNOB BEFORE DISTRIBUTING IT CORRECTLY
```
```

Not repaired in this row. The fix is not obviously "make it per-tree": the
delivery engine is deliberately ONE shared authority, so per-tree batching
policy would need the engine to resolve policy per emitting tree, which is a
design question and not a patch. Recorded as the first `MODULE-STATE-OWNERSHIP-0`
finding, for ruling.

### Other lifetime candidates in cluster 1, not yet ruled

```text
batch-scope.ts:batchDepth            global nesting depth across all trees
write-context.ts:activeContext       operation-scoped fact in a global slot
restoration-eligibility.ts:designated same shape
path-observation-port.ts:runtime     package-global delivery authority
path-notifier.ts:globalPathNotifier  the singleton behind it
materialization-realization:installed package-global installation
materialize-markers.ts:applyMemberValue package-global applier
```

Each needs the same question: **is the FACT it retains package-scoped, or is the
storage merely convenient?**

## BATCH-UPDATES-SURVIVAL-0 — characterized, not yet ruled

### Consumer inventory: ZERO

```text
production consumers of batchUpdates:false      0
enhancers                                       0
apps/demo                                       0
specs                                           3   all written by me, this session
docs                                            mentions only
```

The only production references are the writer (`signal-tree.ts:1638`) and the
declaration (`types.ts:607`).

### ⚠️ PRIOR ART — THE WRITE-PATH SPIKE FOUND THIS DEFECT ALREADY

`docs/research/2026-08-write-path-spike.md`:

> `signalTree()` construction mutates global notifier state … a tree created
> with `batchUpdates: false` silently switches every other tree in the process
> to synchronous notification. **Reproduced accidentally while writing the
> probes.**

So the cross-tree collision is confirmed twice, independently, and long
predates the delivery split. The same spike records a sibling defect from the
identical cause — one global notifier with no tree identity: *"guardrails and
devtools both subscribe `'**'` to the same global notifier, but only devtools
filters by tree ownership … guardrails on tree A will receive tree B's paths
verbatim."*

### What `false` actually changes — measured

⚠️ THE FIRST PROBE READ 0/0 IN BOTH ARMS and would have "proved" the flag inert.
It omitted the `causal-runtime` / `position-topology` capabilities, so no
mutation envelopes were emitted at all. A carrier that exercises nothing agrees
with every hypothesis.

```text
                     intercept   deliver    deliver      delivered
                     sameTick    sameTick   afterFlush   paths
batchUpdates: true       0          0           1        ["a"]
batchUpdates: false      3          2           2        ["a","a"]
```

Two real, observable differences:

```text
DELIVERY TIMING      false = synchronous, true = deferred to a microtask
COALESCING           true collapses two writes to `a` into one; false does not
```

So `batchUpdates:false` is **not** redundant with `batching()`. They point
opposite ways: `batching()` ADDS explicit `batch()`/`coalesce()`;
`batchUpdates:false` REMOVES automatic deferral. Nothing in `batching()`
expresses synchronous uncoalesced delivery.

That falsifies BU-A's premise as stated — the knob does have a unique semantic
effect. What it does NOT have is a consumer.

```text
BU-A as written    "no unique required semantic job"     FALSIFIED on capability
BU-A on evidence   "a real capability nobody claims"     still the likely ruling
BU-B               requires a demonstrated consumer      none found
BU-C               contradicted by the TreeConfig API    disfavoured
```

Recommendation: **BU-A**, retiring a real-but-unclaimed capability rather than
building per-tree delivery machinery for a knob with zero users and a broken
lifetime. But the premise must be restated honestly — it retires because it is
unclaimed, not because it is redundant.

### ⚠️ INDEPENDENT FINDING — INTERCEPTOR `block` DID NOT TAKE EFFECT IN EITHER ARM

```text
tree.$.blockMe.set(99)  with an interceptor returning { block: true }
batchUpdates: true    -> value committed, 99
batchUpdates: false   -> value committed, 99
```

Interception timing follows the batching switch (0 vs 3 same-tick invocations),
which is itself the coupling worth questioning — *synchronous interception is
authority; deferred subscriber delivery is scheduling, and one flag must not own
both.* But the block failed in BOTH arms, so **this is not attributable to
batching** and must not be folded into its verdict. It is a separate open
question about whether interception can block a leaf write on this path at all.
Recorded, not diagnosed.

### Ambient bindings routed

```text
treeIdBrand        TYPE-ONLY / kernel brand
ENTITY_MAP_BRAND   TYPE-ONLY / entity-domain brand
ngDevMode × 7      NOT module state — but external build/framework policy INPUT
                   -> C6 FRAMEWORK-DEPENDENCY subject
```

⚠️ I had called all nine "dismissable because `declare` emits nothing". Wrong for
`ngDevMode`: it emits no storage and code still reads an externally supplied
global and branches on it.

```text
NO LOCAL STORAGE DOES NOT MEAN NO EXTERNAL AUTHORITY
```

Angular/build coupling can enter the kernel without an Angular import — which is
a discovery domain the Angular-import detector cannot see.

## MODULE-STATE-EVIDENCE-CONTROL-0 — CLOSED

The census's DISCOVERY is proven. The evidence collector is a different
instrument: it does not find bindings, it characterises them, and each of its
claims needed its own counterfactual before 101 subjects were ruled on it.

### What the field names used to claim, versus what they measured

```text
readers                     -> an identifier occurrence count
referencedByOtherProdFiles  -> a substring match on a common word
writtenIn                   -> "(module top level)" whenever unresolved
```

That last one is the worst shape: a missing measurement rendered as a plausible
answer. Three counters — `batchDepth`, `nextRegistryId`,
`nextStandaloneEntityPositionId` — were reported as mutated at module scope
because `++`/`--` were recorded as writes with no location attached.

Now:

```text
writes                    kind + resolved writer function, per write
writerLocations           resolved only; never a default
resolvedReadsInFile       excludes declaration names, assignment targets and
                          property names
mutatingCallCandidates    CANDIDATES — `.set` on an arbitrary object is not
                          proof of collection mutation
importedByProductionFiles only for EXPORTED names, and only where the other file
                          actually IMPORTS it; `null` for module-private
```

Shadowing is resolved: a parameter or local of the same name no longer counts as
a write to the module binding. That is the ordinary case in this codebase, not
an edge case.

### 13 controls, 5 mutations

| mutation | controls killed |
|---|---|
| drop `++`/`--` writer location | 2 |
| stop recording `++`/`--` entirely | 4 |
| ignore shadowing | 2 |
| assignment targets counted as reads | 1 |
| drop mutating-call detection | 1 |

⚠️ TWO OF MY OWN CONTROLS WERE DEFECTIVE, both caught by the sweep rather than by
review. The read control used a binding that is never assigned, so the
"assignment targets leak into reads" mutation changed nothing and passed —
replaced with a write-only binding whose read count must be zero. Then my
mutation for it was `const isAssignTarget = false || <original>`, which is
just the original expression: **a no-op mutation reported as a surviving
control.** A mutation that does not mutate is indistinguishable from a control
that does not control.

### ⚠️ AND I CLOSED IT ONE DIMENSION EARLY

"The 101 can now be ruled on evidence that means what it says" was still too
strong. Cross-file evidence had moved from a substring match to "does the
importing file import this SPELLING" — better, and still not symbol identity.
Two failure modes, both of which change a deletion verdict:

```text
import { runtime as observationRuntime }   -> importer MISSED entirely
a.ts exports `state`; b.ts exports `state`;
c.ts imports it from b                     -> ALSO attributed to a.ts
```

And every control was one synthetic source string, so neither could be seen.
`resolvedReadsInFile` also claimed resolution it did not perform — it was
identifier occurrences minus a hand-rolled scope approximation.

Identity now comes from the TypeScript **TypeChecker**: a Program over the
production files, `getSymbolAtLocation` on every identifier,
`getAliasedSymbol` to follow imports, and comparison on **declaration identity**
— never on text. The denominator is unchanged at 126/101 via a completely
different resolution path.

### ⚠️ A CLASS PROPERTY INITIALIZER IS NOT MODULE TOP LEVEL

`readonly id = nextRegistryId++` runs once PER CONSTRUCTION; module top level
runs once per module load. The walker recognised neither property initializers
nor constructors, found no enclosing function, and fell through to
"(module top level)" — reporting a per-instance allocator as load-time
initialisation, in the very column whose job is lifetime.

```text
before   nextRegistryId  writers: ['(module top level)']
after    nextRegistryId  writers: ['TreePositionRegistry.id (property
                                    initializer, per construction)']
```

### 18 controls, 6 mutations, multi-file

| mutation | controls killed |
|---|---|
| compare by SPELLING instead of declaration identity | 7 |
| ignore alias resolution | 4 |
| disable symbol resolution for reads | 3 |
| drop `++`/`--` writer location | 1 |
| drop mutation-candidate detection | 1 |
| treat class property initializers as module top level | 1 |

Fixture spans four modules: A exports a binding, B exports the SAME SPELLING,
C imports only from B, D imports A's under an alias and reads, writes and
mutates it — plus a local shadowing that alias.

### ⚠️ AND A COMMENT IN THE COLLECTOR WAS SIMPLY FALSE

```ts
if (!ts.isIdentifier(d.name)) continue; // destructuring handled below
```

Nothing below handled it. Census discovery recurses into object and array
binding patterns; the evidence collector silently skipped them — under a comment
asserting the opposite, which is worse than an absent feature because it answers
the question a reader would have asked.

Both instruments reported **126**. That was never evidence they described the
same 126.

```text
COUNT PARITY IS NOT SUBJECT PARITY
```

`tools/module-state-parity.mjs` now compares KEYS, not counts, and is wired into
the ownership gate.

### ⚠️ AND THE PROGRAM WAS BUILT FROM AN INVENTED COMPILER WORLD

`ts.createProgram` was given a hand-written options subset. The package declares
`paths` mappings (`@signaltree/shared` -> source); without them those imports
resolve to nothing, so a legitimate cross-file consumer disappears and its
subject looks unclaimed. Options now come from `packages/core/tsconfig.lib.json`,
and the parity tool asserts every first-party import in the analysed set
actually resolves.

### One control is honestly vacuous today

Removing the collector's BindingPattern traversal does NOT break subject-set
parity, because production currently has **zero** top-level destructured
bindings. The mutation kills 5 evidence controls on a fixture that has them, and
the parity check cannot fire against the real codebase at all.

It is kept as a FUTURE tripwire: the first destructured module binding makes the
two instruments diverge loudly instead of quietly enumerating different sets.
A control that cannot fire today still earns its place when what it guards is
"the two tools that both claim to list the subjects we are about to delete from"
— but it is recorded as vacuous rather than counted as proof.

### ⚠️ REAL OPTIONS, SYNTHETIC FILE SET

The previous fix loaded the project's real compiler options and then handed
`createProgram` a file list built by walking the directory for `*.ts` minus
`*.spec.ts`. Both instruments shared that walk.

```text
COMPILER-OPTION PARITY IS NOT PROJECT-INPUT PARITY.
TWO INSTRUMENTS AGREEING DOES NOT PROVE THEIR SHARED UNIVERSE IS THE RIGHT
UNIVERSE.
```

Measured against `tsconfig.lib.json`'s own `fileNames`:

```text
tsconfig production inputs   101
directory walk               102
in walk only                   1   src/test-setup.ts
```

`test-setup.ts` is excluded from the package's compilation and was in both
instruments' universe. It contains **zero** top-level bindings, so today's
denominator was unaffected — luck, not correctness, and the same shape as the
destructuring vacuity recorded above.

`productionSourceFiles()` is now the single authority, consumed by census
discovery, the evidence collector and the consumer traces. Directory walking
survives only where it is honestly a different question: core's SPECS, and other
packages searched as separate projects.

### Excluded-file control

"Every production input is analysed" is one direction and passes trivially if the
authority returns everything on disk. So a real temporary project is built whose
tsconfig EXCLUDES one file containing top-level state:

```text
included.ts  with top-level state  ->  IS a production input
excluded.ts  with top-level state  ->  is NOT a production input
```

⚠️ MY FIRST MUTATION FOR THIS CRASHED rather than failing a control — ENOENT,
exit 1. The gate would have refused, but a crash proves only that the code path
changed. Replaced with one that ignores the exclusion without crashing, which
kills the control cleanly.

### Standing state

```text
126 bindings · 9 ambient · 101 mutable non-ambient  <- Pass A denominator

project-input parity    tsconfig 101 == analysed 101; excluded file proven excluded
subject-set parity      IDENTICAL KEYS, census vs evidence
module resolution       real tsconfig, all first-party imports resolve
evidence controls       23/23, 9 mutations proven, TypeChecker-resolved
census observers        48/48, 13 families proven
ownership gate          exit 2 · 352 subjects · 296 awaiting ruling
register                55/55
```

Pass A may now be ruled on this evidence.

## BATCH-UPDATES-SURVIVAL-0 — DISCRIMINATOR RUN, BU-A RECOMMENDED

Re-derived through symbol resolution rather than carrying the grep result into a
deletion verdict. `tools/batch-updates-consumers.mjs` resolves every
`.batchUpdates` access to a property symbol and compares it against
`TreeConfig`'s own declaration, so a same-named property on an unrelated type
cannot count as a consumer and an aliased or spread access cannot be missed.

⚠️ THE FIRST RUN OF THIS TRACE BUILT ITS OWN FILE UNIVERSE BY WALKING, the same
unverified premise the evidence collector had just been corrected for. Re-run
against `productionSourceFiles()` for core, with the other packages searched as
what they are — separate projects. Result unchanged, now on a stated universe:

```text
core production inputs (tsconfig)   101
core specs                          279
external roots (shared, demo)       153
total analysed                      533
uses resolving to TreeConfig.batchUpdates   4

PRODUCTION
  signal-tree.ts :: create   `config.batchUpdates !== false`      the WRITER

SPECS
  path-delivery-ownership.spec.ts × 3         written by me this session
```

**One production use, and it is the option's own implementation.** Nothing reads
it to decide anything; nothing forwards it; no enhancer, no demo app, no other
package. The grep result survives symbol resolution.

⚠️ THE THREE SPEC USES RESOLVE AS "untyped/other" because I wrote
`{ batchUpdates: false } as never`. My own carriers assert on a config option
through a cast that bypasses the type — they would keep compiling if the
property were deleted. Worth knowing before treating them as protection.

### Deletion blast radius — measured

Removing `batchUpdates?: boolean` from `TreeConfig`:

```text
production fallout   1 site   signal-tree.ts:1638 — the writer
other packages       0
apps/demo            0
spec typecheck       the same single site
```

### Public teaching surface — the only real cost

```text
docs/myths-and-misconceptions.md:167
    "To disable automatic batching: signalTree(state, { batchUpdates: false })"

docs/guides/migration-v14-v14.1.md:133
    "the `batchUpdates` config option is unrelated and STILL EXISTS"
```

That migration guide actively reassures users the option survives, so external
adopters may exist and are unknowable from here. Retirement is a deliberate
breaking change, not a silent cleanup — though pre-1.0 is precisely when it is
cheapest.

### Precedent in the same interface

`TreeConfig` carries a comment recording that `enableTimeTravel` was REMOVED in
14.1.1 for having zero consumers. The process precedent holds; **the reason does
not transfer** — `enableTimeTravel` silently did nothing, whereas
`batchUpdates:false` demonstrably changes delivery from deferred/coalesced to
synchronous/uncoalesced. That distinction is the whole point of running this
discriminator instead of assuming redundancy.

### Recommendation

```text
BU-A   RETIRE                                          RECOMMENDED
       no surviving claimant of the semantic job
       one production site, the writer itself
       no per-tree delivery machinery to be built

BU-B   RETAIN PER TREE                                 no claimant found
BU-C   EXPLICIT GLOBAL                                  contradicted by TreeConfig
```

Retire it because it is **unclaimed**, not because it is redundant or inert.
It is a real capability — synchronous uncoalesced automatic delivery — that
`batching()` cannot express, and nothing in the repository or its shipped
examples asks for it.

⚠️ NOT FROZEN AND NOT IMPLEMENTED. The ruling is the reviewer's. If BU-A is
taken, the work is: delete the property, delete the writer, delete
`batchingEnabled` from the port, fix two live docs, and re-run the register —
and the cross-tree lifetime defect disappears with the knob rather than being
repaired around it.

## BATCH-UPDATES-SURVIVAL-0 — WORKSPACE-WIDE CENSUS

```text
A ZERO-CONSUMER CLAIM IS ONLY AS LARGE AS THE CONSUMER UNIVERSE IT SEARCHED
THE COMPILATION UNIT CHOOSES THE ANALYSIS UNIVERSE; THE DIRECTORY DOES NOT
```

### ⚠️ THE PREVIOUS TRACE'S UNIVERSE WAS A LIST I HAD TYPED

`core`, `shared`, `demo` — searched because I wrote those three, then reported
"zero elsewhere", a claim about the workspace derived from an unchecked list.
`tsconfig.base.json` also maps `@signaltree/events` and `@signaltree/ng-forms`,
so the omission was not obviously harmless from the paths file either.

`tools/workspace-projects.mjs` now discovers projects mechanically (any
directory with a `project.json`) and loads each project's OWN tsconfig:

```text
apps/demo         114 inputs   tsconfig.app.json
apps/demo-e2e       3 inputs   tsconfig.json      <- omitted by the typed list
packages/core     101 inputs   tsconfig.lib.json
packages/shared    13 inputs   tsconfig.lib.json
```

`packages/events` and `packages/ng-forms` exist as directories containing only
`node_modules` — leftovers of deleted packages. **Three dangling path mappings**
remain in `tsconfig.base.json` pointing at files that do not exist; an import
through them would silently fail to resolve. Reported, not fixed here.

### ⚠️ THE POSITIVE CONTROL CAUGHT A SCANNER THAT SAW NOTHING AT ALL

First run: **zero uses in every category — including core production**, which
demonstrably has one. Without the control I would have reported "zero consumers
workspace-wide" from a scanner incapable of finding any.

Cause: each project's Program also loads `.d.ts` files, including a PUBLISHED
`@signaltree/core` typing that declares its own `TreeConfig`. The declaration
search matched that one, producing a key from a file the workspace does not
compile, so every genuine use failed to match. Restricted to core's own inputs.

Also fixed: declaration identity across Programs must compare source position,
not node object identity — each project compiles core's sources into its own
Program, so object comparison finds zero consumers everywhere except core.

### Result

```text
projects searched            4, each with its own tsconfig
TreeConfig.batchUpdates uses 1

  core production            1   signal-tree.ts — `config.batchUpdates`, THE WRITER
  other package production   0
  applications               0
  tests/specs                0

positive control             99 cross-package uses of `signalTree` in apps/demo
```

Mutations: omitting `apps/demo` kills the positive control; omitting
`packages/core` is refused. A project silently dropped from the universe can no
longer produce a quiet zero.

### Ruling recommendation — BU-A

```text
BU-A  RETIRE    RECOMMENDED
BU-B  RETAIN PER TREE    no claimant found in any first-party project
BU-C  EXPLICIT GLOBAL    contradicted by TreeConfig's per-tree spelling
```

Retire because it is **unclaimed by demonstrated first-party consumers and not
independently required by the frozen architecture** — not because it is
redundant or inert. `batchUpdates:false` genuinely changes delivery from
deferred/coalesced to synchronous/uncoalesced, and `batching()` cannot express
that.

Two live docs teach it, one explicitly promising it "still exists", so external
adopters are possible and unknowable from here. **Retirement is a deliberate
breaking change, documented as such** — not deletion of something nobody could
use.

⚠️ RETIREMENT MUST NOT SMUGGLE IN A SECOND RULING. Deleting the knob decides the
public policy surface. It does NOT decide what fixed observer or interceptor
scheduling replaces it — `INTERCEPT-BLOCK-AUTHORITY-0` owns that
independently, and `{ block: true }` failing to prevent a commit remains
undiagnosed.

Not frozen, not implemented. If BU-A is taken: delete the property, its writer,
`batchingEnabled` and `setBatchingEnabled` from the port, update two live docs,
and the cross-tree lifetime defect leaves with the knob instead of being
repaired around it.

## BATCH-UPDATES-SURVIVAL-0.1 — CLAIMANT CLOSURE

Two assumptions remained in the consumer census. Both were wrong, and the second
would have produced a false zero.

### ⚠️ THE PROJECT UNIVERSE WAS A FILESYSTEM CONVENTION I INVENTED

"Immediate child of `packages/` or `apps/` holding a `project.json`" is
mechanical but is not the workspace's own answer.

```text
THE WORKSPACE GRAPH CHOOSES THE PROJECT UNIVERSE; A `project.json` FILESYSTEM
CONVENTION DOES NOT.
```

```text
Nx reports 5 projects   ["shared","core","demo-e2e","demo","@signaltree/source"]
discovery found 4       @signaltree/source — the workspace ROOT — was missing
```

That root project carries no `sourceRoot`, but the tree it sits on holds **1,162
TypeScript files under `scripts/` alone**, compiled by no discovered project.

### ⚠️ SYMBOL IDENTITY CANNOT DISCOVER A STRUCTURAL AUTHOR

The scanner accepted only a property access or assignment whose symbol resolved
to the `TreeConfig.batchUpdates` signature — and its comment claimed aliased and
spread forms "cannot be missed". False in a structurally typed language:

```ts
const options = { batchUpdates: false };   // anonymous inferred type
signalTree(state, options);                // assignable at the CALL
```

The property belongs to an anonymous object type; declaration identity never
sees it. Same for `satisfies`, spreads, and `config['batchUpdates']`.

```text
DISCOVERY MAY OVER-INCLUDE; CLASSIFICATION MAY NARROW.
```

Discovery is now an exact-token AST sweep over **every first-party `.ts` on
disk** (1,815 files), with the TypeChecker used only to classify.

**Authoring-form control: 8 forms + 1 negative, all discovered.** Removing
`PropertyAssignment` handling loses 6 of 9.

### The old universe produced a false zero — measured

```text
                        files scanned   occurrences   authored
project inputs only              545             5          0
every first-party .ts           1815            11          4
```

### Every occurrence classified — none unexplained

```text
declaration (TreeConfig)                2   core types.ts + a script's OWN interface
implementation read                     1   signal-tree.ts — THE WRITER
tests/specs                             3   mine, this session
recorded LLM output (benchmark data)    3   captured model generations
vendored/built declaration copy         1   scripts/benchmarks/dist-core
unrelated same-name property            1   a metrics COUNTER, not the config flag

AUTHORED FIRST-PARTY CLAIMANTS          0
```

The three benchmark files are stored LLM output measuring what models generate —
they also call `.with()`, deleted in 15.0. Not consumers. But they are evidence
that **models trained on the docs do emit `batchUpdates`**, which bears on
external-adoption risk and strengthens the case for treating retirement as a
documented breaking change.

`scripts/performance/recursive-metrics.ts` declares its own interface with
`batchUpdates: number` — an operation counter. Over-inclusion found it;
classification rejected it. Exactly the division of labour the rule specifies.

### Ruling — BU-A, evidence complete

```text
real observable behavior                    yes, characterized
wrong incumbent lifetime                    yes, cross-tree contamination proven
authored first-party claimant               0, over-inclusive sweep
independently required by frozen architecture   no
correct retention cost                      per-tree observation-policy machinery
```

Retirement is a **deliberate documented breaking change**: two live docs teach
it, one promises it "still exists", and LLMs reproduce it.

⚠️ RETIREMENT DOES NOT SETTLE INTERCEPTOR SCHEDULING.
`INTERCEPT-BLOCK-AUTHORITY-0` remains independent and undiagnosed.

### Convergence-ledger additions

```text
tsconfig.base.json paths -> @signaltree/events        DELETE / config hygiene
tsconfig.base.json paths -> @signaltree/ng-forms      DELETE / config hygiene
tsconfig.base.json paths -> @signaltree/ng-forms/signals  DELETE / config hygiene
```

Three dangling mappings to files that do not exist; the packages are leftover
directories containing only `node_modules`. Nothing imports through them today,
which is precisely why they must not survive the strip by default.

## BATCH-UPDATES-SURVIVAL-0.2 — OCCURRENCE LEDGER, CLAIMANTS = 0

### ⚠️ THE CLASSIFIER MANUFACTURED ITS OWN ZERO

It called ANY `PropertySignature` named `batchUpdates` a "declaration
(TreeConfig)", then reclassified every authored occurrence sharing that file as
unrelated. The conclusion about `recursive-metrics.ts` was right; the RULE was
not:

```ts
interface Metrics { batchUpdates: number }      // in the same file
signalTree(state, { batchUpdates: false });     // a GENUINE claimant
```

would have been discarded on the strength of its neighbour.

```text
SAME FILE DOES NOT IMPLY SAME SEMANTIC DOMAIN.
```

And the published run printed its category table BEFORE reclassification, so it
showed `AUTHORED OPTION: 1` above `CLAIMANTS: 0` — **two classification states
in one report.** Reporting now happens after final classification, so the totals
cannot disagree.

### Eleven occurrences, eleven explicit rulings

Discovery stays over-inclusive; disposition is a ruling with evidence, recorded
per occurrence. No occurrence is dismissed by a rule that also dismisses its
neighbours.

```text
TREECONFIG_DECLARATION   1   core types.ts:607 — the declaration under review
IMPLEMENTATION           1   signal-tree.ts:1638 — its own writer
TEST                     3   carriers written this session
RECORDED_DATA            3   captured LLM output; also calls `.with()`, deleted in 15.0
GENERATED_COPY           1   vendored snapshot of a BUILT typing
UNRELATED_SYMBOL         2   a locally declared operation COUNTER (`: number`),
                             ruled on its OWN evidence, not on its file

FIRST_PARTY_CLAIMANT     0
UNKNOWN                  0
```

Gate: discovered-but-unclassified 0, classified-but-undiscovered 0, UNKNOWN 0.

### Falsifier

A fixture placing an unrelated declaration and a genuine authored option in ONE
file. All three tokens are discovered; the control also re-enacts the retired
heuristic and asserts it would have destroyed the genuine claimant. Reinstating
that heuristic in discovery kills 2 controls and breaks ledger parity.

⚠️ MY FIRST CONTROL ASSERTED FOUR OCCURRENCES AND FAILED. There are three — the
`Metrics` type ANNOTATION is not a `batchUpdates` token. My count was wrong, not
the tool's.

### BU-A — evidence closed

```text
real observable behaviour                     characterized
wrong incumbent lifetime                      cross-tree contamination proven
authored first-party claimants                0, over-inclusive sweep, 1,815 files
occurrences unexplained                       0
independently required by frozen architecture no
cost of correct retention                     per-tree observation-policy machinery
```

Deliberate documented breaking change: two live docs teach it, one promises it
"still exists", and LLM benchmark artifacts show models reproduce it.

⚠️ RETIREMENT DOES NOT SETTLE INTERCEPTOR SCHEDULING.
`INTERCEPT-BLOCK-AUTHORITY-0` remains independent and undiagnosed.

## BATCH-UPDATES-INTENT-0 — FROZEN AND IMPLEMENTED

The ruling reframed the question from "is it claimed?" to "what requirement
justified it?", and that reframing is stronger than the survival analysis it
replaced.

```text
INTENT                reduce repeated observer delivery / notification churn
INCUMBENT MECHANISM   a global boolean switching queue+microtask+coalesce
ACCIDENTAL CONSEQUENCE  `false` also became a "synchronous observer mode"
```

### The code's own documentation confirms the intent

Verified rather than assumed:

```text
types.ts             `batchUpdates?: boolean` — NO JSDoc, no stated contract
signal-tree.ts       "Configure global PathNotifier batching ... opt-out"
PathNotifier         "Enable or disable batching at runtime (global opt-out)"
docs                 "Signal writes are ALWAYS synchronous. Batching only
                      affects change detection notification timing."
```

No explicit same-tick synchronous observer-delivery contract was found. The
documented feature was automatic notification batching WITH AN OPT-OUT; writes
themselves remained synchronous either way. The docs did expose an opt-out
affecting notification timing, so "the opposite" would overstate the evidence —
what is absent is any promise about observer timing, not any mention of it.

```text
AN OPTIMIZATION KNOB DOES NOT BECOME A SEMANTIC CONTRACT JUST BECAUSE DISABLING
THE OPTIMIZATION EXPOSES DIFFERENT TIMING.
```

### Why the ownership was wrong, not just the lifetime

A `TreeConfig` field configured the observer DELIVERY scheduler. That mismatch is
why its value ended up at package lifetime and why a second tree silently
reconfigured the first. And delivery timing is per-OBSERVER: Angular UI wants
coalescing, DevTools may want turn fidelity, an audit consequence may want
immediacy, an external bridge has its own scheduler. One tree-global boolean
cannot express that, and no tree semantic requires it to.

### Retired

```text
TreeConfig.batchUpdates                    DELETED
its writer in signal-tree.ts               DELETED
the port's retained batching configuration DELETED — the port holds NO
                                           configuration now, which is what a
                                           nullable port should be
4 tests for the retired option             DELETED with their subject
2 live docs                                UPDATED — deliberate breaking change
```

### ⚠️ "3 CARRIERS" WAS WRONG — THE DELETION REMOVED FOUR TESTS

```text
before  2031 total    after  2027 total    delta  4
```

```text
A TEST COUNT DELTA MUST BE ACCOUNTED FOR BY NAMED RETIRED CONTRACTS.
```

I had counted `batchUpdates` OCCURRENCES (3) and reported them as carriers. The
marker-to-end deletion removed four `it()` blocks, and the fourth never mentions
`batchUpdates` at all:

| removed test | contract it protected | why it died |
|---|---|---|
| `batchUpdates:false set before install survives installation` | pre-install config survives runtime installation | the config no longer exists |
| `the default direction is preserved too` | the `true` direction was not hardcoded | same |
| `a REAL optional consumer inherits the pre-install setting` | `restoration()` reaching `getPathNotifier()` inherits it | same |
| `positive control — an ALREADY-INSTALLED runtime changes immediately` | the PORT's `setBatchingEnabled` reaches the engine | the port no longer carries batching policy, and **nothing calls its batching surface at all** |

None protected a surviving delivery-engine semantic. The engine's own batching
is exercised by the engine's suites; `restoration` reads
`getPathNotifier().isBatchingEnabled()` — the real engine, never the facade.

### Convergence item created by this retirement

```text
path-observation-port  setBatchingEnabled / isBatchingEnabled forwards
                       NOW DEAD SURFACE — zero callers workspace-wide
                       action: REVIEW (not deleted opportunistically here)
```

They survive only because the facade is handed to marker processors typed as a
`PathNotifier`, so removing methods is a runtime-shape question, not a text
edit. Recorded for the ownership ledger rather than resolved inside a
reconciliation.

`PathNotifier.set/isBatchingEnabled` is likewise **not frozen as permanent
architecture**. With automatic batching now unconditional in production,
`restoration`'s `isBatchingEnabled()` branch may itself reduce to an incumbent
path or a test-mode seam — a later ownership question, deliberately not settled
by this ruling.

**KEPT: `PathNotifier.setBatchingEnabled` / `isBatchingEnabled`.** The delivery
engine's own mechanism, with a production consumer in `restoration` (it reads
`isBatchingEnabled()` to decide whether to `flushSync()`) and many test seams.
The engine owning its own scheduling is the entire point of the split.

### ⚠️ THE RETIREMENT EXPOSED FOUR INERT TEST SETUPS

`heterogeneous-atomicity.spec.ts` called
`getPathNotifier().setBatchingEnabled(false)` in four cases — then constructed a
tree, whose `batchUpdates` writer immediately set it back to `true` on the same
global notifier. **Those cases have always run BATCHED while appearing to ask
for synchronous delivery.** Removing the writer removed the overwrite, and one
assertion flipped the same minute.

The inert calls were removed rather than honoured: batched delivery is the
condition those assertions were written and validated against. A test whose
setup was silently undone by the bug under investigation is a strong,
independent confirmation that the contamination was real.

### ⚠️ AND PATH-NOTIFIER-PREINSTALL-CONTROL-0 WAS REPAIRED, THEN DELETED

That row made the retained configuration survive installation ordering. The
repair was correct for the option as it stood; the option not surviving is a
different question, settled by a different discriminator. Fixing something and
then deleting it is not wasted work — **the fix is what made the ownership
question askable at all.** The cross-tree defect then left with the knob instead
of being repaired around it.

### Result

```text
core                 2007 passed | 3 expected fail
register             55/55
bare                  9.20 / 9.7      dev 11.34 / 11.9
entities             19.64 / 21.0     dev 22.25 / 23.7
occurrence ledger    FIRST_PARTY_CLAIMANT 0, UNKNOWN 0, 5 rows, all outside packages
```

The ledger gate refused until its six now-deleted rows were removed — a ledger
that outlives its subjects starts certifying code that is not there. The
generated `dist-core` typing regenerated to match on the next build, confirming
it tracks core rather than being the static snapshot my evidence note called it.

```text
performance optimization        KEPT — owned by the delivery engine
observer coalescing machinery   KEPT
TreeConfig.batchUpdates         DELETED
port batching configuration     DELETED
synchronous observer mode       NOT A CONTRACT; may return at an OBSERVER
                                boundary if a real consumer earns it
interceptor synchrony           INTERCEPT-BLOCK-AUTHORITY-0, still open
```

## INTERCEPT-BLOCK-AUTHORITY-0 — TWO SURFACES, AND I HAD CONFLATED THEM

```text
AN OBSERVER MAY REACT TO A COMMIT.
ONLY PRECOMMIT AUTHORITY MAY PREVENT ONE.
```

### ⚠️ THE ORIGINAL FINDING TESTED THE WRONG SURFACE

`{ block: true }` failing to prevent a write was measured on
`PathNotifier.intercept`. There is a second, entirely separate interception
API — `entityMap.intercept({ onAdd, onUpdate, onRemove })` with `ctx.block()` —
and it is the one with a public contract, production callers and working veto
semantics. Reporting "interception cannot block" without that distinction
would have been a false generalisation.

### Surface 1 — `PathNotifier.intercept` → `{ block?, transform? }`

Execution order, `owned-mutation.ts`:

```ts
const before = untracked(read);
apply();                                  // CANONICAL TRUTH CHANGES HERE
const after = untracked(read);
if (changed) emitOwnedMutation(...);      // interception happens AFTER
```

Three independent reasons it cannot veto, any one sufficient:

```text
ORDER       `apply()` commits before the envelope is even constructed
RESULT      `pathObservation().emitMutation(envelope)` — the { blocked } return
            is DISCARDED at owned-mutation.ts:203
REACHABILITY  `notify` short-circuits when batching is on:
            "Synchronous notify still returns not-blocked info (can't block
            during batching)" — and batching is now UNCONDITIONAL, so the
            interceptor branch never runs at all
```

Measured: interceptor called **0** times, value committed.

```text
production callers   0
spec callers         0   (all `.intercept(` specs use the ENTITY surface)
```

⚠️ RETIRING `batchUpdates` MADE THIS DEFINITIVELY UNREACHABLE. The `!batchingEnabled`
branch was its only path, and nothing depended on it — 2007 tests pass. A
mechanism that only functioned when an optimization was disabled was never a
contract.

**Disposition: IB-C candidate — no surviving semantic job.** Not deleted here;
this row characterizes, the ruling is the reviewer's.

### Surface 2 — `entityMap.intercept({ onAdd, ... })` with `ctx.block(reason)`

Genuinely precommit, and it vetoes by THROWING:

```text
t.$.r.intercept({ onAdd: (_e, ctx) => ctx.block('not allowed') });
expect(() => t.$.r.addOne(...)).toThrow(/not allowed/);
expect(t.$.r.count()).toBe(3);            // unchanged
```

That carrier already exists in `entity-bulk-mutations.spec.ts`, along with an
unsubscribe control. Public API, documented as "validate and transform mutations
BEFORE they happen", with a real production caller in the demo.

**Disposition: PRECOMMIT-AUTHORITY, working.** No defect found.

### What this means

```text
INTERCEPTION IS NOT ONE MECHANISM

entity intercept        precommit veto, throws, public, used, WORKS
PathNotifier intercept  postcommit middleware whose `block` is computed and
                        discarded, unreachable under unconditional batching,
                        zero callers
```

The `{ block?: boolean }` return type is the misleading part: a property named
`block` on a postcommit notification path implies veto authority it never had.
If Surface 1 survives in any form, the name must go with the authority.

⚠️ NO INTERCEPTOR SYNCHRONY WAS RESTORED. Observer synchrony remains unearned,
`batchUpdates` stays retired, and nothing about notifier scheduling was touched
to reach this result — which is exactly why the two questions had to be
separated.

## INTERCEPT-BLOCK-AUTHORITY-0.1 — IB-B. MY "UNREACHABLE" CLAIM WAS WRONG

### ⚠️ I MEASURED BEFORE THE MICROTASK RAN

The previous row reported `interceptorCalled = 0` and concluded the interceptor
branch never executes under unconditional batching. The probe read the counter
immediately after the write, without awaiting the microtask that
`queueMicrotask(() => this.flush())` schedules. The synchronous branch is
skipped; the QUEUED one is not.

```text
                 immediately        after flush
canonical value        99                 99
interceptor calls       0                  1     <- it runs
subscriber calls        0                  1
```

`flush()` reaches the same `_runNotify` the synchronous branch calls —
"Run interceptors + subscribers synchronously for each path" — so batching
defers interception, it does not eliminate it.

### The mechanism is fully functional postcommit delivery middleware

```text
block:     commit YES · interceptor YES · subscriber NO   -> DELIVERY SUPPRESSION
transform: canonical stays 99 · subscriber receives "TRANSFORMED"
flushSync: identical, so the result does not rest on microtask timing
```

```text
IB-A   REFUTED    apply() commits first; the { blocked } return is discarded
IB-C   REFUTED    the interceptor runs, and both block and transform work
IB-B   HELD       PathNotifier.intercept is OBSERVATION / DELIVERY middleware
```

```text
PathNotifier.intercept
    owner    OBSERVATION / DELIVERY
    block     suppress delivery to subscribers — NOT mutation veto
    transform transform the value delivered to subscribers — canonical state
              is untouched
```

⚠️ THE NAME IS THE DEFECT, NOT THE MECHANISM. `{ block?: boolean }` on a
postcommit path reads as veto authority. It has none, and the only thing that
made it look broken was testing it as though it did.

### Survival is a separate question, and still open

```text
first-party production callers   0
spec carriers                    0   (every `.intercept(` spec uses the ENTITY surface)
public API obligation            NONE — `PathNotifier`, `PathNotifierInterceptor`
                                 and `getPathNotifier` are absent from the built
                                 barrel; the barrel's only mention is a comment
                                 saying `getPathNotifier` is not root app API
```

So deletion remains available — but it would retire a **working, correctly
identified delivery capability that nobody claims**, not a dead mechanism. That
is the same distinction `batchUpdates` turned on, and it must be stated the same
way.

Not ruled here. Two candidate dispositions, both defensible:

```text
KEEP as OBSERVATION/DELIVERY, rename `block` -> something honest about delivery
DELETE as an unclaimed delivery capability
```

### Settled

```text
entityMap.intercept        PRECOMMIT-AUTHORITY · WORKING · CLOSED
PathNotifier block as veto REFUTED
PathNotifier.intercept     IB-B delivery middleware · survival OPEN
```

Nothing was restored to reach this: no synchronous observer mode, no
`batchUpdates`, no change to entity interception.

## PATH-NOTIFIER-INTERCEPT-SURVIVAL-0 — DELETED

```text
SEMANTIC COHERENCE EARNS A CLASSIFICATION, NOT A PERMANENT OWNER.
```

Deleted not because it was broken — it worked — but because a working capability
with no claimant does not earn a permanent subsystem. Renaming `block` to
something honest would have converted an unclaimed incumbent feature into a
deliberately designed 15.x one, obliging us to carry the registry, pattern
matching, ordering between interceptors, interaction with coalescing and
`flushSync`, the return-value protocol, types, docs and tests — for zero
demonstrated requirement.

### The deletion closure, derived from readers and writers

```text
PathNotifierInterceptor type            deleted
interceptors registry Map               deleted
intercept()                             deleted
interceptor loop in _runNotify          deleted
blocked / transformed accumulators      deleted
getInterceptorCount() debug helper      deleted — zero callers
hasObservers() interceptor clause       deleted
clear() interceptor clause              deleted
flush()'s `if (res.blocked)` branch     deleted — dead once nothing can block
```

### The verdict protocol went with it

```text
_runNotify  : { blocked, value }  ->  void
notify      : { blocked, value }  ->  void
emitMutation: { blocked, value }  ->  void
port.emitMutation                 ->  void
```

⚠️ NOTHING CONSUMED IT. `owned-mutation` — the only producer — already discarded
the result, and no other caller assigned it. Keeping the shape would have
preserved archaeological evidence of a retired mechanism as though it were a
contract.

### What survives, deliberately untouched

```text
entityMap.intercept + ctx.block()   PRECOMMIT-AUTHORITY, working, its own carriers
subscriber delivery                 unchanged
queued coalescing                   unchanged
flushSync                           unchanged
restoration flush semantics         unchanged
PathNotifier batching engine        unchanged
```

### ⚠️ ONE CARRIER'S CONTRACT CHANGED WITH ITS SUBJECT

`an uninstalled port reports no observers and blocks nothing` asserted
`{ blocked: false, value: 2 }` — the verdict protocol. Rewritten to assert what
still matters: emitting into an uninstalled port is INERT and does not throw.
Renamed accordingly. A carrier that keeps asserting a deleted protocol is
testing the archaeology, not the contract.

The other failure in the same run was `production-scalar-substrate` timing out at
5134ms under parallel load; it passes in isolation. A wall-clock timeout, not a
complexity regression — checked rather than assumed, because a complexity guard
failing during a deletion is exactly the thing one should not wave through.

### Result

```text
core        2007 passed | 3 expected fail
register    55/55
bare         9.19 / 9.7      dev 11.33 / 11.9
entities    19.63 / 21.0     dev 22.24 / 23.7
residue     no notifier-interception representation remains
```

```text
INTERCEPT-BLOCK-AUTHORITY-0        CLOSED
entity interception                PRECOMMIT-AUTHORITY / KEEP
PathNotifier interception          DELETED
```

## MODULE-STATE-OWNERSHIP-0 CLUSTER 1 — DYNAMIC-SCOPE LIFETIMES

```text
SEMANTIC LIFETIME DOES NOT REQUIRE MATCHING PHYSICAL ALLOCATION LIFETIME.
STATE LIFETIME IS PART OF OWNERSHIP.
```

Three module-allocated slots, each asked whether package allocation merely
IMPLEMENTS a valid dynamic scope, or creates authority broader than the fact.

### `activeContext` — AC-A, legitimate

```text
retained fact     the authored write context of the CURRENT synchronous operation
writer            withWriteContext (assign, save/restore in finally)
readers           2 in-file, 0 cross-file
```

| carrier | result |
|---|---|
| nesting | `[undefined, A, B, A, undefined]` — inner restores outer |
| exception | restores to `undefined` |
| cross-tree | one context, two trees, both written under it |
| `await` | context does NOT survive — correct and documented |

The cross-tree result is the ownership answer: the semantic subject is the
AUTHORED OPERATION, not either tree, so package allocation is the right scope
rather than a leak. The module already documents the `await` trap and the
multi-tree/SSR reasoning explicitly.

```text
owner   KERNEL — authored-operation dynamic scope
action  CONVERGED
```

### `designated` — DG-A, legitimate, and my suspicion was wrong

I expected a boolean to collapse nesting — inner exit clearing an outer
designation. It does not:

```text
[false, true, true, true, false]
```

because `withRestorationDesignation` saves `previous` and restores it, rather
than assigning `false`. A boolean is sufficient here precisely because the fact
is idempotent: one designated write promotes the whole causal turn, so an inner
scope has nothing to add.

Async is not merely documented but REFUSED — a thenable return throws ST1033
rather than silently designating nothing.

```text
owner   OPTIONAL-CAPABILITY — restoration designation, causal-turn scoped
action  CONVERGED
```

### `batchDepth` — BD-C. No surviving job

Mechanically flawless as a dynamic scope: nesting `[0,1,2,1,0]`, exception
restores to 0. And entirely unread.

```text
writers                    batchScope (increment/decrement)
readers                    isInBatchScope, getBatchDepth
production use of readers  ZERO — symbol-resolved across all production inputs
```

⚠️ AND THE DOCSTRING CLAIMS A BENEFIT THE CODE CANNOT DELIVER:

> "Angular's change detection sees them as a single batch of updates, resulting
> in a single CD cycle instead of multiple cycles."

`batchScope` increments a counter, calls `fn()`, decrements. There is no change
detection interaction of any kind. Mutation-proven — reducing it to a bare
`fn()` call leaves **2006 of 2007 tests passing**, and the single failure is
`batch-scope.spec.ts > should track batch depth`, the spec asserting the counter
exists.

`batchScope` is called from five production sites in `signal-tree.ts`, so the
wrapper is reachable — it just does nothing. That is the distinction between
"unreachable" and "no surviving job", and it is the second time this audit has
had to make it.

```text
owner   NONE — no reader, therefore no decision, therefore no owner
action  DELETE
```

```text
A DYNAMIC SCOPE WITH NO PRODUCTION DECISION READING IT IS NOT AN AUTHORITY.
REACHABLE BOOKKEEPING IS NOT A SURVIVING SEMANTIC JOB.
```

Five production call sites did not save it. Reachability was never the question.

### BD-C executed

```text
batchDepth, isInBatchScope(), getBatchDepth(), batchScope()   deleted
batch-scope.ts                                                deleted
batch-scope.spec.ts                                           deleted
5 call sites in signal-tree.ts   ->  direct `recursiveUpdate(...)` calls
```

No replacement abstraction. `batchScope` does not become
`PathNotifier` coalescing, the `batching()` enhancer, transactions, causal-turn
grouping or Angular scheduling merely because its name contained "batch" — those
have their own jobs and owners.

**The false claim was deleted, not relocated.** The `signal-tree.ts` doc block
asserting a single CD cycle now records that the mechanism never did that, and
does not reassign the claim to another subsystem. If SignalTree ever consolidates
CD cycles, whatever does it will have to prove it.

### Test accounting — 4 removed, 4 named

```text
before 2027 total   after 2023 total   delta 4
```

`batch-scope.spec.ts` contained exactly four, all asserting the deleted counter:

| removed test | what it protected |
|---|---|
| `should execute function synchronously` | that the wrapper called `fn` — the call sites now call directly |
| `should track batch depth` | the counter |
| `should reset depth on error` | the counter's `try/finally` |
| `should handle nested errors` | nested counter restore |

None protected surviving product behaviour.

`auto-batching.spec.ts` kept its three tests and was RE-TITLED rather than
deleted by filename. Two were called "verify batchScope is called" while
asserting only values — a test proving traversal passed through a dead wrapper is
not a contract. The value claims survive independently, so they now read
`several writes across branches all commit`, `an object argument writes every
named child`, and `an updater argument writes the value it returns`.

### Verification

```text
production references to batchDepth / batchScope / isInBatchScope / getBatchDepth   0
unsupported CD-consolidation claim                                                  0
typecheck · lint · core · 55/55                                                     green
bare      9.16 / 9.7      dev 11.30 / 11.9
entities 19.61 / 21.0     dev 22.22 / 23.7
```

One `test:all` red on the first register run, green uncached and on rerun — the
known intermittent, not investigated further here.

### CLUSTER 1 — CLOSED

```text
activeContext   KERNEL                 CONVERGED
designated      OPTIONAL-CAPABILITY    CONVERGED
batchDepth      NONE                   DELETED
```

### Three scopes interacting

Nested batch → context → designation, throwing from the innermost:

```text
before       depth 0 · ctx null · designated false
innermost    depth 1 · ctx "OP" · designated true
after throw  depth 0 · ctx null · designated false
reordered    depth 0 · ctx null · designated false
```

All three unwind independently, in either nesting order. No shared `try/finally`
corruption — the risk that made testing them together worthwhile.

## CLUSTER 1 CONTINUED — THE REMAINING REASSIGNED-AUTHORITY SLOTS

Twelve more, grouped by the fact each retains rather than by file.

### Installation authority — installed ONCE, at module scope

```text
materialization-realization.ts::installed    the framework realization adapter
materialize-markers.ts::applyMemberValue     the membership value applier
```

Both installers are called at MODULE SCOPE in `signal-tree.ts`, not during tree
construction. That is the structural difference from `batchUpdates`, which ran
its writer on every `signalTree()` call and therefore let a second tree
reconfigure the first. These cannot: nothing re-installs.

Measured:

```text
adapter installed before any tree exists   true
same object after tree 1                   true
same object after tree 2                   true
trees independent                          true
```

⚠️ `applyMemberValue` IS A CYCLE SEAM, NOT SEMANTIC STATE. `signal-tree` imports
`materialize-markers` (three times), so the reverse import is impossible. The
module-global callback exists to let the marker materializer reach a function
that lives in `signal-tree` — the retained fact is a wiring edge, not a
semantic one.

```text
installed          FRAMEWORK-ADAPTER installation port   REVIEW (C6 owns the
                   boundary; lifetime is correct)
applyMemberValue   KERNEL membership convergence         REVIEW (representation
                   is an import-cycle workaround, not a chosen design)
```

### Delivery authority — deliberately one per package

```text
path-observation-port.ts::runtime      the installed delivery runtime
path-notifier.ts::globalPathNotifier   the singleton behind it
```

Package lifetime is the ruling from PN-A: ONE delivery authority, installed by
whichever optional consumer asks first. Not re-examined here.

⚠️ TWO HOLDERS FOR ONE AUTHORITY REMAINS SUSPECT. The port holds `runtime`; the
notifier module holds `globalPathNotifier`. They cannot currently diverge
because `getPathNotifier()` installs itself into the port — but "cannot diverge
today" is a property of one function, not a structural guarantee.

```text
runtime / globalPathNotifier   OPTIONAL-CAPABILITY   REVIEW — duplicate holder
```

### Monotonic allocators — package-scoped by necessity

```text
position-registry.ts::nextRegistryId              registry identity
entity-signal.ts::nextStandaloneEntityPositionId  standalone entity positions
```

Registry ids must be unique ACROSS registries, so the counter cannot be
per-registry without defeating its purpose. This does not contradict the frozen
rule that PositionIds are NOT globally unique — that rule is about positions
within a registry; this counter distinguishes the registries themselves.

```text
both   KERNEL   CONVERGED
```

### Once-guards — idempotence facts, process-scoped by definition

```text
markers/entity-map.ts::entityMapRegistered        register the processor once
restoration.ts::warnedHistoryRetention            warn once
```

A marker processor registers once per process; a diagnostic warns once per
process. Neither fact is per-tree.

```text
both   CONVERGED   (entityMapRegistered DOMAIN-SPECIALIZATION,
                    warnedHistoryRetention DIAGNOSTIC)
```

### Instrumentation with a test-installed sink

```text
production-substrate-stats.ts::activeStats
materialize-markers.ts::treesConstructedCount
```

⚠️ `activeStats` LOOKED LIKE ANOTHER `batchDepth` — its readers
(`isProductionSubstrateStatsActive`, `getProductionSubstrateStats`) have ZERO
production references. It is not: `recordProductionSubstrateStat` has **24
production call sites**, and the recorder returns immediately when nothing is
installed.

```ts
if (!activeStats) return;
```

So production WRITES and tests INSTALL the sink. The direction of the
relationship is the opposite of `batchDepth`, where production maintained a
value nobody read. Here production feeds a sink that is absent unless a test
asks for it — a deliberate zero-cost instrumentation seam.

```text
activeStats            TEST-SEAM / DIAGNOSTIC   CONVERGED
treesConstructedCount  DIAGNOSTIC                REVIEW
```

### Test overrides

```text
entity-signal.ts::entityPositionIdAllocatorOverride
entity-signal.ts::entityPositionIdNotifyEnabled
```

Both written only by `*ForTesting` setters, read only within their own module.

```text
both   TEST-SEAM   CONVERGED
```

### Cluster 1 tally

```text
CONVERGED   activeContext · designated · nextRegistryId ·
            nextStandaloneEntityPositionId · entityMapRegistered ·
            warnedHistoryRetention · activeStats ·
            entityPositionIdAllocatorOverride · entityPositionIdNotifyEnabled
DELETED     batchDepth (+ batchScope, isInBatchScope, getBatchDepth)
REVIEW      installed · applyMemberValue · runtime/globalPathNotifier ·
            treesConstructedCount
```

Four REVIEW rows, each for a REPRESENTATION question rather than an ownership
one — a cycle workaround, a framework-boundary port awaiting C6, a duplicate
holder, and an unexamined counter. None is a lifetime defect.

## CLUSTER 2 — UNINITIALISED AUTHORITIES, RE-DERIVED FROM CURRENT CODE

⚠️ I CARRIED THE PN-A CONCLUSION FORWARD INSTEAD OF RE-DERIVING IT. The previous
row asserted "package lifetime is the ruling from PN-A: ONE delivery authority
… not re-examined here." But `path-observation-port` has lost two
responsibilities since that ruling — batching configuration and interception —
and it is now 130 lines. An earlier justification does not survive the deletion
of the jobs it justified.

### Pair A — `runtime` + `globalPathNotifier`

```text
runtime              the port's nullable pointer to an attached implementation
globalPathNotifier   the engine's own lazy singleton cache
```

Each has a structural reason to exist. The port must NOT import the engine —
that is what keeps 1.42 KB of delivery machinery out of bare — so it cannot ask
`getPathNotifier()`. And `getPathNotifier()` cannot read the port's slot,
because the port exposes no getter for it. Two slots, one engine.

#### ⚠️ DIVERGENCE FALSIFIER — THEY CAN DESYNCHRONISE

```text
                        hasPathObservers()   engine.hasObservers()
after getPathNotifier()        true                  true
after resetPathDeliveryRuntime false                 true     <- DIVERGED
```

`resetPathDeliveryRuntime()` clears the port's pointer and leaves the engine —
and its live subscriber — intact. The producer then skips emitting entirely
(`owned-mutation` guards on `hasPathObservers()`), so a registered subscriber
silently receives nothing.

```text
IDENTITY PARITY DOES NOT JUSTIFY TWO AUTHORITIES.
```

Here parity is not even guaranteed. Both resets are `@internal` testing seams, so
this is not a production defect today — but it is a state the architecture
permits, and the failure it produces (a live subscriber that stops receiving)
looks exactly like a product bug.

```text
runtime              KERNEL INTEGRATION PORT   REVIEW — the retained fact is
                     legitimate; the RESET PATHS must not be able to
                     desynchronise the pair
globalPathNotifier   OPTIONAL-CAPABILITY       REVIEW — same convergence
```

Candidate repair, not implemented here: one reset, or a port getter so the engine
stops caching independently.

#### ⚠️ AND THE PORT FORWARDS A METHOD I DELETED

```text
DEAD FORWARD: port.intercept -> engine has undefined
```

`forward('intercept', noop)` survived the interception deletion. Anything
calling `pathObservation().intercept(...)` now gets a **silent no-op** instead of
a `TypeError` — strictly worse than deletion, because it fails quietly. Found by
enumerating every port forward against the engine's actual surface rather than by
reading the diff.

`setBatchingEnabled` / `isBatchingEnabled` still have live targets on the engine,
so they are dead by CALLER count (zero), not by target — a different disposition
and already on the ledger.

### Pair B — `installed` + `applyMemberValue`

```text
AN INSTALLED CALLBACK IS NOT AN AUTHORITY UNTIL A DECISION DEPENDS ON WHICH
CALLBACK IS INSTALLED.
DEPENDENCY INVERSION MAY REQUIRE A PORT. IT DOES NOT CREATE A SECOND SEMANTIC
OWNER.
```

Both are installed at MODULE SCOPE in `signal-tree.ts`, so no tree construction
re-installs anything — structurally unable to reproduce the `batchUpdates`
contamination.

#### But a second install DOES retroactively change an existing tree

```text
tree 1 built under implementation A
implementation B installed
tree 1 READ  ->  executes B
```

Measured: one call into the second implementation during a `tree1()` read.

That is correct for what this actually is — `installed` holds the process's
FRAMEWORK REALIZATION ADAPTER, and there is exactly one framework per process.
It is package policy, not per-tree configuration, so a tree adopting the current
adapter is the intended behaviour rather than contamination. The distinction from
`batchUpdates` is that `batchUpdates` was spelled as per-tree configuration and
stored globally; this is spelled as a process-level install and behaves that way.

```text
installed   FRAMEWORK-ADAPTER installation port   REVIEW — C6 owns whether this
            boundary survives in this shape
```

`applyMemberValue` remains a cycle seam: `signal-tree` imports
`materialize-markers`, so the reverse import is impossible and the callback is
late-bound dependency injection, not an independent semantic owner. The
membership convergence semantics are owned by `signal-tree`; this slot only
carries a wiring edge.

```text
applyMemberValue   KERNEL membership convergence   REIMPLEMENT — the semantic
                   owner is elsewhere; a mutable module callback is an
                   import-cycle workaround, not a chosen representation
```

### ⚠️ THE STALE FORWARD WAS A TYPE-BOUNDARY DEFECT, NOT A MISSED LINE

`port.intercept` survived because the facade was written as:

```ts
const PORT = { ... } as unknown as PathNotifier;
```

That cast let the port claim the entire engine shape with nothing checking it.
Deleting one forward would have left the same trap for the next engine deletion.

```text
A PORT MUST BE TYPED AS THE CONTRACT IT PROVIDES, NOT AS THE IMPLEMENTATION IT
FORWARDS TO.
```

### The narrow contract, derived from consumers

Symbol-resolved production callers, not copied from the engine:

```text
emitMutation   owned-mutation — the write path
notify         entity-signal — 18 sites, through the threaded facade
```

Everything else the facade forwarded — `subscribe`, `intercept`, `onFlush`,
`onReset`, `flush`, `flushSync`, `setBatchingEnabled`, `isBatchingEnabled`,
`hasObservers` — has **zero production callers through the port**. Optional
consumers reach the engine directly via `getPathNotifier()`, which is the point
of the split.

```ts
export interface PathObservationPort {
  emitMutation(envelope: MutationEnvelope): void;
  notify(path, value, prev, ownerPath?, subjectIds?, positionIds?, meta?, ownerId?): void;
}
```

The compiler immediately caught what the cast had hidden: `materializeMarkers`
and `createEntitySignal` both typed their threaded parameter as the full
`PathNotifier`. Narrowed to the port — the only thing either ever calls is
`notify`.

### Reset coherence

```text
resetPathDeliveryRuntime() now clears the engine's observers before detaching
```

so no supported reset can produce:

```text
hasPathObservers()     false
engine.hasObservers()  true
```

with `owned-mutation` refusing to publish to a still-subscribed engine.

### Carriers, both mutation-proven

```text
no supported reset leaves a subscribed engine behind a detached producer
    mutation: restore the independent reset            -> dies

the port exposes ONLY the contract it provides
    mutation: re-add a stale forward + the cast        -> dies
```

The second is a structural guard: `Object.keys(port)` must be exactly
`['emitMutation','notify']`. Facade drift back toward the engine's shape now
fails a test rather than waiting for someone to call a silent no-op.

### Cluster 2 ruling — authority pair closed, five rows still open

| subject | owner | action |
|---|---|---|
| `runtime` | KERNEL INTEGRATION PORT | **CONVERGED** — narrow contract landed |
| `globalPathNotifier` | OPTIONAL-CAPABILITY / delivery | **CONVERGED** — reset coherence landed |
| `resetPathDeliveryRuntime` | test seam | **CONVERGED** — no longer independently detaches |
| `port.intercept` | — | **DELETED** with the cast that permitted it |
| `installed` | FRAMEWORK-ADAPTER boundary | **REIMPLEMENT at C6** |
| `applyMemberValue` | KERNEL membership authority | **REIMPLEMENT** — cycle seam, no independent owner |
| `treesConstructedCount` | — | **REVIEW** — not yet characterized, carried to the next batch |

⚠️ THE HEADING ABOVE ORIGINALLY READ "no REVIEW rows remain" while the table
below it still carried `treesConstructedCount` as REVIEW and four rows marked
NOT YET CONVERGED. Corrected — closure language has to survive reading its own
table.

⚠️ AND I RETRACT "none is a lifetime defect" FROM THE PREVIOUS ROW. That was
written before the divergence falsifier ran. `runtime`/`globalPathNotifier` did
encode an inadmissible lifetime state — two mutable holders for one delivery
relationship, with independent resets. `installed`/`applyMemberValue` are the
ones that merely lack the per-tree defect.

### Provisional rows, held rather than promoted

`nextRegistryId`, `nextStandaloneEntityPositionId`, `entityMapRegistered`,
`warnedHistoryRetention` were marked CONVERGED on a semantic explanation plus a
reference count. Owner is likely known; the DECISION that consumes each retained
fact was not shown. Downgraded to **OWNER LIKELY KNOWN / NOT YET CONVERGED**
pending a short decision trace.

```text
MODULE-SCOPE INSTALLATION REFUTES PER-TREE CONTAMINATION; IT DOES NOT PROVE THE
REPRESENTATION IS GREENFIELD-CONVERGED.
```

### Result

```text
core        2005 passed | 3 expected fail
register    55/55
bare         9.03 / 9.7      dev 11.17 / 11.9
entities    19.47 / 21.0     dev 22.09 / 23.7
census      123 bindings, 98 mutable non-ambient
parity      clean
```

## PRE-COLLECTION CLOSURE — REACQUISITION + FIVE DECISION TRACES

### ⚠️ RESET COHERENCE WAS ONLY HALF PROVEN

The detachment carrier showed a reset does not leave a subscribed engine behind
a detached producer. It said nothing about REACQUISITION: `getPathNotifier()`
returns the RETAINED singleton, so if it installed only on first creation, every
consumer after a reset would hold a live engine the producer never publishes to
— permanently detached, and silent.

Carrier added: reset → reacquire → same instance → subscribe → authored write →
delivery arrives. Suppressing reinstallation kills **5 carriers**.

⚠️ MY FIRST MUTATION FOR IT SILENTLY DID NOT APPLY — the pattern ignored a
comment block between the `if` and the install call, and I reported "0 carriers
failed" as though the carrier were weak. It was the mutation that was absent.
Redone with an assertion on the pattern.

```text
runtime · globalPathNotifier · reset relationship   CONVERGED
```

### 1. `nextRegistryId` — KERNEL / CONVERGED

```text
retained fact  the next unallocated registry (TreeId)
write          `readonly id = nextRegistryId++` — per registry construction
read           registry.id -> envelope `ownerId`, `defineOwnedOwnerId`
DECISION       link.ts:441  `if (m['ownerId'] !== registry.id) return;`
```

A Link decides whether a delivered mutation belongs to ITS tree by comparing
registry ids. The code says why in place: *"Two same-shaped trees give their
collections the SAME local position id, so identity is (registry, position) —
never the position alone."*

Falsifier: force every registry to id 1. **19 tests fail**, including
`owner isolation — a second tree does not drive this link` and
`two trees with the same collection path stay isolated`.

Package lifetime EARNED, and this does not contradict the frozen "PositionIds
are not globally unique" rule — that governs positions WITHIN a registry; this
counter distinguishes the registries that scope them.

### 2. `nextStandaloneEntityPositionId` — DOMAIN-SPECIALIZATION / CONVERGED

Allocates PositionIds for entity collections constructed with no tree registry
to scope them. It exists solely for the standalone entity path, so the identity
domain is the entity specialization, not the kernel.

### 3. `entityMapRegistered` — REDUNDANT, DELETE candidate

```text
decision   whether registerBuiltinMarkerProcessor(...) runs
```

But `registerProcessor` ALREADY dedupes:

```ts
const alreadyRegistered = MARKER_PROCESSORS.some((p) => p.check === check);
if (alreadyRegistered) return;
```

and the check function is the same reference every time. Bypassing the boolean
leaves the full suite green.

The guard's only remaining effect is avoiding one closure allocation per
`entityMap()` call, since the inner dedupe returns early anyway. That is a
micro-optimization, not a semantic guard — the registry already knows the fact
the boolean duplicates.

```text
owner   DOMAIN-SPECIALIZATION
action  DELETE — pending ruling, since the closure-allocation nuance is real if
        small
```

### 4. `warnedHistoryRetention` — DIAGNOSTIC / CONVERGED

```text
reader     `if (warnedHistoryRetention || !root ...) return;`
decision   emit ST2029 once vs repeatedly
```

Its own comment says "One report per process". No product semantic depends on
it; a configuration diagnostic warning once per process is the intended shape.

### 5. `treesConstructedCount` — DIAGNOSTIC / CONVERGED

Previously carried as an uncharacterized REVIEW.

```text
reader     `treesConstructedCount > 0` gates a dev-mode warning
decision   whether `registerMarkerProcessor()` was called after trees existed
count use  interpolated into the message: "(N trees so far)"
```

So the DECISION is `> 0`; the COUNT itself only enriches the message. A real
diagnostic with a real reader — not deletable, and not a product semantic.

### Pre-collection gate

```text
runtime / globalPathNotifier reacquisition   PROVEN
nextRegistryId                               KERNEL / CONVERGED
nextStandaloneEntityPositionId               DOMAIN-SPECIALIZATION / CONVERGED
entityMapRegistered                          DELETE (redundant guard)
warnedHistoryRetention                       DIAGNOSTIC / CONVERGED
treesConstructedCount                        DIAGNOSTIC / CONVERGED

generic REVIEW rows from this cluster        0
installed · applyMemberValue                 REIMPLEMENT (named later work)
```

## PRE-COLLECTION-CLOSE-0 — THE LAST TWO ROWS

### `entityMapRegistered` — DELETED

```text
DO NOT CACHE A FACT ALREADY AUTHORITATIVELY KNOWN BY THE REGISTRY MERELY TO
AVOID AN UNMEASURED ALLOCATION.
```

The boolean duplicated what `MARKER_PROCESSORS` already owns —
`registerProcessor` returns early when a processor with the same `check`
function is present, and the check is the same reference every call. Deleted;
the registry's own idempotence is the authority.

Census: **123 → 122 bindings, 98 → 97 mutable non-ambient.**

If that closure allocation ever becomes measurable, hoist the callback rather
than reintroducing duplicate mutable state.

### `nextStandaloneEntityPositionId` — the decision, found

⚠️ MY PREVIOUS CLOSURE WAS PREMATURE. I recorded
`DOMAIN-SPECIALIZATION / CONVERGED` on the grounds that the allocator "exists
solely for the standalone entity path". That identifies its PRODUCER and its
probable domain — not the decision that consumes the value, which is what the
`nextRegistryId` trace had just demonstrated is the thing that earns package
lifetime.

Traced end-to-end:

```text
nextStandaloneEntityPositionId++
    -> standaloneEntityPositionIdAllocator()
    -> createEntitySignal's `positionId`
    -> getPositionIds() / getPositionIdsForNotify()
    -> pathNotifier.notify(..., positionIds, ...)   3 call sites
    -> the delivery envelope a consumer receives
```

Collision falsifier — force every standalone collection to id 1:

```text
FAIL  owner PositionId allocation >
      allocates a new owner position when the same path materializes twice
```

The carrier constructs **two standalone collections at the SAME PATH** (`'rows'`)
and requires their positionIds to differ, then asserts those ids appear in the
`notify` envelope.

That is the semantic consequence: two same-path standalone collections are
otherwise indistinguishable — identical path string, subject ids both starting
at 1. A consumer receiving `notify('rows.1', ...)` could not tell which
collection produced it.

It is the same discrimination job `nextRegistryId` does for trees, applied where
no registry exists to do it. In a tree, `ownerId` (the registry id) carries the
distinction and positions are registry-scoped. A standalone collection has no
registry, so its position allocator must carry the distinction itself.

⚠️ AND THIS DOES NOT CONTRADICT "PositionIds ARE NOT GLOBALLY UNIQUE". That rule
governs positions WITHIN a registry — two same-shaped trees deliberately give
their collections the same local position id, which is exactly why identity is
`(registry, position)`. The standalone allocator is the fallback for subjects
that have no registry half to pair with.

```text
nextStandaloneEntityPositionId
    owner   DOMAIN-SPECIALIZATION (entity)
    action  CONVERGED — package uniqueness earned by a demonstrated consumer
```

### Pre-collection gate — closed

```text
runtime / globalPathNotifier / reset   CONVERGED (reacquisition proven)
PathObservationPort                    CONVERGED (emitMutation + notify only)
nextRegistryId                         KERNEL / CONVERGED
nextStandaloneEntityPositionId         DOMAIN-SPECIALIZATION / CONVERGED
entityMapRegistered                    DELETED
warnedHistoryRetention                 DIAGNOSTIC / CONVERGED
treesConstructedCount                  DIAGNOSTIC / CONVERGED

installed                              REIMPLEMENT at C6
applyMemberValue                       REIMPLEMENT
generic REVIEW rows                    0
```

## MUTABLE COLLECTION PASS

```text
COLLECTION MUTABILITY DOES NOT CHOOSE OWNERSHIP. MEMBERSHIP SEMANTICS DO.
```

### ⚠️ THE DENOMINATOR WAS NOT 20

Re-derived from the current 97 mutable non-ambient subjects rather than carried
forward: **28 collection-shaped subjects**.

Ten of those are `const` object/array literals with **no mutation of any kind** —
no method mutators, no property assignment, verified rather than assumed. They
are constants by convention (not `Object.freeze`d, so not provably immutable) and
belong with `MODULE-CONSTANT-POLICY-0`, not here:

```text
DEFAULT_CONFIG · WRONG_ENTITY_METHODS · EXTERNAL_ACQUISITION ·
defaultDependencies ×2 · WHOLE_SUBJECT · PORT ·
TREE_CAPABILITY_DEPENDENCIES · TREE_CAPABILITY_ORDER · RESTORATION_CAPABILITIES
```

**Actual mutable collections: 18.**

### A. Identity / topology registries — indexes, not authorities

```text
AN INDEX MAY LOCATE AN AUTHORITY WITHOUT OWNING THE AUTHORITY.
```

| subject | membership means | owner | action |
|---|---|---|---|
| `OWNED_NODE_METADATA` | node → its positionIds/subjectIds/ownerPath | KERNEL | CONVERGED |
| `ROOT_TREES` | root accessor → its tree | KERNEL | CONVERGED |
| `OBSERVATION` | leaf → dormant observation claims | KERNEL | CONVERGED |
| `TREE_STORES` | "this object is a tree store" | KERNEL | CONVERGED |
| `MEMBERSHIP_REVISION` | branch → its membership carrier signal | KERNEL | CONVERGED |

All WeakMap/WeakSet keyed by the node itself, so retention is the node's
lifetime — no independent eviction policy to get wrong.

`MEMBERSHIP_REVISION` is the one that retains observable state (a
`WritableSignal`), not merely an index. It is still not a second truth: the
signal's value is a revision counter whose only job is invalidating a memo, and
the source of truth remains the branch's own enumerability. That is exactly the
frozen `ONE MEMBERSHIP CARRIER PER BRANCH` shape.

### B. Observation registry

| subject | membership means | owner | action |
|---|---|---|---|
| `listeners` (error-reporter) | who receives `onTreeError` events | KERNEL | CONVERGED |

Strong `Set`, but user-controlled: `subscribe` returns an unsubscribe, and a
test-seam reset exists. Membership decides delivery, never tree state.

### C. Causal / consequence retention

| subject | membership means | owner | action |
|---|---|---|---|
| `scopesByOwner` | owner → open commit scopes by id | OPTIONAL-CAPABILITY | CONVERGED |
| `openScopesByKey` | key → currently open scope ids | OPTIONAL-CAPABILITY | CONVERGED |
| `settleListenersByKey` | key → settle callbacks | OPTIONAL-CAPABILITY | CONVERGED |
| `heldByKey` | key → held consequences | OPTIONAL-CAPABILITY | CONVERGED |

All four WeakMap-keyed by owner/scope key, so retention ends with the owner.
None decides restorability — that stays with the single restoration authority.

### D. Capability / marker registry

| subject | membership means | owner | action |
|---|---|---|---|
| `MARKER_PROCESSORS` | registered marker processors, in order | KERNEL | CONVERGED |

Push-only, never cleared, monotonic for the process. It is the authority
`entityMapRegistered` was duplicating — dedupes on `check` identity, which is
why that boolean could be deleted.

### E. Diagnostics — all dev-only, verified

| subject | bound | owner | action |
|---|---|---|---|
| `warnedWriteOnly` | WeakSet on the processor | DIAGNOSTIC | CONVERGED |
| `ENTITY_ARRAY_WARNED` | explicit cap of 256 | DIAGNOSTIC | CONVERGED |
| `MARKER_IN_ARRAY_WARNED` | dev-gated | DIAGNOSTIC | CONVERGED |
| `warnedNoopPaths` | dev-gated inline | DIAGNOSTIC | CONVERGED |
| `warnedNoopCopyPaths` | dev-gated AT INSTALLATION | DIAGNOSTIC | CONVERGED |

⚠️ `warnedNoopCopyPaths` LOOKED LIKE UNBOUNDED PRODUCTION GROWTH. It is a strong
`Set<string>` keyed by PATH with no cap, and its guard condition contains no
`ngDevMode` check — so on inspection it appeared to grow forever in production,
which dynamic member churn would make severe.

It does not. `leafEqual` — the only thing that touches it — is installed only
when dev mode is on:

```ts
const equal = typeof ngDevMode === 'undefined' || ngDevMode
  ? leafEqual(equalityFn, path)
  : equalityFn;
```

The guard sits at the INSTALLATION site rather than inside the function, which
is the repo's foldability idiom and also why reading the function alone
misleads. Chased to the call site rather than accepted from the condition.

### F. Caches

```text
A CACHE MAY RETAIN A DERIVATION. IT MUST NOT BECOME A SECOND OBSERVABLE STATE.
```

| subject | source of truth | invalidation | owner | action |
|---|---|---|---|---|
| `MATERIALIZED` | the branch's live signals | `MEMBERSHIP_REVISION` dependency inside the memo | KERNEL | CONVERGED |
| `SNAPSHOT_MEMO` | the marker node | the memo's own dependencies | KERNEL | CONVERGED |

Both WeakMap-keyed by the node, both storing a `computed` rather than a value —
so invalidation is the reactive graph's, not a hand-rolled eviction rule. That
is why `INVALIDATING CACHE IDENTITY IS NOT REACTIVE INVALIDATION` was the
correct earlier ruling: the memo object is stable and its dependency is what
changes.

### Batch summary

```text
CURRENT COLLECTION SUBJECTS      28
  constants by convention        10  -> MODULE-CONSTANT-POLICY-0
  actual mutable collections     18

CONVERGED                        18
MOVE / SPLIT / REIMPLEMENT / DELETE   0
UNRESOLVED                        0
```

No collection was found owning state another authority already owns, no cache
without a proven invalidation path, and no unbounded production retention. The
one candidate for each of those turned out to be `MEMBERSHIP_REVISION` (a
carrier, not a truth), the two memos (reactive invalidation), and
`warnedNoopCopyPaths` (dev-gated at installation).

## ACCELERATED MODEL — TRIAGE, AND WHAT IT REVEALED

```text
100% OF SUBJECTS MUST BE ACCOUNTED FOR.
NOT 100% OF SUBJECTS DESERVE A CUSTOM EXPERIMENT.
MUTATION PROVES DISPUTED SEMANTICS; IT IS NOT A CEREMONY FOR OBVIOUS MECHANICS.
```

An anomaly score now rides on every module-state subject. It never makes a
ruling — it decides how much evidence to spend. Weights encode the shapes that
actually produced defects here: global policy with per-tree spelling, multiple
reset paths, installed runtimes, test-only readers, duplicate retained facts.

**It validates against known outcomes.** The top scores are the subjects that
produced real defects — `runtime`/`globalPathNotifier` at 7 (the reset
divergence), `activeStats` at 6 (the one that resembled `batchDepth`).

### ⚠️ THE SCORER MADE THE SAME MISTAKE IT EXISTS TO CATCH — TWICE

```text
first pass    every module-level arrow function scored +2 for
              "installed runtime"                       -> 6 pure helpers DEEP
second pass   `SUBJECT_RESTORATION_CLAIMS_SYMBOL` scored 6 entirely from the
              word "SUBJECT" in its name and "restoration" in its path
```

A `const f = () => {}` is a function declaration, not an installed callback; the
shape that matters is a REASSIGNABLE slot. And a `Symbol.for()` constant is a
property key the census already enumerates separately.

```text
A SYMBOL'S NAME DOES NOT CHOOSE ITS OWNER
```

— committed by the triage tool built to enforce it. Corrected both:
**DEEP 20 → 14 → 13, and every remaining DEEP subject was already ruled.**

### ⚠️ AND THE DENOMINATOR OVERSTATED MUTABLE AUTHORITY BY 2×

`mutableCandidate` means "not a literal primitive", which is far broader than
"mutable". Across the 97:

```text
labelled mutable non-ambient        97
  with a write or a mutating call   33   <- real mutable authority
  with NEITHER                      64   <- constants, keys, functions

the inert 64, by shape:
  26  Symbol.for() keys        13  const functions        8  object literals
   5  Symbol()                  3  as-expressions         2  array literals
   2  conditionals              1  identifier alias
```

Those 64 are not mutable state and never were. They still owe ownership
rulings — `IMMUTABILITY PROVES ABSENCE OF MUTABLE STATE; IT DOES NOT PROVE
ABSENCE OF SEMANTIC AUTHORITY` — but as constants and structural keys, under
`MODULE-CONSTANT-POLICY-0`, not as authority slots.

### Batch closure

```text
33 real mutable-authority subjects
  31 ruled across Clusters 1–2 and the collection pass
   2 pending, both in devtools-impl
```

| subject | retained fact | owner | action |
|---|---|---|---|
| `devToolsGroups` | `Map` of devtools groups, held on a global registry host | DIAGNOSTIC | CONVERGED |
| `devToolsConnections` | `Map` of devtools connections, same host | DIAGNOSTIC | CONVERGED |

Both are `const` bindings caching a Map that lives on a documented global
registry host (`__SIGNALTREE_DEVTOOLS_*`), which is how devtools survives module
duplication. Devtools is `ngDevMode`-gated and tree-shakes to 0.07 KB in
production. No product semantic reads either.

### Standing state

```text
module-state subjects                122
  ambient                              9
  literal primitives                  16  -> MODULE-CONSTANT-POLICY-0
  inert (keys/functions/literals)     64  -> MODULE-CONSTANT-POLICY-0
  REAL MUTABLE AUTHORITY              33  -> ALL RULED

remaining actions from this pass
  installed          REIMPLEMENT at C6
  applyMemberValue   REIMPLEMENT
  generic REVIEW     0
```

**MODULE-STATE-OWNERSHIP-0 Pass A is complete.** Every subject that holds
mutable authority has an owner and an action.

## PASS A CLOSED + MODULE-CONSTANT-POLICY-0

### ⚠️ ONE BATCH RULE WAS INADMISSIBLE

```python
if r['writes'] or r['mutationCandidates']:
    return area, 'CONVERGED', 'mutated within one module by its own operations'
```

Locality of implementation is not ownership. It proves nothing about semantic
owner, lifetime, duplicate authority, retention, or reset behaviour — and a
batch classifier producing `CONVERGED` from it would launder exactly the
questions this phase exists to ask. It reached only two pending subjects, both
given real traces below.

### The last two mutable-authority subjects

| | `devToolsGroups` | `devToolsConnections` |
|---|---|---|
| membership means | a devtools group exists for this groupId | a live/connecting devtools connection for this groupId |
| writers | `set` at group creation | `set` on connect and reconnect |
| removers | `delete` on teardown | `delete` on disconnect, failure, teardown |
| readers | `get` for reuse; `get` for aggregated-instance lookup | `get` before send/subscribe |
| decision | reuse the existing group vs create one | send to an existing connection vs open one |
| lifetime | the devtools session, not any tree | same |
| why a global host | `window`/`globalThis` keyed by `__SIGNALTREE_DEVTOOLS_*` so duplicate module instances share one devtools registry — the browser extension is process-wide, so a package-local Map would split one session in two |

```text
both   DIAGNOSTIC   CONVERGED
```

Dev-gated and 0.07 KB in production; no product semantic reads either.

```text
MODULE-STATE-OWNERSHIP-0 / PASS A    CLOSED
  true mutable-authority denominator   33
  all ruled                            33
  named actions   installed REIMPLEMENT@C6 · applyMemberValue REIMPLEMENT
  generic REVIEW                        0
```

### Triage calibration — the failure direction that matters

```text
TRIAGE MAY OVER-ESCALATE. IT MUST NOT SILENTLY UNDER-ESCALATE KNOWN RISK SHAPES.
```

Both observed scorer failures were false positives, which cost time and miss
nothing. The dangerous direction is invisible: a known-dangerous shape quietly
landing in FAST-LANE and closing on an evidence row.

`tools/triage-calibration.mjs` pins both directions using subjects whose real
disposition this audit established — 7 must never be FAST-LANE (including both
halves of the reset-divergence pair and the cache whose correctness is
invalidation), 3 must not reach DEEP on lexical grounds. Weakening the
authority signals kills 5 controls.

Raw identifier-name scoring dropped from +3 to +1. Path domain is evidence about
current REPRESENTATION, never about ownership, so it may nudge a lane and must
not decide one. That is what let a `Symbol.for()` key score 6.

### MODULE-CONSTANT-POLICY-0 — 80 subjects

Denominator derived, not carried forward.

```text
31  structural keys (Symbol / Symbol.for)
16  primitive constants
13  pure module functions
10  immutable tables
10  other (as-expressions, conditionals, Object.freeze, alias)

FAST-CLOSED   76
REVIEW         4
DELETE         0
UNKNOWN OWNER  0
```

⚠️ OWNER-BY-PATH IS A HYPOTHESIS. The batch tool suggests an owner from module
location; that is `OWNER_CANDIDATE`, never `OWNER`. Each fast-closed row's owner
comes from its consumers.

### The four escalated

| subject | fact | owner | action |
|---|---|---|---|
| `TREE_CAPABILITY_ORDER` | capability visiting order — **order IS consumed**, it drives dependency resolution | KERNEL | CONVERGED |
| `RESTORATION_CAPABILITIES` | which capabilities grant `hasRestorationAuthority` | OPTIONAL-CAPABILITY | CONVERGED |
| `WHOLE_SUBJECT` | shared `{kind:'whole'}` sentinel for whole-subject addresses | KERNEL | CONVERGED |
| `SNAPSHOT_FORMAT_VERSION` | `'2.0.0'` stamped into every snapshot | OPTIONAL-CAPABILITY | **REVIEW** |

⚠️ `SNAPSHOT_FORMAT_VERSION` IS WRITTEN AND NEVER READ. It is stamped into every
persisted snapshot and **nothing validates or migrates on it** — no comparison,
no version check, no migration branch anywhere in serialization.

That is not dead code: a version stamp is forward-useful precisely because
future readers can migrate on it, and removing it would strand every snapshot
already written. But the name implies a compatibility guarantee the code does
not provide, and a snapshot from an incompatible future format would be loaded
without complaint today.

Recorded as REVIEW rather than ruled: whether 1.0 ships a reader for it is a
serialization-contract decision, not a constant-policy one.

### MUTATION-ENVELOPE-OWNERSHIP-0 — `kind` and `structural` (CLOSED: DELETE both)

`MutationEnvelope` is a one-producer, one-consumer parameter object: built in
`internals/owned-mutation.ts` and immediately translated field-for-field into a
positional `notify(...)` call. Two of its nine fields were dead in **opposite
directions**, which is why neither was visible from one side alone:

| field | producer | consumer | verdict |
|---|---|---|---|
| `kind` | set on **every** mutation | **none** | DELETE |
| `structural` | **never set** | `meta.structuralEffect` | DELETE |

**`kind`.** Three producers, all reachable, none informative. Two threaded a
literal `'set'`/`'update'` from `leaf.set`/`leaf.update`. The third —
`observation-substrate.ts` — computed it as `intent === 'replace' ? 'set' :
'update'`, i.e. **derived the field from its own neighbour in the same call**.
A value computed from the argument beside it carries no independent fact, which
is exactly why no consumer ever branched on it. The type `MutationKind`
enumerated seven shapes; five (`insert`/`remove`/`move`/`rekey`/`replace`) were
never produced at all.

**`structural`.** The sole producer never assigned it, so `envelope.structural`
was always `undefined`. Its one reader, `path-notifier.ts`, copied it into
`meta.structuralEffect`; the absence-sensitive-looking test downstream
(`entry.meta?.structuralEffect !== undefined`) treats absent and
present-undefined identically, so no observable behaviour distinguished the
field from its own removal. Entity structural effects never used this route —
they reach delivery through a **direct** `notify(...)` call carrying
`createStructuralEffectMeta(...)`.

> **A LIVE CONSUMER TYPE DOES NOT RESCUE A TRANSPORT FIELD THAT NO PRODUCER CAN
> EVER POPULATE.**

**Scope of the deletion.** The field `structural` dies; the type
`StructuralEffect` does **not** — it has ~150 live references across
`entity-signal`, `restoration`, `transactions` and the whole causal runtime, and
a real producer in `createStructuralEffectMeta`. The type `MutationKind` **does**
die, because once the field goes its only remaining use is a parameter feeding
the deleted field. `mutationIntent` is untouched and stays: it is genuinely
consumed (`transactions.ts` branches on `=== 'replace'`).

**TYPE-SURFACE-PROTECTION-0 does not engage.** Established by compile probe
against the published entry (`dist/packages/core/src/index.d.ts`), not by
grepping `index.ts` — that grep scores `0` for `StructuralEffect` too and so
cannot discriminate. The probe imports each type from the built entry and takes
the compiler's exit code:

```text
PUBLIC   WriteMetadata            ← known-positive control
private  MutationEnvelope         ← subject
private  MutationKind             ← subject
private  StructuralEffect
private  __DefinitelyNotAType__   ← known-negative control
```

An earlier run of this probe reported *everything* private including the
negative control — a dead instrument from an unresolved path mapping. The
result above is only admissible because the positive control passes.

**Verification.** `tsc` clean; core **2006 passed / 3 expected fail / 2026
total** — exact parity with the pre-deletion baseline, and no test-count delta
to account for because no assertion was retired. Bundle: bare 9.03→**9.01** KB,
entities 19.46→**19.45** KB, dev −20 B each.

### MUTATION-ENVELOPE-OWNERSHIP-0 — identity family

**`subjectId` — DELETE.** A third field dead in the `structural` direction:
produced by nobody, handled by its one consumer. The producer wrote
`subjectId: options.subjectIds?.[0]`, but neither call site of the envelope
supplies `subjectIds` — `signal-tree.ts` passes `positionIds` only, and
`observation-substrate.ts` passes neither. The consumer already guarded
`envelope.subjectId === undefined ? undefined : [envelope.subjectId]`, so an
always-undefined field was behaviourally identical to no field. (That guard is
also why the hypothesised `[undefined]` leak — a length-1 array that would make
`(subjectIds?.length ?? 0) === 0` false in `transactions.ts` — does not exist.)

Proven by **exit code with a bidirectional control**, not by reading call sites:

```text
ARM B   throw when options.subjectIds IS undefined     exit 1   ← control: site reached
ARM A   throw when options.subjectIds is EVER defined  exit 0   ← never populated
ARM C   throw when positionIds.length > 1              exit 0   ← [0] narrowing drops nothing
```

Arm A alone would have been unfalsifiable — a throw in unreachable code is also
green. Arm B is what makes it evidence.

**The deletion had a tail, and the tail is the actual finding.**
`MutationEnvelope.subjectId` → `OwnedMutationOptions.subjectIds` →
`defineOwnedSubjectIds` (one caller, behind the guard that never opened) →
`OwnedNodeMetadata.subjectIds` (its only writer). All deleted. What survives is
`getOwnedSubjectIds`, which has 70+ live uses — because subject ids reach leaves
by a **direct `Object.defineProperty('__subjectIds')` in `entity-signal.ts`**.

That is the third time in this audit the same shape appears: the entity path
writes the fact directly, and the owned-mutation/envelope path carries a
**second, unused writer for a fact entities already own** — `structural`,
`subjectId`, and the sidecar storage mode all fail the same way.

**`ownerId` — KEEP.** Genuinely consumed, and load-bearing precisely because of
a frozen decision: position ids are deliberately **not** globally unique, so
`ownerId` is the registry namespace that disambiguates them. `path-notifier.ts`
reads it in batch-coalescing identity (`left.ownerId !== right.ownerId →
distinct`, NOTIFIER-SCOPE-0) and folds it into `meta` so a `'**'` subscriber can
tell whose tree a write belongs to.

**`positionId` — KEEP.** Both the emission guard (`undefined` → emit nothing)
and the delivered identity.

**`ownerPath` — NOT DELETED; referred to the representation ruling.** Measured,
and the measurement is unambiguous:

```text
ARM E (control)  throw when ownerPath === path         exit 1   ← site reached
ARM D            throw when ownerPath !== path         exit 0   ← never differs
ARM F            throw when ownerPath is undefined     exit 0   ← never absent
```

So `envelope.ownerPath` is **always exactly `envelope.path`**, and *both*
defaults written to handle their disagreement are dead: the producer's
`options.ownerPath ?? options.path` and the consumer's `envelope.ownerPath ??
envelope.path`.

This is deliberately **not** treated as dead-code removal. Unlike `kind`,
`structural` and `subjectId`, `ownerPath` is produced *and* read — it merely
always equals its neighbour, and it does so for two **different** reasons:
`signal-tree.ts` sets both to the leaf path, while `observation-substrate.ts`
sets `{ path: ownerPath, ownerPath }`, deliberately reporting the mutation *at
the owner path*. Same value, different semantic domain. Collapsing them would
be a representation choice about whether this transport should preserve a
distinction the `notify(...)` protocol maintains for its other callers — which
is the ME-A/ME-B/ME-C question, not a mechanical cleanup.

> **SAME VALUE DOES NOT IMPLY SAME SEMANTIC DOMAIN.**

**`before`/`after`/`attribution` — KEEP.** The transition values themselves, and
`attribution` always carries at least `mutationIntent`, which `transactions.ts`
branches on.

**Envelope after this pass: 10 fields → 7.** `positionId`, `ownerId`, `path`,
`ownerPath`, `before`, `after`, `attribution`. Core **2006 / 3 / 2026** at every
step — unchanged from baseline, no assertion retired.

**A note on how the last residue was caught.** After all four deletions the core
suite was green at 2006/3/2026 — and a spec was still constructing a
`MutationEnvelope` with `kind: 'set' as never`. Vitest strips types, so that
literal kept "passing" while naming a field that no longer existed. The
ratcheted `spec-types` gate is what failed, on the one file that got worse.

> **A GREEN SUITE THAT DOES NOT TYPECHECK ITS OWN SPECS CANNOT SEE FIELD ROT.**

The `as never` also illustrates why the cast rule is narrow rather than absolute:
the boundary under test there is port inertness, not envelope shape, so the cast
was incidental rather than a bypass of the assertion — but it is exactly what
let the stale field sit unnoticed.

**Gate state after the pass:** `gates --fast` 47/47, `typecheck` pass,
`lint:budget` pass, `spec-types` pass, bundle bare **8.98**/9.7 KB (from 9.03),
entities **19.41**/21 KB (from 19.46), dev 11.12 and 22.02.

`check-kernel-ownership` remains RED, correctly and for the open burn-down only:
340 censused subjects, 340 ledger rows, **0 stale**, 279 UNKNOWN. Two repairs
were needed to get there, both pre-existing:

1. The census self-check was hard-failing with *"the parser is broken, not the
   repository"* — because its known-present anchor was `batchUpdates`, a field
   BATCH-UPDATES-INTENT-0 had already retired. A `mustFind` anchor must name
   something the audit is not trying to delete, or the gate dies of its own
   success. Repointed to `enhancers`, with a bogus-name control confirming the
   anchor still fails when it should (exit 1 bogus / exit 0 real).
2. Twelve STALE ledger rows named subjects that no longer exist — four from this
   pass (`envelope:kind`, `envelope:subjectId`, `envelope:structural`,
   `orphan:…defineOwnedSubjectIds`), eight from earlier closures (batch-scope,
   `config:batchUpdates`, the narrowed path-observation-port state). Retired by
   recording the seven surviving envelope rulings in the generator's `RULINGS`
   map and regenerating — deliberately NOT by hand-editing rows, since subjects
   come from the census and a ruling for a nonexistent subject is a stale row
   rather than a decision.

### MUTATION-ENVELOPE-OWNERSHIP-0 — ME-B, CLOSED

**Ruling: the notification contract is the authority. `MutationEnvelope` is
deleted.**

> **A ONE-USE OBJECT THAT ONLY TRANSCODES INTO THE ALREADY-AUTHORITATIVE
> PROTOCOL IS NOT A SECOND SEMANTIC BOUNDARY.**
>
> **ONE SEMANTIC PUBLICATION JOB, ONE PORT OPERATION.**

The route collapsed from five hops to one:

```text
before                              after
──────────────────────────────      ────────────────────────────
OwnedMutationOptions                OwnedMutationOptions
  ↓                                   ↓
MutationEnvelope                    PathObservationPort.notify(...)
  ↓
PathObservationPort.emitMutation
  ↓
PathNotifier.emitMutation
  ↓
notify(...)
```

Deleted: `MutationEnvelope`, `PathNotifier.emitMutation`,
`PathObservationPort.emitMutation`, `PORT.emitMutation`, `toSegments`,
`joinPathSegments`, `OwnedMutationOptions.ownerPath`, and `WriteAttribution`.

**The encodings were not merely redundant, they were fictional.** `toSegments`
split a string path on `.` so the envelope could carry `PropertyKey[]`;
`joinPathSegments` rejoined it with the same delimiter one hop later. That
round-trip is string identity, so nothing observable depended on it — and the
intermediate array was *wrong* for any key containing a dot, which never
mattered because **no consumer ever read the segments**. The one representation
the envelope added over the protocol was the one nothing used. Both helpers were
checked for independent consumers before deletion, as the ruling required; each
had exactly zero.

**`ownerPath` — two separate rulings, as directed.** The envelope field is
deleted with the envelope. The protocol parameter is KEPT, and it is not a
formality: at `entity-signal.ts` the direct producer publishes `path` =
`` `${basePath}.${key}` `` with `ownerPath` = `basePath`, genuinely distinct.
`OwnedMutationOptions.ownerPath` was also deleted after tracing its one
non-envelope job — it installed persistent `__ownerPath` metadata on the leaf.
That semantic fact is preserved and now **derived from `path`** at this
producer, rather than threaded as a second, always-identical argument.

**`WriteAttribution` — the last of the tail, found by a gate not by reading.**
A hand-maintained subset of `WriteMetadata` that existed for one field,
`MutationEnvelope.attribution`. With the envelope gone it had no consumer, and
`dead-exports` is what said so. Confirmed private by compile probe (control:
`WriteMetadata` PUBLIC, negative control private), so TYPE-SURFACE-PROTECTION-0
does not engage. The attribution fact is untouched — it is published as the
`WriteMetadata` it always really was.

**Carriers: none added.** The ruling asked for three and preferred existing ones.
Rather than assume coverage, each fact was **mutation-tested against the new
call** — every arm restored from backup, never by checkout:

```text
swap before/after           6 tests fail
corrupt path                5 tests fail
corrupt ownerPath ONLY      1 test  fails
drop positionIds            5 tests fail
drop ownerId                1 test  fails
drop attribution            7 tests fail
collapse entity ownerPath   5 tests fail   ← carrier 3, on the entity route
```

All six facts are independently defended, `ownerPath` separately from `path`,
and the entity route's distinct addressing is already guarded — which is exactly
the generalization the ruling warned against ("`ownerPath === path` everywhere"),
and it cannot be made without turning five tests red.

Two carriers were **updated in place, not retired**: the uninstalled-port
inertness test now exercises `notify`, and the port's member list now asserts
`['notify']`. That second assertion is the structural guard against a future
parameter object appearing *beside* the protocol instead of replacing it.

**The census anchor defect recurred immediately — and that is the finding.**
`mustFind('mutationEnvelopeFields', …, 'positionId')` failed with *"the parser is
broken, not the repository"* the moment the interface was deleted. That is the
second occurrence in two passes, after `batchUpdates`. Twice is not coincidence:

> **A KNOWN-PRESENT ANCHOR MUST NAME SOMETHING THE AUDIT IS NOT TRYING TO
> DELETE, OR SUCCESSFUL CLEANUP REPORTS ITSELF AS TOOL FAILURE.**

A convergence audit deletes subjects by design, so any anchor pinned to a subject
under disposition is a *scheduled* false alarm. The whole `mutationEnvelopeFields`
category was retired — discovery, anchor, emit, and category accounting — rather
than repointed to another field of a dying interface, and the seven `envelope:*`
rulings were removed from the generator for the same reason: a ruling for a
subject that no longer exists is a stale row, not a decision.

**Subject identity is NOT closed by this.** The envelope evidence is negative —
this generic scalar route never had a subject-identity producer. Entity/causal
subject identity is live with 70+ readers and is untouched.

> **ABSENCE OF A GENERIC PRODUCER IS EVIDENCE AGAINST GENERICIZING THE FACT.**

`SUBJECT-IDENTITY-OWNERSHIP-0` remains open and must be derived from those live
consumers, not from this deletion.

**Positional `notify(...)` is not frozen by ME-B.** One protocol is frozen, not
its parameter syntax. A typed `PathNotification` object derived from *all*
current producers and consumers remains admissible as representation cleanup —
but only as an in-place replacement. Adding one beside the positional API would
recreate the exact dual-protocol shape this ruling removed.

**Verification.** core **2006 / 3 / 2026** (unchanged at every step, no assertion
retired) · `tsc` clean · `gates --fast` **47/47** · typecheck, lint:budget,
spec-types pass · dead-exports 0 · census/ledger **331 = 331, STALE 0**, 277
UNKNOWN (the genuine remaining burn-down) · bundle bare **8.92**/9.7 KB, entities
**19.35**/21 KB, dev 11.06 and 21.97.

**Cumulative for this subject:** bare 9.03 → **8.92** KB (−110 B), entities
19.46 → **19.35** KB. Three dead transport fields, one dead writer chain, two
fictional encodings, one redundant subset type, and an entire protocol layer.

### ANCHOR-CONTROL-0 — the census self-check, fixed systemically

Two production-subject anchors remained (`signalTree`, and the `enhancers` I had
just substituted for `batchUpdates`). Both were replaced, and `mustFind` was
retired in favour of `mustDiscoverSomething`:

> **A DISCOVERY CONTROL MUST TEST THE DETECTOR, NOT THE SURVIVAL OF A PRODUCTION
> SUBJECT.**

Detector correctness was already fixture-proven and needed no new machinery:
`census-detectors.mjs` declares every family with planted positives, planted
negatives and a killing mutation, and `census-mutation-proof.mjs` — run by
`check-kernel-ownership` — proves each detector dies when mutated. Those fixtures
contain no production subject. What remains in the census is the one thing
fixtures cannot see: whether a detector that works on a fixture returned nothing
against the real tree. That check names no subject.

Controlled both ways: stubbing `detectInterfaceFields` to return `[]` still fails
with the correct message (exit 1), and the unstubbed census passes (exit 0).

---

## SUBJECT-IDENTITY-OWNERSHIP-0

### Coverage

```text
TOTAL LIVE SUBJECT-ID SITES   995   (AST, production compilation unit)
ACCOUNTED BY FAMILIES         995
UNCLASSIFIED                    0
```

Gated by `tools/subject-identity-census.mjs`, which fails if any file is claimed
by two families, by none, or if a family names a file with no sites.

### Identity definition

> **A subject is the identity of one logical collection member across its whole
> lifetime — independent of the key that currently addresses it and of the
> physical position that currently backs it.**

### Producer families

| producer family | allocation / source | lifetime | owner |
|---|---|---|---|
| fresh member | `StructuralStore.allocateFreshSubjectId()` — per-store counter from 1 | until forgotten | entity/structural |
| planned batch add | `planFreshSubjectIds(n)` (reserve, then commit) | same | entity/structural |
| replay reinstatement | `createSubject(id, key)` with a **given** id; bumps `nextSubjectId` past it | preserves identity across rollback/restore | causal replay |

There is **no generic producer.** The ME-B result already proved the generic
authored-scalar route never produced one.

### Consumer families

| family | sites | decision made from subject id | needs independent identity? |
|---|---|---|---|
| A entity structural identity | 575 | which member a key/position currently denotes; rekey, replace, tombstone, reactivate | **yes** |
| B notification / link routing | 39 | routes a delivery to the member it concerns | carries, does not decide |
| C restoration claim / reclamation | 130 | whether a physical backing may be released | **yes** |
| D causal transaction / rollback | 105 | which member an effect compensates | **yes** |
| E realization / replay | 143 | which member to reinstate, and its neighbours | **yes** |
| F diagnostics | 3 | reporting only | no |

### Lifecycle matrix — measured, not inferred

| scenario | key/address | positionId | subjectId |
|---|---|---|---|
| ordinary scalar | path | present | **none** (proved by ME-B) |
| entity member | key | present | present |
| same-key update | unchanged | unchanged | unchanged |
| **rekey** (`changeId(1,2)`) | **1 → 2** | 2 → 2 | **1 → 1 (preserved)** |
| replace value | unchanged | unchanged | preserved |
| remove → tombstone | key released | retained | retained, `state: tombstoned` |
| **retire + re-add same key** | **1 → 1** | **1 → 1** | **1 → 2 (fresh)** |
| same key, two collections | 7 / 7 | 3 / 4 | **1 / 1 (collide)** |
| replay reinstatement | restored | restored | **preserved** |

### The decisive result

Neither identity is a function of the other, and both directions are measured:

```text
same position, successive subjects   retire+re-add: position 1 → 1, subject 1 → 2
same subject, changed address        rekey:         key 1 → 2,      subject 1 → 1
```

A 25-cycle churn probe made the first shape emphatic: **one position id (`[1]`)
backing twenty-five successive subject identities.** A consumer holding the
position cannot tell which member it refers to; only the subject id can.

Subject ids are **collection-scoped**, minted from 1 per `StructuralStore` — so
two collections in one tree genuinely hold different subjects both numbered 1.
`SubjectRestorationClaims` is tree-scoped and indexes the bare number, and that
collision is deliberately resolved by **conservative over-retention** plus a
broadcast to every registered physical owner, with `multi-collection-subject-collision.spec.ts`
proving the collision is real rather than assumed. Note the asymmetry with
position ids, which were given an explicit `ownerId` namespace: subject identity
answered the same problem by over-retaining instead of by scoping.

### Ruling

```text
SI-A + SI-C  (explicit combination, not a compromise)

  SI-A  subject identity IS an independent semantic domain
        proven in both directions above; neither position nor key can
        substitute for it

  SI-C  every producer is entity/structural or causal replay
        the generic scalar kernel must not manufacture it

semantic owner     DOMAIN-SPECIALIZATION (entity/structural)
transport owner    KERNEL — notify(...) may CARRY subjectIds, because that
                   parameter has a real producer (entity-signal, 18 sites)
retention owner    the reclamation planner, via `prepared.retire` →
                   `forgetLifetime` → `StructuralStore.forgetSubject`
action             KEEP the identity domain
```

> **IDENTITY MAY NAME A RESTORATION SUBJECT. IT DOES NOT THEREFORE OWN
> RESTORATION POLICY.** — upheld: the identity layer only reads
> `state?.restoreAllowed ?? true` and forwards it. The bit is decided by the
> reclamation/restoration authority, never by the identity layer.

### Retention

Measured under 25 add/remove cycles with full reclamation applied (25 candidates,
25 reclaimed): the heavy resources are released — `entitySignal: false`,
`nodeFacadeMaterialized: false`, `fieldFacadesMaterialized: []`. What persists is
the O(1) lifetime record (`state`, `revision`, `positionIds`), which a tombstone
needs in order to be distinguishable from "never existed". Pruning is available
through `forgetSubject` and is driven by the reclamation plan, not by identity.

**A suspicion I raised and then disproved:** `subjectStateSignals` has zero
delete sites, which looked like an unbounded map. It is lazily created and, under
this churn workload, **never populated at all** (`activationToken` false for all
25). Not an unbounded retention path. No escalation.

### NEW FINDING — two more dead transport fields (needs a ruling)

Applying the ME-B lesson to the surviving generic slots found the same shape
twice more, by symbol-resolved census with a proven-live read detector:

```text
WriteMetadata.subjectIds     2 writes   0 reads
WriteMetadata.positionIds    2 writes   0 reads

read-detector controls:  structuralEffect 19 reads · mutationIntent 8 · participation 2
```

Both are stamped into the ambient `withWriteContext(...)` by replay
(`tree-realization-adapter.ts:1132`) and restoration (`restoration.ts:1525`), and
therefore ride along in delivered `meta`. Nothing reads either. The fact reaches
consumers by the route they actually use — the explicit `subjectIds` /
`positionIds` **parameters** of `notify(...)`, which restoration and transactions
take positionally. The meta copy is a duplicate transport of an already-delivered
fact.

**Not deleted.** `WriteMetadata` is PUBLIC (compile probe against the built entry;
controls discriminating), so removing fields is a public type-surface change and
`TYPE-SURFACE-PROTECTION-0` engages. Referred for ruling.

### Named remaining work

```text
SUBJECT-CLAIM-SCOPE     REIMPLEMENT (optional, not a 1.0 blocker)
    tree-scoped claims index a collection-scoped number and over-retain by
    design. Correct and carrier-proven, but it is the one place where subject
    identity lacks the namespace that position identity was given.
```

`SUBJECT-IDENTITY-OWNERSHIP-0 — CLOSED.` No generic REVIEW.

### SUBJECT-IDENTITY-OWNERSHIP-0 — corrections

**1. The "995 live sites / 995 accounted" claim is RETRACTED.** The semantics are
unaffected — SI-A and SI-C rest on measured lifecycle discriminators, not on this
denominator — but the instrument had not earned the coverage claim. Two defects,
and they share a shape worth naming:

```text
type-vs-value decided by walking node.parent UPWARD   → 995 of 995 came back "runtime"
syntactic role decided by reading node.parent         → 904 of 904 came back "READ"
semantic family assigned by FILE                      → violates SAME FILE DOES NOT
                                                        IMPLY SAME SEMANTIC DOMAIN
```

> **AN UNRELIABLE LOOKUP THAT FAILS UNIFORMLY IS INDISTINGUISHABLE FROM A REAL
> UNIFORM ANSWER.**

Parent back-pointers are not reliably set (a sibling tool had already crashed on
a parentless node), so both `inType` and the parent are now **passed down** the
walk, where the traversal already knows them and cannot be wrong about a node it
never had to ask about. Families are assigned per `(file, enclosing named
function)`; anonymous callbacks attribute to their nearest named scope, because
pushing `(anon)` collapsed 85 unrelated closures in one file into a single bucket
— the same over-coarse grouping, one level down.

Corrected census:

```text
VALUE-LEVEL SITES  904        BY ROLE   543 READ   128 FORWARD   94 DECLARE
ACCOUNTED          904                   68 WRITE   42 ALLOCATE   29 COMPARE
UNCLASSIFIED         0

  434  A entity structural identity        FILES SPANNING >1 FAMILY: 2
   25  B notification / link routing         structural-store.ts -> A, C, F
  213  C restoration claim / reclamation     entity-signal.ts    -> A, C, F
   94  D causal transaction / rollback
  118  E realization / replay
   20  F diagnostics
```

The correction moved real mass — **A 575 → 434, C 130 → 213** — so the file-level
version had been crediting ~80 reclamation sites to structural identity. Count
continuity with 995 was explicitly not a goal.

**2. `WriteMetadata.positionIds` DELETED; `WriteMetadata.subjectIds` KEPT.**

The ruling was executed and, in executing it, **its premise turned out to hold
for only one of the two fields.** Both measured identically — and the first
measurement was itself wrong:

```text
first census      2 writers each     ← WRONG, under-counted
repaired census   8 writers each     0 production readers each
```

The under-count is instructive. Write detection compared
`getPropertyOfType(contextualType, prop)` against the declaration symbol by
identity — but every optional `metaOverride?: WriteMetadata` parameter gives a
contextual type of `WriteMetadata | undefined`, and the checker **synthesizes** a
union property symbol that fails strict identity. Six of eight sites vanished.
It was caught only because `tsc` failed on sites the census had reported absent.

> **COMPARE DECLARATIONS, NOT SYMBOL IDENTITY.**

With that repaired, the deletion was executed for both — and two carriers went
red. Repointing them to the surviving route separated the fields:

```text
positionIds   carrier repointed to interceptLeafSignals' own argument → GREEN
              duplicate transport CONFIRMED, deletion stands

subjectIds    same switch → RED.  node `__subjectIds` = [1, 2] for a rekeyed row
              where the replayed effect names [1]. The node answers "which
              subjects has this node held", the effect answers "which subject is
              this". On the interceptor replay route the ambient copy is the
              ONLY carrier of the latter.
```

Two carriers depend on it, and they assert real semantics: that a rekeyed row
keeps one stable subject token, and that removed and reused subjects stay
distinct across replay observation. So `subjectIds` was **restored**.

> **IDENTICAL CONSUMER COUNTS DO NOT IMPLY IDENTICAL DISPOSITIONS. "NO PRODUCTION
> READER" IS A REASON TO ASK WHETHER THE FACT HAS ANOTHER AUTHORITATIVE ROUTE —
> IT IS NOT ITSELF THE ANSWER.**

`WriteMetadata.subjectIds` therefore remains, with its disposition open: produced
by replay, read only by carriers, and the sole route to the effect's subject on
the interceptor path. It is **not** dead duplicate transport, and the ME-B
reasoning does not reach it.

**3. `SUBJECT-CLAIM-SCOPE` reclassified CONVERGED, not REIMPLEMENT.**

```text
semantics    tree-scoped conservative claim equivalence over collection-local ids
correctness  PROVEN        collision  PROVEN REAL (permanent carrier)
failure mode over-retention, never premature release
owner        RESTORATION / RECLAMATION        action  CONVERGED
```

Carrying a `REIMPLEMENT` while calling it "not a blocker" would fight the
requirement that unresolved convergence actions reach zero. Optional future work
is recorded separately and is not release work:

```text
SUBJECT-CLAIM-PRECISION-0   namespace claims by physical collection owner
                            PERFORMANCE / RETENTION OPTIMIZATION
                            promote only if measurement shows material cost
```

### REPLAY-SUBJECT-ATTRIBUTION-0 — the ruling's own alternative outcome

The `SPLIT / REIMPLEMENT` ruling was executed as far as its precondition allowed,
and then stopped at the branch it defined for itself:

> **DO NOT BUILD RUNTIME MACHINERY SOLELY TO SATISFY A TEST.**

**Step 1 — producers.** Eight writers, two causal sources, not eight authorities:

| producer family | source record | why that subject is the effect subject |
|---|---|---|
| tree realization / replay (7 sites) | `effect.subjectId` on the planned causal effect | the effect *is* the reinstatement of that subject — add, remove, rekey and the heterogeneous frame each name the one row they realize |
| restoration replay (1 site) | `entry.restorationSubjectIds` on the history record | the record names exactly the subjects that entry is responsible for restoring |

**Step 2 — the split could not find a destination.** The narrowest internal
carrier does not exist, and could not be created without new machinery:

```text
interceptLeafSignals        "not root app API" (index.ts), unexported,
                            zero consumers outside core
production readers of the
  effect subject at replay  0 — the causal runtime HOLDS effect.subjectId when
                            it stamps the meta; it never reads it back
CanonicalTurn.__effects[]
  .subjectId                undefined on the exposed clones — measured, turns
                            come back as {kind:'add'|'rekey'|'set'} with no
                            subject
turn.restorationSubjectIds  present — but the two carriers ALREADY read it to
                            compute their EXPECTED values, so asserting the
                            replay half against it is circular
```

**The semantic fact is not at risk.** Correct replay attribution is defended by
behaviour, overwhelmingly: mutating `createSubject(mutation.subjectId, …)` to
reinstate a wrong id turns **432 tests red**. The meta copy never carried
correctness — it only let an observer re-read what the causal record already
said.

**So the ruling's precondition — "after the internal replay-attribution carrier
exists, DELETE the public field" — is unsatisfiable without building a runtime
carrier whose only consumers would be two tests.** Per §7 that is the one allowed
alternative outcome: stop and return the evidence.

**State left:** `WriteMetadata.positionIds` DELETED (accepted, proven duplicate).
`WriteMetadata.subjectIds` left in place with its disposition recorded in the
declaration itself — what is settled (wrong home, 8 writers / 0 production
readers, specialized job on a generic public type) and what blocked the move (no
production consumer to move it for, no non-circular record to host the claim).

The open choice is narrow and belongs to the reviewer:

```text
(a) DELETE the field and retire the replay-observation half of two carriers,
    accepting that "what the replay observer saw" becomes unassertable — the
    underlying invariant stays proven by the 432-test behavioural surface.

(b) KEEP it as a declared observation seam, owned CAUSAL/RESTORATION, job
    "replay attribution / observation", action CONVERGED — accepting a public
    generic field whose real job is specialized.
```

Nothing was retired and no machinery was added, so either is still cheap.

### REPLAY-SUBJECT-ATTRIBUTION-0 — CLOSED, option (a)

`WriteMetadata.subjectIds` DELETED, with all eight writers (7 realization/replay,
1 restoration replay) and the parameter tail they fed. No replacement:
no `replaySubjectIds`, no replay context, no newly exposed
`CanonicalTurn.__effects[].subjectId`.

**What the failed first attempt established, and what it did not.** Substituting
the node's `__subjectIds` returned `[1, 2]` for a rekeyed row where the replayed
effect names `[1]` — node subject LINEAGE and causal effect ATTRIBUTION are
different facts. Being distinct is not the same as earning a public slot:

> **A TEST CAN PROVE THAT TWO FACTS ARE DISTINCT WITHOUT EARNING A PUBLIC
> OBSERVATION CHANNEL FOR EITHER FACT.**
>
> **TEST-ONLY OBSERVABILITY DOES NOT CREATE A PRODUCTION SEMANTIC JOB.**

**Why no replacement channel was built.** The only route where this copy was the
sole carrier is `interceptLeafSignals` — unexported, explicitly "not root app
API", no consumer outside core. Production readers of the replay effect subject:
zero; the causal runtime *holds* `effect.subjectId` when it stamps the meta and
never reads it back. The two alternatives were both dead ends, measured rather
than assumed: the exposed `CanonicalTurn.__effects[]` carry no numeric
`subjectId`, and re-reading `restorationSubjectIds` would be circular because the
carriers already derive their EXPECTED tokens from that field.

**What was retired: one assertion, not two tests.** The carriers lost only
*"a private test observer can re-read the exact causal effect subject through
public WriteMetadata"*. Every semantic claim survives, and the test count is
unchanged at 2026:

```text
rekeyedToken      === addedToken        rekey preserves the logical subject
retainedToken     === addedToken        retention preserves it
reusedPathToken   !== addedToken        a reused key gets a distinct subject
removedToken      === originalToken     removal preserves the retired subject
replacementToken  !== originalToken     the replacement is a new subject
liveSubjectTokens contains each         live observation still sees them
```

**Correctness never lived in the deleted field.** Mutating
`createSubject(mutation.subjectId, …)` → `+ 1000` turns 432 tests red. Rather
than freeze that count, representative permanent carriers that die for the
intended semantic reason:

```text
preserves subject identity and owned positions across structural rekey
resolves the same semantic subject target after a rekey performed after adapter creation
refuses same-key structural work when that key is now occupied by a different subject
prepares and realizes a retained-subject structural restore from removal metadata alone
resolves a restored semantic subject target after adapter creation
```

**Process note.** The first attempt at the carrier edit used an unscoped
string replacement that matched every `unsubscribe()` in the file and broke two
unrelated tests. Restored and redone within the two specific `it` blocks.

> **SCOPE DESTRUCTIVE EDITS TO THE EXACT SEMANTIC SUBJECT, NOT MERELY MATCHING
> SYNTAX.**

```text
SUBJECT-IDENTITY-OWNERSHIP-0
  SI-A / SI-C                    CLOSED
  census                         904 / 904 / 0
  WriteMetadata.positionIds      DELETED
  WriteMetadata.subjectIds       DELETED
  node subject identity          CONVERGED
  causal replay subject identity CONVERGED
  SUBJECT-CLAIM-SCOPE            CONVERGED
  SUBJECT-CLAIM-PRECISION-0      OPTIONAL OPTIMIZATION
REPLAY-SUBJECT-ATTRIBUTION-0     CLOSED
```

### TYPE-BARREL-CONVERGENCE-0 — CLOSED

All 11 declarations moved out of the kernel type barrel to their owner modules
(`batching.types.ts`, `transactions.types.ts` — created, `restoration.types.ts`,
`devtools.types.ts`).

```text
moved subjects              11
duplicate declarations       0    (one `export interface` each, verified per type)
public import regressions    0
kernel -> optional leaks     0
```

**BA-TYPE-A, trivially.** The Batch 1 note that `lib/enhancer-types.ts` consumed
`BatchingMethods` was **my error** — a filename grep matching PROSE. The only
`lib/` occurrences were that comment and the declaration itself, so no generic
enhancer type ever knew an optional enhancer's method bag. Nothing to unpick.

**The `api-baseline` gate independently confirmed the move was placement-only**,
and this is the best evidence in the whole action:

```text
Surface metadata changed (declaring file / framework coupling);
the exported symbol set is IDENTICAL. Regenerate the baseline.
```

A gate designed to catch public-surface drift saw a file change and no symbol
change. Baseline regenerated; 47/47 fast gates green.

Also caught: my public-surface probe reported `RestorationHistoryEntry` MISSING.
That was a **probe artifact** — it is generic, and the probe wrote
`export type X = RestorationHistoryEntry;` with no type argument. Re-probed as
`RestorationHistoryEntry<{a:1}>`: PUBLIC, with the bogus-type control still
failing. Not a regression, and worth recording because a false regression report
is as damaging as a missed one.

`DevToolsConfig` also sits in `lib/types.ts` and is diagnostic-owned, but it is
**not a censused subject**, so it was left alone per the scope rule rather than
silently widening the action.

---

### BATCH 2 — construction / capability / markers / structural symbols

Denominator re-derived after the move (not the ~35 estimate): **41 subjects**.
Closed **36**; escalated **5**.

| group | n | owner | action |
|---|---|---|---|
| config with a proven reader | 5 | KERNEL | CONVERGED |
| capability declarations + construction param | 5 | KERNEL | CONVERGED |
| marker factories (authoring syntax) | 2 | DOMAIN-SPECIALIZATION | CONVERGED |
| marker registration / materialization | 4 | KERNEL ×3, DOMAIN ×1 | CONVERGED |
| structural symbols | 20 | KERNEL ×13, OPTIONAL ×5, DOMAIN ×1, FRAMEWORK ×1 | CONVERGED |

Config rows carry their proven reader site, resolved by declaration symbol via a
new `tools/tree-config-consumers.mjs` generalized from the `batchUpdates`
instrument — declaration comparison, not symbol identity, so the union-property
synthesis defect cannot recur.

Marker rows keep SYNTAX separate from REGISTRATION and MATERIALIZATION: a marker
requests construction and does not thereby become canonical state authority —
`entityMapRegistered` was deleted for exactly that confusion.

One symbol is not kernel-owned: `ScalarSlotRuntime` is declared in
`tree-scalar-slot-angular-runtime.ts` and is FRAMEWORK-ADAPTER — correctly on the
framework side already, so CONVERGED rather than MOVE. (An earlier pass of my own
extractor reported five symbols as having zero uses; that was a multi-line
`Symbol.for(` form defeating the regex, not dead code. All 20 are live.)

**ESCALATED — five public config options with no production decision:**

```text
TreeConfig.name                   0 production readers
TreeConfig.enableDevTools         0
TreeConfig.maxCacheSize           0
TreeConfig.trackPerformance       0
TreeConfig.useStructuralSharing   0

controls on the same run: enhancers 1, capabilities 1, derived 1,
                          useShallowComparison 1, debugMode 2
external consumers across all packages/apps: none
```

This is the `batchUpdates` shape on public authoring surface. Deleting public
options is not a fast-lane call, so they stay UNKNOWN pending a ruling.

### TREE-CONFIG-DEAD-SURFACE-0 — CLOSED, five options DELETED

```text
name  ·  enableDevTools  ·  maxCacheSize  ·  trackPerformance  ·  useStructuralSharing
```

Evidence: **0 production readers each**, symbol-resolved by declaration; **0
consumers anywhere else in the workspace**; and on the same run the instrument
found readers for `enhancers` (1), `capabilities` (1), `derived` (1),
`useShallowComparison` (1) and `debugMode` (2). The zero is a measurement, not a
detector seeing nothing.

> **A CONFIGURATION INPUT WITH NO READER CANNOT AFFECT THE CONFIGURED SYSTEM.**
>
> **PUBLIC AUTHORING SYNTAX WITHOUT A PRODUCTION DECISION IS NOT A CAPABILITY.**

**Contract sweep — one pass, and it found no contract but two hazards.**

1. `TreeConfig.name` carried the doc *"Name shown in devtools."* It was shown
   nowhere; the working field is **`DevToolsConfig.name`**, which survives. That
   is the same shape this very file already tombstones for `enableTimeTravel`:
   *"it had ZERO consumers in signal-tree.ts and silently did nothing, while a
   working flag of the same name lives on `DevToolsConfig`."* Twice is a pattern,
   and it is an argument for deletion, not against it.
2. **`enableDevTools` is also a live exported FUNCTION** (`devtools.ts:87`,
   `enableDevTools(name?)`). The dead config field was a same-spelled twin of a
   working API — an author reaching for the option got silence while the real
   thing sat one import away.

No spec asserted any of the five as a `TreeConfig` option; no live doc teaches
them (`maxCacheSize` appears once in `migration-v8-v9.md` as an option of the
long-deleted `memoization()` enhancer, and archived docs keep historical names by
rule); no release-claim entry names them. **No explicit write-only or reserved
contract exists**, so none was invented from a spelling — and nothing their names
imply was implemented:

> **AN UNUSED KNOB IS A DELETION CANDIDATE, NOT AN IMPLEMENTATION BACKLOG.**

`api-inventory --check` stayed green: `TreeConfig` is still exported, so a field
contraction removes no public symbol.

---

### DEBUG-MODE-OWNERSHIP-0 — DIAGNOSTIC, not KERNEL

I closed this row too fast in Batch 2, on the reasoning that `signal-tree.ts`
reads it.

> **A READER PROVES LIVENESS. A READER DOES NOT PROVE OWNERSHIP.**

Both readers traced: `signal-tree.ts:1805` gates
`console.log(TREE_DESTROYED)`; `signal-tree.ts:2057` forwards it into
`resolveEnhancerOrder`, where it gates only
`console.warn(ENHANCER_CYCLE_DETECTED)` — the unordered fallback
`return enhancers` runs either way. Nothing touches canonical state, mutation
semantics, identity, membership or causal authority. Owner **DIAGNOSTIC**.

`TreeConfig` remains the right surface: these are kernel-level dev logs that fire
without `devTools()` installed. And the "third reader in serialization" from my
Batch 2 report was a loose grep — that module declares its **own** unrelated
`debugMode`. The symbol-resolved instrument said two, and two was right.

---

### PUBLIC-SURFACE-CENSUS-PARITY-0 — CLOSED, and it was NOT the isolated miss

**`DevToolsConfig` is DC-A.** It is absent from `api-baseline.json` entirely — it
is not publicly exported, only module-exported from `lib/types.ts` and re-exported
through the internal `enhancers/types.ts`. The public-type census was right to
omit it; there was no defect there.

**But the sweep the ruling demanded found a real DC-B gap of nine.** Checking the
census's public denominator against the independent `api-baseline` (built
surface, a different mechanism from source parsing) returned:

```text
api-baseline public symbols   69
ownership census public rows  60
missing                        9   AuditEntry, AuditMetadata, AuditTrackerConfig,
                                   DefineStoreConfig, ReadonlyEntityNode,
                                   ReadonlyEntitySignal, ReadonlyNodeAccessor,
                                   ReadonlyStore, ReadonlyView
```

Cause: a public type reaches the barrel by **two spellings**, and the detector
knew one —

```ts
export type { PlantedType } from './c';                 // matched
export { defineStore, type DefineStoreConfig } from '…' // NOT matched
```

The value detector was never wrong about these (it filters `type ` members out),
so nothing was miscounted as a value; the type side simply never looked inside a
value clause. Patched, with planted fixture positives for both inline spellings
and negatives asserting a value beside an inline type is still not a type.

Two follow-on repairs the patch itself forced:

- The `publicValueExport` **mutation proof went unprovable** because my inline
  scan reused the value detector's exact regex text, making the declared killing
  pattern match twice. Rewritten to be textually distinct; all 13 families
  mutation-proven again.
- Parity is now **wired into `check-kernel-ownership`**, with a control proving
  the gate fails when a public symbol is unaccounted (exit 3) and passes when
  restored. A denominator that can silently shrink is not a denominator.

> **A DISCOVERED OUT-OF-DENOMINATOR SUBJECT REQUIRES EITHER AN EXPLICIT
> EXCLUSION OR A DENOMINATOR REPAIR.**

The denominator honestly **grew**: 326 → 335 subjects. All nine were ruled
immediately on the Batch 1 basis (readonly family → KERNEL, audit → DIAGNOSTIC,
`DefineStoreConfig` → FRAMEWORK-ADAPTER/MOVE with `defineStore`).

### PIPELINE-DENOMINATOR-STABILITY-0 — CLOSED

**A. The 335 → 327 delta, by exact key comparison** (not by hypothesis — the
census was regenerated with the pre-de-export sources restored, then again
after, and the two key sets diffed):

```text
REMOVED 8:
  6 × orphan:*                    legitimate — the export genuinely no longer exists
  2 × pipeline-candidate:*        ILLEGITIMATE
        lib/entity-signal.ts:setEntityPositionIdNotifyEnabledForTesting
        lib/internals/owned-mutation.ts:defineIntrinsicMutationEmitter
ADDED 0
```

The hypothesis was exactly right, and `defineIntrinsicMutationEmitter` is live
production machinery that merely stopped being exported.

**B. The cause was export-sensitivity in discovery.** `detectPipelineFns`
matched `^export function`, so removing a modifier deleted behaviour from the
denominator.

> **A BEHAVIORAL PIPELINE DOES NOT STOP BEING BEHAVIOR WHEN ITS EXPORT MODIFIER
> IS REMOVED.**
>
> **EXPORT STATUS IS API REACHABILITY EVIDENCE. IT IS NOT BEHAVIORAL-PIPELINE
> DISCOVERY.**

**And the repair found far more than the two.** Making it export-invariant
recovered **eleven internal pipelines that had never been in the denominator at
all** — `signal-tree.ts:materializeOrdinaryBranch`, `materializeTreeMarkers`,
`republishMembers`, `utils.ts:materialized`,
`materialize-markers.ts:materializeKeyedAware`,
`member-membership.ts:activateOne`/`deactivateOne`,
`tree-realization-adapter.ts:resolveNotifyPath`,
`confirmed-undo.ts`/`pending-rollback.ts:getRestoredStructuralResource`,
`transactions.ts:cloneTurnRecord`. The de-export did not create this hole; it
made an existing one observable.

**C.** An export-invariance control is planted: a non-exported verb-named
function in the fixture that must still be discovered. All 13 families remain
mutation-proven.

**D. Accounting: `335 − 6 + 11 = 340`. UNEXPLAINED DELTA = 0.**

---

### BATCH 4A — module state (120 subjects), by exact-identity evidence join

```text
census state subjects  120      MATCHED by exact key  120
evidence rows          120      NEW 0        ABSENT 0
```

The prior `module-state-evidence` rows carry the same `state:<file>:<name>` key
the ledger uses, so this is an identity join, not resemblance.

| owner / action | n |
|---|---|
| KERNEL / CONVERGED | 71 |
| OPTIONAL-CAPABILITY / CONVERGED | 26 |
| DIAGNOSTIC / CONVERGED | 13 |
| DOMAIN-SPECIALIZATION / CONVERGED | 6 |
| FRAMEWORK-ADAPTER / CONVERGED | 1 |
| TEST-SEAM / CONVERGED | 1 |
| **KERNEL / REIMPLEMENT** | 1 — `applyMemberValue` |
| **FRAMEWORK-ADAPTER / REIMPLEMENT** | 1 — `installed`, the C6 realization boundary |

Both pre-existing named actions were carried forward rather than cleared by
knowing their owner. The only genuine retention question — four warn-dedupe
`Set`s in `signal-tree.ts` — resolved on inspection: `ENTITY_ARRAY_WARNED` has an
explicit size cap and `warnedNoopPaths` sits behind an `ngDevMode` guard, so
neither can grow in a shipped build.

---

### BATCH 4B — bare-reachable modules (27)

Owners aggregated from the jobs already classified **inside** each module.

> **REACHABILITY IS EVIDENCE ABOUT COST, NOT EVIDENCE ABOUT OWNERSHIP.**

```text
BM-A  KERNEL / CONVERGED              24
BM-B  KERNEL / SPLIT                   1   lib/utils.ts — a bare-required kernel
                                           job sharing a module with a framework job
BM-C  FRAMEWORK-ADAPTER / REIMPLEMENT  2   tree-scalar-slot-angular-runtime.ts
                                           materialization-realization.ts
```

**This batch could not be done until its reporter was repaired, and two of my own
first verdicts were wrong because of it.** `bare-module-list.mjs` emitted only
`basename(p)`:

- `constants.js` matched both `lib/constants.ts` and
  `enhancers/serialization/constants.ts`. I had ruled it **SPLIT** on the
  strength of the wrong one; with paths it is `lib/constants.ts`, kernel-only,
  **CONVERGED**.
- `index.js` matched both the package barrel and `lib/markers/index.ts`; it is
  actually `enhancers/index.ts`.
- `b.js` had no source anywhere because it is **the tool's own synthetic probe
  entry**, which had been censused as a phantom bare-reachable subject.

> **A MEASUREMENT HARNESS MUST NOT APPEAR IN ITS OWN MEASUREMENT.**

Three genuinely shared modules (`deep-equal`, `is-built-in-object`,
`is-traversable-node`) resolve to `@signaltree/shared` — outside the core census
file universe by construction, not a miss.

---

## OWNERSHIP DISCOVERY IS COMPLETE

```text
339 censused subjects   ·   339 ledger rows   ·   STALE 0   ·   UNKNOWN 0

remaining convergence actions   25
    REIMPLEMENT  16      MOVE  4      SPLIT  2      DELETE  1
```

```text
UNKNOWN:  277 → 232 → 196 → 191 → 148 → 28 → 0
```

Every surviving mechanism now has one explicit semantic owner. What remains is
not discovery but execution of named actions — C6 framework handoff and its
dependents chief among them.

## OWNERSHIP-CLOSURE-CORRECTION-0 — the three defects, repaired

`UNKNOWN = 0` was retracted and re-earned. All three findings were correct.

### A. Batch 4A owner provenance — the shortcut was real

My classifier was a regex over the file path with a `KERNEL` fallback. That is
exactly the prohibited direction, and the exact-key join did not license it:

> **AN EXACT JOIN TO EVIDENCE DOES NOT AUTHORIZE A HEURISTIC OWNER DERIVATION
> FROM THAT EVIDENCE'S FILE PATH.**

Replaced by `tools/state-ownership-registry.mjs`, which admits exactly two
sources and records which one every row used:

```text
CURRENT STATE SUBJECTS   120
EXPLICIT adjudications    52   per subject, from its retained fact and readers
JOB-INVENTORY derived     68   the module's other subjects were adjudicated
                               individually and agree; the row names the
                               establishing job
PATH-INFERRED OWNERS       0
UNRESOLVED                 0
```

**There is no fallback owner, and that refusal did the work.** The registry
failed twice on first run — surfacing 30 subjects in modules with no adjudicated
job, then 15 more in modules whose only jobs were test seams or whose jobs
disagreed. The path regex had been silently absorbing all 45 into KERNEL. Six of
them are in `lib/utils.ts`, whose jobs genuinely disagree (KERNEL +
FRAMEWORK-ADAPTER) — the module already ruled SPLIT.

### B. Bare-module subject identity

The reporter learned full paths but the ledger key was still `bare-module:<basename>`.

> **IF A PATH WAS REQUIRED TO DISAMBIGUATE THE SUBJECT, THE PATH MUST
> PARTICIPATE IN THE SUBJECT'S IDENTITY.**

Keys are now normalized source paths (`bare-module:core/lib/constants.ts`,
`bare-module:shared/lib/deep-equal.ts`) — dist prefix stripped, package identity
retained, temp directories excluded, probe entry excluded. Collision control:
`lib/constants.ts` and `enhancers/serialization/constants.ts` derive two distinct
keys where the basename scheme collapsed them into one.

### C. Bare aggregation re-derived — and the answer changed

Recomputed from the corrected job inventory rather than reused, and it did **not**
reproduce my earlier counts:

```text
first pass (path-derived jobs)      re-derived (corrected jobs)
  BM-A  24 CONVERGED                  BM-A  19 CONVERGED
  BM-B   1 SPLIT                      BM-B   3 SPLIT
  BM-C   2 REIMPLEMENT                BM-C   2 REIMPLEMENT
                                       +     4 KERNEL/REIMPLEMENT inherited from
                                             an angular-value job inside them
```

`lib/constants.ts` is a newly visible **BM-B**: it holds DIAGNOSTIC message
catalogues and the FRAMEWORK-ADAPTER `ngDevMode` declaration in one bare-reachable
module. The first pass called it CONVERGED off the wrong basename match.

### D. Action accounting — the two missing rows were `REVIEW`

My tally regexed four action spellings and printed 23 against a checker total of
25. The gap was two `REVIEW` rows — `public:batching` and `public:entityMap` —
which are not generic review at all but the named BATCHING-OWNERSHIP-0 and
ENTITY-REPRESENTATION-OWNERSHIP-0 discriminators. Renamed to REIMPLEMENT with the
named issue in the rationale.

> **ACTION ACCOUNTING REQUIRES SUBJECT PARITY, NOT A PARTIAL REGEX OVER ACTION
> NAMES.**

```text
TOTAL non-CONVERGED rows   30
sum of group counts        30      unexplained 0      generic REVIEW 0
REIMPLEMENT 22 · MOVE 4 · SPLIT 3 · DELETE 1

by underlying named issue:
   22  C6 framework handoff
    3  bare-reachability consequence
    1  BATCHING-OWNERSHIP-0        1  ENTITY-REPRESENTATION-OWNERSHIP-0
    1  createAuditTracker          1  applyMemberValue
    1  dead export (isAnySignal)
```

### E. Final ownership gate

```text
339 censused subjects   ·   339 ledger rows
MISSING 0 · STALE 0 · UNKNOWN OWNER 0
unexplained subject delta 0 · unexplained action delta 0 · generic REVIEW 0
PATH-INFERRED OWNERS 0

core 2006 | 3 expected fail · gates --fast 47/47 · typecheck/spec-types/lint 0
dead-exports 0 · api-inventory 0 · public-surface parity 0 · mutation-proof 0
bare 8.92/9.7 KB · entities 19.35/21 KB
```

**OWNERSHIP DISCOVERY — CLOSED.**

## OWNERSHIP-CLOSURE-CORRECTION-1 — final provenance close

### A. `JOB-INVENTORY` inheritance deleted

The objection was right: inheriting an owner from a module's other agreeing jobs
detects a *known* mixed module but cannot detect a binding that **is** the
module's undiscovered minority job.

> **AGREEMENT AMONG KNOWN JOBS IN A MODULE DOES NOT PROVE THAT AN UNCLASSIFIED
> JOB BELONGS TO THE SAME DOMAIN.**
>
> **A MODULE'S OWNER IS THE RESULT OF ITS JOBS. A JOB'S OWNER CANNOT BE DERIVED
> FROM THE MODULE OWNER IT HELPS CREATE.**

The preferred source in A1 turned out not to exist: the historical
MODULE-STATE-OWNERSHIP-0 and MODULE-CONSTANT-POLICY-0 passes were adjudicated
conversationally and never persisted per subject, so there was nothing to join
against. A3 applied instead — `module-state-evidence.mjs` was extended to record
`readerLocationsInFile` (it already captured `enclosingFn` and was discarding
it), and all 68 were adjudicated from **what their readers do**.

**`lib/signal-tree.ts` proves both earlier derivations wrong.** Inheritance made
all twelve of its bindings KERNEL. Three are (`NODE_ACCESSOR_SYMBOL`,
`NODE_STORE_SYMBOL`, `NODE_ACCESSOR_PEER` — read by `makeNodeAccessor`). The
other nine are read only by `warnEntityArrayLeaf`, `warnMarkerInContainer` or the
noop-warn paths and are **DIAGNOSTIC**.

```text
CURRENT STATE SUBJECTS   120
EXPLICIT adjudications   120
JOB-INVENTORY derived      0      ← the branch was deleted, not merely unused
PATH-INFERRED OWNERS       0
UNRESOLVED                 0
```

The registry has no derivation branch at all now, so an unadjudicated subject
fails the run rather than inheriting anything.

### B. Permanent bare-module identity control

`tools/bare-module-identity-control.mjs`, wired into `check-kernel-ownership`. It
**imports the real `normalizeBareSubject` and `isProbeEntry`** rather than
re-implementing them — a control that copies the scheme proves only that the copy
agrees with itself. (This required guarding `bare-module-list.mjs`'s main body so
importing it does not trigger an esbuild run.)

It asserts: two sources sharing a basename stay two subjects (`constants.js` and
`index.js`, both real historical collisions); the basename collapse is
demonstrably detectable; package identity retained; dist prefix stripped; no
absolute path; probe entry excluded and a real module not mistaken for it.

Mutation-proven: forcing `normalizeBareSubject` back to `basename(path)` makes
the ownership gate exit 3; restoring it returns 0.

> **THE EVIDENCE INFRASTRUCTURE MUST DEFEND THE IDENTITY SCHEME THAT ITS
> OWNERSHIP CLAIMS DEPEND ON.**

### C/D. Bare modules re-derived a second time — and changed again

Recomputed from the now fully-explicit state rows:

```text
first (path-derived)   second (job-inventory)   third (explicit rows)
  BM-A 24 CONVERGED      BM-A 19 CONVERGED        BM-A 19 CONVERGED
  BM-B  1 SPLIT          BM-B  3 SPLIT            BM-B  5 SPLIT
  BM-C  2 REIMPLEMENT    BM-C  2 REIMPLEMENT      BM-C  2 REIMPLEMENT
                          + 4 KERNEL/REIMPLEMENT   + 1 KERNEL/REIMPLEMENT
```

`signal-tree.ts`, `materialize-markers.ts` and `merge-derived.ts` are newly
visible **BM-B** modules — each holds DIAGNOSTIC or FRAMEWORK-ADAPTER bindings
alongside its bare-required kernel job. None of that was visible while state
owners were inherited.

### E. Final closure gate

```text
339 censused subjects   ·   339 ledger rows

MISSING 0 · STALE 0 · UNKNOWN OWNER 0
PATH-INFERRED STATE OWNERS 0 · MODULE-INFERRED STATE OWNERS 0
unexplained subject delta 0 · unexplained action delta 0 · generic REVIEW 0

non-CONVERGED 30 = REIMPLEMENT 19 · SPLIT 6 · MOVE 4 · DELETE 1

bare identity control GREEN (basename-collapse mutation → gate exit 3)
census mutation-proof GREEN (13 families) · public-surface parity GREEN

core 2006 | 3 expected fail · gates --fast 47/47 · typecheck/spec-types/lint 0
dead-exports 0 · api-inventory 0 · bare 8.92/9.7 KB · entities 19.35/21 KB
```

**OWNERSHIP DISCOVERY — CLOSED.**

## C6-FRAMEWORK-HANDOFF-0 — C6.0 denominator repair (implementation not started)

### The detector was repaired, not the three rows

`angular-value` vs `angular-type` was decided from the import STATEMENT's `type`
modifier. That is wrong at the granularity that matters:

> **IMPORT STATEMENT KIND DOES NOT ESTABLISH RUNTIME COUPLING. VALUE-POSITION
> USE DOES.**
>
> **TYPE ERASURE IS A PROPERTY OF THE REFERENCED SYMBOL'S USE, NOT OF THE IMPORT
> STATEMENT THAT HAPPENS TO CONTAIN IT.**

`import { signal, Signal } from '@angular/core'` carries one runtime symbol and
one erased type. The census now classifies per symbol by AST value-position, and
the result matches the emitted artifact exactly — **11 modules with a real
runtime `@angular/core` import**, confirmed independently in `dist`:

```text
signal        devtools-impl · restoration · entity-signal · signal-tree ·
              utils · tree-scalar-slot-angular-runtime
computed      entity-signal · entity-map · signal-tree · utils
isSignal      serialization · merge-derived · signal-tree · utils
untracked     signal-tree · owned-mutation
linkedSignal  tree-scalar-slot-angular-runtime
effect / runInInjectionContext / Injector    utils
inject / Injectable / DestroyRef             define-store
```

`Signal` and `WritableSignal` have **zero** value-position uses across all 10
files that name them.

Reclassified to `angular-type` / CONVERGED: `lib/types.ts`,
`lib/internals/derived-types.ts`, `lib/internals/builder-types.ts` — none emits
an `@angular/core` import; builder-types is not emitted at all. They are not C6
runtime debt today.

A permanent control (`tools/angular-coupling-control.mjs`, wired into the
ownership gate) plants the exact defeating shape — one runtime symbol and one
erased type in a single non-`type` import — and asserts the statement-kind rule
**would** misclassify it.

### The bare SPLIT rule was too aggressive, and is now adjudicated

`owners.length > 1 → SPLIT` proposed five file surgeries the moment corrected
state provenance revealed diagnostic and framework bindings.

> **MULTIPLE SEMANTIC OWNERS IN ONE FILE ARE EVIDENCE TO INSPECT A BOUNDARY, NOT
> PROOF THAT A PHYSICAL SPLIT IS REQUIRED.**
>
> **SPLIT WHEN CO-LOCATION CREATES DEPENDENCY, AUTHORITY, OR MATERIAL COST — NOT
> TO MAKE THE OWNERSHIP TABLE MONOCHROME.**

| module | runtime Angular | ngDevMode guards | disposition |
|---|---|---|---|
| `lib/utils.ts` | signal, computed, isSignal, **effect, Injector, runInInjectionContext** | 10 | **SPLIT held** — the DI work is a different job from the kernel utilities beside it |
| `lib/signal-tree.ts` | signal, isSignal, untracked, computed | 32 | **REIMPLEMENT** — coupling belongs to the kernel job itself; no diagnostic split |
| `lib/internals/merge-derived.ts` | isSignal | 4 | **REIMPLEMENT** — re-evaluate after `isReactiveNode` |
| `lib/internals/materialize-markers.ts` | **none** | 8 | **CONVERGED** — dev-guarded co-location, no dependency or cost |
| `lib/constants.ts` | **none** | 2 | **REIMPLEMENT (DEV-ENV)** — fix S4 first, then re-evaluate |

### Denominator

```text
338 censused = 338 ledger rows · STALE 0 · UNKNOWN 0
non-CONVERGED 26 = REIMPLEMENT 19 · MOVE 4 · SPLIT 2 · DELETE 1
C6 21   ·   non-C6 5   ·   UNCLASSIFIED 0
```

### The key structural finding

`signal-tree.js` already contains:

```js
installMaterializationRealization({
  isReactiveNode: (node) => isSignal(node),
  memoizeSnapshot: (_node, compute) => computed(compute),
});
```

**The neutral realization seam already exists — the kernel imports Angular in
order to install Angular into its own port.** The dependency direction is
inverted, not missing. S2/S2b are therefore a convergence-point fix rather than a
new abstraction, and

> **THE BARE KERNEL MUST NOT REQUIRE ANGULAR TO REALIZE CANONICAL STATE.**

remains the constraint that decides S1.

### C6.1 — four decisive findings, ahead of implementation

**1. Angular's native signal already satisfies a neutral cell contract — with no
wrapper.** The kernel's entire cell surface is: create with `{ equal }`, call to
read, `.set`, `.update`, `.asReadonly` (one use, `destroyed`). Compiled against
`@angular/core`:

```ts
interface ReadableCell<T> { (): T }
interface WritableCell<T> extends ReadableCell<T> {
  set(v: T): void; update(fn: (c: T) => T): void; asReadonly(): ReadableCell<T>;
}
const a: WritableCell<number> = angularWritableSignal;  // COMPILES
const b: ReadableCell<number> = angularSignal;          // COMPILES
```

Negative control (adding a member Angular lacks) fails, so the probe
discriminates. **Option 2 costs the Angular vertical zero wrapper objects and
zero hot-path indirection** — it is not an aspiration, it type-checks today.

> **FRAMEWORK NEUTRALITY MAY ADD AN ADAPTER BOUNDARY. IT MUST NOT ADD A SECOND
> REACTIVE GRAPH TO A VERTICAL THAT CAN USE ITS NATIVE GRAPH DIRECTLY.**

**2. The scalar-slot path ALREADY implements Option 2.** For `causal-runtime`
trees the canonical value lives in `tree-scalar-slot-runtime.ts` — which imports
**zero** Angular — in a `staged` map behind `readSlot`/`commitSlot`. The Angular
module supplies only observation: `linkedSignal(() => { publication.observe(slot);
… return kernel.readSlot(slot) })`, with `.set` **overwritten** to commit into
the kernel. Angular holds no canonical state on that path at all.

So `linkedSignal` is not a primitive to port. Its semantic requirement is:

```text
a readable cell DERIVED from (publication token, kernel slot storage)
whose write goes to the kernel rather than to the cell
```

Only trees WITHOUT `causal-runtime` fall back to `signal(value, { equal })` as
canonical storage. **S1 is therefore not "replace Angular signals" — it is
"extend the storage model the causal path already uses to the plain path."**

**3. The realization port's own documentation already assigns installation
correctly.** `materialization-realization.ts` states: *"INSTALLATION is once per
process by whichever package supplies the reactive runtime; `@signaltree/core`
does it for Angular."* The contract is deliberately two methods and warns
against becoming a signals abstraction. Its only consumer is
`materialize-markers.ts` (2 sites), and it degrades by design — *"a neutral
consumer with no framework installed is a supported configuration, not an
error."* Moving the install call out of `signal-tree.ts` is a topology fix with a
documented safe degradation, not a redesign.

**4. `ngDevMode` is DEV-C — there is no runtime Angular dependency.** It is
declared as an ambient global (`declare const ngDevMode: boolean | undefined`)
in `constants.ts` and `utils.ts` and never imported; the bundler substitutes it
(`define: { ngDevMode: 'false' }`, which our own size tooling does). It appears
nowhere in the value-position Angular symbol set.

The residual issue is **vocabulary portability, not coupling**: a non-Angular
consumer's bundler will not define the name, and `typeof ngDevMode ===
'undefined' || ngDevMode` then defaults to dev behaviour — correct, but it ships
warnings. That is a naming decision, not a runtime service.

### C6.2 — realization-install topology PROVEN, S3 `withoutTracking` LANDED

**Topology proof (by removal, not inspection).** Deleting the
`installMaterializationRealization({...})` call from `signal-tree.ts` and running
the suite gives **2002 pass / 4 fail** — and the four are exactly the two
documented degradations, nothing else:

```text
memoizeSnapshot (reference stability)   3 × marker-snapshot-memo.spec.ts
isReactiveNode  (already-realized)      1 × write-only-marker.spec.ts
```

One production install site, two read sites, and correct-but-degraded behaviour
without any realization. **The installation can move out of the kernel without
creating a second authority**, and four carriers already pin the affordances so a
move that failed to install would be caught.

**S3 landed.** `internals/tracking-suppression.ts` — one operation, no runtime:

```ts
export type TrackingSuppression = <T>(fn: () => T) => T;
export function installTrackingSuppression(next: TrackingSuppression): void;
export function withoutTracking<T>(fn: () => T): T;   // default: fn()
```

All four `untracked` sites converted. **`owned-mutation.ts`'s only Angular VALUE
import was `untracked`, so it is now framework-neutral at runtime — runtime-coupled
modules 11 → 10**, confirmed in the emitted artifact.

**The contract was undefended, and finding that out took a hang.** Disconnecting
the suppression left the full suite green — no carrier proved it did anything. A
first probe was wrong too: `leaf.set()` is Angular's own setter, so it never
reaches `withoutTracking`, which lives in `recursiveUpdate` (the merge path) and
`runOwnedMutation`. Retargeted at the merge path inside an `effect`, the
disconnected arm **did not terminate in 10 minutes** while the installed arm
finished in seconds.

That is the failure mode: without suppression, the bookkeeping read enrols the
writer as a dependent of the leaf it just wrote, so a reactive context writing
through the merge path re-triggers itself forever. A timeout is not a
measurement, so it is now a **bounded permanent carrier**
(`tracking-suppression.spec.ts`) with a 50-run cap:

```text
suppression installed      settles, PASS
suppression disconnected   hits the cap — "expected 50 to be less than 50", RED
```

> **A FAILURE MODE THAT IS NON-TERMINATION CANNOT BE ASSERTED BY "DID IT
> FINISH". BOUND IT, THEN ASSERT THE BOUND.**

`dead-exports` then caught a `resetTrackingSuppression` seam nothing reached; it
was deleted rather than exported — an unused seam is machinery for a test that
does not exist yet.

```text
core 2007 | 3 expected fail | 2027   (+1: the new carrier)
340 censused = 340 ledger rows · STALE 0 · UNKNOWN 0 · actions 25
gates --fast 47/47 · bare 8.93/9.7 KB · entities 19.37/21 KB
```

### C6 performance gate — established BEFORE S1 touches the hot path

Split deliberately, because this repository already refuses flaky timing
assertions ("timings move with the machine, so asserting them would make the
suite flaky and teach people to ignore it"):

**Deterministic half — `c6-neutrality-invariants.spec.ts`, a real gate.** Five
invariants encoding the frozen rule, none of which move with the machine:

```text
an ordinary leaf IS the framework cell, not a wrapper around one
the leaf participates in the FRAMEWORK graph directly — no second graph
reading a leaf allocates no per-read wrapper — identity is stable
the merge write path reaches the same single cell
a causal tree still exposes exactly ONE cell per leaf
```

Mutation-proven: introducing exactly the architecture C6 must not produce — a
wrapper cell around `signal(value, { equal })` — turns 2 of the 5 red.

**Recorded half — `tools/bench-c6-baseline.mjs`, records, does not gate.** Seven
arms, each with a postcondition so an arm that stops working cannot report as
"faster". Baseline (median ms per 2000 ops, reps=7):

```text
construct-plain-tree      22.3729      scalar-read              0.0417
construct-wide-tree-256    5.1625      scalar-write-leaf-set    0.0930
merge-write-same-leaf      0.4773      merge-write-many-leaves  0.6596
causal-tree-write          0.4351
```

One number is already an argument: **`causal-tree-write` is 4.7× the cost of
`scalar-write-leaf-set`**. That is the slot-storage path, and it is direct
support for the S1 ADAPTER-FIRST ruling — moving ordinary trees onto scalar-slot
storage would trade a single Angular signal for kernel slot + observation cell +
publication machinery on the common path.

**The C6 ratchet — `check-angular-coupling-budget`.** Zero is the target and is
deliberately NOT asserted yet, because core IS the Angular adapter this release
and a permanently red gate is an ignored gate. It records the current 10
runtime-coupled modules; a module leaving is locked in with `--update`, a module
joining fails. Self-tested: the register mutates a neutral module to import
`untracked` and catches it (exit 1).

### C6.4 attempted, reverted — the ratchet failed my own change

I moved the Angular binding into `internals/angular-realization.ts` so the
eventual package split would be a file move. The ratchet rejected it: **10 → 11**
coupled modules.

It was right. `signal-tree.ts` still imports `signal` to create leaves and
`isSignal` in `recursiveUpdate` for its own work, so isolating the *install*
removed no coupling and added a module that had it.

> **CONCENTRATING A DEPENDENCY IS NOT REMOVING IT.**

Reverted, with the reasoning left in place at the call site. The install moves
out when S2b lands — once `isSignal` here becomes the realization's
`isReactiveNode` and leaf creation goes through the cell contract, this module
stops importing Angular at all and the binding leaves with nothing behind it.

```text
core 2012 | 3 expected fail | 2032    gates --fast 49/49
340 censused = 340 ledger rows · STALE 0 · UNKNOWN 0 · actions 25
runtime-coupled modules 10 (ratcheted)
bare 8.93/9.7 KB · entities 19.37/21 KB
```

## PACKAGE-GENERATION-CENSUS-0

Denominator built from the git record (every directory that ever held a
publishable manifest) plus the current workspace, then reconciled against the
**registry**, because release truth is npm and not git.

```text
21 packages in the denominator · 0 unexplained

  8  ABSORB    batching · devtools · entities · serialization · time-travel
               types · utils · shared
  8  DELETE    schema · callable-syntax · syntax-transform · memoization
               enterprise · middleware · presets · async
  3  REBUILD   core · events · ng-forms
  2  LEGACY-ONLY  guardrails · realtime
```

Dispositions come from the deleting commit's own stated reason where one exists
— *"SignalTree ships no validation API"* (schema), *"the transform can never
run"* (callable-syntax), *"not published in 14.0.0"* (enterprise) — and from
whether the semantic job is reachable in the v15 public surface today (`batching()`,
`devTools()`, `persistence()`, `restoration()`, `entityMap` all are).

**13 of 21 were NEVER published.** They have no users to strand, which removes
most of the ecosystem question outright. The eight that exist are:

```text
core · events · ng-forms · schema · guardrails · realtime   14.1.3
enterprise · callable-syntax                                13.5.0
```

### A warning I raised and then had to withdraw

From the git manifests I flagged six packages as *"⚠ ADMITS v15"* — `events` and
`ng-forms` carried `@signaltree/core@^15.0.0-rc.1`, and four others carried
`workspace:*`. Against the registry that is **wrong**: no 15.x of anything was
ever published, and every published companion pins core to a **14.x or 13.x
caret range**, which cannot resolve against a 15.x core. `workspace:*` never
reaches the registry — it is rewritten at publish time.

> **A DEPENDENCY RANGE IN A WORKSPACE MANIFEST IS NOT THE RANGE THE REGISTRY
> SERVES.**

### Which makes the real argument for the scope change sharper, not weaker

npm would already refuse to install a v14 companion beside a v15 core. The
hazard was never mechanical resolution:

```text
mechanical mixing    already blocked by semver
conceptual mixing    NOT blocked by anything
```

A reader — or a coding agent — seeing `@signaltree/schema` beside
`@signaltree/core` assumes one ecosystem, and no version number corrects that
assumption. `@signal-tree/kernel` beside `@signaltree/schema` looks wrong
immediately. **That is what the scope buys, and a version bump cannot.**

### Consequence for the new repository's obligations

Only three packages carry a job into v15 (`core` → kernel, and `events` /
`ng-forms` as REBUILD candidates that must re-earn existence on the v15
observation port and framework-adapter boundary — not by porting their
implementations). Two are LEGACY-ONLY with real users. Everything else is
absorbed or dead.

So the v15 generation can legitimately launch as `kernel` + `angular` alone,
with every future package earning its existence the same way surviving kernel
mechanisms had to.

## PACKAGE-NAMESPACE-CLOSURE-0 — CLOSED

> **A REPOSITORY-MANIFEST CENSUS IS NOT A PACKAGE-NAMESPACE CENSUS.**

```text
A  git manifests ever present     21
B  names mentioned (tree+history) 37
C  names published (probed)        8
U  union                          38    dispositioned 38    unexplained 0
```

| disposition | n | names |
|---|---|---|
| SEE-GENERATION-CENSUS | 21 | the manifest denominator, dispositioned by PACKAGE-GENERATION-CENSUS-0 |
| PROSE-ONLY | 8 | doc/history prose, never a package contract |
| TEST-FIXTURE | 3 | `fake`, `x`, `definitely-not-a-package` — deliberate negative controls |
| PROPOSED-FUTURE | 2 | `kernel`, `angular` — belong to the `@signal-tree` generation |
| PROPOSED-NOT-EARNED | 1 | `authoring` — RELEASE-1.0.md: *"STOPPED. Package/form is UNPROVEN."* |
| NEVER-EXISTED | 1 | `storage` — documented in myths-and-misconceptions as a myth |
| NOT-A-PACKAGE | 1 | `source` — the Nx workspace root project name |
| NON-PACKAGE | 1 | `persist` — see below |

**Names absent from the earlier 21-row census, and why:** `authoring`, `kernel`,
`angular`, `storage`, `source`, `persist`, plus the prose and fixture names.
None ever held a manifest, so a manifest-derived denominator was structurally
blind to them — which is the whole point of the union.

**Published names with no manifest: 0.** Every published package had a manifest.

### Two denominator defects, both found by the tool refusing to default

1. **`grep -rho … | grep -v node_modules` was inert.** `-h` suppresses
   filenames, so the second grep filtered MATCH TEXT, not paths, and could never
   exclude a `node_modules` hit. Replaced with a real `--exclude-dir`.

2. **`git log --all -p | grep` manufactured phantom subjects.** Streaming the
   whole history through a pipe split tokens at buffer boundaries: `mentioned`
   fell from **56 to 37** once replaced with `git grep` over refs. Nineteen of
   the original "names" were truncation artifacts.

   > **A DENOMINATOR ASSEMBLED THROUGH AN UNBOUNDED PIPE IS NOT REPRODUCIBLE.**

`@signaltree/persist` survived that repair, so it is a real historical string,
not an artifact. It is absent from every manifest, from the live discussion
record and from the registry (404); it corresponds to the persistence capability
that shipped as the in-core `persistence()` enhancer. **RESIDUAL:** the exact
originating commit was not pinpointed within the search budget — stated rather
than glossed.

### Registry probe is proven live, not assumed

`--verify-registry` checks a known-published name and a known-absent name in the
same run:

```text
@signaltree/core                -> 14.1.3          (probe is live)
bogus name                      -> 404             (probe discriminates)
```

Without that, "never published" and "the lookup failed" are the same output.
`npm search @signaltree` was independently shown unreliable — it returns seven
packages and silently omits `@signaltree/enterprise`, which is published at
13.5.0. **C is probed per name, never searched.**

### Corrections to earlier dispositions

`events` and `ng-forms` were **narrowed from REBUILD to LEGACY-ONLY**. Both are
published at 14.1.3 with their old implementations deleted (EVT-DEL, NGF-DEL),
but neither has an independently proven surviving job with a known new owner.

> **A SURVIVING USE CASE DOES NOT AUTOMATICALLY EARN A SURVIVING PACKAGE.**

`core → kernel` is the only REBUILD.

### npm scope status — narrower than I first stated

```text
@signal-tree/kernel     package name currently ABSENT (404)
@signal-tree scope      OWNERSHIP AND CLAIMABILITY NOT ESTABLISHED
```

A 404 on a package name says nothing about scope ownership. **Retracted**: my
earlier "@signal-tree scope = unclaimed". Nothing was created, claimed or
published.

```text
gates --fast 49/49 · core 2012 | 3 expected fail · 340 = 340 · UNKNOWN 0
```

## PACKAGE-NAMESPACE-CLOSURE-0 — CLOSED (after two closure-contract repairs)

Both objections were correct, and fixing the first changed a published-history
fact.

### 1. C is now an independent registry denominator

The previous `C = 8` was a hand-maintained list re-verified by `npm view` — it
could only confirm names already known from A and B.

> **A DENOMINATOR THAT CAN ONLY CONFIRM WHAT YOU ALREADY KNEW IS NOT AN
> INDEPENDENT SOURCE.**

`registry.npmjs.org/-/org/signaltree/package` enumerates the scope
authoritatively and answers **unauthenticated** (`npm access list packages`
returns E401 without a token; search was already disqualified for omitting
`@signaltree/enterprise`).

**It immediately produced a fact A∪B had wrong:** `@signaltree/async` is in the
scope but returns no version — because it **was published and then UNPUBLISHED
on 2025-09-16**. My earlier census recorded it as never published. Nine names
enumerated, each then verified individually by `npm view`.

Controls: the enumeration must contain the known positives `core` **and**
`enterprise` or the run fails; pointing it at a nonexistent org exits 1 rather
than reporting an empty namespace — enumeration failure and an empty scope are
different facts.

### 2. The disposition ontology is restored to exactly six

I had invented `PROSE-ONLY`, `TEST-FIXTURE`, `PROPOSED-FUTURE`,
`PROPOSED-NOT-EARNED`, `NEVER-EXISTED`, `NOT-A-PACKAGE` — and a seventh,
`SEE-GENERATION-CENSUS`, which deferred rather than decided.

> **A RATIONALE IS NOT A DISPOSITION.**

All collapse to `NON-PACKAGE`, with the detail preserved as a `[subtype]` prefix
on each rationale. The manifest names now resolve to their real values in this
table instead of pointing elsewhere. `@signaltree/kernel` and
`@signaltree/angular` are **NON-PACKAGE** — their possible future existence under
`@signal-tree` does not make the old strings anything else.

### Final arithmetic

```text
A  git manifests            21
B  names mentioned          38        (self-exclusion applied — see below)
C  scope enumeration         9        authoritative, unauthenticated
U  union                    38        dispositioned 38    unexplained 0

  8  ABSORB        batching · devtools · entities · serialization · shared
                   time-travel · types · utils
  7  LEGACY-ONLY   callable-syntax · enterprise · events · guardrails
                   ng-forms · realtime · schema
  5  DELETE        async · memoization · middleware · presets · syntax-transform
 17  NON-PACKAGE   prose, fixtures, proposals, workspace root, myths
  1  REBUILD       core → @signal-tree/kernel
  0  BRIDGE
```

**The census was also censusing itself.** Its own registry-liveness probe name,
`@signaltree/definitely-not-a-package-xyz`, entered the union and demanded a
disposition — the same defect as the bare-module reporter censusing its
synthetic entry. The census tooling is now excluded from its own denominator.

> **A MEASUREMENT HARNESS MUST NOT APPEAR IN ITS OWN MEASUREMENT.**

### Publication generation — frozen

```text
<= 14    @signaltree/*
>= 15    @signal-tree/*

cross-generation compatibility   NONE IMPLIED — explicit BRIDGE only
active v15 repository            github.com/JBorgia/signal-tree
brand                            SignalTree
website                          signaltree.io

@signal-tree/kernel   package name currently ABSENT (404)
@signal-tree scope    ownership/claimability NOT established
```

Nothing was created, claimed or published. Package-generation work stops here
absent a new falsifier.

```text
gates --fast 49/49 · lint budget clean · core 2012 | 3 expected fail
```

### C6 / S2b — `isSignal` → the neutral realization predicate

**S2b-1 `merge-derived.ts` — COMPLETE, ratchet 10 → 9.** Its only Angular VALUE
import is gone; the remaining `Signal` reference is type-position and erases.
Mutation-proven: forcing the predicate to `false` turns
`derived-after-tree-call` and `derived-not-state` red.

**And the substitution exposed a contract asymmetry worth keeping.** The neutral
predicate degrades to `false` when no realization is installed. For
`materialize-markers` that is documented as *"the conservative direction: the
walk treats the node as ordinary data"*. In `merge-derived` the identical
degradation is the OPPOSITE of conservative — a caller-supplied `computed()`
treated as ordinary data is silently dropped, which that file calls *"historically
the single most expensive failure mode"*.

Measured: with the realization uninstalled, the substitution takes the failure
count from **4 to 8**. The scenario is incoherent in practice (Angular
`computed()` passed into a tree with no Angular realization), but it is a real
coupling of correctness to installation.

> **THE SAME DEGRADATION IS NOT EQUALLY SAFE FOR EVERY CONSUMER OF A CONTRACT.
> SAFE-FAILURE DIRECTION IS PART OF THE SEMANTICS.**

**S2b-2 `signal-tree.ts` — two of three sites substituted; NOT neutralized.**
Line 26 is the realization binding itself (`isReactiveNode: (node) =>
isSignal(node)`) — Angular *answering* the question, where the other two were the
kernel *asking* it. It stays until S1 frees leaf creation from Angular `signal`.

```text
signal-tree.js runtime imports: signal, isSignal, computed, untracked   (unchanged)
coupling ratchet: 9 — no growth, no shrink from this arm
```

The Angular guard was also doing two jobs: `isSignal` is a type guard, so a plain
`boolean` broke `'set' in prop`. The neutral predicate narrows to **`object`** —
the weakest thing supporting the membership test — rather than to a framework
type, because naming `Signal` there would reintroduce the coupling in the type
system while claiming to have removed it from the runtime.

### The performance question is UNRESOLVED on this machine

Line 941 is the hot merge path, so it was measured against the baseline. It
cannot be answered here:

```text
same code, three consecutive equal-parameter runs
worst regression:  +77.1%   +127.3%   +190.1%
```

Earlier runs put `construct-plain-tree` — which never executes the changed line —
at +15.7%, +97.4% and +91.4%, while `merge-write-many-leaves`, the arm that does,
came back **-6.8%** once. The noise floor exceeds any effect the change could
have.

> **A MEASUREMENT WHOSE NOISE EXCEEDS ITS EFFECT IS NOT EVIDENCE IN EITHER
> DIRECTION.**

I am therefore claiming neither "no regression" nor "a regression". The
deterministic invariants — which do not move with the machine — remain green:
leaf is still the framework cell, still in Angular's own graph, no per-read
allocation.

A tool defect surfaced too: `--check` compared a baseline recorded at `n=2000`
against a run at `n=4000` and reported **"+269.7% worst regression"** that
measured only the ratio of the workloads. It now refuses mismatched parameters.

> **A COMPARISON IS ONLY A MEASUREMENT WHEN BOTH SIDES DID THE SAME WORK.**

`serialization.ts` remains STOPPED, unadjudicated.

```text
341 censused = 341 ledger rows · STALE 0 · UNKNOWN 0 · actions 24
core 2012 | 3 expected fail · gates --fast 49/49 · coupled modules 9
bare 8.93/9.7 KB · entities 19.38/21 KB
```

### C6 — realization-absence behaviour (NOT a derived-semantics question)

> **CORRECTION TO THIS SECTION'S FRAMING.** It was first written as
> `REALIZATION-ABSENCE-SEMANTICS-0` with `.derived()` as the discriminator. That
> was wrong scoping and is withdrawn. Derived is settled architecture: the dead
> standalone `derived()` marker was removed in v6.3.1 and its `DerivedMarker`
> archaeology deleted; the live `.derived(($) => ({ … }))` capability is
> retained, KERNEL-owned, with `derived-types.ts` / `merge-derived.ts` already
> carrying REIMPLEMENT for their Angular-shaped implementation.
>
>     CLOSED ARCHITECTURE AND OPEN IMPLEMENTATION WORK CAN COEXIST.
>
> What follows is C6 implementation evidence about one predicate's behaviour
> when no realization is installed. It reconsiders no part of the derived
> contract, and the "Angular `computed()` into a tree with no Angular
> realization" scenario is very plausibly an invalid composition in the future
> package topology rather than a configuration the kernel must support.

**The 4→8 result was never a product defect**, and the contract says so
plainly: `TreeConfig.derived` is documented as *"returns a partial shape of
`computed()` signals"*, so its input is framework-created by definition. Nothing
there needed adjudicating.

**The measurement did find a real defect — in my own S2b-2.**
Measuring absence with all three substitutions in place:

```text
realization absent, before S2b                      4 failures
realization absent, after S2b-1 (merge-derived)     8
realization absent, after S2b-2 (both sites)      169   ← 151 from ONE site
realization absent, line 941 reverted              37
```

Line 941 asks *"is this leaf, which the kernel itself created, writable?"* — and
routing it through the realization predicate made every merge write silently do
nothing when no adapter was installed. The kernel's canonical write path had
become contingent on an optional adapter.

> **THE KERNEL MUST NOT ASK AN OPTIONAL ADAPTER WHETHER ITS OWN STATE EXISTS.**

Line 941 is reverted with the measurement recorded at the call site. Line 1430
keeps the neutral predicate, because its subject is a **caller-supplied** value —
the same question `merge-derived` asks. Same function name, different semantic
decision, and the 151-test gap is what separates them.

**Outcome.** Absence is a supported state for the kernel proper — its own state,
membership, identity and mutation paths all work without any realization, which
is why the number is 37 and not 169. Specific consumers require installation for
their particular operation, and each failure traces to one:

```text
derived-* (4 suites)          .derived() is contractually framework-valued
marker-snapshot-memo          the documented memoizeSnapshot degradation
write-only-marker             the documented isReactiveNode shortcut
restoration / rehydration /
serialization / readonly      consume caller-supplied reactive values
```

**No new predicate was added, and none is proposed.** Absence policy stays
consumer-local — `getMaterializationRealization()` already expresses "acquire,
then decide", and nothing here forced a
`isReactiveNodeStrict`/`Conservative` split.

> **REALIZATION ABSENCE IS NOT A NEGATIVE CLASSIFICATION.**
>
> **SAFE-FAILURE POLICY BELONGS TO THE CONSUMER, NOT TO THE PREDICATE.**

```text
coupling ratchet 9 (unchanged — line 941 never held a separate dependency)
core 2012 | 3 expected fail · gates --fast 49/49
```

### SERIALIZATION-REACTIVE-CLASSIFICATION-0 — SUPERSEDED by SER-A below

> **THIS SECTION'S CONCLUSION WAS WRONG AND IS WITHDRAWN.** It ruled "answer A"
> and routed the predicate through the realization port, justified by "a tree
> using `persistence()` is already in a framework context". That reasoning does
> not survive a framework-neutral kernel: persistence is a surviving KERNEL
> capability, and a headless or server tree must not lose the ability to persist
> because no framework is installed.
>
>     OPTIONAL DOES NOT MEAN FRAMEWORK-DEPENDENT.
>
> The physical result (9 → 8) stands; the semantic route was replaced. Kept for
> the measurement it contains.

All six `isSignal` sites in `serialization.ts` ask about **a node inside
SignalTree's own tree**: unwrap it for encoding, classify branch vs leaf, resolve
a write target, decide whether to recurse. None inspects an Angular object for
Angular-specific wire handling — the encoder unwraps the VALUE and serializes
that. So the question is A, and the substitution lands.

**Why A is safe here and was not at `signal-tree.ts` line 941.** Measured, not
assumed:

```text
                                realization installed    realization absent
line 941 (kernel write path)    —                        +151 failures
serialization (optional cap)    2012 pass                +4 over baseline
```

> **AN OPTIONAL CAPABILITY MAY DEPEND ON A REALIZATION. THE KERNEL MAY NOT.**

A tree using `persistence()` is already in a framework context; the kernel's
canonical merge write is not.

`serialization.js` now emits no `@angular/core` import. Ratchet locked at **8**.

### ⚠️ The mutation control FAILED, and the substitution is therefore UNPROVEN

Forcing the predicate to `false` left **all 2012 tests passing**. No carrier
defends this decision.

The cause is visible in the code: several sites already read

```ts
isSignal(v) || (typeof v === 'function' && 'set' in v && typeof v.set === 'function')
```

SignalTree leaves *are* functions with `.set`, so the structural fallback catches
every writable leaf whether or not `isSignal` answers. `isSignal` only adds
coverage for READONLY reactive values (a `computed()`), and no exercised path
appears to depend on that.

So this substitution is **safe but unverified**: nothing regressed, and nothing
would have caught it if it were wrong.

> **A SUBSTITUTION THAT NO CARRIER CAN FALSIFY HAS MOVED A NUMBER, NOT PROVEN A
> SEMANTIC.**

It is recorded as a ratchet reduction with that caveat attached rather than
counted as verified convergence. The follow-on question — whether `isSignal` is
simply redundant at those sites given the structural fallback — is left open and
NOT resolved here.

```text
342 censused = 342 ledger rows · STALE 0 · UNKNOWN 0 · actions 23
core 2012 | 3 expected fail · gates --fast 49/49 · coupled modules 8
```

### SERIALIZATION-REACTIVE-NEED-0 — SER-A, REDUNDANT

The failed mutation control was the real signal. Asked narrowly — *does any
supported path need reactive classification beyond the structural
writable-callable check?* — the answer is no, per path:

| path | input | readonly reactive reachable? | what `isSignal` contributed |
|---|---|---|---|
| ENCODE (416) | `encodeSnapshot(tree(), …)` — the MATERIALIZED snapshot | **no** — probed: `tree()` on a tree with `.derived()` yields `["a","b"]`, no `sum` | nothing; the code's own comment already said *"we already unwrapped them"* |
| HYDRATE branch/leaf (626, 837) | walks `$` | yes | nothing — already paired with the identical structural fallback |
| HYDRATE write target (731, 762) | walks `$` | yes | **worse than nothing** — see below |
| HYDRATE recursion guard (787) | walks `$` | yes | gated anyway by `isTraversableNode` + `isWritableCallable` |

Probed directly: a `.derived()` value in `$` is a function with **no `.set`** — a
readonly computed. The structural check answers `false` for it, which is correct:
a computed can never be a write target.

**Where the framework arm differed, it was arguably unsound.** At the
write-target sites `isSignal(candidate)` answers TRUE for a readonly `computed()`
and the result is cast `as WritableSignal` — a `.set` that does not exist.
Untested either way; recorded, not fixed here.

**Action taken (SER-A):** the classification dependency is deleted, and
deliberately NOT replaced with realization machinery.

> **DO NOT REPLACE AN UNNEEDED FRAMEWORK DEPENDENCY WITH AN UNNEEDED
> ABSTRACTION.**

`serialization.ts` now depends on neither `@angular/core` at runtime nor the
realization port — a better outcome than the substitution it replaced. Ratchet
stays at **8**, now earned rather than relocated.

### C6-PERF-DISCRIMINATOR-0 — TIMING AUTHORITY EARNED

The machine was not the problem; the METHOD was. Sequential whole-suite runs gave
+77%/+127%/+190% for identical code. Interleaving the arms inside ONE process, in
randomized order within each block, so drift hits every arm equally:

```text
                  A/A noise floor      A/B separation
  run 1                8.0%                +33.5%
  run 2                1.0%                +35.7%
  run 3                0.9%                +44.5%
```

Arm B is the architecture C6 forbids — a wrapper cell in front of every leaf —
used purely as a known-material regression to detect. Direction correct and
separation exceeds 3× the noise floor on every run.

> **A HARNESS WITHOUT A DEMONSTRATED SENSITIVITY CONTROL HAS NO TIMING
> AUTHORITY. THE FIX MAY BE THE METHOD, NOT THE MACHINE.**

⚠️ Arm B is a harness control, **not an S1 surrogate**. S1 must be measured on
its own mechanism.

```text
342 censused = 342 ledger rows · STALE 0 · UNKNOWN 0 · actions 23
core 2012 | 3 expected fail · gates --fast 49/49 · coupled modules 8
bare 8.93/9.7 KB · entities 19.37/21 KB
```

### S1 — ordinary leaf carrier — CLOSED GREEN

`internals/cell-runtime.ts` states the requirement the kernel actually has:
`ReadableCell` / `WritableCell` / `CellRuntime.createCell(initial, equal?)`.
Nothing else — no `computed`, no `effect`, no scheduler.

Angular's `WritableSignal` satisfies `WritableCell` **structurally**, so the
adapter hands back the native object: one cell per leaf, in Angular's own
dependency graph, no wrapper and no second reactive graph.

**Measured against the baseline frozen before S1 existed**, using the
interleaved protocol that earned timing authority:

```text
op              S1 Δ      A/A p90    known-bad     verdict
scalar-write   +0.49%      3.29%    +19.27% (20/20)  GREEN
scalar-read   +14.78%     22.92%    +19.24% (16/20)  inside envelope
```

`scalar-write` is the authoritative operation and shows no material regression —
12/20 blocks, nothing resembling the known-bad 20/20 signature. All five
deterministic representation invariants remain green.

**The Angular fallback in `signal-tree.ts` stays deliberately.** Leaf allocation
is the kernel's OWN canonical state, and line 941 already proved what happens
when the kernel asks an optional adapter about its own state — 151 failures. The
fallback goes away when the package split makes the adapter structural rather
than optional, not before.

Per the release ruling: **direction frozen, no further S1 optimization.**

### Documentation surfaces classified

`docs/reference/` now holds the whitepaper, ADSP protocol, case study, demo
portfolio, persistence ruling and monetization papers — evidence, judged against
the world when written, excluded from the live link/install gate.

> **A REFERENCE ARTIFACT IS NOT A LIVE DOCUMENTATION SURFACE.**

The whitepaper's 25 missing `figures/` references are preserved untouched. Both
doc gates now share one historical-document marker, so `V9_PLAN.md`, the v4.0.0
`MIGRATION.md` and the v7 `docs/ai/LLM.md` keep naming `@signaltree/core` — the
package those generations actually shipped.

> **A HISTORICAL RECORD IS EVIDENCE. DO NOT EDIT IT TO SATISFY A GATE.**

### Identity move

`@signaltree/core` → **`@signal-tree/kernel`** across the workspace, with repo
URLs repointed to `JBorgia/signal-tree`. The physical `kernel` / `angular` split
is still earned by convergence; only the identity moved.

The rename broke `check-documented-imports`, which derived a package's directory
by stripping a hard-coded `@signaltree/` scope. Its self-test caught it
immediately — a known-positive that stopped resolving. It now looks packages up
by NAME and accepts both scopes, so a historical `@signaltree/*` specifier and a
live `@signal-tree/*` one are both understood.

## SPLIT-HISTORY-REGRESSION-CONTROL-0 — CLOSED, split exonerated

Three release gates were RED while `PHYSICAL-PACKAGE-SPLIT-0` was in flight.
Reverting one suspect line (`isWritableCell`) reproduced the failure, which
exonerated that substitution and **nothing else** — the carrier, `PLAIN_RUNTIME`,
the removed Angular leaf fallback and `destroyedSig` were all still unaccounted
for. The control below covers the whole change set.

Arm A = commit `97e304cf`, pre-split, built from its own sources.
Arm B = current working tree.

| arm | A (pre-split) | B (current) | disposition |
| --- | --- | --- | --- |
| `bench-compare` undo-redo | RED | RED | pre-existing; very likely stale harness — 224 restoration tests are GREEN, but that proves the product's *exercised* restoration contract, not that every assumption in the arm is wrong |
| `bench-history-ownership` | RED | RED | pre-existing; exact disposition **OPEN** |
| `size-report` | RED, identical unresolved `storage-adapters.js` | RED | stale harness **confirmed** |

None of the three is a regression from the split work.

### The control nearly returned a false answer three times

    A WORKTREE IS NOT AN ISOLATED EXPERIMENT WHEN THE BUILD SYSTEM'S WORKSPACE
    ROOT IS EXTERNALLY PINNED. VERIFY THE ARTIFACT, NOT THE DIRECTORY.

1. Nx reported `2/2 cache hit (100%)` and produced **no artifact at all**. A
   green build exit is not evidence that a build happened.
2. With `node_modules` symlinked from the main repo, the Nx **daemon** serviced
   the request in the main workspace.
3. The root cause: **`NX_WORKSPACE_ROOT_PATH` was exported in the environment**,
   so every "isolated" worktree build compiled main-repo sources and rewrote the
   main `dist`. Builds must override it (`NX_WORKSPACE_ROOT_PATH=<worktree>
   NX_DAEMON=false`) or they silently measure the wrong repository.

Arm A was only trusted after asserting the built artifact carried `isSignal` and
**zero** split markers. Reproduce the baseline from commit `97e304cf`; the
checkout itself was removed rather than kept.

### Release-harness debt — RC blockers, NOT on the split path

These must be resolved before any release gate is claimed GREEN. They do not
interrupt TYPE-A or the physical package split, because the control above proves
they are not regressions from it.

- **RC-HARNESS-1** — reconcile the `bench-compare` undo/redo arm with frozen
  current history semantics.
- **RC-HARNESS-2** — adjudicate the `bench-history-ownership` pre-existing RED.
- **RC-HARNESS-3** — repair or delete the stale `size-report` storage arm,
  without resurrecting a dead runtime API to satisfy a reporter.

## CELL-IDENTITY — CLOSED

Angular's `isSignal()` was doing TWO jobs in the kernel: framework identity, and
SignalTree cell identity. v15 separates them.

### CELL-IDENTITY-ACQUISITION-0 — CLOSED GREEN

    REALIZATION CREATES AN OBJECT.
    SEMANTIC ADOPTION GIVES IT STATE-CELL IDENTITY.

| acquires cell identity | does NOT |
| --- | --- |
| owned tree leaf (at installation) | unadopted `CellRuntime` value |
| `DerivedRuntime` value | publication token (`signal(0)`) |
| explicit `stampDerived` adoption | `toWritableSignal` Angular view |
| `linkedSignal` owned leaf | foreign consumer signal |

Foreign reactivity is recognised ONLY at the walker boundary, via the
realization port — never by widening cell ownership.

Two failed hypotheses, both measured rather than argued:

- `memoizeSnapshot` registration was speculative and removed: it did not move
  the 214-red discriminator.
- Reusing an existing ownership fact is IMPOSSIBLE as a universal
  discriminator — a plain-tree leaf reports `__emitsMutations = false`, because
  `wrapOwnedWritableSignal` runs only under `buildPlan.has('mutation-capture')`.

The producer that explained 209 of 214 failures was found by instrumenting the
discriminators, not by grepping: `linkedSignalGetter` in the Angular scalar-slot
runtime, wearing `__ownerId` / `__ownerPath` / `__positionIds`.

    REACTIVE OBJECT DOES NOT AUTOMATICALLY MEAN STATE CELL.

### CELL-IDENTITY-CARRIER-0 — FROZEN: private non-enumerable symbol

| arm | wide construction | heap/tree |
| --- | --- | --- |
| WeakSet, all runtime cells | +12.2% | +1.9% — RED |
| symbol, all runtime cells | +6.1% | 0.0% |
| **symbol, sparse (accepted)** | **+6.7%** | **0.0%** |
| A/A noise floor | ±2.1% | ±0.0% |

The cost is REAL, not neutral: ~0.078 ms once, on a 1000-field construction.
Accepted under the preregistered stop rule — sparse did not materially beat
symbol-all, retained memory is flat, no wrapping occurs, and S1 identity is
exact (`markTreeCell(native) === native`). Do not reopen without a packed-consumer
or production falsifier.

## TYPE-A-PACKAGE-BINDING-0 — CLOSED GREEN (TA-B), FROZEN

One semantic implementation; two truthful package declarations.

|  | `@signal-tree/kernel` | `@signal-tree/angular` |
| --- | --- | --- |
| leaf / nested leaf | `WritableCell<T>` | `WritableSignal<T>` |
| `destroyed` | `ReadableCell<boolean>` | `Signal<boolean>` |
| entity field | `WritableCell<T>` | `WritableSignal<T>` |
| entity `asReadonly()` | `ReadableCell<T>` | `Signal<T>` |
| `EntityMap.empty` | `ReadableCell<boolean>` | `Signal<boolean>` |
| Angular assignment | REJECTED | — |

TA-A carried the kernel; TA-B fired at the npm boundary. The kernel cannot
describe `AngularLeaf`: its content is the private brands `[SIGNAL]` /
`[ɵWRITABLE_SIGNAL]`, which is exactly why a neutral cell is NOT assignable to a
`WritableSignal`. So `AngularLeaf` lives in the Angular package and merges into
the kernel's canonical registry.

### Earned adapter type surface — nothing more

    LeafCarriers · LeafOf · TreeNodeOf · ISignalTreeOf · SignalTreeFactoryOf

`CarrierKind` and `ReadonlyOf` stay internal. `NeutralLeaf` was withdrawn:
`WritableCell` already declares `(): T`, so the registry uses the earned type and
the `adapter <-> types` cycle is gone.

### The registry is causally responsible, not decorative

    carrier registration removed  -> 55 type errors
    carrier registration restored ->  0

Three places had independently hard-coded the carrier and all now derive it:
`TreeNodeOf` (leaves), `SignalTreeBuilderOf` (`destroyed`), and
`EntitySignalOf` / `EntityNodeOf` (entity surfaces). Declaration-only — EntityMap
identity, membership, ordering, selection and runtime are untouched.

### Two defects found by removing a nominal brand

- **`ngDevMode`** arrived through Angular's AMBIENT types. Neutralising the
  imports broke five files: an invisible declaration dependency on a bundler
  convention. Now declared locally, per the repo's existing pattern.
- **`readonly.ts` conditional order.** `Signal`'s `[SIGNAL]` brand was silently
  discriminating: a bare `() => T` `NodeAccessor` could not match it.
  `ReadableCell` is brandless, so accessors matched FIRST and readonly branches
  collapsed to `ReadableCell<void>`, losing their child topology.

      REMOVING A NOMINAL BRAND MAKES STRUCTURAL ORDER LOAD-BEARING.

### One authority per signature

The five public `signalTree` overloads were briefly written twice — once in
`signal-tree.ts`, once mirrored in the factory type. The hand-maintained copy is
DELETED: `SignalTreeFactoryOf<C>` is now the only declaration, binding the same
runtime implementation to `'cell'` and `'angular'`.

`CallableWritableSignal` now resolves to a neutral cell and reads as a misnomer.
Deliberately NOT renamed here — that is a surface-quality ruling for
`GREENFIELD-V15-SURFACE-0`.

## C6 — CLOSED GREEN, FROZEN

v15 physically exists as a neutral kernel plus a native Angular realization, in
real installable artifacts — not merely as a workspace architecture.

| packed `@signal-tree/kernel` (Angular absent) | |
| --- | --- |
| `npm ls @angular/core` | empty |
| manifest Angular dep / peer | none |
| packed JS Angular imports | **0** (detector control: 1) |
| packed `.d.ts` Angular refs | **0** (detector control: 1) |
| root + `/adapter` resolution | PASS |
| tree · nested · entityMap · derived · function-as-state · destroy | PASS |
| restoration eligibility, both sides | PASS |
| Link push-out · settled · retrieve · dispose | PASS |

| packed `@signal-tree/angular` (both tarballs) | |
| --- | --- |
| dependency direction | angular -> kernel, no reverse |
| public-root installs realization | PASS, no manual installer |
| native `WritableSignal` · stable identity · graph participation | PASS |
| merge reaches the same native cell | PASS |
| `destroyed` / entity / `asReadonly` / `.empty` are Signals | PASS |
| installed `.d.ts` TYPE-A | PASS |
| minified, tree-shaken production bundle | PASS |

### Packing earned its keep

The split itself was already committed. What a green workspace could NOT see is
that the SHIPPED Angular package installed nothing:

`packages/angular/src/index.ts` carried `import './lib/install-realization';` —
a bare side-effect import. The bundler ELIDED it. The published `index.js`
contained zero occurrences of `installCellRuntime`, so a clean consumer got
neutral kernel cells: `isSignal` false, no `asReadonly`, no dependency tracking.
The packed consumer scored **2/7**. Dropping `sideEffects: false` from the
manifest did not prevent it — the bundler judged the module pure on its own.

Repaired by making installation a module-scope CALL of an imported binding
(`ensureAngularRealization()`), which cannot be elided. **7/7** afterwards,
including a minified, tree-shaken production bundle.

    A BARE SIDE-EFFECT IMPORT IS NOT A PACKAGING GUARANTEE. A CALLED BINDING IS.

2010 kernel tests, 25 Angular tests, lint and typecheck were ALL GREEN with that
defect in place. Only installing the tarball exposed it.

Two supporting repairs the same pass required: `packages/angular`'s
`tsconfig.lib.prod.json` had `outDir`/`declarationDir` pointing into the KERNEL's
dist (build contamination that would have made packed evidence untrustworthy),
and `restoration-eligibility.ts` carried `@internal`, which stripped the earned
`/adapter` semantic-ingress export out of the emitted declarations. The built
manifests were verified installable.

### One retraction

`restoration()` appearing not to record was MY probe testing the wrong contract:
v15 restoration is OPT-IN, so `canUndo() === false` for undesignated writes is the
frozen semantic. The two-sided control (undesignated stays unadmitted; `undoable()`
admits and `undo()` restores) passes from the tarball. RC-HARNESS-1 is therefore a
stale benchmark contract — it calls ordinary `updateOne()` while describing those
operations as undoable. **RC-HARNESS-2 remains independently OPEN.**

Not authorized by this closure: no tag, no RC declaration. `15.0.0-rc.1` remains a
pre-existing placeholder string.

## Pre-freeze ownership dispositions

### ENTITY-REPRESENTATION-OWNERSHIP-0 — ER-A, CLOSED GREEN / FROZEN

    MULTIPLE PHYSICAL STRUCTURES DO NOT IMPLY MULTIPLE SEMANTIC AUTHORITIES.

| structure | owns | keyed by |
| --- | --- | --- |
| `StructuralStore<K>` | identity, lifetime, revision, active-node structure | `K` -> subjectId |
| `EntityValueStore<E>` | retained row value | subjectId |
| per-entity cells | observation projection | subjectId |

Complementary, joined by subject identity — no two hold the same fact. Exactly ONE
`new StructuralStore` site in the kernel; row values appear only in `lib/physical/`
and its owner; `entity-map.ts` (433 lines) keeps no competing row store, it
delegates to `createEntitySignal`.

Carrier: `er-divergence-probe.spec.ts` reads the same fact through three routes —
`rows.all()`, the per-entity cell, and the whole-value snapshot — across add,
field write, bulk update, removal, re-add, `setAll` replacement, and
remove-then-restore. Mutation-controlled: forcing one route stale turns all 3 red.
**No refactor earned.** Do not expand this into a representation matrix.

### BATCHING-OWNERSHIP-0 — BO-A, CLOSED GREEN / FROZEN

    BATCHING MAY CHANGE WHEN OBSERVERS ARE TOLD. IT MAY NOT OWN CAUSAL TRUTH.

`batching.ts` references to causal/commit authority — `PhysicalCommitClock`,
`commitSlot`, `beginFrame`, `subjectId`, `positionId`, `revision`, `restoration`:

    batching.ts                   0
    tree-scalar-leaf-runtime.ts  18   <- control: the pattern DOES match
    entity-signal.ts            279   <- control

It imports `copyTreeProperties`, `visitTree`, types and `ENHANCER_META`; its state
is `notificationDelayMs`, a timeout id, pending-writes-by-path, and a flush via
`queueMicrotask`/`setTimeout`. Orchestration, not a second transaction engine.

Carrier: `batching-ownership.spec.ts` — final authoritative value agrees batched vs
unbatched; batching cannot MINT restoration eligibility (undesignated writes inside
`batch()` stay undesignated); batching cannot STRIP it (`undoable(() => t.batch(…))`
stays undoable and `undo()` restores). Mutation-controlled.

Notification counts are deliberately NOT asserted: coalescing publication is the
enhancer's declared job, so differing delivery is correct behaviour.

### ACCESSOR-STORE-UNIFICATION-0 — NOT REQUIRED

No meaningful duality survives the split. The "store" concept
(`NODE_STORE_SYMBOL` / `TREE_STORES`) is internal to four modules with **0**
references on the public surface — an internal memo-keying detail, not two public
authorities to unify, and not an API-freeze risk.

## GREENFIELD-V15-SURFACE-0 — IMPLEMENTED

Post-rewrite ledger, measured from installed tarballs (not `src/index.ts`):

| package | exports | star exports |
| --- | --- | --- |
| `@signal-tree/kernel` | 47 | **0** |
| `@signal-tree/kernel/adapter` | 18 | **0** |
| `@signal-tree/angular` | 48 | **0** |

Pre-rewrite the kernel had 66. Reconciled exactly: 33 KEEP + 2 RENAME +
9 INTERNALIZE + 5 DELETE + 17 ruled = 66. (The earlier prose said "18 unresolved"
and "DELETE 4" — both were miscounts in the summary, not gaps in the inventory.)

### The defect the census found

`@signal-tree/angular` did `export * from '@signal-tree/kernel'`, republishing the
kernel's NEUTRAL carrier-sensitive types. An Angular user annotating
`TreeNode<State>` got `WritableCell`, not `WritableSignal` — a carrier lie, even
though `signalTree()` INFERENCE was correct. Patching the two known names would
have left the trap for the next carrier-sensitive type, so the star export is gone
and every name is re-exported deliberately.

    ONE SEMANTIC TYPE AUTHORITY, PACKAGE-SPECIFIC CARRIER BINDING.

Both packages now spell the same concepts identically; only the carrier differs:

    kernel   WritableLeaf<T> -> neutral writable cell
    angular  WritableLeaf<T> -> Angular WritableSignal<T>

### Renames — no compatibility aliases

    CallableWritableSignal -> WritableLeaf   ("callable" described the
                                              representation; "writable" is the
                                              capability a user cares about)
    WithDerived            -> DerivedOf      (`.with()` was removed on purpose)

### Two conflicts the implementation surfaced

- **`TransactionMethods`** was collateral damage of the `PendingTransaction`
  removal. It is a KEEP; restored.
- **`ReadonlyStore` could not be internalized.** `defineStore(..., 'readonly')`
  RETURNS it, so a kept public API would have had an unnameable return type. It
  stays public; the rest of the readonly machinery is internal.

### Verification

    installed type controls        kernel neutral / Angular native   PASS
    Angular TreeNode<S>.count      WritableSignal<number>            PASS (leak fixed)
    kernel -> WritableSignal       REJECTED via @ts-expect-error     PASS
    negative control               every removed name unreachable    PASS
    packed runtime controls        kernel 10/10, Angular 7/7         PASS
    restoration eligibility        both sides                        PASS

Package identity corrected: the kernel no longer describes itself as
"Reactive JSON for Angular".

**RC-HARNESS-3 is NOT closed by this.** Deleting `StorageAdapter` gives it the
right disposition; the stale `size-report` arm that imports a nonexistent
`createIndexedDBAdapter` must still be repaired and the gate rerun.

## ANGULAR-SURFACE-CARRIER-CLOSURE-0 — CLOSED GREEN

The explicit Angular barrel from `e764938d` classified three names as
carrier-INSENSITIVE without proving it. A packed-consumer probe proved five
annotations lied, and following the thread found two more:

    SignalTreeBuilder.destroyed    -> ReadableCell<boolean>
    EntitySignal.empty             -> ReadableCell<boolean>
    EntitySignal.all               -> ReadableCell<Row[]>
    entity field                   -> WritableCell<string>
    entity .asReadonly()           -> ReadableCell<string>
    EntitySignalWithSlices         -> inherited the lie from EntitySignal
    ReadonlyStore                  -> NOT EXPORTED from Angular at all, so the
                                      return of `defineStore(..., 'readonly')`
                                      could not be named; once bound it still
                                      yielded neutral leaves because
                                      `ReadonlyNodeView` hardcoded `ReadableCell`

    INFERENCE BEING CORRECT IS NOT ENOUGH IF A NAMED PUBLIC ANNOTATION CAN LIE.

Fixed by binding the existing semantic authorities — no duplicated type system,
no restored star export. The compiler proved the preregistered condition, so
`/adapter` gained six type-only binders and nothing else:

    EntitySignalOf · EntityNodeOf · EntitySignalWithSlicesOf
    SignalTreeBuilderOf · ReadonlyStoreOf · ReadonlyViewOf

No physical machinery, membership, clocks, subjects, slots or stats crossed.
`ReadonlyNodeView`'s leaf branches now derive `ReadonlyOf<C, V>`; the
`NodeAccessor`-before-`ReadableCell` ordering fix was threaded around, not through.

`DerivedOf` was measured, not assumed: it takes the tree type as a PARAMETER and
mints no leaves, so it PRESERVES whatever carrier the caller supplies —
carrier-insensitive, re-exported without binding.

### Final package-qualified ledger

| package | exports | star |
| --- | --- | --- |
| `@signal-tree/kernel` | 47 | 0 |
| `@signal-tree/kernel/adapter` | 24 | 0 |
| `@signal-tree/angular` | 51 | 0 |
| **total** | **122** | **0** |

    angular carrier-bound names        9 of 9
    angular internals leaked           NONE
    removed names reachable            NONE
    packed type controls               5/5 PASS
    packed runtime  kernel 10/10 · angular 7/7 · Link 4/4
