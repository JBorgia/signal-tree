# Pre-release surface blockers

> **Status: OPEN. These block release, not Phase B.** One list so none of it is
> rediscovered late. Owner instruction, 2026-09-22: the grammar rename and
> everything below must be addressed before release.

## The ordering that is binding

Placement decides names. Names decide docs. Nothing is applied twice.

```text
1  CAPABILITY-SURFACE-0        method surface vs standalone operations
                               -> docs/research/capability-surface-0.md
2  disposition ownership       where optional operations live
3  PUBLIC-API-GRAMMAR-0        classify the FINAL surface, approve one
                               complete rename set
4  apply placement + naming    together, once
5  callable/ownership gate     inventory callables, not exports
6  docs sweep                  README, guides, llms.txt, demo,
                               packed consumers, api-baseline, migration
7  full gates + self-test
8  Phase B against FINAL API   branch phase-b-proposal-realization
9  REACT-PENDING-TURN-REALIZATION-0
10 retired-subject-slope       trustworthy gates before release
11 release
```

## Blockers

### 1. Grammar rename — `proposal()` -> `propose()`

Preserved on branch `grammar-rename-unapproved`, deliberately NOT committed to
main. A verb beside `accept()`/`reject()` is the better name; `proposal()`
returning a `Proposal` was a noun-as-method. Held only because
CAPABILITY-SURFACE-0 may move the operation off the tree entirely, in which
case the name lands as `propose(store, fn)` and the method rename was wasted
motion.

**Must not ship as `proposal()` by default through inattention.** If
CAPABILITY-SURFACE-0 keeps methods, apply the rename. If it goes standalone,
the name still changes — just in a different position.

### 2. The rest of the approved rename set

`PUBLIC-API-GRAMMAR-0`'s inventory also flagged `empty()` as a genuine naming
defect: it is a boolean query sitting beside a mutating `clear()`, so it reads
as a command. `isEmpty()` is the candidate. `tap()`, `intercept()` and
`settled()` were correctly left undecided — they carry domain meaning and need
use-site inspection, not taxonomy alone.

### 3. Callable-surface gate

`api-baseline` is export-oriented and therefore blind to a public method added
to an already-exported interface: `proposal()` landed on `TransactionMethods`
and the baseline recorded only the five new types. Any gate that comes out of
this must inventory **callables and their owners**, not exports.

### 4. Versioning commitment

The support policy promises a documented migration path before removal, except
for correctness or security defects. Naming and placement cleanups are neither.
So removals need a bridge release that deprecates with a stated replacement,
then one coherent major — not a silent rewrite of a policy adopted days ago
specifically to rebuild API-stability trust.

### 5. `retired-subject-slope`

~38% spurious red on untouched code, bimodal, tracked in
`RETIRED-SUBJECT-SLOPE-STABILITY-0`. Does not block development; does block
trustworthy release gates, because a gate whose noise crosses its threshold
provides no evidence in either direction.

### 6. `REACT-PENDING-TURN-REALIZATION-0`

React does not physically realize pending-turn state — measured with raw
`transaction()`, so it is not a Proposal defect. Angular, Vue and Solid pass
the same conformance contract 7/7.

## Preserved work

```text
grammar-rename-unapproved        rename sweep + ~419 lines grammar/DX inventory
phase-b-proposal-realization     shared realization contract + 4 adapters
```

Both built with a temporary git index, so neither disturbed the working tree.
