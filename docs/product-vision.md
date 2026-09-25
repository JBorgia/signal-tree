# SignalTree product vision — complete victory

> **This document is a TARGET, not a capability list.** Nothing here should be
> read as shipped. For what actually exists today see
> [`oss-vs-studio.md`](oss-vs-studio.md), which is strictly factual about the
> open-source/commercial split, and [`why-signaltree.md`](why-signaltree.md) for
> current positioning. Where this document and those disagree, those are right
> and this is aspiration.

Complete victory is much bigger than "SignalTree is a correct state-management
library." The end state is that a company can use SignalTree as the
**authoritative causal state substrate** for an application or agent system, and
stop building a pile of separate machinery for optimistic state, transactions,
provenance, audit, synchronization, persistence, debugging, and agent
accountability.

The clean test:

> **Can a serious company build a distributed, AI-heavy application on
> SignalTree and get local responsiveness, server truth, causality,
> auditability, recovery, and operational visibility as one coherent system
> rather than assembling six products and a custom backend protocol?**

If yes, that is the functional victory.

## The eight capabilities

1. **Application state that behaves correctly under real concurrency.**
   Developers get ordinary reactive state, entities, derived state, optimistic
   interaction, transactions, server realizations, rollback, rekeying, offline
   work, retries, and concurrent work. Independent work progresses
   independently. Later truth cannot be destroyed by earlier rollback. The
   developer does not manually reason about compensation order.

2. **Causality is first-class.** SignalTree knows not just that a value changed,
   but which contribution produced it, what that contribution observed, what
   remains unresolved, which downstream facts depend on it, and what can safely
   settle or leave the process. That turns "state management" into something
   much closer to a causal runtime.

3. **One state model from UI to backend boundary.** A developer should not need
   one representation for UI state, another for optimistic requests, another for
   cache invalidation, another for persistence, and another for server
   synchronization. The same semantic identity and causal model should survive
   the trip through Link/Relay/backend realization and back.

4. **Safe outbound synchronization becomes automatic.** A user can keep working
   while speculative state exists. Independent safe work can synchronize
   immediately. Dependent work waits only as long as its actual dependency
   requires. Full-value payloads remain coherent. The application does not have
   to globally freeze because one transaction is unresolved.

5. **Relay becomes the coordination plane.** This is where SignalTree stops
   being merely a library. Relay can carry causality across devices, sessions,
   processes, services, and eventually agents: synchronization, realization,
   conflict handling, durable contribution identity, policy enforcement,
   reconnect/offline recovery, and potentially multi-party coordination.

6. **Studio makes causality observable.** Not merely "Redux DevTools with nicer
   graphs." A developer or operator should be able to answer: *Why is this value
   here? Who produced it? What did that operation depend on? What is still
   speculative? Why hasn't this consequence executed? What server truth replaced
   it? What happened before a failure?* That is extremely difficult to
   reconstruct after the fact in normal systems.

7. **Audit/provenance becomes a product, not a debugging side effect.** For
   important workflows, SignalTree can produce durable evidence of the causal
   path from input to decision to state change to external consequence. That is
   useful for regulated software, financial workflows, enterprise approvals, AI
   systems, safety-critical operations, and anywhere someone eventually asks
   "why did the system do that?"

8. **Agents become a major expansion path.** An AI agent has exactly the
   problems SignalTree is being forced to solve: uncertain truth, speculative
   work, long-running operations, tool results arriving later, dependencies
   between decisions, retries, partial failure, multiple actors, external
   consequences, and the need to explain what it believed when it acted. A
   sufficiently mature SignalTree could provide the state/causality substrate
   underneath long-running agents rather than forcing each agent framework to
   reinvent it.

## The capabilities must COMPOSE

Companies today often have something conceptually like:

```text
React/Angular state
+ query cache
+ optimistic mutation system
+ API request IDs
+ backend database transactions
+ websocket synchronization
+ event log
+ distributed tracing
+ audit records
+ agent memory
+ custom idempotency
+ custom rollback logic
```

Even if SignalTree never replaces every component, complete victory is that it
supplies the **semantic spine connecting them**:

```text
                 SignalTree semantic identity
                           │
                    causal contributions
                           │
             dependency / authority / settlement
                           │
       ┌───────────────────┼────────────────────┐
       │                   │                    │
   application          Relay               Studio
      state          coordination         inspection
       │                   │                    │
       └──────────── provenance / evidence ─────┘
                           │
                     external world
```

That is much harder to copy than "a fast signal tree."

## Three levels of commercial victory

**Level 1 — developer adoption.** SignalTree becomes a library developers choose
because it is fast, pleasant, and eliminates difficult application-state bugs.
This gets distribution.

**Level 2 — infrastructure adoption.** Teams depend on Relay, Studio, durable
synchronization, inspection, collaboration, policy, enterprise controls and
audit. This is where meaningful recurring revenue starts.

**Level 3 — ecosystem dependence.** Other frameworks, agent systems, SaaS
products, devices and services begin speaking the SignalTree
semantic/provenance model. At that point the moat is no longer primarily
implementation code. It is compatibility, accumulated tooling, operational
history, integrations, schemas, developer familiarity, third-party support, and
a network of systems that already understand the protocol.

## The commercial architecture

```text
OPEN / EASY TO ADOPT            COMMERCIAL / HARD TO RECREATE
────────────────────────        ─────────────────────────────
core semantics                  Relay
protocol                        hosted coordination
client libraries                Studio
framework bindings              organization-wide inspection
interoperability                durable evidence
                                policy / compliance
                                verification
                                retention
                                cross-environment provenance
                                enterprise controls
                                operational intelligence
```

The core has to be good enough that people voluntarily put it everywhere. The
paid system becomes valuable **because SignalTree is everywhere**, not because
the free library has been artificially crippled.

## The north star

> **A user should be able to ask SignalTree "Why is the system in this state?"
> and get a truthful, machine-verifiable causal answer.**

For an ordinary web app that is a debugging superpower. For a financial or
enterprise application it is auditability. For a distributed system it is
provenance. For an autonomous agent it may become the distinction between "the
model did something" and **"we can establish what information caused this agent
to take this action, what remained uncertain, and which external effects
followed."**

If SignalTree reaches that point while retaining the ergonomics and performance
of normal application state, that is complete victory. It is no longer competing
primarily with Redux, Zustand, MobX, signals libraries, or a backend JWT trick.
It becomes infrastructure for **causal software execution**.

## Why this constrains the architecture work

If provenance, dependency, identity, authority, settlement and consequence
safety are bolted on afterward, the end state above probably never works
cleanly. If they are foundational semantics, almost every higher-level
commercial capability becomes something that can be DERIVED rather than faked.

That is the standard the current v16 work is being held to. The ongoing
architecture investigation — `docs/audits/2026-09-24-frontier-composition-spike/`
and `docs/audits/2026-09-25-radical-alternatives/` — is deciding exactly these
foundations: semantic identity, contribution ownership, dependency, obligation
propagation, and consequence eligibility. Capability 2 and capability 7 in
particular are downstream of whether those land as primitives or as add-ons.
