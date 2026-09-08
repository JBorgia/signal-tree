# Scoring sheet — one per evaluator

> **Disposition: INVESTIGATION.** Fill in during the session, not afterwards.
> Copy this file per evaluator.

```text
Session ID        ______________________
Date              ______________________
Facilitator       ______________________
Artifact version  ______________________  (git commit of frames.html served)
                  If this differs between evaluators, their results are not
                  directly comparable — say so when scoring the cohort.
Population        [ ] Engineering / SRE
                  [ ] Security / Risk / Audit / AI governance
                  [ ] Other: ______________________
Role & seniority  ______________________
Recruitment       [ ] cold outreach     [ ] warm intro
channel           [ ] inbound / saw SignalTree content
                  [ ] existing contact  [ ] other: ______________
                  (inbound and warm evaluators are self-selected as already
                   interested — weight their pull down, and never let the
                   cohort be entirely non-cold)
Buys or blocks?   [ ] can authorize spend  [ ] can block adoption  [ ] neither
Session valid?    [ ] VALID   [ ] INVALID — reason: ______________________
```

## Phase 1 — nothing revealed

Tick only what the evaluator raised **unprompted**. Quote verbatim.

```text
[ ] Asked what caused a state transition
    quote: ______________________________________________

[ ] Asked WHO or WHAT initiated an action (identity)
    quote: ______________________________________________

[ ] Asked on whose behalf something acted (delegation)
    quote: ______________________________________________

[ ] Asked under what approval / policy / right (authorization)
    quote: ______________________________________________

[ ] Asked how any of it could be proven or independently verified
    quote: ______________________________________________

[ ] Asked whether the two approvals were distinct people (four-eyes)
    quote: ______________________________________________

[ ] Confused authored work with server realization
    quote: ______________________________________________

[ ] Raised nothing in any of the above categories
```

Which beat prompted it, if any: `____`

## Phase 2 — after the agent reveal

```text
[ ] "Does that change anything?" -> materially changed their answer
    quote: ______________________________________________

[ ] Now asked for identity / delegation / authorization / proof
    which:  [ ] identity [ ] delegation [ ] authorization [ ] proof
    quote: ______________________________________________

[ ] Said their existing backend identity or audit already covers it
    quote: ______________________________________________

[ ] Indifferent — no change in position
```

## Follow-up quality

When they asked for something, what did they say they'd use it for?

```text
______________________________________________________________
______________________________________________________________
```

```text
[ ] Named a concrete obligation (dispute, audit, regulator, incident, sign-off)
[ ] General interest only, no obligation named
```

This is the line between a requirement and a passing remark. An actor question
with no obligation behind it is not STRONG PULL regardless of who asked it.

## Threshold reached

Tick exactly one. Thresholds are fixed in
[`README.md`](README.md) and must not be reinterpreted after the fact.

```text
[ ] STRONG PULL      risk/audit evaluator independently asked who acted, on whose
                     behalf, under what authorization, or how it can be proven
[ ] MODERATE PULL    engineer asked unprompted which actor caused a transition
[ ] WEAK / NO SIGNAL understood the timeline; never identified actor, delegation,
                     authorization or verification as missing
[ ] NEGATIVE         after explanation, said existing backend identity/audit
                     evidence is sufficient for their use case
```

## Facilitator notes

Anything that would change how the next session is run — including any moment
you suspect you leaked the hypothesis.

```text
______________________________________________________________
______________________________________________________________
______________________________________________________________
```
