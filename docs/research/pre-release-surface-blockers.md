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

### 5. `retired-subject-slope` — redesigned, NOT yet cleared

The old 50-vs-150 slope and ratio checks are falsified and removed: their
operands were 4 MB-quantized and overlapping, so the verdict was decided by
which runtime mode each median drew. Replaced by an absolute 40 MB ceiling on
the non-retaining arm, mutation-proven in the SAME arm with deliberate
retention.

**Remaining blocker: the threshold was derived on darwin/arm64 and release
gates run on ubuntu-latest linux/x64.** An absolute ceiling is
environment-dependent in a way the normalized slope was not. Validate on the
release platform — control distribution plus `--retain 10000` — before it
blocks a release.

Honest sensitivity, recorded rather than implied: reliably detects >= ~10,000
deliberately retained retired-node HANDLES; 5,000 is marginal; <= 2,500
invisible. Handles rather than subjects, because a 1:1 handle-to-SubjectId
relationship was not separately proven.

### 6. `REACT-PENDING-TURN-REALIZATION-0`

React does not physically realize pending-turn state — measured with raw
`transaction()`, so it is not a Proposal defect. Angular, Vue and Solid pass
the same conformance contract 7/7.

## Permanent engineering rule from this episode

> **Never use a global textual rename as evidence that an API migration is
> complete.**

The `transaction()` -> `transact()` sweep looked complete after matching
`.transaction(`. It was not. What the grep did not distinguish:

```text
bare property access        store.transaction        (no parens)
indexed type access         (typeof t)['transaction']
synthetic fixtures          test extensions that declare their OWN member
                            named `transaction`, which must NOT be renamed
formatting-sensitive tests  @ts-expect-error directives whose position depends
                            on a file being unformatted
```

Typecheck and the behavioural suites found every one of those; the grep found
none of them. A rename is complete when the type system and the gates say so.

Corollary, learned the expensive way in the same change: **never run a
formatter over a glob wider than the files you edited.** A blanket prettier
sweep reformatted 135 unrelated files and broke `@ts-expect-error` positioning
by splitting single-line calls away from their directives.

## Preserved work

```text
grammar-rename-unapproved        rename sweep + ~419 lines grammar/DX inventory
phase-b-proposal-realization     shared realization contract + 4 adapters
```

Both built with a temporary git index, so neither disturbed the working tree.
