# v15 retention and field-allocation follow-through

November 10, 2026. Based on published v15.4.4 source
`2bdf2ec54622e41b607242c8345b3389ce4ffb6c`. Retention checkpoint
`713f8a45841f84ca7740afc1515964f367227133` fixes finalizer-held dependency graphs
and first EntityMap builder configuration retention. Field-allocation checkpoint
`ef806bef2a71aa48709c2b4cad5e71d1ee359c2f` adds the bounded lazy-field port.

Execution checkpoint: source controls, focused tests and measurements pass;
full final-artifact qualification is still in progress. This is an unreleased
15.4.4-based review candidate, not a republication of that registry version.

## Correctness and compatibility

The finalizer now holds weak consumer edges instead of dependency nodes whose
recipes can capture their owner. Global EntityMap registration no longer shares
its first builder's lexical scope. Original-source controls demonstrate both
retention causes separately. Live subscribers remain current across forced GC.

Field getters preserve the original keyset, descriptors, identity and captured
entity lifetime. Full projection initialization happens once on first acquisition;
failed initialization can retry. Weak inventory metadata does not create fields
or retain deleted getters. Strong subject epochs and intrinsic mutation
registration remain intact.

The port preserves v15's `entitySig()?.[fieldKey]`, `api.updateOne`, metadata,
`transaction`, and Link/settlement semantics. It does not import v16's selected
write paths, own-property read behavior or field-Link bindings. Eager-source
controls rejected two invalid test assumptions before the fixtures were corrected:
v16 method spelling and direct field Link enrollment. Valid collection-Link
fixtures assert actual post-enrollment writes on both the original and prototype.

Focused prototype validation passes 134 kernel tests, 12 framework tests,
canonical retention GC, `pnpm run typecheck`, the existing spec-type ratchet and
zero-warning changed-file lint. Existing physical-inventory expectation changes
retain all value, revision, lifetime, backing and reclamation assertions.

## Demand-sensitive memory costs

Generator: `tools/release-followthrough/compare-v15-fields.py PACKET demand` on
`codex/v16-followthrough`, with the recorded `field-demand-child.mjs` and shared
quiescence helper. Eight serial children compare retention-fixed v15 against the
lazy-field successor, using exact copied artifacts and checksums. The workload
holds six 512-row stores with 32 fields, performs 36,864 edits, then acquires one
field and every field. All input bindings remain unchanged and all sampled
actual resources collect.

| Live heap above imported baseline | Retention-fixed v15 | Lazy v15 |
| --- | ---: | ---: |
| Handles held | 219.43 MiB | 28.40 MiB |
| After whole-row edits | 224.41 MiB | 33.63 MiB |
| All fields acquired | 271.28 MiB | 279.55 MiB |

Fully materialized rows cost about 3.05% more heap. Construction is deferred until
first access, so this is a saving for unused fields, not free field construction.
The separate three-build ordinary application comparison finds no resolved v15
CPU regression, lower edited heap, and collection failures only in released v15.
Finite workloads and sampled resources are not universal leak or latency proofs.

The [current controller](../../../RELEASE-CURRENT.md) owns qualification and release
status. No merge, tag or registry publication is selected by this review branch.
