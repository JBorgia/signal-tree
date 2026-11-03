# Approved artifact-cost acceptance

October 18, 2026. **Owner approved the four artifact ceilings; all four now pass.**
Approval is limited to artifact cost and its validation.

Approved disposition: accept the measured artifact cost of the authorized whole-value
new-key correctness behavior, with the narrow ceilings below. This accepts
artifact cost only, not performance neutrality or v16 release readiness.

## Exact cost and proposed ceilings

Baseline `8d220643e0d4e34cbdbc6e55e6ef692b25d5e023`; candidate runtime
`9917c92fbbdc9dfdd14601f1f5fb7ce21799be71`. Passing repair checkpoint `89bfca62`
and evidence `96a54e6a` remain preserved. Matched build settings, source/artifact
hashes and executable fixtures are in the [attribution record](artifact-cost/README.md).

All measured sizes and headroom below are gzip bytes. The gate calls its settings
KB but divides bytes by 1024; proposed settings below therefore use KiB.

| Fixture | Incumbent | Candidate | Added bytes | Current limit, bytes | Current failure, bytes | Proposed setting, KiB | Proposed maximum integer bytes | Proposed headroom, bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Bare production | 11,919 | 12,592 | +673 | 12,032 | 560 | **12.41** | 12,707 | **115** |
| Bare development | 14,325 | 15,028 | +703 | 14,438 | 590 | **14.79** | 15,144 | **116** |
| Entities production | 26,074 | 26,640 | +566 | 26,214 | 426 | **26.16** | 26,787 | **147** |
| Entities development | 28,902 | 29,495 | +593 | 29,081 | 414 | **28.98** | 29,675 | **180** |

### Headroom rationale

Preserve the incumbent's existing absolute byte allowance rather than expand it
in proportion to the larger artifact: 113 / 113 / 140 / 179 bytes. Add each prior
allowance to the candidate measurement, then round the KiB setting upward to two
decimal places. This gives 115 / 116 / 147 / 180 bytes: only 2 / 3 / 7 / 1 extra
bytes from rounding. The proposal is consistent with the gate's documented narrow
headroom policy and gives no new feature-growth allowance. It is not an empirical
bound on future compiler variation or permission to spend without review.

These ceilings are prospective policy choices, not test results. The existing
four failures remain failures until explicit approval, implementation of the
policy change and verification against the resulting identified artifact. Approval
would not retroactively turn preserved failed runs green. The ceiling increases
would be 675 / 706 / 573 / 594 bytes, distinct from the actual added artifact bytes.

## What the cost buys, and who pays

The owner authorized whole-value writes to ordinary branches to admit supplied
new keys. That supported behavior requires private preparation, valid member
installation, observation enrollment and transaction responsibility installed
before later equality/publication callbacks can fail. Tested outcomes include
new keys in scalar/nested/array/undefined shapes, coherent publication, rollback,
retained recovery authority, reentrant writes and no retained unpublished slots
after failed preparation. Stable v15 behavior and internal inspection replay's
separate unknown-key policy are not changed by this approval.

This is cumulative cost for the new-key path, not solely the final capture patch:
the paired installation repair itself added 138 / 171 / 116 / 113 bytes before
optimization. The new-key constructor and observation paths account for most of
the earlier increase. Users who need this behavior benefit from honoring the
public contract and safe failure handling. Ordinary consumers also pay the core
bundle cost when they never add keys. Transaction/restoration enhancer implementations
are not accidentally retained by the bare fixture. Entity consumers pay their
fixture's additional 566 production bytes; no claim covers every framework app's
final download or startup cost.

## Safe reductions already assessed

- Retained module identities are unchanged: 33 library modules bare, 43 entities.
  No unintended transaction/restoration enhancer implementation or obsolete
  alternative authority was found in these fixture graphs.
- Four copies of prepared-record installation loops were factored into one
  internal helper, preserving guards, order and installation positions. This
  saved 20 / 33 / 123 / 105 gzip bytes and received independent review plus its
  own full kernel/framework, type and installed-consumer verification.
- Factoring transaction member-effect construction would not reduce these fixtures
  because that implementation is absent from their graphs; it was not pursued.
- Removing preparation, observation enrollment or exception publication would
  sacrifice tested required behavior. No further safe material reduction was
  established. This is not a proof that the candidate is globally minimal.

## Runtime evidence and unresolved costs

The [preregistered study](representative-cost/README.md) supports narrow cost
characterization, not a CPU/heap acceptance threshold invented afterward:

- All 20 synchronous timing and all 20 CPU comparisons remain directionally
  unresolved. This establishes neither regression nor equivalence.
- Ten populated trees add 4,920–5,560 bytes of live process heap in the tested
  ordinary profiles: roughly 492–556 bytes per tree averaged within those fixtures.
  The separate 100-empty-tree control adds 29,048 bytes, about 290 per tree.
  Do not subtract the differently shaped fixtures to infer per-row cost.
- Corrected cleanup samples clear all tree WeakRefs. This is sampled collectibility,
  not absence of retained child metadata or universal leak freedom.
- Isolated pending-owner memory at 10,000 rows remains unresolved: the aggregate
  process delta is negative in both arms and cannot represent owner storage.
- Developer-host contention, small sample counts, omitted framework rendering,
  startup/parse, optional history and application traces limit interpretation.

No general speed advantage pays for the artifact increase in this proposal.
The justification is required correctness at an explicitly quantified footprint,
with small measured populated-memory growth and unresolved timing tradeoffs.

## Requested owner disposition

Approve or decline the four proposed artifact ceilings for this correctness
change. Approval would authorize only those budget settings and their validation;
it would not authorize release, push, merge, activation, tag, publication, runtime
optimization, API changes or reopening B. It would not certify CPU neutrality,
resolve pending-owner memory attribution or close the other open-key, restoration
and semantic-scope readiness items. Declining retains the artifact blocker while
preserving the passing correctness checkpoint; it does not reject contribution
ownership or authorize a new architecture experiment.

## Approval and execution

The owner explicitly approved this proposal on October 18. The four settings were
implemented in tools/check-bundle-budget.mjs and verified with Node 24.15.0 against
the identified candidate build. All 248 artifact hashes still match the sealed
candidate manifest; no stale managed-worktree dist was used.

[Budget output](artifact-cost/approval/budget.log) and
[validation receipt](artifact-cost/approval/receipt.json) record four passes. The
proposal sections above preserve the decision basis and original failed limits.
No runtime or benchmark was rerun or altered. Other readiness blockers and
performance uncertainties remain; no release authority follows from this approval.
