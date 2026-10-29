# Proposed route to an adoptable SignalTree v16

October 28, 2026. Planning recommendation, not runtime/API/release approval.

Evidence basis: readiness controller at dec6e6a74ba426e8d87fbee412cfd4bd91530be8; experimental runtime 75416029be1e0c1d9735ed3bdc0f4e8e6c02f775; retained production checkpoint 87f6831fa60cafe87508f0ace84b7638698ca3b0. The readiness worktree has unrelated dirty guidance and measurement-contract edits; preserved. No runtime, controller, budgets or release state changed for this proposal. B remains closed. The recurrence stop is active.

## Recommendation

Complete the approved incumbent contract through a complete application workflow and the existing release machinery. A business demo should expose the required behavior, not become a workaround around failing library semantics. Qualify complete paths early, freeze distributable bytes only after focused blockers close, and authorize a controlled adoption pilot only after safety qualification.

This does not select a new internal representation. The collection binding design and independent review remain the immediate technical gate. We must not turn a planning comparison into authorization to bypass that gate.

## Delivery options considered

| Option | Benefit | Limitation | Recommendation |
| --- | --- | --- | --- |
| Continue local repair and test-count accumulation | Small changes, preserves accumulated work | Repeatedly misses composition and provides poor completion evidence | Stop using this as the organizing strategy |
| Complete approved incumbent scope through whole workflows | Tests useful behavior across the actual boundaries; reuses substrate and gates | The shared binding mechanism must still survive review and execution | Preferred route; no completion guarantee |
| Release conservative-only v16 or mark declarations experimental indefinitely | Potentially smaller qualification surface | Changes approved product scope; does not repair other known defects | Owner decision only; not assumed or selected |
| Replace Link with drafts/outboxes | Already useful workflow evidence | Changes visibility and developer obligations; not equivalent automatic/conditional progress | Optional examples, not a substitute for required Link behavior |
| Start a new ownership/kernel rewrite | Could reconsider representation if impossibility is shown | High migration uncertainty; B is closed; no evidence justifies restarting now | Do not pursue by default |
| Add an MCP, custom test platform or full private inspection product | Additional automation or visualization | Does not establish publication eligibility; existing tests/browser tooling already reach code | Do not add as a dependency for completion |

## Thirty practices, prioritized

These are evaluated practices, not thirty new infrastructure projects or automatically mandatory gates. Reuse existing implementations. New examples and tests remain scoped to approved behavior. “Next” means after focused correctness survives; “Later” requires the applicable owner authorization.

| # | Practice | Placement | Value and guardrail |
| --- | --- | --- | --- |
| 1 | One concise active acceptance ledger | Now; reuse controller | Each supported promise maps to a falsifier, source identity and closure condition; link historical evidence rather than recopy it. |
| 2 | Freeze the intended release contract | Now; consolidate existing decisions | No silent deferral of conditional progress or expansion to arbitrary async causality. |
| 3 | Classify findings separately | Now | Proven corruption/leakage, unavailable capability, observation gap, policy conflict and cost failure need different remedies. |
| 4 | One active integrated candidate | Now | Preserve rejected checkpoints, but do not keep several evolving repair branches as competing current truth. |
| 5 | Parallelize independent work, centralize integration | Now | Review, application fixtures and contract mapping can proceed separately; shared runtime ownership and final documents stay coordinated. |
| 6 | Predeclare success, recurrence and resource limits | Now | One finite mechanism attempt must answer its matrix; another covered failure returns to disposition, not an automatic repair chain. No invented calendar estimate. |
| 7 | Bind payload and eligibility to the same revision | Immediate design | A value alone cannot certify its contributing responsibilities. This is an invariant, not a preselected data structure. |
| 8 | Make eligibility enforcement mandatory | Immediate design | Unsupported declaration admission cannot bypass obligations on ordinary delivery or invoke a weaker hidden engine. |
| 9 | Preserve distinct obligation roles | Immediate design | Destination ownership, observed inputs, possible-owner window, shared validation and recipient uncertainty are not interchangeable. |
| 10 | Specify complete-operation preparation and completion | Immediate design | Membership, values and order must reach consumers coherently; reentrant authored work remains distinct. |
| 11 | Define obligation replacement and retirement | Immediate design | Reclaim obsolete metadata without deleting current absence, input or recovery evidence; count and heap are different measurements. |
| 12 | Retire replaced machinery after equivalence is demonstrated | During authorized implementation | Avoid two settlement/eligibility authorities; identify replacement responsibilities before adding new layers. Do not delete preserved evidence. |
| 13 | Execute the combined path matrix early | Focused gate | Reuse C1–C14 and prior assertions across point, collection and aggregate sources; callbacks and useful delivery must actually execute. |
| 14 | Add bounded generated operation sequences | Targeted addition | Fixed replay seeds and shrinking can expose composition; the oracle must derive from agreed semantics, not duplicate implementation. Do not build another production model. |
| 15 | Schedule delivery deterministically | Focused gate | Control both owner orders, queued versus in-flight sends, later-owner introduction and no-new-write wake-up. Avoid sleep-based evidence. |
| 16 | Fault-test supported failure boundaries | Focused gate | Preparation, validation, callback throws, capture and recovery; do not imply universal process-OOM recovery. |
| 17 | Exercise four real framework realizations | Focused then broader | Require fresh SignalTree reads and each framework's own timing. An Angular business demo does not narrow four-framework support. |
| 18 | Independent review at mechanism and final integration boundaries | Reuse protocol | Review raw failures, role composition and omitted paths; do not require a new ceremony for every routine edit. |
| 19 | Build one public-API business reference workflow | Parallel preparation; gated acceptance | An order/work-item editor should demonstrate pending edits, row structure, rejection, independent progress, error recovery and teardown. |
| 20 | Add a controllable HTTP endpoint | Application test | Log actual requests and acknowledge/fail/delay them; establish backend reconciliation explicitly. A sent request is not durable server success. |
| 21 | Use one scenario vocabulary across tests and UI | Application test | Show transaction status, visible state, eligible ordinary payload, requests and failure result. Do not invent public diagnostics or expose private Studio. |
| 22 | Test local installed tarballs with ordinary bundlers | First surviving complete slice, then final release | No source aliases, private imports or annotation overrides as adoption evidence. Keep the source diagnostic panel separately labeled. |
| 23 | Validate migration and declaration usability with developers | Next; no outreach without authority | Measure hidden-input mistakes, extra ownership declarations, cleanup code and recovery burden. Documentation alone does not establish usability. |
| 24 | Use a controlled design-partner pilot | Later, separately authorized | Staging/synthetic data first, pinned artifact, stated supported workflow and recovery plan. Never ask companies to validate known publication leaks in production. |
| 25 | Run exact-SHA registry and mutation self-tests | Next; reuse release process | Full kernel/framework, source/spec types, docs, lint, package and browser gates. Rebuild after mutations and verify the final bytes. |
| 26 | Predeclare matched production costs | Next; reuse measurement contract | CPU/latency, construction, churn, fixed/data heap, pending obligations and bundle cost separately. No favorable resampling or ceiling change by inference. |
| 27 | Qualify long-lived sessions and teardown | Focused lifecycle then next-stage heap | Repeated mount/unmount, retained references/receipts, pending and in-flight work; post-drain obligation counts plus actual collectibility evidence. |
| 28 | Audit release supply chain and persistence boundaries | Next; reuse existing workflow | Dependency/license review, package contents and provenance; backend authentication/validation stays application-owned. Do not turn the state library into an enterprise platform. |
| 29 | Make operational support credible | Before public release | Supported peer/browser/runtime ranges, known limitations, migration, error/recovery examples and issue-report recipe. No invented staffed SLA. |
| 30 | Stage adoption with an explicit rollback/reconciliation plan | Later, separately authorized | Pin versions, start with a bounded application feature, monitor actual persistence outcomes. Reverting a package cannot automatically undo already-sent server writes. |

## Concrete application acceptance surface

Prefer an Angular order/work-item editor using synthetic data and the public framework facade. Reuse the existing demo and React reference where practical; do not start four independent polished applications. Add thin framework workflow equivalents so React/Vue/Solid rendering and disposal are actually exercised.

The application should expose: an item list and detail editor; live pending proposals; a separately declared independent update; add/remove/rekey/reorder; confirm/reject; useful refusal and retry; a scripted endpoint; and destroy/remount. Make only already-supported promises. Persistence conflict policy belongs to the example application; no inferred exactly-once, offline durability or automatic async provenance guarantee.

Execute observable acceptance from UI to endpoint:

1. Dependent publication holds while an actual required owner remains pending.
2. Qualified independent work progresses where remaining aggregate prerequisites permit it.
3. Final blocker settlement produces the correct current ordinary payload without another edit, even if a later unrelated owner remains pending.
4. Rejection does not leak inspection display, lose pending authority or resurrect old delivery tickets.
5. Queued supersession and already-started corrective delivery follow their different contracts.
6. Failed requests show usable retry/recovery without pretending a client rollback reverses remote persistence.
7. Remove/recreate respects entity lifetime; active selection, held references and order remain coherent.
8. Teardown releases obligations that no longer serve live work, and late completions follow disposal rules.

The current localhost lab is diagnostic evidence only. It deliberately uses internal inspection setup and ignoreAnnotations:true to retain experimental initialization. It cannot qualify public installation or tree shaking. An ordinary consumer build must work without those concessions.

## Finite execution order

1. Complete the already-authorized collection design correction and independent review. Map all preserved failure gates to one mechanism and its consumers. Runtime stop stays active until the required disposition permits a successor.
2. Under bounded implementation authority, run the complete focused path matrix on one source. Include inspected inputs, selected inverses, retirement, source forms and useful progress. A failure in a claimed-covered rule triggers the existing recurrence boundary.
3. Qualify the complete application path and real framework realizations. Install candidate tarballs and test normal compiler/bundler behavior. No ad hoc exceptions in the example to hide library failures.
4. Freeze a candidate; run the repository's complete exact-artifact procedure. Reconcile every changed verdict, source/spec diagnostics and budget. Measure approved workload profiles and disclose unresolved costs.
5. Seek separately authorized pilot/release disposition with migration, support, persistence-recovery and security evidence. A pilot adds usability/operational evidence; it does not waive known safety failures.

This plan does not require a large formal-verification project, a new MCP, another architecture competition, four full applications or an enterprise backend. It does require a complete state transition contract and evidence beyond source tests.

## Proposed definition of release completion

- All supported critical workflows have executable safety and useful-progress assertions, and no known supported correctness blocker remains.
- Every shipped framework and public source form has its required qualification; unsupported observations remain explicitly unfulfilled rather than passed.
- The exact candidate passes existing mandatory gates, or a genuine policy change is explicitly approved on its own evidence. Historical assertion corrections remain traceable.
- Installed package bytes work under supported real consumer configurations; no unqualified experimental API is silently promoted.
- Required cost limits pass or an exact tradeoff is approved. Correctness is not exchanged for performance.
- Application declarations, migration and error recovery are usable and honestly documented; hidden-input omissions remain application responsibility.
- Lifecycle and long-session tests cover the supported workloads; no universal leak-free claim is inferred from a finite run.
- Release/publication and any customer pilot receive their own authorization.

## External references used narrowly

- fast-check model-based testing: https://fast-check.dev/docs/advanced/model-based-testing/ . Command sequences and shrinking are useful; its documentation explicitly warns against duplicating implementation in the oracle.
- Playwright network testing: https://playwright.dev/docs/network . Existing browser APIs can observe/intercept HTTP; an MCP is unnecessary for this work.
- npm provenance: https://docs.npmjs.com/generating-provenance-statements/ . Provenance connects an artifact to source/build information, not a proof of functional correctness.

## Review and limits

Two independent read-only reviews were requested: delivery framing/alternatives, and adoption/verification gaps. They received the frozen premises and repository evidence without the preferred route. Final synthesis remains centralized. The root verified the installed consumer's --legacy-peer-deps setting and the React reference gate's explicit typecheck-only limitation against source. Those are coverage limits, not newly reproduced runtime defects.

No company interview, pilot, new suite, benchmark or new release verification ran for this planning assessment. Proposed practices do not establish that developers will adopt v16. No estimates of duration, customer demand or performance superiority are claimed.
