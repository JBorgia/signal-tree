# Independent singleton ordinary-row reuse review

**Bounded acceptance of the one-expression reuse change against exact C5.** No source-safety counterexample found in the reviewed paths. The unchanged point-work gate remains red; this is not integration or performance qualification.

## Identity and scope

Author manifest SHA256 `c2fd0a2e27a3a0e80601e2909d0b7ad4720d1bfca8ee1dda0053fea7503af9f0`; exact C5 baseline manifest SHA256 `b38d1ddc2a326b0589abe910447af92362a80e5e438b20cec657573d2603d620`; runtime patch SHA256 `e2fe023d694793b1225ac95c290dda8e5d52785b907bd45df2737c33bd23fbfd`.

Two disposable copies: successor and baseline. Baseline was reconstructed with the preserved BASE-entity.ts and verified against every C5 manifest entry. The new tests are identical in both copies. Successor differs in runtime only at experimental-publication/entity.ts:153: singleton reuses row instead of new Map(row). Author source/freeze artifacts and both copies' expected manifest entries remain unchanged (VERIFICATION.json). No root or author edits.

## Source safety

- Singleton is defined by the complete admitted ordinary sequence having exactly one edit, not by subject count. Duplicate/repeated edits and authored tombstones remain part of that sequence. Multi-edit snapshots still allocate copies, including repeated aliases.
- rowFields at:105 first clones the currently installed row into this preparation's nextFields. The ordinary loop fills that private row before creating per-edit evidence at:153–162. With one ordinary edit there is no later iteration that can rewrite it. Physical preparation uses nextViews separately; physicalRow remains a copy.
- The remaining preparation constructs records, overlays and support closures but does not mutate that ordinary row. Installation places the same prepared row into the outer fields map. Every later preparation obtains a fresh Map through rowFields; retirement deletes the outer subject entry rather than clearing/mutating the retained row.
- Responsibility choose writes its separate selectedFields map. Endpoint choices are resolved into the row before per-edit evidence escapes. Later calls cannot rewrite that row through the selection map. Restoration uses the same fresh-row path, retaining explicit restoredFields precedence. Inspection mutates physical support, not this ordinary row.
- Per-edit evidence exposes lookups, not a row-map mutator. Native requirements/owner cells can still evolve through their existing lifecycle; the old shallow Map copy also shared those endpoint/requirement objects. This change does not create deep payload/proof immutability and should not be described that way.

Recipient preparation/finalizer reentry, later writes, retirement and restoration therefore cannot mutate the saved row through the inspected producer paths. This relies on existing private source/record ownership, not defense against arbitrary mutation of private installation records. No global cache, new ownership authority, caller-payload freeze or public API is introduced.

## Independent replay

The unchanged new test pair passes **13/13 on baseline and13/13 on successor**, including calibration, held per-edit facts before/after installation, later writes, physical inspection, retirement/restoration, absent versus present undefined, repeated/multi-edit snapshots, preparation refusal, finalizer reentry, and real owner confirm/rollback. Assertions check useful values and held proof identity; no counter-only stand-in for missing work.

Actual matched constructor counts over200 updates after population:

| Row width | Populations | Maps C5 → successor | Copied entries C5 → successor |
| --- | --- | --- | --- |
| 2 | 2,000 and20,000 | 5,200 →5,000 | 2,000 →1,600 |
| 32 | 2,000 and20,000 | 5,200 →5,000 | 32,000 →25,600 |

Raw JSONL and generated ALLOCATION-COMPARISON.json are retained. This reproduces exactly200 removed Map constructions and200×width removed copied entries, independently at both populations.

The original point control is byte-identical and independently red on both arms: **15,800 →15,400 visits; required <2,000**. Its equal-count check between2k and20k passes before the ceiling assertion. These failures are retained in baseline-point.log and successor-point.log. No budget changed or waived.

## Measurement interpretation and limits

The test temporarily proxies the actual global Map constructor, forwards to the real constructor, and counts each consumed iterator entry. It restores Map in finally and calibrates an empty and copied Map independently. Population, assertions and teardown occur outside the measured200-update region. Every updated row and an untouched sentinel are checked. The two arms run the same test workload and instrumentation; the one runtime expression explains the matched decrement without changing loop/counter syntax.

These are JavaScript constructor/iterator event counts, not retained bytes, total allocations, CPU time or a heap measurement. The iterator wrapper itself adds unmeasured wrapper/generator work and may alter native constructor fast paths; elapsed times are not comparable evidence. This workload uses native Maps and ordinary array/Map iterables; it does not prove transparent instrumentation for arbitrary custom iterators. No speed ranking or whole-library allocation claim is made.

No broader author regression suite or type gates were independently rerun for this single-expression review. Their author results are not reattributed here. Combining this C5 change with joint-phase/retirement successors requires separate integration validation. Main retains integration authority.
