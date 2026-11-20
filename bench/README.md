# Scenario harness

Measures the store against the budgets in `budgets.json`. Each scenario runs
in fresh processes (5 runs unless `budgets.json` says otherwise) and is judged
on the median; zero and never budgets must hold in every run.

```sh
pnpm bench M1 S2            # some scenarios; groups: M, S, S4, S6; default all
pnpm bench all --aa         # also measure run-to-run noise (two interleaved sets)
pnpm bench S1 --baseline out/results-v15-shim-latest.json --noise out/aa-v15-shim-latest.json
pnpm bench S5 --s5-full     # the 8-hour soak; --s5-compressed (the default) is the nightly one
pnpm bench:test             # the harness's own tests
```

Results are written to `bench/out/` and never committed.

## Measurement choices

Where the budgets leave a detail open, the harness does the following.

**Node scenarios (M1, M2, M3, S7)**
- Each side of a comparison (the store and a plain Angular signal) runs in
  its own process, and the order alternates between runs. Angular runs in
  production mode.
- Timings are the median of 21 rounds after 5 warm-up rounds.
- M1 writes a leaf two levels deep in a five-leaf tree. Allocations are
  counted with V8's sampling heap profiler, sampling every byte. The counting
  process runs without background recompilation. A self-test runs before
  each count: it must see one allocation per write in a loop that allocates,
  and none in a loop that does not.
- M3 builds from 1,000 branches of 100 numeric leaves and reads 10 leaves
  spread across the state. Heap is read after full garbage collections.
- Plain state and rows are made the way a server payload arrives (parsed from
  JSON). Built by property assignment, the same objects take several times
  more memory, and the amount varies from run to run.
- S7 writes as `user` to a location whose owners alternate between open
  transactions and holders whose merge keeps the incoming value. The tree size
  stays the same while the number of links varies.

**Browser scenarios (S1–S5)**
- Chromium is the build pinned by the Playwright version in the lockfile,
  headless, with the CPU slowed through the DevTools protocol. Chrome applies
  that slowdown by pausing the page's thread; at a rate of 4 we measured
  2.8–3.3× on this hardware.
- The page is cross-origin isolated, so timers have 5 µs resolution rather
  than 100 µs.
- Store time comes from one `signal-tree:turn` measure per turn or batch,
  never per write. In bench builds the store also does its delayed reads
  inside that measure, so work otherwise done later during rendering counts
  as store time.
- A keystroke is measured from the key-down event to the next paint, the same
  way in every run. The browser's own Event Timing figure is reported next to
  it when the browser provides one; it rounds to 8 ms and skips anything under
  16 ms, so it is never used in its place.
- S1: 500 text inputs in 25 sections of 20, each bound to one leaf. Five
  warm-up keystrokes in other fields, then one measured keystroke.
- S2: the table shows the first 1,000 rows, one component per row, with fixed
  column widths. Each server message is its own task, carries 50 row updates,
  and changes 3 fields per row; rows are picked uniformly from the whole
  collection.
  - A long frame counts against the store only when the store's time inside
    it is more than the frame's length minus 50 ms, so the frame would not
    have been long without the store. Frames that merely contain store work
    are reported next to it.
  - Main-thread time is the time the page's thread spent running tasks
    during the minute.
  - Heap overhead is (store heap − plain rows) ÷ plain rows. The page lets go
    of its own copy of the rows before measuring, so a store that keeps the
    rows it was given reads about 0, and one that also keeps a full copy
    reads about 1. It is measured after loading and again after the minute,
    with the table removed; the larger of the two counts.
- S3 replaces 50,000 loaded rows with 50,000 new ones while the table is
  shown. Long tasks are the long animation frames the browser reports. The
  replace starts in a task of the page's own, because the frames do not count
  work in the task Playwright's evaluate runs in as a task (issue #75).
- S4: the agent edits 1,000 fields spread over 200 shown rows, 5 per row. The
  undo history keeps 100 entries. In the typing test the user's field is one
  of the agent's targets; the user types every 100 ms and the agent sends a
  batch every 500 ms.
- S5 drives S2 and S4 traffic. The nightly run goes as fast as the page allows
  until 2 million field writes and samples the heap at every 5% of them; the
  full run uses real time and samples every 5 minutes. The harness empties
  its own buffers as it goes and stops with an error if any of its marks
  remain.

**Comparisons**
- Run-to-run noise is the difference between the medians of two interleaved
  sets of runs on the same code. A median is a regression when it is worse
  than the baseline by more than 3% or that noise, whichever is larger.
- A metric that reads 0 in the noise runs, or whose baseline is 0, is compared
  in its own units instead, against the larger of its noise and a floor set
  in `budgets.json` (for example one frame, or the 5 µs timer step).
- A metric that is missing, or did not produce a value in every required run,
  fails.

Ruleset test line (scratch PR; never merged to main).
