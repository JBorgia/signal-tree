# Successor-placement boundary qualification

Baseline: `cfe5884d7e82dd8b95c0d32f460b244144595610`.
Owner-approved policy direction and pre-execution expectations: SPEC.md.
This checkpoint adds the specification and focused tests only. No production
implementation or rejected model changes. B remains rejected.

## Results

New `packages/kernel/src/lib/successor-placement-policy.spec.ts`:

| Boundary | Incumbent | B selected |
| --- | --- | --- |
| Moved successor, first success then terminal no-op | Pass | Pass |
| Successor moved farther | Pass | Pass |
| Successor externally removed; predecessor survives | Pass | **Fails: refuses required success** |
| Fresh same-key successor moved before predecessor | Pass | **Fails: refuses required success** |
| Same successor lifetime rekeyed | Pass | Pass |
| Successor restored by same settlement | Pass | Pass |
| Temporary successor removed by same settlement | Pass | Pass |
| Several temporary successors | Pass | Pass |
| Originally neighborless restoration | Pass | Pass |
| Both original anchors lost, fresh same-key successor | Pass: atomic refusal/repeat/confirm | Pass: atomic refusal/repeat/confirm |

First run: **18 ordinary passes / 2 ordinary failures**. The source and log were
preserved before formatting. No assertion was weakened or marked expected-failure.
Final focused run including unchanged restoration-missing-anchors.spec.ts and
b-authored-topology-repair.spec.ts: **52 ordinary passes / 2 ordinary failures**.
All 34 existing controls pass; no skips. The new incumbent arm is 10/10 and B is
8/10. B authority is explicitly asserted as native-pending in successful-scenario
fixtures; incumbent asserts the experimental authority is absent.

Positive tests check scalar restoration, ids/all agreement, restored held identity,
zero pending authority, later writes and repeated terminal rollback. The two red
cases stop at rollback; later state, lifetime and terminality assertions in those
cases are not reached. Their refusal atomicity is not claimed from this run.
The separate lost-both-anchors test checks unchanged mixed state, detached old
lifetimes, fresh replacement identity, repeated refusal, pending authority and
useful confirmation in both arms.

## B failure boundary

Both failures throw SignalTreeRollbackError with cause:

```
Removed entity anchor has no placement
```

In native-entity-ownership-experiment.ts, `successor()` follows a captured
successor through this settlement's removals. However, it is invoked for every
restored topology delta. An externally removed successor C has no current native
placement or retained membership placement, so the traversal throws before
`__prepareOwnershipDelta` can use the still-valid predecessor A.

In the replacement discriminator, fresh C is deliberately prepended: the expected
order is fresh C,A,B from predecessor fallback. Treating fresh C as the old
successor would instead put B before fresh C. B refuses; it does not exhibit that
identity-aliasing outcome. This is unavailable compatible settlement, not observed
silent order corruption or successful partial rollback.

The same-settlement controls still pass. Their temporary anchors are valid
preparation evidence and disappear from final topology. This does not authorize
arbitrary anchor substitution, blanket refusal, or importing full chronological
replay. Complete-target contradictory-anchor validation remains a separate rule.

## Independent review and checks

Independent source/test review confirmed expected boundaries, selected authority,
held-lifetime discriminators, and the traversal's loss of predecessor fallback.
Root inspected the cited branch and executed both first and final focused runs.
The reviewer made no edits or execution claims.

`node tools/check-spec-types.mjs` passes the unchanged ratchet. Its output reports
three improvements relative to the stored ratchet, with six diagnostics still in
mut-participation.spec.ts; this is not clean spec compilation. No allowance was
updated and no improvement is attributed to this new test. Only the new test was
formatted. No broad kernel/framework suites, build, bundle or CPU/heap measurement
was performed. No runtime lint claim is made for this test/spec-only checkpoint.

The earlier rejected model, its prewritten bracket expectation, stale-order
regression and quadratic-admission witness remain unchanged. The separate
ordinary-churn cleanup defect is neither repaired nor reclassified. This result
qualifies the bounded successor policy and exposes two B compatibility failures;
it does not accept B or authorize adaptation.

## Replay

Use Node 24.15.0 and pinned pnpm 10.17.0 from the repository root:

```sh
NX_DAEMON=false pnpm nx test kernel --testFile=src/lib/successor-placement-policy.spec.ts --skip-nx-cache
NX_DAEMON=false pnpm nx test kernel --testFile=src/lib/successor-placement-policy.spec.ts --testFile=src/enhancers/restoration/restoration-missing-anchors.spec.ts --testFile=src/lib/b-authored-topology-repair.spec.ts --skip-nx-cache
node tools/check-spec-types.mjs
```

The first two intentionally exit 1 on the preserved B refusals. See EVIDENCE.md
for source seals and first-failure archive. No default activation, API acceptance,
v15 change, push, merge, tag or publication.
