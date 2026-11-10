# Candidate C packed field heap prototype

November 10, 2026. Separate experiment from unchanged Candidate C, based on `833ed0673`. The bulk CPU prototype is outside this branch. The result supports a follow-up on narrow row storage. Production remains HOLD.

## Representation and correctness

Fresh live rows with at most three fields can install separate fixed-slot ordinary and physical field rows. Each channel keeps the same endpoint objects and requirement identities. Prepared and exposed evidence retains the existing detached maps. Existing-field writes can update a slot in place. On capacity overflow, exposure, reentrant preparation, or a required copy, the point preparation can promote to a map before installation. A packed-row copy visits at most three entries per channel. Wider initial rows and generic updates use maps.

The heap change targets per-row map and backing-table overhead. It keeps the ordinary/physical distinction, exact captured requirements, current owner handling, and retirement revision checks. The added promotion witness checks both proof channels before and after adding a fourth field. The late-retirement witness checks both equal-value and changed-value points prepared before the plan was captured, on both map and packed storage. Independent source review identified that coverage gap and found no concrete counterexample to the scoped representation.

All 119 focused tests across 13 files pass, including the original source point-work gate. Kernel types and focused lint with zero warnings pass. The exact built point counter also passes. The built counter finds **1,800 visits** for 200 distinct writes at 2,000 and 20,000 rows, under the original `<2,000` bound. The public `setAll()` reentry probe enrolls a recipient during a payload descriptor callback on the built prototype. The stale batch installs zero rows, the later batch succeeds, and the refused attempt's per-edit proof remains readable.

## Matched measurements

Fresh serial Node 24.15.0 children on Apple M4, production mode, two Candidate C A/A controls plus five alternating pairs per profile. The existing forced-GC and turn quiescence rule applies to the ten-tree heap workload. Each tree holds 1,000 three-field rows and 16 scalar fields, with no row handles or transaction enhancer. Every heap child checks counts and teardown sentinels. This is whole-process heap above baseline, not a retained-size census of individual objects.

| Final artifact endpoint | C median | Packed median | Registered direction |
| --- | ---: | ---: | --- |
| Populated live minus baseline heap | 17,720,712 B | 15,661,048 B | Lower |
| Population CPU, 200 batches of 100 rows | 409.154 ms | 365.847 ms | Unresolved |
| Warm point synchronous CPU, 2,000 writes | 31.658 ms | 27.091 ms | Unresolved |
| Warm point CPU through two turns | 46.923 ms | 27.162 ms | Lower |

Heap improves **2,059,664 B (11.6%)** in the final cohort. The first artifact had three lint warnings in its iterator. Its separate cohort showed a similar heap change, from 17,721,312 B to 15,661,272 B. The iterator guards were corrected before rebuilding and measuring the final cohort, and the first cohort remains separate. Point total CPU was unresolved in the first cohort. The final result shows a lower descriptive range for that metric on the measured host, with the synchronous direction unresolved and no attribution of the post-write difference. These ranges do not establish general CPU acceptance or production workloads. Rows wider than three fields and long-lived workloads that promote rows need separate measurement.

## Replay

The [evidence archive](evidence.tar.gz) and [SHA-256](evidence.sha256) retain both cost cohorts, exact kernel artifacts, counter and reentry probes, and witness logs. Run `python3 compare.py /absolute/path/to/node` in a fresh extracted packet with access to the pinned workspace dependency tree. Run `node public-reentry.mjs /absolute/path/to/dist` and `node replay/counter-child.mjs arm /absolute/path/to/dist/index.js` for the built witnesses. The declared direction rule requires nonoverlap and a median gap exceeding the largest measured A/A or arm range. Raw distributions and host telemetry are retained. Independent interpretation review recomputed all 36 samples and checked 275 input hashes in each cohort. Point samples bind to artifacts through the runner arguments and schedule. The point harness imports a second quiescence-helper copy, which is unused on that path and byte-identical to the hash-pinned helper.
