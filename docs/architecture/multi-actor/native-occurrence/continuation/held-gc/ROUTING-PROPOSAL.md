# Proposed held-continuation GC routing (not implemented)

Bounded integration into the existing forwarding-retention-gc gate; do not silently remove ordinary coverage. Current C21 already has the historical Nx held-continuation-probe:retention target and its retention-probe.config.ts. The existing registered forwarding-retention-gc runner covers a distinct nine-arm forwarding fixture, not this three-arm primitive fixture.

1. Extend tools/check-forwarding-retention.mjs to retain its original nine executions verbatim and add the unchanged held-continuation fixture's three arms: hold-proceed, drop-proceed, hold-row. Separate fresh process/output for each; explicit --expose-gc in workers. Existing retention config gains the held fixture, with each child filtered to its exact file. No arm filter accepted by the aggregate runner; require exactly 9+3 executed results, not just successful process count.
2. Validate each held artifact's mode, pinned Node identity, 12 held and 12 released rounds, and original test success. Preserve original positive/negative controls, explicit row-holding assertion, rollback completion/capture guards and non-replay assertion. Do not replace these with recording-only traces or assert new universal receiver retention/reclamation promises.
3. Update forwarding-retention-gc gate coverage to state both matrices. Only in this same reviewed successor add held-continuation-probe to the ordinary config's explicit GC exclusions, beside existing forwarding-retention-probe. Show discovery movement (one ordinary file removed, one GC file added; all others unchanged) plus gate listing/runner matrix proof. No exclude-only promotion. Keep existing historical target unless separately authorized to remove it.
4. Runner checks must fail on missing/unexecuted arm, invalid mode, missing/mismatched artifact, missing GC, or child failure. Preserve raw child output and first failures. Any added deadline stops only its owned subprocess group.

## Prewritten falsifiers / mutants for routing review

All proposed, NOT executed here; no source mutation in this three-arm qualification.

- Existing forwarding fixture retained-tree mutation must still fail its original collectibility assertions. Extending the gate must not drop that check.
- Held hold-proceed fixture-only mutation: immediately before held sampling, replace the captured callback with a no-op only for hold-proceed. The unchanged staleError assertion must fail. This checks that gate execution reaches non-replay assertion, without altering runtime.
- Held positive-control mutation: leave box.positive referenced across released sampling. The unchanged released positive=false assertion must fail. Do not use retained-tree as this fixture's mutant: unlike the forwarding fixture it does not assert all tree targets collect.
- Held hold-row mutation: clear box.receiver before held sampling only for hold-row. The original every-sample row=true assertion should fail. Verify failure under the matched GC harness before adopting this as a gate mutant; GC eligibility alone is not proof.
- Runner artifact mutant: delete/swap a completed arm's JSON or omit one arm. Aggregate must fail even if all invoked children exited0. GC-negative control: absent --expose-gc must fail at the existing precondition, not skip.

Minimal existing gate mutation registration can use the retained-positive held mutant in addition to preserving the existing forwarding retained-tree control in runner self-tests; gate schema changes are not assumed. Review exact gate mutation interface before choosing whether the second mutant belongs in a dedicated runner self-test. No broad test run or new timing budget follows from this proposal.
