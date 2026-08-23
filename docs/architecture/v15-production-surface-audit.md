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

## Queue

NGF-0 goes first: it is bounded, already known to be open, and the package would
otherwise ship unjustified. The A3 transactions experiment is high value but it
is a new question, and a new question does not outrank an unfinished one.

```text
NGF-0   does @signaltree/ng-forms exist at all?          DONE — deleted
   ↓
TH-0    generic WritableSignal history                   DONE — deleted
   ↓
A3      status vs transactions
   ↓
A1      remote acquisition / resource composition
   ↓
A2      persistence + does core/storage exist at all?    ← one question, not two
   ↓
A6      EntitySignal.map
   ↓
MATRIX-CLOSE
        EVT-0 @signaltree/events, and each of its subpaths
        core/security
        core/storage (resolved by A2)
        every surviving root capability
        every shipped artifact -> terminal disposition
   ↓
freeze the Candidate B surface
```

## Register

| id | capability | v13 spelling | status |
| --- | --- | --- | --- |
| **NGF-0** | **does `@signaltree/ng-forms` exist at all?** | whole package | **DELETED — NGF-DEL executed** |
| **TH-0** | **generic `WritableSignal` history** | `trackHistory` | **DELETED — TH-DEL executed** |
| A1 | remote acquisition / loading | `loader` | evidence gathered, undecided |
| A2 | **durability/persistence, INCLUDING whether `@signaltree/core/storage` exists at all** | `stored`, `flushAllStoredSignals`, the `./storage` subpath | evidence gathered, undecided |
| A3 | async / status representation | `status` | evidence gathered, undecided |
| A4+A5 | form integration and its history | `form`, `FormSignal`, `history`, `@signaltree/ng-forms/signals` | **resolved — one consumer, proven path, one gap** |
| A6 | collection projections | `EntitySignal.map` | not started |
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

Not started. 8 errors.

`A7` (`.with()`) is already decided — declarative construction, 15.0.

---

## Why this is documented this way

The migration guidance an LLM will need is generated from these dossiers, not
written separately. "`loader(...)` → `<x>`" is only trustworthy if the reason is
recorded next to it, because otherwise the next agent re-litigates the decision
from the historical spelling — which is the weakest evidence there is.
