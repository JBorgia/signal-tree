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

Criterion 8 is a judgment, so it is recorded as a count of special cases and
guards in each mechanism, decided against that count and not against a feeling.

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
