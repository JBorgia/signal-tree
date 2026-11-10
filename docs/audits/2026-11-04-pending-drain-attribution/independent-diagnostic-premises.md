# V16-PENDING-DRAIN-ATTRIBUTION-0 — independent diagnostic premises

Disposition: bounded diagnostic admission is reasonable with the safeguards below. The measurements can discriminate workload scaling, selected reachable structures, sampled allocation sites and scheduled/executed boundary activity. They cannot, by themselves, establish dominant retained bytes per semantic owner, explain all drain CPU, diagnose a universal leak or promote candidate C.

Read-only review: no tests, snapshots, profilers, calibration jobs or performance workloads executed; no repository files changed. Only this requested review artifact is written. Inspected current C controller/design/report and the preserved cost child/quiescence harness, not other review verdicts.

## Frozen premises

Verbatim from C's `docs/audits/2026-11-04-fast-point-dual-map-runtime/DESIGN.md`, retained at `9aa20563b`:

> Unknown attribution remains unknown; write ownership is not proof of input independence.

> Destination settlement ownership, known input dependencies, fixed possible-owner holds, shared validation and recipient uncertainty remain separate roles even when owner identities coincide.

> These are semantic requirements, not a selection of persistent roots, global replay, whole-store copies or a new ownership engine. Existing approved semantics and B's closure remain in force.

The existing pending child holds10 trees of1000 rows, primes row reads0–9, authors10 transactions PER TREE on distinct row values, rolls back the handles, releases their arrays, then destroys/releases the trees. Every checkpoint uses the same shared64KiB/three-stable/forty-turn helper. This is100 owners total at the live checkpoint. The point drain timing child is a different workload:2200 writes including warmup to one warm row, followed by two setImmediate boundaries. These workloads must not be silently treated as the same ownership experiment.

## 1. Define the scaling question before launch

- State that0/1/10/32 is owners per tree if that is intended: with10 trees the corresponding totals are0/10/100/320. Verify actual native pending counts, edited row identities, values, completed rollback state and unchanged rows; configuration labels are not proof the owners exist.
- Increasing owners on distinct rows also increases touched facts, ownership handles, transaction journal records and potentially realized readers. That is scaling of the specified pending workload, not isolated bytes per owner or proof that an owner registry causes the entire slope. Record the touched-row/field count and handle count in each cell.
- Use identical priming across owner-count cells, or name priming as another changed factor. Priming32 rows for every arm improves within-grid comparability but makes the10-owner diagnostic a different priming workload from the old ten-row cost child. Keeping the old priming only for10 and expanding it for32 confounds owner scaling with observation realization. Either choice needs an explicit limit; neither justifies pooling with the old cohort.
- Keep transactions enhancement, tree shape, construction, row population and reads identical for zero-owner controls. Run the same checkpoint/turn/GC logic even when settle has no handles; do not omit the live/settled drains or replace an enhanced zero-owner fixture with an unenhanced populated fixture.
- Distinguish process-before-construction, enhanced idle primed, pending live, settled and destroyed baselines. `live-minus-idle` answers a different question from absolute live heap and from `settled-minus-baseline`. No dimension compensates for another.
- Precommit fresh-child schedule, A/A controls or replication count, cell stop policy, missing-data treatment and no favorable retries. Old48-child acceptance records remain immutable; this is a new diagnostic cohort, not a replacement/retry of them.

## 2. Quiescence and checkpoints

The64KiB/three-stable/forty-turn rule must remain identical for A/C and every owner count. Record every round's heap/turn count and checkpoint assertions; retain nonconvergence as unresolved. Do not tune epsilon, rounds or collection counts to obtain stable curves.

The helper's heap stability is an operational convergence criterion, not a proof that every scheduled consequence ran. Quiet heap can coexist with a deferred timer, an unresolved owner or a retained asynchronous callback. Trace logical queue completion separately where supported; do not redefine the checkpoint through a smaller fixed sleep. Preserve the helper's real task turns and four-GC collection sequence rather than substituting Promise.resolve microtasks.

Strong-root hygiene is essential: author/settle/destroy helpers should return before the measured checkpoint. Clear owners arrays and held tree arrays at the specified frontiers; avoid a last-owner/tree local in an active async frame, a closure or an output record. Preserve intentionally held roots at primed/live/settled rather than accidentally optimizing them away. WeakRef checks need their own event-loop boundary and must not dereference a sampled object immediately before the GC intended to collect it; dereferencing itself can extend current-job liveness. Check actual trees/resources, not only disposable wrapper arrays.

The0-owner settled/destroyed checkpoints still require the same scope cleanup and protocol. A zero-owner endpoint that skips author work may be a useful idle reference, but it cannot quantify the allocation cost of an equivalent number of ordinary writes unless that distinct workload is explicitly supplied.

## 3. Snapshot attribution is conditional graph evidence

One fresh child/one checkpoint/one snapshot is a good way to avoid prior snapshots perturbing later checkpoints. It does not make the snapshot a passive copy of the prior process.memoryUsage reading. Record memory/GC/checkpoint state immediately before capture and identify the Node/V8 capture mechanism and its own behavior. Capture may change the reached heap; conclusions are about the captured graph after that mechanism. Avoid comparing snapshot self-size directly with an earlier whole-process heap delta as though the metrics were identical.

Parse actual snapshot metadata/schema; validate node and edge fields, typed array offsets, counts and file completeness. Stable node IDs only have identity meaning inside the snapshot/version semantics being used; do not assume independently created children share object identities. Snapshot parsing/analysis should run after the capture child exits and outside other measurement children.

Weak/ephemeron handling is a decisive safeguard. WeakMap keys are not ordinary roots, and a live WeakMap value's retention can depend on both its table and a live key. Merely deleting every weak edge and treating every remaining internal edge as an unconditional strong edge is not a generally justified retained-size algorithm. If the parser cannot validate the relevant ephemeron rules, report visible node/edge counts and candidate paths with limits; do not claim exact dominators/retained bytes for those structures. A WeakMap token may remain while its row Map key is strongly reachable even after its original retirement plan is dropped. Conversely, a weak cache entry is not automatically a leak just because it appears in a graph.

Classify roots separately: fixture `held`/owner-handle roots, runtime global registries, active stacks/async frames, queued callbacks, diagnostic/profiler roots and synthetic calibration roots. A path from a fixture owner to a requirement does not prove the runtime alone retains it. A path from several owners/rows to a shared requirement/window does not yield additive per-owner bytes. Report overlap/shared nodes and unique unions where making counts; summing each category's reachable subgraph double-counts aliases. Self-size sums over disjoint node sets are different from dominator retained size and from reachable closure size.

Use exact native role/cell/lifetime distinctions where the graph can support them. Similar object shapes or names are candidate categories, not proof a node is destination/input/validation/possible evidence. No owner-array collapse or current-pending reinterpretation is permitted in the diagnostic to simplify graph labeling.

Minimal credential-free environment is appropriate: explicit required PATH/HOME/temp/locale settings, no inherited tokens/session secrets, no credentials embedded in argv/output paths. Runtime data itself must be synthetic. Heap captures can contain all child inputs/paths/modules; do not upload them merely because environment keys were scrubbed.

## 4. Allocation sampling is a separate question

Use separate children from scalar heap, snapshots and boundary traces. Record sampler interval, flags, actual support in pinned Node/V8, stack depth and whether collected allocations are included or only surviving samples remain. Sampled bytes/counts are statistical attribution, not a complete allocation census or retained/dominator size. Small allocations and short-lived wrappers may be underrepresented; absence of a sampled site is not absence of work.

Do not derive CPU significance from allocated bytes or promote C from a lower sampled stack. Keep exact workload/phase scope, raw profile and calibration outcome. Sampler setup/teardown must not be included in a supposedly uninstrumented timing endpoint. A sampled-allocation result and the existing synchronous/drain CPU results remain distinct observations.

## 5. Boundary traces and event-loop/GC interpretation

Instrumentation belongs only in byte-identified copies of built JS artifacts, with both original and patched hashes, exact injection sites and a restoration/input manifest. The frozen A/C source and measured package directories remain untouched. A copied diagnostic build is another artifact identity, not a new result for the old cost cohort.

Keep scheduled, executed, cancelled, coalesced and still-pending counts distinct. One scheduled owner wake may fan out, deduplicate or trigger a later queue; scheduled-minus-executed is not automatically retained callback count. Define logical phases (author, first task boundary, later drain turns, settle, destroy) and observation windows. Do not infer a phase from timestamps alone.

Tracing storage must avoid retaining owners, maps, transaction handles, callbacks or arguments. Record scalar IDs/counts/phase strings; do not keep an ID-to-object map or saved callback/stack closures in the trace. Any wrapper can alter function identity, receiver/error behavior, scheduling and allocations; preserve those contracts and run the specified semantic witness. Instrument both arms identically where the source site exists and identify unmatched sites rather than forcing an artificial correspondence.

GC records, event-loop-turn markers and synchronous/drain wall/CPU are separate streams. Temporal overlap does not assign all a GC pause to the immediately preceding callback or demonstrate that GC caused the old drain regression. A task marker bounds a window, not an exclusive accounting region. Profiler/trace observers and logging also schedule/allocate; retain an uninstrumented diagnostic control and state those limits. Do not convert the sum of recorded callback durations into full process CPU or treat absent events as proof of no deferred work.

## 6. Calibrate before library diagnostics

Use a tiny synthetic graph with known strong aliases, a separate independent root, a WeakMap key/value relationship, an intentionally retained object and a released object observed after the required task/GC boundary. The parser must distinguish unique self-size categories, alias overlap and intentionally retained roots. Require exact identity/count/edge facts where the format supports them; do not invent an exact V8 byte budget from one run. Include an intentionally wrong alias/root classification as a negative calibration if the reported conclusion depends on that classification.

Allocation calibration should allocate known counted classes/sites and separate retained from released examples under its chosen sampling flags; require that disabling/omitting the relevant recording makes its positive check fail. Do not require every tiny synthetic allocation to appear at a probabilistic interval.

Queue calibration should schedule and execute a known finite microtask/task chain, include a deduplicated/coalesced path if the parser reports it, and detect a deliberately missing recording/phase. Known-bad controls test the probe, not a runtime optimization. Preserve first calibration failures and stop affected diagnostics rather than weakening the oracle or launching expensive library captures with an untrusted parser.

## 7. Finite interpretation and authority

Carry the existing4GiB aggregate-owned RSS,25% host floor, PID/birth cleanup and bounded time/disk policies into snapshot/sampling children; capture can use much more memory/disk than the scalar heap child. Pre-register snapshot file cap, partial-file handling and timeout behavior. No watchdog failure becomes a library heap claim. Keep one heavy slot, no overlapping capture/profile/scalar child and no calibrated-exclusive-core claim.

Successful diagnostic completion permits narrow statements such as: at this captured checkpoint C has more nodes in a validated category; a specified path reaches those nodes; sampled allocations concentrate at this source stack; a copied-artifact boundary executes more queued callbacks. It does not establish all pending overhead's cause, universal leak freedom, an unavoidable semantic cost, or release acceptance. Keep A=frozen fe18 and C=9aa identities explicit, all old cohorts separate, HOLD unchanged, and no automatic optimization queue.
