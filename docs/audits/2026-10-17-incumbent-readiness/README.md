# Incumbent v16 release-contract audit

Date: October 17, 2026. Source inspected:
`8d220643e0d4e34cbdbc6e55e6ef692b25d5e023`.
Branch: `codex/v16-incumbent-readiness`.

**Not release-ready.** This is a finite acceptance inventory, not permission to
change public semantics or a completed qualification of a repaired candidate.
B is closed at `17e1a76f`; no B repair or architectural replacement is in scope.

Current superseding dispositions are in the [October 18 reconciliation](reconciliation/README.md).
This record retains the original audit findings and verdicts at its stated source.

## Checkout and inherited evidence

The isolated worktree started clean at the exact incumbent SHA above. The
original checkout and its research specs are untouched. Dependencies are an
ignored symlink to the retained incumbent's existing dependency root, not a new
frozen installation. Required tools remain Node 24.15.0 and pnpm 10.17.0.

The seven evidence files under
[existing candidate acceptance](../../research/v16-candidate-acceptance-0/RESULT.md)
are copied byte-for-byte from `774dfd7f267400dc06fe8c8ffe976f18b51d52b0`.
That commit differs from 8d only in those evidence/doc files. It does not change
the verified runtime SHA. Archive SHA-256:
`1df9a6ebdfb29386a8e2c74c34e78844677f2cedad036523a1d894a2db20d885`.
The old controller's October 1 progress list is historical, not a current queue.

Recorded exact-8d results: 84/84 release registry; 84/84 mutation proofs
(12 indirect); fresh five-package rebuild; packed consumers and strict typing;
Angular production AOT and teardown; 136/136 browser checks; accepted artifact
ceilings. These results are inherited evidence, not runs performed by this audit.
The ordinary suite's expected failures do not disappear because gates passed.

The preceding readiness audit's focused run on unchanged 8d returned 35 ordinary
passes and 8 expected failures, exit 0. It exercised open-key, granularity,
restoration limitations and recovery-handle controls. External log:
`/private/tmp/incumbent-readiness-focused-20261017.log`.

```sh
PATH=/private/tmp/st-b-qualification-20261016/bin:/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:$PATH \
NX_DAEMON=false pnpm nx test kernel \
  --testFile=src/lib/open-key-reachability.spec.ts \
  --testFile=src/lib/e-granularity.spec.ts \
  --testFile=src/enhancers/restoration/reversal-known-limitations.spec.ts \
  --testFile=src/enhancers/transactions/recovery-handle-0.spec.ts \
  --skip-nx-cache
```

## Finite acceptance inventory

| ID | Evidence and disposition | Required acceptance |
| --- | --- | --- |
| K1 | Proven: whole Record replacement drops newly supplied keys. Runtime repair target, with a conflicting ST2010 compatibility test requiring owner resolution. | Original `e-granularity` whole-value assertion; exact membership including absence versus present undefined; nested/root writes; failure-before-install; rollback; inherited observation/Link; four frameworks. |
| K2 | Proven: types promise a callable never-materialized descendant; runtime returns undefined. Public type narrowing is not authorized. | Original `open-key-reachability` assertion and positive type tests; stable held handle across installation; read acquisition changes no semantic membership; destruction, protocol keys and ancestor subscriptions. Implementation contract remains unresolved. |
| R1 | Proven: setAll reorder then removeOne cannot undo its ordinary designated turn. Safe refusal is not promised restoration. | Original desired undo assertions across all three enhancer configurations; redo, identity, values, order, coherent publication; retain genuine unsafe-placement refusal controls. |
| R2 | Proven: addOne then prependMany overwrite cannot undo its ordinary designated turn. | Same acceptance as R1; original desired assertion unchanged. |
| L1 | Ten inherited matrix failures: independent Link work does not progress while unrelated work is pending/refused. Supported target under L16. Causal mechanism not yet established. | Ten unchanged matrix assertions plus existing positive delivery controls; targeted reproduction and causal trace before repair. |
| S1 | 57 inherited failures of successful overlapping settlement. Stronger frozen laws and consumer refusal guidance conflict. | Owner product-scope reconciliation with rationale independent of incumbent limitations; preserve all assertions and original verdicts. No automatic B reopening. |
| S2 | One inherited visible authority-projection failure; canonical/pending and authority inputs partly unobservable/unavailable. | Reconcile stronger authority target with documented application-owned reconciliation; no inspection redesign inferred from missing observations. |
| Q1 | Exact-8d engineering verification is complete; final repaired runtime is not frozen or verified. | Focused falsifiers after each repair, then affected suites/types/spec-types/lint; complete registry and mutation proofs, fresh installed artifacts, framework/browser checks and budgets at final source. |

R1/R2 are six desired-behavior failures, not six independent defects. Their
source describes mismatched per-call order endpoints versus complete-turn
endpoints. Neither case has later independent work that would justify treating
safe refusal as the intended success. The public kernel README promises undo
and redo of designated turns. Accepting these as limitations instead of repairing
them requires an explicit product decision; no such decision is recorded here.

## Open-key decision boundary

`e-granularity.spec.ts` explicitly rejects initial keys defining the legal value
of an open Record. `traversal-diagnostics.spec.ts` W1 nevertheless requires an
ST2010 warning for an unknown write, including a Record-typed initial value;
`recursiveUpdate` discards that key. Type erasure prevents selecting different
runtime behavior for otherwise identical Record and closed-object values.

The owner question submitted by this audit is whether ordinary whole-value writes
may materialize newly supplied keys regardless of the erased TypeScript shape.
Owner authorized newly supplied keys on October 17: honor the whole-value
promise, preserving internal inspection replay's separate unknown-key policy.
This authorizes K1 implementation, not never-present descendant handles.

This does not settle never-present descendant acquisition. Recursive positive
types also promise descendants such as `.id()` before a value supplies a shape.
A stable deferred handle would need a specified protocol policy: blindly returning
callables for absent `then`/`toJSON` can change Promise/serialization behavior.
Reads must not create membership. No implementation is selected here.

Dynamic creation also invalidates a deliberate premise of
`DESCENDANT-MATERIALIZATION-0` in the production-surface audit: ordinary leaves
currently exist eagerly, so an ancestor observation claim only walks existing
children. Any creation repair must propagate active ancestor/Link claims, retain
construction authority safely, and respect prototype/security boundaries.
A child insertion in `recursiveUpdate` alone does not establish that contract.

## Semantic matrix accounting

The four committed JSON records in `docs/audits/2026-09-24-matrix-rebaseline/`
contain 424 rows: 188 held, 68 violated, 168 unsupported, zero execution errors.
Later exact candidate evidence records unchanged verdicts against 19a5/ecf048;
48 trace differences concern diagnostic rekey labels. This audit classifies
existing results; it does not rerun the matrix or upgrade its verdicts.
Reproduce this classification from repository root:

```sh
python3 docs/audits/2026-10-17-incumbent-readiness/classify-matrix.py
```

[The row inventory](matrix-classification.csv) retains every case ID, original
verdict, group, source and unsupported/failed assertion detail. Groups:

| Original verdict | Count | Meaning for readiness |
| --- | ---: | --- |
| Held | 188 | Existing tested claims; not proof of whole-law conformance. |
| Violated: overlap | 57 | Unmet stronger settlement target; scope reconciliation required. |
| Violated: independent Link | 10 | Supported-target failures; causal diagnosis remains. |
| Violated: authority projection | 1 | A1 visible actual 7 versus expected 1; pending authority survives. Scope/adapter interpretation unresolved. |
| Unsupported: omitted enhancer | 112 | Fixture lacks the requested enhancer capability; not product exclusion and not success. |
| Unsupported: refusal setup | 6 | Harness setup gap; may mask other missing capabilities. |
| Unsupported: terminal observation | 17 | Missing terminal-disposition reader; full claim unverified. |
| Unsupported: canonical split | 24 | Observation/architecture requirement unresolved; no promise that a reader alone solves it. |
| Unsupported: authority input | 9 | Four correlated, five revision-ordering inputs unavailable; current consumer guidance assigns policy to application. |

SEMANTICS-2 L3 requires removing contributions rather than restoring historical
values. L16 requires unrelated work to remain synchronizable. The consumer
composition guide, deliberately updated in `45b8a6ef`, instead documents
newest-open-first settlement and atomic older-overlap refusal; reconciliation,
revision and staleness policies belong to the application. These statements do
not authorize silently weakening either frozen assertions or product scope.
The remaining product question is whether successful arbitrary-order overlap and
canonical/authority semantics are v16 release requirements or a separate product
capability. A narrower release needs an independent application/product rationale.

## Costs, limitations and review

[Matched incumbent cost evidence](../../research/v16-candidate-acceptance-0/COST-TABLES.md)
remains explicit: tested mixed transactions cost approximately 25% more wall time
and 20–21% more CPU than 19a5; enhanced idle heap increases roughly 11–21% in
those fixtures. Ordinary shifts were small relative to A/A noise. This is a
measured tradeoff, not a newly invented release failure. Artifact ceilings were
already owner-approved; no ceiling is changed here. Short construction samples
do not establish neutrality or application performance.

Four unexported provenance expected failures remain research debt unless a
public consequence is demonstrated. Old repaired capture/recovery/publication
failures are not re-added as blockers. Native B reclamation passed its controls;
the standalone model leak is not a native incumbent or final B failure.

Two independent read-only investigations covered open-key compatibility and
restoration/matrix scope. The primary agent verified the cited assertions,
consumer/frozen-law conflict and all matrix group counts from raw JSON. Neither
investigation performed runtime verification or approved an architecture change.

A separate [independent interpretation review](REVIEW.md) found no material
inventory blocker and verified all 424 rows against raw evidence. Its limits are
recorded explicitly.

No source or test assertion changes accompany this record. The next implementation
step depends on the open-key decision; independent contract accounting is complete.
Final release-contract acceptance remains blocked by the explicit questions above.

## Authorized new-key experiment disposition

The [experimental implementation and its recurrence counterexample](new-key-candidate/README.md)
are preserved separately. Authorization stands; the implementation is not accepted.
Historical evidence above applies to its stated source, not this dirty experimental runtime.
