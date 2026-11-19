# Selected product reference completion audit

Read-only audit, October 29, 2026. No source edits or test reruns. Existing results
are attributed to their recorded executions, not represented as new executions.

## Disposition

P4 has a substantial, independently reviewed reference core: installed Angular
AOT/DOM behavior, a narrow AG-UI adapter, command-bound review authority, explicit
input observations, and separate remote/local recovery. The governing PLAN's
claim of bounded passing reviews is supported. It does not yet demonstrate every
part of the “human/embedded/browser entry paths share operations” completion
condition as a reusable application example. Do not turn this into a requirement
for production authentication, an agent platform, new native APIs, or an HTTP
rewrite of the browser demo.

The smallest remaining P4 work is a bounded application entry/producer composition
plus a current consumer walkthrough. Real navigation is a separately identified
lifetime disposition, not permission to build durable recovery infrastructure.
Native recurrence, four-facade exact-candidate qualification and release gates
remain P3/P6 work; the passing 5727cd8f artifacts do not qualify a new native candidate.

## Concrete remaining work, in priority order

### 1. Demonstrate the selected entry-path convergence in the actual reference

Premise: PLAN.md:39 explicitly requires human/embedded/browser entry paths sharing
operations. installed/browser/app.ts:27 offers only “Propose via AG-UI”; :89–113
constructs and completes a hardcoded west-route event sequence synchronously inside
the component. Playwright genuinely drives the same DOM path a human can drive,
and attribution correctly remains unknown. However, there is no consumer-facing
host producer entry accepting a proposed route/observation and optional declared
host context. Independent note editing (:214) is an unrelated immediate write,
not a second business proposal entry through the review/command workflow.

Missing implementation/evidence: factor the existing application proposal-entry
logic into a shared local path used by a minimal human route request and a bounded
host/embedded producer (a deterministic fixture is sufficient). Both should reach
the existing immutable review, exact command grant, version checks and local
settlement, rather than adding a second approval engine. Browser automation should
continue to use those same controls. This is application/reference ownership,
not a new kernel or published companion API, and needs no live LLM or extra protocol.

Input observation belongs in this same slice. Current :92 captures the packet
before stream creation and :85–87 closes over it correctly; protocol/input-evidence.test.mjs:10–30
already proves delayed completion preserves the old version. But the browser's
hardcoded producer neither consumes that packet nor delays. A deterministic producer
that receives the captured packet, pauses for a fixture input change, then completes
would demonstrate the corrected contract end to end. Do not rerun every old test:
add only the missing convergence/delayed-completion discriminator. This is a missing
composition demonstration, not evidence that the corrected builder is broken.

### 2. Make the current consumer guidance reproducible without historical inference

Premise: docs/architecture/multi-actor/IMPLEMENTATION.md explicitly preserves initial
checkpoints and later records the 12-case reference. That is truthful history.
However, tools/experiments/multi-actor-operations/README.md remains the reference
entry point and says there is no browser framework integration or serialized
approval tokens (Limits), while its workflow teaches only the synchronous
two-argument proposal call and direct backend adapter. Those statements describe
the original standalone coordinator slice, not the delivered browser/HTTP compositions.

Missing reference deliverable: one clearly current walkthrough linking the existing
runner and showing these actual host responsibilities together: capture and supply
an observation; create/review; bind the exact command; acquire a host grant only on
explicit Apply; retain it while uncertain; revoke it after a terminal remote receipt;
retry local settlement without resending; finish cleanup. The implementations already
exist. Do not create another package or duplicate the code to satisfy this item.
Label the older walkthrough as standalone/historical and point readers to the current
composition. PLAN.md:10 makes developer usability part of success; a set of passing
controls alone is not the full teaching artifact.

The M18 phrase “needs no Studio or diagnostics” in COVERAGE.md:26 is too broad.
The browser intentionally uses public lifecycle facts at app.ts:75–78 and :181–185
for recovery decisions. Correct boundary: no private Studio, diagnostic recording,
or sampled trace dependency; supported lifecycle readers are explicit integration
inputs. This is a wording correction, not a demand to remove those readers.

### 3. Resolve the reference's lifetime promise before claiming navigation coverage

Premise: app.ts:223–230 returns from dispose while uncertain/local-pending/busy,
then ngOnDestroy simply calls dispose. This truthfully refuses explicit cleanup;
it cannot prevent Angular from destroying the view or make a component-owned session
recoverable after navigation. The current checks prove explicit disposal refusal and
retained in-memory responsibility, not a route guard or surviving recovery UI.
IMPLEMENTATION.md already acknowledges this, and COVERAGE M15 remains open.

Bounded disposition: keep P4 explicitly an in-session reference with navigation
outside its completion claim, or supply the application's existing route/session
ownership mechanism so an attempted leave is blocked or the same live session remains
reachable. For a complete navigable application reference, demonstrating that usable
owner is real implementation work. No durable outbox, restart service, persistence
engine, or kernel teardown redesign follows from this finding. Those are application
production decisions. Do not mark M15 complete merely because no cleanup callback ran.

## Boundaries already supplied; do not reopen as missing implementation

- Review authority: app.ts:64–74, :115–128, :161–167 bind a host-issued grant to the
  exact immutable coordinator command and send it through a separate gate. Protocol
  completion/actor labels cannot issue it. Uncertainty retains it; terminal remote
  receipt releases it independently of native recovery. HTTP reviewRequired=true
  checks that gate inside the real handler before backend application. The standalone
  backend permission switch is not the approval guarantee. The 12 DOM, separate
  security scenarios, isolated authority controls and 15 HTTP controls are recorded
  in VERIFICATION.md and the review archives. They overlap; do not sum them.
- UI attribution: default unknown is honest. Human and Playwright clicks cannot be
  distinguished from DOM events. Host-declared actor support exists in coordinator
  and protocol tests. The missing entry composition should preserve that distinction,
  not add authenticated-looking labels. app.ts:112 currently displays only actor.kind;
  if a declared producer is added, show its declaration and label as such. No current
  unknown path is falsely authenticated.
- Input evidence: optional third observation argument and host closure address the
  demonstrated late-version upgrade. Complete business input selection and actual
  fresh evaluation remain application duties; the library cannot infer hidden model
  context. A version check is not proof of the producer's reasoning.
- Local recovery: app.ts:170–193 retains receipt and native handle, correlates the
  expected terminal lifecycle fact and checks pending state. Retry is local only.
  Real rollback refusal/retry and post-terminal removal-observer errors are exercised.
  The unconstructed success/confirm-throw case remains unqualified, not an established
  bug or justification for private fault hooks/new APIs. Reopen only with a concrete
  supported trigger or broader native qualification need.
- Browser and HTTP are separate compositions. This is stated in VERIFICATION.md.
  P4 selected one framework reference and one protocol adapter; it does not mandate
  replacing the explicitly accepted in-browser authority stand-in with HTTP now.
  Production remote authority must run outside the untrusted browser, but requiring
  that migration to close this bounded fixture would expand the selected scope.

## Production/application obligations versus library completion

Application/backend owns production identity, reviewer authorization, domain rules,
complete input packets, atomic durable conditional writes/idempotency, grant and
receipt retention, unique command domains, restart reconciliation and compensation.
The examples should identify these responsibilities, not claim to implement them.
They are not missing SignalTree kernel features. The gate's fixed host identity,
HTTP fixture bearer and in-memory receipt maps remain deliberately non-production.

Kernel/facade completion still requires the separately governed native recurrence,
writer/recipient/lifetime coverage, framework timing/current-reader work and exact
artifact qualification. M09 entity replacement/rekey review semantics and native
publication parity remain broader whole-product obligations; they are not silently
satisfied by a single-delivery scalar reference. No new native candidate is accepted
by this audit, and no previously rejected mechanism or B closure is reopened.

## Identity and inspection limits

Inspected PLAN, COVERAGE, IMPLEMENTATION, DEVELOPER-GUIDE, experiment entry README,
VERIFICATION, current browser app/checks/runner and archived reviews, protocol and
input-evidence control, and the previously reviewed HTTP/authority composition.
No new runtime counterexample was pursued; this audit concerns completion mapping.
Source hashes below identify the principal reviewed inputs at read time. No source
or guidance file was modified.

```text
8d1746835c158580713e4e0696c75296fbc962fd2197edd547834a536d70fa91  docs/architecture/multi-actor/PLAN.md
ba0d1ab00179a2af5eed7b69c5d0961336a4e9400197de0d790c32435ab228c8  docs/architecture/multi-actor/COVERAGE.md
f96802c5b976a6b2f8ad99eb3ca6c1ddf0acc4bc3c3d7211d192b93e1a239241  docs/architecture/multi-actor/IMPLEMENTATION.md
5061fa32c42573bfc117b52637a863cdd8f792a6d325c83a2e4d60687738091a  docs/architecture/multi-actor/DEVELOPER-GUIDE.md
e208e0254919feeebe95384b21aa5302baf1937de495e13dbc03f04129d51c8a  tools/experiments/multi-actor-operations/installed/browser/app.ts
1438d339d257dec60ff725daa2fc3fbb872bf59bfd768e222c1ac02cee65eafe  tools/experiments/multi-actor-operations/installed/browser/checks.mjs
e6b3ccd93c9b2019e46e0bface3dc2812218bfe3e293c1258665f1d417870aef  tools/experiments/multi-actor-operations/protocol/ag-ui.mjs
bd3b95e9d020720d09abcbccd90f7b3d51a93da955a63f9b4dcce7ed4c0cd413  tools/experiments/multi-actor-operations/protocol/input-evidence.test.mjs
b5440acc9f41407a51822e26caeefe34f1bcd09d9f8bbb1c41a25cfdff22b120  tools/experiments/multi-actor-operations/http/fixture.mjs
653ae035ff584c4832b7b817431c5dd314920b75890de937e8e54d8ba287326f  tools/experiments/multi-actor-operations/authority/review-fixture.mjs
```
