# AGENT-UX-REFERENCE-0

> **Disposition: PASSES — reported 2026-09-22. No new primitive added.** A product proof using the
> API that already exists. **Not** a kernel-design track.

## Question

> Can an application implement a convincing multi-writer review workflow using
> **only the public SignalTree API**, without reconstructing kernel semantics
> itself?

The reference consumes exactly `proposal.inspect()` plus ordinary state reads.
No `SubjectId`, no `PositionId`, no transaction internals, no private effect
list.

## What the reference must prove

```text
1  LIVE REVIEW           proposed values visible before settlement
2  CURRENT vs SUPERSEDED  inspect() tells the reviewer whether each
                          contribution still stands
3  CONCURRENT TRUTH       a server/human change during review is immediately
                          visible through ordinary reads
4  SAFE SETTLEMENT        accept/reject does not clobber newer truth
5  ONE LOGICAL ACTION     a multi-field / multi-entity proposal is reviewed and
                          settled as one unit
```

Restoration is proved in a **separate section**, not mixed into the first
explanation, because it is a separate decision:

```ts
let proposal!: Proposal;
undoable(() => {
  proposal = tree.propose(() => applyAgentResult());
});
// review gap
proposal.accept();
// later
tree.undo();
```

Designation happens around the authored proposal, never retroactively at
`accept()`.

## The presentation trap this reference must not fall into

`status: 'current'` is the status of the **contribution**, not of the proposed
value. If an agent adds row A as `Alpha` and a server then renames it, the
structural contribution is still `current` — the entity it added still exists —
while the value on screen is the server's.

```text
Priority     3              CURRENT
Assignee     Ada            CURRENT
Order A      Server Name    CURRENT
                         ^-- status of the CONTRIBUTION;
                             the value beside it is an ordinary read
```

So the reference renders `inspect()` **beside** current state, never as a value
snapshot. `ProposalInspection` must not be made to pretend it is one.

## Falsifiers — registered BEFORE any convenience API

Reopen the API question only if the reference cannot be built without one of
these:

```text
- the review UI needs SubjectId or PositionId
- the app must reconstruct supersession itself
- the app must inspect private transaction effects
- framework-specific Proposal APIs are required
- accept/reject needs behaviour PendingTransaction does not already support
- current application state cannot be rendered beside inspect() cleanly
- one logical proposed action cannot be represented without app-side grouping
```

If none occur, **no new primitive is added**. The standing DX rule holds:

> Don't answer an awkwardness with another primitive.

## Method

Executable, not illustrative. The reference lives in `apps/demo`, whose specs
import `@signal-tree/angular` by package name — so "public API only" is
enforced by the import path rather than by reviewer discipline. A reach into
kernel internals would be visible as an import, which is the point.

---

# RESULT — the workflow builds on the public API, unchanged

`apps/demo/src/app/agent-review-reference.spec.ts`, 7 cases, green. All five
required properties hold, plus the presentation trap and the restoration
section.

## Every falsifier stayed clear

```text
needs SubjectId or PositionId                    NO
app reconstructs supersession itself             NO — inspect() reports it
app inspects private transaction effects         NO
framework-specific Proposal APIs required        NO
accept/reject needs behaviour PendingTransaction
  does not already support                       NO
state cannot be rendered beside inspect()        NO
one logical action needs app-side grouping       NO
```

The whole review surface an application writes is this:

```ts
const buildReview = (tree, proposal) =>
  proposal.inspect().changes.map((change) => ({
    path: change.path,
    status: change.status,
    currentValue: readByPath(tree, change.path),
  }));
```

`status` from `inspect()`, `currentValue` from an ordinary read. Nothing else.

**Stated accurately: `readByPath()` is an APPLICATION adapter, not something
SignalTree provides.** There is no universal path resolver here and none is
claimed. The proof is narrower and sufficient: an application can map a public
`path` onto state it already understands, without `SubjectId`, `PositionId`,
private effects or supersession logic of its own.

**Consequence: `ProposalChange.path` is now behavioural API.** The reference
associates review status with application state through it, so its FORMAT is a
contract and not merely a string-shaped type — `orders.7841.priority` carries
the business key. `proposal-review-surface-0.spec.ts` remains the explicit
authority for that behaviour. Do NOT respond to path handling by adding value
snapshots to `ProposalInspection`; that would make the inspection pretend to be
a value snapshot, which is exactly the presentation trap above.

**So no new primitive is added.** The standing rule holds: don't answer an
awkwardness with another primitive.

## The presentation trap, proved rather than described

An agent adds row `A` with `assignee: 'Alpha'`; a server then renames it:

```text
row A   status  'current'        the contribution — the entity exists — stands
        value   'Server Name'    an ordinary read, which is the server's
```

A UI showing status without that value column would tell the reviewer the
opposite of the truth. The reference renders them side by side.

## A real DX finding the reference surfaced

The first draft wrote `tree.$.lastSyncedBy('agent')` on the ANGULAR facade.
That silently did nothing: Angular leaves are Angular signals, written with
`.set()`, so the callable form is a read with an ignored argument. The write
never happened and `inspect()` correctly reported only the other change.

This is the third adapter where the callable-write form is not the write door —
Solid documents `.set()` too, while React writes callably. The grammar is
genuinely adapter-physical, which is why the Phase B contract delegates writes
to hooks. Worth carrying into the docs: **a reference example written for one
adapter's write grammar is silently wrong on another.**

## Verified

```text
reference cases        7/7
demo full suite        29 suites, 169 passed, 4 skipped
kernel                 286 files / 2410 passed
typecheck              exit 0
```
