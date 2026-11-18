# Cross-version transfer assessment

The selected compatible transfers are implemented and locally qualified on v15
`e45fd69616586cae6f7f9e8622c082199d0fded0` and v16
`f8cf26e50193ca8aa5580da15b739129313f256e`. Unmeasured leads remain explicitly
separate. Neither line changes its public contract or adds configuration.

## Transfers already established before this pass

The [November 10 follow-through](../2026-11-10-v15-v16-followthrough/README.md)
backported two concrete retention repairs into stable v15: finalizer cleanup
edges stopped retaining their consumers, and the global entity-registration
callback stopped retaining the first builder's application closures. Both release
lines also acquired entity field carriers on demand. The v15 adaptation preserved
its own update, metadata and settlement paths instead of importing v16's selected
write/publication machinery.

That earlier demand experiment illustrates the right transfer criterion. Sparse
field use saved substantial heap on both lines, while fully materializing every
field cost roughly 1.95% extra heap on v16 and 3.05% on v15 in its specific cohort.
Those historical observations are not fresh measurements of the current candidates
and must not be added to this pass's gains. The useful shared idea is to pay for
field machinery when it is demanded and then measure where the deferred cost lands.

The [previous v15 construction work](../2026-11-17-oversight-followthrough/DECISIONS.md)
also established empty-plan and lazy-container savings. It rejected a particular
method extraction because delivered bytes increased. That result argues for
measuring each proposed split; it does not justify deleting supported APIs.

## Current transfer candidates

| Mechanism | Direction | Source relationship | Required distinction | Current investigation |
| --- | --- | --- | --- | --- |
| Empty plan and empty runtime containers | v15 → v16 | v15 already defers several containers that v16 still creates eagerly | v16 adds witness channels and prepared-construction cancellation; preserve admission and cleanup | Not ported in this selection: small setup target, while the container patch needs separate cancellation/witness adaptation; no measured v16 saving claimed |
| Implicit zero structural revisions | v15 candidate → v16 adaptation | Both accessors default absent revisions to zero; both created explicit zero entries | Preserve reset of an explicitly reused subject ID, nonzero revision checks and retirement mutation sensitivity | Adopted and qualified on both lines, including actual settlement and dense rekey coverage |
| First-claim observation records | v15 candidate → v16 adaptation | Both register dormant ordinary leaves before writers escape | Keep intrinsic interception, weak discoverability, stable claimed identity and disarm/rearm behavior; preserve v16 branch scopes and owned position IDs | Adopted and qualified on both lines; sparse, dense, release and rearm costs remain visible |
| Aligned fresh population preparation | v16-specific | v16 has separate ordinary/physical topology and mutation-frame preparation; v15 has no corresponding replay | Reuse only demonstrably equivalent completed placement; retain detached values and publication facts | Qualified; complete-app startup improves materially at 10,000/50,000 rows; no corresponding v15 replay to remove |
| Stronger refusal/publication containment | v16 → v15 would change semantics | The lines intentionally have different refusal consequences | Stable-v15 compatibility forbids silently changing its publication contract | Keep version-specific; application recovery and backend authorization can be shared independently |
| Final-adjacency Link repair | v16 fix → v15 investigation | v15 already holds unresolved neighbors and settles them; v16 had a different sequential interpretation | Preserve eligible order rather than imposing inspection-only physical order | Eight exact-package v15 witnesses pass across baseline/candidate, neutral/Angular and ordinary/confirmed transaction; no v15 repair needed |
| Placement resolver head/cycle cursors | v16 → v15 investigated | v15 already uses owner-grouped removal runs and dependency queues, without the same repeated fallback search | v15 strict cycle refusal and creation ordering differ from v16’s preserved earliest-input cycle break | No direct backport; v16 correction passes the original work bounds and exact-order comparison |
| Exact-artifact, first-use, retirement and investigator checks | Both directions | Measurement and integration methods can be shared without identical runtime algorithms | Assert each line’s contract explicitly; shared application outcomes do not imply identical guarantees | Reused in this study with version-specific identities |

A failed method-extraction experiment does not prove every future decomposition
is uneconomic. A v16-only optimization also does not imply v15 is missing a useful
feature: the avoided preparation may exist only because v16 provides a different
contract. Measured whole-application effects, new bytes, active cost and retained
heap determine whether an implementation transfer earns its complexity.

## What the new v15 experiment has established

The sparse-revision candidate saves approximately 460 KB per 10,000 populated
rows in the measured cohorts, including actual open/confirm/rollback operations
and retirement. It uses an accessor that already treats missing entries as zero;
explicitly recreating an existing subject still deletes the old revision so it
resets correctly.

First-claim observation allocation saves approximately 840 KB with 64 live
scalar Links across 8,192 ordinary leaves. Once all leaves have their own Link, that
saving is essentially consumed. Disposal and rearming retain identity as required.
The original limited experiment and its adverse CPU results remain preserved;
this is a memory selection, not a general CPU speedup or a zero-residual-heap claim.
V16's equivalent source paths are adapted with its branch scopes and owned
position identities intact and pass their own qualification.

The v16 port's independently reviewed live cohort saves 837,176 bytes with 64
scalar Links. Dense rearming shows an adverse paired median of +270,424 bytes
against a roughly 190 MB process-heap workload; all three differences are positive,
and the observed A/A maximum is 255,552 bytes. Tested trees collect. This is neither
proof of a leak nor grounds to declare the adverse result merely noise.

Demand has two precise meanings here. Observation records are deferred until a
leaf is first claimed for mutation observation; ordinary framework reads do not
mean creating a separate scalar Link. Once claimed, its record/position identity
persists for that source's lifetime even after release. Structural revision entries
are created by operations such as rekeying and lifetime changes; ordinary value
edits and pure reorder do not by themselves populate that map. Fully demanding
structural revisions needs a separate rekey test, not just a large count of value
edits. The completed 10,000-row rekey-and-restore checkpoint consumes the initial
saving on both lines: the final paired medians are −2,392 bytes on v15 (mixed
signs) and +1,600 bytes on v16 (all three positive, within the observed A/A span).
The latter is an adverse observation, not proof of equivalence. V16 directly
observes revisions 0/1/2; v15 proves public effects and relies on source for the
internal revision interpretation.

The complete Angular application independently measures 50,000-row populated
heap reductions of 917,956 bytes on v15 and 982,204 bytes on v16. These are browser
whole-application paired medians, not sums of the Node experiments or exact
per-object sizes. V16 factory time falls by a paired median 37.9 ms at 10,000 rows
and 201.6 ms at 50,000 rows. V15's smaller startup differences do not establish
a universal speedup. See [the application comparison](APPLICATION-COMPARISON.md).

## What should remain version-specific

V16's completed-placement reuse avoids replaying a separate ordinary topology
that v15 does not maintain in the same way. Its pending/publication/refusal
guarantees are also different. Those algorithms cannot be copied into stable v15
and called an optimization without changing the product's contract.

The discovered ordered-Link defect supplies another shared lesson: assert final
eligible order under multiple fresh additions, not just values and membership.
The concrete repair belongs where the final-adjacency interpretation occurs;
v15 needs its own source/counterexample check before any backport is justified.
That check now passes for both v15 artifacts, both carriers and both ordinary and
transaction-confirmed prepends. V15's existing deferred-neighbor mechanism already
handles the case. Copying the v16 fix would therefore be unnecessary.

The older v15 empty-plan/container changes remain a plausible, unmeasured v16
lead. V16 has extra construction-cancellation and detached-member paths, plus
entity/structural witness sets. Copying v15's two-set/container patch would be
incomplete. This selection prioritizes the measured population bottleneck and
the two source-equivalent allocation changes. It does not claim that every
remaining allocation is necessary or that the unported changes are impossible.

Application tests, exact-artifact measurement, durable authorization, command
correlation and gap-aware presentation can be shared as methods and integration
components. A shared application outcome still does not imply that the two
runtimes—or competing libraries—provide identical native guarantees.

## Resolver transfer and a separate unmeasured lead

The v16 full registry exposed a new extra scan in replacement rollback after the
ordered-Link correction. Its selected resolver reduction maintains indexed heads
and stable fallback cursors. It passes 587,500 exact-effect/order comparisons and
the six unchanged rollback work-bound cases. V15 does not use that repeated-search algorithm.
Its `tree-realization-adapter.ts` groups by owner and delegates to
`insertion-order.ts`, whose removal runs and dependency queues follow deliberate
repairs `6b6badc75` and `ca206a08d`. V15's strict contradictory-cycle refusal also
differs from v16's existing cycle-break behavior. Copying the resolver would not
be a compatible generic optimization.

A separate v15 source inspection identifies repeated eligible-key and array
searches when many unique rows are added while a collection Link is already live.
The growing eligible-key scan alone has a triangular comparison count in that
source path. This is an unmeasured bulk-egress lead, not a new benchmark result,
a startup bottleneck in the common app or a promised CPU improvement. The v16
cursor patch does not address it. A future investigation would need useful
public value/order/delivery checks, actual operation counts and inspection,
foreign-owner and held-anchor cases before choosing another representation.
No change to qualified v15 is justified by this transfer review alone.
