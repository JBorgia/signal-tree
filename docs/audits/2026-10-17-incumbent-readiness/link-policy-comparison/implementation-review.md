# Independent private Link bridge review

Reviewed PLAN.md, private.ts, loader.mjs, witness.ts, traces and source hooks under `/private/tmp/link-policy-bridge`. Production edits: none. Initial review is source inspection plus independent replay of the generated bundle; worker is collecting additional raw falsifiers, to be appended.

## Observed narrow result

Independent command: `node --input-type=module -e "const {run}=await import('/private/tmp/link-policy-bridge/bundle.mjs'); const r=await run(); console.log(JSON.stringify(r.filter(x=>x.phase==='pending'||x.assertion==='FAIL'||x.harnessError),null,2));"`. Bundle hash immediately afterward: `02106f0250cd61880ae570b86b5183d37f4e4172114435ce48fac1c54225a6a6` (worker concurrently building; use final paired receipts for archival provenance).

Replay observed control ingress `[]`, private bridge ingress `[42,7]` with x still 7 pending. It observed bridge reentry assertion failure: `sent:[42]`, current y 7. This is stale authoritative-revision publication after an observer changes y, not evidence that speculative 7 itself escaped. It also observed control rejected-copy failure with sent7 after rollback; this differs from the earliest traces inspected, so exact source snapshot/loader receipts matter. The bridge held that unknown copied revision.

The private policy's useful ingress result is non-vacuous: distinct incoming/outgoing connections on the same scalar share the tree with pending x. Unknown writes remain held even after confirmation, accurately an unmet ordinary-progress obligation rather than a complete replacement.

## Findings

1. **Final admission check is absent after sending observation.** Loader replaces the two schedule calls, but actual Link calls observeLink after approval before endpoint.set. That observer changes y to unknown copied7; the captured authoritative42 still sends. Spec's reentrant revision requirement fails and must remain reported. This is a boundary defect in the experiment; it does not establish unsafe speculative payload egress.
2. **Potential permanently stranded send after unknown intermediate revision.** Source: private.admit stores callbacks keyed by sendConsequenceKey but never invokes held callbacks. Scenario sent to worker: authoritative42 starts in flight, unknown7 arrives, first request resolves and sendEligible becomes held, then authoritative9 arrives. New flush can be admitted but appends to a chain waiting on the old held send. No wake path in private.ts releases it. Existing inflight case changes directly to known7 before acknowledgement, so misses this state. Pending execution confirmation.
3. **First matching notification is not intrinsically an installation receipt.** acquire tracks `(owner,position,consumed)` and annotate grants clean to the first matching notify. It does not identify the exact incoming mutation or capture atomicity. Asked worker to exercise an intrinsic observer before Link observation that reenters same-position writing pending captured7 before the outer incoming42 notification, plus enqueue-observer reentry after stamping. These distinguish an actual admitted-installation proof from dynamic-scope coincidence. A source possibility is not yet an observed leak. The later latest-reference equality may conservatively hold many reordered cases; preserve that outcome if so.
4. **Retention claim must stay narrow.** heldCount0 demonstrates only no retained held callbacks after dispose. `latest` and `receipts` grow and are not deleted on tree/connection destruction; neither measurement nor code establishes total roots zero or heap collectibility. Entries currently contain numbers/facts rather than trees, but unbounded entries remain a limitation.
5. **Bridge and model coverage differ substantially.** Bridge derives only clean/unknown scalar facts. It does not infer portable or native reads, nested dependencies, owner outcomes, coherent records, or B/C declarations. Model-only algebra cannot fill those integration gaps. This is acceptable if each claim remains explicitly split.

## Engine source note

Engine.ts is a finite trusted algebra, not an integrated ownership authority. At initial inspection owner/outcome permit identity reset and arbitrary terminal-state reversal; returned Facts owners Set is mutable at runtime despite ReadonlySet typing, and freezing only the outer revision does not freeze it. These are relevant if claiming enforcement of immutable facts or terminal owners. They may instead be documented trusted-harness assumptions; no adversarial application API is implemented. Node strip-only execution failed on constructor parameter property, preserved by worker; that tooling failure is not a semantic test result.

Disposition so far: useful scalar ingress observed; candidate does not meet all unchanged specification discriminators. Do not infer production readiness or declare the ingress scope generally safe from the small pass set. Await additional raw witnesses before finalizing exact limitations.

## Final raw-falsifier addendum

Read final RESULT.md and extended traces. Independently replayed final bundle through `import('/private/tmp/link-policy-bridge/bundle.mjs'); await run()` and filtered the concrete scenarios. No policy or witness edits by reviewer. Final reviewed identities:

- bundle.mjs: `f0563a215211937edeb1af10380865833f8c7f683ca6c411e55beda4b7be0d69`
- private.ts: `90fc78d2f07350bc58f74e962e2eaccccdeff2489e0452d8655ed5117d393394`
- engine.ts: `cfaa8999c837a09d2e8386e859e2b98c0eba4ab58c10c115243c540507531a74`
- witness.ts: `890f1a112b00e3e564f15c39a6ac22b94fcc77578fc44ac783a43866fa14699a`
- traces.json: `a61d698be8148455654067403e89f63bd2bb013a890740a6a8a815f98cec4b10`
- baseline-traces.json: `f5f5d00b9cd82cbcf79ad0ae9dd981a5aebe8c77894c7be8d9b8382498f5333a`

Confirmed held-inflight liveness failure: sent remains `[42]` with current y9, both before and after p confirmation. This executes the previously hypothesized held-send/chain deadlock. No correct later eligible progress established in that state.

Confirmed both attribution falsifiers hold: pre-notify intrinsic reentry and enqueue-observer reentry each produce `sent:[]`, current y7. The first matching event can be the nested event, but a subsequent unknown/latest revision invalidates eligibility in this exact ordering. Therefore this review found no speculative leak in those two witnesses. Their passes do not upgrade first-notification matching to a universal installation receipt.

Confirmed stale-revision reentry remains sent42/current y7. Confirmed tree-destroy sends42 before the later confirm-on-destroyed-tree harness error. Inspected baseline-traces.json, and compared all baseline receipt original/loaded hashes: zero changed inputs. The same tree-destroy send is present in byte-identical source control. This is a concrete baseline behavior against the experimental requirement; it is not a bridge-specific regression or a settled product-lifecycle defect determination. No additional lifecycle investigation or repair requested.

### Engine limitations are executable, not merely type concerns

Ran a finite direct model check against the engine hash above with Node ESM importing Engine/facts. Sequence A: register p, propose7 with p, reject p, send, confirm p, send. Sequence B: register p, propose7 with p, call `revision.facts.owners.clear()`, send. Observed exactly:

`{"rejected":[],"reopened":[7],"mutatedEvidence":[7]}`

Thus the model checks declarations against a known lower bound only while the harness preserves that bound and terminal outcomes. It does not enforce terminality or runtime immutability of evidence. `ReadonlySet` discourages mutation in typed callers but does not freeze the returned Set; owner/outcome can reset identities/states. Plain-record payload cloning/freezing tests remain valid; they are distinct from immutable evidence. RESULT.md's finite-model framing is appropriate, but its statement that rejected owners cannot be cleansed needs this explicit qualification. These findings do not imply a production public API vulnerability: none was implemented.

### Finite disposition

RESULT.md accurately reports the three integrated failures, unmet ordinary automatic progress, actual-Link/model split, trust in external authority, and retained research metadata. Add the engine qualification above when preserving the result. The candidate fails its integration discriminators and must not be promoted. The useful surviving result is narrowly demonstrated authoritative scalar ingress progress with conservative unknown holds. No further implementation, broad exploration, architecture reopening or repair is necessary to complete this experiment.
