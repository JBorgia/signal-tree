# Evidence ledger

Research checked October 29, 2026. Primary sources only for external technical claims. A documented feature is not a cross-product conformance result. External URLs are living documentation unless a version is specified. No external package was installed or benchmarked for this report.

## Demand, interaction and permission

| ID | Source | What it establishes | Limit |
| --- | --- | --- | --- |
| S1 | [NIST agent identity/authorization initiative](https://www.nist.gov/news-events/news/2026/02/new-concept-paper-identity-and-authority-software-agents) | Institutional work on agent identification and authorization; dated February 5, 2026 | A concept/project initiative, not an implemented universal agent identity standard |
| S2 | [Microsoft Entra agent logs](https://learn.microsoft.com/en-us/entra/agent-id/sign-in-audit-logs-agents) | Agent involvement can be distinguished in initiator/performer/target identity records | Identity-system audit is not a complete business-state effect ledger |
| S3 | [Microsoft agent shared responsibility](https://learn.microsoft.com/en-us/azure/security/fundamentals/shared-responsibility-ai-agent) | State, autonomous actions and composition introduce additional responsibility boundaries | Governance guidance does not specify a reactive-store algorithm |
| S4 | [LangGraph concurrent graph update error](https://docs.langchain.com/oss/javascript/langgraph/errors/INVALID_CONCURRENT_GRAPH_UPDATE) | Parallel updates require defined state-combination behavior | Graph-state conflict is not identical to browser transaction rollback |
| S5 | [Microsoft AG-UI human approval](https://learn.microsoft.com/en-us/agent-framework/integrations/by-component/ui/ag-ui/human-in-the-loop) | Approval remains server-owned; client shared state cannot populate/replace it in the documented Python integration | Platform and language support differ; do not generalize one adapter's guarantee to all AG-UI implementations |
| S6 | [AG-UI shared state](https://docs.ag-ui.com/concepts/state) | Structured shared state, snapshots and JSON Patch deltas between agents and frontends | Does not by itself establish the business authority or approval meaning of a patch |
| S7 | [WebMCP draft](https://webmachinelearning.github.io/webmcp/) and [Chrome WebMCP](https://developer.chrome.com/docs/ai/webmcp) | Website tools for browser agents; draft discusses inherited user identity and security limits | October 27 draft is not a W3C Standard; no browser support matrix was executed |
| S8 | [Salesforce agentic integration patterns](https://architect.salesforce.com/docs/architect/fundamentals/guide/agentic-integration-patterns) | Concrete patterns for action sequencing, correlation, retries, compensation and audit | Prescriptive architecture guidance; not proof of SignalTree market share or equivalent guarantees |

Supplementary demand evidence: [LangChain State of Agent Engineering](https://www.langchain.com/state-of-agent-engineering), public survey fielded November 18–December 2, 2025, 1,340 respondents, 63% technology. Reported 57.3% with production agents and nearly 89% observability. It is self-selected vendor research, not population-wide adoption or a survey of demand for a frontend library. Do not use its current page publication metadata as the survey date.

## Persistence, concurrent state and alternatives

| ID | Source | What it establishes | Limit |
| --- | --- | --- | --- |
| S9 | [HTTP semantics, If-Match](https://www.rfc-editor.org/rfc/rfc9110.html#name-if-match) | Conditional writes can prevent lost updates against a selected representation | Resource validators are server-defined; this is not a multi-resource transaction or a complete read-set predicate check |
| S10 | [Temporal workflow execution](https://docs.temporal.io/workflow-execution) | Durable workflow execution and recovery from persisted history | External effect idempotency and application policy remain necessary; no blanket exactly-once external-effect claim |
| S11 | [Compensating transaction pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/compensating-transaction) | Remote compensation can require business-specific behavior rather than restoring old state | Does not prescribe SignalTree's local rollback policy |
| S12 | [TanStack DB overview](https://tanstack.com/db/latest/docs/overview), [transaction rollback](https://tanstack.com/db/latest/docs/reference/interfaces/Transaction), [Electric integration](https://tanstack.com/db/latest/docs/collections/electric-collection), [offline transactions](https://tanstack.com/db/latest/docs/guides/offline-transactions) | Collections, queries, optimistic state; conflicting-transaction rollback; sync-stream acknowledgment; separate durable retry outbox | No executed equivalence comparison. Backend idempotency remains necessary; sync acknowledgment is not all external-effect durability |
| S13 | [Yjs selective undo](https://docs.yjs.dev/api/undo-manager) | Undo may be scoped by transaction origin on shared types | Origin labels do not authenticate actors or approve remote business effects |
| S14 | [Replicache architecture](https://doc.replicache.dev/concepts/how-it-works) | Transactional mutators, subscriptions and canonical backend with optimistic local behavior | A useful design comparator, not a new adoption/support recommendation; current commercial support was not audited |
| S15 | [XState actors](https://stately.ai/docs/actors) and [persistence](https://stately.ai/docs/persistence) | Actor/workflow state and persisted snapshots | Pages display a v6 alpha banner; pin a released implementation for an executed comparison. Does not establish interchangeable entity lifetime or selective compensation semantics |
| S16 | [Event sourcing pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing) | Append-only events can support history/reconstruction, with substantial complexity | This report does not recommend mandatory event sourcing for application state |

## Integration standards

- [MCP authorization, 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization): transport authorization, not arbitrary application-operation permission or local settlement semantics.
- [A2A and MCP](https://a2a-protocol.org/latest/topics/a2a-and-mcp/): independent-agent collaboration versus tool/data access. Use only when actual integration needs it.
- [OpenTelemetry GenAI conventions](https://github.com/open-telemetry/semantic-conventions-genai): traces/metrics/events. The old main OpenTelemetry GenAI page redirects readers to this repository. Sampling and diagnostics are not correctness storage.
- [W3C PROV-DM](https://www.w3.org/TR/prov-dm/): established vocabulary for entities, activities, agents and derivation. Borrow semantics for export; do not implement the whole ontology in the kernel.
- [OAuth Rich Authorization Requests, RFC 9396](https://www.rfc-editor.org/rfc/rfc9396.html): fine-grained authorization data exists outside state libraries; application-specific meaning still requires enforcement.
- [LangGraph interrupts](https://docs.langchain.com/oss/javascript/langgraph/interrupts): checkpointed pause/resume for human input; resumed node execution and side effects need explicit care.
- [OpenAI Agents SDK human approval](https://openai.github.io/openai-agents-js/guides/human-in-the-loop/): tool approval interrupts/resumption. A runtime approval flow is not evidence that mutable application data stayed equal to what the user reviewed.

## Local source and frozen evidence

Active root for the following relative paths: `/Users/jonathanborgia/.codex/worktrees/v16-incumbent-readiness/signaltree` at evidence HEAD `5727cd8f` when inspected. These paths intentionally refer to the active readiness worktree, not the older checkout holding this report.

| Evidence | Finding supported |
| --- | --- |
| `packages/kernel/src/index.ts` | Public factory/entities/Link/transaction/restoration surface exists; no newly selected operation-companion API inferred |
| `packages/kernel/src/enhancers/transactions/transactions.types.ts` | `transact`, `inspect`, `confirm`, `rollback`; inspection distinguishes current/superseded and exposes address/subject information; not a complete approval artifact |
| `packages/kernel/src/internals.ts` | Observation/tooling integration primitives; names do not imply authentication or a new state authority |
| `packages/kernel/src/lib/internals/write-observation-scope.ts` | Declared synchronous scopes, eight-token cap, explicit omitted/unscoped flags, no automatic promise continuation; diagnostics must not suppress work |
| `packages/kernel/src/lib/link.ts`, `packages/kernel/src/lib/external.ts` | Settlement completion can coexist with endpoint failure; external acquisition is synchronous authority classification, not a label for every remote computation |
| `RELEASE-CURRENT.md` | Current readiness and owner-decision inventory; historical sections do not override latest disposition |
| `docs/audits/2026-10-17-incumbent-readiness/link-collection-proof-successor/README.md` | Rejected87ddcfde: enrollment loses unfinished support, excluded collection still blocks payload, incoming permission reaches peer; framework/consumer/lifecycle limits |
| `docs/audits/2026-10-17-incumbent-readiness/production-route/PLAN.md` | Planning recommendation for whole-workflow qualification; not itself owner authorization |
| `docs/audits/2026-10-17-incumbent-readiness/link-membership-observation-design/AUTHORITY.md` | Approved bounded possible-owner hold; fixed authorship window, distinct known dependencies and recipient uncertainty, settlement-triggered fresh evaluation |

Repository constraints in this checkout: [contributor contracts](../../../docs/contributor-contracts.md), [review protocol](../../../.github/skills/adversarial-confirmation/references/protocol.md), [measurement guidance](../../../docs/performance/measurement-contract.md). These relative links are checked with the local documentation check described in REVIEW.md.

## Limits of inference

This is representative research across the necessary layers, not a claim to have evaluated every agent product. Primary documentation establishes capabilities and obligations; it does not establish comparative performance, lack of equivalent solutions elsewhere, product adoption or correctness of a proposed SignalTree mechanism. Those claims require the matched scenarios in [ACCEPTANCE.md](ACCEPTANCE.md).
