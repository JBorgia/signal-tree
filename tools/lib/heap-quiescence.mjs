/**
 * THE ONE QUIESCENCE PROTOCOL. Every retained-heap measurement in this repo
 * uses this file, with no per-scenario and no per-arm knobs.
 *
 * ## Why this exists
 *
 * `tools/memory-report.mjs` already knew that a synchronous `gc()` cannot
 * reclaim what a turn boundary reclaims — its own header says so, twice, and
 * names the 8x error that taught it. It then applied the turn boundary to
 * exactly ONE of its eight scenarios, via a `yieldBeforeMeasure` flag on the
 * scenario record. The two arms that were supposed to be compared were
 * measured at different points in the reclamation curve, and the table
 * published the difference as if it were a property of the code:
 *
 *   entityMap 10k, no boundary  ......  59.95 MB   <- published as the baseline
 *   entityMap 10k + transient byId(),
 *     WITH boundary  ................   18.03 MB   <- published as the ablation
 *
 * Read as an ablation that says "materialising a node for every row costs
 * NEGATIVE 42 MB", which cannot happen: the transient arm populates the strong
 * `entitySignals` map and so retains strictly MORE. Under one protocol the
 * pair is 12.65 -> 18.01, monotone, and the 42 MB was never there.
 *
 * The same missing boundary made the cross-library table invalid rather than
 * merely wrong. Adding the boundary moves SignalTree by ~54 MB and moves peer arms
 * ngrx-signals and raw-signals by 0.00 MB each — because SignalTree is the only
 * arm with a microtask-deferred notifier, weak caches and a
 * FinalizationRegistry. A protocol that is not neutral across arms is not a
 * comparison. That is why this is a shared module and not a helper copied into
 * three tools: the defect was not the missing 50ms, it was that the settling
 * rule was a per-call decision at all.
 *
 * ## The contract
 *
 * A measurement is taken when the logical operation AND every consequence the
 * library itself scheduled from that operation have settled. Not "after 50ms" —
 * a fixed sleep is another arbitrary point on the curve, and a library that
 * defers more work than the sleep allows would be measured mid-flight while a
 * library that defers none would not. `quiesce()` instead drains turn
 * boundaries until the heap STOPS MOVING, so the endpoint is defined by the
 * subject rather than by the harness, and an arm that needs more rounds simply
 * gets them.
 *
 * Non-convergence THROWS. An unsettled number that looks settled is the entire
 * failure class this file exists to end, so there is no path here that returns
 * one.
 */

const MB = 1024 * 1024;

/** A full mark-sweep, several times: one pass leaves finalisables behind. */
export function collect() {
  if (typeof globalThis.gc !== 'function') {
    throw new Error('collect() requires --expose-gc');
  }
  for (let i = 0; i < 4; i++) globalThis.gc();
}

/**
 * Yield a real turn boundary. `setTimeout` and not `Promise.resolve()`: a
 * microtask recovers ~5 MB of the ~47 MB on the entityMap 10k shape, because
 * WeakRef clearing and FinalizationRegistry callbacks need a task, not a
 * microtask. Measured on that shape: no boundary 59.86 MB, microtask 54.49 MB,
 * task 12.67 MB.
 */
const turn = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Drain turn boundaries until the heap stops moving, then report where it
 * stopped.
 *
 * @param {object}  [opts]
 * @param {number}  [opts.epsilonBytes] movement below this counts as stopped.
 * @param {number}  [opts.stableRounds] consecutive quiet rounds required.
 * @param {number}  [opts.maxRounds]    give up (throw) past this many.
 * @param {string}  [opts.label]        named in the non-convergence error.
 * @returns {Promise<{heapUsed: number, rounds: number}>}
 */
export async function quiesce({
  epsilonBytes = 64 * 1024,
  stableRounds = 3,
  maxRounds = 40,
  label = 'heap',
} = {}) {
  collect();
  let previous = process.memoryUsage().heapUsed;
  let quiet = 0;
  for (let round = 1; round <= maxRounds; round++) {
    await turn();
    collect();
    const current = process.memoryUsage().heapUsed;
    quiet = Math.abs(current - previous) <= epsilonBytes ? quiet + 1 : 0;
    previous = current;
    if (quiet >= stableRounds) return { heapUsed: current, rounds: round };
  }
  throw new Error(
    `${label}: heap never settled — still moving by more than ` +
      `${(epsilonBytes / 1024).toFixed(
        0
      )} KB after ${maxRounds} turn boundaries. ` +
      `Reporting this number would publish allocation as retention, which is the ` +
      `defect tools/lib/heap-quiescence.mjs exists to prevent.`
  );
}

/**
 * Retained bytes for whatever `build` returns, plus whether it is COLLECTABLE
 * once released.
 *
 * BOTH endpoints are quiesced. The `before` reading is the one the old
 * `bench-compare` got wrong in the most expensive way: it took the baseline
 * after five timing iterations and four synchronous `gc()` calls, which left
 * roughly 300 MB of unreclaimed garbage in the reading. Adding a boundary to
 * that flow made the arm report MINUS 294 MB retained — a difference of two
 * contaminated numbers, which is what the 66.12 MB it used to print also was.
 *
 * The collectability check is a WeakRef, never a heap delta. An earlier version
 * reported "reclaimed" as (held − released) and made every entityMap scenario
 * look like a 2.3 MB leak: V8 does not shrink `heapUsed` promptly even once
 * objects are unreachable. A WeakRef that no longer derefs is proof; a heap
 * number that has not come down yet is not evidence of anything.
 *
 * `build` may be async — the cross-library arms need `await import(...)` and an
 * awaited workload before there is anything to hold. Everything it awaits
 * happens INSIDE the measured window, between the two quiescence points, which
 * is what "retained by this scenario" has to mean.
 *
 * @param {() => unknown | Promise<unknown>} build must RESOLVE TO the thing
 *   whose retention is asked about. Resolving to nothing throws rather than
 *   measuring an empty scenario.
 * @param {{label?: string}} [opts]
 */
export async function measureRetained(build, { label = 'scenario' } = {}) {
  const start = await quiesce({ label: `${label} (baseline)` });
  let held = await build();
  if (held === undefined) {
    throw new Error(`${label}: build() returned nothing — nothing to measure`);
  }
  const settled = await quiesce({ label: `${label} (held)` });

  const ref = new WeakRef(
    typeof held === 'object' && held !== null ? held : { held }
  );
  held = null;
  await quiesce({ label: `${label} (released)` });

  return {
    retainedBytes: settled.heapUsed - start.heapUsed,
    retainedMB: (settled.heapUsed - start.heapUsed) / MB,
    quiesceRounds: settled.rounds,
    collectable: ref.deref() === undefined,
  };
}

/** Guard every entry point identically. */
export function requireExposeGc(toolName) {
  if (typeof globalThis.gc !== 'function') {
    console.error(
      `❌ ${toolName} requires --expose-gc.\n` +
        '   Without it these numbers measure allocation, not retention — 8x high\n' +
        '   in the one case this repo has on record, and wrong in the direction\n' +
        '   that invents a memory problem.'
    );
    process.exit(1);
  }
}

export { MB };
