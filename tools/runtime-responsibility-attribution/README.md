# Runtime responsibility attribution — diagnostic experiment

The measured v16 candidate at `3eabc01dd` (runtime `fe18a8e1c`) remains frozen.
This directory preserves one finite experiment; none of these patches is adopted
runtime code, a new API, or permission to activate/publish the candidate.

`diagnostic-runtime.patch` plus `runtime-attribution-probe.ts.fixture` mark phases
and count scalar calls/copies. Copy the probe to kernel/src/lib/internals and the
attribution spec fixture to kernel/src/lib before a focused Nx invocation.
`ATTRIBUTION_OUTPUT` must point at an output JSON file. The tracing test allows
30 seconds because synchronous stack collection exceeded the ordinary5s limit;
its durations must never be used as cost measurements. The counter's interval,
nested charging behavior and original bound are unchanged. Instrumentation is
not included in cost artifacts.

`singleton-reader.spec.fixture` was independently authored and then executed by
the main agent: reuse off/on × paired singleton/missing pair/repeated edit. It
checks saved readers across installation, refused preparation and later writes.
It runs with the diagnostic patch/probe. `late-history.spec.fixture` is public API
only and can run with an uninstrumented baseline or prototype. Copy fixtures to
kernel/src/lib and invoke `pnpm nx test kernel --skip-nx-cache --maxWorkers=1
--testFile=src/lib/<copied-file>.spec.ts` with Node24.15.0/pnpm10.17.0.
Remove copied fixtures/probes afterward; use a disposable checkout.

`singleton-image-reuse.patch` is the sole uninstrumented prototype. It reuses an
already detached physical snapshot only for a singleton admitted ordinary edit.
It preserves a new copy for missing pairs and multi-edit sequences. Its observed
count is12,600 versus13,000, so the original `<2000` requirement still fails.
The late-history ablation intentionally skips earlier native preparation; it is
a negative control, not a proposed optimization. It permits premature delivery
before foreign confirmation/rollback and demonstrates why the responsibility
cannot simply be omitted when no consumer is enrolled yet.

A retained internal source reports its row maps after destroy because the source
is deliberately still reachable. This is population evidence, not a WeakRef tree
collection oracle or a demonstrated leak. Measured whole-process heap deltas and
finite WeakRef checks are separately reported in the audit packet.
