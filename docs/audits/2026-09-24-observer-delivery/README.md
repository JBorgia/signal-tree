# v15 observer-delivery: structurally present, NOT reachable from the kernel's public API

Bounded follow-up on the defect identified while merging the v16 line. Run
against the PUBLISHED `@signal-tree/kernel@15.3.0` tarball in an isolated
consumer — no repo source, no local `dist/`, no workspace `node_modules`.
`repro.mjs` in this directory is the exact program.

## The claim under test

v16 reads a physical commit clock around the compensation so it can separate

    the compensation FAILED                      -> refuse, keep the turn
    the compensation INSTALLED, delivery threw   -> retire the turn, rethrow

15.3.0 has no such split, so the second was expected to be misreported as a
refusal — leaving a transaction pending AFTER its state had already reversed.

## What is ESTABLISHED

**1. The mechanism is absent from the shipped artifact.** In
`dist/enhancers/transactions/transactions.js` of the published 15.3.0 tarball:

    getPhysicalCommitClock   0 occurrences
    revision                 0
    installed                0
    observerFailed           0

Any throw out of the compensation call is therefore classified as a refusal.
That part of the diagnosis is confirmed against the artifact users install.

**2. It is NOT reachable from the kernel's PUBLIC API.** Every route tried:

    link() endpoint `set` throws   observer is ASYNC and isolated. The rollback
                                   returned "ok", x reversed, the turn retired,
                                   and `link.settled()` RESOLVED — the error
                                   never reaches the rollback at all.
    entityMap `selectId` throws    not invoked on the compensation path;
                                   rollback restored both rows and returned "ok"
    entityMap `intercept()`        gate-shaped: runs BEFORE the write, so it
                                   produces a pre-install refusal, not this
    devTools / restoration config  expose no user callback at all

Measured continuations after the target attempt: subsequent ordinary writes
work, a subsequent transaction opens and rolls back cleanly, and the tree is
left consistent. No lifecycle inconsistency was produced.

## Controls, because catching an exception cannot distinguish outcomes

    CONTROL 1  successful rollback   ok, pending 0, retry ok,
                                     confirm correctly refuses
    CONTROL 2  pre-install refusal   effect-validation-failed, pending stays 1,
                                     retry refuses IDENTICALLY, later confirm ok

Control 2 is the H1/H3 contract holding on shipped 15.3.0, independently
confirmed here against the tarball.

## What is NOT established, and the blocker

**Unreachable in general — NOT shown, and do not read it that way.** Public-API
reachability is about what a CONSUMER can trigger. It is a different question
from whether the path can be exercised in a test: the kernel notifier exposes
`setBatchingEnabled(false)`, which delivers synchronously, and the v16 line
uses exactly that to drive this path in `transaction-safety.spec.ts`. The
routes below were the ones tried from the published surface; a throwing
`link()` endpoint is asynchronous, which says nothing about other paths.

A framework adapter could supply one — an Angular `effect` or a computed read
running inside the invalidation group is the obvious candidate. THAT IS NOT
TESTED HERE. It is the blocker, and the next step if this is pursued: run the
same case set through `@signal-tree/angular` rather than the bare kernel.

## Disposition

Severity is materially bounded, not dismissed. Structurally real and worth
keeping fixed in v16 — where the clock check already exists — but no public
kernel API reaches it, so it does not justify action against shipped 15.3.0 on
its own.

⚠️ Do NOT read this as "15.3.0 is fine". It says the defect has no demonstrated
route through the kernel. The framework arm is untested and could change that.

## Incidental finding

In control 2, `confirmed` goes 1 -> 0 across the `confirm()`. That is the L15
correctness-only default releasing a record nothing pending can still need — not
a defect, and a live example of the hazard flagged for the matrix rebaseline:
assertions that COUNT confirmed turns can go vacuous under this default.
