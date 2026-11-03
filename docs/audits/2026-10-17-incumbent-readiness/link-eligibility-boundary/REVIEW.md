# Independent eligibility premise review

Reviewed source: `7c511c2b59e803b065b2a674e0f7b0a897f85145` at the incumbent-readiness checkout. Read the follow-up SPEC and prior delivery README. This is source/premise review, not a test execution report. No repository edits.

## Finding

Lifecycle observation can resolve a **complete, already established candidate-owner set**. It cannot establish that set's completeness from current pending transactions. An immutable revision with an exhaustive dependency upper bound S becomes eligible when every member of S is confirmed, provided there is no remaining unknown input, rejection, revision replacement or destruction. An actual input set need not be exact: a conservative exhaustive superset is sufficient for safety, although less live.

Thus the simple fresh-tree controls deserve a positive result: if the entire experiment starts from known committed values and the only possible speculative inputs are p (or p and q), confirmation of all those owners discharges the finite uncertainty. Holding forever in that explicitly closed world is model bookkeeping incompleteness. Do not claim that runtime has inferred those premises merely because the test author knows them.

The production lifecycle API can supply p/q identity and outcomes to a subscriber attached before transitions. It cannot supply the premise that there was no older rejected value retained outside the tree, no other input tree, and no unobserved application input. A late reader has only current pending state and a sequence number, not retrospective terminal outcomes. `onCommitScopesSettled` is even weaker: its notification does not distinguish confirmation from rejection.

## Minimal paired oracle (synchronous)

Use the same tree `{ x: 0, y: 0 }`, same write trace and same lifecycle/read trace in both arms:

```ts
const q = tree.transact(() => tree.$.x(7));
const captured = tree.$.x();       // execute in BOTH arms
q.rollback();                    // x is now 0; q terminal rejected
// Difference only in ordinary application evaluation:
tree.$.y(7);                     // independent arm
// versus tree.$.y(captured);     // rejected-input arm
```

There are no timers or promises. Both arms have equal written values, target positions, tree reads, transaction transitions and pending-count snapshots. The difference is whether the JavaScript scalar local was consumed. Ordinary kernel reads and write metadata do not expose that data-flow edge. The independent arm should progress under the desired independent-progress criterion; the copied arm should remain ineligible under the desired no-rejected-input publication criterion. They cannot be classified differently by those observations alone. Conservatively tainting everything after the observed read holds both and does not establish useful independence.

For the requested all-confirm boundary, insert a new disjoint pending p after q's rollback; perform the two y writes while p is pending, then confirm p. Every currently relevant pending owner in a naive snapshot confirms, but the same ambiguity remains. This demonstrates why “no current pending remains” is not exhaustive provenance. Keep the simpler fresh-tree all-confirm control separately: it has no hidden q and is safe under its explicit premises.

For later overwrites, start with a dependent y, then overwrite with literal 7 versus the same previously captured 7. Equal value or an ordinary write revision alone does not prove dependency removal. A separately admitted authoritative Link payload can provide the additional evidence by its existing external-authority contract; an ordinary application assignment does not inherently carry that contract.

## Multi-owner cases

- y is known to depend on q; p confirms, q pending: hold.
- Exact immutable y revision depends only on q; q confirms while unrelated p remains: eligibility is possible if the dependency evidence is exhaustive.
- Exhaustive possible set {p,q}; p then q confirm: eligible after q.
- Same set; p confirms and q rejects: do not turn the old revision clean. Recompute/replace with separately justified evidence, or hold/cancel according to the existing experimental rules.
- Refusal is not rejection/terminality; do not retire the dependency.
- A new transaction opening after capture need not contaminate an unchanged revision automatically, but any reentrant new revision must receive new evidence and delivery revalidation.

## Important contract qualification

The above negative oracle is the user's desired **causal publication safety** criterion, not a demonstrated violation of every existing incumbent contract. `commit-consequence.ts` explicitly defines: all scopes settle → persist current surviving truth. It releases tree-held ordinary consequences after either commit or discard. Mutation responsibility does not roll back an ordinary independent y merely because it was evaluated from x. The public README also says write notifications do not establish a causal relationship or complete history.

Accordingly, a baseline sending retained y=7 after q rejection is an ordinary surviving-state publication under the documented gate, and a counterexample to the stronger desired dependency-aware criterion. Do not report it as a newly proved transaction-capture bug, pretend the safe hold prevents every later local-copy publication, or silently change mutation ownership to satisfy the oracle. The latest user instruction explicitly requests this stronger distinction, so it is a valid experiment requirement; its broader release interpretation still needs clear product wording.

## Source anchors and limits

- `packages/kernel/src/lib/internals/commit-consequence.ts`: module rule; `scheduleDurableConsequence`; `settleCommitScope`; `onCommitScopesSettled`.
- `packages/kernel/src/lib/internals/transaction-lifecycle-source.ts`: current pending snapshot, exact owner transition facts.
- `packages/kernel/src/lib/internals/transaction-lifecycle-view.ts`: “no retrospective event or payload history”; terminal event subscription; destruction handling.
- `packages/kernel/src/enhancers/transactions/transactions.ts` around lifecycle source definition: pending views retire, abandonment may advance sequence without terminal transition, and outcomes must not be inferred from disappearance alone.
- `packages/kernel/src/lib/internals/write-observation-scope.ts`: declared synchronous membership explicitly is not read dependency or exclusive cause.
- `packages/kernel/README.md` tooling section: notification does not establish causality or complete history.

This review does not prove automatic progress impossible in every supported restricted boundary. It establishes the precise insufficiency of current read/write/lifecycle facts for unannotated ordinary JavaScript value flow, even synchronously. It supports resolving demonstrably complete finite owner sets while preserving unknown elsewhere; it does not authorize a new policy/API or perpetual retention of every historical owner. Destruction and the 34 delivery controls remain separate claims.

## Independent replay supplement

Executed both saved `baseline-bundle.mjs` and `bundle.mjs` with Node 24.15.0 by importing each exported `run()` in a fresh review process. All 22 trace entries per arm exactly match their preserved JSON (`JSON.stringify` equality); saved separate `baseline-reviewer-traces.json` and `reviewer-traces.json`. Verified 88 original source hashes per arm against the current checkout; all baseline loaded hashes equal original hashes.

Observed discriminator results agree with the analysis:

- Direct and synchronous reactive all-confirm: production publishes 7; experiment remains held. The simple scenario has no actual unresolved owner after confirmation, but the experiment never acquired a complete owner bound; it retains only unknown.
- Two owners: confirmation of p while q remains pending does not release y. q confirmation OR rejection releases surviving y=9 under production's current-surviving-state gate; experiment holds both.
- Post-rejection literal versus retained local: normalized y metadata is equal and both arms execute the same read; production sends both, experiment holds both. This is the exact synchronous observational ambiguity above.
- Later literal/captured equal overwrites do not create distinguishable eligibility evidence.
- Authoritative incoming Link payload remains the positive automatic case.

These are bounded scalar probes, not a semantic matrix or framework qualification. Their equality asserts source/trace reproducibility, not policy acceptance. No delivery changes or override are justified by the ambiguity. The precise product boundary is unannotated ordinary JavaScript inputs outside an exhaustively tracked input domain, not merely asynchronous work.
