# V15 construction cost experiment

Compare exact v15 baseline, empty-planning candidate, and planning plus lazy
containers. This is an implementation experiment, not permission to remove a
public API or to assign whole-process cost to an individual feature.

`prepare CONFIG NEW_PACKET` admits independently built kernel manifests and
immutable source receipts. The configuration supplies `arms` with baseline,
planning and lazy `{manifest, sha256}`, `toolchain` (repository root containing
pinned dependencies), and `angularAdapter` plus its SHA-256. The latter is the
unchanged built Angular observation adapter. Each artifact is bundled with
production defines into neutral and actual Angular-native fixtures, each with a
bare and Link/transactions-loaded version. Factories remain exported; emitted
module checks distinguish loaded from bare. Angular bundles include its runtime
and are not marginal library size. No source-runtime aliases are used.

`run PACKET controls|cpu|heap NEW_OUTPUT` uses fresh serial Node 24.15.0 child
processes. CPU and forced-GC processes are separate. Five matched rounds rotate
and reverse arm order, with an independent baseline A/A child adjacent to each
round's primary baseline (alternating before/after). This supplies five paired
noise observations distributed through each profile/carrier's cohort.
Each child records module import, first factory, remaining factories, first use,
steady writes plus immediate reads/drain, late attachment, held-writer delivery, transaction settlement
and destruction as applicable. Factory timing includes the common shallow clone
of the seed object. Module import remains separate from episode totals. Whole
episode timing includes all state oracles
and the common scheduler drains; stage sums are not called total runtime cost.
CPU is synchronous process user+system accounting, wall time is elapsed time.
Heap children emit no timing stages. Host/load/free memory are recorded per
child; this does not establish exclusive-machine isolation.

Profiles cover many tiny trees, ordinary 8-field trees, 128-field trees, an
actively delivering unrelated Link, late scalar/root Links and configured
transactions. Each timed write is immediately read and the complete value trace
is checked after timing, then released before heap checkpoints. Every tree is
used; all final
fields, held snapshots, outbound payload hashes, confirmed/rolled-back values,
and destruction are asserted. Held writers are acquired before Link attachment
and used after attachment/disposal. Inputs use the same literal seeds and writes
on every arm. Module-ready, constructed, first-used, written, active,
destroyed-but-held and helper-return heap checkpoints distinguish lifetime phases.
Actual tree/snapshot WeakRefs have a positive pin/release control. Normal release
failure remains a failure, not a discarded sample.

Controls omit a constructed tree, omit one useful final write, or drop an actual
delivery recording, or skip the unrelated Link's write; each must fail its named
oracle. A positive counterpart and
pin/release control run on every arm/carrier. All arms must produce identical
semantic oracles. Earlier failures and nonzero children are retained. Existing
output directories are refused, and source/bundle/toolchain hashes bind inputs
before and after the cohort. These controls do not prove equivalence for APIs
outside these workloads; kernel/facade tests remain separate obligations.
