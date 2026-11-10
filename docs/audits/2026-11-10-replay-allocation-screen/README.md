# Ordinary replay and publication allocation screen

November 10, 2026. The packed kernel remains the baseline. This isolated prototype removes transient allocations but does not establish a population CPU improvement. Production remains HOLD.

## Change

Ordinary replay still runs in the same step order, including payload reflection, clone callbacks, and displacement. The rich path now completes each step's adjacency once, then builds the ordered list and per-subject index in the same pass. Per-step, per-subject, and ordered arrays remain distinct and share the completed mutation identities. Repeated subjects append their completed effects in step order. The point-only path retains its existing completion.

Native publication still enumerates the same payload keys at the same point in preparation. An empty staged map has no older keys to merge, so the existing ordered `Object.keys` result suffices. Nonempty maps retain the union and deduplication. The initial prototype used nullish field dispatch. Independent source review identified that this also changed how private packets with accessor or undefined fields were read. The final prototype restores the original strict-null dispatch and has its own clean build and matched cohort.

## Cost

Packed kernel `b6acda575` is verified against the previous 141-file binding. Both arms run on Node 24.15.0 and Apple M4 in production mode. Each profile uses two packed A/A controls and five alternating comparison pairs in fresh serial processes. The final cohort completes 48 children. The initial cohort remains separate. A direction requires disjoint arm ranges and a median gap larger than the largest observed A/A or arm range.

| Endpoint | Packed baseline median | Final prototype median | Direction |
| --- | ---: | ---: | --- |
| Population CPU, 200 batches of 100 rows | 429.025 ms | 385.902 ms | Unresolved |
| Population CPU, 30 batches of 1,000 rows | 516.954 ms | 497.858 ms | Unresolved |
| Warm point CPU through two turns, 2,000 writes | 23.868 ms | 23.430 ms | Unresolved |
| Live heap above baseline, ten stores with 1,000 three-field rows each | 15,661,288 B | 15,659,000 B | Lower |

The heap difference is 2,288 B across ten stores. It meets the descriptive rule in the final cohort only, is small relative to the prior packed-row gain, and does not show a change in the retained representation. The initial cohort also leaves both population CPU directions unresolved.

The separate V8 sampling pair on the 1,000-row population workload still places most sampled `setAll` stack time under frame preparation. The packed baseline attributes about 85 ms to publication preparation and 66 ms to ordinary topology preparation, inclusive. The prototype shows about 76 ms and 66 ms respectively. These overlapping sampled elapsed weights localize work, while the matched process CPU screen governs the comparison. They do not identify a saving from a particular allocation.

## Verification

All 120 focused tests across 14 files pass, including repeated-subject inverse replay, duplicate and restored publication support, and the unchanged point-work gate. Kernel source types and focused lint with zero warnings pass. Both exact artifacts pass the clone-reentry differential byte for byte, public `setAll()` recipient enrollment, late links after edits, same-key retirement, and invalidation of a plan captured after point preparation. The original counter reports **1,800 visits** at both 2,000 and 20,000 rows on both builds, passing the original `<2,000` gate. The point gate's sentinel, width, planted-charge, and thrown-undefined controls pass.

## Evidence

The [evidence archive](evidence.tar.gz) and [SHA-256](evidence.sha256) retain both cohorts and their exact artifacts, verification scripts, logs, and sampled profiles. Run `python3 compare.py /absolute/path/to/node` from a fresh packet with the pinned dependencies accessible and an empty output location. Run `bash /absolute/path/to/verify.sh` from the source worktree to replay the built and source witnesses, and `python3 profile-summary.py /absolute/path/to/packet` to summarize profiles.
