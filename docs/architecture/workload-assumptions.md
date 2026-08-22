# Workload assumptions ledger

Assumptions supply the weights in every representation decision. Written down so
they cannot quietly become facts, with an evidence column so their strength is
visible. Anything marked **strategic** is a bet, not a finding.

| #   | assumption                                                                                  | evidence                                                                         | confidence           |
| --- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------- |
| A1  | Point reads are common                                                                      | TruckTrax: 28 `byId(` sites, 25 collections                                      | observed             |
| A2  | Whole-collection projections are common enough to optimize                                  | TruckTrax: 44 `all()` sites, 19 in `computed()`, 4 genuine whole-row projections | observed             |
| A3  | Some collections have reactive fan-out > 1                                                  | TruckTrax: 4–7 whole-collection consumers on several collections                 | observed             |
| A4  | Most mutations affect a small fraction of a collection                                      | `updateOne` dominates the mutation surface; `setAll` is a load path              | observed (weak)      |
| A5  | Collections of 10k–100k are supported                                                       | benchmark range; no application evidence above 10k                               | assumption           |
| A6  | Construction cost may be traded for repeated runtime savings                                | architecture intent; construction is 15 ms vs 0.39 ms per whole read at 10k      | measured + strategic |
| A7  | Permanent per-entity memory needs repeated benefit **or** broader architectural use         | 127 B/entity buys a 1.4–1.9× whole-read improvement and nothing else today       | measured             |
| A8  | Transaction / optimistic / history / sync work should not require replacing the state model | strategic; production reports of optimistic UI costs                             | strategic            |

## Explicitly NOT assumed

```text
the global share of projection-heavy collections
whole reads per minute
realized recomputations per mutation
collection-size distribution across the ecosystem
that TruckTrax generalizes
```

Those need traces. They are **not** v15 release prerequisites.

## Benchmark counts

`tools/bench-workload-classes.mjs` encodes these. They are assumptions, chosen
to be structurally distinct rather than accurate:

| class            |       N | point reads | whole reads | mutations | derived |
| ---------------- | ------: | ----------: | ----------: | --------: | ------: |
| POINT_HEAVY      |  10,000 |     100,000 |          10 |    10,000 |       0 |
| PROJECTION_HEAVY |  10,000 |       1,000 |      20,000 |     2,000 |       0 |
| REACTIVE_FANOUT  |  10,000 |       5,000 |           0 |     2,000 |       5 |
| BULK_LOAD        | 100,000 |       1,000 |          50 |       100 |       0 |
| REALTIME         |  10,000 |      20,000 |       2,000 |    20,000 |       3 |

Operations are **interleaved** in proportion rather than run in phases. This
matters more than the counts: a cached whole read costs ~0.0001 ms, so read count
without interleaving would overstate projection-heavy workloads by orders of
magnitude. What costs is a whole read that a mutation has invalidated — the
realized recomputation, not the read.

## Release rule

> Research may reopen a v15 decision only if it reveals a structural problem
> that would be expensive or impossible to fix after release.

**Must answer before v15** — anything touching representation or semantics:
entityMap retention, whether the projection earns its keep end-to-end, point
mutation staying cheap, pathological fan-out, whether transaction/history/
optimistic requirements need a different mutation representation, add/remove/
rekey correctness, and whether the public API locks in something already
believed wrong.

**Can answer after v15** — the ecosystem distribution questions listed above.

## Measurement caveat

Whole-workload timings move ~3–5% run to run at these sizes even at median of 3.
A delta under ~5% is not a result. Deltas of 8–11% reproduce; deltas of 2–3% do
not.
