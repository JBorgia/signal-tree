# Independent review requested: bounded P4 entry convergence

Ready for a different reviewer; browser worker has stopped editing app.ts/checks.mjs.
Please independently review the delta against history/pre-convergence and replay
current focused browser checks. No external CLI reviewer was launched. This is a
review request and implementation record, not a reviewer verdict or P4 acceptance.
Final source/artifact hashes: ../convergence-review/identities.json.
Current work: /private/tmp/st-p4-browser-fLlJQx. Evidence: ../evidence/.

Scope: browser fixture only. Human requested-route input and deterministic embedded
producer both converge on acceptProposal, then the unchanged review, exact-command
host grant, remote outcome and local settlement methods. The original AG-UI button
remains for prior controls. Human and UI/browser-automation initiators remain unknown;
embedded context is an explicit host declaration displayed as not authenticated.

Start embedded captures and retains the immutable observation before the inter-event
pause. Completion evaluates a deterministic rule from that packet, not current
backend values, and streams its resulting proposal through AG-UI with a builder
closed over the same observation. Old capacity 10 yields west; current capacity 0
cannot silently upgrade that packet's revision. Fresh evaluation at zero yields south.
No new reasoning engine, protocol wire type, public API or native behavior is added.

A producer waiting before proposal creation is the only new owned resource. Other
proposal entry is disabled while it waits. Completing it disposes its stream; explicit
session disposal cancels it before any operation/grant/native transaction exists.
Existing unresolved operation/grant/local recovery guards still precede owner disposal.
Actual navigation, reload and durable handoff remain outside the demonstrated scope
and are explicitly labeled in the UI; no route framework or navigation veto was added.

Validation: Node 24.15.0, strict full Angular AOT with strictTemplates and
skipLibCheck=false; 15 DOM cases pass, no page errors. The original 12 test bodies
are byte-for-byte unchanged. Added three:
1. Human south proposal then host-declared embedded west proposal traverse the
   same consent/command/local path; embedded lost ack retains grant and retries
   without duplicate commit, then clears local pending responsibility.
2. Embedded observation captured at capacity 10/version 0; independent service
   writes capacity 0/version 1 before completion; old west proposal preserves
   version 0, is rejected and rolls back while independent note survives. New
   observation/evaluation selects south and succeeds. A hardcoded-west producer
   or response-time observation upgrade would fail these assertions.
3. Disposal while waiting cancels the producer with no grant, command delivery,
   commit or late proposal, and tree cleanup runs once.

Both new implementation runs passed; no new first semantic failure occurred. The
first pass used ABA for delayed input; its source/results remain in
history/convergence-first-aba-pass. The second strengthens it with changed data
and a fresh opposite route decision. All prior first failures remain preserved.
Pre-change 12-case source/evidence is in history/pre-convergence.

Replay from repository root:

```sh
PATH=/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:$PATH node tools/experiments/multi-actor-operations/installed/browser/run.mjs
```

The runner reuses unchanged pinned kernel/Angular tarballs, offline installs peers,
compiles only the consumer AOT, then runs the local server/Chromium. Package/runtime
sources, broader docs and walkthrough remain untouched. Main owns guidance updates.
