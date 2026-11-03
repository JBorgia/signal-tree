# SignalTree's role in multi-actor applications

Research synthesis, October 29, 2026. **Recommendation, not an accepted API, runtime design, release-scope change or implementation authorization.**

## Conclusion

SignalTree should be a framework-native application-state engine with trustworthy mutation and settlement semantics, complemented by an optional application-operation layer for human and agent workflows. It should let applications explain what changed, whose operation authored it, what evidence it depended on, what survives, and what may be published. It must distinguish observed facts, application declarations and unknowns.

The core must remain useful without agents. Agents make coherent mutation, review and recovery more valuable; they do not require an LLM, an identity provider or a distributed workflow engine inside a store.

The full product is not simply a kernel. It comprises:

1. A correct reactive state engine and framework facades.
2. Optional operation integration: application context, reviewed revisions, local settlement and server-outcome correlation.
3. Thin protocol adapters and application examples, built on existing protocols.
4. Studio for private diagnostic recording and investigation, without making private tooling necessary for public correctness or basic application review UI.

**The missing connection is between an application operation and its actual effects.** Identity, agent orchestration, tool transport, databases and telemetry already cover adjacent responsibilities. SignalTree should preserve the state facts those systems cannot reconstruct from a final value or a tool-call log.

This is a justified product direction, not a claim of market exclusivity or proven implementation superiority. A simpler command/API stack is sufficient for many applications. The distinctive workload is interactive, overlapping human/agent edits with preview, conflict, safe withdrawal and independently eligible synchronization.

## Evidence and scope

The [source ledger](SOURCES.md) distinguishes existing implementation documentation, standards, draft protocols, demand evidence and architectural inference. The [acceptance scenarios](ACCEPTANCE.md) specify falsifiable whole-workflow outcomes, not test results.

Local identities inspected:

- This research checkout: `fix/d1-d2-forward-port`, `628d302dadb082a48c58528651c9088234d0a777`, `16.0.0-dev`. Untracked `frontier` is unrelated and untouched.
- Active readiness checkout: `/Users/jonathanborgia/.codex/worktrees/v16-incumbent-readiness/signaltree`, evidence HEAD `5727cd8f` at inspection. Existing AGENTS.md and measurement-contract edits are untouched.
- Retained runtime identified by that controller: `87f6831fa60cafe87508f0ace84b7638698ca3b0`. This is a retained development runtime, not a claim that v16 is published.
- Latest reviewed collection candidate: `87ddcfdedcb5d91e700d812bd6cbee2f77038510`, rejected. New-recipient validation, omitted-collection obligations and relationship-local ingress permission remain decisive failures.
- B's replacement track remains closed. No runtime successor, package, public API or ceiling is selected here.

This research includes primary-source browsing, local types/contracts and evidence-record inspection, and independent review. No runtime suite, external library bake-off, customer interview, adoption pilot or new performance measurement was executed. Historical tests are attributed to their records, not claimed as new reproduction.

## The need is established; the packaging is a decision

Evidence already supports agent attribution, controlled actions, shared state, concurrency handling, approvals and recovery. Microsoft has agent identity logging and server-owned approval rules; LangGraph documents conflicting concurrent updates; Salesforce documents action correlation, compensation and safe retries; Chrome is developing structured browser-agent tools. These are concrete product mechanisms, not only forecasts. [S1–S8](SOURCES.md)

The evidence does not establish that every site needs live speculation, that every agent can be authenticated by a browser library, or that one particular rollback representation wins. Those are different questions from whether consequential multi-actor changes need dependable handling.

## Actors and trust

| Actor | Normal entry | Attribution boundary |
| --- | --- | --- |
| Human | UI or API | Authenticated session and application operation; a click alone does not prove a human generated it |
| Embedded agent | Application tools/backend actions | Run and operation IDs can be supplied by the host; permissions still come from application/server policy |
| Browser agent | Tools such as WebMCP, or UI actuation | Tool context may provide correlation; browser credentials alone do not attest a separate agent identity |
| Machine agent | Mouse/keyboard/process/API activity | Application sees resulting supported operations; external executor identity may remain unknown |
| External service | Subscription, response or command callback | Authenticated source and explicit version/correlation evidence; arrival alone is not authority |

Do not label all UI events human, all external updates authoritative, or all authenticated requests user-approved. An actor label is not a credential. WebMCP explicitly discusses inherited browser identity and is still a draft. [S7]

## Product contract: four boundaries

### 1. Application operation

A meaningful user/agent action has a stable correlation identity, validated arguments, relevant base/input evidence, and application-supplied actor context. These are supplied and enforced at explicit boundaries, not inferred from primitive values.

An operation can span several local transactions, asynchronous attempts and backend commands. **Agent run, application operation, local transaction, delivery attempt and server commit are different identities and lifecycles.** The companion maps them without pretending a synchronous scope follows arbitrary promises, closures or processes.

Ordinary leaf setters remain ordinary setters. No mandatory Redux-style actions/reducers or command bus is proposed for basic state. Consequential agent actions benefit from named application capabilities because they establish input, validation and attribution boundaries.

### 2. Native mutation

The kernel records actual installed value, membership, lifetime and order effects, with coherent responsibility and publication. It does not trust an agent's proposed diff as proof of the effects actually installed.

Physical display, ordinary truth and authored changes remain distinct where inspection requires them. Review and publication consumers must receive the relevant facts from their native owner; they must not reconstruct ordinary authority from a displayed row or late notification payload.

Destination settlement ownership, known input dependencies, fixed possible-owner holds, shared validation and recipient uncertainty remain separate roles even when owner identities coincide. Known ownership is never proof of input independence.

These are semantic requirements, not a selection of persistent roots, global replay, whole-store copies or a new ownership engine. Existing approved semantics and B's closure remain in force.

### 3. Review and local settlement

An application must distinguish what was proposed, what is currently visible, what has been superseded and what remains settleable. Useful safe refusal is an explicit outcome under the approved newest-open-first contract; arbitrary-order success is not silently added.

For the complete multi-actor product, approval must refer to the reviewed operation revision and its effect/input preconditions. Reentry or intervening writes cannot silently substitute another operation. Changes outside the relevant footprint need not invalidate everything; affected preconditions must be revalidated. A conservative whole-operation revision check is a legitimate initial implementation if its cost to usefulness is disclosed.

**Exact revision-bound approval is a proposed companion contract, not an existing guarantee of `inspect()` followed by `confirm()`.** Public inspection currently provides contribution status and identity-related addressing, not an immutable security approval artifact or a complete before/after snapshot. The minimum neutral seam for safe review must be proven before selecting exports.

Approval authority remains application/server-owned. A client preview is not permission to execute. Partial approval must define dependency-safe suboperations; arbitrary slicing of a semantic unit is not assumed supported.

### 4. Publication and external outcome

A connection may send only a projection whose actual participating facts and obligations permit that send. Each connection has its own acquisition/recipient authority. Adding a recipient cannot clean unfinished evidence; removing an ancestor from a payload removes its obsolete participation without dropping genuine consumed-input dependencies.

The approved target Link contract remains: conservative undeclared behavior with bounded possible-owner holds, and conditional progress under qualified declarations. This is not qualified production behavior: conservative production holding remains, and the declaration candidate is rejected. Neither drafts nor outboxes silently replace the approved target.

Eligible, queued, sent, acknowledged and applied are different states. A local `confirm()` does not prove a server commit. Existing `Link.settled()` can resolve after an endpoint `set()` rejects; delivery failure is observed separately. Neither completion signal may be presented as proof of successful persistence. Lost acknowledgements require correlation and idempotency at the authoritative endpoint. A local rollback cannot unsend an email, reverse a payment or compensate a remote service by itself. HTTP conditional requests and backend-specific revision checks provide existing mechanisms for stale-write prevention. [S9–S11]

## Recommended responsibility map

| Capability | Owner | Placement rule |
| --- | --- | --- |
| Native reactive state, entity lifetimes and typed addressing | Kernel | One local semantic authority |
| Complete installation/capture and coherent publication | Kernel | Must be correct before consumers run |
| Transaction inspection, refusal/recovery and restoration | Kernel/enhancers | Reuse existing supported settlement semantics |
| Source revision/effect evidence needed for faithful review | Minimum neutral kernel seam, only if needed | Do not promote diagnostic scopes into correctness certificates |
| Link eligibility, contributor replacement and obligation retirement | Kernel-owned Link semantics | A separate adapter cannot infer missing native facts |
| Framework scheduling/carriers and lifecycle | Each framework facade | Native computed timing remains framework-owned |
| Principal/executor/run/operation correlation | Optional operation companion | Application supplies trust context; kernel may carry opaque correlation where necessary |
| Revision-bound review, approval UX and conflict workflow | Companion plus application | Uses native facts; no second rollback or settlement engine |
| Domain rules and permission decisions | Application/backend | No generic kernel policy decides who may reschedule a truck |
| AG-UI, MCP/WebMCP, agent SDK mappings | Thin optional integrations | Protocol events are translated, never granted implicit ordinary-state authority |
| Distributed agent coordination | Existing A2A/agent infrastructure where needed | Not required merely because two agents edit one application |
| Durable commands, persistence, idempotency and compensation | Existing backend/workflow infrastructure | Server is authoritative for external effects |
| Diagnostic sessions, recording and query engine | Private Studio | Existing boundary preserved |
| Public telemetry/export hooks | Minimal public facts and optional exporters, after surface review | No duplicated private Studio implementation; correctness independent of diagnostics |

The companion may own proposal records, correlation and workflow status. It must not independently declare native effects current, settleable or publishable. Consuming approval must validate its bound evidence at the authoritative mutation/settlement boundary. An inspect–await–confirm sequence is insufficient. If the public surface cannot make validation and action indivisible against intervening writes or reentry, that is a blocked seam proposal—not permission to build a shadow effect ledger.

Start with **one companion prototype and one protocol adapter**, not a package for every row. Package names, exported APIs and distribution are not selected. The current public five-package plan remains unchanged until owner-approved evidence justifies expansion.

The first adapter should be selected by the reference workflow: AG-UI for embedded agent/backend interaction or experimental WebMCP for browser-agent tools. A2A is an integration when actual remote-agent delegation is present, not a mandatory layer. Plain HTTP remains a viable transport.

## Existing alternatives and positioning

| Approach | Strongest use | What remains application work / needs comparison |
| --- | --- | --- |
| Ordinary store + versioned server commands + agent tools | CRUD and mostly serialized workflows | Review correlation and UI optimistic state; often sufficient without SignalTree |
| TanStack DB + versioned backend + immutable proposals | Normalized data, live queries and review without modifying accepted entities | Conflicting optimistic rollback can cascade; exact review, lifetime and dependent-work requirements need matched tests. Durable outbox/sync acknowledgment integrations already exist |
| Yjs/CRDT stack + approval workflow | Concurrent collaborative shared documents | Origin-selective undo exists; semantic approval, business constraints and durable external effects remain separate |
| Replicache-style mutators + authoritative backend | Local-first optimistic data and server reconciliation | Review-before-execution and actor/approval mapping; do not turn command replay into arbitrary callback replay |
| XState/agent workflow + store | Explicit workflow transitions and long-lived process coordination | Data mutation identity/rollback semantics remain a separate concern |
| SignalTree + optional operations + existing agent protocols | Application-shaped reactive state with entity lifetimes, review, restoration and conditional synchronization | Current composition defects must close; API burden and equivalent-workload costs must be measured |

These are documented capability comparisons, not executed equivalence results. Yjs already offers selective undo; TanStack DB already separates optimistic and synced state. No unsupported claim that SignalTree uniquely owns those ideas is made. [S12–S15]

### Strategy selection

**Recommend:** strengthen the current state engine and expose the smallest truthful seams; prototype accountable application operations outside it. This preserves simple state DX while allowing richer agent integration.

**Do not select:** an all-in-one agent platform in the kernel, automatic inference of arbitrary JavaScript causality, a second correctness engine in a companion, mandatory event sourcing, or a new B replacement. Event sourcing can serve a backend domain when justified; it is not required for every reactive tree. [S16]

Isolated drafts and outboxes remain valid workflow options. They do not retroactively satisfy the selected same-tree conditional-Link requirement and do not make distributed consistency or approval semantics disappear.

## Current SignalTree gap map

| Area | Established evidence | Remaining requirement |
| --- | --- | --- |
| Local transactions | Public transact/inspect/confirm/rollback and recovery contracts | Whole supported composition qualification, not blanket arbitrary-order success |
| Entity/inspection/ordinary separation | Existing implementation and extensive bounded repairs | Current installation, inverse, selection and framework failures remain blockers |
| Conditional publication | Reviewed declarations, possible-owner policy and many discriminators | Current collection successor rejected; no production claim |
| Public tooling | Versioned `/internals` includes active transaction context, lifecycle/refusal and Link activity/failure observations | Reuse these before proposing exports; synchronous context and reader sequences are not a global review revision or durable server receipt |
| Attribution | Synchronous declared observation scopes and write observations | Scopes are diagnostics, not complete causal read sets, authenticated identity or durable audit |
| Human/agent review | Contribution inspection exists | Exact review revision, effect description and authoritative approval correlation require a demonstrated companion seam |
| Async operations | Application composition is possible | Explicit context continuation; no implied ambient causal propagation |
| Network execution | Link endpoint callbacks and delivery/failure observations | `settled()` may resolve after failed delivery; no inferred backend idempotency, distributed transaction or durable acknowledgement |
| Lifecycle and performance | Historical bounded results exist | Exact final-candidate retirement, installed consumers and populated-workload evidence remain open |

Relevant source and readiness records are linked in [SOURCES.md](SOURCES.md). Source availability is not shipped-artifact qualification.

## One product workflow, multiple entry paths

Use a synthetic dispatch editor, not live TruckTrax data. A site-owned scheduling agent proposes a route change. A browser agent changes an independent note through a tool. A human edits a conflicting time window. A service changes capacity. The user reviews a specific proposal revision, resolves a conflict, accepts eligible work, and observes a delayed/lost acknowledgement.

Repeat the browser action through UI actuation with executor identity unknown. The state rules must still hold. Do not rely on agent identity to make concurrency correct.

The same application operations should work without AI, with deterministic scripts. This isolates the library guarantee from model quality. Add real agents only after deterministic scenarios pass; they exercise discoverability and usability, not replace semantic oracles.

Compare a simpler versioned-command/store arm with SignalTree and with SignalTree plus the companion. Give every arm the same external guarantees and allowed refusal policy. Measure application glue, developer mistakes, useful progress, latency, retained obligations and runtime costs. A smaller API is not better if it hides required correctness code in the application.

## Finite route from research to production

1. **Use the existing acceptance ledger.** Keep current release blockers distinct from proposed product additions. This report is not another release controller.
2. **Close the current recurrence design gate.** The next authorized mechanism must cover source facts, aggregate participation, relationship permission, validation, wake-up and retirement together. Keep immutable first failures. Do not resume stopped runtime work on this report's authority.
3. **If separately selected, prepare an operation prototype without claiming kernel readiness.** Attempt public-only review/correlation; record precisely where existing APIs cannot express it. That evidence, not speculative API design, determines minimal seam proposals.
4. **For that separately selected product experiment, qualify the whole synthetic workflow** against the [acceptance scenarios](ACCEPTANCE.md), supported frameworks and installed artifacts. No private-import demo workaround counts as adoption evidence.
5. **Compare realistic costs and developer burden.** Use the existing measurement policy. Establish thresholds before measurements; disclose unavailable capabilities. No comparative speed or memory result is inferred here.
6. **Finish existing release qualification and authorize any new surface separately.** New companion/API commitments require owner selection. The companion prototype and full-product qualification are future selectable work, not v16 release dependencies unless explicitly approved.

The strongest existing-stack control must be allowed to win. If it achieves the same outcomes with equal or lower integration burden and no material lost capability, the multi-actor-specific SignalTree recommendation is unsupported; ordinary SignalTree development may continue on its separate merits. Documented application logic counts equally for every arm.

Research is complete enough to recommend this product identity and ownership split. It is not complete enough to select a new internal algorithm, claim market uniqueness, promise delivery dates, or pronounce v16 ready. Those are explicit engineering/adoption gates, not reasons to reopen whether accountable multi-actor mutation is needed.

## Deliberate non-goals

- Inferring whether every click came from a human or a machine.
- Recovering complete provenance from arbitrary cached values or external programs.
- Explaining a model's true internal reasoning from state logs.
- Authenticating agents by trusting caller-supplied labels.
- Making local transaction confirmation equivalent to durable server success.
- Reimplementing LLM orchestration, identity issuance, CRDT replication or a workflow server.
- Requiring agent metadata, unbounded journals or global agent infrastructure for basic state usage.
- Reopening B, waiving current Link requirements, changing approved semantic laws, or increasing ceilings by research recommendation.

Independent findings and final corrections are recorded in [REVIEW.md](REVIEW.md).
