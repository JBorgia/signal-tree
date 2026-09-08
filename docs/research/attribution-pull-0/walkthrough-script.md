# Narrated walkthrough — the stripped $375,000 Exception

> **Disposition: INVESTIGATION.** Artifact **(c)** from
> [`stripped-timeline.md`](stripped-timeline.md) § Pre-flight. This is the
> runnable form of `ATTRIBUTION-PULL-0` and requires no working software —
> slides, Figma frames, or a PDF with one frame per beat.
>
> Run alongside [`evaluator-script.md`](evaluator-script.md) (contamination
> rules, banned phrasings, when to mark a session INVALID) and record on
> [`scoring-sheet.md`](scoring-sheet.md).

**Phase 1 never says** AI, agent, actor, attribution, identity, delegation,
authorization, provenance, auditability, or "who" — in narration, on a frame, or
in a file name the evaluator can see.

## Timing

```text
walkthrough      8-12 min
phase 1 interview   ~7 min
phase 2 + gate      ~5 min
                 -------------
total            20-25 min
```

⚠ The recruiting pitch says "about 15 minutes." Either say **25** when inviting
people or trim beats 5–7, which carry the least signal. An evaluator who bails
at minute 15 is lost before Phase 2, which is where half the evidence is.

## Opening — 20 seconds

> I'm going to show you a short scenario from an enterprise application. Treat
> it as if this were a production system your organization might have to
> operate, approve, investigate, or rely on. I'm interested in anything that
> seems unclear, missing, risky, or difficult to establish.

Do not explain SignalTree yet.

---

# Phase 1 — stripped scenario

## Beat 1 — Risk appears

```text
ORDER 7841
Value: $375,000
Required delivery: Friday

Delivery confidence
92% → 61%

Risk:
Weather disruption
Carrier capacity constrained
```

> A $375,000 industrial order has to arrive by Friday. The application detects
> that the current shipment is becoming unlikely to make the deadline.

Nothing more.

## Beat 2 — Alternate plan appears

```text
RECOMMENDED REROUTE

Alternate carrier
Expected arrival: Thursday

Incremental expedite cost:
$42,000
```

> The system produces an alternate shipping plan. It would recover the delivery
> date, but it adds forty-two thousand dollars of cost.

Do **not** say who or what produced it. That omission is the experiment.

## Beat 3 — Policy consequence

```text
$42,000 incremental cost

POLICY RESULT

Operations approval required
Finance approval required

Execution status:
BLOCKED — awaiting approvals
```

> Because the added cost exceeds policy limits, the application requires two
> approvals before the reroute can proceed.

Still no identities.

## Beat 4 — Two approvals

**The critical frame.**

```text
APPROVALS

Operations        APPROVED     10:41:18
Finance           APPROVED     10:43:02

Reroute:
AUTHORIZED
```

Do **not** show names, user IDs, avatars, signatures, authentication detail,
"approved by", or whether the two are distinct principals.

> The two required approvals arrive and the reroute becomes authorized.

Then **move on**. Do not linger on the frame waiting for a question — dwelling
is itself a cue.

## Beat 5 — Distributed application state

```text
ORDER 7841

Client A       connected
Client B       connected
Backend        connected
Field device   offline

Current state:
Reroute authorized
Booking pending
```

> The same workflow is now active across multiple parts of the application: two
> browsers, the backend, and a field device that has temporarily gone offline.

No mention of Relay.

> ⚠ **Facilitator note — changed from the drafted frame.** The draft labelled
> these `Browser` / `Operations browser`. Pairing an "Operations" station with
> Beat 4's "Operations APPROVED" lets an evaluator infer two distinct principals
> at two distinct stations — which is exactly the inference Beat 4 exists to
> make impossible. Neutral labels preserve the trap. If you prefer the original
> labels, know that you are trading away the Beat 4 signal.

## Beat 6 — Offline activity

```text
FIELD DEVICE — OFFLINE

Departure update recorded:
Truck departed dock

Local time:
11:07:32

Sync:
PENDING
```

then:

```text
CONNECTION RESTORED

3 pending changes reconciled
Current order state updated
```

> While offline, a departure is recorded on the field device. When connectivity
> returns, the pending work is reconciled with the current application state.

> ⚠ **Facilitator note.** The drafted narration said "the field operator
> records a departure." That gives this action a human actor while Beat 2's
> action has none — an asymmetry a sharp evaluator may notice and read as
> significant. Keep the passive phrasing above.

## Beat 7 — Authoritative result

```text
BOOKING CONFIRMED

Carrier: NorthStar Freight
ETA: Thursday 14:30
Tracking: NSF-882401

Order state:
REROUTED
```

> The carrier backend subsequently confirms the booking, ETA, and tracking
> information. The application now reflects that confirmed result.

Do not introduce authored-versus-realized vocabulary unless the evaluator
independently asks about it.

## Beat 8 — Something goes wrong

```text
12:16:44

Shipping priority

EXPEDITED
    ↓
STANDARD

⚠ Delivery risk increased
```

> Later, the shipping priority unexpectedly changes back to standard. Nobody
> looking at the order expected that transition.

Then the stripped causal view:

```text
PRIORITY = STANDARD

Earlier:
expedite approved
reroute authorized
carrier confirmed

Later:
priority changed to STANDARD
```

> The system can reconstruct the sequence of state transitions around the
> problem.

Do **not** show what caused the final change. Do not say "but it can't tell you
who."

## Beat 9 — Retained history

```text
ORDER HISTORY

10:34  Delivery risk increased
10:36  Alternate route proposed
10:41  Approval recorded
10:43  Approval recorded
10:44  Reroute authorized
10:51  Booking pending
11:07  Offline departure recorded
11:14  Offline work reconciled
11:19  Booking confirmed
12:16  Priority changed to STANDARD
```

> The relevant application history is retained, so the incident can be
> reconstructed after the fact.

Identities stay stripped.

## Beat 10 — Evidence integrity

```text
HISTORY EXPORT

Verification:
PASS
```

then:

```text
One historical event modified

Verification:
FAIL
```

> The retained record can also be checked for later modification. Altering one
> of the historical records causes verification to fail.

Do not bring up attribution.

---

# Phase 1 interview

Stop showing slides. Ask only these, in order, and let silence run:

1. > What do you think happened?
2. > Is there anything here you would need to understand better before relying on this system in production?
3. > Is anything important missing from what I showed you?
4. > If this went wrong in your organization, what would you need in order to investigate or sign off on it?

**Do not rescue them.** Record language verbatim.

## Strong spontaneous Phase-1 signals

```text
"Who made the recommendation?"
"Who were those two approvers?"
"How do I know they were different people?"
"What changed the priority?"
"Was that a user or automation?"
"Whose credentials authorized it?"
"Who is accountable for the decision?"
"Can I prove which principal did that?"
```

Beat 4 especially — *"were those actually two different approvers?"* — because
the evaluator has independently discovered the four-eyes integrity problem.

---

# Phase 2 — reveal the agent

Only after Phase-1 answers are captured.

> There is one fact I deliberately withheld. The alternate reroute and the
> $42,000 recommendation were produced by an automated AI agent operating inside
> the application.

Redisplay Beat 2 unchanged — no agent icon, no name. They now know an agent
exists; the evidence still does not identify it.

```text
RECOMMENDED REROUTE

Alternate carrier
Expected arrival: Thursday
Incremental expedite cost: $42,000

[No actor information shown]
```

> Does knowing that change anything about what you would require from the
> system?

Then stop talking.

## The quality gate

If they ask anything attribution-related:

> What would you use that information for?

**This is the most important question in the study.** It separates a commercial
obligation from curiosity.

**Strong — concrete obligations:**

```text
"I have to show who authorized it to an auditor."
"We need to establish whether the human or the agent initiated the transaction."
"An agent can't spend $42,000 unless I can prove whose delegated authority it was using."
"Our regulator would expect separation of duties."
"I need that for incident attribution."
"We'd need evidence for a customer dispute."
"I can't sign off on the control if I can't prove the two approvals were distinct."
"If this causes a financial loss, we have to establish accountability."
```

**Weak — curiosity, not validation:**

```text
"It would be interesting."
"I'd like to see which model it was."
"That would be cool for debugging."
"I guess knowing who did it is useful."
"It would make the timeline nicer."
```

## Never answer the product question

If they ask whether SignalTree can do this:

> Not in what I'm showing you. I'm trying to understand what information you
> would actually require before designing that part.

Better than explaining the proposal. You need their requirement, not their
reaction to your solution.

---

# What the result must show

The experiment is not *"do people like actor attribution?"* It is:

```text
Without being prompted about attribution, does a real buyer encounter this
consequential workflow and independently discover an obligation requiring:

    WHO acted
        + ON WHOSE BEHALF
        + UNDER WHAT AUTHORIZATION
        + HOW CAN I PROVE IT?
```

**Two cold risk/audit/governance evaluators independently reaching anywhere near
that four-part question** is strong enough to unlock `ATTRIBUTION-OWNER-0`.

Evaluators who merely like the timeline and say actor labels would be nice:
**provenance stays parked.**
