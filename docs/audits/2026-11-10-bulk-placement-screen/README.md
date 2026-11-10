# Bulk placement CPU screen on packed Candidate C

November 10, 2026. The packed prototype remains the comparison baseline. This experiment found no resolved CPU improvement. Production remains HOLD.

## Rejected ordinary replay shortcut

The first prototype substituted final physical adjacency for ordinary replay in an initially empty, aligned collection. Independent review reproduced a semantic difference on the built packed baseline and the first prototype. During the ordinary payload clone, a getter reentered and installed rows `inner` and `b`. Both builds preserved the nested write and refused the outer one. A recipient acquired the outer attempt's physical packet `[add a, add b]` on both. Its ordinary packet was `[add a]` on the baseline and `[add a, add b]` on the shortcut. Refusal therefore did not make the change unobservable. The first prototype also required the causal commit clock, which the ordinary no-enhancer fixture does not install.

## Replacement screen

The tested replacement preserves ordinary replay and callback order. Its physical placement stage skips regenerating adjacency for a unique fresh sequence whose requested key order is already satisfied. The commit still orders the live store. Visibility lookup keeps the original first-query snapshot and returns directly when the queried indexed anchor is already visible in that snapshot. Other lookups retain their original traversal.

All 115 focused source tests across 16 files pass, including controls for skipped order rewrites and cached visibility. Kernel source types and focused lint with zero warnings pass. The built replacement matches the baseline's clone-reentry output byte for byte. The built public `setAll()` enrollment witness also passes. Built late-reader and retirement probes cover three, four, eight, and 32 fields, foreign confirmation and rollback, repeated same-key retirement, and plans captured after a point was prepared. The original exact counter reports **1,800 visits** for 200 distinct writes at both 2,000 and 20,000 rows on both arms, under the unchanged `<2,000` bound.

## Measured CPU

The packed baseline was reverified against 141 files from the final packed cohort at `b6acda575`. The replacement is an uncached kernel build, with both arms bound by payload hashes. Node 24.15.0, Apple M4, production mode, fresh serial processes, two A/A controls and five alternating pairs per profile. All 36 children completed. The rule requires nonoverlapping ranges and a median gap larger than the largest observed A/A or comparison-arm range. Host conditions and all sample distributions are archived.

| Workload | Packed baseline median CPU | Replacement median CPU | Direction |
| --- | ---: | ---: | --- |
| Population phase, 200 batches of 100 rows | 323.322 ms | 341.678 ms | Unresolved |
| Population phase, 30 batches of 1,000 rows | 503.387 ms | 510.617 ms | Unresolved |
| Warm point total CPU, 2,000 writes through two turns | 23.516 ms | 25.118 ms | Unresolved |

The replacement removes structural work in its admitted case. The timing does not establish a saving and the observed medians are higher. Retain both experiments as evidence rather than promoting either. A broader CPU change needs to preserve sequential ordinary evidence in the presence of callback reentry. Application acceptance remains open.

## Evidence

The [evidence archive](evidence.tar.gz) preserves the rejected diff and artifact, final and baseline artifacts, build logs, profiles' raw samples, and correctness witnesses. Verify with `shasum -a 256 -c evidence.sha256`. Replay cost with `python3 compare.py /absolute/path/to/node` from an extracted packet with pinned workspace dependencies and a fresh `runs` directory. Replay the getter witness with `node clone-reentry-review.mjs /absolute/path/to/dist`.
