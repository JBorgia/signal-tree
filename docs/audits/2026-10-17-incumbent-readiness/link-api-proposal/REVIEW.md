# Independent Link API premise review

Review base: 6ceca15d, incumbent-readiness checkout. Source inspection only; no native experiment or API implementation. Reviewed link.ts, transactions.types.ts, transaction handle decoration/lifecycle source, existing Link tooling state, and the declaration contract/examples records. API spelling remains owner selection.

## Premises

The executable record states: "The harness is a single-destination model." It also states: "observe(owner) is an explicit supplied lower-bound fact, not an implemented automatic read tracker." Thus the examples do not license a claim of automatic completeness checking or native multi-connection integration.

The existing Link contract says "The handle. Deliberately three members." Adding a method is an observable public API choice needing approval, even though it is a reasonable response to the newly demonstrated authoring need. Existing methods are retrieve, settled, dispose; none provides declaration outcome observation.

## Candidate comparison

1. **Connection-local declaration around native synchronous writes.** Best fit for an additive proposal: applications retain framework-native writes and transaction ownership. The declaration authorizes only that connection's newly authored revision(s), not every connection attached to the same tree. Its cost is execution-scope semantics, staging all early sends through validation/reentry, and a deliberately small result/error surface. It cannot retroactively bless a current unchanged value without an authored mutation. An explicit equal-value write must still receive a new responsibility revision; merely opening a scope does not.
2. **Explicit snapshot publication.** The application supplies or requests one payload. More direct endpoint intent, but it adds a second publication workflow alongside automatic live synchronization. Rejection must reconcile a previously captured snapshot with fresh native truth; automatic sends may supersede it. This is not simpler under the already selected current-truth fallback contract. It fits a manual/outbox product better than this task.
3. **Connection-owned write.** A setter supplied by Link can bind one scalar payload tightly, but duplicates native framework setters, scales poorly to nested/reactive writes and couples publication authority to installation. It must still govern reentrant native writes, so it does not eliminate the hard scope boundary. Useful comparator, not the smallest general additive fit.

Recommendation for a proposal: connection-local synchronous declaration, initially scalar. This is not API or runtime acceptance.

## Required limits and discriminators

- Explicit unknown must remain different from explicit independence; neither defaults to independence. The empty declared dependency list may be normalized internally, but examples should make its responsibility assertion conspicuous.
- Multiple writes in one scope create separate immutable native revision identities. A later revision supersedes a queued earlier one; declarations cannot change started I/O. All early publication waits for whole synchronous validation (including return-shape getters) to complete.
- Any scope that performs no relevant write grants no ticket. A second connection remains conservatively unknown unless independently and explicitly covered. Nested scopes must not erase outer known lower bounds.
- A scalar Link declaration cannot certify an aggregate snapshot merely because one field was touched. Full object/entity/order readiness requires subsequent composite contribution and lifetime accounting, not a broad syntax acceptance now.
- Cross-tree dependencies require authentic owner identity and actual terminal outcomes; connection-local scope is not tree-local identity. Separate runtime copies/realms remain unsupported unless identity can be validated, in which case malformed/unrecognized declarations fail before callback execution.
- Runtime lower bounds can disprove a declaration, not prove hidden-input completeness. Saved values, control dependence, caches and asynchronous retained inputs remain application obligations. The omission leak is misuse evidence, never a safety pass.

## Reuse of PendingTransaction

The authentic existing handle is a plausible argument identity without another public token constructor. Public structural typing is not authenticity. The implementation must privately enroll each ordinary and recovery handle and resolve immutable owner identity without invoking inspect, confirm or rollback, without parsing public display paths, and without reading caller-provided numeric fields. Proxy/wrapped/forged handles are not authenticated automatically.

Private enrollment must support terminal handles and empty transactions explicitly. Current lifecycle snapshots enumerate pending transactions only: absence is not evidence of confirmation. Confirmation, rejection, abandonment and refusal differ. Retained authentic handles may preserve their terminal identity while disposal releases connection subscriptions and responsibility records. This is an implementation requirement, not evidence already provided by the current machinery.

## Observability and failure surface

The proposal must describe application-visible outcomes without requiring imports from kernel/internals. Existing LinkStateReader is private tooling and cannot quietly become the user-facing contract. A small immutable per-call result can distinguish valid complete evidence, pending declared dependencies, conservative unknown and conservative late contradiction. Admission is not delivery; settled retains its existing delivery semantics.

If the proposal promises observation of later fallback (e.g. declared owner rejects after return), an immutable initial result is insufficient. Either state that only immediate declaration admission/error is reported and later behavior follows documented existing Link synchronization, or specify one minimal query/subscription with lifecycle rules. Do not invent broad persistent diagnostics to answer a need not demonstrated.

Malformed declaration must fail before callback. Late contradiction must preserve installed writes conservatively and make the declaration failure observable. Callback-thrown values preserve established precedence. Any result type must avoid implying that a thrown callback rolled back ordinary writes. Async-return misuse can be reported synchronously, but JavaScript still runs its continuation; no ambient scope follows it.

## Decision

The comparison supports proposing one scalar connection-local declaration surface for owner review. It does not support native implementation before approval or aggregate/entity acceptance. Key falsifiers for that proposal are unknown versus empty, real foreign identity, no-write scope, ABA, nested second connection, contradictory nested scope, return-shape getter reentry, callback error precedence and late rejected-owner fallback. Production hold remains unchanged.

## Review of concrete proposal draft

Inspected /private/tmp/link-api-proposal/PROPOSAL.md, proposal-types.ts and examples.ts. The draft makes the recommendation appropriately conditional, preserves scalar-only scope and native write forms, treats PendingTransaction as an authentic identity rather than settlement authority, and limits the receipt to eligibility/admission rather than transport acknowledgment. The read-only receipt is a justified additional surface if late fallback must be application-observable; it is not literally just one new method in the total public type graph. No alternative examined offers the same capabilities with less semantic machinery merely by renaming operations.

Two concrete specification blockers before submitting this as a complete API proposal:

1. **Nested receipts have no state during the shared horizon.** Inner declare returns before outer validation completes. A caller can read its receipt immediately inside the outer callback. eligible is premature, held/pending-dependency is false if no owner blocks it, and conservative does not express pending validation. Add validating/deferred-admission state or explicitly disallow receipt reads until horizon closure. Specify transitions when the outer scope later fails or disposes. A native falsifier must inspect the inner receipt before outer completion and then trigger the outer return getter contradiction.
2. **Input validation can execute user code too.** Reading declaration.kind/owners, copying arrays or invoking iterators/Proxy traps can reenter before callback validation. Establish the horizon before any user-controlled property access, and keep it through error reporting. A malformed declaration can guarantee the work callback is not invoked; it cannot promise arbitrary validation getters caused no writes. Such already-installed effects need conservative handling. Add malformed accessor/iterator plus nested-declaration falsifier. Authenticity checks should use object identity without inspecting handle methods.

Clarification required: outer unknown responsibility cannot be erased merely by nesting an independent declaration; unknown is not a known owner but remains unproved trigger/context input. State the conservative outcome explicitly rather than only saying nested scopes inherit known owners.

These are specification corrections, not evidence of native runtime failure. Type-checking the declarations does not settle them. Once corrected, the draft is suitable for owner API review; no native implementation is recommended before that approval.

### Correction verification

Read the revised draft and type sketch. Both identified blockers are addressed in the specification: validating state covers an inner receipt before shared-horizon completion; validation begins before input property/iterator access, and the guarantee is callback nonexecution rather than impossible global side-effect freedom. Unknown outer responsibility is explicitly preserved through nested independent declarations. Corresponding native falsifiers are listed without claiming execution.

One editorial clarification remains: disposal must apply per connection. Disposing an outer connection cannot silently dispose a different inner connection's receipt; the shared validation horizon still finishes, while only receipts of the disposed connection become disposed. Subject to that clarification, no further blocker to owner review of this bounded API proposal is identified. This is not API approval, runtime integration acceptance or proof of native scalar/aggregate feasibility.
