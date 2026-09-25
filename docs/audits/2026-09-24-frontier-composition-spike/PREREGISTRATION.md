# Frontier composition spike — PREREGISTERED before implementation

Frozen 2026-09-24, **before any spike code exists**, so no property can be
adjusted after seeing a result. Recorded at the point where frontier leads the
bridgeable contract surface but has not earned selection.

## Why this exists

The bridge answered what it honestly could and stopped. It deliberately models
none of Link, batching, restoration, framework publication or retention, and it
cannot: PROTOCOL disclaims them. The question it therefore cannot reach is the
one that decides v16:

> Can the frontier mechanism keep its semantic advantage when connected to the
> actual SignalTree machinery the bridge could not model?

SignalTree has historically failed **at boundaries**, not inside a subsystem.
That is precisely what is untested so far.

## Status entering the spike

On the 203 bridge-carryable rows, after six bridge defects were found and fixed
and calibration came back with no distorting categories:

    path                held  violated  unsupported
    native               110        58           35
    incumbent-bridged    108        57           38
    frontier             177         0           26
    prepared             106        60           37
    draft                 69       112           22
    replay                43         0          160

Frontier is the only candidate that is both broad and violation-free on the
honestly bridgeable surface. Replay's zero violations are not comparable -- it
declines most of the surface. This is a LEAD, not a verdict: 177/0 was measured
through an instrument that produced six false candidate findings before it was
calibrated.

## The architecture constraint — the spike's main risk

Frontier must **replace one responsibility**, not sit beside the existing engine
as a second semantic system:

    public direct write
        -> existing semantic addressing / lifetime
        -> frontier ownership resolution        <- the candidate replacement
        -> existing coherent realization / publication
        -> Link / frameworks / restoration

It keeps PositionId, SubjectId, StructuralStore, mutation frames,
PathNotifier/publication and framework-native realization. It replaces the
baseline-compensation / overlap-decision responsibility.

> **If the spike ends up maintaining two sources of truth, that is NEGATIVE
> evidence and is to be reported as such, not engineered around.**

This is the same trap the draft adapter rule named: the finding is not allowed
to be quietly implemented away.

## Preregistered properties

Each is pass / fail / unsupported-with-reason. `unsupported` is never a pass.

    F1 overlapping pending scalar writers
       P1 writes x,y; P2 writes y,z; all R8 reject/confirm orders
       -> settles correctly, with NO unnecessary refusal

    F2 later ordinary/external truth over an older pending contribution
       later write at the same location
       -> later truth survives
       -> settling the older contribution does not resurrect or clobber it

    F3 pending-created entity lifetime  (the case draft could not do)
       P1 creates S1; P2 edits S1
       -> shared-live semantics actually work
       -> settling either contribution preserves valid dependent truth

    F4 structural topology
       add / remove / rekey, plus a new lifetime at a freed key
       -> SubjectId lifetime stays correct
       -> no key-based retargeting

    F5 Link / L16                      (unmeasurable through the bridge)
       pending contribution on x, unrelated y changes
       -> unrelated outbound progress continues
       -> no fabricated mixed snapshot is ever sent
       -> only a DEMONSTRATED dependency may hold

    F6 batching / deferred context
       transaction / external / restoration across deferred execution
       -> semantic classification survives scheduling

    F7 restoration
       later authoritative truth arrives after an authored contribution
       -> undo/rollback never erases later truth

    F8 L15 retention                   (unmeasurable through the bridge)
       after the obligation ends:
       -> active correctness state is reclaimed
       -> diagnostic retention is optional and explicitly bounded

    F9 publication
       settlement emits only coherent snapshots
       -> no intermediate torn state through the real notifier/framework path

F5 and F8 are the two the bridge structurally could not reach (9 Link rows and
41 confirmedCount rows). They are the point of the spike, not an extra.

## Order of execution — and why it is NOT F3 first

    PHASE 0  DECISION PROBE     F1 -> F5          <- run this first
    PHASE A  ownership is real  F3, F2, F4
    PHASE B  ownership composes F6, F7, F9
    PHASE C  no permanent baggage  F8

The natural instinct is F3 first, because it is the best pure integration test:
it forces the candidate through real SubjectId, StructuralStore, entity lifetime
and field ownership, and an F5 failure before ownership is stable is ambiguous
between frontier being wrong, the integration being incomplete, the Link handoff
being wrong, and publication timing being wrong.

That reasoning is correct for PROVING the architecture. It is the wrong order
for DECIDING WHETHER TO BUILD IT, and that is the open question.

Reason: the measured value of the structural rows is low. Of the 58 contract
violations frontier fixes, 48 are rekey scenarios with two or three
simultaneously-pending operations -- 40 of them "three pending rekeys" alone.
That is a pathological pattern, not an application pattern. The property with
real user value is F5, the tree-wide Link hold, which is everyday-path and
entirely unmeasured.

So what is PROVEN is low-value and what is HIGH-VALUE is unproven, and the order
should resolve that asymmetry first.

F1 and F5 are both purely SCALAR. F5 needs scalar ownership plus Link; it does
not need entity lifetime, SubjectId or StructuralStore, which is what makes F3
expensive. F1 supplies exactly the control that disambiguates an F5 failure: if
F1 holds and F5 fails, the failure is in ownership-to-Link composition and not in
ownership itself. The diagnostic argument is therefore satisfied without first
building structural ownership for the exotic-rekey family.

KILL CONDITION. If F5 fails after F1 holds, STOP. Frontier's remaining
demonstrated value is 58 exotic rekey rows, which does not justify replacing a
working ownership mechanism in a GA product. Phases A-C are not attempted.

## What would make frontier EARNED

All of the following, together. Any one failing sends it back:

1. converts the known unnecessary refusals into correct settlements
2. preserves every current safety property
3. passes structural lifetime cases NATURALLY, not via presence guards
4. removes or materially narrows the global Link hold
5. requires no retained per-write history after obligations end
6. preserves coherent publication
7. does not require developers to stop using normal direct writes
8. is SIMPLER in semantic exceptions than the current compensation machinery

Criterion 8 is a judgment, so it is decided against a count, not a feeling --
and the count separates two categories, because they are not the same thing:

    MECHANISM RULES  rules intrinsic to the ownership model, e.g.
                     "the latest surviving contribution determines the
                     visible value"
    PATCH RULES      conditionals whose only purpose is repairing an
                     interaction or edge case, e.g. "...unless a later pending
                     writer overlaps, except the external versioned case,
                     except rekey collision, except..."

Ten lines of general ownership machinery can be mechanically larger and
semantically SIMPLER than five scattered compensating guards. So the comparison
is over:

    number of semantic concepts
    number of exception branches
    number of cross-subsystem special cases
    number of retained state classes

and explicitly NOT over raw lines of code.

## Rules for running this

- Preregistered properties are frozen. A property discovered mid-spike is
  recorded as NEW and reported separately; it never retroactively joins this
  list.
- A spike defect is classified as a spike defect before any result is reported
  as architecture evidence. Six bridge defects were found this way; the same
  discipline applies here and the prior should be that more exist.
- The incumbent is a REFERENCE MEASUREMENT, not an oracle. It violates 58 of the
  frozen contract's own cases. Expected behaviour comes from the contract.
- No aggregate score. Per-property verdicts only.
- Verdicts are exit codes, never greps of output.

---

## Naming — DECIDED: `transact()` stays

Settled by the owner 2026-09-24. `speculate()` was considered seriously and is
arguably more descriptive of live-until-settled semantics -- `transact()` carries
a database implication (writes hidden until commit) that is the inverse of this
model. It is not adopted. The vocabulary was consolidated onto `transact()` this
session and shipped in 15.3.0, and no rename is worth a second breaking change
to the same API.

`contribution`, `owner`, `frontier` and `disposition` remain INTERNAL
vocabulary. This is closed; it is not to be reopened by a spike result.

---

# OWNER-SEAM-0 — scoped 2026-09-24, no production commitment

Scopes the plumbing each owner-resolution candidate needs, after OWNER-KEY-0
showed neither populates itself for free.

## Candidate B is far smaller than OWNER-KEY-0's failure implied

The prerequisite failed because a write registers no dependency node. But the
reason is not that the write path LACKS the node -- it is that the write branch
simply never calls anything with it. In `location-runtime.ts` the callable is
one function closing over one `node`:

    const location = markTreeCell(function (value) {
      if (arguments.length === 0) {
        trackDependency(node, token);   // READ branch uses node
        return read();
      }
      binding.replace(value);           // WRITE branch: node IS in scope,
                                        // nothing is called with it
    });

`binding.notify` in the same closure already does `node.version += 1;
notifyDependents(node)`. So the node is in lexical scope on both branches at
every site.

    DependencyNode creation sites in location-runtime.ts:  3
    sites where the write path lacks the node:             0
    files touched:                                         1

Entity field leaves are covered by the same seam rather than needing separate
structural plumbing: OWNER-KEY-0 showed `A.score()` registers dependency nodes,
which means entity fields already ARE locations on this machinery. The seam sits
at the location layer, which is the universal one.

## Candidate A pays a permanent-metadata cost B does not

A needs a durable `DependencyNode -> PositionId` mapping: new metadata per
location, allocated on creation, with an explicit cleanup obligation at subject
retirement.

That collides with the hard criterion. v15 earned whole-lifetime forgetting, and
a registry that outlives retired subjects would REGRESS a hard-won property, not
merely add implementation work.

B has no equivalent exposure. Ownership keyed directly by node can live in a
`WeakMap<DependencyNode, owner>`, so when a subject retires and its nodes become
unreachable the frontier entries disappear with them. Zero-residue is structural
rather than a cleanup path that must be written, tested and kept correct.

    criterion                         A                         B
    new permanent identities          one per location          none
    translation steps                 node -> position -> turn  node -> owner
    cleanup at retirement             explicit, must not leak   automatic
    subject/key-reuse special cases   required                  none (F3-B, D)
    production touchpoints            registry + write + retire 3, one file

## Recommendation

**Candidate B**, on the criteria as written: fewer permanent identities, fewer
translation steps, fewer special cases, cleaner cleanup. OWNER-KEY-0's
structural result independently supports it -- the kernel already exposes a
subject anchor node plus distinct leaf nodes, which is the identity a frontier
wants, so nothing has to reconstruct `(SubjectId, leaf)`.

UNMEASURED, and not to be asserted: the runtime cost of registering ownership on
every write. DEPENDENCY-1's timings were too noisy to use and this seam sits on
the hottest path in the kernel. A real isolated benchmark is required before
adoption, and the zero-owner case must stay free.

## Standing constraint

Implement only enough of B to make F3 real, then run F5 IMMEDIATELY. If F5 shows
no meaningful independent-progress gain, stop and reassess rather than
continuing to refine ownership. The ownership model is not the deliverable; the
Link/L16 behaviour is.

---

# OWNER-SEAM-1 — the answer is NO for B, and it REVERSES the recommendation

Question: can `{node, semanticOwner}` meet at the existing mutation boundary
without new global hot-path coupling?

## Two corrections to OWNER-SEAM-0 accepted first

Candidate A does NOT require durable per-location metadata with explicit
retirement cleanup. `WeakMap<DependencyNode, PositionId>` works: the PositionId
already exists, the mapping is weak, and a dead node drops its entry. A also
needs no key-reuse special cases -- that flaw belonged to ADDRESS matching, not
to node->position mapping. The retirement criterion therefore does NOT decide
between them, and OWNER-SEAM-0 overstated B's advantage on exactly the criterion
it called decisive.

B is also not cleanup-free: settlement needs the reverse relation
`P1 -> {nodeX, nodeY, subjectAnchor}` so claims can be released. That is
transient correctness state and it does require terminal cleanup.

## The finding

**The entire write-to-transaction delivery path speaks PositionId, not
DependencyNode.** PathNotifier's payload carries `positionIds`, and the
transaction runtime builds turns from `positionIds` (transactions.ts:158, 687,
710). Transactions already receive writes this way.

So B's real cost is not obtaining the node -- it is that the boundary which
already delivers writes to the transaction layer does not speak in nodes. B
would need either the notifier payload extended to carry nodes, which changes a
measured hot path, or an ambient current-owner consulted per write.

**The kernel already tried the ambient mechanism and rejected it**
(intrinsic-mutation.ts:18-22):

> "A first fix short-circuited on a process-wide installed-observer count. It
> MEASURED WELL but it is the wrong ownership boundary: one observer installed
> anywhere puts the probe back on every unrelated tree in the process. Pay for
> use belongs at the smallest practical boundary."

CORRECTED SCOPE of that evidence. What was rejected is a PROCESS-WIDE
installed-observer gate, where one observer anywhere imposed work on unrelated
trees. That establishes a design rule -- pay-for-use belongs at the smallest
practical boundary -- and is strong evidence against GLOBAL AMBIENT solutions.
It is NOT a blanket falsification of every possible B implementation, and this
file should not claim the kernel already tried the exact shape B needs.

The accurate statement: B would require changing the existing write->transaction
boundary to carry node/owner information, or introducing another owner-context
seam. The existing observer boundary is per-leaf and pay-for-use, and a
transaction cannot pre-register on leaves it has not yet seen, so B cannot ride
it unchanged.

## Revised recommendation: Candidate A

Not because B's identity story is wrong -- OWNER-KEY-0's subject-anchor result
still makes node identity the natural ownership key -- but because A joins the
captured read identity to the stream the transaction layer ALREADY consumes,
with one weak mapping and no hot-path change:

    captured DependencyNode
      -> WeakMap<DependencyNode, PositionId>     <- the only new thing
      -> existing positionIds already on the turn
      -> owner

B's elegance was real but it was measured against the wrong cost. The seam is
not three lines in one file; it is a new ambient ownership channel on the
hottest path, of the exact kind this kernel already removed on measurement.

**Candidate A: LEADING. Neither selected.** The remaining unknown for A is
whether a node can be mapped to its PositionId at creation, where both are in
scope -- unverified, and the next thing to check.

---

# OWNER-SEAM-2 — outcome B for scalar leaves; entity/anchor coverage UNVERIFIED

Question: at what construction boundary, if any, are the stable DependencyNode
and its correct PositionId simultaneously available?

## Verified: scalar leaves are outcome B, one call boundary apart

Two existing sites already hold what the mapping needs, with NO signature
changes and no new subsystem:

    location-runtime.ts createCell   `location` and `node` are both in scope
                                     (the node lives in the location's closure)

    signal-tree.ts  (leaf, path, positionIds, ..., registry, address)
                                     receives the SAME Location object as `leaf`
                                     together with its positionIds, and already
                                     calls defineNodeAddress(leaf) and
                                     defineOwnedPositionIds(leaf, positionIds)

So the join is two weak writes at sites that already have both objects:

    createCell        NODE_OF.set(location, node)
    leaf construction POSITIONS_OF_NODE.set(NODE_OF.get(leaf), positionIds)

That is materially smaller than "new registry plumbing", and it is weak-keyed,
so retired nodes drop their entries without a cleanup path.

## NOT VERIFIED, and it is the part that decides whether A solves F3

DEPENDENCY-1F established that the identities frontier needs are THREE:

    scalar leaf        verified above
    entity field leaf  UNVERIFIED
    subject anchor     UNVERIFIED

Entity positions are allocated separately at `entity-signal.ts:778`, not through
the leaf-construction path inspected above, so entity field leaves and the
subject anchor may follow outcome C (independent construction boundaries) or
outcome D (node without PositionId, or PositionId without node). OWNER-KEY-0
showed entity fields DO have DependencyNodes; whether those nodes reach a
PositionId at any shared construction boundary is simply not established here.

**If only scalar cells map cleanly, A has not solved F3.** F3 is a structural
property and its dependency is on a pending-created SUBJECT, so the anchor and
field identities are the ones that matter. This must be measured before A is
selected, not assumed from the scalar result.

## Non-vacuity controls required before adopting any mapping

A WeakMap being weak does not make the MAPPED POSITION semantics
lifetime-correct. Recreate the DEPENDENCY-1F discriminators against the mapping
itself:

    key reuse   old A.score node -> position_old
                remove old A, create fresh A
                fresh A.score node -> position_fresh
                REQUIRE node_old != node_fresh
                AND position_old must not resolve the fresh subject's ownership

    rekey       A -> B, same node
                mapping still names the same semantic position/lifetime,
                with no remap keyed by business key

## Cost model, if the shape holds

    ordinary write, no capture   zero new lookup cost
    location creation            one weak registration
    transaction with reads       one lookup per DISTINCT captured node

That is a healthier model than adding work to every mutation, which is what B
would have required. No benchmark until the shape is established.

---

# CANDIDATE STATUS — frozen 2026-09-24, before the C spike

    A  node -> PositionId
       FALSIFIED for structural ownership. Entity fields collapse to one
       collection-level position (OWNER-SEAM-2B), destroying leaf, subject and
       lifetime separation.

    B  node-keyed frontier + write-site owner context
       VIABLE but invasive. Retained as fallback. Needs owner context on the
       hot write path, which the existing write->transaction boundary does not
       carry.

    C  node -> lossless semantic identity -> existing effect owner
       PROMOTED TO IMPLEMENTATION SPIKE. **Not selected.**

"C leading on both halves" overstated it and is withdrawn. C has enough evidence
to EARN implementation; its decisive join equality is the first thing that
implementation must prove, not something already shown.

## The two gates the C spike must clear FIRST

Both were preregistered and NEITHER has passed.

    ROW 8 EQUALITY  the semantic identity derived from the TurnEffect must
                    EQUAL the identity bound to the captured anchor node.
                    OWNER-KEY-1 half 2 only showed BOTH EXIST and are separately
                    stable. Equality was untestable with no binding to derive a
                    key from.

    SCALAR ROW      x node <-> the effect position for x. Unmeasured entirely.

## Scope limit for the spike

Three namespaces only. No generalized semantic-identity framework, no tagged
union forced over every fact, no public API:

    scalar            DependencyNode -> PositionId
    subject existence DependencyNode -> SubjectId
    entity leaf       DependencyNode -> SubjectId + scoped leaf segments

The transaction side normalizes existing TurnEffects into those same three
classes. No display path, no business key, and no reverse inference participates
in owner identity at any point.

ROW3b, though exploratory rather than preregistered, is why this is worth
building: reading `A.score` captures the subject ANCHOR as well as the leaf, so
"P2 depends on S1 existing" falls out of ordinary read capture instead of
needing a separate existence detector.
