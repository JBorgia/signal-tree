# AGENT-UX-REFERENCE-0

> **Disposition: OPEN — preregistered 2026-09-22.** A product proof using the
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
