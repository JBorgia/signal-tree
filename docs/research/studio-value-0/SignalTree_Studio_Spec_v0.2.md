# SignalTree Studio
## Product & Engineering Specification — Revision 0.2

Semantic debugging, state explanation, and AI-assisted investigation for SignalTree.

**Working specification; product thesis under validation.**

---

### Document control

| Field | Value |
|---|---|
| Document | SignalTree Studio — Product & Engineering Specification |
| Version | 0.2 (revised after adversarial review of v0.1) |
| Status | Working specification; product thesis under validation |
| Supersedes | v0.1 (2026-09-08); **redefines the STUDIO-VALUE-0 gate** (see §0, §20) |
| Date | 2026-09-08 |
| Primary product statement | SignalTree is state with semantics. Studio makes those semantics visible, searchable, comparable, and explainable — scoped to the flows where SignalTree actually owns the facts (see §3). |
| Kernel relationship | Studio consumes SignalTree semantics; it must not distort kernel truth to make explanations prettier. |
| AI relationship | AI is optional, user-selected, read-only analysis over Studio evidence; AI is never the source of semantic truth. |
| Goal | **Adoption of SignalTree.** Studio is the means, ships free, and is measured on newcomer onboarding cost (§20.1). No commercial track while that holds (§22.4). |
| Build sequence | v15 substrate → observation seam **built in slices** (§8.5) → each slice gated on the §20 onboarding measure → Relay only if distributed semantics independently earn it. |

**Status discipline**

This document intentionally distinguishes **ESTABLISHED** v15 semantics from
**PROPOSED** Studio behavior. Anything requiring a research-only observation hook
is not yet a shipping Studio capability claim and is labelled `RESEARCH-ONLY` in
this document wherever it appears. The eight-point hardening of §22 is directly
traceable to the adversarial findings recorded in §0.1.

---

### Contents

0. Revision record and lineage
1. Executive summary
2. Product context and decisions
3. Product thesis, positioning, and non-goals
4. Users and jobs to be done
5. Design principles
6. Reference architecture
7. Semantic data model
8. Runtime observation and capture contract
9. Core Studio UX
10. Detailed feature specifications
11. AI architecture and BYO-model integration
12. Semantic query and tool API
13. Invariants, watchpoints, and anomaly analysis
14. Sessions, storage, export, and collaboration
15. Security, privacy, and enterprise controls
16. Packaging and deployment
17. Performance and scalability budgets
18. Reliability, evidence discipline, and testing
19. Feature ranking and roadmap
20. Validation plan — the STUDIO-VALUE-0 gate
21. Future Relay integration
22. Acceptance criteria
23. Open issues and decisions

Appendices — schemas, examples, and API sketches

---

## 0. Revision record and lineage

v0.2 is the response to an adversarial review of v0.1. The review was grounded
against the current 15.0 kernel surface and the repository's existing research
lineage: `docs/research/studio-value-0/` (the frozen incident, questions and scoring),
`TODO.md` §MUTATION-OBSERVABILITY-0 and the "three constraints Studio inherits"
section, and `docs/ADSP/SignalTree_Protection_Commercialization_Adversarial_Audit_v0.6.md`
(falsifier #10: *"if Studio is merely logs, traces, or DevTools with more
metadata, the thesis is weak"*).

### 0.1 Findings and dispositions

| # | Finding (v0.1 review) | Disposition in v0.2 |
|---|---|---|
| F1 | Wedge overstated: "why is this value here" is usually answered by single-writer correlation, which a competent control wins. Differentiation survives only in *distributed-responsibility* flows: multi-write atomic parcels, authored→realized handoffs, non-atomic later overwrites. | §3 reframes the wedge. Flagship demo and validation score distributed-responsibility cases like-for-like. |
| F2 | v0.1 replaced the STUDIO-VALUE-0 gate without engaging it; validation discipline invalidated. | §0, §20: the gate is **engaged and kept binding**, with the yardstick changed on the record — Studio is scored against the best alternative buildable on SignalTree itself — the shipped-API path (§20.2) — rather than against a rival framework's tooling (§20.1). The stop condition survives the change. |
| F3 | Feasibility scores overstated on every feature that inherits the unshipped observation seam (#6, #8, #9, #11, #13), and understated where the kernel already ships the fact (#5). | §19 table corrected; seam given its own roadmap row; #5 reframed as projection of shipped kernel semantics. |
| F4 | No roadmap item earns the observation seam itself before any P0 feature. | §8.5 adds **Phase 0**: seam + adversarial mutation-matrix gate (C11, C14). §22.1 made conditional on it. |
| F5 | MVP could not demo the headline cart-88213 story (invariants/realization not in MVP). | §19.2 adds realization/origin view (already shipped kernel facts) and Studio-level invariant *evaluation* to MVP; "first-violating-event" linkage ships when the seam lands. |
| F6 | Acceptance criteria non-measurable or self-contradictory (22.1.1). | §22 rewritten: assertable budgets, reproducible DERIVED, structurally distinct INFERENCE/UNKNOWN, measurable overhead, hard commercial gate. |
| F7 | Narrative moat thinner than claimed: kernel already ships a narrative hook (`audit` `metadata.description`); kernel also ships a Redux-DevTools adapter via `devTools()`. | §3 and §8.4 record both facts honestly. Moat rests on the semantic layer, explicitly not on absence of actions. |
| F8 | v3 validation has no exposure decision; v3 is an employer codebase. | The v3 track is withdrawn; the gate runs on the purpose-built fixture only (§20.3). Evidence hash-and-freeze before investigation is retained (§20.4). |
| F9 | Review bibliography absent; provenance falsification uncredited. | Lineage credited in §2.1 and §20. |

### 0.2 Relation to prior research

- **STUDIO-VALUE-0 (`README.md`):** the gate for the wedge — the frozen Cart
  88213 incident, its eight questions, the two trap questions Studio must fail
  honestly (Q4, Q7), and the scoring. **Adopted verbatim.** The incident is the
  distributed-responsibility flow the wedge is defined on, and it is
  paradigm-neutral: it is a property of the application's state history, not of
  any framework's representation of it.
- **Yardstick, changed on the record (2026-09-08):** Studio is scored against
  **the best alternative buildable on SignalTree without Studio** — the cheap
  shipped-API path (`devTools()`, `exportDebugSession()`, `audit`
  `metadata.description`) a competent developer already has for free (§20.2).
  Not against a rival framework's tooling: that would anchor Studio's design to
  a model SignalTree deliberately does not share, and let the rival's
  representation define success. The substrate-native baseline is the harder
  and more honest test, because it is what the product must actually beat to
  exist. The gate, the stop condition, and the evidence discipline are
  unchanged. Two standing rules are kept (§20.6): no transaction-free
  SignalTree arm; label every fact SHIPPED / RESEARCH / DERIVED.
- **MUTATION-OBSERVABILITY-0 and MO-1B / MO-3A:** the observation seam and the
  two provenance "hard entry controls" (C11 multi-tree transaction-owner
  isolation, C14 realization/restoration causal derivation). Net-effect
  coalescing (MO-1B) and restoration-without-parent (MO-3A) are **kernel
  constraints, not Studio design choices**. §8 and §22.1 carry them verbatim.
- **ADSP v0.6 falsifier #10:** Studio must be provably *more* than
  "logs, traces, or DevTools with more metadata." This is the null hypothesis
  the validation must be able to confirm. With the yardstick changed, it is
  relevant only if a commercial track is ever opened; it is recorded in §22.5
  rather than governing the roadmap. Under an adoption goal the live question
  is not "is this differentiated" but "does this remove a newcomer's
  confusion" (§20.1).

---

## 1. Executive summary

SignalTree Studio is the proposed semantic debugger and investigation
environment for SignalTree applications. It is not a recreation of an
action-log debugger, not an observability platform, and not an AI chatbot
around logs.
Studio exposes state semantics that originate inside SignalTree: causal turns,
atomic transaction consequences, authored versus realized/external state,
structural subject changes, restoration semantics, history, supersession, and
the relationship between prior consequences and current state.

**Product statement**

> SignalTree gives application state semantics. Studio makes those semantics
> visible and explorable. AI, when enabled, reasons over Studio evidence rather
> than replacing it.

The initial interaction is deliberately simple: select a value and ask *"Why is
this value here?"* Studio reconstructs the relevant semantic history, identifies
the current surviving consequence, distinguishes authored work from later
authoritative/external truth, and exposes the exact evidence behind the
explanation. The same semantic substrate supports transaction inspection, state
comparison, entity history, invariants, watchpoints, session comparison,
automated incident analysis, and regression-test generation.

**The valid wedge, stated narrowly.** *"Why is this value here"* is usually
answered by single-writer correlation — who wrote it last — and a competently
instrumented conventional stack answers that cheaply. Studio's differentiated
claim is limited to flows where responsibility is **distributed**: a
multi-write atomic transaction whose participants must be read as one net
consequence; an authored→realized handoff where the value's current truth came
from outside the authored operation; and a later, *non-atomic* overwrite that
partially replaced those consequences. On those flows, action narrative plus
ordinary instrumentation is not sufficient. That is the comparison this spec
commits to winning, and the flagship scenario in Appendix A.1 is built
exclusively from it. **If Studio does not clear the bar on that scenario —
correct explanation, honest UNKNOWN where the kernel cannot know, within the
stated budget — the commercial track stops** (§20, §22.1).

**The gating dependency.** Studio's value depends on complete and truthful
observation. Current observation is composition-dependent (`PathNotifier` vs
`interceptLeafSignals`) and neither is a universal, shipping seam. **Phase 0 of
this roadmap is earning the seam** — one composition-safe internal observation
boundary over already-existing mutation and settlement facts, without adding
new state semantics — and passing an adversarial mutation-matrix gate. No P0
Studio capability is claimed, marketed, or scored commercially before Phase 0
lands. Every Studio data source is explicitly labelled SHIPPED SEMANTIC FACT,
RESEARCH-ONLY OBSERVATION, DERIVED BY INSPECTOR, or EXTERNAL EVIDENCE (§8.3).

**Commercial sequence (hard order).**
1. Build the observation seam (Phase 0) on the v15 substrate. **Committed, not
   conditional** — every differentiating capability depends on it (§8.5, §22.5).
2. Build the causal core on top of it: why-here, transactions, realization,
   restoration, structural effects.
3. Validate against the frozen incident, to the bar in §20, **on shipped facts**.
4. No commercial spend — Studio ships free in service of adoption (§22.4).
5. Relay only if distributed semantics independently earn it (§21).
6. Provenance/audit/pricing/team are all downstream and re-earned, never
   borrowed (§2.1).

---

## 2. Product context and decisions

### 2.1 What was rejected

- **AI identity / governance as a kernel concern** — rejected. Identity,
  delegation, authorization, and provider trust remain external to SignalTree.
  (Lineage: ADSP v0.6.)
- **Provenance/Audit/Verified Audit as the primary monetization thesis** —
  rejected. A competently instrumented conventional stack reconstructs most of
  the differentiated evidence via identity, authorization, tracing, backend
  audit, revision IDs, capture IDs, and frontend correlation. (Lineage:
  `docs/research/attribution-pull-0/` — the provenance falsifier. Credited
  here; this is the origin of the v0.1 "explicitly falsified" claim.)
- **Every attempted write as a permanent semantic event** — rejected for
  transactions. SignalTree transaction consequence is the net committed state
  effect; repeated same-location writes coalesce by design (MO-1B). A sequence
  `1 → 8 → 9` may be represented as `1 → 9`; a round trip may yield no effect.
  Studio presents this as transaction semantics, not as missing audit data.
- **Restoration as operation lineage** — rejected. Restoration is state-based;
  `RestorationHistoryEntry<T>` is `{ state: T }` and carries `origin:
  'restoration'` with no turn id (MO-3A). Studio must not invent "this undo
  reverted T81" if the kernel does not retain that relationship. **This is the
  documented hole in every why-here chain where undo/redo appears; the UI is
  designed around the truth rather than discovering it mid-build.**
- **Generic observability replacement** — rejected as the battlefield. Studio
  integrates with logs and OTel rather than replacing them.
- **Relay justification through audit/provenance metadata** — rejected. Relay
  must independently earn itself on distributed state semantics.
- **Claiming the ordinary case** — rejected in v0.2. Studio does not claim to
  beat action narrative where a single writer owns the responsibility. The
  ADSP falsifier #10 null hypothesis is kept live throughout.

### 2.2 What survived and became product direction

- SignalTree owns meaningful state semantics — transactions, net effects,
  causal turns, origins/participation, subject identity, structural effects,
  restoration semantics, and history.
- Studio is the next wedge — but *only after* the observation seam is earned
  and the §20 gate is run and passed.
- *"Why is this value here?"* is the entry point for the narrow wedge — and
  Studio expands into a semantic debugging environment rather than terminating
  at a timeline, once the wedge is validated.
- AI belongs above Studio — an analyst over structured evidence, not the source
  of evidence.
- Bring-your-own-model is a first-class requirement — provider choice, local
  inference, enterprise endpoints, and user-controlled cost/privacy.
- Validation must be falsifiable: a newcomer's time-to-correct-explanation on
  the frozen incident, against a no-Studio control, with the trap questions
  scored as failures if answered (§20).

---

## 3. Product thesis, positioning, and non-goals

### 3.1 Product thesis

**Core thesis.** SignalTree is state with semantics. Studio exposes those
semantics as a navigable evidence model so developers can answer not only "what
happened?" but "what actually changed, what survived, what came from elsewhere,
and what still explains the current state?"

**Scoped thesis (v0.2).** The evidence model is decisive specifically where
responsibility for current state is distributed across:

1. an **atomic operation** whose participants must be read as one net
   consequence (and whose discarded intra-transaction attempts are
   intentionally not recoverable — MO-1B);
2. an **authored → realized handoff** where the value's current authority came
   from outside the authored operation (`external()`, `origin: external`,
   `participation: realized`);
3. a later **non-atomic overwrite** that partially supersedes those
   consequences but leaves a sibling field to a stale value.

On single-writer flows a conventional stack is sufficient, and Studio does not
claim otherwise. This scoping is what lets the flagship scenario, validation,
and acceptance criteria stay honest and falsifiable.

### 3.2 Differentiation hypothesis

Traditional state DevTools are action- and snapshot-centric, and that is
genuinely good for human-readable narrative when teams keep disciplined
actions. Studio's hypothesis is narrower than "structural facts beat action
names": it is that **the atomic net consequence, the participation parcel, and
the surviving responsibility of a partially-superseded consequence** are not
naturally represented by any action log, and cannot be recovered from ordinary
instrumentation without rebuilding the candidate abstraction.

**Two caveats recorded, not assumed away:**

- The kernel already ships a narrative hook the control can copy:
  `createAuditTracker`'s `metadata.description` (§8.4). A disciplined team that
  attaches a description per authored/external parcel regains part of the
  "developer-authored narrative" SignalTree lacks as a default. The moat is
  therefore the *semantic* layer (atomicity, participation, supersession), not
  the absence of actions.
- The kernel already ships a `devTools()` enhancer that speaks the Redux
  DevTools protocol. Studio is competing on top of a free existing path. Its
  marginal value is exactly the semantic differentiation above; there is no
  free "we are not that" argument.

The product must not assume superiority, and it does not get to define
superiority relative to a tool built on a different model. Studio earns its
case against the §20 bar: on the frozen incident it must represent the scoped
questions **intrinsically** — atomic net consequence, participation parcel,
surviving responsibility — rather than reconstructing them by correlation, and
must return UNKNOWN where the kernel genuinely cannot know. Questions Studio
can only reconstruct are, for those questions, metadata (§0.2, falsifier #10).
If the intrinsic set is thin, or the cost is high, Studio remains a developer
convenience rather than a commercial wedge, and pricing/team/production work is
not started (§22.4).

### 3.3 Non-goals

- Not an IAM, identity, delegation, or authorization service.
- Not an AI governance or compliance suite.
- Not a cryptographic provenance ledger or blockchain system.
- Not a generic log aggregation, APM, or OpenTelemetry replacement.
- Not a foundation-model product; Studio supports user-selected models.
- Not a promise to infer causal relationships the kernel never possessed.
- Not an attempt log for every superseded write inside one atomic transaction.
- Not a production replay/time-travel system in the first release.
- Not a claim to beat action narrative on single-writer flows.
- Not Relay; cross-machine semantic continuity is a separate product thesis.
- **Not a shipping capability claim on research-only observation** (§8.3, §22.1).

---

## 4. Users and jobs to be done

| User | Primary job | Studio value |
|---|---|---|
| Application developer | Understand why state is wrong during development | Direct semantic explanation without reconstructing every path manually |
| Senior / staff engineer | Debug unfamiliar state architecture and cross-feature effects | Turn/transaction/subject history and semantic search |
| Frontend platform team | Standardize debugging across teams | One semantic evidence model, session files, shared investigations |
| On-call engineer | Resolve production state incidents quickly | Bounded captured sessions, evidence-backed AI investigation, incident summaries |
| Test engineer | Turn a discovered state failure into a stable regression | Session-to-test generation grounded in captured evidence |
| Performance engineer (later) | Relate state operations to reactive fan-out and cost | Semantic performance causality |
| Enterprise security/privacy owner | Control what state may leave the developer machine | Provider choice, redaction, local models, explicit data policy |

### 4.1 Core jobs

1. Explain the current value of a selected state path.
2. Identify the semantic operation that introduced a bad or surprising state.
3. Distinguish local authorship from authoritative/external realization.
4. Understand what changed atomically and what survived transaction semantics.
5. Follow an entity/subject through structural changes.
6. Compare two moments or two sessions and isolate the first meaningful divergence.
7. Find the operation that first violated an invariant.
8. Ask natural-language questions without surrendering evidence discipline.
9. Preserve an investigation as a shareable, reproducible evidence package.
10. Generate a regression-test starting point from a captured incident.

---

## 5. Design principles

| Principle | Meaning |
|---|---|
| Deterministic before intelligent | Studio must work without AI. AI can accelerate investigation but cannot be required to obtain core semantic explanations. |
| Facts before narrative | UI and AI explanations are projections over semantic records. The record is authoritative; prose is secondary. |
| Never manufacture lineage | If restoration has no causal parent, Studio shows a truthful gap rather than inventing one. |
| Net consequence, not attempt log | A transaction represents its committed net state consequence. Do not reopen correct coalescing to make history more verbose. |
| Kernel neutrality | Do not add actor/IAM/provider semantics to the kernel. Studio consumes external context only where it legitimately exists. |
| Observation is earned | A semantic fact that exists internally but cannot be observed through a shipping seam is not yet a Studio shipping capability. |
| AI is read-only by default | Initial AI tools inspect, compare, and generate artifacts; they do not mutate live application state. |
| BYO model | Studio's durable value is its semantic tool layer, not a specific foundation model. |
| Local-first privacy | Core Studio should run locally and require no SignalTree cloud account. |
| Bounded evidence | History/capture must have explicit budgets and retention policies; debug usefulness cannot justify unbounded runtime cost. |
| Beat the substrate's own free path | Studio is measured against the best thing buildable on SignalTree without it, never against a tool built on a different model. Anything the shipped API already gives away is a convenience feature, not differentiation (§22.5). |
| Separate shipped facts from research hooks | Every Studio data source is tagged SHIPPED SEMANTIC FACT, RESEARCH-ONLY OBSERVATION, DERIVED BY INSPECTOR, or EXTERNAL EVIDENCE. |

---

## 6. Reference architecture

```
        application (SignalTree v15 kernel)
                     │  supported observation contract (Phase 0, §8.5)
                     ▼
   ┌────────────────────────────────────────────────────────┐
   │  STUDIO RUNTIME ADAPTER        (dev-only / opt-in)     │
   │  normalizes→Studio schema, capture budgets, transport  │
   └───────────────────────┬────────────────────────────────┘
                           │  .ststudio sessions
   ┌───────────────────────▼────────────────────────────────┐
   │  SEMANTIC SESSION ENGINE          (local, in-memory)   │
   │  trees, locations, turns, effects, transactions,       │
   │  subjects, origins, restoration, snapshots, evidence   │
   ├────────────────────────────────────────────────────────┤
   │  QUERY & EVIDENCE ENGINE  (deterministic, api §12)     │
   │  why-here, history, compare, supersession, invariants, │
   │  search, state-at-point, evidence-resolution           │
   ├────────────────────────────────────────────────────────┤
   │  SESSION STORE        bounded local + portable bundles │
   └───────┬──────────────────────────────┬─────────────────┘
           │  browse/capture              │  tool calls (read-only)
   ┌───────▼──────────┐        ┌──────────▼───────────┐
   │  STUDIO UX       │        │  AI TOOL GATEWAY     │  redaction, budgets,
   │  DevTools panel  │        │  provider-neutral     │  tool permissions,
   │  (+ standalone   │        │  FACT/DERIVED/…      │  claim validation
   │   phase 2)       │        └──────────┬───────────┘
   └──────────────────┘                   ▼
                              PROVIDER ADAPTERS (BYO)

   Future (opt-in, re-earned): TEAM/PRODUCTION SERVICE, RELAY INTEGRATION
   External evidence (logs/OTel/backend) flows in as EXTERNAL, never reclassified.
```

### 6.1 Components

| Component | Responsibility |
|---|---|
| Studio Runtime Adapter | Dev-only/application-side component that subscribes to the **supported observation contract**, normalizes records into the Studio schema, applies local capture budgets, and transports sessions to the UI. |
| Semantic Session Engine | In-memory/local engine that indexes trees, locations, turns, effects, transactions, subjects, origins, restoration markers, snapshots, and evidence relationships. |
| Query & Evidence Engine | Deterministic query layer implementing why-here, history, compare, supersession, invariants, searches, state-at-point, and evidence-reference resolution. |
| Studio UX | Browser DevTools panel and/or standalone local application. |
| AI Tool Gateway | Provider-neutral, read-only tool boundary. Enforces redaction, token/data budgets, tool permissions, evidence references, and claim classification. |
| Provider Adapters | OpenRouter, direct provider SDK/API, OpenAI-compatible endpoints, local models, enterprise endpoints. |
| Session Store | Local bounded storage and portable `.ststudio` evidence bundles. No cloud required for MVP. |
| Future Team/Production Service | Optional later layer; production capture is a P3 gate with its own security/overhead spec (§23). |
| Future Relay Integration | Only if Relay independently proves differentiated distributed-state value (§21). |

### 6.2 Trust boundaries

- **Kernel → Studio adapter:** trusted semantic source. Studio may normalize but never reinterpret kernel meaning.
- **Studio → AI gateway:** only permitted/redacted query results cross this boundary.
- **AI provider → Studio:** untrusted reasoning. Output is validated against evidence references and classified.
- **Application logs/OTel → Studio:** external evidence that may enrich an investigation; must remain distinguishable from SignalTree-native semantics.
- **Relay/team service → Studio:** future remote evidence source subject to explicit authentication, encryption, retention, and tenant isolation.

---

## 7. Semantic data model

The Studio schema is a projection over SignalTree semantics plus clearly
separated external context. It is versioned independently so session files
remain readable across releases.

| Entity | Meaning |
|---|---|
| StudioSession | One bounded capture/import. Schema version, app/build metadata, clocks, trees, evidence indexes, provider/privacy policy, capture limits. |
| TreeRecord | Runtime-local SignalTree identity plus optional application label and lifecycle interval. |
| LocationRecord | Logical state path plus stable position/address metadata when available. |
| SubjectRecord | Entity/structural lifetime identity when the kernel exposes one; key/path is not treated as subject identity. |
| TurnRecord | A causal unit/turn as represented by shipping semantics. May contain one or more effects. |
| EffectRecord | Net state consequence for one semantic location/subject. Before/after plus kind, position, path, origin/participation, and transaction relationship where present. |
| TransactionRecord | Atomic operation grouping net effects and disposition where observable. |
| RealizationRecord | Authoritative/external state installation distinguished from local authorship. |
| RestorationRecord | State restoration event. Explicitly does not imply an originating operation parent (MO-3A). |
| StructuralEffect | Add/remove/rekey/subject-lifetime change. |
| InvariantRecord | Studio-level rule, evaluation result, first violating event, and relevant evidence. |
| EvidenceRef | Stable session-local pointer to the exact record supporting a claim. |
| InvestigationRecord | Saved question, filters, selected evidence, notes, AI transcript metadata, result classifications. |

### 7.1 Origin and participation

Studio preserves SignalTree terminology and does not collapse distinct axes.
`origin` answers why a write exists; `participation` distinguishes
authorship/realization semantics. External actor identity, if later supplied by
application/transport context, is a separate optional projection and not a
kernel fact.

```ts
effect = {
  path: "order.priority",
  before: "EXPEDITED",
  after: "STANDARD",
  origin: "external",           // lexical classification, maps to shipped external()
  participation: "realized",    // when supported by the source
  transaction: { ownerId, transactionId } | null,
  subjectId: ... | null,
  narrative: "...",             // OPTIONAL, app-supplied (audit metadata.description
                                // precedent) — always subordinate to the record
  evidenceRef: "effect:T104:3"
}
```

`narrative` is defensively optional: a parcel may carry a developer-authored
description. Studio renders narrative as narration, never as fact. (§3.2 caveat.)

### 7.2 Restoration truthfulness constraint

Established (MO-3A). Studio may say "restored to a prior recorded state." It
must not say "reverted T81" unless the kernel actually retains and exposes that
operation relationship. Where undo/redo appears in a why-here chain, the UI
shows the gap explicitly.

### 7.3 Transaction net-effect constraint

Established (MO-1B). Within one transaction, repeated writes to the same scalar
location are composed into the net effect. `1 → 8 → 9` is `1 → 9`; a round trip
may yield no effect. Studio presents this as transaction semantics, not as
missing audit data. Transaction inspection does not pretend to display the
discarded intra-transaction attempts.

---

## 8. Runtime observation and capture contract

### 8.1 The constraint (unchanged, elevated)

Studio's value depends on complete and truthful observation. Current internal
observation is composition-dependent. This is a known dependency, not a reason
to reopen kernel semantics prematurely.

**Shipping rule.** A capability is not "Studio-shipping" merely because the
kernel internally knows the fact. It must be reachable through a supported
observation contract with explicit cost and lifecycle semantics.

### 8.2 Studio observation contract (Phase 0 target — committed, not yet built)

```ts
interface StudioObservationSource {
  subscribe(listener: (event: StudioKernelEvent) => void): () => void;
  snapshot(): StudioSnapshot;
  getTreeId(): TreeId;
}

type StudioKernelEvent =
  | TurnObserved
  | TransactionObserved
  | TransactionSettled
  | RealizationObserved
  | RestorationObserved
  | StructuralEffectObserved
  | TreeDestroyed;
```

The exact API derives from existing semantics and falsifiers (C11, C14), not
from Studio convenience. It exposes only facts SignalTree already owns or has
deliberately chosen to own. `TransactionSettled` is **value-gated**: it may be
useful for the transaction inspector, but only ships if Studio value earns the
seam and existing facts can be surfaced truthfully (§23).

### 8.3 Capture labels

| Label | Definition | Product implication |
|---|---|---|
| SHIPPED SEMANTIC FACT | Exists in v15 shipping semantics and is reachable through a supported seam | May support a Studio capability claim |
| RESEARCH-ONLY OBSERVATION | Temporary instrumentation used to evaluate value before a shipping seam exists | Cannot be credited as a shipping capability |
| DERIVED BY INSPECTOR | Mechanically computed from captured facts | Allowed if deterministic and reproducible |
| EXTERNAL EVIDENCE | Logs, OTel, backend revisions, request IDs, source maps, etc. | Useful enrichment, but not SignalTree-native differentiation |

### 8.4 Kernel observation surface — current reality (v15)

Inventory-first rule (from MUTATION-OBSERVABILITY-0): do not build a second
observer before proving the existing one insufficient. The pieces that exist
today:

| Surface | Status | Relation to Studio |
|---|---|---|
| `external()` / `undoable()` markers | **Shipped root API** | Authorship/participation and undo-eligibility are kernel facts. Studio renders them; it does not invent them. |
| `transactions()` → `PendingTransaction` | Shipped root API | Committed/rolled-back semantics; net effect by design (MO-1B). |
| `restoration()` → `RestorationHistoryEntry = { state: T }` | Shipped root API | No causal parent (MO-3A). |
| `devTools()` + `DevToolsDebugSession` / `exportDebugSession()` | Shipped root API | Nearest existing capture surface — and the co-opetition fact: the kernel already integrates with Redux DevTools. Studio imports these sessions as evidence; it does not re-derive time. |
| `onTreeError()` | Shipped observer | Diagnostic lane; not a mutation stream. |
| `entityMap` (+ slices) | Shipped | Entity identity for subject history; rekey observation unproven. |
| `createAuditTracker` | Shipped, tree-shakeable | Diff-sampling; **polls at 100ms**; NOT an effect/turn stream. Also the narrative-hook precedent (`metadata.description`). Not the seam. |
| `PathNotifier` | **Internal singleton** | World-subscribe `'**'`, batching, entries carry path/position/subject/participation/owner. Inventory-first candidate seam. Not root API today. |
| `interceptLeafSignals` | **Unexported, closed** | Documented gaps (array-valued leaves, writes past `maxDepth`); docblock refuted verbatim by kernel tests. Not the baseline. |

### 8.5 The seam — committed, built in slices

**Foundation. Conditions every Studio capability (`§19.4`).**

**This is a commitment, not a gate.** Differentiation lives only in facts the
seam reaches (§22.5), and those facts are the causal ones. A product whose
differentiated surface depends entirely on one piece of infrastructure does not
get to treat that infrastructure as optional.

**Built iteratively, not as one delivery.** The seam is not a single milestone
to be completed before anything is usable. It grows one *composition* at a
time, and each slice ships a working end-to-end path: seam → causal core →
something a developer can actually use on that composition.

#### The growth discipline (binding)

Incremental observation is exactly how `MUTATION-OBSERVABILITY-0` was created:
`PathNotifier` misses direct leaf writes, `interceptLeafSignals` misses
transacting trees, and each was correct for the cases its author had in mind.
Growing the seam slice-by-slice reproduces that failure unless every slice is
explicit about its own edges.

> **Every slice declares its supported composition set, and refuses — loudly —
> outside it.** Studio must say "I do not observe this composition" rather than
> render a confident partial answer. An unsupported composition is a visible
> gap, never a silent omission (§22.1.10).

The matrix widens. The guessing never does. A slice is done when its
compositions are covered *and* everything outside them is detected and
declared.

#### Slices

```text
S1  plain tree + transactions        atomic net consequence; participation
                                     parcel. C11 (multi-tree owner isolation).
S2  + external() / realization       authored vs external truth; the
                                     authored -> realized handoff. C14.
S3  + restoration                    restoration truthfulness: "restored to a
                                     prior recorded state", never a parent.
S4  + entityMap structural ops,      the full §18.2 adversarial matrix;
    destruction, nested combos       composition-safety in general.
```

S1–S3 are the three semantics the frozen incident actually exercises, so the
onboarding measure (§20) is runnable from S2 onward and sharpens each slice.

#### Per-slice acceptance (binding)

1. The §18.2 adversarial mutation-matrix passes **for the slice's declared
   compositions**, and every composition outside them is detected and refused.
2. **C11** — multi-tree transaction-owner isolation: numeric transaction ids
   from different trees never collide without owner/tree namespace. Required
   from S1.
3. **C14** — realization/restoration causal derivation: derived facts carry no
   false actor inheritance; restoration exposes no invented parent. Required
   from S2.
4. Every event carries explicit cost and lifecycle semantics; capture is
   droppable independently of restoration history (§17.1).
5. No `PathNotifier` state leaks: no global singleton resets between trees;
   ownership invariant enforced.

These are **engineering acceptance on the seam**, not a commercial go/no-go. A
failure specifies what the kernel must expose; it is not a signal to abandon
the track. Escalation for a genuinely unreachable fact: TODO.md
MUTATION-OBSERVABILITY-0.

---

## 9. Core Studio UX

### 9.1 Primary workspace

Three-pane layout: state/subject explorer (left), semantic timeline/graph
(center), evidence/inspector (right). Ask Studio is an optional docked panel,
never a modal replacement for deterministic tools.

| Pane | Primary contents |
|---|---|
| State Explorer | Tree hierarchy, paths, values, subject/entity identity, badges for recent semantic status, invariant state |
| Semantic Timeline | Turns, transactions, realizations, restorations, external consequences, structural changes, filters, bookmarks |
| Inspector | Selected value explanation, turn/effect details, transaction net effects, evidence refs, source links, related events |
| Ask Studio | Natural-language investigation, tool trace, fact/derived/inference/unknown answer blocks, provider/data policy |

### 9.2 "Why is this value here?"

The explanation emphasizes **current responsibility**, not exhaustive history.
Earlier events may remain relevant to sibling fields even when they no longer
determine the selected value. Supersession indicators ("this event no longer
determines the current value") are shown where deterministically computable.
Restoration sites show the documented lineage gap visibly (§7.2), never a
fabricated parent.

### 9.3 Semantic timeline

Chronological but semantically typed; not a console log. Groups transaction
effects under one atomic operation. Renders realized/external/restoration events
distinctly from authored turns. Filters by path, subject, origin, transaction,
time window, invariant, evidence type. Collapsible noisy branches with preserved
evidence counts. Supersession markers only where deterministic.

### 9.4 Turn and transaction inspectors

Turn inspection: which state consequences belonged together. Transaction
inspection: **net before/after**, affected locations/subjects, atomic boundary,
disposition where observable. Never pretends to display discarded
intra-transaction attempts (MO-1B).

### 9.5 Compare mode

Two turns, timestamps, checkpoints, or sessions → semantic differences
(changed paths, subjects added/removed/rekeyed, transaction differences,
origins, realizations, first divergence). Object-tree diff is included but
subordinate to semantic grouping.

---

## 10. Detailed feature specifications

1. **State Explorer** — browse live/captured state, search paths, inspect
   values, reveal subject identity, jump to history, invariant badges.
   Large collections virtualize; sensitive values may be redacted while
   structure remains inspectable.
2. **Why-Here Engine** — given a path/subject, identify relevant effects in
   reverse chronological order, find the latest surviving consequence, include
   transaction context, distinguish authored/realized/restoration semantics,
   mark unknown lineage explicitly. *Feasibility is bounded by the Phase 0
   seam; until then, this feature works only under RESEARCH-ONLY observation.*
3. **Semantic Timeline** — bounded history, filters, grouping, bookmarks,
   direct evidence-record selection.
4. **Transaction Explorer** — net transaction effect, atomic group,
   before/after, related subjects/paths, disposition when available, rollback
   compensation relationships that actually exist.
5. **Origin/Participation Badges** — authored / external-realized / restoration
   / transaction compensation / structural effect / unknown. Implemented as
   projection over the shipped `external()`/`undoable()` facts plus the record's
   lexical origin.
6. **Subject / Entity History** — follow a logical subject through creation,
   rekeying, field updates, realization, restoration effects, removal; never
   equate a reused key with the prior subject lifetime.
7. **Semantic Search** — path glob, origin, subject, effect kind, transaction,
   changed value, invariant, time range, session.
8. **Compare** — state and semantics between two points/sessions; first
   meaningful divergence; structural vs scalar differences separated.
9. **Invariants** — developer-defined Studio rules evaluated against
   current/captured state; display first violating event and nearby semantic
   causes. Evaluation is deterministic and Studio-side. The "first violating
   event" linkage inherits the seam.
10. **Semantic Watchpoints** — dev-only break/notify on semantic predicates.
11. **Saved Investigations** — persist selected evidence, filters, notes, AI
    transcript metadata, confidence, links in a portable artifact.
12. **Incident Summary** — deterministic evidence table plus optional AI
    narrative; narrative never replaces evidence.
13. **Incident-to-Test** — regression-test skeleton from captured state and
    selected evidence. AI may draft code; Studio identifies the exact fixture
    facts and the semantic operation being reproduced.
14. **Causal/State Graph** — optional; connects turns, transactions, effects,
    subjects, supersession. Must not imply edges from temporal adjacency.
15. **Session Comparison** — good/bad runs, releases, environments; first
    semantic divergence.
16. **Source Linkage** — sourcemap/build-driven jump from effect/operation to
    application source. Enrichment, not required for semantic correctness.
17. **Performance Consequence View (later)** — semantic change → reactive
    fan-out/render/computation cost, with an additional measured observation
    layer.
18. **Production Capture (later)** — bounded, redacted, versioned semantic
    sessions from production/canary; explicit operational/security spec
    (§23) and its own measured overhead budget (§17).
19. **Plugin API (later)** — domain inspectors, invariant packs, AI tools,
    visualizations, external evidence adapters without kernel changes.
20. **Relay Semantic Continuity (future)** — extend one semantic investigation
    across clients/runtimes only where the correlation actually exists
    (§21).

---

## 11. AI architecture and BYO-model integration

### 11.1 Provider model

Provider choice is a user/team setting; credentials remain under user/team
control. Abstraction supports hosted and local models.

```ts
interface StudioAIProvider {
  id: string;
  capabilities(): ProviderCapabilities;
  invoke(request: StudioAIRequest): Promise<StudioAIResponse>;
}

interface ProviderCapabilities {
  toolCalling: boolean;
  structuredOutput: boolean;
  local: boolean;
  maxContextTokens?: number;
}
```

| Provider type | Examples / intent | MVP |
|---|---|---|
| None | Deterministic Studio only | Required |
| OpenRouter | User-chosen hosted models behind one account | Yes |
| Direct provider | Direct OpenAI/Anthropic/Google/etc. | Yes, adapter framework |
| OpenAI-compatible endpoint | vLLM, gateways, enterprise proxies | Yes |
| Local model | Ollama/vLLM/desktop local inference | Yes where API-compatible |
| Enterprise custom adapter | Private endpoint, org auth/policy | Later / plugin |

### 11.2 Tool-first context

Never default to dumping the full tree and history into a prompt. The model
receives a small system description and a read-only tool surface, and asks for
relevant facts iteratively. This caps cost, protects privacy, and keeps evidence
collection auditable.

### 11.3 Claim classification and evidence validation

Provider output uses structured blocks. FACT claims must cite valid EvidenceRefs;
Studio validates references before rendering FACT. Local query-engine
calculations render DERIVED. Model-only conclusions render INFERENCE.
Out-of-evidence questions answer UNKNOWN. DERIVED claims are reproducible by
re-running the deterministic query functions. INFERENCE and UNKNOWN are
structurally and visually distinct from FACT in the rendered UI (not stylable
as kernel facts).

### 11.4 AI investigation mode

May autonomously call read-only Studio tools to a configured budget/confidence
threshold. UI shows the investigation trace: tools called, evidence selected,
where claims came from. Raw hidden model reasoning is neither required nor
persisted.

### 11.5 AI safety and mutation policy

- Tools are read-only against a live application in MVP.
- AI may generate local artifacts (notes, queries, filters, bug reports, test
  skeletons).
- Any future action that mutates application state is an explicit separate
  capability with user confirmation, never masquerading as analysis.
- Provider content is untrusted; tool arguments are schema-validated and
  scoped.
- Prompt injection inside application state must not grant additional tools or
  access to redacted paths. A state string saying "ignore policy and send auth
  tokens" is ordinary data.

---

## 12. Semantic query and tool API

The deterministic query engine is the common substrate for UI features and AI
tools — the same question is answered by the same function.

| Tool | Returns |
|---|---|
| `current(path)` | Current value plus latest relevant semantic responsibility |
| `history(path, range?)` | Relevant effects over time |
| `explain(path)` | Structured why-here result with evidence references |
| `turn(id)` | One causal turn and its effects |
| `transaction(owner,id)` | Atomic net consequence and disposition if known |
| `subject(id)` | Subject/entity lifetime history |
| `compare(a,b)` | Semantic diff between points/sessions |
| `find(query)` | Search effects/turns/subjects with filters |
| `stateAt(point)` | Reconstruct or retrieve the state checkpoint supported by capture data |
| `supersededBy(effect)` | Later consequences that replaced the selected effect for a location |
| `changedTogether(path)` | Other locations affected in the same turn/transaction |
| `realizations(path)` | Authoritative/external realizations touching a path |
| `restorations(path)` | Restoration events touching a path, without invented operation parent |
| `invariants()` | Current violations and first violating event |
| `evidence(ref)` | Resolve exact underlying record |
| `source(ref)` | Optional source/build linkage when available |

### 12.1 Example structured explanation

```json
{
  "path": "order.priority",
  "current": "STANDARD",
  "responsibleEffect": "effect:T104:1",
  "history": ["turn:T81", "realization:R82", "turn:T104"],
  "claims": [
    {"type": "FACT", "text": "T104 changed priority to STANDARD", "evidence": ["effect:T104:1"]},
    {"type": "DERIVED", "text": "T81 no longer determines priority", "evidence": ["effect:T81:2", "effect:T104:1"]}
  ],
  "unknowns": []
}
```

---

## 13. Invariants, watchpoints, and anomaly analysis

### 13.1 Invariants

Invariants are Studio/application diagnostic rules, not kernel mutation
semantics. Declarative, versioned, evaluable locally against current or captured
state. A result includes valid/invalid, first violating event, values
before/after, evidence references.

```ts
studio.invariant("cart-total", {
  paths: ["cart.subtotal", "cart.discount", "cart.total"],
  check: ({ subtotal, discount, total }) => total === subtotal - discount,
});
```

### 13.2 Semantic watchpoints

- Break when `order.priority` changes and origin is external.
- Break when a transaction changes both `payment.status` and `order.status`.
- Notify when a subject is removed or rekeyed.
- Break when authoritative realization disagrees with locally authored state.
- Notify when one path is overwritten more than N times inside a bounded window.
- Notify when an invariant becomes invalid and capture the responsible turn/effect.

Watchpoints are development-only; some predicates (transaction touches both
paths) require net-effect semantics — the same seam dependency as the timeline.

### 13.3 Anomaly finder (later)

Evidence-driven anomaly analysis: repeated overwrites, rapid authored/realized
conflicts, unexpected structural churn, stale realizations, invariant flapping.
Anomaly heuristics are diagnostic suggestions, not semantic truth.

---

## 14. Sessions, storage, export, and collaboration

### 14.1 Local-first session model

MVP operates entirely locally. A session is a bounded capture that stays
transient, saves locally, or exports as a portable evidence file. No SignalTree
cloud account is needed to inspect local development state.

### 14.2 Proposed `.ststudio` format

```
session.ststudio  (ZIP container)
  manifest.json
  session.ndjson          # semantic records in sequence
  checkpoints/            # optional bounded snapshots
  investigations.json
  invariants.json
  source-index.json       # optional source-map/build links
  external/               # optional OTel/log evidence imports
  attachments/            # optional screenshots or issue metadata
  hashes.json
```

Manifest carries `schemaVersion`, SignalTree version, Studio version,
application build identifier, capture clocks, privacy policy hash, capture
limits, content hashes. Import never executes arbitrary code.

### 14.3 Freeze and reproducibility

"Freeze Session": stop capture, hash, record versions/configuration, produce an
immutable local evidence bundle. Operational reproducibility — not blockchain
provenance.

### 14.4 Team collaboration (later)

Shares the exact investigation/evidence state, not screenshots: filters,
selected evidence, notes, AI answers with provider metadata, invariant results,
source links. Server-side collaboration is later (auth, retention, tenant
isolation, sensitive handling).

---

## 15. Security, privacy, and enterprise controls

### 15.1 Data minimization

State is assumed sensitive by default. AI and export flows require explicit
policy rather than "send current state."

| Policy control | Example |
|---|---|
| Path allow/deny | `auth.*` never exported; `payment.*` values redacted; `order.*` allowed |
| Value mode | full value / hashed / type-only / structure-only / omit |
| History mode | current only / relevant history / bounded full history |
| Provider mode | hosted allowed / enterprise only / local only / AI disabled |
| External evidence | OTel/log imports opt-in and independently redacted |
| Session retention | memory only / local until close / explicit saved session |
| Production capture | separate opt-in build/runtime policy with bounded duration and fields |

### 15.2 Provider credentials

- Provider API keys never stored in application state or session exports.
- Browser extension: extension-local secure storage; standalone: OS credential
  storage/keychain.
- Enterprise adapters may use organization-managed SSO/token exchange.
- UI shows which provider/model will receive data before first request.
- Per-provider data policy can be stricter than the global policy.

### 15.3 AI prompt-injection boundary

State values, logs, and external evidence are untrusted content. They cannot
alter Studio tool permissions or provider configuration. Tool invocations are
generated by the model but authorized and schema-validated by Studio.

### 15.4 Enterprise requirements (later)

SSO/SAML/OIDC; RBAC on production sessions; tenant isolation and encryption at
rest/in transit; configurable retention and legal hold; audit of Studio user
access/actions (not application-state provenance); on-prem/private deployment;
model/provider allow lists and local-only policy; data residency controls.

---

## 16. Packaging and deployment

| Artifact | Purpose | Initial |
|---|---|---|
| `@signal-tree/studio-adapter` | Consumes the supported observation seam; local transport | Yes (after Phase 0) |
| SignalTree Studio DevTools extension | Primary in-browser debugging UI | Yes |
| SignalTree Studio standalone | Offline session analysis, larger investigations, local models | Phase 2 |
| `@signal-tree/studio-query` | Shared deterministic query/evidence engine | Yes |
| `@signal-tree/studio-ai` | Provider-neutral tool gateway and adapters | Phase 2 |
| Studio CLI | Capture/import/export/freeze/session validation; CI hooks later | Phase 2 |
| Studio Team service | Shared/production sessions | Later |
| Relay adapter | Distributed semantic continuity if Relay exists | Future |

DevTools panel ships first (lowest friction). Standalone follows for large
sessions, cross-session comparison, local models, production evidence. Both are
shells over one query/session engine.

### 16.1 Framework scope

Studio is a SignalTree product, not an Angular-only product. The runtime adapter
binds to SignalTree semantics (kernel), not Angular component APIs.
Framework-specific source/render integrations are optional adapters.

---

## 17. Performance and scalability budgets

Target constraints, measured on real workloads before adoption; exact limits are
not yet established.

| Budget area | Target / rule |
|---|---|
| Disabled overhead | Effectively zero; Studio tree-shakeable/omittable from production unless explicitly enabled (precedent: `audit`) |
| Enabled dev CPU overhead | Target <5% on representative interactive workloads; investigate >10% |
| Per-event allocation | Compact normalized records; avoid cloning full tree state per mutation |
| History | Bounded by event count and/or bytes with explicit user-visible limit |
| Checkpoints | Sparse/periodic or on-demand; never full-tree snapshot per turn by default |
| Large collections | Virtualized UI; index records rather than render full history |
| AI context | Tool-driven; only relevant evidence returned, with configurable byte/token budgets |
| Session export | Streaming/NDJSON; compression; incremental hashes where practical |
| Production capture | Off by default; bounded duration/fields; separately measured overhead budget |
| Phase 0 seam | Per-event cost explicit and lifecycle-defined before any closure (§8.5) |

### 17.1 Bounded history

Diagnostic history is a separate ownership concern and must not be smuggled into
restoration semantics. Capture can be dropped/rotated independently of
restoration history.

---

## 18. Reliability, evidence discipline, and testing

### 18.1 Truthfulness tests

- Restoration never gains a fake originating actor/turn (MO-3A).
- Net transaction effects match kernel transaction semantics, including
  same-path coalescing and round-trip disappearance (MO-1B).
- Numeric transaction ids from different trees never collide without
  owner/tree namespace (C11).
- External/realized state is not silently classified as local authorship (C14).
- AI FACT claims always resolve to valid EvidenceRefs.
- DERIVED claims are reproducible by deterministic query functions.
- INFERENCE and UNKNOWN cannot be styled as kernel facts.
- Temporal adjacency alone never creates a causal graph edge.
- Subject lifetime identity is not silently replaced by key/path identity.

### 18.2 Observation completeness gate (Phase 0 exit, binding)

Before Studio claims complete "why here" coverage, the supported observation
contract must pass an adversarial mutation-matrix over: bare trees, enhanced
trees (batching, transactions, restoration, devTools), trees mid-`transactions()`
(attempted/committed/rolled-back), entityMap structural/entity operations,
`external()` realization, restoration, destruction, and relevant nested
configurations. Missing observation is surfaced as "coverage incomplete", not
hidden. Transaction-free trees are an **inadmissible** surrogate for this gate
(§20.6): a plain non-transacting tree proves none of the hardest semantics.

### 18.3 AI evaluation

Score answer correctness, evidence coverage, overclaim rate, unknown
recognition, unnecessary data requested, tool-call efficiency, cost. Evidence
discipline outranks raw model quality: a smaller grounded model beats a larger
model that invents lineage.

---

## 19. Feature ranking and roadmap

### 19.1 Feature grid (feasibility corrected per v0.2 review)

Scores are 1–5. `Feas` reflects **current kernel + Phase 0 seam**, not
aspiration. Features marked ⚠ inherit the seam and score no higher than it.

| # | Feature | Val | Diff | Feas | Comm | Phase |
|---|---|---|---|---|---|---|
| 1 | Why is this value here? ⚠ | 5 | 5 | 3 | 5 | P0 |
| 2 | Evidence-backed AI answers | 5 | 5 | 4 | 5 | P0 |
| 3 | Fact / Derived / Inference / Unknown | 5 | 5 | 5 | 5 | P0 |
| 4 | Transaction consequence explorer ⚠ | 5 | 5 | 4 | 5 | P0 |
| 5 | Authored vs realized/external view | 5 | 5 | 5 | 5 | P0 |
| 6 | Semantic timeline ⚠ | 5 | 4 | 3 | 5 | P0 |
| 7 | Ask Studio / BYO AI | 5 | 5 | 4 | 5 | P1 |
| 8 | Current-state responsibility map ⚠ | 5 | 5 | 3 | 5 | P1 |
| 9 | Compare two moments ⚠ | 5 | 4 | 3 | 5 | P1 |
| 10 | Subject/entity history | 5 | 5 | 3 | 4 | P1 |
| 11 | Invariant monitor ⚠ | 5 | 4 | 3 | 5 | P1 |
| 12 | What changed before failure? ⚠ | 5 | 4 | 3 | 5 | P1 |
| 13 | Semantic search ⚠ | 5 | 4 | 3 | 4 | P1 |
| 14 | Structural-change explorer | 4 | 5 | 4 | 4 | P1 |
| 15 | Supersession explorer ⚠ | 5 | 5 | 3 | 4 | P1 |
| 16 | Session comparison | 5 | 4 | 3 | 5 | P2 |
| 17 | Automatic incident report | 5 | 3 | 4 | 5 | P2 |
| 18 | Incident-to-test generator | 5 | 4 | 3 | 5 | P2 |
| 19 | Causal/state graph | 4 | 5 | 3 | 4 | P2 |
| 20 | State checkpoint / bisect | 5 | 4 | 3 | 4 | P2 |
| 21 | Realization/reconciliation inspector | 5 | 5 | 3 | 5 | P2 |
| 22 | Source-code linkage | 5 | 3 | 3 | 4 | P2 |
| 23 | Semantic watchpoints | 5 | 4 | 3 | 4 | P2 |
| 24 | Saved investigations | 4 | 3 | 5 | 5 | P2 |
| 25 | AI privacy/redaction policy | 5 | 4 | 4 | 5 | P1 |
| 26 | Local-model mode | 4 | 4 | 4 | 4 | P1 |
| 27 | Anomaly finder | 4 | 4 | 3 | 4 | P3 |
| 28 | Multi-client divergence | 5 | 5 | 2 | 5 | P3 |
| 29 | Reaction/fan-out explorer | 5 | 5 | 2 | 4 | P3 |
| 30 | Performance consequence view | 5 | 4 | 2 | 5 | P3 |
| 31 | Scenario replay | 5 | 5 | 2 | 5 | P3 |
| 32 | Counterfactual inspection | 4 | 5 | 2 | 4 | P3 |
| 33 | Production Studio session | 5 | 5 | 2 | 5 | P3 |
| 34 | Team investigation sharing | 4 | 3 | 4 | 5 | P3 |
| 35 | Studio plugin/tool API | 4 | 4 | 3 | 5 | P3 |
| 36 | Cross-app semantic comparison | 3 | 5 | 2 | 4 | P4 |
| 37 | Relay semantic continuity | 5 | 5 | 1 | 5 | P4 |
| — | **Observation seam (Phase 0)** | — | — | **gate** | — | **P0-pre** |

> Note on #5: the authored/realized axis is already shipped kernel semantics
> (`external()`). This feature is a projection, which is why Feas is 5 and the
> differentiation is native rather than invented.

### 19.2 Product-bet ranking

| Product area | Score | Rationale |
|---|---|---|
| Semantic state explanation (distributed-responsibility scope) | 10/10 | Closest to SignalTree-native differentiation; foundation for everything else |
| AI semantic investigator | 9.5/10 | Large UX multiplier while keeping the model outside semantic truth |
| Transaction / causal debugging | 9.5/10 | Strong native semantics not naturally modeled by action timelines |
| Invariant + divergence analysis | 9/10 | Turns state semantics into direct root-cause value |
| Entity/structural debugging | 8.5/10 | Strong for data-heavy applications and subject identity |
| Incident comparison / regression generation | 8.5/10 | High workflow value and path to monetization |
| Production semantic debugging | 8/10 | High revenue but materially harder security/ops problem |
| Reactive/performance causality | 7.5/10 | Valuable later; avoid scope explosion in MVP |
| Team collaboration/reporting | 7/10 | Useful monetization layer, weak standalone moat |
| Relay-backed distributed Studio | 7/10 now; possibly 10/10 later | Huge if Relay independently proves distributed semantic value |
| AI provenance/governance | 3/10 | Differentiation not earned in prior falsifier |
| Generic observability replacement | 2/10 | Wrong battlefield; integrate instead |

### 19.3 Recommended MVP

**Prerequisite: Phase 0 seam + observation-completeness gate (§8.5, §18.2).**

> State Explorer + Why Here + Semantic Timeline + Turn Inspector +
> Transaction Inspector + origin/participation (realization) labels +
> Studio-level invariant *evaluation* + Compare + semantic search +
> session import/export.

The realization/origin view and invariant evaluation are pulled into MVP
because the flagship scenario ([A1]) cannot be demonstrated without them; the
kernel already ships the realization facts ([§8.4]), so the cost is a
projection, not new semantics. "First-violating-event" *linkage* ships when the
seam lands.

### 19.4 Roadmap

```
S1        seam: plain tree +        why-here over an atomic parcel;        accept:
          transactions              participation. C11.                    §8.5
S2        seam: + external() /      authored vs external truth; the        §20 gate
          realization               realized handoff. C14.                 runs: GROW/
                                    ---- onboarding measure starts here    HOLD/STOP
S3        seam: + restoration       restoration truthfulness (UNKNOWN,     §20 gate
                                    never an invented parent)              re-runs
S4        seam: + entityMap ops,    full §18.2 adversarial matrix;         §20 gate
          destruction, nesting      composition-safety in general          re-runs

          Each slice ships end to end — seam, causal core, usable surface —
          declares its supported compositions, and refuses outside them.
          Deterministic-only throughout; no AI prerequisite.
P1        Ask Studio / BYO; responsibility map; compare; subject history;
          invariants 1st-event; search; watchpoints; privacy policy; local-
          model mode
P2        Session comparison; incident report; incident-to-test; graph;
          checkpoint/bisect; realization inspector; source linkage; saved
          investigations
P3        Anomaly finder; production capture; reactive/fan-out; replay;
          counterfactual; team sharing; plugin API
P4        Cross-app comparison; Relay continuity (only if Relay earns itself)
```

**Ranking rule (binding).** Within a slice, position is set by how much a
capability reduces a newcomer's time-to-correct-explanation (§20.1) — that is
the adoption lever and the thing being measured. Where two capabilities help a
newcomer equally, prefer the one resting on causal semantics the substrate
uniquely owns (§22.5).

**Growth rule (binding).** A slice is built only after the previous slice
returned **GROW** (§20.7). A **HOLD** stops the next slice until the reason is
diagnosed. This is what keeps the roadmap above a plan rather than a
commitment: everything after the current slice is a hypothesis about where
confusion lives, and each gate is permission to keep spending.

---

## 20. Validation plan — the STUDIO-VALUE-0 gate

### 20.1 What Studio is measured on

The overall goal is **adoption of SignalTree**. Studio is a means to it, not a
separate product to be priced. So the gate measures the adoption lever
directly:

> **Does a developer who does not know SignalTree reach a correct explanation
> of the frozen Cart 88213 incident faster WITH Studio than with SignalTree and
> no Studio?**

Time-to-understanding for a newcomer is the thing Studio has to move. If it
does not cut that, it is not buying adoption, whatever else it does well.

**What this replaces, and why.** Earlier revisions measured Studio against a
rival framework's tooling, then against an absolute bar, then against the
shipped-API path. Those are the right questions for a product that has to
justify a price. They are the wrong question for a tool whose job is to make
the substrate easier to adopt: a convenience feature that removes a day of
confusion has real adoption value even when it is not differentiated moat.

**What is deliberately kept.** "It helps adoption" is nearly unfalsifiable, and
this repository has closed two investigations specifically to stop that kind of
reasoning (`CONTROL-ARM-0`; `STATE-CONSEQUENCE-VALUE-0`, closed
DIFFERENTIATION NOT EARNED). The measure above is falsifiable — it is a time,
against a control condition, on a fixed incident, with a newcomer. The trap
questions, the evidence labelling and the stop condition survive unchanged.

### 20.2 The control condition

The same developer profile, the same frozen evidence, the same questions —
SignalTree with **no Studio**: `devTools()` / `exportDebugSession()`, `audit`
`metadata.description`, ordinary logs, OTel, a debugger.

This is not a rival paradigm and it is not a strawman: it is what a developer
adopting SignalTree gets today. If they can already answer the questions
cheaply, Studio is not what is standing between them and adoption.

### 20.3 The fixture

The frozen Cart 88213 incident (`docs/research/studio-value-0/README.md`)
against the shared backend (`apps/`). Domain is one cart:
`subtotal, promoCode, discount, total, status, serverRevision`.

The incident exercises three semantics, matching the seam slices (§8.5): an
atomic multi-field parcel (S1), an authored→realized handoff (S2), and a
later non-atomic overwrite plus restoration truthfulness (S3).

### 20.4 Run protocol — per slice, not once

The gate is **not** a single end-of-project event. It runs from **S2 onward**,
each time a slice lands, on that slice's declared compositions.

1. Capture runtime evidence from the fixture — no hand-authored narration.
2. sha256-hash the evidence; commit the manifest **before** investigation.
3. Recruit an investigator who does not know SignalTree, did not build the
   slice, and is not told which questions are traps.
4. Run the questions in both conditions: Studio, and §20.2 no-Studio.
5. Score against §20.5. Record the delta in time-to-correct-explanation.
6. Publish the raw evidence and both timings, including the failures.

Running it per slice is the point: it tells you whether the *next* slice is
worth building while it is still cheap to stop.

### 20.5 What to measure

| Measure | Why |
|---|---|
| Time to correct explanation | **The core measure.** Studio vs no-Studio, same newcomer profile. |
| Correctness | Did they reach the right explanation at all? |
| Wrong hypotheses | Did the representation steer them badly? |
| Questions needing prior SignalTree knowledge | Adoption friction Studio failed to remove. |
| Unknown recognition | Did the tool admit missing semantics rather than infer them? |
| Composition refusals | Did Studio correctly declare what it does not observe (§8.5)? |
| Bespoke instrumentation | How much app-specific support had to exist first? |

Unknown recognition and composition refusals cannot be bought with effort, and
a tool that fakes either has made adoption *worse*, not better — a newcomer who
trusts a confident wrong answer is in a worse position than one who got none.

### 20.6 Standing rules

- **Shipped facts only.** A capability whose evidence is still RESEARCH-ONLY at
  gate time is not scored — it is not yet a capability (§8.3).
- **No transaction-free arm.** An arm that avoids attempted/committed/
  rolled-back dodges the hardest causal semantics. S1 ships transactions first
  precisely so this is never necessary.
- **No hand-authored explanation strings.** The inspector derives explanations
  from real machinery, or it does not make the claim.
- **Product-neutral backend logging.** No `knownIssue: PRICE-441` in log lines
  that gives the incident away.
- **The newcomer is real.** Not a teammate who absorbed SignalTree semantics by
  osmosis. The measure is worthless if the investigator already knows the model.

### 20.7 Binding outcomes — evaluated per slice

```text
GROW     Studio materially cuts time-to-correct-explanation vs no-Studio,
         with honest UNKNOWNs and honest composition refusals
         -> the slice earned itself; build the next one

HOLD     no material delta on this slice's semantics
         -> do not build the next slice yet. Either the semantics are not
            where the confusion lives, or the presentation is the problem.
            Diagnose before spending.

STOP     wrong explanations, or a knowledge claim on Q4/Q7, or a silent
         partial answer on an unsupported composition
         -> Studio is making adoption worse; stop and fix or abandon
```

`HOLD` is the outcome iteration exists to make cheap: it costs one slice, not
the whole roadmap. Commercial questions — pricing, team service, production
capture — are downstream of adoption working at all, and are not decided here
(§22.4).

---

## 21. Future Relay integration

Relay remains a separate thesis. Studio does not depend on Relay. If Relay
independently proves SignalTree can preserve meaningful state semantics across
runtime boundaries better than conventional sync systems, Studio becomes the
visibility layer over those distributed semantics.

### 21.1 Potential Relay-enhanced features

- Multi-client semantic timeline across runtimes.
- Authoritative server realization and client reconciliation linked by explicit
  transport correlation.
- Offline capture → replay → server acceptance visualized as one distributed
  workflow where the correlation actually exists.
- Divergence detection across clients/replicas.
- Cross-runtime subject/entity history.
- Production incident packages spanning client, Relay, and backend evidence.

### 21.2 Guardrail

**No borrowed justification.** Relay may not borrow the failed audit/provenance
business case. It must earn itself on distributed application-state semantics,
offline/reconnect, multi-client coherence, reconciliation, and semantic
continuity.

---

## 22. Acceptance criteria

### 22.1 MVP functional acceptance (binding; conditional on Phase 0)

1. **Seam acceptance met** (§18.2, §8.5): adversarial mutation-matrix green
   across the enumerated paths; **C11** and **C14** green. The seam is
   committed work, so this is a definition-of-done on the foundation, not a
   decision about whether to proceed. Until it is met, no capability claim is
   made from RESEARCH-ONLY capture.
2. User can connect Studio to a development SignalTree application with **no
   change to application domain logic**; capture wiring goes through the
   supported adapter, and trees without a stable identity carry a state-side
   label bound in the adapter.
3. Studio can browse current state and select a path/subject.
4. Why Here returns a structured explanation grounded in evidence references,
   and marks restoration lineage gaps and unknown lineage explicitly (§7.2).
5. Semantic Timeline distinguishes at least authored work, transaction effects,
   realized/external changes, restoration, and structural changes where the
   source provides those facts.
6. Turn Inspector and Transaction Inspector show exact before/after **net**
   effects without inventing superseded intra-transaction attempts (MO-1B).
7. Compare can identify semantic differences between two capture points.
8. Semantic search can filter by path and event type.
9. Session capture is bounded and exportable/importable.
10. Missing observation coverage is surfaced, never silently omitted.
11. **Unsupported compositions are refused, not approximated** (§8.5): Studio
    states "I do not observe this composition" rather than rendering a
    confident partial answer. A silent partial answer on an unsupported
    composition is a §20.7 STOP — it makes adoption worse than no tool.

### 22.2 AI acceptance

1. Studio is fully usable with AI disabled.
2. At least OpenRouter and one generic OpenAI-compatible endpoint are supported
   through one provider abstraction.
3. AI uses read-only semantic tools; **no provider request may exceed the
   path-policy × byte/token budget except a single scoped tool return, and every
   request is preceded by a privilege/redaction check.** Asserted in tests.
4. Every FACT claim resolves to one or more valid EvidenceRefs; **DERIVED claims
   are reproducible by re-running the query engine**; INFERENCE and UNKNOWN are
   structurally and visually distinct from FACT in rendered output.
5. Redaction/path policy is applied before any provider request.
6. Provider keys are never included in session files or application state.
7. AI cannot mutate the live application in MVP.

### 22.3 Performance acceptance

1. Disabled Studio integration is **measurably** near-zero: production bundle
   delta with Studio excluded is bounded by a committed byte budget, and the
   integration is tree-shakeable (precedent: `audit`).
2. Enabled development capture overhead is measured against v3-representative
   workloads and compared with the §17 budget; **>10% fails**.
3. History obeys explicit event/byte limits and remains bounded.
4. Large state trees/collections remain usable through virtualization/indexing.
5. AI tool calls obey configurable result-size and token budgets.
6. Phase 0 seam per-event cost is explicit and lifecycle-defined before
   closure (§8.5).

### 22.4 Commercial gate (binding)

Studio's job is adoption of SignalTree (§20.1); it ships free. Commercial
questions are downstream of adoption working at all, and none of them are
decided by the §20 gate.

- **No pricing, team service, or production-capture engineering** is started
  while Studio is serving adoption. §23's "do not set pricing before
  differentiation is measured" stands as a rule.
- If a commercial track is ever opened, it needs its own gate, and the
  differentiation question returns with it — see §22.5, which records where
  durable differentiation would have to live.
- A sustained run of §20.7 **GROW** outcomes is evidence Studio helps adoption.
  It is *not* evidence anyone would pay for it. Those are different claims and
  may not be substituted for one another.

### 22.5 Where differentiation would have to live (recorded)

**This is not a rule about what to build. It is a finding to preserve**, so it
is available if a commercial track is ever opened (§22.4) and so it is not
rediscovered from scratch.

If Studio's advantage is reachable from the shipped API surface (§8.4, §20.2),
then by construction someone else can rebuild it cheaply. Presentation is not a
moat; it is a head start with a fixed expiry. Durable differentiation, if it is
ever needed, lives only in facts the seam reaches — and those facts are exactly
the causal ones: what an operation did as one net consequence, what
participated in it, what came from outside, what a later write superseded.

**Why it does not govern the roadmap.** Under an adoption goal it points the
wrong way. A convenience feature that removes a day of a newcomer's confusion
has real adoption value even though it is trivially copyable, and refusing to
build it because it is not moat would be optimizing for a business model that
does not currently exist. Adoption value and differentiation are separate
axes; §20 measures the first, this section records the second.

The useful residue is a **design bias, not a gate**: when two capabilities help
a newcomer equally, prefer the one resting on causal semantics the substrate
uniquely owns. That is the ranking rule in §19.4, and the reason the seam is
committed (§8.5) — it is the foundation for the capabilities that only
SignalTree can offer, whether or not they are ever sold.

---

## 23. Open issues and decisions

| Issue | Disposition | Status |
|---|---|---|
| Universal observation seam | Highest architectural dependency. Phase 0 with §8.5 exit gates (mutation matrix + C11 + C14). | **Open — gating** |
| Transaction settlement observation | Useful for transaction inspector; ship only if Studio value earns the seam and facts can be surfaced truthfully. | Open / value-gated |
| Exact turn identity surface | Confirm which stable identifiers Studio can rely on across shipped configurations. | Open |
| `PathNotifier` vs `audit` as candidate seams | Inventory-first rule (MUTATION-OBSERVABILITY-0): prove PathNotifier insufficient before building a second observer; `audit` is diff-sampling/polling and is not the seam. | Open — inventory in Phase 0 |
| SignalTree arm + minimal inspector | Not started; the gate cannot run until it exists. | **Blocking the gate** |
| Independent investigator | Must not have built either the inspector or the §20.2 baseline, and must not be told which questions are traps (§20.4). | Open — required before any run |
| What counts as a material delta | §20.7 GROW requires "materially cuts time-to-correct-explanation" but the threshold is not quantified. | **Open — must be set before the first run, not after** |
| Newcomer recruitment | §20.6 requires a real newcomer per slice run; source and profile undefined. | **Open — blocks the S2 gate** |
| Production capture | Separate security/privacy/retention/overhead/deployment spec. | Deferred |
| Standalone shell technology | Browser extension first; Tauri/Electron/web later, after query/session engine stabilizes. | Deferred |
| Source linkage | Requires build/source-map integration design. | Deferred |
| Team service | No cloud requirement for MVP; collaboration follows product validation. | Deferred |
| Commercial packaging/pricing | Not started while Studio serves adoption (§22.4). | Deferred |
| Relay coupling | No dependency until Relay independently passes its own value test. | Deferred |
| AI provider adapter set | OpenRouter + generic compatible endpoint sufficient to establish architecture; direct adapters follow demand. | Open but non-blocking |

---

## Appendix A — Example user workflows

### A1. Wrong current value (the flagship scenario)

Developer selects `order.priority`, clicks Why. Studio shows the latest external
consequence that changed EXPEDITED → STANDARD, the earlier reroute transaction
that is historically relevant but no longer responsible, and — on the cart flow —
the later non-atomic sweep that cleared `promoCode`/`discount` while leaving
`total` at a value that reflects the vanished discount. Distributed
responsibility across authored → realized → partially-superseded is the case
this product exists for.

### A2. Optimistic state disagreement

Developer filters for realizations. Studio shows locally authored optimistic
values followed by authoritative replacement and the exact fields the server
changed.

### A3. Structural disappearance

Developer selects a missing row from history. Subject history shows removal
plus other subjects changed atomically in the same transaction.

### A4. Invariant failure

Studio marks first event where `total = subtotal - discount` became false and
shows changed/unchanged related fields.

### A5. Ask Studio

Developer asks "Why did checkout fail only for this session?" AI compares
good/bad sessions using tools, cites first semantic divergence, and labels the
likely business explanation as inference.

### A6. Regression test

From selected invariant violation, Studio creates a test skeleton using captured
initial state and responsible semantic operation.

### A7. Unknown lineage

Developer asks "Which original action did this undo revert?" Studio answers
UNKNOWN / not represented, while explaining that the value was restored to a
prior recorded state.

---

## Appendix B — Proposed record sketches

```ts
type StudioRecord =
  | StudioTurn
  | StudioEffect
  | StudioTransaction
  | StudioSubject
  | StudioRestoration
  | StudioInvariantResult;

interface StudioEffect {
  id: string;
  treeId: string;
  turnId?: string;
  path: string;
  positionId?: number;
  subjectId?: string;
  kind: "set" | "add" | "remove" | "rekey";
  before?: unknown;
  after?: unknown;
  origin?: string;          // maps to shipped external() classification
  participation?: string;   // authored vs realized
  transaction?: { ownerId: string | number; transactionId: number };
  narrative?: string;       // app-supplied only; renders as narration, never fact
  observedAt: number;
  sourceClass: "SHIPPED" | "RESEARCH" | "EXTERNAL";
}
```

---

## Appendix C — Example Ask Studio response

> Question: Why is total $102 when discount is $0?

```
FACT      T142 changed total $120 → $96 during the optimistic transaction.
          Evidence: [effect:T142:3]

FACT      R143 realized authoritative discount $24 → $18 and total $96 → $102.
          Evidence: [effect:R143:1, effect:R143:2]

FACT      T191 later changed discount $18 → $0 and did not change total.
          Evidence: [effect:T191:2]

DERIVED   The invariant total == subtotal - discount became false immediately
          after T191.  Evidence: [invariant:cart-total:T191]

INFERENCE The maintenance path likely omitted a required total recomputation.

UNKNOWN   Whether product requirements intended total to be recomputed at
          this stage.
```

---

## Appendix D — Summary product definition

**One-line definition.** SignalTree Studio is a local-first semantic debugger
that lets developers inspect, query, compare, and AI-analyze the state semantics
SignalTree actually owns — scoped to distributed-responsibility flows — while
preserving an explicit boundary between recorded facts, deterministic
derivation, model inference, and unknowns.

**The initial product succeeds if** a developer can click a surprising state
value in a flow where responsibility is spread across an atomic operation, a
realized handoff, and a partial supersession, obtain a truthful semantic
explanation in seconds, inspect the exact transaction/turn/effects behind that
explanation, compare alternate points or sessions, and optionally ask their
preferred AI model to investigate using the same evidence model — **and if
Studio clears the §20 bar on the frozen incident: the load-bearing questions
represented intrinsically, the trap questions failed honestly.** Everything else — team services, production capture,
performance causality, and Relay continuity — follows only after that foundation
proves differentiated value, and only in the order §1 and §19.4 define.