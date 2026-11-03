# Link product alternatives — comparative research

Research source: `d7b538610684eb6a4a356820fb9cdd08be71840d` (runtime
`87f6831fa60cafe87508f0ace84b7638698ca3b0`). The owner authorized comparing
three product alternatives, not replacing Link or changing public APIs. Production
and its safe hold are unchanged; B remains closed. No release candidate is frozen.

## Product comparison before implementation selection

The options answer different questions; visibility is not scored as a correctness
failure merely because it differs from live proposals.

| Approach | What users see before approval | What publication means | Who supplies publication responsibility |
| --- | --- | --- | --- |
| Automatic committed projection + bounded tracking | Speculation through existing live references | Automatic whole-value synchronization of eligible revisions | Runtime within explicitly observable executions; unknown work needs a defined rule |
| Explicit transaction-owned outbox | Live proposals may remain visible | Explicit accepted snapshot/command entries, not every state change | Application declares all required owners; a future automatic effect scope would need tracking |
| Isolated review + ordinary live Link | Review UI sees draft; live consumers see accepted truth | Ordinary synchronization after intentional live installation | Isolation and application acceptance/merge policy |
| Conservative control | Live speculation | Existing eligible projection after tree-wide holds clear | Existing shared consequence authority; no finer independence proof |

The current implementation already has an eligible egress projection (`link.ts`,
starting around line303). It excludes inspection-only state and advances through
eligible effects. It is not an arbitrary provenance-aware committed store. Adding
another projection cannot distinguish a copied speculative ordinary write by
storage layout alone. This observation does not rule out a correctly classified
committed projection; it identifies the additional obligation.

## Dimension scores

Scores are qualitative, not measured rankings or an aggregate winner. **Demonstrated
slice** means the new neutral-kernel application samples below. **Conditional** means
an explicit usage boundary. **Unqualified** means production correctness is absent.
Ceremony/integration assessments are source/design inferences; CPU/heap/bytes remain
unmeasured at equivalent capability. No numerical score conceals unknowns.

| Dimension | Automatic projection/tracking | Explicit outbox | Isolated review | Current control |
| --- | --- | --- | --- | --- |
| Safety | Unqualified: prior nested policies fail; native/deferred inputs missing | Conditional demonstrated slice; wrong owner declarations leak | Conditional demonstrated slice; draft-to-live violations leak | Existing pending hold controls; not universal asynchronous information-flow safety |
| Independent progress | Unqualified at full requested boundary | Demonstrated slice for independent entries; skips pending-owner entries in O1 | Demonstrated while draft stays outside live tree; live transactions still hold Link | Fails same-tree progress while any scope pending |
| Developer ceremony | Low in fully instrumented code; unknown boundary adds rules | High: enqueue, owner sets, supersession, retry/disposal | Moderate: draft UI source, accept/discard, stale/conflict policy | Low initial ceremony; potentially expensive blocked workflows |
| Framework integration | Highest unresolved burden: cache hits and scheduling/reads | Low for explicit service glue; automatic effect scope remains high-risk | Existing framework forms/signals fit; preview consumers explicitly use draft | Existing integration reused |
| Backend requirements | Existing snapshots possible if coherent revisions defined | Snapshot endpoint possible; commands/idempotency/durability require extra protocol | Existing live endpoint possible; concurrent edit policy still required | Existing endpoint contract |
| Runtime cost | Unknown; revision labels, dependency retention, projection work | Unknown; entry payloads, owner sets and retry storage move into application | Unknown; draft data and duplicated derivations, no live provenance model in sample | Known current artifact only; no new matched cost comparison |

An explicit outbox and an automatic transaction effect scope are **not the same
score**. The sample uses explicit ownership. Automatically assigning effects across
callbacks/await inherits the provenance problem and may also incorrectly transfer
ordinary write ownership. No such reassignment is proposed.

## Shared eight-discriminator ledger

These are capability results and gaps, not eight fully qualified passes per arm.
Automatic-arm evidence is reused from the preserved provenance experiment. The
control is existing exact-source evidence plus the paired probe, not a new campaign.

| Discriminator | Automatic arm | Outbox slice | Isolated-review slice |
| --- | --- | --- | --- |
| Unrelated progress | Hypothetical trusted input only; no production solution | O1 sends independent entry while proposal open | D1 sends live status while draft is edited |
| Direct/multi-hop speculation | Initial nested model leaks; conservative repair overholds | O1 keeps explicitly owned derived payload queued; O5 proves omitted owner leaks | D1 derivations stay in review state; D3 proves premature bridge leaks |
| Multiple pending inputs | Label union modeled; production ownership discovery missing | O2 waits for both explicit owners before one complete payload | D2 accepts one reviewed batch; independently evolving/conflicting drafts untested |
| Independent overwrite | Conditional model revision replacement; production no-op semantics unknown | O3 supersedes old queued intent with explicitly independent entry | Ordinary live writes possible; stale draft acceptance/conflict detection unqualified |
| Reject queued speculation | Discard cannot merely cleanse token; compensation not integrated | O1/O3 cancel unsent rejected-owner entries | D1 discard has no live effect; cannot retract a previously accepted/in-flight payload |
| Deferred work | Current write metadata cannot classify tested captured copy | O3 carries owner explicitly across await; unknown entry remains held | D3 generation check rejects stale deferred completion; application policy |
| Coherent payload | Whole-revision/domain definition still required | O2 one complete object; remote multi-command atomicity untested | D2 actual transact/confirm emits complete root object, no partial pair |
| Destroy/retry/failure | No integrated proof | O4 retains failed entry for explicit retry; destroy deliberately abandons queue; in-flight/reentrant/crash behavior unqualified | Reuses Link; samples dispose/destroy; existing failure/disposal tests are source evidence, not newly rerun |

## Executed evidence and its limits

`PLAN.md` and its hash precede execution. `first-run.log` records seven completed
examples. After independent review requested a missing negative control,
`NEGATIVE-CONTROL.md` specified O5 before execution. `with-negative-control.log` records the first eight-check execution; final
`overwrite-control-final.log` and `results.json` record all eight after strengthening O3. **Two are negative witnesses**
(D3 deliberately violates isolation; O5 omits ownership), so this is not eight
positive safety proofs. D3 includes both successful stale-completion prevention
and the explicit violation witness. No assertions were weakened. Independent review found O3 initially drained only
after rejection; the original is preserved and an added pre-rejection drain now
asserts [42] while the owner is still pending and dependent entries remain queued.
`overwrite-control-final.log` records this stronger final execution.

The runner bundles actual unchanged kernel source via esbuild and records source
hashes. Transactions, rollback/confirmation and ordinary Link in D1–D3 are real.
O1 copies are straight-line reads/writes through two locations, not a reactive
callback chain; automatic reactive propagation is not qualified by this sample.
The outbox is application research glue; its labels, queue, retry and teardown are
not kernel guarantees. Source is transpiled for this runtime experiment; this is
not a strict-types package integration check. The owner helper's `any` is test
glue, not a proposed public type or production implementation.

Important outbox omissions: concurrent drains can duplicate delivery; one failed send currently stops that
drain before later independent entries, so failure-isolated progress is untested; callbacks
that settle/reenter during dispatch need admission/revision rules; thrown terminal
confirmation/rollback needs actual authority reconciliation; there is no persistent
storage, crash recovery or atomic transaction/outbox commit. A failed endpoint may
have applied its payload before losing acknowledgement, so retry is not exactly-once.
Destroy means explicit abandonment of unsent in-memory entries, not a durable
obligation being fulfilled. Accepted in-flight work cannot be recalled. These are
unqualified requirements, not waived because O4 passes its narrower assertions.

Important draft omissions: choosing draft UI does not automatically move existing
live subscribers into review. Domain merge, entity lifetime/rekey/order conflicts,
multiple independently accepted drafts, stale-base validation and collaborative
edits remain application requirements. D2 is one accepted multi-field batch, not
proof of general merge. Accidental early copying into live state is ordinary
publication, as D3 demonstrates; isolation is a programming contract, not sandboxing.

No fresh CPU/heap/bundle numbers were generated. Structural costs above are
hypotheses to measure only after matched obligations are selected. The two current
entity budget failures remain separate; prior artifact approval is not extended.

## Existing contracts and genuine product choices

At this source, `composition-recipes.md` §5 explicitly supports application-owned
drafts and says no draft-session kernel API is planned. Its §7 defines PUSH-OUT as
“committed X -> Y.set()” after settled authored writes. Proposal controls require
visibility through ordinary references before acceptance. Thus drafts are already
a valid application choice; making them the replacement for live proposals is a
product/migration decision. An application queue is also possible without a kernel
export, but replacing automatic Link with an outbox changes what callers receive.

Independent progress and coherent publication stay shared requirements. Which UI
sees a proposal, whether outbound work converges state or preserves commands, and
who declares dependencies are explicit product dimensions, not implementation
conveniences. A command outbox must not silently coalesce operations like state
synchronization; a snapshot outbox needs supersession to avoid obsolete payloads.

## Recommendation

Do not select one universal replacement from these results. For review-before-save
workflows, **isolated review is the strongest near-term candidate**: it already
fits documented application ownership and the real-kernel slice demonstrates
independent progress without inferring dependencies. This is a workflow preference,
not measured lower cost or a recommendation to remove live proposals.

For applications whose outbound intent is a command, **explicit outbox ownership**
is a serious alternative worth a lifecycle/durability contract. It trades hidden
inference for visible obligations, not for automatic safety. Treat automatic effect
scope as a separate unproven feature.

Continue automatic live-proposal research only if its unique benefit—existing live
consumers automatically previewing pending edits—justifies the unresolved boundary
and framework integration burden. The completed failures remain valid but do not
make the alternatives wrong merely for changing visibility.

The next selection should use one representative consumer workflow and its actual
need for live preview, commands versus state convergence, remote acknowledgement,
and conflict policy. No API or product replacement is selected here. Preserve the
safe hold until an authorized alternative earns its own acceptance checks.

## Replay

Node24.15.0 with repository dependencies pinned to pnpm10.17.0:

```sh
SIGNALTREE_ROOT=/absolute/path/to/d7b53861 node run.mjs
```

`results.json` records runtime source hashes. Existing production suites were not
rerun without a production change. Prior failure evidence remains linked through
[the provenance comparison](../link-provenance-feasibility/README.md).

## Independent review

[Contract comparison](CONTRACT-REVIEW.md) and [sample review](SAMPLE-REVIEW.md)
and [final addendum](FINAL-REVIEW.md) challenge both framing and execution claims. Reviewers inspected source and raw
results; the root executed the samples. No production acceptance is implied.
