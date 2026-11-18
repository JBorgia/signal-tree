# V16 startup attribution

This is a new diagnostic harness; it does not change prior measured tools or
evidence. `prepare.mjs <five-package-root> <fresh-output>` bundles actual kernel
and Angular package entrypoints with production defines. Every bundled input
and output is hashed. The bundle retains names for profiling and is not a bundle
size fixture. `child.mjs <packet-directory> <kernel|angular> <rows> <fresh-result>
[timing|profile]` runs one isolated Node process against that bundle.

The workload matches the common dispatch application's eight-field rows,
accepted EntityMap/capacity tree and transaction-enabled proposal tree. It
separates seed, accepted construction, population, proposal construction,
first collection read, first point update, late Link activation, post-Link
update, and destruction. Endpoint/count checks precede first-all timing; every
row is checked after the first collection read. Actual delivered payload length
and changed first row are checked after late activation. Both trees and the
Link are destroyed.

`profile` records 100 microsecond inspector samples separately per phase.
`summarize-profile.mjs <profile> <fresh-summary>` preserves raw frame identities,
self weights, inclusive weights and the profile hash. Inclusive weights
overlap and must not be added. Sample intervals include GC and inspector
protocol overhead; they are candidate attribution, not precise function CPU
cost. These Node phases are not browser factory or application startup timing.
The asynchronous phase driver also yields between phases; unlike the common
application factory, it does not construct both trees and populate in one
synchronous call. Phase totals must not be presented as that factory's time.
Source seals/build receipts are separate from these bundle hashes. Comparative
claims require repeated uninstrumented processes and same-arm controls.

The first candidate specializes only fresh entity placement with equal physical
and ordinary membership. It preserves row cloning, source facts, publication
packets, responsibility, queued notifications and late activation. Tests cover
the negative guard cases. No capability or public export is added.

Rejected shortcuts: skipping queued notifications because no observer currently
exists would lose late observers and enqueue evidence; replacing generic
cloning with a plain-object probe introduces additional proxy/getter
observations. Neither follows from the measured cost.

The prepend falsifier exposed an existing publication defect independently of
the specialization. A source with unique rows `a,b`, an existing collection
Link, and `prependMany([x,y])` physically reads `x,y,a,b`; the original recipient
read `y,a,b,x`. `falsify-prepend.mjs <bundle> <fresh-result> no unique ordinary`
exercises that minimum; the final argument `transaction` tests confirmation
without any prior rollback. The correction resolves final adjacency within the
recipient's private structural draft, across nonstructural edits, with explicit
remove/rekey boundaries. It retains ordinary payload and evidence chronology.
The comparison keeps original, correction-only and corrected-specialized
packages separate. It does not attribute the correctness fix to faster startup.

An additional test initially assumed direct mutation of retained caller input
could never change a nested Link seed object. The unchanged original package
also violates that stronger assumption, and it is not the documented contract.
The failed oracle and original-package probe remain in the experiment evidence.
The supported regression checks that later SignalTree nested writes preserve
already delivered payloads; the specialization retains the existing deep clone.

The separate allocation candidate leaves zero structural revision implicit
(`subjectRevision` already defaults to zero) and registers dormant observation
with a null sentinel until its first claim. Explicit reused-subject reset,
nonzero revisions, owned position identity, inherited branch observation and
release/rearm behavior remain covered. `activation-heap.mjs` compares the
corrected-specialized pre-port package with this additional allocation variant:
64 trees with 128 ordinary leaves each, sparse and dense live Links, disposal
and rearm, and 10,000 entities through actual pending/confirmed/rolled-back
transactions and retirement. Positive and fault controls must pass before the
27-child heap cohort is interpreted. Heap checkpoints include the first-claim
cost, use four GC requests separated by event-loop jobs and retain same-arm
controls; they are whole-process measurements, not CPU or dominator claims.

`build-packages.py build <workspace> <fresh-output>` records all package sources,
consumed shared build inputs including `llms.txt`, any declared Nx
`packageBuildGlobals`, the pinned toolchain, source snapshots and a source seal.
It removes only that workspace's output and runs uncached serial canonical
builds for all five packages. A successful receipt requires unchanged source;
final package qualification remains separate. `snapshot` performs no build.
