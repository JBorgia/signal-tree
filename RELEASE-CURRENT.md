# Current work — incumbent v16 readiness

Updated October 20, 2026. Branch `codex/v16-incumbent-readiness`.
Baseline: `8d220643e0d4e34cbdbc6e55e6ef692b25d5e023`.
Accepted new-key runtime checkpoint: `9917c92fbbdc9dfdd14601f1f5fb7ce21799be71`.
Version **16.0.0-dev**. **Not release-ready; no final candidate freeze yet.**

## Scope and authority

Complete the finite incumbent release contract and its required verification.
No release, merge, push, activation, tag, publication or unrelated architecture
change. B's replacement track is closed at `17e1a76f` and is not a repair queue.
Original checkouts, rejected checkpoints and first-failure evidence are preserved.

Owner decisions:

- Ordinary whole-value writes may create supplied new keys. Internal inspection
  replay retains its separate unknown-key policy; stable v15 remains unchanged.
- Four new-key artifact ceilings are approved and verified. This is artifact-cost
  acceptance, not performance neutrality or release readiness.
- Owner-authorized string-Record migration: arbitrary direct access is unknown;
  known/hybrid children and whole-value writes retain their types. The reviewed
  type-only patch is applied. No lookup export or deferred-handle runtime is added.
  Other index-signature forms remain outside this bounded migration.
- Conditional Link progress may use explicit complete publication ownership
  declarations; the application owns hidden-input omissions. This approves the
  contract direction, not an API or implementation. Undeclared writes retain the
  conservative hold; conditional progress still requires implementation evidence.
- Documented newest-open-first settlement is v16 scope: atomic retryable refusal,
  retained authority, useful retry, truthful inspection/errors and independent
  progress remain required. Server reconciliation policy belongs to applications.
  Arbitrary-order surgical success and canonical authority projection remain
  preserved advanced capability targets, not claimed release capabilities.

## Current acceptance checklist

[Reconciliation and exact evidence](docs/audits/2026-10-17-incumbent-readiness/reconciliation/README.md)
are the current detailed disposition. The original
[inventory and row classification](docs/audits/2026-10-17-incumbent-readiness/README.md)
remain historical evidence at their stated source.

| Item | Status | Next acceptance requirement |
| --- | --- | --- |
| Whole-value new keys / capture | Complete for checkpoint | Preserve passing retention, reentry, recovery, inspection and four-framework controls |
| Artifact cost | Prior new-key cost approved; current two entity budgets fail | Current measured bytes need separate disposition; ceilings unchanged |
| String-Record direct access (K2 bounded migration) | Reviewed typing patch applied; source hashes match verified copy | Unknown arbitrary access, known/hybrid children and whole writes preserved; migration guidance saved; no lookup/deferred API implemented |
| Two composed-restoration failures | Repaired at `87f6831f`; reviewed and broader affected checks pass | Preserve first failures and controlled capture limitations; final release verification remains pending |
| Independent Link progression | Supported blocker; location-disjoint experiment `927ee0d8` rejected and reverted | Reactive copies need dependency evidence; safe gate retained; no new provenance architecture authorized |
| Stronger semantic matrix | Scope disposition recorded, not passed | Preserve 188 held / 68 violated / 168 unsupported record and test supported public contract separately |
| Final exact-SHA qualification | Not yet eligible | Close supported blockers, freeze source, then complete required verification |

## Declared-Link finite qualification — focused gate failed

[Exact failure ledger, controls, review and replay](docs/audits/2026-10-17-incumbent-readiness/link-declared-qualification/README.md)
qualifies frozen research inputs against source `568bdf69`. **Current candidate
rejected for integration**: accepted scalar entity-field links send undefined;
entity equal-inspection adoption is missing; helper refresh causes inspection-only
aggregate publication; receipt terminality, secondary error reporting, source
validation and post-drain metadata reclamation fail. Source/receipt stores each
grow by16 over8 fully settled/disposed/destroyed cross-tree cycles.

Native aggregate controls16/16 and actual restoration undo/redo remain passing.
Composition24/26 fails two assertions from one missing-report cause. Tree destruction
and explicit disposal retain their established distinction. Prior scalar adoption
results remain valid. Historical32/34 expectations are separately reconciled;
hidden-input omission stays misuse, not a safety pass.

Full suites, complete types/installed artifacts and fresh cost measurements were
not run because the focused entry gate failed. Production runtime and safe hold
remain unchanged. No repair, API acceptance, budget change or reopening of B.

## Equal inspected-value adoption — bounded candidate

[Native candidate, first failures, exact inputs and independent review](docs/audits/2026-10-17-incumbent-readiness/link-equal-adoption/README.md)
implements authorized scalar adoption in a disposable native overlay. Final
focused Nx: 96/96; targeted kernel typecheck passes. Independent facade cases:
16 direct and 24 native root/branch cases pass. Original 25 safety assertions,
13 prior controls and nested failure remain passing. Three prior no-adoption
expectations now differ under the owner's new rule; historical32/34 delivery
accounting remains separate. Raw original assertions are preserved.

First native compile/type failures and the unchanged P5 acquisition regression
are preserved. Root/branch authority admission fixes P5 without a Link-specific
exception or forcing value notifications. Production runtime remains unchanged;
this evidence does not qualify complete declarations, entity/removal/destruction
retention, performance/artifacts or release. No full qualification was run.

## Equal inspected-value adoption — owner decision

[Native/declaration boundary evidence and review](docs/audits/2026-10-17-incumbent-readiness/link-equal-write-boundary/README.md)
shows the prior native behavior: ordinary7, inspection99, equal ordinary99 emits
no contribution; an equal transaction rolls back leaving physical99 and eligible7.
Inspection context exit restores metadata only. Baseline and private candidate
agree; this was not a declaration-only regression.

The owner subsequently authorized v16 adoption: explicit ordinary99 adopts that
value, and transactional rejection restores both physical state and publication
authority7. Genuine ordinary99-to99 remains a no-op. This is a new explicit
compatibility decision, not a claim that the existing implementation meets it.
A bounded native implementation experiment is underway; production hold remains.

## Native declaration boundary correction — October 20

[Preserved correction, failures and review](docs/audits/2026-10-17-incumbent-readiness/link-native-boundaries/README.md)
records a private scalar experiment against `376129b5`. Original 25 safety
assertions, 13 prior controls, nested failure and 31 new assertions pass; root
added 13 controls pass. Misuse is separate. Historical delivery remains 32/34
under unchanged old permanent-hold assertions, with the approved post-confirmation
semantics documented separately. No production runtime change.

Independent review supports enclosing validation and ordinary-state participation
corrections. An ordinary setter equal to inspection-displayed state produces no
native revision: the prewritten publication expectation remains failed and the
API's equal-value-authorship promise is unqualified. Retention, scans, framework
and entity integration remain unqualified; no broad production acceptance.
Conservative production hold and current release blockers remain unchanged.

## October 19 reviewed checkpoint

[Runtime repair, rejected Link experiment and exact verification](docs/audits/2026-10-17-incumbent-readiness/remaining-runtime/README.md)
records runtime `87f6831fa60cafe87508f0ace84b7638698ca3b0`: kernel 5,837 ordinary
passes / five expected failures / 12 skips; frameworks 599 passes / three skips.
Source/spec types, affected lint and fresh package/demo builds pass. Two fresh
entity budgets fail. No full release-registry, mutation or installed-consumer
qualification is claimed. Earlier sections below retain their historical scope.

Independent review found no further bounded restoration blocker. The Link
experiment leaks pending values copied through reactive callbacks because
location-disjointness is not dependency independence. Safe gate restored at
`e9653a41`; original assertions and rejected source preserved. Closing this
supported requirement needs a scoped dependency-provenance design, not another
admission exception or transaction-ownership change. B remains closed.

## Bounded Link provenance experiment

[Preregistered experiment, failures and independent review](docs/audits/2026-10-17-incumbent-readiness/link-provenance-feasibility/README.md)
leaves production at the reviewed checkpoint. Initial model: 15 passes / three
new nested-dependency failures. Conservative frame composition: 17 passes / one
unchanged progress failure. No integrated candidate passed. An unchanged-kernel
probe records identical observed metadata for a deferred constant and captured
speculative value; the safe hold blocks both until confirmation. This is a bounded
observability result, not proof automatic provenance is universally impossible.
A real trusted-input/execution-boundary contract and native cache instrumentation
remain unresolved. No public boundary API, narrower scope or runtime change was
selected. The two entity budgets remain separate blockers; no release freeze.

## Comparative product research

[Three publication/visibility alternatives](docs/audits/2026-10-17-incumbent-readiness/link-product-comparison/README.md)
compares automatic tracking, explicit outbox responsibility and isolated review
with ordinary Link. Owner authorized comparison, not replacement or API selection.
Real-kernel application examples demonstrate bounded progress for explicit entries
and isolated review; intentional negative controls show that missing ownership or
premature draft copying still publishes speculation. Neither is a qualified
production replacement. Visibility models are distinguished, not ranked by fidelity
to current live proposals. Runtime costs remain unmeasured at equivalent capability.
Current safe hold, supported-progress blocker and artifact blockers remain intact.

## End-to-end workflow adoption evidence

[Ticket review and explicit command adoption](docs/audits/2026-10-17-incumbent-readiness/workflow-adoption/README.md)
now have independently replayed headless scenarios and strict application typechecks.
Review-before-save preserves concurrent edits and explicit conflicts with ordinary
Link. The command sample uses versioned tooling identity/lifecycle and remains
experimental: recovery adoption, retention and durability are unqualified. Negative
controls and first failures are preserved; line counts measure application burden,
not runtime cost. No package source changed. The owner declined the proposed
workflow-scoped relaxation: automatic independent progress remains required, without
a promise to infer arbitrary asynchronous causality. A bounded configurable-Link
comparison is authorized; no API or runtime change is selected. Both entity budgets
remain open.

## Configurable Link comparison completed

[Reviewed specification, bounded comparison and preserved failures](docs/audits/2026-10-17-incumbent-readiness/link-policy-comparison/README.md)
show useful scalar authoritative-ingress progress while unrelated work is pending.
The private bridge fails send-time reentry and held-send replacement; ordinary
unscoped writes remain held even after confirmation. Tree-destroy sends are also
observed in unchanged baseline code and require separate lifecycle adjudication.
Explicit ownership and manual scheduling are model-only; adversarial review exposes
mutable evidence and reversible terminal outcomes in that model. No public API or
production policy was selected. Automatic independent progress remains required
and unresolved; safe hold, optional adoption workflows, closed B and both entity
budget blockers remain unchanged. No broader suites or repeated cost campaign ran.

## Delivery/evidence follow-up completed

[Bounded state machine, controls and independent review](docs/audits/2026-10-17-incumbent-readiness/link-delivery-followup/README.md)
separate eligibility from delivery. The private revision passes 34 targeted delivery
assertions, including reentry, held-send replacement, serialized corrective delivery,
settlement visibility and observable errors. Immutable evidence/terminal outcomes
pass model adversarial controls; the original conflicting fixture and ticket-mutation
failure remain preserved. Ordinary direct writes still have unknown eligibility
after confirmation; this is not a missed wake-up. Tree-destruction behavior remains
separately unresolved. No production integration or public API is accepted. Automatic
independent progress and both entity budgets remain release blockers. Further scope
changes require owner decision; no new configuration or provenance expansion is selected.

## Eligibility boundary and destruction classified

[Minimal controls, source trace and independent review](docs/audits/2026-10-17-incumbent-readiness/link-eligibility-boundary/README.md)
distinguish complete owner-set resolution from missing provenance. All known possible
owners confirming can discharge a complete set; the private clean/unknown flag has
no such bookkeeping. Current pending snapshots cannot establish completeness for a
synchronous retained local from a previously rejected owner. Literal and retained
copies have identical observed metadata. Baseline publication follows its current
surviving-truth contract; stronger causal withholding requires an explicit product
boundary, not another delivery guard. No policy/API changes selected.

Destruction is now classified separately: established tests permit a pre-destroy
queued value to send. The earlier zero-send research oracle was stronger than that
contract. Started requests may complete; held settlement waiters remaining pending
until explicit Link.dispose() reproduce a previously documented lifecycle gap.
Tree destruction is not specified as connection disposal. Automatic progress and
artifact blockers remain open; no release qualification is inferred.

On October 19 the owner approved surviving-write semantics for the reproduced
post-rejection retained-local write: it authors new surviving application truth,
without inheriting the rejected causal origin. This closes that specific product
question only. It does not establish independence while other owners remain pending,
change the production hold, or approve the experimental delivery mechanism.

## Bounded owner-window eligibility rejected

[Private experiment and independent replay](docs/audits/2026-10-17-incumbent-readiness/link-owner-window/README.md)
demonstrate earlier revision progress after its captured owners confirm while a later
owner remains pending. The first implementation fails ABA: net-equal value publication
is deliberately suppressed, leaving Link on an older responsibility ticket than the
latest mutation evidence. Both owners confirm but the value never sends. Window
controls record 45 passes and one failure; cross-tree speculative copying remains an
explicit unsupported boundary. Historical delivery checks remain unchanged: 32 pass,
two old permanent-unknown expectations differ under the proposed eligibility behavior.
No repair followed the counterexample. Production hold, surviving-write semantics,
independent-progress requirement and separate artifact blockers remain unchanged.
No public API, broader qualification or replacement transport is selected.

## Responsibility observation correction remains private

[Bounded correction and independent review](docs/audits/2026-10-17-incumbent-readiness/link-responsibility-observation/README.md)
close the earlier ABA failure in the default-batched scalar experiment: 46 unchanged
owner-window and 16 added controls pass without extra value emissions. Same-runtime
cross-tree pending copies now remain held through namespaced owner evidence.
Historical delivery checks remain 32/34, with two preserved old eligibility oracles.
Global source scans and retained research metadata are explicit limitations. Immediate
independence from existing pending owners, framework/entity coverage and production
acceptance remain unproved. Production hold, surviving-write semantics, B closure
and the two entity-budget blockers remain unchanged.

## Immediate independence: observation mechanism insufficient

[Decisive paired replay and independent review](docs/audits/2026-10-17-incumbent-readiness/link-immediate-independence/README.md)
show literal ordinary y(7) remains held while x=7 is pending. A reactive y(x()) copy
also holds; both receive identical responsibility facts and send after confirmation.
The mechanism lacks consumed-source dependency evidence. Its ABA correction stands,
but scan optimization and retention work are not pursued for this failed eligibility
solution. Historical 32/34 confirmation expectations are explicitly reconciled without
editing originals or claiming another 34/34 run. Production hold and automatic
independent-progress blocker remain; no alternative API or architecture is selected.

## Input-boundary comparison awaits product selection

[Reviewed specification comparison](docs/audits/2026-10-17-incumbent-readiness/link-scope-comparison/README.md)
distinguishes tracked fresh reads from complete input evidence. Pre-scope values,
closures and native caches cannot become clean merely because a scope observed no
reads. Explicit publication ownership supplies application assertions, not automatic
proof. Conditional immediate progress needs a truthful complete-input contract;
no public API or requirement change is selected. Production hold and the blocker
remain. No new runtime experiment, lifecycle heuristic or B work was started.

## Conditional publication direction approved

[Owner decision and declaration contract draft](docs/audits/2026-10-17-incumbent-readiness/link-declared-contract/README.md)
record application responsibility for complete declarations. This answers the prior
comparison's direction question; API and implementation remain unapproved. Declaration
validation must cover the completed synchronous operation before early publication.
Publication dependencies do not assign compensation ownership. The older-receipt
rejection fallback remains an explicit compatibility obligation before implementation.
Production hold, closed B investigation and separate artifact blockers remain unchanged.

## Declaration rules exercised as a standalone specification

[Executable examples, first falsifier and independent review](docs/audits/2026-10-17-incumbent-readiness/link-declaration-examples/README.md)
cover rejection against surviving current projection, conservative retention after
late contradiction, and synchronous-only declarations. A returned then-getter exposed
validation reentry escaping the first scope; the unchanged falsifier passes after
keeping the scope through return-shape inspection. Original18 examples match, including
one explicitly leaking hidden-input negative control, plus four adversarial controls.
This is a single-destination model with supplied projection/outcome seams, not native
Link integration or API selection. The rejected-receipt rule is executable at that
boundary; production provision of the boundary remains unproved. Safe hold remains.

## Link-local API proposal awaits owner approval

[Concrete API comparison and independent review](docs/audits/2026-10-17-incumbent-readiness/link-api-proposal/README.md)
recommend a scalar connection-local synchronous declaration with independent,
dependent and unknown forms, plus an observable per-operation receipt. This is a
proposal, not a selected export or native implementation. Existing transaction handles
would be authenticated only as dependency identities, never invoked as settlement
authority. Nested validation/input-accessor gaps found in review are addressed in the
proposal. Type sketches pass; no runtime or framework qualification is claimed.
Production hold remains until an approved native experiment survives its controls.

## Approved scalar native experiment rejected

Owner approved the proposed surface at247cfec7 for the bounded native experiment,
not production activation or release acceptance. [Native result and two reproduced
safety blockers](docs/audits/2026-10-17-incumbent-readiness/link-declared-native/README.md)
demonstrate conditional independent scalar progress, authentic no-op identity and
connection isolation. After completing missing fallback, original25 ordinary assertions
pass; misuse is separate. Root controls add12/13, with inspection sending99 instead
of eligible7. Independent review also reproduces an inner connection sending after
outer validation fails. Both failures persist in frozen final source. No repair,
broader qualification or production integration follows. Missing full delivery,
recovery/reporter and framework evidence remains explicit; production hold is unchanged.

## Verified evidence and limits

- [Applied string-Record typing migration](docs/audits/2026-10-17-incumbent-readiness/unknown-dynamic-access/README.md)
  records exact destination hashes, reused verification, independent review and
  [consumer migration guidance](docs/guides/open-record-typing-v16.md).

- [Paired capture repair](docs/audits/2026-10-17-incumbent-readiness/paired-membership/README.md)
  preserves runtime `89bfca62` and evidence `96a54e6a`.
- [Artifact attribution](docs/audits/2026-10-17-incumbent-readiness/artifact-cost/README.md)
  identifies the separately verified helper optimization `9917c92f`.
- [Approved artifact decision and receipt](docs/audits/2026-10-17-incumbent-readiness/ARTIFACT-ACCEPTANCE.md)
  records ceilings implemented at `4dfc3576`; 248 identified artifact hashes
  remained unchanged. Prior failed budget runs are preserved, not relabelled.
- [Preregistered representative cost](docs/audits/2026-10-17-incumbent-readiness/representative-cost/README.md)
  leaves timing direction and large pending-owner attribution unresolved. Corrected
  cleanup supports sampled tree collectibility, not universal absence of leakage.
- Earlier focused reconciliation: restoration **71 ordinary passes / 6 expected
  failures**; unchanged Link cases **10 violated / 2 unsupported**. Vue shape
  counterexample strictly typechecks and its populated controls execute.
- [Exact baseline qualification](docs/research/v16-candidate-acceptance-0/RESULT.md)
  applies to `8d220643`, not a future runtime. Existing successful gate runs do not
  close current supported-behavior failures or certify another source/artifact.

## Final verification boundary

Once supported requirements are satisfied, obtain independent review and freeze
the final runtime/source. Run the required affected suites, runtime/spec types,
lint and documentation checks, then the complete release registry, mutation proofs,
fresh package/demo builds, installed-artifact consumers and framework/browser
checks against identified final source/artifacts. Rebuild after mutation tests.
Record ordinary passes, expected failures, skips and unexecuted checks separately.
Do not declare the stronger matrix fulfilled or add APIs merely to observe it.
Verification grants no publication authority.

### Preserved runtime counterexamples after typing migration

See the [separate boundary evidence](docs/audits/2026-10-17-incumbent-readiness/runtime-boundaries/README.md).
Compound rollback restores rows but history retry fails ST1034; the one-removal
repair is not general compensation support. The [bounded Link publication repair](docs/audits/2026-10-17-incumbent-readiness/link-order-repair/README.md)
now passes queued/in-flight and reentry controls with independent review. Original
Link failure remains archived. Compound restoration and independent Link progress
remain blockers; this is not final runtime qualification.

### Compound compensation candidate

[Candidate and preserved failures](docs/audits/2026-10-17-incumbent-readiness/compound-compensation/README.md):
complete compensated structural intervals, including known zero-net work, pass
16 focused controls and independent review. Final combined focused run has 44
ordinary passes; fresh type/spec/build/demo and unchanged budget gates pass.
On October 19 the owner authorized the specific invalid snapshot-index assertion
correction. The corrected regression passes 2/2 ordinary tests and spec-types;
runtime is unchanged and the original failures remain archived. The earlier
44-test run and fresh artifact results retain their original provenance. R1/R2
composition, broader Link progression and final qualification remain unresolved;
this is not release readiness.
