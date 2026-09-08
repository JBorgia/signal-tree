# ATTRIBUTION-PULL-0 — demand falsifier

> **Disposition: INVESTIGATION. Non-shipping evidence.** This is the test
> instrument for the experiment preregistered in [`TODO.md`](../../../TODO.md)
> § `ATTRIBUTION-PULL-0`. It is not product guidance and describes no shipped
> capability. Nothing in `ATTRIBUTION-OWNER-0` may begin until this reports.

## The question

Does the buying population reach for actor/delegation provenance when it is
deliberately absent — or do they accept a causally complete timeline that never
says who did anything?

Nearly everyone answers "yes, obviously" when asked whether AI accountability
matters. That question is worthless. This experiment removes the capability,
says nothing about it, and measures whether anyone notices.

## Instrument

| File | Purpose |
| ---- | ------- |
| [`stripped-timeline.md`](stripped-timeline.md) | Exactly what to show and what to omit, beat by beat |
| [`evaluator-script.md`](evaluator-script.md) | Facilitator wording, and the phrases that invalidate a session |
| [`scoring-sheet.md`](scoring-sheet.md) | Per-session observation sheet, one per evaluator |

## Before the first session

The beat table in [`stripped-timeline.md`](stripped-timeline.md) is derived from
the planning document, not from the running demo. **Reconcile it against the
built application first** — see that file's pre-flight section. A leftover actor
label on screen invalidates every session run after it, silently.

## Two phases, one session

A late addition to the protocol, because the single-phase version conflates two
different questions:

```text
PHASE 1   fully stripped; AI involvement never mentioned
          asks: is actor identity spontaneously missed at all?

PHASE 2   reveal that an autonomous agent initiated the proposal;
          the timeline still carries no actor record
          asks: once an agent is known to have acted, is provenance demanded?
```

Phase 2 cannot contaminate Phase 1 because it comes after. Record the two
separately — an evaluator who misses it in Phase 1 but demands proof in Phase 2
is a real signal, and the single-phase design would have lost it.

## Populations

Segment, and weight the results differently. "Who acted, under whose authority"
is a compliance question, not a debugging question, so a developer audience
structurally under-detects it.

```text
ENGINEERING / SRE           debugging framing
                            expect: "what caused this?"
                            weak evidence either way

SECURITY / RISK / AUDIT     accountability framing
AI GOVERNANCE               expect: "which principal? whose authority? can you prove it?"
                            strong evidence in both directions
```

Minimum viable sample: **two evaluators from the risk/audit/governance
population.** A result drawn only from engineers cannot settle this, in either
direction.

## Thresholds — declared before anyone sees the demo

```text
STRONG PULL      A risk/audit evaluator independently asks who acted, on whose
                 behalf, under what authorization, or how any of it can be proven.

MODERATE PULL    An engineer asks, unprompted, which actor caused a state
                 transition.

WEAK / NO SIGNAL Evaluator understands the timeline and never identifies actor,
                 delegation, authorization, or verification as missing.

NEGATIVE         After provenance is explained, the evaluator says their existing
                 backend identity and audit evidence already covers it.
```

## Reading the result

```text
repeated unprompted asks        -> permission to open ATTRIBUTION-OWNER-0
no asks                         -> do not build it yet
explicit indifference after
  the capability is explained   -> evidence against productization
```

Absence of asks is **not** deletion authority. Latent needs exist and are not
always articulated; a null result parks the work, it does not kill it.

One specific outcome worth watching for: an evaluator who asks how they would
know the agent really acted under a named principal's authority has validated
not merely actor provenance but the split between a **presented credential** and
an **operation receipt** — the distinction `ATTRIBUTION-OWNER-0` treats as
load-bearing.

## Recording the result

Append the outcome to `TODO.md` § `ATTRIBUTION-PULL-0` with the session count,
population breakdown, which threshold was reached, and verbatim quotes for any
spontaneous actor question. Verbatim matters: a paraphrase loses whether they
asked about identity, delegation, authorization, or proof, and those are four
different findings.
