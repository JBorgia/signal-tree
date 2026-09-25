# Radical Alternatives Register — opened 2026-09-25

## The process rule this encodes

> **Radical-first falsification.** Before adding machinery to the leading
> architecture, ask whether a materially simpler architecture exists that
> DELETES the entire problem class. Test the most disruptive plausible
> architecture first when its failure can be established cheaply.

> **Complexity must earn itself against deletion.** For every new concept --
> `UnresolvedObligation`, waiter graph, emission footprint, frontier, dependency
> edge -- ask whether an architecture exists in which the concept simply does
> not exist. Test that architecture before making the concept permanent.

"Radical" means CHANGES THE SOURCE OF TRUTH, not changes a data structure. Each
entry gets one page and ONE killing experiment, not equal effort.

The target is not to prove Candidate C good. It is to make it increasingly hard
for a materially better architecture to still be hiding.

## Already decided — do NOT re-run these

Three entries on the proposed list are answered by work already done, and
re-running them would waste effort in the opposite direction.

**No shared-live speculative mutation (pure draft) — FALSIFIED, formally.**
Measured, not dismissed: draft scored 69 held / 112 violated on the 203
bridge-carryable SEMANTICS-2 rows, and its 16 T12 failures are one architectural
fact -- a second contribution cannot see an entity created by a still-pending
first contribution, because a draft is based on canonical. The native kernel
holds all 16. Draft passes only by simulating a live overlay, which the frozen
promotion rule names in advance as the finding that draft is not simpler for
this product. Recorded as falsified rather than rejected.

**Per-contribution overlay stack — this IS the leading candidate, not an
alternative to it.** frontier.mjs already resolves each cell as the
highest-seq surviving patch with `omit` for the settling contribution, and has
no compensation concept at all. It is not an untested radical direction.

**Explicit dependency declaration only — already a component, not a
replacement.** DEPENDENCY-1 established that reads inside `transact()` are
capturable and that hoisted/external dependencies are NOT inferable at all, so
declaration is already required for class 3. The open question is whether
declaration should REPLACE capture for classes 1-2, which is an ergonomics
question, not an architecture falsifier.

## Open entries, ordered by leverage / cost

    RADICAL-COMMITTED-VIEW-0   deletes the MOST machinery, cheapest to test
    RADICAL-PERSISTENT-0       one benchmark may settle it
    RADICAL-MVCC-0             medium cost, deletes compensation
    RADICAL-OPLOG-0            large, but makes ownership native
    RADICAL-CAUSAL-DAG-0       separates causal substrate from state
    RADICAL-JOINT-DISPOSITION  no rollback of observed speculative work
    RADICAL-TAINTED-VALUES     likely killed on JS ergonomics alone

### RADICAL-COMMITTED-VIEW-0 — run FIRST

Claim: Link never needs blocker logic, because each consumer reads a
COMMITTED-ONLY projection. If true it deletes obligations, waiters, emission
footprint, multiplicity and late-seeding in one move -- every concept built in
this branch.

Why it is plausible: frontier already exposes `canonical()`, i.e. resolve with
pending patches omitted. A committed projection may be nearly free in that model
rather than a second tree.

Prediction to test, stated before running: it likely DISSOLVES F5-A and FAILS
F5-B. Under a committed-only view, x's canonical value does not change while
pending, so nothing is exported for x and nothing needs holding; y's canonical
changes, so y exports normally -- independent progress falls out with no
machinery. But a dependent write (`y = x() + 1`, P2 confirms) makes y's CANONICAL
value 2, derived from an uncommitted x, and a committed-only projection would
export it. If that happens, committed-view deletes the independent-progress
machinery but cannot replace the dependency machinery.

Kill if: maintaining the projection duplicates the tree, breaks realization
semantics, or imposes cost on trees with no Link.
Promote if: it dissolves BOTH F5-A and F5-B.
Partial: if it dissolves only F5-A, the obligation model shrinks to dependency
only, which is still a large deletion and must be taken.

---

## FROZEN RULE — authority is a partial order (from AUTHORITY-1 row E)

> **A semantic fact has a selectable frontier only when there is a UNIQUE
> MAXIMAL candidate under the explicit authority relation.**

If two live candidates are incomparable, SignalTree must NOT invent an order.
L12 is explicit: "The kernel never infers authority order from arrival order.
Authority order comes from the semantic contract of the INGRESS OPERATION, or
from explicit authority evidence."

The obvious contribution-store implementation violated this SILENTLY, resolving
incomparable domains by insertion order. Nothing in the other authority rows
exposed it; only modelling authority as a relation rather than a scalar did.

**Resolution, decided now rather than deferred:** no public conflict value is
added. The ingress contract must supply enough authority evidence to establish a
legal frontier, and an ingress that does not is REFUSED before incoherent truth
is published. A first-class user-visible conflict state is introduced only if
unresolved multi-authority truth is later decided to be a product feature in its
own right.

Also recorded from AUTHORITY-1: the base must carry the authority that produced
it, or compaction erases ordering and a later lower-authority write wins. That
is one tag on current truth, not retained history.
