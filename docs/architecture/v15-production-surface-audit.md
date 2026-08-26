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
that earned access — _apply external truth_, _act after committed truth_ —
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
claim than _schedule this consequence when the relevant truth is settled_ — and
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

| id         | capability                                                                             | v13 spelling                                                    | status                                                 |
| ---------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------ |
| **NGF-0**  | **does `@signaltree/ng-forms` exist at all?**                                          | whole package                                                   | **DELETED — NGF-DEL executed**                         |
| **TH-0**   | **generic `WritableSignal` history**                                                   | `trackHistory`                                                  | **DELETED — TH-DEL executed**                          |
| **PER-0**  | **does `persistence()` deserve to ship, and in this form?**                            | `persistence`, `StorageAdapter`, `./storage`                    | **REDESIGN — function survives, form does not**        |
| **EVT-0**  | **does `@signaltree/events` exist at all?**                                            | the package and its four entry points                           | **DELETED — EVT-DEL executed**                         |
| **SEC-0**  | **does `@signaltree/core/security` exist at all?**                                     | the subpath and `security()`                                    | **DELETED — SEC-DEL executed**                         |
| **HIST-0** | **is history participation whole-tree, or selective?**                                 | `timeTravel()` scope                                            | **CLOSED — HIST-C, operation/turn-scoped eligibility** |
| A1         | remote acquisition / loading                                                           | `loader`                                                        | **RESOLVED — C1 yes, C2 is one narrow seam**           |
| A2         | **durability/persistence, INCLUDING whether `@signaltree/core/storage` exists at all** | `stored`, `flushAllStoredSignals`, the `./storage` subpath      | **RESOLVED — A2-B, and one new MATRIX-CLOSE row**      |
| A3         | async / status representation                                                          | `status`                                                        | **RESOLVED — function yes, ownership no**              |
| A4+A5      | form integration and its history                                                       | `form`, `FormSignal`, `history`, `@signaltree/ng-forms/signals` | **resolved — one consumer, proven path, one gap**      |
| A6         | collection projections                                                                 | `EntitySignal.map`                                              | **RESOLVED — no gap; `asMap` already ships**           |
| A7         | tree composition                                                                       | `.with()`                                                       | decided in 15.0 — declarative construction             |

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
manufactures its _own_, so the application's state is not involved at all.

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

Every falsification attempt failed, and two of them produced evidence _against_
the package:

| test                                                   | outcome                                                      |
| ------------------------------------------------------ | ------------------------------------------------------------ |
| Does anything need SignalTree semantics?               | only `createFormTree`, and it is the rejected two-model sync |
| Is a template seam missing?                            | no — the directive takes a plain signal                      |
| Is there production demand?                            | none; the one consumer is gate-mandated                      |
| Does the SignalTree-coupled entry point have a future? | it is deprecated with no chosen replacement                  |

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
const fields = form(model, schema); // Angular Signal Forms
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

| step                     | result                                              |
| ------------------------ | --------------------------------------------------- |
| `hist.undo()`            | value reverts, **and time-travel's history GROWS**  |
| `tree.undo()` afterwards | **REDOES the edit** — the model moves forward       |
| both after two edits     | `hist.canUndo()` and `tree.canUndo()` are both true |

Because the undo is a `model.update(...)`, it is a _new write_. Time-travel
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
anything, this branch _weakens_ the ownership case, because the thing it does
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
mechanically retained" — was wrong about the _reason_, and correcting a reason
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
"loader" — it is closer to _apply externally acquired collection truth, with
entity lifetime preserved and the correct causal classification_. That is a far
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

| #   | case                                   | tests                                             |
| --- | -------------------------------------- | ------------------------------------------------- |
| 1   | initial load `[A,B]`                   | basic external acquisition                        |
| 2   | refresh `[A',B']`, same keys           | surviving subject identity                        |
| 3   | refresh `[B,C]`                        | B survives, A retires, C is new                   |
| 4   | A returns later                        | key reuse must NOT resurrect A's old subject      |
| 5   | params P1 → P2                         | who owns clearing and supersession                |
| 6   | P1 slow, P2 fast                       | a stale response must not overwrite a newer scope |
| 7   | refresh with identical values          | no false semantic work                            |
| 8   | `timeTravel()` enabled                 | does acquisition pollute user history?            |
| 9   | pending transaction on a refreshed row | whose truth wins                                  |
| 10  | destroy a route-scoped tree            | controller lifecycle terminates                   |

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

| case                                              | result                                                                                       |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1-2 initial load, then refresh with the same keys | surviving key keeps its `SubjectId`; a reference held across the refresh reads the new value |
| 3 refresh drops A, keeps B, adds C                | B's lifetime survives, A retires, C is new                                                   |
| 4 A returns later                                 | new lifetime; the reference held before the gap stays `undefined` — no resurrection          |
| 7 refresh with identical values                   | no identity churn                                                                            |
| 10 destroy, then a late response                  | does not throw into the acquirer                                                             |

Part 1 of C2 — the thing the earlier note guessed was the missing seam — is
**already correct**. `setAll` over an ordinary `entityMap` is a
lifetime-preserving reconciliation, which is exactly what a remote refresh
needs. Nothing has to be added for it.

## C2 — the real gap is SEMANTIC CLASSIFICATION, and the seam already exists

**Case 8.** An untagged refresh is indistinguishable from an authored mutation:
time-travel's history GROWS, and the user's undo reverts _the server's truth_ to
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
point is that it is now a _statable consequence of classification_ rather than
an accident: untagged, the same sequence cannot be resolved at all.

## Part 3 — request ownership is correctly external

Cases 5-6. Core has no scope concept: a slow P1 response landing after a P2
scope simply replaces it, because `setAll` applies whatever it is given.

That is right, not a defect. Params, cancellation, supersession and staleness
belong to the resource/controller — which is what Angular's `resource()` already
owns. Composition therefore _requires_ a controller; it does not require
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
sentence. The earned primitive is the sentence: _apply this write as externally
acquired truth rather than as something the user did._ Naming and shape are open
— that is a design step, not a finding.

## What A1-0 does NOT settle

The cache conveniences, deliberately excluded from this spike. 19 production
sites configure `staleTime: '30m'`, `swr`, `lazy` identically, which looks far
more like a default than a feature; `tags` has zero exercised invalidation. Ask
that question _after_ the seam exists, and ask it as "which of these is missing
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

| file                               | sites | params                                               |
| ---------------------------------- | ----: | ---------------------------------------------------- |
| `scaletrax/…/clearview.state.ts`   |     6 | `{ regionUrl }`, `{ regionUrl, customerExternalId }` |
| `scaletrax/…/dispatch.state.ts`    |     4 | none, and one `{ … }` filter                         |
| `trucktrax-geo/…/catalog.state.ts` |     3 | `PlantFilter`                                        |
| `scaletrax/…/v3edge.state.ts`      |     2 | none                                                 |
| `trucktrax-geo/…/device.state.ts`  |     1 | `{ region }`                                         |
| `trucktrax-geo/…/work.state.ts`    |     1 | `{ partyMember }`                                    |

**The uniformity is the finding.** Every site without exception uses
`staleTime: '30m'`, `swr: true`, `lazy: true`. The only variation is
`clearOnParamsChange: true`, present on the parameterized ones. This is not six
different jobs wearing one abstraction — it is one job, configured identically
19 times. The default is doing no work: nobody has ever chosen a different
`staleTime`.

The runtime surface actually consumed is two methods on the collection node:

```ts
force ? this._$.orders.refresh(params) : this._$.orders.load(params);
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
collection's contents _as one causal event_ — preserving subject identity for
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

| #   | case                                                  | tests                                                                                              |
| --- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 1   | authored write to historical state                    | history grows; undo restores                                                                       |
| 2   | authored write to non-historical state                | history does not grow                                                                              |
| 3   | realization into historical state                     | still does not grow                                                                                |
| 4   | historical + non-historical in one TURN               | what does one undo mean                                                                            |
| 5   | historical + non-historical in one TRANSACTION        | **the model discriminator**                                                                        |
| 6   | same location: authored edit, then server realization | authored reversible, realization not                                                               |
| 7   | entity remove/rekey in a historical collection        | SubjectId and restoration guarantees unchanged                                                     |
| 8   | undo after unrelated UI mutations                     | the product edit reverses without rewinding unrelated state                                        |
| 9   | retention                                             | non-participating state must not acquire restoration lifetime merely because `timeTravel()` exists |

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

The hardest semantic target named for this audit — _reverse an operation's own
effects against intervening non-restorable truth, rather than rewinding a
whole-tree snapshot_ — **is already met**.

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
_before_ the undone operation gives the same answer under both models, because
they are already inside the prior snapshot. Only truth arriving _after_
separates them. Same "control first" lesson as the four earlier false signals,
in a new costume: a case that passes is not automatically a case that tested
anything.

## The nine cases

| #   | measured today                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------ |
| 1-2 | **no notion of a non-historical branch** — a `ui.scrollTop` write and a document edit are indistinguishable; both create turns |
| 3   | a realization into a historical branch does NOT enter history ✓                                                                |
| 5   | a transaction spanning both branches reverses **both**, atomically                                                             |
| 7   | entity subject lifetime survives undo — a held reference re-publishes ✓                                                        |
| 9   | UI churn creates history entries; subject claims tracked separately                                                            |
| 10a | intervening truth _before_ the undone operation survives (does not discriminate)                                               |
| 10b | intervening truth _after_ survives — **per-turn reversal confirmed**                                                           |

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

Control (case 10b's shape): a realization to a _different_ leaf **does** survive.
So this is a location-collision defect, not a general failure to respect
realizations. Reproduced identically through the structural path
(`updateOne` on an entity row → reverts to `orig`, discarding `SERVER`).

Per-turn reversal restores the turn's recorded before-value **unconditionally**.
It reverses the right _locations_ but never asks whether its recorded
before-value is still authoritative at those locations. The consequence:

> an undo silently discards server state whenever the user's last edit and a
> later server response touched the same location

That is the ordinary optimistic-update collision, not an edge case. It joins the
two pinned P0s as the same class of bug — reversal is per-turn in _what_ it
touches but not in _whether_ what it recorded still holds.

Redo is consistent with undo: `canRedo()` is true and redo replays `'A'`, not
`'SERVER'`. The realization is absent from both directions. Whatever HIST decides
about later truth has to decide it for redo too — "undo respects later truth but
redo does not" is incoherent.

**This does not discriminate between the models.** It is a defect in the shared
mechanics that HIST-SCOPE merely made visible, and it must be fixed against the
chosen model alongside the coalesced-turn P0.

### Case 9 — the two consequences separate cleanly

Measured on the causal inventories directly, not from a heap probe:

|                    | authored churn (40 rounds, window 5) | realization churn (40 rounds)      |
| ------------------ | ------------------------------------ | ---------------------------------- |
| history entries    | bounded by the window                | **0**                              |
| claim owners       | ≤ 5                                  | **0**                              |
| claimed subjects   | tracked                              | **0**                              |
| collection correct | yes                                  | yes (control: `ids() === ['g39']`) |

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
requires a _second_ inventory — new machinery, and exactly the scope HIST-0
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
the _authored but non-reversible_ case — a UI change the user genuinely caused
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
justified removing it with _"history() had exactly one consumer,
form({ history }), and dies with it."_ That was true of the repository and false
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

The earlier open question — _is "authored but non-reversible" real?_ — is
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

The stated reason for compiling `timeTravel()` out is _cost_, not semantics — and
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
merely be _sufficient_ to express designation — it must be sufficient to
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
_"the flush that delivers this entry is DEFERRED to a microtask … `isRestoring`-
style flags that reset synchronously are already false by then."_ The fix
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

| #   | case                              | result                                            |
| --- | --------------------------------- | ------------------------------------------------- |
| 1   | ordinary unmarked write           | no entry, no undo — **and the write still lands** |
| 2   | one marked write                  | exactly one turn; undo restores                   |
| 3   | several marked writes, one turn   | ONE atomic entry                                  |
| 4   | **marked + unmarked, one turn**   | **the WHOLE turn reverses**                       |
| 5   | two marked scopes, one tick       | **one** turn — see below                          |
| 6   | transaction inside a marked scope | one reversible transaction                        |
| 7   | unmarked transaction              | no entry; **the transaction still commits**       |
| 8   | realization inside a marked scope | stays non-historical — rule 4 holds               |
| 9   | restoration inside a marked scope | no new history — rule 5 holds                     |
| 10  | nested marked scopes              | idempotent, one turn                              |
| —   | non-eligible entity churn         | **zero claims, zero claimed subjects**            |
| —   | designated turn (control)         | claims acquired — the zero above means something  |
| —   | async designation scope           | **throws ST1033**, never silently ignored         |

**Case 4 is the one that had to hold** and does: one designated write promotes
the whole turn, so the door cannot reintroduce partial reversal by another
route. Case 7 confirms the separation the contract needs — eligibility governs
restoration, never whether a write lands.

### Case 5 — the scope is an ELIGIBILITY scope, not an operation boundary

```ts
reversible(() => tree.$.a.set(10));
reversible(() => tree.$.b.set(20)); // same tick
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
_an authored write entering through THIS adapter marks its causal operation
reversible_ — which is **not** location-scoped history, because writes to the
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

One measurement shapes the adapter: wrapping the _dispatch_ does designate the
turn (measured: 1). No real application can exploit that — the browser
dispatches — but it proves the directive's write is **synchronous** inside the
event, so there is no scheduling gap for a designation to fall into. An adapter
that designates inside its own `set()` is therefore sound.

### The adapter, and the control that keeps it honest

`toWritableSignal(node, injector, { designatesRestoration: true })` wraps the
write-back in the designation. `histc2-form-ingress.spec.ts`:

|                                   | result                                                  |
| --------------------------------- | ------------------------------------------------------- |
| real DOM edit through the adapter | **one reversible turn**; undo restores tree and form    |
| same branch, ordinary tree handle | **non-reversible** — the HIST-B control                 |
| adapter WITHOUT the option        | non-reversible — the option does the work, not the form |

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

The public API should carry **one bit**: _this write belongs to the user's
reversible action model._ Everything else (`intent`, `source`, `causalMode`,
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
does not keep. Case 4 measured one designated write promoting an _undesignated_
sibling in the same turn, so a name implying per-write scope
(`withRestorableWrite`) would have mis-stated the unit.

Not public, and deliberately: `restorationEligible`, `restorationDesignated`,
`causalMode`, `intent`, `source`, `restorationEligibility`. Those are the
engine's reasoning. The public surface carries one bit — _this is an undoable
user operation._

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
a wrapper; the question is whether a _product user_ should be able to undo that
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

A further cluster is the same mechanism seen from the positive side — _"rolls back
a pending write while preserving a later unrelated confirmed write"_ — which can
only preserve later work it knows about.

**This is exactly the failure class the flip was designed to expose.** The later
write is not a user-restorable operation; nobody wants `undoable()` on it. But
transaction _correctness_ depends on the engine knowing it happened. History had
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
pinned _"an untagged refresh BECOMES an undoable user turn"_ — an A1-0 finding
where server data arriving without realization classification entered the undo
stack. Under opt-in it does not, because it was never designated. The flip fixes
it rather than needing a guard.

**No second admission concept exists.** `history-step-adapter.spec.ts` describes
a _"seam that demarcates a user-recognizable undo step"_, which read like a rival
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
const laterEffects = this.history;
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
the admission rule — the question is _which causal origins can create or remove a
rollback dependency_, and authored/realization/restoration get falsified
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

Not repaired here, deliberately — it _is_ the ledger-admission question. Deciding
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
  typeof meta?.transactionId === 'number' && meta.transactionOwner === transactionOwnerToken // <- ITS OWN private token
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
`time-travel.spec.ts:1113` — _"keeps transaction authority singular for composed
transactions() + timeTravel()"_ — was, all along, exercising time-travel's
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

`timeTravel()` stops asking _"is this MY transaction?"_ and starts asking _"does
this write carry a recognised ACTIVE transaction identity?"_.

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
restored value was expected. Every shape reduces to _the operation was not
designated, so no turn exists_.

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
non-authored, but cannot say _this was a restoration_ rather than _this was a
server refresh_.

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
_authored iff origin is absent_. **That is wrong**, and the table I had just
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
mistake was the field name rather than the word: _apply this as established truth
rather than as newly authored work_ is a coherent participation mode that
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
_reverse one previously designated operation legally_; it is asking _show the tree
as this snapshot_. Most jump targets were never designated at all, so the
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
'system'` at **seven** sites. So an internal write does not fall back to
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

type WriteOrigin = 'external' | 'restoration' | 'devtools' | 'transaction-rollback'; // exact value pending its consumer audit // no 'application' — see A1-N
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

# SEMANTICS-NAMES-1 — EXECUTED. The repository speaks the ontology

Seven batches, seven commits, each verified by exit code before the next began.

```text
e4ad19f9  batch 1   metadata ontology
2df46f2e  batch 2   structural-effect split
7c6d629c  —         origin-union disposition (three orphans withdrawn)
8e1e2f37  batch 3.1 restoration identity
4c6ed5eb  batch 3.2 restoration history vocabulary
62475b8b  batch 3.3 + 4   prose, and timeTravel() -> restoration()
2efe1f71  batch 5   inspection vocabulary + the derivation fix
c52b0932  batch 6+7 finish and grep
```

## The two axes, as shipped

```ts
type WriteParticipation = 'authored' | 'realized' | 'inspection';
type WriteOrigin = 'restoration' | 'devtools' | 'external';
```

```ts
{                          participation: 'authored'   }  // absent origin
{ origin: 'external',      participation: 'realized'   }
{ origin: 'restoration',   participation: 'realized'   }
{ origin: 'devtools',      participation: 'inspection' }
```

## Three findings the sweep produced that a rename was not supposed to produce

### 1. `StructuralEffect` was already taken — by a different concept

Renaming `StructuralHistoryEffect` -> `StructuralEffect` collided with
`causal-types.ts`'s `StructuralEffect = 'add' | 'remove' | 'rekey'`, silently
shadowing it so `structuralContext?: StructuralEffect` began resolving to a
string. The record and the KIND had been one identifier apart since the
causal-runtime kernel was scaffolded. Split:

```text
StructuralEffectKind  'add' | 'remove' | 'rekey'
StructuralEffect      the subject/key/value structural fact
```

### 2. `enableTimeTravel` was TWO different things

A `DevToolsConfig` option governing the Redux DevTools timeline scrubber, and a
module-local restoration convenience function. The sweep renamed both, which
would have retired a name the grid deliberately keeps AND made the survivor
collide in meaning with `restoration()`. Reverted on the DevTools side;
`anyTimeTravelEnabled` -> `anyDevtoolsTimelineEnabled` so the two can no longer
be confused by eye.

**Both collisions are the same shape as the `historyEffect` correction: a name
that reads as one concept is load-bearing for two.** Worth noting that the
mechanical sweep is what surfaced them — they were invisible while both concepts
had comfortable, different-looking names.

### 3. `stored()` was deriving policy from provenance

The batch-5 derivation check found `stored()` declining to persist a write whose
ORIGIN was devtools. The property that makes a scrub un-persistable is that it is
INSPECTION — a diagnostic application of state nobody committed — not that
DevTools performed it. Now keyed on `isInspectionWrite()`, with both directions
pinned: an inspection from any origin declines, and a devtools origin ALONE
persists.

## `AppliedHistory` — the inspection the owner ordered, and it straddled

Instantiated by `transactions.ts` as well as restoration, and consumed by
reclamation, redo/authority assessment, realization-context,
greenfield-transactions and entity-signal. Its own spec already had the word: it
is "the confirmed applied PROJECTION" over the TurnStore.

```text
AppliedHistory -> AppliedTurnProjection      (no authority named)
'history-evicted' -> 'turn-evicted'
```

`AppliedRestorationHistory` would have been the `historyEffect` mistake again.

## What was DELIBERATELY not renamed

```text
DevToolsConfig.enableTimeTravel   the timeline scrubber really does travel
devTools() JSDoc, README lines    same
maxHistorySize                    unambiguous inside RestorationConfig
local spec variables              beforeHistory / baselineHistory are
                                  getRestorationHistory().length readings
docs/architecture, rfcs, archive, records of what existed when written;
audits, CHANGELOG, RELEASE-NOTES  rewriting them would falsify the trail
```

`TimeTravelEntry` became `RestorationHistoryEntry`, NOT `RestorationTurn`: it is
`{ action, timestamp, state, payload }` — a snapshot with a label. Calling it a
turn would assert the causal-turn structure HIST-C established in a type that
does not have it.

## Ghost names found by grep that no gate can see

```text
ST1033's runtime message      told users to call `reversible(...)`, a candidate
                              name that never shipped
the root barrel's comment     recommended `tree.with(a).with(b)`, deleted in 15.0
packages/core/ENHANCERS.md    documented `tree.with(...)` as THE way to compose,
                              and it ships inside the tarball
README                        `timeTravel({ maxHistory: 50 })` — an option that
                              has never existed under any name
```

Four in one workstream. Prose is not type-checked, and this is the failure mode
this audit keeps re-finding.

## ⚠️ Open, flagged not fixed

`enhancer-safety.spec.ts` exercises `tree.with(...)` against a hand-built MOCK
tree that defines its own `.with()`. It passes while testing a method the real
tree has not had since 15.0. A test-validity question, not a vocabulary one.

## Final grep — every survivor classified

```text
timeTravel / causalMode / CausalWriteMode / 'authoring' / 'realization' /
historyEffect / StructuralHistoryEffect / isApplyingExternalState /
UpdateMetadata / getHistory( / resetHistory( / AppliedHistory / 'history step' /
reversible(                                        ZERO on every shipped surface

TimeTravel        DevToolsConfig.enableTimeTravel and its docs (kept), plus
                  migration guides recording the old name (historical)
time-travel       devTools() prose (kept), migration guides, benchmark scenario
                  labels comparing against other libraries' features
tree.with(        the ISignalTree tombstone explaining its removal, migration
                  guides, and the mock-tree spec flagged above
```

> **A methodology note.** The first run of this grep reported ZERO everywhere,
> including for names that demonstrably existed. `for t in …; do grep … $SCOPE`
> in zsh does not word-split `$SCOPE`, so every search ran against one
> nonexistent path and stderr was suppressed. Caught by adding a sanity line that
> asserted a KNOWN-PRESENT name returns a non-zero count. A clean grep is only
> evidence if something proves the grep can fail.

## SEMANTICS-NAMES-1 CLOSED

No SEMANTICS-NAMES-2. The open naming items belong to other workstreams:
`intent` (needs its own overlap audit), the `transaction-rollback` origin (needs
its consumer audit), `stored().reload()` (PER-B), and the diagnostic-journal
types (JOURNAL-1 must earn the representation first).

Closure set, all exit 0: `nx test core` (1847 passed / 203 files),
`nx lint core`, `npm run typecheck`, `nx build core`, `nx build demo`,
`check-spec-types`, `check-error-codes`, `check-demo-coverage`,
`check-release-claims`, `lint-readme-apis`, `check-doc-links`,
`verify-gates --fast` 35/35.

## Queue — CORRECTED

The first draft of this list dropped PER-B, which had not gone anywhere: the same
paragraph above says `stored().reload()` is PER-B's to classify. Only A1 leaves
the queue, because A1 is terminally closed.

```text
1  DIAG-JOURNAL-1     read-only bounded projection + reclamation falsifiers
2  DIAG-JOURNAL-1.1   rollback provenance AND correlation
3  DX-NAMES-1         developer vocabulary / misuse-resistance study   <-- next
4  PER-B              stored() semantics, including reload()'s classification
5  MATRIX-CLOSE
6  Candidate B        only if materially different
7  TruckTrax pass 2
8  TruckTrax pass 3
9  final perf / retention
10 FULL historical release gate suite (not --fast)
11 RC / final closure
```

DX-NAMES-1 is REQUIRED pre-v15, not polish, and it goes before PER-B because
PER-B and MATRIX-CLOSE would freeze the remaining developer-facing vocabulary.
Its acceptance bar is not "best-scoring name":

> The winner must make the correct operation easier to choose than an ordinary
> `.set()`, across representative external-source scenarios, without attracting
> materially incorrect uses.

A guardrail disguised as vocabulary.

### Carried: harness-validity cleanup

`enhancer-safety.spec.ts` builds a MOCK tree with its own `.with()` and exercises
it. It passes while testing a method the real tree has not had since 15.0, which
is false confidence about a surface that no longer exists. Not a naming task and
not a JOURNAL task — carried as its own item.

# DIAG-JOURNAL-1 — PRE-REGISTERED before any implementation

> **CONTRACT UNDER TEST: can SignalTree retain a bounded, read-only description
> of causal turns sufficient for diagnostics WITHOUT acquiring restoration
> rights, transaction ownership, subject ownership, or reclamation authority?**

DIAG-JOURNAL-0 closed as B: existing facts sufficed except restoration origin.
That gap is now filled — the restoration-origin B shipped, and A1 case 6 measures
`origin: 'restoration'` on an undo's writes. So JOURNAL-1 CONSUMES a complete
vocabulary and invents none:

```text
causal runtime / notifier   effect, path, subject, position, origin,
                            participation, transaction identity
TURN-FEED                   opened, staged, confirmed, rolled-back
onFlush                     the actual causal-turn boundary (DIAG-J-0 case 8)
```

TURN-FEED stays transaction-lifecycle-only. Consuming it is allowed; widening it
is not.

## The representation is NOT pre-named

`DiagnosticTurn` vs `DiagnosticRecord` stays open until the grouping probe says
whether one retained object corresponds 1:1 to a causal turn. Naming it first
would be asserting the answer.

## Falsifiers

```text
F1  GROUPING          does a flush-bounded entry correspond 1:1 to a causal turn?
                      two writes in one tick; a transaction; a rollback
F2  ONTOLOGY          a devtools inspection is journalled as
                      origin devtools + participation inspection, and NOT
                      reinterpreted as authored / realized / restoration.
                      A restoration stays TWO facts: origin restoration +
                      participation realized. The journal may not recompress the
                      axes this release just separated.
F3  NO RESTORATION    with the journal ON: history length, canUndo, canRedo and
    RIGHTS            the admitted set are identical to journal OFF
F4  NO OWNERSHIP      restoration claim inventory unchanged; transaction
                      dependency/claim ownership unchanged
F5  RECLAMATION       create -> remove -> restoration right gone -> reclaimed,
                      and the disposition is IDENTICAL with the journal ON.
                      A subject whose only remaining reason to exist is the
                      journal must still be reclaimed.
F6  EVICTION          a bounded journal releases its own ordinary payload
                      references when an entry falls out of the window
F7  NO LIVE HANDLES   nothing retained is callable, a signal, a node, a claim
                      handle, a capture bucket, a turn store, or a closure
                      capable of reversal
```

## Pre-registered outcomes

```text
A  the contract holds as stated                     -> build it, propose surface
B  holds only with a narrower retention rule        -> record the rule, then build
C  observation cannot be separated from ownership   -> STOP. A journal that
                                                       pins subjects is a second
                                                       retention authority and
                                                       does not ship
D  1:1 turn correspondence fails                    -> the unit is not a turn;
                                                       name it for what it is
U  evidence does not discriminate
```

A category C halts JOURNAL-1 the way it halted HIST-C2.

## Out of scope, restated

Interactive time travel. The journal never acquires `restore()`, `apply()`,
`undo()` or an equivalent. A later "jump to this point" routes through the single
restoration authority or is refused where no legal restoration exists.

# TURN-FEED-0.2 — a correctness repair to the frozen seam

Found while probing DIAG-JOURNAL-1's grouping, and it blocked JOURNAL-1 because
the journal must CONSUME this channel.

```text
enhancers: [transactions()]                 subscriber received NOTHING
enhancers: [restoration(), transactions()]  subscriber received all four events
```

**TURN-FEED's observable lifecycle depended on enhancer composition**, which
contradicts the ownership independence TURN-FEED itself claims.

## Mechanism

```text
enhancer input === enhancer output        transactions() mutates in place
enhancer host  !== the public tree        applyEnhancers runs, THEN createBuilder
                                          produces what signalTree() returns
```

The channel was a symbol on whatever object was asked, and
`getTransactionLifecycleChannel()` did two jobs at once — _create if missing_ for
the owner, _find_ for an observer. So an observer asking the public tree did not
fail: it silently got a brand-new channel that could never fire. **Fail-open by
construction.**

## The repair

```text
installTransactionLifecycleChannel(tree)     OWNER side. Idempotent.
tryGetTransactionLifecycleChannel(tree)      observer. undefined = absence.
getTransactionLifecycleChannel(tree)         observer. ST1036 = corruption.
```

> If a tree has a transaction authority, failure to resolve its lifecycle channel
> is CORRUPTION, not absence.

Absence stays legitimate — a diagnostic observer must work on a tree with no
transaction capability — and is keyed on `__transactions`, the handle the
enhancer publishes, rather than on a heuristic like "has a `transaction` method".

**Canonical host derived, not assumed.** Measured across the enhancer input, the
`applyEnhancers` output and the public tree: `tree.$` is the one object identical
at all three points. `hostIsPublic` was false in BOTH compositions, so the tree
object itself could never have worked.

**Both authorities install.** `restoration()` owns transactions of its own
(`transactionOwnerToken`), so it is an owner-side installer rather than an
observer — which is what makes case 4 (enhancer order) pass without an observer
ever creating a channel.

## Acceptance — 11 cases in `turn-feed-0-2-reachability.spec.ts`

Cases 1-6 and 9-10 are reachability, order-independence, tree isolation, channel
identity and unsubscribe. Two are worth calling out:

**Case 8 is the self-test.** It deletes the installed channel from the canonical
host while leaving the authority in place — reproducing exactly the state the old
code produced silently on every single-enhancer tree — and proves the lookup
throws `ST1036` rather than minting an inert channel.

**Case 7b was a wrong expectation, corrected by measurement.** `restoration()`
alone DOES expose a channel, because restoration is a transaction owner. Absence
is keyed on having no OWNER, not on the `transactions()` enhancer specifically.

## Why TURN-FEED-0 missed it

Every case that SUBSCRIBES composes `restoration() + transactions()`. The one
single-enhancer case asserts only that behaviour is unchanged and never
subscribes — its comment, _"announcing to nobody is not an error"_, was true of
what it tested and quietly normalised the missing condition.

```text
what it proved     installing the protocol does not disturb transactions()
what we read       transactions() exposes the protocol
```

Green for a reason other than the intended one, exactly the class now being
hunted.

## This does NOT reopen TURN-FEED

```text
unchanged   event vocabulary (opened / staged / confirmed / rolled-back),
            lifecycle-only scope, transaction semantics, restoration admission
repaired    ownership, identity, reachability, failure behaviour
```

Recorded as a correctness repair to the frozen seam, not a new disposition.

# TURN-FEED-0.2.1 — the repair was still deriving ownership from one producer

The 0.2 resolver asked `!!tree['__transactions']` to decide whether a tree HAS a
transaction authority. Its own acceptance matrix contained the contradiction:
case 7b records that `restoration()` alone owns transactions and installs a
channel, while `restoration()` publishes no `__transactions` handle.

Predicted, then measured before fixing:

```text
restoration() alone, channel deleted from the canonical host
  expected  "transaction authority but no lifecycle channel"   (corruption)
  ACTUAL    "this tree has no transaction capability"          (absence)
```

**The loud failure was loud for one enhancer and silent for the other.** Case 8
had proved fail-loud for one owner IMPLEMENTATION, not for the ownership
INVARIANT.

## The fix comes out of the owner/observer split itself

`installTransactionLifecycleChannel()` is an operation only an owner performs, so
the act of installing IS the authority fact:

```text
canonical host
  TransactionLifecycleOwnerPresent = true     written by install
  TransactionLifecycleChannel      = channel
```

```text
channel present                    -> return it
channel absent + owner marker      -> ST1036 CORRUPTION
channel absent + no owner marker   -> legitimate absence
```

The marker is written BEFORE install's early return, so a second owner joining an
existing channel still asserts it, and it survives a channel that is later lost —
which is exactly the corrupted state the resolver has to recognise.

**Not** `__transactions || __restoration`. That replaces one owner-specific
heuristic with two and keeps the defect, merely enumerating more of it. Nothing
records WHICH owner or how many; if owner identity is ever needed the marker
becomes a registry, but widening it before a consumer exists would be inventing
the requirement.

## Triangulated, not exemplified

```text
8a  transactions() owner  + deleted channel   -> corruption
8b  restoration() owner   + deleted channel   -> corruption
8c  no owner, no channel                      -> legitimate absence
```

13 cases green. This is the third finding in this seam produced by asking _why_
a green test is green rather than _whether_ it is green.

# F1 REPRESENTATION — TERMINAL

```text
journal unit           = the causal turn (flush-bounded)
transaction lifecycle  = correlated protocol facts
```

A confirmed transaction happens to align with one causal turn; a rollback proves
transaction identity cannot define the unit — one transaction, two causal turns,
one lifecycle ending `rolled-back`.

```ts
DiagnosticTurn {
  sequence: number;
  effects: readonly DiagnosticEffect[];
  transactionId?: number;   // CORRELATION, not the boundary
}
```

The concrete type name and field set stay open — F3-F7 must be allowed to delete
fields that are not necessary and expose fields that are — but the semantic unit
is settled.

## ⚠️ A constraint that falls out of F1 and must not be lost

**Lifecycle state may not be stored inside a turn as though it were turn state.**
A transaction can be `opened`/`staged` when its speculative causal turn is
recorded and become `rolled-back` later, after a DIFFERENT causal turn exists.
Retroactively editing the first turn would rewrite what that turn WAS. Lifecycle
facts need correlated event representation, not mutation of a recorded turn.

# DIAG-JOURNAL-1 · F1 + F2 — measured after the repair, probe unchanged

```text
two writes, one tick        1 group, paths [a, b]      turn boundary agrees
two writes, separate ticks  2 groups
confirmed transaction       1 group + opened/staged/confirmed, tx id 1
rolled-back transaction     2 GROUPS + opened/staged/rolled-back
```

## The rollback result shapes the representation

A rollback is **two causal turns** — the speculative writes, then the
compensation — against **one** transaction lifecycle ending `rolled-back`.

So "one retained object = one transaction" is already false. But outcome D is
NOT in play: the flush-bounded unit is a causal turn in every case measured. What
the journal needs is **causal turns with transaction correlation**:

```text
causal turn #41   speculative effects        tx 7
transaction 7     rolled-back
causal turn #42   compensation effects
```

## F2 — the ontology survives observation

```text
{ origin: 'devtools',    participation: 'inspection' }
{ origin: 'restoration', participation: 'realized'   }
{ origin: 'external',    participation: 'realized'   }
```

Three occurrences, three distinct pairs, none collapsed. Inspection is not
reinterpreted as authored or realized, and a restoration stays TWO facts rather
than being flattened into "realized". The journal consumes the ontology; it does
not recompress it.

One ordering note recorded rather than worked around: the probe undoes BEFORE the
external ingress, because A1 case 6 already establishes that external truth at
that location refuses the undo (ST1034). This case is about observation, not a
re-measurement of P0-C.

Still owed by JOURNAL-1: F3-F7 (no restoration rights, no ownership, the
reclamation comparison, eviction, no live handles) — which need an actual bounded
journal to measure.

# DIAG-JOURNAL-1 · F3-F7 — the contract holds, and it produced one missing fact

The smallest bounded internal journal now exists
(`internals/diagnostics/diagnostic-journal.ts`): two retained streams, one
monotonic sequence, values retained AS OBSERVED rather than cloned, disposable.
No public API and no schema commitment.

```text
F3  no restoration rights          HOLDS
F4  no SignalTree ownership        HOLDS
F4b disposal ends observation      HOLDS
F5  reclamation identical ON/OFF   HOLDS
F6  bounded eviction releases      HOLDS  (own gate, --expose-gc)
F7  no live handles retained       HOLDS
```

## Every arm carries a positive control

"OFF equals ON" is vacuously true for a journal that observed NOTHING — and a
silently-inert observer is precisely the defect TURN-FEED-0.2 found one layer
down. So each ON arm also proves the journal recorded the occurrence whose
ownership is being compared: paths for F3, a transaction id for F4, subject ids
for F5. **An equality result is only evidence if the observer could have been the
thing that broke it.**

## F5 is the one that matters

```text
add 'a' -> remove 'a' -> push the removal out of the retention window
```

The journal holds a description of that subject's add and remove for the whole
run. `claimedWhileRestorable` true, `claimedAfterEviction` false, `stillRetired`
false — identical to the no-journal arm. Describing a subject confers no
retention right.

## F6 needed THREE arms, and the first version was wrong

The first attempt used `undoable()` writes and failed: the payload survived
eviction. That was the TEST, not the product — a designated write is retained by
restoration history, which legitimately holds the value and has nothing to do
with the journal. Two arms cannot tell "the journal still holds it" from
"something else does".

```text
A  no journal          payload DIES    nothing else retains it
B  journal, retained   payload LIVES   the journal really holds it
C  journal, evicted    payload DIES    the bound is real
```

A second wrong turn is recorded in the file: arm B first measured ZERO retained
turns on a bare tree, because the path notifier — the journal's observation seam
— is not wired without enhancers. That was the journal seeing nothing, not the
journal releasing something.

`poolOptions.forks.execArgv` was tried first for the `--expose-gc` flag and
**silently did nothing on vitest 4**, which is the same shape as everything else
this release has been finding, so it is not used. F6 runs as its own gate
(`retention-gc` — renamed from `journal-retention` when A2-5 joined it, 36/36)
with the flag via `NODE_OPTIONS`, and FAILS rather
than skipping without it — self-tested by running the gate bare. A skipped
retention test reads as evidence in a green run.

## ⚠️ THE MISSING FACT — the compensation turn has no correlation

Measured, and it is the result the owner anticipated:

```text
turn 1   speculative    transactionId 1,  origin -,  participation -
tx 1     rolled-back
turn 2   compensation   transactionId -,  origin -,  participation realized
```

**A diagnostic reader cannot say turn 2 is the compensation for transaction 1.**
Its only distinguishing fact is `participation: 'realized'`, which it shares with
external truth and with restoration. The only remaining way to correlate it is
temporal adjacency — "it came after the rolled-back event" — which is exactly the
incidental-correctness trap this workstream keeps finding.

This is the same SHAPE as DIAG-JOURNAL-0's case 7, where a restoration was
indistinguishable from external truth and was fixed by giving it a positive
origin. And it names the value the naming grid deliberately left open:

```text
grid, SEMANTICS-NAMES-1   'transaction-rollback' — OPEN, pending a consumer audit
DIAG-JOURNAL-1            here is the consumer
```

Recorded as one missing fact and a narrow seam, NOT implemented here: adding an
origin is a metadata-surface decision, and the grid's own rule is that a positive
origin exists only where a consumer needs it. There is now exactly one.

## Disposition

**A — the contract holds as stated.** Observation is separable from ownership: a
bounded read-only journal retains descriptions, grants no restoration rights,
acquires no SignalTree ownership, does not change reclamation, releases what it
held when its record is evicted, and holds no live handles. No category C.

Schema and name still deliberately unfrozen. The one thing F1-F7 has EARNED
beyond the shape is that a compensation turn needs a correlating fact it does not
currently carry.

# DIAG-JOURNAL-1.1 — provenance and correlation, kept as two facts

DIAG-JOURNAL-1 found that a compensation turn could not be tied to the
transaction it compensates. `origin: 'transaction-rollback'` alone does NOT close
that: it answers a different question.

```text
PROVENANCE    origin: 'transaction-rollback'   why this realized write exists
CORRELATION   transactionId                    which transaction it compensates
```

Making one dimension answer both is the compression this release has spent its
whole length undoing, so both were implemented and proved separately.

## The falsifier ran first

> **Can two transaction authorities visible on one tree produce the same numeric
> id?**

Measured before stamping anything:

```text
one tree, both enhancers, three transactions
  distinct owners announced  1
  ids                        [1, 2, 3]

CONTROL — two trees
  ids                        [1, 1]   under DIFFERENT owners
```

`restoration()` holds a `transactionOwnerToken` of its own but only LISTENS; the
single per-tree runtime is the only announcer. So a bare `transactionId` is
unambiguous **within one tree**, which is the only scope a journal ever observes.
The cross-tree control is what makes that a measured claim rather than an
assumption — and it is why `{ owner, id }` was NOT collapsed into `id` anywhere
except the per-tree diagnostic record. The owner object itself stays out of
retained records, per F7.

## Result

```text
turn 1   speculative    transactionId 1
tx 1     rolled-back
turn 2   compensation   transactionId 1, origin 'transaction-rollback', realized
```

A reader joins all three on transaction 1 without temporal adjacency. A CONFIRMED
transaction produces no `'transaction-rollback'` provenance, which keeps the
origin meaning _compensation_ rather than _a write near a transaction_.

The original DIAG-JOURNAL-1 case that measured the gap is kept, updated, and
points here — the file where a gap was found is worth keeping as the place a
regression would show.

## Journal schema and name stay UNFROZEN

F1-F7 earned the unit (causal turn), the correlated lifecycle stream, shared
chronology, bounded retention, and the three ownership negatives. They did not
earn a public API — and 1.1 is the proof: the journal began without a fact a real
diagnostic reader demonstrably requires.

> The first consumer earns the primitive. The SECOND independent consumer tests
> whether the representation is general rather than tailored to the first.

DevTools is the likely second consumer. Until then `DiagnosticJournal`,
`DiagnosticTurn`, the field set and the lifecycle representation are internal
working vocabulary.

# DX-NAMES-1 · STEP 1 — the corpus, classified BEFORE any candidate name

> **PRE-REGISTRATION. Candidate generation may look at the calibration corpus.
> The semantic classification of a scenario may NOT change in response to how a
> candidate performs on it.** If a name reads badly on disk-loaded state, we do
> not get to reclassify disk-loaded state as "not external" to save the name.

TruckTrax is used READ-ONLY. Candidate renderings are written beside the original
code in this document; no production file is modified by this study. Migration is
a later decision.

## The real corpus (TruckTrax, read-only)

Situation written in ordinary language first, classification second. No candidate
name has been applied at the time of writing.

```text
id   site                                     situation                          class
R1   clearview.state customers                HTTP GET -> keyed collection       acquired
R2   clearview.state projects                 HTTP GET (parameterized)           acquired
R3   clearview.state products                 HTTP GET (parameterized)           acquired
R4   clearview.state plants                   HTTP GET                           acquired
R5   clearview.state (plant-scoped)           HTTP GET                           acquired
R6   clearview.state cities                   HTTP GET                           acquired
R7   dispatch.state haulers                   HTTP GET                           acquired
R8   dispatch.state trucks                    HTTP GET + client filter           acquired
R9   dispatch.state drivers                   HTTP GET + client filter           acquired
R10  dispatch.state (region-scoped)           HTTP GET                           acquired
R11  v3edge.state (1)                         HTTP GET                           acquired
R12  v3edge.state (2)                         HTTP GET                           acquired
R13  catalog.state haulers                    HTTP GET                           acquired
R14  catalog.state trucks                     HTTP GET + page.items              acquired
R15  catalog.state plants                     HTTP GET (filtered)                acquired
R16  device.state glinxDevices                HTTP GET + key requirement         acquired
R17  work.state messages                      HTTP GET (party-scoped)            acquired

R18  ticket.ops loadTickets$                  HTTP GET -> setAll, no loader      acquired
R19  device.ops addGlinxDevice$               POST response -> upsertMany        ⚠ AMBIGUOUS
R20  device.ops getGLinxDeviceByExternalId$   GET -> upsertMany                  acquired
R21  device.ops setGlinxDeviceEntity          Bluetooth bridge -> upsertMany     acquired
R22  ticket.ops setActiveTicket (socket path) SignalR ticket -> active selection ⚠ AMBIGUOUS
R23  dev-flags.service                        localStorage -> signal             PER-B
R24  device-token-manager                     Capacitor Preferences.get          PER-B
```

### ⚠️ FINDING BEFORE THE STUDY EVEN STARTS: the real corpus is a monoculture

There are **17 `loader()` sites** (R1-R17) and **19 real HTTP-acquisition cases**
once R18 and R20 are counted. The two numbers answer different questions, and
conflating them is what produced the earlier "19 loader sites" error; both are
stated here. Nineteen instances of one situation makes the monoculture finding
stronger, not weaker.

The `loader()` uniformity the A1 audit noted is not just uniform CONFIGURATION,
it is uniform SITUATION.

> **CORRECTION 1 — real call sites test FLUENCY repeatedly; semantic scenario
> FAMILIES determine the score.** The 19 HTTP cases are rendered in full, because
> repetition is what exposes awkward syntax — but they score as ONE family. Left
> as 19 votes, a name tuned for HTTP would outvote WebSocket, worker, sensor,
> peer, every authored negative and both ambiguous cases through duplicate
> weighting alone.

Consequences the study must respect:

```text
the corpus proves    the name works for server fetch
it cannot prove      breadth — disk, cache, worker, socket, sensor, peer
```

So `incoming()`'s open question — does it teach "arriving now over a channel"
rather than "acquired rather than authored"? — **cannot be answered by TruckTrax
alone**. The constructed controls carry that weight, and saying so now prevents a
monoculture result from being read as breadth evidence later.

(The earlier audit prose said 19 `loader()` sites; the count is 17. Its own table
totalled 17 too. Corrected here.)

### The two genuinely hard cases, classified before names

**R19 — the POST response.** The app authored a device creation; the server
returned the canonical record, which is then upserted. The REQUEST is authored;
the applied VALUE is acquired. Classified **acquired**, because what reaches the
tree is the server's record and not the client's input — but recorded as
ambiguous, since a developer could reasonably read the whole operation as
authored work. Any candidate that makes this site read naturally as "authored" is
teaching the wrong thing at exactly the point where the distinction bites.

**R22 — the socket-driven active-ticket selection.** A SignalR ticket arrives and
the app sets it as the ACTIVE ticket. Two facts are entangled: the ticket data is
acquired, and the selection of which ticket is active is a UI/business decision.
Classified **ambiguous**, and it is the best available test of whether a
candidate name tempts a developer to wrap a scope that contains authored work.

**R23/R24 — durable storage.** Classified **PER-B-owned** and excluded from
scoring. Whether reading back durable state is realized participation is PER-B's
call, and letting a naming study decide it by implication is exactly the
compression this release keeps undoing.

## Constructed coverage controls

The corpus cannot exercise these; they are stated now, before candidates:

```text
C1   REST GET result                       acquired
C2   WebSocket / SSE push                  acquired
C3   IndexedDB read-back                   PER-B PROBE — NOT SCORED
C4   localStorage read-back                PER-B PROBE — NOT SCORED
C5a  worker performs app-owned calculation AUTHORED / derived   ⚠ TRAP
C5b  worker relays a device observation    ACQUIRED             ⚠ TRAP
C6   native / sensor bridge reading        acquired
C7   collaborative peer edit               acquired
C8   user form input                       AUTHORED (negative)
C9   local business-rule mutation          AUTHORED (negative)
C10  optimistic write inside a transaction AUTHORED (negative)
C11  DevTools jump                         INSPECTION (negative)
C12  undo / redo                           RESTORATION (negative)
C13  server response to a user's POST      ⚠ ambiguous (mirrors R19)
```

> **CORRECTION 2 — C3/C4 are non-binding probes, not scored cases.** The real
> persistence sites were excluded because PER-B owns whether durable read-back is
> realized participation; letting CONSTRUCTED persistence cases influence the
> winner anyway would smuggle that decision back in. They are used only for
> sensitivity: _if PER-B later classifies durable read-back as acquired, does the
> candidate still read correctly?_

> **CORRECTION 3 — the worker case splits, and it is a TRAP.** Physical origin is
> not semantic origin.
>
> ```ts
> const price = await worker.calculatePrice(localInputs); // C5a — AUTHORED
> const reading = await hardwareWorker.readSensor(); // C5b — ACQUIRED
> ```
>
> Both literally "came in" over `postMessage`. They are classified differently.
> **A name that makes a developer wrap both is teaching transport topology
> instead of causal semantics**, and this is the sharpest falsifier in the study.

## Split, fixed now

```text
CALIBRATION   R1-R14  +  C1-C13        candidates may be refined against these
HOLDOUT       R15-R22                  finalists only, untouched until then
EXCLUDED      R23, R24                 PER-B owns the classification
```

The holdout deliberately carries both ambiguous cases (R19, R22) and the only
non-HTTP real site (R21, Bluetooth). Calibration is therefore a monoculture plus
constructed breadth, which is stated rather than hidden: a shortlist that scores
well on calibration has NOT yet been tested against real ambiguity.

## Scoring dimensions, weighted before results

```text
HEAVY   decision inference   would a competent TS developer know the wrapper
                             belongs here, reading the site cold?
HEAVY   misuse resistance    where does the name TEMPT a wrap that does not
                             belong? (C8-C12 are the trap set)
HEAVY   wrong-omission       against doing nothing special (`tree.$.x.set(v)`),
                             does the name explain why the scope exists? An
                             ornamental-looking candidate FAILS even if its
                             English is accurate.
HEAVY   scope-boundary       does the name guide the developer to wrap EXACTLY
                             the acquired writes, or invite wrapping a whole
                             callback that also contains authored consequences?
medium  breadth              does one name cover fetch, disk, worker, sensor,
                             peer without teaching a narrower story?
medium  family coherence     beside `undoable()`, `transaction()`, `restoration()`
light   discoverability      IDE completion, grep, docs search
light   prior art collision  established framework meanings
```

Scope-boundary is HEAVY because R22 exposed something worse than picking the
wrong API: a socket callback contains acquired ticket data AND the authored
decision to make that ticket active. A name describing the surrounding EVENT
invites "this whole callback is incoming", which classifies authored work as
external truth — a failure the type system cannot see.

## Elimination BEFORE ranking

A candidate is rejected outright if:

```text
T1  SITUATIONAL AFFORDANCE — after the primitive has been taught ONCE, the
    situation does not cue a developer to reach for this API
T2  it attracts a major negative case (C8-C12)
T3  it encourages wrapping authored consequences
T4  its meaning depends on TRANSPORT rather than causal ownership
T5  the name does not make the special door feel WARRANTED here — it reads as
    ceremony rather than as a decision worth stating
T6  it only works for HTTP / network acquisition
```

> **⚠️ T1 and T5 WERE REPLACED IN PLACE, and the rejections below were re-derived
> under the replacements.** Step 2 originally ran a cold-reader criterion ("an
> unfamiliar developer cannot define it") and an ornamentation criterion, both of
> which the revised north star rejects: SignalTree does not need names that
> explain its causal model to someone who has never seen it, it needs names that
> become obvious at the moment of use to someone who has. Every verdict that
> depended on the old T1 or T5 is restated with its corrected reason rather than
> left standing on a criterion no longer in force.

Only survivors get compared. A table reading `realize 71 / incoming 83 /
applyExternal 85` would let a disqualifying flaw be outscored by fluency.

## Deliverable

Not a ranking — a **rejection ledger** with an earned reason per candidate, the
way `origin`, `participation` and `restoration()` were earned.

# DX-NAMES-1 · STEP 2 — elimination, and the rejection ledger

Method note, stated plainly: this is one experienced reader applying fixed
criteria to real code, not a user study. Every judgement below is attached to a
specific rendered site so it can be disputed on the evidence rather than on
taste. Where the criteria did not discriminate, that is recorded too.

## The renderings that decide it

### The HTTP family (19 cases, ONE score) — fluent for almost everything

```ts
// R18, ticket.ops.loadTickets$, as it exists today
this._ticketApi.getMyTickets$({ startDate, endDate }).pipe(
  tap((page) => {
    this._$tickets.entities.setAll(page.items ?? []);
    this._setLoaded();
  })
);
```

```ts
// candidates, same site
tap(page => { incoming(()      => entities.setAll(page.items ?? [])); … });
tap(page => { applyExternal(() => entities.setAll(page.items ?? [])); … });
tap(page => { received(()      => entities.setAll(page.items ?? [])); … });
tap(page => { setExternal(()   => entities.setAll(page.items ?? [])); … });
tap(page => { realize(()       => entities.setAll(page.items ?? [])); … });
```

**Every candidate reads acceptably here.** Nineteen repetitions establish
fluency and discriminate almost nothing — which is exactly why the family scores
once.

### C5a / C5b — the trap, and the study's sharpest result

```ts
// C5a — the worker is an implementation detail of APP-OWNED computation
const price = await pricingWorker.calculate(localInputs);
tree.$.quote.total.set(price); // authored. NO wrapper belongs here.

// C5b — the worker relays a device observation
const reading = await sensorWorker.read();
tree.$.telemetry.set(reading); // acquired. A wrapper belongs here.
```

Now the same two sites under each family:

```ts
incoming(() => tree.$.quote.total.set(price)); // ⚠️ reads CORRECT and is WRONG
incoming(() => tree.$.telemetry.set(reading)); // reads correct, is right

applyExternal(() => tree.$.quote.total.set(price)); // reads WRONG — good
applyExternal(() => tree.$.telemetry.set(reading)); // reads correct, is right
```

`incoming()` cannot separate them, because both values did arrive. The word is
true of the transport in both cases and true of the semantics in only one.
`applyExternal()` separates them, because a price the application asked its own
worker to compute is not _external_ to the application — the authority never
left. **T4 fires for the whole event/source family.**

### R22 — scope-boundary, on real mixed code

```ts
// today, inside TicketingHub.onTicketChange
this._store.ops.tickets.setActiveTicket(ticket);
this._store.ops.tickets.loadTertiaryData$(ticket.id).subscribe();
```

```ts
// what an event-word invites
incoming(() => {
  ops.tickets.setActiveTicket(ticket); // acquired DATA + authored SELECTION
  ops.tickets.loadTertiaryData$(ticket.id).subscribe(); // and an async call
});

// what an action-word invites
applyExternal(() => {
  ops.tickets.applyTicketData(ticket); // just the acquired write
});
ops.tickets.selectActive(ticket.id); // the authored decision, outside
```

The event word describes the callback, so the callback is what gets wrapped —
including an authored selection and an async subscribe that `ST1035` would then
refuse. The action word describes what you are doing to the state, so it
naturally ends at the acquired write. **T3 fires for the event/source family.**

## The rejection ledger

```text
realize()                  REJECT  T1 (situational retrieval)
  The incumbent, and it still loses under the corrected criterion — for a better
  reason. Teach it once ("`realize()` applies externally acquired state"), then a
  week later the developer is writing
  `api.getTickets().subscribe(tickets => …)`. The situation does not cue the word
  "realize"; nothing about a subscribe callback retrieves it. Compare the same
  sentence taught for `applyExternal()`, where the situation and the word share
  vocabulary.
  The old reason — "a stranger cannot define it" — is withdrawn. The correct one
  is POOR SITUATIONAL RETRIEVAL AFTER LEARNING.
  NOTE: `realized` survives as the participation VALUE. Values are READ in
  metadata by people already holding the ontology; doors are TYPED at the moment
  a situation occurs. The asymmetry is the point.

incoming()                 REJECT  T3, T4
  Best five-second read in the study, and it fails on the two heavyweights it
  was added to test. C5a/C5b: cannot separate an app-owned worker computation
  from a relayed device observation, because both "came in". R22: describes the
  surrounding event, so it invites wrapping the whole callback including the
  authored selection. It classifies ARRIVAL CONTEXT; SignalTree needs AUTHORITY
  OF THE WRITE.

received()                 REJECT  T3, T4
  Everything above, worse: past-tense event description pulls even harder toward
  callback-wide wrapping.

external()                 RUNNER-UP  (was REJECT on the withdrawn T1)
  The old rejection leaned on "no action at all — it does not say what happens",
  which is a cold-reader complaint and no longer disqualifying. Under the
  corrected criteria it survives: the situation cues it, it repels the worker
  price (a value the app asked its own worker for is not external), and it is
  adjective-shaped like `undoable`. Its remaining defect is T3 — as an adjective
  it characterises the surrounding context, so R22's mixed callback still invites
  a callback-wide wrap. Narrower than `incoming()`'s defect, and real.

fromExternal()             REJECT  T5 (unwarranted-feeling)
  A prepositional fragment reads as an argument rather than something being done,
  so at the call site it feels like an annotation someone added rather than a
  decision worth stating. Re-derived under the corrected T5; the old
  "reads as decoration next to `.set()`" phrasing was the same observation made
  against the wrong standard.

applyIncoming()            REJECT  T4
  `apply` repairs the scope-boundary problem; `incoming` keeps the transport
  problem. Half a fix.

applyReceived()            REJECT  T4
  As above.

setExternal()              REJECT  false narrowing
  Strong discoverability, and Angular's literal `set()`/`update()` is real prior
  art for it. But SignalTree's door is a SCOPE that may contain `setAll`,
  `addOne`, `removeOne`, `updateOne` and structural writes. `set` promises one
  mutation and delivers a region — the same class of error as a name asserting an
  ownership the code does not have.
  RECORDED ALTERNATIVE: if the door were a single-write function rather than a
  scope, `setExternal` would be the strongest name in the study. That is an API
  SHAPE question, not a naming one, and A1 case 9 already chose the scope.

setFromExternal()          REJECT  false narrowing, T5
  Same defect, more syllables.

acceptExternal()            REJECT  false affordance
  "Accept" implies a decision or validation gate. The door performs no gate — it
  classifies. A name that promises admission control invites someone to look for
  the rejection path.

writeAsExternal()          SURVIVE (weak)
  Semantically precise: write these AS external. Two costs — `write` is not the
  vocabulary applications use (they `set`, `update`, `addOne`), and at 15
  characters it is the longest survivor. Kept for comparison, not favoured.

ingest()                   REJECT  T1 (situational retrieval), false affordance
  ETL / pipeline vocabulary. A developer writing an Angular subscribe callback
  does not retrieve "ingest", and the word additionally suggests a transformation
  step the door does not perform.

hydrate()                  REJECT  T2, prior art
  Established narrower meaning: TanStack `hydrate()` restores a previously
  DEHYDRATED representation into a cache; SSR uses it for the same round-trip.
  It would attract exactly the persistence and SSR cases PER-B has not yet
  classified.

sync()                     REJECT  T2
  Attracts bidirectional-sync misuse — the name implies the tree pushes back.

store()                    REJECT  direction collision
  Means "persist" to most readers, and SignalTree already ships `stored()`. It
  points the opposite way down the same axis.

remote()                   REJECT  T6
  Network only, by construction. Fails disk, worker, sensor and peer.

reconcile()                REJECT  false affordance
  Promises merge semantics. The door applies; it does not reconcile.

applyExternal()            SURVIVE
  Action + source. Passes T1 (a cold reader can infer it), T2 (it reads WRONG on
  every C8-C12 negative — the trap set repels it), T3 (describes what you are
  doing to the state, so the scope ends at the acquired write), T4 ("external"
  is about authority, not transport — the C5a worker price is not external to
  the app that asked for it), T5 (it states a classification a plain `.set()`
  cannot), T6 (fetch, disk, worker-relay, sensor and peer all read correctly).
  RECORDED WEAKNESS: it can be misread as "apply this VALUE" rather than
  "classify these writes". The callback form is the mitigation, and the
  weakness is real rather than dismissed.
```

## Survivors

```text
applyExternal()      survives all six thresholds
writeAsExternal()    survives, weaker on family coherence and length
```

Two survivors, both from the ACTION+SOURCE family. The finding is stated
NARROWLY, because the broad version turns English grammar into architecture:

> **The arrival-oriented names TESTED HERE — `incoming`, `received`, and the bare
> source adjectives — tended to cue the surrounding acquisition EVENT, while
> `applyExternal()` cued the state-classification OPERATION.**

That keeps the evidence attached to the candidates that produced it. A general
law ("event words classify arrival, action words classify writes") is a useful
heuristic for generating candidates and is NOT claimed as proved.

## What Step 2 did NOT settle

The holdout is untouched: R15-R22 have not been rendered against any candidate.
The finalists face it next, and `incoming()` goes with them as a control — an
elimination reached on constructed evidence should be re-tested on real ambiguous
code rather than trusted.

C3/C4 sensitivity, non-binding: `applyExternal(() => tree.$.settings.set(saved))`
reads correctly for an IndexedDB read-back, so the survivor does not pre-empt
PER-B either way. `incoming()` reads noticeably worse there, which is consistent
with its T4 rejection but is not part of it.

# DX-NAMES-1 · STEP 3 — the holdout

Untouched until the finalists existed. `incoming()` is carried as a CONTROL: an
elimination reached on constructed cases should be re-tested on real ambiguous
code, not trusted.

## R19 — the POST response (the ambiguous one)

```ts
// today
return this._deviceService.create$(body).pipe(tap((device) => this._$.glinxDevices.upsertMany(this._keyedDevices([device]))));
```

```ts
tap((device) => applyExternal(() => this._$.glinxDevices.upsertMany(this._keyedDevices([device]))));

tap((device) => incoming(() => this._$.glinxDevices.upsertMany(this._keyedDevices([device]))));
```

Both read acceptably, and both are correct — the applied value IS the server's
record. But they teach differently. `applyExternal` says _the record you are
storing is the server's, not yours_, which is the fact that matters when someone
later wonders why creating a device is not an undo step. `incoming` says _this
arrived_, which is true and does not answer the question.

**Neither is eliminated here. `applyExternal` instructs; `incoming` narrates.**

## R22 — the mixed socket callback (the dangerous one)

The elimination reproduced, and worse than predicted:

```ts
// what the site actually contains
this._store.ops.tickets.setActiveTicket(ticket);
this._store.ops.tickets.loadTertiaryData$(ticket.id).subscribe();
```

Wrapping this callback in `incoming()` produces three separate defects at once:

```text
1  the authored ACTIVE-TICKET SELECTION is classified as external truth
2  `loadTertiaryData$(...).subscribe()` is an async call inside the scope, so
   the writes it eventually performs land OUTSIDE the classification — the
   silent trap `ST1035` exists to refuse, reached here by a name rather than by
   carelessness
3  under P0-C the falsely-external selection becomes protected from a legitimate
   undo
```

`applyExternal()` **does not invite** that wrap — and the earlier claim that it
"refuses the mis-wrap by construction" is WITHDRAWN as an overclaim. Nothing
stops a developer writing:

```ts
applyExternal(() => {
  ops.tickets.setActiveTicket(ticket);
  ops.tickets.loadTertiaryData$(ticket.id).subscribe();
});
```

There is no runtime or type barrier. What the name does is ask the reader to
identify WHICH write is external rather than to classify the whole arrival event,
and that is a DX advantage — evidence of discouragement, not a guarantee. The
correct rendering separates them:

```ts
applyExternal(() => ops.tickets.applyTicketData(ticket));
ops.tickets.selectActive(ticket.id);
```

## R21 — the Bluetooth bridge (the only non-HTTP real site)

```ts
// today: "e.g. BluetoothStore updating a linked device"
setGlinxDeviceEntity(entity: DeviceDto): void {
  this._$.glinxDevices.upsertMany(this._keyedDevices([entity]));
}
```

```ts
applyExternal(() => this._$.glinxDevices.upsertMany(…));   // reads correctly
incoming(() => this._$.glinxDevices.upsertMany(…));        // also reads correctly
```

No discrimination. Recorded as such rather than credited to either.

## R15-R18, R20 — more HTTP

Fluent for both finalists and for the control. One family, already scored.

## Holdout result

```text
applyExternal()    survives; instructs rather than narrates on R19; DISCOURAGES
                   the R22 mis-wrap (no barrier — see the withdrawal above)
writeAsExternal()  survives; identical semantics, consistently clumsier at every
                   real site
incoming()          ELIMINATION CONFIRMED on real code — R22 reproduced the
                   scope-boundary failure and added the async-boundary defect
```

The holdout did not overturn anything, and it did not merely repeat the
calibration either: R22 produced a defect the constructed cases had not shown —
the async call inside a wrongly-widened scope.

# DX-NAMES-1 — DISPOSITION

```text
external ingress door   applyExternal(() => { … })
```

Earned reason, in one sentence: **event words classify the arrival, action words
classify the write, and SignalTree needs the write classified** — so the family
was decided before the word was, and within the action family `applyExternal`
was the only member that survived all six thresholds.

Against the acceptance bar the owner set:

> The winner must make the correct operation easier to choose than an ordinary
> `.set()`, across representative external-source scenarios, without attracting
> materially incorrect uses.

```text
easier than .set()          yes — it states a classification `.set()` cannot,
                            and the trap set (C8-C12) reads WRONG under it
incorrect uses attracted    none found; the R22 mis-wrap that the event family
                            invites is not invited here
```

## Not yet done, and deliberately

```text
RENAME NOT EXECUTED    `realize()` ships today. Renaming a public export is a
                       surface change and belongs with the other executed
                       renames, not inside a study.
`realized` UNCHANGED   the participation VALUE stays. Values are READ by people
                       already holding the ontology; doors are TYPED by people
                       who are not. The asymmetry is the point.
OUTSIDE DEVELOPERS     everything here is one experienced reader against real
                       code with fixed criteria. It is the strongest evidence
                       available without external participants, and it is not a
                       user study.
TRUCKTRAX UNTOUCHED    no production file was modified. Migration is later, and
                       optional.
```

## The other doors, checked for family coherence

```text
undoable()      KEEP. Says exactly what the application is designating, and the
                study's own criteria endorse it: action-shaped, infers its own
                use, and reads WRONG on anything that is not authored work.
transaction()   KEEP. Accurate, established, and the noun is the thing.
restoration()   KEEP. Already earned in SEMANTICS-NAMES-1.
devTools()      KEEP.
```

`undoable()` and `applyExternal()` are deliberately asymmetric — one designates
authored work, the other classifies acquired writes — and that asymmetry is
correct: they are not two directions of one operation.

## Queue

```text
1  PER-B            stored() semantics, including reload()'s classification  <-- next
2  MATRIX-CLOSE
3  Candidate B      only if materially different
4  TruckTrax pass 2
5  TruckTrax pass 3
6  final perf / retention
7  FULL historical release gate suite (not --fast)
8  RC / final closure
```

Carried: the `realize()` -> `applyExternal()` rename, to execute with PER-B's
naming or at MATRIX-CLOSE; the `enhancer-safety.spec.ts` mock-`.with()`
harness-validity item.

# DX-NAMES-1 · STEP 4 — the north star is revised, and the ranking is re-run

## The revised standard, and the acceptance bar it replaces

```text
WAS   can an unfamiliar TypeScript developer explain what this function does?
NOW   after minimal exposure to SignalTree's concepts, does the name make the
      correct API easy to RECOGNISE at the moment it should be used?
```

> **The winning term does not need to explain SignalTree's semantics by itself.
> It must act as a memorable, misuse-resistant signpost that reliably leads
> developers to the correct primitive when the corresponding situation occurs.**

Signposts, not instruction manuals. A great primitive needs about one sentence of
teaching:

```text
undoable(…)        authored changes that should be undoable
transaction(…)     authored changes provisional until confirmed
<the door>(…)      state arriving from outside the authored operation
```

Re-weighted:

```text
HEAVY   situational affordance   at a real call site, does this feel like the
                                 obvious SignalTree door for the situation?
HEAVY   retrievability           having learned it once, would a developer REACH
                                 for this word when the situation recurs?
HEAVY   misuse attraction        what other situations make the word feel equally
                                 appropriate while the semantics are wrong?
HEAVY   scope guidance           does it encourage wrapping exactly the acquired
                                 writes, or everything in the callback?
medium  breadth, family coherence, discoverability, brevity
DEMOTED cold-reader explanation  (was T1)
```

## ⚠️ THE RE-RUN'S ACTUAL RESULT: the reframing does not revive `incoming()`

This is the finding, and it is counter-intuitive:

```text
T1 cold-reader explanation   DEMOTED   -> this is what killed realize(),
                                          external(), ingest(), fromExternal()
T3 scope guidance            RETAINED  -> one of the two things that killed
                                          incoming()
T4 transport-not-authority   RETAINED  as "misuse attraction" -> the other one
```

**`incoming()` failed the criteria the reframing KEEPS. `external()` failed the
criterion the reframing DROPS.** So the honest consequence of the new north star
is that `external()` is revived and `incoming()` is not.

Both C5a and R22 survive the reweighting intact:

```ts
const price = await pricingWorker.calculate(localInputs);
incoming(() => tree.$.quote.total.set(price)); // feels right, IS WRONG
```

That is not a cold-reader problem. It is precisely **misuse attraction** — the
word feels equally appropriate for a value the application asked its own worker
to compute, and the semantics there are authored. Anything a developer `await`s
"comes in", which makes the word a magnet for exactly the case it must repel.

## What `apply` actually buys, tested rather than assumed

The fair challenge: with `undoable()` and `transaction()` establishing that these
are scopes, is `apply` noise?

```ts
incoming(() => …)
external(() => …)
applyExternal(() => …)
```

**Family coherence says `apply` is the odd one out, and that is a real cost.**
`undoable` is an adjective; `transaction` is a noun. Neither sibling is an action
verb, so `applyExternal()` breaks the shape of the family it joins.

But the siblings tolerate loose scoping and this door does not, which is the
asymmetry that decides it:

```text
undoable()        wrapping extra writes is HARMLESS — one designated write
                  promotes the whole causal turn anyway (HIST-C case 4)
transaction()     wrapping extra writes is INTENDED — that is what a
                  transaction IS
the ingress door  wrapping extra writes MISCLASSIFIES AUTHORED WORK as external
                  truth, and P0-C then protects it from a legitimate undo
```

So `apply` is not verbosity. It is the only part of the name doing scope
discipline, and this is the one door in the family that needs it. The family
precedent argues for an adjective; the semantics argue against one. **The
semantics win, and the family incoherence is recorded as a real cost rather than
explained away.**

## Re-scored, survivors only

```text
                    afford  retrieve  misuse  scope   family  verdict
incoming()            ★★★     ★★★       ✗      ~✗      ★★★    REJECT (misuse, scope)
external()            ★★      ★★        ★★     ~✗      ★★★    RUNNER-UP
applyExternal()       ★★      ★★        ★★★    ★★★     ✗      HOLDS
acquired()            ★       ★         ★~     ~✗      ★★★    REJECT (retrieve)
```

`acquired()` was generated by the reframing itself — adjective-shaped like
`undoable`, and about authority rather than transport. It is rejected on the new
heavyweight it was built for: writing `api.get().subscribe(r => …)`, a developer
retrieves _incoming_, _external_, _received_ long before _acquired_.

`external()` is the honest runner-up and its only remaining defect is scope
guidance: as an adjective it characterises the surrounding context, so R22's
mixed callback still invites a callback-wide wrap. That defect is narrower than
`incoming()`'s, because "external" at least reads WRONG on the worker price.

## Where my judgement is weakest, stated

```text
misuse attraction    strong evidence — C5a and R22 are concrete and reproducible
scope guidance       strong evidence — R22 is real code with real consequences
situational          WEAK evidence — this is introspection about what a developer
affordance             would retrieve, and I am not a sample
retrievability       WEAK evidence — same
```

The two dimensions the revised north star makes HEAVIEST are the two this study
can measure LEAST well. `incoming()` almost certainly beats `applyExternal()` on
both, and I cannot quantify by how much. What I can measure is that it attracts
a misclassification the other does not.

> **So the recommendation is `applyExternal()`, held on misuse resistance and
> scope discipline rather than on comprehension — and the affordance question is
> the one worth putting to outside developers before the rename executes.** If a
> handful of Angular developers reliably reach for `incoming()` and reliably
> avoid wrapping the worker price, that is evidence this study cannot produce and
> it should overturn this.

## Revised disposition

```text
external ingress door   applyExternal(() => { … })   RECOMMENDED, not frozen
runner-up               external()
rejected                incoming() — best signpost in the study, and it points a
                                     developer at the worker case too
```

The rename stays unexecuted, which is now doing useful work rather than being
mere caution: `realize()` ships today and is rejected under both the old standard
and the new one, so the door's name is the open question and the shape is not.

# DX-NAMES-1.1 — the criterion corrected, the winner unchanged, the doubt recorded

Four corrections applied IN PLACE rather than appended, so no verdict is left
standing on a criterion no longer in force:

```text
1  T1 cold-reader explanation  ->  situational affordance / retrieval after
                                   the primitive has been taught once
2  T5 "looks ornamental"       ->  does the name make the door feel WARRANTED
3  R22 "refuses by construction"  WITHDRAWN — it discourages; there is no barrier
4  the event/action "law"         NARROWED to the candidates actually tested
```

Re-derived verdicts:

```text
realize()      REJECT — poor situational retrieval after learning. The word is
                        not cued by a subscribe callback. (Old reason, "a
                        stranger cannot define it", withdrawn.)
external()     RUNNER-UP — its rejection depended on the withdrawn T1. Under the
                        corrected criteria it survives, with T3 as its remaining
                        defect.
incoming()     REJECT — unchanged, and for the criteria the new standard KEEPS.
fromExternal() REJECT — T5 as corrected.
ingest()       REJECT — situational retrieval.
```

## Why the winner did not move

The worker pair is the load-bearing evidence and it is untouched by the criterion
change, because it was never a comprehension result:

```ts
const price = await pricingWorker.calculate(localInputs); // app-owned
const reading = await sensorWorker.read(); // acquired
```

```text
incoming()        cues "something arrived"                  — true of BOTH
applyExternal()   cues "applying something whose authority
                  is external"                              — true of ONE
```

That is the distinction SignalTree needs a developer to make, and it is the
distinction the name has to carry.

## ⚠️ THE DOUBT, RECORDED — and it is well founded

The owner is not certain about `applyExternal()`, and the study agrees with the
doubt rather than arguing with it:

```text
misuse attraction   STRONG evidence   C5a and R22 are concrete and reproducible
scope guidance      STRONG evidence   R22 is real code with real consequences
situational
  affordance        WEAK evidence     introspection about what a developer would
retrievability      WEAK evidence     reach for. One reader is not a sample.
```

**The revised north star makes heaviest exactly the two dimensions this study
measures worst.** More analysis from the same reader cannot fix that — it would
only produce more confident prose on the same evidence. Two honest ways forward,
and they are cheap:

```text
A  ASK A FEW ANGULAR DEVELOPERS, two questions, ten minutes:
     1  given this subscribe callback and one sentence of teaching, which name do
        you reach for?
     2  here is `const price = await pricingWorker.calculate(inputs)` — does the
        door belong around `tree.$.quote.total.set(price)`?
   Q1 is the affordance evidence this study lacks. Q2 is the falsifier. A name
   that wins Q1 and fails Q2 is the trap; a name that wins both should overturn
   this recommendation.

B  DEFER. `realize()` is still what ships, the rename is unexecuted, and nothing
   downstream depends on the choice. PER-B and MATRIX-CLOSE can proceed and the
   door can be named at the surface-change point with better evidence.
```

Neither costs anything, and B costs nothing at all. What should NOT happen is
freezing the name on the strength of the dimensions this study happens to be good
at, when the owner's own criteria say the other two matter more.

## Disposition

```text
applyExternal()   LEADING, on misuse resistance and scope discipline
external()        RUNNER-UP
incoming()        REJECTED on the criteria the revised standard retains
realize()         REJECTED under both standards, for different reasons
DX-NAMES-1        NOT TERMINAL — affordance evidence outstanding
```

The vocabulary it would produce, three recognisable doors rather than three
explanations:

```ts
undoable(() => { … });         // authored, and I want it undoable
applyExternal(() => { … });    // applying state under external authority
tree.transaction(() => { … }); // authored speculatively
```

# DX-NAMES-1.2 — `apply` fails isolation, and the leader changes

Three candidates, no scores, two unresolved questions:

```text
Q1  does `apply` earn its word, or was it credited by inference?
Q2  is `external` the right CONCEPT, or a positional stand-in for the causal one?
```

Pre-registered control, from the same rule that made 19 HTTP sites score once:

> **`applyExternal()` gets no credit for scope discipline unless the same R22
> rendering shows that `external()` or `acquired()` materially invites the wrong
> boundary more strongly.**

## Q1 — R22 rendered for all three, which had never been done

```ts
external(() => {
  ops.tickets.setActiveTicket(ticket);
  ops.tickets.loadTertiaryData$(ticket.id).subscribe();
});

acquired(() => { …identical… });

applyExternal(() => { …identical… });
```

**All three look equally wrong, and for the same reason:** `setActiveTicket` is
visibly an application decision, and `loadTertiaryData$(…).subscribe()` is
visibly async. The wrongness is in the CONTENTS, not in the wrapper's grammar.

```text
WITHDRAWN: "`apply` is the only part of the name doing scope discipline, on the
           one door in the family that needs it."
```

That was an inference from grammar, never a controlled comparison — the same
error as crediting a name 19 times for one situation, and the same shape as the
"refuses by construction" overclaim withdrawn one round earlier. Under isolation
`apply` buys nothing measurable.

The one argument left for it is authoring-time affordance: a developer inside a
socket handler thinking _"this handler is external state arriving"_ might wrap
broadly, whereas `applyExternal` demands they name a thing being applied. **That
argument is refused as evidence here**, because it is precisely the introspective
affordance reasoning this study has already classified as its weakest, and it
cannot be admitted for one candidate while being discounted for another.

## ⚠️ Q1b — a correction to my own strongest evidence

Earlier the worker pair was recorded as:

```text
applyExternal(() => tree.$.quote.total.set(price));   // "reads WRONG — good"
```

That was over-credited. A pricing worker runs off the main thread, in another
module, reached by `postMessage` — a developer may quite reasonably read it as
_external_. The honest result:

```text
the worker trap DISCRIMINATES    incoming/received  vs  external/acquired family
                                 (transport vs authority — this holds)
it does NOT DISCRIMINATE         within that family
it does NOT make any of them     safe. C5a stays a genuine trap for every
                                 surviving candidate.
```

So the worker pair remains the study's strongest result and a narrower one than
claimed: it eliminates arrival words. It does not choose between the survivors,
and it does not license "our winner is immune."

## Q2 — the concept, and the argument that actually decides it

The implemented ontology is:

```ts
{ origin: 'external', participation: 'realized' }
```

`acquired` appears nowhere in it. It is the word this audit's PROSE uses
("externally acquired truth") — good prose, not the model's vocabulary.

```text
external(() => …)   the door's name IS the origin value it stamps. Learning the
                    door teaches the metadata, and reading the metadata teaches
                    the door. One word, one concept, two places.

acquired(() => …)   names neither implemented field, so it adds a third synonym
                    to an axis this release spent seven batches de-duplicating.
```

That is the strongest coherence argument produced anywhere in DX-NAMES, and it
was not visible until the candidate was compared against the SHIPPED metadata
rather than against the prose.

Also weighed and found not decisive:

```text
acquire/release collision   real but moderate. The clash is with the VERB
                            `acquire` (locks, resources); the candidate is a past
                            participle used as a scope category, like `undoable`.
grammar                     `acquired(() => …)` can misread as "this callback was
                            acquired"; `undoable(() => …)` does not have that
                            problem. Minor once taught.
```

## Voice, and the cost `external()` actually carries

```ts
undoable(() => …)      this authored scope may be restored
external(() => …)      this scope applies state of external origin
transaction(() => …)   this authored scope is speculative
```

Three single words naming scope CATEGORIES, which is what the two existing doors
already are — `undoable` does not mean "make this undoable" and `transaction`
does not mean "transact this". `applyExternal()` is the only member shaped as a
verb phrase, and with `apply` no longer earning its keep the voice mismatch is a
cost with nothing on the other side of it.

The real cost of `external()`, measured rather than asserted: the word appears 64
times in the TruckTrax apps. Inspected, almost all are comments, strings and test
titles rather than bindings, so SHADOWING pressure is low — but `grep "external("`
is noisy in a codebase that already talks about external drivers, external
haulers and external ids. A light-weight discoverability cost, recorded, not
disqualifying.

## Revised disposition — the leader CHANGES

```text
external()        LEADING. Single word, matches the family's voice, and its name
                  is the origin value it stamps.
applyExternal()   RUNNER-UP. Identical semantics; `apply` failed isolation, so
                  the extra word now costs voice coherence and buys nothing
                  demonstrated.
acquired()        REJECTED. Not in the implemented ontology — it would add a
                  third synonym to the axis this release just de-duplicated.
incoming()        REJECTED. Arrival, not authority (the worker pair, which still
                  holds for this purpose).
realize()         REJECTED. Poor situational retrieval after teaching.
```

DX-NAMES-1 stays NON-TERMINAL, and the remaining question narrowed usefully:
`external()` vs `applyExternal()` is now purely a DX question — brevity and voice
against authoring-time affordance — with no safety difference between them. That
is exactly the question a ten-minute check with a few Angular developers settles
and this study cannot.

## What changed my own answer, stated plainly

The recommendation moved because a comparison was RUN that had previously been
INFERRED. Both of the things that made `applyExternal()` look stronger — scope
discipline and worker-trap immunity — shrank when isolated, and the argument for
`external()` grew when the candidate was checked against the shipped metadata
instead of the prose describing it.

# DX-NAMES-1.3 — is the ONTOLOGY right? Two facts, and one of them changes the argument

"It matches the enum" is coherence with what shipped, not evidence that what
shipped is accurate. The last round conflated those and stopped asking once it
found a match. Two facts settle it.

## FACT 1 — `origin` is not a location binary, and `'external'` IS the odd one out

```text
origin?  'restoration' | 'devtools' | 'external' | 'transaction-rollback'
absent   ordinary application work (A1-N)
```

There is no `'internal'`. The axis is **which named originator applied this**,
with absence meaning the application itself. And in that set:

```text
restoration          an ACT performed by a SignalTree subsystem
transaction-rollback an ACT performed by a SignalTree subsystem
devtools             an AGENT that is a SignalTree subsystem
external             …not an act, not an agent. The COMPLEMENT of the set.
```

So the suspicion was right: `'external'` is the only member that names a location
rather than an originator. A value consistent with its siblings would be an act
name — `'acquisition'`, matching `restoration` and `transaction-rollback`.

**But the asymmetry is structural, not a naming slip.** SignalTree can enumerate
its OWN originators and cannot enumerate the world's. Three closed-set members
naming subsystems, plus one open-set complement naming everything else, will
never look alike — and the complement's correct name IS "outside". Renaming it
`'acquisition'` would make the enum look tidier while describing the application's
act rather than the value's provenance, on an axis defined as provenance.

> **Verdict: the ontology is not wrong.** `'external'` is the right name for the
> complement of a set the library cannot close.

## FACT 2 — `origin` IS consumer-visible, so the coherence argument earns its keep

```text
WriteMetadata          exported from the root barrel (index.ts:103)
devtools timeline      `origin` rides into the Redux action metadata — a
                       developer literally reads `origin: "external"` in the
                       DevTools panel
diagnostic journal     exposes `origin` to a reader
ST1034                 speaks of "external truth" in a user-facing message
```

The earlier worry — that "learning the door teaches the metadata" might really
mean "this keeps our own source self-consistent" — does not hold. A developer
encounters the string outside the function name, in the tool they debug with.

## The accuracy question, answered on the sharpest case rather than on tidiness

`acquired` describes the application's ACT of obtaining. The door does not
classify the obtaining — that already happened before the call. It classifies the
APPLICATION of the value. And the study's sharpest trap discriminates the two
words:

```ts
const price = await pricingWorker.calculate(localInputs); // app-owned

acquired(() => tree.$.quote.total.set(price));
// "did I acquire this from the worker?"  LITERALLY YES. The word affirms the
// wrong answer.

external(() => tree.$.quote.total.set(price));
// "is this external to my application?"  Invites the RIGHT question — external
// to what, my thread or my app? — and the honest answer is no.
```

Neither is immune (C5a remains a trap for every survivor, as 1.2 recorded). But
`acquired` misleads MORE, because acquisition literally occurred while externality
is at least contestable in the direction of the correct answer.

**Marked honestly: that is a judgement about which question a word provokes, not a
measurement.** It is the same class of reasoning this study called weak for
affordance, and it is recorded as such — but it is the only accuracy argument
anywhere that touches C5a, and it points the same way as Facts 1 and 2.

## Where `acquired` would have been right

Not on `origin`. On **participation**, if that axis had been named for what the
application did rather than for how the write participates:

```text
participation   'authored' | 'realized' | 'inspection'
```

`authored` / `acquired` would be a cleaner OPPOSING PAIR than
`authored` / `realized` — and this audit's own prose has been saying so all along
("AUTHORED vs ACQUIRED"). That is a real observation about a shipped name, and it
is **NOT acted on**: `realized` is deliberately shared by restoration and external
truth precisely because they participate identically while originating
differently, which `acquired` would break (a restoration acquires nothing). The
prose was loose; the enum is right.

## Disposition — `external()`, now on accuracy

```text
external()        SETTLED as the recommendation. Three independent arguments now
                  point one way: it names the complement correctly (Fact 1), a
                  developer meets the word in DevTools (Fact 2), and it provokes
                  the right question on the worker trap.
applyExternal()   RUNNER-UP. `apply` still buys nothing demonstrated (1.2).
acquired()        REJECTED — but on accuracy, not on novelty. It names the app's
                  act on an axis defined by provenance, and it affirms the wrong
                  answer on C5a.
```

## Stopping rule, stated so this does not loop

The name question has now consumed four rounds and each produced a real
correction — a demoted criterion, a withdrawn overclaim, a failed isolation, and
this accuracy check. This round is the first that produced **no reversal**, and
the three arguments it found are independent of one another. That is the signal to
stop.

```text
CLOSED BY EVIDENCE     which concept the door names, and why `acquired` loses
STILL OPEN, and only
settleable outside      `external()` vs `applyExternal()` — brevity and family
                        voice against authoring-time affordance. No safety
                        difference. Ten minutes with a few Angular developers, or
                        pick `external()` and move on.
NOT REOPENING           the origin enum, the participation enum, `incoming()`,
                        `realize()`
```

# DX-NAMES-1.4 — the reference frame, and an explicit reversal

Recorded as a REOPENING of `external()` vs `acquired()` on new grounds, not as a
refinement. What follows changes an argument this study already used to close the
question.

## ⚠️ REVERSAL LEDGER — DX-NAMES-1.3's accuracy leg is WITHDRAWN

```text
1.3 claimed   the worker trap discriminates `external` from `acquired`:
              "did I acquire this price?" affirms the wrong answer, while
              "is this external?" invites the right question.

withdrawn     because under the reference frame below, the pricing-worker write
              needs NO DOOR AT ALL. It is authored. `tree.$.price.set(price)`.
              So C5a was never a test of WHICH WORD — it is a test of WHETHER
              THE DOOR BELONGS, which is a different question.
```

This is the **second** walk-back of the same leg, by a different mechanism:

```text
Q1b (1.2)   over-credited: a pricing worker is off-thread and in another module,
            so a developer may reasonably read it as external. The trap
            discriminates ARRIVAL words from AUTHORITY words and does not
            discriminate WITHIN the authority family.
1.3         re-credited it as an accuracy discriminator anyway.
1.4 (here)  withdrawn again, and Q1b's original finding stands. It was closer to
            correct than the round that reversed it.
```

Recorded plainly because a leg that has now failed twice should not be available
for a third citation. **C5a's standing finding: crossing a transport or execution
boundary does not itself cross a causal-authority boundary.** That is what it
proves, and it is enough.

DX-NAMES-1.3 therefore stands on TWO independent arguments, not three: the
structural-complement reading of the enum (Fact 1) and consumer visibility
(Fact 2).

## THE REFERENCE FRAME — chosen, not discovered

> **SignalTree speaks from the store's causal perspective: a write is AUTHORED
> when the current operation owns the decision, and EXTERNAL when its authority
> comes from outside that operation.**

The bank analogy earns its place here: the same money is legitimately described
differently by the customer and by the bank, and a teller writing in the bank's
ledger uses the bank's accounting perspective. A developer writing SignalTree
state uses SignalTree's.

`external` is therefore a TERM OF ART with a coordinate system, not a source
adjective:

```text
external means   outside the authority of the current authored operation
it does NOT mean another thread, module, worker, tab, process, server or machine
```

```ts
const price = await pricingWorker.calculate(inputs);
tree.$.price.set(price); // authored. The app delegated COMPUTATION;
// authority never left.

const reading = await sensorWorker.readSensor();
external(() => tree.$.temperature.set(reading)); // another authority observed it
```

**The frame requires no implementation change**, which is the strongest evidence
it was already the model's real rule rather than a new invention: absence of
origin already means authored application work (A1-N), and
`getWriteParticipation` already defaults to `'authored'`. The frame NAMES what
ships.

## `acquired()` — rejected on the frame, not on novelty

The earlier reason is withdrawn as backwards:

```text
WITHDRAWN   "acquired() loses because the word isn't already in the ontology"
STANDS      external() wins because SignalTree's causal perspective is chosen as
            the single reference frame for BOTH api and diagnostics, and
            `external` is the term that perspective uses.
```

`acquired` is application-perspective language — _I acquired this value_.
`external` is store-perspective language — _this write's authority is outside
this operation_. Had the application's perspective been chosen as canonical,
`acquired()` could have won **and the metadata should have moved with it**. What
is not available is mixing them.

## Fact 2 survives, and the earlier version of it was circular

The critique was right that "it matches the enum" was coherence with what
shipped. Under a CHOSEN frame it stops being circular:

```text
circular version   external() is right because the enum says 'external'
frame version      one perspective is canonical for both surfaces, so the door,
                   the metadata, the diagnostics and the docs must all speak it —
                   and a developer verifies that continuity in DevTools, where
                   `origin: "external"` is visible beside the `external()` they
                   typed
```

With `acquired()` the developer would translate between two perspectives every
time they crossed from authoring to debugging. That cost buys nothing once the
frame is chosen. **The two-perspective proposal is rejected as a conscious trade,
not waved through as free.**

## ⚠️ THE RESIDUAL RISK, and it is the real one

Choosing the causal definition means `external` now has a **counter-intuitive
reading available**. Its everyday meaning IS topological, so a developer who
never reads the definition will reason:

```ts
// the worker is a different thread, therefore external
external(() => tree.$.price.set(price)); // ⚠️ WRONG, and it reads fine
```

**The frame does not remove the C5a trap. It relocates it from the choice of word
into the definition of the word.** That is a genuine cost of committing to a term
of art, and it belongs in the record rather than in a footnote.

Against it, the teaching argument holds: one invariant beats a list of
exceptions.

```text
without the frame   worker sometimes counts; POST responses are special;
                    WebSocket is special unless…; external doesn't mean external
with the frame      ask who owned the DECISION, from the current operation's
                    point of view. Everything derives.
```

Net assessment: a simplification, with the residual risk being that the word's
plain meaning competes with its defined meaning. That risk is measurable, and it
is precisely question 2 of the outside check already on the board — _given
`const price = await pricingWorker.calculate(inputs)`, does the door belong?_ A
developer pool that answers "yes" is measuring the topological misreading, and
that would be real evidence against `external()` rather than against the frame.

## Status

```text
SEMANTIC QUESTION   CLOSED. The frame is chosen; `external` is the term that
                    frame uses; `acquired` is rejected for mixing perspectives.
DX QUESTION         OPEN, unchanged: external() vs applyExternal(), and now also
                    the topological-misreading rate for `external`. Both are
                    outside-developer questions.
NOT REOPENING       C5a as a word discriminator (failed twice), either enum,
                    incoming(), realize()
```

The definition must ship WITH the door — the JSDoc's first line has to be _outside
the authority of the current authored operation, not outside your process_ —
because that sentence is now load-bearing rather than explanatory.

# DX-NAMES-1 · STEP 5 — the outside check, pre-registered and BLOCKED on people

The instrument is written and the decision rule is fixed before any data exists:
[`docs/audits/2026-08/dx-names-1-outside-check.md`](../audits/2026-08/dx-names-1-outside-check.md).

**I cannot execute this step.** It needs developers, and no amount of further
analysis substitutes — that is the whole reason it exists. What is deliverable
without them is the instrument, built so the answer BINDS instead of being
interpreted afterwards.

## Scope, narrowed as instructed

```text
TESTED       external()  vs  applyExternal()
NOT TESTED   incoming, acquired, realize, received, setExternal, and the rest —
             closed for this round
```

Two questions, both of which internal analysis has now failed to settle twice:

```text
A  situational retrieval   which name does the situation CUE, after the invariant
                           is taught once?
B  the topological trap     given the invariant and NO worker explanation, does a
                           developer correctly refuse the door for an app-owned
                           worker computation and accept it for a relayed sensor
                           reading?
```

## Design guards, and three that are mine rather than the brief's

```text
from the brief   only two names; invariant given verbatim once; no worker
                 explanation before Test B; presentation order counterbalanced;
                 directional signal, no significance claimed
added here       Test B runs AFTER Test A, because the trap would otherwise teach
                 retrieval
added here       an UNPROMPTED question ("what word came to mind before you saw
                 the options?"), recorded verbatim even when it names a rejected
                 candidate — that is still evidence about what the situation cues
added here       B3: "in your own words, what does 'external' mean here?", coded
                 causal vs topological. This is the direct measure of the
                 residual risk DX-NAMES-1.4 recorded, and the most informative
                 single item in the instrument
```

## Pre-registered decision rule

```text
1  retrieval comparable, trap mostly passed   -> external()
2  applyExternal materially better            -> applyExternal(), `apply` earns
                                                 its word on evidence at last
3  BOTH names fail the trap                   -> the FRAME survives, the public
                                                 WORD does not. `origin:
                                                 'external'` stays internal; the
                                                 door name reopens with a
                                                 measured reason
4  B1/B2 right but B3 reasoning topological   -> warning, not verdict. The word
                                                 works by luck on two cases;
                                                 ship the definition in the
                                                 JSDoc's FIRST line
```

Outcome 3 is the one worth noticing: **the reference frame can survive even if the
best public word for teaching it changes.** Keeping those separable is what stops
a bad measurement from taking the principle down with it.

## Queue

```text
1  OUTSIDE CHECK      blocked on participants — 5-8 Angular developers who have
                      never used SignalTree; TruckTrax colleagues are the natural
                      pool                                              <-- HERE
2  close DX-NAMES-1   the rule above decides it; no further analysis
3  PER-B              stored() semantics, including reload()'s classification
4  MATRIX-CLOSE
5  Candidate B, TruckTrax passes 2-3, final perf/retention
6  FULL historical release gate suite (not --fast)
7  RC / final closure
```

PER-B does not depend on the answer, so it can proceed in parallel if the check
takes time to run. What should NOT happen is the name being frozen by default
because the check was inconvenient to run — the door still ships as `realize()`,
which is rejected under every standard this study has used, so the rename is
owed either way.

# DX-NAMES-1 — FINAL, and EXECUTED

```text
canonical reference frame   SignalTree / the current authored operation

authored                    the current operation owns the state decision
external                    the authoritative decision came from outside it

public ingress door         external(() => { … })
internal metadata           origin: 'external', participation: 'realized'
```

Rejections, each with its surviving reason:

```text
applyExternal()   semantically identical. `apply` failed isolation (1.2) and
                  demonstrated no independent benefit, so the longer form never
                  earned its extra vocabulary.
acquired()        valid application-perspective English, rejected because
                  SignalTree deliberately keeps ONE store-centric frame across
                  API, metadata, diagnostics and docs.
incoming()        arrival / transport language.
realize()         poor situational retrieval after teaching.
```

## The outside check is WITHDRAWN, not deferred

The instrument stays on disk, marked withdrawn, because the reasoning that
retired it is worth more than the instrument was. It was built to measure a human
preference between two names; two results converted the question into an
architectural-consistency one:

```text
1.4  the reference frame gave `external` a precise coordinate system
1.2  `apply` failed isolation — R22 read wrong under BOTH forms because the
     CONTENTS were wrong, not because one wrapper supplied scope discipline
```

And the topological-ambiguity worry is answered by precedent rather than by
survey. **A library may define a term of art.** `transaction`, `effect`, `signal`,
`subject`, `computed` and `reducer` all need defining; requiring a survey before
defining a word would make half of software's vocabulary undefinable. What matters
is whether the definition is coherent and GENERATIVE rather than a list of
exceptions — and this one derives every case from a single question.

> ⚠️ **The residual risk did not disappear; it changed category.** It is no longer
> an unmeasured unknown, it is a DOCUMENTATION OBLIGATION — discharged, not
> promised: the definition is now `external()`'s first JSDoc line, and the docs
> teach the decision instead of enumerating sources.

```text
who owned the decision?
  this operation      ordinary write / undoable() / transaction()
  another authority   external(() => …)
```

not

```text
HTTP -> external    WebSocket -> external    Worker -> maybe    Storage -> …
```

because the second form degenerates into exceptions at the first unusual source.

## C5a's permanent job

**Retired as a candidate-name comparison, for good.** It was cited that way twice
and withdrawn twice. Its architectural finding is one sentence:

> A transport or execution boundary is not a causal-authority boundary.

It now tests whether a developer understands the REFERENCE FRAME, which is more
valuable than testing which word is prettier.

## Executed

```text
realize()        ->  external()
lib/realize.ts   ->  lib/external.ts
```

The rename landed with the disposition rather than being carried, because leaving
`realize()` in the barrel while the record said `external()` is precisely the
doc-versus-code drift this release keeps catching. ST1035's runtime message and
its catalogue row moved with it; the demo's Refresh-from-server button now reads
`external(() => …)`.

Verified by exit code: nx test core (1877 passed / 208 files), nx lint core,
npm run typecheck, nx build core, nx build demo, check-spec-types,
check-error-codes, check-demo-coverage 17/17.

## Queue

```text
1  PER-B            stored() semantics, including reload()'s classification  <-- next
2  MATRIX-CLOSE
3  Candidate B      only if materially different
4  TruckTrax passes 2-3
5  final perf / retention
6  FULL historical release gate suite (not --fast)
7  RC / final closure
```

Carried: `enhancer-safety.spec.ts`'s mock-`.with()` harness-validity item.

# PER-B — PRE-REGISTERED before touching implementation

> **NULL: can `stored()` load and reload durable state while preserving the
> authored/external distinction, transaction safety and the single restoration
> authority — WITHOUT persistence inventing its own causal semantics?**

DX-NAMES deliberately deferred the two real persistence sites (localStorage,
Capacitor Preferences) rather than deciding them by implication. PER-B has to
settle them directly, and it may not answer by analogy either.

## Acceptance bar

> Persistence may OBSERVE and REPRODUCE state. It must never manufacture
> authorship, restoration rights, transaction settlement, or causal authority
> merely because data crossed durable storage.

## The falsifier, tied to the reference frame rather than to a source table

> **If moving the same authoritative value between HTTP, localStorage,
> IndexedDB, Capacitor Preferences or an in-memory adapter changes
> restoration/transaction semantics SOLELY because the adapter changed, PER-B
> fails — unless the difference is earned by authority semantics rather than by
> transport.**

That is DX-NAMES-1.4's frame applied to storage: a durable boundary is not a
causal-authority boundary any more than a worker boundary is.

## Prohibition

> **Persistence may not derive causal policy from storage origin.** No
> `origin === 'storage'` branch, and no new `origin: 'storage'` value unless a
> consumer independently earns that provenance fact. `external` and
> `participation: 'realized'` already exist; PER-B adds metadata only if
> persistence demonstrates a diagnostic question those cannot answer.

The precedent is exact: DIAG-JOURNAL-1.1 earned `'transaction-rollback'` by
producing a consumer that could not otherwise correlate. Absent that, absence.

## Three loads, deliberately NOT collapsed

The hardest counterexample is initial hydration: if persistence is reconstructing
**this same application's previously authored state**, calling it external may be
misleading even though the bytes came from disk.

```text
autoload during construction     is this even a causal event, or is it the
                                 tree's initial value arriving late?
explicit reload after live       the operation is LEARNING what the durable
                                 authority now says -> external, probably
cross-context storage update     another tab/process wrote it -> external,
                                 clearly
```

## Cases, locked

```text
P1   autoload before any user work         external / authored / outside history?
P2   explicit stored().reload()            does rereading classify as external?
P3   reload after an undoable local edit   does durable truth protect itself from
                                           an undo of older local work?
P4   reload inside a pending transaction   contribution, dependency evidence, or
                                           refused?
P5   save during a pending transaction     can speculative state reach storage
                                           before settlement?
P6   rollback after a speculative save     is storage guaranteed free of
                                           withdrawn work?
P7   confirmed transaction                 when may persistence observe it?
P8   async adapter restore                 is classification applied at the
                                           SYNCHRONOUS tree write, not around the
                                           await?
P9   reload mixed with authored writes     can a reload scope classify a
                                           neighbouring authored write?
P10  restore + structural/entity data      same semantics as scalars, including
                                           identity and provenance protection
P11  destroy while load/save pending       no late write into dead ownership
P12  repeated reload of the same value     no fake authored turns or restoration
                                           rights merely because persistence ran
```

## First hypothesis to attack

```ts
const saved = await adapter.load();
external(() => tree.$.settings.set(saved)); // synchronous application
```

Stronger now that `external()` has a coordinate system — _did the current
authored operation own the state decision?_ For an explicit reload the answer is
usually no. **But PER-B must PROVE that rather than assume "storage = external".**

## Transaction expectation, stated before measuring

Speculative authored state must not become durable truth before confirmation. If
`stored()` autosaves staged values, that is the major PER-B defect: persistence
would turn rollback-able work into an external observation of its own speculation.

Prior art already in the tree, to be tested rather than trusted:
`internals/commit-consequence.ts` claims a single commit-scope authority with the
rule _durable storage never gets ahead of the tree's settled commit state_, and
`transactions()` opens that scope before the callback runs. Whether it holds for
`reload()` as well as for saves is P4's question.

## Order

```text
P1 -> P2 -> P5 -> P4
```

Initial load, explicit reload, speculative save, reload during a pending
transaction. Those four decide whether `stored()` already has a coherent model or
whether this is Candidate B territory.

# PER-B · P1 / P2 / P3 / P4 / P5 / P7 — one root cause, two defects

## ⚠️ THE FOUNDATIONAL DISTINCTION

> **Autoload is not a realization — it is not a causal write at all.
> `reload()` IS a realization, because a live tree learns an authoritative value
> it did not choose.**

That is the answer to the counterexample the pre-registration called hardest, and
it is not a compromise between the two candidate readings. It is a third one.

```text
P1  autoload      writesObserved 0, restoration history at baseline, canUndo
                  false. The durable value IS the tree's initial value, arriving
                  on the materialisation path. Nothing to classify, nothing to
                  protect, nothing to admit.
P2  reload()      the operation ASKED; it did not choose the value.
```

Keeping the three loads separate was what made this visible. Collapsing them into
"load" would have forced a classification onto a case that has no causal event to
classify.

## The root cause

```text
BEFORE   reload()'s tree write carried { origin: null, participation: null }
         — AUTHORED. The current operation claimed to own a decision that
         durable storage had made.
AFTER    { origin: 'external', participation: 'realized' }
```

No `origin: 'storage'`, and no branch anywhere on the fact that the bytes came
off disk. The prohibition holds: persistence earns no provenance value of its own
until a consumer needs one.

## Two defects, both downstream of that one misclassification

```text
P3   BEFORE  an undo of OLDER local work SUCCEEDED and reverted the location,
             silently discarding the durable value the reload had just read —
             P0-C only protects realizations.
     AFTER   ST1034. Refused whole, durable value intact, cursor unmoved.

P4   BEFORE  a reload inside a pending transaction was captured into that
             transaction's CONTRIBUTION, so the rollback reverted it and left the
             tree holding a value durable storage no longer had. The tree
             silently disagreed with storage.
     AFTER   contributes nothing; the rollback reverses only the authored write;
             tree and storage agree. NOT refused either, because the ingress
             touched nothing speculative — C3's bounded admission, behaving as A1
             case 5 measured for HTTP.
```

Both are the falsifier's own prediction coming true in reverse: the same
authoritative value was getting different restoration and transaction semantics
because it arrived through storage rather than through HTTP. It now gets the same
semantics, and the difference that remains is earned by authority rather than by
transport.

## Not defects — the settlement boundary already holds

```text
P5   speculative state never reached storage; after rollback live and durable
     agree
P7   persistence observes a confirmed transaction only AFTER settlement
```

`internals/commit-consequence.ts`'s rule — _durable storage never gets ahead of
the tree's settled commit state_ — is doing real work rather than asserting
itself. Tested rather than trusted, as pre-registered.

## A falsifier left in place by an earlier session, and it tripped

`restoration.spec.ts` carried a test titled _"records history for stored clear()
and reload()"_ whose comment pre-registered this exact outcome:

> ⚠️ OPEN QUESTION for PER-B … If reload is reclassified as a realization, this
> designation goes and the assertion inverts.

It inverted. `undoable(() => theme.reload())` now records NOTHING, because
designation only ever promotes AUTHORED work — the same rule that stops
`undoable()` making a server refresh undoable. The test is retitled and its
assertion inverted rather than deleted.

## Still owed

```text
P8   async adapter restore — classification at the SYNCHRONOUS write, not around
     the await
P9   reload mixed with authored writes in one scope
P10  restore + structural / entity data
P11  destroy while a load or save is pending
P12  repeated reload of the same durable value
```

# PER-B · P8-P12 — the boundaries hold, and one finding is NOT ours

No new defects. Two results needed a control to classify correctly, and one of
them belongs to somebody else.

```text
P8   async adapter restore     HOLDS. Classification lands on the SYNCHRONOUS
                               write, and `external(async () => …)` throws
                               ST1035 rather than silently classifying nothing.
P9   mixed scope               HOLDS. A reload and an authored write in the SAME
                               TICK keep their own classifications: theme
                               external/realized, label authored.
P10  structural data           HOLDS for classification. See the control below.
P11  destroy while pending     HOLDS, by design. See below.
P12  repeated reload           HOLDS. Three reloads of the same durable value:
                               restoration history unchanged, canUndo unchanged,
                               no drift. Persistence ran and manufactured nothing.
```

## ⚠️ P10 — a finding that is NOT a PER-B defect, proved by control

An undo over a whole-array `stored<Row[]>` leaf fails with:

```text
"Unsupported scoped undo effect at rows"
```

not with ST1034. The tempting read is that persistence broke restoration. **The
control refutes it:** a PLAIN array leaf, no `stored()` anywhere, fails with the
identical message.

```text
stored<Row[]>  ->  "Unsupported scoped undo effect at rows"
plain Row[]    ->  "Unsupported scoped undo effect at rows"
```

So this is a pre-existing scoped-undo limitation for whole-array writes, and PER-B
walked into it rather than causing it. The OUTCOME is safe — durable truth
survives — and what is wrong is the DIAGNOSIS a developer receives: a generic
"unsupported" where the classified refusal would have explained the situation.

**Carried as its own item.** Fixing it means teaching scoped undo about array
leaves, which is not persistence's job, and the control ships in the spec so the
distinction cannot be re-blurred later.

## P11 — the late durable write is the STATED design

`writesAfterDestroy: 1`. A debounced save committed after the tree was destroyed,
and `stored.ts`'s own contract says why:

> Weakness must not be able to outrace durability.

Membership of the pending set tracks PENDING-NESS, not signal lifetime, so an
armed write commits even if its tree is gone. Losing a user's last setting because
a per-route tree was torn down is the worse behaviour, and a mobile WebView kill is
the common case rather than a corner one.

The pre-registered question was _"no late write into dead ownership"_, and the
refined probe answers the direction that actually matters:

```text
durable write after destroy   1   intended — the value must not be lost
TREE write after destroy      0   nothing resurrected state into dead ownership
```

Those are different questions, and only the second would have been a defect.

## PER-B — DISPOSITION

```text
null       CAN stored() load and reload durable state while preserving the
           authored/external distinction, transaction safety and the single
           restoration authority WITHOUT persistence inventing its own causal
           semantics?
answer     YES, once reload() is classified. One misclassification produced two
           defects; nothing else in persistence claimed causal authority it did
           not have.
```

Against the acceptance bar — _persistence may observe and reproduce state, and
must never manufacture authorship, restoration rights, transaction settlement or
causal authority merely because data crossed durable storage_:

```text
authorship              no — reload is realized, autoload is not a causal event
restoration rights      no — P12 proves repetition manufactures nothing, and
                        `undoable()` cannot promote a reload
transaction settlement  no — P5/P7, the commit-scope authority already held
causal authority        no — no `origin: 'storage'`, no branch on the adapter
```

And against the falsifier — _if the same authoritative value gets different
restoration/transaction semantics because the adapter changed, PER-B fails_:

```text
BEFORE   HTTP via external()  protected by P0-C, excluded from contribution
         localStorage reload  destroyed by undo, captured into contribution
AFTER    identical
```

The remaining difference between a fetch and a disk read is now zero at the causal
layer, which is what the reference frame demanded: **a durable boundary is not a
causal-authority boundary.**

## Carried out of PER-B

```text
whole-array scoped undo   "Unsupported scoped undo effect" where ST1034 belongs.
                          Pre-existing, control-proved, not persistence's job.
enhancer-safety.spec.ts   the mock-`.with()` harness-validity item
```

## Queue

```text
1  MATRIX-CLOSE                                                      <-- next
2  Candidate B      only if materially different
3  TruckTrax passes 2-3
4  final perf / retention
5  FULL historical release gate suite (not --fast)
6  RC / final closure
```

# MATRIX-CLOSE — PRE-REGISTERED. A residue audit, not a design round

> **NULL: can every remaining causal / restoration / transaction / diagnostic
> concept be assigned ONE owner, ONE semantic dimension and the MINIMUM necessary
> primitive, with no public or internal residue implying authorities or
> capabilities that no longer exist?**

The work gets SMALLER here. No abstraction may be introduced to make the table
symmetric.

## The matrix

```text
FUNCTION | OWNER | PUBLIC NEED | MINIMUM PRIMITIVE | CURRENT FORM | DISPOSITION
```

```text
CORE-INTERNAL            the library needs it; nobody outside calls it
FIRST-PARTY ENHANCER     an enhancer owns it; core does not
THIRD-PARTY AUTHORING    someone outside this repo demonstrably needs to call it
```

> **Only DEMONSTRATED third-party authoring need justifies a public primitive.
> "Might be useful" is UNPROVEN, not PUBLIC.**

## Falsifier classes, searched for BEFORE looking at names

```text
M1   policy derived from origin — `origin === 'external'` deciding
     participation or restoration behaviour
M2   positive metadata with zero consumers
M3   owner-implying names across authority boundaries ("history", "restore",
     "transaction", "source" where that subsystem does not own the behaviour)
M4   mock-only public API
M5   nonexistent APIs in prose, docs and examples
M6   green tests because the intended metadata DISAPPEARED — proof must fail when
     the mechanism is removed, not merely stay green because nothing is observed
M7   permissive / index-signature typing hiding stale names or stale reads
M8   generic residue words — system / history / state / source / mode where the
     code means something more precise
M9   duplicated causal concepts — two primitives, enums, channels or names
     carrying the same authority or policy
M10  a hidden SECOND authority — anything besides restoration() deciding
     restoration rights, anything besides transactions() deciding settlement
M11  TRANSPORT-SPECIFIC CAUSAL POLICY — storage / HTTP / worker / socket /
     adapter branches that change causal semantics with no demonstrated
     authority difference
```

**M11 is new, and PER-B earned it.** The same authoritative value behaved
differently purely because it crossed localStorage rather than HTTP, and fixing
one classification erased the difference entirely. Any remaining version of that
mistake is the highest-value thing this audit can find.

## Proof standard — three answers per surviving primitive

```text
WHAT behaviour does this primitive enable?
WHY is this a distinct semantic dimension?
WHAT TEST FAILS if this exact mechanism is removed while incidental behaviour
     remains?
```

The third is the one that matters. This release has repeatedly found tests green
for a reason other than the intended one — TURN-FEED-0's unsubscribed channel,
DEVTOOLS-JUMP-0's dropped `transactionId`, the `apply` credit that was never
isolated. A primitive whose removal breaks nothing is residue no matter how
sensible it reads.

## Method

```text
COMPILER-DRIVEN where possible   temporarily narrow or remove a permissive type
                                 or index signature and let TypeScript enumerate
                                 the stale consumers. Batch 1 proved textual
                                 search cannot see through `[key: string]:
                                 unknown`.
KNOWN-POSITIVE CONTROL on every  a zero-match grep is not evidence unless
zero-match grep                  something proves the grep can find anything.
                                 Paid for once already.
```

## Start with the carried residue, at the TOP rather than inside a global grep

```text
1  enhancer-safety.spec.ts's mock `.with()`
   Harmless fixture vocabulary, a masked nonexistent public method, or a
   weakened harness? MATRIX-CLOSE material either way — it is precisely a
   harness-validity / public-surface residue (M4).

2  whole-array scoped undo diagnosis ("Unsupported scoped undo effect at rows")
   CLASSIFY BEFORE FIXING. Is this stale vocabulary caused by the architectural
   closure, or an independent restoration capability limitation? If the latter,
   record it and do NOT let MATRIX-CLOSE expand into RESTORE-P1.
```

## Expected shape of the outcome

```text
PUBLIC PRIMITIVES        undoable() external() transaction() restoration()
                         devTools() … and only what independently earned a
                         third-party authoring need
INTERNAL DIMENSIONS      origin, participation, transactionId, restoration
                         designation / provenance, diagnostic sequencing … each
                         with NAMED consumers
REJECTED RESIDUE         [item] — no consumer / wrong owner / stale vocabulary /
                         harness artifact
CARRIED NON-MATRIX       [item] — real, but architecturally orthogonal
```

## Stopping rule

> **Complete when every surviving concept has an owner, a consumer, a semantic
> dimension and a falsifiable proof — and every unexplained residue is either
> DELETED or explicitly CARRIED outside the matrix.**

# MATRIX-CLOSE · pass 1 — the carried residue, and the M1/M10/M11 sweeps

## ITEM 1 — the mock `.with()` was worse than stale vocabulary. DELETED

`enhancer-safety.spec.ts` contained seven tests over a hand-built
`createMockTree()` whose `.with()`, duplicate check AND dependency check were all
implemented **in the test file**. It threw

```text
"Enhancer X has already been applied to this tree"
```

a string that does not exist anywhere in the product. The file called
`signalTree()` **zero** times.

```text
what it looked like   coverage of enhancer duplicate/dependency safety
what it was           the test asserting that the TEST's reimplementation worked
                      — unable to fail for a product reason, over a method 15.0
                      deleted
```

The real behaviour is covered against real trees in
`lib/enhancer-metadata-authority.spec.ts` — duplicate detection by name,
requirement satisfaction by capability, fail-closed before any enhancer runs,
declaration-order independence, a throwing enhancer aborting construction — with
the messages the library actually emits (`"dup" is configured 2 times`).

Deleted, with the metadata block that DID touch real code kept, and the
deletion's reasoning recorded in the file so it cannot be reintroduced as
"missing coverage".

## ITEM 2 — CLASSIFIED, and it splits in a way that stops a sweep

The whole-array undo diagnosis (`"Unsupported scoped undo effect at rows"`):

```text
CAPABILITY LIMITATION   `isSupportedEffect` accepts a 'set' only when before and
                        after are scalar, or when the write is not at its owner
                        path. A root-level non-scalar leaf satisfies neither, so
                        a whole-array replacement cannot be reversed by scoped
                        undo at all. That is RESTORE-P1 design work, NOT residue.
                        -> CARRIED OUT of the matrix, as pre-registered.

DIAGNOSTIC RESIDUE      the throw carries no ST code, so `check-error-codes`
                        cannot see it and a user has nowhere to land.
```

⚠️ **And the diagnostic half turned out to be a CLASS, not an instance.** There
are **149** uncoded `throw new Error(...)` sites in core outside specs. Giving
this one a code would be arbitrary — fixing one of 149 is worse than fixing none,
because it implies the other 148 were considered.

```text
NEW CARRIED ITEM   uncoded user-facing throws (149 sites). Needs triage —
                   most are probably internal invariant violations no user can
                   reach, and the gate only polices ST-prefixed codes, so the
                   distinction has never been drawn. That is its own workstream.
```

This is the pre-registration working: MATRIX-CLOSE was told to classify before
fixing, and classifying is what revealed that the tempting fix was one arbitrary
edit inside an unexamined class.

## M1 — policy derived from origin: ONE branch, and it is CORRECT

Five live `origin ===` branches. Four are self- or foreign-filtering (_don't
observe my own output_, _another authority's replay is not my business_) plus one
coalescing-identity check, none of which derives policy from provenance.

The fifth is real policy — and it is the strongest evidence in the repo that
`origin` earns its axis:

```ts
// signal-tree.ts
function currentHydrateMode(): 'merge' | 'restore' {
  return getActiveWriteContext()?.origin === 'restoration' ? 'restore' : 'merge';
}
```

An UNDO must land the user exactly where they were; a REHYDRATE crosses a process
boundary and must normalise. **Participation cannot make that distinction** —
restoration and external truth are both `'realized'`, and a server refresh must
merge while an undo must restore. Only origin separates them.

> So `origin` is a DIAGNOSTIC axis with exactly one policy consumer, by design.
> That is not M1; it is the two-axis result being load-bearing. And it sharpens
> the prohibition rather than weakening it: policy keys on PARTICIPATION unless
> the question is literally _which authority replayed this_.

## M2 — the origin values, each with a named consumer

```text
'restoration'           4 code consumers (restoration self-filter, transactions
                        x2, currentHydrateMode)
'devtools'              diagnostic display — the Redux action metadata a human
                        reads in the panel
'external'              diagnostic display, same
'transaction-rollback'  DIAG-JOURNAL-1.1's correlation consumer
```

Three of four have only DISPLAY consumers, and that is correct rather than
suspicious: provenance exists to be read by a person debugging. M2 targets
metadata with NO consumer, which none of these are. Note also that `stored()` and
`write-participation.ts` both carry comments stating they deliberately do NOT key
on origin — the prohibition is documented at the sites most likely to break it.

## M10 — no hidden second authority

```text
restoration admission   `isTurnEligible` appears ONLY in restoration.ts, and
                        `restorationDesignated` only in restoration-eligibility.ts
settlement              `openCommitScope`/`settleCommitScope` in transactions.ts
                        and commit-consequence.ts — the latter being the single
                        commit-scope authority by design, not a second one
```

## M11 — no transport-specific causal policy

Zero hits for adapter/storage/http/socket/worker branches affecting causal
semantics. PER-B removed the only one that existed.

## ⚠️ Sweep status, stated rather than implied

```text
SWEPT      M1, M2, M4 (item 1), M10, M11
NOT YET    M3, M5, M6, M7, M8, M9
```

M6 (green-for-the-wrong-reason) is the expensive one and the most valuable; it
cannot be done by grep and needs mechanism-removal probes per primitive. Recorded
as owed rather than quietly skipped.

Verified by exit code: nx test core (1883 passed / 209 files — seven mock-only
tests deleted), nx lint core, npm run typecheck, verify-gates --fast 36/36.

# MATRIX-CLOSE · pass 2A — M3, M8, M7

## M3 — two findings, and I caused one of them

### ⚠️ An edit session had been given the restoration authority's name

`EditSession` is a public subpath (`@signaltree/core/edit-session`) with its own
`undo()`, `redo()`, `canUndo()`, `canRedo()` over local past/present/future
stacks. It never touches the causal runtime, restoration claims, causal turns or
designation — a draft over two plain signals.

```text
git log -S   4c6ed5eb  SEMANTICS-NAMES-1 batch 3 pass 2
before       getHistory(): UndoRedoHistory<T>
after        getRestorationHistory(): UndoRedoHistory<T>
```

**My own sweep did this.** Batch 3 renamed `getHistory` repo-wide and handed a
scratchpad the authority's vocabulary — precisely the "name implies an ownership
the code does not have" error that batch corrected everywhere else. Fixed:

```text
EditSession.getRestorationHistory()  ->  getEditHistory()
```

`UndoRedoHistory<T>` is KEPT: it names a session's own undo/redo stacks
accurately and claims no authority. The rationale is recorded at the declaration
so the next repo-wide sweep does not redo it.

### Batch-2 rename survivors in `entity-signal.ts`

```text
addOneWithHistoryEffect       -> addOneWithStructuralEffect
stagedAddHistoryEffects       -> stagedAddStructuralEffects
stagedRemovalHistoryEffects   -> stagedRemovalStructuralEffects
```

One site already read `createStructuralEffectMeta(stagedAddHistoryEffects[i])` —
the type had been renamed and the variable holding it had not.

### Correctly untouched

`ScopedHistoryAuthority`, `pruneHistoryExcluded`, `recordHistory`,
`compositionHistory`, `FormHistory*` are all TOMBSTONES. A tombstone must name
the thing it buries.

## M8 — clean

Every production `*Source*` identifier is `asyncSource` (a marker named for what
it is), a generic `TSource`, or `RealizationContextSource` (a supplier). No
residue of the retired `source` metadata field. `System` has exactly one
identifier.

## M7 — the escape hatch was ACTIVELY HARMFUL, and it is deleted

`WriteMetadata` carried the only permissive signature in the metadata types:

```ts
/** Open extension for guardrails' historical custom-key shape. */
[key: string]: unknown;
```

Three facts, in order of weight:

```text
1  HARMFUL   this is the mechanism that let batch 1's stale `meta.source` reads
             keep compiling after the rename — all 24 of them typechecked as
             `unknown`. Withdrawing it is what forced the compiler to enumerate
             them. Leaving it means the next rename hides the same way.
2  UNUSED    compiler-verified, not grepped: with the signature withdrawn,
             `npm run typecheck` passes across `packages/*/src/**` AND
             `apps/demo/src/**`.
3  ORPHANED  its justification names guardrails, a package removed in a4bc5493.
             The hatch outlived its only stated consumer.
```

### ⚠️ And its ONLY consumer was a test asserting it exists

`write-context.spec.ts` carried `customKey: 'value'` and asserted the open
extension round-tripped. That was the sole thing in the repo exercising it.

> **A test whose subject is its own fixture cannot fail for a product reason.**

Identical circularity to pass 1's mock `.with()` suites. The declared-field
pass-through assertion is kept; the custom-key half went with the hatch.

## An incidental find: a perf assertion whose stated basis was wrong

Not from any falsifier class — it flaked during pass-2A verification.

```text
FAILED   memoised 11.67ms  vs  threshold 7.73ms
CLAIMED  "four orders of magnitude of headroom … only fails if memoisation stops
          working entirely"
```

The claim was wrong about its own mechanism: it compared 2,000 memoised reads
against 5x a **single** rebuild timing, and one `performance.now()` sample of one
rebuild carries JIT warm-up and GC noise that no headroom on the memoised side
can absorb. The real headroom was whatever that one sample happened to be.

Fixed by taking the FASTEST of three rebuilds — an estimate of how fast a rebuild
CAN go, which is what the comparison means. Four consecutive green runs after,
three before the fix confirmed the flake rather than a regression.

## Pass 2A verification

nx test core (1883 passed / 209 files), nx lint core, npm run typecheck,
nx build core, check-spec-types, verify-gates --fast 36/36 — all exit 0.

```text
SWEPT      M1, M2, M3, M4, M7, M8, M10, M11
NOT YET    M5, M9 (pass 2B), M6 (pass 3, on the reduced survivor set)
```

# MATRIX-CLOSE · pass 2B — M5 and M9

## M5 — clean in BOTH directions

Answered by the self-tested gates rather than by my own greps, which is the
stronger form:

```text
FORWARD   readme-apis        every @signaltree symbol named in a README exists
          error-codes        every emitted code documented, none invented
          doc-links, declaration-docs
REVERSE   dead-exports       no exported symbol unreachable from the barrels and
                             every import (1902 files, 865 imported names)
          demo-coverage      every root-barrel export demonstrated (17/17)
```

### The gap the gates cannot see, swept separately

`lint-readme-apis` checks imported SYMBOLS, not MEMBERS — which is exactly how
`tree.with(...)` survived in ENHANCERS.md until batch 7 grepped for it. So every
member name taught in CURRENT docs was extracted and checked against the built
declarations: 43 distinct names across 28 docs, 13 not found, **all 13
classified as false positives or correct history**:

```text
9   user-state property names from the examples' own state (todos, isAdmin,
    activeUser, retryCount, firmware, items, selectedUser, hasSelection,
    activeUserCount)
2   my regex's `$` alternative matching RxJS/NgRx rather than a tree —
    `users$.pipe(...)` and `this.store.select(...)`, the latter inside a block
    labelled "Before (NgRx)"
2   correctly historical — `## 6. batchUpdate() removed` and
    `updateOptimized()` "Deprecated in 13.5.0 and removed here"
```

Known-positive control, per the standing rule: the checker finds `undoable`,
`external` and `reload` in the declarations and does not find
`definitelyNotAMethod`. A zero result from it is therefore evidence.

## M9 — no duplicated ownership on any axis

```text
restoration eligibility   isTurnEligible only in restoration.ts;
                          restorationDesignated only in restoration-eligibility.ts
settlement                transactions.ts decides WHEN a transaction settles;
                          commit-consequence.ts decides WHETHER a durable
                          consequence may run. Different decisions, different
                          axes — and PER-B's P5/P7 proved persistence has no
                          "confirmed enough to save" rule of its own.
authored vs realized      one field, one reader (`getWriteParticipation`)
origin                    one field
transaction correlation   `transactionId` routes writes; `(owner, id)` identifies
                          lifecycle events. NOT duplication — `owner` is what
                          lets restoration filter its OWN transactions from
                          foreign ones (`event.owner === transactionOwnerToken`),
                          and DIAG-JOURNAL-1.1 measured that a bare id suffices
                          only WITHIN one tree.
diagnostic record         the journal OBSERVES; restoration history OWNS
                          reversal. F3-F7 proved the journal decides nothing.
structuralEffect          pass 2A removed the last three `*HistoryEffect*`
                          survivors; zero remain.
```

**Acceptance rule held:** two mechanisms may observe the same event, but only one
owns the decision on a given axis.

## ⚠️ M9's real work: is `asyncSource` a second, unclassified ingress?

The suspicion was strong and specific. `asyncSource` is exported from the root
barrel, its entire job is acquiring external data, and it contains no
`withWriteContext` at all — the loaded value lands via a bare
`dataSignal.set(value)`. That is the exact shape PER-B just fixed in
`stored().reload()`, where it cost two defects.

**Measured, and the suspicion is REFUTED:**

```text
load ran            0 -> 7
causal events       0
restoration steps   1 (baseline)
canUndo             false
undo of authored    succeeds; the loaded value is untouched
work
```

`asyncSource`'s value lives OUTSIDE the causal substrate — the same category as
PER-B's P1 autoload, not the same category as `reload()`. There is no turn to
admit, no location for P0-C to protect, no contribution for a transaction to
capture. **A bare `set` with no write context is CORRECT here, and wrapping it in
`external()` would be classifying a non-event.**

### ⚠️ And it took THREE harness attempts, which is the finding worth keeping

```text
attempt 1   causalEvents: 0   — because the load NEVER RAN (no injection context)
attempt 2   causalEvents: 0   — because the load never ran (wrong marker shape:
                                asyncSource takes { initial, load }, and its
                                accessor IS the value, not `.data()`)
attempt 3   causalEvents: 0   — because there is genuinely no causal event
```

The first two reported the RIGHT NUMBER for the WRONG REASON. Recording either
would have logged a correct conclusion on broken evidence — precisely the failure
mode this audit keeps finding in other people's tests, committed by the audit
itself. The spec now asserts the load explicitly (`before` 0, `after` 7) so a
future harness break surfaces as a failure rather than a silent zero.

## Pass 2B verification

nx test core (1885 passed / 210 files), nx lint core, check-spec-types,
verify-gates --fast 36/36 — all exit 0.

```text
SWEPT      M1 M2 M3 M4 M5 M7 M8 M9 M10 M11
REMAINING  M6 only — mechanism-removal proofs against the frozen survivor set
```

# MATRIX-CLOSE — THE FROZEN SURVIVOR SET (pre-registration for M6)

Frozen BEFORE any mechanism is removed. M6 may **falsify** this table; it may not
silently rewrite it. If a probe shows two rows are the same mechanism, that is an
M6 finding and one row is deleted explicitly.

**Seven mechanism rows, not eleven.** Three concepts from the conceptual list
collapse, and one owns no behaviour at all — recorded below rather than kept for
symmetry.

## The seven

```text
S1  RESTORATION DESIGNATION
    owner        restoration / restoration-eligibility.ts
    dimension    restoration eligibility
    consumer     `isTurnEligible(designated)` in restoration.ts
    behaviour    only explicitly designated authored work may enter restoration
                 history
    public door  undoable()
    probe        make `markMetaDesignated` return its input unchanged
    expected     histc2-door.spec.ts — an `undoable()` write is NOT admitted, so
                 the admission assertion fails

S2  PARTICIPATION
    owner        causal runtime / write-participation.ts
    dimension    authored vs realized vs inspection causal POLICY
    consumer     restoration admission, transaction capture, P0-C, stored()
    behaviour    a realized write gains no authored rights and makes no
                 transaction contribution
    public door  external()
    probe        make `getWriteParticipation` always return 'authored'
    expected     a1-ingress.spec.ts case 2 — `historyGrew` stops being 0

S3  ORIGIN
    owner        causal attribution / mutation-types.ts
    dimension    PROVENANCE
    consumer     `currentHydrateMode()` — the one policy consumer participation
                 CANNOT serve, since restoration and external truth are both
                 'realized' while restore-vs-merge depends on WHICH authority
                 replayed the write. Plus diagnostics.
    behaviour    a restoration replay is applied exactly; a rehydrate normalises
    probe        make `currentHydrateMode()` always return 'merge'
    expected     hydrate-decisions.spec.ts:110 "a RESTORE is not a decline" — the
                 marker treats the undo as a competing rehydrate and declines it

S4  TRANSACTION CORRELATION (transactionId)
    owner        transactions
    dimension    write-to-transaction correlation
    consumer     capture buckets, the rollback dependency ledger, the diagnostic
                 journal
    behaviour    effects correlate with the transaction that produced them
    public door  transaction()
    probe        omit `transactionId` from the context `transaction()` establishes
    expected     tx-ledger / rollback specs — speculative writes are no longer
                 captured into the transaction, so rollback compensates nothing

S5  LIFECYCLE IDENTITY (owner, id)
    owner        transaction-lifecycle.ts
    dimension    protocol identity ACROSS owners
    consumer     restoration's foreign-transaction filter
                 (`event.owner === transactionOwnerToken`), the journal
    behaviour    the same numeric id on two trees is not conflated
    probe        make `transactionIdentityKey` key on `id` alone
    expected     turn-feed-0-1-identity.spec.ts fails

S6  COMMIT-CONSEQUENCE BOUNDARY
    owner        commit-consequence.ts
    dimension    MAY this durable consequence run now? (distinct from
                 transactions' WHEN does settlement occur?)
    consumer     stored()
    behaviour    durable storage never gets ahead of settled commit state
    probe        make `scheduleDurableConsequence` run its consequence immediately
    expected     per-b-classification.spec.ts P5 — speculative state reaches
                 storage during a pending transaction

S7  STRUCTURAL EFFECT
    owner        mutation substrate (entity-signal, path-notifier)
    dimension    structural mutation description
    consumer     restoration reversal AND transaction rollback composition
    behaviour    add/remove/rekey carry enough information to be reversed safely
    probe        omit `structuralEffect` from delivered metadata
    expected     turn-effect-composition.spec.ts — subject-keyed composition
                 cannot annihilate add+remove
```

## Collapsed, and why — no row for these

```text
external()      NOT a mechanism. It is the public DOOR onto S2 + S3, and its
                removal probe IS S2's. Named as the door on those rows.
undoable()      the public door onto S1, same reasoning.
transaction()   the public door onto S4/S5/S6; the mechanisms are the three rows.

DIAGNOSTIC      ⚠️ WITHDRAWN — see the amendment below. This entry claimed the
JOURNAL         journal "owns no behaviour", which was a CATEGORY ERROR.

asyncSource     NOT an ingress mechanism. Pass 2B established POSITIVELY that its
                load runs and produces zero causal events, so there is no causal
                behaviour to prove.
```

## ⚠️ AMENDMENT — the table's first falsification, before any probe ran

The frozen table excluded the diagnostic journal on the grounds that it "owns no
behaviour". **That conflated two different claims.**

```text
F3-F7 PROVED      the journal owns no CAUSAL AUTHORITY
F3-F7 DID NOT     prove it owns no BEHAVIOUR
PROVE
```

The journal owns real behaviour — it observes causal turns, retains them
boundedly, observes lifecycle facts, preserves a monotonic sequence for
correlation, exposes `turns()` / `transactionEvents()`, and disposes cleanly.
That behaviour is READ-ONLY, which is a different thing from absent.

And MATRIX-CLOSE's null explicitly covers _diagnostic_ concepts, so excluding the
journal would have defined **every observation-only mechanism out of M6** — a
rule that would have exempted exactly the kind of mechanism most likely to be
silently inert. TURN-FEED-0.2 is the standing proof that an observer can be
broken and look fine.

```text
S8  DIAGNOSTIC JOURNAL
    owner        diagnostic observation
    dimension    bounded read-only causal chronology
    consumer     DevTools / diagnostic readers
    behaviour    authored / realized / inspection turns and lifecycle facts can be
                 observed and CORRELATED without granting restoration,
                 settlement or ownership
    probe        disable the journal's turn recording while leaving the notifier
                 and lifecycle production intact
    control      prove the causal write and the transaction actually occurred
    expected     the journal's grouping/correlation assertions lose their turns
                 while the tree's own behaviour stays correct
```

Its success criterion is unusually clean, and it is the whole point of the row:

```text
journal proof        RED
causal behaviour     GREEN
restoration rights   unchanged
transaction result   unchanged
```

The original entry's own words — _"removing it must break nothing except its own
specs"_ — were already almost the right expectation. Its specs ARE the proof of
the behaviour it owns; "nothing else breaks" is the non-interference half.

### And this repairs S3 rather than weakening it

Forcing `currentHydrateMode()` to `'merge'` proves that **`origin: 'restoration'`
has an independent policy consumer participation cannot replace**. It does not
prove the whole provenance axis: `'external'`, `'devtools'` and
`'transaction-rollback'` are diagnostic provenance, and S8 is where they earn
their existence through observable behaviour instead of leaning on S3's single
policy consumer.

```text
S3   provenance mechanism — ONE authority-specific policy consumer
     (restoration -> exact restore rather than merge), plus diagnostic consumers
S8   observes provenance, owns diagnostic chronology, owns NO causal policy
```

## Pre-registered outcomes per probe

```text
PROVEN                 the intended assertion fails for the predicted SEMANTIC
                       reason
NOT PROVEN — COMPILE   removal only causes type or import fallout
NOT PROVEN — CRASH     execution never reaches the behaviour under test
NOT PROVEN — INCIDENTAL some other behaviour fails while the claimed invariant
                       still passes
HARNESS INVALID        the positive arm never exercised the mechanism at all
```

The fifth category is earned rather than theoretical: pass 2B's `asyncSource`
probe produced the CORRECT zero twice from a harness that never ran the load.
**Every probe below therefore states its positive control** — the thing that must
be observably true before the removal result means anything.

## Method

```text
one mechanism at a time      restore before the next
capture the failure MESSAGE  not just the exit code — the message is what proves
                             the reason
green before and after       the restore is verified, not assumed
```

# MATRIX-CLOSE · M6 — eight mechanism-removal probes. SIX PROVEN, TWO NOT

One mechanism at a time, restored before the next, tree verified clean and green
after all eight (1885 passed).

```text
S1  restoration designation   PROVEN
S2  participation             PROVEN
S3  origin                    ⚠️ NOT PROVEN
S4  transaction correlation   PROVEN
S5  lifecycle identity        ⚠️ NOT PROVEN
S6  commit-consequence        PROVEN — table's named spec was WRONG
S7  structural effect         PROVEN, overwhelmingly
S8  diagnostic journal        PROVEN — and exactly as its criterion predicted
```

## The six proven

```text
S1  markMetaDesignated stops stamping
    -> histc2-door.spec.ts, 8 failures, "expected +0 to be 1" — nothing is
       admitted. The predicted semantic reason.

S2  getWriteParticipation always returns 'authored'
    -> a1-ingress.spec.ts, "expected 'no-refusal' to be 'ST1034'" — P0-C stops
       protecting external truth, which is precisely the behaviour claimed.

S4  transactionId omitted from the transaction's context
    -> diag-journal-1-1-correlation.spec.ts, "txIds [undefined]" and one turn
       where two were expected. Correlation is the behaviour, and it is gone.

S6  the settlement boundary disabled
    -> ⚠️ the table named per-b-classification P5, and P5 STAYED GREEN. The real
       proofs are persistence-commit-ordering.spec.ts, stored-commit-ordering.spec.ts
       and a2-persistence-discriminators.spec.ts — 8 failures.
       WHY P5 did not fail, which is the useful part: P5's write happens INSIDE a
       transaction callback, so it takes commit-consequence's FIRST branch
       (`deferCommitConsequence(owner, transactionId, …)`), and the probe disabled
       the SECOND (the open-scope-key path). Two routes into one boundary, and the
       table named a spec that exercises the other one.

S7  structuralEffect dropped from delivered metadata
    -> 107 failures across restoration, transactions, entity lifetime and
       a1-ingress. The most load-bearing mechanism in the set.

S8  the journal's turn recording disabled
    -> EXACTLY the pre-registered criterion, which is why the amendment was worth
       making:
           journal specs        RED (6: correlation, F3, F4, F4b, F5, retention)
           everything else      GREEN (1879 passed)
       An observer with real behaviour and no authority. Note that F3/F4/F5 fail
       through their POSITIVE CONTROLS — the assertions that the journal actually
       observed something — which is those controls doing the job they were added
       for.
```

## ⚠️ S3 — NOT PROVEN. `origin` has no proven POLICY consumer

```text
probe      currentHydrateMode() forced to 'merge'
target     hydrate-decisions.spec.ts:110 "a RESTORE is not a decline"  -> GREEN
full suite 1885 passed, 20 skipped                                     -> GREEN
```

**Forcing the mode breaks nothing in the entire suite.** So the row's claimed
behaviour — _a restoration replay is applied exactly; a rehydrate normalises_ —
has no proof.

This retracts a claim MATRIX-CLOSE pass 1 made:

```text
PASS 1 SAID   "`currentHydrateMode` is the strongest evidence in the repo that
              `origin` earns its axis" — a policy consumer participation cannot
              serve
M6 SAYS       that consumer is UNOBSERVED. The reasoning may still be correct;
              the EVIDENCE does not exist.
```

Two possible resolutions, and M6 does not choose between them:

```text
A  the behaviour is real and untested   -> it is owed a test. The in-source
                                           rationale describes a measured defect
                                           ("n=3 rows=3 -> undo -> n=2 rows=3"),
                                           so a spec should be recoverable from it.
B  the mechanism is dead                -> the marker-hydrate path no longer
                                           depends on the distinction, and the
                                           branch should go.
```

Either way, `origin` remains justified as a PROVENANCE axis — DX-NAMES-1.3's
Fact 1 and 2 stand on the enum's structure and on consumer visibility, not on
this. What is withdrawn is the claim that it has a proven policy consumer.

## ⚠️ S5 — NOT PROVEN. The `owner` half of lifecycle identity is unobserved

```text
probe      transactionIdentityKey returns String(id), dropping the owner ordinal
target     turn-feed-0-1-identity.spec.ts  -> GREEN (2/2)
full suite                                  -> GREEN (1885 passed)
```

The identity spec was written specifically as this falsifier, and it does not
falsify. A distinction the probe surfaced:

```text
the KEY's owner component      unproven — nothing observes a collision
restoration's owner FILTER     different mechanism (`event.owner ===
                               transactionOwnerToken`), compared directly, not
                               through the key
```

And DIAG-JOURNAL-1.1 already measured that **one tree announces under exactly one
owner**, with channels held per-tree host — so within the only scope that ever
reads the key, `id` alone may genuinely suffice. That points at resolution B, but
it is not proven either.

```text
A  a second announcing owner is possible and untested -> owed a test
B  it is impossible by construction                   -> the owner component is
                                                         redundant and should go,
                                                         with the per-tree
                                                         invariant asserted instead
```

## The two probes that needed rescuing, recorded

```text
S7 first run   ANCHOR-MISS — my patch string did not exist. Caught by the
               anchor-count assertion rather than by a green run.
S8 target run  HARNESS INVALID — I pointed at
               `src/lib/internals/diagnostics/diag-journal-1-grouping.spec.ts`
               and the file is at `src/lib/internals/diag-journal-1-grouping.spec.ts`.
               Vitest found no tests and exited 1, which the target arm reported
               as "before=1" rather than as a pass. The FULL-SUITE arm is what
               produced S8's result.
```

Both are why the method requires a green-before arm and a full-suite arm rather
than trusting one named spec.

## Status

```text
M1-M5, M7-M11   swept
M6              8 probes run; 6 proven, 2 NOT proven
OPEN            S3 and S5 — each needs a test written or a mechanism deleted.
                That is a decision, not a sweep, so MATRIX-CLOSE does not make it
                unilaterally.
```

# MATRIX-CLOSE — S3 and S5 RESOLVED. Two mechanisms deleted

Neither was kept on the strength of a plausible rationale.

## S3 — RECOVERY ATTEMPTED, and it found something stronger than "the defect is gone"

The rule was: recover the exact case the comment claims, and let the result
decide. Do not invent a different scenario that happens to make the branch
matter.

```text
the claimed corruption   n=3 rows=3  ->  undo  ->  n=2 rows=3
reproduced?              NO — both revert (n=2 rows=2)
```

But the recovery turned up the reason it CANNOT matter, which is a stronger
result than a defect having been fixed elsewhere:

```text
currentHydrateMode() produced   'merge' | 'restore'
every marker branches only on   'rehydrate'
```

`entity-map.ts` and `async-source.ts` each decline exactly one mode —
`mode === 'rehydrate'` — and `currentHydrateMode()` never produced it. **Both of
its return values fell through the same path in every marker processor.** The
distinction was computed and no consumer could act on it.

```text
DELETED    currentHydrateMode(); the call site passes 'restore' directly
KEPT       `origin` — this deletes a POLICY BRANCH, not the axis. Provenance
           consumers (DevTools action metadata, the diagnostic journal) and
           DX-NAMES-1.3 Fact 1 are untouched. What is withdrawn is the claim,
           made in MATRIX-CLOSE pass 1, that origin had a policy consumer.
PERMANENT  s3-hydrate-mode-recovery.spec.ts holds both halves — the historical
PROOF      case not reproducing, AND 'merge'/'restore' being indistinguishable to
           a loader-backed marker while 'rehydrate' is not. The branch cannot
           return on the strength of its own comment.
```

A small confirmation arrived from lint: deleting the branch orphaned
`getActiveWriteContext` in `signal-tree.ts`. That function was the file's ONLY
consumer of the ambient write context.

## S5 — the owner component DELETED from the key, `event.owner` KEPT

```text
DELETED   transactionIdentityKey(owner, id) -> transactionIdentityKey(id), and the
          interned-ordinal WeakMap with it
KEPT      TransactionLifecycleEvent.owner — a DIFFERENT mechanism, compared
          directly by restoration (`event.owner === transactionOwnerToken`) to
          ignore its own announcements and act only on foreign ones
```

The invariant that makes a bare id sufficient was already measured by
DIAG-JOURNAL-1.1 and is now asserted where the deletion happened:

> A channel is installed on ONE tree's canonical host and exactly ONE owner
> announces on it. Two trees both mint id 1 and never share a channel, so the
> collision the ordinal disambiguated cannot reach any single reader.

Two tests added to `turn-feed-0-1-identity.spec.ts` — the spec that failed to
falsify — so it now asserts the invariant that replaced what it could not prove:

```text
two trees each mint id 1, and no observer sees both
event.owner is still load-bearing — every announcement carries the SAME owner,
which is what makes the foreign/own comparison a usable filter
```

The second is worth noting: M6 did not disprove `event.owner`, but nothing
proved it either. It has a proof now.

```text
owner on the EVENT    earned, and now tested
owner inside the KEY  unproven, and gone
```

## MATRIX-CLOSE — CLOSED

```text
M1-M5, M7-M11     swept
M6                8 probes: 6 proven, 2 not
S3, S5            RESOLVED by deletion, each with a permanent proof of why
```

Against the stopping rule — _every surviving concept has an owner, a consumer, a
semantic dimension and a falsifiable proof, and every unexplained residue is
deleted or explicitly carried_:

```text
SIX PROVEN SURVIVORS   restoration designation, participation, transaction
                       correlation, commit-consequence, structural effect,
                       diagnostic journal
TWO DELETED            currentHydrateMode's policy branch; the owner ordinal in
                       the identity key
RESIDUE DELETED        mock `.with()` suites, the WriteMetadata escape hatch and
                       its self-referential test, three stale `*HistoryEffect*`
                       names, one false authority name (`EditSession`)
CARRIED OUT            whole-array scoped undo (RESTORE-P1); 149 uncoded throws
                       (own triage); the noisy-baseline perf assertion (fixed
                       incidentally)
```

Four of this workstream's findings were the audit correcting ITSELF — the
`getRestorationHistory` rename, the `asyncSource` harness, the S6 spec
misattribution, and pass 1's `currentHydrateMode` claim now withdrawn by M6.

## Queue

```text
1  Candidate B      only if materially different                     <-- next
2  TruckTrax passes 2-3
3  final perf / retention
4  FULL historical release gate suite (not --fast)
5  RC / final closure
```

# RELEASE-RESIDUE-0 — the debris sweep. FOUR live findings

> **NULL: does the repository still contain any LIVE artifact that describes,
> exposes, imports, tests, configures or implies a v15 mechanism that no longer
> exists?**

⚠️ **ORDERING CORRECTION.** Candidate B was frozen at `ca3663b4` and tagged before
this pass was requested. That was the wrong order. This scan found live residue,
so **B moves** — a frozen artifact with debris is worse than a freeze one commit
later.

Deliberately mechanical. Known-positive control on every zero (`undoable` appears
in 75 files, so a zero elsewhere is a real zero).

```text
ZERO HITS   timeTravel, TimeTravel, causalMode, CausalWriteMode, 'authoring',
            'realization', UpdateMetadata, getHistory(, resetHistory(,
            historyEffect, StructuralHistoryEffect, isApplyingExternalState,
            SHOW-, M6-, M7-PROBE
TOMBSTONES  restorationEligibility (3), currentHydrateMode (6), pauseRecording,
            transient — all documenting their own removal. KEPT.
LIVE-VALID  `d.realize(ctx)` in single-pass-construction.spec.ts — an unrelated
            local descriptor hook, not the deleted door
```

## FINDING 1 — a production guide taught THREE deleted mechanisms

`docs/guides/time-travel-in-production.md`, current guidance, built around levers
that no longer exist:

```text
§2   `entityMap({ recordHistory: false })`   DELETED in 15.0
§4   `restoration({ shouldSkip })`           DELETED in 15.0
"A starting configuration"                   used BOTH — the most copy-pasted
                                             snippet in the guide
the composition-patterns table               recommended them per row, including
                                             "Yes — the headline pattern"
```

⚠️ And the mechanism by which it survived is the one predicted: **my own batch-4
sweep renamed `timeTravel(` -> `restoration(` INSIDE these instructions**, so the
file now taught `restoration({ shouldSkip })` — the new name carrying a dead
option. A rename that touched the file and left the corpse.

Corrected following the guide's own §3 convention (which already marked
`pauseRecording()` struck-through and REMOVED): §2 and §4 marked removed with the
opt-in replacement shown, the original §2 text preserved in a `<details>` block
because its memory arithmetic is still the reason the lever existed, the starting
configuration rewritten to what actually ships, and all five table rows
re-pointed at `undoable()` / `external()`.

## FINDING 2 — the root README taught two deleted levers as the answer

> "If you just need undo over a big grid, `pauseRecording()` and
> `restoration({ shouldSkip })` are the levers."

Both deleted. Replaced with `undoable()`, which is what actually does that job.

## ⚠️ FINDING 3 — THE README TAUGHT THREE SUBPATH IMPORTS, NONE OF WHICH RESOLVE

```typescript
import { SecurityValidator, SecurityPresets } from '@signaltree/core/security';
import { createEditSession, createTreeEditSession } from '@signaltree/core/edit-session';
import { createStorageAdapter, createIndexedDBAdapter } from '@signaltree/core/storage';
```

```text
packages/core/package.json exports   { ".", "./package.json" }
```

`security` and `storage` were deleted in 15.0. **`edit-session` was never in the
export map at all** — and it is LIVE CODE. So:

```text
createEditSession / createTreeEditSession   UNREACHABLE by any consumer
EditSession.getEditHistory()                dead public surface — pass 2A renamed
                                            something no consumer can call
```

The barrel's own comment says _"Moved to '@signaltree/core/edit-session' in v9.
Import from there to reduce main bundle size"_ — pointing at a subpath that does
not exist.

**Why no gate caught it.** `lint-readme-apis` validates symbols against BUILT
ENTRY POINTS, and there are two (core, shared); an import from a path that is not
an entry point is not checked against anything. `find-dead-exports` measures
reachability from barrels and in-repo imports — edit-session's own specs import
it, so it looks reachable. Neither gate asks _"is this reachable from a PUBLISHED
entry point?"_

```text
FIXED     the README block, which no longer teaches unresolvable imports
CARRIED   whether edit-session should be PUBLISHED or DELETED is a surface
          decision, not residue cleanup. Recorded, not answered.
NEW GAP   no gate checks documented-subpath-vs-export-map. Candidate for the
          gate suite.
```

## FINDING 4 — an ORPHANED JSDoc block on a live public interface

`TreeConfig` carried twenty lines of JSDoc for a `security` field — import
instructions, a v11 migration note, two worked examples — and **the field itself
was already gone with SEC-DEL.** Only the documentation survived, inside a live
public type, describing a subpath that no longer resolves.

Replaced with a short note recording what was there and why it went.

## Classification — zero unexplained hits

```text
LIVE-VALID              1   (`d.realize(ctx)`, unrelated concept)
INTENTIONAL-TOMBSTONE   4   restorationEligibility, currentHydrateMode,
                            pauseRecording, transient
DELETED / FIXED         4   the guide's three false levers, the README's two dead
                            levers, the README's three unresolvable imports, the
                            orphaned JSDoc
CARRIED-WORKSTREAM      3   whole-array scoped undo -> RESTORE-P1
                            149 uncoded throws -> error-taxonomy triage
                            edit-session publish-or-delete -> surface decision
```

The two previously-carried items survive this scan **because they are explicitly
carried**, not because the sweep missed them — which is what the stopping rule
asked for.

# RELEASE-RESIDUE-0.1 — edit-session DELETED, and the gate that would have caught it

## edit-session is deleted, not published

```text
packages/core/src/lib/edit-session.ts        DELETED
  + edit-session.spec.ts, -clone-fidelity, -lossless-clone
```

The evidence pointed at deletion rather than rescue, and none of it is about the
code's quality:

```text
no reachable published entry point — never in the export map
no production consumer has demonstrated a need
its "public" status came from COMMENTS and a README, not from package.json
its only importers were its own specs
Candidate A converged on one package, one "." entry point, no companion subpaths
MATRIX-CLOSE's rule: only DEMONSTRATED third-party need earns public surface
```

**Implemented and tested is not evidence that something should ship** — this
release has deleted several things for exactly that reason. Publishing it now
would turn an archaeological accident into a permanent v15 commitment.

A consequence worth stating: pass 2A's `getEditHistory()` rename was production
churn on unreachable code. Both findings are still true — MATRIX-CLOSE caught a
name claiming an authority it did not have, and RELEASE-RESIDUE then found the
whole surface was unreachable.

The repo already half-knew. `docs/myths-and-misconceptions.md` said plainly that
`18fe5781` withdrew the subpath and _"There is no import path for it"_, and
`check-rc-public-dispositions.mjs` recorded it as **"UNPLACED edit-session
subpath; null not run"** — while the README taught the import and the barrel
comment pointed readers at it. **The fact was right in two places and contradicted
in three.**

## The new gate — `check-documented-imports.mjs`

```text
lint-readme-apis    does this SYMBOL exist in some built entry point?
find-dead-exports   is this symbol reachable from barrels or repo imports?
NEW                 can a USER import the documented SPECIFIER at all?
```

It resolves every `from '@signaltree/…'` in LIVE docs into package + subpath and
requires the subpath to be in that package's real `exports`. Historical material
is excluded **by path and filename**, never by inspecting the snippet — a current
guide must not pass because a parser guessed it was about the past.

Self-tested, and wired into `verify-gates` with its self-test as a separate row:

```text
@signaltree/core                          -> resolves
@signaltree/core/definitely-not-exported  -> rejected
@signaltree/definitely-not-a-package      -> rejected
```

### ⚠️ It found two more on its FIRST run, and one is worse than edit-session

```text
packages/core/README.md — the SHIPPED readme, inside the npm tarball

  @signaltree/ng-forms                     the package was DELETED in 41373050
                                           (NGF-DEL). Two sections, a full
                                           validator API, worked examples.
  @signaltree/core/enhancers/batching      never an export, and presented under
                                           a ✅ as "Also fine: Explicit subpath"
```

A deleted package still being taught in the shipped README is the strongest
possible justification for the gate, and `lint-readme-apis` structurally could
not see it: a specifier for a package that is not built is checked against
nothing.

### And the gate suite caught its own follow-on

Deleting edit-session removed the only emitter of **ST2028**, and
`check-error-codes` failed immediately — documentation obligation surfaced
mechanically rather than by memory. Marked retired using the catalogue's existing
convention.

## The two carries, with the dispositions the owner set

```text
WHOLE-ARRAY SCOPED UNDO / RESTORE-P1
  Candidate B    does NOT block
  before final   MUST be explicitly dispositioned
  the question   does v15 documentation IMPLY that a whole-array replacement
                 designated with `undoable()` is reversible? If yes, narrow the
                 docs or fix it. If no, keep the permanent regression showing the
                 safe outcome and carry the capability work.
  NOT OPENED NOW — MATRIX-CLOSE proved it is an independent restoration
  capability problem, and pulling it in now violates the boundary that stopped
  MATRIX-CLOSE becoming another design cycle. TruckTrax 2-3 is evidence: if a
  real consumer naturally hits this shape, the priority changes.

149 UNCODED THROWS
  Candidate B    does NOT block
  before RC      BOUNDED triage only
  the question   is there a USER-ACTIONABLE public failure in the shipping v15
                 surface that the catalogue promises to explain and cannot?
                 NOT "does every throw have a code" — that is a taxonomy project
                 with 149 opportunities for arbitrary decisions.
  Internal invariant-only throws stay out of this release.
```

## Verification

```text
nx test core     1871 passed / 209 files   (18 fewer — edit-session's suites)
lint, typecheck, build core, build demo    all 0
verify-gates --fast                        38/38   (36 + the new gate and its
                                                    self-test)
```

# TRUCKTRAX PASS 2 — read-only. The frozen failure ledger

Candidate B = `6ee4a27f`. Consumer = `~/code/v3` (scaletrax, trucktrax-geo,
geotrax) on **@signaltree/core 13.3.0**. **No TruckTrax file was modified.** The
artifact is the ledger, not a working consumer.

## Consumed surface — 10 symbols, 32 import sites, all from `@signaltree/core`

### ⚠️ AMENDED — the first numbers were LEXICAL OCCURRENCES, not call sites

The original table reported `stored 61 / loader 50 / asyncSource 17 / status 54`
from `grep -rhoE "\b$s\b" | wc -l`, which counts comments, type references and
repeated mentions. **This is the same counting error the audit corrected once
before** — A1 had to restate `loader` from six IMPORT sites to nineteen CALL
sites. Counting a proxy instead of the thing is the recurring shape of every
defect in this repo's history, and it recurred here.

Re-measured as declarations:

```text
symbol                  DECLARATIONS  files   in Candidate B's ONLY entry point?
signalTree                       11      -    EXPORTED
entityMap / derivedFrom
  / WithDerived                   -      -    EXPORTED
timeTravel                        -      -    renamed -> restoration()
loader                           19      6    *** NOT EXPORTED ***
stored                    7 leaves       10    *** NOT EXPORTED ***
status<E>                         9     25    *** NOT EXPORTED ***
asyncSource                       1      2    *** NOT EXPORTED ***
flushAllStoredSignals             1      1    *** NOT EXPORTED ***
```

**"100+ production sites" is WITHDRAWN.** The real footprint is 19 loader
configurations, 7 persisted leaves, 9 status markers, ONE asyncSource declaration
and ONE host drain. A materially different argument, and it must not be allowed to
become a false one later.

Parsed from the BUILT declaration's export statements, not from a name grep: 68
named exports, and six of TruckTrax's ten are absent.

## ⚠️ THE HEADLINE — five markers are deliberately withdrawn, and TruckTrax runs on them

Not a v15 regression. `c53aa416` ("remove stored marker from public rc surface")
predates Candidate A, and A's barrel is already without them. They are recorded
decisions in `check-rc-public-dispositions.mjs`'s BLOCKED list:

```text
asyncSource            "DELETE / named carrier removed"
loader                 "UNRESOLVED cache-policy carrier; survival requires
                        independent authority"
stored                 "NOT EARNED as RC public API; consequence ordering fix is
                        not survival proof"
flushAllStoredSignals  "LC page-hide drain for stored debounce hazard"
```

So the surface decision is deliberate AND a real production consumer uses all of
it — `stored` at 61 sites, `loader` at 50, `status` markers in five state files
(`save: status<NotifyErrorModel>()`), `asyncSource` at 17.

**Candidate B offers no documented replacement for any of them.** That is the
finding pass 2 existed to produce, and internal analysis could not have produced
it: every gate passes, because the gates check that what IS exported is coherent,
not that what a consumer NEEDS is exported.

## The ledger

```text
TT2-1  timeTravel() -> restoration()
       sites            17
       failure          symbol not exported
       replacement      restoration(), same config shape
       docs sufficient? YES — the rename is in the migration path and the audit
       shape            mechanical rename
       class            BREAKING-BY-DESIGN

TT2-2  automatic history -> undoable() opt-in
       sites            every write in a restoration()-enabled tree
       failure          COMPILES AND RUNS, records nothing. The dangerous one:
                        no error, just an undo stack that is silently empty
       replacement      wrap authored operations in undoable()
       docs sufficient? PARTIAL — undoable() is documented; nothing tells an
                        UPGRADING consumer that its existing undo stopped working
       shape            semantic — requires deciding which operations are
                        user-reversible
       class            BREAKING-BY-DESIGN + DOC/DX-GAP

TT2-3  stored()                 7 persisted leaves, 10 files
       class            DOC/DX-GAP -> A2-REOPEN. PER-B supplied evidence that did
                        not exist when "NOT EARNED as RC public API" was written.

TT2-4  loader()                19 configurations, 6 files
       class            DOC/DX-GAP — NOT a defect. A1 examined these exact 19
                        sites and resolved "C1 yes, C2 is one narrow seam", which
                        became `external()`. TT2 produces no new evidence against
                        A1; it exposes a MISSING MIGRATION RECIPE.

TT2-5  status<E>()              9 markers, 25 files
       class            ⚠️ UNRESOLVED, not decided. A3-TX settles it.

TT2-6  asyncSource()            1 declaration, 2 files
       class            DOC/DX-GAP. Deletion STANDS — M9 measured positively that
                        its load produces ZERO causal events, so it is outside the
                        causal substrate and reinstating it as a core primitive
                        would go backwards. Migration is ordinary Angular/RxJS
                        ownership, NOT `external()` around a non-event.

TT2-7  flushAllStoredSignals    1 call, 1 file
       class            DOC/DX-GAP -> A2-REOPEN as the host-drain half. The
                        BEHAVIOUR earned itself — Capacitor backgrounding is the
                        host lifecycle the web platform cannot infer, which A2
                        already established. The SPELLING is a smaller question.

TT2-8  @signaltree/ng-forms in the workspace catalog
       failure          package deleted (41373050)
       reality          ZERO imports in apps/*/src or libs — declared, unused
       class            STALE-TRUCKTRAX

TT2-9  HTTP acquisition applied with no classification
       sites            19 (the A1 corpus: loader declarations + ops setAll)
       failure          none at build time. Under 15.0 an untagged refresh is
                        authored work, so it is NOT protected by P0-C and CAN be
                        captured into a transaction's contribution
       replacement      external(() => …)
       docs sufficient? YES — external() ships with the definition in its first
                        JSDoc line
       shape            semantic — 19 sites, mechanical once understood
       class            BREAKING-BY-DESIGN (a correctness improvement the
                        consumer must opt into)
```

## ⚠️ A SECOND GATE GAP, now demonstrated rather than theoretical

`stored()` is documented at length in the SHIPPED core README and is not
exported. Neither gate sees it:

```text
check-documented-imports   checks SPECIFIERS. `@signaltree/core` resolves, so it
                           passes. It never looks at the symbol.
lint-readme-apis           checks symbols that appear in an IMPORT STATEMENT. The
                           README shows `stored('key', default)` inside a state
                           object and never imports it, so there is nothing to
                           check.
```

The edit-session finding was documented-but-unpublishable at the SPECIFIER level.
This is the same defect at the SYMBOL level. **A third gate is owed:** every
`@signaltree` API named in a live doc as a CALL must be an exported symbol.

## What pass 2 did NOT do

No build or typecheck of v3 against Candidate B — that needs the dependency
repointed, which modifies the consumer. The analysis is static against the built
declaration's export list, which is the same authority a compiler would use. The
failure ledger is complete for the symbol surface; RUNTIME behavioural differences
(TT2-2 and TT2-9 in particular, which compile cleanly and change meaning) are
identified but unmeasured, and pass 3 is where they get measured.

## The A/B fork is REJECTED as too coarse

The five symbols do not share an architectural status, and one decision covering
all of them would restore things TT2 gives no grounds to restore.

```text
loader()                withdrawal STANDS — A1 settled it on these exact sites
asyncSource()           deletion STANDS — M9 measured it outside the substrate
stored()                A2 REOPENS — PER-B is new evidence
flushAllStoredSignals() reopens WITH A2, as the host-drain half
status<E>()             ⚠️ never resolved. A3-TX settles it now.
```

**What TT2 actually exposed, precisely:**

```text
A1  was SETTLED, and its migration story was never written
A2  was once UNRESOLVED, and PER-B has since supplied major new evidence
A3  was explicitly left UNRESOLVED and then disappeared behind a blocked-symbol
    list, which read as a decision it never was
```

Call-site counts are not votes for old spellings — A1 said so first, and the
corrected numbers above are exactly why that rule matters.

# A3-TX — the owed falsifier, run. And a CORRECTION to the premise

## The falsifier's answer: `transactions()` CANNOT absorb `status<E>()`

Measured in `a3-tx-status-falsifier.spec.ts` against the real production shapes.

```text
case 1  POST /ticket, no speculative state
        -> to open a transaction at all we had to WRITE A SENTINEL
           (`ticket.id.set('__inflight__')`) — inventing a speculative business
           write purely to obtain operation status
        -> "a pending transaction exists" is TREE-scoped, not per-operation
        -> a rollback reverses writes and retains NO typed error payload

case 2  imperative feature-flag load
        -> a transaction opens and confirms with ZERO writes. It does not refuse
           — which is worse for the absorption argument, not better: an empty
           ceremony carrying no loading state and no typed error. Nothing to wrap,
           and wrapping nothing yields nothing.
```

## ⚠️ BUT THE PREMISE WAS WRONG, and it changes the outcome

The brief said A3 _"was explicitly left unresolved and then disappeared behind a
blocked-symbol list"_. **It was resolved, by measurement.** `4decd287` deleted the
marker with a rationale from derivation S1:

> the two capabilities the API implied — **transition governance** and **lifecycle
> observation** — were both absent: every setter was an unguarded assignment, and
> nothing in core ever drove status from an execution

Verified against the pre-deletion source: the setters were bare pairs of
`stateSignal.set(...)` / `errorSignal.set(...)` with no guard, four of them, plus
promise-style aliases. `status()` was **two signals and four unguarded setters** —
ordinary store truth wearing a primitive's clothes.

So the alternative was never `transactions()`. **My falsifier answers a question
that was not the one deciding the case** — correctly, and it resurrects nothing.

```text
WITHDRAWN   "A3 was never resolved"
STANDS      A3 was resolved by S1 on measurement. `status` does NOT come back.
USEFUL      A3-TX's negative result is still worth keeping: it says do not migrate
            status to transactions either. That was a live temptation.
```

## The replacement, demonstrated rather than asserted

Because declining to restore something nine production sites use requires showing
the migration exists:

```ts
save: { state: 'idle' | 'loading' | 'loaded' | 'error', error: NotifyError | null }

const setLoading = () => { state.set('loading'); error.set(null); };
const setError = (e) => { state.set('error');   error.set(e); };
const isLoading = () => state() === 'loading';
```

Identical behaviour to the deleted marker, typed error preserved, no primitive
required — because the marker was never doing more than this. **What v15 owes is
the RECIPE, not the API.**

## TT2-5 reclassified

```text
WAS   ⚠️ UNRESOLVED — A3-TX settles it
NOW   DOC/DX-GAP. Deletion stands on S1's measurement; migration is ordinary
      state + derived predicates, mechanical across all 9 markers.
```

## Where this leaves the five withdrawn symbols

```text
loader()                withdrawal STANDS   A1, on these exact 19 sites
asyncSource()           deletion STANDS     M9, measured outside the substrate
status<E>()             deletion STANDS     S1, measured — corrected above
stored()                A2 REOPENS          PER-B is genuinely new evidence
flushAllStoredSignals() reopens WITH A2     the host-drain half
```

**THREE of five stand; TWO reopen.** (An earlier draft of this line said "four of
five" — wrong arithmetic, corrected here before it could be inherited as fact.
`loader`, `asyncSource` and `status` stay withheld; `stored` and the host drain
reopen together, because they are two halves of one capability.)

Only persistence has new evidence, and it is the one the brief was right to single
out: PER-B did not exist when _"NOT EARNED as RC public API"_ was written.

# A2-REOPEN — PRE-REGISTERED. The capability, not the spelling

> **Given PER-B's settled causal semantics, what is the SMALLEST public
> persistence capability that lets ordinary state survive process lifetime and
> lets a host synchronously drain pending durable work, WITHOUT making persistence
> a causal authority?**

⚠️ **`stored()` and `flushAllStoredSignals()` are NOT preregistered as the answer.**
The whole production-surface process has been about not letting historical
spelling decide architecture, and `stored` having an implementation is the same
non-argument that `edit-session` had.

## Settled, and NOT reopened

PER-B established these; A2 may not relitigate them, only prove a proposed surface
reaches them.

```text
ordinary app write        AUTHORED; persistence observes it
construction / autoload   MATERIALISATION — no causal write at all (P1)
reload into a live tree   EXTERNAL / REALIZED (P2)
pending transaction       must not become durable before settlement (P5)
inspection                must not persist (DEVTOOLS-JUMP-0.1)
host drain                a DURABILITY operation, not a tree-state write
```

## Three candidate placements

```text
A2-A  DECLARATION MARKER            signalTree({ theme: stored('theme','light') })
A2-B  COMPOSITION over a node       persist(tree.$.theme, { key: 'theme' })
A2-C  TREE-SCOPED CAPABILITY        const durability = persistence(tree, {...})
```

The discriminating question, and the one Signal Forms already taught once:

> **Does persistence need to change what a BRANCH IS, or is it behaviour attached
> to ordinary state?**

Forms resolved as _ordinary state + composition_ when the capability could live
outside the tree ontology. Persistence may be the next such case — or may be the
exception, for one specific reason tested first.

## The five discriminators

```text
A2-1  CONSTRUCTION MATERIALISATION   ⚠️ run first — it is the only reason a
      durable value present at construction must be the FIRST publicly observable
      value, with no transient default, no causal write, no diagnostic turn, no
      restoration entry, no transaction evidence.
      If composition cannot reach that without a post-construction write, a
      declaration-time marker OWNS something composition cannot reproduce — a real
      semantic reason rather than "we have the code".

A2-2  LIVE RELOAD                    the surviving surface must reach
      origin external / participation realized, and a prior authored write must
      not be able to discard the durable truth afterwards.

A2-3  SETTLEMENT                     pending tx -> storage unchanged; confirm ->
      may update; rollback -> unchanged. No persistence API invents its own
      settlement rule.

A2-4  HOST DRAIN                     the real Capacitor shape: armed debounce,
      host says backgrounding, drain returns with the latest value durable.
      OWNERSHIP IS OPEN — `durability.flush()`, `tree.persistence.flush()`, or a
      process-global `flushAll…()` only if nothing narrower can find every pending
      write.

A2-5  LIFETIME                       an armed durable write MAY complete after
      destroy; nothing may write back INTO the tree, resurrect state, or retain
      the owner indefinitely. The new placement must not change what PER-B P11
      measured.
```

## Excluded unless one of the five demands it

```text
MigrationFn        tags               storage factories
collection persistence                prefix-clearing utilities
custom lifecycle heuristics           a storage-specific origin
a persistence-specific transaction authority
```

This is what stops "A2 reopened" becoming "restore the old subsystem". The
corrected footprint is SEVEN persisted leaves and ONE drain — small enough to
reason from what production needs rather than from the 61-lexical-hit illusion.

## Stopping rule

> A2 closes when **exactly one** public placement satisfies construction
> materialisation, live external reload, settlement ordering, native-host drain
> and lifetime semantics **with the least new authority and surface**.

## Standard of evidence, carried from A3

A new experiment may reopen an old disposition **only where it brings genuinely
new evidence**. A3-TX did not overturn S1 — `status()` had already been measured as
ordinary state with unguarded setters, and the replacement was demonstrated
directly. PER-B is that new evidence for persistence; nothing else here qualifies.

# A2-1 — CONSTRUCTION MATERIALISATION. The marker does not own it

Four arms, same durable value, same assertions —
`a2-1-construction-materialisation.spec.ts`.

```text
arm A  marker: stored('key','default')          first value durable, ZERO causal
                                                writes, no restoration entry
arm B  compose AFTER construction               ⚠️ transient default publicly
                                                observable, AND the catch-up
                                                write is causal ('theme' emitted)
arm C  application reads BEFORE construction    first value durable, ZERO causal
                                                writes — IDENTICAL to arm A
```

## The finding

**Arm C reaches the marker's result with no new API at all.**

```ts
const raw = storage.getItem('theme');
const tree = signalTree({ theme: raw ? JSON.parse(raw).data : 'light' });
```

⚠️ **CORRECTION — my justification for this was FALSE.** I wrote that
"`localStorage` and Capacitor Preferences both expose a sync read". **Capacitor
Preferences is asynchronous**: `@capacitor/preferences@8.0.1` declares
`get(options): Promise<GetResult>` and `set(options): Promise<void>`, and
TruckTrax's own `device-token-manager.ts` awaits both. Verified against the
installed package, not against either party's recollection.

The measured RESULT survives; its SCOPE does not:

```text
PROVEN        with a SYNCHRONOUS source, application pre-read reproduces marker
              materialisation — first public value is the durable value, no
              transient, no causal write
NOT PROVEN    the same property for an ASYNCHRONOUS persistence source
```

And the footprint is genuinely synchronous, which is why the result stands for it:
**all seven `stored()` leaves pass NO storage adapter**, so they use the default,
`localStorage`. Being a Capacitor app does not mean those leaves use Preferences —
TruckTrax's Preferences usage is a separate, hand-rolled async path (device
tokens) that has never gone through `stored()`.

So the honest claim is: _for the demonstrated localStorage footprint_, `stored()`
does not uniquely own construction materialisation. Not: _on every platform this
footprint targets._

So the answer to A2-1's question is **no**: the marker does not own construction
materialisation. What it provides over arm C is the read boilerplate, once per
persisted leaf — **a DX difference, not a capability difference.** A2's
pre-registration says only a capability difference earns declaration-time
placement.

Arm B is the one that fails, and it matters because it is the naive shape a
`persist(node, { key })` adapter falls into: hydrating after construction makes
the transient observable AND emits a causal write. Any compositional design must
therefore push the read to the application, not perform it itself.

## What A2-1 does and does not settle

```text
REMOVED   the strongest argument for arm A. `stored()`'s declaration-time
          placement is no longer justified by materialisation.
NOT SETTLED  arm C is only an INITIALISATION technique, not a persistence
          capability. It says nothing about write-through, settlement ordering,
          host drain or lifetime — which is exactly what A2-2..A2-5 measure, and
          where a real API still has to exist.
```

The live question is now narrower and better posed: **given that initialisation
needs no API, what is the smallest surface for the WRITE side — write-through,
settlement deference, host drain, and teardown?**

# A2-1B — the async-source control. OUTCOME C

Run because A2-1's justification was false, not because TruckTrax needs an async
source. `a2-1b-async-source.spec.ts`.

```text
A  marker prevents observability until the read resolves   IMPOSSIBLE
B  marker starts at default and catches up                 true of EVERY shape
C  the contract covers SYNCHRONOUS construction only       ✓
```

## Measured

```text
stored({ storage })   takes the DOM `Storage` interface. An async source is not
                      merely unsupported at runtime — it CANNOT BE PASSED, and a
                      `@ts-expect-error` pins that.

any constructor       `signalTree(...)` returns synchronously, so a value behind a
                      Promise is not available at that instant. Some observable
                      value must exist before it arrives. Measured: the transient
                      IS observable, and the catch-up IS a causal write ('theme'
                      emitted).

CONTROL               the same source awaited in app bootstrap, BEFORE
                      construction: durable value first, zero causal writes.
```

**The transient and the causal write are properties of the ASYNCHRONY, not of the
API shape.** So async materialisation cannot argue for any placement — it is a
scope limit to state publicly: _construction materialisation is synchronous-source
only; asynchronous sources preload in application bootstrap._

## ⚠️ A fact that carries straight into A2-4

The repo ALREADY has two storage contracts with different synchrony assumptions:

```text
stored({ storage })            `Storage`                      synchronous by type
persistence's StorageAdapter   `T | Promise<T>` on every op    async-tolerant
```

So the drain requirement must split, exactly as the brief said:

```text
SYNC adapter    flush() may complete synchronously
ASYNC adapter   flush() must EXPOSE COMPLETION for the caller to await
INVARIANT       SignalTree must never report durability as complete merely
                because asynchronous work was dispatched
```

That last line is the one that matters, and it is now grounded: TruckTrax's own
Preferences path awaits every write, so a drain that resolved on dispatch would be
lying to exactly the host it exists to serve.

## Harness note

The first run of the middle case reported ZERO causal writes — because a bare tree
has no path notifier wired, not because no write occurred. **Same trap the
`asyncSource` probe fell into twice.** `restoration()` was added so the notifier is
live, and the comment says why, so a future zero there means something.

# A2-3 — SETTLEMENT. Per-node composition FAILS; the claimant must be the tree

`a2-3-settlement-placement.spec.ts`. The persister used is deliberately minimal:
it observes writes through the public notifier and routes every durable write
through `scheduleDurableConsequence` — **no transaction inspection anywhere**,
which is the condition the placement had to satisfy.

```text
arm B  claimant = the LEAF NODE      duringPending "dark"   ⚠️ SPECULATIVE LEAK
arm C  claimant = the TREE           duringPending "light"  ✓ deferred
arm C2 confirm                       "light" -> "dark"      ✓
CONTROL ordinary authored write      persists immediately   ✓
```

## Why arm B fails, and it is not the authority's fault

`resolveScopeKey` resolves a per-tree scope via
`getPositionRegistry(candidate.$ ?? node)`. **A leaf node carries no registry and
has no `.$`**, so no scope resolves, `hasOpen()` is false, and the durable write
runs immediately — leaking the speculative value into storage during a pending
transaction.

The authority answered correctly; it was asked a question a leaf cannot answer.

> **A2-B collapses into A2-C.** `persist(tree.$.theme, { key })` cannot obey
> settlement from the node alone, so a compositional design needs the tree
> anyway — at which point it IS a tree-scoped capability wearing a per-node
> signature.

## ⚠️ SECOND FINDING — deferral alone is insufficient

Arm C defers correctly, and then this happened:

```text
durable writes, in order:  ['dark', 'light']
final store:               'light'   (correct)
```

The deferred speculative write STILL RAN after settlement, and was then
overwritten by the compensation. Final state is right, but **storage transiently
held rolled-back data**, and a crash in that window leaves durable truth holding
speculative state.

⚠️ **CORRECTED BY A2-3.1.** I recorded this as "deferral alone is insufficient —
a persister needs the settlement OUTCOME, so it must CANCEL like `stored()`".
Both halves of that are wrong. See A2-3.1 below: the residue is caused by WHEN
the persisted value is read, and the shipping surface fixes it without
cancelling anything. A2-3's arm-B/arm-C result — a LEAF claimant resolves no
scope and defers nothing — stands unchanged.

# A2-3.1 — the throughout-proof, and three findings that reshape A2

`packages/core/src/lib/a2-3-1-rollback-cancellation.spec.ts`, 4/4 passing. The
assertion is over EVERY payload that ever reached storage, not the final one — a
final-state test accepts `light -> dark -> light`, which is the crash window.

## FINDING 1 — the invariant is value-capture timing, NOT cancellation

A2-3 diagnosed its arm-C residue as "deferral alone is insufficient; the persister
needs the settlement OUTCOME, so it must cancel like `stored()`". Measurement says
otherwise. Both arms below use the same tree, the same single consequence
authority and the same `heldByKey` bucket; the only difference is when the value
is read:

```text
ARM-TIME capture   closes over the value at write time.   durable = ['dark']  ✗
RUN-TIME capture   reads the tree inside run().           durable = ['light'] ✓
```

Both deferred correctly while the transaction was open. The arm-time one still
persisted the discarded value, because a DEBOUNCED persister necessarily lands in
`heldByKey` — a timer fires after the transaction callback returned, so there is
no ambient context to file against, and outcome-cancellation is simply not
available to that shape. A2-3's prescription was unavailable to the very shape
that needed it.

```text
INVARIANT      no durable payload may EVER contain a discarded value
stored()       captures in the mutation's own stack  -> MUST cancel
persistence()  reads the tree inside run()           -> nothing to cancel
```

Two sufficient strategies. A durability capability must pick one **explicitly**;
routing through the consequence authority does not confer safety by itself.

## FINDING 2 — ⚠️ WITHDRAWN. See "A2-3.1 FINDING 2 WITHDRAWN" below

_(The measurement in this subsection stands — `interceptLeafSignals` really is
refused on an enhanced tree. The CONCLUSION drawn from it does not.)_

## FINDING 2 (as originally recorded) — a post-construction capability has NO observation seam

Building the persister on `interceptLeafSignals` (the per-tree seam, synchronous
with the write) measured:

```text
bare tree                interceptor fires        ✓
tree with restoration()  fires ZERO times         ✗
```

Not stacking displacement — an explicit refusal. Enhanced leaves carry
`__emitsMutations`, and `interceptLeafSignals` returns early on
`hasIntrinsicMutationEmitter(node)`: the node emits its own mutations, so wrapping
it would double-count. Its own JSDoc already says "queued for hostile audit under
MUT; do not build new consumers on it."

That leaves an outside observer nothing synchronous:

```text
interceptLeafSignals        refused on any enhanced tree — i.e. always
pathNotifier.subscribe      fires at FLUSH, after the ambient context is gone
pathNotifier.intercept      also inside _runNotify, so also at flush
```

> **A2-C is an ENHANCER, not a post-construction function.** `persistence(tree)`
> called after construction cannot work. The `const durability = persist(tree)`
> shape the design discussion was converging on is ruled out by measurement.

## FINDING 3 — the tree-scoped persistence ENHANCER already ships

```text
persistence(config)   EXPORTED from the root barrel
                      Enhancer<SerializationMethods & PersistenceMethods>
                      { save(), load(), clear(), __flushAutoSave? }
                      StorageAdapter is async-tolerant (T | Promise<T>)
```

It is already settlement-correct and already run-time-capture: autoSave debounces,
then routes through `scheduleDurableConsequence({claimant: tree, key: autoSaveKey})`
with one collapsing token per enhancer instance, serialises inside `run`, and
`cancelDurableConsequence`s on `destroy()`. `persistence-commit-ordering.spec.ts`
already carries a throughout-assertion for rollback, and M6's S6 probe proved that
deference fails closed when the boundary is disabled.

**So A2's placement question is answered by something that already exists.**

```text
A2-A  declaration marker          falsified (A2-1, A2-1B)
A2-B  per-node composition        falsified (A2-3 arm B)
A2-C  post-construction function  falsified (A2-3.1 Finding 2)
A2-C' TREE-SCOPED ENHANCER        survives — and already ships
```

## What is actually left of A2

```text
1  PER-LEAF SELECTION AND KEYING
   persistence() persists the WHOLE TREE under ONE key. TruckTrax has SEVEN
   individually-keyed leaves that are a subset of the tree. Whole-tree would
   persist transient UI state nobody wants durable, and would migrate a shipped
   app from seven storage keys to one.

2  THE DRAIN (A2-4)
   `__flushAutoSave` is underscore-prefixed, optional, and documented "for
   testing" — and it calls `enhanced.save()` DIRECTLY, bypassing
   `scheduleDurableConsequence`. So the only existing drain is both non-public
   and settlement-unsafe: invoked mid-transaction it writes speculative state,
   at exactly the moment (app backgrounding) when no rollback may ever arrive.
   That is a real gap, not a spelling question.
```

A2-2 and A2-5 now run against the shipping `persistence()` enhancer rather than a
hypothetical surface.

# A2-2 — the tree-scoped surface had the marker's old defect. Found and fixed

`packages/core/src/lib/a2-2-tree-scoped-rehydration.spec.ts`, 3/3.

PER-B P2 settled that a durable re-read is a REALIZATION of external truth, and
P4 showed the cost of getting it wrong: an authored reload contributes to an
enclosing transaction and is rolled back with it. A2-3.1 established that the
surviving placement is the tree-scoped enhancer — so A2-2 asked the same question
one level up, with PER-B's observer verbatim so the results are comparable.

```text
persistence().load()   { origin: null, participation: null }   AUTHORED   ✗
ordinary write         { origin: null, participation: null }   AUTHORED   ✓ control
stored().reload()      { origin: 'external', participation: 'realized' }  ✓ known-positive
```

One emitted write, classified authored. The control and the known-positive both
pass in the same file, so the observer discriminates and the zero is not an
artifact — the payload was also round-tripped through the enhancer's own
`save()` rather than a hand-written envelope, after a guessed shape made `load()`
a silent no-op on the first attempt.

**Fixed** in `serialization.ts`: `load()` now applies the deserialization inside
`withWriteContext({ ...ambient, origin: 'external', participation: 'realized' })`,
the same spelling `stored().reload()` uses. Only the SYNCHRONOUS application is
wrapped — the `await` is the storage READ, so this is not the async application
ST1035 refuses. Full core suite green afterwards (1895 passed).

```text
A2 has now found TWO defects in persistence()'s neighbourhood:
  A2-4.1   the only drain (`__flushAutoSave`) is non-public AND bypasses
           settlement — MEASURED, not read: it writes `{a: 'doomed'}` while a
           transaction is open, and storage stays inconsistent after the
           rollback because the drain also tore down autoSave. Positive control
           in the same file (it does persist an ordinary armed write) rules out
           a drain that simply writes nothing. Carried as a TRIPWIRE spec:
           fixing the drain must break it. Deferred to the surface freeze
           because routing through the consequence authority also changes what
           the drain returns and what a host may await.
  A2-2     tree-scoped rehydration was classified as authored work
Both were invisible while A2 argued about placement instead of measuring the
surface that already ships.
```

# A2-5 — lifetime. Non-regression, plus one correction to the measurement itself

`packages/core/src/enhancers/serialization/a2-5-lifetime.spec.ts`, 5/5, under the
`retention-gc` gate (renamed from `journal-retention`; it now carries both
GC-requiring proofs and runs with `--expose-gc` via `NODE_OPTIONS`).

```text
BEHAVIOUR
  armed write, tree lives        persisted            ✓ positive control
  armed write, destroy() first   never reaches storage ✓

RETENTION (three arms, the DIAG-JOURNAL-1 F6 shape)
  A  no persistence enhancer     payload DIES    -> the harness can collect
  B  persistence(), not destroyed payload LIVES  -> the capability really holds
                                                    application values
  C  persistence(), destroyed     payload DIES   -> destroy() releases them
```

Arm B's retention is not incidental: autoSave keeps `previousState = tree()`, a
full materialised snapshot, for reference-identity change detection. So a
persisted tree holds a second copy of its own state for the life of the
capability. That is a deliberate trade — it replaced polling
`JSON.stringify(tree())` every 100ms — and `destroy()` releases it, but it is a
fact the surface freeze should state rather than leave to be discovered.

## ⚠️ Correction to the measurement

Arm B first held a `WeakRef(tree)` and measured COLLECTED, which would have made
arm C vacuous. That was not evidence of no retention: `signalTree()` returns a
wrapper and the enhancer's closures capture the object it was handed, so the
outer reference can die while everything the capability holds lives on. The same
zero-for-the-wrong-reason trap as the asyncSource probe and the A2-4 control,
in retention form. Retention is measured on a payload object written into the
state instead — the technique F6 already uses, which also makes the two results
directly comparable.

# A2-4.2 — the OTHER drain, and it is the one that decides the freeze

`packages/core/src/lib/markers/a2-4-2-marker-drain-settlement.spec.ts`, 3/3.

A2-4.1 measured the enhancer's drain. This measures the marker's — the one
TruckTrax actually calls from Capacitor's pause hook — and they are not symmetric:

```text
__flushAutoSave         serializes the TREE AS IT STANDS      writes 'doomed'  ✗
flushAllStoredSignals   drains `pendingStoredWrites`, and the ONLY path into
                        that set is `saveCommitted`, reached only from inside a
                        durable consequence's `run`                            ✓
```

So the marker's drain is settlement-safe **by construction rather than by
checking**: there is no ordering in which it can be asked the wrong question.
Three arms — an ordinary pending write IS drained, a speculative one is
unreachable, and confirm-then-drain persists — so the safe result is not a drain
that simply never writes.

One measured surprise, better than the prediction: after the rollback the drain
DOES write, because the compensation is itself a marker write that arms its own
consequence. Storage converges on committed truth rather than merely avoiding
the speculative value. The invariant is stated over every write ever made.

# A2-C SURFACE FREEZE

## What A2 settles

```text
PLACEMENT   a TREE-SCOPED ENHANCER, and it already ships as `persistence()`.
            A2-A falsified (A2-1, A2-1B), A2-B falsified (A2-3 arm B), the
            post-construction form of A2-C falsified (A2-3.1 Finding 2).
FIXED       persistence().load() now classifies as external/realized  (A2-2)
NOT ADDED   per-leaf selection/keying on `persistence()`. It would duplicate
            what `stored()` already does correctly, and "might be useful" is
            UNPROVEN, not PUBLIC.
NOT ADDED   any new durability primitive. A2 designed nothing; it measured.
```

## The one gap A2 leaves open on the enhancer

```text
persistence() HAS NO PUBLIC DRAIN.
  `__flushAutoSave` is underscore-prefixed, typed optional, documented "for
  testing", and settlement-unsafe (A2-4.1, tripwired). A public drain must be
  routed through `scheduleDurableConsequence` — which also decides what it
  returns and what a host may await, so it is one decision, not a rename.
```

TruckTrax does not need it: its single drain call site is
`flushAllStoredSignals`, which is already correct. So this is a completeness gap
in the enhancer, not a migration blocker — and under the standing rule it needs
a demonstrated need before it becomes public surface.

## ⚠️ What A2 CANNOT settle, and must not decide by itself

The freeze runs into a recorded prior decision, `c53aa416` (2026-08-21, _"remove
stored marker from public rc surface"_), which unexported `stored`,
`createStorageKeys`, `clearStoragePrefix`, `flushAllStoredSignals` and their
types, and swept them out of the README, `docs/ai/LLM.md`, both persistence
guides and the demo. TT2 already recorded it, with the disposition text from
`check-rc-public-dispositions.mjs`: _"NOT EARNED as RC public API; consequence
ordering fix is not survival proof."_

A2's evidence cuts BOTH ways and is now on the record for whoever decides:

```text
AGAINST re-export   A2-1/A2-1B: construction materialisation is NOT a unique
                    marker capability — reading synchronous storage before
                    construction reaches the identical result with no API.
~~FOR re-export~~   ⚠️ **WITHDRAWN.** I argued that `flushAllStoredSignals` is
                    settlement-safe BY CONSTRUCTION and therefore earns public
                    surface. A2-4.2's result is still true — it IS safe — but
                    the TruckTrax lineage shows the drain exists only to close a
                    window `stored()`'s own 100ms debounce opened. A production
                    call site proves somebody had to close the window; the
                    history proves SignalTree opened it. Safety of a mitigation
                    is not evidence for the capability it mitigates.
```

TruckTrax imports `stored` and `flushAllStoredSignals` from `@signaltree/core`
in four files. Under the constraint that no migration may depend on anything the
frozen surface does not explicitly support, **TT3 cannot proceed on the seven
persisted leaves until this is decided either way.** The options are: re-export
the pair, or write the whole-tree `persistence()` migration recipe and accept
that seven storage keys become one for a shipped app.

# DOCUMENTED-SYMBOLS — the symbol-level gate, earned mid-freeze

Checking whether `stored` was exported found that core's barrel still ADVERTISED
it. `c53aa416` swept every consumer-facing document and missed the barrel's own
`PUBLIC API SUMMARY`; `serialization` had been advertised-but-unexported since
before Candidate A. Every gate stayed green, because:

```text
lint-readme-apis          reads READMEs, not source barrels
check-documented-imports  checks SPECIFIERS, not names
find-dead-exports         checks the other direction
```

`tools/check-documented-symbols.mjs` closes it, wired as two gate rows
(`documented-symbols` + self-test). Scope is deliberately just the API-SUMMARY
bullet list — barrel comments legitimately discuss internal and deleted symbols,
and a gate that fires on those gets ignored. Two live defects removed.

Its own first version failed for a reason worth keeping: a doc comment
containing `packages/*` + `/src` closed the block comment early. The self-test
caught it via the gate runner, not the direct invocation — the direct run had
happened before the comment was added.

# NOTIFIER-SCOPE-0 — the impact audit, and it RECLASSIFIES the defect

`packages/core/src/lib/notifier-scope-0-impact.spec.ts`, 3 pass + 2 KNOWN RED.

⚠️ **THE MECHANISM DESCRIPTION BELOW WAS WRONG AND IS CORRECTED IN ITS OWN
SECTION.** I recorded the cause as "coalesces by PATH STRING with no tree
qualification". `PathNotifier` defaults to `batchIdentityMode:
'path-position-subject'` and `hasSameSemanticIdentity` compares `positionId`.
The real defect is that `positionId` is registry-local while the notifier is
process-global — see NOTIFIER-SCOPE-0 IDENTITY below. The impact results in this
section are unaffected; only the explanation was.

It was provisionally classified **release-significant, not release-blocking**,
on the reading that it is an observation-seam problem. The audit was owed before
RC. It was run, and that classification does not survive it.

## Every wildcard consumer, classified

```text
devtools-impl.ts:1830     OBSERVATION ONLY — and it already guards with
                          `isPathOwnedByTree(path)`
diagnostic-journal.ts:117 OBSERVATION ONLY — S8 established it owns behaviour,
                          not authority
restoration.ts:2878       AUTHORITY — captures into restoration history AND
                          maintains `externalTruthByPath`, the P0-C protection
                          map, keyed by BARE PATH STRING
transactions.ts:1154      AUTHORITY — captures the compensation record a
                          rollback replays
```

`serialization.ts:1258` and `audit.ts:153` use `tree.subscribe()`, not the
notifier, and are unaffected.

## What the two AUTHORITY consumers actually do

Two trees whose states share a top-level property name — `settings`, `items`,
`loading`, `theme` — written in the SAME notifier flush:

```text
RESTORATION    b.undo() sets tree B to 'a0', which is TREE A's baseline.
               Not a lost undo. A FOREIGN value applied to B's state as if B
               had authored it.

TRANSACTIONS   pa.rollback() leaves tree A at 'a1'. The rollback SILENTLY DOES
               NOTHING, because tree B's same-path write coalesced over A's
               capture. A transaction reporting success while its compensation
               was dropped.
```

Both are pinned as `it.fails` so the suite stays green and the defect cannot be
carried silently; fixing it must flip them to plain `it`.

Three arms pass and bound the blast radius, which matters for the fix:

```text
one tree alone                         correct
two trees, DIFFERENT paths             correct
two trees, same path, DIFFERENT flushes correct — B's history does not capture
                                        A's write, and B's state is untouched
```

So the trigger is specifically **same path string + same flush**, not merely
coexistence.

## Reclassification

```text
WAS   release-significant, not release-blocking
IS    RELEASE-BLOCKING — silent state corruption in two AUTHORITY consumers,
      on a collision (two trees, a shared top-level property name) that an
      ordinary Angular app hits by accident
```

The provisional classification was made before anyone had asked what reaches
the consumers, and it was reasonable on the information available. The
measurement is what changed it, which is the whole reason the audit was owed.

# NOTIFIER-SCOPE-0 IDENTITY — the mechanism, and the correction to its diagnosis

`packages/core/src/lib/notifier-scope-0-identity.spec.ts`, 3 pass + 1 KNOWN RED.

## The first explanation was wrong

I recorded the cause as _"the notifier coalesces by PATH STRING within a flush,
with no tree qualification."_ It does not.

```text
PathNotifier.batchIdentityMode   defaults to 'path-position-subject'
hasSameSemanticIdentity          compares left.positionId === right.positionId
```

**The notifier already attempts semantic identity.** The defect is one level
down, and it is sharper:

```text
TreePositionRegistry allocates from `nextPositionId = 1`, PER REGISTRY.
The notifier is PROCESS-GLOBAL.

  tree A `theme` -> positionId 2     distinct registry objects,
  tree B `theme` -> positionId 2     identical local ids

  2 === 2 -> "same semantic identity" -> coalesced -> one write LOST
```

Measured delivery for `a.$.theme.set('a1'); b.$.theme.set('b1')` in one flush:

```text
DELIVERED: [ "theme=b1 pos=[2] subj=undefined" ]
```

`positionId` means _"position 2 in THIS tree's registry"_. The notifier consumes
it as _"position 2 in the process"_. A registry-local identifier is being used
across a namespace boundary it does not span.

## The same missing fact A2-3 hit

```text
leaf.positionIds        [2]        present
leaf.ownerPath          "theme"    present
getPositionRegistry(leaf)          UNDEFINED
getPositionRegistry(tree.$)        defined
```

`definePositionRegistry` is called on `tree` and `tree.$` only
(`signal-tree.ts:1174`). So A2-3's _"a leaf resolves no commit scope"_ is not
"a leaf has no owner identity" — it has a position NUMBER with no way to say
which registry indexes it. One sentence covers both findings:

> a SignalTree location must be unambiguously owned by ONE tree, and that
> ownership must be resolvable FROM THE LOCATION.

## The invariant, pinned before either fix is chosen

```text
two trees / same path / same local positionId / same tick
  => two DISTINCT pending mutations
  => BOTH delivered
  => restoration remains tree-local        (notifier-scope-0-impact.spec)
  => transaction compensation remains tree-local
```

## Cost survey of the two fixes

```text
GLOBAL ALLOCATION            module-level counter instead of per-registry `1`
  all 24 positionId consumers are ALREADY tree-scoped and need only
  uniqueness-WITHIN-scope; global allocation is a strict strengthening of that
  guarantee, so none of them changes
  positionIds are non-enumerable (4 `enumerable: false` defineProperty sites)
  or WeakMap-held, and appear nowhere in serialization.ts — they do NOT cross a
  durable boundary, so there is no cross-process reproducibility risk
  turn-store's `inspect()` is a diagnostic snapshot, not a rehydration path
  COST: the identifier stops meaning "position N in this tree" and becomes
        "runtime-unique object id" — repairing a consumer by redefining the
        identifier it misused

REGISTRY QUALIFICATION       compare (registry, positionId) instead
  semantically purer: the namespace is named rather than eliminated
  touches every keyed structure across 24 files — `turn-store.positionIndex`
  and `restoration.positionTurnIds` are `Map<PositionId, …>` today
  ⚠️ AND IT NEEDS THE LEAF->REGISTRY LINK FIRST. `emitOwnedMutation` sends
  `positionIds` only, and no per-write tree token exists outside a transaction
  (`WriteMetadata.transactionOwner` is transaction-scoped). So this fix
  subsumes A2-3's missing link rather than being independent of it
  COST: strictly larger, and fixes both findings at once
```

**CHOSEN: registry qualification, and it is implemented.** The deciding argument
is the one the survey surfaced rather than the cost: global allocation fixes the
notifier and leaves "which tree owns X?" unanswered, while qualification is the
same concept both defects need. Infrastructure that two independently measured
defects require is not speculative.

# A2-3.1 FINDING 2 WITHDRAWN — a post-construction binding is viable

`a2-3-1-rollback-cancellation.spec.ts` gains two arms.

Finding 2 concluded _"a post-construction durability capability has no usable
seam, therefore A2-C must be an ENHANCER."_ That followed from needing a
SYNCHRONOUS seam — which was only needed to land in the cancellable bucket —
which Finding 1 had already shown unnecessary. Same seam A2-3 arm C used, same
authority, same `heldByKey` bucket; only capture timing differs:

```text
ARM  durable = ['dark','light']    reproduces A2-3 arm C exactly
RUN  durable = ['light','light']   the discarded value never lands
```

The measurement that stands is narrower than the conclusion drawn from it:
`interceptLeafSignals` really is refused on an enhanced tree
(`__emitsMutations`). That rules out ONE seam, not the shape.

A post-construction binding is still blocked behind NOTIFIER-SCOPE-0 — `'**'`
cannot tell two trees apart — but that is ONE shared blocker, not a second
independent reason to require an enhancer.

## The generalisation, beyond persistence

```text
an OUTBOUND binding means
  on change to X   -> schedule a consequence for X
  when legal       -> read CURRENT X, send it to Y
NOT
  on change to X   -> snapshot X, eventually send that snapshot

unless the operation represents an EVENT rather than state synchronisation.
```

# BIND-BRANCH-0 — external provenance follows SUPPLIED INFORMATION

`packages/core/src/lib/bind-branch-0-acquisition-turn.spec.ts`, 6/6.

## The question was wrong first

It began as _"is a branch retrieve ONE causal turn?"_ — too coarse both ways. A
three-value payload legitimately produces three mutation events; and nothing
downstream may inherit the acquisition's authority, or provenance becomes
contagious:

```text
storage -> external write -> effect -> write -> effect -> write
                       ALL somehow "external"
```

The debugger version is the concrete one: load `theme = 'light'` and watch six
unrelated fields change under one external banner. _Where did all that other
data come from?_ is the correct developer reaction, and the tool caused it.

The invariant under test instead:

```text
DIRECTLY MATERIALIZED FROM THE PAYLOAD   belongs to the acquisition
REACTIONS CAUSED BY APPLYING IT          keep their own causal semantics
```

## Measured — the boundary rule already holds

```text
external(() => tree.$.settings({theme, units}))
  settings.theme    origin=external  participation=realized
  settings.units    origin=external  participation=realized
  restoration entries 0, transactionId undefined

authored reaction in the SAME TICK, outside the external() scope
  settings.distancePrecision   origin=undefined  participation=undefined  ✓

a computed reading theme
  emits NO mutation event at all                                          ✓

CONTROL: the same branch write without external()
  both effects origin=undefined                                           ✓
```

So a branch acquisition is not an opaque blob — every payload member is
individually visible with its own provenance, and timing does not leak
authority. `persist(x, y)` needs no new machinery for this.

## ⚠️ Two limits the runtime cannot currently express

```text
1  THERE IS NO WITHIN-TICK TURN BOUNDARY
   three separate `undoable()` calls in one tick produce ONE history entry,
   not three; the journal closes a turn on the notifier FLUSH. Both candidate
   observables are TICK counters. "one retrieve = one causal turn" is therefore
   not a statable invariant today — which is why the test asserts per-effect
   provenance instead.

2  THE JOURNAL HAS NO CAUSAL EDGE
   acquisition and reaction share one turn with one `sequence`. Each effect
   carries its own origin, so "where did that come from?" IS answerable; "what
   caused what" is not — there is no `causedBy` on `DiagnosticEffect`, so
   `external theme -> authored precision` is representable only as
   co-membership in a flush.

   Restoring the chain is diagnostic-journal CORRELATION METADATA, not a new
   causal dimension. Execution/settlement grouping and diagnostic causality are
   different questions; batching must not erase provenance, and today it does
   not — it erases ORDERING OF CAUSE, which is a smaller and separable gap.
```

## Sharp edge found while measuring

`DiagnosticJournal.turns()` returns the LIVE array and `dispose()` does
`turns.length = 0`. A caller that reads the reference and then disposes gets an
empty result. Cost one debugging round; the spec now copies before disposing.

# OWNERSHIP CORRECTION — implemented. Registry-qualified location identity

All three known-red pins are now green and the suite carries **zero** expected
failures.

## What changed

```text
PositionRegistry.id            process-unique NAMESPACE id, allocated once per
                               registry. positionId keeps meaning "position N in
                               THIS tree" — the namespace is NAMED, not removed.

leaf metadata                  __ownerId (a comparable value, for the notifier,
                               which has no node to ask) AND the registry object
                               itself via definePositionRegistry.

MutationEnvelope.ownerId       emitOwnedMutation -> emitMutation -> notify
WriteMetadata.ownerId          folded into delivered meta in notify(), so every
                               '**' subscriber can tell whose tree a write is

hasSameSemanticIdentity        rejects on differing ownerId BEFORE comparing
                               positionId. Entries with no namespace both carry
                               `undefined` and compare exactly as before — the
                               fix cannot make a single-tree case newly distinct.

restoration / transactions     decline a write that positively names a different
                               owner. Absent namespace is accepted, as before.
```

## ⚠️ Delivery was only half of it

Qualifying the notifier made both trees deliver — and the two AUTHORITY tests
still failed, differently. Previously restoration and transactions lost one
tree's write to coalescing; afterwards they received BOTH and captured both,
because a `'**'` subscription had never filtered by owner. The masking had been
hiding a second defect of the same origin.

```text
before   b.undo() -> 'a0'      tree A's baseline applied to tree B
         pa.rollback() -> 'a1'  the rollback silently did nothing
after    both correct, both controls green
```

## What it also fixed, for free

`commit-consequence` is UNCHANGED. `resolveScopeKey` already asked
`getPositionRegistry(node)`; it simply never got an answer from a leaf. A2-3 arm
B — which measured a leaf claimant leaking a speculative value and concluded a
persistence API must be handed the tree — now defers correctly, and the spec is
inverted with the old measurement recorded in place.

```text
A2-3's conclusion "an explicit tree argument is required"   WITHDRAWN
```

## Fallout, and how it was handled

Three specs pinned pre-fix behaviour:

```text
a2-3-settlement-placement  arm B inverted; the old numbers kept in the comment
mut-participation x2       asserted an EXACT delivered-meta object, so a
                           per-run `ownerId` broke a deep-equal about
                           PARTICIPATION. Narrowed to strip ownerId and an
                           undefined structuralEffect — every semantic key is
                           still compared exactly, and the finding is unchanged.
```

## Process note

The `emitMutation` edit silently no-op'd on a whitespace mismatch and I did not
assert on that replacement, so `ownerId` never reached `notify()` while the leaf
metadata looked correct. It presented as "the fix does not work". Every edit in
the change is now verified present by an explicit count before the suite runs —
the same rule as "verify by exit code", applied to edits.

# LINK-0 — three causal directions, measured as behaviours

`packages/core/src/lib/link-0-three-directions.spec.ts`, 12/12. Nothing named
`link()` exists; this asks whether the runtime can already carry what such a
primitive would have to promise.

```text
PULL      Y.get()       -> X    on demand
PUSH-IN   Y.subscribe() -> X    pushed
PUSH-OUT  committed X   -> Y.set()
```

NAMING: `bind` is rejected — `ISignalTree` already has `bind(thisArg?)` and
`Function.prototype.bind` owns the word. `connect` reads as an imperative action.
`link` names the RELATIONSHIP, and direction falls out of what the endpoint
supplies (`get` = `X <- Y`, `set` = `X -> Y`, both = `X <-> Y`). Working
candidate, not frozen.

## Results

```text
PULL      leaf / branch / root   all apply, all external/realized, zero
                                 restoration entries
          wrong shape refused    external(async () => …) throws ST1035, which
                                 is what makes "await outside, apply inside" a
                                 contract rather than a convention
PUSH-IN   every emission is its own acquisition; a stream earns no undo
PUSH-OUT  leaf / branch / root   only settled state escapes, late read at every
                                 scope; confirm control lets it through
```

## ⚠️ A claim I was about to make, and the measurement that stopped it

I wrote an arm expecting `external()` to be what protects a pushed value from a
rollback. It is not — the AUTHORED control survives identically:

```text
transaction writes 'speculative', then a source emits 'from-source'
rollback -> 'from-source' survives, for BOTH classifications
```

What preserves it is CONSERVATIVE COMPENSATION: the rollback declines to clobber
a write that landed after the one it is reversing, whatever that write claimed.
So PUSH-IN's survival across a transaction is not evidence for the ingress
classification.

The evidence is at the RESTORATION boundary instead, and there it is decisive:

```text
authored later write   undo SUCCEEDS, 'from-source' silently discarded
acquired later write   undo REFUSED — ST1034 — value preserved
```

That is RESTORE-P0 P0-C, and it is the one measured place where the ingress
classification changes an outcome. It is why PUSH-IN must go through `external()`
even though the transaction arm cannot tell the difference.

# LINK-1 — a bidirectional, asynchronous, disposable relationship. 15/15

`packages/core/src/lib/link-1-relationship.spec.ts`. The question LINK-0 could
not answer: **can one tiny relationship primitive stay correct when the
relationship is genuinely bidirectional, asynchronous and disposable, without
rebuilding the policies we deliberately removed?** Measured answer: yes.

Cases 3–5 are properties OF A RELATIONSHIP, so the spec carries a TEST-LOCAL
REFERENCE HARNESS — `makeLink`, not an export, whose only privilege is using
core internals exactly as a core `link()` would. Nothing named `link()` ships.

## Mutation check first, because a harness that passes immediately is not evidence

```text
remove self-echo correlation check     2 failed  ✓
remove outbound serialization          1 failed  ✓
remove disposed guard inside run()     1 failed  ✓
remove ownership acceptance check      2 failed  ✓
remove disposed guard after get()      15 passed ⚠️ redundant, not vacuous — the
                                       `acquire` guard covers both inbound entry
                                       points, so either alone sufficed.
                                       Removing BOTH fails the test. The
                                       redundant check was deleted.
```

## Case 1 — and it found the last unowned location class

The acceptance predicate is the one the ownership correction made possible:
`getPositionRegistry(X) !== undefined` plus writability.

```text
tree (callable root)   registry YES   callable   -> ACCEPTED
tree.$                 registry YES   NOT callable, NOT settable
                                                 -> a NAMESPACE, not a location
branch accessor        registry no -> YES        -> ⚠️ FIXED, see below
leaf                   registry YES   .set       -> ACCEPTED
bare signal('foo')     registry no    .set       -> REFUSED
computed               registry no    no set     -> REFUSED
```

Two results worth carrying:

**The root location is `tree`, not `tree.$`.** `tree.$` resolves a registry but
is neither callable nor settable. Any `link(x, y)` documentation must say `tree`.

**⚠️ Branch accessors had no owner identity.** The ownership correction reached
`tree`, `tree.$` and leaves; `makeNodeAccessor` was the one class left out, so
`getPositionRegistry(tree.$.settings)` was undefined while both the leaf under it
and the root above it answered. Fixed at its single construction site. The
invariant is now complete: **every SignalTree location names its owning tree.**

And a bare `WritableSignal` being refused is the case a `WritableSignal<T>` type
bound would have wrongly admitted — it has a setter but no owner, so no
settlement authority and no location identity.

## Cases 3 & 4 — echo suppression must be LINK-LOCAL, and that is falsifiable

```text
value acquired through L        does NOT leave through L      ✓
authored write on same location DOES leave                    ✓ control
Y1 --L1--> X                   DOES reach Y2 through L2       ✓
```

The third arm is what makes this a design constraint rather than a preference.
Suppressing by PROVENANCE — "external writes never go outbound" — passes the
first two and silently desynchronises Y2 from truth Y1 supplied. Only a
link-local correlation gets all three right.

The mechanism already exists: `WriteMetadata.correlationId` survives to the
subscriber alongside `origin`, `participation` and `ownerId` (measured).

⚠️ **AND I DREW THE WRONG CONCLUSION FROM IT.** I wrote that because
`external()` cannot stamp a correlation, "a correct two-way link must be core."
LINK-ECHO-1 falsifies that: correlation is SUFFICIENT, not necessary. See
LINK-ECHO-1 below — the core-necessity argument survives, but it rests on the
EGRESS authority, not the ingress classification.

## Case 5 — order, not a clock

```text
committed A then B, endpoint takes 50ms for A and 5ms for B
serialized      Y ends at ['A','B'], last value === X          ✓
unserialized    Y ends at ['B','A'], Y holds A while X is B     ✓ control
```

⚠️ This is NOT a debounce. There is no clock window and no interval in which
committed state is deliberately not durable — only consequence ORDER is
preserved. Coalescing waiting writes would be an optimisation on top of this
contract, not a different one.

## Case 6 — the minimum failure contract, and deliberately the whole of it

```text
rejected set        captured; NO unhandled rejection                 ✓
the tree            UNMOVED — a failed egress does not un-author X   ✓
after a rejection   a later write still goes out; the chain is not
                    wedged forever                                   ✓
```

No retry, no backoff, no error signal, no status. Those are what `loader()` was.
The only thing an automatic async link owes is that it must not manufacture
invisible unhandled rejections.

## Case 2 — dispose() stops NEW activity and claims nothing more

```text
X no longer reaches Y                                    ✓
Y no longer reaches X                                    ✓
a get() resolving AFTER dispose() does not resurrect X    ✓
an outbound consequence HELD at dispose time, released by a later
  settlement, does NOT escape                            ✓
CONTROL: without dispose() that same held write DOES escape ✓
```

An in-flight `get()` is not cancelled — it cannot be, unless Y supports
cancellation. The guarantee is that its RESULT is not applied. SignalTree
promises no new link activity, not retraction of an effect that already escaped.

## What LINK-1 changes about the disposition

```text
loader()        DELETE — PULL plus orchestration that is not SignalTree's
asyncSource()   DELETE — PUSH-IN plus stream orchestration
stored()        link(leaf, keyValueEndpoint) + debounce + init convenience
persistence()   link(root, serializedEndpoint) + autosave policy
link(x, y)      CANDIDATE SURVIVOR, and now with a measured contract
```

The harness needed no new causal machinery. It used ownership qualification,
`withWriteContext`, `scheduleDurableConsequence` with X ITSELF as claimant
(possible only since the ownership correction), run-time capture from A2-3.1,
and a promise chain. Every one of those was earned separately for another reason.

`retrieve()` stays EXPLICIT. Nothing in the lineage has earned automatic initial
retrieval as fundamental behaviour.

# LINK-ECHO-1 — my core-necessity argument was wrong. The corrected one is better

`packages/core/src/lib/link-echo-1-suppression.spec.ts`, 24/24 across three arms
plus two public-only arms.

LINK-1 proved correlation WORKS. I claimed it proved correlation is NECESSARY,
and those are different claims. One shared battery — leaf self-echo, authored
control, cross-link, authored-change-after-acquisition, rapid A-then-B inbound,
branch full-shape, branch structurally-equal-different-reference, and X returning
to an earlier value — run against three suppression rules:

```text
correlation      8/8   stamp linkId inbound; outbound skips its own
equality-said    7/8   ELIMINATED
equality-held    8/8   equivalent to correlation, and stamps NOTHING
```

## What eliminated `equality-said`

The rule exactly as first proposed — "remember what Y said" — fails one case, and
it is not a hypothetical:

```text
1  Y supplies 'light'          nothing goes out              ✓
2  app authors 'dark'          'dark' goes out; Y holds it   ✓
3  app authors 'light' again   'light' === what Y SAID in 1  -> SUPPRESSED  ✗
```

Y is stranded at `'dark'` while X is `'light'`, permanently, because the mismatch
is invisible to the rule. One word fixes it: remember what Y is known to **HOLD**,
which means an outbound send updates the remembered value too. That is the only
difference between the two equality arms, and it is worth stating explicitly in
whatever ships.

## `equality-held` is the better rule, not merely an equal one

```text
Y already told us X = A. Don't immediately tell Y that X = A.
If X becomes B, tell Y B.
```

It describes the RELATIONSHIP; correlation describes the implementation. It needs
no privileged ingress. And it draws a boundary worth having: `link()` is STATE
SYNCHRONISATION, so difference is meaningful — an event emission
(`sendOrder(order)`) has no "only if different" and belongs to the
committed-consequence side instead.

`deepEqual` is the comparison, which is why the different-reference case matters:
a transport that deserializes JSON hands back equal contents with new identity
every time, and reference equality would echo forever.

## What survives of the core-necessity argument, and it is simpler

```text
INBOUND    reachable from public `external()` alone — measured
OUTBOUND   NOT reachable. `scheduleDurableConsequence` is not exported and
           `getPathNotifier` is explicitly "not root app API", so application
           code has no way to defer a write until the tree settles.
```

Measured: the only thing user-land can do is write through at authoring time.
Inside a transaction that leaves Y holding the rolled-back value with nothing
coming to correct it — LINK-1's PUSH-OUT requirement, "only settled state
escapes", unreachable from outside core.

> **A settlement-safe public EGRESS capability is required.**

⚠️ I first wrote that as "`link()` is core because of the egress authority",
which is a second overclaim of the same shape: it proves an egress GATE must be
core, not that `link()` must BE that gate. EGRESS-0 separates them, and NULL
survives — see below.

# LINK-2 — the public contract. 12/12

`packages/core/src/lib/link-2-public-contract.spec.ts`. Deliberately smaller than
LINK-1; it retests no causality and answers only the unearned API questions.

## The endpoint contract

```text
Endpoint<T>   get? / set? / subscribe?, all optional, AT LEAST ONE required
              empty is REFUSED, not silently inert — every member being optional
              means `{}` type-checks, and a link that looks installed and does
              nothing forever is the worst available outcome
              get-only / set-only / subscribe-only all valid
              retrieve() on a set-only endpoint fails loudly
```

**`get + subscribe` is meaningful** — snapshot then live — and must not be
forbidden. It also has a hazard that is the exact mirror of case 5's outbound
rule:

```text
OUTBOUND  an older set() may not finish after a newer one   -> serialize
INBOUND   an older acquisition may not overwrite a newer one -> sequence guard
```

Measured: a slow `get()` started first and resolving last overwrites a newer
pushed value without the guard. Neither rule involves a clock.

## The returned surface

```text
retrieve()   EARNED, and stays EXPLICIT — nothing in the lineage has earned
             automatic startup hydration
dispose()    EARNED (LINK-1 case 2)
settled()    EARNED. ⚠️ Corrected from "conditionally earned": the NEED is
             conditional on whether `set()` is async, but `Endpoint<T>` allows
             `void | Promise<void>`, so the generic link supports async egress
             and `settled()` is the only way to observe the outbound queue the
             link itself owns. For a synchronous endpoint it resolves
             immediately and is rarely useful — measured — which is a fact about
             that endpoint, not a reason for conditional typing. Making it exist
             conditionally via overloads would add complexity for nearly no
             value.
clear()      NOT EARNED — an endpoint operation
save()       NOT EARNED — outbound is automatic
flush()      NOT EARNED — there is no debounce to flush
errors       NO Link surface at all
```

## Rejection visibility needs no new surface

A rejected `set()` routes to `reportTreeError`, which `onTreeError` already
observes — the mechanism built to answer NGXS's `NgxsUnhandledErrorHandler`
because per-marker `onError` meant wiring Sentry at every call site forever. The
harness's LINK-1 `failures` array is deleted. Also verified: a listener that
throws does not damage the link, so adding error reporting cannot become a source
of errors.

```text
⚠️ FINDING, AND IT IS NOT A LINK FEATURE — `onTreeError` is NOT exported from
   the barrel. It lives in `internals/`, so no application can reach it and
   every marker reporting through it is invisible today. Pinned by an assertion
   that exporting it must flip.

   Carried as its OWN disposition, ERROR-SURFACE-0, so `link()` cannot smuggle
   the decision in:
     was `onTreeError` intended to be public?
     does any application requirement need to observe caught core errors?
   Very likely yes to both — but it is decided on its own evidence.
```

# EGRESS-0 — NULL SURVIVES. `link()` is a composition, not the primitive

`packages/core/src/lib/egress-0-userland-link.spec.ts`, 12/12.

```text
NULL       one minimal PUBLIC settlement-aware egress primitive, plus existing
           public `external()`, is sufficient to implement link() OUTSIDE core
FALSIFIER  a correct link still needs private machinery even with that gate
```

The candidate gate is transport-neutral and knows nothing about state:

```text
onCommitted(x, cb)   observe X, defer to settlement, read X LATE, call cb
```

Everything private lives in it — ownership resolution, the observation seam, the
commit-consequence authority. The user-land link above the fold imports only
`external()`, `deepEqual()`, `onCommitted()` and ordinary JavaScript.

## The whole battery, re-run against the user-land implementation

```text
self-echo (equality-held)                        ✓
CONTROL: authored change goes out                ✓
cross-link Y1 -> X -> Y2                         ✓
X returns to an earlier value after Y moved on   ✓
branch structural-equality, new reference        ✓
PUSH-OUT: only settled state escapes             ✓  <- the one it could not
                                                       meet before the gate
outbound ordering (50ms A vs 5ms B)              ✓
disposal: a held consequence does not escape     ✓
the gate refuses an unowned X                    ✓
```

Mutation-checked: removing settlement deferral from the gate fails 2, removing
equality suppression fails 4, removing serialization fails 1.

> **So `link()` is NOT the causal primitive.** The stack is:
>
> ```text
> CORE CAUSAL GATES     external()      Y -> X
>                       onCommitted()   X -> outside world
> COMPOSITION           link()          state sync using both
> ```

That also unblocks something `link()` alone would have left unreachable. Storage
SET, HTTP PUT, socket send, POST and telemetry share the same outbound
settlement boundary, and only some are state synchronisation:

```text
link          "is Y already at this state?"    equality is meaningful
event effect  "perform this thing"             equality is meaningless
```

`chargeCard(order)` has no "only if different". If `link()` were the only public
egress, the whole MATRIX commit-consequence dimension would stay private.

`link()` may still ship — as an excellent ergonomic composition that must earn
itself as CONVENIENCE, not as a causal primitive.

## ⚠️ What the battery could NOT show, found by mutation

The refinement "advance `knownY` only once `set()` succeeds" is a correctness
argument, and I wrote a test claiming to measure it. Mutating the harness to
advance at SCHEDULE time left all 12 green — so the test was passing for the
wrong reason and has been rewritten to assert only what it observes.

The reason is structural: a rejected write leaves X at the failed value and Y
stale, nothing re-evaluates X because X has not changed, and the next write
differs from the failed value so BOTH rules dispatch and resynchronise. A
divergence needs the link to consult `knownY` for a value never successfully
sent with no intervening send — which requires RETRY, deliberately out of scope.

Keep the on-success rule, because a variable named "what Y is known to hold" must
not record a value Y never received. But it is UNEARNED BY MEASUREMENT, and if
retry is ever added it becomes measurable and must be tested then.

# LINK-RACE-0 — cross-direction concurrency is a real defect

Neither LINK-1 nor LINK-2 hit it: each proved its own direction ordered
correctly, and the failure appears only when they CROSS.

```text
X authors B    -> set(B) begins, slow
Y pushes C     -> X becomes C
set(B) completes

X = C, Y = B — with both direction rules individually obeyed
```

Measured, and nothing corrects it: the consequence for C already ran and was
suppressed, because at that moment `knownY` still said C.

```text
WITHOUT post-success recheck   X='C', Y='B'   permanent divergence
WITH post-success recheck      X='C', Y='C'   converges, sends ['B','C']
```

The fix is small and local — on a successful write, compare X as it is NOW
against what Y now holds and dispatch again if they differ. It invents no
conflict resolution and no versioning; it only re-asserts X, the side the link
already treats as authoritative.

But it only works if resolution MEANS something, which is a contract on Y:

```text
`set(v)` resolving successfully = the endpoint acknowledges v as its state
```

An endpoint that cannot promise that is not a bidirectional STATE endpoint
without supplying version/conflict semantics of its own. That is a healthy
boundary, and it is a requirement on the endpoint rather than machinery in the
link.

# LINK-2 case 4 — the type CANNOT enforce the X constraint

`packages/core/src/lib/link-2-x-constraint.typing.spec.ts`. ⚠️ LINK-2's header
referenced this file before it existed — an accuracy defect, now fixed. Writing
it also overturned what I expected it to say.

```text
tree.$                REJECTED by the type    ✓
computed              ACCEPTED by the type    ✗ measured
bare WritableSignal   ACCEPTED by the type    ✗ measured
```

`NodeAccessor<T>` declares `(): T`, and every `Signal<T>` is a zero-argument
function returning `T`, so a `computed` satisfies it. A bare `WritableSignal` is
structurally identical to an owned leaf. Ownership is a RUNTIME fact on a
non-enumerable property and TypeScript cannot see it.

So the X constraint is a RUNTIME constraint. Making it compile-time needs a
BRANDED location type threaded through every public return type in the library —
a real option, a far larger decision than LINK, recorded and not taken. The
consequence: `link()`'s X parameter cannot be trusted to reject at compile time.

# LINK-RACE-1 — the fix is a RECONCILIATION LOOP, not a recheck

`egress-0-userland-link.spec.ts`, 16/16 with three reconciliation modes.

```text
ONE crossing,   no reconciliation   X='C' Y='B'   permanent divergence
ONE crossing,   single recheck      X='C' Y='C'   converges
TWO crossings,  single recheck      X='D' Y='C'   ⚠️ DIVERGES AGAIN
TWO crossings,  reconciliation loop X='D' Y='D'   converges
THREE crossings, loop               X='E' Y='E'   still converges
CONTROL: no crossing, loop          sends exactly once
```

The corrective write is itself an outbound write, so it can be crossed too. A
post-success recheck that runs ONCE stops exactly one step short, every time.

```text
after every acknowledged outbound write, keep reconciling until current X
equals the endpoint's acknowledged state
```

No debounce, no retry, no conflict resolver. The loop terminates on EQUALITY
rather than a counter, which is why depth is not a parameter — and the control
arm rules out a loop that simply sends until it happens to match.

The acknowledgement contract this rests on, stated precisely:

> after `set(v)` resolves successfully, the link may treat `v` as Y's
> acknowledged state UNTIL A LATER INBOUND VALUE SUPERSEDES IT

For a `set + subscribe` endpoint that makes ordering between acknowledgement and
subscription delivery part of Y's contract. An endpoint that cannot provide a
coherent ordering between its two channels is not a generic bidirectional STATE
endpoint without its own version/conflict protocol — which is not SignalTree's
problem to solve.

# EGRESS-1 — the NULL is FALSIFIED. There are THREE gates, not two

`packages/core/src/lib/egress-1-observation-vs-consequence.spec.ts`, 8/8.

EGRESS-0 showed `link()` is a composition over `external()` and a
settlement-aware gate, then inferred that gate is THE egress primitive for
everything crossing the boundary. That inference does not survive.

```text
                       state OBSERVER      one-shot CONSEQUENCE
authored write         fires   ✓ wanted    runs    ✓ wanted
external acquisition   fires   ✗ fatal     silent  ✓
rollback compensation  fires   ✗ fatal     silent  ✓
A -> B -> A -> B       4 fires ✗ fatal     1 run   ✓
undo                   SILENT  ✗ DEFECT    silent  ✓   (OWNER-REPLAY-0)
```

The difference is not a filter that could be added to the observer. It is WHO
ASKS:

```text
OBSERVER     a standing subscription — "tell me whenever X settles".
             Cause-blind by construction, which is exactly right for state.
CONSEQUENCE  scheduled BY an operation, in that operation's own stack —
             "if MY authored work survives, do this once".
```

A cause filter would not close it: the rollback compensation and the undo are
both genuinely settled writes, and a standing subscription cannot know that a
charge belonged to one particular earlier operation rather than to the location.

```text
external(...)      inbound authority                Y -> X
afterCommit(...)   one-shot consequence authority   an operation -> out
onCommitted(...)   committed-state observation      X -> out, standing
link(...)          state synchronisation — composition over external +
                   onCommitted, and NOT over afterCommit
```

`afterCommit` is the shape `stored()` and `persistence()` already use privately.
The OBSERVER is the newer idea, and it is the one `link()` needs.

## ⚠️ OWNER-REPLAY-0 — a gap in the ownership correction, found here

I expected the undo to fire the observer twice and measured ONCE. The observer
saw the authored value and never saw the reversal, while the tree really did
return.

```text
the undo DOES reach the notifier   origin=restoration
                                   ownerId=UNDEFINED
```

The ownership correction taught `emitOwnedMutation` to carry the namespace, but
the enhancers replay through `notifier.notify(...)` positionally, and those call
sites were never taught it. **24 sites** across restoration, transactions,
devtools and entity-signal.

Consequences:

```text
isolation      UNAFFECTED — the guards accept an absent namespace by design
observers      BLIND to restoration, and to every other replayed write
link()         would leave Y holding the pre-undo value forever
```

⚠️ **FIXED — see OWNER-REPLAY-1 below.** The `undo` row moved from `SILENT` to
`2 fires ✗ fatal`, which strengthened the falsification exactly as predicted.

# ERROR-SURFACE-0 — the reporter is not central, and its vocabulary is dead

`packages/core/src/lib/error-surface-0-disposition.spec.ts`, 4/4.

The finding is NOT "it isn't exported".

```text
reportTreeError call sites in the WHOLE library:  2
                                   async-source.ts, stored.ts
                                   — BOTH APIs this audit is retiring

TreeErrorSource members with a reporter:    stored, async-source
TreeErrorSource members with NONE:          async-query, entity-loader,
                                            persistence, effect
```

A capability built to be "one place to observe every error the library catches"
was wired to two markers and then left in `internals/`. Its listener contract is
sound — additive, and a throwing listener does not damage the reporting
operation — so this is under-wiring, not a broken mechanism.

```text
INTENDED PUBLIC?   its rationale only makes sense if yes — a Sentry integration
                   is an application concern
DEMANDED?          not yet. Under the standing rule, "might be useful" is
                   UNPROVEN, not PUBLIC
TAXONOMY RIGHT?    NO. Four members name nothing; two name retiring APIs
```

⚠️ **ORDER MATTERS.** Export first and clean later, and the retired vocabulary
becomes a compatibility obligation. The taxonomy is disposed BEFORE the function
is exported, or neither happens.

## Process note

The scan needed two corrections before it was trustworthy: `import.meta.url`
arrives vite-prefixed (`/@fs/...`) and `cwd()` is the workspace root, not
vitest's `--root`. Either mistake would have scanned nothing and "confirmed" the
finding for entirely the wrong reason, so the file now asserts it can see
`signal-tree.ts` before counting anything.

# OWNER-REPLAY-1 — the ownership invariant, completed

`packages/core/src/lib/owner-replay-1.spec.ts`, 3/3. The invariant is promoted:

```text
WAS  ordinary mutations name their owning tree
IS   every SignalTree-owned mutation delivered through the notifier names its
     owning tree
```

⚠️ **THE FIRST WORDING OUTRAN THE EVIDENCE.** I wrote "authored, external,
restoration, rollback, DevTools or structural replay alike" while the permanent
test exercised only the first four. OWNER-REPLAY-2 measured the other two, found
a real defect in one of them, and narrowed the claim to what is shown.

## ⚠️ It was TWO edits, not twenty-four

The 24 `notifier.notify(...)` sites were a red herring, and the inventory said so
before anything was changed. Measured meta shapes:

```text
authored   { mutationIntent, ownerId }                    via emitOwnedMutation ✓
replay     { intent: 'system', participation, positionIds }                     ✗
```

Replay metas are built by spreading `getActiveWriteContext()`, and each replay
already runs inside ONE `withWriteContext` wrap. Stamping the namespace there
reaches every downstream site — including the realization adapter's SEVEN
`intent: 'system'` builders — and a new replay site inherits it without anyone
remembering to. That is what "structurally unavoidable" buys over an enumeration.

```text
restoration.ts   the wrap around `realizationPort.applyAtomically(...)`
transactions.ts  the wrap around the compensation
```

⚠️ The first attempt stamped the WRONG wrap — `restoreState`'s, which is not the
path `undo()` takes. The measurement said so immediately (the event still
arrived with no namespace), and the ST1034 stack from an earlier probe was what
pointed at `applyTurnEffectsThroughRealizationPort` instead.

## Verified

```text
authored / external / restoration / rollback   ALL carry the namespace
two trees, same path, same local positionId    never borrow each other's
an owner-filtered observer now SEES a restoration:  [2, 1], was [2]
```

Mutation-checked: dropping restoration's `ownerId` fails 3 of 3; dropping
rollback's fails 1 of 3.

NOTIFIER-SCOPE-0's authority tests re-run green, so completing the invariant did
not weaken tree isolation — the guards accept an absent namespace by design, and
there are now fewer writes that have one.

## Test-design note

The first version of the preregistration put an `external()` acquisition BETWEEN
the authored turn and the undo, and the undo refused with ST1034 — P0-C
protecting acquired truth, exactly as LINK-0 measured. Sequencing the
acquisition after the undo keeps the test on its own question.

# OWNER-REPLAY-2 — closing the gap between the invariant written and verified

`packages/core/src/lib/owner-replay-2.spec.ts`, 4/4.

```text
structural AUTHORED (addOne/removeOne)   ownerId: undefined   ✗ DEFECT, FIXED
structural REPLAY (restore/rollback)     ownerId: present     ✓ (REPLAY-1)
devtools inspection via write context    ownerId: present     ✓
owner-only marker ping                   ownerId: undefined   ⚠️ RESIDUE
devtools-impl.ts:1817 direct notify      UNVERIFIED
```

## The defect it found

Collections notify the path notifier DIRECTLY rather than through the owned-write
wrapper, so an authored `addOne` arrived unqualified while the restoration and
rollback replays OF THE SAME OPERATION carried the namespace. An owner-filtered
observer was blind to every authored collection change — the same shape as
OWNER-REPLAY-0 and wider in reach.

Fixed the same structural way: one `ambientMeta()` helper inside
`entity-signal.ts` that all NINE `getActiveWriteContext()` sites route through,
so a new notification site cannot silently omit the namespace. Mutation-checked —
removing the namespace from that helper fails 3 of 4.

DevTools needed no change: an inspection travels the ORDINARY owned write path
and inherits the namespace from `emitOwnedMutation`.

## What remains unverified, stated rather than assumed away

```text
1  THE OWNER-ONLY MARKER PING
   A bare `{ path: 'rows' }` accompanies each collection mutation with BOTH
   values undefined (`isOwnerOnlyMarkerSignal`). It reaches delivery with no
   metaOverride at all, so it carries no namespace — and no VALUE either, so an
   observer learns nothing from it the valued `rows.<id>` event does not already
   say. The tests assert over value-carrying events specifically rather than
   pretending the ping is covered.

2  `devtools-impl.ts:1817`
   `notifier.notify(path, next, prev, ownerPath)` — four arguments, NO meta, so
   it structurally cannot carry a namespace. It sits inside
   `interceptLeafSignals`, which A2-3.1 measured as REFUSED on any enhanced tree,
   so it is LIKELY unreachable for the trees this matters for. "Likely" is not
   "measured".
```

## The invariant, narrowed to what is shown

> Every VALUE-CARRYING SignalTree mutation delivered through the notifier names
> its owning tree — authored, external, restoration, rollback, DevTools
> inspection and structural collection writes alike.

# AFTER-COMMIT-0 — ⚠️ ITS HEADLINE IS WITHDRAWN BY AFTER-COMMIT-1

_(Everything below about the CONTRACT stands. The conclusion that `X` is earned
does not — see AFTER-COMMIT-1. What this file actually falsified is that
`transactionOwner` is a valid TREE CLAIMANT, which was already known.)_

# AFTER-COMMIT-0 — the claimant form is falsified

`packages/core/src/lib/after-commit-0.spec.ts`, 10/10.

```text
NULL      a one-shot consequence needs NO location argument; one registration
          binds to the AMBIENT authored operation
RESULT    ⚠️ FALSIFIED, by a rule this codebase already states and enforces
```

## Why the no-argument form loses

Measured first, before writing the harness:

```text
outside a transaction        getActiveWriteContext() === null
inside one, before a write   { transactionId, transactionOwner }
nested transactions          REFUSED — "Nested transaction is not supported"
```

The second line looked like enough. It is not:
`openCommitScope(transactionOwnerToken, transactionId, tree)` keys the scope on
`resolveScopeKey(TREE)`. The ambient `transactionOwner` is only the token
identifying the operation, and it resolves to ITSELF — so a consequence claiming
it finds no open scope and runs immediately. Measured: the confirmed and
rolled-back cases both ran during the callback.

That is deliberate. `scopeOwns` says so:

> "The write context is ambient: any code running inside a transaction callback
> sees that transaction's owner and id, INCLUDING A WRITE TO A COMPLETELY
> DIFFERENT TREE. Presence of a transaction is not evidence that the write is
> speculative under it, so ownership must be POSITIVELY ESTABLISHED."

A no-argument `afterCommit()` can only infer, and inference is what that rule
refuses. **The anchor is not a leaked claimant — it is the caller positively
establishing whose settlement gates the effect.** Nesting being refused retires
the nested-ownership case as unreachable rather than unproven.

## What survives

```text
confirmed transaction    held while pending, then exactly once      ✓
rolled back              discarded, never run-and-compensated       ✓
same fn registered 2x    runs TWICE                                 ✓
registration order       effects START in order A, B, C             ✓
two trees interleaved    B rolled back, A confirmed -> only A runs  ✓
async return             a never-resolving effect does not block
                         the next one from starting                 ✓
```

The two-tree case is the signature discriminator: if ambient attribution were
sufficient, either both would escape or neither would.

⚠️ `key` is a FRESH TOKEN per call, and that single line is the whole
event-vs-state distinction. `scheduleDurableConsequence` coalesces by key —
right for a state observation, semantic corruption for an authored event.
Mutation-checked: keying on callback identity fails exactly the
duplicate-registration case, silently collapsing a double charge into one.

## Two measured results that are CONTRACT QUESTIONS, not defects to fix here

```text
1  OUTSIDE A TRANSACTION IT RUNS SYNCHRONOUSLY
   With no open scope there is nothing to defer to, so the effect runs before
   `afterCommit` returns — re-entrant inside the caller's own operation.
   `afterCommit(tree, chargeCard)` outside a transaction charges DURING the
   function that asked for it. One `queueMicrotask` at the no-scope branch
   would make timing uniform with the transactional path; the uniform-timing
   argument looks stronger than the zero-latency one. Recorded, not chosen.

2  A SYNCHRONOUS THROW ESCAPES `confirm()`
   Sibling isolation HOLDS — the second consequence still starts, which is the
   property that matters and which I had assumed was broken. But the throw
   propagates out of the transaction API that released it, so a caller who
   registered nothing can be thrown at by someone else's consequence.
   Surfacing loudly is defensible and so is isolating; inventing a public error
   channel is not (ERROR-SURFACE-0). Pinned so a change is deliberate.
```

## The resulting shape

```text
afterCommit(anchor, effect)
  registration identity   per CALL
  settlement authority    SignalTree
  start ordering          SignalTree
  remote completion       caller
  retry                   caller
  dedupe                  none
  equality                meaningless
```

`afterCommit.settled()` would be a category error: a link owns an outbound
queue, a one-shot consequence does not.

# AFTER-COMMIT-1 — the NULL SURVIVES. `afterCommit(effect)` needs no anchor

`packages/core/src/lib/after-commit-1.spec.ts`, 10/10.

## ⚠️ Withdrawing "X IS EARNED"

AFTER-COMMIT-0 concluded the anchor was earned. It was one step too far. What it
falsified was

```text
scheduleDurableConsequence({ claimant: transactionOwner, ... })
```

— that `transactionOwner` is not a valid TREE CLAIMANT, which was already known.
It never tested whether AMBIENT OPERATION IDENTITY is sufficient.

I leaned on `scopeOwns` to justify the anchor, and misapplied it. Its rule —
_"presence of a transaction is not evidence that THE WRITE is speculative under
it"_ — governs MUTATION ATTRIBUTION: a write to tree B inside a transaction on
tree A must not become speculative under A. An explicit consequence registration
is a different act. Nothing is inferred from a mutation; the application named
the operation by running inside it and saying so.

## What the operation-keyed form measures

`deferOperationConsequence(owner, transactionId, key, fn)` looks the scope up by
that exact pair and skips the attribution guard — deliberately narrow: it reaches
only an ALREADY OPEN scope and never runs anything itself.

```text
⚠️ a transaction with NO WRITES AT ALL still holds it       confirm -> 1
                                                            rollback -> 0
with a write, confirm holds then releases exactly once       ✓
with a write, rollback discards                              ✓
⚠️ a transaction on A that WRITES TREE B: the effect is A's  ✓
two interleaved transactions resolve independently           ✓
same callback registered twice runs twice                    ✓
effects start in registration order                          ✓
⚠️ outside a transaction it DEFERS, not re-entrant           ✓
CONTROL: the claimant route still runs during the callback   ✓
```

The first case is decisive: **no mutation to attribute and no location to anchor
to — only an operation** — and the consequence still tracks confirm/rollback. So
the scope is per-operation, independent of any write, and ambient
`(owner, transactionId)` identifies it.

The third is the direct counterexample to my misapplication: the effect follows
the operation it was REGISTERED IN, while B's write is correctly not speculative
under A and survives A's rollback.

Mutation-checked: routing the candidate through the claimant form fails 6 of 10;
keying on callback identity fails 1; dropping the microtask fails 1.

## The two open contract questions, now decided

```text
OUTSIDE A TRANSACTION   DEFER. An API named `afterCommit` must not sometimes
                        mean "before this function returns". Uniform
                        non-reentrancy beats saving one microtask, and the
                        candidate implements it.

A THROWING CONSEQUENCE  still escapes `confirm()`. Sibling isolation holds, so
                        the property that matters is intact — but a caller who
                        registered nothing can be thrown at by someone else's
                        consequence, and `pending.confirm()` throwing makes a
                        COMMITTED transaction look failed. That is a settlement
                        boundary decision, not `afterCommit`'s, and still not a
                        reason to invent a public error channel.
```

## The resulting pair

```text
afterCommit(effect)         operation -> one consequence
onCommitted(x, observer)    location  -> standing observation
link(x, endpoint)           location  <-> external state
```

`onCommitted` genuinely needs `x` because the relationship IS to a location.
`afterCommit` does not, and now that is measured rather than assumed in either
direction.

# DEMARCATION-0 — the NULL survives. The public surface is `link()` alone

`packages/core/src/lib/demarcation-0.spec.ts`, 16/16.

```text
NULL       a correct public `link(x, endpoint)` can be implemented on INTERNAL
           settlement-aware observation; no public `onCommitted()` or
           `afterCommit()` is required
RESULT     SURVIVES
```

## ⚠️ A drift, corrected

AFTER-COMMIT-1 proved `afterCommit(effect)` has a coherent contract, and I
treated coherence as a warrant for publishing it. The standing rule — only a
DEMONSTRATED THIRD-PARTY AUTHORING NEED justifies a public primitive — was
applied rigorously to `stored`, `persistence` and `loader`, and not to the
primitives I had just discovered.

```text
commit consequence            EARNED INTERNAL CAPABILITY
`afterCommit(effect)`         PUBLIC SURVIVAL UNPROVEN
committed-state observation   EARNED INTERNAL CAPABILITY
`onCommitted(x, cb)`          PUBLIC SURVIVAL UNPROVEN
```

The AFTER-COMMIT-0/1 tests stay — they prove the internal model a link is built
out of. And EGRESS-0's result changes STATUS rather than vanishing: it showed a
user-land link is implementable GIVEN A PUBLIC gate, so with the gate private
that inverts into the reason `link()` must be core.

## Q1 — public link on private machinery: YES

The composed candidate is the whole surface — `retrieve()`, `settled()`,
`dispose()`. No `.subscribe()`, no `.then()`, no `afterGet`/`afterSet`, no
lifecycle callbacks.

⚠️ It is written to the ten preserved semantics, and this file RE-PROVES several
against the new composition — settlement safety, collection turn coalescing,
owner isolation, reconciliation, acquisition/echo behaviour, disposal, empty
endpoint. It is NOT a one-for-one replay of every LINK-0/1/2/RACE case; those
results stand on their own files.

## Q2 — the exact private capability required

```text
1  getPositionRegistry(x)          owner identity, and the acceptance predicate
2  getPathNotifier().subscribe     the trigger stream
3  notifier.onFlush                THE TURN BOUNDARY — see below
4  scheduleDurableConsequence      settlement-deferred egress with late read
5  external()                      PUBLIC already; the inbound half needs
                                   nothing private
```

⚠️ **The turn boundary was a real discovery, not an optimisation.** Scheduling
per delivered event gave ONE observation for three writes to the same leaf — but
that is the NOTIFIER coalescing same-path entries, not turn coalescing. Measured:
`addMany` of three rows produced THREE observations of the same final
collection, because three distinct child paths deliver three events. For a link
that is three identical outbound writes — three serialised round-trips for one
logical change. `onFlush` fires once per flush, the same boundary the diagnostic
journal uses.

## Q3 — the owner-only collection ping IS harmless for link

Every mutator was inventoried:

```text
addOne addMany updateOne upsertOne removeOne setAll clear
  -> each emits >= 1 QUALIFIED, VALUE-CARRYING `data.rows.<id>` event
  -> the unqualified `{ path: 'data.rows' }` ping accompanies every one and is
     NEVER the only event
```

So a link that filters on the namespace and late-reads sees every transition.
Mutation refines this further: treating the ping AS a trigger breaks nothing,
because it always arrives in the same flush as its valued siblings. The filter
is DEFENSIVE for link, not load-bearing.

⚠️ **AND "HARMLESS" WAS WRONG IN GENERAL.** REALIZATION-NAMESPACE-0 later found
this same ping CORRUPTING realization state — it carries no `structuralEffect`,
so `deriveCollectionPath` takes its non-structural branch and rewrites a nested
collection's descriptor path to the parent branch. "Harmless to the consumer I
was looking at" is not "harmless".

## Q4 — one behaviour that forces nothing, and one surface limitation

```text
AN ANGULAR EFFECT SEES SPECULATIVE STATE — measured and pinned. Ordinary
reactivity cannot distinguish settled from speculative, and it observes
'speculative' mid-transaction. It is TRANSIENTLY wrong, not permanently: the
reversal is observed too.

That does NOT earn a public observer. The remedy for an irreversible action is
that it belongs to whoever owns transaction confirmation — the same code holding
the pending handle. For `afterCommit` to earn public surface, the falsifier
would have to be code that does NOT own settlement, demonstrably needing to
register an irreversible consequence with the current operation and unable to
express it by composition. No such case is on record.
```

⚠️ **An entityMap NODE is not a linkable location.** It resolves no registry —
leaves and branch accessors got one in OWNER-REPLAY-2, a marker-materialised
collection node is neither. So `link(tree.$.data.rows, endpoint)` is refused.
The PARENT BRANCH covers it, whose late read includes the collection's settled
contents.

⚠️ **I called that "a spelling, not a capability". That is NOT PROVEN.** For
`{ data: { rows, selectedId, page } }`, linking `data` instead of `data.rows`
changes both the VALUE SHAPE sent to Y and the SYNCHRONISATION SCOPE — unrelated
siblings now drive the endpoint. See ENTITY-LINK-0.

## Q5 — evidence

```text
drop owner isolation            1 of 16 fails
drop the reconciliation loop    1 of 16 fails
drop the flush turn boundary    1 of 16 fails
drop the loop equality guard    HANGS — the loop's only termination condition
```

Two guarantees were asserted without being tested in the first draft — owner
isolation and reconciliation — and mutation caught it; both now have cases.

⚠️ And the composition got SMALLER because of it: a separate echo-suppression
check turned out to be redundant. The reconciliation loop's first iteration
already compares current X against `knownY` and returns without sending, so
echo suppression and the convergence test are the same question asked at
different moments. One equality check, not two.

# ENTITY-LINK-0 — the NULL is falsified. The exclusion is NOT "just a spelling"

`packages/core/src/lib/entity-link-0.spec.ts`, 4/4.

DEMARCATION-0 said excluding `entityMap` from linkable locations "costs a
spelling rather than a capability". ⚠️ That was not proven, and it is wrong.

```text
collection carries a positionId allocated from the tree's registry   ✓
collection carries its own ownerPath ("data.rows")                   ✓
restoration reverses it as its OWN position, independently           ✓
collection carries the REGISTRY back-reference                       ✗
```

So `entityMap` is ALREADY an independently addressable SignalTree position —
the topology, restoration and the notifier all treat it as one. **The missing
registry is an ownership hole broader than `link()`; link merely found it.** Same
class as OWNER-REPLAY-2's authored-collection gap and the branch-accessor gap
before it.

And the substitute is not equivalent, measured on `{ rows, selectedId, page }`:

```text
link(tree.$.data, rowsEndpoint)
  fires for `page` and `selectedId`, which have nothing to do with rows
  sends { rows, selectedId, page } where the endpoint expects rows
```

Both SYNCHRONISATION SCOPE and VALUE SHAPE change.

⚠️ The fix is NOT "add a registry to collections so link works" — that is the
reasoning this audit refuses. The question is whether every addressable position
should name its owner. Recorded for that decision, not taken here.

# LINK-HANDLE-0 — strong OUTBOUND settlement earned; whole-Link settlement still open

⚠️ An earlier draft of this heading said `settled()` was FROZEN. It is not: this
file's own record says whether an in-flight `retrieve()` participates is an open
contract question, so the honest claim is "strong outbound settlement earned,
one discriminator remaining" — see LINK-HANDLE-1.

`packages/core/src/lib/link-handle-0.spec.ts`, 10/10.

## 1 — the boundary is STRONG

```text
WEAK    resolves while an observation is HELD behind settlement. Measured: a
        host awaiting it before backgrounding is told the link is caught up,
        and the send happens after confirm.
STRONG  waits through the held observation AND anything a completed send
        enqueues behind it.
```

⚠️ **The first STRONG implementation was wrong, and mutation exposed it.** It
polled a counter across `await flush()` — microtasks only — so a settlement
arriving on a MACROTASK could never be observed and the loop hit its own guard.
The baseline failed the moment the test confirmed via `setTimeout`. Each held
observation now owns a promise the settlement authority resolves, so `settled()`
waits on a SIGNAL rather than spinning.

Honest limit, stated not hidden: if nothing ever settles the transaction,
`settled()` waits forever — the same trade `persistence()` already documents for
an unresolved optimistic mutation.

## 2 — outbound failure REJECTS `settled()`

A public link otherwise has no way to tell the application that Y refused the
state, and `settled()` is where the application is already waiting. Verified: it
rejects, the queue is NOT wedged (a later write still goes out), and the failure
is reported ONCE rather than on every subsequent call.

No retry, no backoff, no status, no `onTreeError`.

## 3 — disposal

```text
outbound set IN FLIGHT      not cancelled; nothing new begins
held observation released   does not send after disposal
retrieve() in flight        result not applied
settled() already waiting   RESOLVES rather than hanging
```

The last one needs disposal to resolve the waiters itself: a held observation's
count never returns to zero on its own.

## ⚠️ The candidate shrank twice, both times because mutation refused a clause

```text
`chain === before` re-check   SUBSUMED. Every appended send is preceded by a
                              held observation, so the release-signal wait
                              already carries the loop. Removing it failed
                              nothing — including a test asserting how much work
                              had finished AT the moment settled() resolved,
                              which is the direct form of the question.
`inFlightRetrievals` guard    UNTESTED, so removed rather than kept on faith.
                              Whether settled() should also wait for an
                              in-flight retrieve() is an OPEN CONTRACT QUESTION:
                              retrieve() returns its own promise, so a caller
                              can already await it.
```

Same pattern as DEMARCATION-0's redundant echo check. Final mutation state — every
remaining clause discriminated:

```text
ignore held observations   1 of 10 fails
swallow the failure        2 of 10 fail
dispose leaves waiters     1 of 10 fails
```

## Test-design corrections made along the way

Three arms passed for the wrong reason before being tightened: a SYNCHRONOUS
endpoint let a send complete inside the microtask `await settled()` already
yields; a microtask-fast `confirm()` never exercised the held-observation wait;
and disposing while a send was in flight exited through the wrong branch. Each
is noted at the arm it affected.

# OWNER-LOCATION-0 — the NULL is falsified. entityMap was NOT exceptional

`packages/core/src/lib/owner-location-0.spec.ts`, 3/3.

An inventory BEFORE any invariant, because the tempting move — hand collections a
registry so `link()` accepts them — would choose the fix by what one API wants.

```text
                     positionId  ownerPath  registry
tree (root)              n          n          Y
tree.$ (namespace)       Y          Y          Y
branch accessor          Y          Y          Y
leaf / nested leaf       Y          Y          Y
compared node            Y          Y          Y
entityMap node           Y          Y          n   <- addressable, unowned
stored node              Y          Y          n   <- addressable, unowned
asyncSource node         n          n          n   <- not addressable at all
```

**Two positions, not one.** The pattern is mechanical rather than semantic: the
registry is attached at the leaf/branch construction sites in `signal-tree.ts`,
and a MARKER builds its own node, so both marker-constructed positions missed it.
`compared` has it only because it routes through `wrapLeafSignal`.

So the invariant the inventory supports — distinct from OWNER-REPLAY-2's, which
is about MUTATIONS:

> **Every independently addressable SignalTree state position names its owning
> PositionRegistry.**

Fixed at the two MARKER CONSTRUCTION BOUNDARIES, `stored.ts` and
`entity-map.ts` — not at `link()`, and not by special-casing collections.
Mutation-checked: dropping either fails 2 of 3. Verified across trees — two
collections at the same path resolve different registries, each the one its own
tree resolves, while the local position numbers still collide (the namespace is
named, not eliminated).

`stored.ts` had typed its context registry as opaque `unknown` "because this
marker only ever compares it by reference". That is no longer true and the
comment now says why.

Two earlier pins flipped as a result: DEMARCATION-0's "an entityMap node is not a
linkable location" and ENTITY-LINK-0's "only the registry is missing".

# LINK-COLLECTION-0 — the NULL survives. `Row[]` is the collection's value

`packages/core/src/lib/link-collection-0.spec.ts`, 9 pass + 1 KNOWN RED.

Ownership does not settle the VALUE contract: a collection is still not an
ordinary callable writable location. The candidate resolves the shape FROM THE
NODE rather than from configuration —

```text
read     rows.all()
acquire  external(() => rows.setAll(value))
value    Row[]
```

— and nothing marker-specific reaches the public surface.

```text
acquisition applies through setAll, no echo back to Y        ✓
acquisition is EXTERNAL — zero restoration history           ✓
addMany is ONE outbound snapshot, not N                      ✓
rollback never leaks a speculative collection                ✓
restoration reconciles to the FINAL restored collection      ✓
a pushed whole snapshot REPLACES rather than merges          ✓
two trees at the same collection path stay isolated          ✓
dispose stops the relationship                               ✓
```

## ⚠️ NESTED-COLLECTION-ROLLBACK-0 — a defect found here, and it is not link's

```text
{ rows: entityMap }            transaction rollback of addOne   WORKS
{ data: { rows: entityMap } }  the SAME rollback                REFUSES,
                               and the speculative row SURVIVES
```

`SignalTreeRollbackError` is thrown and the tree is left holding state a
transaction explicitly withdrew. **Verified pre-existing** — identical result
with the OWNER-LOCATION-0 change stashed. Same severity class as
NOTIFIER-SCOPE-0, carried as its own item and pinned `it.fails`; the link arm
uses a top-level collection so link's question stays link's question.

# LINK-HANDLE-1 — an in-flight `retrieve()` DOES participate in `settled()`

`packages/core/src/lib/link-handle-1.spec.ts`, 5/5.

```text
EXCLUDED   settled() resolves BEFORE the acquisition lands, and the link then
           mutates X after the caller was told the relationship was settled —
           the same misleading shape as the WEAK outbound reading
INCLUDED   waits for the retrieval, its acquisition, AND outbound work the
           acquisition causes
```

`retrieve()` having its own promise is not sufficient to exclude it:
per-operation promises and whole-object idle promises routinely coexist, and
`retrieve()` is a method ON THE HANDLE that can mutate X. Disposal releases a
`settled()` waiting on a retrieval, and the late value is still not applied.

Mutation-checked: removing retrieval participation fails 1 of 5; leaving
retrieval waiters unreleased on dispose fails 1 of 5.

## The multi-failure contract

```text
set(A) rejects, set(B) rejects, then settled()
  -> BOTH failures happen; ONE is reported (the latest)
```

Chosen as the minimum that makes no false claim: `settled()`'s contract is _this
relationship is caught up_, and a rejection communicates _it is not_. WHICH
failure is reported is not part of that claim, and the latest describes the most
recent attempt. **No AggregateError is invented** — no case has been shown where
a caller acts differently on two failures than on one, and inventing a richer
error shape is the same move as inventing retry or status.

# NESTED-STRUCTURAL-ROLLBACK-1 — the NULL is falsified, and the defect is WIDER

`packages/core/src/lib/nested-structural-rollback-1.spec.ts`, 10 pass + 5 KNOWN
RED. **Stopping to report the boundary before patching**, per the rule that a
broadened inventory exposing a larger defect names it first.

## The inventory — the split is by OPERATION KIND, not depth

```text
             addOne  addMany  updateOne  upsertOne  removeOne  setAll  clear
top            ok      ok        ok         ok         ok       ok      ok
data.rows     THREW   THREW     THREW      THREW       ok       ok      ok
a.b.rows      THREW   THREW     THREW      THREW       ok       ok      ok
```

Anything that CREATES OR MODIFIES a subject refuses. Depth beyond one level
changes nothing. ⚠️ `setAll`/`clear` are recorded from a SEEDED collection and
are not uniformly safe — `setAll` on an EMPTY nested collection also throws,
because replacing nothing with something creates a subject. **The dividing line
is SUBJECT CREATION, not the operation's name.**

## ⚠️ And a second axis: a SECOND TREE makes even the safe cases fail

```text
NESTED, one tree    removeOne  threw=false  restored ✓
NESTED, two trees   removeOne  threw=true   NOT RESTORED ✗
TOP,    one tree               threw=false  restored ✓
TOP,    two trees              threw=false  restored ✓
```

⚠️ **CORRECTION.** I first called this "silent data loss". It is not silent —
`rollback()` throws `SignalTreeRollbackError` — and it is the SAME failure class
as the one-tree cases:

```text
rollback requested -> rollback REFUSED -> the transaction's speculative state
remains materialised

  addOne     the speculative ADDITION remains
  removeOne  the speculative DELETION remains
```

The second tree widens the defect's REACH — an operation that succeeds with one
tree fails with two — not its severity class.

## The boundary, traced rather than guessed

Every layer that could plausibly lose nested identity was measured and is
CORRECT:

```text
delivered ownerPath           "data.rows"           ✓
delivered positionIds         [3] = the collection  ✓
registry.contains(root, coll) true                  ✓
structuralOwnerPaths index    [3 -> "data.rows"]    ✓
resolveNodeAtPath             splits on "."         ✓
```

Instrumenting `canApplyEffect` names the single point of loss:

```text
top     descPath="rows"   resolved="rows"   ownerNode=true
nested  descPath="data"   resolved="data"   ownerNode=false  -> REJECT
```

`resolveCollectionPath` prefers `descriptor.collectionPath`, and that descriptor
holds the PARENT branch's path. It comes from `deriveCollectionPath`
(`tree-realization-adapter.ts`):

```text
if (!ownerPath.includes('.')) return ownerPath;   // top-level "rows"       ✓
if (typeof subjectId !== 'number') return undefined;
return parentPath(ownerPath);                     // "data.rows" -> "data"  ✗
```

> ⚠️ **The derivation is STRING-SHAPED AND AMBIGUOUS.** It answers _"given a
> row-field path, which collection contains it?"_ by stripping the last segment
> — correct when `ownerPath` names a ROW (`rows.x`), wrong when it names a
> NESTED COLLECTION (`data.rows`). Those are indistinguishable as strings.
> Top-level works only because a root collection has no dot and takes the
> earlier branch.

So this is **not a missing identity**. The correct answer already exists in
`structuralOwnerPaths` (positionId -> collection ownerPath); the string
derivation overrides it because the descriptor is consulted first.

## What the fix must and must not do

```text
MUST     derive the collection path from whether the position IS a collection,
         not from the shape of its path string
MUST     leave the planner's refusal intact — it behaves correctly given the
         bad path it was handed
MUST     explain the two-tree axis, or show it has a separate cause
MUST NOT patch the thrown SignalTreeRollbackError
MUST NOT weaken refusal to let the rollback continue
```

## ⚠️ Release accounting

Core is **2092 passing with 6 expected failures**, and five of those are this
defect. That is NOT release-green: an expected failure standing in for a
correctness defect is a deferred bug, not a passing suite.

# REALIZATION-NAMESPACE-0 — the NULL survives. The two axes are ONE defect

`packages/core/src/lib/realization-namespace-0.spec.ts`, 9/9 (4 pinning current
broken behaviour).

```text
NULL       realization descriptor/capture state is fully owner-isolated
RESULT     SURVIVES — B never writes A's descriptor
```

## The discriminator matrix

```text
A  A only                              ok
B  A + B created, B never mutated      ok      existence alone is fine
C  A + B, B SCALAR mutation only       ok      any B notification is fine
D  A + B, B COLLECTION mutation        FAILS   the reproducer
E  same path, DIFFERENT local posIds   ok      padding A fixes it
F  DIFFERENT path, same local posIds   FAILS   path is irrelevant
G  B created FIRST                     FAILS   ordering is irrelevant
```

The trigger is a **local position-id collision plus a collection mutation in the
other tree** — not co-existence, not path, not order.

## The descriptor snapshot — it diverges AT THE SEED

```text
ONE tree   afterSeed  collectionPath = "data.rows"   ✓
TWO trees  afterSeed  collectionPath = "data"        ✗
```

Both runs have a private map (size 1), a correct `ownerPath`, and the same
position. Only the DERIVED `collectionPath` differs, and it is already wrong
before any transaction exists. Maps and registries are distinct objects.

## So it is ONE defect, and here is the mechanism

`deriveCollectionPath` returns `ownerPath` (correct) only when the notification
carries a `structuralEffect`. The unqualified OWNER-ONLY COLLECTION PING —
`{ path: 'data.rows' }`, both values undefined, no structural effect, no
`ownerId` — takes the non-structural branch:

```text
if (path === ownerPath) {
  return ownerPath.includes('.') ? parentPath(ownerPath) : undefined;
}
```

`"data.rows"` -> `parentPath` -> `"data"`. At top level `"rows"` has no dot and
returns `undefined`, leaving the good value alone — **the entire reason
top-level survives.**

With one tree the ping coalesces away in the same flush as the structural event.
With a second tree mutating a collection at the SAME LOCAL POSITION ID, flush
composition changes, the ping survives separately, and it lands LAST.

```text
ROOT CAUSE   deriveCollectionPath is string-shaped and ambiguous
AXIS 1       nested subject-creating ops fail deterministically
AXIS 2       a second same-position tree makes even nested removeOne fail, by
             changing which of A's OWN notifications writes last
```

⚠️ `path === ownerPath` cannot mean "a row inside a collection" — if a
notification's path IS its owner path, it is ABOUT the owner. `parentPath` is
wrong there for any nested owner and only accidentally harmless at the root.

## ⚠️ This corrects DEMARCATION-0 and OWNER-REPLAY-2

I recorded the owner-only ping as "harmless residue" and "defensive, not
load-bearing". That was true FOR LINK — a link filters it out, and every
transition also emits a qualified event — and **false in general**. The ping is
the vehicle that corrupts realization state here.

> "Harmless to the consumer I was looking at" is not "harmless".

Both records are corrected in place.

# OWNER-PING-0 — the ping is QUALIFIED, and that alone fixed the two-tree axis

The owner-only collection ping's two producers were found by instrumenting
`notify` and capturing the stack:

```text
restoration.ts:3080     forwarding an interceptLeafSignals mutator event
transactions.ts:1321    the same shape
```

Both values are `undefined` because `wrapMutator` deliberately skips
snapshotting for collections, and both forwarded to `notify` POSITIONALLY —
without an `ownerId`. Both call sites already had `treeOwnerId` in scope, from
the guard added in OWNER-REPLAY-1.

**Qualifying the ping fixed the ENTIRE two-tree axis on its own** — D, F, G and
the isolation case. With the namespace present the notifier's semantic identity
separates A's ping from B's, coalescing behaves as it does with one tree, and
the ping no longer survives to claim the descriptor first.

The invariant is promoted accordingly, and this is the third widening:

```text
WAS  every VALUE-CARRYING mutation names its owning tree
IS   every notification that participates in a global SignalTree mechanism —
     batching, coalescing, delivery, attribution or authority — names its owning
     tree, WHETHER OR NOT IT CARRIES A VALUE
```

REALIZATION-NAMESPACE-0 is what forced it: a value-less notification changed
causal state indirectly.

⚠️ And PositionIds are deliberately NOT made globally unique. The probe proved
local ids are viable — distinct registries, distinct descriptor maps, no
cross-writes — and colliding local numbers are the falsifier that exposed this
class of bug. Globally uniquifying them would have hidden it.

# STRUCTURAL-PATH-1 — ⚠️ MY CANDIDATE FIX IS FALSIFIED

The diagnosis stands. The fix I wrote does not.

## The candidate

`deriveCollectionPath`'s two ambiguous branches, changed so that

```text
path === ownerPath          -> undefined   (was parentPath(ownerPath))
path under ownerPath + subj -> ownerPath   (was parentPath(ownerPath))
```

on the premise that **`ownerPath` never names a ROW** — since `entity-signal`
always notifies with `basePath`, the collection, as the owner path.

## What it did

```text
nested addOne / addMany     FIXED
nested removeOne two-tree   already fixed by OWNER-PING-0
nested updateOne/upsertOne  still red — they are SCALAR effects and never reach
                            the structural branch at all
5 tree-realization-adapter tests   BROKEN
1 restoration rekey test           BROKEN
```

## Why it is wrong

Those adapter tests construct descriptors where **`ownerPath` DOES name a row**.
So the premise is false, `path === ownerPath` does not imply "about the owner",
and no string rule can separate the cases — which is the original finding,
turned back on my own fix.

Reverted. The ping qualification is kept, because it is independently correct
and breaks nothing.

## What the real fix needs

```text
CONSULT POSITION IDENTITY, not path shape. `structuralOwnerPaths` already knows
which positions ARE collections; the derivation must ask that rather than infer
from dots.

AND a second derivation has the same ambiguity: `deriveFieldPathFromRow` writes
a SUBJECT DESCRIPTOR recording subject 1 at path "data.rows" with an empty field
path, which is why `resolveLiveScalarNode` fails for updateOne/upsertOne even
once `collectionPath` is correct.
```

Instrumented evidence for the remaining reds:

```text
top     path=rows.seed.n       descColl=rows       target=true
nested  path=data.rows.seed.n  descColl=data.rows  target=FALSE
        subjDesc { path: "data.rows", fieldPathFromRow: "" }
```

⚠️ **That reading was taken UNDER the falsified candidate.** `descColl=data.rows`
held only while the reverted patch was applied; at HEAD it is `"data"` again.
What the experiment proved is narrower and still useful: fixing `collectionPath`
alone is INSUFFICIENT, because the subject-descriptor derivation carries the same
ambiguity independently.

## Standing

```text
core   2102 passing, 5 expected failures
```

Still NOT release-green: four are nested rollback (addOne, addMany, updateOne,
upsertOne) and one is `link-collection-0`'s duplicate pin of the same defect.

# REALIZATION-ADDRESS-0 — the NULL survives. The role IS knowable from position

`packages/core/src/lib/realization-address-0.spec.ts`, 3/3.

The remaining defect is renamed for what it is:

> **REALIZATION ADDRESS ROLE AMBIGUITY.** `ownerPath` is not one semantic thing.
> Sometimes it names a COLLECTION (`data.rows`); sometimes it legitimately names
> a ROW (`rows.someKey`). The adapter and rekey controls prove both, so no string
> test can separate them. Dots encode NESTING, not role.

```text
INVALID DISCRIMINATORS
  ownerPath.includes('.')      path === ownerPath      parentPath(ownerPath)
```

That is why my candidate broke five adapter tests and a restoration rekey test:
it changed the rule for BOTH roles at once.

## The measured inventory

Instrumenting `rememberTreeRealizationDescriptor` and classifying `effect.owner`
against the set of positions that ARE collections:

```text
shape   op         owner ROLE        path            derived collectionPath
TOP     addOne       2   COLLECTION  rows.x          rows        ✓
TOP     addMany      2   COLLECTION  rows.x          rows        ✓
TOP     updateOne    2   COLLECTION  rows.seed       rows        ✓
TOP     upsertOne    2   COLLECTION  rows.seed       rows        ✓
TOP     removeOne    2   COLLECTION  rows.seed       rows        ✓
NESTED  addOne       3   COLLECTION  data.rows.x     data.rows   ✓
NESTED  addOne       3   COLLECTION  data.rows       data        ✗
NESTED  updateOne    3   COLLECTION  data.rows.seed  data        ✗
NESTED  upsertOne    3   COLLECTION  data.rows.seed  data        ✗
NESTED  removeOne    3   COLLECTION  data.rows       data        ✗
```

⚠️ **`ROLE` is `COLLECTION` in every single row** — the position discriminator is
exact at depth 0, 1 and 3, and rejects a nested plain leaf whose ownerPath also
contains a dot. Meanwhile the string derivation is wrong for every NESTED
non-structural notification.

## Answers to the preregistered questions

```text
1  roles ownerPath can have         COLLECTION and ROW — both legitimate
2  can owner position separate them YES, measured, no exceptions
3  what the adapter tests protect   the ROW-OWNED reading — which is exactly why
                                    a blanket change broke them
4  canonical containing collection  the owner position's own address, when that
                                    position IS a collection
5  canonical field in a subject     path relative to the collection, minus the
                                    subject-key segment
6  can the derived strings stay
   cached descriptor authority?     OPEN
7  zero-tree-visit preserved?       OPEN
```

## The rule the inventory supports

```text
if effect.owner IS a collection position
     collectionPath   = that collection's address       (no dot counting)
     fieldPathFromRow = relative path minus the subject-key segment
else
     the existing ROW-OWNED rules, UNCHANGED
```

Role-conditional, so the adapter and rekey tests are preserved BY CONSTRUCTION —
they are row-owned and take the other branch untouched.

## ⚠️ Why it is not implemented: a measured plumbing constraint

`structuralOwnerPaths` is built inside `createTreeRealizationAdapter`'s closure.
`rememberTreeRealizationDescriptor` is a FREE FUNCTION called from `transactions`
and `restoration` and cannot reach it. **The role classification the fix needs is
not available where the derivation happens.**

That is a design decision — where the collection-position index lives, and
whether the derived strings should remain descriptor state at all — and it is
entangled with the two open questions. Descriptors are FIRST-WRITE-WINS
(`existing?.collectionPath ?? collectionPath`), so caching an ambiguous
derivation is unsafe independently of ordering; OWNER-PING-0 fixed the
cross-tree ordering that exposed it, not the caching.

Also confirmed: `deriveFieldPathFromRow` carries the identical dot-based guess —
stripping the entity-key segment when `ownerPath` has no dot and keeping the
whole relative path when it does.

# The notifier ownership invariant, made permanent

`packages/core/src/lib/notifier-ownership-invariant.spec.ts`, 3/3, with no
`transactions()`.

```text
two trees give their collections the SAME local position id      ✓ precondition
alternating structural writes stay owner-distinguishable         ✓
   — asserted over EVERY delivered notification, value-less included
a scalar write is owner-qualified too                            ✓
```

⚠️ A tree with NO enhancers resolves no registry and emits NO notifications at
all — position topology and mutation capture are enabler-gated — so
`restoration()` is present only to turn the notifier on. Stated rather than
letting the file's title overclaim.

⚠️ Local position ids deliberately COLLIDE here. Identity is
`(registry, local position)`, never the number alone; making position ids
globally unique would make this test pass vacuously and would have hidden every
bug in this class.

# REALIZATION-TARGET-ROLE-1 — the six regressions explained, and TWO wrong models corrected

`packages/core/src/lib/realization-target-role-1.spec.ts`, 4/4.

## Two corrections in a row, one of them mine

```text
1  "ownerPath sometimes names a ROW"     proposed, withdrawn as row-owned
                                          POSITIONS after measurement
2  "the adapter tests are scalar leaves"  MINE, and WRONG — I generalised from
                                          `profile.name` / `preference`, which
                                          pass no ownerPath and no subjectId.
                                          The six that break DO pass
                                          `ownerPath: 'users.u1'`.
```

## What is actually true

```text
collection node    positionId YES
row NODE           positionId NO — no owned metadata at all
row FIELD LEAF     positionId YES, and it is THE COLLECTION'S position,
                   plus a subjectId, with ownerPath naming the ROW
```

Measured on `data.users` containing row `u1`:

```text
collPos           = 3
nameLeafPos       = 3                 <- the collection's position
nameLeafOwnerPath = data.users.u1     <- the ROW path
nameLeafSubjects  = [1]
```

So `ownerPath` really does take both shapes and they are indistinguishable as
strings — while `effect.owner` is the COLLECTION POSITION in both.

## Which half broke the six — isolated

The withdrawn patch had two independent halves. Applied separately:

```text
A  `path === ownerPath` -> undefined     breaks NOTHING (152 pass)
B  row-field branch -> `ownerPath`       breaks ALL SIX
```

⚠️ **The `preference` case needs no explanation** — it was never affected.
`'preference'` has no dot, so the old code already returned `undefined` there,
and candidate A is safe. The open item is closed by isolation rather than by
tracing.

B broke them because `ownerPath` is the COLLECTION in production and the ROW in
those tests. The old `parentPath(ownerPath)` is right for the row shape and
wrong for the collection shape; my rule was the exact inverse.

## The rule that is correct for BOTH

```text
                ownerPath       old parentPath    candidate B      REGISTRY RULE
production      data.rows       data       ✗      data.rows  ✓     data.rows  ✓
adapter tests   data.users.u1   data.users ✓      data.users.u1 ✗  data.users ✓
```

> **Ask the registry for the owner position's canonical collection address.
> Never read `ownerPath`'s shape.** Correct for both, because it ignores the
> string entirely.

This is the PositionRegistry-as-authority decision, now EARNED by measurement
rather than assumed — and it removes the need for the branch I had proposed
(`isCollection ? new : old`), which would have kept a field whose meaning
depends on which branch wrote it.

## The separation that makes it simple

```text
PositionId  = the CAUSAL / OWNERSHIP position
SubjectId   = an ENTITY LIFETIME
field path  = a coordinate WITHIN the current subject
⚠️ "PositionIds identify state positions" was too strong — a row field leaf
reports the collection's P3, so a PositionId does not uniquely identify that
leaf. It identifies who OWNS it.
```

## Standing

```text
core   2112 passing, 5 expected failures
```

Remaining before implementation: DESCRIPTOR-ROLE-0 (which descriptor fields
serve scalar vs subject resolution) and SUBJECT-ADDRESS-0 (ping != whole
subject != field — the ping carries `subj=[1]`, measured, so it WILL manufacture
`fieldPathFromRow = ''` today).

# DESCRIPTOR-ROLE-0 — the NULL survives, and the overload is NARROWER than I claimed

`packages/core/src/lib/descriptor-role-0.spec.ts`, 4/4.

```text
NULL       collectionPath / fieldPathFromRow serve SUBJECT realization
           exclusively; ordinary scalar replay uses its own machinery
RESULT     SURVIVES
```

Every production read traced through its consumer branch:

```text
collectionPath
  occupancy tracking          SUBJECT (keyed by subjectId)
  descriptor write / merge    capture-side, not resolution
  resolveCollectionPath       STRUCTURAL / subject
  resolveCurrentSubjectTarget SUBJECT — resolves a collection node
fieldPathFromRow
  canResolvePreparedSubjectTarget   requires effect.subjectId
  assignPreparedSubjectValue        requires a prepared SUBJECT
  resolveSubjectFieldPath           keyed by effect.subjectId
```

`resolveLiveScalarNode` falls back to `descriptor.path` for a non-subject effect
and never consults either field.

⚠️ **So the overload I named does not exist in the CONSUMERS.** I said
`collectionPath` doubles as a parent/scope coordinate for scalars. It does not:
the DERIVATION computes a parent-shaped string for scalar-looking inputs that
nothing then reads. Narrower, and better-behaved, than a genuinely overloaded
field.

## ⚠️ The top-level copies are VESTIGIAL

Both fields exist twice — on the descriptor and per `subjectDescriptors` entry —
with the top-level as a last-resort fallback. Removing BOTH:

```text
baseline                          2112 passing, 5 expected fail
both top-level fallbacks dropped  2112 passing, 5 expected fail
```

Identical across the entire suite. **Historical convenience, not required
fallback authority.** Not deleted here — what the descriptor must retain for
zero-tree-visit replay is an implementation question, and deleting for elegance
is what this audit refuses. Recorded so the implementation does not preserve
them believing something depends on them.

## ⚠️ A THIRD meaning for `''`, found while tracing

```text
canResolvePreparedSubjectTarget   if (!fieldPathFromRow) return false;
                                  -> '' is FALSY, so it reads as NO PATH
assignPreparedSubjectValue        if (fieldPathFromRow === '') { ... }
                                  -> '' reads as WHOLE SUBJECT
```

Two consumers, two meanings for the same value. That bears directly on
SUBJECT-ADDRESS-0: the owner-only ping manufactures `''`, and which consumer
sees it decides whether the effect is REFUSED or applied to the ENTIRE ROW.

The three states must stay distinct — `undefined` (no information), `''` (whole
subject), `'name'` (a field) — and today two of them already collide at one call
site, independently of the ping.

## Theorem, tightened

```text
PositionId  = the CAUSAL / OWNERSHIP position
SubjectId   = an ENTITY LIFETIME
field path  = a coordinate WITHIN the current subject
```

⚠️ "PositionIds identify STATE positions" was too strong: a row field leaf
reports the collection's P3, so a PositionId does not uniquely identify that
leaf — it identifies who OWNS it.

# CANDIDATE B — the reconciliation. A -> HEAD is materially different, many times over

Candidate A is `a4c0b747` (_"the published manifests were not installable — plus
15.0.0-rc.1"_), frozen and immutable. B was conditional on the hardening work
finding material production-facing changes. **That condition is met and the
question is no longer whether B is needed — it is whether HEAD qualifies to BE
it.** This is the evidence package.

```text
103 commits    377 files    21,690 insertions    25,935 deletions
91 production source files    138 spec files    NET -4,245 lines
```

The candidate got SMALLER, which is the shape a hardening pass should have.

## MATERIAL TO CONSUMER — public surface

```text
REMOVED   timeTravel()            -> restoration()
          TimeTravelMethods       -> RestorationMethods
          TimeTravelEntry         -> RestorationHistoryEntry
          UpdateMetadata          -> WriteMetadata
          @signaltree/core/security  subpath deleted
          @signaltree/core/storage   subpath deleted
          @signaltree/events angular subtree deleted
          EditSession.getHistory()   -> getEditHistory()
          getHistory()/resetHistory() -> getRestorationHistory()/
                                         resetRestorationHistory()

ADDED     undoable()   ⚠️ DID NOT EXIST IN A — grep count 0 in A's barrel
          external()
          restoration()
```

`undoable()` is the single largest consumer-facing difference, and it is not a
rename: **A had no opt-in restoration door at all.**

## MATERIAL TO CORRECTNESS — semantics that changed, not names

```text
A                                          HEAD
---------------------------------------    -----------------------------------
history admitted by DEFAULT, with          OPT-IN. `isTurnEligible = designated`.
`recordHistory: false` / `shouldSkip`      Nothing enters restoration history
opt-OUTS                                   without `undoable()`. (HIST-C2)

TimeTravelMethods EXTENDS                  separated. The duplicate
TransactionMethods — two `transaction()`   `timeTravel().transaction()` and its
implementations on one surface             145-line rollback planner deleted
                                           (TX-SURFACE-0)

a restoration was indistinguishable        origin: 'restoration' propagates;
from external truth at the observation     P0-C protects realizations; ST1034
seam                                       refuses a divergent undo

`stored().reload()` applied as AUTHORED    applied as external truth. Two defects
work                                       fixed: an undo destroying durable
                                           truth, a rollback reverting a reload
                                           (PER-B)

a devtools scrub was AUTHORED — it could   participation: 'inspection'. Excluded
create rollback dependency evidence and    from dependency admission and
VETO a business rollback                   contribution (DEVTOOLS-JUMP-0/0.1)

TURN-FEED did not exist                    four-event lifecycle channel, owner-
                                           installed, ST1036 on unresolvable
                                           (TURN-FEED-0 / 0.2 / 0.2.1)

source: 5-value union + an open            origin: 3 values, then 4 with
`[key: string]: unknown` escape hatch      'transaction-rollback' earned by a
                                           consumer. Hatch DELETED — it was what
                                           let 24 stale reads compile.

no external-truth ingress door             external() — origin external,
                                           participation realized, ST1035 on an
                                           async scope (A1)
```

## INTERNAL HARDENING ONLY

```text
causal-write-mode.ts        -> write-participation.ts
time-travel/                -> restoration/
StructuralHistoryEffect     -> StructuralEffect + StructuralEffectKind (a real
                               aliasing defect, two concepts one name)
AppliedHistory              -> AppliedTurnProjection (straddled two authorities)
seven fabricated `origin: 'system'` publish sites   -> absence
currentHydrateMode()        -> DELETED (computed a distinction no marker could
                               act on)
transactionIdentityKey(owner, id) -> (id), ordinal WeakMap deleted
NEW: transaction-lifecycle.ts, diagnostic-journal.ts,
     restoration-eligibility.ts, undoable.ts, external.ts
```

## DELETED RESIDUE

```text
mock `.with()` enhancer-safety suites   tested the test's own reimplementation
WriteMetadata escape hatch + its only   a test asserting the hatch exists
consumer
form-history/, security-validator       dead subsystems
three stale *HistoryEffect* names, one false authority name (EditSession)
```

## TEST / HARNESS ONLY

```text
138 spec files changed. New falsification suites: HIST-0, RESTORE-P0, HIST-C2,
TX-SURFACE-0, TX-LEDGER, TURN-FEED-0/0.2, DEVTOOLS-JUMP-0/0.1, A1 ingress,
DIAG-JOURNAL-1 (F1-F7), PER-B (P1-P12), MATRIX-CLOSE M6 + S3 recovery.
Harness fixes: a noisy perf baseline, and the vitest retention gate (37th gate).
```

## DOC ONLY

The audit itself, the errors catalogue (ST1033-ST1036), the naming grid, the
DX-NAMES rejection ledger, and the withdrawn outside-check instrument.

## VERDICT

```text
materially different?   YES — on every axis except doc-only, and the public
                        surface alone would settle it
qualifies as B?         YES, subject to the freeze verification below
```

**Candidate B = the revision frozen at the commit following this record.** A stays
immutable at `a4c0b747`.

## Why the freeze must precede TruckTrax pass 2

TruckTrax audits a production consumer against a candidate that could actually
ship. Run it against an unfrozen tree and later cleanup silently moves the thing
it validated. MATRIX-CLOSE supplies the boundary: six proven survivors, two
unjustified mechanisms deleted, residue removed or carried out explicitly, and
the verification set green.

# RESTORE-P0 — the reversal-validity cluster

Grouped because they are one defect family, not three bugs: **the recorded
inverse is valid at capture time, but unconditional replay later can violate
intervening state.** The engine knows _what effect belonged to the authored
operation_; what it does not ask is _is this authored effect still causally
applicable to the current truth?_

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
restoration _and_ diagnostic projections are both known.

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
blocking `constructor` and `prototype` as _literal data keys_ — which are
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
effect cannot know _"this value exists physically but is not yet eligible to
escape as a durable consequence"_ — SignalTree can. That is a genuine ownership
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
await withWriteContext({ intent: 'system', causalMode: 'realization' }, () => tree.load());
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

| #   | case                            | question                                                                              |
| --- | ------------------------------- | ------------------------------------------------------------------------------------- |
| 1   | hydrate a scalar                | can external storage establish initial truth without creating bogus authored history? |
| 2   | normal write                    | does persistence observe the settled value, or intermediate physical writes?          |
| 3   | transaction rollback            | is the rolled-back intermediate value ever persisted?                                 |
| 4   | time-travel undo                | is restored state meant to become durable, and when?                                  |
| 5   | debounce + immediate background | can the host force the latest value durable when lifecycle hooks never fire?          |
| 6   | storage write failure           | who owns the error; does state stay authoritative?                                    |
| 7   | destroy with a pending write    | drain, cancel, or an explicit host decision?                                          |
| 8   | SSR / no storage platform       | can the tree exist without a storage implementation?                                  |
| 9   | multiple persisted leaves       | does one drain require a tree-wide registry?                                          |
| 10  | custom adapter                  | does `./storage` provide anything SignalTree-specific beyond a key/value adapter?     |

**Case 3 may be A2's version of A1's discovery.** Persistence should be a
consequence of _committed_ truth. If the mechanism sees private intermediate
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

| job       | shipped `persistence()`                               |
| --------- | ----------------------------------------------------- |
| RESTORE   | `autoLoad` on construction, `load()`                  |
| PUBLISH   | debounced autoSave                                    |
| DRAIN     | **public `save()`** — plus `__flushAutoSave`          |
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
> transaction is open would persist speculative state — _the same defect
> `stored()` had, reached through a different API_.

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
_classify this incoming write as realization rather than authored action_; A2
needs _run this outgoing side effect only on committed truth_. Both are about
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
entailed is the `StorageAdapter` _contract_; the generic implementations and the
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
transaction case _better_ than `stored()` did. The earned seam is:

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
    flushAllStoredSignals(); // beat the ~100ms debounce window
  }
});
```

This confirms the hypothesis that `flushAllStoredSignals` is a shutdown drain
rather than a general-purpose API — and it adds a constraint that a
browser-only design would miss. **This is Capacitor on Android.** `pagehide`
does not fire when a native app backgrounds. A persistence capability that
owns its own lifecycle via `pagehide`/`visibilitychange` would silently lose
the last write on exactly the platform this consumer ships.

So the requirement is not "expose a global flush function". It is: _the
persistence capability must be drainable by a host that knows something the web
platform cannot tell it._ That could be a method on the capability, a
tree-level `flush()`, or a registered lifecycle adapter — but it cannot be an
internal `pagehide` listener alone.

## Semantic owner and lifetime

The individual leaf owns its key and value. The DRAIN is tree-scoped or
capability-scoped, because the host calls it once for everything.

## Open questions before a disposition

- Is the debounce (~100ms) part of the contract? The drain exists only because
  of it.
- Does anything need persisted _collections_, or only scalar leaves? No
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
what a branch _is_, where an attached behaviour would leave it ordinary state.

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

| case                  | supports a SignalTree primitive                                                     | argues against one                                     |
| --------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------ |
| optimistic mutation   | lifecycle unrepresentable by `transactions()` without losing semantics              | the transaction already owns pending/confirm/reject    |
| non-optimistic save   | the lifecycle must participate in SignalTree semantics _before_ state changes       | ordinary async/controller state handles it             |
| external async op     | some SignalTree-owned state or causal property is required despite no tree mutation | the lifecycle lives entirely outside SignalTree        |
| concurrent operations | SignalTree has a coherent identity/concurrency model the app needs                  | the single `status` slot collapses distinct operations |
| typed errors          | errors need durable or tree-owned semantics                                         | errors belong to the request/controller/UI layer       |

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

| site                    | job                                                 | case                    |
| ----------------------- | --------------------------------------------------- | ----------------------- |
| `ticket.save`           | POST create ticket                                  | non-optimistic mutation |
| `ticket.useLast`        | recall-most-recent request                          | non-optimistic mutation |
| `v3edge.capture`        | scale capture request                               | non-optimistic mutation |
| `v3edge.netWeight`      | ask backend to compute net weight                   | external async op       |
| `work/messages.loading` | message POST failure state                          | non-optimistic mutation |
| `work/tickets.loading`  | imperative load of a loader-less `entityMap`        | external async op       |
| `device.loading`        | request lifecycle beside a loader-backed collection | external async op       |
| `feature-flag.load`     | fetch flags, land them on a separate leaf           | external async op       |

## Finding 1 — NOT ONE SITE IS AN OPTIMISTIC MUTATION

This is the headline, and it settles the question the audit was opened to ask.
`transactions()` owns optimistic local mutation with rollback. **Zero of the
eight sites mutate local state before the server answers.** `netWeight` and
`feature-flag` are explicit about it — the result lands on a _separate_ leaf
(`netWeightResult`, `flags`) that is written only on success.

So the "transactions subsumes status" hypothesis is refuted by absence, not by
argument. Case 1 of the matrix has no production instances at all; every site is
case 2 or case 3. Renaming `status()` to `transactionStatus()` would have
overfitted a use case that does not occur here.

## Finding 2 — `loader` and `status` coexist WITHOUT overlapping

`messagesState()` declares both: a `loader()` on the `threads` collection, and a
`status()` named `loading` whose doc comment says it is send-failure state for
message _posts_. Different operations on the same slice. `work/tickets` is the
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
concluded: _workflow state is ordinary store truth; its predicates are ordinary
derived projections._

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

That a well-specified operation-lifecycle primitive _with_ operation identity
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
const fields = form(model, schema); // Angular Signal Forms
const undo = trackHistory(model, { capacity: 50 });
```

**C1 — can this compose?** Yes. Demonstrated by the greenfield spike, and the
demos already converted.

**C2 — what is missing from core to make it correct?** Exactly one thing, and it
is not new code.

## The one gap

| piece                                             | shipped in `15.0.0-rc.1`? |
| ------------------------------------------------- | ------------------------- |
| `toWritableSignal` — the seam                     | **yes**                   |
| Angular Signal Forms — validation, touched, dirty | external, fine            |
| `trackHistory` — undo/redo over a plain signal    | **implemented, WITHHELD** |

`trackHistory` lives at `core/src/lib/form-history/form-history.ts:206`, appears
zero times in the core barrel and zero times in the shipped `.d.ts`, and its
disposition reads "LC / mechanically retained after form deletion".

The _wording_ of that disposition is falsified. `trackHistory` was not
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
Object.fromEntries(this.slice.entities.map()); // v13
Object.fromEntries(this.slice.entities.asMap()); // v15
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

---

# SUBJECT-ADDRESS-0 — the whole-subject address is EARNED

`packages/core/src/lib/subject-address-0.spec.ts`

```text
NULL       a genuine causal event exists whose target is an existing subject AS
           A WHOLE, distinct from structural lifetime transitions, from
           collection-owner notifications, and from field mutations
FALSIFIER  no production event needs it
```

**The NULL SURVIVES.** My expectation went the other way and was wrong.

Instrumenting `deriveFieldPathFromRow`'s output across every entity operation at
both depths:

```text
TOP    updateOne  path=rows.seed       ownerPath=rows       coll=rows  FIELD=""
NESTED updateOne  path=data.rows.seed  ownerPath=data.rows  coll=data  FIELD="seed"
```

A top-level row update legitimately produces `''` — it addresses the WHOLE ROW,
not a field within it. So CASE A ("delete `''`") is falsified, and the answer to
the one sentence is:

> **A whole existing subject IS a realizable scalar target.**

⚠️ **The nested defect is worse than previously recorded.** It does not merely
derive the wrong collection — it FABRICATES A FIELD COORDINATE EQUAL TO THE
ENTITY KEY. `FIELD="seed"` claims the row has a field called `seed`.

⚠️ **Why this was invisible at top level.** The owner-only ping and a genuine
whole-row update produce the same derived output there — both `''`. The bogus one
is masked by a legitimate one.

So the disposition is CASE B: three states, represented explicitly.

```text
undefined     this event establishes NO subject address
whole         this event targets the entire current subject
field 'name'  this event targets a field within the current subject
```

⚠️ Do NOT resolve the DESCRIPTOR-ROLE-0 `''` disagreement by changing the falsy
test to `=== undefined`. That makes the inconsistency work without deciding
whether the state should exist — and it demonstrably should.

---

# DESCRIPTOR-MERGE-0 — the two descriptor levels have OPPOSITE policies

`packages/core/src/lib/descriptor-merge-0.spec.ts`

Driven directly through the exported `rememberTreeRealizationDescriptor`, so
these are the real production merge rules under controlled inputs.

```text
NULL       descriptor accumulation is monotonic in information
FALSIFIER  the two levels disagree, so which address survives depends on
           arrival order rather than information content
```

**The NULL IS FALSIFIED.**

```text
top-level descriptor      existing?.fieldPathFromRow ?? fieldPathFromRow
                          FIRST-WRITE-WINS
subjectDescriptors entry  unconditional overwrite when anything differs
                          LAST-WRITE-WINS
```

⚠️ And `''` is not nullish, so at the top level a whole-subject `''` written by a
weak early notification permanently blocks every later field address.

## This explains the DESCRIPTOR-ROLE-0 result

DESCRIPTOR-ROLE-0 measured that deleting both top-level copies changed nothing,
and recorded them as vestigial without an explanation. This is it: consumers read
`inline ?? subjectDescriptors[subjectId] ?? descriptor.<field>`, and the
per-subject entry is LAST-write-wins, so it is always current and permanently
shadows the frozen top-level copy. **Unread because unreachable, not because the
information is unnecessary.**

## ⚠️ WITHDRAWN — this does NOT explain the nested failure

This section originally claimed last-write-wins made the fabricated address win,
and that first-write-wins would have made nested rollback work by accident.
**SUBJECT-ADDRESS-CARDINALITY-0 falsified that** — see below. The merge
asymmetry is real; it is not the nested mechanism.

## ⚠️ AND THE PING NEEDS NO SUBJECT AT ALL

```text
if (structuralEffect) return undefined;
if (path === ownerPath) return '';                        <- returns here
if (typeof subjectId !== 'number' || ...) return undefined;
```

`''` is returned BEFORE `subjectId` is examined. An owner-only ping carrying NO
SUBJECT still establishes "the whole subject" as its address — which answers the
remaining SUBJECT-ADDRESS-0 case:

> The owner-only ping must establish NO subject address. Today it establishes the
> strongest address in the model, for a subject that does not exist.

In that one case nothing shadows it — there is no `subjectDescriptors` entry — so
the frozen top-level copy IS what consumers reach. The vestigial finding holds
for every case EXCEPT this one.

## Consequence for the pending correction

"Make descriptor writes monotonic in information" was underspecified: **neither**
current policy is monotonic. The correction must name a rule under which a weaker
notification cannot displace a stronger one **in either direction**, and the
three address states must be representable so that "no address" and "the whole
subject" cannot collide.

---

# SUBJECT-ADDRESS-CARDINALITY-0 — one retained slot IS sufficient

`packages/core/src/lib/subject-address-cardinality-0.spec.ts`

```text
NULL       within one causal/restoration frame a subject requires at most one
           ADDRESSLESS fallback coordinate
FALSIFIER  two effects for the SAME owner PositionId and SubjectId
           simultaneously require two different retained coordinates AND cannot
           be distinguished from the effects themselves
```

**The NULL SURVIVES — on the falsifier's second clause.**

Two different coordinates ARE simultaneously required. They are not _retained_,
because every effect that needs a field coordinate carries its own complete
inline address. Captured `ReversalEffect`s for a two-field update:

```text
EFFECT owner=2 subj=1 struct=undefined path=rows.r1.name    ownerPath=rows
EFFECT owner=2 subj=1 struct=undefined path=rows.r1.enabled ownerPath=rows
```

And at resolution the inline term wins every time:

```text
RESOLVE inlineField="name"    descField="" => field="name"
RESOLVE inlineField="enabled" descField="" => field="enabled"
```

⚠️ `descField=""` on both lines — present and unused. The single retained slot
holds **neither** of the two coordinates that were applied.

## The only addressless effects are structural

```text
EFFECT owner=2 subj=1 struct=rekey path=undefined ownerPath=undefined
```

And a structural effect needs a COLLECTION path, never a subject FIELD
coordinate. So the addressless case never contends for the slot.

> **`Map<SubjectId, one address>` is not the wrong data structure.** Field
> coordinates travel with their effects; the retained entry is a fallback for
> addressless effects, and those need only a collection.

Plan item 5's second branch ("if two legitimate coordinates can coexist, the map
is wrong") is therefore **not taken**. The first branch applies.

## ⚠️ TWO CORRECTIONS THIS FORCES

**1. DESCRIPTOR-MERGE-0's mechanism claim is withdrawn.** The descriptor is never
consulted for these effects — the inline term short-circuits the `??` chain
before either level is reached. Neither merge policy participates in the nested
failure. The measured merge asymmetry stands as a fact; its explanatory role does
not.

**2. The corrected nested mechanism is purely inline:**

```text
deriveCollectionPathFromEffect(path=data.rows.r1.name, ownerPath=data.rows)
  ownerPath.includes('.') -> parentPath('data.rows') -> 'data'
```

`data` is a branch, not a collection, so resolution bails at `isCollectionNode`
before a field coordinate is even considered. Nested probes produce no resolve
line at all, which is how this was located.

## ⚠️ AND THIS CHANGES WHERE THE REGISTRY RULE MUST BE REACHABLE

```ts
function deriveCollectionPathFromEffect(effect) {
  if (!hasInlineSubjectAddress(effect)) return undefined;
  return deriveCollectionPath(effect.path, effect.ownerPath, effect.subjectId, undefined);
}
```

**Inline is not an independent address.** It is the same two broken helpers
applied to the effect's own strings. So:

- Correcting the derivation corrects both paths at once — good.
- But `registry.collectionPathFor(positionId)` must be reachable from the
  **inline resolution path inside the adapter**, not only from descriptor capture
  in `rememberTreeRealizationDescriptor`. The adapter already closes over the
  tree, so this is reachable; it is called out because the plan's step 1 wording
  ("record at entityMap materialization") describes only the capture half.

`effect.owner` is the PositionId and is present on every effect, so the lookup
has its key at both sites.

---

# REAL-WHOLE-EFFECT-0 — WHOLE is NOT earned at the effect layer

`packages/core/src/lib/real-whole-effect-0.spec.ts`

```text
NULL       at least one real non-structural ReversalEffect requires
           WHOLE-subject scalar targeting
FALSIFIER  all real non-structural subject effects are FIELD-addressed; WHOLE
           exists only in descriptor/notification derivation
```

**The NULL IS FALSIFIED. OUTCOME A.**

Every `ReversalEffect` reaching `validateEffects` / `applyAtomically` captured
across the full matrix. **Not one non-structural effect addresses a whole
subject.** Every one is a field coordinate carrying a SCALAR before/after — never
a row object:

```text
updateOne 1 field   subj=1 path=rows.r1.n     before=number:99  after=number:1
updateOne 2 fields  subj=1 path=rows.r1.name  before=string:"X"
                    subj=1 path=rows.r1.n     before=number:99
replaceOne          path=rows.r1.name / rows.r1.n   (scalars)
upsertOne existing  subj=1 path=rows.r1.name / rows.r1.n
setAll replacing    subj=1 path=rows.r1.name / rows.r1.n
```

Every whole-entity-looking operation DECOMPOSES. Every lifetime transition is
structural and ADDRESSLESS:

```text
addOne / addMany / upsertOne new   struct=remove  path=undefined
removeOne / clear                  struct=add     path=undefined
changeId                           struct=rekey   path=undefined
```

## ⚠️ SUBJECT-ADDRESS-0 asked the right question at the WRONG LAYER

`''` is produced by descriptor/notification derivation, and that finding stands
as a fact about that layer. But no `ReversalEffect` ever needs it. The two layers
were conflated in that record; the effect layer is what the repair targets.

**So do NOT put WHOLE in the effect representation:**

```text
subject scalar effect   FIELD(path)
absence                 not a subject scalar effect / structural
```

No `{ kind: 'whole' }` on `ReversalEffect`. Subject effect identity becomes:

```text
owner PositionId  -> canonical collection (registry)
SubjectId         -> current entity lifetime / key
fieldPath         -> coordinate inside the entity
```

with `structuralContext` handling existence, membership and rekey.

The permanent test asserts the observable consequence: a sibling field written
OUTSIDE the transaction survives rollback of a field written inside it. A single
whole-row effect would clobber it.

---

# ⚠️ REPLACE-ONE-SUBJECT-0 — a SEPARATE P0, and it is TOP-LEVEL

`packages/core/src/lib/replace-one-subject-0.spec.ts`

Found by the traffic inventory above, not sought. `replaceOne` emits reversal
effects with **no SubjectId**, while the operations either side of it emit one:

```text
upsertOne existing  subj=1          path=rows.r1.name / rows.r1.n
setAll replacing    subj=1          path=rows.r1.name / rows.r1.n
replaceOne          subj=undefined  path=rows.r1.name / rows.r1.n   <- HERE
```

All three are the same semantic operation and decompose identically. Only
`replaceOne` drops subject identity, and it fails:

```text
transaction rollback  "SignalTree could not rollback the pending transaction"
undoable() + undo     "Unsupported scoped undo effect at structural-drift"
```

⚠️ **This is a TOP-LEVEL failure.** Every previously recorded rollback defect in
this class is nested-only, and all five expected failures are nested — so this is
not covered by them. It is also not the inline collection derivation, which is
correct at top level. The mechanism is upstream: with no SubjectId,
`hasInlineSubjectAddress` is false, so no inline subject address is derived and
no fallback descriptor can be keyed.

**Recorded, NOT fixed** — a distinct defect found while answering a different
question, and fixing it inside the address repair would confound both. The spec
pins current behaviour with `upsertOne` as the control; when `replaceOne` is
repaired those tests fail, and that failure is the intended signal.

## Correction to the previous summary

"Every blocking question is now closed" was wrong on two counts: REAL-WHOLE-EFFECT-0
was open and has now flipped the planned representation, and this defect was not
known at all.

---

# ADDRESS-REPAIR-1 — the production correction

`packages/core/src/lib/address-repair-1.spec.ts`

> **Ask the registry for the owner position's canonical collection address.
> Never read `ownerPath`'s shape.**

The collection PositionId and its address are BOTH known at entityMap
materialization, so they are recorded there. Everything downstream asks:

```text
path === collection        owner-only notification  -> NO address
collection + 1 segment     the row itself           -> whole
collection + 2+ segments   a field within the row   -> field(rest)
```

The derivation is explicit — `undefined | {kind:'whole'} | {kind:'field'}` — and
the entity-key segment is CONSUMED as addressing rather than returned as a
coordinate, which makes `FIELD="seed"` unrepresentable rather than merely
avoided.

## Reached from BOTH call sites

SUBJECT-ADDRESS-CARDINALITY-0 showed the INLINE path is the one that mattered,
so `collectionPathFor` is reachable from `deriveCollectionPathFromEffect` /
`deriveFieldPathFromEffect` as well as from `rememberTreeRealizationDescriptor`.
Threading uses the `tree` each resolver already receives — no new plumbing, and
no `visitTree()` added to capture or replay.

## Legacy branch preserved BY CONSTRUCTION

Synthetic adapter/rekey callers never materialized an entityMap, so
`collectionPathFor` returns `undefined` and the legacy string interpretation
runs. REALIZATION-TARGET-ROLE-1 measured that those cases legitimately use a
ROW-shaped `ownerPath`; they keep their meaning without a special case.

## Result

```text
before   2134 passing, 5 expected fail
after    2153 passing, 0 expected fail
```

Closed: nested `addOne` / `addMany` / `updateOne` / `upsertOne`, nested
collection rollback (LINK-COLLECTION-0), the SUBJECT-ADDRESS-0 nested round-trip.

⚠️ **`REPLACE-ONE-SUBJECT-0` still fails, deliberately.** It is the CONTROL for
this commit — that defect drops `SubjectId` at the mutation producer, upstream of
address derivation, so a correct address repair must not fix it. It did not.

## Mutation proof — six mutants, six distinct kill sets

```text
A  registry registration removed        15 failures / 4 files
B  owner ping manufactures WHOLE         1 failure  / 1 file
C  entity key retained as coordinate     63 failures / 21 files
D  inline precedence broken               6 failures / 4 files
E  collection derived from path shape    13 failures / 4 files
F  ownerId removed from value-less ping  13 failures / 4 files
```

## ⚠️ MUTATION B INITIALLY KILLED NOTHING — reported, not papered over

Making the owner ping return `whole` broke zero tests across the whole suite.
That is a measured reachability fact, not a coverage gap:

```text
SUBJECT-ADDRESS-CARDINALITY-0   every real effect carries an inline address,
                                and the inline term wins
REAL-WHOLE-EFFECT-0             no non-structural effect needs whole; every
                                structural effect skips field derivation
```

Together those make the descriptor's subject coordinate **unreachable for real
production traffic**, so a bogus `''` in it changes nothing observable today.

> **Owner-only ping → no subject address is an ENFORCED CONSTRUCTION INVARIANT,
> not a currently user-observable failure path.**

The derivation-boundary mutant proves the invariant is encoded; `replaceOne`
demonstrates why keeping it matters if an addressless non-structural effect ever
reaches fallback. B must NOT be described as closing a presently manifested
runtime defect. It is still worth having — the fallback
becomes reachable the moment an addressless non-structural effect appears, and
REPLACE-ONE-SUBJECT-0 is already a defect of exactly that shape. The contract is
therefore pinned at the derivation boundary (via the exported
`rememberTreeRealizationDescriptor`), which does kill mutation B.

## ⚠️ What ADDRESS-REPAIR-1 did NOT do

The STORAGE encoding is still `string | undefined` with `''` meaning whole,
converted at one place (`encodeSubjectAddress`). DESCRIPTOR-ROLE-0's `''`
disagreement between `canResolvePreparedSubjectTarget` (falsy → no path) and
`assignPreparedSubjectValue` (whole subject) SURVIVES. It is safe only because
the derivation no longer produces `''` for anything meaning "no address".

Migrating the stored shape is a representation change, not a correctness fix, and
is deliberately left out of this commit. DESCRIPTOR-MERGE-0's order-dependent
two-level merge is likewise untouched and still open.

---

# REPLACE-ONE-SUBJECT-1 — the producer boundary repair

`packages/core/src/lib/replace-one-subject-1.spec.ts`

```text
NULL       replaceOne already knows the SubjectId and merely fails to propagate
           it through the channel upsertOne / setAll use
FALSIFIER  it lacks the identity at its producer boundary and needs a new lookup
```

**The NULL SURVIVES.** `replaceOne` resolves
`structuralStore.subjectIdForKey(id)` and THROWS if it is missing — it has had
the identity all along. It then passed `undefined` to `pathNotifier.notify`'s
`subjectIds` parameter:

```text
entity-signal.ts   updateOne    subjectIdsForWrite      ✓
                   updateMany   [subjectIdsForWrite[i]] ✓
                   removeOne    subjectIdsForWrite      ✓
                   replaceOne   undefined               ✗  <- the only one
```

The repair is that one argument. No new lookup, no path parsing, no
key-as-identity fallback, no realization-adapter special case — which the
standing instruction explicitly ruled out, since inferring the subject from the
path would recreate the identity-from-strings problem ADDRESS-REPAIR-1 removed.

## The replacement object's `id` is DATA, not identity

The existing contract is explicit and is PRESERVED:

> "The id comes from the caller on purpose. A `setOne` deriving it via
> `selectId(entity)` writes to whatever slot the entity's own id field names —
> and `changeId` can leave `entity.id` disagreeing with the storage key."

`replaceOne` is deliberately NOT a rekey, and this fix does not make it one.

## Mutation proof — one mutant, exactly the intended kill set

Removing ONLY the new propagation:

```text
KILLED   replaceOne TOP transaction rollback
         replaceOne TOP undo
         replaceOne NESTED transaction rollback
         replaceOne NESTED undo
         rekey -> current-key discriminator
         rekey inside the transaction

GREEN    upsertOne(existing)
         setAll(existing)
         ordinary updateOne
         every ADDRESS-REPAIR-1 nested battery
```

Six failures, all in one file. A broader kill set would have meant the fix was
placed too broadly.

```text
before   2153 passing
after    2160 passing
```

---

# CORRECTNESS-DEFECT LEDGER

⚠️ **"Zero expected failures" is NOT sufficient evidence of correctness.**
REPLACE-ONE-SUBJECT-0 demonstrated why: a permanent test can PASS while pinning
known-broken behaviour, so the suite counted five expected failures while six
defects existed. Keep this ledger alongside the raw counts through Candidate B.

```text
ADDRESS-REPAIR-1        CLOSED   aff7e6a6
REPLACE-ONE-SUBJECT-1   CLOSED   this commit

known correctness defects = 0
zero expected-fails representing correctness defects
zero passing "known broken behavior" pins awaiting inversion
```

Still OPEN as measured representation/fallback issues, deliberately not
correctness defects:

```text
DESCRIPTOR-ROLE-0    '' falsy at one consumer, whole-subject at another
DESCRIPTOR-MERGE-0   two levels, opposite policies, arrival-order dependent
                     top-level copies: "candidate redundant after semantic
                     repair" — removal mutation not yet re-run
```

---

# DESCRIPTOR-TOPLEVEL-RECHECK-0 — the copies are PROVEN redundant

Measurement only. No production change.

## Why the earlier result needed re-running

DESCRIPTOR-ROLE-0 removed the top-level `collectionPath` / `fieldPathFromRow`
fallbacks and the suite was unchanged — but that was **confounded**. The
owner-only ping could manufacture a top-level whole-subject address, and
DESCRIPTOR-MERGE-0 later showed the no-subject case was the ONE path where the
top-level value was actually reachable (nothing shadows it, because there is no
`subjectDescriptors` entry to shadow with).

ADDRESS-REPAIR-1 repaired that producer boundary: an owner-only notification now
establishes no subject address at all. So the measurement was re-run against
`aff7e6a6 + d50ae108`, with no Link code in the equation.

## The mutation

The STRONG form — all six top-level reads removed, not only the fallback-position
ones:

```text
resolveCollectionPath          descriptor?.collectionPath      (primary read)
resolveSubjectFieldPath        descriptor?.fieldPathFromRow
resolveCurrentSubjectTarget    descriptor?.collectionPath
                               descriptor?.fieldPathFromRow
resolveNotifyPath              descriptor?.collectionPath
                               descriptor?.fieldPathFromRow
```

## RESULT — OUTCOME A, and it is now unconfounded

```text
2159 passing, 1 failed
```

The single failure is DESCRIPTOR-ROLE-0's own SOURCE-TEXT inventory
(`expect(ADAPTER).toContain('descriptor?.collectionPath ??')`), which exists to
detect exactly this shape change. **No behavioural test depends on the top-level
copies.**

> **Top-level subject-address copies are not fallback authority.** The inline
> effect address, the per-subject entry, and the structural machinery supply all
> required realization data.

This closes the DESCRIPTOR-MERGE-0 sub-question. The status moves from
"candidate redundant after semantic repair" to **proven redundant**.

## ⚠️ DELIBERATELY NOT DELETED

Deleting two fields now buys almost nothing and would add a production commit
immediately before Link. These are one coherent representation-cleanup problem:

```text
remove redundant top-level copies
eliminate the duplicated / opposite-direction merge policy
resolve the '' representation disagreement
```

Filed as representation debt, not a correctness defect, and not a release
blocker. HEAD restored; proceeding to LINK-COLLECTION-TYPE-0.

---

# LINK-COLLECTION-TYPE-0 — the NULL is falsified at the SOURCE

`packages/core/src/lib/link-collection-type-0.typing.spec.ts` (compile-time)
`packages/core/src/lib/link-collection-type-0.spec.ts` (runtime companion)

```text
NULL       the existing Link typing machinery can infer a collection node's
           natural value as Row[] across every endpoint combination, without a
           collection-specific public API
FALSIFIER  at least one legitimate endpoint shape cannot
```

**FALSIFIED — and not for the reason the matrix was designed to find.**

It is not endpoint variance, overload ordering, or subscribe generics. The
existing target union does not admit a collection node at all:

```text
tree.$.rows()                                   NOT callable        (correct)
NodeAccessor<T> | WritableSignal<T> admits it?  NO

Argument of type 'EntitySignal<Row, string>' is not assignable to
parameter of type 'LinkTarget<unknown>'
```

So `link(tree.$.rows, ...)` does not type-check today and inference never reaches
the endpoint. All seven cells fail for one upstream reason.

> **node access shape != linked value shape.** A collection node is deliberately
> non-callable, and that must not deny it a natural value.

## The correction — one conditional branch, no public API expansion

No `linkCollection()`, no `collection: true`, no `mode`, no required
`link<Row[]>`:

```ts
type NaturalValue<S> = S extends EntitySignal<infer R, infer _K> ? R[] : S extends NodeAccessor<infer T> ? T : S extends WritableSignal<infer T> ? T : never;

declare function link<S>(source: S, endpoint: Endpoint<NaturalValue<S>>): void;
```

Making `link` generic over the SOURCE is what lets contextual typing flow into
the endpoint callbacks. Every callback in the spec is UNANNOTATED and every
assertion is `Exact<>` — an annotated `(value: Row[])` would prove only that an
annotated callback compiles, which is strictly weaker.

## Result — all seven cells, both `get` forms, all controls

```text
get / set / subscribe / get+set / get+subscribe / set+subscribe / all three
sync get and async get, no separate overload
scalar control      tree.$.count    -> number
object control      tree.$.settings -> { theme: string }
negatives           wrong get, wrong subscribe emission, wrong set,
                    scalar endpoint given Row[], Row-field access inside set
shape pins          tree.$.rows() rejected; rows.all() is Row[]
```

## ⚠️ A measurement that corrected me mid-probe

I expected the naive wrong-`set` negative to be swallowed by parameter
bivariance. It is NOT: `set` is a PROPERTY with a function type, not a method
shorthand, so `strictFunctionTypes` checks it contravariantly. Recorded because
the opposite belief would have justified a weaker negative control.

## Type mutation proof — five mutants, narrow distinct kill sets

```text
A  natural value -> the node type          14 errors, collection cells
B  natural value -> Row (not Row[])        14 errors, collection cells
C  collection branch removed                15 errors; scalar (186) and object
                                            (192) controls stay GREEN
D  broad "non-callable => array" rule        1 error — the ORDINARY-OBJECT
                                            control, and nothing else
E  subscribe generic decoupled from T        5 errors — the four subscribe cells
                                            plus its now-unused negative;
                                            get/set survive
```

⚠️ **D is the important one.** A broad rule satisfies every collection cell while
silently breaking ordinary objects, and it kills exactly one assertion — the
control that exists for it. C leaving both controls green proves the branch is
scoped to collections rather than widening the extractor.

## Runtime companion

```text
outbound   rows.all()          -> Row[] crosses the endpoint
inbound    Row[] -> rows.setAll(value), REPLACEMENT not append
empty      [] empties the collection (the append control)
shape      the node is not callable at runtime either
```

Deliberately small; LINK-COLLECTION-0 remains the full runtime battery.

```text
before   2160 passing
after    2164 passing
```

**No production typing change made yet** — the extractor is proven as a candidate
in the typing spec. It lands with production `link()`, which is next.

---

# LINK-MATERIALIZED-VALUE-0 — FALSIFIED, and NOT root-specific

`packages/core/src/lib/link-materialized-value-0.typing.spec.ts` (compile-time)
`packages/core/src/lib/link-materialized-value-0.spec.ts` (runtime)

```text
NULL       callable root/branch natural values already have a public type that
           truthfully matches their materialized runtime value
FALSIFIER  a callable source containing entityMap state exposes EntityMapBuilder
           in its declared value type while runtime natural state differs
```

**FALSIFIED.**

```text
cell       TYPE today                            RUNTIME read
A count    number                                1                          ✓
B rows     Row[]                                 Row[] via all()            ✓
C nested   { label, users: EntityMapBuilder }    { label, users:{all:[]} }  ✗
D root     EntityMapBuilder in 2 positions       { all: [] } in both        ✗
E plain    { a: number; b: string }              { a, b }                   ✓
```

## ⚠️ THE DECISIVE RESULT — the nested branch is as broken as the root

`tree.$.nested` has the IDENTICAL defect, and `tree.$.plain` is fine. So:

> **The problem is RECURSIVE MATERIALIZATION, not root identity.**

A policy phrased as "exclude the root" would measure the wrong thing.

## The type matches NEITHER side

```text
declared   EntityMapBuilder<User, string, ...>    the construction marker
read       { all: User[] }
write      { all: User[] }  OR  User[]
```

Same category as LINK-COLLECTION-TYPE-0, one level up:

> **construction marker type != synchronized runtime state type**

## `{ all: T[] }` is DESIGNED, not an artifact

The live node has 32 own enumerable keys; the snapshot has exactly one. And
`applyState` has an explicit branch for it:

```ts
typeof stateNode.setAll === 'function' && Array.isArray(snapshot.all)
  -> stateNode.setAll(snapshot.all)
```

It is the serialization / devtools / restore representation.

## The round trip IS coherent — so this is NOT outcome 3

Read a branch, write it straight back, state is preserved: the write side accepts
both shapes. A full-state contract EXISTS at runtime.

⚠️ But read and write are ASYMMETRIC — read gives `{ all: T[] }`, write accepts
`{ all: T[] } | T[]`. Link synchronizes complete X with complete Y, so an
endpoint would RECEIVE an internal snapshot representation and be allowed to SEND
either shape. That is not something userland should have to speak.

## Disposition — outcome 2, and it WIDENS the earlier plan

```text
TRUTHFUL, admit      owned scalar leaf
                     entity collection    (read all() / write setAll())
                     ordinary branch with NO collection in its state

UNTRUTHFUL, exclude  any callable source whose declared state CONTAINS an
                     entityMap marker — the root of any tree that has a
                     collection, AND any branch containing one
```

Measured as exactly expressible in the type system, with no recursive
materialization machinery:

```ts
type ContainsMarker<T> = T extends EntityMapBuilder<...> ? true
  : T extends object
    ? true extends { [K in keyof T]: ContainsMarker<T[K]> }[keyof T] ? true : false
    : false;
```

⚠️ **Recorded, NOT implemented.** Excluding a public Link target is a
public-surface decision. The standing authorization was to exclude _the root_
rather than invent machinery; the measurement shows the truthful rule is broader
than that, which is new information and wants confirmation before it lands.

⚠️ The typing spec pins the untruthful cells POSITIVELY, so a future
materialization fix fails there and forces this record to be revisited rather
than going stale.

```text
before   2164 passing
after    2171 passing
```

## ⚠️ ONE UNREPRODUCED SUITE FAILURE — reported, not resolved

One run showed `2170 passed | 1 failed`. I did not capture the log for that run,
so the test is unidentified. Six subsequent runs are clean, three of them with
`--skip-nx-cache` to rule out cached results.

Recorded rather than dismissed: an intermittent at roughly 1-in-7 is worth
watching, and the procedural lesson is that suite runs whose output is piped
through `grep` lose the failure detail that identifies it.

---

# FLAKE-HUNT-0 — the intermittent is IDENTIFIED

Bounded hunt: 10 uncached runs with full logs retained, stop on first failure.
All 10 clean.

⚠️ **But the culprit surfaced anyway, during the Link port.**

```text
entity-granular-reactivity.spec.ts
  "a single-entity update does not rebuild the collection"
  expect(perUpdate).toBeLessThan(0.05)   measured 0.082
```

A wall-clock assertion. It passed 6/6 in isolation immediately afterwards and
has failed once under full-suite load — the same signature as the earlier
unidentified failure (one test, unreproducible, no state change).

**So the flake is a machine-speed-dependent timing bound, not a correctness
defect.** It belongs to the already-filed performance-proof work: replace fragile
single-best timing with warmup plus a robust statistic. Not fixed here — that is
a separate change and folding it into the Link commit would confound both.

---

# PRODUCTION `link()` — shipped

`packages/core/src/lib/link.ts`

```ts
const connection = link(source, endpoint);
await connection.retrieve();
await connection.settled();
connection.dispose();
```

Source-driven `NaturalValue<S>`, marker-based truthful-source admission, and the
three-member handle. No `linkCollection()`, no mode flag, no required generic, no
`afterCommit`/`onCommitted`, no public settlement hooks.

## Admission — TYPE TRUTHFULNESS, not topology

```text
ADMIT    tree.$.count      number
         tree.$.rows       Row[]
         tree.$.nested.users   User[]   (the escape hatch for a bad enclosure)
         tree.$.plain      { a, b }
         a root with NO collection anywhere

REJECT   tree.$.nested     contains an EntityMapBuilder
         a root WITH a collection
```

⚠️ Rejection is at the SOURCE parameter, not by collapsing the endpoint value —
proven with two negatives that would otherwise slip through: a subscribe-only
endpoint and an empty one, neither of which contributes inference.

## ⚠️ FOUR EARNED SEMANTICS THE PORT CAUGHT

Running the permanent batteries against production found four gaps in my first
implementation. Each was a contract a battery had already earned:

```text
DEMARCATION-0   an EMPTY endpoint must be REFUSED, not silently inert
LINK-HANDLE-0   settled() is STRONG, not `await chain` — the weak form means
                only "the chain I can currently see is drained" and misses
                observations HELD behind settlement
LINK-HANDLE-0   held observations are WAITERS, not a counter — a macrotask
                settlement is invisible to a microtask poll
LINK-2 case 3   a rejected send reaches the EXISTING central reporter, so the
                handle needs no error member
```

**This is exactly why the batteries are ported rather than trusted.** A local
harness that agrees with itself proves nothing about what ships.

## ⚠️ TWO BATTERY CONFLICTS, RESOLVED IN FAVOUR OF THE LATER CONTRACT

```text
LINK-HANDLE-0   settled() THROWS the last failure
LINK-2 case 3   errors go to onTreeError; settled() does NOT throw
```

LINK-2 is the public-contract battery and explicitly retires the earlier
mechanism — "the harness's `failures` array in LINK-1 was a test convenience and
is gone". Production reports centrally and `settled()` does not throw. LINK-1
case 6's two tests were moved onto `onTreeError`; the SEMANTIC is unchanged, only
where it is observed.

```text
LINK-2   expect(l.linkId).toMatch(/^link#/)
```

`linkId` was a REFERENCE-HARNESS artifact and is not on the shipped handle.
⚠️ Adding it to satisfy the test would have grown the public surface for a test
rather than a demonstrated need, so the assertion now states the case's actual
point — each single-direction endpoint constructs a usable link — and pins that
`linkId` is ABSENT.

## `TreeErrorSource` gains `'link'`

⚠️ This MOVES the ERROR-SURFACE-0 finding rather than closing it. `link.ts` is
the third reporter and the first wired to something NOT being retired. The
taxonomy still needs disposition before `onTreeError` is exported, and it now has
a member a consumer would see.

## Batteries running against production

```text
LINK-1  LINK-2  LINK-COLLECTION-0  DEMARCATION-0
```

⚠️ `LINK-HANDLE-0`, `LINK-HANDLE-1` and `LINK-ECHO-1` keep their local harnesses
DELIBERATELY: each takes a `mode` parameter and exists to CONTRAST two candidate
semantics. Their parameterization is the experiment, and collapsing them onto the
single shipped behaviour would delete the comparison that chose it.

```text
before   2171 passing
after    2171 passing (+ link.ts, + admission typing spec)
```

---

# PRODUCTION-LINK-CONFORMANCE-0 — what actually SHIPS

`packages/core/src/lib/production-link-conformance-0.spec.ts`

⚠️ **Preserving the comparison harnesses is not the same as proving the chosen
semantics in production.** `LINK-HANDLE-0/1` and `LINK-ECHO-1` keep their `mode`
parameters because they explain WHY a side won. But a winning candidate asserted
only against a local harness is not evidence about the shipped function.

## ⚠️ THE PREDICTION WAS RIGHT — and the gap was wider

Against `c3d79be0`, **five of nine failed**:

```text
settled() does NOT resolve while an in-flight retrieve is pending   FAIL
stays pending through outbound work FOLLOWING the acquisition       FAIL
a retrieve started after settled() began still holds it open        FAIL
dispose() releases a settled() waiting on a pending retrieve        FAIL
a held consequence delays settled() — STRONG                        FAIL
```

## P0 — retrieve participates in settlement (LINK-HANDLE-1: INCLUDED)

Production had no registration of retrieval as link-owned pending work:

```ts
const seq = ++inboundSeq;
acquire(await endpoint.get(), seq);
```

`INCLUDED` is what LINK-HANDLE-1 chose, and its default. The recorded reason is
that an EXCLUDED `retrieve()` can MUTATE X after `settled()` has returned —
misleading in exactly the way the WEAK outbound reading was. Having its own
promise is not sufficient to exclude it.

Fixed with waiters, not a counter, and released in `finally` so a rejected
`get()` cannot wedge every future `settled()`. Retrieval is drained BEFORE the
held set, because an acquisition can enqueue outbound work.

## ⚠️ TWO OF MY FIVE FAILURES WERE THE TEST'S FAULT, NOT PRODUCTION'S

Both were caught by taking the failure seriously instead of changing production
to satisfy it:

```text
"a held consequence delays settled()"
  I called settled() in the SAME TICK as the write, before any flush. No
  observation had reached the settlement authority yet, so this tested a
  STRONGER contract than LINK-HANDLE-0 earned. Its shape is a TRANSACTION plus
  `await flush()` — held, waiting, nothing on the chain.

"stays pending through the work the acquisition CAUSES"
  I assumed the acquired value produces an outbound send. It does NOT: inbound
  acquisition is ECHO SUPPRESSED, so `set` is never called for it. The earned
  shape is an AUTHORED WRITE after the retrieval.
```

Production was right about both. Only the retrieve-participation failures were
real defects.

## Mutation — removing retrieval registration

```text
KILLED  settled() during a pending retrieve
        retrieve started after settled() began
        disposal releasing a retrieval waiter

GREEN   ordinary outbound-only settlement
        held-consequence settlement
        echo suppression
        outbound reconciliation
        the error contract
```

Three failures, all in the conformance file. The new mechanism is earned
cleanly.

## Public-surface trim

`NaturalValue` is no longer re-exported from the package root. It is
type-inference machinery — `link(source, endpoint)` infers without the caller
ever naming it — and no third-party authoring need has earned the symbol. It
stays exported from `link.ts` for declaration emit.

```text
before   2171 passing
after    2180 passing
```

## ⚠️ STATUS CORRECTION

`c3d79be0` means production `link()` has **LANDED**, not that it ships. Its
contract is not frozen while ERROR-SURFACE-1 is open.

---

# ERROR-SURFACE-1 — OUTCOME B. The event is not yet a public contract.

`packages/core/src/lib/error-surface-1.spec.ts`

```text
NULL       the existing reporter can become the v15 generic public
           error-observation mechanism with a small, truthful, stable event
FALSIFIER  it cannot identify which tree emitted an otherwise identical error;
           or the taxonomy would freeze obsolete categories
```

**FALSIFIED on both counts.**

## ⚠️ 1. Two same-shaped trees are INDISTINGUISHABLE

Two independent trees, both linked, both endpoints failing identically:

```text
{ source: 'link', operation: 'link:set', error: Error('endpoint down') }
{ source: 'link', operation: 'link:set', error: Error('endpoint down') }
```

Byte-identical on every public fact. A listener wired to logging, Sentry or
recovery routing cannot tell A from B.

⚠️ **This is the SAME lesson NOTIFIER-SCOPE-0 and OWNER-PING-0 already cost us,
arriving in diagnostics.** Two same-shaped trees give their positions the same
local ids by design, and `settings.theme` names a location in both. The reporter
carries no owner at all — not even the `ownerId` the notifier ownership
invariant already requires of _every notification_.

`path` is absent too, though `ownerPath` IS known at the Link reporting site.

## ⚠️ 2. The taxonomy is mostly UNPRODUCED and mostly RETIRING

```text
member          live producer?   status
stored          YES              RETIRING
async-source    YES              RETIRING
link            YES              keeps
async-query     NO               no producer
entity-loader   NO               no producer
persistence     NO               no producer
effect          NO               no producer
```

Seven members, three producers, **one producer not scheduled for deletion**.
Exporting this union would freeze `'stored'` and `'async-source'` as permanent
public strings naming APIs v15 is removing — migration debt becoming API.

And `source` duplicates `operation` for the surviving member:

```text
source = 'link'    operation = 'link:set'
```

So `source` is not obviously earned as public information even there.

## What DID hold — the mechanism is repairable, not wrong

```text
one failure -> listener invoked exactly once          ✓
a throwing listener damages neither link nor peers    ✓
unsubscribe is clean                                  ✓
reporting with no listeners is harmless               ✓
multiple listeners are independent                    ✓
failed send: X stays authored, queue usable,
             settled() RESOLVES per LINK-2            ✓
```

## Disposition — recorded, NOT fixed, NOT exported

```text
MISSING   owner attribution, without which a process-global observer cannot
          route or attribute anything in a multi-tree application
UNEARNED  a 7-member source union, 4/7 unproduced, 2 of 3 live producers
          retiring, surviving member duplicating `operation`
```

⚠️ Adding owner attribution is a real change with its own question — WHICH stable
tree identity, given PositionIds are deliberately tree-local and must not become
public global identity. That is a decision, not a measurement, and it is left to
be taken rather than assumed here.

## ⚠️ WORDING RULE, now enforced in `link.ts`

Until this closes:

> **Link reports rejected outbound sends to SignalTree's INTERNAL error
> reporter.**

NOT "Link failures are publicly observable". `onTreeError` is not exported —
asserted permanently by this battery against `index.ts`.

## Consequence for the Link freeze

Public Link CANNOT be frozen yet. Its failure contract points at a channel users
cannot reach, so one of two things must happen first:

```text
A  repair the event (owner attribution + a truthful minimal shape), then export
B  reopen where automatic Link egress failure becomes publicly observable
```

The measurement supports A being achievable — every delivery semantic holds and
only the EVENT is deficient — but it does not authorize it.

```text
before   2180 passing
after    2190 passing
```

---

# ERROR-OWNER-IDENTITY-0 — falsified by ONE producer, and it is retiring

`packages/core/src/lib/error-owner-identity-0.spec.ts`

```text
NULL       the PositionRegistry identity already used to isolate notifications
           is unique across live trees, stable for a tree's lifetime, available
           at EVERY live error producer, not a PositionId, not path-derived
FALSIFIER  at least one live producer cannot obtain it without traversal,
           global lookup, or inventing another registry
```

**FALSIFIED — by exactly one producer.**

```text
producer       tree identity            path                    status
link           registry.id          ✓   getOwnedOwnerPath(x) ✓  KEEPS
stored         ownerRegistry.id     ✓   `key`                ✓  RETIRING
async-source   NONE                 ✗   NONE                 ✗  RETIRING
```

`createAsyncSourceSignal(marker)` takes **only the marker** — no materialization
context, no path, no registry. It cannot attribute an error without new
plumbing, which is the falsifier's clause exactly.

## The token's required properties are ALREADY TRUE — measured, not assumed

```text
unique across simultaneously live trees   ✓  even same-shaped ones
stable for one tree's lifetime            ✓  across writes, structure, rekey
NOT a PositionId                          ✓  two trees SHARE position ids
NOT derived from path                     ✓  same path, different trees
```

⚠️ The third line is why this cannot be solved with a PositionId. Two
same-shaped trees deliberately give their positions the SAME local ids — a
designed falsifier elsewhere (NOTIFIER-OWNERSHIP), and exactly what makes
PositionId unusable as public attribution.

## Disposition — do NOT weaken the event for a retiring API

The tempting move is `treeId?: TreeId` so `async-source` can omit it. That would
freeze an optional-attribution wart into v15 **permanently, to accommodate an API
v15 is deleting** — the same "migration debt becoming API" failure
ERROR-SURFACE-1 rejected for the `source` union.

```text
OPTION 1   plumb context into createAsyncSourceSignal, then export with
           treeId REQUIRED
OPTION 2   export the reporter AFTER async-source is removed, with treeId
           REQUIRED from the start
```

Both keep `treeId` required. ⚠️ Recorded, NOT implemented — the choice depends on
migration sequencing, which is a decision rather than a measurement.

## The identity model this preserves

```text
TreeId      the owning LIVE TREE / namespace   (opaque, runtime-local)
PositionId  a causal position INSIDE that tree
SubjectId   an entity lifetime inside collection ownership
path        human / diagnostic location, never identity
```

⚠️ `TreeId` is CORRELATION ONLY — "event A came from tree X, event B from tree
Y". Not persistence, not state addressing, not restoration, not cross-process
identity. The name is deliberately not `ownerId`, which already carries
causal/runtime meaning internally.

## Decisions taken (pending implementation)

```text
DROP     `source` from the public contract — 7 values, 4 unproduced, 2 of 3
         live producers retiring, survivor duplicates `operation`
KEEP     `operation` as `string`, NOT a frozen union — useful diagnostics, but
         an enumerated forever-vocabulary is unearned
ADD      `path` where the producer knows it — Link knows `ownerPath`, so its
         current omission is needless information loss
NEVER    export `reportTreeError`, `TreeErrorSource`, the listener registry, or
         `clearTreeErrorListenersForTesting`
NEVER    add anything to `Link` — no onError, status, failures, error signal,
         or rejection from `settled()`
```

```text
before   2190 passing
after    2197 passing
```

---

# ASYNC-SOURCE-RETIRE-0 — the inventory, and TWO plan-changing measurements

`packages/core/src/lib/async-source-retire-0.spec.ts`

The directive was to carve `asyncSource` retirement out as a NARROW prerequisite.
The inventory says it is not narrow — and separately says retiring it may not be
what unblocks the error event at all.

## ⚠️ 1. RETIREMENT IS NOT NARROW — ~95 files

```text
core source (non-spec)   15   signal-tree, types, utils, readonly,
                              readonly-readers, serialization,
                              materialize-markers, entity-map, index, ...
core specs               ~14
demo app                 ~8   routes, navigation, examples config, components
tools / release gates      5   verify-gates, check-rc-public-dispositions,
                              check-contract-neutrality, check-bundle-budget,
                              bench-ssr-payload
docs / rfcs / audits     ~50
```

`asyncSource` is PUBLICLY EXPORTED via `markers/index.ts`, so removal is a
breaking public change with demo, gate and documentation consequences. **That is
the migration phase, not a prerequisite to it.**

⚠️ Good news: `async-query.ts` does NOT depend on it — the single reference is a
comment describing a shape. Retirement does not cascade into the other async
primitive.

## ⚠️ 2. ITS CENTRAL REPORTING IS ALREADY INCOMPLETE — 1 of 3 failure paths

This is the measurement that matters, because the ONLY reason `asyncSource`
blocks ERROR-SURFACE-2 is that it is a reporter producer that cannot supply
`treeId`.

```text
errorSignal.set(err)     3 failure paths   sync throw, observable error,
                                           promise rejection
reportTreeError(...)     1 failure path    the SYNC THROW only
```

An application observing `asyncSource` through the central reporter today sees
**one of its three failure modes**. The surface that carries all of them is the
marker's own public signal, `readonly error: Signal<unknown | null>`.

⚠️ **That reframes the blocker.** `asyncSource`'s central report is not a coherent
observability guarantee that retirement would remove — it is a partial one that
never covered the async paths, sitting beside a complete local one.

## The third option the measurement supports

```text
OPTION 1  plumb ownership context into async-source   spends architecture on a
                                                      retiring API
OPTION 2  retire async-source first                   ~95 files; the migration
                                                      phase, not a prerequisite
OPTION 3  remove its SINGLE reportTreeError call      one call site
```

Under OPTION 3 every remaining producer supplies required attribution
immediately:

```text
link     registry.id ✓  ownerPath ✓        KEEPS
stored   ownerRegistry.id ✓  key ✓         RETIRING LATER, already compliant
```

⚠️ Cost, stated plainly: `asyncSource` users lose the one central-reporter path
they had and must use `node.error()` — which is public, and is the only surface
that covered their other two failure modes anyway.

⚠️ **Recorded, NOT taken.** Removing an observability path is a public-surface
decision even when the path is partial, and the "narrow prerequisite" premise the
directive rested on is now measured false.

```text
before   2197 passing
after    2203 passing
```

---

# ASYNC-SOURCE-REPORT-RETIRE-0 — one call site, and the blocker is gone

Production change: `async-source.ts` no longer calls `reportTreeError`. Nothing
else about the marker changed.

## ⚠️ WORDING — this is NOT a public API removal

`onTreeError` is not exported today, so no supported consumer could observe this
path. It is an **internal observable-behaviour change**, recorded honestly
because deep-importing tests can notice it.

The marker's SUPPORTED error contract is untouched:

```text
              node.error()   central report (before)
sync throw         ✓              ✓
Observable error   ✓              ✗
Promise rejection  ✓              ✗
```

The central call covered ONE of three failure modes and sat beside a complete
public signal. It was never this marker's error contract.

## Reporter inventory after the change

```text
link     treeId = registry.id        path = ownerPath      KEEPS
stored   treeId = ownerRegistry.id   path = key            RETIRING LATER
```

**No unattributable producer remains**, which is exactly what lets
`TreeErrorEvent.treeId` be REQUIRED rather than optional — without retiring
`asyncSource` (~95 files) and without plumbing ownership into an API v15 deletes.

## Permanent controls

Three local error-contract tests, driven through `TestBed.runInInjectionContext`
because auto-load is deferred off the materialize pass:

```text
1  synchronous load() throw   -> node.error(), loading released
2  promise rejection          -> node.error()
3  observable error           -> node.error()
```

Each also asserts nothing reaches the central reporter.

## ⚠️ The discriminator — restoring ONLY the central call

```text
DEAD    the inventory pins (5 files' worth)
DEAD    control 1's CENTRAL-ABSENCE assertion only
GREEN   control 1's node.error() assertions
GREEN   controls 2 and 3 entirely
```

Control 1 failed on `expected 1 to be +0` — the reporter count — with its local
assertions already passed. So the mutation cleanly separates:

```text
LOCAL supported error behaviour     unaffected
RETIRED internal global reporting   detected
```

which is the whole point of the change.

`asyncSource` FULL retirement stays in the original migration phase.

```text
before   2203 passing
after    2206 passing
```

---

# STORED-OWNER-INVARIANT-0 — required `treeId` is EARNED

`packages/core/src/lib/stored-owner-invariant-0.spec.ts`

```text
NULL       every materialized stored() capable of reaching reportError has an
           owner PositionRegistry; the optionality is defensive/type-level
FALSIFIER  a legitimate stored error can reach reportTreeError with no registry
```

**The NULL SURVIVES.** Instrumented at the report boundary, for both live report
operations and both enhancer configurations:

```text
NO enhancers               op=read   hasContext=true hasRegistry=true id=1
restoration+transactions   op=read   hasContext=true hasRegistry=true id=2
NO enhancers               op=write  hasContext=true hasRegistry=true id=1
restoration+transactions   op=write  hasContext=true hasRegistry=true id=2
```

## ⚠️ A DISTINCTION THAT NEARLY COST US THE REQUIRED FIELD

The first version of this probe asserted `getPositionRegistry(tree.$)` and FAILED
on a plain tree. That is a **different question**:

```text
the registry EXISTS            always — created unconditionally by
                               createMaterializationContext
the registry is ATTACHED to $  only when an enhancer enables position topology
```

`stored()` reads it from the CONTEXT, not the node, so its ownership does not
depend on enhancers. **Asserting the node attachment would have falsified the
NULL for the wrong reason and forced `treeId?: TreeId` permanently.**

⚠️ A second trap in the same probe: stored writes are DEBOUNCED. Without
`flushAllStoredSignals()` the failure never occurs and the test passes with zero
reports — measured before the flush was added.

## Why the optionality is type-level only

```text
1  MaterializationContext.positionRegistry is REQUIRED and unconditionally
   constructed — unlike the capability-gated positionTopologyEnabled
2  the only production path into createStoredSignal is the marker processor
   registration; it lives in the INTERNAL lib/markers barrel, and index.ts
   neither names it nor re-exports that barrel
```

Both remaining producers can therefore supply ownership at every live report
path:

```text
link     registry.id        ownerPath
stored   ownerRegistry.id   key
```

⚠️ Had this failed, the correct response was NOT to weaken the event — it was to
bring back the exact construction path that lacked ownership.

---

# ERROR-PATH-SEMANTICS-0 → ERROR-SURFACE-2 CLOSED. The reporter is PUBLIC.

## ERROR-PATH-SEMANTICS-0 — OUTCOME A

The candidate event documented `path` as a state location while producers
supplied two different domains:

```text
Link     ownerPath      a state location
stored   storage key    NOT a state location
```

That is the same type/runtime mismatch class `source` and `detail` were just
deleted for. Measured — the two are fully independent:

```text
stored('storage-key-xyz') at `prefs`      key = storage-key-xyz   ownerPath = prefs
nested at `settings.prefs`                key = storage-key-abc   ownerPath = settings.prefs
```

`stored` already captured `ownerPath` and simply reported the wrong one. Changed
to `path: ownerPath`, so **`path` has ONE meaning for every producer**: the
SignalTree state location associated with the report.

The storage key remains available through `stored`'s own
`onError({ key, operation })` context, where it belongs. No `storageKey` field
was added to the event.

Permanent controls include the strongest form: **a Link and a `stored` node at
the same location report the same `path`.**

## Reporter header corrected

```text
WAS   "one place to observe every error the library catches"
NOW   "a process-wide observer for errors SignalTree explicitly REPORTS"
```

The original was an aspiration that was never true, and the measured producer
inventory is deliberately narrow: `link` and `stored`. Every other catch site
handles its error locally and does not participate.

## PUBLIC — exactly three symbols

```text
onTreeError      the observer
TreeErrorEvent   what it receives
TreeId           only because the event names it
```

NOT public: `reportTreeError`, `clearTreeErrorListenersForTesting`,
`TreeErrorSource` (deleted outright), the listener registry, `PositionRegistry`,
`treeIdBrand`. Pinned by matching EXPORT STATEMENTS rather than file text.

## The public delivery contract, proven through root imports

```text
two identical trees          distinct treeId, same path, same operation
same tree                    stable treeId
path                         state location for BOTH producers
one failure                  one event
throwing listener            damages neither the link nor its peers
unsubscribe / zero / many    clean, harmless, independent
failed Link send             observable once, X authored, queue alive,
                             settled() RESOLVES
Link handle                  still exactly retrieve / settled / dispose
```

## Link may now say it

> **Rejected outbound Link sends are publicly observable through `onTreeError`.**

```text
before   2222 passing
after    2235 passing
```

⚠️ **A test-hygiene lesson, caught twice.** Two assertions matched raw
`index.ts` text and failed on the file's own comments ABOUT not exporting
something. Both are now matched against parsed export statements. A test that
cannot distinguish an export from prose about an export is not testing the
surface.

---

# COMPARISON-FULL-STATE-0 — the NULL survives; Link is a full-value boundary

`packages/core/src/lib/comparison-full-state-0.spec.ts`

⚠️ **"Full-state" describes the LINK BOUNDARY, not SignalTree's internal
mutation granularity.** The tree keeps granular entity notifications, granular
reversal and per-position causal identity; a Link endpoint nonetheless exchanges
`Row[]` as one complete collection value. Conflating the two levels would be a
false claim about the internals.

## Production makes exactly ONE equality decision

```ts
if (knownY !== undefined && deepEqual(now, knownY.value)) return;
```

One line, serving echo suppression AND acknowledgement reconciliation — which
DEMARCATION-0 already found were the same mechanism, not two.

## The equality guarantee, phrased truthfully

`deepEqual` is neither "JSON-like only" nor arbitrary JS semantic equality:

```text
primitives      SameValueZero — NaN equals NaN
arrays          element-wise          plain objects   key-wise
Date            by time value         RegExp          source + flags
Map / Set       structural            Error           name + message
boxed Number/String/Boolean           cycles          co-inductive, depth 64
functions       BY REFERENCE — two identical closures are NOT equal
```

Link is not extended to accommodate exotic values; the inventory exists so the
documented promise matches the code.

## Full-value proofs

```text
scalar      inbound replaces
branch      inbound { a: 9, b: 2 } is COMPLETE, not a patch
branch      outbound sends { a: 5, b: 2 } when only `a` changed
collection  inbound [B, C] over [A, B] REPLACES — A is gone
collection  outbound sends the complete all() snapshot
equality    a FRESH but deep-equal inbound value does not echo back
equality    reconciliation is driven by the rule, not object identity
equality    re-writing an EQUAL value manufactures no send
```

Type negatives prove no patch protocol: `Partial<T>` is rejected for `get`,
`subscribe`'s `next`, and collection rows. No runtime patch detector exists —
the type is the authority.

## No comparator is earned

The question was never whether one could be useful, but whether any EARNED
behaviour required one. None did. `LinkEndpoint` has no `equals` / `comparator`
/ `compare` / `identityFn`.

## The experiment chose the architecture; users do not choose the experiment

Three harnesses carry a mode parameter and NONE is a user option:

```text
LINK-HANDLE-0    'weak' | 'strong'
LINK-HANDLE-1    'included' | 'excluded'
LINK-ECHO-1      'correlation' | 'equality-said' | 'equality-held'
```

Pinned: production `link.ts` contains no mode, no `Suppression`, and none of
those literals.

## Mutation results — five kill, ⚠️ ONE SURVIVES

```text
A  structural -> reference equality      4 failures
B  collection inbound merges              3 failures (one is the known flaky
                                          wall-clock test, not a real kill)
C  endpoint accepts Partial<T>            typecheck
E  acquisition echoes back out            8 failures
F  settled() ignores in-flight retrieve   3 failures

D  no follow-up reconciliation            ⚠️ ZERO
```

### ⚠️ Mutation D survives — reported, not hidden

Making the reconciliation loop send once and return kills nothing. Not the race
case, and not the tightest form either: authoring X from INSIDE `endpoint.set()`
during its own await window still reconciles.

The reason is that a write marks the notifier dirty, the next flush schedules
another durable consequence, and that re-entry performs the follow-up send. The
loop is **redundant with flush-driven rescheduling** for every case constructible
through the public API.

⚠️ This does not mean LINK-RACE-1 was wrong — its harness had no flush-driven
rearm, so the loop was load-bearing THERE. The property is now carried by a
different mechanism, and the loop is belt-and-braces.

**Left in place deliberately.** Removing it is a production behaviour change with
no failing test to justify it, and "delete code no test covers" is how a subtle
race returns. Recorded so nobody assumes a passing suite vouches for it.

## Frozen semantic statements

```text
Link exchanges COMPLETE values.
get() returns a complete value; subscribe(next) supplies complete values;
set(value) receives a complete value.
Collections cross the boundary as complete Row[] snapshots.
Equality is the earned structural rule, for echo suppression AND reconciliation.
Link exposes no comparator and defines no patch/merge protocol.
Internal granular reactivity is INDEPENDENT of Link's full-value boundary.
```

```text
before   2235 passing
after    2250 passing
```

---

# CONSOLIDATION-0 — the experiments are archived; the invariants remain

Evidence and scaffolding only. **No production change, no API change.**

## ⚠️ THE MEASUREMENT THAT DECIDED THE HARNESS DISPOSITION

A catastrophic production mutation — outbound sends never arm — fails **9 spec
files**, and **NONE of the three comparison harnesses**:

```text
FAILED   comparison-full-state-0   demarcation-0   link-1-relationship
         link-2-public-contract    link-collection-0
         production-link-conformance-0   tree-error-attribution   ...

DID NOT NOTICE
         link-handle-0   link-handle-1   link-echo-1-suppression
```

They each carry a LOCAL `link` implementation with a `mode` parameter, so no
production change can ever fail them. **They are structurally incapable of
protecting production.** That is the argument for archiving them — not a
judgement about their past value, which was decisive.

## The three experiments, and what they decided

```text
LINK-HANDLE-0   'weak' | 'strong' settled()
                STRONG won. The weak reading resolves while an observation is
                still HELD behind settlement, so a host that awaited it before
                backgrounding was told the link was caught up when it was not.

LINK-HANDLE-1   'included' | 'excluded' retrieve
                INCLUDED won. An excluded retrieve() can MUTATE X after
                settled() has returned — misleading in exactly the way the weak
                outbound reading was. Having its own promise is not sufficient
                to exclude it; per-operation and whole-object idle promises
                routinely coexist.

LINK-ECHO-1     'correlation' | 'equality-said' | 'equality-held'
                EQUALITY won. No causal token, no provenance metadata, and no
                correlation id is needed: the reconciliation loop's own
                first-iteration equality check already suppresses the echo.
                DEMARCATION-0 had independently found that a separate
                echo-suppression check WAS that first iteration.
```

Each winning outcome is now asserted against production:

```text
STRONG settlement    production-link-conformance-0 (held consequence)
INCLUDED retrieve    production-link-conformance-0 (3 retrieve cases)
equality echo        comparison-full-state-0 (fresh-but-deep-equal)
```

⚠️ **LINK-RACE-1 has no file to dispose.** It never was a separate harness — it
is a named invariant carried by the conformance and demarcation batteries.

## ERROR-SURFACE archaeology → three permanent batteries

```text
DELETED   error-surface-0-disposition.spec.ts     4 tests
          error-surface-1.spec.ts                10 tests
          error-owner-identity-0.spec.ts          7 tests

KEPT      tree-error-attribution.spec.ts    <- ERROR-SURFACE-2 + the four
                                               TreeId property tests
          tree-error-public-contract.spec.ts <- exports, runtime shape, and
                                               the delivery semantics the two
                                               deleted files had been carrying
          error-reporter.spec.ts             <- reporter unit delivery
```

Falsifier coverage for every deletion:

```text
"listener contract is sound"        -> public-contract: throwing listener
5 delivery cases (ES-1)             -> public-contract: exactly-once, isolation,
                                       unsubscribe/zero/many, failed send
4 TreeId property cases (EOI-0)     -> MIGRATED verbatim into attribution
"reports from exactly two places"   -> superseded by a STRONGER guarantee: a
                                       third producer that cannot supply treeId
                                       does not typecheck, since the field is
                                       required
producer-reachability source-text   -> behavioural: link and stored both report
                                       with treeId + path; async-source's
                                       non-participation is pinned in
                                       async-source-retire-0
```

Every remaining `RESOLVED — what used to be false is now true` assertion is
gone. Those were archaeology; this document is where archaeology belongs.

## KEPT, tagged MIGRATION-SENSITIVE

```text
stored-owner-invariant-0.spec.ts    ownership at stored's report boundary
async-source-retire-0.spec.ts       the three local error paths, and the
                                    reporting-retirement record
```

Both protect behaviour of primitives scheduled for retirement. They are
deliberately NOT deleted ahead of that migration.

## Mutation D — disposition, NOT deletion

The reconciliation loop's continuation stays. `COMPARISON-FULL-STATE-0` measured
that removing it kills zero tests because flush-driven rescheduling carries the
same property — but a surviving mutation is **not deletion authority**.
Production currently has two mechanisms carrying one invariant; that is
redundancy, and removing one needs its own preregistered experiment
(`RECONCILIATION-REDUNDANCY-0`) proving flush-driven rearm is guaranteed across
every lifecycle, disposal and settlement case. Not now.

---

# MIGRATION-MAP-0 — inventory and replacement matrix. NO DELETIONS.

## ⚠️ THE HEADLINE, AND IT CORRECTS AN EARLIER RECORD

**None of the retiring primitives is publicly reachable.** Retiring them is
therefore **NOT a breaking public change**.

```text
package.json exports    { ".": ..., "./package.json": ... }   NO subpath
root exports            70 symbols, parsed from export statements
  loader                not exported
  asyncSource           not exported
  stored                not exported
  flushAllStoredSignals not exported
  asyncQuery            not exported
  export * from         (none)
```

⚠️ **ASYNC-SOURCE-RETIRE-0 said "asyncSource is PUBLICLY EXPORTED (via
markers/index.ts), so removal is a breaking public change." That was WRONG.** It
checked the barrel and not the `exports` map. The barrel is unreachable: the map
publishes no subpath, `index.ts` never re-exports it, and the root exposes the
markers it does want by DIRECT FILE PATH (`./lib/markers/entity-map`,
`./lib/markers/derived`).

**Nothing in the repository imports the markers barrel at all.** It is dead.

That does not shrink the ~95-file _work_; it reclassifies the _risk_. These are
internal deletions plus demo/doc/tool updates, not a consumer break.

## Consumer counts

```text
symbol                  prodTS  specs  demo  tools  docs
loader                      15     24     3      7    44
asyncSource                 13     17     9     12    33
stored                      20     58    11     12    55
flushAllStoredSignals        2      6     1      1     9
asyncQuery                   7      6     8      5    26
```

Docs split — archived record must KEEP historical names:

```text
                live  archived
asyncSource        8        20
stored            11        31
loader            12        24
```

## Replacement matrix — ⚠️ VERIFY, do not assume

```text
loader                  DELETE. Acquisition is `link({ get })` where the need is
                        external synchronization, or ordinary application async
                        composition where it is not. A3-0 already found not one
                        call site was an optimistic mutation.

asyncSource             DELETE. Its supported contract is `node.error()` plus
                        local loading state; ASYNC-SOURCE-RETIRE-0 measured the
                        central report covered 1 of 3 failure paths and removed
                        it. Replacement is ordinary async state, or `link` where
                        the behaviour is genuinely external synchronization.

stored                  NEEDS ITS OWN SEMANTIC MATRIX — see below. ⚠️ Do NOT
                        write "superseded by Link" until the behaviour matrix is
                        compared. Its surface is materially wider than Link's.

flushAllStoredSignals   Likely DELETE. Already recorded as a MITIGATION for a
                        SignalTree-introduced hazard, not a capability. Its
                        replacement must FOLLOW from the persistence decision,
                        not be reinvented as another global drain.

asyncQuery              ⚠️ NEEDS DECISION. Not in the previously-decided set, not
                        root-exported, 7 production files and 8 demo files. Its
                        `'async-query'` TreeErrorSource member never had a
                        producer. Classify before sequencing.
```

## `stored` behaviour matrix — enumerated, NOT yet dispositioned

```text
initial read           serialize / deserialize hooks
storage injection      storage?: Storage | null
debounce               debounceMs, maxWaitMs
versioning             version, migrate, clearOnMigrationFailure
local errors           onError(error, { key, operation })
operations             read | write | migrate | remove
global participation   onTreeError with treeId + state path
global drain           flushAllStoredSignals
transaction behaviour  durable-consequence scheduling, rollback interaction
```

⚠️ Nine behaviours. Link supplies three directions and a settlement handle. The
question for STORED-PERSISTENCE-0 is **"if `stored` never existed, what would
the architecture naturally use?"** — not "what object has the same shape".

## Demo — inventory now, rebuild at DEMO-COVERAGE-0

```text
internal / deep imports                 0     ⚠️ negative gate ALREADY satisfied
imports from '@signaltree/core'        48
link                                   75     already exercising the new surface
external                               19
onTreeError                             1     ⚠️ the public error contract is
                                              essentially undemonstrated

retiring API references
  stored        36 refs / 10 files
  asyncSource   19 refs /  9 files
  asyncQuery    13 refs /  8 files
  loader         9 refs /  3 files
  flushAll       2 refs /  1 file
```

## Tools and gates — 23 files reference retiring APIs

Including `verify-gates.mjs`, `check-bundle-budget.mjs`,
`check-contract-neutrality.mjs`, `check-rc-public-dispositions.mjs`,
`check-documented-symbols.mjs`, `size-report.mjs`, tree-shaking and
AI-codegen-benchmark prompts. ⚠️ Several are RELEASE GATES — they must be
updated in the same phase as the primitive they reference, or the gate run at
the end will fail for migration reasons rather than real ones.

## Recommended phase boundaries

```text
MIGRATION-MAP-0        this record. No deletion.
ASYNC-QUERY-DECIDE-0   ⚠️ NEW — classify asyncQuery before ordering
LOADER-RETIRE-0        smallest: 15 prod / 3 demo files
ASYNC-SOURCE-RETIRE-1  ~95 files, its own phase
STORED-PERSISTENCE-0   the nine-behaviour matrix; heaviest
STATUS-RESIDUE-0       sweep once the majors are gone
MIGRATION-CLOSE-0      zero-reference + public-surface proof
DEMO-COVERAGE-0        release gate, BEFORE full gates and Candidate B
PERF-PROOF-0
```

⚠️ `asyncQuery` is inserted ahead of LOADER because its disposition changes
whether `loader` retirement is truly the smallest first step.

## Held decisions

```text
public error contract FROZEN — onTreeError / TreeErrorEvent / TreeId. When
stored disappears and Link is briefly the only producer, that is NOT evidence
the observer should become Link-specific. Its genericity is already earned.

migration-sensitive specs stay until their primitive is retired:
  stored-owner-invariant-0    async-source-retire-0

the entity-granular-reactivity wall-clock flake is NOT touched during migration.
```

---

# ASYNC-QUERY-DECIDE-0 — OUTCOME A: DELETE

Disposition experiment. No deletion in this commit.

```text
QUESTION   does asyncQuery provide any semantic capability the final v15
           architecture would independently invent if it had never existed?
```

**No. Every capability it provides is an RxJS operator.**

## 1. The behaviour matrix, read from the pipeline

```ts
merge(
  trigger$.pipe(debounceTime(debounce), filter(predicate), distinctUntilChanged(equal)),
  rerun$
).pipe(switchMap(...), catchError(...))
```

```text
owns                     mechanism
value / loading / error  three Angular signals
debounce                 debounceTime          RxJS
dedup                    distinctUntilChanged  RxJS
stale suppression        switchMap             RxJS
cancellation             switchMap             RxJS
refetch                  rerun() -> Subject, merged AFTER dedup
reset                    re-set the initial signals

does NOT own
  sequence counter · cache · retry · AbortController · explicit unsubscribe
```

⚠️ **Zero causal / tree integration**, measured by direct search:

```text
positionRegistry   0     withWriteContext   0     external      0
transaction        0     reportTreeError    0
```

It has no owned position, no path, no write context, no durable consequence, and
no participation in the error channel. It is a reactive convenience wrapper that
happens to live in the tree, not a causal participant.

## 2. The load-bearing discriminator — measured, not argued

Slow A started, fast B started after, A resolves last:

```text
asyncQuery      started ['A','B']   final 'result:B'
plain RxJS      started ['A','B']   final 'result:B'
```

The plain version uses `Subject` + `switchMap` and **no SignalTree at all**.
Stale-response suppression is `switchMap`, not a SignalTree semantic.

## 3. No real production consumer

All seven "production" files are registration or TYPE plumbing:

```text
async-query.ts / .contract.ts   the primitive itself
markers/index.ts                the DEAD barrel (nothing imports it)
materialize-markers.ts          marker registration
types.ts, readonly.ts,          marker-resolution TYPE machinery
readonly-readers.ts
error-reporter.ts               the 'async-query' source member — which never
                                had a producer, and is now deleted
entity-loader.ts                a COMMENT: "mirrors asyncQuery"
test-setup.ts                   test wiring
```

## 4. Independence — both sequencing questions answered

```text
asyncSource   asyncQuery's ONLY reference is a comment ("alias for results to
              match the asyncSource shape"). INDEPENDENT — asyncSource
              retirement order does not block this.
loader        entity-loader.ts references asyncQuery only in a comment about
              scope-param equality. Deleting asyncQuery does NOT remove a
              migration target for loader callers. INDEPENDENT.
```

## 5. Bypass probe — ⚠️ the strongest evidence

Making the pipeline permanently inert (no query ever runs) fails **two spec
files, both its own**:

```text
FAILED   markers/async-query.spec.ts
         markers/async-query-a1-2-equivalence.spec.ts

DID NOT NOTICE   every other spec in the suite
```

The other referencing specs are TYPING specs — marker resolution, readonly, the
type matrix — which assert the type system resolves the marker, not that it
behaves. **No independent consumer invariant detects its absence.**

Per the decision rule, a primitive's own unit tests are not evidence that the
abstraction deserves to exist.

## 6. Error and loading semantics — for the record

```text
sync throw / rejection / observable error
  -> errorSignal set, loading false, and the PREVIOUS RESULT IS RETAINED
     (`resultsSignal.set` runs only on ok:true)
  -> nothing reaches onTreeError; there was never a producer
```

Applying the standard test: _if SignalTree launched at v15 with Link, external()
and ordinary Angular available, would we add a core marker solely to manufacture
data/loading/error over an RxJS pipeline?_ **No.** That is application async
state.

## DISPOSITION — DELETE

```text
no unique causal/tree role              ✓
no unique public contract               ✓  not root-reachable
strongest behaviour = plain switchMap   ✓
loading/error are convenience state     ✓
races/cancellation owned by RxJS        ✓
no independent consumer invariant       ✓
```

## Demo — preserve the SCENARIO, not the primitive

Eight files, and the teaching scenario is one thing: **debounced search with
loading and error states**.

```text
app.routes.ts · navigation.component.ts · examples.config.ts     wiring
whats-new.component.html                                         changelog prose
pages/async-demo/async-demo.component.html                       page shell
examples/.../async/async-demo.component.{ts,html,spec.ts}        THE scenario
```

⚠️ DEMO-COVERAGE-0 must keep "debounced search, loading, error, cancellation"
as a demonstrated scenario — expressed with an application-owned RxJS pipeline
plus `external()` to land results, or `link({ get })` where the relationship is
genuinely a synchronization. **Deleting the primitive must not delete the
lesson.**

## Revised sequence

```text
ASYNC-QUERY-RETIRE-0     independent of both loader and asyncSource
LOADER-RETIRE-0
ASYNC-SOURCE-RETIRE-1
STORED-PERSISTENCE-0
STATUS-RESIDUE-0
MIGRATION-CLOSE-0
DEMO-COVERAGE-0
PERF-PROOF-0
```

## Advisory findings held at arm's length

A separate local review reported a stale tarball `/storage` expectation, an
Angular consumer fixture failure, a README missing `link`/`onTreeError`, and a
staged-vs-unstaged mismatch. ⚠️ It audited a DIRTY working tree and a different
test count, so it is not release truth. Those exact gates are to be re-run on a
CLEAN committed HEAD after migration and disposed from fresh evidence. Migration
is NOT redesigned around that snapshot.

---

# ASYNC-QUERY-RETIRE-0 — deleted. The lesson survived the primitive.

> **`asyncQuery` did not own asynchronous query semantics; it packaged an RxJS
> composition inside a SignalTree marker.**

That is why it fails the v15 ownership test. Debounce, equality filtering,
stale-result suppression and cancellation are already owned by the reactive
stream doing the work — SignalTree added no causal or state-engine authority
over any of them.

## Deleted

```text
markers/async-query.ts                     the primitive
markers/async-query.contract.ts            its contract
markers/async-query.spec.ts                its behavioural specs
markers/async-query-a1-2-equivalence.spec.ts
markers/index.ts                           the dead-barrel entry
```

## Type-resolution plumbing — compiler-driven, marker rows only

```text
types.ts              3 marker-resolution rows
readonly.ts           ReadonlyAsyncQuerySignal + its conditional branch
readonly-readers.ts   ASYNC_QUERY_READERS
```

Neighbouring markers keep their exact typing; nothing generic was simplified
beyond what the deletion earned.

## ⚠️ ONE GENERIC INVARIANT MIGRATED, ONE COVERAGE LOSS RECORDED

**Migrated.** `marker-resolution.typing.spec.ts` asserted that
`DeepEntityAwareTreeNode` resolves a NON-ENTITY marker at the internal-variant
level. That invariant is marker-independent, so it moved onto `stored` rather
than disappearing.

⚠️ **Lost, and recorded rather than papered over.** `ROQuery['input']` was the
ONLY assertion proving `DemoteWritable` turns a PICKED `WritableSignal` member
into a plain `Signal`. asyncQuery was the only marker with a writable member in
its reader allowlist, so that branch of the readonly resolver is now
**unexercised**. `ROStored` covers a DIFFERENT property — the allowlist REMOVING
`set`/`clear`, not demoting a retained member.

Deliberately NOT substituted with a synthetic re-declaration: copying the
conditional into a spec asserts the copy, not the resolver. The next marker with
a writable member must re-earn that row. The gap is pinned in the spec itself.

## Demo — the scenario was preserved, the primitive was not

The eight demo references were one live lesson plus wiring and dated history:

```text
MIGRATED   async/async-demo.component.{ts,html,spec.ts}
             the snippet now teaches the pipeline that always owned the
             behaviour: debounceTime -> distinctUntilChanged -> switchMap, with
             results landed through external(). The spec asserts 'switchMap'
             where it used to assert 'asyncQuery'.
RELABELLED app.routes.ts · navigation.component.ts · examples.config.ts
KEPT       pages/async-demo — already titled "Async Markers Removed"
KEPT       whats-new — dated changelog entries (v9.5.0, v10.2, v10.3)
```

⚠️ `apps/demo` live-code references = **0**. Only dated history remains.

## Tools and gates

```text
UPDATED   check-bundle-budget.mjs           prose
          route-smoke.spec.ts               route comment
          ai-codegen-benchmark/scorer.mjs   member set + marker regex —
                                            it would otherwise have gone on
                                            REWARDING agents for emitting a
                                            deleted API
          prompts/003-debounced-search.yaml now requires `debounceTime`
ALREADY OK check-rc-public-dispositions.mjs already listed asyncQuery as deleted
```

Gates run directly: `check-rc-public-dispositions`, `check-bundle-budget`,
`check-documented-symbols` — all exit 0.

## Live docs vs archived record

```text
CORRECTED  README.md (snippet + NgRx concept map)
           docs/ai/agent-templates.md  ⚠️ this file INSTRUCTS agents; it had
                                       asyncQuery as the "canonical" async
                                       pattern
           docs/development/testing.md
           docs/compare/{ngrx-signalstore,capability-matrix,native-signals}.md
           docs/guides/{custom-markers-enhancers,streaming-accumulation}.md
KEPT       docs/architecture, docs/audits, docs/rfcs, CHANGELOGs
           docs/guides/migration-v13-v14.md  (a v13->v14 historical table)
```

Remaining live-doc mentions are all "the OLD markers are not part of v15" —
correct framing.

⚠️ **Those same compare/guide files still name `stored`, `asyncSource` and
`loader` as current.** They were corrected for asyncQuery only; a full pass
belongs to MIGRATION-CLOSE-0 rather than touching them four times.

## Zero-reference inventory (all spellings: asyncQuery, async-query, AsyncQuery, ASYNC_QUERY)

```text
production (core src)     0
demo live code            0
dead marker barrel        0
current tools/gates       0
live docs                 0 presented as available
core specs                3   retirement-record prose only
archived docs            19   intentionally retained
```

## Verification

```text
core suite      2168 passing (2189 total)   the one intermittent is the known
                                            entity-granular-reactivity
                                            wall-clock flake; green on re-run
typecheck       clean
core lint       clean
demo test       19 suites / 106 tests passing
demo lint       clean
PUBLIC API      zero delta — asyncQuery was never root-reachable
```

---

# ASYNC-QUERY-CLOSE-0 — three corrections to the retirement record

Evidence and docs only. The architectural decision is unchanged.

## ⚠️ 1. The demo claim was OVERSTATED — now genuinely proven

The retirement said the scenario was "preserved". At the TEACHING level that was
true; as a BEHAVIOURAL claim it was not. The only test asserted the rendered
snippet contained the word `switchMap`, which proves the panel renders.

**Outcome A taken.** `search-pipeline.ts` extracts the pipeline as ordinary
application code, and `search-pipeline.spec.ts` EXECUTES it:

```text
latest-wins   slow A started first, fast B second -> result is B
debounce      a burst of 3 collapses to 1 request
dedup         the same query twice issues 1 request
loading       true while active, false on result
error         a rejection sets error and clears loading
recovery      a later successful query still works
```

## ⚠️ 2. THE RECOVERY TEST FOUND A REAL DEFECT IN MY OWN REPLACEMENT

The first draft of `search-pipeline.ts` handled errors in the SUBSCRIBER. The
recovery test failed — and the reason is exactly what the retired primitive's
implementation comment had warned:

> "Errors are caught INSIDE switchMap, per query... if a query error escaped
> switchMap it would terminate the outer subscription, and the pipeline would
> silently stop responding to all future inputs."

So the demo would have taught a pattern that **silently dies on the first
error**. Fixed with `catchError` inside `switchMap`, mapping to an outcome
object, and the displayed snippet was corrected to match the tested code.

> ⚠️ **A retired primitive can still own a lesson worth carrying forward even
> when it owned no architecture.** asyncQuery had no causal authority — that
> finding stands — but its implementation encoded real operational knowledge, and
> deleting the code without reading it would have discarded that.

This is why the behavioural control was worth adding rather than narrowing the
claim.

## ⚠️ 3. A cleanup note had invented a dependency

`docs/development/testing.md` was edited during the retirement to say the
replacement scenario calls `inject(DestroyRef)` alongside `asyncSource`. **It
does not** — the replacement is an application-owned RxJS pipeline with no
SignalTree marker and no `DestroyRef`. Corrected in place, with the error
recorded: a cleanup note that invents a dependency is the same class of defect as
an overstated test claim.

## `DemoteWritable` — DELETED as UNREACHABLE (Outcome B)

The reachability question was answered mechanically rather than carried as an
"unexercised forever" comment. Every surviving reader allowlist member:

```text
ENTITY_READERS         methods and computeds
ENTITY_LOADER_READERS  loading/loaded/error/lastLoadedAt/params — all Signal
ASYNC_SOURCE_READERS   data/loading/error — all Signal
STORED_READERS         key/version — plain values
```

Not one is a `WritableSignal`. The only two that ever were — `asyncQuery.input`
and `status.state` — belonged to primitives that no longer exist. `status` is
already gone, so there was no STATUS-MIGRATION-SENSITIVE case to defer.

⚠️ `ReadonlyExtras` demotes writable EXTRAS through `ReadonlyView`, a DIFFERENT
mechanism, unaffected by this deletion.

**Deletion safety was proven by the existing `Equal<>` assertions** over all four
allowlists: had any member been writable, replacing `DemoteWritable<T[P]>` with
`T[P]` would have widened its type and failed those assertions. Typecheck stayed
green. No synthetic marker was invented to keep the abstraction alive.

The reintroduction condition is recorded in `readonly.ts` itself: a future marker
exposing a writable reader must restore the demotion WITH a test.

## Verification

```text
production asyncQuery refs   1 — a historical note inside the DemoteWritable
                                 deletion record; zero code references
public API delta             0
core suite                   2168 passing, 0 failures
demo                         20 suites / 112 tests passing (was 106)
typecheck / core lint / demo lint   clean
```

---

# LOADER-RETIRE-0 — ⚠️ STOPPED BEFORE DELETION. The NULL does not survive.

Classification only. **Nothing deleted.**

```text
NULL       loader has no unique SignalTree semantic authority; its footprint
           decomposes into implementation/registration, one-shot external
           acquisition, ordinary application async, and obsolete plumbing
FALSIFIER  a legitimate remaining behaviour requires ownership that cannot be
           expressed through application async, external(), or Link without
           inventing replacement machinery
```

**The FALSIFIER holds — but not in the way the NULL anticipated.**

## ⚠️ 1. `loader()` IS NOT A STANDALONE MARKER

It is a FEATURE ATTACHED TO `entityMap`:

```ts
entityMap({ load: loader(fn, opts) });
```

```text
markers/loader.ts          102 lines   a validating factory returning
                                       LoaderFeature<E, P>
markers/entity-loader.ts   720 lines   the implementation
```

So "retire loader" is not a marker deletion. It is a decision about a
**collection-acquisition subsystem**.

## ⚠️ 2. IT IS NOT AN RxJS WRAPPER — the asyncQuery analogy fails

```text
rxjs references   6, and ALL type-level:
                  `Observable` in a union, an rxjs-FREE isObservable check
switchMap         0
catchError        0
distinctUntilChanged  0
```

asyncQuery was deleted because RxJS already owned every behaviour it claimed.
**That reasoning does not transfer.** `loader` implements its own machinery.

## 3. What it actually implements — a CACHING + PERSISTENCE layer

```text
staleTime             8   freshness window
swr                   5   stale-while-revalidate
tags                 10   invalidation tags
persist              21   persisted scope entries
maxScopes            10   touch-ordered storage GC
equal                10   param equality
clearOnParamsChange   4
lazy                  6
cache                 6
EntityStorageAdapter      its OWN storage abstraction —
                          IndexedDB / localStorage / custom
```

## 4. Zero causal integration — measured

```text
external()   withWriteContext   positionRegistry
transaction  scheduleDurableConsequence   reportTreeError      ALL 0
```

So it has no causal authority. That part of the NULL is CONFIRMED.

## 5. No real production callers

Every non-primitive reference is type plumbing, a comment, or a guard:

```text
utils.ts            isLoaderFeature guard
types.ts            LoaderFeature brand + EntityLoaderSurface
readonly*.ts        LOADER_READERS / surface typing
entity-map.ts       accepts + validates the feature
serialization.ts    two COMMENTS citing `loader({ staleTime })` semantics
signal-tree.ts, materialize-markers.ts, async-source*.ts, index.ts   plumbing
```

Demo references are historical prose in the `whats-new` changelog only.

## ⚠️ THE STOP CONDITION

The NULL's four-way decomposition has no bucket for what this actually is. There
is a FIFTH category:

> **A caching and persistence layer for entity collections, with its own storage
> adapter.**

Deleting it does not remove an abstraction over machinery someone else owns — it
**removes user-facing capability**: stale-while-revalidate, tag invalidation,
multi-scope persistence, and storage GC. Nothing in `external()`, `link()` or
"ordinary application async" supplies those, and inventing a replacement is
explicitly prohibited.

⚠️ **AND ITS `persist` MACHINERY OVERLAPS `stored`.** Both own serialized
durable state with their own storage abstraction. `stored` is
`STORED-PERSISTENCE-0`, two phases away, and that phase's whole question is
"who naturally owns each persistence concern if `stored` never existed."

Deciding `loader`'s persistence separately would either delete SWR/tags/scope-GC
with no disposition, or answer the persistence-ownership question twice — once
here, informally, and once properly later.

## RECOMMENDED REORDER

```text
WAS   LOADER-RETIRE-0 -> ASYNC-SOURCE-RETIRE-1 -> STORED-PERSISTENCE-0
NOW   ASYNC-SOURCE-RETIRE-1
        ↓
      PERSISTENCE-DECOMPOSE-0   stored + loader.persist together, since both
                                own durable serialized state with their own
                                storage adapter
        ↓
      LOADER-RETIRE-1           the acquisition/caching half, once persistence
                                ownership is settled
```

`asyncSource` is unaffected and remains next — it is genuinely independent, and
`ASYNC-SOURCE-RETIRE-0` already measured its supported contract.

## Methodological note carried forward

ASYNC-QUERY-CLOSE-0's lesson applied here and changed the outcome: read every
branch before deleting. Had the asyncQuery template been applied by analogy —
"async marker, therefore RxJS wrapper, therefore delete" — this would have
deleted a caching subsystem on a false premise.

⚠️ **Architectural ownership and operational capability are different
questions.** `loader` fails the first (no causal authority, and caching is a
data-layer concern) while holding real amounts of the second.

## ⚠️ CORRECTIONS to the LOADER-RETIRE-0 record

**The omitted category, named.** The NULL's four-way decomposition
(implementation / one-shot acquisition / application async / compatibility) was
incomplete. It omitted:

```text
CACHE / REMOTE-DATA POLICY
  stale/fresh state · stale-while-revalidate · tag invalidation
  scoped cache entries · cache equality · cache eviction / retention
```

That omission is what removed deletion authority.

**⚠️ DO NOT OVERCORRECT.** This result does NOT establish any of:

```text
loader must remain in SignalTree      loader should become public
caching belongs in core               loader.persist is the right design
SWR belongs in entityMap              EntityStorageAdapter should survive
maxScopes belongs to persistence
```

It establishes only that **meaningful capability exists and its architectural
owner is not yet dispositioned.** Those statements stay separate.

> **A primitive can fail the ownership test without being semantically empty.**
> asyncQuery failed ownership AND reduced to RxJS operators. `loader` appears to
> fail causal ownership while holding a substantial remote-data/cache policy
> layer. Different findings, different treatment.

**⚠️ `maxScopes` is NOT pre-classified as persistence.** It lives beside
`loader.persist`, but grouping by implementation proximity is not measurement.
`PERSISTENCE-DECOMPOSE-0` must establish:

```text
does maxScopes operate with persist DISABLED?
does it bound the in-memory scope cache only?
does it also control durable storage eviction?
  -> CACHE POLICY / PERSISTENCE POLICY / BOTH
```

Likewise `tags`, `staleTime`, `swr`, `equal`, `clearOnParamsChange` and `lazy`
begin as CACHE/ACQUISITION concerns, not persistence concerns.

**`status` is already gone**, confirmed by this probe — no `STATUS_READERS`, and
only an `EntityLoaderSurface` comment remains. So `STATUS-RESIDUE-0` means
reference/doc cleanup, NOT retiring a live primitive. No migration phase should
be spent deleting code that is already absent.

## Revised sequence

```text
ASYNC-SOURCE-RETIRE-1        next; genuinely independent
PERSISTENCE-DECOMPOSE-0      stored + loader.persist + EntityStorageAdapter
LOADER-CACHE-DISPOSITION-0   acquisition + staleTime/SWR/tags/equal/scopes
LOADER-RETIRE-1              only if the disposition earns deletion
STATUS-RESIDUE-0             references and docs only
MIGRATION-CLOSE-0
DEMO-COVERAGE-0
```

`loader` is not touched during ASYNC-SOURCE-RETIRE-1 except for stale comments
whose only purpose was describing `asyncSource`.

---

# ASYNC-SOURCE-RETIRE-1 — deleted. No falsifier appeared.

## Classification — no real consumers

Recounted post-asyncQuery rather than trusting MIGRATION-MAP-0's numbers:

```text
production      15 files -> 7 real code, 8 comment-only
core specs      17
demo             5 -> ZERO real imports; all HTML code samples
tools/scripts   11
```

The seven real files were the primitive, its contract, the dead barrel, and
marker-resolution type plumbing (`types.ts`, `readonly.ts`,
`readonly-readers.ts`). ⚠️ **The `index.ts` reference was a COMMENT** — parsed
exports confirm `asyncSource` was never root-reachable, so public API delta is
zero.

## Causal integration — all zero

```text
external()  withWriteContext  positionRegistry  transaction
scheduleDurableConsequence  getPathNotifier  ownerPath  TreeId   ALL 0
reportTreeError                                                  comment only
```

## ⚠️ ITS STALE-RESULT CONTRACT WAS INCONSISTENT — measured, not inferred

Slow A started first, fast B second, A resolving last:

```text
PROMISE path      started [A,B]  final = A   ⚠️ THE STALE RESULT WINS
OBSERVABLE path   started [A,B]  final = B   latest-wins
RECOVERY          value=ok error=null        recovery works
```

`runLoad()` calls `currentSub?.unsubscribe()`, which cancels an in-flight
**Observable** — but a Promise cannot be cancelled and there is no sequence
guard, so a slow earlier load **overwrites a newer one**.

⚠️ So the migration does not "preserve" this contract — the replacement pattern
(`switchMap`) is strictly BETTER on the Promise path. Recorded as a FIX, not as
preservation, per the standing instruction not to silently upgrade a contract and
later claim it was kept.

**The operational guard worth carrying forward:** each `runLoad()` creates a
FRESH subscription, which is why error recovery works naturally. The asyncQuery
replacement had to add `catchError` inside `switchMap` to get the same property.

## Bypass probe — 7 files, and every generic invariant has a survivor

```text
its own specs        async-source.spec · a1-equivalence · m9-ingress
its retirement rec   async-source-retire-0
GENERIC              hydrate-decisions · marker-contract · rehydrate-ownership
```

⚠️ Unlike asyncQuery (2 files, both its own), three GENERIC invariants noticed.
Each has a surviving subject:

```text
"a declined rehydrate is observable"   entity-map.ts ALSO reports
                                       decision: 'declined'
marker-contract snapshot/transient     entityMap and stored
rehydrate accept-vs-decline contrast   entityMap (declines) + loader (accepts)
```

⚠️ **`hydrate-decisions.spec.ts` had already reserved its asyncSource cases
"deliberately LEFT for ASYNC-DEL"** — this phase — and `m4-reconstruction.spec.ts`
predicted the consequence outright:

> "The `hydrate` hook has exactly two implementers: `entityMap` and
> `asyncSource`. `asyncSource` is already a frozen DELETE, so on the far side of
> that deletion `hydrate` reduces to ONE implementer, exactly as `snapshot` did."

That prediction is now true.

## Migrations, not deletions, where an invariant was generic

```text
hydrate-decisions   seam-unsubscribe + rehydrate-declines -> loader-backed
                    entityMap
ssr-transfer        the whole RFC 0014 transfer fixture -> loader-backed
                    entityMap; callable reads became count()/ids()
bench-ssr-payload   same migration, so the SSR payload gate keeps measuring
                    transfer-vs-rehydrate
marker-contract     the describe became EMPTY and was removed; entityMap and
                    stored remain as subjects
```

## Records retired because their SUBJECT is gone

```text
owner-location-0    the "not addressable at all" row is now EMPTY. That is the
                    DESIRED end state — OWNER-PING-0 fixed entityMap and stored,
                    and asyncSource stayed unaddressable only because it was a
                    frozen DELETE. The row is KEPT, empty, so a new
                    unaddressable marker re-populates it visibly.
m4-reconstruction   the conformance-spectrum MIDDLE point had no survivor with
                    that shape (callable, isSignal false, MarkerProcessor
                    symbol), so the row is retired rather than re-subjected.
ssr-transfer C3     the "ships its payload then drops it" gap has no remaining
                    carrier. Not a defect FIXED — one whose carrier was removed.
```

## Tools — two would have kept teaching a deleted API

```text
bench-ssr-payload.mjs   IMPORTED asyncSource and CRASHED on load; migrated
scorer.mjs              removed its member set AND the marker-detection regex
prompts 002 / 007       required `asyncSource` OR `status(` — BOTH deleted, so
                        these prompts were already stale; now require
                        `external(` / `entityMap`
check-contract-neutrality / check-bundle-budget   comments
verify-gates + check-rc-public-dispositions       KEPT: the disposition ledger
                                                  correctly records asyncSource
                                                  as DELETE, and the gate
                                                  mutation still resolves
```

## Zero-reference gate

```text
production CODE            0
demo live code (.ts)       0
dead marker barrel         0
public API delta           0
production comments       10   historical prose in current code
core specs                10   retirement records
demo                       2   dated changelog + the "Removed" page
current tools/gates        4   disposition ledger + comments
live docs                  4   all "the OLD markers are deleted" framing
archived docs             24   intentionally retained
```

⚠️ `test-setup.ts` and `docs/development/testing.md` both justified the Angular
TestBed setup by asyncSource's `inject(DestroyRef)`. That justification is now
false — the setup is still REQUIRED, but by `define-store.ts`, `entity-loader.ts`
and ordinary injection-context specs. Corrected in both rather than left to rot.

```text
core   2120 passing, 0 failures     typecheck clean   lint clean
demo   20 suites / 112 tests        lint clean
gates  check-rc-public-dispositions · check-bundle-budget ·
       check-contract-neutrality · check-documented-symbols   all exit 0
```

---

# PERSISTENCE-DECOMPOSE-0 — the frozen Link API expresses persistence

`packages/core/src/lib/persistence-decompose-0.spec.ts`

Analysis and prototype only. **Nothing deleted, and Link was NOT modified.**

The prototype endpoint is exactly `LinkEndpoint<T>` — `get` and `set`. No
`StoredOptions` shape was copied onto it; every storage concern lives INSIDE
those two functions.

## §8 TRANSACTION / ROLLBACK — the strongest falsifier, and it held

```text
rolled-back transaction   NO speculative value ever durable
committed transaction     ONE write of the COMPLETE committed value
ordinary authored write   persists normally
```

⚠️ **My first assertion here was WRONG, and the failure was informative.** I
asserted `writes === []` after a rollback. It failed — with one write of
`{ theme: 'light', density: 1 }`, the **post-rollback** state.

So Link did not leak speculative values; the rollback is itself a state change,
which armed a reconciling send of the committed truth. That is LINK-RACE-1
behaviour, not a persistence defect. The real invariant — no SPECULATIVE value is
ever durable — is now asserted directly, per-write.

This is the strongest evidence that persistence belongs on the commit boundary
rather than inside a marker write path: `stored` needed durable-consequence
scheduling for exactly this, and Link already has it.

## §9 SETTLEMENT vs DEBOUNCE — `settled()` IS a durability boundary

```text
debounced write, before settled()   NOT durable
await link.settled()                durable
```

The endpoint's `set()` returns a Promise that resolves only when the durable
write lands, so `settled()` means "durably written", not "scheduled".

⚠️ **THE COALESCING CLAIM IS WITHDRAWN — see 0B CORRECTION 1.** 0A asserted only
that the final durable value was `C` and called that endpoint coalescing. It is
not: instrumenting write COUNT and timing shows TWO durable writes, and the
coalescing is LINK's, not the endpoint's.

> **A LOCAL Link settlement mechanism exists that can replace the global
> durability boundary.** Exact `stored` scheduling-policy disposition was still
> under test at 0A; see 0B for `maxWaitMs`. That direction answers the TruckTrax
> durability requirement without a global API.

⚠️ Per the ASYNC-SOURCE lesson, "await write", "flush" and "settled" were treated
as three separate claims and measured separately rather than as synonyms.

## §11-12 SERIALIZATION and MIGRATION are endpoint-owned

```text
custom serializer     Link transported T; the endpoint chose the wire format
version migration     v1 payload upgraded inside get() — NO Link involvement
absent value          the endpoint's decision, not Link's
```

Migration happens while INTERPRETING the durable representation, which is why it
belongs to the adapter. No serializer hook on Link, and no pressure to add one.

## §13 ERROR MODEL — the frozen contract holds, with one measured asymmetry

```text
outbound set() failure   -> onTreeError, once, operation 'link:set',
                            path = 'settings' (the STATE location)
                         -> X stays authored, queue survives, later write lands
```

⚠️ The storage key `'k'` never appears in `path` — the ERROR-PATH-SEMANTICS-0
separation holds under a persistence workload.

⚠️ **AND A DIRECTIONAL ASYMMETRY, measured not assumed:** a failing `retrieve()`
**REJECTS to its own caller** and does NOT reach `onTreeError`. The reporter
covers automatic OUTBOUND egress; an explicitly awaited operation returns its own
error. Storage-specific detail (key, backend, codec, quota) therefore stays with
the endpoint/application, and `TreeErrorEvent` needs no widening.

## §4 `maxScopes` — PERSISTENCE RETENTION, measured from code

⚠️ **This contradicts my own earlier speculation** that it sounded like cache
eviction. The evidence:

```text
declared on            EntityPersist — inside the persist options object
gated by               `if (!p || !scoped || p.maxScopes === undefined) return;`
                       -> persist DISABLED means NO GC at all
mechanism              adapter.removeItem over a touch-ordered scope index at
                       `${key}::__scopes`
its own doc            "This is storage GC only — in-memory multi-scope LRU
                       caching remains deferred (RFC 0003 §5); the in-memory
                       cache is still single-scope."
```

There is no multi-scope in-memory cache for it to bound. **Classification:
PERSISTENCE RETENTION**, not cache retention and not both.

## Proposed ownership

```text
state synchronization        LINK RELATIONSHIP
storage backend             ENDPOINT / ADAPTER
serialization / codec       ENDPOINT / ADAPTER
version migration           ENDPOINT / ADAPTER
debounce / write scheduling ENDPOINT POLICY
durability boundary         LINK settled()      (already exists)
storage-specific errors     ENDPOINT / APPLICATION
generic sync failure        onTreeError         (already exists)
global flush                DELETE
maxScopes                   PERSISTENCE RETENTION — travels with whatever owns
                            durable scope storage
```

**Required new core API: NONE.** Question 7 answers `no`.

## ⚠️ WHAT THIS PHASE DID NOT COVER

Stated plainly rather than implied by omission:

```text
NOT measured   clearOnMigrationFailure · remove/clear semantics · maxWaitMs as a
               distinct policy · the full loader.persist inventory (adapter
               contract details, persisted metadata shape, hydration timing,
               staleTime/SWR/tags interaction)
```

The §5 concept-overlap matrix is therefore PARTIAL: it is established for the
generic-persistence column (stored's concerns) and NOT yet for the
loader-cache column. `LOADER-CACHE-DISPOSITION-0` still owns that side, and this
phase's contribution is that **persistence is now removable from the loader
question** — which was its purpose.

```text
core 2130 passing, typecheck clean, lint clean
```

---

# PERSISTENCE-DECOMPOSE-0B — two corrections, and a better architecture

⚠️ **0A was accepted as `PERSISTENCE-DECOMPOSE-0A`, NOT as the closed phase.** Its
own report said the concept-overlap matrix was partial while declaring the
decomposition done; those cannot both be true.

## ⚠️ CORRECTION 1 — the coalescing claim was WRONG, and the truth is simpler

0A asserted only that the final durable value was `C`. Instrumented properly —
`set()` invocations, resolutions, durable writes, 50ms endpoint timer, authored
at t=0/20/40:

```text
set(A) INVOKED  +5ms    -> DURABLE  +58ms
set(C) INVOKED +60ms    -> DURABLE +113ms
durable writes: ["A","C"]     count = 2      NOT one
pending timers cleared: 0
```

**TWO durable writes, and `B` was never passed to `set()` at all.**

> **The coalescing is LINK's, not the endpoint's.** Its reconciliation loop reads
> the CURRENT value after each acknowledged send, so intermediate truth is
> skipped. The endpoint timer contributes only LATENCY — it is not a debounce,
> because Link serializes and the timer is never cleared while pending.

⚠️ That also makes the orphaned-Promise hazard in the 0A prototype UNREACHABLE
(`pendingCleared === 0`) — but only because Link's serial contract prevents it.
Worth knowing rather than relying on.

## ⚠️ CORRECTION 2 — `maxWaitMs` is OBSOLETE UNDER LINK SERIALIZATION

Continuous authored writes every 15ms against a 40ms durable latency:

```text
durable: 1, 3, 6, 8, 11, 13, 16, 19, 20      9 writes over 458ms
final durable = 20 = the tree value          NO starvation
```

One durable write per send-completion, always carrying the newest truth.

`maxWaitMs` existed to bound `stored`'s **restartable** debounce, which could
starve indefinitely under continuous writes. Link never restarts a timer — it
sends, then sends whatever is latest — so **that STARVATION failure mode is
structurally impossible and `maxWaitMs` has nothing left to bound.**

⚠️ **NARROWER THAN IT FIRST READ.** This does NOT mean Link serialization
supplies every reason someone configured `debounceMs`. Time-based **write-rate
reduction** remains a distinct endpoint policy — and CORRECTION 1's own
measurement is the evidence: the 50ms endpoint timer produced **2 durable writes
where 3 authored writes occurred**, which is rate reduction Link's coalescing did
not supply on its own.

```text
maxWaitMs   OBSOLETE — its starvation argument is gone under Link serialization
debounceMs  ENDPOINT POLICY — genuine write-rate reduction, NOT the coalescing
            mechanism, and NOT made redundant by Link
```

So the correct statement is narrow: Link removes the starvation ARGUMENT for
`maxWaitMs`; it does not make `debounceMs` redundant.

## §3 CODEC ROUND-TRIP — closed

0A's custom-serializer test was **one-way**: its default `get()` did
`JSON.parse` and could never have read back the `V2|...` it wrote. Now:

```text
author -> encode -> durable 'V2|round|7'
FRESH tree -> retrieve -> decode -> { theme: 'round', density: 7 }
malformed 'V9|...' -> retrieve REJECTS, state untouched
```

Encode and decode both live in the endpoint; Link sees only `T`. **No codec hook
on Link.**

## §6 RETRIEVE RECOVERY — closed

```text
malformed durable value  -> retrieve() rejects, state untouched
backend repaired         -> retrieve() SUCCEEDS
```

Explicit acquisition is not permanently dead after one failure — the same defect
class the asyncQuery replacement had.

## §7 DISPOSAL WITH PENDING DURABILITY — the ORDER is the contract

⚠️ `dispose()` **abandons** a pending write from Link's perspective. The
endpoint's own timer may still fire, but Link guarantees nothing about it and a
consumer that disposed first cannot await it.

```text
CORRECT     await handle.settled();   // the durability boundary
            handle.dispose();         // then release

WRONG       handle.dispose();         // then hope storage finishes
```

And `dispose()` **releases** an in-flight `settled()` waiter rather than hanging
it, so the pattern is safe to use defensively.

⚠️ This is the CORE mechanism relevant to TruckTrax. It does NOT prove TruckTrax
is fixed — the production consumer still has to use the order correctly.

## Ownership, updated

```text
state synchronization        LINK RELATIONSHIP
outbound coalescing          LINK  (was mis-attributed to the endpoint in 0A)
storage backend              ENDPOINT / ADAPTER
codec (encode AND decode)    ENDPOINT / ADAPTER
version migration            ENDPOINT / ADAPTER
write latency policy         ENDPOINT (optional)
maxWaitMs                    OBSOLETE UNDER LINK SERIALIZATION
durability boundary          LINK settled()  — and dispose AFTER it
global flush                 DELETE
```

**Required new core API: still NONE.**

## ⚠️ STILL OPEN — 0B is not the closed phase either

```text
NOT YET MEASURED
  clearOnMigrationFailure       stored behaviour + adapter-policy prototype
  remove / clear                what it means, and whether the ADAPTER OBJECT
                                may carry it while LinkEndpoint stays get/set/
                                subscribe
  maxScopes runtime control     persist-disabled vs enabled churn
                                (source evidence is strong; the behavioural
                                discriminator has not been run)
  full loader.persist inventory adapter contract, key shapes, persisted
                                metadata, hydration timing/precedence,
                                staleTime/SWR/tags/equality interaction
  the loader-cache HALF of the concept-overlap matrix
```

`PERSISTENCE-DECOMPOSE-0` remains OPEN. `STORED-RETIRE-0` is not yet unblocked.

---

# PERSISTENCE-DECOMPOSE-0 — CLOSED. Two more corrections first.

## ⚠️ CORRECTION 3 — a test that asserted nothing

The 0B disposal case ended in `expect(true).toBe(true)`. The conclusion was
plausible from the implementation and **unproven by the test**. It now asserts
that nothing is durable at the moment of disposal, and records the honest
boundary fact: the endpoint's own timer is not Link's to cancel, so whether it
eventually lands is the endpoint's business — what matters is that **Link offers
no guarantee once disposed**, so a consumer cannot await it.

## ⚠️ CORRECTION 4 — the `maxWaitMs` claim was too broad

```text
WAS   "maxWaitMs OBSOLETE; serialization already provides what debounce was for"
NOW   Link removes the STARVATION argument for maxWaitMs. It does NOT make
      debounceMs redundant.
```

CORRECTION 1's own measurement is the evidence: the 50ms endpoint timer produced
**2 durable writes where 3 authored writes occurred**. That is genuine write-rate
reduction, and Link's coalescing did not supply it.

```text
maxWaitMs   OBSOLETE — its starvation argument is gone
debounceMs  ENDPOINT POLICY — real rate reduction, NOT the coalescing mechanism
```

## §4 `clearOnMigrationFailure` — ADAPTER POLICY

Read from `stored.ts` (two identical paths): report, optionally `removeItem`,
return the default — **entirely inside the READ path**, while interpreting the
durable representation. Prototyped inside endpoint `get()`, both settings, no
SignalTree API addition.

## §5 `remove` / `clear` — TWO responsibilities, and an ORDERING rule

`stored().clear()` is compound: reset the tree value, remove the durable key,
supersede pending writes, obey the transaction boundary, report as
`operation: 'remove'`.

⚠️ **Writing the default is NOT removing the key** — absence is what lets an
endpoint choose a fallback. Measured decomposition:

```text
remove() THEN reset          ✗ the authored reset re-creates the key
reset, SETTLE, THEN remove   ✓ absence achieved AND the relationship stays live
reset, settle, dispose,
  THEN remove                ✗ absence achieved but persistence ENDS — see PIN A
```

⚠️ **CORRECTED BY PIN A.** 0B first recommended disposing before removing. That
achieves absence but ends the relationship, which is NOT what `stored().clear()`
does. **Settling is what makes removal stable; disposal was never the
mechanism.**

```text
LINK CONTRACT       stays get / set / subscribe — SignalTree never calls remove
ADAPTER OBJECT      may carry storage administration (adapter.remove)
```

⚠️ **Recorded as a real ergonomic cost, not glossed:** one method became two
calls plus an ordering rule. `stored` hid the ordering inside `clear()`; an
application now owns it explicitly.

## §8 `maxScopes` — PERSISTENCE RETENTION, frozen

The gate is **structural**, which is stronger than the preregistered churn test
for the persist-disabled question:

```text
touchScopeIndex()   ONE call site: writeThrough()
writeThrough()      opens `if (!persist) return;`
touchScopeIndex()   opens `if (!p || !scoped || p.maxScopes === undefined) return;`
```

Double-gated — with persist disabled the GC is **unreachable**, not merely
inactive. Mechanism is `adapter.removeItem` over `` `${key}::__scopes` ``, and the
option's own doc says the in-memory cache is still **single-scope**.

⚠️ Stated honestly: this is a CALL-GRAPH proof. It does **not** measure eviction
ORDER or revisit-refetch under persist-enabled churn — those belong to
`LOADER-CACHE-DISPOSITION-0`.

## §9 FULL `loader.persist` INVENTORY — and the surprise

`EntityPersist` has only **four** options:

```text
adapter                 getItem / setItem / removeItem
key                     base storage address
hydrateThenRevalidate   hydration precedence vs a live fetch
maxScopes               persisted-scope GC
```

⚠️ **AND ONLY TWO `setItem` CALL SITES EXIST:**

```text
line 423   JSON.stringify(entity.all())    the ROWS
line 402   JSON.stringify(index)           a scope-KEY list, for GC
```

**ZERO cache metadata is persisted.** `lastLoadedAt`, `staleTime`, `tags` and
`swr` never reach `setItem` or `stringify` — they are in-memory only.

> That answers the discriminating question directly. loader's durable surface is
> a **generic row-snapshot representation with loader-specific scoped hydration
> and GC semantics** — not a durable cache with staleness metadata.
>
> ⚠️ Phrased carefully: "not remote-cache persistence" would be too broad. Those
> durable rows DO participate in loader cache hydration
> (`hydrateThenRevalidate`, scope addressing), so the representation is generic
> while its SEMANTICS around hydration and eviction are loader-specific. The
> matrix below says this correctly; the summary sentence did not.

## §10 THE OVERLAP MATRIX — completed

```text
concept              STORED                  LOADER.PERSIST          verdict
storage backend      Storage (injected)      EntityStorageAdapter    SAME CONCEPT
address / key        `key`                   `key` + scope suffix    SAME CONCEPT
codec                serialize/deserialize   JSON only               SAME CONCEPT
                                                                     (stored richer)
durable payload      the leaf value          entity.all() rows       SAME CONCEPT
                                                                     (both = the
                                                                     node's value)
version / migration  version/migrate/        none                    STORED-ONLY
                     clearOnMigrationFailure
write scheduling     debounceMs/maxWaitMs    immediate write-through RELATED,
                                                                     DIFFERENT
failure policy       report + local onError  silent best-effort      RELATED,
                                                                     DIFFERENT
removal              clear() compound        adapter.removeItem      RELATED,
                                                                     DIFFERENT
hydration precedence n/a                     hydrateThenRevalidate   LOADER-CACHE
scope identity       n/a                     scopeStorageKey(params) LOADER-CACHE
scope index / GC     n/a                     ::__scopes + maxScopes  LOADER-CACHE
staleness / SWR      n/a                     IN-MEMORY ONLY          CACHE-ONLY
tags / equality      n/a                     IN-MEMORY ONLY          CACHE-ONLY
```

**Generic:** backend, address, codec, durable payload. **Loader-cache:** hydration
precedence, scope identity, scope GC. **Cache-only and never durable:** staleness,
SWR, tags, equality.

⚠️ **Do NOT unify these merely because both serialize bytes.** The shared rows are
a low-level storage/codec concern; the runtime relationships are different
(one-value synchronization vs scoped remote-cache hydration).

## COMPLETION — every row disposed

```text
transaction / rollback        LINK — no speculative value durable
commit                        LINK — complete committed truth
outbound coalescing           LINK  (mis-attributed to the endpoint in 0A)
durability boundary           LINK settled(), and dispose AFTER it
storage backend               ADAPTER
codec (encode AND decode)     ADAPTER
version migration             ADAPTER
clearOnMigrationFailure       ADAPTER POLICY
debounceMs                    ENDPOINT POLICY (rate reduction)
maxWaitMs                     OBSOLETE (starvation argument gone)
remove / clear                APPLICATION — two calls + an ordering rule
storage-specific errors       ADAPTER / APPLICATION
generic sync failure          onTreeError (unchanged)
global flush                  DELETE
maxScopes                     PERSISTENCE RETENTION (loader-cache side)
loader durable payload        GENERIC row persistence, NOT cache persistence
```

**Required new core API: NONE. Link remains frozen and unmodified.**

`PERSISTENCE-DECOMPOSE-0` is **CLOSED**. `STORED-RETIRE-0` is unblocked, and
should be implementation migration and deletion — not another architecture
investigation.

---

# STORED-RETIRE-0 §0 — the two pre-deletion pins, CLOSED

## ⚠️ PIN A — `stored().clear()` KEEPS PERSISTENCE ACTIVE

The measurement I owed and had not run. Against a real in-memory `Storage`:

```text
after set(A)    durable {"__v":1,"data":"A"}   tree A
after clear()   durable ABSENT                 tree default
after set(B)    durable {"__v":1,"data":"B"}   tree B
```

So `clear()` is **three** things: remove the durable key, reset the tree value,
**and keep the relationship alive.**

### ⚠️ AND THE MIGRATION IS CHEAPER THAN 0B CLAIMED

0B recommended `reset → settled → dispose → remove`. That achieves absence but
**ends persistence**, which would have forced a relink. Measured, the correct
recipe is three steps with **no dispose and no relink**:

```ts
tree.$.x.set(defaultValue); // reset
await persistence.settled(); // let the outbound send land
adapter.remove(); // THEN delete
```

```text
absence after remove        ✓
later authored write        ✓ persists again — matches stored()
```

> **Settling is what makes removal stable; disposal was never the mechanism.**
> 0B's failing case removed BEFORE the reset settled, which is why the removal
> was lost — and I then mis-attributed the fix to `dispose()`.

Migration cost, stated honestly: **one method becomes three calls plus an
ordering rule.** Not a relink. Not a reason to keep `stored`.

## ⚠️ PIN B — migration-failure observability CHANGES OWNER

Today `stored`'s migration failure routes through `reportError('migrate', …)` →
`reportTreeError`, so it **does** reach `onTreeError` with
`operation: 'migrate'`.

After deletion that producer is gone, and the adapter prototype catches and
returns a fallback — so **Link never sees a failure and nothing reaches the
observer.**

```text
storage / migration / codec failure   ADAPTER or APPLICATION error handling
endpoint get() throws                 link.retrieve() REJECTS its caller
automatic Link set() failure          onTreeError
```

⚠️ Recorded as an **intentional ownership change, not a regression.** It is
consistent with the already-measured rule that explicit `retrieve()` failures
reject their caller rather than entering the global observer. The adapter must
**not** call the internal `reportTreeError`, and `onTreeError` is **not** widened.

## §1 CURRENT FOOTPRINT — recounted, not inherited

```text
production      19 files
core specs      55
demo            11
tools/scripts   12
```

⚠️ Materially larger than `asyncSource`, and unlike it there is a **real code
reference outside the primitive**: `lib/signal-tree.ts` uses `isStoredMarker`.
Several enhancers (`restoration`, `serialization`, `devtools`) and internals
(`commit-consequence`, `intercept-leaf-signals`, `tree-realization-adapter`,
`error-reporter`) also name it — each needs classifying as
STORED-ONLY vs SHARED before anything is deleted, per §2.

**Deletion has NOT begun.** The pins are closed; the mechanical retirement is
the next step.

## §2/§3 CLASSIFICATION — the footprint was references, not dependencies

⚠️ **CORRECTION to §1 above.** §1 recorded "a real code reference outside the
primitive: `lib/signal-tree.ts` uses `isStoredMarker`." That is **false**.
A parsed grep for every stored identifier found no code reference in
`signal-tree.ts` — its four hits are prose, three of them the ordinary English
verb ("stored as a plain array leaf", "stored its return value"). The claim
came from a scan that did not separate comments from code.

Of the 19 production files, **6** carry executable dependencies:

```text
markers/stored.ts              the primitive
markers/stored.contract.ts     its contract
markers/index.ts               barrel re-export
lib/types.ts                   3x  StoredMarker -> StoredSignal resolution rows
lib/readonly.ts                ReadonlyStoredSignal + one dispatch row
lib/readonly-readers.ts        STORED_READERS
```

The other **13 are comments or prose.** The distinction that mattered was
"created during the stored era" vs "owned by stored":

- `internals/commit-consequence.ts` — **SHARED, survives independently.**
  `link.ts:295` and `serialization.ts:1231` both call `scheduleDurableConsequence`
  with no involvement from `stored`.
- `internals/intercept-leaf-signals.ts`, `signal-tree.ts`, `restoration.ts` —
  the ordinary English verb.
- `error-reporter.ts`, `tree-realization-adapter.ts`, `devtools-impl.ts`,
  `serialization.ts` — historical prose naming a past producer.

### One structural consequence

`stored` was the **last non-entity marker** in the type resolvers. After its
removal `TreeNode`, `DeepEntityAwareTreeNode` and `EntityAwareTreeNode` dispatch
on `LoadingEntityMapMarker` and `EntityMapMarker` only; every other row is a
shape row. The `asyncQuery -> stored` migrated row in
`marker-resolution.typing.spec.ts` therefore becomes **vacuous, not orphaned** —
its subject is deleted with it. Re-pointing it at `entityMap` would fabricate
coverage, so it is retired with that reasoning recorded inline.

## MARKER-PAYLOAD-LEAK-0 — the invariant `stored-leak` was really carrying

Retiring `stored` reached a **preregistered hard stop**: a generic invariant
whose only carrier was being deleted, with evidence a surviving implementation
might violate it. `markers/stored-leak.spec.ts` stated it absolutely —

> a marker must never carry its payload into a snapshot

— and the surviving public marker holds `__entityMapConfig` as a **plain
enumerable property**, where `stored` had made `options` non-enumerable.

### The question was the marker-location contract, not the fix

Asking "should `__entityMapConfig` be non-enumerable?" presupposes the repair.
The prior question is where a marker declaration is _interpreted at all_.
Measured on both sides, with no casts in the type fixtures:

```text
position                  type semantics   runtime semantics   diagnostic
────────────────────────  ───────────────  ──────────────────  ───────────
root object property      marker           materialized        none needed
nested object property    marker           materialized        none needed
class-instance property   marker           materialized        none needed
array element             ordinary data    ordinary data       ST2021
tuple element             ordinary data    ordinary data       ST2021
Map value                 ordinary data    ordinary data       silent gap
Set member                ordinary data    ordinary data       silent gap
```

**Types and runtime agree on every row.** Nothing is a type _error_: a container
position resolves to the raw builder type, which is truthful — the declaration
is ordinary data there, and the editor says so.

### OUTCOME A. The contract already existed and was already documented

`ST2021` (`signal-tree.ts:414-458`, `docs/errors/README.md:82`) states it:
**"Markers belong at object positions."** Dev-mode, bounded scan, deduped. The
leaking path is not a supported marker use; it is a leaf holding an object, and
`tree()` containing it is `tree()` being correct.

### Severity, kept proportional to evidence

The forced probe injected a field the public API cannot produce. With **every**
public config field populated, including closures capturing a secret, the same
position yields:

```json
{ "list": [{ "__isEntityMap": true, "__entityMapConfig": { "hooks": {} }, "__computedSlices": {} }] }
```

No application data. The reason is structural, and is the real difference from
`stored`:

- public `EntityConfig` is **five optional FUNCTIONS** — `selectId`,
  `sortComparer`, `hooks.{beforeAdd,beforeUpdate,beforeRemove}`;
- `loader()` — the only route to `persist: { adapter }`, the one
  `EntityStorageAdapter` shape that _could_ carry data the way `stored`'s
  `Storage` did — is **not exported from any entry point**, and core's
  `exports` map has no subpath;
- `entityMap` is the **only public declarative marker factory** (18 value
  exports; `form`/`compared`/`derived`/`loader`/`stored` are all internal).

So this is **marker payload exposure at an out-of-contract position**, not a
credential vulnerability. `stored`'s case was genuinely worse: its supported,
public options held a live `Storage` object with application contents.

### The invariant, narrowed and re-carried

> At **supported** marker positions, snapshots contain the MATERIALIZED VALUE
> and never the construction payload.

Carried by `lib/marker-location-grammar.spec.ts` (8 tests, over `tree()` and the
`persistence()` durable path) and the type negative
`lib/marker-location-grammar.typing.spec.ts`. Both mutation-controlled:

```text
M1  neuter warnMarkerInArray   -> grammar test FAILS
M2  isEntityMapMarker => false -> 4 tests FAIL (opacity + grammar)
```

`stored-leak.spec.ts`'s absolute wording is **retired as broader than the API it
protected**. Its subject-specific history is preserved as S1 in
`docs/audits/2026-08/14.0.0-capability-inventory.md`.

### Two items CHARACTERIZED, not fixed

1. **ST2021 diagnostic completeness — `MARKER-GRAMMAR-DIAGNOSTICS-0`.** Map and
   Set do **not** produce a wrong state outcome: they are out-of-contract marker
   positions and are correctly treated as ordinary data. The gap is diagnostic
   only — array/tuple misuse warns, the identical Map/Set misuse is silent. Held
   as characterized debt; preferred disposition is GREENFIELD-IMPLEMENTATION-0,
   which should derive diagnostics from the settled grammar rather than inherit
   today's array-specific scanner.
2. **`docs/errors/README.md:82` still names `stored()` and `status()`** as
   example markers. Both are retired; the line needs updating in the doc pass.

### A measurement error, recorded because it nearly became a finding

The first pass reported a type/runtime **disagreement** at class-instance
properties. There is none. The assertion was written against `$.h` — the branch
accessor — rather than `$.h.rows`, the actual marker position. The branch's type
was answering a different question. Both specs now pin the corrected result.

## Two reusable rules this earned

**INVARIANT CARRIER RULE.** Before deleting the last test attached to a retiring
primitive: state the invariant _without naming the primitive_, find a real
surviving carrier, or stop and disposition it. Never knowingly drop a live
invariant because its original carrier is being deleted. Of `stored`'s three
generic invariants, two had **stronger** surviving carriers — devtools-vs-durable
moved to `write-participation`'s `participation: 'inspection'`, owner/`treeId`
moved to Link, which obtains the registry unconditionally where `stored` spelled
it `context?.positionRegistry`. The third did not, and that is where deletion
authority stopped.

**VACUOUS vs ORPHANED.** An invariant whose _subject_ is deleted alongside its
carrier is vacuous — retire it and say why. An invariant whose subject survives
is orphaned — it must be re-carried or dispositioned. `stored`'s non-entity
marker resolution row was vacuous; `stored-leak` was orphaned. Re-pointing a
vacuous row at a surviving primitive fabricates coverage; dropping an orphaned
one loses it. They look identical at the point of deletion, and the only way to
tell them apart is to name the subject independently of the primitive.

## ANGULAR-OWNERSHIP-0 — the package boundary is itself a greenfield deliverable

Greenfield asks "does this belong in SignalTree?". That question is too coarse,
and answering it badly fails in two opposite directions: Angular integration
concerns sink into core, or every Angular application reinvents the same
lifecycle glue the library is uniquely placed to provide. The question is
three-way:

```text
CORE          defines truth
ANGULAR       binds that truth safely into Angular's runtime
APPLICATION   decides what the truth means for this product
```

Placement in the greenfield program:

```text
MIGRATION-CLOSE-0 -> GREENFIELD-CONTRACT-EXTRACTION-0 -> ANGULAR-OWNERSHIP-0
                  -> GREENFIELD-IMPLEMENTATION-0 -> DEMO-COVERAGE-0
```

`ANGULAR-OWNERSHIP-0` does not add APIs. It answers where responsibilities
belong, and its output is a matrix with one row per public capability.

### The mechanical test

| Question                                                                                   | Owner                 |
| ------------------------------------------------------------------------------------------ | --------------------- |
| Would this semantic exist identically in React, Vue, Node or vanilla TS?                   | core                  |
| Does this exist because Angular has DI, `DestroyRef`, injection contexts, Angular Signals? | `@signaltree/angular` |
| Does this encode a backend, domain, UX, storage format, or retry policy?                   | application           |

Two sharper heuristics, applied in this order:

- **If two well-designed Angular applications could reasonably want different
  behaviour, it is application policy** — however common the choice.
- **If every correct Angular application must perform the same ceremony to
  preserve a SignalTree invariant, that is an Angular-package candidate.**

A third column is required in the matrix: _would three independent Angular apps
reimplement this identically?_ Yes is strong evidence for the Angular package;
divergence caused by product choices sends it to the application.

### Two frozen constraints

> **Framework adapters may remove framework ceremony; they may not erase core
> semantic boundaries.**

An Angular helper may make lifecycle, DI and interop convenient. It may not make
an unowned Angular signal satisfy the owned-location contract that `link()`
enforces. Make the correct path easy; never hide the ownership violation.

> **`@signaltree/angular` must never become a junk drawer for what felt too
> opinionated for core.**

A feature earns that package because _Angular creates the requirement_, not
because it is used in an Angular application. Acceptance criterion for the whole
greenfield: for every public capability we can say not only why it exists, but
why it lives in that layer rather than one above or below.

### ⚠️ MEASURED CORRECTION TO THE PREMISE

The three-way split describes core as a _framework-neutral_ engine. **Today's
core is not that**, and the phase must be designed around the real starting
point rather than the intended one. Measured at `a78696e5`:

```text
26 of 107 production files import @angular/core
most-used: computed(44) signal(24) isSignal(10) effect(9) linkedSignal(7)
```

Angular signals are not a dependency of the engine, they ARE the engine's
reactive substrate. So the first row of the mechanical test, read literally,
would classify core's own reactivity as non-core — which is incoherent. The rule
needs restating for this repo:

> Core may depend on Angular's **reactive primitives**. It may not depend on
> Angular's **runtime**: DI, injection contexts, lifecycle, components.

Making core genuinely framework-neutral is a separate and much larger decision
(replacing the reactive substrate), not a package-boundary question. It should
not be smuggled in under `ANGULAR-OWNERSHIP-0`.

### The Angular-runtime coupling that already exists in core

Under the restated rule the category is not hypothetical — it is already
populated, and it is small enough to enumerate exactly. Three files, four sites,
all adjacent to public API:

```text
lib/utils.ts:240          runInInjectionContext + Injector + effect
                          (backs the PUBLIC toWritableSignal, index.ts:175)
lib/define-store.ts:131   inject(DestroyRef).onDestroy(...)
                          (backs the PUBLIC defineStore)
markers/entity-loader.ts:319  inject(DestroyRef, { optional: true })
```

Everything else Angular-shaped in core is reactivity. So
`ANGULAR-OWNERSHIP-0`'s first job is an inventory of _existing_ runtime coupling,
not only a decision about where new helpers go.

Two consequences worth recording now:

- `defineStore` already binds teardown to `DestroyRef`. The "every Angular
  consumer hand-codes `destroyRef.onDestroy(() => l.dispose())`" hazard is
  therefore partly precedented inside core, which is evidence both that the
  ceremony is real and that core is currently the wrong owner of it.
- `toWritableSignal` already _warns at runtime_ when called outside an injection
  context. A public core API whose correctness depends on Angular's injection
  rules is the clearest single instance of the misplacement this phase exists to
  find.

### Audit areas, and the exclusion list

In scope: lifecycle (`DestroyRef`, Link disposal, subscription cleanup); DI
(providers, tokens, injection-context requirements, provider-scoped lifetime);
Angular Signal interop (readable exposure, computed interop, ownership-safe
writes); Angular-lifecycle-managed Observable integration (generic RxJS is not
Angular-specific and does not qualify); the Angular-specific half of
SSR/hydration only; change detection/scheduling **only if measured to require
library support**; and TestBed-specific helpers, which would belong in
`@signaltree/angular/testing` while core semantic fixtures stay in core.

Explicitly application-owned, however common in Angular apps: HTTP clients,
REST/GraphQL policy, auth, storage selection, localStorage/IndexedDB schemas,
persistence codecs, migration and version policy, retry/backoff, cache freshness
and SWR policy, business validation, routing, error/toast UX, analytics, feature
flags, domain forms.

The persistence work makes the line concrete. An Angular helper that disposes a
Link with `DestroyRef` is a library candidate. An Angular helper that persists
settings to `localStorage` under `"settings-v3"` with a 250 ms debounce is
application territory — and PERSISTENCE-DECOMPOSE-0 already proved the frozen
Link API expresses it without core involvement.

### Repository state this phase inherits

`packages/angular` **does not exist**. Only `core` and `shared` carry package
manifests at `a78696e5`; `authoring`, `events` and `ng-forms` are directories
without their own published manifest. So this is a layer to be _designed_, not a
package to be tidied — which is the right position to be in before greenfield.

## ⚠️ CORRECTION — the rekey evidence was wrong; the conclusion survives

`48ad4e4a`'s commit message and a comment in `link.ts` claimed:

> rekey measured `path: 'rows.1'` carrying `v.id === 77` — the path holds the OLD
> key while the value holds the NEW one, and no `structuralEffect` is emitted.

**Every particular of that is false.** It was not a rekey. `updateOne(1, { id: 77 })`
merely merges a field named `id` into a row's payload; the collection index is
untouched, and that is DOCUMENTED behaviour — `types.ts:972` states outright that
a row's own `id` field may disagree with its key once `changeId` has moved it.
Measured after `updateOne(1, { id: 77 })`:

```text
all()      [{"id":77,...},{"id":2,...}]     payload changed
ids()      [1, 2]                           index UNCHANGED
has(1)     true       has(77)  false
```

So the earlier "two rows with the same id, no error" reading was also wrong: keys
`1` and `2` remain distinct; only two payloads happen to carry the same `id`
value, which is meaningless data.

### The real rekey, measured

`EntitySignal.changeId(from, to)` is the rekey operation. `changeId(1, 77)`:

```text
path                rows.77                        the NEW key
v / prev            {id:1,name:'a'} (identical)    payload UNTOUCHED
subjectIds          [1]                            stable subject
structuralEffect    { kind:'rekey', subject:1, beforeKey:1, afterKey:77 }
ids()               [77, 2]                        index MOVED
has(1) false        has(77) true
```

And the collision policy is explicit rejection, not silent corruption:

```text
changeId(1, 2)  ->  throws "Cannot change id to 2: already in use"
```

### What this changes, and what it does not

The **conclusion is unchanged**: an entity projection must be keyed on SubjectId,
never on key or path. But it now rests on sound evidence rather than an artefact:

- `structuralEffect { kind:'rekey', subject, beforeKey, afterKey }` states the
  address transition and the stable subject explicitly.
- Independently, a removed key that is later re-added receives a **NEW**
  SubjectId — measured: remove key 1 (subject 1), add key 1 again → subject 3,
  with `afterSubject`/`beforeSubject` ordering carriers on both events. A key is
  therefore not a lifetime, which forbids `Map<Key, Row>` regardless of rekey.

The entity projection is in fact **easier** than reported: rekey is a first-class
structural effect carrying complete information, not a silent payload mutation to
be inferred.

### The methodology failure

The probe exercised `updateOne` with an `id` in its patch and assumed that was
the rekey path, because the source contained `kind: 'rekey'`. The presence of a
mechanism in the source was taken as proof that the operation reached it. The
missing step was a CONTROL asserting the index actually moved — `ids()` would
have shown `[1,2]` immediately. This earns:

> **OPERATION-REACHED-MECHANISM CONTROL.** When measuring a named mechanism,
> assert that the operation under test actually reached it. Finding the mechanism
> in the source and finding an operation whose output looks related are two
> different facts. Prefer asserting the mechanism's own observable effect (here,
> the moved index) over inferring it from a plausible payload.

## ENTITY-PROJECTION-BASELINE-IDENTITY-0 — OUTCOME B

The required information exists, but not at the boundary a Link can reach.

`StructuralStore` (`lib/physical/structural-store.ts`) already provides
everything a seed needs, in O(n):

```text
activeKeysSnapshot(): readonly K[]        ORDERED active keys
subjectIdForKey(key): number | undefined  key   -> SubjectId
activeKeyForSubject(subject): K | undefined  SubjectId -> current key
```

Ordering is guaranteed **by construction, not by coincidence**:
`getProjectedEntries()` builds `all()` by iterating `activeKeysSnapshot()`, so a
seed built the same way cannot diverge from `all()`'s order. The store maintains
an explicit linked list (`ActiveNode.prev/next`), which is the carrier
`beforeSubject`/`afterSubject` refer to.

What the materialized `EntitySignal` exposes is NOT sufficient:

```text
__subjectIds            the LAST operation's subjects only, and gated on a
                        `subjectMetadataEnabled` capability flag
__findKeyBySubjectId    the reverse direction (subject -> key)
```

So this is Outcome B: design the smallest INTERNAL seed — conceptually
`ordered [{ subjectId, row }]` — reusing the exact `getProjectedEntity(key)` path
`all()` uses so the seed and the public value cannot diverge. `SubjectId` is not
exposed publicly, and no `Map<Key, Row>` bootstrap is used at any point.

## ENTITY-INSPECTION-TOPOLOGY-0 — measured

Scalar and branch inspection contaminates a VALUE at a location that keeps
existing. Entity inspection can change **which lifetimes exist**, so local and
egress-eligible topology can diverge. Measured before writing any reducer.

### T0 — the production path reaches the entity mechanisms

The `OPERATION-REACHED-MECHANISM` control, applied to the mechanism this phase
is about to implement against. A real `applyState` scrub inside the production
DevTools write context decomposes into the same subject-addressed vocabulary the
synthetic probes use:

```text
rows.1  subj[1]     part:inspection  se:{kind:remove, subject:1, afterSubject:2}
rows.2  subj[2]     part:inspection  se:null   v:{id:2,name:'b'}
rows.3  subj[3]     part:inspection  se:{kind:add, subject:3, key:3, beforeSubject:2}
rows    subj[1,2,3] part:inspection
```

So synthetic inspection operations are valid proxies for the production scrub.

### T5 — routing needs no address metadata

After an inspection `changeId(1, 88)`, a later authored update at the new local
address arrives carrying `subjectIds: [1]` — it names the subject directly. The
projection therefore never looks up an address to route an event, and the seed's
`key` is needed for BOOTSTRAP only, not steady state.

### T6 — VACUOUS

The only order-affecting public operations are `prependOne`/`prependMany`, which
add rather than reorder. No independent reorder operation exists to characterize.

### T3 / T4 — the two cases that stopped implementation

```text
T3  eligible [S1] · inspection add S2 · authored update S2
    the authored event carries subjectIds:[2] and a complete row, but NO
    structural effect and NO ordering carrier. S2 is not in the eligible
    projection, so adopting it would mean inventing an insertion position that
    no eligible operation ever specified.

T4  eligible [S1@1, S2@2] · inspection remove S1 · authored add S3@1
    the authored add DOES carry a full structural effect with ordering, and
    S3 != S1 correctly. But applying it to a projection that still holds S1
    yields TWO live subjects at key 1 — an internally invalid collection, in a
    system that rejects key collisions outright (`changeId(1,2)` throws).
```

Both were referred for ruling rather than decided by the reducer's control flow.

## THE ORDERING CARRIER — a misreading, caught by measurement

`beforeSubject` and `afterSubject` are **NEIGHBOUR DESCRIPTORS, not insertion
directives**:

```text
operation                effect                              result
addOne D onto [1,2,3]    beforeSubject: 3                    [1,2,3,4]
prependOne D             afterSubject: 1                     [4,1,2,3]
remove FIRST             afterSubject: 2                     (no predecessor)
remove MIDDLE            beforeSubject: 1, afterSubject: 3   (both neighbours)
remove LAST              beforeSubject: 2                    (no successor)
add into empty           neither                             [1]
```

`beforeSubject` is the subject immediately BEFORE this one — its PREDECESSOR.
So an add inserts AFTER `beforeSubject`, or BEFORE `afterSubject`, or is the
only element.

⚠️ The earlier T4 note read `beforeSubject: 2` as "insert before subject 2",
which would have built eligible order backwards on every append. The measured
local order disproved it immediately. Pinned permanently in
`entity-order-carrier.spec.ts`.

### A second inference error in the same pass

The permanent assertions first used `not.toHaveProperty('beforeSubject')` for
the end-of-collection cases, because the key was absent from the probe's
`JSON.stringify` output. It is not absent — it is present and `undefined`, and
`JSON.stringify` omits undefined values. Absence from serialized output is not
absence from the object. The assertions now check the VALUE.

Both errors share a shape worth naming alongside
`OPERATION-REACHED-MECHANISM CONTROL`:

> **READ THE OBSERVATION, NOT ITS RENDERING.** A probe's printed form is a lossy
> projection of the thing measured — `JSON.stringify` drops `undefined`, key
> order is not insertion order, and a name is not a semantic. Assert against the
> value, and confirm a vocabulary's meaning against an observable outcome rather
> than against what the identifier sounds like.

# THE OBSERVATION SUBSTRATE BRANCH

Everything below was reached while trying to give `serialization()` the
inspection-egress invariant that Link already carries. It ended somewhere else
entirely: three previously unknown public-contract defects in `link()`, and a
measured design for the substrate that fixes them.

**No production code changed in this branch.** Every prototype was env-gated
scratch, measured, and reverted; probe files are preserved in the session
scratchpad.

```text
production-code baseline   15a8cd67
current clean HEAD         this record and its successors
commits since baseline     DOCUMENTATION ONLY
```

⚠️ `15a8cd67` is the last production-code checkpoint, NOT current HEAD. Reverting
"back to the clean checkpoint" through the documentation commits would erase the
only repository evidence that any of this was discovered.

## How it started: serialization has no metadata-bearing observation

`persistence()` publishes `tree()` — current observable state — so a DevTools
scrub becomes durable. Measured at 120ms, past the 100ms autosave poll; a 20ms
observation had wrongly reported it excluded (see TEMPORAL-ABSENCE CONTROL).

The fix could not be applied, because the enhancer has nowhere to apply it:

```text
tree.subscribe(fn)          fn: (state: T) => void   — no metadata at all
poll tree() by reference    — no metadata at all
scheduleDurableConsequence  — write context already lost
```

Link had a path-notifier subscription carrying `meta`; serialization has
nothing. And its entity snapshot grammar `{ all: Row[] }` defeats generic
whole-tree path patching, which is what forced SOURCE-ADAPTER-EXTRACTION-0
earlier than planned.

## What the capability probe found instead

Giving serialization a notifier subscription requires the tree to emit at all —
and a plain tree emits **nothing**:

```text
signalTree({user:{name:'a'}})  ->  t.$.user.name.set('b')  ->  0 notifications
```

That is capability-gated. And the capability graph decomposes exactly along two
previously unnoticed defects:

```text
'mutation-capture':  []                                         atomic
'position-topology': []                                         atomic
'causal-runtime':    ['mutation-capture', 'position-topology']  implies both
```

| tree capabilities        | scalar            | branch     | entity |
| ------------------------ | ----------------- | ---------- | ------ |
| _(bare)_                 | **throws**        | `[]` inert | works  |
| `position-topology` only | constructs, inert | —          | —      |
| `mutation-capture` only  | **throws**        | —          | —      |
| both                     | works             | works      | works  |

**`causal-runtime` is NOT the required substrate.** It merely implies the pair
and adds transaction/restoration machinery no consumer here needs. Every Link
conformance suite in the repo composes `transactions()`, which is why this was
invisible: "Link is green" meant "green with causal-runtime present."

## THREE PUBLIC-CONTRACT DEFECTS IN `link()`

### `LINK-BARE-SCALAR-0` — false unowned-location rejection

```ts
const tree = signalTree({ x: 0 });
link(tree.$.x, endpoint); // throws "X must be an owned SignalTree location"
```

`tree.$.x` **is** an owned location. Leaf registry attachment is gated on
`position-topology` (`signal-tree.ts:161`), so `getPositionRegistry` answers
nothing and the guard rejects a legitimate source.

⚠️ FAIL-CLOSED IS NOT PROOF OF CONTRACT CORRECTNESS. A guard can reject safely
and still be wrong, when the operation is inside the supported contract.

### `LINK-BARE-BRANCH-0` — silently inert relationship

```ts
const tree = signalTree({ s: { theme: 'light' } });
const l = link(tree.$.s, endpoint); // constructs happily
tree.$.s.theme.set('dark');
await l.settled(); // resolves
// endpoint received nothing. Ever.
```

The branch accessor gets its registry unconditionally (`signal-tree.ts:399`), so
construction succeeds; leaf writes are wrapped only under `mutation-capture`
(`:165`), so nothing is ever observed. Fail-open, and the most dangerous of the
three.

### `LINK-ROOT-SOURCE-0` — type-accepted, always broken

A cast-free `link(tree.$, endpoint)` **typechecks**, and no test in the repo
exercises it. At runtime it fails in BOTH configurations, by DIFFERENT
mechanisms:

```text
bare              "X must be an owned SignalTree location"
+ causal-runtime  "x is not a function"
```

The second proves this is not the scalar ownership defect wearing a different
hat — the NaturalValue path assumes a callable source. Dispositioned separately;
it must not be folded into the substrate work.

## Why the obvious fixes were rejected, in order

### BASE-OBSERVATION-COST-0 — CLOSED, COST-C

Making the capability pair baseline was measured against a tree with NO
consumer — no Link, no persistence, no transactions:

```text
construction, 100 scalar leaves   ~+113%
ordinary leaf write               ~+150%
nested leaf write                 ~+161%
```

Rejected. The tax lands on the write hot path, paid by trees that never use it.
(Memory was measured without forced GC and is therefore UNMEASURED; the entity
result showing a speedup is noise and non-actionable.)

### LAZY-OBSERVATION-INSTALL-0 — CLOSED, LAZY-E

Retrofit after construction. Ownership retrofit works and preserves identity —
`definePositionRegistry` is a configurable `defineProperty`, and
`wrapOwnedWritableSignal` mutates `set`/`update` in place rather than replacing
the object. With a real position id supplied, an already-held handle emits and
`link()` works.

But with that positive control in place:

```text
fresh x.set     -> 1 event
pre-held set    -> 0 events      (captured before the retrofit)
```

Rejected. See ESCAPED-CALLABLE RULE.

⚠️ An earlier run of this same probe reported `0 / 0` and proved nothing — the
retrofit itself was broken because `emitOwnedMutation` returns early without
`positionIds[0]`. A discriminator without a working positive control is not a
discriminator.

## THE SUBSTRATE THAT SURVIVED — `DORMANT-OBSERVATION-HOOK-0`

Characterized across four phases: `DORMANT-OBSERVATION-HOOK-0` (the mechanism
and its cost), `OWNER-DISCOVERABILITY-0` (activation from the source alone),
`SOURCE-OBSERVATION-ACTIVATION-0` (branch, scope, fanout) and
`OBSERVATION-LIFECYCLE-0` (claims, disposal, position identity).

```text
ordinary leaf
  ├── tiny owner seed: registry + ownerPath          (branches/entities already have it)
  └── STABLE dormant write path, installed at construction
              │  inactive  -> raw write, no observation work
              │  armed     -> observe
              ▼
      position identity, allocated LAZILY on first activation
              ▼
      one shared mutation publication -> PathNotifier
              ▼
      many consumers, each owning its authority projection
```

Characterized across four phases, all green:

|                                   |                                                                                                                                            |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| escaped-callable semantics        | pre-held `set` AND `update` observed after arming                                                                                          |
| inactive write cost               | no material regression measurable in the discriminator; the measurable cost sits on construction (~+18% seed, ~+32% seed+hook, 100 leaves) |
| owner discovery from source alone | registry + ownerPath suffice; no tree/sibling argument                                                                                     |
| branch activation                 | reaches PRE-EXISTING descendants — and `DESCENDANT-MATERIALIZATION-0` proves ordinary state cannot arrive later                            |
| source scoping                    | verified physically AND behaviourally                                                                                                      |
| notifier fanout                   | one publication, many consumers                                                                                                            |
| activation lifecycle              | claim-based; idempotent disposal                                                                                                           |
| position-id lifetime              | **POS-A** — one per source lifetime, retained across disarm/rearm                                                                          |
| memory                            | **UNKNOWN**                                                                                                                                |

`OBSERVATION-LIFECYCLE-0`, with Link itself claiming and releasing rather than
a manually pre-armed source:

```text
before any link   {claims:0,               armed:false}
link A            {claims:1, positionId:1, armed:true }
link B            {claims:2, positionId:1, armed:true }   no second identity
  one write       publications=1  A=[1,2] B=[2]
dispose A         {claims:1, positionId:1, armed:true }
dispose A twice   {claims:1, positionId:1, armed:true }   idempotent
dispose B         {claims:0, positionId:1, armed:false}   returns DORMANT
  dormant write   value=4  publications=0
link C            {claims:1, positionId:1, armed:true }   same identity
  write via the ORIGINAL pre-held callable  ->  endpoint [5]
```

`L4` is the economic point: a temporary Link must not convert "pay when
observed" into "pay forever after first observation."

## `DESCENDANT-MATERIALIZATION-0` — the late-descendant question, MEASURED

`SOURCE-OBSERVATION-ACTIVATION-0` proved that an ancestor claim arms descendants
**that already exist**. It left open whether a descendant can first materialize
AFTER its ancestor is claimed — in which case the one-shot recursive walk in
`acquireObservation` would be insufficient and nothing would propagate the claim.

Measured by tracing actual `finalizeLeafSignal` execution, not proxy rendering:

```text
--- constructing, no access yet ---
[LEAF] settings.theme
[LEAF] settings.units
[LEAF] top
--- construction returned ---
--- first access to settings.theme ---
(no [LEAF] trace — the object already existed)

[LEAF] a.b.c.d        deep nesting, also at construction
```

**MAT-A. Every ordinary leaf at every depth is created during construction.**
What looks late from the application's side is first ACCESS to an object the
ancestor's walk has already seen.

The second category — later STRUCTURAL creation of ordinary state — is closed
too. Both routes fail:

```text
tree.$.settings.set({theme, added})    TypeError: set is not a function
applyState({settings:{theme, extra}})  key absent, and NO [LEAF] trace fired
```

A branch accessor has no `.set`, and `applyState` with an unknown key neither
creates a leaf nor exposes one. Ordinary object shape is fixed at construction.

So `LATE-DESCENDANT-0` is **VACUOUS for ordinary state, in both categories** —
not missing coverage. The one-shot walk is sufficient because ordinary state
cannot appear after it. Entity structural additions are the third category and
are out of scope here: collections carry their own observation and work on a
bare tree.

⚠️ Recorded separately, unpursued, as `APPLYSTATE-UNKNOWN-KEY-0`:

> `applyState` currently ignores unknown ordinary object keys without
> materializing new state.

Deliberately NOT called a defect. Whether silent ignore is wrong is a
CONTRACT-BEFORE-DEFECT question, and answering it here would contaminate the
observation-substrate work with an unrelated contract dispute. No work on it in
this branch.

## COMPOSITION LAWS EARNED HERE

**POST-CONSTRUCTION CAPABILITY RULE.** A public operation invoked after tree
construction cannot depend on an optional construction-time capability unless it
can install that capability itself, or the requirement is explicitly part of the
public contract. `link()` satisfies neither, so an implementation-only
construction requirement cannot be retroactively called a valid precondition.

**ESCAPED-CALLABLE RULE.** Once a public callable has escaped to application
code, later correctness cannot depend on replacing the property it came from.
`CallableWritableSignal<T>` extends Angular's `WritableSignal<T>`, so `.set` is
part of the exposed writable object; a consumer may retain it.

**DORMANCY RULE.** If a future runtime consumer may require interception after
public callables have escaped, the interception point must exist before escape.
Expensive behaviour may remain dormant until activated.

**OWNER-DISCOVERABILITY RULE.** A post-construction operation that receives only
a source must reach every carrier it needs starting FROM that source. A proof
that borrows metadata from the tree or a sibling proves mutability, not public
activation reachability.

**OBSERVATION ACTIVATION FOLLOWS SOURCE SCOPE.** `link(a.b)` arms `a.b.deep` and
leaves `a.sibling` and `top` dormant. A relationship must not convert unrelated
state into observed state.

**SHARED OBSERVATION, SEPARATE AUTHORITY.** One physical mutation publication
serves many consumers; each owns its own eligible-authority projection. Fanout
is the notifier's job; activation ownership is a claim.

**UNIFY SEMANTICS, NOT REPRESENTATION.** Scalar, branch and entity need
different carriers. The bare inventory: a leaf has nothing, a branch already has
registry + ownerPath + ownerId, an entity has its own registry, the root has
none. Do not stamp identical metadata on every shape for symmetry.

## METHODOLOGY RULES EARNED HERE

**MEASURE THE PROPOSED MECHANISM, NOT AN INSTRUMENTED SURROGATE.** The dormant
hook first measured **+120.5%** and nearly died — because the prototype STACKED
a wrapper on an already-wrapped leaf. Integrated into the leaf's own
write path, no material regression was measurable. A benchmark falsifies an architecture only when the
measured execution shape preserves the mechanism's dispatch topology.

**FANOUT IS NOT LIFECYCLE.** Proving that multiple consumers receive one
physical event does not prove that activation ownership, final release, or
resource identity is correct. The fanout probe pre-armed manually; the lifecycle
question needed its own phase.

**FAIL-CLOSED IS NOT PROOF OF CONTRACT CORRECTNESS.** Complements
CONTRACT-BEFORE-DEFECT: first establish the subject is supported, then a false
rejection is itself a defect.

**STRUCTURAL EDIT CONTROL.** For broad automated edits, assert both the intended
anchor and adjacent preserved anchors, then trust the compiler's exit status
rather than a visual diff. A range-slice edit in this branch silently deleted
`held`/`retrievals` from `link.ts`; typecheck caught it, reading did not.

**SUBJECT-ADDRESS RULE.** Before interpreting a probe, prove the observation is
attached to the exact semantic subject under test — not its parent branch,
wrapper, projection or representation. Earned when a class-instance marker
position was read as a type/runtime disagreement: the assertion was on `$.h`,
the branch, rather than `$.h.rows`, the marker position. Both sides had agreed
all along.

**COMPOUND-OP SUCCESSOR RULE.** When decomposing or replacing a compound
operation, test the state before, the state after, AND the next valid operation.
`stored.clear()` looked equivalent after checking absence alone; the next
authored write revealed the missing lifecycle property — persistence remained
active. That is what makes `reset -> settled -> remove` correct and
`dispose`-based recipes wrong.

**VERIFY BY EXIT CODE, NOT BY PIPELINE.** `npm run typecheck | grep error | head`
reports `head`'s status, not the compiler's. Run the command, then read `$?`.

## PHASE STATUS

```text
BASE-OBSERVATION-COST-0          CLOSED — COST-C   (pair-as-baseline rejected)
LAZY-OBSERVATION-INSTALL-0       CLOSED — LAZY-E   (post-hoc replacement rejected)
OWNER-DISCOVERABILITY-0          CLOSED — GREEN
SOURCE-OBSERVATION-ACTIVATION-0  CLOSED — GREEN
    pre-existing descendants     GREEN
    source scope / nested scope  GREEN
    notifier fanout              GREEN
    late ordinary descendants    VACUOUS — MAT-A
OBSERVATION-LIFECYCLE-0          CLOSED — GREEN / POS-A
DESCENDANT-MATERIALIZATION-0     CLOSED — MAT-A

OBSERVATION-METADATA-FIDELITY-0  CLOSED — GREEN (F1/F2/F3/F4)
OBSERVATION-OVERLAP-0            CLOSED — OVERLAP-A
ENTITY-ACQUISITION-CONTROL-0     CLOSED — ENTITY-N (narrowed)
LINK-CONSTRUCTION-ACQUIRE-CLEANUP-0  CLOSED — GREEN
    -> OBSERVATION-SUBSTRATE-IMPLEMENT-0 unblocked on correctness
    -> retained memory required BEFORE final substrate freeze
```

`SOURCE-OBSERVATION-ACTIVATION-0` is closed. Do not reopen it for late
descendants: MAT-A settled that.

### `OBSERVATION-METADATA-FIDELITY-0` — the framing that matters

Named FIDELITY, not parity. The incumbent mutation-capture envelope is a
**characterization control**, not a specification to copy forward.

> **CHARACTERIZATION CONTROL != REPLACEMENT SPECIFICATION.** The question is what
> mutation MEANING the surviving carrier must preserve for real consumers and
> invariants — never which incumbent fields exist and could be copied.

Fields like `owner`, `path`, `ownerPath`, `before`, `after` and `participation`
have obvious semantic necessity. `kind` and `mutationIntent` do not: the
prototype hardcodes `'set'`/`'replace'` and nothing has yet shown a consumer
that depends on the distinction. Each field is classified REQUIRED / REDUNDANT /
DEAD TAXONOMY / UNKNOWN by tracing consumers — INVARIANT CARRIER applied to a
vocabulary rather than to a test. UNKNOWN is a stop, not a default to preserve.

## `OBSERVATION-METADATA-FIDELITY-0` — F2, the field classification

Traced by consumer, not by presence. The two fields whose necessity was genuinely
unknown resolve in opposite directions.

### `mutationIntent` — REQUIRED on the capture path; UNCONSUMED on the dormant one

⚠️ **PATH-SPECIFIC.** The classification below is correct for the incumbent
`mutation-capture` carrier. It does NOT transfer to the dormant substrate:
`transactions` and `restoration` are the only readers, both declare
`causal-runtime`, which implies `mutation-capture`, whose interception returns
from `finalizeLeafSignal` BEFORE the substrate installs. No configuration can
both use the dormant carrier and consume its `mutationIntent`.

```text
mutation-capture path    REQUIRED / consumed
dormant path             FIDELITY-PRESERVED, currently UNCONSUMED
```

The dormant carrier still reports `set -> replace` and `update -> derive`,
because it is semantically faithful and free — not because it repairs a
reachable defect there.

> **INVARIANT OWNERSHIP IS PATH-SPECIFIC.** A field being consumed on one
> producer path does not establish ownership for another, mutually exclusive
> producer path. Trace the consumer FOR THE PATH IN HAND.

#### The original capture-path finding

```text
leaf.set(v)       -> kind 'set'     mutationIntent 'replace'
leaf.update(fn)   -> kind 'update'  mutationIntent 'derive'
```

It travels inside `attribution`, so it reaches subscribers as `meta`, and it is
consumed:

```text
transactions.ts:249    if (laterEffect.mutationIntent === 'replace')
transactions.ts:743    combineScalarMutationIntent(existing, effect)
restoration.ts:2486    combineScalarMutationIntent(existing, effect)
restoration.ts:2611    mutationIntent: meta?.mutationIntent
```

And `combineScalarMutationIntent` makes **`replace` dominate `derive`**.

⚠️ The scratch arm hardcoded `'set'`/`'replace'` for BOTH operations, so every
`update()` was reported as a replace. On the CAPTURE path that would propagate,
since replace dominates in the combiner.

⚠️ **BUT THE PROPAGATION CLAIM DOES NOT APPLY TO THE DORMANT PATH**, as the
path-specific note above records. An earlier version of this section said the
error "PROPAGATES through accumulated effects" without that qualification. It
would — if a consumer could see it. On the dormant path none can. The fix is
still right; the severity was overstated.

The phase is still named FIDELITY rather than parity for a good reason: the
distinction had to be traced to a consumer before it could be classified at
all.

### `kind` — DEAD TAXONOMY on the notification path

`emitMutation` destructures the envelope and **never reads `kind`**:

```text
notify(path, after, before, ownerPath, subjectIds, positionIds,
       { ...attribution, structuralEffect }, ownerId)
```

`PathHandler` has no `kind` parameter, and the only `.kind` in `path-notifier.ts`
is `structuralEffect.kind` (add/remove/rekey), a different union. Only
`owned-mutation.ts:186` constructs an envelope, so there is no second path.

So `MutationKind` is not observable by any notification consumer. Classified DEAD
TAXONOMY **for the observation carrier** — deliberately not "delete the type",
which is a separate question about `MutationEnvelope` itself.

## `OBSERVATION-METADATA-FIDELITY-0` — F1/F3/F4, one semantic matrix

Run with the F2 defect CORRECTED in the scratch, so the arm receives the
operation and derives intent rather than hardcoding it. Eight cases, incumbent
carrier (`mutation-capture + position-topology`) against the dormant candidate,
comparing the actual notifier metadata rather than endpoint behaviour.

```text
                          intent    participation  origin
authored / set            replace   null           null      = =  both carriers
authored / update         derive    null           null      = =
inspection / set          replace   inspection     devtools  = =
inspection / update       derive    inspection     devtools  = =
realized / set            replace   realized       external  = =
realized / update         derive    realized       external  = =
devtools+authored / set   replace   NULL           devtools  = =
devtools+authored / update derive   NULL           devtools  = =
```

`path`, `ownerPath`, `before`, `after`, `mutationIntent`, `participation`,
`origin`, `intent` and position-id PRESENCE are identical in every cell.

**F3 green.** Participation attribution survives the dormant carrier across both
operations. ⚠️ Note the REPRESENTATION, which is not one literal per semantic
state:

```text
semantic state    notifier representation
authored          absent / null          (NOT a literal 'authored')
inspection        'inspection'
realized          'realized'
```

Both carriers represent it identically. This is a fact about the physical
encoding, not a change to the three-state semantic model — `getWriteParticipation`
already defaults absence to `'authored'`, and the runtime deliberately does not
materialize the default on every write. Carrier fidelity only — inspection
exclusion, eligible authority and complete acquisition remain consumer semantics
and were deliberately not exercised here.

**F4 green.** `origin: 'devtools'` with no inspection participation reports
`participation: null` in BOTH carriers. The rejected "devtools origin means
inspection" predicate is not re-encoded.

**F1 green, by classification rather than byte equality.** The only difference is
`ownerId`, which varies because each case constructs a fresh tree with a fresh
registry — REPRESENTATIONAL, and the closure criterion explicitly does not
require numeric position/owner identity across separately constructed trees. No
field was classified UNKNOWN, so there is no stop here.

The corrected `update -> derive` path is confirmed working, which closes the
loop on the F2 defect.

`OBSERVATION-METADATA-FIDELITY-0` is CLOSED. Remaining before implementation:
`OBSERVATION-OVERLAP-0`, `ENTITY-ACQUISITION-CONTROL-0`,
`LINK-CONSTRUCTION-ACQUIRE-CLEANUP-0`.

## `OBSERVATION-OVERLAP-0` — CLOSED, OVERLAP-A

Do claims compose when source scopes OVERLAP? Distinct from two links on the
same scalar, which `OBSERVATION-LIFECYCLE-0` already proved. Production-shaped:
Link acquires on construction and releases on dispose, no manual pre-arming, and
every handle and setter retained BEFORE either Link exists.

```text
tree: { settings: { theme, units }, outside }

O1  link(settings)              theme{claims 1, pos 1}  units{claims 1, pos 2}  outside{claims 0}
O2  + link(settings.theme)      theme{claims 2, pos 1}  units{claims 1}      no new identity
O3  write theme                 publications=1   A={theme:'dark',units:'metric'}  B=['dark']
O4  write units                 publications=1   A={...,units:'imperial'}         B=[]
O5  dispose PARENT              theme{claims 1, armed}  units{claims 0, DISARMED}
      write theme               publications=1   B=['solar']
      write units               publications=0   value mutates to 'metric'
O8  double-dispose parent       theme{claims 1}  — B's claim not stolen
O6  dispose CHILD               theme{claims 0, disarmed, pos 1 RETAINED}
      write theme               publications=0   value mutates
O7  child disposed FIRST        theme{claims 2 -> 1, STILL ARMED}  parent keeps
                                receiving the complete branch; then parent
                                dispose -> dormant
```

**OBSERVATION CLAIMS COMPOSE BY PHYSICAL LEAF.** Overlapping consumer scopes
share one physical installation, one identity and one publication; each claim
releases only its own ownership of each leaf.

`O4` is the one worth keeping in mind: a single publication feeds both
consumers, and the child correctly receives NOTHING for a sibling write. Scope
lives above the shared physical observation, not in it — which is what makes
SHARED OBSERVATION, SEPARATE AUTHORITY implementable rather than aspirational.

`O5` and `O7` are the mechanism discriminators. Releasing the parent disarms
`units` (nobody else claims it) while `theme` stays armed for the child; the
opposite order keeps `theme` armed for the parent. Neither direction gives a
claim priority over the other. `POS-A` holds here as no identity CHURN under
overlapping claims and retention after final disarm — `theme` keeps
`positionId 1` throughout. ⚠️ Reactivation with the same id was proved by
`OBSERVATION-LIFECYCLE-0`, not by this phase; do not attribute it here.

None of OVERLAP-B (duplicate installation), OVERLAP-C (release stealing another
consumer's leaf) or OVERLAP-D (identity churn) occurred.

## `ENTITY-ACQUISITION-CONTROL-0` — CLOSED, ENTITY-N (narrowed)

Two results, and only one of them is what the phase was looking for.

### The stop condition works, but its mutation control is a NO-OP

`getNodeProcessor()` — the marker subsystem's own `Symbol.for('SignalTree:MarkerProcessor')`
recognizer — is the right canonical stop: reused rather than duck-typed from
method names. With it, acquisition stops at the entity boundary (`stopped: ['']`
direct, `['rows']` nested), nothing under the entity is armed, and native
add/update/remove are still observed by a direct entity Link.

⚠️ **But removing the stop changes NOTHING measurable.** With `ST_STOP=off` the
generic walk recurses through `byId`, `all`, `asMap` and the mutators — and arms
exactly the same set: none. Those members are functions and computeds without an
`__arm`, so `claimLeaf` declines them and the recursion finds nothing to claim.

So the E2 control does not cross an authoritative checker. The hypothesis
**"generic recursion would instrument entity internals" is REFUTED for the
current representation**, not merely unproven — and the phase is closed by
NARROWING rather than by inventing a harmful surface to justify a design
preference.

### ENTITY-N, the frozen narrow result

```text
direct entity source           native observation works
ordinary claims beneath entity NONE
same, with the stop REMOVED    NONE
ancestor branch                receives the native entity publication
```

> **ENTITY OBSERVATION REMAINS NATIVE.** Entity collections use their existing
> structural carrier and require no ordinary dormant leaf claims. Generic
> acquisition never needs to manufacture a second physical representation for
> entity state.

Do NOT freeze "generic recursion is harmful". It was measured benign with
respect to ordinary claims.

### ⚠️ And do NOT freeze `getNodeProcessor()` as the entity predicate

It is proven to be the marker subsystem's canonical MATERIALIZATION stamp. It is
NOT proven to mean _entity specifically_ — it may match other marker-processed
representations whose descendants DO require ordinary observation.

Since the stop has no demonstrated correctness necessity, a blanket
`if (getNodeProcessor(node)) return` must not go into production for symmetry or
defence. If a stop is wanted for traversal cost or blast radius, first establish
an entity-specific discriminator, or prove every marker-processed node owns an
independent observation representation. OWNERSHIP-BEFORE-ADOPTION.

### ⚠️ `LINK-BRANCH-NESTED-ENTITY-0` — A REGRESSION I INTRODUCED, not a pre-existing defect

⚠️ **CORRECTION. This was recorded as a pre-existing source-interpretation
defect. It is neither.** Bisected against `48ad4e4a~1`:

```text
before 48ad4e4a  {"title":"x","rows":{"all":[{"id":1,"n":"a"}]}}   CORRECT
after  48ad4e4a  {"title":"x","rows":{"1":{...},"all":[]}}         MALFORMED
```

It is a REGRESSION introduced by the scalar/branch eligible projection in
`48ad4e4a` — my own change. "Reproduced on production code, no scratch involved"
was literally true and materially misleading: the production code already
contained it.

**The mechanism.** A branch source's read is correct — `tree.$.dashboard()`
returns `{"title":"x","rows":{"all":[...]}}`, identical to `tree()`. The
malformation happens in the eligible projection: an entity mutation publishes at
path `dashboard.rows.1`, which passes the branch Link's owner and path-prefix
filter, and `applyAtRelativePath` then patches it BY PATH into the branch
snapshot — creating `rows["1"]` while the entity's own `all` stays stale.

So the projection treats a nested entity node as ordinary path-addressable
structure. That is the same category error the collection gate in
`advanceEligible` was written to prevent for a DIRECT entity source, and it was
never extended to an entity nested INSIDE a branch source.

Found while proving that stopping recursion does not blind an ancestor. It does
not — the parent DOES receive a publication. What it receives is malformed:

```text
link(tree.$.dashboard) after rows.addOne({id:1,n:'a'})

branch link value  {"title":"x","rows":{"1":{"id":1,"n":"a"},"all":[]}}   WRONG
tree() says        {"title":"x","rows":{"all":[{"id":1,"n":"a"}]}}        correct
rows.all()         [{"id":1,"n":"a"}]                                     correct
```

The branch's `read()` enumerates the entity node's own keys instead of using its
snapshot, producing a phantom `"1"` key AND an empty `all` — wrong in two
directions at once. `tree()` and `all()` are both correct, so this is specific to
the value a branch Link publishes.

Severity is real: **`link()`** on a branch containing a collection externalizes
truth that round-trips to an EMPTY collection.

⚠️ **Only `link()` was reproduced.** An earlier draft of this record also named
`persistence()`. That was an overclaim — architectural adjacency is not a traced
dependency. Other consumers are affected ONLY if they reuse this branch
source-interpretation mechanism, and that has not been established. When
serialization resumes, trace whether its value production invokes this same
branch NaturalValue path before assuming it inherits the defect.
STRUCTURAL REFERENCE != CAUSAL DEPENDENCY.

It is NOT a source-interpretation defect and does NOT share a cause with
`LINK-ROOT-SOURCE-0`. It lives in the authority projection, above interpretation
and below the endpoint.

### It does not gate the substrate

The observation carrier did its job: the entity mutation published natively and
the ancestor Link WAS notified. The corruption happens afterwards, when the
branch's complete value is interpreted. That localization is itself evidence
that observation and source interpretation are genuinely separate
responsibilities rather than two words for one thing:

```text
entity mutation -> native publication -> ancestor notified   GREEN
                                      -> branch value built  DEFECT
```

So it does not block `OBSERVATION-SUBSTRATE-IMPLEMENT-0`. It DOES block any
claim of general branch-Link NaturalValue correctness, and must be resolved
before final Link public-contract closure.

Dispositioned separately, unpursued here. It belongs with `LINK-ROOT-SOURCE-0`
as a source-interpretation defect rather than an observation-carrier one.

## `LINK-CONSTRUCTION-ACQUIRE-CLEANUP-0` — CLOSED, GREEN

The last planned correctness gate: does acquisition survive the failure and
edge paths of Link construction?

```text
C1 empty-endpoint refusal        threw, claims 0, not armed     no leak
C2 unowned-source refusal        threw, claims 0                no leak
C3 construct + dispose, no write claims 0, disarmed             clean
C4 25 construct/dispose cycles   claims 0, ONE distinct positionId
C5 dispose DURING in-flight send claims 0, disarmed; post-dispose write silent
C6 one link refused, one holding survivor keeps claims 1, armed
```

Both refusals happen BEFORE acquisition — the registry guard and the
empty-endpoint guard precede `accessorsFor` — so a rejected `link()` cannot
strand a claim. `C6` proves a refusal does not disturb an unrelated surviving
relationship.

`C4` is the one worth keeping: twenty-five complete relationship lifecycles
leave zero claims and exactly ONE position identity. POS-A holds not just across
one arm/disarm/rearm but across repeated independent relationships on the same
source — no accumulation, no identity churn, no slow leak.

`C5` closes the interaction between disposal and an unresolved send: the claim
releases, the source disarms, and a post-dispose write mutates state while
publishing nothing.

## ALL PRE-IMPLEMENTATION GATES ARE NOW GREEN

```text
escaped-callable semantics       GREEN
inactive write cost              GREEN
owner discovery from source      GREEN
branch activation                GREEN
source scoping                   GREEN
late descendants                 VACUOUS — MAT-A
notifier fanout                  GREEN
activation lifecycle             GREEN
position-id lifetime             GREEN — POS-A
metadata fidelity                GREEN
claim composition under overlap  GREEN — OVERLAP-A
entity acquisition               GREEN — ENTITY-N (narrowed)
construction / cleanup           GREEN
memory                           UNKNOWN — required before final freeze
```

`OBSERVATION-SUBSTRATE-IMPLEMENT-0` is unblocked on correctness. Two source
INTERPRETATION defects (`LINK-ROOT-SOURCE-0`, `LINK-BRANCH-NESTED-ENTITY-0`)
remain open and do not gate it; they gate any claim of general Link
NaturalValue correctness.

## `OBSERVATION-SUBSTRATE-IMPLEMENT-0` — LANDED

`link()` now works on an ordinary tree. `LINK-BARE-SCALAR-0` and
`LINK-BARE-BRANCH-0` are CLOSED.

```text
internals/observation-substrate.ts   stable interception + claim lifecycle
signal-tree.ts finalizeLeafSignal    installs it on leaves WITHOUT capture
link.ts                              acquires after validation, releases on dispose
```

Installed only where `mutation-capture` is absent — that path already
intercepts and returns earlier, and wrapping twice would publish twice.

17 permanent tests: `link-bare-contract.spec.ts` states the PUBLIC contract and
names no capability; `observation-substrate.spec.ts` covers lifecycle, claim
composition, cleanup and metadata fidelity.

**Cost.** No material ordinary write-hot-path regression was measurable in the
implementation discriminator (~0.054ms/10k scalar, ~0.055 nested, against a bare
baseline in the same range). Construction rose roughly +38% per 100 leaves
(~0.148ms against ~0.107) in this microbenchmark.

⚠️ Deliberately not stated as "indistinguishable" or "zero-cost": these runs
swing widely, and noisy equality must not be promoted into a guarantee. What the
evidence does support decisively is that COST-C — the ~+150% WRITE-path tax that
disqualified making the capability pair baseline — is avoided.

### Mutations

```text
M1 replace the method instead of a stable arm   11 tests fail
M2 update intent derive -> replace               1 test  fails
M4 final release leaves the source armed         2 tests fail
M5 reallocate position identity per activation   2 tests fail
M3 reinstall the arm on EVERY claim              SURVIVES
```

⚠️ **M3 survives, and it is not a coverage gap.** The arm is a SINGLE SLOT, not
a subscriber list, so reinstalling an equivalent closure is behaviourally
identical — there is no second publication to observe. No test was invented to
pretend otherwise.

So the frozen correctness properties are OBSERVABLE ones, not an implementation
branch:

```text
ONE stable interception point per physical leaf
ONE physical publication per mutation
claims compose by physical leaf
final release controls lifetime
```

NOT frozen: "the arm slot may only be assigned on the 0 -> 1 transition". That
guard is an efficiency property of this implementation.

### ⚠️ A NARROWING OF THE F2 CLAIM

The record earlier said the hardcoded-intent prototype defect "PROPAGATES
through accumulated effects". That overstates what can currently happen.

`mutationIntent` has exactly two readers, `transactions` and `restoration`. Both
declare `causal-runtime`; `causal-runtime` implies `mutation-capture`; and
`mutation-capture` returns from `finalizeLeafSignal` BEFORE this substrate is
installed. **So no tree that uses this substrate can have a `mutationIntent`
consumer.** The distinction is carried faithfully because it is correct and
free, not because it repairs a reachable defect.

That also means the consumer-level replace-vs-derive test cannot be written
against this substrate — only against the incumbent capture path, which already
had it right. `observation-substrate.spec.ts` asserts CARRIAGE and says so
inline rather than implying a behavioural dependency it does not have.

## `RETAINED-MEMORY-0` — MEASURED, with forced GC

The adoption discriminator, deferred throughout discovery and run against the
real implementation. `NODE_OPTIONS=--expose-gc`, heap settled with four
collections before every reading, baseline taken from a real git worktree at
`61243b92` rather than a feature flag.

⚠️ This supersedes the earlier `29.91 -> 174.09 KB/tree` figure, which was taken
from raw `heapUsed` deltas with no GC control and was recorded as UNMEASURED.

```text
                          baseline 61243b92   substrate   delta
MEM-1 scalar, per leaf          788 B          1232 B     +444 B
MEM-2 nested,  per leaf        1477 B          1895 B     +417 B
MEM-5 entity control       42301 B/tree   42282 B/tree      ~0
```

⚠️ **MEM-2's per-leaf figures are CORRECTED.** The fixture has SEVEN scalar
leaves (`d,e,f,g,j,k,l`) and the first pass divided its totals by eleven,
producing `940 / 1206 / +266`. The totals themselves were right; the denominator
was not.

The correction strengthens the result rather than weakening it: two very
different ordinary topologies now land within ~30 bytes of each other, so the
incremental cost is roughly **420–445 B per ordinary leaf** rather than the
incoherent `266–444` range the bad arithmetic produced.

⚠️ MEM-2 is also NOT yet a topology control: MEM-1 has 100 leaves and MEM-2 has
7, so leaf count and topology vary together. A 100-leaf nested fixture is needed
before topology can be read as the independent variable.

**MEM-5 is the attribution control and it works.** Entity-heavy trees show no
change, because entity nodes never receive the substrate. So the delta really is
per ORDINARY LEAF, not global tree overhead.

`MEM-3` — activate then release leaves **179 B/tree** residue, consistent with
POS-A deliberately retaining position identity for the source's lifetime.

Baseline `MEM-3`/`MEM-4` could not run at all: `link()` on a bare scalar THREW
there. That is the defect this substrate fixes, showing up as an inability to
measure.

### MEM-4 — bounded, not linear

The question that decides MEM-C:

```text
  10 cycles/tree   592 B/tree   59.24 B/cycle
  50 cycles/tree   277 B/tree    5.54 B/cycle
 250 cycles/tree   251 B/tree    1.00 B/cycle
```

25x the cycles yields LESS residue, and per-cycle cost converges toward zero —
the signature of a fixed residue over a growing denominator. **No retention
proportional to relationship count. Not MEM-C.**

### Verdict: MEM-B, with a MEM-D component

Roughly **420–445 bytes retained per ordinary leaf** — about 42–45 KB for a
100-leaf tree, paid whether or not anything is ever observed. Real, bounded, and
structurally understood.

Part of it is genuinely representational rather than intrinsic. Each leaf
currently retains two bound raw callables, two replaced methods, the arm
variable, and a state record holding `{claims, positionId, slot, registry,
ownerPath}` — where `registry`, `ownerPath` and `slot` DUPLICATE information
already on the leaf via `definePositionRegistry`, `defineOwnedOwnerPath` and the
arm symbol. Reading those at claim time instead of caching them would shrink the
per-leaf record without touching any frozen semantic.

That optimization is NOT applied here. It is recorded so the adoption decision
is made against the honest number, and so the reducible portion is not mistaken
for an intrinsic cost of the design.

## `MEM-D-REDUCE-0` — applied, and honestly a small win

The per-leaf record dropped `slot`, `registry` and `ownerPath`, all of which are
already reachable from the leaf itself and are now read at CLAIM time — a rare
operation — rather than retained by every ordinary leaf forever.

```text
type LeafObservation = { claims, positionId }   // was: + slot, registry, ownerPath
```

Re-measured with a corrected fixture holding LEAF COUNT AT 100 in both
topologies, so topology is finally the independent variable:

```text
                    A baseline   B landed   C MEM-D    C - A     saved
wide   100 leaves     789 B       1232 B     1208 B    +419 B    24 B/leaf
nested 100 leaves     732 B       1148 B     1124 B    +392 B    24 B/leaf
entity control      42577 B/tree  42629      42629      +52 B    0
```

**The topology control now works.** With leaf count equal, wide and nested land
within ~27 B of each other.

⚠️ Stated as measured: the incremental retention is PREDOMINANTLY per ordinary
leaf, and no material topology dependence was measurable in the equal-100-leaf
wide-vs-nested discriminator. Two shapes are not every shape.

⚠️ **MEM-D bought 24 B/leaf — about 5% of the substrate's cost.** Worth taking,
and not the reduction the duplicated-state description might have implied. The
remaining **~390–420 B/leaf** is the mechanism itself: two bound raw callables,
two replaced methods, the arm closure, and a two-field WeakMap record. That is
what ESCAPED-CALLABLE and DORMANCY cost — interception has to exist before any
callable escapes, and it has to persist.

The entity control stays flat (+52 B/tree, ~0.1%), confirming the delta is not
global tree overhead.

Cost after the reduction is unchanged: ~0.054ms/10k scalar writes, ~0.054
nested, ~0.141ms construction per 100 leaves. Memory was not purchased with a
write-path regression.

### Adoption

The question was never "can this be free" — stable pre-escape interception
requires persistent per-leaf machinery by construction. It was whether, after
obvious duplication is removed, the remainder is intrinsic enough that another
architecture search would be unjustified.

It is. The two alternatives are already falsified by measurement: making the
capability pair baseline costs ~+150% on the WRITE path for every tree
(`COST-C`), and post-hoc installation cannot cover an escaped callable
(`LAZY-E`). The surviving ~400 B/leaf buys a `link()` that works on an ordinary
tree, and nothing cheaper has survived a falsifier.

```text
RETAINED-MEMORY-0     MEM-B, MEM-C refuted, MEM-D applied
observation substrate ADOPTED / ARCHITECTURE FROZEN
```

### What "frozen" does and does not mean

FROZEN: the stable dormant observation carrier is the v15 architecture, and the
permanent carriers pin its semantics. Reopening the architecture requires a NEW
falsifier, not the observation that the winning mechanism has a nonzero cost.

NOT FROZEN: the implementation's internal representation. A later profiling pass
may reduce closures, allocations or state layout **provided every permanent
carrier and frozen semantic still holds**. That is optimization against a frozen
contract, not architecture discovery.

Recorded as non-blocking future work: **`OBSERVATION-REPRESENTATION-PERF`** — the
`rawSet`/`rawUpdate` bound callables are the obvious next target. It must not
gate v15 sequencing.

> **REDUCE REPRESENTATION BEFORE REOPENING SEMANTICS.** When an architecture has
> survived its semantic falsifiers but carries measurable baseline cost, remove
> demonstrably redundant representation first. Do not reopen previously
> falsified semantic designs merely because the correct carrier is not free.

`MEM-D` is the canonical instance. The substrate cost ~443 B/leaf; the plainly
duplicated part came out for 24 B; the remaining ~400 B is the mechanism itself.
That is NOT a reason to revisit `COST-C` (baseline capabilities, ~150% write-path
tax) or `LAZY-E` (post-hoc interception, defeated by escaped callables) — both
were falsified on their own evidence, and neither becomes cheaper because the
survivor is not free.

## `LINK-ROOT-SOURCE-0` — the mechanism, measured

Re-measured after adoption; the substrate does not change it, because the
substrate installs on LEAVES and the root is not one.

```text
root registry   false
root ownerPath  null
typeof tree.$   'object'        ← NOT callable
root own keys   a,b

BARE  link(tree.$)   throws "X must be an owned SignalTree location"
CAPS  link(tree.$)   throws "x is not a function"
CONTROL link(tree)   throws "X must be an owned SignalTree location"
                     (typeof tree is 'function', but it carries no registry either)
```

Two independent causes, which is why the capability pair never fixed it:

1. **No owner carrier.** The root accessor gets neither a registry nor an
   ownerPath, so the ownership guard rejects it — the same shape as
   `LINK-BARE-SCALAR-0`, but at a node the substrate deliberately does not seed.
2. **`accessorsFor` assumes a callable source.** Its final branch is
   `read: () => (x as () => T)()`, and `tree.$` is a plain OBJECT. That is the
   `"x is not a function"` failure, and it is a SOURCE-INTERPRETATION defect
   independent of observation: supplying a registry would not fix it.

So a fix requires both an owner carrier for the root and a `NaturalValue`
interpretation that handles a non-callable whole-tree source. Neither is in the
observation substrate's scope, which is why this was kept separate.

## `LINK-BRANCH-NESTED-ENTITY-0` — REPAIRED

Handled as a REGRESSION against frozen semantics, not as a new architecture
question. Each collection nested inside a branch source now gets its own
`EntityEgressProjection` instance — the same algorithm a direct collection
source uses, with separate state — and its ELIGIBLE value is written into the
branch snapshot under the canonical `{ all: Row[] }` grammar.

```text
introduced   48ad4e4a
repaired     this commit
```

Nine permanent tests. `R1`–`R3` add/update/remove publish canonical values with
no phantom address key; `R4` keeps ordinary sibling path-patching working;
`R5` places a collection at deeper ordinary depth so no one-level `rows` special
case can pass; `R6` holds the direct collection source unchanged; `R8` keeps
`realized` eligible.

### ⚠️ R9 exists because a mutation survived

The tempting repair — "a collection changed, so re-read the branch" — produces
the correct SHAPE while destroying the reason the projection exists. `R7` was
written to catch it and **did not**: its later write was to a SIBLING, so a
re-read never fired, and the mutation passed all eight tests.

The hitchhike needs an authored COLLECTION event AFTER an inspection one:

```text
authored   add row 1 'authored'
inspection update row 1 -> 'SCRUBBED'
authored   add row 2 'second'

published   [{1,'authored'}, {2,'second'}]     correct
re-read     [{1,'SCRUBBED'}, {2,'second'}]     the scrub rides out
```

`R9` is that case, and it kills the re-read mutation alone. Recorded because a
shape-only assertion would have ratified the wrong repair — MECHANISM-
DISCRIMINATING CASE, and the reason M2 was worth running at all.

Mutations: reverting to path-patching beneath the collection fails 6; the
re-read fails R9 alone.

## `LINK-NONLEAF-SOURCE-INTERPRETATION-0` — closed, convergence NEGATIVE

The question was whether root and nested-collection failures shared one
defective non-leaf `NaturalValue` interpreter. They do not.

```text
                        ROOT    NESTED COLLECTION
observation              ok            ok
ownership carrier      MISSING         ok
NaturalValue interp    WRONG           ok  (never broken)
authority projection     ok          WAS WRONG  (ours)
```

The branch accessor's own read was correct throughout — `tree.$.dashboard()`
returns exactly what `tree()` does. Only the projection above it was wrong. So
`LINK-ROOT-SOURCE-0` stands alone, with its two independently measured causes,
and its scope is now smaller than when the convergence hypothesis was open.

## `LINK-ROOT-SOURCE-0` — CLOSED

Two independent causes, both repaired, which is why supplying the observation
capabilities never fixed it:

```text
owner carrier      tree.$ had no registry — capability-gated exactly as ordinary
                   leaves were. Attached unconditionally now, for the same reason
                   the substrate seeds leaves: a post-construction operation
                   cannot ask for a capability.

NaturalValue       accessorsFor fell through to a callable read and tree.$ is a
                   plain OBJECT. The root is now recognized FIRST and read
                   through its owning tree: tree() IS the whole-tree snapshot.
```

`tree.$` is the ADDRESS; the whole-tree snapshot is the VALUE. The root was NOT
made callable, arbitrary non-callable objects did NOT become readable, and no
new observation mechanism exists for the root — descendants are observed through
the adopted substrate exactly as for any branch.

Seven permanent tests: complete whole-tree egress, a descendant setter retained
BEFORE the link, owner isolation against a same-shaped sibling tree, inspection
exclusion with no hitchhike, realized eligibility, a collection inside the root
publishing canonically, and dispose ending the relationship.

Mutations: removing the owner carrier fails all 7; routing back through the
callable fallback fails all 7; replacing the eligible projection with a current
whole-tree re-read fails the inspection case ALONE — the same authority
discriminator R9 provides for nested collections.

### ⚠️ 876 failures, from one line

The first attempt recorded the owning tree as a SYMBOL PROPERTY on the root
accessor. That failed 876 tests. The tree closes over the accessor, so the
property creates a cycle the snapshot and unwrap walkers follow. A WeakMap
sidecar keeps the reference outside anything that enumerates the node, and the
same change then failed 1.

Bisecting was what made this cheap: the owner carriers alone failed 1, the
interpretation change alone failed 0, so the 876 had to come from the third
piece. Assuming the design was at fault would have been the expensive mistake.

### One characterization test flipped

`stored-owner-invariant-0.spec.ts` asserted `getPositionRegistry(tree.$)` was
UNDEFINED without enhancers, with a comment noting the attachment was
"enhancer-gated and ABSENT here". That is precisely the gating this phase
removes, so the assertion now expects it DEFINED. The test's own point — that
`stored()` takes its registry from the materialization context and reports
without enhancers — is unaffected.

### What root actually cost — `ROOT-COST-SCOPE-0`, answered by the diff

The question was whether root could be supported as a per-tree special case with
essentially no effect on ordinary source representation or hot paths. It is an
implementation-diff question, so it is answered by reading the diff rather than
by opening a phase:

```text
root-source.ts        47 lines, a WeakMap        ONE ENTRY PER TREE
signal-tree.ts        2 defineProperty + 1 set   ONCE PER TREE, at construction
link.ts               1 branch in accessorsFor   ONCE PER link() CALL
```

`accessorsFor` has exactly one call site and it is construction-time, so the root
check is one WeakMap lookup per relationship — never per write, per read, or per
notification.

⚠️ AND THE HONEST PART: ordinary leaves DID get heavier in this era, but not for
root. `installDormantObservation` per leaf belongs to the observation substrate,
which was adopted and frozen on its own measured evidence for bare scalar and
branch Link. Root neither caused it nor extended it. Attributing that cost to
root would make the case for root look worse than it is, and would also hide
which decision actually owns the memory.

## RULES EARNED — COST vs UNIFORMITY

> **UNIFORMITY MUST EARN ITS COST.** Prefer one semantic model, but do not
> require one physical representation when doing so imposes avoidable cost on
> the common case.

The distinction that makes it actionable:

```text
semantic uniformity          GOOD
representation uniformity    only good when cheap
```

`link()` must have ONE understandable contract — source, observation, eligible
authority, semantic value, endpoint. That does not require every source type to
pay for the same machinery. A healthy implementation is allowed to look like:

```text
scalar     optimized scalar path
branch     compose ordinary descendants
entity     native structural carrier
root       one per-tree special case
future     a specialized adapter, if justified
```

with all five obeying the same external semantics.

> **SPECIALIZE THE RARE CASE BEFORE TAXING THE COMMON CASE.**

> **SPECIALIZE RARE STRUCTURAL CASES OUTSIDE THE HOT REPRESENTATION.** If an
> uncommon semantic case needs metadata that would distort traversal or tax
> common nodes, keep that metadata in a SIDECAR or a specialized adapter rather
> than forcing representation uniformity.

The 876-failure incident is the evidence for the third rule, and it is easy to
misread. Supporting root did not have huge systemic blast radius. Putting one
exceptional relationship into the representation that everything else traverses
did. Moving it to a WeakMap reduced 876 failures to 1 — and that 1 was a
characterization test whose premise was being changed deliberately.

⚠️ COST MEANS EVERY DIMENSION, not runtime speed:

```text
write hot-path CPU      retained memory        bundle size
read cost               allocation/GC          startup cost
construction cost       type complexity        debugging complexity
common-path complexity  maintenance burden
```

An abstraction that removes 30 lines of special-case code and adds 400 bytes to
every leaf is not elegant. One that makes root beautifully symmetric at the cost
of a conditional on every scalar write, forever, is a bad trade.

### The procedure

```text
Semantics proved correct?
  yes ↓
Is there measurable cost?
  yes ↓
Can redundant representation be removed?        REDUCE REPRESENTATION BEFORE
  yes -> remove it                              REOPENING SEMANTICS
  ↓
Is the remaining cost caused by a rare case?
  yes -> specialize the rare case               SPECIALIZE THE RARE CASE BEFORE
  ↓                                             TAXING THE COMMON CASE
Only if neither works: reconsider architecture
```

Rare cases are ALLOWED to be structurally exceptional when that keeps the common
case simple. That is good architecture, not impurity.

### ⚠️ A disposition question this leaves OPEN, deliberately

Whether `link(tree.$, endpoint)` should be part of the INTENTIONAL public API is
a different question from whether the incumbent's type system admits it. It does
admit it cast-free, so CONTRACT-BEFORE-DEFECT made the runtime failure a defect
and the repair was localized enough to be worth making. That settles the
incumbent. It does not settle greenfield, and persistence needing whole-tree
semantics must NOT be allowed to settle it either — the semantic machinery can be
shared without the public source form being advertised.

## OPEN

```text
LINK-BARE-SCALAR-0     CLOSED — substrate landed
LINK-BARE-BRANCH-0     CLOSED — substrate landed
LINK-ROOT-SOURCE-0             CLOSED — owner carrier + root NaturalValue
LINK-BRANCH-NESTED-ENTITY-0    CLOSED — regression introduced 48ad4e4a,
                               repaired; each nested collection now carries its
                               own eligible projection.
PERSISTENCE-AS-LINK-SWAP-0     CLOSED — SWAP-A. persistence() relationship
                               authority is Link.
memory                 unmeasured for the dormant representation
INSPECTION-EGRESS-0    open — Link green; persistence green via the swap;
                       standalone serialization() unmeasured
STORED-RETIRE-0        paused; stored-devtools-isolation.spec.ts still load-bearing
```

## `PERSISTENCE-AS-LINK-SWAP-0` — CLOSED, SWAP-A

The hypothesis put directly under load rather than diagrammed:

> Persistence does not need its own relationship authority model.
> Persistence = Link + application/durability policy.

### The baseline, measured BEFORE the substitution

The nine-row matrix was written against the INCUMBENT first, so a row that fails
after the swap can be classified rather than assumed to be a regression. The
prediction was preregistered: `persistence()` detected change by WHOLE-TREE
REFERENCE IDENTITY (`tree() !== previousState`, with a 100 ms polling fallback
outside Angular) and gated the write on a whole-tree STRING compare. That is
structurally the same mechanism as `LINK-ROOT-SOURCE-0`'s M3 mutation — "replace
the eligible projection with a current whole-tree re-read" — which passed six
rows and killed the inspection row alone.

```text
P1 authored              PASS
P2 inspection            FAIL   ← predicted
P3 inspection hitchhike  FAIL   ← predicted, load-bearing
P4 realized              PASS
P5 I4 authority          PASS   (non-discriminating on the incumbent — see below)
P6 no bad echo           PASS
P7 entity whole tree     PASS
P8 owner isolation       PASS
P9 dispose               PASS
```

Exactly the two predicted rows, and nothing else. The incumbent's shape was
complete and its authority was wrong:

> **CORRECT COMPLETE SHAPE IS NOT CORRECT EXTERNALLY-AUTHORIZED TRUTH.**

⚠️ P5 passing on the incumbent is NOT evidence that the incumbent had I4 right.
It passes because the incumbent has no eligible authority at all and simply
persists current state. P5's value is as a guard against OVERCORRECTION — an
authored-only projection that refused to move on external acquisition would fail
it — so it only becomes discriminating once P2/P3 are fixed.

### The seam

One line bound encoding to "whatever the tree currently holds":

```ts
const raw = tree(); // inside enhanced.serialize
```

Everything else in the serializer — special types, circular refs, nodeMap,
metadata, replacer — is pure encoding over `raw` and always was. Extracting
`encodeSnapshot(raw, tree, config)` is what let `persistence()` encode the value
Link says is EGRESS-ELIGIBLE. `serialize(config?)` is unchanged and still means
"encode current state"; only an internal caller may name a different value.

### What Link took over, and what persistence kept

```text
LINK NOW OWNS                     WAS, IN persistence()
change detection                  tree() !== previousState + 100ms POLLING
turn coalescing                   debounceMs doing double duty as correctness
transaction gating                a bespoke scheduleDurableConsequence claim
echo suppression                  lastCacheKey, a STRING compare of the payload
realized inbound                  hand-written withWriteContext({ origin:
                                  'external', participation: 'realized' })
owner isolation                   implicit in one-subscription-per-tree
inspection exclusion              ABSENT — the defect

PERSISTENCE KEEPS                 because none of it is relationship semantics
storage adapter, key, codec + metadata/version, debounce, skipCache,
load()/autoLoad lifecycle
```

Four imports became unused, which is the receipt: `withWriteContext`,
`getActiveWriteContext`, `scheduleDurableConsequence`, `cancelDurableConsequence`.
Persistence no longer reaches for causal primitives at all.

### Mutations

```text
M1  publish tree() instead of the eligible value    P3 alone
M2  save() publishes tree()                         P2c alone
M3  load() applies without Link acquiring           P6 alone
M4  drain awaits settlement                         the A2-4.1 drain row (HANG)
    the incumbent baseline itself                   P2 + P3
```

P2 is pinned by the measured incumbent rather than by a synthetic mutation, and
that is recorded as such.

### ⚠️ TWO ROWS THAT DID NOT DISCRIMINATE, AND WHAT FIXED THEM

**The manual path was missing.** M2 kills a row that did not exist in the
original matrix: a devtools scrub followed by an explicit `save()`. An
autoSave-only matrix never reaches it, and `save()` publishing `tree()` is the
obvious implementation. `save()` publishes `latestEligible`.

**M3 survived the entire matrix at first** — the inbound half of the swap was
UNPINNED. The cause was a line of mine:

```ts
lastCacheKey = encodeSnapshot(inbound, tree, cacheKeyConfig); // after load()
```

That is the incumbent's echo suppression rebuilt on top of the primitive that
replaced it. While it stood, a mutation that applied the payload without telling
the relationship still passed P6, because this line suppressed the echo on its
own. Deleting it made the claim falsifiable and M3 immediately killed P6.

> **DELETE THE DUPLICATE TO MAKE THE CLAIM FALSIFIABLE.** A redundant
> reimplementation of the mechanism under test does not merely add code — it
> makes the test unable to detect the mechanism's absence.

A third attempt, "acquired truth survives a transaction rollback", could not be
made to discriminate at all: `load()` is async, so the payload lands after the
transaction callback has returned and rollback has no claim on it regardless of
classification. It is kept as an explicitly labelled CHARACTERIZATION row, not
counted as evidence.

### Two behaviours changed, both SWAP-D

**`autoSave: false` no longer means "no relationship".** The first attempt
disposed the Link, which also disposed `save()`'s authority: `save()` fell back
to the construction baseline and wrote `0` where the tree held `7`. Turning off
the pump is not the same as cutting the pipe. The relationship stays live and
tracks eligible authority; `outbound` records and returns without publishing.

⚠️ That is a real, accepted cost: with `autoSave: false` the projection work
still happens per write. It is the same work `autoSave: true` does, and the
alternative is a `save()` that publishes the wrong value. Recorded rather than
hidden.

**The A2-4.1 drain tripwire fired and was inverted, as its own instructions
required.** It predicted that routing the drain through the consequence
authority would make its completion asynchronous with respect to settlement.
That prediction was correct and the first attempt walked into it: a drain that
awaited settlement HUNG while a transaction was open — a hang at the moment a
host is trying to leave, which is worse than the defect being fixed.

The resolution is that the boundary stopped being the drain's problem. Link hands
a value to the endpoint only from inside its own durable consequence, so anything
drainable has ALREADY cleared settlement. The drain neither bypasses the
authority nor waits on it.

> **AN UNRESOLVED OPTIMISTIC MUTATION HAS NO COMMITTED TRUTH TO PERSIST.**

### The type-surface note

`TruthfulLinkSource` rejects a root whose declared type still contains an
`entityMap` construction marker, because a CALLER writing endpoint callbacks
would be handed a value type matching neither the marker nor the runtime state.
Persistence has no such caller: the endpoint is internal, its value is consumed
only by the codec, and no `NaturalValue<T>` reaches application code. One
documented internal cast, protecting an authoring surface that does not exist
here. This is NOT a reason to weaken the public rule.

### Result

```text
SWAP-A.   PERSISTENCE RELATIONSHIP AUTHORITY = LINK
```

Thirteen permanent rows; the existing persistence contract passes unchanged
except for the one inverted tripwire; zero public API delta.

> **SUBSTITUTE THE ARCHITECTURE, DON'T DIAGRAM IT.** Running the real contract
> against the proposed engine produced two defects, one hang and two vacuous
> tests in a single pass. A call-graph audit showing the two mechanisms "appear
> similar" would have produced none of them.

## `GREENFIELD-ROOT-ACCESSOR-SHAPE-0` — PREREGISTERED, NOT DECIDED

⚠️ NOT A CHANGE TO THE INCUMBENT. `1c93fa6f` is cheap, green and correct for the
incumbent, and changing `$` semantics there would create migration noise without
teaching us anything. This section records a greenfield hypothesis and what would
have to be measured to adopt it.

### The decomposition that produced it

`link(tree.$)` failed for THREE separable reasons, and conflating them is what
made the root look expensive:

```text
tree.$ is not callable          -> the NaturalValue read failure
                                   ("x is not a function")
tree.$ carried no owner         -> the ownership-guard failure
backreference stored ON tree.$  -> the 876-test traversal/cycle explosion
```

Only the FIRST is what a callable root would eliminate. A callable `tree.$`
would still have needed to say which tree it belonged to, and the 876 came from
the attempted fix, not from the root's shape.

### The hypothesis

```text
tree()        NO      the tree owns the state system, lifecycle and
                      facilities — it is not a state-value function
tree.$()      YES     root state location, callable, NaturalValue = whole tree
tree.$.b()    YES     unchanged
```

Link's source rule would then collapse to one line — _an ordinary state location
is callable and calling it returns its NaturalValue_ — with entities remaining
the intentional specialized case because their representation warrants one.

### What the incumbent already tells us, measured not assumed

**Traversal is ALREADY function-aware, by design.** `isTraversableNode` accepts
functions explicitly, and its own comment says why: a SignalTree leaf IS a
callable, so a bare `typeof === 'object'` check "silently skips every signal in
the tree." Branch accessors are callable today and are traversed today. Making
the root callable does not change its traversability class, which lowers the
ROOT-CALL-C risk considerably.

**Observation does not care.** `path-notifier.ts` contains no callability check
of any kind — no `typeof … === 'function'`, no `isSignal`, no accessor
recognition. Its contract is pattern subscription over
`(value, prev, path, owner, origin, subjectIds, position, meta)`.

> **CALLABILITY IS A SOURCE-INTERFACE CONCERN, NOT AN OBSERVATION CONCERN.**

So a callable root could simplify NaturalValue/source interpretation without
touching observation, authority or notification.

**The one concrete site that could bite.** `isNodeAccessor` is
`typeof value === 'function' && CALLABLE_SIGNAL_SYMBOL in value`. Today `tree.$`
is a plain object and therefore is NOT a node accessor by this predicate. A
callable, branded root would begin matching it everywhere that predicate runs.
That is the "runtime-shape ambiguity" risk in concrete form, and it is a
checkable list of call sites rather than a worry.

### What must be measured before adopting

```text
construction cost     per TREE, and confirmed not per node
retained memory       per tree only; must not change any leaf
traversal/snapshot    no cycles, no function internals walked,
                      byte-identical serialized state
type surface          tree.$() infers the complete state type; every
                      descendant API survives unchanged
shape ambiguity       every isNodeAccessor / marker-recognition call site
                      re-checked against a branded callable root
Link simplification   DELETE the root branch in accessorsFor and prove the
                      same Link contract still passes
```

### Read-callability first, replacement separately

```text
tree.$()            read          <- test this alone first
tree.$(newState)    replacement   <- NOT automatic
tree.$.set(v)       replacement   <- the signal-shaped alternative
```

Value-reading symmetry is what simplifies source interpretation. A second public
whole-tree mutation surface has to earn its own keep, and the incumbent's
`RootReadWrite` (`internals/root-source.ts`) is compatibility machinery, not
evidence that the greenfield root must be writable through the same door.

### Outcomes

```text
ROOT-CALL-A  simplifies interpretation, no meaningful perf/memory regression,
             no traversal/type complications        -> adopt in greenfield
ROOT-CALL-B  works, but measurable or structural cost
                                                    -> keep the isolated root adapter
ROOT-CALL-C  runtime-shape ambiguity or contamination of common machinery
                                                    -> reject, however clean it looks
```

### ⚠️ One correction to the framing that produced this

"Do not preserve incumbent `tree()` callability merely because root Link uses it
as its canonical reader" is the right conclusion from an understated premise.
`tree()` is not merely root Link's reader — it is the incumbent's PRIMARY
whole-tree snapshot API: `serialize()` and `toJSON()` are built on it,
`persistence()` reads it, and the test and documentation surface assumes it
throughout. Greenfield inherits none of that, so the recommendation stands
unchanged; but the migration is a large surface, not a single reader, and a
later reader should not be led to think otherwise.

This is the rule from the cost work applied to a primitive rather than to a
special case:

> **Can an exceptional representation be DELETED by choosing a better primitive
> shape, without paying for it elsewhere?** If yes, take it. That is the
> shortcut worth having.

## `INSPECTION-EGRESS-0` — CLOSED. Standalone serialization: SER-EGRESS-A

### Reachability first, because it narrows everything

`serialization()` is not exported from any entrypoint. `@signaltree/core` has
exactly one (`.`) and it exports `persistence` alone. "Standalone serialization"
is therefore reachable only as the `SerializationMethods` half of a persisted
tree, which is what the disposition rows drive.

### The classification, traced rather than inferred from names

```text
serialize    ENCODE    encodeSnapshot(tree())            -> string to caller
toJSON       ENCODE    tree()
snapshot     ENCODE    toJSON() + metadata + deep clone
deserialize  ACQUIRE   -> fromJSON
restore      ACQUIRE   -> fromJSON
fromJSON     ACQUIRE   the one application point
load         ACQUIRE   -> Link acquire() -> external(() => tree(value))

EGRESS       NONE
```

No serialization method owns a durable or external consequence. Calling
`serialize()` twice against an attached `link(tree.$, …)` publishes NOTHING.
The durable write that DOES follow a `deserialize()` belongs to Link observing a
state change — persistence's egress doing its job, not serialization's.

> **ENCODING DOES NOT CHOOSE AUTHORITY. THE CALLER DOES.**

### ⚠️ `serialize()` showing inspected state is CORRECT, and is now pinned

A caller asking for bytes is asking about the state it can see. The tempting
"fix" — making `serialize()` encode eligible authority because persistence does
— would be wrong, so SER-1 asserts the scrub IS in the output, next to a row
asserting the same scrub never becomes durable. The invariant is narrower than
"inspection must never be visible":

```text
inspection MAY alter observable and diagnostic state
inspection MAY NOT acquire external causal authority
```

### The defect that was actually there — and it was not an egress defect

Measured participation on each inbound path, BEFORE any change:

```text
load()          { origin: 'external', participation: 'realized' }
deserialize()   {}     <- nothing at all
restore()       {}     <- nothing at all
```

All three converge on `fromJSON`, which declared nothing. Every
participation-keyed consumer therefore read a `deserialize()` as authored work:
revocable by a transaction, indistinguishable from something the user did. That
is the A2-2 defect resurfacing on a sibling path. The incumbent had fixed it by
hand-wrapping ONE CALLER — `load()` — and the swap moved that caller's job into
Link's `acquire()`. Neither ever covered the public methods.

The fix is one `external()` at the convergence point.

> **FIX THE CONVERGENCE POINT, NOT THE CALLER THAT REVEALED IT.**

⚠️ It is CLASSIFICATION, NOT A RELATIONSHIP. It declares what the write IS. It
does not give serialization an eligible projection, a `knownY`, or any egress
authority — a serializer with no relationship attached maintains nothing.
OWNERSHIP-BEFORE-ADOPTION. When a relationship IS attached, it observes a
correctly classified write and decides authority itself.

Mutation: dropping the `external()` fails the `deserialize()` and `restore()`
rows and leaves `load()` green, because `load()` reaches truth through Link.

### `SERIALIZATION-ELIGIBLE-PROJECTION-0` — RETIRED AS SUPERSEDED

Deleted, not parked, and not "unfinished". Every piece it was building has a
surviving carrier in Link:

```text
createTreeEgressProjection      -> eligible + entityProjection +
                                   nestedCollections in link.ts
adoptRealized()                 -> acquire(), which sets eligible AND knownY
                                   directly rather than reducing notifications
notifier '**' + owner filter    -> link.ts's offSub, keyed on
                                   (registry, position)
lastCacheKey from eligible      -> knownY + deepEqual, which needs no encoding
                                   to answer
```

Its one known outstanding defect — a missing tree-owner filter on the `'**'`
subscription — is a defect Link never had, because Link was built with the
filter. That is the clearest possible signal that the responsibility moved
rather than the code.

> **A PLAN CAN BE RETIRED BY THE ARCHITECTURE THAT SURVIVED IT.** This one is
> not abandoned or deferred; the concept it was built around stopped existing.

### The split, frozen

```text
serialization   TRANSFORMS VALUES — encode out, acquire in
Link            DECIDES AUTHORIZED EXTERNAL TRUTH
persistence     APPLIES DURABILITY POLICY to that relationship
```

### `STORED-RETIRE-0` — the carrier requirement is now satisfied

`stored-devtools-isolation.spec.ts` was the last blocker. It pins a TWO-SIDED
invariant: an undo rewrites storage (correct — the user is undoing the persisted
change), a devtools scrub does not. Both halves now have carriers independent of
`stored()`:

```text
inspection does NOT egress   inspection-egress-conformance.spec.ts,
                             persistence-as-link-swap-0.spec.ts P2/P2c/P3
undo/restoration DOES egress inspection-egress-conformance.spec.ts:144
```

So the invariant survives `stored()`'s deletion. Whether every remaining row in
that file has a carrier is the check `STORED-RETIRE-0` itself must run when it
resumes — this clears the blocker, it does not pre-approve the deletion.

## `PRE-RELEASE-PUBLIC-SURFACE-DEDUPE-0` — A RELEASE GATE, not cleanup

> **ONE SEMANTIC JOB, ONE AUTHORITATIVE PUBLIC SURFACE.** If two public APIs
> differ only in spelling or convenience, one should normally die — and it must
> die BEFORE release, because afterwards deletion is expensive while before it
> is merely a refusal to institutionalize duplication.

Every public API overlapping another must prove it owns a distinct semantic job:

```text
DISTINCT SEMANTIC OWNER?      KEEP
PURE CONVENIENCE?             justify explicitly, or delete
DUPLICATES ANOTHER AUTHORITY? DELETE
HISTORICAL COMPATIBILITY?     migrate/delete before release if feasible
```

Scope is not serialization alone: duplicate state reads, duplicate mutation
routes, duplicate external-sync mechanisms, duplicate lifecycle APIs, duplicate
history/restoration entry points, and legacy enhancer APIs whose semantics now
belong to Link/core.

### First concrete disposition — the snapshot surface, CENSUSED

⚠️ There are more duplicates than the framing assumed. Measured on a persisted
tree today:

```text
WHOLE-TREE READ — four public paths, all rooted in tree()
    tree()          the materialiser
    toJSON()        -> tree()
    serialize()     -> encodeSnapshot(tree())
    snapshot()      -> toJSON() + metadata + a JSON deep clone

WHOLE-TREE WRITE — five public entry points, two convergence points
    tree(value)     the root write path
    fromJSON()      the application point
    deserialize()   -> fromJSON
    restore()       -> fromJSON
    load()          -> Link acquire() -> external(() => tree(value))
```

`snapshot()` and the write cluster were both missing from the initial framing.
That the write cluster already converges on TWO points — proved by this phase,
since one `external()` fixed all three inbound methods at once — is direct
evidence that the public multiplicity is spelling, not semantics.

Candidate target, to be argued at the gate rather than assumed here:

```text
tree.$()              canonical whole-tree NaturalValue
serialize(value, o?)  a codec PRIMITIVE over a supplied value, and only if
                      SignalTree-specific encoding is genuinely required
tree()                disposition before release
tree.toJSON()         DELETE unless it proves unique value
tree.serialize()      DELETE unless convenience is intentionally worth it
tree.snapshot()       DELETE unless metadata+clone is a distinct job
```

⚠️ AND THE COST IS ALREADY KNOWN TO BE LARGE. `tree()` is not a minor reader:
`serialize()`, `toJSON()` and `snapshot()` are all built on it, `persistence()`
reads it, and the test and documentation surface assumes it throughout. The gate
decides whether that migration is worth paying; it must not be entered believing
the surface is small.

This gate belongs immediately BEFORE the final greenfield contract freeze /
Candidate B, with the snapshot surface as its first disposition.

## `STORED-RETIRE-0` — CLOSED, STORED-R-A. `stored()` IS DELETED

Run in RETIREMENT MODE: compiler-driven deletion in one batch, not a phase per
helper. There was no architectural question left — `PERSISTENCE-AS-LINK-SWAP-0`
had already proved where every responsibility went:

```text
BEFORE                          AFTER
stored()                        ordinary state location
  state                           + Link                (relationship authority)
  persistence                     + persistence policy  (endpoint, codec, key,
  authority                                              lifecycle)
  lifecycle
  its own marker/API
```

⚠️ AND IT WAS NOT REBUILT ON LINK. `stored(key, initial, options)` is now
expressible as ordinary state plus a relationship plus policy, so keeping the
name would have been a second spelling of a job that already has an owner —
exactly what `PRE-RELEASE-PUBLIC-SURFACE-DEDUPE-0` exists to refuse.

### ⚠️ THE PUBLIC API DELTA IS ZERO, which the framing did not expect

`stored` was ALREADY unreachable: `@signaltree/core` has one entrypoint (`.`),
it does not export `stored`, it does not re-export `lib/markers/index.ts`, and
`stored` does not appear in `tools/api-baseline.json` at all. Its removal from
the public surface happened earlier, at `c53aa416`.

```text
diff of `export` lines in packages/core/src/index.ts, HEAD vs now:  EMPTY
```

So this batch removed an INTERNAL subsystem. Nothing needed classifying as an
intended public removal, and "do not require zero API delta during retirement"
turned out not to be needed.

The only type-level trace was three `StoredMarker -> StoredSignal` branches in
`types.ts`'s node resolution. Users could never construct a `StoredMarker`
without a public `stored()`, so removing those branches is unreachable-type
cleanup, not a contract change.

### What was deleted

```text
implementation      markers/stored.ts (1082 lines), markers/stored.contract.ts
type machinery      StoredMarker/StoredSignal branches in types.ts,
                    readonly.ts, readonly-readers.ts, markers/index.ts exports
helpers             flushAllStoredSignals, createStoredSignal, isStoredMarker,
                    createStorageKeys, clearStoragePrefix, STORED_MARKER
diagnostics         ST2020 (duplicate stored() key) — NO PRODUCER REMAINS
tests               12 whole spec files + ~20 blocks inside general specs
docs                the marker row and Pattern 3 in docs/ai/LLM.md, the ST2020
                    row and the ST2021 marker list, two stale index entries
```

Total: 49 files, +349 / −6611.

### The invariant-carrier table

```text
INVARIANT                          OLD CARRIER              SURVIVING CARRIER
inspection does NOT egress         stored-devtools-isolation inspection-egress-conformance,
                                                            persistence-as-link P2/P2c/P3
undo/restoration DOES egress       stored-devtools-isolation inspection-egress-conformance:144
a rolled-back value is not durable stored-commit-ordering    a2-persistence-discriminators c3
the drain respects settlement      a2-4-2-marker-drain       a2-4-1-drain-settlement
owner isolation                    stored-commit-ordering    persistence-as-link P8
external truth is REALIZED         per-b-classification      serialization-egress-disposition SER-3
marker never leaks into a snapshot stored-leak               marker-location-grammar
                                                            ("persistence() — the durable path
                                                             the stored leak actually reached")
a marker materialises to a signal  m3-* stored rows          same rows, on compared()
a marker nests without leaking     marker-materialization    its entityMap() sibling row
```

### ⚠️ THREE ORPHANS FOUND — carriers ADDED BEFORE deleting

Not everything had a carrier, and the checks that found the gaps were cheap:

**1. The durable commit boundary.** `CONFIRM` (as opposed to rollback), a THROWN
transaction, a SUPERSEDED intermediate, OUT-OF-ORDER confirm of overlapping
transactions, and FOREIGN-tree scope absorption were observed ONLY through
`stored()`. New carrier: `persistence-commit-boundary-carrier.spec.ts`, 5 rows.
Mutation — publishing without Link's settlement claim — fails 2 of them.

The subject moved from the marker to the enhancer, which is the point: the
boundary was never `stored()`'s property. It belongs to the durable-consequence
authority, which Link now claims on persistence's behalf.

**2. Error attribution DISTINCTNESS.** `link-persistence-conformance` §7
asserted only that `treeId` is DEFINED — which a constant would satisfy. The
claim ERROR-SURFACE-2 actually earned is that two same-shaped trees failing at
the same PATH are told apart, and its mirror, that repeated failures from one
relationship keep the SAME id. Both lived only in `stored` rows. Added as §7b
and §7c.

**3. What `path` MEANS.** Retiring `stored` emptied
`describe('ERROR-PATH-SEMANTICS-0: one meaning for path')` completely — every
assertion about the meaning of `path` had been written against the marker. Added
as §7d: an error names WHERE IN THE TREE the failure happened, never where the
endpoint chose to put the bytes.

> **EMPTY SUITE = CARRIER ALARM.** When retirement empties a permanent suite,
> classify the suite explicitly: VACUOUS because its subject disappeared, or
> ORPHANED because a general invariant just lost its last carrier. Never delete
> an empty suite without making that disposition.

Three suites emptied during this batch.

> Two were correctly vacuous — their premise was the deleted primitive. The
> third had been the only home of a general invariant, and only the empty shell
> revealed it.

### Retired as VACUOUS — subject gone, no independent requirement

```text
versioning/migration, key prefixing, debounce, drain-on-pagehide, storage error
handling, flushAllStoredSignals   -> stored-specific POLICY, frozen DELETE
construction-time durable pre-emption (A2-1 "the DECLARATION MARKER")
    -> only stored loaded at construction; persistence() autoLoad is
       post-construction by design, so the premise itself is gone
"path is the state location for BOTH producers"
    -> there is one producer now; the comparison has no second term
"stored is PRESENT as a plain value", "stored() declares transient"
    -> assertions about the deleted marker's own declaration
```

### Unexpected coupling discovered

`stored()` was the codebase's default "here is a marker" fixture: 22 general
specs used it incidentally, in files about transactions, realization, leaf
interception, traversal and M3 conformance. Most did not need a DURABLE leaf at
all — only a leaf — and were migrated to `compared()`, `entityMap()`, or plain
state. That is worth recording as a hazard rather than a footnote:

> **FIXTURE DEPENDENCY IS NOT SEMANTIC DEPENDENCY.** Blast radius from deleting
> a feature must distinguish code that depended on the feature's SEMANTICS from
> tests that merely used the feature as a convenient SPECIMEN.

### Gates

```text
core tests        2090 passed, 18 skipped, 1 todo    (was 2261 — the delta is
                  retired stored-specific policy, plus 12 new carrier rows)
workspace         exit 0, all 4 projects
typecheck         0
lint              0 errors (5 pre-existing warnings)
README API lint   exit 0 — every @signaltree symbol named in a README exists
public API delta  ZERO — see above
```

⚠️ ONE PRE-EXISTING GATE FAILURE, NOT INTRODUCED HERE. `signaltree-bare` is over
budget at 9.77/9.7 KB prod and 11.79/11.7 KB dev. Measured identical at HEAD, and
attributed by removing `LINK-ROOT-SOURCE-0`'s root carriers from the bare path:
that yields 9.76 KB, still over. So the root work costs about **10 bytes of prod
bundle** — a useful datum for `ROOT-COST-SCOPE-0`'s bundle dimension — and is
not the cause. The overage predates this session's work and is left open.

### Also fixed while sweeping — live docs teaching deleted APIs

`docs/ai/LLM.md` contradicted itself: a marker table taught `stored(key,
default)` while a later section said it was removed. The same table also still
taught `status<E>()`, retired earlier, and named `serialization()` as the
persistence enhancer when `serialization` is not exported at all — only
`persistence` is. `scripts/lint-readme-apis.mjs` did not catch any of it because
it checks READMEs only, which is the doc-example lint gap restated: the
AI-facing document is the one an agent reads first and the one nothing gates.

## `AI-DOC-SURFACE-GATE-0` — CLOSED

Scope was deliberately narrow: live docs may not teach APIs already proven
unreachable. It did NOT disposition still-live duplicates — those remain
`PRE-RELEASE-PUBLIC-SURFACE-DEDUPE-0`.

### ⚠️ A CORRECTION TO MY OWN DIAGNOSIS

I first reported that the doc lint "isn't a registered gate — an npm script
nothing in CI invokes." **That was wrong.** `readme-apis` has been a registered
gate in `tools/verify-gates.mjs`, running in CI via `npm run gates`, with a
proving mutation. I concluded otherwise from a truncated grep and did not check
the rest of the file.

The real defect is narrower and more interesting: the gate ran, passed, and
protected nothing here, because the SCRIPT only inspected import statements.

```text
what it checked      an ES import statement naming @signaltree symbols
what it missed       | `stored(key, default)` | ... |     an API table
                     theme: stored('app-theme', 'light')  a block with no import
```

> **A DOC TEACHES BY EXAMPLE, NOT BY IMPORT.** An agent reading a table of
> markers needs no import line to be misled.

### What the widened gate found

A denylist pass over fenced code blocks and API-table rows, in live docs only:

```text
docs/ai/agent-templates.md   a `.cursorrules` template that told agents to use
                             `status()` and `stored()` — and explicitly FORBADE
                             the correct shape: "DO NOT generate manual
                             `loading: { state, error }` shapes"
docs/ai/LLM.md               a migration section teaching the migration BACKWARDS,
                             from ordinary state TO the deleted `status()`
docs/compare/ngrx-signalstore.md   `status<ApiError>()` in two comparison examples
docs/guides/composition-recipes.md `status<Err>()` in a capability table and a slice
README.md                    `effects()` (removed years ago, its own row said
                             "removal next major") and `serialization()`, which is
                             not exported at all
```

The `.cursorrules` template is the worst of these by a distance: it did not merely
mention a deleted API, it instructed agents to prefer it and prohibited the
replacement.

### Design of the check, and its limits

It is a DENYLIST, not "every identifier must resolve". Doc examples legitimately
call application-owned helpers, and a checker that flagged those would be
permanently red — which teaches people to ignore gates, the exact failure the
lint's own header already warns about.

Two controls keep it honest:

```text
denylist rot     every RETIRED entry is asserted ABSENT from the built surface,
                 so re-adding an API fails the gate loudly instead of leaving a
                 lie that still passes
records exempt   docs/architecture/** and docs/research/** are excluded from the
                 TEACHING pass — a record of a deletion must be able to show what
                 was deleted. The import pass still covers them.
```

⚠️ AND THE NEW HALF NEEDED ITS OWN PROOF. One mutation cannot exercise two
independent checks, so `readme-apis:teaching` is a companion gate whose mutation
re-teaches a deleted API in `docs/ai/LLM.md`. Both halves now fail on demand:
45/49 gates proven, up from 44/48.

### Census datum for the next batch

Verified against the BUILT surface, with reachable controls (`signalTree`,
`entityMap`, `link`, `external`, `persistence` all resolve):

```text
UNREACHABLE today: stored, status, asyncSource, asyncQuery, serialization,
                   flushAllStoredSignals, effects, withPersistence,
                   loader, compared, derived
```

`loader`, `compared` and `derived` are NOT retired — they are INTERNAL-ONLY
markers. That is a whole `ALREADY UNREACHABLE` category for
`REMAINING-FEATURE-DISPOSITION-BATCH-0`, and it says the public surface is
considerably smaller than the `markers/` directory implies.

## `REMAINING-FEATURE-DISPOSITION-BATCH-0` — PARTIAL. One deletion, one HARD STOP

### The census, verified against the BUILT surface with reachable controls

```text
reachable      signalTree  entityMap  link  external  persistence
UNREACHABLE    compared  byKeys  linked  loader  invalidateTag  derived
```

⚠️ THE CENSUS ITSELF NEEDED A CORRECTION. `derived` appeared as "named in
index.ts" and "unreachable in the build" at the same time, and both were right:
the `derived()` FUNCTION was removed in v6.3.1, and only the TYPES
`DerivedMarker`/`DerivedType` remained exported.

### C. `derived` — DELETED, and it was unreachable, not merely unused

Nothing in production could construct a `DerivedMarker`: its only factory went
in v6.3.1, nine major versions ago. Deleted: `markers/derived.ts`, the
`isDerivedMarker` branch in `mergeDerivedState`, and the two public type exports.

> **A SHARED WORD KEEPS DEAD CODE ALIVE.** `.derived(($) => ({ … }))` is a very
> live feature that takes a factory returning ordinary computeds — handled by
> the `isSignalLike` branch, and always was. The dead MARKER and the live
> FEATURE share a name, and that resemblance is what made the marker look
> load-bearing for nine versions.

⚠️ IT WAS NOT AS CLEAN AS FIRST JUDGED. Removing the import alone broke
`.derived()`'s RETURN TYPE — `DerivedMarker` is an arm of `ProcessDerived` and
of `DeepMergeTree`, so a live public feature's types depended on a marker no
value could ever be. Both arms removed properly; typecheck 0, 2090 tests green.

Public API delta: **two type removals, INTENDED** — `DerivedMarker`,
`DerivedType`. Exporting a type whose only constructor is gone does not preserve
compatibility, it advertises one.

### A. `loader` — HARD STOP, and the reason is new

`LOADER-RETIRE-0` already refuted deletion: loader holds a real remote-data cache
layer (stale/fresh, SWR, tag invalidation, scoped entries, cache equality,
eviction) whose owner is undispositioned. That stop was not re-litigated.

What is NEW is reachability, and it is worse than "internal-only":

```text
v12 removed the raw `load: fn` path
entityMap({ load }) now requires a LoaderFeature
only loader() produces a LoaderFeature
loader() is not exported
```

⚠️ AND THE RUNTIME SAYS SO. `entity-map.ts:249` throws:

> `SignalTree: entityMap({ load }) requires the loader() helper —
entityMap({ load: loader(fn, { staleTime, swr, tags }) }). The raw "load: fn"
form was removed in v12 …`

A user who writes `entityMap({ load: fn })` is told to use a function they
cannot import. **`entityMap({ load })` is a dead end at runtime**, and the error
message documents the dead end as the solution.

That is a product decision, not a compiler-driven cleanup — export `loader`, or
reject `load` differently, or remove the option. STOP condition: distinct
behavior with unclear owner.

### B. `compared` — HARD STOP, same class

Withdrawn from the RC surface deliberately at `76ab032c`; `byKeys` and `linked`
are in the same position. Nothing in production constructs one, and its only job
is to hand a leaf a custom `equal`. Deleting it is defensible — but it was
withdrawn ON PURPOSE, and "ship it or delete it" is the same product decision
`loader` needs. Both are held for one disposition rather than resolved by
whichever happened to be smaller.

⚠️ A FIXTURE NOTE. `compared()` is now the specimen for M3's "a marker
materialises to a signal" rows, because after `stored()` it is the only core
marker that does. If it is deleted, those rows lose their subject and the
surviving carrier is `form()` in `@signaltree/ng-forms`. Recorded so the
decision is made knowingly — FIXTURE DEPENDENCY IS NOT SEMANTIC DEPENDENCY cuts
both ways.

## ⚠️ THE FINDING THAT MATTERS MOST — docs advertised what nobody can reach

The census was meant to feed a deletion batch. Instead it exposed that live docs
CLAIMED six unreachable capabilities, including in competitive material:

```text
docs/compare/capability-matrix.md   "Per-leaf equality — `compared()` /
                                    `byKeys()`" listed as a SignalTree
                                    capability others lack (❌ for every rival)
                                    and a "Markers as one concept" bullet naming
                                    SIX markers, FIVE of them unreachable
docs/compare/ngrx-signalstore.md    an entire persistence section: `stored()`
                                    per-leaf, `stored(key, default, { version,
                                    migrate })`, `createIndexedDBAdapter()` /
                                    `createStorageAdapter()` from
                                    `@signaltree/core/storage` — an entry point
                                    that does not exist — and
                                    `flushAllStoredSignals()`
docs/errors/README.md               ST2019 for `compared()` and ST2004 pointing
                                    at `loader()`, diagnostics whose producers
                                    or remedies are unreachable
```

> **AN UNREACHABLE CAPABILITY IS A FALSE CLAIM, NOT A STALE DOC.** A comparison
> table is read by someone deciding whether to adopt the library. Listing a
> capability a user cannot invoke is not documentation drift; it is a claim we
> cannot honour.

### The gate grew to catch this class

`WITHDRAWN` joins `RETIRED` — implemented-but-unexported alongside deleted —
because the difference is nil for a reader: both lead to an import that does not
resolve. Both share the absent-from-surface control.

Three corrections were needed, each earned by a false positive on the first run:

```text
method form         `derived` matched `.derived(`, the live tree method.
                    Fixed with a `(?<![.\w])` guard.
local bindings      `const derived = derivedFrom<T>(); derived(($) => …)` is the
                    idiomatic form the root README teaches, and is
                    indistinguishable BY NAME from the removed free function.
                    `derived` is therefore NOT in either list:
                        A NAME-BASED GATE CANNOT OUTLIVE A NAME COLLISION.
explaining vs       widening to whole table rows flagged "Withdrawn: its
teaching            subject, the `stored()` marker, is deleted" — a row doing
                    this gate's job. Rows announcing a removal are exempt.
```

And the widening was itself necessary: the original rule matched only rows
STARTING with a backticked name, so the capability-matrix claim — whose cell
opens with prose — passed cleanly.

### Gates

```text
core 2090 · workspace exit 0 · typecheck 0 · lint 0 · doc gate 0
public API delta   2 type removals, INTENDED
bundle             signaltree-bare still 9.77/9.7 KB — PRE-EXISTING, not raised
```

## `loader` — DELETED. Successor established, and the mode changed

### ⚠️ THE MODE SWITCH THAT MADE THIS POSSIBLE

The previous entry held `loader` at a HARD STOP on the reasoning that real
behavior needs a successor before deletion. That instinct is correct for
incumbent solidification and WRONG for a greenfield replacement, and it was
recreating the incumbent one careful relocation at a time.

> **GREENFIELD INVARIANT CARRIER.** Before asking where an incumbent behavior
> goes, ask whether the SEMANTIC REQUIREMENT belongs in the new contract at all.
> ORPHANED means a GREENFIELD invariant has no carrier — not that an incumbent
> behavior disappeared.

Three-way disposition, and real behavior does not imply the first:

```text
1 GREENFIELD CONTRACT     intentionally SignalTree -> minimum clean carrier
2 APPLICATION / POLICY    useful, not SignalTree   -> remove, no successor owed
3 HISTORICAL / ACCIDENTAL the implementation accumulated it -> delete
```

`LOADER-RETIRE-0` was right that loader was not semantically empty. It was
answering a different question than greenfield asks.

### The split

```text
external acquisition / synchronization   -> link()        (category 1)
entity state and topology                -> entityMap()   (category 1)
staleTime, SWR, tags, scoped cache,
eviction, maxScopes, loading status      -> application   (category 2)
```

Same shape as persistence: relationship authority moved to Link, and the policy
half left core rather than justifying the wrapper's survival. We did not keep the
old persistence authority because codec and key and debounce remained; loader gets
the same treatment.

The successor was already proven. `composed-acquisition.spec.ts` — "can remote
keyed acquisition compose with an ORDINARY `entityMap`? No `loader()`" —
deliberately excluded staleTime/swr/lazy/tags so the spike could not conclude
that composition "needs machinery" when the machinery came from the API under
test. `link()` makes that composition first-class.

### Deleted

```text
markers/loader.ts, markers/entity-loader.ts        822 lines
loader(), LoaderFeature, attachLoader, EntityLoaderSurface, EntityPersist,
EntityStorageAdapter, invalidateTag, parseDuration, stableStringify
entityMap({ load }) — the whole loading overload and builder
LoadingEntityMapMarker / LoadingEntitySignal / LoadingEntityMapBuilder
ReadonlyEntityLoaderSurface, ReadonlyLoadingEntitySignal, ENTITY_LOADER_READERS
isLoaderFeature
ST2004
3 subject specs + loader rows across 11 more
```

⚠️ AND `rxjs` LEFT WITH IT. It was an optional peer dependency of `@signaltree/core`
and loader was its only consumer. The lint's dependency check caught that
immediately: core no longer uses rxjs at all, so the peer dependency is removed.
A subsystem's true cost includes the dependencies it alone justified.

### ⚠️ NOTHING DECLINES HYDRATION ANY MORE

The `entityMap` hydrate processor declined tree-level rehydration when a loader
owned the collection — guarded by `typeof node.load === 'function'`, and `load`
was attached only by the loader feature. With loader gone the predicate can never
be true.

M4 had already traced the trajectory: `hydrate` had two implementers,
`asyncSource` and `entityMap`; asyncSource's deletion left one, and loader's
leaves ZERO declining paths. "A source-owning marker declines rehydration" is not
an invariant that lost its carrier — it is a rule with no subject, because no
marker in core owns an external source. Relationships do, and a relationship is
`link()`. The RFC 0014 contrast — `transfer` accepts what `rehydrate` declines —
retires with it: both modes accept.

`reportHydrateDecision` now has zero producers. Recorded, not yet deleted.

### Empty suites, classified

```text
VACUOUS   RFC 0014 transfer-vs-rehydrate contrast   no declining implementer
VACUOUS   rehydrate: source-owning markers decline  same
VACUOUS   S3-RECOVER branch analysis                subject was loader hydration
VACUOUS   0B §8 maxScopes/GC source-text pins       read a deleted FILE's text
MIGRATED  readonly parity `plants` fixture          the invariant is readonly ×
                                                    merged-derived, not loading;
                                                    now a plain entityMap
VACUOUS   TreeNode loading-slice typing arm         the arm no longer exists
```

### Gates

```text
core 2017 · workspace exit 0 · typecheck 0 · lint 0 · doc gate 0
public export delta   ZERO — loader was never exported
package.json          rxjs peer dependency REMOVED
bundle                signaltree-bare unchanged; still pre-existing over budget
```

## `REMAINING-FEATURE-DISPOSITION-BATCH-0` — CLOSED

### `compared` / `byKeys` — DELETED, question preserved

The representation went wholesale: the factory, `ComparedMarker`,
`isComparedMarker`, the materialization branch, ST2019, and every test whose
subject it was. Not kept "in case custom equality matters later".

> **PER-LOCATION-EQUALITY-0 — OPEN.** Whether a location may carry its own
> comparator is an unresolved greenfield PERFORMANCE question. If evidence later
> admits it, it gets designed from the measured requirement — not inherited as
> `compared(value, equal)`. Preserving an old answer is not the same as
> preserving the question.

### `linked` — DELETED, and the name was not evidence

Traced only far enough to check for a frozen invariant, per the caution that
`linked` is not `Link`. It is not: `linked()` is a thin wrapper over Angular's
native `linkedSignal` — derived-but-writable state, no relationship semantics at
all. Its whole job is already covered by a primitive users can call directly,
and the demo page was titled "linked() Removed From RC" before this batch began.

The `ProcessDerived` behaviour it motivated SURVIVES on its own terms: a
`WritableSignal` merged through `.derived()` still keeps `.set()`, because that
rule was always about WritableSignals and never about the wrapper. Its readonly
parity fixture now uses `linkedSignal` directly — MIGRATED, and the new specimen
IS the successor.

### Dead hydration observability — DELETED

`reportHydrateDecision`, `onHydrateDecision`, `HydrateDecisionEvent` and the
listener set: unexported, zero producers once nothing declines hydration. Two
specs existed solely to observe those decisions and are retired VACUOUS.

### ⚠️ THE DELETIONS KEPT PRODUCING DELETIONS

Each removal exposed the next, and the compiler found every one:

```text
loader deleted        -> rxjs was core's only rxjs consumer   -> peer dep removed
compared deleted      -> wrapLeafSignal had one caller        -> helper removed
nothing declines      -> reportHydrateDecision had 0 producers-> facility removed
```

> **A SUBSYSTEM'S COST INCLUDES DEPENDENCIES IT ALONE JUSTIFIES.** `rxjs` leaving
> with `loader` is architectural evidence, not package hygiene: a subsystem
> imposes bundle, dependency, maintenance and security cost even when its own
> implementation looks isolated.

> **NO SURVIVING SUBJECT, NO SURVIVING INVARIANT.** "Source-owning markers
> decline rehydration" needed no replacement carrier because there are no
> source-owning markers. External source ownership moved to relationships, and
> relationships are `link()`.

### Empty suites, classified

```text
VACUOUS   compared.spec, linked.spec, linked-null, linked-inference
VACUOUS   hydrate-decisions, m5-decision-observability   facility has no producer
VACUOUS   M3's "a marker materialises to a signal" rows  no core marker does any
                                                         more; `form()` in
                                                         ng-forms carries it
MIGRATED  readonly parity `draft` fixture                invariant is about ANY
                                                         WritableSignal; specimen
                                                         swapped to linkedSignal
MIGRATED  entity-array marker-in-array row               entityMap serves it
```

### ⚠️ THE BUNDLE BUDGET IS GREEN, AND IT WAS NOT RAISED

```text
before   signaltree-bare  ❌ 9.77/9.7 KB prod   ❌ 11.79/11.7 KB dev
after    signaltree-bare  ✅ 9.66/9.7 KB prod   ✅ 11.65/11.7 KB dev
```

That overage was flagged as PRE-EXISTING three phases ago and deliberately left
open rather than accommodated. It was fixed by deleting code nobody could reach —
`compared`'s materialization branch and `wrapLeafSignal` were both in the bare
path. Raising the ceiling would have hidden the fact that the bare bundle was
carrying an unreachable marker.

### Gates

```text
core 1990 · workspace exit 0 · typecheck 0 · lint 0 · doc gate 0
public export delta   ZERO — none of these were exported
peer dependencies     @angular/core, tslib   (rxjs reclaimed)
bundle                BOTH TARGETS GREEN for the first time this session
```

Next: `HIST-SCOPE` and the realization/undo correctness defect. No further
legacy-feature preservation phase.

## `GREENFIELD-FRAMEWORK-HANDOFF-0` — the boundary, RESTORED not rediscovered

> **SignalTree owns truth. The framework owns observation.**

```text
                ┌────────────────────┐
                │   neutral kernel   │  state / slots / entities
                │                    │  transactions / causal authority
                │                    │  Link / history
                └─────────┬──────────┘
                          │  physical commit
                          │  CommittedChangeSet
                 ═════════╪═════════
                   FRAMEWORK HANDOFF
                 ═════════╪═════════
                          │  PublicationAdapter
                 /        |        \
          Angular       React       Vue
           token      subscriber   trigger
```

The handoff is at COMMITTED PUBLICATION. Not at `signalTree()` construction, not
inside `Link`, not at `TreeRealizationPort`, not at entity storage, not at causal
interpretation.

### ⚠️ THE INCUMBENT GOT FURTHER THAN THE PLAN REMEMBERED — measured

**1. The neutral kernel exists, and it is genuinely neutral.**
`internals/tree-scalar-slot-runtime.ts` imports only `PositionId`,
`PhysicalCommitClock` and the stats counter. Zero framework imports. Its surface
is already the one the plan calls for:

```text
createSlot(initial, equal, positionId?) -> SlotIndex
readSlot / commitSlot / updateSlot      over SlotIndex
beginFrame() -> { set, update, discard, commit }
resolveScalarSlot(positionId) · revision() · slotCount()
```

**2. The PublicationAdapter is already IMPLEMENTED, not merely sketched.**
`AngularScalarSlotPublicationAdapter` in the Angular runtime is exactly the
proposed contract:

```text
observe(slotIndex)   reads a hidden WritableSignal<number> token
publish(result)      bumps the token for every result.changedSlots entry
```

`SlotIndex -> hidden Angular reactive token` is not a design to build. It ships.

**3. The Angular runtime is a genuine ADAPTER, not a fork.** It imports the
neutral module and delegates — `kernel.createSlot(initialValue, equal,
positionId)`. The layering the plan wants already exists in the dependency graph.

**4. `CommittedChangeSet` half-exists.** `ScalarSlotCommitResult` is
`{ revision, changedSlots }` — the skeleton. Missing: `transactionId`,
`revisionFrom` (only the post-commit `revision` is carried), and
`structuralChanges`.

### So the blocker is NARROWER than "migrate the realization port"

Two files import the WRAPPER instead of the kernel:

```text
lib/signal-tree.ts:54                          -> tree-scalar-slot-angular-runtime
internals/causal-runtime/tree-realization-adapter.ts:14 -> same
```

and the wrapper's storage handle is Angular-shaped where the kernel's is not:

```text
NEUTRAL   createSlot(...)          -> SlotIndex
          resolveScalarSlot(pos)   -> SlotIndex | undefined

ANGULAR   createLeaf(...)          -> WritableSignal<T>      ← the leak
          resolveScalarLeaf(pos)   -> WritableSignal<unknown>← the leak
          publishPrepared(result)                            ← adapter fused in
```

⚠️ AND THE TWO MODULES EXPORT THE SAME NAMES — `TreeScalarSlotRuntime`,
`createTreeScalarSlotRuntime`, `ScalarSlotMutationFrame`. A shadowing pair
distinguished only by import path is exactly how a transitive coupling passes a
direct-import check, which is why the neutrality gate must be transitive.

### The neutrality map, measured

```text
23 non-spec files in packages/core import '@angular/core'
```

Including `link.ts`, whose `NaturalValue` still has a `WritableSignal<infer T>`
arm and whose `accessorsFor` branches on `.set()` — adapter shape leaking into
authority machinery. Link is causal: eligible truth, knownY, external
acquisition, settlement, inspection exclusion. None of that is observation.

`signal-tree.ts` is explicit that this is transitional:

> "for this release `@signaltree/core` IS the Angular adapter, so the binding
> lives here rather than in the neutral materializer"

```ts
installMaterializationRealization({
  isReactiveNode: (node) => isSignal(node),
  memoizeSnapshot: (_node, compute) => computed(compute),
});
```

That seam is evidence the plan was already partly executed, not evidence that
Angular is the permanent substrate.

### ⚠️ ARCHITECTURE IS PRESERVED; OLD PUBLIC GRAMMAR IS NOT

The original cross-framework document showed leaves as `tree.$.a.name.set('x')`.
That is NOT grandfathered by recovering the architecture:

```text
ORIGINAL ARCHITECTURAL BOUNDARY   preserve
OLD PUBLIC GRAMMAR                do NOT automatically preserve
GREENFIELD GRAMMAR                location() / location(value) / location(fn)
```

Uniform callable locations are also what removes Link's need to branch on
Angular's `.set()`, so the grammar decision and the neutrality work reinforce
each other. See `GREENFIELD-ROOT-ACCESSOR-SHAPE-0` for the root's half.

### The second neutrality problem, also already identified

`@signaltree/authoring` and `@signaltree/kernel` solve different problems:

```text
@signaltree/authoring   marker contracts, descriptors, guards,
                        registerMarkerProcessor, enhancer protocol — neutral
                        because authorship factories are INERT DESCRIPTORS
@signaltree/kernel      authoritative engine
framework adapter       Angular / React / Vue observation
```

The marker analysis had already shown Angular primitives live exclusively inside
`create*Signal` realization functions, never in the authoring factories.

### The discriminator

One kernel tree, NO framework installed: reads, writes, updater writes,
transactions, `entityMap`, `link()`, history/restoration all work. Attach the
Angular adapter and the SAME tree becomes Angular-reactively observable, with
authoritative values staying in the kernel rather than moving into tokens.
Whether `isSignal(location)` is true is NOT a kernel requirement, and must not be
allowed to force kernel representation.

### FROZEN AT THE ARCHITECTURE LEVEL

> **SignalTree owns truth. The framework owns observation. The framework handoff
> occurs at COMMITTED PUBLICATION.**

No longer a candidate. This is why React and Vue later need ADAPTERS rather than
SignalTree rewrites.

> **FRAMEWORK NEUTRALITY IS A TYPE-CLOSURE PROPERTY, NOT AN IMPORT-LINE
> PROPERTY.** A kernel file importing no framework package is insufficient if one
> of its dependencies hands it a `WritableSignal`. The shadow pair above is the
> proof: a direct-import gate stayed green while Angular-shaped semantics sat
> transitively beneath the causal runtime.

That is the same lesson the documentation gate taught — checking the superficial
spelling misses the semantic dependency. Two independent gates, one failure mode.

### ⚠️ WHEN IMPLEMENTATION STARTS, THE INCUMBENT IS EVIDENCE — NOT THE TARGET

```text
neutral runtime          SEMANTIC SHAPE is evidence; its representation is NOT
                         automatically the target
publication adapter      PROVEN ARCHITECTURE; the implementation may be reused
                         if it is still minimal
createLeaf -> Writable   transitional incumbent shape — DO NOT REPRODUCE
```

The same caution applies to the envelope. `ScalarSlotCommitResult`'s
`{ revision, changedSlots }` is useful evidence, but `transactionId`,
`revisionFrom` and `structuralChanges` must NOT be bolted on merely because an
older note sketched a `CommittedChangeSet` with them. The final shape comes from
what transactions, structural realization and adapters actually require once
`HIST` closes — otherwise recovering an architecture note becomes another
incumbent-preservation exercise, which is the failure this whole mode switch
exists to avoid.

⚠️ NOT SCHEDULED. Implementation waits for `HIST`: restoration semantics can
still change the required physical and causal contract, and extracting a kernel
against a contract that is still moving would be building on sand. When greenfield
starts, the cut is already known — BELOW PUBLICATION IS SIGNALTREE, ABOVE
PUBLICATION IS FRAMEWORK.

## `HIST-C2` + `RESTORE-P0` — CLOSED, PROVEN BY MUTATION

ADSP MODE: IMPLEMENTATION.

Both were already landed and green. Rather than re-report that, they were proven
closed to the enforcement directive's own standard: both mutation directions must
bite, or the separation is not load-bearing.

```text
M1  rollback dependency by AUTHORSHIP, not causal effect
    (drop the observed-effect projection from getPendingRollbackPlan)
    -> 4 FAIL, incl. "REPAIRED (C3) — a dependent REALIZATION now refuses the
       rollback" and "dependency evidence does not outlive the transaction"

M2  restoration selection ignores undoable()  (isTurnEligible -> true)
    -> 16 FAIL across 10 files: every histc2-* spec, devtools-jump-0,
       turn-feed-0

M3  undo ignores later external truth  (drop the externalConflict refusal)
    -> 4 FAIL: both P0-C repros, the whole-turn refusal, and the redo-cursor pin
```

Both directions bite. The separation is load-bearing in each.

### ⚠️ MY FIRST M1 WAS A NO-OP, AND ITS FAILURE IS THE BETTER EVIDENCE

The first attempt filtered later turns on `effect.origin !== 'external'`. Thirteen
tests passed and the mutation looked survived — but `CausalEffect` has **no
`origin` field at all**:

```text
CausalEffect { owner, before, after, subjectId?, structural?, structuralContext? }
```

So the predicate was always true and nothing changed. The separation was not
weak; the mutation was invalid.

> **A MUTATION NEEDS ITS OWN POSITIVE CONTROL.** A mutation that "survives"
> proves nothing until you have shown it changed behaviour at all.

And the absence it revealed is stronger evidence than the mutation would have
been: rollback dependency **cannot** discriminate by authorship, because
authorship is not in the causal record. TX-LEDGER C3's "relevance is decided by
position and subject overlap" is enforced by the data shape, not by policy.

### The architecture, as implemented

```text
confirmedTurns          canonical authored causal facts
dependencyLedger        BOUNDED PROJECTION for effects with no authored turn of
                        their own — a realization, typically; entries filtered by
                        `seq > openedAt` and discarded with the transaction
getPendingRollbackPlan  authoredLater + observedLater, relevance by position and
                        subject overlap
isTurnEligible          restoration selection ONLY — never causal admission
externalConflict        world-relative applicability at the reversal boundary
```

One causal system. One restoration authority. A projection, not a second
canonical history — exactly what the frozen model requires.

### P0's frozen policy

> an undo either reverses the authored operation, or it does not happen

Refusal, not partial application, not overwriting later truth. P0-D settled
FRAME-relative validity ("given what this same frame will also do"); P0-C settled
WORLD-relative validity ("given what happened AFTER the turn"), which is not
derivable and therefore a policy. Skipping the conflicting effect would make an
authored turn partially reversible — the HIST-B failure through a different door.
Letting the inverse win would make history an authority over facts it does not
own.

⚠️ AND IT IS NOT BARE VALUE EQUALITY. The check is `externalTruthBySubject` —
later external authority FOR THAT SUBJECT — and only then a drift comparison. The
subject gate is what keeps `AUTHORITY TRANSITION != STATE TRANSITION` intact; an
unrelated equal value cannot stand in for causal applicability.

### Retention, already implemented

`dependency evidence does not outlive the transaction that needed it` is a
permanent row, and M1 kills it. The ledger is not an unbounded authored history.

# CURRENT FRONTIER — reconciled from artifacts

⚠️ **This section is the reconciled current status as of this commit.** Every
section above it preserves the state at the time it was written, including
statements later entries supersede. Read those as history.

> **A LONG APPEND-ONLY RECORD IS A HISTORY, NOT A STATUS.**

`FRONTIER-RECONCILIATION-0`, ADSP MODE: IMPLEMENTATION. Status was derived from
code, tests and git log — never from a document's own label. 37 distinct
identifiers appeared near an OPEN-ish word across the two live records; after
reconciliation:

```text
CLOSED       17     RETIRED/VACUOUS  6     SUPERSEDED  3
HISTORICAL   4      OPEN             6     BLOCKED     1
```

## CLOSED — closure commit + surviving carrier

```text
HIST-0                  HIST-C selected                        record + histc2-* specs
HIST-C2                 e046c394; opt-in flip landed           M2 fails 16 across 10 files
TX-LEDGER C3            e4e0463b                               M1 fails 4
RESTORE-P0  A/B/C/D     p0c-divergence, p0c-row-divergence     M3 fails 4
A1 ingress door         98edd3c1 realize() is external()       external() exported
PERSISTENCE-DECOMPOSE-0 08e38603                               record
INSPECTION-EGRESS-0     539408a3                               serialization-egress-disposition
STORED-RETIRE-0         47e07100                               stored absent from source
LINK-* (5 defects)      1c93fa6f and predecessors              link-*-conformance specs
OBSERVATION SUBSTRATE   fab04961 / 8b611b38                    observation-substrate.spec
PERSISTENCE-AS-LINK     910f9d61                               persistence-as-link-swap-0
ERROR-SURFACE-1/2       d4d97b9f                               tree-error-* specs
MATRIX-CLOSE            6ee4a27f                               record
NOTIFIER-SCOPE-0        d4d97b9f                               record
PER-B                   888c61bb                               per-b rows migrated to SER-3
B2-1 .with()            223b355a                               `with` unreachable (controlled)
signaltree-bare budget  031ec775                               ✅ 9.66/9.7 · 11.65/11.7
```

## RETIRED / VACUOUS — subject gone, no surviving invariant

```text
stored() atomic consequence semantics   release step 1 — VACUOUS, stored() deleted
stored().reload() classification        VACUOUS, carried by HIST-C2 but stored() is gone
loader / entityMap({ load })            RETIRED c52e8fc0 — link() is the successor
compared / byKeys / linked              RETIRED 031ec775
derived MARKER                          RETIRED 0e20eff3 — .derived() is a different feature
hydrate DECLINE + onHydrateDecision     VACUOUS — no marker in core owns an external source
```

## SUPERSEDED — a later ruling absorbed the question

```text
HydrateMode "PUBLIC, no repair owed"
    The recorded decision rests on `onHydrateDecision` being exported so
    `HydrateDecisionEvent.mode` is nameable. That facility is DELETED (nothing
    declines hydration). Verified: HydrateMode was never in index.ts — not at
    session start either — `registerMarkerProcessor` is not public, and
    packages/authoring/src/lib is an empty stub. No public surface needs it, so
    no contract was removed. ⚠️ IF an authoring SDK later ships
    `registerMarkerProcessor`, the hydrate hook's parameter becomes nameable-by-
    third-parties again and this decision must be re-taken, not assumed.

ENTITY_LOADER_READERS pending disposition   deleted with loader
bind / requires / isDev pending disposition all unreachable (controlled)
```

## OPEN — surviving requirement, owner, evidence, next action

```text
1 PRE-RELEASE-PUBLIC-SURFACE-DEDUPE-0
    requirement  one semantic job, one authoritative public surface
    owner        public API surface
    evidence     4 whole-tree READ paths (tree/toJSON/serialize/snapshot) and 5
                 WRITE entry points converging on 2; deepEqual (11 consumers),
                 asReadonly (13), toWritableSignal (1) still reachable
    next         disposition each; the deletion-first three need consumer
                 migration, not just a decision

2 PER-LOCATION-EQUALITY-0
    requirement  may a location carry its own comparator?
    owner        greenfield contract, unassigned
    evidence     compared() deleted 031ec775; no successor and none owed yet
    next         performance evidence, or leave out by default bias

5 MARKER-GRAMMAR-DIAGNOSTICS-0
    ST2021 is silent for Map/Set positions (marker-location-grammar records the
    gap as a live DIAGNOSTIC GAP row)

6 APPLYSTATE-UNKNOWN-KEY-0
    recorded, unresolved
```

## BLOCKED

```text
tools/api-baseline.json re-baseline
    blocked on B2 alone. ⚠️ NO LONGER ON B3 — see the patch below.
    Three of the five symbols the blocking note names — `.with()`, `requires`,
    ENTITY_LOADER_READERS — are already gone, so the blocker's SCOPE has shrunk
    even though the blocker itself stands.
```

### ⚠️ FRONTIER PATCH — `B3` is SUPERSEDED, and the reconciliation found this by

### contradicting itself

The first reconciliation left a hole: it recorded the baseline as blocked on
`B2 AND B3` while listing no `B3` anywhere in the execution frontier, and
`packages/authoring` contains no files at all. One of those had to be wrong.

Resolved from artifacts, three agreeing independently:

```text
RELEASE-1.0.md:150   "Gate B waits on the declaration artifact, not on
                     architecture." And package verdicts (Tier 4) wait on their
                     SEMANTIC OWNERS being known — which is a derivation-lane
                     dependency, not a Gate-B one.
this record:17844    GREENFIELD-FRAMEWORK-HANDOFF-0 claims
                     `@signaltree/authoring` and `@signaltree/kernel` as the
                     greenfield target, explicitly NOT SCHEDULED, waiting on HIST
packages/authoring/  EMPTY — no extraction has begun, and none is queued
```

B3 is the authoring/realization package separation. It is greenfield work owned
by `GREENFIELD-FRAMEWORK-HANDOFF-0`, executed AFTER the surface freeze. Its
original blocking rationale — "B3 can move declaration locations and exported
paths, and the baseline records both" — was sound while B3 sat before the freeze.
It no longer does: the baseline taken at the freeze records the FROZEN surface,
and greenfield will produce its own.

> **B3-SUPERSEDED.** The api-baseline blocker stops naming it. Owner:
> `GREENFIELD-FRAMEWORK-HANDOFF-0`.

Positive control for the artifact query: the same log method locates known closed
package decisions (`SCHEMA-DEL`, `FORM-DEL`), so the absence of any authoring-
extraction commit is a finding rather than a broken search.

## HISTORICAL — investigations, not work items

`HIST-C2 step 6 category-C stop` (resolved by TX-LEDGER C3) · `LOADER-RETIRE-0`
(superseded by the authority flip) · `SCHEMA-DEL` / `FORM-DEL` (executed) ·
the `isDev` episode (closed, kept as a methodology note).

## PARKED BY DESIGN — recorded targets, not current work

`GREENFIELD-FRAMEWORK-HANDOFF-0` (frozen; waits for HIST) ·
`GREENFIELD-ROOT-ACCESSOR-SHAPE-0` (preregistered) ·
`OBSERVATION-REPRESENTATION-PERF` · `ANGULAR-OWNERSHIP-0`

## THE EXECUTION FRONTIER

```text
NOW                        (empty — both carried items closed)

BEFORE PUBLIC SURFACE      PRE-RELEASE-PUBLIC-SURFACE-DEDUPE-0
FREEZE                     MARKER-GRAMMAR-DIAGNOSTICS-0
                           APPLYSTATE-UNKNOWN-KEY-0
                           PER-LOCATION-EQUALITY-0 (decide, or decline by default)

AT THE FREEZE              api-baseline re-baseline (after B2 + B3)

AFTER THE FREEZE           GREENFIELD implementation — below publication is
                           SignalTree, above publication is framework
```

⚠️ The release plan's 28-step list is still valid FROM step 3 onward. Step 1
("finish stored()/persistence atomic consequence semantics") is vacuous and step
2's heterogeneous-atomicity test exists and is green.

## `NOW-CLOSE-0` — both carried items CLOSED

### raw-NUL harness gate

Requirement, verbatim from the carry: _a cheap syntactic gate rejecting raw NUL
and unexpected C0 controls in tracked sources._ Earned by a real incident — an
invisible NUL reached committed source, propagated into the script written to fix
it, and was found only because Python refused to parse that script.

Owner: TOOLING. No runtime semantics were touched, and none needed to be — the
defect is that a byte no semantic tool can see reached a commit.

```text
tools/check-source-controls.mjs   C0 minus TAB/LF/CR, plus DEL, over
                                  `git ls-files` (not a glob — an ignore list
                                  drifts; the tracked set is by definition what a
                                  commit can carry)
gate  source-controls             mutation: plant \0 in constants.ts -> caught
gate  source-controls:self        mutation: allow 0x00 in the detector  -> caught
scan at HEAD                      1065 tracked files, clean
```

⚠️ IT SHIPS WITH ITS OWN POSITIVE CONTROL, in the tool itself. A checker whose
only evidence is "found nothing" is indistinguishable from a checker that cannot
find anything — twice this session, in a mutation filtering a non-existent field
and a reachability grep that called `entityMap` unreachable. `--self-test` plants
a NUL in a synthetic buffer and requires exactly one hit, then requires TAB/LF/CR
to pass untouched.

### rollback-message legibility

Requirement: _`transactions()`' compensation path surfaces the wrapped error's
message rather than the underlying refusal kind._ Measured cause:
`ROLLBACK_ERROR_MESSAGE` is a CONSTANT, so both refusal kinds produced one
identical sentence and the kind survived only on `.cause`.

That is the defect stated precisely: a thrown error's MESSAGE is what reaches a
console, a bug report and a log aggregator; `.cause` is what reaches a debugger
someone already opened. So one sentence served two opposite situations —

```text
later-confirmed-dependency   later work relies on facts the rollback would
                             invalidate. REFUSING IS CORRECT; nothing to fix.
effect-validation-failed     the compensation could not be applied. Something IS
                             wrong.
```

⚠️ SEMANTICS UNCHANGED, DELIBERATELY. Same refusal in the same cases, same error
type, same `cause` payload, and the constant survives as a PREFIX so every
existing matcher still matches. Only the rendering of an already-made decision
improved.

**And the assertion that hid it was strengthened, not loosened.**
`restoration.spec.ts`'s shared helper asserted the message was EXACTLY the
constant — which is precisely what made the regression invisible. It now requires
the constant as a prefix AND requires the message to name the refusal kind, so
those 7 rows became tripwires: the mutation reinstating the regression fails all
7 plus both new rows.

⚠️ THE CARRIER'S FIRST VERSION WAS WORTHLESS. It reimplemented the renderer
inside the spec and passed while proving nothing about shipped code. Repointed at
the production `explainRollbackFailure` — DELETE THE DUPLICATE TO MAKE THE CLAIM
FALSIFIABLE.

### Gates

```text
core 1992 · workspace exit 0 · typecheck 0 · lint 0 · doc gate 0 · NUL gate 0
gates proven   47/51 (was 45/49)
public export delta   ZERO
```

## `PRE-RELEASE-PUBLIC-SURFACE-DEDUPE-0` — batch 1

ADSP MODE: IMPLEMENTATION. Decisions in the required form, or deletion.

### DELETED — no surviving public semantic job

```text
toJSON()          MEASURED EXACTLY EQUAL to `tree()`. Its one distinct job was
                  `JSON.stringify(tree)` protocol conformance — which worked
                  ONLY with persistence() installed, so on a bare tree
                  `JSON.stringify(tree)` returned `undefined`. A protocol hook
                  that silently yields undefined in the DEFAULT case is a trap.
snapshot()        toJSON() + metadata + a JSON deep clone. Nothing public
                  consumed it; its only pair was restore().
restore(s)        fromJSON(s.data, s.metadata) — a synonym whose English name
                  emphasises a different part of one operation.
EffectsMethods    a PUBLIC TYPE describing an enhancer removed years ago.
                  Nothing implemented it. A type nobody can obtain is not
                  compatibility.
deepEqual         re-export removed. Eleven internal callers prove the ALGORITHM
                  is needed, not that users need the comparator. It still ships
                  from @signaltree/shared, where it lives.
```

### INTERNALIZED — capability survives, public spelling does not

```text
fromJSON()   the external-truth acquisition point where `external()` classifies
             the write. Now the private `acquireJSON`; `deserialize` is its only
             caller.
```

### KEPT — distinct admitted job proved

```text
serialize / deserialize   the one job `tree()`/`tree(value)` CANNOT do: a
                          type-preserving durable representation. `tree()` hands
                          back live Date/Map/Set/bigint and no version envelope.
```

⚠️ AND TWO KEPT ON EVIDENCE AFTER I HAD ALREADY DELETED THEM. Both retractions
are the process working — the deterministic case decided, not my expectation.

```text
toWritableSignal  It is the Angular Signal Forms bridge: `form(model)` needs a
                  WritableSignal, and `{ undoable: true }` is the only public
                  way to make a form edit a restoration-eligible turn. Three
                  HIST-C2 form-ingress carriers express that and have no other
                  door.

                  ⚠️ DELETING THE EXPORT LEFT THEM GREEN, because they import
                  from `lib/utils` directly. A SPEC REACHING PAST THE BARREL
                  CANNOT TESTIFY ABOUT THE BARREL — consumer evidence gathered
                  inside the package is blind to exactly the third-party need
                  the export exists for.

asReadonly        A probe showed `ReadonlyView<typeof tree.$> = tree.$` narrows
                  correctly AND blocks `.set` (controlled with
                  `@ts-expect-error`), which argued for deletion. It addressed
                  the NAMESPACE. For the CALLABLE tree,
                  `ReadonlyView<typeof tree>` loses the call signature, so the
                  annotation cannot express a tree's readonly projection at all.
                  SUBJECT-ADDRESS RULE: a probe must address the same node the
                  API does.
```

### `PER-LOCATION-EQUALITY-0` — CLOSED **OUT**

No first-class public comparator contract is admitted in v15. `compared()` is
deleted, no existing evidence contradicts the disposition, and no experiment is
owed to give a deleted idea another chance. Future MEASURED performance
requirements may reopen it under ADSP §29 — that is a contract disposition, not
a claim that custom equality can never have value.

### ⚠️ NOT TOUCHED, DELIBERATELY — `tree()`

```text
CURRENT incumbent canonical surface  !=  GREENFIELD target surface
during dedupe    remove multiplicity
during greenfield  replace the surviving canonical spelling
```

`tree()` is destined to become `tree.$()`, and that does NOT make it eligible for
deletion before the replacement authority exists. Dedupe removed four spellings
AROUND it; greenfield replaces it.

### Result

```text
core public exports   72 -> 68
serialization methods  6 -> 2
core 1991 · typecheck 0 · lint 0 · doc gate 0 · NUL gate 0
```

## PUBLIC-CARRIER — the two KEEPs proved through the barrel

The batch-1 retractions were semantically plausible and evidentially weak. Both
now have carriers that import from `@signaltree/core` itself.

> **A SPEC REACHING PAST THE BARREL CANNOT TESTIFY ABOUT THE BARREL.**

⚠️ NO SPEC IN THIS PACKAGE COULD OBSERVE ITS OWN PUBLIC EXPORT LIST. Every one
imports relatively, so deleting a re-export left them all green while breaking
every external consumer — which is exactly what happened to `toWritableSignal`.
`public-barrel-carrier.spec.ts` and its typing sibling are the deliberate
exception, and the only two; the Nx boundary rule is disabled in them with that
reason stated, and a `resolve.alias` makes `@signaltree/core` resolve to the
source barrel so a missing export fails the row.

### `toWritableSignal` — KEEP

```text
requirement  form(model) needs a WritableSignal, and `{ undoable: true }` is the
             only public way to make a form edit a restoration-eligible turn
carrier      a real Angular component: barrel import -> toWritableSignal(node,
             injector, { undoable: true }) -> form(...) -> edit -> the
             restoration history grows
control      an ordinary write does NOT grow it, and the SAME write DOES once
             wrapped in undoable() — so the mechanism is exercised both ways
mutation     remove the re-export -> "toWritableSignal is not a function"
```

### `asReadonly` — KEEP, and the KEEPER is pinned at the subject

⚠️ SHOWING THE ALTERNATIVE FAILS WOULD PROVE THE PROBLEM EXISTS, NOT THAT THIS
API SOLVES IT. Both halves are asserted:

```text
keeper       asReadonly(tree) stays CALLABLE, types descendant reads, returns
             the identical runtime object, and `.set` is unavailable
             (@ts-expect-error)
control      `ReadonlyView<typeof tree> = tree` is NOT callable — pinned with
             its own @ts-expect-error, so if that ever starts compiling the
             justification is gone and the row says so
specificity  the annotation's DESCENDANT reads do work, so the failure is
             located at the call signature rather than general
mutation     remove the re-export -> "asReadonly is not a function"
```

The probe that argued for deletion addressed `tree.$`, the NAMESPACE. The API
projects the CALLABLE TREE. SUBJECT-ADDRESS RULE, re-earned.

## `PRE-RELEASE-PUBLIC-SURFACE-DEDUPE-0` — batch 2, and B2

### Exhaustive classification — 69 exports, nothing unclassified

```text
RUNTIME (17)   every one has a distinct public contract
  signalTree entityMap link external undoable onTreeError
  persistence transactions restoration devTools batching
  derivedFrom defineStore asReadonly toWritableSignal
  createAuditTracker SignalTreeRollbackError

TYPE (52)      every one maps to an exported runtime owner
  signalTree          11   entityMap 10   devTools 5   asReadonly 4
  persistence          3   transactions 3  audit 3    link 2
  restoration          2   batching 2      defineStore 2
  onTreeError          1   derivedFrom 1
  enhancer protocol    3   (Enhancer, EnhancerWithMeta, EnhancerCleanup)
  write classification 1   (WriteMetadata)

UNCLAIMED TYPES: NONE
```

The enhancer protocol and `WriteMetadata` have no single runtime owner because
their consumer is a third-party AUTHOR, which is the surface
`GREENFIELD-FRAMEWORK-HANDOFF-0` names `@signaltree/authoring`.

### DELETED — `createAuditCallback`

> **ITS DOCUMENTED PURPOSE WAS FALSE.** It returned
> `(previousState: T, currentState: T) => void` and said it was "suitable for
> `tree.subscribe()`". The public `subscribe` takes a `PathHandler` > `(value, prev, path, ownerPath?, source?, subjectIds?, …)`.

Proven with a `@ts-expect-error`: the two-state callback cannot be passed to the
public method it was written for. Zero consumers anywhere. `createAuditTracker`
survives because it ATTACHES ITSELF and therefore needs no handler signature from
the caller — which is exactly what made the callback form unusable.

### Public-boundary carriers — the four whose evidence was thin

```text
toWritableSignal     form() bridge + { undoable: true } eligibility   mutation ✓
asReadonly           callable-tree readonly projection                mutation ✓
defineStore          Angular DI provisioning (0 workspace consumers)  mutation ✓
createAuditTracker   self-attaching change log                       mutation ✓
```

⚠️ THE OTHER 13 RUNTIME SYMBOLS DO NOT HAVE BARREL CARRIERS. They are exercised
throughout the suite through relative imports, which proves their SEMANTICS and —
per the rule this batch earned — not their reachability. Stated rather than
glossed: barrel coverage is 4 of 17. The four chosen are the ones whose public
need was contested or unevidenced; extending coverage to the rest is cheap now
that the alias and the exception exist.

### ⚠️ A DEFECT FOUND BY WRITING THE CARRIER — AND HALF OF IT WAS MINE

Two claims came out of that carrier. See `AUDIT-TRACKER-CONTRACT-0` below: the
subject claim was **my own error**, and the polling claim was real.

### B2 — SETTLED? **YES**

> Can I point at every exported runtime symbol and exported public type and state
> the distinct public contract it serves?

Yes. 17 runtime symbols with owners, 52 types all claimed, zero unclassified, and
the one export whose contract turned out to be fictional is deleted.

## B2 CLOSED — the baseline regenerated once, and given a gate

```text
before   71 symbols · entrypoints  .  ./security  ./storage
after    69 symbols · entrypoints  .
```

### ⚠️ THE BASELINE HAD DRIFTED, AND ITS CHECK EXISTED AND RAN NOWHERE

`api-inventory.mjs --check` has been in the tool the whole time — wired to no
gate and no CI job. So the baseline recorded `./security` and `./storage` as
shipping entrypoints long after those subpaths stopped existing, and 71 symbols
against a real 69.

> **A BASELINE NOTHING VERIFIES IS A MEMO, NOT A GATE.**

Now registered as `api-baseline`, with a mutation that adds an undeclared export
and is caught. 48/52 gates proven, up from 47/51. Third instance this session of
the same shape: `readme-apis` ran but inspected only imports; `lint:readmes`
looked unwired until the register was read properly; this one genuinely ran
nowhere.

### Five dangling subpath mappings deleted

`tsconfig.base.json` mapped `@signaltree/core/{lazy,security,edit-session,storage,
authoring}` to source files that DO NOT EXIST, against a package declaring only
`.`. Each mapping let an import typecheck inside this repo and fail for every
real consumer — the same false-negative shape as a spec importing past the
barrel, one layer up. The only remaining references were stale comments, one of
which claimed `@signaltree/core/storage` exposes the adapters; corrected in
place.

⚠️ `@signaltree/core/authoring` was among them. That is the package
`GREENFIELD-FRAMEWORK-HANDOFF-0` names as a future boundary — the mapping was an
option someone reserved and never took, and it is not evidence the extraction
happened. `packages/authoring` remains an empty directory.

### Gates at B2 close

```text
core 1995 · workspace exit 0 · typecheck 0 · lint 0
doc gate 0 · NUL gate 0 · api-baseline 0
bundle  signaltree-bare ✅ 9.66/9.7 · entities ✅ 20.07/21
gates proven  48/52
```

## `AUDIT-TRACKER-CONTRACT-0` — CLOSED. One retraction, one real defect

B2 stays closed; `createAuditTracker`'s public job was never in question.

### 1. The subject defect was MINE, and the type was already correct

I reported that `NodeAccessor<T>` admits `tree.$`, which then throws
`"tree is not a function"` — filed as the same class as `LINK-ROOT-SOURCE-0`.

Measured without a cast:

```text
createAuditTracker(tree, log)     compiles
createAuditTracker(tree.$, log)   error TS2345 — TreeNode<S> is not assignable
                                  to NodeAccessor<S>
```

The type ALREADY rejects it. My carrier had written `tree.$ as never`, and the
cast admitted what the parameter refuses.

> **A CAST DEFEATS THE OBSERVATION** exactly as a no-op mutation does, and for
> the same reason: the check never ran.

Third member of that family today, after a mutation filtering a field the type
does not have and a reachability grep that called `entityMap` unreachable. The
disposition is therefore **Outcome A, already satisfied** — the accepted subject
is the callable tree, and the compiler enforces it.

Kept as an asserted row rather than an assumption: a `@ts-expect-error` on
`createAuditTracker(tree.$, log)` in the typing carrier, with a mutation widening
the parameter to `NodeAccessor<T> | Record<string, unknown>` that makes it bite.
If `TreeNode` ever becomes assignable to `NodeAccessor`, the runtime failure
returns and that line starts compiling.

### 2. The polling claim was real — FALSE CLAIM, corrected

```text
doc said     "Uses tree.subscribe() for reactive change detection in Angular
              contexts, providing zero-polling overhead"
measured     signalTree({...}) has NO `subscribe` property at all
             -> the detector can never select the fast path for a public tree
control      handed a subscribe-capable specimen, the detector DOES take that
             branch — so the detector is fine and the claim is not
```

Disposition: **documentation defect, not implementation.** The claim is corrected
rather than rescued. Giving the tree a `subscribe` to make the sentence true would
add a second subscription architecture, and framework observation belongs at
committed publication (`GREENFIELD-FRAMEWORK-HANDOFF-0`, frozen). A 100 ms poll is
the honest description of what the tracker does today.

### Recorded separately, as required

```text
createAuditTracker public job   KEEP — B2 already decided, unaffected
accepted subject                the CALLABLE tree; `tree.$` rejected at compile
                                time, asserted and mutation-proven
polling contract                zero-polling was never an admitted contract for
                                a publicly constructible tree; claim corrected
defect repair                   documentation only; no type or runtime change
                                was owed
```

## `MARKER-GRAMMAR-DIAGNOSTICS-0` — CLOSED. Grammar unchanged, coverage extended

### The detector, traced

```text
warnMarkerInArray(key, value: readonly unknown[])
    sampled 64 elements, checked isEntityMapMarker || isRegisteredMarker,
    warned "key[i] … [ST2021]"
```

It was ARRAY-SHAPED BY CONSTRUCTION — the parameter is an array — so Map and Set
escaped because it was never called for them. Its call site is the branch
`if (Array.isArray(value) || isBuiltInObject(value))`, which is the one place
that already knows both facts the diagnostic needs: this value looks like a
marker, and this position is not marker-admissible because its interior is never
traversed.

### Positive controls already existed

`marker-location-grammar.spec.ts` carried all three before any change: an object
position stays quiet, an array position WARNS, and Map/Set assert zero warnings.
So the checker was provably alive and the gap provably real without building
anything.

### Repair — at the convergence point, not beside it

`warnMarkerInArray` became `warnMarkerInContainer` with Map and Set arms. No
second marker parser, no Map- or Set-specific materializer, no general recursive
walk.

⚠️ THE GRAMMAR IS UNCHANGED, and the row asserts BOTH halves. A Map value and a
Set member are still ordinary data — not materialised, no marker semantics, not
recursed into — and the developer is now told. The `materialized(...) === false`
assertions are what fail if a future repair "fixes" the diagnostic by
materialising the marker.

⚠️ THE POSITION IS RENDERED HONESTLY.

```text
m -> Map value at key "a"
s -> Set member #0
```

Not `m.a`. READ THE OBSERVATION, NOT ITS RENDERING — a property path would name
a location that does not exist and cannot be addressed.

### Mutations

```text
M1  disable the Map arm                        Map row fails
M2  disable the Set arm                        Set row fails
M3  admit Map/Set to the materialising branch  the grammar row fails
control  a Map or Set holding NO marker stays silent — without it, "Map/Set now
         warn" would be satisfied by warning on every Map and Set in the tree
```

### Cost

No new scan of ordinary values. The diagnostic runs at the branch that had
already decided the position becomes a leaf, under the same dev guard, the same
64-element sample bound and the same per-key dedupe the array scan always had.

⚠️ THE DEV BUDGET MOVED, AND ONLY BECAUSE PROD DID NOT. `signaltree-bare` dev
went 11.65 → 11.79 KB for two more diagnostic sentences; the ceiling is raised
11.7 → 11.9. Prod is FLAT at 9.66 KB and `check-devmode-foldable` is green, so
the strings provably do not ship — which is the condition the budget tool's own
guidance names for a dev bump. A prod change would have been a regression to fix
instead of a ceiling to move.

## `APPLYSTATE-UNKNOWN-KEY-0` — CLOSED, **UNKNOWN-A (IGNORE)**. No production change

### Scope, established before anything else

```text
applyState        NOT exported from @signaltree/core
production callers  ONE — devtools time-travel, devtools-impl.ts:1457
that call declares  { intent: 'system', origin: 'devtools',
                      participation: 'inspection' }
```

So this was never a public policy question. It is the internal contract of a
devtools replay path.

### Characterized — positive control first

```text
control   known key            -> written                    (known = 2)
root      { known, unknown }   -> known applies; `unknown` absent from `$`
                                  AND absent from tree()
nested    { b: { known, unknown } } -> same
refusal   { unknown } only     -> does NOT throw; known untouched
```

### The contract, on three independent grounds

⚠️ NONE OF THEM IS "THE IMPLEMENTATION DOES IT."

**1. Security.** The mechanism is one line,
`if (!Object.prototype.hasOwnProperty.call(stateNode, key)) continue;`, and it is
documented as load-bearing against a real prototype-pollution incident: the
devtools channel reaches `applyState` through a bare `JSON.parse` of a
`postMessage` payload, `JSON.parse` mints a real OWN `__proto__`, and the walk
recursed into `Object.prototype`.

> **"UNKNOWN KEY" AND "PROTOTYPE-CHAIN KEY" ARE THE SAME TEST.** Choosing CREATE
> would reintroduce the incident class, not merely change a convenience.

**2. Causal class.** The single caller declares `participation: 'inspection'`.
`INSPECTION-EGRESS-0` forbids an inspection write acquiring external causal
authority; creating tree structure is strictly stronger than that.

**3. Construction model.** Ordinary locations materialise at construction, and a
late ordinary descendant is not assumed to exist because incoming data names it
— `DESCENDANT-MATERIALIZATION-0`.

### Carrier gap found and closed

`apply-state-pollution.spec.ts` already had "the OWN-NESS check refuses a key the
tree does not have" — but it uses `toString`, a PROTOTYPE-CHAIN key. That carries
the security half. The ORDINARY unknown key (`{ unknown: 3 }`, neither inherited
nor dangerous) had no carrier at all. `apply-state-unknown-key.spec.ts` adds it,
including the row that separates A from B: an unknown-only snapshot neither
throws nor disturbs.

```text
M1  CREATE — assign unknown keys instead of skipping   3 rows fail, incl. the
                                                      pollution carrier
M2  REJECT — throw on an unknown key                   4 rows fail
```

### Diagnostic disposition — SILENT, retained

Asked separately from the semantics, as required. Silent ignore stands:

```text
the payload is UNTRUSTED and attacker-influenced through postMessage, so a
per-unknown-key warning is a log-spam vector aimed at the developer console
the guard's purpose is refusal-by-omission, not education
default bias for a new diagnostic policy is OUT
```

⚠️ THE COST IS REAL AND RECORDED: a developer hand-editing state in the Redux
DevTools panel and mistyping a key gets silence. That is a genuine DX gap, and it
is accepted here rather than paid for by warning on hostile input.

### Greenfield disposition

```text
applyState itself          HISTORICAL — an internal devtools replay helper, not
                           a greenfield primitive
surviving requirement      GREENFIELD CONTRACT — "a devtools replay must not
                           create structure", which belongs to the
                           observation/devtools side of the publication boundary
unknown-key policy API     NOT ADMITTED — no first-class option earned
```

### Result

Contract derived, already in force, now carried. **No production change was
owed** — the behavior that looked surprising is a security invariant.

# GATE B — FROZEN

The public surface at this commit is **authoritative for the incumbent release**.

```text
core public exports   69   =  17 runtime  +  52 type-only
entrypoints           .    (only one; five phantom tsconfig subpaths deleted)
api-baseline          tools/api-baseline.json  sha1 5a0064ee…
bundle  bare          prod 9.66/9.7 KB   dev 11.79/11.9 KB
bundle  entities      prod 20.07/21 KB   dev 22.74/23.7 KB
gates                 52 run, ALL GREEN; 48/52 proven able to fail
core tests            2000 passed · workspace exit 0 · typecheck 0 · lint 0
```

## This is an authority transition, not a checkpoint

```text
BEFORE GATE B   a public API candidate had to prove it SURVIVES
AFTER GATE B    a proposed public API change must prove the FROZEN SURFACE
                CANNOT satisfy an admitted requirement
```

No casual additions. No convenience aliases. No "while we're here" exports. The
public-surface analogue of ADSP §29's architecture authority flip.

## ⚠️ FREEZE DOES NOT CANONIZE IMPLEMENTATION REPRESENTATION

Gate B freezes the incumbent RELEASE CONTRACT. It reverses nothing decided for
greenfield:

```text
incumbent tree()          remains the frozen current spelling
greenfield tree.$()       remains the chosen replacement target
Angular representation    NOT blessed as kernel architecture — the handoff at
                          committed publication stays frozen
B3                        remains SUPERSEDED into GREENFIELD-FRAMEWORK-HANDOFF-0
```

Public release freeze ≠ representation freeze.

## The frontier was proven empty, and the checker was fixed first

⚠️ MY FIRST EMPTINESS CHECK COULD NOT DISTINGUISH CLOSED FROM OPEN. Grepping the
log for an item's name found `DIAG-JOURNAL` in a commit that merely MENTIONS it,
which would have "proven" a still-open item closed. Replaced with a reading of
the last record heading naming each item: five read CLOSED, `DIAG-JOURNAL` reads
NOT MARKED CLOSED. The control had to work before the freeze could rely on it.

## ⚠️ THE FREEZE ATTEMPT FOUND EIGHT FAILING GATES

`verify-gates` had never been run end-to-end during the pre-freeze batches — only
its individual members. Running all 52 found eight failures, and the split matters:

```text
MINE, from this session's deletions
  spec-types        6 type errors in specs — vitest TRANSPILES WITHOUT
                    TYPECHECKING, so 2000 green tests hid them. A dangling
                    `void tree.$.src`, a `Row` type deleted with its block, two
                    dead imports of deleted markers, an implicit any.
  dead-exports      4 exports my deletions orphaned — cancelDurableConsequence,
                    HydrateDecision, HydrateReason, hasDormantObservation. The
                    only "consumer" of the first was a comment in my own
                    tombstone.
  lint:budget       core 0 -> 5 warnings. Two were eslint-disable directives my
                    own edit made dead; three were non-null assertions that
                    disappear when the function is captured in a local rather
                    than re-read behind `!`.
  doc-links         3 links to files I deleted, converted to prose.

STALE INSTRUMENTS, not product defects
  bounded-history-retention      both probes live OUTSIDE the test suite, so
  signal-identity-durability     HIST-C2's 194-row opt-in migration never
                                 reached them. Undesignated writes never enter
                                 restoration history, so `undo()` did nothing —
                                 and the second reported "reactive identity is
                                 not durable". Designating one write per probe:
                                 4/4 properties pass and retention plateaus.

A REAL GAP THE GATE CAUGHT
  release-claims    `link` and `onTreeError` — two of this release's primary
                    capabilities — were absent from the core README, which
                    SHIPS IN THE TARBALL. Documented now, with what `link()`
                    will not carry: an inspection write does not become external
                    truth.
```

> **A GATE REGISTER IS NOT ITS MEMBERS.** Every one of those eight was reachable
> the whole time; nothing had run them together. Same family as the baseline
> nothing verified.

## ⚠️ AND ONE THING I DID, WHICH THE GATES SURFACED

`docs/ADSP/` did not exist at session start. A blanket `git add -A` in `d6e4e8af`
— a commit about the observation substrate — swept in an untracked 2,420-line
whitepaper and a 4 MB PDF, unreviewed, carrying 25 unresolvable `figures/*.png`
links. It is excluded from the link gate as a point-in-time published artifact,
which is honest, but the lesson is the commit hygiene: `git add -A` stages what
you have not read.

## Post-freeze rule

A deterministic counterexample to a frozen public contract reopens Gate B, via
the ADSP §29.5 six-condition gate. Desire for better diagnostics, architectural
elegance, an empty capability cell, easier DevTools work, or internal convenience
do NOT.

Next: `DIAG-JOURNAL`, which works UNDER this frozen contract.

# `DIAG-JOURNAL` — DISPOSITION CORRECTED, and the metadata seam is already closed

⚠️ THIS SECTION SUPERSEDES THE "MISSING FACT" SUBSECTION OF DIAG-JOURNAL-1. That
text is accurate as history and stale as status.

## The disposition is DJ-C, not DJ-B

I re-derived the question from first principles as a four-way choice (no journal /
live feed / bounded journal / existing data suffices) and provisionally selected
DJ-B — "the live PathNotifier stream already satisfies it." That was wrong,
because it was reasoned without reading the artifact:

```text
internals/diagnostics/diagnostic-journal.ts     EXISTS — 170 lines
F3  no restoration rights                       HOLDS
F4  no SignalTree ownership                     HOLDS
F4b disposal ends observation                   HOLDS
F5  reclamation identical ON/OFF                HOLDS
F6  bounded eviction releases                   HOLDS (own --expose-gc gate)
F7  no live handles retained                    HOLDS
production instantiation                        NONE
```

> **DJ-C — a bounded, non-authoritative, disposable internal journal EXISTS and
> is proven. It is DORMANT BY DEFAULT: zero production instantiation, therefore
> zero always-on cost.**

My `lateSaw = 0` measurement was about the NOTIFIER, and retention is precisely
what the journal adds — so it could not have selected between DJ-B and DJ-C at
all. Measuring the wrong component answers a different question.

⚠️ AND THE EXISTING OWNERSHIP EVIDENCE IS STRONGER THAN THE MUTATIONS I PROPOSED.
`diag-journal-1-ownership.spec.ts` proves separation on the REAL mechanism —
restoration facts identical with the journal on, no restoration or planning
operation exposed, claims and reclamation candidates unchanged, and a subject
whose only remaining reason to exist is the journal is STILL reclaimed. The
eviction gate carries a no-journal control arm. Mutating production to route the
notifier through restoration would have tested a system that does not exist.

## The compensation-correlation seam — CLOSED by DIAG-JOURNAL-1.1

The record says a diagnostic reader cannot tell a compensation turn from external
truth. Measured at HEAD, it can:

```text
SPEC  origin=-                     part=-         txId=1   member of tx 1
v0    origin=transaction-rollback  part=realized  txId=1   COMPENSATES tx 1
EXT   origin=external              part=realized  txId=-   external truth
```

`'transaction-rollback'` was already in the `WriteMetadata['origin']` union and is
now emitted at the compensation write context, closing the SEMANTICS-NAMES-1 cell
that was left open pending a consumer.

> **PARTICIPATION CLASSIFIES THE CHANGE'S AUTHORITY ROLE. ORIGIN CLASSIFIES THE
> CAUSE THAT PRODUCED IT.** A compensation stays `realized`; the origin does not
> make it authored, undoable, externally authoritative, or part of restoration
> history.

⚠️ ON THE `transactionId` OVERLOADING CONCERN, which was raised before this was
known to be implemented. The compensation turn DOES carry `transactionId`, and
the same field marks membership on the speculative turn. It is not ambiguous,
because the PAIR disambiguates:

```text
txId present, no rollback origin      -> MEMBER of that transaction
txId present, origin transaction-rollback -> COMPENSATES that transaction
```

A distinct `compensatesTransactionId` would also have worked and would carry the
relation in one field rather than two. The existing pair is sufficient and is
carried by `diag-journal-1-1-correlation.spec.ts`; recorded so the choice is
visible rather than assumed.

## Nothing owed

```text
public API delta        ZERO
causal authority delta  ZERO
restoration delta       ZERO
retention mechanism     NONE ADDED — the journal predates this phase and stays
                        dormant
Gate B                  UNCHANGED
```

## ⚠️ FOUR TIMES IN ONE THREAD

`HIST-C2`, `RESTORE-P0`, the DJ disposition, and this seam were each already
resolved in the artifacts while I derived them again from the record. The
corollary already recorded — a long append-only record is a history, not a status
— needs its active form:

> **READ THE ARTIFACT BEFORE DERIVING THE QUESTION.** A phase that names a
> problem is not evidence the problem is open. Check the code and the log FIRST,
> not after the framing is built — a framing built on a stale premise survives
> every subsequent step, because each step is checked against the framing rather
> than against the artifact.

## `DIAG-JOURNAL` — **CLOSED, DJ-C**

```text
mechanism              bounded internal diagnostic journal
lifecycle              dormant — zero production instantiation by default
authority              observation only
restoration rights     none
ownership              none over SignalTree subjects
retention              bounded; eviction releases
compensation identity  participation = realized
                       origin        = transaction-rollback
                       transactionId = correlating transaction
public API delta       zero
Gate B                 unchanged
```

The thread required no architecture, no implementation and no Gate-B change. The
artifact already contained the answer, including the compensation seam.

### `compensatesTransactionId` — NOT reopened

The existing pair is semantically readable:

```text
transactionId = 1, origin absent                  member of transaction 1
transactionId = 1, origin transaction-rollback    compensation caused by tx 1
```

A dedicated field would be a REPRESENTATION REFINEMENT, not a demonstrated
missing capability. Do not reopen it without a consumer that cannot correctly
interpret the existing pair.

## `PERF-GATE-DETERMINISM-0` — recorded, NOT started

The demo batching benchmark has now interrupted the full gate register three
times. Each occurrence was handled correctly — identified, isolated, rerun,
verified by exit code — but repeated reruns must not become permanent release
procedure.

> **A KNOWN FLAKE REDUCES THE INFORMATION CONTENT OF A RED GATE.** If a red
> register routinely means "run it again", the register stops being evidence.

```text
QUESTION   is that test proving a PERFORMANCE INVARIANT, or comparing wall-clock
           timing under uncontrollable parallel load?
GOAL       preserve the performance falsifier without making gate success
           scheduler-dependent
SCOPE      tooling. Not architecture, and it does not interrupt the sequence.
```

## Where the API question now stands

```text
INCUMBENT    Gate B frozen · stable release contract · no cleanup-driven churn
GREENFIELD   owns future representation · callable `tree.$` target unchanged ·
             framework-neutral kernel target unchanged · B3 remains greenfield
```

Nothing in `DIAG-JOURNAL` pulled legacy representation forward, and nothing
reopened Gate B.

> **THE TUG-OF-WAR PHASE IS OVER.** The incumbent contract is frozen; the
> next-generation implementation gets built against the frozen greenfield
> decisions rather than negotiated against the incumbent line by line.

⚠️ AND SEQUENCING NOW FOLLOWS THE RELEASE CONTROLLER. The history / restoration /
diagnostic cluster is solidified. No further historical semantic archaeology
unless `RELEASE-1.0.md` names an unresolved item — opportunistically starting
whichever architecture topic looks interesting is what §29.7f exists to stop one
level down.
