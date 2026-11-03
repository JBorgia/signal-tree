# Independent adoption-contract review

Reviewed source checkout HEAD `676ecb7955c6a0af6898bb17225d68060692fc95`, current contracts, review protocol, prior link-product-comparison evidence, and both new application scenarios. Premises and planned falsifiers are in `/private/tmp/link-adoption-review-plan.md`. Source files in the repository were not changed by this reviewer.

## Executed evidence

Independently replayed each saved bundle using Node v24.15.0:

- `node --input-type=module -e 'const result = await (await import("/private/tmp/link-adoption-draft/bundle.mjs")).run(); console.log(JSON.stringify({groups: result.outcomes.length, deliveries: result.endpointDeliveries}));'` → eight groups, thirteen endpoint deliveries. Output `/private/tmp/link-adoption-draft-independent-run.log`.
- `node --input-type=module -e 'const result = await (await import("/private/tmp/link-adoption-outbox/bundle.mjs")).run(); console.log(JSON.stringify({groups: result.length}));'` → eight groups. Output `/private/tmp/link-adoption-outbox-independent-run.log`.

Checked every source path in draft receipt.json (90 inputs) and outbox source-receipt.json (101 inputs) with Node crypto SHA256 against current bytes; no mismatches. Reviewed complete editor/scenario and application/test sources. These are replay results of source-bundled neutral kernel fixtures, not installed-package/framework/browser or release verification. An assertion group is not an independent product qualification.

## Draft finding and disposition

The workflow substantively demonstrates isolation, useful simultaneous ordinary Link publication, coherent two-field acceptance, explicit overlap conflicts, both choices, rejection without publication, continued live synchronization, obsolete async completion suppression and teardown. Its endpoint assertions contain actual complete Ticket values; absence assertions are paired with useful sends.

Source review found an ordinary ABA counterexample to the initial plan's freshness policy: comparing current live values with reviewed values alone permits A→B→A between review and acceptance. Worker self-review independently found it. The final source adds an application live revision and tests ABA plus a late overlapping edit. Initial passing source/output are preserved rather than represented as testing that case. Final assertions pass on replay. Acceptance writes the two editable leaves in one confirmed transaction; ordinary root Link publishes the complete Ticket. This is more precise than the plan's phrase “complete Ticket installation.”

Concrete burden: base/draft copies, a separate reviewed snapshot/conflict list, session/edit/live revisions, declared editable fields, per-field three-way rules, explicit conflict choice/review/accept/reject actions, suggestion freshness checks, and tree/Link/session cleanup. Any new writer must preserve the live revision discipline. Published values remain ordinary live truth; all consumers do not automatically preview the review state. Copying draft values through liveEdit still bypasses the intended review boundary. Draft RESULT.md accurately states the limits, including scalar policy, no server CAS, no confirmation-failure recovery qualification and no remote durability.

## Outbox findings and disposition

The workflow substantively demonstrates actual-handle settlement gating, independent audit progress while dispatch awaits two contributors, cancellation and explicit supersession, applied-before-ack failure with explicit retry, shared drains, active-versus-queued destruction, rollback refusal with useful subsequent settlement, and a negative owner-omission leak. The retry deliberately applies the same command twice: this is valuable evidence of acknowledgement ambiguity, not exactly-once success.

Independent review found the original begin heuristic could observe multiple opened transactions and throw after obtaining an outer handle, stranding that handle until tree destruction. The final test preserves an actual lifecycle-observer reentrancy counterexample against application-first.ts. The final implementation captures the exact active transaction ID in its own callback using the existing exported `activeTransactionContext`, and the corresponding control settles both handles and restores the initial state. That is a concrete repair to this fixture; it does not authorize a new public convenience API.

The first two failed execution controls expected a leaf subscriber and Link endpoint error to throw synchronously from settlement. Source confirms those were fixture premise errors: location-runtime.ts contains listener exceptions, while link.ts schedules endpoint sends asynchronously and catches/reports `link:set` failures. The corrected rollback test proves terminal rejected state despite the contained listener error. The final throwing-confirmation test uses a private `deferOperationConsequence` fault injection in test scaffolding, then verifies actual lifecycle confirmed state and useful command delivery despite the throw. It qualifies that injected reconciliation path, not a synchronous ordinary Link endpoint failure contract. Preserve failed logs and source.

Concrete burden: command IDs and immutable scalar payload copies, explicit full contributor sets, owner-ID/handle mapping, tooling lifecycle subscription, pending/confirmed/rejected/unknown classification, entry states and attempts, explicit retry and supersession policy, single-worker draining, and in-flight/queued teardown distinctions. Both `activeTransactionContext` and `transactionLifecycleReader` are versioned `/internals` tooling imports. The first establishes callback identity, the second observes settlement authority; neither automatically discovers command provenance. Public handle status is not invented from whether settlement returns or throws.

Remaining limits visible in current source:

- Owner.state, Entry.status and entries Map are mutable trusted application bookkeeping; callers can bypass policy. Omitting one real contributor also leaks, as actually tested.
- Callbacks throwing with recoverable automatic-abort refusal are not registered into wrapper recovery; arbitrary transactions created through exposed tree access likewise do not gain declarable wrapper owners automatically.
- Draining is serialized across awaited endpoint work. A slow/hung endpoint delays later independent entries. Settled/failed records are retained; destroy clears the owners Map but entries retain owner/handle references while the service remains reachable. No heap-cleanup bound is established.
- The test demonstrates in-flight destroy uncertainty and queued abandonment, not recall of remote work, crash recovery, persistence, receiver idempotency, automatic effect-scope propagation, or comprehensive reentrancy.

These are adoption costs and stated boundaries. They do not invalidate the demonstrated command workflow, but prevent claiming a qualified general transaction-owned outbox replacement.

## Scope interpretation

Both samples now offer application-shaped feasibility evidence with substantive actions, controlled endpoints and ordinary counterexamples beyond the earlier small comparison. Their burden differs: review-state copies and conflict policy versus explicit publication intent, contributor declarations, lifecycle bookkeeping and retry uncertainty. Neither burden inventory is a cost ranking or proof of universal preference. No equivalent-capability runtime measurements exist here.

An owner can use this evidence to decide whether either workflow fits an intended application and whether product scope should change. Passing these fixtures does not itself approve narrowing the supported independent-progress contract, remove live proposals, select API/export changes, reopen B, remove the conservative safe hold, or close release/artifact blockers.

Final interpretation check: reviewed outbox RESULT.md after completion. It expressly distinguishes the tooling-dependent service from a facade-only recipe, preserves the first/second/third fixture failures and compiler correction, labels the private fault injection, and discloses the remaining adoption limitations above. No substantive overclaim found. Draft and outbox reports can support bounded feasibility/adoption-burden discussion; no additional product authority follows.
