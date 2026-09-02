# Composition recipes: patterns that need no new API

Several capabilities get asked for often enough that they look like missing
features: a standard enhancer policy, a reusable entity-CRUD Ops base, a
selection read-model, optimistic writes with server reconciliation,
staged/draft editing, one-shot loading, a persistent relationship with an
external authority, and a human-readable explanation projected from causal
facts. All eight are **compositions of primitives that already ship**, and
each is deliberately _not_ in `@signal-tree/kernel`.

They live here because a recipe is the better answer when the composition is
short and the opinions are yours: it costs no API surface, it can't be
half-right for your app, and you can read the whole thing.

### Import rule

These recipes are framework-neutral, so their reusable helpers import from
`@signal-tree/kernel`. At an Angular or React application construction site,
import the same primitives from `@signal-tree/angular` or `@signal-tree/react`
respectively. A framework application should use its framework package as its
complete SignalTree facade; direct kernel imports are for helpers that are
intentionally runtime-independent.

The filter for what belongs on this page, going forward: if an application
problem can be expressed cleanly by composing primitives that already ship,
it earns a recipe here, not a new kernel API. A pattern becomes a kernel
capability only when repeated real implementations reveal a semantic property
applications cannot safely own themselves — see [TODO §12](../../TODO.md) for
the fuller catalog of patterns considered against this filter.

> **Provenance.** §1–3 are the resolved forms of findings A, B and C from
> [`docs/audits/2026-07/v3-consumer-reuse-audit.md`](../audits/2026-07/v3-consumer-reuse-audit.md),
> which came out of auditing a large real consumer (three apps, twelve admin
> domains). Every snippet in those three sections is the shape that consumer
> arrived at, with the corrections the audit produced. §4–8 came out of a
> later design discussion applying the same "recipe, not API" filter to
> patterns that consumer (and others) asked about next.

---

## 1. A standard enhancer policy

**The need:** every app re-decides which enhancers to apply and whether to gate
`restoration()` out of production. Two apps in one repo will drift.

**The recipe** — one function in your shared lib. It returns the enhancer
ARRAY, not an enhanced tree: 15.0 has no `.with()`, and a helper that took a
tree could not add anything to it.

```typescript
import { batching, devTools } from '@signal-tree/kernel';
import type { Enhancer } from '@signal-tree/kernel';

export interface StandardEnhancerOptions {
  name: string;
  /** Extra enhancers the CALLER constructed — see the tree-shaking note. */
  extra?: Array<Enhancer<unknown>>;
}

export function standardEnhancers({ name, extra = [] }: StandardEnhancerOptions) {
  return [batching(), devTools({ name }), ...extra];
}
```

Used at the construction site, which is the only place enhancers can be applied:

```typescript
const tree = signalTree(state, {
  enhancers: standardEnhancers({ name: 'MyApp' }),
});
```

### The tree-shaking trap — read this before writing your own

The obvious version takes an `isProduction` boolean and gates `restoration()`
inside:

```typescript
// ✗ DON'T — restoration ships in every production bundle
return isProduction ? base : [...base, restoration()];
```

That is a **static import behind a runtime check**, so the bundler cannot drop
`restoration` — your production build carries a deep-clone-per-write enhancer it
never uses. This is not hypothetical: it is the same mistake
[RFC 0005 §0](../rfcs/0005-entity-loader-composition.md) documents, where
`entity-map.ts` statically imported `attachLoader` and shipped the loader in
every `entityMap` bundle for a full version.

Gate it **structurally** instead — the caller imports `restoration` only where it
is wanted, so a production entry point never references it:

```typescript
// dev entry point
signalTree(state, {
  enhancers: standardEnhancers({
    name: 'MyApp Dev',
    extra: [restoration()], // import lives in the dev-only file
  }),
});

// production entry point — no restoration import anywhere in this graph
signalTree(state, { enhancers: standardEnhancers({ name: 'MyApp' }) });
```

With Angular, `fileReplacements` in `angular.json` is the natural seam.

### Typing note

The declared enhancer array is a tuple, and `signalTree` intersects every
enhancer's additions into its result. That only survives if the tuple survives:
annotating the helper's return as `Enhancer<unknown>[]` widens it and every added
method disappears — `.batch()`, `.undo()`, `.serialize()` — while the runtime
keeps working, which is the worst version of the failure. Let the return type
infer, or write the array inline at the construction site.

If your helper lives in a **library** and you let TypeScript infer, the emitted
`.d.ts` will reference the enhancer method interfaces — `BatchingMethods`,
`DevToolsMethods`, `RestorationMethods`, `OptimizedUpdateMethods`,
`EffectsMethods`. All five are exported from `@signal-tree/kernel`, so this works.

---

## 2. A reusable entity-CRUD Ops base

**The need:** N admin domains that all do list/create/update/delete against a
REST endpoint, with optimistic writes and rollback.

Most of this already ships. Before writing any of it, note what you get for free:

| Concern                            | Already provided by                          |
| ---------------------------------- | -------------------------------------------- |
| Normalized collection, O(1) `byId` | `entityMap()`                                |
| Fetch + caching + freshness        | app-owned service / framework data primitive |
| Load status                        | ordinary state in the slice                  |
| Save/submit lifecycle              | ordinary state in the slice                  |
| Batch writes in one notification   | `upsertMany` / `updateMany` / `removeMany`   |

What is **not** provided is the opinionated glue: your REST verb/URL conventions,
your error model, and the optimistic-rollback policy. That glue is what the
recipe is.

### State: one slice factory per domain

```typescript
import { entityMap } from '@signal-tree/kernel';

export function entityCrudState<T extends { id: string }>(api: ApiService, config: { name: string; endpoint: string; staleTime?: string }) {
  return {
    entities: entityMap<T, string>({
      selectId: (e) => e.id,
    }),
    loadStatus: 'not-loaded' as 'not-loaded' | 'loading' | 'loaded' | 'error',
    save: {
      state: 'idle' as 'idle' | 'saving' | 'saved' | 'error',
      error: null as AppError | null,
    },
    selection: { selectedIds: [] as string[], isAdding: false },
  };
}
```

The old `loader()` helper is not part of the current RC public API. Keep request
coalescing, freshness, and retry policy in the Ops/service layer.

### Ops: an abstract base over a tree slice

The base operates on a **slice of your existing tree**, not its own store, so all
domains share one DevTools timeline and one restoration history.

```typescript
export abstract class EntityCrudOps<T extends { id: string }> {
  protected abstract readonly slice: EntityCrudSlice<T>;
  protected abstract readonly config: EntityCrudConfig;
  private readonly api = inject(ApiService);

  // Reads proxy the slice — no copies, no sync.
  get entities() {
    return this.slice.entities.all;
  }
  get isSaving() {
    return this.slice.save.loading;
  }
  get saveError() {
    return this.slice.save.error;
  }

  update$(id: string, changes: Partial<T>): Observable<T | AppError> {
    const { entities, save } = this.slice;
    // SNAPSHOT FIRST — this is the rollback data.
    const previous = entities.byId(id)?.() ?? null;
    if (previous) entities.upsertOne({ ...previous, ...changes } as T);
    save.setLoading();

    return this.api.patch$<Partial<T>, T>(`${this.config.endpoint}/${id}`, changes).pipe(
      take(1),
      tap((saved) => {
        entities.upsertOne(saved);
        save.setLoaded();
      }),
      catchError((e) => {
        if (previous) entities.upsertOne(previous); // restore the snapshot
        const error = toAppError(e, `${this.config.name}.update`);
        save.setError(error);
        return of(error);
      })
    );
  }
}
```

A domain is then a few lines:

```typescript
@Injectable({ providedIn: 'root' })
export class PlantOps extends EntityCrudOps<Plant> {
  protected readonly slice = inject(APP_TREE).$.plant;
  protected readonly config = { name: 'PlantOps', endpoint: 'plant' } as const;
}
```

### Two things to get right

**Snapshot before you mutate.** Rollback needs the _previous value_, so capture
it first. `updateAndReport()` is not the tool here — it returns the changed
**paths** (for partial-payload sync, audit trails, targeted persistence), not the
prior values, so it cannot restore state on its own.

**Roll back the whole of what you touched.** If an operation clears selection,
snapshot the selection too and restore _that_, not the ids you were acting on:

```typescript
const previousSelection = selection.selectedIds(); // not `[id]`
```

Restoring `[id]` looks right and passes a single-selection test, then silently
drops the user's other selections whenever a delete fails with several rows
selected. This was a real bug found in review, and its test passed because it
selected exactly the row it deleted.

### Why this isn't in core

It has no independent runtime, so [RFC 0007 §1](../rfcs/0007-packaging-principle-and-ng-forms-reslice.md)
would place it in core as an injected feature rather than a package — but the
parts worth sharing are already shipped, and what's left is an `extend`-this base
class plus your REST conventions. A base class you inherit from is the ceremony
SignalTree defines itself against ("your state literal is the API"), so it stays
yours. Keep loading and REST policy in that application-owned layer; do not pass
a raw `load:` function to EntityMap.

---

## 3. A selection read-model

**The need:** `selectedIds` plus the derived reads every table UI wants.

`selectedIds` is app-owned writable state. The reads are four one-line
`computed`s, so they belong in the configured derived factory:

```typescript
export function selectionDerived<T extends { id: string }>(slice: { entities: Pick<EntitySignal<T, string>, 'byId'>; selection: { selectedIds: Signal<string[]> } }) {
  return {
    selection: {
      selectedEntities: computed(() =>
        slice.selection
          .selectedIds()
          .map((id) => slice.entities.byId(id)?.() ?? null)
          .filter((x): x is T => x != null)
      ),
      isMultiEdit: computed(() => slice.selection.selectedIds().length > 1),
      hasSelections: computed(() => slice.selection.selectedIds().length > 0),
      selectionCount: computed(() => slice.selection.selectedIds().length),
    },
  };
}
```

Merge it per domain:

```typescript
signalTree(createBaseState(api), {
  derived: ($) => ({
    plant: selectionDerived($.plant),
    driver: selectionDerived($.driver),
  }),
});
```

**Why not an `entityMap().computed()` slice?** A slice's `compute` receives only
that collection's `E[]`, so it cannot read an external `selectedIds`. Selection
is inherently cross-state, which is exactly the boundary that makes it a derived
rather than a slice — see the
[entity-collection cookbook §2](entity-collection-cookbook.md).

### If your derived reads come back `undefined`

That has one overwhelmingly common cause: **two copies of `@angular/core`**. Each
copy has its own `Symbol(SIGNAL)`, so `isSignal()` inside `@signal-tree/kernel`
rejects a `computed()` your code created, and the configured tier drops every value.
Since 13.2.0 this warns as `[ST2007]`; before that it failed silently. Fix the
duplication in your bundler (Vite: `resolve: { dedupe: ['@angular/core'] }`;
Jest: `moduleNameMapper`).

---

## 4. Optimistic writes with server reconciliation

**The need:** apply a change to the UI immediately, send it to the server, and
either confirm it or cleanly revert it — without losing whatever else the user
did while the request was in flight.

This is a full match for `transactions()`, not something to hand-roll. A
transaction's pending writes are excluded from confirmed causal turns until you
say otherwise, and rolling one back reverts **only its own writes** — later,
unrelated activity survives:

```typescript
import { signalTree, transactions } from '@signal-tree/kernel';

const tree = signalTree(
  {
    order: { status: 'open' as 'open' | 'assigned' },
    driver: { orderId: null as number | null },
  },
  { enhancers: [transactions()] }
);

const pending = tree.transaction(() => {
  tree.$.order.status.set('assigned');
  tree.$.driver.orderId.set(17);
});

api.assignOrder(17).subscribe({
  next: () => pending.confirm(),
  error: () => pending.rollback(),
});
```

If the request fails, `pending.rollback()` puts `order.status`/`driver.orderId`
back to their pre-transaction values — and if something else in the tree
changed in the meantime (a live telemetry feed landing a new row, say), that
change is untouched. This is a pinned, tested guarantee, not an assumption:
see `transactions enhancer › supports an optimistic workflow where rollback
reverts optimistic state but preserves later unrelated activity` in
[`packages/kernel/src/enhancers/transactions/transactions.spec.ts`](../../packages/kernel/src/enhancers/transactions/transactions.spec.ts).

### What `transactions()` does not decide for you

`transactions()` gives you the **pending → confirm/rollback lifecycle**. It
does not decide your reconciliation POLICY — server-wins vs. client-wins vs.
merge, whether a rejected write retries, or how staleness is judged. Those are
yours, same as the REST conventions in §2's Ops base:

```typescript
api.assignOrder(17).subscribe({
  next: (serverOrder) => {
    pending.confirm();
    // Server truth may differ from what you assumed (a different assignee,
    // say) — land it as external(), same as any other server-accepted value.
    external(() => tree.$.order.set(serverOrder));
  },
  error: (err) => {
    if (isRetryable(err)) return retry();
    pending.rollback();
  },
});
```

`external()` classifies that final write as **authoritative from outside the
current authored operation** — the correct label whether it happens to equal
what you optimistically set or not. A rejected server write is a domain
decision (retry, rollback, or surface a conflict for the user), not something
`transactions()` guesses at.

### Why not just `set()` and `catchError` a manual snapshot?

You can — §2's `EntityCrudOps.update$` does exactly that, by hand, because it
predates a cross-cutting need for `transactions()` in that recipe. The
difference `transactions()` earns is **isolation**: a hand-rolled snapshot/
restore reverts your own field to what YOU remembered, which is wrong the
moment something else touched the tree while your request was in flight (see
§2's own "roll back the whole of what you touched" warning — this is the same
bug at a different scope). `transactions()` reverts exactly its own turn's
writes, nothing else, unconditionally.

---

## 5. Staged / draft editing

**The need:** let a user accumulate several edits — a multi-field form, a
batch of row changes — reviewable before anything becomes real, discardable
without a trace if they back out.

SignalTree does not need a `beginStage()`/draft-session API for this, and one
is deliberately not planned (see [TODO §12](../../TODO.md)). The shape is:

```text
canonical state
      ↓
application-owned draft            (plain component/service state — a form
                                     model, a local signal, whatever your
                                     framework already gives you for "values
                                     the user is looking at but hasn't saved")
      ↓
validation / review / edits        (entirely your domain's business)
      ↓
one intentional commit             (writes the draft into canonical state —
                                     `transactions()` if the commit itself
                                     needs atomic all-or-nothing, undoable()
                                     if it should be one entry in restoration
                                     history, or a plain set()/upsertOne()
                                     if neither)
```

**What SignalTree owns:** that the eventual commit is coherently classified —
one authored turn (undoable, if you designate it so), not silently smeared
across however many writes your draft's field-by-field edits happened to
produce. **What your application owns:** everything about the draft itself —
its shape, its validation, whether it lives in a form library's model, a
plain component field, or its own tiny `signalTree()` you never merge with
the main one.

```typescript
// The draft never touches the tree — it's just state your form/component owns.
const draft = signal<Partial<Ticket>>({});

function reviewField(key: keyof Ticket, value: Ticket[typeof key]) {
  draft.update((d) => ({ ...d, [key]: value }));
}

function commit(id: string) {
  // One write, one authored turn — not one turn per field the user touched.
  tree.$.tickets.updateOne(id, draft());
  draft.set({});
}

function discard() {
  draft.set({}); // Nothing to undo — nothing was ever authored.
}
```

If the commit itself needs multi-location atomicity (several tree paths must
land together or not at all), wrap it in `transactions()` per §4 above — the
transaction body **is** the commit, and `confirm()` fires once validation
passes.

### Why this earns "canonical," not just "possible"

Committing a draft is functionally identical to any other authored write from
SignalTree's side — there's no special-cased "draft commit" concept to get
wrong, and nothing to keep in sync between a draft-tracking marker and the
canonical value, because the draft was never IN the tree. The causal model
does the real work here indirectly: because an authored turn is a first-class
concept, "the user's edit became real" is always one coherent fact to point
at later — in restoration history, in DevTools, or in a human-readable
explanation projected from the causal record (§8, below) — regardless of how
many keystrokes produced it.

### Executable example (already in this repo, not invented)

[`packages/kernel/src/lib/staged-draft-editing-0.spec.ts`](../../packages/kernel/src/lib/staged-draft-editing-0.spec.ts)
measures the two halves of this claim rather than asserting them: accumulating
draft edits produces zero tree writes and zero restoration growth: a discard
before commit leaves restoration history exactly as it was, because nothing
was ever authored; and one commit of a multi-field draft — three field writes
wrapped in one `undoable()` call — is exactly one restoration entry holding
the complete committed state, not three.

---

## 6. One-shot loading — no `link()` needed

**The need:** fetch a record, land it, done. No ongoing relationship, no
refetch policy to think about.

`loader()` and `asyncSource()` were both retired with no direct successor,
which reads as a gap until you notice neither one was ever required for
this case. The whole thing is three steps, none of them SignalTree's job
until the last:

```typescript
async function loadDriver(id: string) {
  const driver = await api.getDriver(id); // request + fetch: entirely yours
  external(() => tree.$.driver.set(driver)); // land it, classified correctly
}
```

`external()` is the only SignalTree-specific line. It exists so this write is
correctly attributed as "authoritative from outside the current authored
operation" rather than looking like the user typed it — which matters for
restoration history (an external write is not something `undo()` should hand
back to the user as if they'd made it) and for anything downstream that reads
causal origin (§4/§5's commit-classification story, a causal-explanation
projection). Loading, error state, retry, and caching are ordinary
application/framework concerns — a `resource()`, an RxJS pipe, a signal you
set yourself — exactly as if SignalTree weren't involved at all until the
`external()` line.

### When you'd reach for `link()` instead

Only when there's an ONGOING relationship to an endpoint, not a single fetch
— see §7. A `link()` for something you're going to read once and never
resync is a `Link` handle you have to remember to `dispose()` for nothing.

---

## 7. A persistent relationship with an external authority

**The need:** a tree location that stays synchronized with something outside
the tree — polling, a live push feed, or two-way sync (edit locally, persist
outward) — as an ongoing relationship, not a one-off fetch.

This is `link()`, unspecialized — the same primitive [the persistence
guide](persistence-guide.md) uses for storage, generalized to any endpoint.
Three independent directions, compose whichever you need:

```text
PULL       Y.get()         -> X     on demand, via connection.retrieve()
PUSH-IN    Y.subscribe()   -> X     pushed, live
PUSH-OUT   committed X     -> Y.set()   after every settled authored write
```

```typescript
import { link } from '@signal-tree/kernel';

const connection = link(tree.$.rows, {
  get: () => api.load(), // PULL — on demand
  set: (rows) => api.save(rows), // PUSH-OUT — every settled write
  subscribe: (next) => socket.on('rows', next), // PUSH-IN — live
});

await connection.retrieve(); // triggers get() once, now
// ... later, on teardown:
connection.dispose();
```

Supply only the directions you need — `loader`-shaped persistent polling is
`get` alone; a read-only live feed is `subscribe` alone; two-way sync uses
both `get`/`subscribe` and `set`. `X` (the tree location `link()` is given)
must be an OWNED SignalTree location — a bare `signal()` or `computed()` is
refused, because there is no tree to settle a write against.

### This is the actual mapping the four retired markers collapsed into

Not an assertion — this is literally the design record the kernel's own
`link()` behavioral spec opens with:

```text
loader / HTTP GET / localStorage read     PULL
asyncSource / socket / GPS                PUSH-IN
stored write / HTTP PUT / SQLite UPDATE   PUSH-OUT
persistence                               PULL + PUSH-OUT
live synchronization                      PUSH-IN + PUSH-OUT
```

See [`packages/kernel/src/lib/link-0-three-directions.spec.ts`](../../packages/kernel/src/lib/link-0-three-directions.spec.ts)
(the design-provenance comment at the top of that file is the source of the
table above) and [`link-1-relationship.spec.ts`](../../packages/kernel/src/lib/link-1-relationship.spec.ts)
for the relationship contract itself — including the two refusals worth
knowing up front: a rejected `set()` is captured and reported once through
`onTreeError` rather than left as an unhandled rejection, and a `get()` that
resolves AFTER `dispose()` must not resurrect the location (both pinned
tests, not incidental behavior).

### What SignalTree does not decide for you

`staleTime`, SWR, retry, request dedup, caching, auth, and URL construction
all live inside your `get`/`set`/`subscribe` implementations — none of them
are SignalTree concepts. If you need staleness-aware refetching (the removed `loader()`'s old `staleTime`/`swr` options), that's a small stateful wrapper
around `connection.retrieve()` you own, not something to look for on `Link`
itself.

---

## 8. A human-readable explanation, projected from causal facts

**The need:** show a user or an AI agent _why_ the tree looks the way it
does — "who changed this, and what happened" — without teaching the kernel
what a sentence is.

At the kernel boundary, restoration history exposes the snapshot that a retained
turn can restore:

```typescript
export interface RestorationHistoryEntry<T> {
  state: T;
}
```

That's it. No actor name, business-action label, timestamp, arbitrary payload,
prose, or per-field diff. The one thing every entry reliably gives you is
`state`: a whole-tree snapshot at that turn's boundary. This is deliberate,
not an omission to fill in later: a name, clock, sentence, or actor kept "for
the explanation" would make presentation data intrinsic to every retained
turn, despite being needed only by an application, projector, or future tooling.

### The composition

```text
restoration snapshot              (RestorationHistoryEntry.state — a whole-
                                    tree snapshot at each authored turn
                                    boundary)
      ↓
diff consecutive snapshots        (what changed between this entry's state
                                    and the previous one — ordinary object
                                    comparison, entirely your code)
      ↓
resolve stable identities         (an id the diff touched -> the entity/user
                                    it names, via entityMap().byId() or your
                                    own lookup — the kernel never stored the
                                    display name, only the id)
      ↓
application/domain metadata       (what "assigned" means for a ticket, what
                                    a driver's display name is — yours)
      ↓
projector                         (a plain function: the diff + your metadata
                                    -> a sentence, a diff view, an agent-facing
                                    JSON summary — whatever the consumer needs)
      ↓
"Ticket 482 was reassigned to Driver 17."
```

```typescript
function explainLastChange(tree: MyTree): string | null {
  const entries = tree.getRestorationHistory();
  const [previous, last] = entries.slice(-2);
  if (!last) return null;

  // Diffing is ordinary code — the kernel gives you the two snapshots, not the diff.
  const changedTicketId = findChangedTicketId(previous?.state, last.state);
  const ticket = changedTicketId ? tree.$.tickets.byId(changedTicketId)?.() : undefined;

  return ticket ? `Ticket #${ticket.ticketNumber} was reassigned to ${describeDriver(ticket.driverId)}` : 'A change occurred';
}
```

`findChangedTicketId`/`describeDriver`, timestamps, actors, payloads, and the
diff strategy are entirely yours. The kernel gives you a stable whole-tree
snapshot at every authored turn boundary and nothing more; deriving "what
changed" from two snapshots is application code, same as it would be diffing
any two plain objects.

`RestorationHistoryEntry`'s exact shape and `getRestorationHistory()`'s
behavior (one entry per designated turn, `state` always a full snapshot) are
proven in [`packages/kernel/src/enhancers/restoration/restoration.spec.ts`](../../packages/kernel/src/enhancers/restoration/restoration.spec.ts) —
not asserted here.

### Why the causal model helps here

Because an authored turn is a first-class kernel concept (not something your
application has to reconstruct from a stream of individual `set()` calls),
"one coherent thing happened" is already true before you write a single line
of projection code — you're formatting a fact that already has clean
boundaries, not inferring where one user action ended and the next began from
raw write noise.

### What SignalTree does not guarantee

It does not guarantee your explanation is HUMAN-READABLE, correct, localized,
or complete — that's the projector's job, entirely application code, and it
can be wrong the way any application code can be wrong. What the kernel
guarantees is narrower and more load-bearing: that each entry's `state`
corresponds to a REAL authored turn boundary (not a partial write, not an
external write mislabeled as authored), so the projector is never explaining
a change that didn't causally happen the way the snapshots say it did.
