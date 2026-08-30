# SignalTree v15 Project Directives v0.4

**Date:** 2026-08-30  
**Status:** RC1 live; public API frozen; commercialization experiments next.

## 1. Current authority

SignalTree `15.0.0-rc.1` is published as:

- `@signal-tree/kernel`
- `@signal-tree/angular`

Candidate source is `4020b7dd`; release evidence is recorded at `22209ecc`.
The release matrix is 66/66 with zero known-red. The package split, packed
consumer, production consumer, framework-neutral kernel, and singular
construction model are closed.

The v15 construction/access surface is not an open design area:

```text
signalTree(initialState, config?)
config.derived: ($) => ({ ... })
tree.$
```

Do not reintroduce a builder, second facade, positional/fluent/staged derived
path, derived tier helper, or duplicate public tree interface without a direct
production falsifier.

## 2. Governing commercial thesis

**GO, NARROW THESIS.**

> SignalTree may make consequential client/application state materially easier
> to investigate by preserving authored-vs-realized truth, restoration,
> subject-lifetime, and causal-turn semantics without requiring a backend
> rewrite.

Authorship means intentional local application work rather than realization,
restoration, or inspection. It does not imply an identified human, principal,
agent, approval, or authorization context.

## 3. Immediate engineering scope

Only bounded RC/GA correctness and DX repairs are permitted before the
commercial experiments. Current known repairs:

- Angular package metadata must preserve structural realization installation;
- emitted public JSDoc must teach singular declarative construction;
- release/status documents must reflect RC1 reality.

Do not reopen kernel semantics or package topology to make experiments easier.
An experiment may use internal diagnostic machinery in an unpublished harness;
that does not earn a public API.

## 4. Experiment order

```text
1. STATE-SEMANTICS-0
2. MIGRATION-WEDGE-0
3. PAID-PILOT-0 / STUDIO-WTP-0
4. ATTRIBUTION-OWNER-0 — only if customer evidence demands it
5. STATE-WHY-0 — only after tested attribution exists end to end
6. RELAY-VALUE-0 — only if distributed preservation recurs in real cases
```

### `STATE-SEMANTICS-0`

Compare a strong conventional control with SignalTree on one consequential
incident involving local authored work, external/server realization,
restoration or rollback, and subject lifetime where relevant.

The control includes competent backend audit, correlation IDs, OpenTelemetry,
frontend telemetry, and ordinary state. Measure correctness, completeness,
time, tools consulted, manual correlation, and confidence.

The scenario must not require actor identity, approvals, agents, Relay, or
cross-runtime attribution.

### `MIGRATION-WEDGE-0`

Run in the same brownfield workflow. Measure time and code touched, backend and
deployment changes, conceptual onboarding, and time to first useful explanation.

Falsifier: useful value requires backend replacement, event-sourcing conversion,
broad application migration, or Relay before the first explanation.

### `PAID-PILOT-0`

Ask a qualified organization to pay roughly $15k-$30k for the demonstrated
one-workflow outcome. Record the recurring workflow, buyer, displaced budget,
success criterion, and path to recurring Studio/support spend.

Interest without a recurring workflow, budget owner, or paid next step is red.

## 5. Product boundaries

Studio semantic core and Studio Cloud are separate bets:

- local causal investigation may prove the category;
- production ingestion, retention, search, collaboration, and administration
  must separately prove recurring software value.

Studio may be the company. Relay may remain optional. Audit and Verified Audit
may never exist. That is success when evidence selects it.

Park until earned:

- actor/principal/agent identity;
- approvals and authorization provenance;
- Relay protocols and distributed journals;
- Audit/Verified Audit;
- agent governance;
- elaborate provenance infrastructure;
- six-figure ACV planning as roadmap input;
- strategic-partner architecture.

## 6. Deliberate non-customers

Lose when a narrower system solves the real problem:

- backend audit for ordinary CRUD accountability;
- event sourcing for a thin client over an event-sourced backend;
- OpenTelemetry/observability for execution tracing;
- Liveblocks/Yjs for collaborative documents;
- Zero/Electric for sync/replication;
- Convex for a new realtime backend;
- ordinary stores/signals for simple UI state.

## 7. Protection and provenance

Apache-2.0 is already published for RC1. Do not turn protection into the next
architecture phase.

Do now:

- bounded counsel review of ownership, trademark, licensing, and disclosures;
- preserve source tag, npm/GitHub artifact hashes, and release evidence;
- maintain factual chronology and permissioned claims.

Defer patents, elaborate provenance systems, partner-defense machinery, and
private roadmap disclosure until customer evidence makes them material.

## 8. Evidence rule

Implementation, experiment, and buyer evidence earn every expansion. Product
roadmaps do not back-propagate requirements into the kernel.
