# STATE-CONSEQUENCE-VALUE-0 — harness design

> **Disposition: INVESTIGATION. Non-shipping.** The commercial gate for the
> provenance track, preregistered in [`TODO.md`](../../../TODO.md). Nothing here
> describes a shipped capability.

## The question

> Does application-state consequence provenance add material explanatory and
> evidentiary value **beyond a strong conventional stack**?

Not "is provenance useful." That is settled and largely commoditized.

## The control must be built to WIN

This is the whole experiment. A control arm built to lose proves nothing, and
every previous rigged-comparison trap in this track — the transaction-free
escape hatch, the harness-supplied-facts blur — was a variant of the same error.

**Rule: whoever builds the control is trying to make it answer every question.**
If the control wins, that is a real and valuable result: it means SignalTree
should not build this, and we saved the cost.

```text
CONTROL                                  CANDIDATE
agent IAM identity                       the same stack, unchanged
+ delegated authorization / OBO          + SignalTree net state-consequence model
+ OpenTelemetry agent & tool tracing     + experimental provenance binding
+ backend audit / event log              + test-only settlement oracle
+ ordinary client state
```

## Fidelity: what "credible control" actually requires

Three options, and only one is both feasible and honest:

```text
(1) live stack        real Entra/Okta + OTel collector + audit DB
                      most credible; cannot be provisioned here
(2) faithful artifacts  generate what real systems actually emit —
                      OTel spans to current GenAI semantic conventions,
                      a real audit-table schema, an OBO token with real
                      claim structure — then investigate from those
                      FEASIBLE AND HONEST
(3) paper walkthrough  describe what each system "would show"
                      REJECTED — indistinguishable from a strawman
```

**Take (2).** The discipline that makes it credible: every control artifact must
be generated to a published spec, not invented. If a span field is disputed, the
resolution is the OTel semantic-convention document, not our judgement.

**Blocked, and must be resolved before the run:** nobody here can provision real
Entra/Okta. Either obtain a real OBO token structure from documentation and
reproduce it faithfully, or recruit someone who runs that stack to build the
control arm. **Do not let a SignalTree author build the control arm alone.**

## The incident

Reuse the `$375,000 Exception` beats already scripted in
[`../attribution-pull-0/walkthrough-script.md`](../attribution-pull-0/walkthrough-script.md).
It already contains the causal shapes under test: an agent-initiated proposal,
policy-gated approvals, offline reconciliation, server realization superseding
client state, a later unexplained change, and a rollback.

**Do not run it transaction-free.** Removing attempted/committed/rolled-back
deletes one of the strongest claimed advantages and proves differentiated
causality by avoiding the hardest semantics.

## The questions, asked of both arms

```text
Why is this application field this value now?
Who intentionally initiated the consequential operation?
Was the agent acting for someone?
What authorization permitted it?
Which state effects actually committed?
Which were rolled back?
What did the backend subsequently establish as truth?
Did another client author the resulting value, or merely realize it?
Did a later restoration represent a new human action?
Can all of that be connected without manually stitching four systems together?
```

## Measured

```text
time to correct explanation
manual cross-system joins required
missing causal edges
wrong actor attribution
authored vs realized distinction preserved
committed vs rolled-back effects distinguished
ability to explain the current state value
later realizations/restorations traced without actor inheritance
application-specific instrumentation required
```

## Honesty constraints, carried from the kernel work

**1. Harness-supplied facts must be labelled.** On rollback SignalTree publishes
nothing — confirm publishes net effects, rollback publishes none. The settlement
oracle can say a transaction was discarded, but the *attempted* writes come from
the harness, which authored the scenario. **The candidate arm must not present
harness knowledge as SignalTree-derived knowledge.** Mark every such fact.

**2. Restoration may not claim `derivedFrom`.** A restoration consequence may say
"this location was restored to a prior recorded state" and nothing more. It must
not name an originating operation or inherit that operation's actor — the kernel
deliberately does not retain that relationship.

**3. Distributed correlation is not SignalTree's to claim.** If `R22 derives from
P17` across an HTTP boundary, whichever system carried the correlation gets the
credit — request context, Relay, backend, or trace context. If the candidate arm
shows that edge, state which component supplied it.

**4. Multi-actor same-field transactions are out of scope.** Intermediate writes
to one location inside a transaction are destroyed at capture by design. Do not
build a scenario beat that depends on recovering them.

## First-pass prediction, recorded before the run

Stated now so it can be wrong on the record.

```text
CONTROL probably ANSWERS       who acted, on whose behalf, under what
                               authorization, what tool calls occurred,
                               what the backend recorded

CONTROL probably STRUGGLES     which client-state effects committed vs rolled
                               back; whether a value was authored or realized;
                               why the CURRENT value is what it is after
                               several supersessions

CANDIDATE adds value ONLY IF   the second group matters to the evaluator and
                               costs the control real correlation effort
```

If the control answers the second group cheaply, **SignalTree has no moat here**
and the provenance track closes. That outcome is a success of the experiment,
not a failure of it.

## Status

```text
harness design         THIS DOCUMENT
control arm            BLOCKED — needs a non-SignalTree builder and real
                       OBO/OTel artifact structure
candidate arm          buildable — spike + oracle exist
scoring                derive from the measured list above
run                    NOT SCHEDULED
```
