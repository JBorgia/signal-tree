# CONTROL-ARM-0 — the conventional evidence packet

> **Disposition: INVESTIGATION. Non-shipping.** The control arm of
> `STATE-CONSEQUENCE-VALUE-0`. Built FIRST, deliberately, so the comparison is
> not defined around what SignalTree happens to be good at.

## Governing rule

> **Build the best conventional explanation a sophisticated enterprise could
> reasonably produce without implementing SignalTree's state-semantic model.**

Whoever builds this is trying to make it **win**. If it answers every question,
that is a valuable result: SignalTree should not build provenance, and we saved
the cost.

## What the control is given for free

Every reasonable advantage a competent, well-instrumented enterprise would have:

```text
correlation IDs propagated browser -> backend   traceId, requestId, agentSession,
                                                principal, order
authenticated identities                        agent + human, with OBO delegation
authorization decisions                         PDP decision log + approval records
detailed tool traces                            OTel GenAI semantic conventions
structured backend audit                        before/after, principal, requestId
synchronized timestamps                         good enough to investigate
frontend logging around state operations        what a competent team would add
competent investigators                         who understand all four systems
```

If OpenTelemetry can naturally represent an edge, it gets that edge. Nothing is
reserved for SignalTree merely because SignalTree can also represent it.

## What the control is NOT given for free

The properties under test:

```text
authored vs realized            was this value produced here, or received?
transaction disposition         which speculative effects committed vs withdrew?
state-effect identity           which operation caused THIS location to change?
restoration semantics           was an undo a fresh act by the original actor?
cross-runtime consequence graph
```

If the control wants those, it must **instrument them itself** — and that
engineering is measured, not free.

> **The boundary that must not be crossed:** do not quietly build a bespoke
> application-state causal engine into the control and keep calling it "ordinary
> telemetry." If reproducing SignalTree's semantics is what it takes, then
> **reproducing SignalTree is itself the evidence.** Record that cost.

## Packet

```text
identity.json        agent session, OBO delegation, user + service identities
authorization.json   PDP decisions and the two approval records
otel-trace.json      three traces: UI+agent+tools+HTTP, carrier callback, legacy sweep
backend-audit.json   authoritative mutations, before/after, principal, requestId
frontend-log.json    ordinary client store logging, deliberately unannotated
```

Deliberately **separate artifacts, not one merged timeline.** Merging them is
the investigation work being measured.

## The investigation task

Both arms get the same final symptom:

```text
ORDER 7841
priority = STANDARD
```

And the same ten questions:

1. Why is `priority` currently `STANDARD`?
2. Which operation initiated the reroute?
3. Was that operation human- or agent-initiated?
4. Whose authorization was the agent exercising?
5. Which proposed state changes actually committed?
6. Which were withdrawn or rolled back?
7. Which later values came from authoritative backend truth?
8. Did another browser author that state, or merely receive it?
9. Did any restoration/undo represent a fresh action by the original actor?
10. What evidence supports each part of that explanation?

## Measured

```text
correctness
time to a correct explanation
number of systems consulted
number of manual joins
number of ambiguous causal edges
incorrect attributions made
application-specific instrumentation required
engineering required BEFORE the incident
confidence in the final explanation
counterfactual completeness
```

**Counterfactual completeness** matters most and is easiest to miss: when the
investigator cannot answer something, **can they identify exactly what evidence
was never captured?** A conventional stack can produce an answer that merely
*looks* complete, and that failure mode is invisible without this metric.

## Classifying each failure

Only one bucket is potential SignalTree white space:

```text
1. missing because the control fixture is weak
   -> our fault. Strengthen the fixture and re-run.

2. missing because ordinary instrumentation could capture it
   -> NOT white space. A competent team would just add it.

3. missing because capturing it requires bespoke state semantics
   -> POTENTIAL WHITE SPACE. Record what would have to be built.
```

Bucket 1 is the one a SignalTree author is most likely to reach for
unconsciously. Independent review of the classification is required.

## The falsifier bar

The thesis dies if a well-instrumented conventional stack produces
**substantially the same** state-causal explanation with similar reliability and
reasonable effort.

```text
control 4 minutes vs SignalTree 3 minutes   ->  NO BUSINESS
```

It has to win **materially**, not marginally.

## Run history

### v1 — INVALID FOR ANY MOAT CLAIM

The first blind run falsified the **fixture**, not the thesis. The investigator
answered Q1-Q4 and Q9 with high confidence and failed Q6 and Q8 — but too many
failures traced to inconsistencies introduced by the fixture author rather than
to real limits of a conventional stack:

```text
priority never recorded as set to EXPEDITED    missing audit coverage
svc-booking absent from identity.json           unregistered principal
rq-82 reused across two principals              non-unique join key
browser-A logged zero ui.click, browser-B did   asymmetric instrumentation
pendingCount 3 vs one visible offline write     unexplained inconsistency
only 4 of 18 client entries carried traceId     weak correlation propagation
no PDP decision for any service principal       incomplete authz coverage
no server revision echoed to the client         missing ordinary field
```

Worse, the strongest apparently-pro-SignalTree signal — that 22 of 31
correlations were timestamp-adjacency rather than ID-based — was itself a
product of that weak propagation. **Claiming white space from v1 would have been
claiming a moat manufactured by the fixture author's own sloppiness.**

Retained from v1: the investigator independently concluded the dispute turned on
**transaction disposition, authored-vs-realized, and restoration semantics**.
That validates the QUESTION SET. It is not evidence for any particular solution.

### v2 — all eight bucket-1 items repaired

```text
+ audit entry priority STANDARD -> EXPEDITED (rev 1045, derived write)
+ svc-booking, svc-orders-api registered
+ unique request ids per principal (rq-85 for svc-booking)
+ symmetric ui.click / interactionId across all three clients
+ pendingCount reconciled to 1, captureIds listed
+ traceId / requestId propagated through approvals, execute, replay
+ PDP decisions for every service principal, incl. the legacy sweep,
  with its selection rule and match reason
+ serverRevision on every mutation, echoed as appliedRevision in client logs
+ span parentage corrected; offline capture linked to its replay
```

**Q6 and Q8 are now the real discriminators.** The control has full ordinary
correlation infrastructure. What it still does not have is a state-semantic
model — no origin marker, no transaction disposition, no restoration semantics.
If ordinary fields turn out to answer Q6 and Q8, the white space shrinks
dramatically, and that is a legitimate result.

## Scoring rubric for v2 — PREREGISTERED, before the result was seen

Recorded while the v2 investigator was still running, precisely so the rubric
cannot be fitted to the answer.

### "Answered" is not "solved"

The experiment measures the **cost of obtaining the answer**, not only whether
an answer exists. Two materially different outcomes look identical if scored as
answered/unanswered:

```text
A. answered with ordinary instrumentation and cheap ID-based joins
   -> white space is probably WEAK

B. answered only after assembling interactionId + requestId + traceId +
   serverRevision + captureId + client logging + backend audit + PDP,
   and then manually reconstructing across five systems
   -> SignalTree may still have value by making the semantic relationship
      INTRINSIC rather than ASSEMBLED
```

**That distinction is the whole remaining business case.** Do not let *"the
answer exists somewhere in the logs"* become equivalent to *"the problem is
already solved."*

### Six questions to ask of every remaining Q6/Q8 gap

```text
1. Could ordinary instrumentation close this?
2. How many fields or hooks would have to be added?
3. At which layer?
4. Would EVERY application team need to implement it themselves?
5. Does the solution generalize, or is it scenario-specific?
6. Does implementing it amount to a state-semantic subsystem?
```

If the answer to a gap is *"one middleware hook + a transactionId + a
disposition field"* — **the moat is thin.** If closing it starts requiring:

```text
intercept every state mutation
group logical operations
model transaction boundaries
retain net effects
distinguish ingress from authorship
correlate server revisions
avoid treating replay/restoration as fresh authorship
```

then the team is **recreating the semantic layer under test**, and that is
bucket 3.

### Q8 specifically — classify the reasoning, not just the verdict

```text
"B received it because it applied server revision 1045"
    -> conventional stack WINS that part

"B received it because there is no local click or request"
    -> inference from ABSENCE. The fixture may still be under-instrumented;
       consider a v3 where the sync layer propagates serverRevision and
       sourceRequestId to the receiving client, which a strong conventional
       implementation would plausibly do.

"even with revision propagation I cannot tell the local semantic role
 without an explicit authored/realized model"
    -> INTERESTING WHITE SPACE
```

### The stopping condition

If the control answers **all ten** with high confidence, mostly ID-based joins,
minimal bespoke state instrumentation, and modest effort — become substantially
less bullish and consider stopping the provenance track outright.

### v2 result — THE CONTROL LARGELY WON

```text
                        v1          v2
total joins             31          43
ID-based             9 (29%)    34 (79%)
inferential             22           6
high-confidence       5/10        8/10
```

The v1 "22 of 31 joins were inferential" figure — which had looked like the
strongest pro-SignalTree signal — was **entirely a product of the weak fixture**.
With correlation propagated properly it inverts.

Scored against the rubric preregistered above:

```text
Q7  CONVENTIONAL WINS   serverRevision -> appliedRevision resolved 8 values by ID join
Q9  CONVENTIONAL WINS   captureId answered "fresh action?" by ID join alone
Q6  bucket 2            residual gap = ONE explicit disposition field
Q8  bucket 1 + 2        residual gap = propagate the revision stamp to browser B
Q3  not state semantics GenAI prompt capture
Q4  not state semantics policy text
```

The investigator's own closing is the sharpest evidence against the thesis:

> *"captureId is the proof of the point: it is the one place where 'was this a
> fresh action?' was answerable directly, and it was answerable **because
> someone recorded it**, not because it could be inferred."*

That argues **recording the property is what matters**, and that a conventional
stack can record it. It is not an argument that SignalTree is required.

### v3 declined, deliberately

Adding browser-B's revision stamp would probably turn Q8 green. Running v3
knowing that would be testing whether the conventional stack can be built
*badly enough* for SignalTree to win. That is not an experiment.

## Status — CLOSED

```text
outcome             DIFFERENTIATION NOT EARNED
disposition         recorded in TODO.md § STATE-CONSEQUENCE-VALUE-0
SignalTree arm      NEVER BUILT — correctly, the control settled it first
v3                  declined
```

**Non-claim, explicit:** this does not show SignalTree's causal/state semantics
have no value. It shows agent/application-state provenance is not presently
justified as a differentiated commercial product.
