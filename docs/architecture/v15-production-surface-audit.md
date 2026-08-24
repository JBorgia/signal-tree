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

it imports `form` (aliased `stForm`), `history` and `signalTree` from the core
barrel and builds the model with `history({ capacity: 50 })`.

> Written out in prose rather than quoted as code on purpose. `form` and
> `history` are deleted at HEAD, and `readme-apis` reads an import line in any
> fence as a claim about the current barrel — it rejected the literal quotation,
> correctly. The consumer's line is real; it is just written against an older
> core.

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

# HIST-C2 — deriving the door

Accepted going in, from the disposition: eligibility attaches to the **causal
turn**; a scope or call site is only how the application designates that turn.
The door must generalise the existing admission predicate, not add a second
mechanism.

## Finding 1 — HIST-B is not merely refuted, it is SHIPPED

Found while reading the capture path for the prototype:
`captureIntoBucket()` opens with `isHistoryExcludedCapture(ownerPath, path)`,
which reads a `HISTORY_EXCLUDED` symbol stamped on collection nodes by
**`entityMap({ recordHistory: false })`** (RFC 0012). That is a public,
location-scoped history exclusion in the product today — HIST-B in miniature.

Case 4 predicts what location scoping does to an atomic causal turn. Measured, in
`histc2-record-history-collision.spec.ts`, with both controls green so the
mechanism is provably exercised:

```text
control  excluded collection alone      -> no history entry        (works)
control  ordinary leaf alone            -> one history entry       (works)

THE COLLISION — one tick, therefore ONE causal turn:
    document.title.set('edited')
    cache.updateOne('a', { name: 'changed' })
  -> ONE history entry
  undo
  -> document.title  'v1'        reversed
  -> cache.a.name    'changed'   NOT reversed
```

**An atomically authored operation is partially reversed.** Exactly the failure
case 4 predicted for HIST-B, present in shipped API rather than in a hypothetical
design. And the mixed shape is the ordinary one in application code — write a
document field and refresh a cache in the same handler.

### This is an argument FOR C2, not a new defect to guard

Under an opt-in default nothing is recorded unless an operation is designated, so
`recordHistory: false` has nothing left to subtract from: the option **dissolves**
rather than needing a compatibility guard. The flip removes a shipped defect
instead of adding machinery to contain it.

```text
RECONCILIATION      recordHistory:false is subsumed by opt-in eligibility and
                    should be deleted with the flip, not carried forward
```

That also sharpens the requirement on the prototype: the eligibility bit must not
merely be *sufficient* to express designation — it must be sufficient to
**subsume** the one location-scoped exclusion already in the product.

## The contract being tested

```text
RESTORATION ELIGIBILITY

1. Default authored turns are non-reversible.
2. An explicit reversible designation promotes the authored causal turn to
   restoration-eligible.
3. Eligibility is turn-wide and therefore atomic.
4. Realization can never be promoted into restoration history.
5. Restoration can never become new restoration history.
6. An eligible confirmed turn enters the one existing history inventory and
   acquires restoration claims.
7. A non-eligible turn acquires neither.
8. Eligibility does not imply diagnostic visibility; DIAG-JOURNAL owns that.
```

## Prototype constraint: the default is NOT flipped yet

The flip is a behaviour change under 1754 existing tests that all assume
default-on, so flipping it first would destroy the ability to characterise
anything. The prototype therefore carries an explicit mode —
`all` (today's semantics) versus `designated` (HIST-C2) — existing suites run
unchanged in `all`, and the new cases run in `designated`. **The default flip is
a separate, deliberate change made after the door semantics are proven**, not a
side effect of this derivation.

## Where the designation may NOT live

```text
NOT on state location     HIST-B; case 4 refuted it and Finding 1 shows the
                          shipped instance producing partial reversal
NOT per leaf write        eligibility would be write-scoped while the engine's
                          atomic unit is the turn, so two writes in one turn
                          could disagree about their shared operation
```

Which leaves designation of the operation itself.

## Finding 2 — designation must be captured at WRITE time, not at record time

The first prototype read the ambient designation inside `captureIntoBucket()`
and recorded nothing at all. Probed rather than reasoned about, for one
designated tick containing a leaf write and a collection write:

```text
inside-scope                true
after-set-still-inside      true
outside-scope               false
captureIntoBucket           false     <- x3, ALL of them
after-flush                 false
```

Capture is uniformly deferred to the flush microtask, so by the time the
recorder runs the designation scope has already returned. Any synchronous
ambient flag is invisible there.

**`path-notifier.ts` had already solved this once.** Its `source` field is
captured at `notify()` time with a comment naming the identical trap —
*"the flush that delivers this entry is DEFERRED to a microtask … `isRestoring`-
style flags that reset synchronously are already false by then."* The fix
follows that precedent exactly: stamp the designation onto the write's metadata
at `notify()`, the one synchronous choke point every write passes through, and
read it off the delivered meta at record time.

Three places needed it, and the reason each is separate is itself the finding:

```text
notify()                the general choke point
leaf interceptor        computes its own meta and passes it to notify() as a
                        metaOverride, which BYPASSES notify's stamping
plain-leaf capture      does not go through captureIntoBucket() at all; it
                        calls captureEffects() directly
```

The last two are pre-existing asymmetries in the capture path. They are worth
recording because any future work that assumes "all writes funnel through
`captureIntoBucket`" is wrong.

## The ten cases — results

Prototype: internal `withRestorationDesignation()`, `restorationEligibility:
'designated'`. All 13 assertions in `histc2-door.spec.ts` pass; core stays at
1771 passing and 35/35 fast gates.

| # | case | result |
| --- | --- | --- |
| 1 | ordinary unmarked write | no entry, no undo — **and the write still lands** |
| 2 | one marked write | exactly one turn; undo restores |
| 3 | several marked writes, one turn | ONE atomic entry |
| 4 | **marked + unmarked, one turn** | **the WHOLE turn reverses** |
| 5 | two marked scopes, one tick | **one** turn — see below |
| 6 | transaction inside a marked scope | one reversible transaction |
| 7 | unmarked transaction | no entry; **the transaction still commits** |
| 8 | realization inside a marked scope | stays non-historical — rule 4 holds |
| 9 | restoration inside a marked scope | no new history — rule 5 holds |
| 10 | nested marked scopes | idempotent, one turn |
| — | non-eligible entity churn | **zero claims, zero claimed subjects** |
| — | designated turn (control) | claims acquired — the zero above means something |
| — | async designation scope | **throws ST1033**, never silently ignored |

**Case 4 is the one that had to hold** and does: one designated write promotes
the whole turn, so the door cannot reintroduce partial reversal by another
route. Case 7 confirms the separation the contract needs — eligibility governs
restoration, never whether a write lands.

### Case 5 — the scope is an ELIGIBILITY scope, not an operation boundary

```ts
reversible(() => tree.$.a.set(10));
reversible(() => tree.$.b.set(20));   // same tick
```

collapses to **one** undo step. That is the honest measurement, and it is
consistent with everything else: the turn is the tick, and the scope designates
the turn it is in rather than creating one.

Whether applications need those separate is **not yet established**, and no
machinery is being built for it. Ordinary UI events supply a tick boundary on
their own. If evidence later shows an explicit reversible operation must also
establish a causal-turn boundary, that is a second requirement to derive then.

### The async contract is enforced, not documented

`withRestorationDesignation` throws **ST1033** on a thenable return. PER-0 and
three earlier false signals in this audit were all the same shape — a
synchronous ambient designation that looks like it spans an `await` and does
not. Rather than write that trap down, the door refuses it.

## What remains open in HIST-C2

```text
DONE   1 turn-level eligibility bit is sufficient
DONE   2 same-turn marked/unmarked atomicity
DONE   3 transaction composition (both directions, plus the unmarked case)
DONE   4 scope boundaries / two scopes in one tick
DONE   5 synchronous/async behaviour pinned
OPEN   6 the Signal Forms integration case
OPEN   7 the public spelling
```

Step 6 is the one that could still change the design: TruckTrax's requirement is
that writes entering through an editable form model are reversible, and with
Angular Signal Forms those writes may not have a convenient callback around
them. If the framework lets the event be wrapped, no extra API is earned. If it
does not, the candidate is a designating mutation adapter —
*an authored write entering through THIS adapter marks its causal operation
reversible* — which is **not** location-scoped history, because writes to the
same branch from another source stay ordinary. It gets added only if the real
migration needs it.

### Surface debt to settle at step 7

The prototype stamps `restorationDesignated` on `UpdateMetadata`, which is a
**public type export**. That is acceptable for characterisation and wrong to
ship: applications must express "this is an undoable user operation", not set a
causal-engine field. Moving it off the public type is part of choosing the
spelling.

### Also settled by the prototype, and worth stating

The default is still `'all'`. Flipping it is a separate change, and it is now
cheap to reason about: `isTurnEligible()` is one function, consulted by the
flush path, the root path and the transaction path, and nothing else decides
admission.

## Step 6 — Signal Forms integration: **FORM-C2-B**

Run against the real `@angular/forms/signals` API on Angular 22.0.7, over an
ordinary branch through `toWritableSignal()`.

### The programmatic path composes (but decides nothing)

`histc2-signal-forms.spec.ts`, 6 cases: a `f.name().value.set(...)` inside the
generic scope produces exactly one reversible turn; undo restores the tree AND
the form; an undesignated write to the same model records nothing; a mixed turn
promotes wholly; an ordinary tree-handle write to the form branch stays
non-reversible.

That proves the door composes with Signal Forms. It proves nothing about
production, because the APPLICATION makes that call — of course a scope can wrap
it.

### The DOM path decides it

`histc2-form-dom.spec.ts`. In production the user types into
`<input [formField]="f.name">` and Angular's `FormField` directive writes the
model from inside its own DOM listener.

```text
CONTROL   a DOM edit reaches the tree            'grace'  ✓
FINDING   the same edit produces NO turn         no application callback exists
```

There is nowhere to put `reversible(() => …)`. **FORM-C2-B**: the smallest
mutation-ingress adapter is earned.

One measurement shapes the adapter: wrapping the *dispatch* does designate the
turn (measured: 1). No real application can exploit that — the browser
dispatches — but it proves the directive's write is **synchronous** inside the
event, so there is no scheduling gap for a designation to fall into. An adapter
that designates inside its own `set()` is therefore sound.

### The adapter, and the control that keeps it honest

`toWritableSignal(node, injector, { designatesRestoration: true })` wraps the
write-back in the designation. `histc2-form-ingress.spec.ts`:

| | result |
| --- | --- |
| real DOM edit through the adapter | **one reversible turn**; undo restores tree and form |
| same branch, ordinary tree handle | **non-reversible** — the HIST-B control |
| adapter WITHOUT the option | non-reversible — the option does the work, not the form |

```text
NOT THIS       all writes to branch X are historical          (HIST-B)
THIS           a write ENTERING through this adapter marks
               its causal operation reversible                 (ingress)
```

### The mixed-turn worry does not arise on the DOM path

Pre-registered as a consequence to expose rather than hide. Measured, it does
not occur:

```text
typeInto(...)                 -> turn ALREADY recorded here, synchronously
tree.$.ui.panel.set(...)      -> adds nothing (undesignated, and a later turn)
undo                          -> form edit reverses, screen state does not
```

zone.js flushes at the DOM event boundary, so a template-driven edit closes its
own causal turn before any later application write can join it. The mixed-turn
consequence is real — it is proved programmatically — but for template-driven
editing each edit is naturally its own operation. **The ergonomics worry behind
the step-6 requirement is answered: nothing was special-cased, and the situation
does not arise.**

### Two method corrections from this step

Both are the same failure this audit keeps catching, and both were caught by a
control rather than by reasoning.

**`toWritableSignal` without an injection context is SILENTLY one-way.** Its
`effect()` throws, the catch swallows it behind a `console.warn`, and the
returned signal looks identical. I read the resulting stale model as
"Signal Forms does not observe restoration" — a false defect report about the
seam the whole forms strategy rests on. Passing the injector makes it two-way in
both directions, verified in isolation before continuing.

**`Field` is a TYPE alias, not the directive.** Importing it into `imports: []`
yields NG0919. The directive is `FormField`, selector `[formField]`.

# HIST-C2 step 7 — surface minimisation (prepared, name not yet chosen)

## The current public value surface — 15 names

```text
signalTree  defineStore  asReadonly  SignalTreeRollbackError  entityMap
derivedFrom  createAuditTracker  createAuditCallback  deepEqual
toWritableSignal  batching  timeTravel  transactions  persistence  devTools
```

Plus 51 exported types. Step 7 does not add a package; at most it adds one door
and removes three leaks.

## The leak inventory

```text
LEAK   restorationDesignated      on the PUBLIC UpdateMetadata type
LEAK   restorationEligibility     on TimeTravelConfig — implementation
                                  vocabulary as configuration
LEAK   designatesRestoration      toWritableSignal's option, earned by
                                  FORM-C2-B but not yet named
GONE   recordHistory              EntityConfig — refuted, see dividend below
GONE   shouldSkip                 TimeTravelConfig — subsumed, see below
DOOR   withRestorationDesignation internal today; needs one public spelling
```

## `shouldSkip` — subsumed, and its own rationale says why

Read before proposing removal, because the design is deliberate and good. The
comparator was deliberately MOVED from record time to read time, for five stated
reasons, the first being that a potentially O(state) predicate ran per write to
avoid something that costs almost nothing, and the second that a skipped entry
never existed so a wrong predicate lost history permanently.

That reasoning is sound and it is exactly what opt-in eligibility supersedes. Its
stated purpose is:

> a comparator lets the app decide a change is uninteresting — a cursor position,
> a hover flag, a field the user is still typing into — so undo lands on
> something a person recognises as a step

Under HIST-C2 a cursor position is simply **never designated**. The filter's job
is done upstream, for free, and without a per-transition predicate. The read-time
design existed to avoid losing data by filtering a complete record; opt-in means
the record already contains only the user's operations.

Corroborating: **zero consumers**. Not in this repository outside its own
implementation, and not in TruckTrax.

## Deleting `recordHistory` pays a real dividend

Not just "one fewer option". The exclusion feature is load-bearing for a chain of
machinery that exists only to service it:

```text
pruneHistoryExcluded()      a walk producing a pruned snapshot
didPrune                    `plain !== rawSnapshot`, described in-source as
                            "an exact O(1) test for does this tree use
                            recordHistory: false at all"
prunedEqual()               a structural-equality walk, run only when pruning
                            happened
PHANTOM ENTRIES             the bug that walk guards: a write to an excluded
                            collection still makes a new root, so two snapshots
                            differing only inside excluded state are
                            structurally identical and referentially distinct —
                            `canUndo()` true, undo changes nothing visible, and
                            the user spends a step they never had
isHistoryExcludedCapture()  the capture-path check
HISTORY_EXCLUDED            the symbol, and its stamping in entity-signal
```

All of it goes with the option. A whole class of phantom-entry bug disappears
rather than being fixed.

## Naming — analysis, with one candidate ruled out on evidence

The public API should carry **one bit**: *this write belongs to the user's
reversible action model.* Everything else (`intent`, `source`, `causalMode`,
`subjectIds`, `positionIds`, `restorationEligibility`) is the engine's reasoning
and stays internal.

Two of the three candidate directions have concrete problems, and one of them is
a measurement rather than a preference:

```text
markRestorationBoundary   REFUTED BY CASE 5. Two designation scopes in one tick
                          collapse into ONE turn — the scope is an eligibility
                          scope, NOT an operation boundary. This name would ship
                          a promise the engine does not keep, and would be the
                          first thing a user tests.

withRestorableWrite       MIS-NAMES THE UNIT. Case 4: one designated write
                          promotes an UNDESIGNATED sibling write in the same
                          turn. A reader of "restorable write" expects only that
                          write to revert. The unit is the turn.

withCausalIntent          Leaks engine vocabulary into application code, and
                          "intent" already means something else internally (the
                          UpdateMetadata field).
```

**Recommendation: `undoable()`.** It is the user's word for the capability, it
names the operation rather than the write, it claims no boundary, it pairs with
the `undo()` it feeds, and it carries no engine vocabulary. The adapter option
reads `{ undoable: true }`, which says the right thing at the call site:

```text
undoable(() => { ... })                          the generic door
toWritableSignal(node, injector, { undoable: true })   the framework bridge
```

**Not chosen here.** The name is a product decision; this section records the
analysis and the one candidate that evidence eliminates.

## Sequence once the name is fixed

```text
1  add the public door under the chosen name; keep the internal function as its
   implementation
2  move restorationDesignated off the public UpdateMetadata type
3  rename the adapter option to match the door
4  flip the default; delete restorationEligibility
5  delete recordHistory and the prune/phantom machinery it carries
6  delete shouldSkip
7  full gates + the release-claims exemptions for recordHistory / shouldSkip /
   restorationEligibility must now FAIL if any survived — they are written to
```

Step 7 gate note: the release-claims repair means steps 5, 6 and 4 cannot be
quietly skipped. Each of those three members has an exemption whose stated reason
is that surviving to release makes the exemption wrong.

# HIST-C2 step 7 — `undoable()` FROZEN, and the flip rule pre-registered

## The name

```ts
undoable(() => {
  // the authored operation
});

toWritableSignal(node, injector, { undoable: true });
```

> **`undoable()` designates the authored causal turn containing its writes as
> eligible for undo. It does not create a causal-turn boundary.**

That second sentence is the one the evidence forced. Case 5 measured two
designation scopes in a single tick collapsing into ONE turn, so a name implying
a boundary (`markRestorationBoundary`) would have shipped a promise the engine
does not keep. Case 4 measured one designated write promoting an *undesignated*
sibling in the same turn, so a name implying per-write scope
(`withRestorableWrite`) would have mis-stated the unit.

Not public, and deliberately: `restorationEligible`, `restorationDesignated`,
`causalMode`, `intent`, `source`, `restorationEligibility`. Those are the
engine's reasoning. The public surface carries one bit — *this is an undoable
user operation.*

## PRE-REGISTERED before the default flip

Recorded now, while nothing is failing, because the flip is the step where
migration-by-habit is cheapest and most damaging:

> **No test receives `undoable()` merely because it used to create history.
> Designation requires an independently stated restoration requirement.**

Every post-flip failure gets classified, and only the first class earns
designation:

```text
TEST ASSUMES OLD PRODUCT SEMANTICS
    -> migrate the test; the operation was never a product undo

OPERATION GENUINELY REQUIRES RESTORATION
    -> designate it, and say WHY in the test

ENGINE USED HISTORY AS AN ACCIDENTAL INTERNAL TRANSPORT
    -> architectural defect. Do NOT paper over it with undoable().
```

The third class is the one to watch. A test failing after the flip does not earn
a wrapper; the question is whether a *product user* should be able to undo that
operation.

Pre-registered answers, so they are not decided under pressure:

```text
explicit user edit                        yes
form DOM mutation through the adapter     yes
server realization                        never
persistence restore                       never
setup fixture mutation                    no — establish the baseline differently
test helper that later calls undo         only if the test really exercises an
                                          undoable product operation
```

## ST1034 stays a thrown error

`undo(): void` already has a clean contract:

```text
success   the entire operation was reversed
failure   throws ST1034; nothing changed, cursor unmoved, redo unchanged
```

Widening it to `undo(): UndoResult` because structured conflicts would be
tidier is exactly the speculative-API move this audit has rejected everywhere
else. If DevTools or a real consumer later needs machine-readable refusal
detail, a typed error is the narrower evolution.

## Execution order

```text
1  freeze undoable() / { undoable: true }        <- this commit
2  name-dependent surface work
3  delete recordHistory + its pruning machinery
4  delete or subsume shouldSkip
5  internalize the prototype metadata
6  FLIP TO OPT-IN — classify every failure against the rule above
7  remove the prototype compatibility switch
8  full gates + release-claims + build + TruckTrax surface check
```

Steps 3-5 remove machinery already proved unnecessary. **Step 6 is the only one
expected to be surprising**, because it inverts the semantics under a large
existing corpus rather than deleting something dead.

# HIST-C2 step 6 — THE FLIP: stopped on a category-C finding

One line changed, nothing else:

```text
isTurnEligible: config.restorationEligibility !== 'designated' || designated
             -> config.restorationEligibility === 'all'        || designated
```

Result: **211 failures across 37 files**, out of 1803.

## ⛔ CATEGORY C — transaction rollback uses the history log as its dependency ledger

Found while classifying, and the pre-registered rule says stop rather than
migrate. **The flip is reverted; the default is `'all'` again.**

`packages/core/src/lib/internals/causal-runtime/pending-rollback.ts`:

```ts
function hasLaterStructuralDependency(pendingTurn, store) {
  const laterTurns = [...store.getTurns(), ...store.getPendingTurns()]
    .filter((turn) => turn.id > pendingTurn.id);
  ...
}
```

`store.getTurns()` is the **confirmed turn log** — the restoration history. It is
consulted to decide whether rolling back a pending transaction is SAFE:

```text
transaction adds row 'a'          pending
later authored write sets a.field depends on 'a' existing
rollback                          MUST be refused (SignalTreeRollbackError)
```

Under opt-in, that later write is not `undoable()`, so it never becomes a
confirmed turn, so the dependency is invisible and **the rollback proceeds**. The
seven tests carrying this signature all stop throwing:

```text
rejects rollback when a later same-microtask update derives from pending state
treats update then update in one later confirmed turn as derive for rollback
rejects rollback of a pending add when later same-subject field set depends on it
rejects rollback of a pending add when later same-subject field update depends on it
rejects rollback of a pending remove when the restore key is occupied by a
  different SubjectId
rejects rollback of a pending rekey when later work touches the same structural
  dimension
fails atomically when rolling back a pending rekey would restore into an
  occupied original key
```

A further cluster is the same mechanism seen from the positive side — *"rolls back
a pending write while preserving a later unrelated confirmed write"* — which can
only preserve later work it knows about.

**This is exactly the failure class the flip was designed to expose.** The later
write is not a user-restorable operation; nobody wants `undoable()` on it. But
transaction *correctness* depends on the engine knowing it happened. History had
become hidden infrastructure for causal dependency detection.

Designating those writes to recover green would be the worst available outcome:
it would make transaction safety depend on an application remembering to mark
writes undoable, and would quietly restore the default-reversible world inside
the very mechanism the flip was meant to separate.

### What the fix has to be, stated but not yet derived

The dependency ledger and the restoration history are two different things that
happen to share a store today:

```text
RESTORATION HISTORY   which authored operations a user may reverse
                      -> admission by undoable()

CAUSAL DEPENDENCY     what happened after a pending turn, so rollback can tell
LEDGER                whether reversing it is still safe
                      -> admission by NOTHING; it must see every authored write
```

The second cannot be opt-in. That is not a weakening of HIST-C — it is the same
distinction DIAG-JOURNAL already predicted for observability, arriving a layer
lower and with a correctness consequence rather than a diagnostic one.

## Classification, and an honest note on its completeness

```text
C   ~14   rollback / pending-dependency tests whose mechanism is the confirmed
          turn log                                    ⛔ STOPPED HERE
A   ~197  sampled across every one of the 37 files; every sample was an
          old-default assumption
U   0     nothing ambiguous encountered before stopping
B   0     no product operation needed designation
```

The A count is **sampled, not individually adjudicated**. Every failing file was
opened and at least one failure read; all of them were the same shape — a plain
write expected to produce a history entry — but the remaining ~197 were not
enumerated one by one, because the rule was to stop on C and because the C fix
will change which of them still fail.

Two sub-shapes worth separating when the migration does happen:

```text
A1  the test asserts the old DEFAULT — the expectation itself changes
A2  the test's SUBJECT is restoration, and it must now designate the operation
    it exercises. Adding undoable() here is the test expressing its own subject,
    not migration-by-habit — but each one still needs its reason recorded.
```

## Findings that came free with the flip

**A pinned defect is repaired by it.** `composed-acquisition.spec.ts` CASE 8
pinned *"an untagged refresh BECOMES an undoable user turn"* — an A1-0 finding
where server data arriving without realization classification entered the undo
stack. Under opt-in it does not, because it was never designated. The flip fixes
it rather than needing a guard.

**No second admission concept exists.** `history-step-adapter.spec.ts` describes
a *"seam that demarcates a user-recognizable undo step"*, which read like a rival
to `undoable()`. It is `transactions()`: a GROUPING concept — several writes
become one turn — orthogonal to whether that turn is admitted. The step-5
invariant holds.

## Also observed, not yet explained

`tree-realization-adapter.spec.ts` failed 3 times in the full run and passed when
run alone. Possible test-order coupling; recorded rather than diagnosed, since it
may simply disappear once the C is resolved.

# TX-LEDGER-0 — case 6 first, and it narrows the category C sharply

Case 6 was the architectural control, so it ran before any design work. It
**passes**, and passing changes what the defect is.

## The correction to my own report

I described the category C as "transaction rollback uses the history log as its
dependency ledger". That was too broad. Measured:

```text
transactions() + timeTravel()   rollback refuses  kind 'later-confirmed-dependency'
transactions() ALONE            rollback refuses  kind 'later-confirmed-dependency'
                                                  ^ IDENTICAL
```

`transactions()` is **not affected**. It admits its pending turn into a LOCAL
`TurnStore` built from its own captured effects (`transactions.ts` ~1023), so its
dependency question never consults the restoration history. The required
ownership property holds:

```text
transactions()  does NOT require timeTravel()
```

## What the defect actually is

`timeTravel()` ships its own `transaction()` — `TimeTravelMethods extends
TransactionMethods` — and it is a **different implementation** from the
`transactions()` enhancer. Its rollback plan comes from
`getPendingRollbackPlan()`, whose first line is:

```ts
const laterEffects = this.history
```

That is the restoration history. Under opt-in, ordinary authored writes are not
admitted to it, so `laterEffects` is empty, the dependency is invisible, and the
rollback proceeds. All 7 refusal tests that stopped throwing install
**`timeTravel()` only** and call `store.transaction(...)`.

So the conflation is real, and narrower and more tractable than first reported:

```text
NOT      "transactions use history as their ledger"
BUT      "timeTravel's own transaction API uses history as its ledger, while the
          transactions() enhancer already does it correctly"
```

## Which means the reference implementation already exists

The split does not need inventing. `transactions()` demonstrates it:

```text
pending turn + its own captured effects  ->  local TurnStore  ->  dependency answer
                                             never the history
```

The repair is to stop the `timeTravel()` path substituting the admitted history
for a causal record it should keep itself. What it still needs, and does not have
under opt-in, is the LATER effects — those turns are no longer retained anywhere
once they stop being admitted. That is where the bounded ledger comes in, with
the lifetime already proposed:

```text
no pending transaction              retention = zero
one or more pending transactions    retain causal facts back to the oldest
                                    transaction that could still legally roll back
transaction settles                 release what no live transaction can ask about
```

Payload is identity and effect facts — sequence, origin, affected
positions/subjects/locations, structural dependency facts. Not snapshots, not
inverses, not claims, not a cursor, not a user-facing entry. A correctness
projection, not a second history.

## Still to derive before implementing

Cases 1, 2 and 5 are now partly answered by the case-6 evidence (1 and 2 are
pinned in `tx-ledger-0.spec.ts` against `transactions()`, including the control
that an UNRELATED later write leaves rollback legal — so the ledger is not merely
"something happened"). Two remain open and both decide ledger admission:

```text
3  pending transaction -> later REALIZATION depending on speculative state
   Does rollback have to refuse? Decides whether admission is by authorship or
   by causal effect regardless of origin. A server refresh landing mid-optimistic
   -transaction is the real-world shape.

4  pending transaction -> dependency created -> that dependency then REVERSED
   Does rollback become legal again? Decides whether the projection may be
   monotonic or must reason about current state.
```

Neither is assumed. In particular "all authored turns" is NOT pre-registered as
the admission rule — the question is *which causal origins can create or remove a
rollback dependency*, and authored/realization/restoration get falsified
separately.

## Relationship to DIAG-JOURNAL, kept explicit

One event source, three projections, different owners and different retention:

```text
CAUSAL TURN FEED
   |
   +- transaction dependency projection   correctness, shortest legal retention
   +- restoration projection              designated turns only; claims,
   |                                      inverses, cursor
   +- diagnostic projection               later; bounded observation, no
                                          restoration rights
```

The transaction ledger must not become the DevTools journal, and DIAG-JOURNAL
must not become a second restoration authority. The feed is what both were
missing; it is not itself an inventory.

# TX-SURFACE-0 — does `timeTravel().transaction()` deserve to exist?

> **Null: it has no independently owned public role and should be deleted in
> favour of `transactions()`.**

Audited rather than repaired, on the evidence that it is the less correct of two
implementations of one public concept.

## The evidence for deletion

**The documented owner is already `transactions()`.** The core README says so:

> For optimistic workflows, `transactions()` adds an explicit tree-local
> transaction boundary.

`timeTravel()`'s copy is undocumented duplication that arrives via
`TimeTravelMethods extends TransactionMethods`.

**No production consumer.** TruckTrax has no SignalTree `.transaction()` call at
all — every hit is bundled IndexedDB/localForage code.

**It is the incorrect one.** TX-LEDGER-0: its `getPendingRollbackPlan()` reads
the restoration history as its dependency source, so under opt-in it stops
refusing unsafe rollbacks. `transactions()` reads its own captured effects and is
unaffected.

**The target ownership story already composes, TODAY, under `'designated'`:**

```text
ordinary transaction                    commits, NOT undoable
undoable(() => transaction(...))        commits as ONE undoable turn; undo reverses it
```

Both pinned in `tx-surface-0.spec.ts`. That is the whole model working with no new
machinery:

```text
transactions()  groups authored work
undoable()      admits the resulting causal turn
timeTravel()    restores admitted turns
```

## Two things that did NOT turn out to be problems

**Enhancer order does not change the answer.** `[transactions(), timeTravel()]`
and `[timeTravel(), transactions()]` both refuse with
`later-confirmed-dependency`. I expected a possible order-dependent
overwrite — "whichever enhancer was listed last wins" would have been
release-blocking on its own. It is not happening.

**`timeTravel()` alone is correct today.** Under the current `'all'` default its
history contains the later writes, so its dependency check works. The defect is
latent and only surfaces under opt-in, which is why the flip found it and nothing
before it did.

## Migration cost, counted

```text
time-travel.spec.ts               ~46 transaction() calls, timeTravel only
history-step-adapter.spec.ts        9 calls, timeTravel only
time-travel-contract.typing.spec.ts 1 call
```

All migratable by adding `transactions()` to the enhancer list. No product code
changes.

**Disposition: DELETE, pending confirmation.** `TimeTravelMethods` stops
extending `TransactionMethods`.

---

# TX-LEDGER-0 cases 3 and 4 — asked of the owner

Run against `transactions()`, since that is where rollback lives. Pinned in
`tx-ledger-0-cases34.spec.ts`.

## Case 4 — the projection is MONOTONIC, and that is fine

```text
pending add 'a'
authored update a.name = 'Edited'      dependency created
authored update a.name = 'Alpha'       the effect is reversed by hand
rollback                            -> still REFUSES
```

Once a dependency exists it stands. This is the conservative direction: it can
refuse a rollback that would in fact have been safe, but never permits one that
is not. **Recorded as the decision**, so a future ledger does not need to reason
about current state in order to be correct.

## Case 3 — ⚠️ a FINDING: admission is by AUTHORSHIP, and a realization is discarded

```text
pending add 'a'                             speculative row
realization update a.name = 'FromServer'    a server refresh lands mid-transaction
rollback                                 -> PROCEEDS, and removes the row
```

A realization creates no rollback dependency, so the rollback deletes a row the
server had just written to.

**This is RESTORE-P0 P0-C one layer up.** There, undo overwrote a realization;
here, rollback deletes a row a server refresh had confirmed. Same shape: a
reversal discarding truth the reversing authority does not own.

Not repaired here, deliberately — it *is* the ledger-admission question. Deciding
it decides the rule:

```text
admission by AUTHORSHIP        today's behaviour; a mid-transaction server
                               refresh cannot protect speculative state
admission by CAUSAL EFFECT     a realization touching speculative state makes
                               rollback unsafe, matching how P0-C resolved
                               the same conflict for undo
```

The P0-C precedent argues for the second, and for the same remedy — refuse rather
than destroy. But it is a semantic decision with a cost (more refused rollbacks),
so it is recorded as open rather than assumed.

# TX-SURFACE-0 execution — DELETE is right, and it is BLOCKED

The deletion was executed and then reverted, because carrying it out surfaced a
requirement rather than test debt. HEAD stays green at 1793.

## What executing it proved

```text
remove TimeTravelMethods extends TransactionMethods   builds clean
remove the 91-line duplicate transaction()            builds clean
migrate the specs to install transactions()           58 failures -> 20
```

Those last 20 are **not** migration debt. Measured:

```text
status.set('queued-before')
transaction(() => rows.addOne({ id: 17 }))     pending, NOT confirmed
other.set('queued-after')

confirmed history now contains THREE entries:
  ['status']   before-write
  ['rows']     <- THE PENDING ROW, in CONFIRMED history before confirm()
  ['other']    after-write
```

A speculative row reaches the confirmed restoration history before the
transaction is confirmed. Reproduced in **both** enhancer orders, so it is not
ordering.

## Root cause, and why the fix is a protocol rather than a patch

```ts
// time-travel.ts
const resolveTransactionId = (meta) =>
  typeof meta?.transactionId === 'number' &&
  meta.transactionOwner === transactionOwnerToken   // <- ITS OWN private token
    ? meta.transactionId
    : undefined;
```

`transactions()` does stamp `transactionId` and `transactionOwner` on the ambient
write context, and time-travel does have a pending bucket to route them into. But
it only recognises transactions bearing **its own** token. With its duplicate
`transaction()` deleted, nothing ever carries that token, so every
transaction-tagged write falls through into confirmed history.

The obvious minimal fix — honour any foreign owner — was tried and **measured
worse**: 20 failures became 34. Correct, in hindsight: routing pending writes
into a bucket is only half a protocol. Nothing tells time-travel when a foreign
transaction CONFIRMS or ROLLS BACK, so the bucket never drains.

And no such channel exists. `__transactions` is an inspection surface
(`getConfirmedTurnCount`, `getPendingTurnCount`), not a notification one.

## So the causal-turn feed is a REQUIREMENT, not a preference

The feed sketched for the ledger split turns out to be what this deletion needs
first, in its narrowest form — a pending-turn lifecycle announcement:

```text
transactions()  announces  turn opened (pending)
                           turn confirmed
                           turn rolled back
                              |
                              v
        any causal-turn consumer, time-travel included
```

That is strictly smaller than a dependency ledger and strictly smaller than a
journal. It is the thing that lets one authority own transactions while another
observes their lifecycle — which is the ownership model, stated as code instead
of as a diagram.

**Disposition unchanged: DELETE.** It is sequenced behind the announcement
protocol rather than abandoned.

## A correction to TX-SURFACE-0's own report

I recorded "enhancer order does not change the answer" from a probe where both
orders returned `later-confirmed-dependency`. That was too strong. The **answer**
agreed; which **implementation** produced it did not — in
`[transactions(), timeTravel()]` the later-installed time-travel method
overwrote the earlier one. Both were correct under the `'all'` default, so the
probe could not distinguish them, and I read agreement as absence of a collision.

The duplication WAS order-sensitive in exactly the way that made it worth
deleting; my probe was simply blind to it. The test at
`time-travel.spec.ts:1113` — *"keeps transaction authority singular for composed
transactions() + timeTravel()"* — was, all along, exercising time-travel's
implementation rather than the composition it names.

# TURN-FEED-0 — pre-registered, and deliberately narrower than its name

The TX-SURFACE-0 deletion earned exactly one thing: a way for a transaction
owner to announce a lifecycle, so another authority can observe it without
sharing the owner's private token.

## SCOPE CONSTRAINT, pre-registered

> **TURN-FEED-0 carries transaction LIFECYCLE, not a general stream of mutation
> effects. C3 may widen it only if `transactions()`' existing effect capture
> proves insufficient.**

Recorded because the temptation is obvious and wrong: DIAG-JOURNAL will
eventually want every causal effect, so it is tempting to build that stream now.
That would jump from a three-event protocol that has been falsified into an
architecture that has not.

```text
TURN-FEED-0             transaction lifecycle only          <- earned
TX dependency ledger    effect observation for rollback     <- C3, maybe
                                                               inside transactions()
DIAG-JOURNAL            whole causal observation            <- not yet earned
```

## The protocol

Internal. The identity is the PAIR, which is what preserves the reason
`transactionOwnerToken` existed without making every consumer share it:

```text
(owner, transactionId)

  opened       a transaction is accepting writes
  confirmed    its writes become part of the causal record
  rolled-back  its writes never happened
```

`timeTravel()` stops asking *"is this MY transaction?"* and starts asking *"does
this write carry a recognised ACTIVE transaction identity?"*.

**The lifecycle signal does not grant restoration rights.** That separation is
the whole point, and it gets its own control:

```text
transaction(...).confirm()                designated mode -> NO restoration entry
undoable(() => transaction(...).confirm())               -> exactly ONE turn
```

If a confirmed transaction becomes restoration history on its own, the protocol
has recreated the conflation the flip exposed.

## Six cases

```text
1  PENDING ISOLATION     writes while pending never appear in confirmed
                         restoration history
2  CONFIRMATION          observed exactly once, no duplicate turn, and admission
                         still decided by undoable()
3  ROLLBACK              the observer's bucket disappears; zero restoration
                         entries, zero restoration claims
4  SURROUNDING WRITES    write A / transaction / write B stay distinct causal
                         turns, no cross-bucket contamination
5  ENHANCER ORDERING     both orders behave identically once the duplicate
                         transaction() is gone
6  OWNERSHIP             transactions() alone unchanged; timeTravel() alone has
                         NO transaction() API
```

Case 6 is the one that proves the deletion rather than merely making the composed
path green.

## A reusable audit rule from the correction

> **When two enhancers expose the same public method, equal output does not prove
> composition. Prove which implementation owns the call.**

My order probe compared answers, got agreement, and concluded there was no
collision — while the later-installed enhancer was silently overwriting the
earlier method, and both were correct under the old default so the outputs could
not disagree.

# THE SECOND FLIP — C = 0

Flip-only again: one line, `git diff --stat` showing `1 insertion(+), 1
deletion(-)`.

```text
initial failures   194 across 39 files      (first flip: 211 across 37)

A = 194
B = 0
C = 0      <- the result the first flip could not support
U = 0
```

## The first flip's category C is gone, not compensated for

The seven `rejects rollback …` tests that stopped throwing under flip 1 were the
whole category C. Five such tests exist now, after the TX-SURFACE-0 migration,
and **all five pass under the flip**. Nothing was added to make them pass; the
mechanism that made them fail was deleted:

```text
timeTravel().transaction()          DELETED — it read this.history as its
                                    dependency ledger
getPendingRollbackPlan()            DELETED with it
transactions() admission            now by causal EFFECT, not authorship (C3)
```

## Why C = 0 is asserted from the whole set, not a sample

Flip 1's A count was sampled and I said so. This one is classified by cause
shape across all 194, with the one risky shape enumerated exhaustively.

The distribution is uniform: `canUndo` false, counts short, `[]` where a
restored value was expected. Every shape reduces to *the operation was not
designated, so no turn exists*.

The shape that could hide a C is **"expected [Function] to throw an error"** — a
refusal that stopped firing, which is exactly how flip 1's C presented. All 15
were read individually:

```text
P0-C / P0-C-ROW refusals          undo vs later external truth
non-scalar-leaf undo refusals     ARRAY / DATE / MAP / SET leaves
port + closure refusals           unsupported effect in a closure
```

Every one needs an **admitted turn to refuse**. The refusal machinery is intact;
it has nothing to refuse because the operation was never admitted. None protects
anything other than restoration, which is what separates them from flip 1's
rollback cluster.

## Two things that resolved themselves

**`tree-realization-adapter.spec.ts`.** Flip 1 recorded it as failing 3× in the
full run and passing alone, suspected test-order coupling, explicitly left
unexplained. It is the same designated-mode count difference as everything else —
plain A. The suspicion was wrong and the honest record of it was worth keeping.

**My own protocol specs.** `turn-feed-0` (2) and `turn-feed-0-1-identity` (1) fail
because they assert history counts without requesting designated mode. The cases
that DO request it — case 2's separation control, case 3's designated turn — pass.
So the lifecycle protocol is orthogonal to admission, which is the property it
was built to have.

## What C = 0 actually establishes

Not "the default changed". This:

> **Nothing inside SignalTree requires an arbitrary authored operation to be
> retained as user-restoration history.**

Three concepts that shared storage and mechanisms are now separate:

```text
causal occurrence          every write, observed where it is needed
transaction dependency     bounded, pending-scoped, origin-independent (C3)
restoration eligibility    designated operations only (undoable)
```

# HIST-C2 — CLOSED

## The evidentiary chain

```text
first flip            exposed a category C
TX-SURFACE-0          deleted the duplicate transaction authority
TURN-FEED-0           supplied the missing lifecycle protocol
TX-LEDGER C3          separated dependency from authorship
second flip           A=194  B=0  C=0  U=0
A migration           194 -> 0, six green batches
permanent flip        green
restorationEligibility deleted   green again
```

Final state verified by EXIT CODE, not by reading output: tests 0 (1811 passed),
lint 0, build 0, spec-types 0, fast gates 0 (35/35).

## The claim, now earned rather than intended

> **Arbitrary authored writes are causal state changes, not restoration history.
> Restoration exists only where the application designates an operation as
> undoable. No SignalTree subsystem depends on the old default-all restoration
> inventory.**

Three concepts that previously shared storage and mechanisms are separate:

```text
causal occurrence          observed where it is needed
transaction dependency     bounded, pending-scoped, origin-independent
restoration eligibility    designated operations only
```

## What the migration itself proved

**19 false designations were reverted.** Wrapping compiled and passed in every
one of them, and meant nothing, because the receiver was a `Map`, a physical
scalar frame, a cache, a storage adapter, or a benchmark harness driving
`EntityValueStore`/`StructuralStore` with no tree at all. Mechanical wrapping is
fine for volume; only reading what it wrapped shows whether a designation says
anything. The audit caught these twice, at different scales.

**A runtime fix, not test cleanup.** `markMetaDesignated`'s spread was
materialising absent metadata keys as explicit `undefined` in every delivered
write. MUT-2 caught it because it asserts that shape exactly. Recorded here
because the closing summary would otherwise read as "tests only", and it was not.

**MUT-2 was nearly destroyed by the migration.** Its finding is that authorship
is NOT positively marked; designating its write added a positive marker and
erased that. Reverted, with the designated case added as a separate test, which
left the result sharper: authorship remains unmarked, designation is marked, and
they are different properties.

**Two documented defects are repaired by the flip rather than by a fix.**

```text
6c       deserialize() no longer becomes an undo step, so no first undo can
         discard a restore
CASE 8   an untagged background refresh no longer enters the undo stack
```

Both had to land WITH the flip: designating those operations to green them early
would have reintroduced the defects.

## ⚠️ What the flip did NOT settle — A1 stays on the board

CASE 8's repair is narrower than it looks, and the spec says so in place:

> acquisition is still INDISTINGUISHABLE from an authored write. It just no
> longer MATTERS **for restoration admission**, because neither is admitted
> without designation.

Another subsystem already needs that distinction: TX-LEDGER C3 treats a
classified realization as external truth when deciding whether a rollback is
safe. So the narrow public realization-ingress door A1 identified is **not**
disposed of by HIST-C2, and TruckTrax's loader/acquisition path may still need
it. A1 remains open with its own terminal disposition.

## Remaining sequence

```text
1  DIAG-JOURNAL
2  PER-B                       (owns the stored().reload() question below)
3  A1 realization ingress — terminal disposition
4  MATRIX-CLOSE
5  Candidate B, only if materially different
6  TruckTrax pass 2
7  TruckTrax pass 3
8  final perf / retention measurements
9  FULL release gate suite — `--fast` closes a workstream, not a release
10 RC / final closure
```

## Carried, not dropped

```text
stored().reload()   currently designatable, but it re-reads DURABLE truth, which
                    makes it closer to a restore than an authored operation — and
                    6c establishes that a restore must not become an undo step.
                    PER-B decides; flagged in place in the spec.
raw-NUL harness     a cheap syntactic gate rejecting raw NUL and unexpected C0
                    controls in tracked sources. Earned by a real incident: an
                    invisible NUL byte reached committed source, propagated into
                    the script written to fix it, and was found only because
                    Python refused to parse it. No correctness gate can see it.
rollback message    transactions()' compensation path surfaces the wrapped
                    error's message rather than the underlying refusal kind, so
                    a refusal reason is less legible than before TX-SURFACE-0.
```

**Not to be reopened absent new falsifying production evidence.**

# DIAG-JOURNAL-0 — inventory first. Disposition: **B**

> **NULL: can DevTools observe every causal turn without that observation
> becoming another restoration authority or retention owner?**

Audit, not implementation. No journal object and no new seam were added; this
measured what the EXISTING seams expose at the point a turn is complete.
Pinned in `diag-journal-0-inventory.spec.ts` (7 cases).

## SCOPE CONSTRAINT, carried forward from TURN-FEED-0

> **TURN-FEED remains transaction-lifecycle-only. DIAG-JOURNAL may CONSUME it
> and may not WIDEN it. If causal effects cannot be observed elsewhere, that is
> evidence for a separate narrow observation seam — not permission to smuggle an
> effect bus into transaction lifecycle.**

Also pre-registered: interactive time travel is OUT of scope here. Prove
read-only observability first. The journal must never acquire `restore()`,
`apply()`, `undo()` or equivalent; a later "jump to this point" routes through the
single restoration authority or is refused where no legal restoration exists.

## What already works — six of eight cases need nothing

```text
1  ordinary authored write      observable, and creates ZERO restoration history
2  designated write             same KIND of occurrence; eligibility is an
                                ATTRIBUTE (`restorationDesignated`) rather than a
                                separate diagnostic mechanism
3  realization                  distinguishable via `causalMode`, and acquires no
                                restoration right by being seen
4  transaction identity         `transactionId` rides on the write, so a
   + 5 grouping                 projection groups without inventing a boundary.
                                The four PHASES are not on the write — they are on
                                the TURN-FEED channel, which is exactly why a
                                journal must consume that channel rather than
                                infer phases from effects
8  turn boundary                the FLUSH is observable via `onFlush`, so a
                                projection takes its boundary from the engine
                                instead of guessing a finer one
```

## ⚠️ CASE 7 — the one missing fact

A restoration is **indistinguishable from external truth** at the observation
seam. Measured:

```text
tree.undo()  ->  every delivered write carries causalMode 'realization'
                 and NONE carries source 'time-travel'
```

So a diagnostic projection can see that something happened and can see it was
non-authored, but cannot say *this was a restoration* rather than *this was a
server refresh*.

Not a new discovery so much as a third sighting of the same gap:

```text
MUT-2      recorded the symptom — "REDO is also marked realization"
P0-C       had to work around it with an explicit suppression set, because a
           restoration's own writes were being banked as external truth
DIAG-J-0   needs it as a POSITIVE fact, not a workaround
```

That is the whole of the B: one fact, restoration ORIGIN, at a seam that already
carries origin for everything else.

## Ownership falsifiers — the half measurable without a journal

```text
notifier payloads are VALUES, not live nodes    nothing delivered is callable, so
                                                retaining it cannot pin a subject
                                                graph
subscribing changes no restoration state        history length and canUndo
                                                unchanged; an undesignated write
                                                stays unadmitted while watched
```

The other half — a removed entity whose only remaining reason to exist is the
journal — needs a journal to measure and belongs to DIAG-JOURNAL-1, with the
representation rule as its design constraint: retain DESCRIPTIONS of causal facts
(sequence, origin, phase, paths, position and subject identifiers as values,
effect summaries, transaction identity, designation flag, outcome), never live
signals, tree nodes, capture buckets, turn stores, snapshots, claim handles, or
closures capable of reversal.

## ⚠️ A pre-existing finding, out of scope but not to be lost

`devTools()` already implements `JUMP_TO_STATE` / `JUMP_TO_ACTION`, and applies
whole-tree state directly through `applyState()` under
`withWriteContext({ intent: 'system', source: 'devtools' })`. It does not route
through `timeTravel()`.

So a second state-application path already exists, and under opt-in eligibility
it applies snapshots that were never designated — bypassing admission entirely.
Its in-source rationale is deliberate and worth reading (scrubbing a timeline is
INSPECTION, so `source: 'devtools'` keeps `stored()` from rewriting localStorage),
so this is not an accident. But it is exactly the shape the DIAG-JOURNAL
pre-registration forbids for the journal, and the rule cannot be "the journal may
not, while the neighbouring enhancer already does" without that being a stated
decision.

Recorded as its own question rather than folded into this one. It does NOT make
DIAG-JOURNAL-0 a category C: nothing about OBSERVATION requires it.

## Disposition

```text
B — existing facts are sufficient except for restoration origin.
    Add the narrowest internal observation seam that supplies it, then build the
    read-only projection on top of seams that already exist.
```

Nothing here justifies a second inventory, a second reversal authority, or
widening TURN-FEED.

# SEMANTICS-NAMES-0 — the falsifier fires, and it reorders the queue

> **FALSIFIER: if a single `origin` axis cannot represent the measured
> distinctions without losing a genuinely independent dimension currently carried
> by `source` or `causalMode`, the consolidation is wrong.**

## What each field actually DECIDES

Read from consumers, not from names.

```text
causalMode      ADMISSION   does this enter restoration history, or a
   ('authoring'             transaction's confirmed effects?
    'realization')
                COALESCING  may this batch with a neighbouring write?
                            (path-notifier's semantic-identity check)

                -> "how does this participate in authored causal semantics?"

source          FILTERING       skip my own output (time-travel and
   ('time-travel'               transactions both early-return on
    'devtools'                  source === 'time-travel')
    'system' …)  SIDE EFFECTS   `stored()` declines to persist a write whose
                                source is 'devtools' — scrubbing a timeline is
                                inspection, not a storage edit
                LABELLING       the devtools timeline names the action

                -> "what originated this application?"
```

Two different questions. `causalMode` is a poor name for the first — it says
nothing about which dimension it represents — and `source` is a reasonable name
for the second.

## The measured combination space

Pinned in `semantics-names-0.spec.ts`:

```text
origin         participation    what it is
-------------  --------------   ---------------------------------------
null           null             ordinary authored write
null           realization      external truth (server, storage)
time-travel    realization      restoration (undo / redo)
devtools       null             a devtools state application  <-- !!
```

**The falsifier FIRES.** `devtools` carries a non-default origin with DEFAULT
participation, so the two fields vary independently today and a single `origin`
axis cannot carry the space.

## But the independence is contingent, not structural

That fourth row exists because `devTools()` applies `JUMP_TO_STATE` /
`ROLLBACK` / `IMPORT_STATE` in AUTHORING participation — it sets
`{ intent: 'system', source: 'devtools' }` with no `causalMode` at all.

Whether that is right is **exactly DEVTOOLS-JUMP-0's question.** If a devtools
application is decided to be realization-participating — which it arguably is,
since nobody authored it — the space collapses:

```text
null           null             authored
null           realization      external
time-travel    realization      restoration
devtools       realization      devtools
```

### ⚠️ CORRECTION — that collapse does not follow, and I claimed it did

I wrote that flipping the devtools row makes participation derivable —
*authored iff origin is absent*. **That is wrong**, and the table I had just
recorded refutes it:

```text
null           null             authored
null           realization      external truth      <-- SAME origin,
                                                        DIFFERENT participation
```

External truth has no positive origin either. So even with devtools flipped, one
absent origin maps to two participations and the model stays two-axis. DevTools
was never the only thing preventing a one-axis model.

The real blocker is that `origin` is **incomplete**: there is no positive value
for external truth. Which is suspiciously close to the unresolved A1
realization-ingress problem — an external write has no public door that could
stamp its origin in the first place.

> **So DEVTOOLS-JUMP-0 must NOT be asked to answer the one-axis question. It
> answers only what a DevTools jump IS. The axis question needs `origin` to be
> complete, and completing it may require A1.**

Doing SEMANTICS-NAMES first would mean either freezing a two-axis ontology on the
strength of a behaviour nobody has ratified, or collapsing to one axis by
silently deciding DEVTOOLS-JUMP in passing. Neither is a naming decision.

## ⚠️ A latent consequence of that fourth row, worth its own look

A devtools state application is currently treated as AUTHORED for admission and
coalescing. Under opt-in that is harmless for restoration — it is not designated,
so it cannot enter restoration history. But `transactions()` admits authored
writes into a transaction's captured effects, so a devtools scrub performed while
a transaction is pending would be captured as part of that transaction's
contribution.

Not measured as a live defect here, and not fixed here. Recorded because
DEVTOOLS-JUMP-0 should decide it deliberately rather than inherit it.

> **MEASURED SINCE, in DEVTOOLS-JUMP-0.** Contribution capture does not in fact
> occur for a scrub landing after the callback returns — but the DEPENDENCY
> LEDGER does admit it, and a devtools scrub therefore REFUSES a rollback. The
> suspicion above was right in kind and wrong in mechanism.

## Recommended vocabulary — pending that decision

The renames the audit supports on evidence:

```text
causalMode  ->  participation   [SUPERSEDED: was participationMode]
                the field decides PARTICIPATION in authored causal semantics;
                `causalMode` names no dimension at all

source      ->  origin
                already the right question; `origin` says so, and `cause` /
                `causation` must stay reserved for the dependency relation
                TX-LEDGER owns
```

`realization` survives as a VALUE. The audit supports the reading that the
mistake was the field name rather than the word: *apply this as established truth
rather than as newly authored work* is a coherent participation mode that
restoration and external truth can legitimately share, precisely because origin
now distinguishes them.

```text
{ origin: 'restoration', participationMode: 'realization' }
{ origin: 'external',    participationMode: 'realization' }
```

Those are no longer contradictory. They say: different origins, deliberately
shared application semantics.

## `timeTravel()` -> `restoration()`

Supported, and the strongest argument is the inversion this audit surfaced:

```text
timeTravel()   a constrained restoration authority — designated turns only,
               bounded retention, refusal on divergence, no arbitrary jumping
devTools()     contains the actual arbitrary snapshot jumping
```

The subsystem named "time travel" is the one that cannot travel to arbitrary
points, and the one that can is called something else. `restoration()` also makes
the surrounding vocabulary cohere with terms already shipped —
`undoable()`, restoration history, restoration claims, restoration origin — and
avoids `history`, which this audit has already proved dangerously overloaded
(restoration history, diagnostic history, causal history, dependency evidence).

**Not executed here.** It is a public rename and a terminal naming disposition;
recorded as recommended with its evidence.

## Revised order

```text
1  DEVTOOLS-JUMP-0     restoration vs inspection-state application. NOT the
                       one-axis question — see the correction above
2  SEMANTICS-NAMES-1   execute the ontology on a settled space
3  DIAG-JOURNAL-1      read-only bounded projection + reclamation falsifiers
```

> **SUPERSEDED by DEVTOOLS-JUMP-0's terminal disposition.** The names are now
> settled (`participation` / `origin` / `restoration()`), the ontology is settled
> as two-dimensional, and the only remaining blocker on EXECUTING the rename is
> A1's positive external origin. See "SEMANTICS-NAMES — the terminal names".

# DEVTOOLS-JUMP-0 — the evidence points at **D**

> **What kind of state application is a DevTools jump, and what invariants apply?**

```text
A  authored participation — current semantics intentional
B  realization participation
C  it is RESTORATION and must route through the restoration authority
D  a distinct INSPECTION application, needing its own participation semantic
U  evidence does not discriminate
```

Measured in `devtools-jump-0.spec.ts`. The discriminating evidence is the
transaction interaction, not the philosophy.

## The finding

```text
pending transaction adds row 'a'
devtools scrub updates that row
rollback                          ->  REFUSED, later-confirmed-dependency
                                      the speculative row survives
```

**A diagnostic inspection blocks a business rollback.** A developer moving a
DevTools slider has changed what the application is permitted to do. That is a
wrong ownership relationship whatever the participation is called.

## Why this rules out B as well as A

Flipping devtools to realization participation does **not** fix it. TX-LEDGER C3
deliberately admits later effects by causal EFFECT regardless of origin — that
was the whole point of C3, and it is right for server truth. A devtools scrub
would therefore still create dependency evidence and still block the rollback.

Only a participation EXCLUDED from dependency admission fixes it. That is D.

And B has a second cost, in the other direction. P0-C protects later external
truth from being discarded by an undo, and it protects it by recording
realization-participating writes. Today a devtools write is authored-participating
and therefore unprotected — measured: an undo overwrites a scrub, which is correct
for inspection. Reclassify it as realization and it becomes protected, meaning
**an inspection action could refuse a legitimate undo.** B trades one wrong
ownership relationship for another.

## What C would cost, and why it is not indicated

Routing a jump through the restoration authority would require it to satisfy
designation, validity, refusal and claim semantics. But a scrub is not asking
*reverse one previously designated operation legally*; it is asking *show the tree
as this snapshot*. Most jump targets were never designated at all, so the
authority would have to refuse nearly every one — which is not a DevTools feature,
it is its removal.

So the "single restoration authority" rule is **not violated** by DevTools having
its own application path. It would be violated only if DevTools claimed to be
performing restoration. It does not; it never did.

## Proposed invariants for D — inspection-state application

```text
origin           devtools
participation    inspection  (a third value, not authored and not realization)
                 -> excluded from restoration admission
                 -> excluded from transaction dependency admission
                 -> excluded from transaction contribution capture
                 -> not protected from being overwritten by restoration
                 -> does not persist  (already true: stored() declines it)
                 -> never claims to be undo/redo
```

Every line except `participation` is either already true or already measured, so D
is mostly a matter of NAMING what is happening and closing the one hole.

## One thing this audit did NOT reach

The scrub in the transaction case lands AFTER the transaction callback returns, so
it is not captured into the contribution — and the reason is incidental rather
than designed: `withWriteContext` REPLACES the ambient context, so no
`transactionId` is in scope. A scrub landing DURING a transaction callback is a
different question, and this file does not answer it. Recorded rather than
assumed.

## Disposition — TERMINAL

> **DevTools state application is INSPECTION: not authorship, not realization,
> and not restoration.**

Confirmed by the owner. The decisive argument is not that a jump is
"non-authored" — it is that BOTH existing participations grant it authority it
should not have. Authored lets a scrub create transaction dependency evidence and
veto a rollback; realization would additionally make P0-C protect the scrub
against a legitimate restoration.

The conservative-refusal counter-argument is rejected on a stated principle:

> C3's conservative refusal is correct for **truth or causal consequences that
> another authority has a right to preserve.** A diagnostic snapshot has no such
> right. The fact that the developer looked at state B cannot itself make
> application rollback from C to A illegal.

# The ontology is TWO-DIMENSIONAL — settled

Not "two axes until one can be derived from the other". Two axes, permanently,
because they answer different questions:

```text
origin          Where did this application come from?
participation   How may this application participate in SignalTree's causal
                mechanisms?
```

DEVTOOLS-JUMP makes the second unmistakably a POLICY dimension:

```text
participation: authored     participates as application-authored work

participation: realized     established truth / consequence, not newly
                            authored; eligible for external-truth dependency
                            and provenance treatment

participation: inspection   diagnostic state application; not application work,
                            not authoritative external truth, not restoration;
                            excluded from business dependency and capture
```

**Even if a function could someday compute participation from origin, the
concepts do not merge.** That would recouple provenance to policy — the exact
compression this audit has repeatedly had to undo. The one-axis question is
therefore not deferred; it is closed as the wrong question.

The earlier correction stands and is now doubly grounded: external realization
still has no positive origin, so the one-axis claim was premature on the facts as
well as wrong in principle.

# SEMANTICS-NAMES — the terminal names

Settled by the owner. Field and value names, not `participationMode`:

```ts
type Participation = 'authored' | 'realized' | 'inspection';
```

```text
causalMode   ->  participation
source       ->  origin
timeTravel() ->  restoration()
```

```ts
{ origin: 'restoration', participation: 'realized'   }
{ origin: 'external',    participation: 'realized'   }
{ origin: 'devtools',    participation: 'inspection' }
```

The field and value now read as an answer to a specific question, which
`causalMode: 'realization'` never did.

`timeTravel()` -> `restoration()` is settled and STRENGTHENED by this
disposition: there are two distinct capabilities, and the one that does the
arbitrary jumping is the one NOT called "time travel". A1 concerns external
origin, not restoration ownership, so it is very unlikely to contradict this.

**Blocked on A1 for one thing only:** the exact `origin` VALUE SET — what
ordinary application origin is called, and how external truth comes to carry
`origin: 'external'` when it has no public door to declare itself through. The
rename executes after A1 settles that, and not as another audit.

# DEVTOOLS-JUMP-0.1 — implemented, and the acceptance the owner asked for

Two holes remained after the disposition. Both are now closed and pinned in
`devtools-jump-0-1.spec.ts`.

## Hole 1 — the exclusion from contribution was incidental

DEVTOOLS-JUMP-0 only measured a scrub landing AFTER the callback returned, where
exclusion holds because `withWriteContext` replaces the ambient context and drops
the `transactionId`. The synchronous-in-callback case was never measured.

```text
transaction callback begins
  authored speculative write        addOne('a')
  DevTools inspection DURING it     asDevtools(() => n.set(42))
callback completes
rollback
```

```text
MEASURED   rollback succeeds; row 'a' gone; n stays 42
```

Excluded, now for a declared reason: both capture sites return before any bucket
is touched, whether or not a `transactionId` is in scope. The in-callback scrub of
the SPECULATIVE row also no longer refuses.

## Hole 2 — dependency admission

```text
BEFORE   pending addOne('a'); devtools scrub of 'a'; rollback
         -> REFUSED later-confirmed-dependency, row survives

AFTER    -> rollback succeeds, row gone
```

With a control in the same file: **the identical write in realization
participation still refuses.** Same write, same timing, different participation —
so the exclusion is the participation doing the work, not the timing, and C3
remains intact for the case it was built for.

## The pin the owner asked for — inspection is not a causal eraser

> An inspection write itself cannot create business dependency evidence. A later
> independently authored or realized consequence of that inspection is classified
> on its own terms and may create dependency evidence.

```text
pending addOne('a')
devtools scrub of 'a'            contributes nothing
authored updateOne('a')          classified on its own terms
rollback  ->  REFUSED, correctly
```

Without this, `inspection` would be a laundering channel: touch a speculative row
through the devtools door, then author freely against it and claim the rollback is
unblocked. Inspection excuses the inspection and nothing downstream of it.

## How it is implemented

`'inspection'` is a third `CausalWriteMode` value, DECLARED by `devTools()` in the
write context it establishes — deliberately not inferred from `source ===
'devtools'`, since inferring policy from provenance is the coupling the two-axis
decision rejects. A named `isInspectionWrite()` predicate makes the exclusion read
identically at every site:

```text
transactions      both capture sites return before bucket capture AND before
                  the C3 probe; the leaf site still notifies
capture bridge    excluded from a transaction draft's contribution
time-travel       records no external truth, enters no history, and does NOT
                  delete an existing external-truth marker — inspection is inert
                  with respect to provenance, so looking at a location cannot
                  release it from another authority's protection
```

Verified by exit code: `nx test core` (1836 passed / 202 files), `nx lint core`,
`npm run typecheck`, `nx build core`, `check-spec-types`, `check-release-claims`,
`lint-readme-apis`, `verify-gates --fast` 35/35 — all 0.

`devtools-jump-0.spec.ts` keeps its ORIGINAL context helper, renamed
`asAuthoredDevtools`, because those findings are the behaviour of that context and
are what closed the disposition. `devtools-jump-0-1.spec.ts` is the acceptance
file for the contract.

# Queue after DEVTOOLS-JUMP-0.1

```text
1  A1 terminal ingress    settle the POSITIVE external origin and the public way
                          external truth declares itself   <-- next
2  SEMANTICS-NAMES-1      EXECUTE the renames; not another audit
3  full verification      the standard set, including build / spec-types / gates
4  DIAG-JOURNAL-1         read-only bounded projection + reclamation falsifiers
```

# A1 TERMINAL INGRESS — PRE-REGISTERED before any implementation

A1-0 already established the finding: core knows how to classify an external
write and applications have no way to say it. `withWriteContext` is enhancer
plumbing and is not in the barrel. A1 terminal owes exactly two answers:

```text
1  What does "external truth" mean as an ORIGIN?
2  What is the narrow PUBLIC operation by which an application declares that a
   write is externally acquired truth?
```

## What A1 may NOT reopen

**Participation.** That external truth is `realized` is settled — C3, P0-C,
HIST-C2 and the shipped runtime all rely on it. A1 is provenance plus an ingress
operation, nothing more.

## Pre-registered semantic target

```ts
{ origin: 'external', participation: 'realized' }
```

Encoded today as `{ source: 'external', causalMode: 'realization' }`; the field
names change in SEMANTICS-NAMES-1, and adding the value here is what lets that
rename be mechanical.

The burden is to prove `'external'` is the right canonical origin name and to
find the public API that establishes it.

## Origin names describe PROVENANCE, not process

```text
process        realization / acquisition       <- how the value was obtained
origin         external                        <- where it came from
participation  realized                        <- how it may take part
```

`acquisition` describes the process and therefore belongs on neither axis.
Pre-registered preference: **`external`**, in a set reading
`application / external / restoration / devtools`.

### Sub-question A1-N — is there a POSITIVE application origin?

The one-axis question is closed, so an absent origin no longer has to
disambiguate anything.

> **FALSIFIER: if any consumer must distinguish "no origin recorded" from
> "application origin", absence is not good enough and every ordinary write has
> to be stamped.** If no consumer needs it, absence stands and we pay nothing.

## Candidate doors

```ts
realize(() => { tree.$.rows.setAll(serverRows); });        // leading
applyExternal(() => { … });
external(() => { … });
```

`realize()` composes with the ontology (`realize(...)` -> `origin: external`,
`participation: realized`) but needs SignalTree vocabulary to read.
`applyExternal()` is more obvious and slightly too mechanical — it sounds like it
applies a supplied value rather than classifying arbitrary contained writes.
`external()` is concise but adjective-like and ambiguous.

Names are tested against real call sites, not taste. `withWriteContext` is not a
candidate: the public door must express the semantic operation, not the mechanism
that encodes it.

## The nine discriminating cases — pre-registered

```text
1  ordinary authored write            origin absent/application, participation authored
2  external ingress                   origin external, participation realized,
                                      ZERO restoration admission
3  ingress during a pending tx        dependency evidence where causally relevant,
                                      NOT an authored transaction contribution
4  ingress after speculative create   unsafe rollback REFUSES
5  unrelated ingress                  rollback remains LEGAL
6  ingress then undo                  later external truth cannot be destroyed
7  nested ingress                     idempotent / deterministic
8  synchronous callback boundary      classification cannot leak outside
9  async work scheduled inside        classification does NOT leak, and the API
                                      must say so rather than inherit whatever
                                      `withWriteContext` happens to do
```

Case 9 is the one PER-0 already drew blood on. The pre-registered answer is the
one `undoable()` gives: **refuse a thenable rather than document the trap.**

## Pre-registered failure conditions

```text
A  a name cannot express a real call site           -> name is wrong
B  case 3/4/5 contradicts C3                        -> the door's context
                                                       handling is wrong
C  case 6 lets an undo destroy external truth       -> the door bypasses P0-C
                                                       and is a second authority
D  case 8/9 leaks classification                    -> boundary is not stated
U  evidence does not discriminate the name          -> ship no door this round
```

A category C halts A1 the way it halted HIST-C2.

# A1 TERMINAL INGRESS — RESULT. `realize()` earns the door

Nine cases, pinned in `a1-ingress.spec.ts`. No pre-registered failure category
fired: no A (the name expresses the call site), no B (C3 intact), no C (P0-C
intact), no D (boundary stated), no U.

```text
case                                      measured
1  ordinary authored write                 origin null, participation null
2  realize()                               origin external, participation
                                           realization, history grew 0
3  ingress inside a tx callback            rollback succeeds, row withdrawn,
                                           acquired value stands
4  ingress on the speculative row          REFUSED later-confirmed-dependency
5  unrelated ingress                       rollback legal
6  ingress then undo                       REFUSED ST1034, external truth stands
7  nested ingress                          one fact, idempotent
8  after the scope                         authored again; ingress never a step
9  async callback                          THROWS ST1035
```

## The door

```ts
realize(() => {
  tree.$.rows.setAll(serverRows);
});
```

`realize()` is exported from the root barrel — the mirror of `undoable()`, and
the second half of the sentence A1-0 said core knew how to classify and
applications had no way to say.

Case 3 is worth reading twice. The context is **merged** onto the ambient one
rather than replacing it, so an ingress inside a transaction callback keeps the
enclosing `transactionId` visible. That matters because DEVTOOLS-JUMP-0 caught
this exact area relying on an accident: replacement DROPS the id, and "excluded
because the id vanished" is not the same fact as "excluded because a realization
does not contribute". Case 3 now measures the second.

Cases 4 and 5 differ only in what the ingress touched, which is the bounded
shape C3 was built for: dependency admission is by causal effect, so an ingress
that touches nothing speculative costs a transaction nothing.

Case 9 answers the question PER-0 drew blood on, the way `undoable()` answers it:
**refuse a thenable (`ST1035`) rather than document the trap.** Acquisition is
asynchronous and belongs to a controller; only the APPLICATION of the result is a
SignalTree event, and that is synchronous. The API states its boundary instead of
inheriting whatever `withWriteContext` happens to do.

## Origin: `'external'`, and A1-N answered

`'external'` is the value. `acquisition` describes the process that obtained the
value and belongs on neither axis.

**A1-N: no positive `'application'` origin.** The pre-registered falsifier did
not fire — `source`'s three consumers (filter my own output, side-effect policy,
labelling) all key on POSITIVE values, so nothing must distinguish "no origin
recorded" from "authored by the application". Absence stands, and the common path
pays nothing.

> ⚠️ But there IS a real muddle next door, and it is not the application default.
> `tree-realization-adapter` publishes with `getActiveWriteContext()?.source ??
> 'system'` at **seven** sites. So an internal write does not fall back to
> absence; it fabricates `'system'`, which the naming grid rightly wants
> deprecated. That is the thing to attack — a fake positive origin, not a
> truthful absent one.

## Demo coverage forced the call site

`check-demo-coverage` failed on `realize` until the demo used it, which is the
"test names against real call sites" requirement enforced by a gate rather than
by taste. The usage added is a **Refresh from server** button beside the existing
`undoable()` Add-todo button in the time-travel demo: the history counter does not
move, and Undo still points at the user's last real operation.

## Adjacent user-facing corrections found on the way

```text
ST1033's runtime message told users to call `reversible(...)`  — a candidate name
                                            that never shipped; now `undoable(...)`
the root barrel recommended `tree.with(a).with(b)`  — deleted in 15.0, so the
                                            advice named a method that no longer
                                            exists; now the declarative form
```

Neither is reachable by any correctness gate, and both are the same failure mode
as the docs staleness this audit keeps finding: prose is not type-checked.

---

# THE v15 NAMING GRID — canonical, with two corrections

The owner's full grid is the target vocabulary. Governing rule: **a name
identifies ONE semantic dimension.** `origin` = provenance. `participation` =
causal policy. `transaction` = speculative grouping. `restoration` = legal
reversal. Diagnostics = observation. None may impersonate another.

```ts
type WriteParticipation = 'authored' | 'realized' | 'inspection';

type WriteOrigin =
  | 'external'
  | 'restoration'
  | 'devtools'
  | 'transaction-rollback'   // exact value pending its consumer audit
  ;                          // no 'application' — see A1-N
```

## ⚠️ Correction 1 — `historyEffect` must NOT become `restorationEffect`

The grid proposes `historyEffect` -> `restorationEffect`, conditioned on "if it
belongs exclusively to restoration". **It does not.** `StructuralHistoryEffect`
is consumed by:

```text
enhancers/transactions/transactions.ts
lib/internals/causal-runtime/greenfield-transactions.ts
lib/internals/causal-runtime/transaction-capture-bridge.ts
lib/internals/causal-runtime/tree-realization-adapter.ts
lib/path-notifier.ts
lib/entity-signal.ts
enhancers/time-travel/time-travel.ts
```

It is the canonical structural effect that BOTH authorities compose — subject-keyed
add/remove/rekey composition (RESTORE-P0 A/B) is shared by restoration reversal
and transaction rollback. Renaming it `restorationEffect` would assert
single-authority ownership the code contradicts, which is the same class of error
as calling a diagnostic write authored.

```text
historyEffect          ->  structuralEffect
StructuralHistoryEffect ->  StructuralEffect
```

The grid's instinct is right — "history" must go — but the replacement is
`structural`, not `restoration`.

## ⚠️ Correction 2 — `isApplyingExternalState` is worse than mis-named

The grid flags it as a rename. It is stronger than that: after DEVTOOLS-JUMP-0
the name asserts the exact thing the disposition denies — that a DevTools
application is external truth. It is a false statement in an identifier, not an
imprecise one. `isApplyingInspectionState`.

## Concurred without reservation

`timeTravel()` -> `restoration()` and the whole vocabulary underneath it
(`TimeTravelMethods`, the `time-travel` folder, `source: 'time-travel'`,
`__timeTravel`, docs) — and the grid's closing instruction is the important part:
**the rename must remove the old ontology, not alias it.** A `restoration()`
export sitting on top of `time-travel.ts`, `getHistory()` and "history step"
preserves the old mental model under a new name, which is worse than not
renaming at all.

`UpdateMetadata` -> `WriteMetadata` (it is a public export, so this is a breaking
rename and belongs in this pre-1.0 window). `causalMode` -> `participation`,
`CausalWriteMode` -> `WriteParticipation`, `getCausalWriteMode` ->
`getWriteParticipation`, `'authoring'` -> `'authored'`, `'realization'` ->
`'realized'`. `getHistory()` -> `getRestorationHistory()`, `clearHistory()` ->
`clearRestorationHistory()`, internal `history` -> `restorationHistory`,
`dependencyLedger` -> `rollbackDependencyLedger`, `pendingSource` ->
`pendingOrigin`, `maxHistorySize` kept inside `RestorationConfig`.

`cause` / `causation` stay reserved for the dependency relation; `causal` stays as
an adjective. `undoable()`, `undo()`, `redo()`, `canUndo()`, `canRedo()`,
`restorationDesignated`, `subject`, `positionId`, `claim`, `reclamation`,
`transaction*`, the four lifecycle states, `TURN-FEED` as a workstream name only.

## Open, deliberately

```text
intent                    audit before renaming — overlap with origin /
                          participation is not proven either way
transaction-rollback      the origin string needs its consumer audit first
stored() / reload()       PER-B owns it; classification before name
DiagnosticJournal etc.    JOURNAL-1 must earn the representation first
HistoryEntry ->           RestorationTurn if the unit really is turn-scoped;
                          that is a structural claim to check, not a rename
```

## Queue

```text
1  SEMANTICS-NAMES-1   EXECUTE the settled grid, with both corrections   <-- next
2  full verification   standard set incl. build / spec-types / gates / demo
3  DIAG-JOURNAL-1
```

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
