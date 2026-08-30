# SignalTree Protection, Commercialization & Adversarial Audit Dossier

**Version:** 0.6 — canonical operating strategy  
**Date:** 2026-08-30  
**Purpose:** Consolidate the current SignalTree v15 engineering/commercial thesis, protection strategy, market analysis, monetization model, competitive landscape, partner strategy, open questions, falsifiers, and release/commercial sequencing into one self-contained document designed to be audited by a skeptical or antagonistic AI.

> **Status warning:** This is a strategy and audit document, not legal, patent, tax, securities, employment, or licensing advice. Any legal conclusion, IP filing, license change, trademark action, NDA, strategic agreement, or acquisition/investment term requires qualified counsel.

> **Current verdict:** **GO, NARROW THESIS.** Commercialization experiments are
> justified around the semantics RC1 actually ships. Studio Cloud, Relay, Audit,
> Verified Audit, actor attribution, and six-figure pricing remain gated options,
> not the company thesis.

---

## 0. How an antagonistic AI should review this document

The reviewer should **not** assume the SignalTree thesis is correct. The reviewer should try to break it.

The reviewer is explicitly asked to:

1. distinguish **shipped/observed facts** from **strategic hypotheses**, **inferences**, **pricing assumptions**, and **future product concepts**;
2. identify any claim that outruns current v15 implementation or release status;
3. find existing products that already solve the proposed problem more cheaply or completely;
4. challenge whether the proposed category is real or merely a renamed combination of state management, event sourcing, tracing, audit logging, and sync;
5. attack the migration thesis: determine whether SignalTree can create valuable causal explanation without forcing a backend rewrite;
6. attack the moat: assume a well-funded incumbent can read all public code/docs/tests, use modern AI to infer design intent, hire 20–50 engineers, subsidize pricing, and use existing distribution;
7. attack licensing assumptions from both sides: does permissive licensing give away too much, and does defensive licensing kill category formation and adoption?;
8. challenge every monetization range by finding a cheaper existing substitute and asking why a buyer would pay SignalTree instead;
9. attack Relay specifically: if it is merely sync, WebSockets, presence, rooms, offline, or collaboration, the thesis is weak;
10. attack Studio specifically: if it is merely logs, traces, or Redux/NgRx DevTools with more metadata, the thesis is weak;
11. attack Audit specifically: if it is merely an append-only log or backend audit database, the thesis is weak;
12. challenge the category language for falsifiability against the actually shipped artifact;
13. look for dependence on a single cloud, AI provider, framework, customer, investor, or strategic partner;
14. identify any strategic right a partner could request that would create capture risk;
15. identify what a competitor can legally copy and what SignalTree still owns afterward;
16. identify contradictory statements between engineering evidence and commercial claims;
17. propose the **strongest conventional control stack** against which SignalTree must be measured;
18. explicitly state what evidence would cause the reviewer to recommend **GO**, **NARROW THE THESIS**, **CHANGE BUSINESS MODEL**, **CHANGE LICENSING**, **STOP RELAY**, **STOP AUDIT**, or **STOP COMMERCIALIZATION**.

The reviewer should prefer **falsification over optimism**.

---

# 1. Evidence taxonomy

Every important statement in this dossier should be interpreted under one of these categories.

| Label                    | Meaning                                                                                                                                     | Allowed use                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **OBSERVED**             | Directly supported by code, tests, release artifacts, runtime behavior, existing documents, or current user-provided evidence               | May support concrete claims                                                                   |
| **EXTERNAL FACT**        | Current market/product fact observed from an external source                                                                                | Must be re-verified if time-sensitive                                                         |
| **STRATEGIC ASSUMPTION** | Deliberately chosen product/market assumption                                                                                               | May guide experiments; not proof                                                              |
| **INFERENCE**            | Explanation consistent with evidence but not itself directly established                                                                    | Useful for next experiment                                                                    |
| **HYPOTHESIS**           | Commercial/product proposition that still requires falsification                                                                            | Must not be marketed as established                                                           |
| **OPEN**                 | Not yet established or unresolved                                                                                                           | Must not be presented as closed                                                               |
| **PRIVATE SIGNAL**       | Real usage or relationship evidence that is not cleared for public attribution                                                              | May inform strategy; must not become a public logo/claim without permission                   |
| **ADVISORY CODE AUDIT**  | A code-level finding supplied by an external reviewer or user-provided audit that has not yet been independently reproduced in this dossier | Treat as a high-priority discriminator; re-verify before converting to a public/shipped claim |

This is consistent with the ADSP evidence discipline: positive claims require positive evidence; measurement systems must themselves be falsified; non-claims are first-class output.

---

# 2. Executive directive

SignalTree should be designed to **survive successful imitation**.

The company must not assume that secrecy, superior engineering, open-source goodwill, courts, patents, trademarks, or faster execution will individually protect it.

The operating thesis is:

> **SignalTree gives consequential client/application state semantics that ordinary state stores and backend observability do not naturally preserve—especially authored vs realized truth, restoration vs new authorship, subject lifetime, and causal-turn relationships—and may turn those semantics into a substantially better production “Why is this value true?” investigation experience without requiring a backend rewrite.**

The immediate business is Enterprise Adoption, paid causal-state pilots, and the
Studio semantic core. Relay, Audit, Verified Audit, and agent governance are
options that must be earned independently.

### Primary disclosure test

> **If a well-funded incumbent receives this material tomorrow, what valuable asset does SignalTree still uniquely control?**

### Primary product test

> **Can SignalTree produce a materially better explanation of how consequential application state became true, without requiring the customer to replace the architecture it already trusts?**

### Primary commercial test

> **Will an enterprise pay materially more for that causal-state outcome than it would pay for ordinary logs, tracing, backend audit, or generic synchronization?**

---

# 3. Governing principles

1. Assume every public line of code, test, paper, diagram, and demo can be AI-analyzed and reimplemented.
2. Assume successful ideas will attract copying and may attract revisionist origin claims.
3. Do not depend on legal victory for commercial survival.
4. Do not make fear of incumbents the company’s daily operating psychology.
5. Protection is subordinate to category formation **until evidence shows that a restriction creates more defensibility than adoption cost**.
6. Do not create protective friction that prevents SignalTree from becoming useful enough to matter.
7. Keep framework, cloud, database, observability, and AI-provider neutrality wherever practical.
8. Do not grant strategic rights disproportionate to a partner’s committed value.
9. Preserve optionality: more can be opened later; public disclosure and broad licenses generally cannot be recalled.
10. Do not preimplement speculative Studio/Relay/Audit requirements inside the v15 kernel merely because the future products look plausible.
11. Treat every price, conversion rate, and ARR range as a hypothesis until customers actually pay.
12. Continue shipping during disputes; do not let a narrative or legal fight become the product roadmap.
13. Use factual provenance instead of emotional accusations.
14. Build a business whose economic asset is larger than the public source repository.

---

# 4. Current engineering foundation

## 4.1 What v15 is trying to establish

**OBSERVED / ENGINEERING RECORD**

SignalTree v15 has been developed around explicit separation of semantic dimensions that earlier state systems often collapse:

- logical address is not subject lifetime identity;
- subject identity is not revision identity;
- physical truth is not causal authorship;
- publication is not persistence;
- external synchronization is not mutation authority;
- restoration is not new authorship;
- reactive observation is not state ownership;
- tree lifetime is not subject lifetime;
- diagnostic location is not tree identity;
- a Link external boundary can exchange complete values even when internal reactivity is granular;
- a benchmark result is not evidence until its harness survives falsification.

The current engineering whitepaper characterizes v15 as a planned state engine with explicit semantic boundaries rather than a cosmetic API rewrite.

## 4.2 Important closed/earned engineering concepts

**OBSERVED / ENGINEERING RECORD**

The following are important foundations that the commercial thesis may build on without inventing them for commercial reasons:

- authored transitions vs realizations;
- causal turns;
- subject lifetime identity distinct from address/key reuse;
- restoration authority;
- transaction/commit semantics;
- strong Link relationship semantics;
- explicit retrieval / settlement / disposal;
- framework-neutral truth as the architectural direction;
- framework adapters as observation/realization layers;
- local history/causal semantics;
- error attribution via tree identity + path.

## 4.3 Link is deliberately smaller than Relay

**OBSERVED**

The public Link contract emerged through falsification and was intentionally narrowed. It should not be silently widened merely to make Relay easy.

The commercial system must respect:

> SignalTree exposes the relationship, not necessarily the machinery that makes the relationship causally correct.

Relay is therefore a **future commercial product hypothesis built on earned semantics**, not permission to contaminate the kernel with speculative distributed metadata.

## 4.4 Current engineering status snapshot

**OBSERVED FROM RC1 RELEASE EVIDENCE, 2026-08-30**

SignalTree `15.0.0-rc.1` is live under the hyphenated npm scope:

```text
@signal-tree/kernel@15.0.0-rc.1
@signal-tree/angular@15.0.0-rc.1
tag v15.0.0-rc.1 -> candidate source 4020b7dd
release gates 66/66, 0 failed, 0 known-red
```

The exact candidate tarballs were inspected, installed into a clean Angular 22
consumer, typechecked, bundled, executed, published, downloaded from npm, and
compared byte-for-byte with the authorized artifacts. The real demo production
consumer and browser route smoke are green. The earlier 63/66 result was caused
by stale release harnesses; it did not establish an undo/redo product defect.

The v15 construction/access surface is singular and frozen:

```text
signalTree(initialState, config?)
config.derived: ($) => ({ ... })
tree.$
```

There is no public builder, fluent or positional derived path, tier array,
`.state` facade, or duplicate public tree interface.

**Post-RC finding:** RC1's Angular manifest incorrectly declared
`sideEffects: false`. A side-effect-only import could therefore be removed by a
consumer bundler before it installed the Angular realization. The repository
fix removes that declaration and has a direct esbuild control. Treat this as an
RC packaging/DX correction, not evidence against the semantic thesis.

## 4.5 Code-to-commercial gap audit: actor and authority attribution

**OBSERVED CODE AUDIT — reproduced against RC1 source**

A user-provided code audit of the current kernel reported that `WriteMetadata` contains:

```ts
intent?: 'hydrate' | 'reset' | 'bulk' | 'migration' | 'user' | 'system';
origin?:
  | 'restoration'
  | 'devtools'
  | 'external'
  | 'transaction-rollback';
suppressGuardrails?: boolean;
correlationId?: string;
timestamp?: number;
```

The same audit reported no explicit `actorId`, `userId`, `principal`, `agentId`, approval, or authorization/authority-context concept in the kernel, and reported `RestorationHistoryEntry<T>` as approximately:

```ts
{
  action: string;
  timestamp: number;
  state: T;
  payload?: unknown;
}
```

The current implementation supports important distinctions such as:

- local/user/system intent at a coarse level;
- external realization;
- restoration;
- transaction rollback;
- correlation;
- subject/key/lifetime semantics;

but it **does not yet support the full commercial story of “who did what under what authority.”**

That is not a kernel defect. Actor and authority attribution are optional product
requirements whose owner must be earned from customer evidence. They are not on
the critical path for testing the current semantic substrate.

### Commercial consequences if the advisory audit is confirmed

| Product                  | What is credible now                                                                  | What remains unimplemented/unassigned                                                        |
| ------------------------ | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **Studio**               | Authored-vs-realized, restoration-vs-new-authorship, local causal state investigation | Reliable actor identity, approvals, agent identity, authority context                        |
| **Relay**                | Preserve incoming remote truth as realization rather than recipient authorship        | Actor provenance, authorization, causal journal semantics, distributed attribution           |
| **Audit**                | Future retention can build on state semantics                                         | “Who did what under what authority” evidence model is not yet present in restoration history |
| **Verified Audit**       | Integrity mechanisms can later prove retained evidence                                | There is not yet a sufficiently rich causal evidence object to verify                        |
| **Agent accountability** | Conceptually compatible with agents as external actors                                | No current actor class / agent identity ownership                                            |

### Do not solve this by contaminating the kernel prematurely

The next question is **ownership**, not “add `actorId` everywhere.”

Candidate ownership patterns to falsify include:

1. application/integration supplies identity and authority context at the boundary;
2. a Studio/telemetry layer correlates SignalTree transition IDs with auth/OTel/business context;
3. Relay carries an attribution envelope across runtimes while the kernel remains actor-agnostic;
4. Audit normalizes and retains actor/authority evidence independently of restoration history;
5. some minimal opaque attribution handle belongs in the kernel only if all external-owner designs fail a concrete discriminator.

Run that ownership experiment only after a real investigation or buyer shows
that identified actor/authority context materially increases value.

## 4.6 Framework-neutrality status correction

**OBSERVED / SHIPPED PACKAGE FACT**

The packed kernel has zero Angular runtime and declaration dependencies. Angular
realization lives in `@signal-tree/angular`, whose native-signal behavior was
proven in clean consumers. Framework neutrality is a shipped package boundary,
not a north star. This proves the kernel/Angular split; it does not prove every
future framework adapter.

---

# 5. Category definition

## 5.1 Proposed technical category

### Causal Application State

> **Application state whose consequential transitions preserve enough semantic context to distinguish authorship, realization, restoration, identity/lifetime, and causal relationships independently of the UI framework observing the state.**

This is the **current public-category candidate** because it maps to semantics already present in the v15 engineering record. Actor identity, approval/authorization context, and cross-runtime actor provenance are **extended accountability capabilities**, not part of the minimum shipped-category claim until their ownership and implementation are proven.

Plain-English form:

> **Application state should not merely tell you what is true now; consequential state should be able to explain how it became true.**

Secondary phrase:

> **Explainable application state.**

## 5.2 Commercial-language hierarchy

| Layer              | Recommended language                                                                                                                                | Use                                                                        |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Technical category | **Causal Application State**                                                                                                                        | Architecture, technical notes, analyst/research discussion                 |
| Commercial promise | **SignalTree explains how application state became true — beginning with authorship, realization, restoration, and authority-of-truth boundaries.** | Buyer-facing positioning; do not imply actor attribution until implemented |
| Demo question      | **Why does this value have this value right now?**                                                                                                  | Immediate developer/executive hook                                         |
| Studio             | **Studio explains the causal state story.**                                                                                                         | Production debugging and investigation                                     |
| Relay              | **Relay preserves relevant state causality across runtime boundaries.**                                                                             | Distributed thesis; must be proven                                         |
| Audit              | **Audit independently retains the resulting causal evidence.**                                                                                      | Security/compliance thesis; demand-gated                                   |
| Verified Audit     | **Verified Audit helps detect whether retained evidence was altered.**                                                                              | High-risk evidence integrity; must be buyer-required                       |

## 5.3 Important category non-claims

SignalTree must **not** publicly define itself by capabilities the released artifact does not yet satisfy.

In particular:

- **distributed causal state** remains a commercial north star until Relay semantics are implemented and proven;
- **actor provenance**, **approval/authorization context**, and **agent accountability** are not minimum v15 category claims;
- **“who changed this?”** should not be the headline current Studio promise until actor attribution has an earned owner and conformance;
- framework neutrality is proven for the shipped kernel/Angular package split;
  this does not imply every future framework adapter already exists.

---

# 6. Minimal public semantic glossary

| Term                         | Working definition                                                                                                                                                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **State authority**          | The semantic owner of application truth; not necessarily the framework rendering it                                                                                                                                                               |
| **Authored transition**      | Application work treated as intentional local mutation rather than external realization, restoration, or inspection; it does not imply an identified principal                                                                                    |
| **Realization**              | External or authoritative truth applied without pretending the local consumer authored it                                                                                                                                                         |
| **Causal turn**              | A semantically related unit of authored change and its consequences                                                                                                                                                                               |
| **Subject lifetime**         | Identity of a particular state subject across its valid lifetime, distinct from a reusable public address/key                                                                                                                                     |
| **Restoration authority**    | The mechanism allowed to restore earlier truth without confusing restoration with new authorship                                                                                                                                                  |
| **Causal explanation**       | A reconstructable account of why a value exists using the semantic context actually available; v15’s minimum claim should center on authorship/realization/restoration/identity, while actor/authority attribution remains an extended capability |
| **Distributed causal state** | Future commercial capability preserving relevant causal application-state semantics across participating runtimes/services instead of reducing them to anonymous synchronization; actor provenance is not assumed until separately implemented    |

---

# 7. Governing market thesis

SignalTree is **not** trying to be:

- a better JWT;
- a better backend audit log;
- a generic distributed trace collector;
- a generic WebSocket service;
- a generic collaboration backend;
- a replacement database;
- a general event-sourcing platform;
- a durable workflow engine;
- merely a Redux/NgRx DevTools competitor.

The thesis to prove now is:

> **SignalTree can add a semantic application-state layer to an existing
> consequential system and materially improve investigation of local authored
> work, external/server realization, restoration, rollback, and subject lifetime
> without forcing the organization to rebuild its backend.**

Automation, identified agents, approvals, and multiple runtimes are later
expansions, not part of this first thesis.

If this thesis is false, the commercial strategy must be revised before building heavy Relay/Audit infrastructure.

---

# 8. Why JWT + backend audit is not automatically the competitor SignalTree beats

For many applications, a normal backend audit system is the correct solution.

If the only question is:

> Who authenticated, which API call did they make, what authoritative row changed, and when?

then JWT/OAuth identity + backend audit logging is simpler and should probably win.

The SignalTree thesis begins only when the important question becomes:

> **Why does this application value have this value right now?**

That may require distinguishing:

- local authored intent;
- optimistic client state;
- an AI recommendation;
- human approval;
- tool execution;
- backend acceptance/rejection;
- authoritative server realization;
- another user’s remote action;
- offline reconciliation;
- automation;
- rollback/undo;
- state that never became server truth.

The economic thesis is therefore not “more logs.”

It is:

> **automatic application-state semantics that distinguish authored work,
> external realization, restoration, inspection, and rollback without requiring
> manual logging at every write.**

---

# 9. Conventional control stack SignalTree must beat

The commercial benchmark must not compare SignalTree to a strawman.

The strongest practical control arm should include:

```text
JWT/OAuth identity
+ structured backend audit events
+ correlation / causation IDs
+ OpenTelemetry distributed tracing
+ frontend telemetry
+ ordinary application state
+ normal logging / observability
```

Where relevant, the control may also include:

- event sourcing;
- durable workflow history;
- database CDC;
- collaboration/sync infrastructure;
- session replay;
- application-specific audit code.

SignalTree only has a differentiated product if it produces a materially better application-state explanation **after the control is competently instrumented**.

---

# 10. Competitive landscape

**EXTERNAL MARKET LANDSCAPE / MUST BE PERIODICALLY RE-VERIFIED**

| Existing category/system                    | Already strong at                                                       | SignalTree must add                                                                                                            |
| ------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| JWT + backend audit DB                      | Identity + committed authoritative changes                              | Client state semantics, optimistic/uncommitted state, authored-vs-realized state, subject lifetime, cross-runtime consequences |
| Kurrent/EventStore-style event sourcing     | Immutable event history, replay, audit, ordering, causation/correlation | Brownfield client-side state semantics without forcing backend event-sourcing conversion                                       |
| OpenTelemetry / Datadog-class observability | Distributed execution traces, request flow, errors, performance         | State consequence as the organizing object rather than execution span as the organizing object                                 |
| Liveblocks / Yjs-class collaboration        | Shared state, presence, offline, multiplayer, conflict handling         | Not enough to say “Relay does realtime”; Relay must preserve differentiated application-state semantics                        |
| Zero                                        | Client/local sync, optimistic operations, server reconciliation         | Causal state explanation and semantic attribution beyond generic sync                                                          |
| Electric                                    | Postgres-to-client synchronization/fan-out                              | Backend-agnostic semantic layer rather than database replication                                                               |
| Convex                                      | Database + transactions + automatic realtime frontend sync              | Coexist with customer’s existing backend instead of replacing it                                                               |
| Temporal                                    | Durable workflow execution/history                                      | Application-state consequence semantics, especially on rich clients                                                            |
| NgRx / Redux / Zustand                      | Local state management and ecosystem distribution                       | Deep identity/authority semantics + production causal tooling + commercial operations                                          |
| Sentry / session replay class               | Errors, telemetry, replay, production debugging                         | Causal semantic explanation of state, not merely observing the UI/session                                                      |

### Competitive conclusion

SignalTree should assume that **individual visible features are copyable**.

The company is weak if its differentiation reduces to:

- causal IDs;
- an append-only event log;
- WebSockets;
- a “Why?” button without deep semantics;
- undo;
- session replay;
- actor metadata;
- ordinary audit;
- framework adapter syntax.

---

# 11. Competitive white space hypothesis

The proposed white space is the intersection of:

```text
APPLICATION STATE SEMANTICS
authored vs realized
subject lifetime
causal turns
restoration authority
        |
        v
DISTRIBUTED STATE CONSEQUENCES
browser
worker
backend
agent
offline client
        |
        v
PRODUCTION EXPLANATION
"WHY?"
   /     \
Studio   Relay
   \     /
    Audit
```

Neighboring products usually start from a different primary object:

```text
OpenTelemetry -> execution
Event sourcing -> event
Datadog/Sentry -> telemetry/incident/session
Liveblocks/Yjs -> collaborative document/shared state
Zero/Electric -> synchronization
Convex -> backend/database
Temporal -> workflow execution
NgRx/Redux -> local store/action
```

SignalTree’s proposed organizing object is:

> **the application-state consequence and the semantic transitions that made it true.**

This is a **HYPOTHESIS** until `STATE-SEMANTICS-0` proves a material investigation
outcome, `MIGRATION-WEDGE-0` proves affordable brownfield adoption, and
`PAID-PILOT-0` proves a buyer will fund it. Full actor-aware `STATE-WHY-0` is a
later optional expansion.

---

# 12. Ideal customer profile

The strongest target is:

> **A consequential application with substantial client-side behavior, multiple actors or runtimes, authoritative backend truth, optimistic/offline/agent behavior, and expensive incidents where understanding how state became true matters.**

Likely high-value sectors/use cases:

- industrial / operational software;
- AI-heavy enterprise applications;
- financial / high-value workflows;
- multi-actor operations/control systems;
- sophisticated enterprise collaboration where client behavior is more than a thin view over backend events;
- systems where approvals, automation, human actions, backend authority, and recovery interact.

---

# 13. Deliberate non-customers

SignalTree should **lose intentionally** when a narrower product already solves the real problem.

| Customer need                               | Likely better answer                      | SignalTree implication                                |
| ------------------------------------------- | ----------------------------------------- | ----------------------------------------------------- |
| Basic CRUD admin audit                      | Backend audit logging                     | Do not enter commodity audit market                   |
| Fully event-sourced backend + thin frontend | Existing event-sourcing stack             | SignalTree may add little                             |
| Google Docs-style collaborative editor      | Yjs/Liveblocks-class tools                | Do not sell Relay as generic collaboration            |
| New backend + realtime client               | Convex-class platform                     | Win by coexistence, not backend replacement           |
| Postgres-to-client replication              | Electric-class sync                       | Do not sell Relay as database fan-out                 |
| Technical request tracing                   | OpenTelemetry/Datadog-class observability | Add state semantics or lose                           |
| Simple local UI state                       | NgRx/Redux/Zustand/signals                | Do not force causal infrastructure where value is low |

A company that cannot clearly identify who should **not** buy the product probably has not found the category boundary.

---

# 14. Brownfield adoption invariant

> **The first meaningful SignalTree causal explanation must not require a backend rewrite.**

Target pilot:

```text
EXISTING
React/Angular
-> REST/GraphQL
-> Java/.NET/Node
-> Postgres/other database
+ JWT/OAuth
+ OpenTelemetry/logging

PILOT
same application
+ SignalTree around one consequential workflow
+ causal context propagated through existing API
+ server result returned as realization
+ Studio answers "Why?"
```

The migration wedge is:

> **Add causal state semantics to the architecture you already have.**

Not:

> Replace your backend with SignalTree.

### Brownfield falsifier

If meaningful value requires:

- event-sourcing conversion;
- backend replacement;
- broad application rewrite;
- changing the database;
- replacing existing observability;
- or deploying Relay before the first useful explanation,

then enterprise adoption becomes materially harder and the thesis must be narrowed.

---

# 15. Automatic semantic instrumentation moat hypothesis

The moat is **not** that SignalTree can store a causal ID.

Anyone can add a causal ID.

RC1 already distinguishes these semantic classes automatically:

```text
application-authored work
external realization
history restored Z
transaction rolled back R
inspection changed visible state
```

It does not identify the person, agent, approval, authorization, or remote
participant behind those classes. Those are future attribution enrichments:

```text
human or principal identity
agent identity and tool use
approval / authorization context
remote participant identity
automation identity
```

Do not market the second list as automatic instrumentation until
`ATTRIBUTION-OWNER-0` is earned and implemented.

The moat hypothesis:

> **Semantic instrumentation derived from state authority develops fewer gaps, requires less maintenance, and misclassifies fewer transitions than manually constructed instrumentation.**

This must be tested under `INSTRUMENTATION-COVERAGE-0`.

The first `STATE-SEMANTICS-0` instrument may use the existing internal bounded
diagnostic journal in an unpublished demo or Studio prototype. That does not
authorize exporting the journal or changing the frozen kernel API. A public
investigation contract must be earned by the experiment.

---

# 16. Product architecture

## 16.1 Public substrate

The free/broadly usable layer is primarily distribution and category formation.

Potential public components:

- framework-neutral kernel;
- Angular adapter;
- React adapter;
- future official adapters where demand exists;
- public semantic contracts;
- Link client boundary;
- basic local causal inspection;
- public conformance for public promises;
- documentation;
- examples;
- migration tooling;
- technical notes.

## 16.2 Enterprise Adoption

First paid wedge around/after v15 GA:

- architecture review;
- migration planning;
- one-workflow causal-state pilot;
- production-readiness review;
- private workshops;
- priority support;
- LTS/upgrade support;
- integration design.

Purpose:

> **cash + discovery + design partners + proof**

This can produce revenue before Studio/Relay/Audit are mature.

## 16.3 Studio

Studio should answer:

> **Why did this state become this?**

Potential free/local experience:

- local causal timeline;
- authored vs realized distinction;
- current state explanation;
- local history;
- basic causal graph.

Potential paid organizational value:

- production trace ingestion;
- retained traces;
- remote sessions;
- cross-runtime correlation;
- team collaboration;
- saved investigations;
- shareable incident links;
- SRE/support integrations;
- environment/admin controls;
- causal search/indexing.

### Studio commodity falsifier

If Studio reduces to:

> logs + timeline + prettier DevTools

then it is commodity-adjacent and should not command enterprise observability pricing.

## 16.4 Relay

Relay should **not** be “WebSockets as a service.”

Weak description:

> Here is an event; send it to everyone.

Differentiated description:

> **Here is a SignalTree causal state transition. Preserve the relevant semantic relationship across authorities/runtimes, reconcile it against authoritative truth, and deliver the resulting realization without pretending every recipient authored it.**

Possible Relay responsibilities, **future hypothesis only**:

- connection/session layer;
- state scopes;
- hydration/catch-up;
- causal journal;
- actor provenance;
- authorization;
- reconciliation;
- server authority;
- offline catch-up;
- snapshot/checkpoint policy;
- persistence;
- presence;
- debugging/replay linkage;
- integration with Studio/Audit.

### Relay should not start with arbitrary CRDT ambition

Initial conflict semantics should likely prefer:

- server-authoritative outcomes;
- optimistic client -> authoritative realization;
- version/checkpoint rejection;
- application-defined conflict handling;
- explicit policies.

CRDTs may be added where a use case proves they are appropriate.

### Relay commodity falsifier

If buyers mainly evaluate Relay as:

- WebSockets;
- rooms;
- presence;
- sync throughput;
- generic offline support;
- database fan-out;

then Relay is in a crowded commodity-adjacent market.

## 16.5 Audit

Audit should answer:

> **What causal evidence was independently retained?**

Not:

> Who changed a database row?

Potential value:

- independent retention;
- actor/authority history;
- approvals;
- server realizations;
- agent/tool participation;
- search;
- export;
- retention policy;
- legal hold;
- chain-of-custody workflow.

### Audit commodity falsifier

If Audit becomes merely:

> append events to a database

then backend audit/event stores already solve the problem.

## 16.6 Verified Audit

Verified Audit should answer:

> **Can an independent party detect whether retained evidence was altered?**

Potential mechanisms may include:

- signed receipts;
- hash chains;
- Merkle proofs;
- externally witnessed commitments;
- key management;
- verification;
- customer-verifiable exports.

The product value is **evidence integrity**, not “blockchain.”

## 16.7 Agent accountability

Agents should initially be another actor class, not a separate company.

```text
human
backend
automation
GPT
Gemini
Claude
worker
        |
        v
SignalTree causal state
```

Potential value:

- agent identity;
- tool-to-state consequence;
- proposed vs approved vs realized actions;
- human approval;
- policy;
- cross-model accountability.

Do not create a standalone SKU until repeated buyers have an actual budget for it.

---

# 17. Product portfolio relationship

Studio and Relay are **sibling paths**, not a mandatory sequence.

The diagram below is an option map, not a roadmap. **Studio may be the company**
if the semantic investigation wedge works and distributed preservation adds
little. Relay may remain an integration concern. Audit and Verified Audit may
never exist. Those outcomes are success when they follow evidence rather than
portfolio completion pressure.

```text
                 SignalTree semantic substrate
                          |
               application-state causality
                          |
              +-----------+-----------+
              |                       |
            Studio                  Relay
      explain consequences     preserve semantics
                               across runtimes
              |                       |
              +-----------+-----------+
                          |
                        Audit
                          |
                    Verified Audit
```

### Portfolio coherence falsifier

If:

- Relay becomes merely sync;
- Studio becomes merely logs;
- Audit becomes merely append-only retention;

then the products have lost the semantic moat and should not be justified merely because they form a neat diagram.

---

# 18. Flagship demo strategy

The demo strategy remains useful because the same business event can test multiple commercial propositions.

## 18.1 The $375,000 Exception

Scenario:

- a $375,000 industrial order is at risk;
- an AI agent proposes a $42,000 expedite;
- policy requires human approval;
- multiple humans approve;
- field work may occur offline;
- backend truth changes;
- a stale automation produces a bad value;
- SignalTree explains the value;
- deeper chapters can show Relay/Audit/verification.

## 18.2 Public first 90 seconds

Do not begin with ten product layers.

Use approximately:

1. consequential risk appears;
2. multiple actors/authority boundaries participate;
3. a wrong value appears;
4. user asks **Why?**;
5. SignalTree reconstructs the causal state story.

Then branch by buyer.

## 18.3 Strong-control version

The killer demo should include a competent conventional system.

### Control

```text
JWT/OAuth
backend audit events
OpenTelemetry
ordinary frontend state
```

### SignalTree

```text
same backend
same JWT
same OTel
+ SignalTree causal semantics
+ server realization
+ Studio
(+ Relay only in Arm C)
```

The point is not visual superiority.

The point is to prove a material reduction in investigation effort or a class of explanation the control cannot reliably produce.

---

# 19. Business ADSP experiments

## Operating order

```text
1. STATE-SEMANTICS-0
2. MIGRATION-WEDGE-0
3. PAID-PILOT-0 / STUDIO-WTP-0
4. ATTRIBUTION-OWNER-0 — only if customer evidence says “who/under what authority?” matters
5. STATE-WHY-0 — only after its tested attribution exists end to end
6. RELAY-VALUE-0 — only if distributed preservation recurs in real cases
```

The first three may share one brownfield pilot. Do not block them on actor
identity. The initial valuable question may be “why does the client disagree
with server truth, and what did undo restore?” rather than “who changed this?”

## 19.0 `STATE-SEMANTICS-0` — run before the full flagship comparison

**Purpose**

Test the differentiated semantics that the current kernel appears to actually own before asking it to prove actor-aware accountability it does not yet implement.

**Property**

SignalTree can materially improve explanation of a consequential state outcome by distinguishing at least:

- authored vs externally realized state;
- optimistic/local state vs later authoritative truth;
- restoration/undo vs new authorship;
- subject lifetime/address reuse where relevant;
- transaction rollback vs authored change.

### Control arm

```text
JWT/OAuth
+ structured backend audit
+ correlation IDs
+ OpenTelemetry/frontend telemetry
+ ordinary client state
```

### SignalTree arm

```text
same backend/auth/OTel
+ SignalTree semantic state
+ external realization
+ restoration semantics
+ Studio/local trace prototype
```

### Critical restriction

The scenario must **not depend on actor attribution, approvals, agent identity, or authorization provenance** to answer the test question.

### Candidate task

> “This field changed locally, the server later returned a different authoritative value, and undo/history was used. Which state was actually authored locally, which state was realized from the server, and what would undo legitimately restore?”

### Falsifier

A strong conventional stack answers the semantic question just as correctly and cheaply, or SignalTree’s distinction does not matter to real investigators.

### Consequence

- **Green:** run `MIGRATION-WEDGE-0` and make the paid-pilot ask. Open
  attribution ownership only if investigators or buyers identify it as material.
- **Red:** the core commercial wedge is weaker than the current strategy assumes; do not build Relay/Audit around it.

---

## 19.0A `ATTRIBUTION-OWNER-0`

**DEFERRED BY DEFAULT.** This is not on the critical commercial path. Open it
only when evidence from `STATE-SEMANTICS-0`, migration work, or paid-pilot
conversations shows that identified actor/authority context materially changes
the outcome.

**Question**

Where should actor identity, approval/authorization context, and agent identity live without violating the kernel’s earned ownership boundaries?

### Candidate outcomes

- application/integration context;
- Studio/telemetry correlation layer;
- Relay attribution envelope;
- Audit evidence model;
- minimal opaque kernel handle only if externally owned designs fail.

### Required discriminator

The winning design must allow a real scenario to reconstruct:

```text
authenticated principal
-> authored application transition
-> tool/agent or approval context
-> backend authoritative outcome
-> remote realization
```

without requiring the kernel to become an authentication/authorization system.

### Falsifier

Any candidate that:

- loses attribution across the transition;
- cannot correlate to state causality;
- forces manual instrumentation at every write;
- couples the kernel to a provider-specific identity model;
- or requires a broad public API expansion without measured user value.

### Freeze rule

Do not add public `actorId`/authority APIs merely because the business roadmap wants them. Earn the owner first.

---

## 19.1 `STATE-WHY-0` — full actor-aware flagship test

**Prerequisites**

- `STATE-SEMANTICS-0` is green;
- `ATTRIBUTION-OWNER-0` has identified an owner for actor/authority context if the scenario asks “who?” or depends on approvals/agents;
- the tested implementation actually carries that context end to end.

**Property**

SignalTree materially improves explanation of a consequential application-state outcome versus a strong conventional stack.

### Arm A — conventional control

```text
JWT/OAuth
+ structured backend audit
+ correlation/causation IDs
+ OpenTelemetry/frontend telemetry
+ ordinary client state
```

### Arm B — SignalTree semantic layer

```text
same backend/auth/OTel
+ SignalTree causal semantics
+ causal context
+ server realization
+ Studio
```

No Relay required.

### Arm C — SignalTree + Relay

Arm B plus Relay preserving relevant state semantics across runtimes.

### Task

Give each system to engineers who did not build it.

Ask:

> **Why does this field currently have the wrong value?**

### Measure

- time to correct explanation;
- number of tools/screens;
- manual correlation;
- missing causal edges;
- incorrect actor attribution;
- authored-vs-realized discrimination;
- optimistic/uncommitted state explanation;
- ability to explain later server truth;
- cross-client/running-system reconstruction;
- confidence in the answer.

### Interpretation

- `A << B ≈ C`: Studio/semantic instrumentation is the wedge; Relay may be optional.
- `A < B << C`: Relay adds material differentiated value.
- `A ≈ B ≈ C`: current causal-state commercial thesis is weak.

### Falsifier

SignalTree does not produce a substantially faster, more coherent, more correct, or otherwise unavailable explanation against the strong control.

## 19.2 `MIGRATION-WEDGE-0`

**Property**

A team can obtain its first useful cross-boundary causal explanation without replacing backend architecture.

Measure:

- time to first trace;
- total code touched;
- backend changes;
- services replaced;
- onboarding complexity;
- build/deploy changes;
- number of developers required.

### Falsifier

Meaningful value requires backend redesign, event-sourcing conversion, broad migration, or Relay deployment before the first useful explanation.

## 19.2A `PAID-PILOT-0`

**Property**

A qualified organization will pay roughly $15k–$30k to obtain the demonstrated
causal-state investigation outcome in one consequential workflow.

Measure the recurring workflow, buyer, displaced budget, implementation scope,
success criterion, and credible path from pilot to Studio or support spend.

### Falsifier

Qualified prospects regard the result as interesting but cannot name a recurring
workflow, budget owner, or paid next step.

## 19.3 `INSTRUMENTATION-COVERAGE-0`

Run after `STATE-WHY-0` is green.

Compare conventional manual instrumentation with SignalTree semantic instrumentation.

Measure:

- missing transitions;
- actor/source misclassification;
- instrumentation code volume;
- workflow-change maintenance;
- drift between application semantics and telemetry;
- false causal chains.

### Falsifier

SignalTree instrumentation does not materially reduce gaps or maintenance.

## 19.4 `RELAY-VALUE-0`

**Property**

Preserving application-state semantics across runtime boundaries creates material incremental value beyond Studio-only causal explanation and beyond commodity sync.

Measure:

- `STATE-WHY-0` Arm B vs Arm C;
- customer willingness to pay;
- distributed incident reconstruction;
- offline/cross-client explanation;
- actor/authority preservation;
- avoided manual correlation.

### Falsifier

Relay does not materially improve outcome over Studio alone or customers price-compare it mainly to commodity realtime services.

## 19.5 `STUDIO-WTP-0`

**Property**

Causal production explanation is important enough to support team/enterprise software spend.

### Success signal

- repeated production workflow;
- qualified buyer;
- paid pilot or annual commitment.

### Falsifier

Interest remains a demo novelty with no recurring workflow or budget.

## 19.6 `RELAY-WTP-0`

**Property**

Organizations will pay SignalTree to operate distributed causal-state semantics.

### Falsifier

No repeated cross-company pain, no willingness to pay for pilots, or price is constrained to ordinary WebSocket/sync tooling.

## 19.7 `AUDIT-WTP-0`

**Property**

Independent causal history reaches security/compliance/risk budgets.

### Falsifier

No qualified security/compliance buyers or no willingness to fund a design partnership.

## 19.8 `PROTECT-LICENSE-0`

**Property**

A more restrictive licensing structure provides enough incremental protection to justify adoption/category friction relative to Apache-2.0.

### Baseline

Apache-2.0 kernel + official adapters remains the current strategic baseline unless evidence/counsel says otherwise.

### Candidate structures

- Apache-style permissive;
- MPL-style weak copyleft;
- source-available/dual-license;
- split-package protected engine.

### Test audience

5–10 credible adopters/design partners with real enterprise/legal/procurement exposure.

### Questions

- Would this block evaluation?
- Would legal approve production use?
- Would it block internal adapters?
- Would it block contribution?
- Would it cause selection of a technically weaker alternative?
- What would procurement actually do next?

### Falsifier for restriction

Credible prospects repeatedly identify the protective license as an adoption blocker while the additional protection remains weak.

### Key principle

`PROTECT-LICENSE-0` is qualitative discovery, not a popularity poll.

## 19.9 `CATEGORY-0`

**Property**

SignalTree becomes independently associated with “causal application state” / explainable application-state semantics.

Measure:

- unsolicited third-party use of category language;
- references in posts/articles/talks;
- comparisons saying another product added “SignalTree-like” behavior;
- inbound queries using SignalTree terminology;
- search/discussion gravity.

### Falsifier

Audience understands individual features but the category language does not travel independently.

## 19.10 `PARTNER-POWER-0`

**Property**

A partner increases SignalTree leverage more than it increases appropriation/capture risk.

### Falsifier

The partner requests rights, dependence, or disclosure disproportionate to committed value.

## 19.11 `PROVENANCE-0`

**Property**

An independent third party can reconstruct SignalTree chronology without relying only on SignalTree’s own assertions.

### Falsifier

Chronology depends primarily on signaltree.io or internally controlled statements.

---

# 20. Revised licensing posture

The strategy evolved during this session.

### Earlier position

Public free foundational packages under Apache-2.0 were favored because client-side infrastructure benefits heavily from trust, inspectability, adapter development, forkability, and low vendor-lock-in fear.

### Adversarial correction

A well-funded incumbent with AI can extract design intent from:

- source;
- tests;
- whitepapers;
- ADSP case study;
- demos;
- comments;
- benchmark harnesses.

Therefore openness is not a moat.

### Current posture

> **Apache-2.0 remains the strategic baseline, subject to counsel and `PROTECT-LICENSE-0`.**

Why return to Apache as baseline?

Because a client-side state substrate must become adopted before it can become strategically valuable. Restrictive licensing that kills category formation can destroy more value than it protects.

A more restrictive license must earn itself with evidence.

### Important asymmetry

> You can open protected code later.  
> You generally cannot make already-published permissively licensed code secret again.

Therefore irreversible licensing/public-disclosure choices still deserve pre-GA review.

---

# 21. Public/private asset boundary

## 21.1 Public / adoption-oriented

Potentially public:

- kernel contracts;
- official framework adapters;
- semantic glossary;
- Link public contract;
- basic local causal inspection;
- public conformance;
- examples;
- migration tooling;
- enough architecture to create trust;
- technical notes establishing category/provenance.

## 21.2 Protected / commercial

Keep proprietary or tightly controlled unless a strategic reason says otherwise.

### Relay server

- causal journal implementation;
- tenant topology;
- reconciliation algorithms;
- snapshot/checkpoint strategy;
- routing;
- authorization internals;
- recovery;
- multi-region behavior;
- scaling machinery;
- private operational tests.

### Studio Cloud

- production ingestion;
- indexing/query engine;
- cross-runtime correlation;
- collaboration;
- retention;
- organization controls;
- large-scale investigation infrastructure.

### Audit

- independent retention implementation;
- evidence pipeline;
- legal-hold machinery;
- policy system;
- export operations;
- evidence indexing;
- enterprise administration.

### Verified Audit

- key management;
- signing infrastructure;
- proof generation;
- anchoring operations;
- verification service;
- chain-of-custody implementation.

### Agent governance

- policy evaluation;
- permission model;
- approvals;
- enterprise identity mappings;
- organizational integrations.

### Private adversarial corpus

- production failure cases;
- network partition cases;
- duplicate/reordered delivery;
- long-offline clients;
- authorization races;
- failed acknowledgements;
- upgrade compatibility;
- recovery incidents;
- malformed inputs;
- large causal-history cases;
- customer-specific operational lessons.

---

# 22. Protection against malicious or opportunistic humans

The strategy assumes some actors may:

- copy public ideas;
- exploit ambiguity;
- claim conceptual priority;
- use more legal resources;
- pressure partners/customers;
- hire key talent;
- seek broad rights during investment/partnership;
- exploit weak provenance;
- use public feedback channels to obtain broad rights to submitted ideas;
- attempt to frame SignalTree as derivative after copying it.

The defense must work **without illegal retaliation** and without assuming litigation success.

## 22.1 Defense stack

1. independently verifiable provenance;
2. category association;
3. customers and case studies;
4. controlled disclosure;
5. proprietary commercial operations;
6. private negative knowledge/failure corpus;
7. multiple clouds/providers/models;
8. multiple design partners;
9. multiple financing options;
10. strong trademark/brand discipline;
11. clear company ownership of commercial IP;
12. contributor/employee/contractor IP hygiene;
13. revenue/runway;
14. continuous shipping.

## 22.2 Core principle

> **Make SignalTree easy to adopt, easy to trust, and hard to economically replace — not merely hard to inspect.**

---

# 23. Provenance program

## 23.1 Private invention ledger

Maintain internal chronology for:

- concept;
- date;
- author;
- hypothesis;
- experiment;
- commit;
- diagram;
- rejected alternative;
- result;
- current disposition;
- public disclosure status;
- possible IP sensitivity.

Do not automatically publish the ledger.

## 23.2 Public provenance ledger

Publish selected concepts only after disclosure/IP review.

Potential entries:

- Causal Application State;
- authorship vs realization;
- subject identity vs address;
- Link contract;
- restoration authority;
- important released technical notes.

## 23.3 Provenance bundle per major milestone

Ideally:

- signed source tag;
- package/release publication;
- technical note + artifact hash;
- independent archive;
- trusted timestamp receipt;
- private-ledger cross-reference.

Blockchain anchoring, if used, is supplemental rather than foundational.

## 23.4 Technical note program

Start small:

- `STN-001` — Causal Application State
- `STN-002` — Authorship vs Realization
- `STN-003` — Subject Identity vs Address

Each note should include:

- version;
- date;
- stable identifier;
- hash;
- public contract;
- non-claims;
- references to released artifacts where appropriate.

Do not use technical notes as a mechanism for publishing the future commercial roadmap.

---

# 24. Copycat and origin-claim playbook

Assume a larger company eventually announces something similar and implies it originated the category.

## Step 1 — Preserve evidence

Freeze:

- commits;
- releases;
- archives;
- technical notes;
- demos;
- publications;
- relevant correspondence;
- customer chronology.

## Step 2 — Classify accurately

Distinguish:

- independent similar implementation;
- lawful use of public concepts;
- license violation;
- proprietary-material misuse;
- trademark/confusion;
- materially false historical claim.

## Step 3 — Counsel review

Do not publicly accuse first and investigate later.

## Step 4 — Continue shipping

Do not let the dispute consume the product roadmap.

## Step 5 — Use factual chronology

If useful, publish:

- dates;
- hashes;
- commits;
- released notes;
- archived demos.

Avoid emotional “they stole it” messaging when evidence can speak more credibly.

## Step 6 — Mobilize independent validators

Potentially:

- customers;
- respected engineers;
- researchers;
- ecosystem participants;
- independent archives;
- partners.

## Step 7 — Turn imitation into validation

Position:

> The industry is converging on causal application-state semantics.

Then demonstrate why SignalTree remains ahead.

## Step 8 — Increase commercial alternatives

Use:

- customer contracts;
- funding;
- partnerships;
- distribution;
- other cloud options;
- broader framework support.

The negotiation should be based on assets, not moral entitlement.

---

# 25. What SignalTree should negotiate on if copied

Do not negotiate from:

> You owe us because we invented it.

Negotiate from:

- customers;
- recognized category position;
- proprietary Relay;
- Studio;
- Audit;
- operational infrastructure;
- integration ecosystem;
- private failure corpus;
- real production data/learning;
- case studies;
- brand;
- talent;
- protected IP where applicable;
- ability to remain independent.

Target negotiating frame:

> “You may have reproduced feature X. SignalTree has customers, production
> know-how, integrations, operational evidence, and a product that makes the
> semantics commercially reliable.”

Chronology and provenance prevent easy erasure from the record. They do not
create buyer leverage by themselves.

---

# 26. Partner strategy

## 26.1 General rule

Partner on:

- distribution;
- infrastructure;
- integration;
- customer access;
- credibility.

Retain control of:

- semantic substrate;
- brand;
- roadmap;
- future product optionality;
- commercial data;
- core IP;
- right to work with competitors.

## 26.2 Disclosure levels

| Level              | Audience                                 | Information                                                                         |
| ------------------ | ---------------------------------------- | ----------------------------------------------------------------------------------- |
| 0 — Public         | Anyone                                   | Released code/docs/API/demos                                                        |
| 1 — Integration    | Potential technical partner              | Existing behavior, public interfaces, integration boundary, high-level architecture |
| 2 — Design partner | Selected customer/partner                | Prototype interfaces and limited future behavior necessary for a concrete use case  |
| 3 — Strategic      | Serious platform/JV/investor negotiation | Controlled commercial architecture/roadmap directly relevant to terms               |
| 4 — Diligence      | Financing/acquisition                    | Staged data room after genuine transaction intent                                   |

### Level 1 -> 2 gate

Require:

- named owner;
- concrete use case;
- need-to-know;
- appropriate confidentiality terms;
- meaningful counterparty commitment.

### Level 2 -> 3 gate

Require:

- real transaction;
- decision-makers;
- credible BATNA;
- counsel review;
- staged disclosure.

An NDA is **not** permission to dump the roadmap.

---

# 27. Specific partner sequencing

## 27.1 Existing real users/design partners — now

Highest information value and usually lower appropriation risk.

Goals:

- exact use cases;
- production pain;
- reasons they chose SignalTree;
- repeatability;
- permissioned quotes/case studies;
- support/migration willingness to pay.

## 27.2 Framework/ecosystem advocates — around v15/demo

Goal:

- distribution;
- category credibility;
- adapter ecosystem.

## 27.3 Vercel / AI SDK-style ecosystem — after working agent-state demo

Potential fit:

> AI tooling knows what the agent executed. SignalTree can try to explain what that execution caused application state to become.

Disclosure:

- integration contract;
- provider-neutral demo;
- not full Relay/Audit roadmap.

## 27.4 Cloudflare — later than originally considered

Why Cloudflare may fit:

- stateful/distributed infrastructure can plausibly underpin a Relay service;
- SignalTree should not reinvent basic global compute/networking/storage machinery.

Why Cloudflare is risky:

- infrastructure overlap means it may be capable of moving upward;
- a generic idea/architecture pitch gives the larger platform more leverage;
- terms on generic submission/feedback channels must be reviewed before sharing unpublished technical material.

Recommended timing:

> working Relay prototype + real customer pull + multiple hosting alternatives.

Pitch:

> SignalTree has a workload and is evaluating infrastructure.

Not:

> Please tell us if our distributed-state idea is good.

## 27.5 OpenAI / Google / Anthropic

Approach after:

- agent accountability chapter works;
- same SignalTree demo can swap model providers.

Goal:

- official integration/reference implementation;
- distribution;
- category legitimacy.

Avoid dependency on any one provider.

## 27.6 AWS / Azure / GCP / other hyperscalers

Approach after:

- 2–3 Relay design partners/pilots;
- clear managed-service need.

Then the pitch is:

> Customers want this. Help us distribute/host/co-sell.

## 27.7 Direct state-management incumbents

Do not privately brief the full commercial architecture while SignalTree lacks category leverage.

They can consume public contracts like everyone else.

---

# 28. Partner rights SignalTree should not casually grant

Avoid by default:

- broad exclusivity;
- rights of first refusal over financing/acquisition/future products;
- broad MFN;
- roadmap veto;
- ownership of improvements;
- rights to future inventions;
- automatic IP license attached to investment;
- exclusive cloud deployment;
- exclusive AI-model integration;
- perpetual free commercial rights;
- broad sublicensing;
- right to create a competing managed offering from confidential material.

If exclusivity is ever considered:

- narrow field;
- narrow geography;
- narrow product;
- finite term;
- minimum financial commitment;
- termination rights;
- meaningful compensation.

Transactions remain modular:

> investment != IP license  
> cloud relationship != equity  
> integration != roadmap rights  
> acquisition discussion != unrestricted technical access

---

# 29. Negotiating power

SignalTree’s leverage equation:

```text
technology
+ public provenance
+ production usage
+ revenue
+ proprietary operations
+ customer relationships
+ category recognition
+ multiple provider alternatives
+ multiple financing alternatives
+ credible independence
= negotiating power
```

Not:

```text
great architecture = negotiating power
```

### BATNA requirements

Before a deep strategic negotiation, try to preserve:

- more than one cloud option;
- more than one AI-model integration;
- more than one enterprise customer;
- more than one design partner;
- more than one financing path;
- ability to remain independent.

---

# 30. Talent, key-person, and execution resilience

A well-funded incumbent can attack without copying code by:

- hiring key people;
- generating narrative pressure;
- forcing the founder into legal/PR distraction;
- outspending on recruiting;
- using customer FUD.

Defenses:

- document critical architectural invariants;
- document release procedures;
- document customer commitments;
- maintain operational playbooks;
- create credential recovery/succession;
- use least privilege;
- use appropriate IP/confidentiality agreements;
- give key contributors meaningful ownership/upside where appropriate;
- separate teachable company knowledge from need-to-know proprietary knowledge;
- pre-designate who handles legal/narrative escalation so engineering continues.

---

# 31. Anti-capture architecture

The product should itself reduce strategic capture risk.

- Public client state should remain exportable in ordinary formats.
- Commercial value should come from semantics, operation, evidence, and service—not artificial hostage lock-in.
- Relay’s client contract should become sufficiently documented/versioned for customer trust when it exists.
- Relay’s server implementation may remain proprietary.
- Do not hard-code one cloud’s semantics into the public SignalTree contract.
- Use standard cryptographic primitives for verification where practical.
- Keep public provenance in multiple independent archives.
- Preserve the right to serve competitors unless a narrowly paid exception is justified.
- No partner-specific extension becomes mandatory for normal SignalTree use without strategic review.

---

# 32. Revised business model

The free developer layer is a **distribution engine**.

Revenue comes from:

- reducing incident/debugging cost;
- reducing causal instrumentation gaps;
- reducing distributed-state operational complexity;
- supporting adoption/migration;
- independently retaining high-value causal evidence;
- proving evidence integrity;
- eventually governing agent-to-state consequences.

---

# 33. Commercial readiness vs economic ceiling

The latest code-level audit exposes an important asymmetry: the products with the largest modeled ACVs are the least implemented.

Do not confuse **potential ceiling** with **current sellability**.

| Layer                    | Current readiness                    | Current credible value                                              | Conditional ceiling |
| ------------------------ | ------------------------------------ | ------------------------------------------------------------------- | ------------------- |
| **Enterprise Adoption**  | Highest                              | Migration, architecture, support around existing v15 semantics      | Medium              |
| **Studio semantic core** | Medium                               | Authored vs realized, restoration, causal/local state investigation | Medium              |
| **Actor-aware Studio**   | Low / attribution owner unresolved   | “Who/what caused this?” across identity/business context            | High                |
| **Relay**                | Low / product hypothesis             | Remote realization and future cross-runtime preservation            | High                |
| **Audit**                | Very low / evidence model incomplete | Independent retained causal evidence                                | High                |
| **Verified Audit**       | Very low                             | Integrity of retained evidence                                      | High                |
| **Agent governance**     | Very low                             | Agent/tool/approval/authority accountability                        | Potentially high    |

### Readiness rule

High prices in this dossier are **future WTP hypotheses**, not signals that those products are close to ship.

The near-term revenue plan should be weighted toward:

1. Enterprise Adoption;
2. paid causal-state pilots;
3. Studio capability that maps to semantics already implemented;
4. only then higher-ACV distributed/audit products after the missing attribution/evidence layers are proven.

---

# 34. Revised pricing hypotheses

These are **internal hypotheses only**.

They should not be presented publicly as established market pricing until real transactions exist.

## Current operating economics

Only three questions govern the next allocation of effort:

1. Can SignalTree close a $15k–$30k one-workflow causal-state pilot?
2. Does that pilot reveal recurring local/production investigation demand?
3. Will the same buyer fund Studio or support after the pilot?

Enterprise Adoption, pilots, and Studio semantic core are the operating plan.
Every other price below is option valuation, not quota or roadmap input.

| Product                           |                                                                                 Revised internal pricing hypothesis |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------: |
| Enterprise assessment/workshop    |                                                                                                          $7.5k–$15k |
| Causal-state pilot                |                                                                                                           $15k–$30k |
| Migration/architecture engagement |                                                                                                           $25k–$50k |
| Annual enterprise support/LTS     |                                                                                                          $25k–$75k+ |
| Studio Team                       |                                                            ~$10k–$25k/year, after recurring team workflow is proven |
| Studio Production                 |                                                            ~$25k–$75k/year, after production causal value is proven |
| Studio Enterprise                 |                                             ~$75k–$150k+/year, contingent on richer cross-runtime/attribution value |
| Relay design partner              |                                                 ~$20k–$40k/year, only after incremental Relay value is demonstrated |
| Relay production                  |                                ~$50k–$150k/year, conditional on causal-semantic differentiation from commodity sync |
| Relay high-consequence enterprise |                                                                            ~$150k–$300k+/year, long-term hypothesis |
| Audit                             |         ~$75k–$200k/year, **not current-readiness pricing**; requires actor/authority evidence model and buyer pull |
| Verified Audit                    |                                                            ~$150k–$400k+/year, **long-term conditional hypothesis** |
| Agent accountability/governance   | Bundled/attach initially; potentially ~$50k–$200k+ only after actor/authority ownership and buyer budget are proven |

### Pricing thesis change

The old Relay model assumed roughly commodity-to-mid-market hosted sync pricing.

The new thesis is:

> **If Relay is truly differentiated causal infrastructure, it should eventually command enterprise infrastructure value materially above commodity realtime pricing.**

If it cannot, the product may not have created enough differentiation.

---

# Appendix A — Speculative portfolio and revenue scenarios

The detailed portfolio compositions below are retained for scenario planning,
not operating decisions. They must not influence product sequencing before paid
pilot and recurring Studio evidence exists.

# 35. Revised revenue projections

## 34.1 Previous model

Earlier scenario planning approximately modeled:

| Stage              | Old modeled ARR |
| ------------------ | --------------: |
| Early traction     |          ~$168k |
| Product-market fit |         ~$1.56M |
| Strong adoption    |         ~$8.56M |

The earlier strong-adoption scenario relied heavily on Relay volume at relatively modest per-organization pricing.

## 34.2 Why the model changed

Updated landscape analysis shows that:

- generic sync is already competitive;
- collaboration is already competitive;
- tracing is already competitive;
- audit/event history is already competitive.

Therefore SignalTree should target fewer, more consequential enterprise deployments at higher ACV **if** the causal-state wedge proves real.

This lowers confidence in a broad commodity Relay path but raises conditional enterprise ACV.

## 34.3 Revised outcome ranges

| Commercial outcome            |      Year 1 |      Year 3 |      Year 5 |
| ----------------------------- | ----------: | ----------: | ----------: |
| **Thesis weak / OSS niche**   |    $0–$100k | $200k–$600k | $500k–$1.5M |
| **Causal “Why?” wedge works** | $100k–$250k |   $750k–$2M |     $2M–$6M |
| **Enterprise platform PMF**   | $150k–$300k |     $2M–$4M |    $7M–$15M |
| **Category breakout**         | $200k–$400k |     $3M–$6M |  $20M–$40M+ |

These are **strategic scenarios, not forecasts**.

## 34.4 Current central planning case — conditional

Conditional on:

- `STATE-WHY-0` green;
- `MIGRATION-WEDGE-0` green;
- enterprise willingness to pay;
- Studio/Relay/Audit coherence;

a central planning case is approximately:

**Composition warning:** Year 1–2 should be assumed to come mainly from Enterprise Adoption, pilots, support, and possibly early Studio. Relay/Audit/Verified Audit should not be relied on for the early plan until their prerequisites close.

| Year   | ARR planning range |
| ------ | -----------------: |
| Year 1 |        $150k–$250k |
| Year 2 |          $500k–$1M |
| Year 3 |          $1.5M–$3M |
| Year 4 |          $3.5M–$7M |
| Year 5 |           $7M–$12M |

## 34.5 Example $10M ARR composition

One possible portfolio:

| Revenue stream              | Customers | Avg annual revenue |        ARR |
| --------------------------- | --------: | -----------------: | ---------: |
| Enterprise support/adoption |        30 |               $40k |      $1.2M |
| Studio                      |        40 |               $60k |      $2.4M |
| Relay                       |        20 |              $100k |      $2.0M |
| Audit                       |        15 |              $140k |      $2.1M |
| Verified Audit              |         6 |              $250k |      $1.5M |
| Agent/policy attach         |         — |                  — |      $0.8M |
| **Total**                   |         — |                  — | **$10.0M** |

These are not necessarily 111 distinct organizations because products can attach.

Example multi-product customer:

```text
Studio   $60k
Relay   $100k
Audit   $140k
Support  $40k
--------------
ACV     $340k
```

## 34.6 Example category-winner model

Illustrative 100-customer mix:

```text
40 customers x $50k   = $2.0M
30 customers x $150k  = $4.5M
20 customers x $275k  = $5.5M
10 customers x $400k  = $4.0M
--------------------------------
                         $16.0M ARR
```

This is a scenario, not a target claim.

---

# 36. Revenue interpretation

The updated distribution is more bimodal than the earlier thesis.

SignalTree is less attractive as:

> a pleasant $2k/month synchronization vendor.

It may become either:

### Smaller outcome

- useful OSS project;
- support/migration company;
- modest Studio product;
- ~$0.5M–$3M ARR range.

### Larger outcome

If the state-causality thesis closes:

- enterprise debugging/observability;
- distributed causal preservation;
- independent evidence retention;
- agent accountability;
- six-figure enterprise ACVs;
- ~$5M–$15M validated platform;
- potentially $20M–$50M+ category winner.

The high ceiling should **not** be used to justify building all products before the core wedge is proven.

---

# 37. Success probability discussion

Earlier subjective planning estimates evolved as evidence changed.

These were never forecasts.

### Before real production-use signals

Approximate subjective estimates discussed:

- meaningful production interest: 50–65%;
- $100k+ ARR: 35–45%;
- $500k–$2M sustainable business: 20–30%;
- $3M–$10M: 8–15%;
- $10M+: 3–7%;
- “commercially meaningful business”: ~30%.

### After private real-world usage signals

Private signals discussed included:

- real enterprise Angular/React usage;
- an individual using another SignalTree version inside a major aerospace environment;
- prior production software built around an early SignalTree version.

These signals de-risked “will serious software be built with SignalTree?” but did **not** prove commercial willingness to pay.

Revised subjective ranges discussed:

- meaningful real-world adoption: 75–85%;
- $100k+ ARR: 45–60%;
- $500k–$2M: 30–40%;
- $3M–$10M: 12–20%;
- $10M+: 5–10%;
- commercially meaningful business: ~40–45%.

### Important public-claim restriction

Do **not** state that a famous organization “uses SignalTree” merely because one engineer uses it without organizational authorization.

Use precise, permissioned language.

### Landscape correction

The more recent competitive analysis narrows the path:

- lower confidence in commodity Relay;
- higher potential ACV if causal explanation/distributed semantic preservation is proven.

Therefore the probability distribution is now more **bimodal**.

No new precise probability should be frozen until `STATE-WHY-0` and `MIGRATION-WEDGE-0` run.

---

# 38. Commercial stage gates

## Stage 0 — prove the semantics currently implemented

Required:

- run `STATE-SEMANTICS-0`;
- run `MIGRATION-WEDGE-0`;
- make the `PAID-PILOT-0` ask;
- keep the first demo question inside semantics the product actually carries.

## Stage 1 — prove value

Required:

- credible v15;
- one-workflow causal demo;
- `STATE-SEMANTICS-0` green;
- `MIGRATION-WEDGE-0`;
- first paid adoption engagements;
- attribution/full `STATE-WHY-0` only if customer evidence requires it.

## Stage 2 — prove repeatability

Required:

- 3–5 paying organizations;
- repeated production trace demand;
- repeatable migration path;
- Studio pilot(s).

## Stage 3 — choose scale product

### Studio-led

If `A << B ≈ C`, then Studio is the main commercial wedge and Relay remains optional.

### Relay-led

If `A < B << C`, then distributed semantic preservation becomes a primary infrastructure bet.

### Audit-led

If high-value customers care most about independent retained evidence, Audit may outrun Relay.

Do not force the product sequence to match the original conceptual ladder.

---

# 39. Twelve-month scorecard

| Metric                                |                            Target / gate | Meaning                                                                          |
| ------------------------------------- | ---------------------------------------: | -------------------------------------------------------------------------------- |
| Independent serious organizations     |                                    10–20 | Core market validation                                                           |
| Permissioned/sanitized case studies   |                                       3+ | Production credibility                                                           |
| Paying enterprise customers           |                                      3–5 | Commercial validation                                                            |
| `STATE-SEMANTICS-0`                   | Decisive semantic advantage over control | Proves value of currently implemented authored/realized/restoration distinctions |
| `MIGRATION-WEDGE-0`                   | Useful trace without backend replacement | Brownfield thesis                                                                |
| `PAID-PILOT-0`                        |            One qualified paid engagement | Commercial outcome, not demo interest                                            |
| `ATTRIBUTION-OWNER-0`                 |                Opened only when demanded | Prevents roadmap pressure from contaminating kernel                              |
| `STATE-WHY-0`                         |       Decisive B > A after prerequisites | Optional full actor-aware thesis                                                 |
| Qualified production-trace requests   |                                       5+ | Studio pull                                                                      |
| Independent Relay pain confirmations  |                                       3+ | Relay discovery                                                                  |
| Paid Relay pilots                     |                  2+ and C materially > B | Relay investment threshold                                                       |
| Qualified audit/retention discussions |                                       3+ | Audit discovery                                                                  |
| Paid Audit design partner             |                                       1+ | Audit build threshold                                                            |
| Meaningful non-Angular use            |                                      Yes | Framework-independence market proof                                              |
| Strategic partner second meetings     |                                 Multiple | Leverage without over-disclosure                                                 |

---

# 40. 90-day execution sequencing

A perfect protection system attached to an unshipped product is not a moat.

## Days 0–30 — close RC issues and prepare the experiment

### P0 — engineering

- ship the bounded RC package/DX corrections;
- build an unpublished local causal-investigation instrument over existing
  semantics;
- define the strong conventional control and one consequential incident;
- do not reopen the v15 API to make the experiment convenient.

### P0 — IP/ownership

- counsel-led disclosure audit;
- ownership/relicensing review;
- trademark review;
- contributor IP review;
- trade-secret candidate review;
- narrow patentability review where justified.

### P0 — licensing

- Apache-2.0 is already published for RC1;
- obtain bounded counsel/ownership/trademark review;
- do not make licensing another architecture phase.

### P0 — asset boundary

Classify:

- public;
- publish later;
- confidential;
- trade-secret candidate;
- proprietary service.

### P0 — truthful claims

Verify:

- production-use claims;
- framework-independence claims;
- shipped vs north-star capabilities;
- benchmark claims;
- release status.

### P1 — provenance

Preserve the signed/tagged source, npm/GitHub artifact hashes, release evidence,
and basic attribution. Do not build a provenance platform before customer proof.

## Days 31–60 — semantic and migration proof

- run `STATE-SEMANTICS-0`;
- run `MIGRATION-WEDGE-0` in the same brownfield workflow;
- Enterprise Adoption offer;
- recruit serious evaluators/design partners.

## Days 61–90 — sell and falsify

- make the paid $15k–$30k pilot ask;
- test conversion to recurring Studio/support spend;
- open `ATTRIBUTION-OWNER-0` only if real investigations demand it;
- track Relay/Audit demand without building them;
- build deeper Relay only if distributed preservation repeatedly creates
  additional measured value.

---

# 41. Release blockers vs non-blockers

## True GA blockers

- actual package/release architecture;
- clean framework-neutral package boundary;
- ownership/relicensing clarity;
- final license decision;
- public/private asset boundary;
- minimum credible provenance;
- truthful public claims;
- release gates;
- packed-consumer proof;
- production-consumer proof;
- API freeze.

## Not GA blockers

Do not delay GA for:

- complete Relay;
- complete Studio;
- complete Audit;
- full provenance platform;
- broad strategic partnership network;
- large advisory board;
- verified audit infrastructure;
- complete agent governance product.

---

# 42. Capital strategy

Raise capital to accelerate proven pull, not to substitute for evidence.

Preferred sequence:

1. bootstrap v15 release and experiments where feasible;
2. use Enterprise Adoption revenue to fund discovery;
3. raise when demand exists but execution/security/sales capacity is the bottleneck;
4. consider defensive acceleration if a larger incumbent enters after real traction;
5. prefer investors that improve recruiting, enterprise sales, infrastructure alternatives, or category reach without demanding strategic capture rights.

---

# 43. Core moat thesis

The moat is not one technical trick.

It is intended to compound across:

```text
SignalTree category / trademark
+ canonical semantic model
+ production adoption
+ public provenance
+ framework integrations
+ Studio
+ Relay
+ Audit
+ private operational knowledge
+ private adversarial corpus
+ customer causal data/history
+ enterprise contracts
+ support reputation
+ integration ecosystem
+ multiple strategic alternatives
```

A competitor can copy individual boxes.

The business succeeds if copying public code does **not** copy the economic asset.

---

# 44. What is easy to copy

Assume these are not durable moats:

- causal IDs;
- “Why?” UI;
- actor metadata;
- local history;
- stable references as a feature;
- a state timeline;
- WebSocket sync;
- offline catch-up;
- append-only logs;
- basic audit;
- approval flows;
- agent IDs;
- session replay;
- public semantic vocabulary by itself.

---

# 45. What may be harder to copy

Potentially compounding assets:

- canonical state-semantic model;
- real enterprise migration experience;
- automatic instrumentation coverage;
- production failure corpus;
- cross-runtime causal query/indexing;
- managed Relay reliability;
- retained causal evidence;
- customer history/data;
- operational runbooks;
- case studies;
- partner integrations;
- category mindshare;
- reputation;
- enterprise relationships;
- support and trust;
- multi-product attachment.

These are still **hypotheses** until accumulated.

---

# 46. Strongest arguments against SignalTree

An antagonistic reviewer should explicitly test these.

## 46.1 “This is just event sourcing plus frontend telemetry”

Possible.

SignalTree must prove that application-state semantics and brownfield adoption create a materially better outcome.

## 46.2 “OpenTelemetry already gives causality”

OTel gives distributed execution context.

SignalTree must prove that state consequences, authored-vs-realized semantics, subject lifetime, optimistic state, and restoration create additional practical value.

## 46.3 “Backend audit already answers who changed what”

For thin clients, yes.

SignalTree should lose those customers.

## 46.4 “Liveblocks/Zero/Electric already solve Relay”

If Relay is generic sync, yes.

SignalTree must prove a different product or stop building Relay.

## 46.5 “Redux/NgRx can add the same DevTools feature”

They can likely copy visible features.

SignalTree must make the value depend on deeper semantics and commercial operations.

## 46.6 “A large incumbent can fork or reimplement the open kernel”

Correct.

The business cannot rely on public kernel scarcity.

## 46.7 “Restrictive licensing would fix that”

Maybe, but it can kill adoption and category formation.

`PROTECT-LICENSE-0` exists to avoid ideological licensing.

## 46.8 “The category is invented marketing”

Possible.

`CATEGORY-0` should prove whether third parties adopt the vocabulary.

## 46.9 “Customers will not migrate state architecture for debugging”

Possible.

`MIGRATION-WEDGE-0` is existential.

## 46.10 “Six-figure ACVs are unrealistic”

Possible.

All prices remain hypotheses until actual enterprise deals exist.

## 46.11 “The current flagship control may know _who_ while SignalTree does not”

If the advisory code audit is correct, a strong JWT/backend-audit control can identify the authenticated principal while the current kernel carries only coarse intent/origin/correlation metadata.

That means an actor-heavy `$375,000 Exception` comparison could make SignalTree lose for an **implementation-gap reason** rather than falsify the deeper state-semantic thesis.

Therefore:

- run `STATE-SEMANTICS-0` first;
- do not ask “who approved this?” until the tested SignalTree stack actually preserves actor/authority context;
- do not fix the gap by reflexively adding identity concepts to the kernel.

---

# 47. Stop conditions

The company should be willing to stop or radically change components.

## Stop/narrow Relay if

- `STATE-WHY-0` does not show distributed incremental value;
- buyers price-compare it only to generic sync;
- 3+ qualified prospects do not show repeated pain;
- paid pilots cannot be obtained.

## Stop/narrow Studio if

- production causal explanation is not recurring;
- engineers are satisfied with existing observability;
- “Why?” is demo-cool but not economically important.

## Stop/narrow Audit if

- backend/event audit is sufficient;
- compliance/security buyers do not value independent causal evidence;
- no paid design partner appears.

## Change licensing if

- Apache creates a specific material commercial threat that a different structure can reduce without blocking adoption;
- or a defensive license repeatedly blocks credible adoption.

## Change category if

- “Causal Application State” does not travel;
- it confuses buyers;
- it cannot be demonstrated without north-star capabilities.

## Change business thesis if

- `STATE-WHY-0` fails;
- `MIGRATION-WEDGE-0` fails.

---

# 48. Audit-ready claim register

| Claim                                                                         | Class                  | Current status                                                      | Required proof                                                   |
| ----------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------- |
| v15 separates authorship from realization                                     | OBSERVED               | Engineering evidence exists                                         | Permanent conformance / release gate                             |
| subject identity differs from address                                         | OBSERVED               | Engineering evidence exists                                         | Permanent conformance                                            |
| Link is strong relationship boundary                                          | OBSERVED               | Frozen engineering contract                                         | Packed/release proof                                             |
| causal record includes actor identity / approval / authorization context      | OPEN / NOT IMPLEMENTED | RC1 source has no actor/principal/agent/authority identity contract | demand-triggered `ATTRIBUTION-OWNER-0` + end-to-end conformance  |
| framework-neutral packed kernel has no Angular runtime/declaration dependency | OBSERVED               | RC1 package closure and clean consumers are green                   | retain package-neutrality gates                                  |
| “Causal Application State” is a useful category                               | HYPOTHESIS             | Not market-proven                                                   | `CATEGORY-0`                                                     |
| Current SignalTree semantics improve a state investigation                    | HYPOTHESIS             | Not proven                                                          | `STATE-SEMANTICS-0`                                              |
| SignalTree explains actor-aware state better than conventional stack          | HYPOTHESIS             | Deferred                                                            | full `STATE-WHY-0` after attribution is demanded and implemented |
| Brownfield migration is cheap                                                 | HYPOTHESIS             | Not proven                                                          | `MIGRATION-WEDGE-0`                                              |
| Semantic instrumentation reduces gaps                                         | HYPOTHESIS             | Not proven                                                          | `INSTRUMENTATION-COVERAGE-0`                                     |
| Studio is enterprise software                                                 | HYPOTHESIS             | Not proven                                                          | `STUDIO-WTP-0`                                                   |
| Relay preserves differentiated causal semantics                               | HYPOTHESIS             | North star                                                          | `RELAY-VALUE-0`                                                  |
| Relay can command $50k–$150k+                                                 | PRICING HYPOTHESIS     | Not proven                                                          | paid pilots/contracts                                            |
| Audit can command high ACV                                                    | PRICING HYPOTHESIS     | Not proven                                                          | security buyer evidence                                          |
| Verified Audit has $150k–$400k+ value                                         | PRICING HYPOTHESIS     | Not proven                                                          | buyer requirement + deals                                        |
| Apache is optimal                                                             | STRATEGIC BASELINE     | Open to evidence                                                    | counsel + `PROTECT-LICENSE-0`                                    |
| incumbents can copy public ideas                                              | STRATEGIC ASSUMPTION   | Deliberately conservative                                           | threat model, not proof claim                                    |
| public provenance improves negotiating power                                  | INFERENCE              | Plausible                                                           | `PROVENANCE-0` + market use                                      |
| product portfolio can exceed $10M ARR                                         | SCENARIO               | Not forecast                                                        | customer count x ACV evidence                                    |

---

# 49. Decision record template

Every major closure should record:

```yaml
decision_id:
property_or_question:
threat_or_failure_mode:
evidence:
evidence_class:
strongest_counterargument:
falsifier:
decision:
non_claims:
public_disclosure:
private_material:
reopen_trigger:
owner:
date:
```

Do not silently rewrite earlier strategy after new evidence.

Preserve:

- prior hypothesis;
- why it was plausible;
- what falsified it;
- new decision;
- what remains unknown.

---

# 50. Source register

The following source artifacts informed this dossier.

## Engineering / methodology

- `SignalTree_v15_Engineering_Whitepaper_v3(1).md`
- `SignalTree_v15_Engineering_Whitepaper_v3(1).docx`
- `SignalTree_v15_Engineering_Whitepaper_v3(1).pdf`
- `Adversarial_Discovery_and_Solidification_Protocol_v1.1(1).md`
- `Adversarial_Discovery_and_Solidification_Protocol_v1.1(1).docx`
- `Adversarial_Discovery_and_Solidification_Protocol_rulebook_v1.1(1).yaml`
- `SignalTree_v15_ADSP_Case_Study_v1(1).docx`

## Product / commercial planning

- `SignalTree_v15_Unified_Demo_and_Demo_Portfolio.docx`
- `SignalTree15 - Persistence Capability Ruling(1).pdf`
- `Signaltree-monetization(1).pdf`
- `Analyze Monetization Ideas.txt`
- `SignalTree_Protection_and_Commercialization_Plan_v0.1.docx`
- `SignalTree_Protection_and_Commercialization_Plan_v0.2.docx`
- `SignalTree_v15_Project_Directives_v0.4.md`

## Current-session operational evidence

- user-provided release-gate/status transcript showing `63/66` release gates with three failures and subsequent triage notes;
- user-provided code-level commercial audit dated 2026-08-30 reporting the current `WriteMetadata`, restoration-history shape, absence of actor/authority identity concepts in `packages/kernel/src`, and packed-kernel framework-neutrality result. These findings are treated as **ADVISORY CODE AUDIT** until independently reproduced.

## External market facts previously used in session

The session referenced current/official materials for:

- JWT / RFC 7519;
- OpenTelemetry context propagation;
- Datadog RUM/APM;
- Kurrent/EventStore event sourcing;
- Liveblocks collaboration/storage;
- Zero sync;
- Electric sync;
- Convex realtime backend;
- Temporal workflows;
- Cloudflare Developer Platform / partner programs;
- Vercel AI SDK / technology partnerships;
- OpenAI partner network.

**Audit instruction:** re-verify all external/time-sensitive facts at the time of review. Do not treat this dossier as a permanent market database.

---

# 51. Private evidence register

The strategy has discussed real-world usage signals that materially improve confidence that serious applications can be built with SignalTree.

These signals should be tracked internally with exact, permissioned wording.

At least some are **not currently safe to convert into organizational logo claims**.

For every private usage signal record:

```yaml
organization_or_context:
individual_contact:
signal_tree_version:
production_or_experiment:
frameworks:
scope:
what_problem_it_solves:
duration:
permission_to_name_org:
permission_to_quote:
case_study_status:
public_claim_allowed:
next_follow_up:
```

Do not say “Company X uses SignalTree” unless organizational attribution is accurate and authorized.

---

# 52. Questions an antagonistic AI must answer

A serious audit should finish with explicit answers to these questions.

## Product

1. What is the strongest non-SignalTree stack that can reproduce the `Why?` outcome?
2. Which SignalTree semantics are actually necessary for the outcome?
3. Which semantics are elegant but economically irrelevant?
4. Can the outcome be obtained with a library/plugin rather than a new state architecture?
5. Does SignalTree need to own client state to produce the value?
6. Can OTel + backend audit + frontend instrumentation produce 80–90% of the value?
7. Is “authored vs realized” understandable and valuable to buyers?
8. Does subject lifetime identity produce measurable business value or only engineering correctness?
9. What is the smallest high-value `Why?` question the **current** kernel can answer without actor/authority attribution?
10. Where should actor identity and approval/authorization context live if not in the kernel?

## Code-to-commercial alignment

11. Is the advisory actor/authority gap reproducible in the current repository?
12. Does current DevTools/debug-session export retain enough write metadata to support Studio’s semantic-core promise?
13. Is `correlationId` retained through the paths Studio would inspect?
14. Can actor/authority attribution be attached outside the kernel without losing causal linkage?
15. Does restoration history need to become a causal evidence model, or should Audit consume a different stream entirely?
16. Which downstream commercial claims are blocked until that ownership question closes?

## Migration

17. How many lines/services must change for a pilot?
18. Can SignalTree wrap an existing Redux/NgRx/Zustand application incrementally?
19. Can SignalTree work with Java/.NET/Node backends without new platform infrastructure?
20. Can a team get value before Relay?
21. Does framework neutrality materially reduce migration risk?

## Competition

22. What competitor is closest to SignalTree’s proposed state-consequence model?
23. Which competitor could add the feature fastest?
24. Which competitor has the most dangerous distribution advantage?
25. Which competitor can bundle it free?
26. Which incumbent has the strongest incentive to subsume the category?

## Moat

27. What remains if the kernel is legally cloned tomorrow?
28. What remains if Studio’s UI is copied?
29. What remains if a competitor markets “causal state” first?
30. How long would it take a 30-engineer team with AI to recreate Relay?
31. Which assets compound with every customer and cannot be copied from GitHub?

## Licensing

32. Does Apache materially increase probability of category formation?
33. Would MPL materially deter the most likely appropriation path?
34. Would source-available terms block enterprise procurement?
35. Does SignalTree have relicensing rights over all relevant code?
36. Are there already-public disclosures that eliminate trade-secret/patent options?

## Monetization

37. Who owns the Studio budget?
38. Who owns the Relay budget?
39. Who owns the Audit budget?
40. What existing budget line is displaced?
41. Is $50k+ Relay ACV realistic compared with alternatives?
42. Does Studio sell without Relay?
43. Does Audit sell without Relay?
44. What is the minimum product that can close a $25k annual contract?
45. How many customers are required to reach breakeven under realistic staffing/security costs?

## Partners

46. Which partners add distribution without becoming direct substitutes?
47. What information can each partner infer from public artifacts already?
48. What information should never be placed in a generic partner/contact form?
49. What partner right would create the most damaging capture?
50. What alternative partner prevents dependency?

## Protection

51. Can an independent third party verify SignalTree chronology?
52. What key ideas are already public?
53. What remains proprietary?
54. What should be defensively published?
55. What should remain undisclosed?
56. What should counsel evaluate before the next major release?

## Execution

57. What are the true GA blockers?
58. Which strategy tasks are distracting from shipping?
59. Which release gates are currently blind/stale?
60. Is founder/key-person risk acceptable?
61. What work must be delegated if a competitor dispute begins?

---

# 53. Audit output format

An antagonistic AI reviewing this dossier should produce:

## A. Verdict

One of:

- **GO**
- **GO, NARROW THESIS**
- **GO, CHANGE MONETIZATION**
- **GO, CHANGE LICENSING**
- **DEFER COMMERCIAL BUILD — RUN EXPERIMENTS**
- **STOP RELAY**
- **STOP AUDIT**
- **STOP COMMERCIALIZATION / OSS ONLY**

## B. Confidence

0–100%, with explicit reason.

## C. Strongest surviving thesis

One paragraph.

## D. Top 10 falsifiers

Ranked by probability x impact.

## E. Competitor substitution table

For each product layer.

## F. Migration burden estimate

Best case / realistic / worst case.

## G. Pricing challenge

What existing spend/budget could justify the proposed ACVs?

## H. Moat-after-copy analysis

Assume a large incumbent copies every public feature.

## I. Partner capture analysis

Who gains too much leverage?

## J. Licensing recommendation

Based on adoption and appropriation—not ideology.

## K. Experiment priority

Which 3 experiments should happen first?

## L. Kill criteria

What evidence should cause SignalTree to stop spending money on each commercial layer?

---

# 54. Current priority stack

The plan should currently optimize in this order:

1. **Close the bounded RC packaging/DX findings without reopening v15.**
2. **Build an unpublished local causal-investigation instrument over existing semantics.**
3. **Run `STATE-SEMANTICS-0` against a strong conventional control.**
4. **Run `MIGRATION-WEDGE-0` in the same brownfield workflow.**
5. **Make the $15k–$30k `PAID-PILOT-0` ask.**
6. **Test conversion into recurring Studio/support spend.**
7. **Open `ATTRIBUTION-OWNER-0` only if customers materially need “who/under what authority?”.**
8. **Run full `STATE-WHY-0` only when its tested attribution exists end to end.**
9. **Open `RELAY-VALUE-0` only when distributed preservation recurs in real cases.**
10. **Keep Audit, Verified Audit, agent governance, elaborate provenance, and strategic-partner architecture parked until demand earns them.**

---

# 55. Current strategic summary

The strongest current thesis is not:

> SignalTree is the best state library.

It is not:

> SignalTree is the best sync service.

It is not:

> SignalTree is the best audit log.

It is:

> **SignalTree may make consequential client/application state materially easier
> to investigate by preserving authored-vs-realized truth, restoration,
> subject-lifetime, and causal-turn semantics without requiring a backend
> rewrite.**

The company is defensible only if:

1. that outcome is valuable enough to buy;
2. it is cheap enough to adopt;
3. the semantics can be instrumented more reliably than manual alternatives;
4. the initial Studio semantic core becomes a recurring production workflow;
5. commercial operations, customers, data, integrations, and know-how compound faster than competitors can copy public features;
6. protection does not suffocate adoption;
7. no strategic partner becomes the only path to distribution, infrastructure, capital, or credibility.

---

# 56. Change log

## v0.1 — 2026-08-28

- initial consolidated protection/commercialization plan;
- adversarial-incumbent threat model;
- provenance;
- licensing gate;
- product boundary;
- disclosure levels;
- anti-capture;
- copycat response;
- 90-day plan.

## v0.2 — 2026-08-28

- category definition/glossary;
- concrete provenance mechanics;
- tighter license interviews;
- explicit disclosure transition gates;
- talent/key-person resilience;
- prioritized pre-GA decisions.

## v0.3 — 2026-08-29

- narrowed category claim;
- made “how state became true” the commercial promise;
- defined deliberate non-customers;
- added brownfield invariant;
- added `STATE-WHY-0`, `MIGRATION-WEDGE-0`, and `INSTRUMENTATION-COVERAGE-0`;
- made Studio/Relay sibling paths;
- made distributed causal graph a north star rather than shipped claim;
- restored Apache-2.0 as strategic baseline subject to evidence;
- subordinated protection to category formation;
- tightened release-vs-strategy sequencing.

## v0.4 — 2026-08-30

- consolidates the full strategy into Markdown for antagonistic AI audit;
- adds strongest-conventional-stack comparison;
- expands competitive landscape and commodity falsifiers;
- adds `RELAY-VALUE-0`;
- integrates updated monetization and higher-ACV enterprise model;
- adds revised outcome ranges and conditional five-year planning case;
- preserves earlier subjective success-probability discussion as non-forecast history;
- incorporates current release-gate red-status snapshot;
- expands partner sequencing and Cloudflare-risk rationale;
- adds explicit malicious-human/non-litigation defense model;
- adds stop conditions, claim register, private evidence register, audit questions, and mandatory audit output format.

## v0.5 — 2026-08-30

- incorporates the code-to-commercial audit supplied after v0.4;
- narrows the public category so actor/authority attribution is not falsely implied as a current v15 capability;
- records the actor/authority gap as **ADVISORY CODE AUDIT** pending independent reproduction;
- adds `STATE-SEMANTICS-0` before the full actor-aware `STATE-WHY-0`;
- adds `ATTRIBUTION-OWNER-0` to determine where identity/approval/authority belongs without contaminating the kernel;
- changes automatic-instrumentation claims to distinguish earned transition semantics from future attribution enrichment;
- adds commercial-readiness-vs-ceiling discipline;
- makes Enterprise Adoption / semantic-core Studio the near-term revenue base;
- further conditions Relay/Audit/Verified Audit pricing on implementation and buyer evidence;
- updates claim register, 90-day sequence, twelve-month scorecard, source register, and priority stack;
- records advisory evidence that packed-kernel framework neutrality may now be physically achieved, pending release-candidate reproduction.

## v0.6 — 2026-08-30

- records RC1 as live with 66/66 release gates and exact registry-consumer proof;
- adopts **GO, NARROW THESIS**;
- defines authorship without implying identified actor identity;
- separates shipped semantic classification from future attribution enrichment;
- makes `STATE-SEMANTICS-0`, `MIGRATION-WEDGE-0`, and `PAID-PILOT-0` the operating sequence;
- defers attribution, full actor-aware `STATE-WHY-0`, Relay, Audit, Verified Audit, and agent governance until demanded;
- distinguishes Studio semantic core from Studio Cloud;
- permits Studio-only success and explicitly states that Audit may never exist;
- moves detailed portfolio economics behind a speculative appendix boundary;
- limits immediate protection work to ownership, trademark/license review, and basic release provenance;
- records the Angular `sideEffects` RC finding and keeps the v15 API frozen.

---

# Final principle

> **Do not optimize SignalTree to prevent copying. Optimize it so that successful copying validates the category but does not transfer the company.**

Also:

> **Do not monetize a future semantic capability as though the kernel already carries it. Let the implementation, experiment, and buyer evidence earn each expansion of the commercial story.**

And before every irreversible disclosure, license grant, partnership, release, or commercial build:

> **What value does this action create for SignalTree, what value does it transfer to a future competitor, and what evidence says the trade is worth making?**
