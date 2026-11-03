# Bounded Link delivery and evidence follow-up

Production Link remains unchanged. This follow-up separates revision eligibility
from delivery state. It does not select a public API, add a configuration option,
reopen B, change budgets or qualify automatic independent progress.

Source baseline: `65dd717fcda88663d0200c5b254784aec37f9239`. Production runtime
remains `87f6831fa60cafe87508f0ace84b7638698ca3b0`.
[Specification](SPEC.md) and [delivery proposal](PROPOSAL.md) precede execution;
[premise review](premise-review.md) records the accepted interpretation.

## Delivery mechanism and findings

A requested revision can be held while an older request is already in flight.
These are separate states. Eligibility belongs to a specific immutable ticket;
it cannot be transferred to another payload. Supersession cancels an unstarted
attempt, not an endpoint call that has already begun.

The private source-loader revision uses the existing Link projection, queue,
acknowledged value and settlement waiter machinery. It adds:

- A ticket captured with the payload, revalidated against immediate mutation
  authority after sending observation and immediately before endpoint invocation.
- A denied-attempt result that releases the send chain while preserving an actual
  Link-held promise. New eligible work can therefore progress without falsely
  completing `settled()` for unknown work.
- Restoration of the sending flag when observation throws. Existing reporting
  and subsequent-input retry remain the error mechanism.

Queued reentry now prevents captured42 from sending when the observer replaces it.
A subsequent authoritative9 progresses. For started42, unknown7, completion42,
then authoritative9, the endpoint receives `[42,9]` serially. When9 arrives while42
is already in flight, the same corrective sequence converges after completion.
Acknowledging42 in between is correct: those were the bytes actually sent.

Held settlement waits persist until eligible correction or connection disposal.
Correction equal to acknowledged state releases the wait without a duplicate send.
Explicit disposal before start prevents delivery; disposal after start does not
claim to recall that request. The prior tree-destruction trace still sends42 in
both unchanged control and experiment. This inherited lifecycle finding remains
separate and unqualified; connection disposal is not proof of tree destruction.

The unchanged prior witness is preserved and replayed. Its authoritative ingress
case still sends42 and7 through a separate outgoing connection while unrelated x7
is pending. Prior copied-value and callback leakage controls retain their results.
No previously failing ordinary-progress assertion was rewritten as success.

## Eligibility and immutable evidence

Ordinary direct writes remain unknown even after unrelated confirmation. The cause
is missing eligibility evidence, not a blocked wake-up. Confirmation does not prove
that an outside write was independent; this experiment must not cleanse it.

The finite A/B/C model now keeps owner outcomes private, rejects duplicate owner
registration and irreversible terminal transitions, authenticates revisions, and
exposes frozen dependency read facades over copied private data. Plain-record
payload cloning remains bounded; arbitrary mutable containers are not qualified.
Destruction cannot be reversed by assigning the exposed alive property.

The original adversarial controls have preserved red results. The original semantic
fixture also remains unchanged: it confirms p and then rejects p, so it correctly
fails the newly explicit irreversible-outcome rule. A separate fixture uses a distinct
rejected owner and keeps all 42 assertion names and expected values. Those assertions
include deliberate hidden-owner leakage and unmet-progress witnesses; they are not
42 fulfilled product requirements.

The first delivery revision inherited mutable ticket objects. Its mutation failure
and exact first source remain saved. Freezing those tickets completed the requested
immutability work; it did not change the delivery algorithm or add another policy.
The owner model and actual scalar tickets are separate evidence claims. Neither
provides automatic discovery of hidden contributors or validates false declarations.

## Qualification boundaries

[Delivery results](DELIVERY.md), [evidence results](EVIDENCE.md) and
[independent implementation review](implementation-review.md) give exact outputs
and limits. The experiment uses finite microtask checkpoints, not a general liveness
proof. Native frameworks, entities, automatic multi-hop/deferred provenance,
retained-heap behavior and production cost are unqualified. Research revision maps
still retain metadata. Model scheduling fields remain trusted harness inputs;
that model is not a production queue.

The shared engine's explicit-ownership/manual policies remain model-only. Passing
its immutable evidence controls does not mean those policies were integrated into
Link. No new policy override can fill the unknown-evidence gap by itself.

## Disposition and remaining product boundary

The tested delivery fixes survive the bounded controls; general automatic progress
does not. Do not adopt or integrate this harness. The production conservative hold
and automatic-progress release blocker remain in place, along with the separate
entity-budget blockers.

The remaining scope choice is concrete: either keep ordinary independent automatic
publication required and keep release blocked until a separately justified evidence
boundary exists, or explicitly narrow the automatic promise to provable boundaries
and rely on application-owned workflows for unknown inputs. The owner has retained
the first requirement; this record does not reverse that decision. The experiment
adds no basis for claiming unknown writes are independent. Further implementation
would require a specific new evidence mechanism or an explicit product decision,
not another delivery guard or expanded configuration menu.

## Verification and replay

Root and independent reviewer replayed the final bundles. All 34 targeted delivery
assertions pass, including two actual `onTreeError` assertions. Thirteen model
adversarial checks and the setup-corrected 42 observations pass. The original
conflicting fixture remains a documented failure. Root replay confirms the ticket
mutation now throws and sends nothing. Strict TypeScript passes for standalone
helpers/model; esbuild execution does not typecheck transformed kernel integration.
All 88 original kernel input hashes match in each of three final receipt files;
exactly Link and PathNotifier change in memory. The bridge=false rows use original
scheduling through the transformed harness; the prior archive holds the truly
unchanged-source control. These are not interchangeable baseline claims.

[Evidence archive](evidence.tar.gz) preserves first sources, first failures, final
bundles/receipts, reviews and root replays. [SHA256SUMS](SHA256SUMS) pins this record.
Replay saved bundles without modifying first-run artifacts:

```sh
mkdir -p /private/tmp/link-delivery-replay
tar -xzf evidence.tar.gz -C /private/tmp/link-delivery-replay
export PATH=/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:$PATH
cd /private/tmp/link-delivery-replay/delivery
shasum -a 256 -c SHA256SUMS
node --input-type=module -e 'const {run}=await import("./bundle.mjs"); console.log(JSON.stringify(await run(),null,2))' > ../prior-witness.json
node --input-type=module -e 'const {run}=await import("./targeted-bundle.mjs"); console.log(JSON.stringify(await run(),null,2))' > ../targeted.json
node --input-type=module -e 'const {run}=await import("./attack-bundle.mjs"); console.log(JSON.stringify(await run(),null,2))' > ../ticket.json
cd ../model
shasum -a 256 -c SHA256SUMS
node adversarial-test.ts
node lifecycle-test.ts
node engine-test.ts
node engine-test-original.ts # expected terminal-outcome fixture rejection
```

Exact build and strict-check commands are in the component result records. Original
absolute loader paths remain preserved for provenance. A zero bundle-run exit does
not imply every requirement passed: inspect assertion results, inherited FAIL rows,
harnessError and explicitly unmet eligibility. No full suites, demo/package build,
benchmark or release verification was justified for this documentation-only commit.
