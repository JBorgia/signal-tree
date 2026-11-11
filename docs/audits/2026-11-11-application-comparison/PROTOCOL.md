# Automated application comparison — protocol before execution

Authority: November 11 request to publish the v15 maintenance update first, then implement automated application scenarios, metrics, comparisons and evidence-led improvements. No v16 registry publication is authorized by this study.

## Cohort and scope

Use the verified npm v15.4.8 release (signed source 37ef1788f6bac61678fc312f391b180bd7a6bbd7; all five archives, latest tags, provenance/signatures and fresh runtime/type/AOT consumers verified before comparative execution), qualified v16 runtime 2826cc941 (source checkpoint 1ce1a501383a2570245b68c9ace913ee3e7afc12, five-package seal sha256-ba5c01b75cd74e50293262f2a324cfe4072353dc845211e5c95e19948b126e05), Angular native signals plus application coordination, NgRx SignalStore 22.0.1, and TanStack Angular DB 0.2.12 / DB 0.15.2 / query-db-collection 1.4.8. All use Angular 22.0.7 and TypeScript 6.0.3, subject to exact manifest compatibility checks and a frozen common framework/toolchain closure and separately frozen arm dependency closures. Optional TanStack 1.0.0-rc.1.4 probe stays separately labeled. No floating latest tags. Preserve exact archives, integrity, locks, installed inputs and served output hashes.

One production Angular AOT screen/template/viewport/seed generator, built separately for each arm. Inventory ordinary state and coordinated dispatch are separate scenarios. The app interface names user actions and narrow presentation reads, never SignalTree transactions or link receipts. Implementations may use their library idioms and app glue; all such glue is measured and inventoried. Shared code may include backend protocol, deterministic test server, domain validation, schema, rendering, oracle and driver. Do not place a common rollback/publication coordinator under all arms.

Governing premise at 1ce1a501383a2570245b68c9ace913ee3e7afc12:
“Give competing arms the same observable task and meaningful success checks. Validate intermediate results when timing intermediate operations. Endpoint agreement does not certify every timed write.”

## Observable contract

- Ordinary initialize/filter/select/rename/toggle/add/remove, including blank-input rejection, normalization, selected-row removal and immediate observable results.
- Two independently editable fields on one row: both optimistic values visible; each accept/reject order preserves the surviving other edit. Exercise all four decision pairs and both response orders.
- Open a plan preview after edits begin: current optimistic values and pending status appear immediately. An explicit publish intent waits for decisions affecting its inputs and publishes the corrected accepted result. A late reader cannot lose pending provenance.
- A plan consumes a capacity draft from a separate panel. Dependent publication waits; unrelated job-progress publication remains available. No universal process-wide pending gate is added as a business requirement.
- Retain editor A and its request, remove A, add B with the same business ID, deliver the old response and invoke A's editor. B remains untouched and a fresh B editor works.
- Hold publication acknowledgement. Destination callback starts another action/publication. Actual backend calls and unique intent IDs prove correct payload, causal order, no lost reentry and no duplicate intent. Queued, started and acknowledged are distinct states. The driver acknowledges publication one after its reentrant local action, without waiting for publication two to start; serial writers are valid.
- Destroy a screen with work pending; later response cannot mutate or publish from the destroyed session. Reopen and verify the new session independently.
- Same-field assignment commands carry an expected assignment revision and a command idempotency key. A and B begin from revision 10. Backend accepts A at 11 but holds its reply; B conflicts and returns current revision 11. C is authored from 11 and accepted at 12. Deliver C before A. A's delayed success cannot revert C/12. Conflict preserves the rejected user's proposed value for review, while canonical assignment state follows the highest observed authoritative revision for that job instance and field. Replies carry the owner/revision pair; they do not replace unrelated row fields. A retired instance response can never update its replacement. Safe rollback refusal is an app reconciliation case, never authority to overwrite newer truth.
- Lost acknowledgement: D is applied at revision 13 but its reply is withheld. Timeout means unknown, not rejection. Retry the same D ID or query its status; the backend returns its original decision and applies it exactly once. Publish captures already-submitted operations for its included inputs. It waits for those operations to have known outcomes, then freezes latest accepted values/revisions into its payload. These bounded traces introduce no additional relevant edit before publication starts; reentry starts a new intent afterward. Multiple request attempts are permitted; one semantic backend application per command and one publication per intent are required. Reusing an idempotency key with a different payload fails without mutation. Also test the contrasting case where the original request never reached the backend. Client libraries do not establish backend durability or authentication.

Correctness uses 20 rows; capacity runs use 1,000 rows and an additional 10,000-row scaling characterization. These are experimental sizes, not claimed production requirements. Common viewport 1280x900, bounded 40-row visible window, same filter and selection rules. Common required observers, held application payloads, serialization requirements and external response release conditions are fixed. Extra library refetches, subscriptions, allocations and other implementation work are counted, not padded across arms. No hidden full-state oracle inside timed operations; named checkpoints assert useful intermediate state without forcing unused field acquisition.

## Required negative controls

Dropped write/stale count; rejected input that still mutates; whole-row rollback that erases another field; stale late preview; premature dependent publication; blanket unrelated-work blocking; business-ID-only stale editor; dropped reentrant publication/duplicate intent; late callback crossing teardown; false rejection on lost acknowledgement. Every admitted scenario requires a nonvacuous oracle and a planted control that it detects. Library failures first get a minimal reproduction and credible app-glue assessment, not an automatic winner claim.

## Metrics and interpretation

Correctness: violations by trace/stage; pending/accepted/rejected/conflict/unknown states; backend operation/publication count and payload; mutation detector sensitivity. Zero semantic violations is an acceptance condition.

Startup: navigation-to-usable screen, module/bootstrap/store construction separately where observable. Warm interaction: DOM event to Angular stabilization and forced layout; label it interaction-to-layout, not INP. Collect EventTiming/INP only in an explicitly instrumented browser run and do not relabel synthetic handler timings. Async recovery: controlled response delivery to corrected DOM and publication start; acknowledgement processing separately from artificial network delay.

CPU: elapsed main-thread work and separate sampled profiles for population, reads, edits, rollback/settlement, publication preparation, notification and render. Profile runs do not supply comparative timing. Work counts/scaling by row count, changed fields, readers, pending operations and age; preserve SignalTree's existing strict point-work witness separately.

Memory: absolute live JS heap and baseline delta after controlled GC; peak pending state; growth across finite long-lived edit cycles; teardown after late-response delivery. Allocation churn, post-GC live bytes and actual retained paths remain distinct. Take retaining-path snapshots when growth suggests a leak; finite cleanup samples do not prove unlimited boundedness.

Payload: production served JS raw/gzip plus app/library closure attribution; peer externalization declared. Maintenance: adapter/coordinator/test code inventory and specific responsibilities, never a claim that LOC establishes productivity. Human development/debugging time, comprehension, adoption and financial ROI remain unmeasured without a human trial.

Timing protocol: first separate calibration, then freeze sample schedule before comparison. Serial fresh Chromium processes, balanced arm order, same-arm controls, fixed seeds and declared throttle settings. Report independent-sample distributions and paired ratios, not pooled operation tails or an A/A band called a confidence interval. Preserve every attempt and first failure. No favorable rerun. Host contention and CDP throttling are limitations; throttle factors are not calibrated devices.

Decision: rank performance only for conforming implementations. Use workload-specific latency and memory costs, residual glue, feasible remedies and risk; no arbitrary aggregate winner score. Characterization is not a production SLO. Existing budgets remain visible; any new app budget needs an independent workload/device rationale before it becomes a gate, never a threshold fitted to a winner. Prioritize improvements by affected workflow, measured impact, cause confidence and engineering cost. Rerun affected correctness and negative controls, point/lifetime/reentry checks and matched baseline measurements; qualify runtime changes fully if any are adopted.

## Premise review disposition

An independent read-only review examined the workload without a preferred winner.
Its first pass rejected SignalTree-shaped adapters, a universal foreign-pending
business gate and timing endpoint equality alone. The current contract uses user
actions, actual backend calls, narrow presentation inputs and stage assertions.
The second pass supplied the compare-and-set/idempotency trace and identified
instance-scoped revisions, attempt/effect separation, captured publication input
sets, serialized reentry and equal external conditions as necessary clarifications.
These corrections are incorporated before implementation. Source inspection is
not a run result. The TanStack whole-row optimistic overlay and same-key rollback
cascade remain hypotheses requiring the small native probes before app design.

No product or public-library semantic change is selected by this protocol.
SignalTree rollback refusal is a supported reconciliation case, not a bug merely
because this application needs a different view. All implementations must express
the agreed application result through native facilities and explicitly counted glue.

## Concrete implementation boundaries

The full dispatch scenario uses a deterministic in-browser test service with
separate request arrival, semantic application, reply delivery and publication
acknowledgement. It enforces field-scoped compare-and-set and idempotency rather
than returning oracle-supplied application state. Its request/application logs
are common retained test payloads. Browser heap therefore measures the whole
application plus this service; it is not a library-only retained-byte partition.
This service establishes the tested protocol, not production backend durability,
authentication or real network behavior.

Each arm owns its own application coordinator. Accepted values, unresolved
absolute assignments and retained conflict proposals have distinct roles.
SignalTree's full arm gives immutable, uniquely keyed proposal entities native
transaction ownership, then derives presentation from accepted state and eligible
proposals. Outcomes stay outside those pending-created entities so rejection
does not destroy later writes to the same proposal. Direct field transactions
remain a separate native capability probe; this normalization is not claimed
necessary for the registered A/B/C trace alone.

Explicit publication intents use each arm's application outbox. Link models
ongoing synchronization and its receipts do not establish remote acknowledgement;
forcing it to act as a unique request queue would change the comparison. This
scenario consequently does not rank native Link's capabilities or demonstrate
that its guarantees are unnecessary. Existing v16 Link witnesses remain separate.

Per-session used-ID sets retain strings after settled payload dismissal, preventing
silent command/intent reuse. Their linear cost is explicit. Finite aging measures
payload cleanup and this legitimate reservation cost separately where possible;
it must not be described as an unlimited memory plateau. Retained payloads and
native handles must still release at teardown.

Queued progress targets are instance-bound. Replacement while such an intent is
waiting and cancellation/error-retry UI are outside the registered traces; no
general cancellation guarantee is claimed from the separate replacement and
publication checks. A future combined trace needs an explicit visible policy.
The current stale-response witness uses a replacement with a lower revision than
the old reply, so monotonic revision checks cannot mask a missing instance guard.
Every asynchronous response checkpoint checks rendered state as well as state
reads. Publication attempts are counted before backend deduplication, and ID
reuse is checked again after settled-payload dismissal.
