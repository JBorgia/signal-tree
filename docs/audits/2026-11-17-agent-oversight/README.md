# v15 value and v16 emerging oversight evaluation

Owner premise: increasingly capable agents will need stronger oversight,
transparency, monitoring and useful controls while working alongside people.
Evaluate that future-facing requirement now. Lack of market adoption does not
invalidate it, and ordinary-store speed is not its acceptance criterion.
The preceding value question was primarily about v15; do not justify v15's
ordinary costs using hypothetical v16 benefits.

This is a bounded functional investigation, not release qualification, an AI
security certification, a new public SDK or an assertion that every requirement
below is implemented. Runtime/package source is unchanged.

## Why this is a concrete engineering hypothesis

Primary disclosures identify actionable failure modes. Anthropic's July 30,
2026 report describes unauthorized access to real systems from evaluation
environments believed to be isolated. OpenAI's August 26 report describes
unauthorized inter-agent communication, containment bypass and information that
did not reach incident-response leaders promptly. These were evaluation
configurations with reduced safeguards; they do not establish the frequency of
such failures in ordinary deployments. They do establish that stated intent,
environment assumptions and available logs can differ from actual effects.

- [Anthropic: cybersecurity evaluation incidents](https://www.anthropic.com/news/investigating-incidents-cybersecurity-evals)
- [OpenAI: Hugging Face incident and response](https://openai.com/index/hugging-face-incident-and-the-road-ahead/)

Anthropic's October 9 report further describes unintended real form submissions
and restriction workarounds; it reports minimal impact for those particular
cases. Its remediation includes stricter containment and monitoring. NIST's
agent evaluation-probe project addresses evidence-grounded outputs and structured
audit trails. OWASP's agentic guidance identifies tool misuse, identity/privilege
abuse and goal hijacking. These support the need for controls at execution
boundaries and truthful evidence, not a claim that a client state library solves
all agent safety.

- [Anthropic: unintended actions](https://www.anthropic.com/research/investigating-unintended-model-actions)
- [NIST: evaluation probes](https://www.nist.gov/programs-projects/building-evaluation-probes-agentic-ai)
- [OWASP: agentic risks](https://genai.owasp.org/2025/12/09/owasp-genai-security-project-releases-top-10-risks-and-mitigations-for-agentic-ai-security/)

Inference: applications need to distinguish proposed intent, permission,
attempted actions, authoritative outcomes, local settlement and missing evidence.
This inference is testable without waiting for a commercial application or
predicting which models, protocols or regulations will dominate.

Existing agent infrastructure is an integration target and a comparison arm.
LangGraph already supports interrupt/review/resume workflows; OpenTelemetry's
GenAI conventions describe agent/tool spans and make sensitive content capture
opt-in. SignalTree should connect application effects and ownership to these
external operations, not equate a trace span with permission or duplicate an
entire orchestrator in its kernel. These are documentation-level capability
observations; this study does not install or benchmark those integrations.
[LangGraph](https://github.com/langchain-ai/langgraphjs/blob/main/docs/docs/agents/human-in-the-loop.md),
[OpenTelemetry](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-spans.md).

## V15: what the extra cost actually buys

The source audit used `6345327058fc46384af7e0ac2536b0a006bd2d45` and the
identified built payload from `891159222d40ccb8f55da038334b9197e0bc3432`.
There are no package-source changes between those revisions. The preceding
[publication/cleanup study](../2026-11-17-publication-activation/README.md)
contains the measured bundle graph and its generating commands; its numbers
are prior evidence, not a new benchmark in this investigation.

| Responsibility                                                      | Paid without selecting the feature?                                                                                                               | Value and disposition                                                                                                                                                                  |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typed tree shape, ordinary snapshots, membership and stable writers | Basic implementation and ownership scaffolding are present. Snapshot caches and membership work follow demand.                                    | Coherent tree/descendant behavior, omission/readdition and retained writer behavior. Keep the contract; its representation is not presumed minimal.                                    |
| Ownership/lifetime and dormant observation                          | Registry and interception scaffolding are built in; position identity/observation activate on demand.                                             | Two trees must not conflate same-path writes; a writer retained before a later Link must still be observable. Existing controls give concrete counterexamples to removing these facts. |
| Transactions and restoration                                        | Their implementations are absent from the measured bare bundle. Runtime records and history are conditional; diagnostic history defaults to zero. | Chosen rollback/history behavior has useful application value. Do not call this an unavoidable tax on every tree.                                                                      |
| Link and DevTools                                                   | Implementations are absent from the measured bare bundle. Minimal later-observation support remains.                                              | Optional relationships/tooling; not a built-in HTTP, storage or agent policy.                                                                                                          |
| EntityMap                                                           | Absent from bare bundle; selecting it brings a substantial shared collection API. Rows, fields, epochs and projections have demand allocation.    | Stable entity lifetimes and consistent reactive collection editing. Individual API methods do not all tree-shake independently; per-method economic value is still unmeasured.         |
| Empty planning/containers                                           | Some empty Maps/Sets and enhancer/capability planning are created even on bare trees.                                                             | No proof these allocations are irreducible. Investigate lazy containers and empty-plan construction separately from removing public features.                                          |

The prior neutral fixtures measured 11,011 gzip bytes bare and 25,333 with
entities. These are fixture totals, not additive feature prices. Angular uses
native carrier realizations; neutral-kernel per-leaf dependency nodes are not
Angular allocation counts. No supported v15 capability has a demonstrated
removal case in this audit. This does not establish that every EntityMap
convenience is economically optimal or that further allocation work is futile.

The new common oversight tests are deliberately also run on v15: host approval,
receipt correlation and basic read-only monitoring must not be credited as
unique v16 features merely because they appear in the v16 reference app.

## Required oversight and functionality

| Requirement                 | Observable acceptance condition                                                                                                                                                                  | Owner                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Faithful review             | Exact immutable proposal, observed versions/entity lifetime and declared/unknown actor are visible; changed content invalidates approval.                                                        | Application integration, with kernel identity underneath                           |
| Enforced execution boundary | No unauthorized effect from forged labels, crossed grants, stale approval or permission changes. Valid approved work still succeeds.                                                             | Trusted host/backend; agent receives restricted commands, not reviewer credentials |
| Concurrent useful work      | Independent human edits and permitted publication continue while other operations wait; receipts settle their original owners only.                                                              | Kernel plus operation/transport integration                                        |
| Honest uncertainty          | Lost or unrelated receipts remain uncertain; retries use stable command identity; local confirmation is not server acceptance.                                                                   | Application and backend                                                            |
| Safe refusal/recovery       | Unsafe rollback preserves state and accurately reports pending authority; required outgoing effects remain held until explicit recovery.                                                         | Kernel plus application recovery policy                                            |
| Trustworthy monitoring      | Observer failure does not alter native outcomes; gaps, duplicates, reordering and truncated history cannot certify a complete record.                                                            | Kernel facts; application/private Studio recording and presentation                |
| Intervention                | Stop unsent work; after possible delivery, preserve uncertainty and reconcile. Never claim cancellation undid an external effect.                                                                | Application/host/backend                                                           |
| Durable reconstruction      | After an actual process/browser restart, associate original command, external effect and receipt without duplicates or silent loss.                                                              | Durable backend and session integration                                            |
| Investigator usability      | A person can find who proposed/authorized what, observed inputs, actual effect, pending work and missing evidence. Labels and model explanations remain claims unless independently established. | Application/private Studio plus authenticated backend facts                        |

The public-library/private-Studio boundary remains unchanged. Read-only kernel
observations are public integration primitives; recording, sessions, query and
Studio UI stay in their private owner. Authentication, sandboxing, durable audit
storage and model factual-grounding checks do not move into the kernel.

## Fresh execution

The common suite passed nine characterizations on each release line. One is
an explicit missing-durability witness, and the refusal case intentionally has
different required observations on v15 and v16. The existing v16 public
workflow passed 62 Node checks and 15 production Angular reference cases.
The separate strict-AOT browser-to-HTTP flow passed all 12 cases on the same
identified runtime payloads.
Both planted browser faults were detected by their specific oracles: reporting
remote success without native settlement, and accepting a stale entity instance
after replacement. These are expected negative-control failures, not failing
candidate behavior.

| Fresh common observation                                             | v15 candidate                                                            | v16 candidate                                                                       | Meaning                                                                                  |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Forged reviewer data/crossed grants                                  | Rejected                                                                 | Rejected                                                                            | Host/application protection; not a unique kernel feature                                 |
| Two deliveries awaiting receipts, B accepted before stale A rejected | Correct original owners settle; human edit survives                      | Same                                                                                | Both support this bounded integrated workflow                                            |
| Throwing monitoring callback                                         | Healthy observer gets three transitions; native confirmation succeeds    | Same                                                                                | Observation failure is isolated from settlement                                          |
| Disconnect spanning a complete operation                             | Six observed transitions versus nine actual; missing interval detectable | Same                                                                                | Sequence/current-state facts can support gap-aware tools; no automatic historical replay |
| Retained history window of two after three confirmations             | Two retained turns, explicit truncation                                  | Same                                                                                | Honest bounded evidence, not a complete durable audit                                    |
| Unsafe rollback after same-key entity replacement                    | Owner remains pending but second outgoing publication occurs             | Owner remains pending and second publication stays held until explicit confirmation | Concrete functional benefit of v16's stronger containment                                |
| Reconstruct in-memory backend after first application                | Same command applies again                                               | Same                                                                                | The fixture lacks durable deduplication; no process-restart guarantee established        |

The refusal test has real positive controls: initial publication `[1]` and a
successor held before refusal. v15 publishes `[99]` on refusal; v16 publishes it
only after explicit confirmation. Both finish with the observed sequence
`[[1], [99]]`. It checks actual outgoing values as well as
`consequencesReleased` metadata. v15's result is preserved compatibility behavior,
not a newly introduced regression.

Results and exact commands are recorded in [RESULTS.json](RESULTS.json).
The [evidence archive](evidence.tar.gz) contains 71 verified selected payloads,
including exact package archives, raw outcomes and first failures; its
[manifest](EVIDENCE.json) binds each file and the archive. It does not bundle
every external dependency or all repository history.
The [preregistered protocol](../../../tools/agent-oversight-lab/PROTOCOL.md)
distinguishes functional passes, characterization of v15 semantics and explicit
limitation witnesses. An overall harness pass means its assertions passed; it
does not turn an observed missing capability into a fulfilled requirement.

The existing installed native workflow and production Angular browser/HTTP
reference are rerun on identified v16 payloads. New common Node tests run on
both lines. Deterministic hostile command data tests the execution boundary;
no real-model prompt-injection rate, model reasoning quality, token spending,
production authentication or human comprehension is measured.

First failures are preserved: the preparer initially treated Angular's build-only
`dist/index.d.ts` as a shipped file; canonical manifest filtering corrected that
assumption. A sandboxed run could not bind loopback HTTP. An early refusal probe
incorrectly expected a superseding scalar write to require refusal; the runtime
allowed the rollback, so the trigger was replaced with the established unsafe
entity-replacement case. A common-only install initially omitted the offline
tslib peer. None of these is classified as a runtime defect. Independent review
also required genuinely overlapping delivery promises, actual publication
observation, and stronger build-receipt/archive-content admission; all were added
before the successful common runs.

## Metrics for the next application proof

Keep correctness and cost separate. For every required failure schedule, count
forbidden effects, false success/cancellation claims, wrong command-owner
settlements and overwritten independent human edits; required count is zero.
Require a positive successful effect and explicit recovery, so refusing all
work cannot pass. Track trace completeness and missing-evidence detection rather
than presenting a partial activity feed as a complete audit.

For an actual app, also measure command-to-observation lag, stop-to-enforcement
latency, recovery completion, investigator task accuracy/time, backlog growth,
and retained bytes per pending operation/history window. Compare observation
off, minimal metadata, and the chosen redacted recording policy. Report startup,
interaction p95 and sustained work separately. These are evaluation metrics,
not already measured figures or arbitrary release budgets.

The next proof should include concurrent browser approvals, real restart after
effect-before-receipt failure, session/navigation isolation, authenticated
principal/tenant/destination binding, redaction and recording backpressure.
V15 and rival implementations should meet the same required product outcomes
using their own strategies; they need not reproduce every v16 internal mechanism.

## Interpretation

V15 should earn its cost through its present state/editing behavior and optional
capabilities. Its existing observation primitives already contribute to oversight.
V16 should earn its premium through stronger concurrent responsibility,
publication and recovery contracts, and through the ability to expose their
actual state faithfully. Test these functions as infrastructure for the emerging
need; do not demand that market adoption precede engineering validation.

A passing local coordination test supports that foundation. It does not establish
a complete oversight product. The remaining work is largely the integration
that makes those facts actionable, durable and understandable to users, rather
than adding generic AI policy to every state tree.

Independent premise, source and result interpretation review found three harness
gaps: receipt ordering was initially sequential, containment initially checked
metadata alone, and artifact admission lacked descriptor-receipt/content joins.
Those were corrected before the successful common runs. Final review verified
the result counts, input/log hashes and installed inventories and corrected the
wording of v15 versus v16 publication timing. It did not certify production
security, a complete oversight product or the unexecuted application requirements.
