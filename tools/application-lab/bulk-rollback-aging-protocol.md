# Retained-tree bulk rollback aging

Registered November 11, 2026. Explain the empty endpoint after pending bulk
population and rollback without treating one heap checkpoint as a leak.
Use the existing exact pending-memory bundles: the frozen baseline and the final
combined lazy-contributor/address-index candidate from
`st-egress-address-pending-bundles-1`. The inherited arm name `lazy` refers to
that identified final combined candidate; artifact hashes establish identity. This probe does not
change runtime source, reclamation authority or semantics.

On the same tree with transactions and an already-active collection Link, repeat
10 cycles of populating 1,000 rows (8 numeric fields plus ID), verifying pending
physical state and zero outbound delivery, rolling back, dropping the transaction
handle, draining microtasks and Link settlement, then forcing GC across jobs.
Compare reused keys with fresh keys; every cycle creates new entity lifetimes.
Three fresh children per baseline/lazy/key-mode cell, alternating arm order.

Generate input/callback locals inside an async per-cycle helper that fully returns
before settled GC. Only numeric subject IDs and WeakRefs escape. Source-owned
inspection methods count retained lifetime records and retained value backings
for all observed subject IDs; no field handles are requested. The retained numeric
ID list itself grows by 1,000 entries/cycle and is part of whole-process heap.
Counts distinguish an empty visible collection from retained physical resources;
they do not count every publication-support allocation.

Every pending snapshot equals its generated input; pending lifecycle count is
one. After rollback, physical rows and pending count are zero. Every outbound
payload must be an empty array, with no pre-settlement delivery. The first cycle
must actually deliver, preventing a never-connected sink from passing vacuously;
subsequent empty delivery counts are recorded rather than imposing an undocumented
deduplication rule. A planted early-send control must be detected.

After ten cycles, dispose the Link and destroy the tree, then fully return from
the outer async helper before checking collection of sampled tree, Link,
transaction and row payload objects. Two separate controls deliberately pin the
tree; its WeakRef must stay alive until the pin is released, then all sampled
objects must collect within 12 job-separated GC passes. Keep those controls out
of the aging distribution. Finite slopes and collection observations do not prove
unlimited boundedness or universal leak freedom. Preserve first failures.

Report each child's full heap trajectory and source counts, plus median/range
per cycle across the three children. Heap is whole process, not per-feature bytes;
no timing ranking is claimed. Save source/bundle hashes, schedule before execution,
raw child results, invocation receipts and the exact generating command.

```sh
node tools/application-lab/bulk-rollback-aging.mjs control /absolute/pending-bundles /fresh/control
node tools/application-lab/bulk-rollback-aging.mjs compare /absolute/pending-bundles /fresh/cohort
```

## Final integration check

The final cohort repeats the same 14-child schedule and unchanged generator
against the frozen baseline and the integrated candidate containing the
contributor/address indexes plus deferred subject reclamation. The prior source,
protocol, bundles, first control and 14 results remain separate evidence. The
new input packet's `bundles.json` and each bundle/source/plan/archive hash are
bound in the fresh schedule before any child starts; those identities, rather
than the inherited arm label `lazy`, identify the integrated candidate.

The correction predicts zero retained lifetime records, retained value backings
and value-backed candidates at every settled empty checkpoint in the candidate.
All sampled transaction handles and row payloads should collect while that tree
remains alive. The paired baseline is expected to reproduce the original
per-lifetime growth. Inspect all child results against these predictions; the
generator's general `passed` field alone establishes its behavioral/cleanup
oracles, not that the new retention prediction was met. Keep original and final
cohorts separate and report any failed prediction without altering the oracle.

This check retains the original heap-only measurement design. A separate
registered settlement-cost cohort measures elapsed time and CPU through the
post-rollback drain; no timing figures will be inferred from this aging run.
