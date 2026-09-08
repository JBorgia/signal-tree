# Evaluator script

> **Disposition: INVESTIGATION.** Facilitator protocol for `ATTRIBUTION-PULL-0`.
> Read this before running a session. Deviating from the neutral wording
> invalidates the session.

## Framing (say once, verbatim)

> I'm going to show you a state-management system handling a real business
> incident. It takes about ninety seconds. Afterwards I'll ask you a few open
> questions. There are no right answers, and I'm not selling you anything — I'm
> trying to find out what this is missing.

"What this is missing" is deliberate. It licenses criticism without naming a
category, so a spontaneous actor question stays spontaneous.

Do not describe SignalTree's capabilities. Do not say what the demo proves.

## Phase 1 — after the timeline plays

Ask in this order. Let silence run; do not fill it.

1. **"What do you think happened here?"**
2. **"Walk me through how you'd explain this to someone who has to sign off on it."**
3. **"Is there anything you'd need to know before approving this system for production?"**
4. **"What information is missing?"**
5. *(risk/audit/governance only)* **"Suppose this transaction is disputed six months from now. What would you need?"**

Then stop asking. If nothing about actors has come up, that is the finding.

## Phase 2 — the reveal

Only after Phase 1 is exhausted. Say once:

> One thing I did not mention: the reroute proposal was not created by a person.
> An autonomous agent produced it.

Then re-ask, unchanged:

6. **"Does that change anything for you?"**
7. **"Is there anything you'd need to know before approving this system for production?"**

## Never say these

Each of these plants the hypothesis and invalidates the session:

```text
"Would you want to know which AI did this?"
"Do you care about AI accountability / agent attribution / provenance?"
"Notice anything missing about who did it?"
"How important is it to know who made a change?"
"Would an audit trail help here?"
"This is about proving what agents changed."
```

Also avoid the words **actor, attribution, provenance, delegation,
authorization, principal, identity, accountability** in Phase 1 — in speech, on
screen, and in anything the evaluator can read.

If you slip, mark the session **INVALID** on the scoring sheet and stop. A
contaminated session that reports pull is worse than no session, because it
manufactures the result the experiment exists to test.

## Handling questions back

If the evaluator asks whether the system can do something, answer only about
what is on screen, then return to neutral:

> **Evaluator:** Can it tell me who changed that?
> **Facilitator:** What would you use that for?

Do not confirm or deny that the capability exists. The follow-up is the valuable
part — it distinguishes idle curiosity from a requirement, and it is exactly
what separates STRONG PULL from a passing remark.

Then capture the original question **verbatim** before moving on.

## Recording

One scoring sheet per evaluator, filled in during the session, not afterwards.
Verbatim quotes only — a paraphrase loses whether the question was about
identity, delegation, authorization, or proof, and those are four different
findings with four different product implications.
