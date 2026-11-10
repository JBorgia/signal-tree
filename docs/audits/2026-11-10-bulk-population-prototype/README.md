# Candidate C bulk publication CPU prototype

November 10, 2026. Experimental branch based on `833ed0673` with Candidate C runtime `9aa20563b`. Keep C as the baseline. This prototype did not resolve a population CPU improvement.

## Change and correctness

A unique ordinary fresh addition may take ownership of its paired detached physical snapshot, since no second ordinary edit can select it. Repeated or nonfresh edits keep the separate copy. The prototype also materializes per-edit reader methods on first request, using inputs captured at preparation. It preserves row reflection, terminal writes, exposure, and refusal checks.

The reentrant enrollment premise is live. A public `setAll()` probe on both exact built artifacts uses a proxy descriptor callback to enroll a recipient during the native participant's `Object.keys` call. Both attempts refuse with the recipient revision error, install zero rows, and deliver the prepared evidence for both attempted subjects. After unsubscribing and successfully populating new values, the captured reader still returns the refused attempt's proof identities. The stack selector targets the callback boundary for this diagnostic. A source-level packet witness pins the same contract without stack inspection and passes on both arms.

The prototype passes 115 focused kernel tests across 11 files, including late consumer settlement, packet pairing, reentry, saved inspection, bulk controls, and retirement. The original source point-work test and exact built-artifact counter pass. The latter observes **1,800 visits** for 200 distinct writes at both 2,000 and 20,000 rows on both arms, against the existing `<2,000` bound. Endpoint, sentinel, width, planted charge, and thrown-undefined checks pass. Kernel types and focused lint pass.

## Matched cost screen

Fresh serial Node 24.15.0 children on Apple M4, production mode, with two C A/A controls and five alternating pairs per profile. Build inputs and raw results are in the evidence. The C kernel bytes were checked against its previous 140-file kernel manifest slice. The prototype kernel was built with an uncached Nx command. The campaign checked artifact hashes before and after. Different phases run in different processes, and these data are separate from previous cohorts.

| Endpoint | C median | Prototype median | Direction |
| --- | ---: | ---: | --- |
| Population CPU, 200 batches of 100 rows | 338.716 ms | 326.111 ms | Unresolved |
| Population CPU, 30 batches of 1,000 rows | 498.747 ms | 498.143 ms | Unresolved |
| Warm point total CPU, 2,000 writes | 47.609 ms | 46.686 ms | Unresolved |

Each arm's sample range and the A/A results are in `runs/summary.json`. The decision rule requires nonoverlap and a median change larger than the largest observed range. No timings support promotion. The prototype does not address the broader ordinary topology path.

## Replay

The [evidence archive](evidence.tar.gz) includes the exact runtime inputs, build, focused checks, both reentry results, counters, and all 36 raw samples. Verify with `shasum -a 256 -c evidence.sha256`. The generating commands are `python3 compare.py /absolute/path/to/node`, `node public-reentry.mjs /absolute/path/to/dist`, and `node replay/counter-child.mjs arm /absolute/path/to/dist/index.js`. Replaying needs the pinned workspace dependency tree available from the extracted directory.
