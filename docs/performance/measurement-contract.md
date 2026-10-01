# Measurement contract

Use the generator for the question being asked, on identified built/installed
artifacts. Report source claim, artifact hashes, environment, workload and raw
results. A build receipt and a source-commit sidecar are different evidence.

- Give competing arms the same observable task and meaningful success checks.
  Validate intermediate results when timing intermediate operations. Endpoint
  agreement does not certify every timed write.
- Name what is timed: primitive execution, framework stabilization, rendering,
  transfer or application startup. Those costs are not interchangeable.
- Compare repeated independent samples and distributions. Use same-arm controls
  to assess noise; do not choose favorable retries or call an A/A band a confidence
  interval. Record first failures and diagnose changes.
- Isolate arms to avoid shared runtime history. A browser context is not proof of
  a fresh renderer process. Describe the isolation actually established.
- Distinguish whole heap, filtered snapshot self-size, retained/dominator memory,
  per-size slopes and positive-only attribution. Do not add incompatible metrics.
- Destroy bounded-lifetime stores. Finite cleanup/GC samples do not prove no leaks
  or bounded growth for every long-lived workload.
- State host contention and throttle settings. Busy runs are development evidence;
  a CDP throttle factor is not a calibrated device class.
- Consumer bundle fixtures must verify behavior and use the intended production
  defines. State which peers are external. A facade fixture differs from a neutral
  kernel budget fixture; simple handwritten undo is not semantic equivalence to
  the full restoration contract.
- Do not raise a ceiling merely because it fails. Attribute cost, test safe
  reductions, and justify any budget change independently.

Executable authorities: `tools/check-bundle-budget.mjs`, the current gate registry
and each benchmark's own protocol. Historical findings remain in the
[design-thesis record](../architecture/design-thesis-and-benchmarking-rules.md);
its old API names, numbers and proposed remedies are not current instructions.
