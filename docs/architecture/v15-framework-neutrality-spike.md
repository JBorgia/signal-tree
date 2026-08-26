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
