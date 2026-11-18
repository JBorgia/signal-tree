# V15 startup allocation follow-through

The qualified source is `e45fd69616586cae6f7f9e8622c082199d0fded0`, containing
runtime implementation `90947841d9c29593a2ef9d8ebf22772cabaf5e70`, on
`codex/v15-startup-economics`. The baseline is
`4e791f32238fa7bdde480c5408a23dc4a4bca804`. Documentation successors have separate
identities. This is local preparation; no tag, npm publication or deployment.

New entities no longer allocate a stored revision of zero: the existing accessor
already supplies zero for absent entries. Explicitly recreating a subject still
deletes its old entry, preserving reset. Ordinary leaves register before writers
escape, but defer their observation record until the first consuming claim.
Claimed identity survives release and rearming. No public flag, type or feature
is added or removed.

## Measured benefit and limits

At 10,000 populated rows, the allocation changes save about 460 KB in separate
forced-GC processes. The saving survives actual value edits, transaction confirm,
rollback and retirement. Structural revisions track changes such as rekeying;
they are not per-value-write counters. The explicit maximum-demand follow-up
holds every row, changes every key and restores every key. Its paired median
saving falls from 460,992 bytes after population to 2,392 bytes after the round
trip, with mixed signs and A/A variation up to 15,520 bytes. Fully demanded
revision storage therefore has no discernible saving in this cohort.

With 64 live scalar Links across 8,192 ordinary leaves, deferred records retain
about 840 KB of saving. With a separate scalar Link on every leaf, that saving is
consumed. These are deliberately different observation-demand patterns, not a
claim that ordinary framework reads each allocate a Link. Tested trees collect;
small whole-process residuals do not establish universally zero retained cost.

The original CPU cohort includes adverse differences. The seven-round follow-up
is mixed and noisy. Select this for memory, not a general CPU speedup or proven
CPU equivalence. The exact final kernel is byte-identical to the measured
combined prototype. A fresh complete Angular application comparison independently
finds 917,956 bytes less populated heap at 50,000 rows, with a paired median
factory difference of −4.0 ms (range −5.9 to −1.2; A/A −0.9 to +3.3 ms).
Smaller workloads have mixed/noise-scale timing differences; this does not
establish a general CPU improvement. Full application results and their limits
are recorded separately in the
[central study](https://github.com/JBorgia/signal-tree/tree/codex/startup-market-economics/docs/audits/2026-11-18-startup-market-economics).

The selected single-process Angular diagnostic profiles construction, population,
first full read and first 100 row-node demands separately. Remaining population
work is concentrated in subject creation, activation and ordered node creation.
It omits initial marker materialization at first `$.rows` access between factory
and population. The [identified follow-up](PROFILE-FOLLOWUP.json) passes with a
continuous constructor-through-population profile, explicit first marker access
and all original assertions intact.
The original phases are not exhaustive startup attribution or a statistical
before/after comparison. Required key, order and lifetime
behavior does not establish that every current representation is irreducible.

## Exact qualification

[The index](QUALIFICATION.json), [payload joins](PAYLOAD-JOINS.json) and
[bundle results](BUNDLE-COST.json) retain exact commands, paths and hashes.
The central evidence packet preserves the referenced raw outputs and generators.

- The first full normal registry passed 89/91 on `90947841`: bundle size and a
  cleanup self-test output buffer failed. A preserved successful standalone
  receipt emits 1,052,244 bytes and reproduces the default-buffer failure.
  Source `e45fd6961` changes only
  that self-test's JSON whitespace; the parsed result is identical. Both affected
  checks pass after correction. This covers 90/91 gates, not one all-green run.
- All 91 gates are proven able to fail on `e45fd6961`, 15 indirectly through
  companion self-tests,
  with exact source restoration and no unproven, vacuous, blind or errored check.
- Five fresh canonical archives join to 158 shipped payloads. All facade payloads,
  public declarations and package manifests remain unchanged. Only two kernel
  implementation payloads differ from the baseline.
- Strict installed consumers, Angular AOT, facade identities, React SSR, the
  strict production demo and all 146 browser checks pass. No demo budget override,
  skipped, flaky or retried browser result is used.
- Independent review verifies source, logs, archive members, payload joins,
  route totals and dense follow-up calculations. It does not rerun every test.

The dense experiment's first harness incorrectly expected a development-only
inspection hook in the production v15 package. Its original error matcher also
matched a directory name instead of the assertion. Those controls are invalid
and no heap sample from that attempt is accepted. The corrected harness checks
real public rekeys, node identity, values and order; v15 internal revision density
is source-supported, not directly observed. Both exact named negative controls
and all nine fresh children pass. The earlier failure is preserved.

## Candidate-specific size disposition

| Gzip fixture | Baseline bytes | Selected bytes | Change | Unchanged ceiling |
| --- | ---: | ---: | ---: | ---: |
| Bare production | 11,071 | 11,048 | −23 | 11,059.2 |
| Bare development | 13,222 | 13,197 | −25 | 13,209.6 |
| Entities production | 25,392 | 25,368 | −24 | 25,292.8 |
| Entities development | 28,339 | 28,311 | −28 | 28,160 |

**Retain the compatible memory improvement and qualify local preparation with
this specific size acceptance.** Both bare fixtures now pass. Entity fixtures
remain 75.2 and 151 bytes over their unchanged ceilings, despite shrinking.
Accept these measured residual costs under the owner's instruction to weigh
budgets against benefit and feasibility. These four gzip fixtures incur no added
bytes; the two uncompressed implementation files grow by 97 bytes in total.
The numerical entity failure stays failed; no ceiling
changes or blanket exception follow. A separate passing/grown/restored fixture
returns 0/1/0 and restores exactly.

The cross-version report distinguishes compatible allocation transfers from
v16's separate publication contract. V15 already handles the multiple-prepend
Link order case repaired in v16: eight exact-package baseline/candidate,
neutral/Angular and ordinary/confirmed-transaction witnesses pass. No redundant
runtime backport is selected.
