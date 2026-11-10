# Packed publication fields under wider rows and sustained edits

November 10, 2026. The [packed prototype](../2026-11-10-packed-field-heap-prototype/README.md) preserves its heap saving when narrow rows receive repeated existing-field edits. The saving is smaller as a share of total heap when consumers hold a handle for every row. The saving disappears once all rows promote. Wider rows use maps on both builds. This campaign gives no general CPU or production qualification.

## Matched comparison

Candidate C uses the qualified `9aa20563b` runtime bytes. The packed arm uses the final kernel from `b6acda57552affb0fdcbc0b40f1996c4345ed5d8`. The previous campaign manifest reverified all 271 selected distribution payloads. Fresh serial children use Node 24.15.0, Apple M4, production mode, a 768 MiB old-space cap, and a 120-second per-child timeout. Two C A/A controls precede three alternating comparison pairs per profile. All 32 scheduled children completed with stable inputs. The prior cohorts stay separate.

Each child creates six stores with 512 rows per store, then holds one handle per row. Two edit phases visit every row per round. Narrow profiles use 12 rounds per phase (73,728 checked updates across both phases), and wide profiles use six (36,864 checked updates). Each round changes one existing field and checks the result on every edited row. Wide rounds rotate through a hot subset of six fields. The promotion profile inserts a fourth field on all 3,072 rows between phases and includes that field in later edits. Both edit phases check full row contents. There is no transaction enhancer or link subscription in the cost workload. These are finite warmed-store fixtures, with no extrapolation to wall-clock uptime.

| Workload, field count includes ID | Cold heap C → packed | Heap after both edit phases C → packed | Final direction |
| --- | ---: | ---: | --- |
| Eight-field rows | 8,035,664 → 8,026,136 B | 118,909,944 → 118,907,736 B | Unresolved |
| 32-field rows | 23,212,568 → 23,268,416 B | 384,276,384 → 384,216,072 B | Unresolved |
| Three-field rows, existing fields only | 5,836,008 → 5,215,984 B | 59,343,656 → 58,723,680 B | Lower |
| Three-field rows, then promote to four | 5,836,008 → 5,217,144 B | 61,165,704 → 61,181,992 B | Higher |

Heap is quiescent live minus process baseline. The primary endpoint is after both edit phases. A direction requires disjoint comparison ranges and a median gap larger than the maximum measured A/A or arm range. Cold eight-field heap passes that descriptive rule by 9,528 B and is a secondary observation. The narrow existing-field gain is 619,976 B both after many edits and close to the original cold difference of 620,024 B. It represents about 1.0% of the handle-primed, edited fixture. After all rows promote, the final heap is 16,288 B higher, about 0.03%, with no resolved difference immediately after promotion. This is a small process-heap difference. All 192 tree sentinels clear after teardown. The narrow cohorts have small higher process residuals after destroy, with no retained tree detected by those sentinels.

The timing includes in-loop checks and separately captures synchronous work and CPU through two immediate turns. Population and steady edit CPU directions are unresolved at both widths and in the narrow workloads. The promotion phase's synchronous CPU median is lower (57.090 → 51.185 ms) under the descriptive rule. Its CPU through two turns remains unresolved. This is workload evidence from a shared host.

## Semantic and bounded-work checks

The packed source suite passed all 128 focused tests across 14 files. Both built kernels passed the same late-reader and reentry probes. Late links acquired after 64 edits saw the expected row on foreign confirmation and rollback at widths 3, 4, 8, and 32. The width-four case starts packed on the prototype and adds a field before acquisition. Reentrant enrollment inside public `setAll()` refused the stale batch, installed no rows, and preserved the captured evidence after a later successful batch. Sixteen same-key lifetimes per width retired with field, membership, visibility, mapping, and pending retirement counters cleared. Retirement plans captured after point preparation became stale on equal-value and changed-value installation on both arms.

The exact unchanged two-field counter reports **1,800 visits at both 2,000 and 20,000 rows** on both arms, passing `<2,000`. A separate probe uses the same counter with wider rows and with a fourth-field promotion. It also instruments the packed iterator so it cannot hide work outside the original Map, Set, Object, and Array hooks.

| Separate workload, 200 distinct point writes | Original hook visits, both arms and both collection sizes | Extra packed iterator visits |
| --- | ---: | ---: |
| Three fields, existing-field edit | 2,200 | 0 |
| Eight fields, existing-field edit | 4,200 | 0 |
| 32 fields, existing-field edit | 13,800 | 0 |
| Three fields, add fourth field | 2,600 | 1,200 |

The existing-field counts vary with row width on both builds and stay flat with collection size. Promotion adds six slot visits per write, three for each prepared channel. The original numeric gate applies to its original two-field fixture.

## Evidence

The [archive](evidence.tar.gz) and [SHA-256](evidence.sha256) contain exact artifacts, the registered schedule, harnesses, raw samples, and both kinds of witnesses. Run `python3 campaign.py /absolute/path/to/node` in a fresh extracted packet after moving the recorded `runs` directory aside and making the pinned workspace dependencies available. From the source worktree, run `bash /absolute/path/to/verify.sh` for the exact artifact probes and focused Nx source witnesses. Verify the archive with `shasum -a 256 -c evidence.sha256`.
