# v15 production surface audit

The RC withholds 57 symbols and ships 34. TruckTrax pass 1 proved that a real
consumer needs several of the withheld ones — see
[`trucktrax-rc1-findings.md`](trucktrax-rc1-findings.md). This document decides
what v15 exposes, and it does **not** decide it symbol-by-symbol.

> **The unit of decision is a CAPABILITY, not a symbol.** TruckTrax proves the
> capabilities matter. It does not prove the v13 API shapes are the right v15
> API shapes. Six `loader` call sites are evidence about remote acquisition;
> they are not a vote to re-export `loader()`.

Nothing here changes the public surface. Candidate A stays frozen. Compatibility
exports to get TruckTrax compiling are specifically forbidden — they would
contaminate the experiment by making the old shape the answer before the
question is asked.

## A design rule TH-0 produced

> **Two APIs that can independently restore the same state are not
> automatically composable. If one system interprets the other's restoration as
> a new authored mutation, exposing both creates competing histories rather than
> additional capability.**

This is why `trackHistory` was deleted, and it is a much stronger reason than
"nobody used it". Test it by making the two systems coexist and asking what the
second one records when the first one undoes.

## THE CONVERGENCE — one causal boundary, two directions

A1 and A2 found the same thing from opposite sides. Recorded here because it is
the strongest structural result of the audit so far.

```text
                     EXTERNAL SYSTEMS
              HTTP · resource · storage · adapters
                       │              ▲
              incoming truth     outgoing effect
                       ▼              │
            ┌──────────────────────────────┐
            │   SIGNALTREE CAUSAL SEAM     │
            │  ingress: classify as        │
            │          realization         │
            │  egress:  act only on        │
            │          settled truth       │
            └──────────────┬───────────────┘
                           ▼
                canonical SignalTree state
              identity · transactions · history
```

**A1 / ingress** — "this incoming value is externally acquired truth, not an
authored user action." Without it, a background refresh becomes an undoable turn
and can make a pending transaction unresolvable.

**A2 / egress** — "run this external consequence only once the state is settled
committed truth." Without it, a composed persistence writes speculative
transaction values.

Both already exist internally. Neither is reachable. That is more fundamental
than `loader()` or `stored()` ever were.

### PUBLIC INTENT vs INTERNAL AUTHORITY

PER-0 sharpened this into a two-tier requirement, because the two cases differ
in **who owns the write**:

```text
A1     the CALLER owns the write
       -> a narrow public door is sufficient:
          "apply externally realized truth"

PER-0  the CALLEE owns an ASYNC write
       -> no caller-side wrapper can reach it; the capability must hold the
          classification authority INTERNALLY
```

So Candidate B needs both, and must not solve them with one exposure:

```text
PUBLIC     a small operation expressing one intent
INTERNAL   the write context — causalMode, subject/position metadata,
           transaction interaction, restoration machinery
```

A redesigned `persistence()` uses the internal authority because it owns its
eventual write. An application-driven resource integration uses the constrained
public door because the application owns that write. Exposing the internal
mechanism to serve the first case would hand every consumer authority only the
second case needs.

### ⚠️ One authority does NOT mean one public API

The temptation is `withCausalContext({...})` because both are implemented with
causal metadata. That exposes mechanism, and it is the same mistake as exposing
`withWriteContext` wholesale. The public doors should encode the narrow intents
that earned access — *apply external truth*, *act after committed truth* —
possibly as two APIs over one constrained protocol.

**One causal boundary, possibly multiple intention-specific doors.** Not "one
public primitive" — that is a design step nobody has earned yet.

### And A2 supplies a counterexample to an older MUT result

Earlier MUT work could not prove SignalTree needed a public committed-observation
facility, and that was right at the time. A2 is the first production-backed
counterexample: a composed persistence must act on settled truth and cannot
determine that boundary through the public API.

That does NOT revive `PathNotifier`, `interceptLeafSignals`, or a general
`observeCommittedWrites()`. Handing outsiders a mutation stream is a much larger
claim than *schedule this consequence when the relevant truth is settled* — and
PER-0 must keep alive the possibility that `persistence()` owns the integration
internally and gains scoped selection, in which case **no public egress door is
needed at all**.

## A deletion rule the TH-DEL cascade produced

> **When a rejected public abstraction has private infrastructure whose only
> purpose is to realize that abstraction, the infrastructure inherits the
> deletion unless it independently passes a survival test.**

`createScopedHistoryAuthority` was exactly that: a private history engine built
so `trackHistory` could share the causal machinery, with no other consumer. Kept
"in case", it would have been dead architecture below the waterline — the part
no public-surface audit looks at.

## An experiment-methodology rule, after three false signals

> **A negative probe is valid only after a control proves the mechanism was
> actually exercised.** "Nothing happened" has meant "the harness never reached
> the behaviour" four times in this audit, and never once meant "the product
> lacks the behaviour".
>
> The scheduler case is one instance: **an async probe must wait on the
> scheduler the mechanism under test actually uses.** "Microtasks drained" is
> not evidence of framework, effect or timer quiescence.

Four false defect signals so far. TH-0's undo looked like a no-op because
`trackHistory` records through an Angular `effect`. A2's persistence looked dead
twice because autoSave debounces through `setTimeout` and falls back to a 100ms
poll outside an injection context. And PER-0's restore looked broken because the
fixture hand-wrote a payload shape that `load()` silently ignored — fixed by
seeding from a real `save()` round-trip, which is the control that should have
come first. Each initially read as a product defect. No gate for this; it
belongs in how experiments are run.

## A release rule NGF-DEL produced

> **A gate may not survive merely because its invariant remains philosophically
> true. It must have a live shipped subject and a falsifiable mutation target.**

`angular-compat` was removed under this rule when its last subject was deleted,
with its resurrection condition recorded: reinstate a compatibility-floor gate
whenever a shipped entry point requires an Angular API above the minimum
admitted by its package peer range. A gate that cannot fail is not protection,
it is a false claim of protection.

## Evidence hierarchy

Used to weigh every claim in every dossier below. Higher beats lower.

```text
1. Real production usage          TruckTrax and any other actual consumer
2. Existing SignalTree semantics  identity, ownership, transactions, lifecycle,
                                  entityMap, derived state, capability planning
3. Common application requirements ordinary web-app workflows beyond one product
4. Existing implementation        useful evidence, NOT authority
5. Historical API shape           weakest evidence
```

Levels 4 and 5 are the trap. The RC currently contains capabilities that are
implemented and withheld, and "it is already written" must never become an
argument that an API deserves to exist. v15 should expose the best public
contract even where that means reshaping or deleting working internals.

## API placements to evaluate

Every dossier must consider all of these before selecting one. They are
materially different architectures, and the choice follows **who owns the
behaviour and its lifetime** — not how v13 happened to spell it.

```text
COMPOSITION            form(toWritableSignal(tree.$.profile), schema)
                       — the branch stays ordinary state; another system
                         composes the capability over it. See the forms
                         case study below. Consider this FIRST.
plain helper            helper(tree.$.users)
tree/subtree enhancer   enhance(tree.$.users, ...)
declaration marker      entityMap({ load: ... })
builder over a subtree  createLoader(tree.$.users, ...)
bound controller        const users = loaderFor(tree.$.users)
node feature            tree.$.users.load(...)
derived capability      tree.$.users.derived(...)
external adapter        createSomething(tree, api)
tree-level enhancer     signalTree(state, { enhancers: [...] })
```

## The canonical case study: forms

We have already run this exact audit once, on forms, and the result is the
precedent that should shape every dossier below.

The question was never "should SignalTree own forms". It was "what part of
forms is SignalTree's". The answer:

```text
SignalTree branch                     ordinary state, nothing special
      │  toWritableSignal(...)        ← THE SEAM, and the whole contribution
      ▼
Angular WritableSignal<Model>
      ▼
Angular Signal Forms                  validation, touched, dirty, disabled,
                                      hidden — Angular owns all of it
field writes
      ▼
SignalTree canonical mutations        transactions, rollback, undo/redo,
                                      causal identity
```

`FORM-DEL` (`b57ba293`) then deleted `form()`, `FormSignal`, the marker
machinery, `history()`, and the entire `@signaltree/ng-forms/signals` bridge.
The demos converted `profile: form(...)` to `profile: { name: '', email: '' }`
and **nothing was lost** — `patch({...})` is just the branch call form.

Three things about that outcome matter here.

**`history()` died with the marker because it had exactly one consumer** —
`form({ history })`. A capability whose only caller is another capability is not
a capability.

**`trackHistory()` survived, and the reason is the whole lesson.** It takes a
plain `WritableSignal` and never referenced the marker, so it needed no
rescuing. The compositional thing was already portable; the coupled thing was
not.

**The real fix landed in core, not in the integration.** When the branch adapter
collapsed multiple field writes under the branch's `PositionId`, that was fixed
in subtree-write semantics so descendants keep their own causal positions — which
then paid off for DevTools, adapters, subtree assignment, serialization restore
and bulk patches. The forms work's most valuable output was a core primitive,
not a forms feature.

> **The hypothesis this establishes, and which every dossier must test:
> SignalTree needs to provide a correct seam and correct causal semantics. It
> does not need to own the domain abstraction.**

Note what this does NOT license. It is not "delete everything and tell people to
compose". Signal Forms exists and is good; there was something real to compose
with. Where no such external system exists, composition is not automatically
available and the capability may genuinely belong here.

## Two questions every dossier must answer

Added because of the forms result, and placed before the API-shape question
because they can make it moot:

> **C1. Can this be expressed by composition over an ordinary SignalTree branch,
> the way Angular Signal Forms composes over `toWritableSignal()`?**
>
> **C2. What minimal primitive, if any, is missing from core to make that
> composition CORRECT?**

C2 is the one that pays. With forms the answer was not "write more forms code",
it was "fix subtree ownership semantics". A dossier that answers C1 "yes" and C2
"nothing" is describing a capability that should not be in the public surface at
all.

## Dossier template

Every capability gets the same headings, so the dossiers can be compared and so
the migration guidance can be generated from them mechanically:

business jobs · call sites (site-by-site) · non-TruckTrax use cases · semantic
owner · scope · lifetime · state it must retain · interaction with
transactions / history / entity identity · SSR and browser/native lifecycle ·
possible API shapes · smallest sufficient public surface · rejected
alternatives · v13 migration · tests needed · bundle and capability cost ·
disposition.

## What makes Candidate B different from Candidate A

Not "everything we happened to decide is clean". The bar is:

> **There is no shipped artifact whose existence lacks a completed derivation.**

The existential audits (PER-0, EVT-0, SEC-0) run BEFORE the closure gate, not
inside it. MATRIX-CLOSE deriving whether a package deserves to exist would be
doing architecture during a closure gate — which is how `ng-forms` reached a
tarball in the first place.

## Queue

NGF-0 goes first: it is bounded, already known to be open, and the package would
otherwise ship unjustified. The A3 transactions experiment is high value but it
is a new question, and a new question does not outrank an unfinished one.

```text
NGF-0   does @signaltree/ng-forms exist at all?          DONE — deleted
   ↓
TH-0    generic WritableSignal history                   DONE — deleted
   ↓
A3-0    status vs transactions/operation lifecycle      DONE — stays deleted
   ↓
A1-0    remote acquisition / resource composition       DONE — one seam owed
   ↓
A2-0    persistence + core/storage                       DONE — A2-B
   ↓
A6      EntitySignal.map                                 DONE — no gap, rename
   ↓
PER-0   persistence(): function vs form                  DONE — REDESIGN
   ↓
EVT-0   @signaltree/events                               DONE — recommend DELETE
   ↓
SEC-0   @signaltree/core/security                        DONE — recommend DELETE
   ↓
MATRIX-CLOSE   ← NO ARCHITECTURE. Mechanical reconciliation only.
        every shipped package    -> terminal disposition
        every shipped subpath    -> terminal disposition
        every public capability  -> terminal disposition
        every shipping doc       -> agrees with the ledger
        no deleted/withheld corpse reachable or advertised

        On encountering an UNPROVEN it FAILS. It does not answer it.
   ↓
freeze the Candidate B surface
```

## Register

| id | capability | v13 spelling | status |
| --- | --- | --- | --- |
| **NGF-0** | **does `@signaltree/ng-forms` exist at all?** | whole package | **DELETED — NGF-DEL executed** |
| **TH-0** | **generic `WritableSignal` history** | `trackHistory` | **DELETED — TH-DEL executed** |
| **PER-0** | **does `persistence()` deserve to ship, and in this form?** | `persistence`, `StorageAdapter`, `./storage` | **REDESIGN — function survives, form does not** |
| **EVT-0** | **does `@signaltree/events` exist at all?** | the package and its four entry points | **DELETED — EVT-DEL executed** |
| **SEC-0** | **does `@signaltree/core/security` exist at all?** | the subpath and `security()` | **DELETED — SEC-DEL executed** |
| **HIST-0** | **is history participation whole-tree, or selective?** | `timeTravel()` scope | **CLOSED — HIST-C, operation/turn-scoped eligibility** |
| A1 | remote acquisition / loading | `loader` | **RESOLVED — C1 yes, C2 is one narrow seam** |
| A2 | **durability/persistence, INCLUDING whether `@signaltree/core/storage` exists at all** | `stored`, `flushAllStoredSignals`, the `./storage` subpath | **RESOLVED — A2-B, and one new MATRIX-CLOSE row** |
| A3 | async / status representation | `status` | **RESOLVED — function yes, ownership no** |
| A4+A5 | form integration and its history | `form`, `FormSignal`, `history`, `@signaltree/ng-forms/signals` | **resolved — one consumer, proven path, one gap** |
| A6 | collection projections | `EntitySignal.map` | **RESOLVED — no gap; `asMap` already ships** |
| A7 | tree composition | `.with()` | decided in 15.0 — declarative construction |

---

# NGF-0 — does `@signaltree/ng-forms` deserve to exist?

Run first, ahead of A1–A3, because it is a bounded question the project already
knows it left open. `FORM-DEL` (`b57ba293`) states it plainly: the marker-free
remainder survived the deletion mechanically, and **"this does NOT establish
that `@signaltree/ng-forms` survives architecturally; that remains UNPROVEN
pending its own audit."** v15 currently intends to publish a package whose
existence has never been justified.

> **Hypothesis: if SignalTree were designed today, with Angular Signal Forms
> available and branch composition proven, we would not create
> `@signaltree/ng-forms`.**

The burden of proof is on the package. What follows is an attempt to falsify the
hypothesis, not to confirm it.

## What is actually in there

2,715 lines. Eight runtime exports and about thirteen types.

**Only ONE file imports `@signaltree/core`** — `src/core/ng-forms.ts`, for
`signalTree` plus three types. Everything else is Angular:

```text
createFormTree            ← the ONLY SignalTree-coupled entry point
   ├── createWizardForm       imports createFormTree from '..'
   └── withFormHistory        takes FormTree<T>; reads formTree.form.getRawValue()
                              — undo/redo over an Angular FormGroup.
                              Imports @angular/core and @signaltree/shared only.

ngFormValidators (296 lines)   pure Angular. No SignalTree reference.
SignalValueDirective            takes a plain WritableSignal<unknown>. A
                                ControlValueAccessor. No SignalTree reference.
createVirtualFormArray          form-array convenience.
```

So the package is one SignalTree-coupled function, two helpers that depend on
it, and ~600 lines of Angular utilities that are in a SignalTree package for no
structural reason.

## Falsification attempt 1 — does `createFormTree` need SignalTree?

This is the strongest case available, so it gets the most weight.

`FormTree<T>` genuinely exposes SignalTree to the user:

```ts
export type FormTree<T> = {
  state: TreeNode<T>;
  $: TreeNode<T>;              // a real SignalTree node
  form: TypedFormGroup<T>;     // and a real Angular FormGroup
  …
};
```

Two models over one logical form, kept in step by hand-rolled synchronization.
`FormTreeOptions extends TreeConfig`, so it also accepts a full tree config.

**This does not falsify the hypothesis — it is the clearest instance of the
architecture the project already rejected.** The Signal Forms result was
celebrated for "one shared model, no synchronization copy, no sync loop".
`createFormTree` is the sync loop. Internally it does not even compose over the
caller's tree: it calls `signalTree(hydratedInitialValues, treeConfig)` and
manufactures its *own*, so the application's state is not involved at all.

It also carries `persistKey`, `storage`, `persistDebounceMs` — a second
implementation of A2's persistence capability, inside a forms package.

And it is already **deprecated at runtime**, warning that "its previous
migration target was removed in 15.0; a replacement has not been chosen yet."

## Falsification attempt 2 — is there a missing template seam?

`SignalValueDirective` is the candidate: a `ControlValueAccessor` binding a
signal to an element. Its input type is `WritableSignal<unknown>` — **a plain
Angular signal**. It never touches a tree. It is a generic Angular directive
whose only connection to this project is its `signalTree`-prefixed selector.

No seam is missing. If it is useful, it is useful to Angular users generally.

## Falsification attempt 3 — is there production demand?

**TruckTrax uses none of the surviving surface.** Its single
`@signaltree/ng-forms` import is `signalForm` from the `/signals` subpath, which
FORM-DEL deleted. Zero uses of `createFormTree`, `withFormHistory`,
`createWizardForm`, `ngFormValidators`, `createVirtualFormArray` or the
directives.

The only consumer is this repo's own demo — and that is **circular**, because
`demo-coverage` is a gate requiring every root-barrel export to be demonstrated.
The demo uses the package because the package exists.

## An unrelated defect found while looking

`apps/demo/src/app/boilerplate-metrics.spec.ts` markets a framework comparison —
"SignalTree + ng-forms, 8 lines of code, complexity 2, maintainability 9" —
around this snippet:

The snippet imports `withForms` from the package and passes `withForms()` as an
enhancer. **That symbol has never existed.** It sits inside a template literal,
so nothing compiles it — a metric that argues for the package is built on an API
the package does not have. Same family as the fictional `FormControl.connect()`
already on record.

(The snippet is described rather than quoted here on purpose: `readme-apis`
scans this document too, and quoting the import made this page fail the gate —
which is the gate working. It is also why the defect survives in the spec file:
a template literal is not an import.)

## Result

Every falsification attempt failed, and two of them produced evidence *against*
the package:

| test | outcome |
| --- | --- |
| Does anything need SignalTree semantics? | only `createFormTree`, and it is the rejected two-model sync |
| Is a template seam missing? | no — the directive takes a plain signal |
| Is there production demand? | none; the one consumer is gate-mandated |
| Does the SignalTree-coupled entry point have a future? | it is deprecated with no chosen replacement |

**Disposition: DELETED.** Executed as NGF-DEL. Not tidied — removed.
`createWizardForm` and `withFormHistory` lost their subject with
`createFormTree`; the validators and the directive were Angular utilities that
did not need a SignalTree package.

They were **not re-homed**. Moving them somewhere else because they look useful
would repeat the same mistake one level down: no demonstrated consumer and no
SignalTree ownership means deletion is the default, and git holds them if a
later product need establishes an owner.

### What NGF-DEL removed

The package; its build, publish and release wiring; the demo page, route, nav
entry, home card and documentation entry that existed only to satisfy
`demo-coverage`; the `/signals` jest mapping; the core README's install
instructions and feature section; the `docs/README` row.

Two things went with it that are worth naming.

**The fictional metric is deleted, not annotated.** The
`should measure form integration boilerplate` test scored "SignalTree +
ng-forms - 8 lines, complexity 2, maintainability 9" against Reactive Forms
using a `withForms()` helper that never existed. Its assertions were
`toBeDefined()`, so it could not have failed on a wrong number either way. A
test whose fixture describes a fictional product is not evidence, and correcting
the number would have implied the comparison was otherwise sound.

**The `angular-compat` gate went too, and that needs recording.** Its entire
subject was the `/signals` entry requiring Angular 22 while the main entry had
to stay importable on Angular 20; it checked that the main entry could not
transitively reach Signal Forms. With both entries gone its floors map is empty
and its mutation target does not exist - it could no longer fail, which is the
blind condition this suite rejects. **The invariant is still real and still
general**: an entry point must not reach an API above its own Angular floor. It
has no subject today because no shipped entry declares a floor above its
package's peer range. Re-add it the moment one does.

### Migration

`createFormTree` -> compose. The seam is the shipped part:

```ts
const model = toWritableSignal(tree.$.editForm);
const fields = form(model, schema);   // Angular Signal Forms
```

Undo/redo over that model is **deliberately not documented yet** - that is the
`trackHistory` question, and naming a replacement now would prejudge it. Same
reason `createFormTree`'s deprecation was left de-pointed rather than re-pointed
in `b57ba293`.

`ngFormValidators`, `SignalValueDirective`, `createVirtualFormArray`,
`createWizardForm`, `withFormHistory` -> no replacement. Angular owns
validation; the rest were conveniences with no demonstrated consumer.

### One thing NGF-DEL leaves open

The demo's start-here page had an "I need form / data validation" card pointing
at the deleted route. The card is removed, so the demo now answers that question
nowhere - even though its old copy was already the right answer ("SignalTree
ships no validation API and no form marker. It publishes the model; Angular
observes it"). A compositional forms example is a demo gap, recorded here rather
than invented during a deletion.

---

# TH-0 — should SignalTree publicly own generic `WritableSignal` history?

> **Null: if v15 had never contained form history, would we create a public
> generic `WritableSignal` history utility today?**

Two propositions are kept strictly apart throughout. "This function is useful"
is not "SignalTree should own it" — that conflation is what put `createFormTree`
in a shipped package for years.

## What it is

`trackHistory(model: WritableSignal<T>, options)`, 230 lines, at
`core/src/lib/form-history/form-history.ts:206`. It attaches an Angular `effect`
that records the model's value on every change, and undoes by writing back:

```ts
read:  () => model(),
write: (next) => model.update((m) => ({ ...m, ...next })),
```

A stack of value snapshots and a shallow merge. No causal identity, no subject
lifetimes, no transaction awareness.

## The decisive experiment

Pinned in `track-history-vs-timetravel.spec.ts`. The compositional forms story
wants `trackHistory(toWritableSignal(tree.$.branch))`, so the question is
whether its undo routes back through the canonical mutation path — the way
`timeTravel()` does — or maintains an independent history around the signal.

**It is independent, and the two systems fight.** Over a tree that also has
`timeTravel()`:

| step | result |
| --- | --- |
| `hist.undo()` | value reverts, **and time-travel's history GROWS** |
| `tree.undo()` afterwards | **REDOES the edit** — the model moves forward |
| both after two edits | `hist.canUndo()` and `tree.canUndo()` are both true |

Because the undo is a `model.update(...)`, it is a *new write*. Time-travel
records it as forward motion. An application wiring a single undo button to
either system gets a stack the other one is actively corrupting.

That is exactly the predicted outcome: **two restoration systems representing
the same user operation at different layers.** It is an argument against
publishing both, and it says nothing about the quality of either.

## The fork, and why neither branch lands on "public SignalTree capability"

**Over SignalTree state** — `timeTravel()` already covers it, with canonical
semantics `trackHistory` does not have: subject identity, transaction
interaction, causal position. And as measured, adding `trackHistory` on top
makes undo incorrect rather than richer.

**Over an arbitrary Angular `WritableSignal`** — it works correctly. But that is
precisely the case with no SignalTree involvement at all. As you put it: a
useful generic Angular primitive is not a SignalTree public capability. If
anything, this branch *weakens* the ownership case, because the thing it does
well is the thing that has nothing to do with this library.

## The other questions

**Does anything consume it?** No. Zero call sites in packages, apps, tools or
TruckTrax. Its only appearances are documentation and its own disposition entry.
TruckTrax's forms wrapper used the deleted `history()` marker, never this.

**Is it needed internally?** No. Nothing in core calls it.

**Does it cost anything to use?** It requires an Angular injection context and
the framework scheduler. The first version of the experiment above used
microtasks and saw every undo as a no-op — a defect in the test, but a fair
warning that this is not a plain function.

## Four possibilities

```text
1. DELETE       generic WritableSignal history is not SignalTree's job
2. INTERNALIZE  core needs it, applications do not
3. MOVE/COMPOSE useful, but belongs beside Angular signals
4. KEEP/REDESIGN an independently justified SignalTree capability
```

2 is refuted — nothing internal uses it. 4 is refuted — over SignalTree state
the justified capability is `timeTravel()`, and this conflicts with it. 3 is
possible in principle but has no destination and no consumer asking for one.

**Disposition: DELETED.** Executed as TH-DEL. The old negative — "LC /
mechanically retained" — was wrong about the *reason*, and correcting a reason
does not produce a positive. `trackHistory` survived FORM-DEL because it was
already compositional, which made it a coherent primitive; the audit asked
whether that makes it SignalTree's to publish, and the answer is no on both
branches of the fork.

The decisive evidence is the semantic conflict, not the absence of users. Zero
usage would have been a weak argument — plenty of good APIs start unused. Two
restoration systems that make each other's interpretation of "undo" wrong is a
structural argument, and it would hold even with a thousand consumers.

### What TH-DEL removed, and one cascade

`form-history.ts` and its two specs, including the TH-0 experiment itself: a
spec cannot outlive its subject, and the measurement it produced is recorded
above. `FormHistoryOptions`, `FormHistoryApi` and `FormHistorySharedAuthority`
went with it, orphaned. Both disposition rows are retired — a deleted symbol has
nothing left to withhold.

Then `dead-exports` found a cascade the same run:
`createScopedHistoryAuthority` in `time-travel.ts`, a private
`TimeTravelManager` over a standalone snapshot signal built by `ed09e864` so
form history could share the causal engine. `trackHistory` was its only
consumer. Deleted rather than kept "in case" — a second history engine over a
synthetic one-node tree is precisely the shape TH-0 measured as harmful.

**Consequence for the forms migration.** Undo/redo over a composed form model
would then have no SignalTree answer, which is honest: for a form over a tree
branch, `timeTravel()` is the answer; for a form over a plain Angular signal,
SignalTree is not in the picture. The migration note stays de-pointed either
way.

## A documentation defect found on the way

`docs/overview.md:37` still advertises core's surface as including `status`,
`stored`, `form`, `asyncSource`, `asyncQuery`, `loader()`, `history()`,
`trackHistory()` and `linked()`. Seven of those nine are deleted or withheld.
`readme-apis` did not catch it because the line is prose, not an import — the
same blind spot that let the fictional `withForms()` survive in a template
literal.

**Corrected now**, because it described the shipped product incorrectly. The
general blind spot goes to MATRIX-CLOSE, and it should NOT become an
understand-all-prose gate. The falsifiable shape is narrower:

> take the deleted/withheld names from the disposition ledger, scan live
> shipping docs for them, and allowlist historical and migration contexts
> explicitly.

That is mechanically testable and would have caught this line. The division of
labour is then: `readme-apis` proves syntactically recognisable API references
resolve; the ledger scan proves the docs do not claim deleted or withheld
capabilities exist.

---

# A1-0 — PRE-REGISTERED before the experiment ran

> **Can Angular resource ownership plus an ordinary `entityMap` reproduce a real
> TruckTrax loader site without losing request correctness, entity lifetime
> identity, or SignalTree causal semantics?**

`connectResource()` is NOT being implemented as a candidate API. It is an
experiment-local adapter whose job is to expose what core is missing. The forms
precedent says the valuable result may be the primitive the spike forces us to
discover, not the adapter.

## C2 has three parts, not one

The earlier note guessed "preserve entity identity during replacement". That may
be necessary and is probably not sufficient. Remote acquisition raises three
separable questions:

```text
1. STRUCTURAL IDENTITY
   surviving key   -> same SubjectId / same lifetime
   removed key     -> correctly retired
   reused key later-> a NEW lifetime, never a resurrection

2. SEMANTIC CLASSIFICATION
   a server refresh is ... an authored mutation? a system realization?
   an undoable turn? a transaction participant?

3. REQUEST OWNERSHIP
   params, cancellation, supersession, stale responses — these belong to the
   resource/controller unless evidence says otherwise
```

**Part 2 is the one to attack.** Identity can be perfect while the causal
classification is wrong. If `setAll()` puts a background refresh into
`timeTravel()` as something the user can undo, the missing primitive is not
"loader" — it is closer to *apply externally acquired collection truth, with
entity lifetime preserved and the correct causal classification*. That is a far
more general seam than a loader, and it is the shape the forms work produced.

If current public collection replacement already gets all three right, C2
answers **nothing**, and the whole of `loader` can disappear into composition.

## Cache policy is OUT of the first proof

The 19 production configurations are uniform — `staleTime: '30m'`, `swr`,
`lazy`, `tags` — but carrying that whole vocabulary into the spike would risk
concluding that "composition needs lots of machinery" when the machinery was
imported from the historical API. `tags` in particular has **zero** exercised
invalidation in production.

First question: can remote keyed acquisition compose with an ordinary
`entityMap` at all? Only then, which cache conveniences are genuinely missing.

## What A3-0 already removed from A1's job

Acquisition status does not need designing here. A3-0 established that
operation-lifecycle state is not SignalTree's to own, and that production
already treats collection acquisition and operation lifecycle as separate
concepts. So the boundary under test is:

```text
Angular resource / controller     loading, error, refreshing, request identity
SignalTree entityMap              committed collection truth, subject identity,
                                  structural and causal semantics
```

A3's deletion creates no hole for `loader` to fill.

## The cases

| # | case | tests |
| --- | --- | --- |
| 1 | initial load `[A,B]` | basic external acquisition |
| 2 | refresh `[A',B']`, same keys | surviving subject identity |
| 3 | refresh `[B,C]` | B survives, A retires, C is new |
| 4 | A returns later | key reuse must NOT resurrect A's old subject |
| 5 | params P1 → P2 | who owns clearing and supersession |
| 6 | P1 slow, P2 fast | a stale response must not overwrite a newer scope |
| 7 | refresh with identical values | no false semantic work |
| 8 | `timeTravel()` enabled | does acquisition pollute user history? |
| 9 | pending transaction on a refreshed row | whose truth wins |
| 10 | destroy a route-scoped tree | controller lifecycle terminates |

Case 9 is the one that could force a statement we have been getting for free:
when server truth arrives for a row an unresolved optimistic transaction is
holding, someone must decide. That decision should not be an accident of
`loader`'s implementation.

## Outcomes, pre-registered

```text
C1 yes / C2 nothing
    -> DELETE the loader implementation; document external composition

C1 yes / C2 a small generic collection-truth seam
    -> EXPOSE only that earned primitive; DELETE loader

C1 mostly yes, but keyed remote coordination has coherent reusable
functionality nothing external supplies
    -> consider a first-party controller/helper; still no marker by default

C1 fails: remote acquisition genuinely requires SignalTree-owned semantics
throughout its lifetime
    -> REDESIGN the capability; only then reconsider first-class ownership
```

---

# A1-0 — RESULT

Run with an ordinary `entityMap` and acquisition composed beside it. No
`loader()`, no cache vocabulary. Pinned in `composed-acquisition.spec.ts`.

## C1 — structural identity composes PERFECTLY, with nothing added

| case | result |
| --- | --- |
| 1-2 initial load, then refresh with the same keys | surviving key keeps its `SubjectId`; a reference held across the refresh reads the new value |
| 3 refresh drops A, keeps B, adds C | B's lifetime survives, A retires, C is new |
| 4 A returns later | new lifetime; the reference held before the gap stays `undefined` — no resurrection |
| 7 refresh with identical values | no identity churn |
| 10 destroy, then a late response | does not throw into the acquirer |

Part 1 of C2 — the thing the earlier note guessed was the missing seam — is
**already correct**. `setAll` over an ordinary `entityMap` is a
lifetime-preserving reconciliation, which is exactly what a remote refresh
needs. Nothing has to be added for it.

## C2 — the real gap is SEMANTIC CLASSIFICATION, and the seam already exists

**Case 8.** An untagged refresh is indistinguishable from an authored mutation:
time-travel's history GROWS, and the user's undo reverts *the server's truth* to
a stale client value.

```text
setAll(server rows)   ->  history 2 -> 3,  canUndo() true
tree.undo()           ->  'Ada'  (the pre-refresh client value)
```

**Case 9 is worse, and it is the one that forces a statement.** A refresh
arriving while an optimistic transaction holds the row makes that transaction
**unresolvable**:

```text
untagged:   rollback() THROWS "could not rollback the pending transaction"
            final value = Server, transaction stuck
```

**Case 8b / 9b — both are fixed by classification, and core already has it.**
Time-travel checks `getCausalWriteMode(activeMeta) === 'realization'` and
declines to record. Wrapping the same write:

```ts
withWriteContext({ intent: 'system', causalMode: 'realization' }, () => {
  rows.setAll(serverRows);
});
```

```text
case 8b:  history 2 -> 2,  value applied,  no phantom undo step
case 9b:  rollback() SUCCEEDS, restoring the pre-transaction baseline
```

**`withWriteContext` is not in the shipped barrel.** Nor is `causalMode`. Core
knows how to classify this write; applications have no way to say it. That is
the entire C2 answer, and it is the forms result again: the valuable output of
the spike is a primitive that already exists internally and is unreachable.

Note what 9b's policy actually is — rollback restores the pre-transaction
baseline, so the concurrent server value is discarded. That is arguable. The
point is that it is now a *statable consequence of classification* rather than
an accident: untagged, the same sequence cannot be resolved at all.

## Part 3 — request ownership is correctly external

Cases 5-6. Core has no scope concept: a slow P1 response landing after a P2
scope simply replaces it, because `setAll` applies whatever it is given.

That is right, not a defect. Params, cancellation, supersession and staleness
belong to the resource/controller — which is what Angular's `resource()` already
owns. Composition therefore *requires* a controller; it does not require
SignalTree to grow one.

## Outcome

The pre-registered second row:

```text
C1 yes / C2 a small generic collection-truth seam
    -> EXPOSE only that earned primitive; DELETE loader
```

**`loader` is not needed for correctness.** Everything it provides beyond cache
policy — keyed acquisition into a collection with preserved lifetimes — an
ordinary `entityMap` already does. What is missing is one narrow door.

**What that door should NOT be: `withWriteContext` as-is.** It is
enhancer-author plumbing carrying `intent`, `source`, `causalMode`, `subjectIds`
and `positionIds`; exposing it wholesale would ship a large surface to buy one
sentence. The earned primitive is the sentence: *apply this write as externally
acquired truth rather than as something the user did.* Naming and shape are open
— that is a design step, not a finding.

## What A1-0 does NOT settle

The cache conveniences, deliberately excluded from this spike. 19 production
sites configure `staleTime: '30m'`, `swr`, `lazy` identically, which looks far
more like a default than a feature; `tags` has zero exercised invalidation. Ask
that question *after* the seam exists, and ask it as "which of these is missing
from composition", not "how do we keep loader".

---

# A1 — remote acquisition / loading

## Business jobs

"What needs to load, refresh, cache, invalidate, cancel, retry, merge, and
expose status?"

## Call sites — 19, all identical in shape

Corrected from pass 1, which counted **import** sites (6) rather than call
sites. Every one is declaration-time configuration inside an `entityMap`:

```ts
entityMap<ClearViewCustomerDto, string, { regionUrl: string }>({
  selectId: c => c.customerExternalId as string,
  load: loader(
    ({ regionUrl }) => clearViewService.getCustomers$(regionUrl).pipe(…),
    { staleTime: '30m', swr: true, clearOnParamsChange: true,
      tags: ['clearview', 'customers'], lazy: true },
  ),
})
```

| file | sites | params |
| --- | ---: | --- |
| `scaletrax/…/clearview.state.ts` | 6 | `{ regionUrl }`, `{ regionUrl, customerExternalId }` |
| `scaletrax/…/dispatch.state.ts` | 4 | none, and one `{ … }` filter |
| `trucktrax-geo/…/catalog.state.ts` | 3 | `PlantFilter` |
| `scaletrax/…/v3edge.state.ts` | 2 | none |
| `trucktrax-geo/…/device.state.ts` | 1 | `{ region }` |
| `trucktrax-geo/…/work.state.ts` | 1 | `{ partyMember }` |

**The uniformity is the finding.** Every site without exception uses
`staleTime: '30m'`, `swr: true`, `lazy: true`. The only variation is
`clearOnParamsChange: true`, present on the parameterized ones. This is not six
different jobs wearing one abstraction — it is one job, configured identically
19 times. The default is doing no work: nobody has ever chosen a different
`staleTime`.

The runtime surface actually consumed is two methods on the collection node:

```ts
force ? this._$.orders.refresh(params) : this._$.orders.load(params)
```

## ⚠️ Tags are declared 78 times and invalidated ZERO times

Every site carries `tags: ['domain', 'entity']`. There are four references to
`invalidateTag` in the codebase and **all four are comments** —
`BACKEND-SEAM (Phase-2 · invalidateTag)` — describing what will happen when the
backend starts emitting entity-change events.

So the invalidation half of the cache policy has **no production evidence at
all**, only documented intent. Under the hierarchy that is level 3 (a plausible
application requirement), not level 1. A surface decision that ships `tags`
because "TruckTrax uses them everywhere" would be reading declaration as use.

## Semantic owner and lifetime

The entity collection. Every site attaches the behaviour to one `entityMap`,
parameterized by that collection's own query shape, and the runtime methods hang
off that node. Nothing here is tree-scoped.

## What is NOT owned

Entity identity (`selectId` is separate and stays separate), transaction
rollback, persistent storage.

## Open questions before a disposition

- Is `tags`/`invalidateTag` in the RC surface at all, given zero demonstrated
  use? Shipping an unexercised invalidation vocabulary is how `loader` became
  "UNRESOLVED cache-policy carrier" in the first place.
- Does the uniform `staleTime: '30m', swr, lazy` triple indicate the right
  default rather than the right option? If every consumer writes the same three
  options, they are a default, not configuration.
- RxJS in the contract: every site returns an Observable. Is that the contract,
  or an adapter?
- Cancellation and retry appear nowhere in the evidence. Neither is currently
  demonstrated; do not design for them from imagination.

## C1 / C2

**C1 — can this compose over an ordinary branch?** Plausibly, and this is the
hypothesis to attack first. Angular now ships `resource()`, which is a real
external system to compose with in the way Signal Forms was. A shape like

```ts
const users = connectResource(tree.$.users, resource({ … }));
```

would leave `entityMap` as ordinary keyed state and put acquisition beside the
tree rather than inside its ontology. If that works, `loader` disappears from
the surface entirely and `staleTime`/`swr`/`lazy`/`tags` become someone else's
vocabulary.

**C2 — what would core have to provide?** The seam. For forms it was
`toWritableSignal`; here it is whatever lets an external acquirer replace a
collection's contents *as one causal event* — preserving subject identity for
rows that survive the refresh, so held references, transactions and undo behave.
That is the `setAll`-with-identity question, and it is exactly the kind of core
primitive the forms work produced. **If the answer to C2 is a small identity
contract rather than a loader, that is the better outcome.**

The counter-argument to record: `resource()` is per-value, and these are keyed
collections with parameters. Composition may need more seam than forms did.

**Disposition: NOT TAKEN.** Needs the `connectResource` spike answering C2, plus
non-TruckTrax evidence — at minimum a paginated list, a stale-while-refresh
dashboard, and a route-scoped store.

---

# HIST-0 (HIST-SCOPE) — PRE-REGISTERED before any evidence

Moved AHEAD of PER-B deliberately. A1 and PER-0 put the causal model at the
centre of Candidate B — restore must classify an async incoming write, egress
needs settlement authority, acquisition needs realization classification. All of
that is the same machinery HIST-SCOPE can change. Designing PER-B first would
risk designing it against a causal model this audit then replaces.

> **Null: does one restoration authority require whole-tree participation, or
> can history participation be selective without breaking causal atomicity,
> identity, or restoration semantics?**

Written before looking at production evidence, because PER-0's outcomes were
written after and that was the weakest thing about it.

## Candidate models — all four kept alive

```text
HIST-A  WHOLE TREE        timeTravel owns every authored write; current
                          semantics survive
HIST-B  LOCATION SCOPED   specific branches/collections participate; one
                          authority, selective membership
HIST-C  OPERATION SCOPED  eligibility belongs to the authored operation/turn;
                          an operation is reversible or not, regardless of
                          which branches it touches
HIST-D  BOTH              location sets eligibility/default, operation resolves
                          participation — acceptable ONLY if B and C are each
                          falsified alone
```

`timeTravel({ include: [...] })` and an operation flag are **possible forms, not
findings**. Neither is assumed.

## Constraints this audit may NOT reopen

Both are already evidence-backed:

> **TH-0** — selective history must be selection INSIDE one restoration
> authority, never multiple independent history engines attached to pieces of
> the tree.
>
> **A1** — realization is non-historical regardless of whether its target
> location normally participates in history.

## Cases

| # | case | tests |
| --- | --- | --- |
| 1 | authored write to historical state | history grows; undo restores |
| 2 | authored write to non-historical state | history does not grow |
| 3 | realization into historical state | still does not grow |
| 4 | historical + non-historical in one TURN | what does one undo mean |
| 5 | historical + non-historical in one TRANSACTION | **the model discriminator** |
| 6 | same location: authored edit, then server realization | authored reversible, realization not |
| 7 | entity remove/rekey in a historical collection | SubjectId and restoration guarantees unchanged |
| 8 | undo after unrelated UI mutations | the product edit reverses without rewinding unrelated state |
| 9 | retention | non-participating state must not acquire restoration lifetime merely because `timeTravel()` exists |

**Case 5 is expected to decide location versus operation.** A transaction that
atomically changes `document.content` (historical) and `ui.selectedTab`
(non-historical) forces a choice:

```text
undo reverses only document.content   -> an atomic authored operation is later
                                         PARTIALLY reversed
undo reverses both                    -> ui.selectedTab was historical after
                                         all, despite being declared otherwise
mixed transactions forbidden          -> a significant programming constraint
```

Operation-scoped eligibility may dissolve that, but the experiment has to show
it rather than the design assuming it.

**Case 9 connects to the lifetime work.** If only part of a tree participates,
history must not acquire restoration claims over the rest: no legal restoration
right means no history-owned retention right.

## Deliberately out of scope unless evidence demands it

Two independent undo domains — "undo in editor A" meaning A's last operation
rather than the global last one. That is a history-channels concept, and it
enters only if TruckTrax or another real consumer demonstrates the need.

## Revised execution order

```text
SEC-DEL + STORAGE-DEL          done — one package, one entry point
   ↓
HIST-0                         settle history participation semantics
   ↓
HIST implementation
   ↓
the coalesced-turn P0          fixed ONCE, against the chosen model
   ↓
PER-B                          scoped persistence, settled egress,
                               causally-correct async restore
   ↓
A1 public ingress door
   ↓
pristine rehearsal -> MATRIX-CLOSE -> Candidate B -> TruckTrax 2/3
```

The P0 moves up. It lives in the same restoration machinery, so fixing it before
HIST-0 settles would risk a HIST implementation invalidating part of the repair.

---

# HIST-0 — BASELINE (descriptive, no implementation changed)

Pinned in `hist0-baseline.spec.ts`. What the existing whole-tree authority does
when selective-history requirements are put to it.

## The headline: the mechanics are ALREADY operation-scoped

The hardest semantic target named for this audit — *reverse an operation's own
effects against intervening non-restorable truth, rather than rewinding a
whole-tree snapshot* — **is already met**.

```text
edit title -> 'A'
realization sets body -> 'server-body'     (AFTER the edit)
undo

  snapshot rewind    would give  title 'v1', body 'b1'      server value LOST
  per-turn reversal  gives       title 'v1', body 'server-body'
                                                    ^ measured
```

Restoration reverses the turn's own effects and leaves later non-restorable
truth standing.

**⚠️ My first formulation of this case did not discriminate**, and I nearly
recorded the weaker result as the finding. Placing the intervening writes
*before* the undone operation gives the same answer under both models, because
they are already inside the prior snapshot. Only truth arriving *after*
separates them. Same "control first" lesson as the four earlier false signals,
in a new costume: a case that passes is not automatically a case that tested
anything.

## The nine cases

| # | measured today |
| --- | --- |
| 1-2 | **no notion of a non-historical branch** — a `ui.scrollTop` write and a document edit are indistinguishable; both create turns |
| 3 | a realization into a historical branch does NOT enter history ✓ |
| 5 | a transaction spanning both branches reverses **both**, atomically |
| 7 | entity subject lifetime survives undo — a held reference re-publishes ✓ |
| 9 | UI churn creates history entries; subject claims tracked separately |
| 10a | intervening truth *before* the undone operation survives (does not discriminate) |
| 10b | intervening truth *after* survives — **per-turn reversal confirmed** |

## What this does to the model space

The question is now much narrower than "whole-tree versus selective", because
the restoration MECHANISM is not the whole-tree part. What is whole-tree is
**eligibility**: every authored write becomes a turn, regardless of location.

```text
ELIGIBILITY      whole-tree today          <- the only thing HIST-SCOPE changes
MECHANICS        per-turn effect reversal  <- already operation-scoped
```

So:

**HIST-B (location-scoped)** is a filter on eligibility. Case 5 prices it
exactly: a transaction touching `document.title` and `ui.selectedPanel` today
reverses both. Filtering by location would partially reverse an atomically
authored operation — the first of the three coherent outcomes, and the one that
breaks atomicity during restoration.

**HIST-C (operation-scoped)** fits the mechanics that already exist. If
eligibility belongs to the turn rather than the branch, case 5 has no
contradiction: the operation is reversible or it is not, and all its writes move
together.

**HIST-A** remains the status quo and is not refuted by anything here — it is
merely expensive in eligibility terms, which case 9 is about rather than
correctness.

**HIST-D** still needs B or C to fail alone before it is admissible.

## Cases 4, 6 and 9 — the three the baseline left open

Pinned in `hist0-remaining.spec.ts` (8 tests).

### Case 4 — atomicity is a property of the TURN, not of `transactions()`

```text
tree.$.document.title.set('edited')     same tick, no transaction
tree.$.ui.panel.set('inspector')
-> 1 history entry, and ONE undo reverses BOTH
```

This is the most consequential of the three. Case 5 priced HIST-B using a
`transactions()` boundary, which could be dismissed as an exotic path. It is not
exotic: two ordinary `.set()` calls in the same tick coalesce into one turn.
Location-scoped eligibility would partially reverse atomically authored turns in
**ordinary application code that never opens a transaction** — an event handler
that updates a document field and a UI field is the normal shape of Angular code,
not a corner case.

**HIST-B is now refuted, not merely expensive.**

### Case 6 — ⚠️ A NEW DEFECT, and not a B-versus-C question

```text
title := 'A'          authored
title := 'SERVER'     realization, LATER
undo               -> 'v1'      MEASURED
                   -> 'SERVER'  what correctness requires
```

Control (case 10b's shape): a realization to a *different* leaf **does** survive.
So this is a location-collision defect, not a general failure to respect
realizations. Reproduced identically through the structural path
(`updateOne` on an entity row → reverts to `orig`, discarding `SERVER`).

Per-turn reversal restores the turn's recorded before-value **unconditionally**.
It reverses the right *locations* but never asks whether its recorded
before-value is still authoritative at those locations. The consequence:

> an undo silently discards server state whenever the user's last edit and a
> later server response touched the same location

That is the ordinary optimistic-update collision, not an edge case. It joins the
two pinned P0s as the same class of bug — reversal is per-turn in *what* it
touches but not in *whether* what it recorded still holds.

Redo is consistent with undo: `canRedo()` is true and redo replays `'A'`, not
`'SERVER'`. The realization is absent from both directions. Whatever HIST decides
about later truth has to decide it for redo too — "undo respects later truth but
redo does not" is incoherent.

**This does not discriminate between the models.** It is a defect in the shared
mechanics that HIST-SCOPE merely made visible, and it must be fixed against the
chosen model alongside the coalesced-turn P0.

### Case 9 — the two consequences separate cleanly

Measured on the causal inventories directly, not from a heap probe:

| | authored churn (40 rounds, window 5) | realization churn (40 rounds) |
| --- | --- | --- |
| history entries | bounded by the window | **0** |
| claim owners | ≤ 5 | **0** |
| claimed subjects | tracked | **0** |
| collection correct | yes | yes (control: `ids() === ['g39']`) |

```text
RESTORATION consequence   SATISFIED      no claim, no SubjectId retained for undo
DIAGNOSTIC  consequence   NOT SATISFIED  the write is ABSENT from history, not
                                         "recorded but non-restorable"
```

The restoration half needs **no new machinery** — a non-restorable write already
acquires no restoration ownership. That is the strongest argument for HIST-C:
the property a selective model needs is already achievable through
classification.

The diagnostic half is a different axis. There is exactly one inventory today and
exclusion means erasure. Promising devtools visibility for excluded operations
requires a *second* inventory — new machinery, and exactly the scope HIST-0
should not smuggle in.

## HIST-0 DISPOSITION — **HIST-C, operation/turn-scoped eligibility**

```text
HIST-A  whole-tree authored history      coherent, NOT SELECTED
HIST-B  location-scoped history          REFUTED — breaks causal-turn atomicity
                                         in ordinary same-tick writes (case 4)
HIST-C  operation/turn-scoped            SELECTED
HIST-D  location + operation             NOT ADMITTED — its prerequisite was B or
                                         C failing alone, and B failed
```

The selected model:

```text
CAUSAL TURN
    |
    +- reversible
    |    -> enters restoration history
    |    -> acquires restoration claims
    |    -> existing per-turn reversal machinery
    |
    +- non-reversible
         -> no restoration entry
         -> no restoration claims
         -> ordinary reclamation
```

The expensive half already behaves correctly (case 9). Selective history needs
**no new reclamation mechanism** — it needs an eligibility decision at the
causal-turn boundary.

### What prices the implementation

Verified against HEAD rather than estimated:

```text
history.push(entry)              ONE site, in insertConfirmedTurn()
retainRestorationClaims(entry)   ONE site, in insertConfirmedTurn()
                                 ^ the SAME method, adjacent lines
insertConfirmedTurn callers      2
```

Both consequences of eligibility already flow through a single gate, and the
three existing short-circuits are the identical predicate
(`getCausalWriteMode(meta) === 'realization'`) at the collection notifier, the
leaf interceptor and the root-write path. HIST-C generalises one predicate; it
does not add a mechanism.

### The open half: eligibility is settled, the DOOR is not

HIST-C says where the semantic authority lives. It does not say what the public
API is. The load-bearing fact:

> `withWriteContext` and `getActiveWriteContext` are **not root-exported**.
> `UpdateMetadata` is a type-only export. There is today **no public way for an
> application to classify a write.**

So realization is an internal classification, and HIST-C requires opening a door
that does not currently exist. Candidates, pre-registered before evidence:

```text
HIST-C1  OPT-OUT    authored operations reversible by default; a way to mark an
                    operation non-reversible
HIST-C2  OPT-IN     only designated operations reversible
HIST-C3  DERIVED    eligibility falls out of the existing intent/causal
                    classification; the "new API" is only a public, ergonomic
                    door onto machinery that already exists
```

**A1 convergence to test, not assume.** A1 concluded core needs a narrow
"apply external truth" ingress door. External truth is exactly the
non-reversible class. If those are the same door, C3 is nearly free and the two
audits converge on one public surface. What that would still leave uncovered is
the *authored but non-reversible* case — a UI change the user genuinely caused
but should not be able to undo — which no existing classification expresses.
Whether that case is real is a question for evidence, not for the design.

## HIST-C-DOOR — production evidence, and it is hostile to the obvious design

Top of the evidence hierarchy: what the real consumer actually ships. Two
independent facts from TruckTrax v3, and neither one is what the API design
would have assumed.

### Fact 1 — `timeTravel()` is compiled OUT of production, in all three apps

`apps/{geotrax,scaletrax,trucktrax-geo}` each carry a `debug-enhancers.ts` /
`debug-enhancers.prod.ts` pair swapped by `fileReplacements`, and the prod
variant is deliberately free of any value import from `@signaltree/core` so the
bundler can drop the enhancer. The in-repo comment is explicit about why:

> the whole-tree-clone-per-write enhancer

`packages/store/src/lib/tree-enhancers.ts` goes further and removes the methods
from the static type on purpose:

> Time-travel is driven from the Redux DevTools panel, not from `tree.undo()`.

So in real production usage, whole-tree history is **a development diagnostic,
not a product feature**. No shipped code calls `tree.undo()`.

### Fact 2 — the real product undo was `history()`, scoped to a form model

The only user-facing undo in the consumer is
`packages/signal-forms/src/lib/entity/build-entity-form.ts`:

```ts
import { form as stForm, history, signalTree } from '@signaltree/core';
// ...
history({ capacity: 50 })
```

wired to `canUndo` / `canRedo` / `undo()` / `redo()` in
`entity-store-signal-form-base.ts` and `entity-form.component.ts`.

**Correction to how this was filed.** `trucktrax-rc1-findings.md` lists
`history` absent with 7 call sites under "migration", and FORM-DEL (`b57ba293`)
justified removing it with *"history() had exactly one consumer,
form({ history }), and dies with it."* That was true of the repository and false
of the product: `form({ history })` is precisely the pattern production shipped,
and it was the **only restoration authority that survived to a production
build**. Deleting it was still correct under TH-0 — it was a second independent
history engine attached to a piece of the tree, which is exactly what TH-0
forbids — but it left the real use case with no replacement, and the ledger
recorded it as a migration cost rather than as the loss of the shipped authority.

### What this does to C1 / C2 / C3

```text
HIST-C1  OPT-OUT   REFUTED as the default. It presumes a default-reversible
                   world, and nobody runs one — production ships history
                   nowhere. An opt-out door would be a way to subtract from a
                   default that the only real consumer has already subtracted
                   entirely.

HIST-C2  OPT-IN    SUPPORTED. Both facts point the same way: restoration is
                   wanted for a BOUNDED set of operations (one form model,
                   capacity 50, explicit UI affordance), not for the tree.

HIST-C3  DERIVED   INSUFFICIENT ALONE. A1's ingress door classifies EXTERNAL
                   truth, and that is a genuine convergence worth keeping — but
                   it cannot express "this authored edit is reversible and that
                   authored map-pan is not." The distinction production needs is
                   between two AUTHORED operations, which no existing causal
                   class separates.
```

The earlier open question — *is "authored but non-reversible" real?* — is
answered, but inverted. It is not that a few authored operations need excluding;
it is that **almost all of them are already excluded in practice**, and the
reversible ones are the small, deliberately designated set.

### The demand, stated as production states it

```text
bounded product undo      scoped to what the user is editing, shipped
cheap whole-tree observability   dev-time, currently paid for with a
                                 clone-per-write enhancer that gets compiled out
```

That is HIST-C2 plus DIAG-JOURNAL, and it is worth noting that these two items
are the ones with real demand behind them. HIST-C's value is not "selective
history is faster"; it is that **opt-in eligibility restores the deleted
`history()` use case inside the single authority TH-0 requires**, instead of as a
second engine bolted to a subtree.

### One honest limit on this evidence

The stated reason for compiling `timeTravel()` out is *cost*, not semantics — and
a note records that the runtime gate never actually fired (DEV-2367), so
production builds were running the enhancer for some time without functional
complaint. So Fact 1 is strong evidence about cost and only suggestive about
eligibility preference. **Fact 2 is the load-bearing one**: a deliberately
scoped, capacity-bounded, UI-wired undo is a semantics choice, not a cost
workaround. Even a free whole-tree history would not make it correct for the
undo button to revert a map pan.

# RESTORE-P0 — the reversal-validity cluster

Grouped because they are one defect family, not three bugs: **the recorded
inverse is valid at capture time, but unconditional replay later can violate
intervening state.** The engine knows *what effect belonged to the authored
operation*; what it does not ask is *is this authored effect still causally
applicable to the current truth?*

```text
P0-A  same-turn setAll/remove structural reversal
P0-B  same-family structural rekey/remove reversal
P0-C  a later realization to the same location is overwritten by undo
        scalar reproduction        pinned
        structural/entity repro    pinned
```

Fixed **once, after HIST-C's eligibility model is installed**, so the repair is
made against the final causal model rather than one HIST then replaces.

Constraints the fix must satisfy:

```text
PRESERVE 10b   a later realization to an UNRELATED location still survives undo
PIN REDO       redo semantics after supersession decided explicitly, not left to
               fall out — "undo respects later truth but redo does not" is
               incoherent, and today both ignore it symmetrically
```

# DIAG-JOURNAL — pre-registered before evidence

HIST-C makes a non-reversible authored operation correctly absent from
restoration history — and therefore, today, absent from diagnostics too, because
there is exactly one inventory. That violates the observability/restoration
distinction this audit established, so it is a v15 item rather than a deferral.

> **Null: can DevTools observe every causal turn without that observation
> becoming another restoration authority or retention owner?**

The failure mode to be hostile to is a re-run of TH-0 one layer down:

```text
NOT THIS:   restoration history #1
            diagnostic history #2 WITH REPLAY      <- a second undo authority
```

The diagnostic side must be **observational**. The classes it should surface:

```text
authored reversible
authored non-reversible
realization
transaction begin / confirm / reject
restoration
```

All visible; only the first necessarily owns restoration lifetime. Whether the
form is a bounded causal journal, an event feed, a serialized projection, or
something smaller is a separate derivation — and the smallest thing that
satisfies the null wins.

## Revised execution order

```text
HIST-0                  CLOSED — HIST-C
   |
HIST-C implementation   operation/turn restoration eligibility; one restoration
                        authority; no location-scoped partial reversal; excluded
                        operations acquire no restoration claims
   |
RESTORE-P0              P0-A, P0-B, P0-C fixed once against the final model;
                        preserve 10b; pin redo
   |
DIAG-JOURNAL            whole-tree developer observability, no restoration
                        ownership, no accidental second undo authority
   |
PER-B                   scoped persistence, causally-correct async restore,
                        settled-only egress
   |
A1 public ingress seam  narrow external-truth write intent
   |
pristine rehearsal -> MATRIX-CLOSE -> Candidate B -> TruckTrax 2/3
```

DIAG-JOURNAL sits before PER-B because it is still part of settling the causal
architecture. Persistence and acquisition should plug into a causal model whose
restoration *and* diagnostic projections are both known.

## What HIST-C actually buys

Not "historical operations are dramatically faster." The real claim:

> **operations that are not reversible stop acquiring restoration cost at all**

Case 9 shows the engine already knows how to do this. The remaining work is
making the distinction available to ordinary authored operations rather than only
to internal causal classes like realization.

The level shift is smaller internally than feared and larger architecturally:
**one causal stream, operation-scoped restoration eligibility, one restoration
authority, and a separate whole-tree diagnostic projection that carries
observation without restoration ownership.**


# SEC-0 — `@signaltree/core/security`

> **Null: if `./security` did not exist, what SignalTree correctness property
> would become impossible for an application to implement through ordinary
> composition?**

335 lines, **zero imports of anything SignalTree**. It offers three protections
through a construction-time `security()` feature. Each was measured; pinned in
`sec0-is-it-redundant.spec.ts`.

## 1. Prototype pollution — core already stops the real attack, unaided

```text
signalTree(JSON.parse('{"a":1,"__proto__":{"polluted":true}}'))   // NO security()
  -> snapshot keys ["a"],  Object.prototype NOT polluted
```

The actual vector is handled unconditionally by core. What `security()` adds is
blocking `constructor` and `prototype` as *literal data keys* — which are
harmless own-properties on a plain object, and which real data contains:

```text
signalTree({ constructor: 'Acme Constructor Co' }, { security: security(...) })
  -> THROWS: Dangerous key "constructor" is not allowed
```

So on this protection the feature is **strictly worse than core alone**: it adds
no defence against the real attack and rejects legitimate data.

## 2. ⚠️ preventXSS is INERT — a live defect

```text
SecurityValidator.validateValue('<script>alert(1)</script>hi')  -> "hi"        ✓
via security() at construction                                  -> unchanged   ✗
via security() on a later write                                 -> unchanged   ✗
```

`validateValue()` RETURNS the sanitised string. The `security()` walk calls it
for its throw behaviour and **discards the return value**. The walk also runs
only at construction, so writes after that are never examined at all.

This is worse than a no-op. A consumer who enables `preventXSS: true` may
reasonably believe stored values are sanitised, and nothing tells them
otherwise. It is the security-theater failure mode: an API implying a boundary
it does not enforce.

**And fixing the bug would not make it right.** Sanitising on the way INTO state
is the wrong boundary — it corrupts data (a bio that legitimately discusses the
`<script>` tag) while failing to protect the rendering sink, which is where XSS
is actually decided and which Angular already escapes by default.

## 3. preventFunctions — serializability, not security

Blocking function values keeps state serialisable. That is a real concern and it
is hygiene, not a security boundary. Core accepts functions today without it.

## Ownership, consumers, form

**SignalTree semantics: none.** No dependence on identity, causal writes,
transactions, restoration, subject lifetime or tree lifecycle. It is a recursive
object walk with a regex.

**Consumers: its own specs.** Nothing in packages, apps or tools. TruckTrax's
`core/security/` hits are its own unrelated folder.

**Form: a public subpath** for a feature nobody imports.

## Outcomes, pre-registered

```text
SEC-A  no SignalTree-owned function            -> DELETE ./security
SEC-B  useful but generic/application-owned    -> DELETE from SignalTree
SEC-C  a narrow semantic primitive survives    -> move to root, delete subpath
SEC-D  substantial owned capability + isolation justified -> KEEP
```

**Result: SEC-A.** There is no function here that composition cannot do, and two
of the three protections are actively wrong — one rejects legitimate data while
adding nothing, the other claims a protection it does not deliver.

## Recommended disposition

**DELETED.** Executed as SEC-DEL, with more urgency than the other deletions — not because the code is unused,
but because the inert `preventXSS` is a false assurance that ships today.

Keep core's own prototype-pollution handling, which is where the real defence
already lives and which is independently covered by
`apply-state-pollution.spec.ts`.

If any of it is kept instead, the `preventXSS` defect must be fixed or the
option removed in the same change. Shipping an advertised protection that does
nothing is the one outcome that is worse than either.

---

# EVT-0 — `@signaltree/events` and its four entry points

> **Null: if `@signaltree/events` did not exist, would v15 create this package
> and each of its four entry points today?**

Four surfaces audited separately, so that one valid adapter cannot entail the
package or its siblings.

## The structural finding, and it is stronger than NGF-0's

**6,381 lines. Zero imports of `@signaltree/core`. Anywhere.**

```text
core     1,836 lines    0 imports
angular  1,432 lines    0 imports
nestjs   1,756 lines    0 imports
testing  1,357 lines    0 imports
```

Every apparent match is a docstring. `ng-forms` at least had one file that
imported core; this package has none.

The single surface that touches entity state does so **deliberately without the
import**:

```ts
/**
 * The minimal read/write surface `applyOptimisticEntityChange` needs from an
 * entityMap collection. A real `@signaltree/core` `EntitySignal<E, K>`
 * satisfies this structurally — no import from `@signaltree/core` required.
 */
export interface EntitySnapshotAccessor<E, K> {
  readonly asMap: Signal<ReadonlyMap<K, E>>;
  upsertOne(entity: E): K;
  removeOne(id: K): void;
}
```

That is a well-written duck type. It is also an admission: the coupling is a
shape, not a dependency, and any object with three methods satisfies it.

## It declares a required peer it never uses

```json
"peerDependencies": { "@signaltree/core": "^15.0.0-rc.1", … }
```

Installing `@signaltree/events` obliges a consumer to install
`@signaltree/core`, for a package that imports nothing from it. That is a defect
independent of the survival question, and it is the kind of thing only a
package-level audit finds.

## Production evidence: zero

TruckTrax uses **none** of it — not the root, not any subpath. The demo has an
events page and two cards, which is `demo-coverage` doing what it is told. Same
circular evidence as `ng-forms`.

## Per surface

**`core` (1,836 lines)** — a typed event toolkit: factory, zod schemas,
registry, validation, idempotency, error classification. Requires no SignalTree
semantics. Composable from ordinary code plus zod. Useful; not owned.

**`/angular` (1,432 lines)** — and this one is worse than merely unowned.
`OptimisticUpdateManager` has **zero references to transactions**, and its
rollback is a caller-supplied closure:

```ts
rollback: () => store.$.trade.status.set('pending'),
```

That is a WRITE, not a reversal — so under `timeTravel()` it becomes a new
authored turn, and under `transactions()` it is a second, competing
optimistic-mutation authority. TH-0's rule applies directly:

> Two APIs that can independently restore the same state are not automatically
> composable.

A3 already established that `transactions()` is SignalTree's optimistic-mutation
authority. Shipping a second one, in a sibling package, that does not know the
first exists, is the `trackHistory` situation again — discovered before release
rather than after.

**`/nestjs` (1,756 lines)** — bullmq, dead-letter queues, decorators, a Nest
module and service. **Server-side Node code in a client-side signal state
library.** There is no SignalTree question here to answer; the surface has no
relationship to the product at all.

**`/testing` (1,357 lines)** — assertions, factories and helpers for the events
package. Its survival is entirely downstream of the package's.

## Recommended disposition

**DELETE `@signaltree/events`.** It fails the NGF-0 test more decisively than
`ng-forms` did: no code coupling at all, no production consumer, a peer
dependency it does not use, a backend subpath unrelated to the product, and an
Angular subpath that duplicates an authority core already owns and would
actively fight.

The event-bus toolkit may be genuinely good. That is not the question NGF-0
settled — **useful is not owned**, and a package with zero imports of the
library it is named after has no ownership claim to make.

**Disposition: DELETED.** Executed as EVT-DEL. Nothing was re-homed, for the
same reason nothing was re-homed from ng-forms.

The shipped topology is now **`@signaltree/core` alone**, which makes the
"one package, one tree" story literal. Its remaining subpaths — `./security`
and `./storage` — are the entire companion surface, and both are under audit
(SEC-0, and PER-0 which put `./storage` on death row unless independently
earned).

Two demo specs were made package-agnostic on the way out. One named `events`;
an earlier version of the same test named `ng-forms` and broke when THAT was
deleted. A test about selection-to-fetch wiring should not be a hostage of the
package list — and with a single package left, `expectOne` also had to become
`match`, because the constructor already fetched the only README there is.

---

# PER-0 — `persistence()`, the `StorageAdapter` contract, and the `./storage` subpath

Opened by A2, which found that `./storage` exists to serve `persistence()` and
that `persistence()` had never been audited. Three artifacts, three separate
questions, deliberately not answered together.

## `persistence()` — the function survives; the form does not

**FUNCTION: needed.** TruckTrax persists three scalar leaves. That demand is
real and predates this API.

**SIGNALTREE-SPECIFIC: yes, and this is what separates it from `ng-forms`.**
A2 measured it: `persistence()` withholds speculative transaction state and
re-arms on settlement, via `scheduleDurableConsequence`. A generic storage
effect cannot know *"this value exists physically but is not yet eligible to
escape as a durable consequence"* — SignalTree can. That is a genuine ownership
claim, not merely working code.

**CURRENT FORM: cannot express the one production need we have evidence for.**
Measured, not inferred:

```text
scoping      persists the WHOLE tree — the payload provably contains a leaf
             explicitly marked do-not-persist
instances    a second persistence() is REFUSED at construction:
             "enhancer 'persistence' is configured 2 times; each enhancer may
              appear once"
selection    no `select`, `include`, `exclude` or path option exists
```

So there is no way — not by configuration, not by using two instances — to say
"persist these three leaves and nothing else". TruckTrax's tree holds entity
collections and scratch state that must not become durable.

**CONSUMERS: zero.** Not used by TruckTrax, not used by any package. The demo
has a persistence page, and that is `demo-coverage` doing what it is told —
circular by NGF-0's reasoning, exactly as it was for `ng-forms`.

**Disposition: REDESIGN.** Not KEEP: the shipped form cannot serve the only
demonstrated need. Not DELETE: the settlement semantics are a real
SignalTree-owned capability that no composition can currently reproduce.

The open design question is the one A2 named, and PER-0 does not settle it:

```text
Option A   expose a public settlement seam; persistence composes outside
Option B   first-party persistence keeps the internal authority and gains
           scoped selection; no public egress door
Option C   something smaller, not yet derived
```

Option B is the one this evidence makes cheapest — the capability already
exists and only lacks selection — but "cheapest" is not "earned", and A and C
have not been attempted.

## `StorageAdapter` — the contract survives whatever persistence becomes

Any durability capability needs a storage abstraction, and this one is three
methods. It is a type: zero runtime cost, and it can live in the main barrel.
Note that today it does NOT — `PersistenceConfig.storage?: StorageAdapter` is
part of a public enhancer's contract while the type is reachable only from a
subpath.

## `createStorageAdapter` / `createIndexedDBAdapter` — unproven

**Consumers: the enhancer's own specs, and nothing else.** No application, no
demo, no package. 108 lines of generic key/value plumbing with zero imports and
no SignalTree semantics of any kind.

By NGF-0's rule that is a deletion by default: useful-looking code with no
demonstrated consumer and no ownership claim. `localStorage` already satisfies
the contract without a factory, and an IndexedDB adapter is a thing an
application writes once against a three-method interface.

## `./storage` — the subpath is unproven independently of all of the above

The correction A2 needed: the CONTRACT being entailed does not entail the
PACKAGE. If the implementations go and only the type survives, the type belongs
in the main barrel and the subpath has nothing left to ship.

```text
persistence redesigned · contract in main barrel · impls deleted
    -> DELETE ./storage

impls independently earn themselves (no current evidence)
    -> ./storage survives
```

## Restore is the OTHER direction, and it is NOT handled

A2 measured egress and found it correct. PER-0 measured ingress and found it is
not. Pinned in `per0-restore-semantics.spec.ts`.

**Hydrating persisted truth creates an undoable user turn.**

```text
autoLoad restores 'PERSISTED'   history 1 -> 2,  canUndo() true
tree.undo()                     -> 'default'
```

The first undo a user presses throws away their saved settings and reverts to
the code default. This is A1's ingress problem again, and arguably worse,
because it happens at startup on every session rather than on a background
poll.

**An explicit `load()` mid-transaction silently redefines rollback.**

```text
transaction sets 'OPTIMISTIC'
load()            -> 'PERSISTED'
rollback()        -> succeeds, and lands on 'PERSISTED'
```

Rollback should restore the pre-transaction baseline, which was `'default'`.
The load moved the baseline. No error, no refusal — the transaction's meaning
changed underneath it.

## And the ingress seam as it exists CANNOT fix this

The obvious move is A1's wrapper. It does not work:

```ts
await withWriteContext({ intent: 'system', causalMode: 'realization' },
  () => tree.load());
// history STILL grows 1 -> 2, canUndo() still true
```

`withWriteContext` is **synchronously scoped**. `load()` is async: the context
is established and torn down before the storage read resolves, so the writes
land outside it. A1's case worked only because `setAll()` was synchronous
inside the wrapper.

**So the classification must wrap the WRITE, not the OPERATION** — and for an
API that owns its own write, only the callee can do that. No caller-side
wrapper can classify `persistence().load()`.

That is a genuine constraint on the shape of the eventual ingress door, and it
was invisible from A1 alone, where the application happened to own the write.

## Persistence uses BOTH directions — and implements one

```text
storage -> tree    incoming durable truth       NOT classified  ✗
tree -> storage    outgoing durable consequence settled-only    ✓
```

That makes `persistence()` half a reference implementation of the causal
boundary. The half it gets right, it gets right in a way no composition can
currently reproduce; the half it gets wrong, it gets wrong in a way no caller
can currently correct.

## Outcome space

Recorded here for completeness, and with a methodological admission: **unlike
A1, A2 and A3, PER-0's outcomes were written down AFTER its evidence.** The
conclusion is not weakened by that — it is falsification-shaped and the
measurements are pinned — but the ordering was worse, and the discipline exists
because post-hoc outcome spaces tend to fit the result.

```text
PER-A  the current whole-tree enhancer is already the minimum correct form
PER-B  the function survives, the form does not -> redesign with scoped
       selection; keep only the required contract; likely delete ./storage
PER-C  the same correctness composes externally through one smaller seam
       -> delete persistence(), expose only that seam
PER-D  responsibilities survive separately -> split
```

**Result: PER-B**, and the restore finding hardens it. PER-A is refuted twice
over — the form cannot scope, and it mishandles ingress. PER-C is refuted by the
synchronous-scope constraint: an external composition cannot classify an async
restore it does not own, so deleting `persistence()` and exposing a seam would
leave restore incorrect in every composition.

## A semantic decision Candidate B must make explicitly

There are now two external-truth/transaction interactions, and they differ:

```text
A1 realization arrives mid-transaction
   rollback -> pre-transaction baseline; the realization is discarded

PER-0 load() arrives mid-transaction
   rollback -> the LOADED value; the baseline moved silently
```

The second is unacceptable because it arises from an unclassified mutation, not
from a decision. But fixing the classification does not by itself choose the
policy. Candidate B must state which:

```text
reject or defer a load while a transaction is unsettled
apply it as a realization with A1's defined semantics
```

PER-0 proves only that today's silent baseline mutation cannot remain.

## What PER-0 hands to Candidate B

**`persistence()` cannot ship in its current form.** It cannot scope, and it
creates an undoable turn out of the user's own saved settings.

Either it is redesigned before the RC, or 15.0 ships without a first-party
durability capability — and applications cannot correctly compose one, because
the egress seam is internal AND the ingress classification is impossible from
outside for an async restore.

Those are linked, and together they are the sharpest constraint the audit has
produced. Shipping neither would leave durability strictly worse than v13, where
`stored()` at least existed and at least worked.

---

# A2-0 — PRE-REGISTERED before the experiment ran

The existing words are refused. Not "how should `stored()` and `./storage`
cooperate" — that question smuggles in the answer. Derive the function first.

> **Null: does SignalTree need to own persistence, or does it only need enough
> committed-state and lifecycle semantics for a persistence system to compose
> correctly?**

## Four jobs, each with its own owner question

```text
1. RESTORE    obtain the persisted value when state is established
2. PUBLISH    committed application truth becomes durable
3. DRAIN      the host says "you may stop now; finish outstanding work"
4. MECHANISM  localStorage / IndexedDB / custom adapter / platform storage
```

The drain is the falsifier that prevents the glib answer
`effect(() => localStorage.setItem(...))`. TruckTrax already proved a
browser-only design is wrong: the Capacitor host knows the app is backgrounding,
and `pagehide` never fires. Composition must stay **host-drainable**.

## Discriminators

| # | case | question |
| --- | --- | --- |
| 1 | hydrate a scalar | can external storage establish initial truth without creating bogus authored history? |
| 2 | normal write | does persistence observe the settled value, or intermediate physical writes? |
| 3 | transaction rollback | is the rolled-back intermediate value ever persisted? |
| 4 | time-travel undo | is restored state meant to become durable, and when? |
| 5 | debounce + immediate background | can the host force the latest value durable when lifecycle hooks never fire? |
| 6 | storage write failure | who owns the error; does state stay authoritative? |
| 7 | destroy with a pending write | drain, cancel, or an explicit host decision? |
| 8 | SSR / no storage platform | can the tree exist without a storage implementation? |
| 9 | multiple persisted leaves | does one drain require a tree-wide registry? |
| 10 | custom adapter | does `./storage` provide anything SignalTree-specific beyond a key/value adapter? |

**Case 3 may be A2's version of A1's discovery.** Persistence should be a
consequence of *committed* truth. If the mechanism sees private intermediate
transaction writes, that is a missing semantic seam of the same family as
causal classification. If it already observes only settled truth, that is
evidence against needing a marker at all.

**Case 5 may expose a different seam** — host lifecycle reaching a persistence
coordinator's `flush()`. That does not imply a global
`flushAllStoredSignals()`; it may only mean the composition object owes its host
a drain operation.

## `./storage` is audited independently, inside this one

For every export — `createStorageAdapter`, `createIndexedDBAdapter` — ask
whether it requires SignalTree state semantics, causal semantics, identity or
lifecycle, or whether it is generic storage plumbing. **Usefulness does not save
a subpath.** NGF-0 settled that.

## Outcomes, pre-registered

```text
A2-A  ordinary state + external persistence works, no missing seam
      -> stored dies, flushAllStoredSignals dies, ./storage likely dies

A2-B  composition works but needs one narrow post-commit / lifecycle seam
      -> expose only that earned primitive; the old ontology still dies

A2-C  persistence genuinely requires SignalTree-owned coordination across
      committed truth and lifecycle
      -> redesign a first-party capability, then decide where ./storage belongs
```

B is the recurring pattern from forms, TH-0, A3 and A1. That is a reason to test
it hard, not a reason to expect it.

---

# A2-0 — RESULT

The subject turned out not to be `stored()`. **`stored` is withheld;
`persistence()` is what actually ships**, so the audit characterised that.
Pinned in `a2-persistence-discriminators.spec.ts`.

## The four jobs are all covered — for whole-tree persistence

| job | shipped `persistence()` |
| --- | --- |
| RESTORE | `autoLoad` on construction, `load()` |
| PUBLISH | debounced autoSave |
| DRAIN | **public `save()`** — plus `__flushAutoSave` |
| MECHANISM | `StorageAdapter`, defaulting to `window.localStorage` |

**Case 5 — the drain works, and needs no global function.** With
`debounceMs: 5000` a write persists nothing; `await tree.save()` writes
immediately. That is exactly what the Capacitor background handler needs, and
it is a method on the thing that owns the behaviour rather than a
`flushAllStoredSignals()` reaching across the whole library.

## Case 3 — the predicted seam is ALREADY CLOSED, and that is the interesting part

Persistence should be a consequence of committed truth. Measured: an optimistic
transaction value is **never written**. Zero writes contain it; one write
happens, after settlement, with the rolled-back value.

The implementation says why, and names the same defect this audit was chasing:

> autoSave serializes the WHOLE tree, so a snapshot taken while an explicit
> transaction is open would persist speculative state — *the same defect
> `stored()` had, reached through a different API*.

It defers by asking whether the tree has an unsettled scope, and re-arms on
settlement, via `scheduleDurableConsequence`.

## But that coordinator is INTERNAL — and that is the A2-B seam

`scheduleDurableConsequence` and `cancelDurableConsequence` are not in the
shipped barrel. Neither is `getActiveWriteContext`.

So a **composed** persistence — ordinary state plus an adapter, which is what
scoped persistence would be — cannot reproduce case 3's correctness. A naive
`effect(() => write(tree.$.prefs()))` persists speculative transaction values,
because there is no public way to ask "is this committed truth yet?".

**This is the same shape as A1's finding, and they may be one seam.** A1 needs
*classify this incoming write as realization rather than authored action*; A2
needs *run this outgoing side effect only on committed truth*. Both are about
the causal status of a write crossing the boundary to an external system, and
both already exist internally.

## Case 9 — the real gap against production is SCOPING

`persistence()` writes the whole tree: the payload provably contains transient
state that must not be durable. TruckTrax needs three scoped leaves out of a
tree that also holds entity collections and scratch state.

Scoping itself is not a SignalTree semantic — reading `tree.$.prefs()` and
writing it is ordinary composition. What composition cannot currently do is the
commit-settlement part above.

## Case 8 — persistence does not degrade

With no `window`, `persistence()` **throws at construction**. A tree carrying it
cannot be built on a platform without storage. Recorded as a characteristic, not
judged here.

## `./storage`

108 lines, **zero imports**, pure generic key/value plumbing: `StorageAdapter`,
`createStorageAdapter`, `createIndexedDBAdapter`. Nothing about it needs
SignalTree state, causal semantics, identity or lifecycle.

By NGF-0's rule that would be enough to delete it — except that it is the
**adapter door for the public `persistence()` enhancer**, whose config takes a
`StorageAdapter` that the main barrel does not export. So `./storage` is not
free-floating utility code; it is the only way to configure a shipped
capability.

**CORRECTION — the CONTRACT may be entailed; the SUBPATH is not.** Saying
"`./storage` survives if `persistence()` survives" repeats NGF-0's error one
level up, at packaging instead of function. If `persistence()` survives, what is
entailed is the `StorageAdapter` *contract*; the generic implementations and the
subpath that ships them are independently unproven. Both of these remain open:

```text
persistence() survives · StorageAdapter survives · generic impls do NOT
    -> export the tiny contract from core, DELETE ./storage

persistence() survives · SignalTree-specific storage impls earn themselves
    -> ./storage survives
```

So: **`./storage`'s current reason for existence depends on `persistence()`, but
its packaging and its generic implementations remain independently unproven.**
`persistence()` has never been audited either — a new row, and the same hole
NGF-0 found: a shipped artifact whose existence nobody proved.

## Disposition

**A2-B.** `stored` and `flushAllStoredSignals` stay deleted — the shipped
enhancer already does RESTORE, PUBLISH, DRAIN and MECHANISM, and does the
transaction case *better* than `stored()` did. The earned seam is:

> a public way to run a durable consequence only on committed truth

which is very likely the same primitive A1 needs, seen from the other side.

Deferred to MATRIX-CLOSE: **PER-0 — does `persistence()` itself deserve to
ship?**, with `./storage` inheriting the answer. Scoped persistence, which is
what production actually needs, is composition over ordinary state plus that
seam — but whether the whole-tree enhancer earns its place is a separate
question this audit did not ask.

---

# A2 — persistence / stored state

## Business jobs

"What state survives reload, when is it written, who owns flushing, migration,
failure, teardown?"

## Call sites — 3 leaves, 1 drain

```ts
// driver-config.state.ts — the whole of the persistence surface in production
haulerId: stored(`haulerId-${envSuffix}`, null as Nullable<number>),
truckId:  stored(`truckId-${envSuffix}`,  null as Nullable<number>),
```

Plus one `stored()` boolean flag in `app.resolvers.ts`. That is the entire
demonstrated use: **three localStorage-backed scalar leaves with env-scoped
keys.** No collections, no migrations, no IndexedDB, no failure handling.

The `stored` disposition — "NOT EARNED as RC public API" — is about a marker
carrying a large surface (`StoredOptions`, `MigrationFn`, `StoredErrorContext`,
`StoredReloadResult`, `createStorageKeys`, `clearStoragePrefix`). The production
evidence justifies a fraction of that.

## The drain is one call, and it is not `pagehide`

```ts
// background-mode.service.ts — the ONLY production call
App.addListener('appStateChange', ({ isActive }) => {
  if (!isActive) {
    flushAllStoredSignals();   // beat the ~100ms debounce window
  }
});
```

This confirms the hypothesis that `flushAllStoredSignals` is a shutdown drain
rather than a general-purpose API — and it adds a constraint that a
browser-only design would miss. **This is Capacitor on Android.** `pagehide`
does not fire when a native app backgrounds. A persistence capability that
owns its own lifecycle via `pagehide`/`visibilitychange` would silently lose
the last write on exactly the platform this consumer ships.

So the requirement is not "expose a global flush function". It is: *the
persistence capability must be drainable by a host that knows something the web
platform cannot tell it.* That could be a method on the capability, a
tree-level `flush()`, or a registered lifecycle adapter — but it cannot be an
internal `pagehide` listener alone.

## Semantic owner and lifetime

The individual leaf owns its key and value. The DRAIN is tree-scoped or
capability-scoped, because the host calls it once for everything.

## Open questions before a disposition

- Is the debounce (~100ms) part of the contract? The drain exists only because
  of it.
- Does anything need persisted *collections*, or only scalar leaves? No
  production evidence for collections.
- Migration (`MigrationFn`) has zero production use. Same question as `tags`.
- Interaction with `stored()` traversal invisibility (a known core defect where
  nested markers leak raw markers into `tree()`) — a re-exported `stored` must
  not re-expose that.

## C1 / C2

**C1** — persistence over three scalar leaves is close to trivially
compositional: read once at construction, subscribe, write debounced. The
awkward part is not the storing, it is the DRAIN, which is inherently a
lifecycle concern the branch cannot own.

**C2** — a way for a host to say "everything is about to stop", reaching every
persisted leaf. That is a tree-level or capability-level lifecycle hook, not a
marker feature. Note the forms lesson applies literally here: `stored()` changes
what a branch *is*, where an attached behaviour would leave it ordinary state.

**Disposition: NOT TAKEN.** Needs the offline/local-preferences scenario and an
answer to C2 that works on a platform where `pagehide` never fires.

---

# A3-0 — PRE-REGISTERED before the experiment ran

> **Null: does SignalTree need an independently mutable operation-lifecycle
> state primitive, once transaction-owned lifecycle and ordinary application
> state are available?**

Written down before any case was run, so the experiment cannot drift toward
rescuing `status()`. `transactions()` is a CONTROL here and is not modified
during the characterization pass — changing it to absorb status would
manufacture the answer.

| case | supports a SignalTree primitive | argues against one |
| --- | --- | --- |
| optimistic mutation | lifecycle unrepresentable by `transactions()` without losing semantics | the transaction already owns pending/confirm/reject |
| non-optimistic save | the lifecycle must participate in SignalTree semantics *before* state changes | ordinary async/controller state handles it |
| external async op | some SignalTree-owned state or causal property is required despite no tree mutation | the lifecycle lives entirely outside SignalTree |
| concurrent operations | SignalTree has a coherent identity/concurrency model the app needs | the single `status` slot collapses distinct operations |
| typed errors | errors need durable or tree-owned semantics | errors belong to the request/controller/UI layer |

Two verdicts are required, and they are independent:

```text
FUNCTION     do applications need async-operation lifecycle represented?
OWNERSHIP    does SignalTree need to own a public primitive for it?
```

"State worth displaying" is not an ownership argument. A UI needs `saving`,
`failed`, `last error`, `refreshing`; the question is whether those values
participate in SignalTree's actual responsibilities — state truth, causal
operations, transactions, restoration, identity — or are transient controller
state stored in the tree because the tree is convenient.

Equally, ephemeral does not imply "not SignalTree". If multiple components react
to it, a route transition depends on it, or its identity must line up with
transaction ownership, that could be a legitimate state function. It just has to
earn it independently.

**Extra discriminator inside the concurrency case — supersession.** When B
starts for the same logical operation while A is in flight: does B supersede A,
coexist with it, cancel it, or leave A able to overwrite B's status? If the
answer is application policy, a generic `status()` leaf is under-specified.

---

# A3-0 — RESULT

Eight `status()` declarations across five files, every one read. The
pre-registered matrix is above; this is what the cases returned.

## The site classification

| site | job | case |
| --- | --- | --- |
| `ticket.save` | POST create ticket | non-optimistic mutation |
| `ticket.useLast` | recall-most-recent request | non-optimistic mutation |
| `v3edge.capture` | scale capture request | non-optimistic mutation |
| `v3edge.netWeight` | ask backend to compute net weight | external async op |
| `work/messages.loading` | message POST failure state | non-optimistic mutation |
| `work/tickets.loading` | imperative load of a loader-less `entityMap` | external async op |
| `device.loading` | request lifecycle beside a loader-backed collection | external async op |
| `feature-flag.load` | fetch flags, land them on a separate leaf | external async op |

## Finding 1 — NOT ONE SITE IS AN OPTIMISTIC MUTATION

This is the headline, and it settles the question the audit was opened to ask.
`transactions()` owns optimistic local mutation with rollback. **Zero of the
eight sites mutate local state before the server answers.** `netWeight` and
`feature-flag` are explicit about it — the result lands on a *separate* leaf
(`netWeightResult`, `flags`) that is written only on success.

So the "transactions subsumes status" hypothesis is refuted by absence, not by
argument. Case 1 of the matrix has no production instances at all; every site is
case 2 or case 3. Renaming `status()` to `transactionStatus()` would have
overfitted a use case that does not occur here.

## Finding 2 — `loader` and `status` coexist WITHOUT overlapping

`messagesState()` declares both: a `loader()` on the `threads` collection, and a
`status()` named `loading` whose doc comment says it is send-failure state for
message *posts*. Different operations on the same slice. `work/tickets` is the
mirror image — an `entityMap` with **no** loader, populated imperatively, with
`status` tracking that acquisition.

The A1/A3 boundary is therefore real and clean: `loader` owns the status of
collections the tree acquires; `status` covers operations it does not perform.
Neither subsumes the other, and the production code already treats them that
way.

## Finding 3 — the concurrency case falsifies the ABSTRACTION, not just the API

No call site has any concurrency guard:

```ts
capture$(dto) {
  this._$.capture.setLoading();
  return this._v3EdgeService.capture$(dto).pipe(
    tap(() => this._$.capture.setLoaded()),
    catchError(error => { this._$.capture.setError(…); return of(null); }),
  );
}
```

Two overlapping captures produce:

```text
A setLoading · B setLoading · A fails · B succeeds   ->  slot reads "loaded",
                                                          A's failure is lost
A setLoading · B setLoading · B succeeds · A fails   ->  slot reads "error",
                                                          B's success is lost
```

The slot has no operation identity, so it describes whichever write landed last.
On supersession the answer is "none of the above": B does not supersede, cancel
or coexist with A — it simply overwrites, and A can overwrite back.

This corroborates derivation S1, which deleted the marker after measuring that
**every setter was an unguarded assignment and nothing in core ever drove status
from an execution** — neither transition governance nor lifecycle observation
was present. A3-0 adds the production half: applications did need this state,
and the abstraction they were given could not say which operation it was about.

**So the correct reading of the 36 compiler errors is: applications need
operation-lifecycle state. It is NOT: `status()` was an adequate abstraction for
it.** Both halves have to be recorded, because the first alone would have
argued for restoring it.

## Finding 4 — typed errors are app-shaped, not tree-shaped

Seven sites use `NotifyErrorModel`, one uses `string`. Every value arrives via
`captureError(error, 'V3EdgeOps')` — an application helper — and is read by the
UI for retry affordances. Nothing restores it, no transaction consults it, no
causal operation depends on it. It is request-layer state that the app keeps
where its other state lives.

## The two verdicts

```text
FUNCTION    do applications need async-operation lifecycle represented?
            YES. Eight sites, consistent shape, real UI needs, and no
            alternative in the library today.

OWNERSHIP   does SignalTree need to own a public primitive for it?
            NO. Not one site requires SignalTree's semantic responsibilities —
            state truth, causal operations, transactions, restoration,
            identity. The state is in the tree because that is where the
            application keeps state and because several components read it.
```

"Several components read it" is a shared-state argument, and shared state is
already served — by an ordinary branch. `{ pending: false, error: null }` with
derived predicates expresses all eight sites, which is precisely what S1
concluded: *workflow state is ordinary store truth; its predicates are ordinary
derived projections.*

**Disposition: `status` stays deleted. No replacement primitive.** The outcome
is the second row of the pre-registered outcome space — transaction lifecycle
for optimistic work, ordinary state plus composition for everything else — and
the migration needs to document two patterns rather than one substitution.

## What TruckTrax has to write instead

```ts
// ordinary branch — no marker
save: { pending: false, error: null as NotifyErrorModel | null },

// ops
this._$.save.pending.set(true);
…
this._$.save.pending.set(false);
this._$.save.error.set(captureError(e, 'TicketOps'));
```

Predicates become `computed`/`derivedFrom`. If an application wants operation
identity — which the concurrency finding says these sites arguably should have —
that is an application concern with an application answer, and it is one v15
does not prevent.

## What A3-0 does NOT establish

That a well-specified operation-lifecycle primitive *with* operation identity
would be wrong for SignalTree. It establishes that the deleted one was
under-specified and that nothing in the production evidence requires SignalTree
to own the concept. If a future case shows lifecycle state that must line up
with transaction ownership or survive restoration, that is a new derivation, not
a resurrection.

---

# A3 — async / status representation

## Business jobs

"What does the UI actually need to know? loading? stale? refreshing? failed?
pending mutation?"

## Call sites — 5 files, and the job is MUTATIONS, not loads

```ts
// ticket.state.ts
save:    status<NotifyErrorModel>(),   // create-ticket request
useLast: status<NotifyErrorModel>(),   // recall-most-recent request

// feature-flag.state.ts
load: status<string>(),
```

Driven imperatively from ops services:

```ts
this._$.save.setLoading();
…
tap(() => this._$.save.setLoaded()),
catchError(e => { this._$.save.setError(captureError(e, 'TicketOps.createTicket$')); … })
```

So `status<E>()` is a **declaration-time leaf producing a small typed state
machine** — `setLoading` / `setLoaded` / `setError(E)` in, predicates out — for
async work **SignalTree does not perform itself**.

That is the precise complement of A1. `loader` owns the status of collections
the tree loads; `status` covers everything else: mutations, imperative loads,
and third-party calls. The two together cover the async-state question, and
neither subsumes the other.

**This is the strongest argument in the audit for a genuinely missing
primitive.** `status` was deleted as "the rejected status marker", but the
36 errors it causes are not a consumer clinging to a helper — they are a
consumer with no other way to say "this mutation is in flight and here is its
typed error". Deriving it from `loader` is not possible: there is no loader
involved in `POST /ticket`.

## Semantic owner and lifetime

The leaf. Lifetime is the tree's; the state machine is per-operation-slot, not
per-request.

## Open questions before a disposition

- Is the typed error parameter (`status<NotifyErrorModel>()`) load-bearing, or
  would `unknown` plus a cast do? Every production site parameterizes it.
- Does it need `pending` vs `refreshing` distinction? No evidence here.
- Should mutation status instead come from `transactions()`, given v15 now has
  a real optimistic-mutation story? Worth testing: a ticket save IS an
  optimistic mutation. This is the one place where a v15 capability might
  legitimately absorb a v13 marker.

## C1 / C2

**C1** — this is the capability where composition is LEAST available, and that
is itself the argument for it. There is no external system that owns "the state
of an operation I performed myself". Angular's `resource()` covers loads it
performs; it does not cover `POST /ticket`. So unlike forms, there is nothing to
compose with.

**C2** — not applicable if C1 is no.

But the forms precedent still bites in a different direction: `history()` died
because its only consumer was another capability. `status` must be checked
against the same test — if v15's `transactions()` can express a ticket save,
then `status` is a view over transaction state rather than a marker, and the
answer is a derived projection, not a public primitive.

**Disposition: NOT TAKEN.** The transactions overlap must be tested first, and
it is the single highest-value experiment in this audit: it is the one case
where a v15 capability may absorb a v13 marker outright.

---

# A4 + A5 — form integration and its history

These were listed separately and are one thing. **28 of the 212 TruckTrax errors
— `form` (14), `history` (7), the `@signaltree/ng-forms/signals` subpath (7) —
come from a single consumer**: TruckTrax's own `packages/signal-forms` wrapper,
in two files.

## The call site, and why it is the case study in miniature

```ts
// packages/signal-forms/src/lib/entity/build-entity-form.ts
const tree = signalTree({
  editForm: stForm<EntityModel<TModel>>({
    initial: createEntityModel(config.metadata, config.defaultValues),
    history: history({ capacity: 50 }),
  }),
});
const fields = signalForm(tree.$.editForm, { schema, injector, name });
```

A throwaway one-node tree, created solely to host a form marker with history,
bridged into Angular Signal Forms. That is precisely the arrangement FORM-DEL
replaced, and TruckTrax's own comment describes the coupling as the feature:
"the FieldTree's model IS the marker's values signal … one engine, no separate
model signal, no sync loop".

The compositional model gives the same property without the marker, because
`toWritableSignal` is the shared model:

```ts
const tree = signalTree({ editForm: createEntityModel(metadata, defaults) });
const model = toWritableSignal(tree.$.editForm);
const fields = form(model, schema);        // Angular Signal Forms
const undo = trackHistory(model, { capacity: 50 });
```

**C1 — can this compose?** Yes. Demonstrated by the greenfield spike, and the
demos already converted.

**C2 — what is missing from core to make it correct?** Exactly one thing, and it
is not new code.

## The one gap

| piece | shipped in `15.0.0-rc.1`? |
| --- | --- |
| `toWritableSignal` — the seam | **yes** |
| Angular Signal Forms — validation, touched, dirty | external, fine |
| `trackHistory` — undo/redo over a plain signal | **implemented, WITHHELD** |

`trackHistory` lives at `core/src/lib/form-history/form-history.ts:206`, appears
zero times in the core barrel and zero times in the shipped `.d.ts`, and its
disposition reads "LC / mechanically retained after form deletion".

The *wording* of that disposition is falsified. `trackHistory` was not
mechanically retained — it survived FORM-DEL **because it was already the
compositional shape**, taking a plain `WritableSignal` and never touching the
marker.

**But that invalidates the old negative; it does not establish a new positive.**
It proves `trackHistory` is a coherent generic primitive. It does not prove
SignalTree should publicly own generic `WritableSignal` history. That needs its
own small audit: does `timeTravel()` already cover it? Is signal-history
generally useful standalone? Does Angular Signal Forms actually need SignalTree
to supply it? Is its contract consistent with v15 history semantics?

The action is **re-audit, not re-export**.

## Disposition

**A4/A5 need no new SignalTree capability.** The migration is TruckTrax's, the
path is proven, and the only SignalTree action is to re-examine one
disposition — `trackHistory` — against the fact that the compositional forms
model depends on it.

`form`, `FormSignal`, `history` and the `signals` subpath stay deleted. Note
that `@signaltree/ng-forms` surviving at all is recorded as UNPROVEN in
`b57ba293`, pending its own audit; nothing here changes that.

---

# A6 — collection projections (`EntitySignal.map`)

The shortest dossier in the audit, and worth recording precisely because the
error count made it look bigger than it is.

## The blast radius is TWO LINES, not eight errors

All eight reduce to two locations in one TruckTrax file, multiplied across the
typecheck projects that include it:

```text
service-crud-ops.ts:134    Object.fromEntries(this.slice.entities.map())
service-crud-state.ts:124  Pick<EntitySignal<T, EntityId>, 'all' | 'byId' | 'map'>
```

The second is a type alias — `ServiceCrudEntityReads` — whose **only reference
in the entire monorepo is its own declaration**. Dead code.

So there is exactly ONE real call: building a `Record<EntityId, TEntity>`
lookup from the collection.

## There is no capability gap — the replacement already ships and is better

`EntitySignal` exposes:

```ts
readonly asMap: Signal<ReadonlyMap<K, E>>;
```

Keyed by the collection's own `selectId`, reactive, and covered by eight
assertions across three core specs. The migration is a rename:

```ts
Object.fromEntries(this.slice.entities.map())     // v13
Object.fromEntries(this.slice.entities.asMap())   // v15
```

and the better form drops `fromEntries` entirely, since a `ReadonlyMap` is what
the consumer wanted in the first place.

## Disposition

**No SignalTree action. Migration only, and it is a rename plus a dead-type
deletion.** `map` does not come back; `asMap` is the same projection with a
better type and a reactive wrapper.

Recorded because the pass-1 ledger listed this at 8 errors alongside genuine
capability gaps, which overstated it. Error counts measure compiler
consequences, not distinct findings — the same correction the implicit-any
cascade needed.

---

# A6 — collection projections (`EntitySignal.map`)

Not started. 8 errors.

`A7` (`.with()`) is already decided — declarative construction, 15.0.

---

## Why this is documented this way

The migration guidance an LLM will need is generated from these dossiers, not
written separately. "`loader(...)` → `<x>`" is only trustworthy if the reason is
recorded next to it, because otherwise the next agent re-litigates the decision
from the historical spelling — which is the weakest evidence there is.
