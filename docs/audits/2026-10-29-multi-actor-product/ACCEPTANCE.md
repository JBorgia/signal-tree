# Whole-workflow acceptance and comparison

Proposed research/qualification plan, October 29, 2026. **No cases below were executed in this research.** These scenarios organize the agreed guarantees and proposed companion requirements; they do not amend the release registry or silently approve new semantics.

## Comparison arms

- **C0:** ordinary framework state, explicit application commands, backend revision checks and existing agent protocol. Strong simple baseline, not deliberately crippled.
- **C1:** SignalTree supported contract with application glue.
- **C2:** SignalTree plus the proposed optional operation companion, using the same kernel authority.
- **C3:** TanStack DB + versioned backend + separate immutable proposals; optionally XState for approval/execution coordination. This is a required strong comparator for the normalized dispatch fixture.
- **Specialist control when relevant:** Yjs for replicated collaborative documents. Do not force either into unrelated requirements or count a configured unsupported capability as a passing test.

All arms must implement the same externally observable scenario, including useful progress, allowed refusal and actor-attribution limits. Record missing capability and application code explicitly. No performance comparison is valid for an arm that omits the required semantics.

## Fixture

Synthetic dispatch workspace with deliveries, route order, capacity and notes. A site-owned scheduling agent, browser tool client, human UI and external service act concurrently. A second browser run uses UI actuation without attested executor identity. Use deterministic scripts first; an LLM is not a test oracle.

Capture UI state, ordinary state where a supported observation exists, endpoint requests, correlated responses, approval records, pending/recovery state and retained-resource counts. Use public application APIs for adoption evidence. Private probes can investigate a failure but cannot close the public-consumer gate.

## Two distinct oracles

**Common product outcomes:** useful independent progress, no unapproved publication, faithful review, explicit conflict/recovery, preserved independent later work, honest delivery outcomes and bounded lifecycle. C0–C3 are judged on these observable outcomes, not SignalTree APIs. A separate proposal store may satisfy rejection by leaving accepted entities untouched. Preserving later work does not require preserving the validity of work whose inputs were rejected; dependency handling must be explicitly specified.

**SignalTree conformance:** declarations, fixed possible-owner windows, inspection/ordinary distinctions, recipient participation, held handles and native framework timing are tested on C1/C2 under their applicable contracts. Alternatives need not expose these mechanisms or an ordinary-state API. Rows below supply SignalTree discriminators and related product scenarios; they are not a universal API checklist.

## Discriminators

| ID | Scenario | Required observable result | Owner |
| --- | --- | --- | --- |
| M01 | Basic user edit, no agents/enhancers | Correct reactive update; no operation protocol required | Kernel/facade |
| M02 | Two operations touch independent fields | Useful independent progress under valid declarations; unresolved foreign inputs still held | Kernel Link |
| M03 | q proposes7; p copies7 and confirms first | No premature send; after relevant gates clear useful delivery occurs without another write | Kernel Link |
| M04 | Unknown-input write; unrelated transaction starts afterward | Later unrelated owner cannot extend fixed possible-owner window; actual new dependencies remain applicable | Kernel Link |
| M05 | Pending removal makes a member absent; updater branches on absence | Observed absence remains an input dependency; independent sibling replacement cannot erase it | Kernel |
| M06 | Add/omit/rekey/reorder with another recipient enrolled mid-validation | Exact aggregate contributors and relationship-specific authority; no enrollment leak or obsolete-collection hold | Kernel Link |
| M07 | UI-only browser/machine action | Same state correctness, executor identity reported unknown rather than invented human/agent attribution | Application integration |
| M08 | Agent proposal reviewed; relevant input/effect changes before approval is consumed | Old approval cannot authorize changed operation; explicit stale/conflict/review behavior | Companion/backend; new contract to prove |
| M09 | Same-key replacement during review | Held references and review targets do not retarget to a new lifetime | Kernel plus companion |
| M10 | Reject/failed rollback, then retry; callback reentry and error | State/authority coherent; safe refusal stays settleable; newer authored work survives; no stale endpoint payload | Kernel/facades |
| M11 | Inspection shows99, ordinary7; adoption/removal and rollback | Approved physical/ordinary distinctions preserved; inspection alone never becomes outgoing authority | Kernel |
| M12 | Server snapshot has no settlement relation; contrast delegated remote computation and authoritative acquisition | No invented confirmation. Remote computation can remain authored; authoritative acquisition is realized and may make rollback unsafe. Acquire asynchronously before synchronous `external()` application | Adapter/application with native semantics |
| M13 | Review UI forged/replayed; backend permission revoked before execution | Server rejects unauthorized/stale action; client metadata is not a capability grant | Backend/integration |
| M14 | Command applied but acknowledgement lost | Retry uses stable command identity; effect not duplicated under endpoint's idempotency contract; UI can represent uncertain outcome; rejected endpoint delivery remains distinguishable from successful persistence even when `settled()` resolves | Backend/companion |
| M15 | Navigate away during held/in-flight work; recreate with same display keys | Dispose semantics honored; no old receipt revival, authority alias or unbounded obligation-free retention | Kernel + companion |
| M16 | Mixed scalar/entity/order operation through all four facades | SignalTree-provided reads and publication coherent; framework-owned computed timing preserved | Kernel/facades |
| M17 | Agent tool action spans await, second tool and server response | Explicit operation correlation survives; local synchronous transaction/declaration is not implicitly extended | Companion |
| M18 | Diagnostics disabled or retention truncated | State/settlement unchanged; audit gaps identified; no correctness dependency on Studio or a sampled trace | Kernel/integration |

M07 attribution, M08 approval, M09 review targeting, M13 authorization, M14 backend delivery, M15 receipt lifecycle and M17 async correlation include proposed integration/backend requirements beyond the local-store contract. They are not claims that current SignalTree fails an already-supported public contract. They are required to demonstrate the full proposed multi-actor product and must get their own reviewed implementation/authority disposition.

Existing SignalTree obligations derive from the active support/transaction/ingress contracts and specific owner authority records listed in [SOURCES.md](SOURCES.md), not from this table. Kernel lifetime/teardown parts of M09/M15 are distinct from their proposed review/receipt integrations. M18 combines existing diagnostic independence with proposed audit-gap reporting. No row alone grants implementation authority.

Partial approval should initially use explicitly defined independent suboperations. Do not add a test that assumes arbitrary subsets of a structurally dependent transaction can settle separately without an approved policy.

## Observation and privacy rules

- Inspect principal, executor, run, operation, local transaction, delivery attempt and server command as different identifiers.
- Record whether attribution/input evidence is observed, declared, verified externally, unknown or truncated. Do not treat these categories as increasing numeric confidence scores.
- Test malicious labels and incomplete declarations as misuse/negative controls. An intentionally omitted hidden input leaking speculation is not a safety pass.
- Redact sensitive arguments in telemetry and retain only facts needed for review/recovery by default. Detailed values require application-controlled retention.
- Use version/authority evidence within its named domain. Do not compare unrelated server revision numbers or assign global causality from wall-clock arrival.

## Scheduling and generated sequences

Exercise both settlement orders, new-recipient enrollment before/during/after validation, equal-value responsibility changes, queued/in-flight replacement, source/recipient disposal and backend response reordering. Use deterministic scheduling rather than arbitrary sleeps.

Add bounded generated sequences only after each command's preconditions and expected results are explicit. Shrink failures to a short public operation sequence. The oracle must use the approved behavior, not replay the implementation's internal data structures. Keep the first failure and source identity.

## Performance and burden

Use the repository measurement contract and fresh installed artifacts. Predeclare acceptable regressions and workload profiles before execution; this report selects no new numerical ceiling.

- Basic store startup/bundle/heap without operation integration.
- Entity-heavy editor with no pending work, one pending operation and several overlapping operations.
- Useful eligible publication while unrelated work is pending.
- Preparation/capture, native update, framework render, delivery, server latency and recovery measured separately.
- Construction, churn, repeated rekey/replacement, long-lived recovery and teardown.
- Metadata growth against live facts/obligations, not lifetime operation count; whole-process heap and record counts separately.
- Application integration code, declarations required per workflow, common mistakes and recovery branches. Line counts describe burden but do not rank correctness.

Ask an implementer unfamiliar with internal ledgers to complete the documented workflow. Record questions, mistakes and workarounds; do not train them on hidden implementation before evaluating DX. No customer contact or pilot is authorized by this plan.

## Completion criteria

The concrete product thesis survives when C2 exposes the required behavior with materially clearer integration than C1 and useful capability beyond C0, without outsourcing essential correctness to undocumented application tricks. A neutral outcome is valid: if C1 needs little glue, a companion package may not be justified. If C3 achieves the same outcomes with equal or lower integration burden and no material lost capability, reject the multi-actor-specific SignalTree product recommendation. Count documented application logic fairly in all arms, including C2; do not excuse companion-specific glue while penalizing equivalent comparator code.

The existing v16 release contract is ready only after its supported blockers close and one exact candidate completes mandatory gates, installed public consumers, framework/browser qualification, lifecycle and approved cost evaluation. Research scenarios and passing models do not replace that procedure. New public companion/API scope and release/pilot actions require their own owner decisions.
