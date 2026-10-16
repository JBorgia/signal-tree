# Frozen semantic comparison

Both arms use the exact baseline frozen oracle and adapter files, verified against their original manifests. Only runtime source selection differs; every loaded source hash is in each raw report. No assertion changed. Candidate source is `/private/tmp/st-sparse-integration-final`; baseline is exact 8d220643.

The normal candidate runner rejects the two bracket-access changes before execution; those guard failures are preserved in guard-*.log. The isolated source-selection runner uses the original baseline oracle in both arms instead of editing manifests or weakening assertions.

| Suite | Baseline H/V/U/N/E | Candidate H/V/U/N/E |
|---|---|---|
|scalar|25/9/1/0/0|30/1/1/1/2|
|structural|135/48/24/0/0|135/8/24/0/40|
|composition|28/10/133/0/0|28/8/133/0/2|
|authority|0/1/10/0/0|0/1/10/0/0|

H held, V violated, U unsupported, N not exercised, E error. Unsupported means this adapter/capability cannot observe or perform the requested case; it is not a successful settlement and is separate from actual runtime exceptions. Reduced violations sometimes became errors, not passes. All runs exit1 because the frozen acceptance cases are not all held.

Transitions and exact assertion actual/expected detail plus errors are in comparison.json. The raw reports preserve all traces. There are no harness hash mismatches and no loaded-source changes during execution.

Replay: `python3 /private/tmp/st-sparse-integration-20261016/semantic-matrices/run.py` after choosing a new output directory (existing files deliberately cannot be overwritten).
