# Eager per-subject activation tokens — candidate, UNDISCHARGED

**Status:** TRIAL RUN. The function survives; eager realization does not.
Change applied and validated — see "Result" at the end.
No change has been made. Reproduce the census and ablation as described below.

## Presence

A completely unobserved `setAll(10k)` — no `byId()`, no metadata reads, no
`timeTravel()`, no transactions, no held nodes — creates **10,000 Angular
`WritableSignal`s**. Measured read-only through the already-exposed
`__inspectSubjectResources`, which reports
`activationToken: subjectStateSignals.has(subjectId)` per subject:

| after `setAll(10k)` plus… | `entitySignal` | `activationToken` | node facade |
| ------------------------- | -------------: | ----------------: | ----------: |
| nothing                   |              0 |            10,000 |           0 |
| `all()`                   |              0 |            10,000 |           0 |
| `updateOne`               |              0 |            10,000 |           0 |
| one `byId()`              |              1 |            10,000 |           1 |
| `byId()` on every row     |         10,000 |            10,000 |           0 |

`entitySignals` is demand-created and is a **separate row** (see below).
`subjectStateSignals` is driven purely by membership.

## Cost

Ablation: `getSubjectStateSignal` returns one shared signal so the per-subject
map contributes nothing. Rebuilt, measured, reverted.

| arm                     | as shipped         | ablated         |
| ----------------------- | ------------------ | --------------- |
| L4 public baseline, 10k | 11.19 MB (1,173 B) | 5.85 MB (613 B) |
| L1 physical stores, 10k | 4.34 MB (455 B)    | 4.34 MB (455 B) |
| `setAll(10k)`           | 18.84 ms           | 16.87 ms        |

**5.34 MB, ~560 B/entity — 48% of the public base retention and 78% of the
L1 -> L4 existence overhead.** An independent measurement of a bare Angular
signal (577 B/signal, `memory-report.mjs`) lands within 3%.

⚠️ Label this **per-subject activation-token machinery**, not "the signals".
The ablation replaced map entries, signal objects and associated retained state
together; it does not isolate the signal object from its Map entry. The
independent per-signal figure makes the signal the likely dominant term, but
that is inference, not measurement.

## The mechanism, traced

**Created eagerly at four sites, all discarding the return value** — called
purely for the side effect of interning a signal when a subject is created:

```text
entity-signal.ts:726    commitFreshSubject
entity-signal.ts:851    fresh add
entity-signal.ts:1047   add with transform
entity-signal.ts:1837   bulk adds (setAll / addMany)  <- the 10,000
```

**Written from one place**, `publishSubjectPhysicalChange` ->
`bumpSubjectStateSignal`, reached from nine call sites covering rekey, remove,
restore, subject transfer and reclamation.

**Read from exactly one place** — `currentKey()`, inside a materialized entity
node:

```ts
const currentKey = (): K | undefined => {
  getSubjectStateSignal(subjectId)(); // the reactive dependency
  const resolved = structuralStore.resolveSubjectHandle(handle);
  return resolved.state === 'active' ? resolved.key : undefined;
};
```

Nodes are demand-created (`byId()`, weakly cached). So the resource is created
eagerly for every member while its only consumer is created on demand. That is
the shape of the inversion already removed once from `setAll` — but the shape is
not the argument. The function has to be established.

## The function to attack

Not "do we need `subjectStateSignals`". State it without Angular nouns:

```text
FUNCTION
  After a reactive consumer has observed a member's structural state, later
  structural changes that independently affect that observation must cause it
  to observe the correct current state.
```

Stated this way on purpose: the contract is not that `byId()` returned an
object, it is that a reactive dependency was actually established. Otherwise a
reactive resource is granted merely because a handle exists.

Challenge cases, each independently:

```text
acquire member observation -> rekey subject
    -> the observation reports the correct current structural state

acquire member observation -> remove subject
    -> the observation reflects the required removal/tombstone semantics

remove -> restore
    -> a surviving observation behaves per the established lifetime contract

same key, different subject
    -> an old observation must not silently follow the new occupant,
       IF that identity distinction independently survives
```

The strongest opposing contract:

> No per-subject reactive resource exists until some observation requires one;
> canonical structural state alone is sufficient before then.

## Two outcomes, only one of which is "delete the concept"

The preregistration deliberately does not predict which of these wins.

```text
FUNCTION survives, EAGER POPULATION fails
  -> per-subject structural reactivity remains a valid on-demand mechanism
  -> delete the four eager creation sites, realize on first read

FUNCTION fails entirely
  -> the mechanism goes the way of subjectPositions
```

⚠️ A wrinkle for whichever survives: `bumpSubjectStateSignal` also interns via
`getSubjectStateSignal`, so removing only the four eager sites leaves writes
creating a signal for any subject that is ever mutated, observed or not. A
complete change likely has to make the writer conditional — bump only what
already exists. Flagged as a design consequence, not a decision.

## Separate row: touched-entity-signal retention

`entitySignals` is already demand-created, so its problem is lifecycle, not
eagerness:

```text
observation demanded -> entity signal created        correct
observation dropped  -> entity signal stays strong   questionable
```

That is the +566 B/entity `L4 -> L5t` residue (11.19 -> 16.59 MB at 10k). It is
`tombstoneSubjectSignal` / `resetEntitySignals` territory, and it should be
audited on its own after this row, not merged into "per-subject Angular
signals".

## If this row resolves

```text
public base today                   1,173 B/entity
public base without eager tokens      613 B/entity
physical stores                       455 B/entity
remaining unexplained existence gap   158 B/entity
```

That last 158 B/entity is the honest unknown and has not been attributed. Do not
call it "Angular overhead" before measuring it.

## Result

The null was exactly the demand-only one: delete the four eager creation sites,
make the writer publish only to a token that already exists
(`subjectStateSignals.get(id)?.update(...)` instead of interning), keep the
demand-side reader untouched.

```text
STRUCTURAL REACTIVITY FUNCTION    SURVIVES for actual observation
EAGER MEMBERSHIP REALIZATION      NOT REQUIRED — deleted
UNOBSERVED MUTATION REALIZATION   NOT REQUIRED — deleted
REPRESENTATION                    on-demand realization is sufficient
```

All four reactive cases pass with the consumer established _before_ the
mutation — rekey, remove, restore, and value update. Every structural invariant
holds:

| after `setAll(10k)` plus…              | activation tokens |
| -------------------------------------- | ----------------: |
| nothing                                |                 0 |
| `updateOne` on an unobserved member    |                 0 |
| rekey of an unobserved member          |                 0 |
| remove of an unobserved member         |                 0 |
| `all()` projection read                |                 0 |
| one member's structural state observed |                 1 |
| …and that member then changes          |  observer correct |

Seventeen tests failed and every failing diff was `activationToken: true ->
false` or a `'subject-activation-channel'` entry leaving a reclamation retain
list — the incumbent representation, not behaviour. They were corrected to the
new truth rather than deleted, because the inventory they assert still exists.

Correcting them surfaced a sharper fact than the trial asked for: **acquiring a
node does not create a token — evaluating a field does.** `byIdOrFail(2)` and
`.name` leave the count at zero; `.name()` invokes `currentKey()` and creates
it. That is the tightened function realized exactly — a reactive resource
appears when a consumer establishes a dependency, not when a handle is handed
out.

### Measured

| measure                           | before   | after    |
| --------------------------------- | -------- | -------- |
| L4 public baseline, 10k           | 11.19 MB | 5.85 MB  |
| L4 per entity                     | 1,173 B  | 613 B    |
| marginal slope (independent tool) | 1,176 B  | 613 B    |
| `setAll(1k)`                      | 1.80 ms  | 1.65 ms  |
| `setAll(10k)`                     | 18.84 ms | 16.90 ms |
| `setAll(50k)`                     | 87.39 ms | 76.94 ms |
| L1 physical stores (control)      | 4.34 MB  | 4.34 MB  |

The production result matches the ablation to the precision these figures are
reported at (5.85 MB either way). `memory-compare.mjs`, whose two-size slope
cancels fixed costs, corroborates the same 613 B/entity by a separate benchmark
path — corroborating rather than fully independent, since both tools sit on the
same quiescence infrastructure.

Against `@ngrx/signals` at 89 B/entity marginal, the gap goes from ~13.2x to
~6.9x. The remaining existence overhead over the physical stores is now
613 - 455 = **158 B/entity**, which is the next unattributed decomposition and
must not be called "Angular overhead" before it is measured.

### The source now encodes the invariant

Verified mechanically rather than asserted:

```text
getSubjectStateSignal(subjectId)()             1   the demand-side read
subjectStateSignals.get(subjectId)?.update()   1   conditional publication
bare getSubjectStateSignal(subjectId);         0
getSubjectStateSignal(...).update(...)         0
```

The interning accessor is reachable only from the single read, so the topology
itself says:

```text
existence does not realize observation
mutation does not realize observation
observation realizes observation
later mutation publishes only to existing observation
```

### Unplanned benefit: churn

Retired subjects no longer leave a token behind, so the orphan portion of the
churn finding fell without being targeted (1,000 live rows, 50 generations):

| arm                    | before        | after         |
| ---------------------- | ------------- | ------------- |
| no history, no reads   | 798 B/retired | 249 B/retired |
| no history, byId reads | 1,346 B       | 798 B         |
| `timeTravel()`         | 2,003 B       | 1,311 B       |

Unbounded growth per retired subject remains the open finding in
[entity-churn-retention.md](./entity-churn-retention.md); it is now ~69% smaller
in the no-restorer arm.

### Still open, deliberately untouched

`entitySignals` lifecycle (the `L4 -> L5t` residue, now 5.41 MB at 10k),
`structuredClone`, the 158 B/entity remainder, and rich field realization in
held nodes. None were touched by this change.
