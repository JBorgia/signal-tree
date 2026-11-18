# Startup, cross-version reuse and market economics

Both selected runtime improvements are retained and locally qualified with
explicit numerical-size dispositions. V15 becomes leaner without changing its
contract. V16 removes substantial redundant startup work and fixes an ordered-Link
defect, while preserving the original point-work tests. It still has materially
higher construction cost than v15. Full native active-work CPU remains mixed and
sometimes adverse; startup improvement is not a universal speedup.

This is an identified candidate comparison, not a claim that these changes are
published on npm. No tag, merge, registry publication or production deployment is
selected. Existing ceilings remain unchanged and failed predicates stay failed.

| Release line | Frozen current runtime | Qualified successor | Branch |
| --- | --- | --- | --- |
| v15 | `4e791f32238fa7bdde480c5408a23dc4a4bca804` | `e45fd69616586cae6f7f9e8622c082199d0fded0` (runtime `90947841d9c29593a2ef9d8ebf22772cabaf5e70`) | `codex/v15-startup-economics` |
| v16 | `5801008ea4ca591b3be483e8bbb0aa02e15f59ed` | `f8cf26e50193ca8aa5580da15b739129313f256e` | `codex/v16-startup-economics` |

This study branches from `1927c8836314feec37ba68313a41a6a33dd6c2a4` on
`codex/startup-market-economics`. Later documentation commits do not relabel
qualified source or earlier experiments.

The [findings and hypotheses register](FINDINGS-AND-HYPOTHESES.md) consolidates
measured results, rejected premises, adverse cases, commercial assumptions and
unmeasured leads with discriminating tests. The [user-experience narrative](USER-EXPERIENCE.md)
explains likely visible behavior, mobile limits, library choice and AI-assisted
adoption. Those interpretations are not new device or human-study measurements.
The register also preserves the dated post-push preview results: v15 Ready,
v16 and the study branch failing their unchanged strict demo size budgets.

The [adoption and positioning follow-up](ADOPTION-AND-POSITIONING.md) evaluates
AI-guidance freshness, TanStack's query capabilities, v15-to-v16 migration,
mixed-major limits, Lite/edition proposals and a richer demo story. It records
source findings and recommendations without selecting new APIs or product tiers.

## What changed and why

Both lines omit stored zero revisions because the accessor already returns zero
for an absent entry; explicit recreation resets any old value. Both defer a
registered ordinary leaf's observation record until its first consuming claim.
Interception still precedes escaped writers and claimed identity survives
release/rearm. These changes remove unused allocation without a new developer
setting. Position IDs were already demand-allocated.

V16 specializes aligned all-fresh population: completed physical placement can
supply equivalent ordinary placement without replaying it and rebuilding a
visibility index. Detached values, facts, validation and continuity remain.
The counterexample investigation also found a baseline ordering defect:
prepending x,y to a,b produced the correct physical order but wrong Link order.
The repair resolves final eligible adjacency without publishing inspection-only
order. Full qualification then caught an extra fallback scan in six existing
rollback work-bound cases. Indexed heads and stable cursors remove that scan;
the old tests and thresholds remain unchanged.

The [candidate ledger](CANDIDATES.md) distinguishes executed findings, invalid
stronger premises, source-only exclusions and unmeasured leads. We did not add a
weaker publication mode. Skipping evidence because no observer exists now would
lose obligations needed by late readers or owners. The [cost map](COST-MAP.md)
separates construction, population, first use, pending work and chosen diagnostics.

## Complete application comparison

The fresh cohort contains 288 independent browser children: 240 main samples and
48 A/A controls across eight implementations, 500/10,000/50,000 rows, timing and
separate forced-GC heap. It uses production Angular 22.0.7, NgRx Signals 22.0.1,
TanStack Angular DB 0.2.12 / DB 0.15.2, Chromium 141.0.7390.37 and Node 24.15.0.
There are 40 visible rows, 180 checked commands and a separate 128-pending workload.
The workload sizes are useful application tiers, not a sampled industry/device
population. No dummy bundle padding, dropped samples or CPU-throttled device
claim is used.

| Line / resident rows | Current factory median ms | Successor factory median ms | Paired factory difference ms | Paired populated app heap difference |
| --- | ---: | ---: | ---: | ---: |
| v15 / 500 | 4.5 | 4.2 | −0.2 | −7,768 B |
| v15 / 10,000 | 11.9 | 11.4 | −0.4 | −230,020 B |
| v15 / 50,000 | 45.5 | 40.8 | −4.0 | −917,956 B |
| v16 / 500 | 17.2 | 13.8 | −3.1 | −68,312 B |
| v16 / 10,000 | 170.9 | 133.0 | −37.9 | −293,036 B |
| v16 / 50,000 | 840.3 | 638.7 | −201.6 | −982,204 B |

Paired differences are medians of differences, not necessarily differences of
medians. V16's larger-store startup gain is supported by every paired sample and
its observed A/A variation; absolute construction remains expensive. V15's small
workloads have noise-scale/mixed timing. Sparse memory improvement is the principal
v15 selection, not a universal CPU claim.

At 50,000 rows, the selected application comparison is:

| Implementation | Factory ms | Populated app heap MB | Additional pending-128 MB | Settle 128 responses ms | Checked commands/s | Complete-app JS gzip |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Native Angular implementation | 27.9 | 48.626 | 0.521 | 228.7 | 224.3 | 41,969 B |
| NgRx Signals | 22.1 | 21.105 | 0.553 | 1,310.1 | 89.6 | 43,736 B |
| v15 | 40.8 | 26.946 | 1.222 | 230.4 | 210.8 | 101,661 B |
| v16 | 638.7 | 31.338 | 1.562 | 228.8 | 216.0 | 147,481 B |
| TanStack DB | 167.0 | 29.037 | 1.094 | 230.2 | 211.5 | 130,053 B |

These are complete application implementations, not intrinsic universal library
rankings. Heap includes Angular, application and in-memory service state. Native
is not automatically the leanest representation. NgRx is smaller and quicker to
construct here, but its authoritative entity-update implementation copies the
entity map and ID array; the common workflow's settlement cost scales differently.
That mechanism is source-supported, not a quantified CPU attribution.

NgRx's 0.9 ms optimistic user enqueue-to-layout p95 is a narrower result: it ends
before authoritative responses, and the next synthetic human arrives only after
prior settlement. It cannot establish general responsiveness under independent
arrivals, paint latency or INP. The [full application report](APPLICATION-COMPARISON.md)
includes that metric, settlement, all tiers, the second TanStack implementation,
paired ranges and A/A values. No universal long-lived-store crossover is inferred.
The v16 settled-minus-populated heap increment grows about 42–46 KB, although
absolute settled heap remains below its current baseline. At 10,000 rows its
128-response settlement takes a paired median 1.1 ms longer (all five +0.8 to
+5.3 ms); startup gains do not erase these adverse active-work observations.

## Full guarantees and where deferred cost returns

The [native retained-store comparison](NATIVE-COMPARISON.md) separately exercises
actual v16 ownership, active Links, withholding, confirmation/rollback, retirement
and repeated lifetimes: 10 controls, 12 functional children, 32 CPU children and
12 heap children pass. Active CPU is mixed. In particular, 1,000-row rollback
settlement is slower in all three paired rounds, and synchronous 10,000-row
confirmation increases in all three. Substantial A/A variation limits causal
claims; it does not erase adverse observations.

All twelve recorded trees collect after owner return, with positive whole-process
residual differences of roughly 18–71 KB in the four candidate/baseline pairs.
Collection is observed by those heap rows; a separate pin/release control asserts
its detector. Exact retained history can grow across fresh lifetimes even when
retired payloads are reclaimed. No universal zero-residual or history-bound claim.

Isolated Node cohorts save roughly 460 KB per 10,000 sparse-revision rows on both
lines and roughly 840 KB with 64 live scalar Links across 8,192 ordinary leaves.
Fully rekeying every lifetime or claiming every leaf consumes those savings.
V16's dense scalar rearm has a +270,424-byte adverse paired median in an earlier
identified cohort. Final dense-revision demand has +1,600 bytes, all three positive.
Do not dismiss either result as equivalence. Browser whole-app savings have a
different engine, artifact and workload and are not exact per-object byte prices.

Public oversight checks use each version's actual contract, including v15's
explicit limitation witnesses. The installed v16 durable Angular application
separately tests approval concurrency, principal/tenant/destination binding,
session isolation and recovery after an effect-before-receipt failure. Backend
authority supplies durable enforcement; the runtime alone does not authorize
external effects, make model output truthful or supply exactly-once guarantees.
[Verification](VERIFICATION.md) records the exact completed checks and boundaries.
No human comprehension, hosted identity-provider or private Studio readiness is
inferred from automated browser tests.

## What can improve the other version

| Transfer | Result |
| --- | --- |
| V15 implicit-zero revisions → v16 | Adapted, measured and qualified with v16 lifetime/ownership distinctions intact. |
| V15 first-claim observation records → v16 | Adapted and qualified; both retain sparse savings and pay on dense demand. |
| Earlier v16 retention lessons → v15 | Finalizer/registration retention repairs and demand field carriers were already transferred in the prior identified work; do not count those old gains again. |
| V16 placement repair → v15 | Unnecessary: eight exact-package v15 witnesses already pass. |
| V16 population specialization / resolver → v15 | No equivalent replay/search to remove; its ownership and cycle semantics differ. Copying the code would not be a compatible generic optimization. |
| V15 empty-plan/lazy containers → v16 | Plausible but unmeasured; v16 witness/cancellation paths need separate adaptation. Parked lead, not a promised saving. |
| Integration and verification methods | Share exact-artifact checks, useful-work assertions, late-reader/lifetime tests, command correlation and durable backend integration without claiming identical native semantics. |

The [full transfer report](CROSS-VERSION.md) includes rationale, source/history
relationships and the separate unmeasured v15 live-Link bulk-egress lead. No
supported v15 feature needs deletion merely because v16 has a different algorithm.

## Business judgment

V15 is a reasonable choice for new, entity-heavy interactive modules when its
identity, ordered state and chosen coordination features replace application
code you would otherwise maintain. NgRx/native remain good choices for smaller
or simpler state and established applications. Replacing a working store solely
for these improvements is often economically weak.

V16 fits overlapping user/agent changes, approvals, pending work and explicit
publication/recovery behavior. Its higher startup and memory cost should buy
concrete coordination requirements. It is not a general “AI-safe” switch and
should not be selected just because an application calls an LLM.

The conditional model favors vertical B2B software vendors with repeated
operational workflows: dispatch, claims, reconciliation and service exceptions.
Fintech/insurance and administrative healthcare have potential value and higher
integration/privacy burdens; sector profitability alone does not prove fit or
willingness to pay. Count a software vendor's saved engineering once, not again
for every downstream customer.

Public runtime license revenue remains zero. Hypothetical private support/tooling
prices of $29/$199/$1,499 per account-month are modeling inputs, not observed
willingness to pay or selected prices. At the middle tier, existing-runtime Studio
integration yields modeled recurring capacity value after fees of $4,956/year,
but first-year value is −$1,044 after adoption. Full-runtime migration payback is
roughly 40 months for v15 and 48 months for incremental v16 under the base
assumptions; new bounded modules fare better. Zero/low benefit reverses the case.
Capacity value is not payroll cash: the base model assigns zero cash payroll,
risk-prevention and performance savings.

For the assumed predominantly low-price account mix, 10,000 paying accounts yield
$10.68 million ARR and about $1.36 million annual operating surplus after the
separately assumed 10,000-free-organization maintenance burden. Initial acquisition
and onboarding are a separate $9 million; a $425,000 readiness reserve is also
separate. The 100- and 1,000-account base cases lose money, and heavy support/CAC
assumptions make the 10,000-account case negative. A focused higher-price mix can
work at smaller scale only if its value and delivery assumptions hold. These are
conditional scenarios, not an attainable-market or earnings forecast.

[Economics and sources](ECONOMICS.md) records negative cases, price ceilings,
per-action allocations, churn/replacement adoption, joint resource accounting and
industry constraints. Broad adoption makes sense for eligible deployments whose
measured marginal benefit exceeds full cost and whose public maintenance is
funded. Actual buyer willingness to pay, avoided workflow hours, field incidents
and human understanding remain unmeasured. They require real customers, not more
synthetic timing samples.

## Qualification and evidence

V15 covers 90/91 normal gates through the preserved correction and all 91
sensitivity proofs, including 15 indirect companion checks. Five canonical
packages/158 payloads, installed consumers/AOT/facades and the strict demo with
146 browser checks pass. Entity gzip still exceeds unchanged ceilings by 75.2
and 151 bytes while shrinking 24/28 bytes; bare fixtures now pass.

V16 passes 86/87 normal gates and all 87 sensitivity proofs, including 13 indirect
companions. Five packages/193 payloads and installed consumers/AOT/facades pass.
All 137 browser behavior checks pass; strict-demo and one browser-size predicate
remain failed. Entity gzip grows 242/191 bytes; demo main grows 1,401 bytes over
the comparable archived baseline. Each release line has a new specific cost
acceptance, not an inherited blanket waiver or an all-green claim.

The [review record](REVIEW.md), [protocol](PROTOCOL.md), [verification](VERIFICATION.md)
and [portable evidence](EVIDENCE-PARTS.json) retain source identities, exact commands, first failures,
raw observations, controls and limitations. Private Studio source is excluded.
