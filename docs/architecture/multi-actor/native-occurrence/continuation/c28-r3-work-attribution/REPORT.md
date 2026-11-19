# Entity point-work attribution — unchanged failing oracle

Main replay on frozen R3 with a test-only counting observer reproduces 13,000 selected element visits for 200 updates at both 2,000 and 20,000 rows. Both attribution totals exactly equal the unchanged original counts. The absolute <2,000 assertion still fails; its collection-size equality passes. No runtime or budget change, no CPU/allocation claim.

The observer extends the existing counter with a guarded stack-site tally. It disables recursive attribution of its own stack processing and emits after restoring patched methods. Original file, patch, command, raw failure and all input hashes are preserved. All manifested files other than this spec remain identical to R3. Calibration after the original failed assertion remains unexecuted; no pass is claimed for it.

Largest sites per 200 updates: combineTerminalRecords 1,200; AdmissionMetadata.array 800; AdmissionMetadata.edit 600; two deep-equality enumeration sites 400 each; prepareOrdinaryTopology 400; several experimental entity publication preparation/view-copy sites 400 each. Full site distributions are in observations.jsonl. These stacks identify counted work, not causal shares of wall time.

The workload installs neither transactions nor Link. Source inspection shows entity publication's registered native factory still prepares support on the ordinary update path. That does not establish the machinery can simply be disabled: later publication/input acquisition and hidden dependencies may require earlier evidence. A safe fast path or a revised cost disposition requires separate mechanism review and representative measurement. No optimization selected or ceiling waived.

Command: pinned Node24.15.0/pnpm10.17.0, Nx kernel, entity-granular-reactivity.spec.ts filtered to the existing single-entity update case, --skip-nx-cache --maxWorkers=1. Exact invocation/environment in COMMAND.json. Run exit1 is the preserved absolute count assertion, not a passing budget gate.

## Bulk diagnostic and counter correction

A separate four-size public restoration round trip passed at 32/64/128/256 rows. The inherited counter overcharges bounded Array.slice by full receiver length. Preserve those first counts as instrumentation observations, not proof of quadratic physical population. A separate calibrated diagnostic counts slice output length while preserving filter input traversal; its five cases pass. Population/replacement then scale linearly in this sample; undo/redo retain a quadratic term.

Exact baseline counts (initial, replacement, undo, redo):
- 32: 2698, 5483, 14512, 15376
- 64: 5386, 10955, 37168, 38896
- 128: 10762, 21899, 107056, 110512
- 256: 21514, 43787, 345136, 352048

A guarded site observer attributes 4096 and 16384 visits during undo/redo at 32 and 64 rows respectively to publicationMeta's repeated plan.changes.filter. This is a genuine full-input filter, unlike bounded slice. The first site probe mistakenly attributed all work to its own renamed fixture; preserved. Correcting only that exclusion records exact matching totals and sites. The 64-row stack-profiler case exceeds the diagnostic default five-second timeout; raw observations are preserved and are not a green run. Unprofiled calibrated cases pass. No production test timeout or budget was changed.

Diagnostic sources and identities are archived separately; runtime stays exact R3. The observed growth plus repeated-scan source motivates the isolated disposition-index prototype, not a claim of demonstrated large-gate or CPU recovery.
