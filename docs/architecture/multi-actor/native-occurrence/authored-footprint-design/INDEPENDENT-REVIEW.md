# Independent mechanism review

Verdict: not yet sufficient to start runtime implementation. All eight files listed
in FREEZE.json matched their recorded hashes during review. This is source/design
inspection, not execution of the proposed mechanism. No runtime or design edits.

## Two concrete blockers

1. **Define the native responsibility-selection producer.** DESIGN.md:25 correctly
   distinguishes no new effects from no existing obligations. The existing
   MutationCaptureRuntime.prepareEntityResponsibility contract returns a
   TerminalRecordPlan or undefined, not retained/superseded obligations. The
   transactions implementation skips equal value-and-presence effects. Specify
   how the native authority issues the needed selection even for equal writes,
   its revision validation, and its preparation/binding/installation order.
   An absent result from an installed authority cannot certify independence.

   For same-tree q writes x=7, independent equal setAll, then reject q: if native
   rejection still restores0, publication must retain that rollback dependency.
   A foreign possible-owner window is a different role and cannot stand in for
   this evidence. Discriminator A correctly makes that distinction mandatory;
   do not alter settlement merely to make publication independent.

2. **Specify the finite stable child-selection representation.** DESIGN.md:87–96
   requires immutable selection handles without collection scans or unbounded
   history, but does not yet identify the representation that provides them.
   Existing EntityTopology.fork() copies the collection; ordinary-topology
   continuity tokens alone do not preserve historical payload/order. Define
   the persistent representation, point-update and composition costs, retention
   ownership/reclamation, and exact frontier validation.

   Concrete reentry requirement: if later-child interception rewrites an earlier
   child, parent membership completion must select the valid newer completed
   child unit or refuse under existing semantics. It must not install the stale
   earlier selection. A live getter, a full snapshot per update, or an unbounded
   delta chain does not satisfy the proposed contract.

These are mechanism-specification gaps, not requests for new public policy.
Close them before commissioning the successor runtime.

## Bounded positive assessment

The scope/participation inventory covers the six known frame constructors plus
related direct point, hydration and inverse paths. Whole, partial and derived
scope remain distinct from inspection/realization participation. Per-step effects
retain their own subject and structural scope, rather than borrowing the initiating
replacement mask. Required private inputs and negative typing controls are suitable
checks, but are not yet compiled evidence.

Membership must select prepared ordinary payload and support together. The design
correctly excludes downstream field cleanup, physical rereads and recipient
reseeding as substitutes. Exact-slot lifecycle, consumed dependencies, initial
ancestry, hidden/new lifetimes and bounded point-work discriminators remain required.

Preserve the original restoration assertion. Keep the wider-updater oracle conflict
as a separate gate; this review neither reconciles it nor declares native acceptance.

## Narrow follow-up

Review only the same-tree discriminator evidence and the concrete additions for
(1) the native responsibility producer and (2) finite child-selection representation,
including installation/frontier validation and retention. No new blanket review
is requested by this verdict.
