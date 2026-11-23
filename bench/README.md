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

**Node scenarios (M1, M2, M3, S7, S8)**
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
- S8 times each operation with the collection at 1,000 and at 100,000 rows of
  20 fields (the S2 rows). Each size runs in its own process, each operation
  on its own tree, and the order of the sizes alternates between runs.
  - Only the operations are timed, in batches; setting up and putting the
    collection back happen between batches. A round is enough batches for
    5 ms of timed work (measured again after warm-up; at most 50 ms of wall
    time), and the result is the median time per operation of 21 rounds after
    5 warm-up rounds.
  - The rounds are interleaved. Every tree and the two reference Maps are
    built first and live until the end. Each measurement is calibrated alone,
    then come 5 warm-up sweeps, a second calibration of each, and 21 measured
    sweeps. A sweep times one round of every measurement in a fixed order
    (Map.set, Map.get, then the operations), starting one measurement later
    each sweep, so none always runs first and a disturbance during a sweep
    reaches the references and the operations alike.
  - Row operations go to 16 rows spread evenly over the collection, the same
    16 at both sizes. A store that walks the rows to reach one walks half of
    them on average, while one that does not keeps those rows in cache at both
    sizes.
  - setAll alternates between two sets of rows with the same ids and different
    values, each handed over as it is. Its cost is the call's time divided by
    the row count, per row written.
  - addOne adds 16 rows with new ids, removed again untimed. Re-adding the same
    ids would grow those keys' chains in a V8 Map until a rehash, which comes
    later the larger the map is.
  - removeOne removes 16 rows spread over the collection, each id once every
    rows ÷ 16 batches, and re-adds them untimed.
  - Transact + rollback opens a transaction that writes one field of one row
    and rolls it back. Undo makes 50 undoable one-row writes untimed (the
    history keeps 100), then times the 50 undos.
  - all() and byId are read repeatedly with nothing written in between. Their
    allocations are counted as M1 counts them, in another process per size.
    Growth is bytes per call at 100,000 rows minus at 1,000: bytes, because a
    copied array is one allocation at any size. The count is exact to about
    one allocation in the counted calls (15.4.9's byId read 0.99999 per call
    once), hence the small allowance in budgets.json.
  - An operation the subject lacks is not measured, and its conditions are
    reported as not applicable; the rest of S8 is judged without them.
  - The bound is relative to a reference measured in every run. Each process
    times Map.set and Map.get, each on its own plain Map holding the same rows
    under their ids, interleaved with the operations and with the same
    calibration, rounds and median. Map.set overwrites existing keys, writing
    another row object on every other visit, so the map never grows and every
    set changes the value.
  - Each reference batch visits 1,000 keys spread over the whole map (batch b
    visits k·stride + b mod stride, with stride = rows ÷ 1,000), so every key
    is visited once every stride batches. At 100,000 rows an entry has left
    the nearest cache by its next visit; at 1,000 the whole map stays there.
    1,000 keys per batch, as for the operations that cost a few nanoseconds:
    in batches of 16, the timer's own cost is about half of a Map.get at
    1,000 rows, which pulls the ratio toward 1.
  - Each S8.<op> passes when its ratio ≤ the factor in `budgets.json` × the
    larger of the two reference ratios, both judged on the medians of the 5
    runs. Each condition's result records the bound and the two reference
    ratios it came from.
  - S8 is gated only on the dedicated gate runner: when `ci/gate-host.mjs
    --pre` passed on the provisioned host (its `/etc/signal-tree/gate-runner`
    marker names the runner) and set `SIGNAL_TREE_GATE_HOST` to this job's
    `RUNNER_NAME`. A self-hosted runner is not enough. Anywhere else, local
    runs and GitHub-hosted runners included, S8 is recorded only: its
    conditions are judged and reported, the summary reads "recorded only: not
    on the gate runner", and neither its verdict nor its regressions change
    the exit status, even with `budgets.json` approved. An S8 that errors still
    fails the run.

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
