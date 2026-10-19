# Baseline Link ordering failure: precise boundary trace

No runtime repair or repository edits. Source HEAD16f85b6d2b46ac1404ef6b089a1e6a459c28cdc3. Per-input source hashes recorded by runner. Original unchanged counterexample remains link-entity-baseline.mjs/json. Instrumented trace only adds event logging to a bundle; it does not alter scheduling or insert flushes. Direct ids/all reads at rollback return are diagnostic observations.

## Observed sequence

1. Initial physical IDs[a,b], lifetimes[1,2].
2. Ordinary setAll with reorder:true inside transaction captures beforeSubjects[1,2], afterSubjects[2,1]. Link receives this exact correct capture.
3. Link's queued order microtask applies [2,1] to its eligible projection. Consequence attempts see open scope and remain held. Before rollback IDs[b,a], outbound[].
4. Rollback prepares target order[1,2]. `prepareEntityTransitionTarget.install` installs structural target and actual keys become[a,b].
5. `publish` invalidates native/current projections via updateSignals, then publishes one row notification per surviving subject. Neither row has add/remove/rekey structural change.
6. No rollback collection-order capture is produced or received. There is exactly one producer-order-capture, link-order-capture and link-order-microtask in the trace: the forward speculative reorder.
7. Commit scope settles with discard and releases2 held consequences. Rollback returns: direct ids[a,b], all[a,b], outbound[].
8. Both rollback row notifications reach Link: subject2 then1, origin transaction-rollback, fields[]. These deliver BEFORE the next endpoint entry.
9. New admission sees no open scope. Endpoint receives[b,a] from the unchanged eligible order.

This distinguishes absent order publication from merely late delivery: existing rollback notifications have already arrived before the wrong send. An extra flush cannot supply a missing order fact.

## First causal divergence and source evidence

- entity-signal.ts1036–1048 ordinary `publishOrderChange` calls mutationCaptureRuntime.publishCollectionOrder with before/after subjects.
- entity-signal.ts3707–3710 setAll invokes this for a surviving order change.
- rollback routes through transactions.ts2623 rollbackPendingTarget and target-transition.ts116–128: install all targets, mark committed, publish each.
- physical/prepare-entity-target.ts166 installs target order;177–244 publication updates signals and emits row-level structural/value notifications. There is no order-capture publication. EntityTargetHost likewise provides no order callback.
- link.ts862–884 subscribes to collection-order capture and updates eligible order in its microtask. This route is never invoked for the rollback target.
- entity-egress-projection.ts42–45/189–194 treats empty fields as no row change; row update has no authority to invent ordering. It retains prior eligible[2,1].

First physical/projection discrepancy is expected transiently during install. The defect is the missing order fact at prepared-target publication: its successful completion gives Link no path to reconcile that discrepancy before terminal consequences. Native collection invalidation succeeds; Link eligible projection remains stale. Capture payload is not wrong, and rollback does not fail installation.

## Finite regression proposal (no implementation)

Permanent public assertion reproduces original sequence unchanged:
- seed a,b;
- link direct collection to recorded endpoint;
- transact setAll b,a reorder:true;
- drain existing notification/Link turn; assert no outbound pending order;
- rollback; assert ids and all equal a,b;
- await existing Link settlement/drain; assert every outbound payload reflects a,b, never b,a.

Positive control: confirm identical reorder sends b,a. Include separate successful ordinary reorder. Regression must run baseline first and preserve its wrong payload, not merely assert final physical order. Pair with inspection-order suppression and non-order compensation tests; order notification must follow existing participation contract rather than reseeding from physical state indiscriminately. A narrower internal trace assertion may confirm rollback publishes one legitimate reversal order transition, but public endpoint payload is the primary acceptance test.

No proposed callback timing/API/ordering semantic change. Any future repair should publish the installed order through the established channel after coherent target installation and before durable delivery, preserving inspection participation and reentry. That is a repair boundary, not an implemented or qualified solution.

## Replay

NODE=/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node
$NODE /private/tmp/link-entity-baseline.mjs
$NODE /private/tmp/link-order-trace.mjs

Files: link-order-trace-code.txt, link-order-trace-transform.mjs, link-order-trace.mjs, link-order-trace.bundle.mjs, link-order-trace.json. Transform is instrumentation only, independent of prior scalar/entity admission experiments. No extra flush, source modification, broadened suite or repair performed.
