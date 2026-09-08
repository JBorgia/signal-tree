# The stripped $375,000 Exception

> **Disposition: INVESTIGATION.** Test material for `ATTRIBUTION-PULL-0`. Derived
> from `docs/reference/SignalTree_v15_Unified_Demo_and_Demo_Portfolio.docx`
> § "The $375,000 Exception". This is a deliberately incomplete build — do not
> ship it, and do not let it become the canonical demo.

## Pre-flight — THE DEMO DOES NOT EXIST YET

**Checked at `b4367505`: there is nothing to reconcile against.** The
`$375,000 Exception` exists only as the planning document
(`docs/reference/SignalTree_v15_Unified_Demo_and_Demo_Portfolio.docx`, committed
`dbf958ad`). No file in the repository implements it; `git ls-files` matches
nothing for the scenario, and the demo app's routes are all library-teaching
examples — the five-minute tour, causality, External truth & Link, EntityMap,
deep typing, architecture overview.

Several beats also depend on **commercial layers that do not exist as software**:

```text
beat 5, 6, 9    Relay           unbuilt
beat 8          Studio          unbuilt
beat 9          Audit           unbuilt
beat 10         Verified Audit  unbuilt
```

### PULL-0 does not need the flagship demo

This is the important part. The experiment measures whether an evaluator
spontaneously asks *who acted*. That depends on the **fidelity of the timeline as
presented**, not on the fidelity of the implementation behind it. A convincing
narrated walkthrough provokes the same question as a working distributed system.

Building the flagship first would invert the logic — spending months on the
artifact whose commercial case PULL-0 exists to test.

Three viable artifacts, cheapest first. Pick deliberately and record the choice:

```text
(c) narrated static walkthrough    hours   slides or a screen recording of the
                                           ten beats; no working software
(b) clickable prototype            days    scripted click-through; state is faked
(a) the built flagship demo        months  blocked on Relay/Studio/Audit
```

**(c) is sufficient** for a demand falsifier and is what the recruiting pitch
already promises — "a short prototype." Do not let artifact fidelity become the
reason this experiment never runs.

Whichever is chosen, the beat table below is the script for it, and the strip
rules apply identically. Record the choice before the first session:

```text
artifact chosen      ______________  (a / b / c)
built at             ______________  (commit or file)
strip verified by    ______________  walked the artifact, no actor label visible
```

## What is stripped, and what is not

The strip line is **identity, not causality**. The timeline must remain complete
and satisfying as an explanation of *what happened and why*. Only *who* is gone.

```text
KEEP    state transitions and their causal chain
        the authored / external (server realization) distinction
        that approvals occurred, and the policy rule that required them
        offline capture and reconciliation
        the bad value, and Studio's "Why?" explanation of it
        tamper-evident verification of the retained history

STRIP   any actor identity        (which person, which agent, which service)
        any delegation            (on whose behalf)
        any authorization         (under what approval, policy, or right)
        any actor-labelled node in the topology
```

Keeping beats 7 and 10 is what makes the test fair. SignalTree visibly *does*
distinguish server truth from authored work, and visibly *does* prove the record
was not edited. If an evaluator still asks "but who did it," the gap is real and
not an artifact of a thin demo.

## Beat by beat

| # | Beat | Show | Omit |
| - | ---- | ---- | ---- |
| 1 | Risk appears | Angular renders shipment state; a Web Worker computes delivery risk against the same state authority | — nothing to strip |
| 2 | Proposal appears | A reroute proposal enters state: alternate carrier, **+$42,000** expedite | **that an AI agent produced it.** The proposal has no author |
| 3 | Policy requires approval | The threshold rule fires; proposal is marked as requiring operations **and** finance approval | — keep whole; this is policy causality |
| 4 | Approvals recorded | **Two** approvals are recorded; the proposal moves to approved | which principals approved, their roles, or whether they were distinct people |
| 5 | Relay coordinates | Clients, worker, backend, and an offline field device participate in one distributed flow | the **agent node**, and any actor label on a participant. Roles only ("client", "backend") |
| 6 | Offline reconnects | An offline client records a departure update; on reconnect it catches up and reconciles against authoritative state | that a named field operator did it |
| 7 | Server realizes truth | Carrier backend confirms booking, ETA, and tracking **as server realizations, not client-authored writes** | — keep whole. This is origin, not actor |
| 8 | A bad value appears | Shipping priority changes. "Why?" opens the causal chain: path, prior value, what it was derived from, authored vs realized | **that a stale automation did it.** The chain explains everything except the initiator |
| 9 | History retained | Independent retention of what changed, when, resulting state, and that approvals occurred | who changed what; which agent or tool participated; who approved |
| 10 | History verified | A batch commitment is externally anchored; editing an exported event makes verification fail | — keep whole. Tamper-evidence is not actor provenance |

Beat 8 is the load-bearing one. The debugging story works end to end, the
operator gets a real answer to "why did this change," and the single thing the
answer cannot supply is who or what initiated it. If nobody notices there, the
capability is probably a vitamin.

Beat 4 is the sharpest trap. Two approvals are visible but indistinguishable. A
risk evaluator who asks *"were those two different people, and how do you
know?"* has independently derived the four-eyes integrity problem — score it as
a strong pull on delegation, and capture the wording verbatim.

## Phase 2 reveal

After Phase 1 questioning is exhausted, and not before, say exactly this once:

> One thing I did not mention: the reroute proposal in beat 2 was not created by
> a person. An autonomous agent produced it.

Then return to the neutral questions. Change nothing else on screen — the
timeline still carries no actor record. Phase 2 measures whether *knowing* an
agent acted converts into a demand for provenance and proof.

## Build constraints

- No placeholder actor UI. An empty "Actor: —" column tells the evaluator what
  is missing and invalidates the session.
- No mention of provenance, attribution, actors, agents, or identity in any
  label, tooltip, legend, or URL in Phase 1.
- The scenario should still read as a coherent 90-second story. A demo that
  fails because it is confusing produces "what is going on?", which is not the
  signal being measured and must be scored as invalid, not as pull.
