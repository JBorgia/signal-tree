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

## Status

```text
fixtures            BUILT (this directory)
blind investigation NOT YET RUN
failure triage      pending investigation
independent review  REQUIRED before any bucket-3 claim is accepted
```
