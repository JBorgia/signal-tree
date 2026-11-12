# Pending lifetime cost through settlement

Registered before the integrated retention-repair cohort, November 11, 2026.
Extend the preserved `egress-pending-memory.mjs` experiment with a distinct
generator, `pending-lifetime-costs.mjs`. Earlier measurements keep their exact
original generator and remain separate evidence.

Use the frozen installed v16 baseline and the integrated egress/reclamation
candidate. Build production bundles from identified package archives. For each
1,000/10,000-row size and confirm/rollback outcome, run five fresh processes per
arm, alternating arm order: 40 children. The store has transactions enabled and
an active collection Link before population. Rows have eight numeric fields
plus ID. Record source, archive, bundle, schedule and output hashes.

Check all physical values while pending and require zero outbound delivery.
Confirm publishes exactly the full collection; rollback publishes exactly an
empty collection. Every settled endpoint must have zero pending transactions.
The early-send control must fail the existing pending-output assertion.

Record the synchronous transaction-population time, the synchronous settlement
call, and a separate elapsed/CPU interval covering that settlement call through
the existing 160-microtask drain and `connection.settled()`. This last interval
includes deferred reclamation and publication. It excludes forced GC and the
following full-state oracle. Do not add these overlapping intervals together.
Comparing only `rollback()` would omit cleanup the fixed implementation now does.

Keep pending, settled-handle-held, settled-handle-dropped, disposed-Link and
destroyed whole-process heap checkpoints. Three job-separated forced GCs follow
each checkpoint. Input/oracle objects are part of the process. Synchronous heap
samples are only a transient high-water lower bound, not peak allocation. This
screen measures single-population settlement; the separate ten-cycle aging
generator checks retained-tree growth and object collection.

Run serially without other benchmark/build/test work. Preserve host load and all
samples; no discarded warmup or favorable retry. Medians and full paired values
are descriptive diagnostics, not confidence intervals or browser latency claims.

```sh
node tools/application-lab/pending-lifetime-costs.mjs build BASELINE_PACKET NEW_BUNDLES CANDIDATE_PACKET
node tools/application-lab/pending-lifetime-costs.mjs compare NEW_BUNDLES NEW_RESULTS 5
```
