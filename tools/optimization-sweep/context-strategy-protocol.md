# Private context retrieval strategy

This is an application strategy experiment, not a runtime optimization or a new
SignalTree API. Preserve the original six-arm packet, original generators and
`lab.row`. The prepared v15 runtime remains untouched. This protocol is registered
before building or executing the new fixture; no result is implied by source
preparation.

## Fixed inputs and application variants

`context-strategy-config.json` pins the prior application plan/build/conformance,
all installed kernel and Angular file payloads for v15.4.9 and C1 v16, their exact
artifact identity records, and the toolchain manifest/lock. The v16 Angular facade
has its own unchanged-artifact identity; it is not relabelled as rebuilt C1 source.
The configuration also freezes the actual Node executable bytes/version, complete
installed Playwright/playwright-core packages and optional fsevents, and all files
in the selected Chromium headless-shell distribution. Package resolution must
still identify those same roots. The measurement runner explicitly launches that
bound headless executable and requires its expected browser version in every
child. Full execution closure is checked at preparation/build/cohort admission
and after each cohort; Node/headless executable digests are also checked before
each child. The OS release is fixed as environment metadata, not a system-library
supply-chain audit.

`context-strategy-packet.mjs prepare CONFIG NEW_PACKET` copies only the two
SignalTree apps and their frozen packages. It verifies every copied source and
package against the original plan, and the original apps' actual build/served
inputs against their recorded hashes. It retains the original plan as historical
provenance rather than requiring every historical prose reference to be current.
No archived file may replace an executed or compiled dependency. Only the selected
application sources and driver extension change; no install or library rebuild
occurs. The original packet is never edited.

`context-strategy-source.mjs` generates three methods in one fixture:

- `point`: the existing `lab.row(id)` path, including its optimistic projection.
- `bulk`: `asMap()` once, followed by requested-key lookup and unchanged
  `projectJob`. The collection Map is cached by the library until invalidated.
- `ordered`: zip existing `ids()` and `all()` into a temporary key-to-row Map,
  then apply the same requested-key lookup/projection. This retains array caches
  and allocates a temporary lookup per read instead of retaining the asMap cache.

Both bulk methods use storage keys, preserve caller order, duplicate keys and
missing values, and read the current replacement lifetime. The fixture has no
sortComparer or callbacks during these collection reads. Returning `all()` alone
would reorder a requested context when replacement removes/re-adds J-0; deriving
keys from payload IDs would not express the general storage-key contract. No
seed-specific numeric index is substituted for this work.

Only full-context acquisition selects a bulk method. Selected 50-row contexts, rendered
rows, editors and every command/publication path retain the original point path.
All three strategies for a given line use exactly the same served application
bytes; the runner chooses only which method to call. Bulk collection caching is
an explicit CPU/allocation/retained-heap and dependency-width tradeoff, not a
replacement for every granular live reader. Native Link automatic input capture
is not provided by this application helper; no NativeInput/proof cache is added.

## Build and conformance admission

`context-strategy-packet.mjs build PACKET NEW_LOG_DIRECTORY` invokes the unchanged
production Angular builder and existing dispatch checker. It retains each command,
first failure and raw log. It refuses a packet with an existing build or conformance
receipt; repair must preserve that attempt and prepare a fresh packet. All new
build dependencies must be pre-bound live inputs. Installed package inventories
must still equal the frozen configuration, and both compiled SignalTree roots
must belong to their own copied packages. Existing dispatch positive cases and
all ten planted controls must pass for both lines (22 cells).

The method's complete source set and protocol are frozen in the packet. Any later
change requires a fresh version and new admission; edited source cannot inherit
prior controls or calibration.

Run commands only after independent source review and the root's heavy-slot grant:

```
node tools/optimization-sweep/context-strategy-measure.mjs controls PACKET NEW_CONTROLS
node tools/optimization-sweep/context-strategy-measure.mjs calibrate PACKET NEW_CALIBRATION CONTROLS/results.json
node tools/optimization-sweep/context-strategy-measure.mjs compare PACKET NEW_COMPARISON CONTROLS/results.json CALIBRATION/results.json
node tools/optimization-sweep/context-strategy-analyze.mjs PACKET COMPARISON NEW_ANALYSIS
```

Controls: each of two lines and three strategies gets one complete normal case
plus five planted faults (36 fresh browsers). The faults are truncated context,
corrupt content, stale cached context, missing optimistic projection and stale
replacement instance. Each must fail its named oracle; unrelated failures do not
count. Normal cases independently check reordered/duplicate/missing keys, exact
pending operations/requests, every optimistic value, unresolved dismissal,
accept/reject decisions and actual applied effect, immutable held snapshots,
replacement instance, stale editor refusal, settled cleanup, and all three methods
on a held inactive store after actual destruction. Existing dispatch conformance
separately covers publication, reentry and lifetime cleanup.

Calibration: one fresh browser per line/strategy/kind at 1,000 rows (12 children).
Comparison admission runs the complete metric validator over every calibration
child, including startup, all context phases, post-edit evidence, telemetry and
memory checkpoints. A passing metadata label cannot replace any of those fields.
Comparison: 1,000 and 10,000 rows, five independent rotated rounds, three strategies,
two lines and separate timing/memory children (120 main). Two additional same-build
point A/A pairs per line/row-count/kind add 32 children (152 total). Strategy order
rotates by round and line; line order alternates. Five rounds give partial positional
balance. The complete schedule is written before the first browser. Missing,
failed or duplicated children invalidate a cohort; preserve first failures and
never select favorable retries.

## Timing, memory and post-edit work

Each child starts a fresh Chromium process. Initial UI reads 40 rows. The initial
context profile has the existing first 50-row demand plus 20 repeats, then first full
context plus 20 repeats in timing children. Memory children make one selected and
one full read. ID generation remains inside materialization; serialization is a
separate interval. Independent complete expected records and cross-strategy/line
canonical hashes check every context; output size is measured in bytes, not tokens.

A new document/store session in the same browser then runs the post-edit profile.
It warms one selected and one full context, outside reported context timings.
It assigns J-0 to Context Owner, checks the actual pending operation, accepts the
actual command once, verifies decision and applied-effect contents, and dismisses
settled records. Full context is measured once plus 20 repeats. J-0 is then replaced
with a different instance and revisions 40; full context is measured again with
complete expected values. Mutation/stabilization lies outside context timers.
Accepted and replacement stages share the stated post-edit store; they are not
independent store-startup samples. No retained context fixture is left in the timed
page. The source-level held-context oracle runs only in untimed control children.

Memory children collect three times with job boundaries at blank, initial populated,
initial contexts dropped, post-edit populated, warmed, before/after accepted-context
reads, before/after replacement-context reads, and final destruction. Report signed
within-child differences. These are whole app/framework/library finite post-GC
checkpoints, not allocated bytes, a per-library dominator census or proof of
universal leak freedom. Array/Map caches belong in the result, even if they trade
retained capacity for lower CPU or vice versa.

Milliseconds are browser elapsed time, not process CPU. Optional CDP task/script/
layout/style duration deltas span the whole context script including validation;
they overlap and must not be added or relabelled as CPU. A process-CPU or allocation
profile would be a separately registered attribution experiment.

Report median/range over five child values and matched-round differences/ratios.
Per-child repeated p50/p95s are summarized across children, never pooled. Signed
heap deltas have no ratio; zero timing denominators produce missing ratios. A/A is
descriptive noise evidence, not a confidence interval. No competing-library winner,
agent reasoning quality, network latency or durable backend conclusion follows.

## Offline tooling controls

`context-strategy-selftest.mjs NEW_OUTPUT` checks the exact schedule, paired sample
identity, selected50 behavior, context corruption detection, analyzer completeness
and signed/zero-denominator handling with synthetic data. These are helper controls,
not application or runtime conformance and not measured comparison samples.
Additional controls omit calibration startup/context/CDP/heap data while preserving
valid receipt hashes, vary a child browser version, and alter expected executable
and helper digests. They must reject before a comparison is admitted.
