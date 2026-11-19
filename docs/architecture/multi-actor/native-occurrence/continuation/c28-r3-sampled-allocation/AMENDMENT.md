# Authorized diagnostic amendment, recorded before execution

Owner authorizes pinned Inspector depth128 (implementation-fixed, no stackDepth option sent) and Inspector-imposed GC at each profile collection. No manual GC within any operation; no heap-limit override. Both collected-object flags true, samplingInterval32768. Same protocol both arms, N2048 only, original replacement+12-microtask drain/undo/redo windows and original assertions/timeouts. This is allocation-site sampling only, not CPU/peak/retention/OOM evidence. Collection work may be sampled; later-stage heap state is altered by profiling and boundary GC. Original PLAN and preflight contradiction remain preserved verbatim.

The exact tagged V8 protocol and implementation in this packet establish both collection flags, hardcoded128 depth and GetAllocationProfile's forced GC. Require synchronous local Session.post callbacks for actual start/stop commands; fail instead of adding awaits. Perform a standalone empty preflight first. Workload workers check each actual callback synchronously as well.

Source mapping: after original test cleanup, enable Debugger and obtain generated script sources/metadata for sampled candidate-package scripts. No Debugger/source serialization in sampled windows. Preserve raw call frames; unmapped sources remain marked. This post-work mapping does not claim to recover the full allocation universe. Mapping cap32MiB total and2MiB per source; record truncation/absence instead of inventing lines.

Containment unchanged:180s launch/no-progress,360s absolute,512MiB boundary heapUsed,32MiB per profile and100000 samples. No full heap snapshot, no profile repeats, no cardinality hooks, no runtime changes.
