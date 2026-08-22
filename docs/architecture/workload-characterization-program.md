# Workload characterization as the architectural input

**Status:** framing. Adopted as the input to representation decisions; the study
itself is not done.

The central question is not "how should entityMap be implemented", and not "how
do other libraries implement entities". It is:

> What state-management work do real applications repeatedly perform, what does
> that work cost, where are developers forced outside their state library to
> satisfy it, and which representation handles those workloads at the lowest
> total runtime, memory and developer cost?

## Evidence hierarchy

| #   | evidence                            | tells us                                   |
| --- | ----------------------------------- | ------------------------------------------ |
| 1   | real application runtime traces     | what actually happens                      |
| 2   | published empirical studies         | whether the pattern generalizes            |
| 3   | production engineering reports      | what breaks at scale                       |
| 4   | developer pain / external solutions | what state libraries leave unsolved        |
| 5   | competitor implementations          | conventions and compatibility expectations |
| 6   | microbenchmarks                     | cost of a candidate implementation         |

**This repo has been running almost entirely on 5 and 6.** That is not an
abstract concern — it is documented in this very investigation. Every
representation judgement up to
[collection-access-profile.md](./collection-access-profile.md) rested on
microbenchmarks plus an unexamined assumption that whole-collection access was
cold. The first look at tier-1 evidence (real consumer code, two branches)
overturned that assumption immediately: `all()` outnumbers `byId()` ~3:1 by call
site, reactive fan-out runs 3-7 consumers per collection, and the shared CRUD
helper turns a point update into a whole read plus a whole write.

Microbenchmarks answer "what does this cost". They cannot answer "how often does
this run", and only the second question decides an architecture that
deliberately trades construction cost for steady-state cost.

## What to characterize

Not API surface — what state actually does:

```text
mutation      point / batch / structural / optimistic / rollback-reconcile
observation   point / whole-collection / filter / sort / group / aggregate /
              cross-store derivation
temporal      transactions / undo / history / snapshots / time travel
distributed   persistence / server sync / optimistic state / realtime /
              offline / conflict resolution
reactive      fan-out / invalidations per mutation / recomputation depth /
              redundant traversal / subscriber lifetime
```

## Workload classes, each with a cost vector

```text
W1 traditional UI state          W6 collaborative / multi-writer
W2 data-heavy interactive UI     W7 temporal state
W3 realtime                      W8 high-frequency telemetry
W4 optimistic network            W9 complex enterprise, many stores
W5 offline-capable
```

```text
N   collection size        F   reactive fan-out
Rp  keyed reads/sec        D   dependency depth
Rc  collection reads/sec   O   optimistic mutations/sec
W   writes/sec             S   sync events/sec
H   historical retention   L   expected lifetime
```

## How a representation gets scored

```text
LifetimeCost(rep, workload) =
    construction
  + pointReadCost      × Rp × L
  + collectionReadCost × Rc × L
  + mutationCost       × W  × L
  + invalidationCost   × F  × W × L
  + retainedMemoryCost × L
  + transientMemoryCost

Score(rep) = Σ P(workload_i) × LifetimeCost(rep, workload_i)
```

Re-weighting `P` is the point: it lets us ask what wins today, what wins if
realtime doubles, what wins if optimistic/offline becomes normal, what wins at
100K entities, what wins if derived collections become the dominant consumption
mechanism.

## Developer cost is part of the score

CPU is not the only axis. Worth counting per requirement:

```text
lines required to express optimistic state
independently synchronized copies of the same state
invalidation boundaries the developer must reason about
rollback code
selector / memoization code
defects arising from keeping derived state in sync
```

A representation that costs another 30 MB can be the better architecture if it
removes a synchronization layer and two dependencies. Conversely, 15 ns off
`byId()` is irrelevant if it complicates something developers do constantly.

## Negative space — likely the highest-value stream

For each recurring requirement: how often does it occur, how expensive is it,
does the state library support it natively, and if not what does the developer
bolt on — and how much duplicated state and coordination results?

The pattern to look for is applications assembling:

```text
state library + query/cache + undo/history + persistence + websocket sync
+ hand-rolled transactions + rollback + conflict handling
```

The opportunity may not be "make update() faster" but "make several of those
unnecessary". A competitor may lack a capability because its representation made
it awkward — that is not a reason to inherit the limitation.

**First negative-space datum, already in hand:** across 25 `entityMap`
declarations in a real application, `ids()` and `asMap()` have **zero** call
sites. Surface that exists and is not used is the inverse signal — it says the
consumed whole-collection API is `all()` alone.

## Standing cautions

- Competitor implementations are case studies inside this program, not the
  design boundary.
- Two ownership violations in a row do not establish that every remaining cost
  is an ownership violation. Some costs should survive.
- Where no trace exists, model explicit low/typical/high scenarios rather than
  inventing a single number.
- External literature cited in discussion (incremental-vs-recompute being
  workload-dependent; sync timing as a cost/responsiveness tradeoff; optimistic
  UI shipping in production with rollback/conflict as the real cost; reactive-API
  usability studies) has NOT been independently verified here. It is recorded as
  the direction the argument came from, not as evidence this repo has checked.
