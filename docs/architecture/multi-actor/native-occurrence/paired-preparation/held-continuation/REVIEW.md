# Held selected continuation — narrow empirical discriminator

**Measured on frozen c47b:** retaining only the saved selected proceed after successful rollback, interceptor detachment and tree.destroy keeps the tree facade, field callable, field publication binding, native publication source and original ordinary requirement reachable in this harness. The row callable and transaction handle collect even while proceed is held. Dropping proceed then allows every sampled library target to collect. The callback still refuses stale execution. This qualifies receiver-retention claims; it does not overturn the no-stale-installation result or establish a permanent/unbounded leak.

## Identity and ownership

Source manifest c47b821c5a805f5b37d6c0f5707098d9871fdf2575d22dcc3e12f4a4c93c81db,2934 files. Original frozen source and all manifest files in the separate /private/tmp/st-held-continuation-review/candidate verified unchanged. Only isolated probe/config/Nx project files were added. Node24.15.0; dependency and probe hashes in IDENTITY.json. No runtime edits, receiver weakening, patched GC hooks, or timing comparison.

The sampled publication binding is getEntityPublicationBinding(leaf), and nativePublicationSource is binding.source. They are real kernel experimental native publication objects. Neither is claimed to be the private writable-location WeakMap binding or an Angular/Vue/Solid native carrier. The tree uses the neutral kernel with transactions(), one row and one field; no batching/framework generalization.

The top-level callback factory captures only a holder box and saves the supplied proceed, then calls it. It does not capture the setup tree/row lexically. Setup completes rollback, confirms x0, detaches the interceptor, destroys the tree, drains notifications, then resolves only the holder and WeakRefs. No target appears in output or assertions. The explicit-row arm deliberately adds a row reference to the holder; other arms do not. Sampled identities include the tree, row, field, publication binding/source, transaction handle and original baseline requirement, not an irrelevant wrapper.

## Results

Values below describe all12 held samples, identical across repeats. “Collected” means WeakRef.deref returned undefined, not inferred from heap size.

| Target | Drop proceed | Hold only proceed | Explicitly hold row, drop proceed |
| --- | --- | --- | --- |
| Tree facade | Collected | Reachable | Reachable |
| Row callable | Collected | Collected | Reachable |
| Field callable | Collected | Reachable | Reachable |
| Field publication binding | Collected | Reachable | Reachable |
| Native publication source | Collected | Reachable | Reachable |
| Transaction handle | Collected | Collected | Collected |
| Original ordinary requirement | Collected | Reachable | Reachable |

After clearing each holder's proceed/receiver and positive sentinel, **every sampled target collected in every arm**, at every recorded release sample. Holding the callback after destroy therefore retained a receiver/source subgraph in these executions, not the entire original row/transaction graph. The baseline requirement remaining reachable does not prove invocation.request retained the selected certificate: the retained native source itself owns ordinary support. No payload-byte or complete obligation accounting is inferred.

Dropped plain-object sentinel collected; explicitly held positive sentinel survived held phase and collected after release. Explicitly held row survived as expected. Both held-proceed raw runs and the Nx matched run rejected callback invocation with `Error: Selected continuation cannot replay` after held sampling. No library target was dereferenced to exercise the callback.

## Method and commands

Existing tools/lib/heap-quiescence.mjs collect() supplies four forced collections. Before EVERY sampling round the probe crosses a real setTimeout task boundary; it then collects and records only booleans. This avoids keeping WeakRef targets alive through same-job repeated dereference. Twelve rounds per phase, no adaptive target-specific stopping and no retained-byte numbers. GC availability is asserted, never skipped. PREREGISTERED.md and probe.spec.ts preserve the setup and expectations.

Initial raw experiment: two fresh processes per arm (6 total), each `NODE_OPTIONS=--expose-gc corepack pnpm exec vitest run --root packages/kernel --config retention-probe.config.ts`, with ST_GC_ARM/ST_GC_OUTPUT set by run.py. All6 completed with valid controls. These remain explicitly raw direct-run evidence, not canonical Nx package validation. The repository has an existing retention-gc direct runner, but the requested matched Nx validation was also performed.

First canonical attempt: `corepack pnpm nx test kernel --skip-nx-cache --config retention-probe.config.ts` with NODE_OPTIONS=--expose-gc. It FAILED BEFORE executing the probe: run-core-vitest supplies vitest.config.ts and Vitest4.1.9 rejects a second config argument. nx-drop-proceed.log and NX-RUNS.json preserve this first failure; no retention result is attributed to it.

Authorized ephemeral target: added only candidate/tools/held-continuation-probe/project.json, saved as ephemeral-project.json. Its nx:run-commands retention target invokes the same probe/config with one config option. Matched drop and held runs used:
`NODE_OPTIONS=--expose-gc NX_DAEMON=false NX_ISOLATE_PLUGINS=false corepack pnpm nx run held-continuation-probe:retention --skip-nx-cache`

Both Nx runs PASS and reproduce every drop/held observation above, including collection after release. Commands, exits and outputs in NX-TARGET-RUNS.json, nx-target-drop-proceed.{log,json}, nx-target-hold-proceed.{log,json}. Explicit-row controls were not independently repeated through Nx; they remain the two raw-process controls. No original/frozen project or Vitest config was changed. No source/type/full suite gate is claimed.

## Source interpretation and limits

The measured pattern is consistent with selectedProceed retaining next (selected-write-operation.ts31–33), then the projection writer/source graph, after invocation.request is cleared. The source trace from the prior review identifies that path; this probe demonstrates a matched ownership difference, not an exact heap retaining-path trace or proof that no other path contributes.

The comment claiming no separate target reference must remain a statement about direct invocation payload storage, not transitive receiver reclamation. On this exact fixture, callback-only ownership retains live objects after destroy and release removes that retention. A permanent leak claim would be wrong: all sampled objects collect once the holder edge is removed. No universal claim follows for all fields, adapters, engines, application-owned interceptors or arbitrary numbers of continuations. No architectural correction/owner policy inferred, no native repair.

This is a trustworthy finite discriminator because setup exits, plain-object controls work, the drop arm collects, the held arm differs in fresh processes and through Nx, explicit receiver holding is separated, and release followup collects. Objects remaining reachable during a bounded phase are observations under this runtime, not a guarantee about future GC. Collection of these objects does not certify all internal state was reclaimed; only the named identities were sampled. The existing bounded correctness disposition stays no stale installation, with measured callback-held receiver/source retention explicitly qualified.

All first logs, original raw experiments, failed Nx invocation and successful isolated Nx pair are archived. SUMMARY.json contains per-arm endpoint matrices and stability checks; original JSON files contain every sample. Frozen c47b unchanged.
