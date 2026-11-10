# v16 retention repair, publication costs and release qualification

November 10, 2026. Runtime checkpoint `5dca0e457a1a348190275c560fc6d93aec88e5e4`
repairs the packed candidate evaluated at `667e4c0923ba379116bdd724dbe80fe541dad14d`.
The exact before artifact remains packed runtime
`b6acda57552affb0fdcbc0b40f1996c4345ed5d8`. Stable v15 is unchanged.

The owner explicitly requested repairs through readiness and instructed that
budgets be weighed against application impact and implementation feasibility.
The [policy registered before repair results](../../../tools/release-readiness/acceptance.json)
retains the original numerical targets and makes lifecycle, semantics and the
original point-work bound binding. It permits an evidenced economic disposition;
it does not turn a missed allocation into a numerical pass. This supersedes the
preceding audit's fixed-allocation rejection for this successor only.

## Repairs and their causes

The dependency finalizer held a Map of dependency nodes. Nodes captured refresh
recipes, and those recipes could capture their owner. The held value therefore
kept the very derived graph awaiting finalization alive. Finalization now retains
only cleanup edges: source Sets containing weak consumer references. A live
consumer still strongly owns its versioned dependency Map. Recompute removes
the old edges and clears both collections together. New regression cases cover
owner-capturing chains, an actual app-shaped store and a live dynamic subscriber
across GC. The original runtime fails two new cases; the repaired retention gate
passes all 13. This fixes observed retention rather than changing a heap budget.

Publication support previously materialized seven counted Maps per slot,
including empty role inventories, and another redundant collection entry Map.
Per-slot contributions now capture immutable nonempty role arrays and numeric
flags. Group summaries retain counted Maps for exact multiplicities. A bounded
512-entry cache shares roleless numeric contributions without retaining owners.
The redundant collection entry inventory and unused proof references are removed.
The new regression checks duplicate owners, all role/flag classes, input mutation,
hidden replacement, restoration and sibling removal with intermediate proofs.

An allocation-only census of the same coordinated workflow observes collection
connection Map allocations falling from 63,048 to 40; total publication setup
falls from 63,177 to 148. This diagnostic identifies eliminated work; it is not a
timing sample or a minimum cost of v16 guarantees. Narrow field connection also
falls from 63 to 49 Maps. No public API, lifetime or publication guarantee changes.

## Matched economics and residual targets

`python3 tools/release-readiness/compare.py /absolute/packet` runs 96 serial fresh
children: two baseline A/A controls and five alternating pairs for eight profiles.
They cover scaled 1,000-row actual job/inventory app bodies, eight ordinary stores
after 9,600 actions, the common coordinated workflow, and 1/2/4/8 coordinated
sessions after ten aging workflows each. Every child binds the exact built files,
helpers and app sources before/after execution. All 96 complete without input
drift. Seven original-baseline collection failures are preserved; the repaired
candidate has no semantic or actual-resource collection failure.

Timing values below are medians of five child p95s, except single first-use
samples. They are not pooled production percentiles. CPU and elapsed time are
separate; directional claims use the registered observed-variability rule.

| Endpoint | Original packed | Repair | Interpretation |
| --- | ---: | ---: | --- |
| Job state first use, 1,000 rows | 29.531 ms | 28.573 ms | Direction unresolved; all five still exceed 25 ms |
| Inventory state first use, 1,000 rows | 26.275 ms | 25.020 ms | Direction unresolved; three exceed 25 ms |
| Job interaction p95 | 0.880 ms | 0.904 ms | Direction unresolved; within 4 ms allocation |
| Inventory interaction p95 | 1.965 ms | 1.917 ms | Direction unresolved; within 4 ms allocation |
| Coordinated start p95 | 14.249 ms | 6.649 ms | Resolved reduction; still above 4 ms |
| Complete coordinated local workflow p95 | 16.169 ms | 7.792 ms | Resolved reduction; within 25 ms |
| Complete workflow synchronous CPU p95 | 43.903 ms | 11.592 ms | Resolved reduction; CPU is not elapsed latency |
| Eight ordinary stores after edits | 27,854,216 B | 27,919,336 B | Small increase; both below 32 MiB |
| Eight coordinated sessions pending | 144,184,360 B | 37,122,032 B | 74.25% reduction; 35.40 MiB still exceeds 32 MiB |
| Same eight sessions settled | 21,657,688 B | 22,669,048 B | Near repaired aged-populated endpoint |

Coordinated start includes connection setup, three optimistic owners, late full
collection enrollment and two edits. It is not established as one recurring UI
action. Every later stage has per-child p95 below 1 ms. The repair preserves the
complete start and workflow timings; splitting labels is not counted as a win.
Warm job/inventory initialization has one child above 25 ms for each profile.
Coordinated first use also remains above 25 ms (median 32.364 ms). These misses
remain visible, and no state-only startup improvement is claimed.

The production-bundled actual React reference app provides application evidence:
five repaired fresh Chromium processes initialize the 1,000-row state in
15.0–15.6 ms and create/lay out its 600 matching DOM rows in 35.0–35.8 ms total.
The original packed app is similar. All observations fit the existing 100 ms
loaded-application readiness envelope, with no resolved comparative startup win.
The timer includes store creation, synchronous React render and forced layout;
it excludes network/module loading and is not navigation time, first paint or INP.
Thirty actual filter transitions per child verify 400/600 rows. Their child p95s
are 16.3–18.4 ms after repair, including the notification task drain and DOM work;
direction is unresolved and this does not establish a 60 Hz guarantee.

Pending heap above imported idle is 6,247,040 / 10,709,152 / 19,582,912 /
37,122,032 bytes at 1/2/4/8 sessions. Pending increments above aged populated
state scale approximately linearly. Eight-session settled state is about 70 KB
above its aged-populated endpoint, and all 24 watched actual resources collect
in every repaired eight-session child. The four/eight-session populated endpoints
increase by about 1.03 MB versus the original; this is not an across-the-board
heap reduction. Whole pending process heap is about 43.8 MiB, not 35.4 MiB.
The chosen 128 MiB app envelope is a planning allocation, not measured browser
headroom. Ten aging cycles plus one pending/settled endpoint do not prove unlimited
history or universal leak freedom.

**Economic disposition:** accept these residual costs for the exercised capacity.
The first-use allocation was provisional; actual framework realization fits its
containing readiness envelope. Recurring state stages fit the interaction target.
Avoidable pending bookkeeping falls substantially and resource collection is now
verified. The remaining 3.40 MiB pending allocation miss is accepted with the
reported scaling, settled working set and capacity limits. Further representation
work could reduce costs, but the evidence does not establish a release blocker
requiring another architecture change. No v15 or application-coordinator speed
parity is claimed. The earlier equivalent-task comparison remains a bounded
comparison, not proof of an unavoidable semantic lower bound.

## Qualification and evidence

Full exact-artifact qualification is in progress. The final receipt will record
the complete registry, mutation restoration, clean rebuild, installed consumers,
production browser scope and unchanged point-work bound before a release-ready
decision is recorded. Package/demo size retains prior explicit owner disposition;
the numerical ceilings remain unchanged.

First failures remain in the packet. The browser measurement's initial filter
assertion exposed its missing external-store notification task drain; the final
interaction helper includes that task before verifying DOM, with the startup
timer unchanged. Lint found unused harness bindings and a const declaration;
original measured helpers are preserved alongside the behavior-neutral cleanup.
The source-control scanner initially classified numbered binary archive parts as
text. Classification now recognizes those parts, with positive/negative tests
that retain rejection of source files with similar names.

Independent premise review preceded repaired result interpretation. Separate
source review found no demonstrated blocker in weak cleanup edges or compact
contributions. Economic review checked the raw cohorts and supported the scoped
disposition while retaining the missed targets, memory increases and timing
limits above. These reviews are source/evidence inspection, not substitute runs.
