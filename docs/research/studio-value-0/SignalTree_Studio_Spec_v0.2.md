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
| Supersedes | v0.1 (2026-09-08); **amends STUDIO-VALUE-0 preregistration** (see §0) |
| Date | 2026-09-08 |
| Primary product statement | SignalTree is state with semantics. Studio makes those semantics visible, searchable, comparable, and explainable — scoped to the flows where SignalTree actually owns the facts (see §3). |
| Kernel relationship | Studio consumes SignalTree semantics; it must not distort kernel truth to make explanations prettier. |
| AI relationship | AI is optional, user-selected, read-only analysis over Studio evidence; AI is never the source of semantic truth. |
| Commercial sequence | SignalTree v15 substrate → **observation seam (Phase 0 gate)** → Studio wedge → Relay only if distributed semantics independently earn it. The wedge proceeds commercially only on the preregistered go/park/stop outcome (§20, §22). |

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
20. Validation plan — amends STUDIO-VALUE-0
21. Future Relay integration
22. Acceptance criteria
23. Open issues and decisions

Appendices — schemas, examples, and API sketches

---

## 0. Revision record and lineage

v0.2 is the response to an adversarial review of v0.1. The review was grounded
against the current 15.0 kernel surface and the repository's existing research
lineage: `docs/research/studio-value-0/` (preregistration + two-app build scope),
`TODO.md` §MUTATION-OBSERVABILITY-0 and the "three constraints Studio inherits"
section, and `docs/ADSP/SignalTree_Protection_Commercialization_Adversarial_Audit_v0.6.md`
(falsifier #10: *"if Studio is merely logs, traces, or Redux/NgRx DevTools with
more metadata, the thesis is weak"*).

### 0.1 Findings and dispositions

| # | Finding (v0.1 review) | Disposition in v0.2 |
|---|---|---|
| F1 | Wedge overstated: "why is this value here" is usually answered by single-writer correlation, which a competent control wins. Differentiation survives only in *distributed-responsibility* flows: multi-write atomic parcels, authored→realized handoffs, non-atomic later overwrites. | §3 reframes the wedge. Flagship demo and validation score distributed-responsibility cases like-for-like. |
| F2 | v0.1 replaced the STUDIO-VALUE-0 preregistration without engaging it; preregistration discipline invalidated. | §0, §20: this spec **amends** the preregistration. The two-app/one-backend build remains the primary engaged experiment. v3 migration admitted only as a gated supplemental track. |
| F3 | Feasibility scores overstated on every feature that inherits the unshipped observation seam (#6, #8, #9, #11, #13), and understated where the kernel already ships the fact (#5). | §19 table corrected; seam given its own roadmap row; #5 reframed as projection of shipped kernel semantics. |
| F4 | No roadmap item earns the observation seam itself before any P0 feature. | §8.5 adds **Phase 0**: seam + adversarial mutation-matrix gate (C11, C14). §22.1 made conditional on it. |
| F5 | MVP could not demo the headline cart-88213 story (invariants/realization not in MVP). | §19.2 adds realization/origin view (already shipped kernel facts) and Studio-level invariant *evaluation* to MVP; "first-violating-event" linkage ships when the seam lands. |
| F6 | Acceptance criteria non-measurable or self-contradictory (22.1.1). | §22 rewritten: assertable budgets, reproducible DERIVED, structurally distinct INFERENCE/UNKNOWN, measurable overhead, hard commercial gate. |
| F7 | Narrative moat thinner than claimed: kernel already ships a narrative hook (`audit` `metadata.description`); kernel also ships a Redux-DevTools adapter via `devTools()`. | §3 and §8.4 record both facts honestly. Moat rests on the semantic layer, explicitly not on absence of actions. |
| F8 | v3 validation has no exposure decision; v3 is an employer codebase. | §20.5 requires an explicit exposure decision (anonymize/redact or internal run) plus evidence hash-and-freeze before any investigation. |
| F9 | Review bibliography absent; provenance falsification uncredited. | Lineage credited in §2.1 and §20. |

### 0.2 Relation to prior research

- **STUDIO-VALUE-0 (preregistration, README.md):** the gate for the wedge.
  Sequence: control first, blind investigation, *then* minimum inspector. Bar:
  material win or stop. Status at time of writing: BLOCKED — synthetic control
  invalid; the instrument failed, not the thesis. **Unchanged and adopted.**
- **STUDIO-VALUE-0 (BUILD-SCOPE.md):** the admissible discriminator — one tiny
  cart app built twice against one neutral backend, NgRx arm vs SignalTree arm +
  minimal inspector. Backend built; NgRx arm not started; NgRx practitioner at
  this writing **not secured**. **Adopted as the primary experiment.** Two of its
  standing rules are restored here (§20.6): no transaction-free SignalTree arm;
  label every fact SHIPPED / RESEARCH / DERIVED.
- **MUTATION-OBSERVABILITY-0 and MO-1B / MO-3A:** the observation seam and the
  two provenance "hard entry controls" (C11 multi-tree transaction-owner
  isolation, C14 realization/restoration causal derivation). Net-effect
  coalescing (MO-1B) and restoration-without-parent (MO-3A) are **kernel
  constraints, not Studio design choices**. §8 and §22.1 carry them verbatim.
- **ADSP v0.6 falsifier #10:** Studio must be provably *more* than
  "logs, traces, or Redux/NgRx DevTools with more metadata." This is the null
  hypothesis the validation must be able to confirm.

---

## 1. Executive summary

SignalTree Studio is the proposed semantic debugger and investigation
environment for SignalTree applications. It is not a recreation of Redux/NgRx
DevTools, not an observability platform, and not an AI chatbot around logs.
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
exclusively from it. **If the preregistered experiment does not show a material
win on that scenario, the commercial track stops** (§20, §22.1).

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
1. Ship the observation seam (Phase 0) on the v15 substrate.
2. Validate the wedge against the preregistered two-app experiment (§20).
3. Only on outcome A (decisive win) build the Studio wedge commercially.
4. Relay only if distributed semantics independently earn it (§21).
5. Provenance/audit/pricing/team are all downstream and re-earned, never
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
  and the preregistered comparison is run (§20).
- *"Why is this value here?"* is the entry point for the narrow wedge — and
  Studio expands into a semantic debugging environment rather than terminating
  at a timeline, once the wedge is validated.
- AI belongs above Studio — an analyst over structured evidence, not the source
  of evidence.
- Bring-your-own-model is a first-class requirement — provider choice, local
  inference, enterprise endpoints, and user-controlled cost/privacy.
- Validation must use fair controls — the committed experiment is the
  two-app/one-backend build; the v3 historical migration is a gated supplement
  (§20.5).

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
- The kernel already ships a `devTools()` enhancer that speaks Redux DevTools.
  Studio is competing on top of a free existing path. Its marginal value is
  exactly the semantic differentiation above; there is no free "not Redux
  DevTools" argument.

The product must not assume superiority. Studio must earn its case in the
preregistered two-app experiment. If ordinary action narrative plus competent
instrumentation answers the scoped questions at similar cost, Studio remains a
developer convenience rather than a commercial wedge, and pricing/team/production
work is not started (§22.4).

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
| Control built to win | Every competitive validation assumes a competent conventional implementation and strengthens the control before comparing. |
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

### 8.2 Proposed Studio observation contract (Phase 0 target, not yet earned)

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

### 8.5 Phase 0 — earn the seam (new)

**Work item, precedes every P0 Studio feature on the roadmap (`§19.4`).**

> Prove one composition-safe internal observation boundary over
> existing mutation and settlement facts — sufficient for why-here,
> transactions, realization, restoration, and structural effects — without
> adding new state semantics.

Exit criteria (binding):

1. The adversarial mutation-matrix in §18.2 passes against: bare trees,
   enhanced trees (batching, transactions, restoration, devTools), trees under
   `transactions()` mid-flight, entityMap structural operations, `external()`
   realizations, restoration, destruction, and nested combinations.
2. **C11** — multi-tree transaction-owner isolation: numeric transaction ids
   from different trees never collide without owner/tree namespace.
3. **C14** — realization/restoration causal derivation: derived facts carry no
   false actor inheritance; restoration exposes no invented parent.
4. Every event carries explicit cost and lifecycle semantics; capture is
   droppable independently of restoration history (§17.1).
5. The seam is stable enough that `PathNotifier` state does not leak (no global
   singleton resets between trees; ownership invariant enforced).

**If C11 or C14 fails, or the mutation matrix reveals a missing kernel fact,
frame B of the commercial thesis collapses to C — the seam decision gate in
TODO.md MUTATION-OBSERVABILITY-0.** The two-app experiment may use RESEARCH-ONLY
instrumentation to evaluate value before this lands (§20.6), but no shipping
Studio capability claim may rest on it.

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
Phase 0   OBSERVATION SEAM          earn one composition-safe boundary;     gate:
          (P0-pre)                  pass §18.2 matrix + C11 + C14           §8.5, §18.2
Phase 0   WEDGE VALIDATION          two-app experiment (§20); consume       A/B/C/D
                                    outcomes BEFORE any commercial spend
P0        MVP (list above)          deterministic-only; no AI prerequisite
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

---

## 20. Validation plan — amends STUDIO-VALUE-0

### 20.1 Relationship to the preregistration

This section **amends** `docs/research/studio-value-0/README.md` +
`BUILD-SCOPE.md`. It does not replace them. The preregistered gate —
*control first, blind investigation, minimum inspector last; material win or
stop* — is unchanged and binding. The preregistered bar is carried verbatim:

```text
control 4 minutes vs Studio 3 minutes   ->  NO BUSINESS
```

### 20.2 Primary experiment (engaged, unchanged direction)

The two-app/one-shared-backend cart build from BUILD-SCOPE.md. Domain is one
cart: `subtotal, promoCode, discount, total, status, serverRevision`. NgRx arm
(full DevTools + OTel + backend correlation) vs SignalTree arm + minimal
inspector answering one data-grounded question. **Status: backend built; NgRx
arm not started; NgRx practitioner not secured — required before any run
(BUILD-SCOPE design issue 4).**

Scenario (the distributed-responsibility flow that defines the wedge):

```text
1. user applies SAVE20
2. client performs an OPTIMISTIC update     (atomic: promoCode+discount+total)
3. server validates and applies a DIFFERENT authoritative discount (tier cap)
4. client reconciles
5. later, a backend maintenance push expires the promo
6. the push clears promoCode + discount and FAILS to recompute total
7. UI ends internally inconsistent: total reflects a discount no longer present
```

### 20.3 v3 historical migration — gated supplemental track (v0.2)

v0.1 proposed "the real v3 NgRx-to-SignalTree migration" as the preferred
validation. v0.2 **downgrades it to a supplemental track conditional on five
gates**, because a real migration is a stronger fixture but carries risks a
hand-built arm does not:

1. **Exposure.** v3 is an employer codebase. Before any capture: decide
   anonymize/redact, or run internally on non-IP material. Public evidence from
   v3 domain state is otherwise forbidden.
2. **Clean freeze.** A genuinely clean boundary must exist: last clean
   NgRx/SignalStore revision and first clean SignalTree revision of the same
   feature, diverging only in the state layer. If the migration crossed
   features or state layers together, the candidate is rejected (selection
   protocol, below).
3. **Discriminator presence.** The chosen feature must contain the
   distributed-responsibility flow (§3.1). BUILD-SCOPE warned a real cart flow
   contains no atomic multi-field operation unless one is built deliberately —
   same caution applies to choosing a v3 feature.
4. **Neutral control authoring.** The NgRx arm of a real migration is authored
   by the migrating team(s) — the interested-party bias is *not* removed by
   realism. An independent NgRx practitioner must review/benchmark it.
5. **Hash-and-freeze.** Raw evidence from both arms is sha256-hashed and the
   manifest committed before investigation, by someone who built neither arm.

If any gate fails, the track is dropped without weakening the primary
experiment. The primary experiment never waits on v3.

### 20.4 Selection protocol (for either real-history track)

1. Identify a feature/store with a clean historical migration boundary.
2. Freeze the last clean pre-SignalTree version and first clean SignalTree
   version of the same feature.
3. Enumerate all non-state-layer functional changes; reject if equivalence is
   too weak.
4. Prefer a real historical state bug or the injected shared-boundary defect;
   the injection point must be identical for both arms.
5. Capture actual runtime evidence from both examples.
6. Hash/freeze evidence before investigation; investigators built neither arm.
7. Score ordinary root-cause questions and the semantic questions Studio claims
   to make intrinsic.

### 20.5 What to measure

| Measure | Why |
|---|---|
| Correctness | Did the investigator reach the right explanation? |
| Time | How quickly? |
| Tools consulted | How many separate surfaces? |
| Manual joins | How much cross-tool correlation (ID-based vs inferential)? |
| Wrong hypotheses | Did one representation steer investigation incorrectly? |
| Bespoke instrumentation | How much app-specific support had to exist? |
| Semantic coverage | Which questions are represented intrinsically vs reconstructed? |
| Evidence discipline | Could every asserted fact be traced to actual evidence? |
| Unknown recognition | Did the tool admit missing semantics rather than infer them? |

### 20.6 Standing rules restored from BUILD-SCOPE

- **No transaction-free SignalTree arm.** A comparison that avoids
  attempted/committed/rolled-back deletes the hardest causal semantics and
  proves differentiated causality by dodging it. Derive the seam first
  (Phase 0) — or use RESEARCH-ONLY instrumentation and label it.
- **Label every fact** the inspector uses: SHIPPED SEMANTIC FACT /
  RESEARCH-ONLY OBSERVATION / DERIVED BY INSPECTOR / EXTERNAL EVIDENCE. A
  conclusion resting on a research-only hook is not a Studio capability claim.
- **Control built to win.** If one extra action field makes a question trivial,
  add it. No hand-authored explanation strings in the SignalTree arm; the
  inspector derives explanations from real machinery.
- **Product-neutral backend logging.** No `knownIssue: PRICE-441` in log
  messages that gives the incident away.

### 20.7 Preregistered outcomes (binding)

```text
A  Studio wins decisively
   faster / more correct, fewer joins, materially less app-specific
   instrumentation                          -> Studio wedge EARNED; commercial
                                               sequence proceeds
B  roughly equivalent
   Studio cleaner but control gets there cheaply -> PARK; free developer
                                               tooling only; no pricing/team/
                                               production spend
C  control wins
   action narrative + ordinary instrumentation easier -> STOP the Studio
                                               commercial track
D  candidate requires hypothetical/unshipped kernel machinery
   -> experiment cannot support the Studio claim; narrow or stop (see Phase 0)
```

These outcomes are consumed before any commercial spend, not after (§22.4).

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

1. **Observation-completeness gate passed** (§18.2): adversarial mutation-matrix
   green across the enumerated paths; **C11** and **C14** green
   (§8.5). Until then, "Studio can browse current state" (§2) does not pass and
   no capability claim is made from RESEARCH-ONLY capture.
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

### 22.4 Commercial gate (binding; new in v0.2)

- §20.7 outcome **A** is required before any commercial investment: pricing,
  team service, or production-capture engineering.
- On **B**: MVP may ship as free developer tooling; nothing commercial starts.
- On **C**: the Studio commercial track stops.
- On **D**: claims are narrowed to what ships, and the seam is re-earned.
- §23 "Do not set pricing before differentiation is measured" is upgraded from
  a disposition to a rule: pricing is not set before A.

---

## 23. Open issues and decisions

| Issue | Disposition | Status |
|---|---|---|
| Universal observation seam | Highest architectural dependency. Phase 0 with §8.5 exit gates (mutation matrix + C11 + C14). | **Open — gating** |
| Transaction settlement observation | Useful for transaction inspector; ship only if Studio value earns the seam and facts can be surfaced truthfully. | Open / value-gated |
| Exact turn identity surface | Confirm which stable identifiers Studio can rely on across shipped configurations. | Open |
| `PathNotifier` vs `audit` as candidate seams | Inventory-first rule (MUTATION-OBSERVABILITY-0): prove PathNotifier insufficient before building a second observer; `audit` is diff-sampling/polling and is not the seam. | Open — inventory in Phase 0 |
| Two-app NgRx arm authorship | NgRx practitioner not secured; required before any run (BUILD-SCOPE issue 4). | **Blocking the primary experiment** |
| v3 supplemental track | Gated on §20.3 (exposure, clean freeze, discriminator, neutral author, hash-freeze). | Deferred / conditional |
| Production capture | Separate security/privacy/retention/overhead/deployment spec. | Deferred |
| Standalone shell technology | Browser extension first; Tauri/Electron/web later, after query/session engine stabilizes. | Deferred |
| Source linkage | Requires build/source-map integration design. | Deferred |
| Team service | No cloud requirement for MVP; collaboration follows product validation. | Deferred |
| Commercial packaging/pricing | Not set before outcome A (§22.4). | Deferred |
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
preferred AI model to investigate using the same evidence model — **and if the
preregistered comparison shows a material, instrumentation-fair win over a
control built to win.** Everything else — team services, production capture,
performance causality, and Relay continuity — follows only after that foundation
proves differentiated value, and only in the order §1 and §19.4 define.