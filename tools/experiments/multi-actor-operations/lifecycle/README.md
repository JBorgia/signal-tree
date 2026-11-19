# Coordinator teardown collectibility

Run from the repository root using Node 24.15.0:

```sh
node --expose-gc tools/experiments/multi-actor-operations/lifecycle/gc.mjs
```

The control retains both a disposed coordinator and an issued review while checking
whether an application dependency captured only by the transport adapter can be
collected. The original source retains it across all 30 GC opportunities; its
source and failing output are preserved in `first-failures/`. Disposal now releases
the adapter after the existing unresolved-operation guard succeeds. The unchanged
control passes; the 27 coordinator/protocol tests pass as well.

This is sampled collectibility, not heap-byte attribution or proof about all GC
schedules. The backend's separate in-memory idempotency records are not measured
or compacted by this check. Disposal still refuses unresolved commands; releasing
responsibility to make memory measurements pass would be incorrect.

For a first-failure replay, copy the directory to a temporary location and replace
its parent `coordinator.mjs` with `first-failures/coordinator.mjs.txt`. Use the same
control and `--expose-gc`; expect nonzero exit. Do not overwrite the working source.
