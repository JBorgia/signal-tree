# First implementation checkpoint

**Historical checkpoint sequence, not the active task queue.** Current work and
acceptance gates are maintained only in [RELEASE-CURRENT.md](../../../RELEASE-CURRENT.md).
Pending/next statements below describe their dated checkpoint and may be
superseded later in this record. Preserve them as evidence, not instructions.

October 29, 2026. Implements the first slice of the owner-selected [plan](PLAN.md).
This is not whole-product completion or v16 release qualification.

## Implemented

The [reference coordinator](../../../tools/experiments/multi-actor-operations/README.md)
provides immutable proposals and review bindings, revision invalidation, unknown or
declared actors, explicit operation/attempt identity, definitive rejection versus
uncertain delivery, idempotent retry through an authoritative fixture, and terminal
cleanup. No native state mirror, inverse ledger, public package or export was added.

The dispatch backend is an in-memory test authority. It atomically checks declared
field versions and fixture permission before applying commands. It does not prove
production authentication, durable idempotency, database crash consistency or
complete input declarations. Its receipt retention is deliberately not production.

## Actual SignalTree composition

The pinned runner imports public kernel and tooling source barrels at
`5727cd8fcf701128358674411400c019b137a5e4`. This active evidence checkout identifies
retained runtime `87f6831f`; the runner does not claim exact installed87 artifact
qualification. Root tooling supplies esbuild because the active dependency symlink
is broken. No active source or dependency link was changed.

Six probes pass, with three explicitly demonstrating limits: inspect/current-value
comparison does not bind consumed input revisions; coalesced observation omits
net-zero input ABA; Link completion can resolve following endpoint failure.
Current-value synchronous validation and operation/lifecycle correlation work in
the bounded cases. No atomic validation/confirm race was demonstrated; a new native
export is not justified by these probes alone.

Three additional workflows use actual public transactions with the coordinator:

1. Accepted version-checked backend command, followed by distinct local confirmation.
2. Backend input-version ABA rejection; local rollback preserves an independent note.
3. Lost acknowledgment leaves the same native transaction pending; retry reuses the
   command identity, applies once in the fixture and then allows local confirmation.

This explicit application workflow is not a substitute for approved conditional
Link progress. It adds no implicit capture across async work and makes no claim
about arbitrary native-effect/approval atomic binding.

## Validation and independent review

Node `24.15.0`, matching `.nvmrc`:

```sh
node --test tools/experiments/multi-actor-operations/*.test.mjs
node tools/experiments/multi-actor-operations/native-probe/run.mjs /path/to/readiness/checkout
node tools/experiments/multi-actor-operations/native-probe/run.mjs /path/to/readiness/checkout --workflow
```

- Coordinator and harness: **18/18 tests pass**.
- Public source probes: **6/6 pass**, including assertions of limitations.
- Native composition: **3/3 pass**, independently replayed.
- Independent premature-confirm mutation is killed by pending-count assertion.
- Primary error identity survives cleanup/reporting errors; all cleanup callbacks run.

First harness failures are retained under `native-probe/first-failures/`. Initial
workflow code used the wrong inspection field and cleanup masked the error.
Independent review subsequently showed that nonempty inspection did not prove
pending authority: the premature-confirm mutant originally survived. The corrected
lifecycle assertion kills it; both outcomes remain preserved. No runtime contract
was weakened to fix these test defects.

Architecture review checked governing-plan authority and kernel/companion/backend
ownership. Code review found the two evidence defects above; final independent
replay found no remaining blocker within this bounded slice. The full release
registry, Nx package suites, installed consumers, framework/browser suites and cost
comparisons were not run because no production kernel/facade source changed and
this prototype does not yet claim those capabilities.

## Historical remaining implementation at the initial checkpoint

- Build and identify installed artifacts for the public integration; add strict
  consumer typing and actual framework workflow before claiming adoption readiness.
- Carry outcome/recovery handling through real confirmation refusal and post-terminal
  observer-error cases; current three workflows do not exhaust those boundaries.
- Resolve the existing reviewed native recurrence mechanism, preserving all original
  collection/provenance failures. No production patch or automatic B successor.
- Integrate one protocol adapter and framework demo with backend permission enforcement.
- Execute common-outcome comparisons, lifecycle/retention and representative cost work.
- Qualify exact final artifacts and release-visible documentation before release.

No package, API, budget, production behavior, active readiness controller or
publication state changed. The prototype is explicitly included in Git discovery;
other ignored experiments and unrelated `frontier` remain untouched.

## Extended implementation checkpoint

The initial checkpoint above is preserved. Subsequent work now supplies:

- [Installed kernel and Angular artifacts](../../../tools/experiments/multi-actor-operations/installed/README.md): fresh canonical builds, tarball hashes, offline installed strict consumers, direct and bundled execution, full Angular AOT. The six probes, three workflows and two settlement controls pass. Main independently replayed the installed workflows, settlement cases and typed operation consumer.
- [AG-UI tool adapter](../../../tools/experiments/multi-actor-operations/protocol/README.md): nine independently replayed controls after correcting disposal/reentrant completion. The original two failures are preserved.
- [HTTP boundary](../../../tools/experiments/multi-actor-operations/http/README.md): two original and four independent controls cover real transport ambiguity, permission, malformed requests and command-key reuse. No durable backend claim.
- [Real Angular browser reference](../../../tools/experiments/multi-actor-operations/installed/browser/README.md): seven DOM-driven scenarios pass; independent review is in progress. This replaces the earlier class-only observation limit for these scenarios, not for every facade.
- [Matched common workflows](../../../tools/experiments/multi-actor-operations/comparison/README.md): C0/C2/C3 pass nine scenarios each. C1 is being added. No unique coordinator capability or performance superiority follows from these results.
- [Teardown falsifier](../../../tools/experiments/multi-actor-operations/lifecycle/README.md): a retained disposed coordinator kept its transport closure alive. The source and first failure are preserved; clearing the adapter after the unresolved-operation guard passes the same collectibility control. Independent review is pending.
- [Developer guidance](DEVELOPER-GUIDE.md) separates actor attribution, local responsibility, review consent, server authority and delivery uncertainty.

The first [native certificate successor](native-certificate/DESIGN.md) remains
rejected. Its full source/patch identities and independent reproduction are
archived. The next reviewed mechanism requires mandatory occurrence enrollment,
complete ancestry, exact-slot lifecycle and incremental selected readiness.
No native candidate has been integrated and no production hold was relaxed.

A clean tracked-root snapshot plus these changes passes the documentation-link
checker: 572/572 links at the latest archived checkpoint. Running that checker in the original root also traverses
ignored `.claude` evidence/worktree copies and reports 1,121 unrelated broken
links; that invocation is not silently classified as green. This documentation
check does not qualify the older root runtime or active v16 artifacts.

## Reviewed application composition

The final reference at this checkpoint adds source-observation binding before
delayed tool completion, explicit local recovery after a terminal backend
rejection, and a separate exact-command review-grant fixture. Earlier seven-case
browser results remain historical; the corrected strict installed AOT workflow
passes 12 DOM scenarios. Independent general review passes those 12 plus five
added probes; separate security review passes those 12 plus two additional
combined scenarios. These overlap and are not summed. Main independently rebuilt
the consumer and replayed the 12 cases using the same verified library tarballs.

The four common comparison arms now pass 44 total tests: nine scenarios per arm
and eight lifecycle checks. The comparison establishes no unique common-outcome
advantage or speed ranking. C1 uses actual installed EntityMap state; native
transaction/publication equivalence remains a different gate.

See the experimental [verification ledger](../../../tools/experiments/multi-actor-operations/VERIFICATION.md).
Source-observation timing and disposal first failures, browser recovery failures,
and rejected native/framework implementations remain preserved separately.
The standalone grant fixture passes 12 adversarial tests; it is not production
authentication, remote attestation or durable storage. Unresolved navigation
responsibility and the unconstructed success/confirm-throw branch remain limits.

The current-reader SDK [decision](framework-current-read/DECISION.md) now has
owner authority for the bounded capability proof and explicit native-adapter migration. The initially proposed existing-SDK implementation fails stable
native metadata checks; it is not integrated. Standalone framework feasibility
work cannot by itself authorize an SDK or carrier-type change.

Native restoration adjudication preserved the original assertion: whole-row
authorship is lost when the experimental publication path derives fields from
value differences. The independent no-op interpretation was corrected and both
versions are preserved. No publication support is cleared merely on reappearance.
A shared producer correction remains under design; production Link is unchanged.

The optional review-grant HTTP composition now passes 15 original and independent
controls, independently replayed by Main. Its default remains ungated unless the
fixture explicitly enables review enforcement; endpoint shutdown is not a durable
recovery mechanism. See the HTTP independent review for exact identities and limits.

The in-session browser now demonstrates human and host-declared embedded entry
paths through the same operation, review, grant and local settlement flow. An
inter-event producer pause preserves the supplied observation; changed inputs
reject the old proposal and fresh evaluation selects a different valid route.
Strict AOT and 15 DOM cases pass; independent review replays those 15 plus four
additional controls. Main verified the reviewed source hashes. This does not
claim network-producer cancellation, navigation recovery or durable handoff.

The bounded current-reader SDK proof survives independent review: 46 focused and
6,484 full-suite passes, with five expected failures and 15 skips accounted
separately. Four canonical packed artifacts and strict consumers pass; all five
source mutants are killed by assertions. Main verified the source/artifact hashes
and independently replayed minimum-peer tests on Angular 20/21 and Vue 3.5.0.
See the [frozen proof](framework-current-read/proof/RESULT.md). This closes bounded
feasibility, not combined native integration, performance or release acceptance.

The publication endpoint model now has a bounded independent acceptance for a
native experiment: [39 unchanged and added controls](native-occurrence/endpoint-composition/RESULTS.md)
pass, including both preserved composition failures. Main replayed all 39. A
[separate native successor](native-occurrence/README.md) is now frozen on a covered inverse failure; model
acceptance does not qualify native installation, lifecycle or work bounds.

The native invocation correction passes its original 25 focused controls but
fails the subsequent [getter-reentry discriminator](native-occurrence/invocation-successor/reentry-review/RESULT.md).
Main reproduced the failure without private-metadata trigger selection. The
candidate remains frozen; the SDK proof's independent acceptance is unaffected.
No full native integration or release acceptance follows.
