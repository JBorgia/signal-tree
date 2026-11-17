# SignalTree optimization sweep

The selected v16 runtime reduces bulk-publication CPU and accumulated history
memory while preserving the checked coordination guarantees. It does not establish
a broad ordinary-application speedup. Startup remains materially more expensive
than v15 and the tested NgRx/native implementations; smaller rollback and some
edit/capture workloads retain explicit adverse results.

**Decision: retain the selected changes; local release-candidate qualification is
complete with explicit numerical-size exceptions.** Fresh local qualification,
all final workload measurements and independent final reviews are complete.
The portable evidence archive is complete and verifies after extraction. The v16 normal
release run completes 86/87 gates; only the unchanged numerical bundle ceiling
fails. All 87 mutation checks complete with exact source restoration. Five rebuilt
canonical packages, installed consumers, Angular AOT and demo behavior verify.
The separate passing/grown/restored bundle fixture produces exits 0/1/0; this proves
detector discrimination without turning the candidate's size miss into a pass.

This record separates measured improvements, rejected alternatives and remaining
costs. It does not claim that every possible algorithm has been exhausted.

The [coverage ledger](CANDIDATES.md), [integration decisions](INTEGRATION.md) and
[registered protocol](PROTOCOL.md) preserve the investigation and first failures.
The final tables measure v15
`4d1142d6166b2d5b2874715e38097665545864dc` and v16
`7ab6cbcc70bf5abe9c5070e38a51bd0229ed1830`. The
[expanded application metrics](APPLICATION-METRICS.md) include both row counts,
throughput, interaction latency and each heap checkpoint. Neither candidate is a
new publication.
The [v15 review branch](https://github.com/JBorgia/signal-tree/tree/codex/v15-optimization-sweep)
and [v16 review branch](https://github.com/JBorgia/signal-tree/tree/codex/v16-optimization-sweep)
are pushed and their remote heads verified. Their documentation-only heads are
`fc279c279b3f1a9d6a9ac17330f5dcf9d0ccdba4` and
`aed4775434b843294310c227e27dc6134f027fb7`, respectively. Each differs from its
measured runtime commit only in `RELEASE-CURRENT.md`; the measurement identities
above remain unchanged.
The frozen comparison arms retain the prior prepared v15 runtime `0d2b96192`
and v16 C1 runtime `2c439198b`; exact package/source joins are recorded per packet.

## What changed

The v16 candidate removes replacement-only index work from fresh population,
skips unnecessary survivor-order analysis, avoids discarded ledger copies and
records, and bounds retained-history scans. It demand-caches projection order,
reuses ordered native requirement selection while producing fresh capture/proof
wrappers, and removes unused capture-bucket bookkeeping. Invalidation still runs
before later publication participants. No public flag or weaker guarantee is added.

The later passes address accumulated costs. Empty retirement packets no
longer materialize direct-collection values that their recipient cannot use.
Confirmed removal facts retain exact placement absence in the existing packed
representation. Notification indexes release terminal memberships after queuing
the required wake, and fully drained recipients retire eligible completed,
noncurrent operations. Cached proofs, native requirements and issued evidence
remain available. The lifetime and proof controls establish those boundaries;
these are not blanket history deletion or a promise of constant memory.

v15 already contained several of those improvements. Its compatible change only
bounds diagnostic-history cleanup by the retained suffix. Fractional retention,
pending IDs, confirmation ordering and existing lifetime behavior are preserved.
This is not a wholesale v16 backport.

The largest application-strategy improvement uses existing keyed `asMap()` reads
for full contexts, while retaining point reads for individual UI rows and selected
50-row contexts. The separate strategy study reduced first full-context medians
at10k rows from33.2 to2.9ms on v15 and25.5 to2.9ms on v16. Those figures belong to
that earlier strategy experiment, not the final runtime comparison below.
Sorted `ids()`/`all()` zipping is not a general substitute for keyed retrieval.

## Equivalent application comparison

All eight production applications now use credible bulk context paths. NgRx
reads its entity map and applies the existing optimistic projection; native
Angular reuses its eager views; TanStack uses direct collection reads. Before and
after SignalTree arms use the same `asMap()` strategy. Pending ownership, revisions,
caller order, duplicate/missing keys, entity lifetime and held snapshots are checked.
Peer strategy changes must not be attributed to SignalTree runtime changes.

The packet uses Angular22.0.7, NgRx Signals22.0.1, TanStack Angular DB0.2.12 /
DB0.15.2 / Query DB Collection1.4.8 / Query Core5.107.1, TypeScript6.0.3 and
Playwright1.56.1. These are pinned tested versions, not a claim about current releases.
There are five fresh-browser samples per arm/size/measurement kind, rotated order,
and separate v15 same-build pairs. CPU-facing observations and forced-GC heap runs
remain separate. All176 comparison children pass, following88 original behavior
cases,32 context cases,9 metric controls and16 calibration children.

At10,000 rows, medians are:

| Application | Store factory ms | First full context ms | Repeated full context p50 ms | Populated app heap above blank, decimal MB |
| --- | ---: | ---: | ---: | ---: |
| Native Angular implementation | 8.1 | 5.4 | 3.8 | 10.84 |
| NgRx SignalStore implementation | 4.7 | 3.7 | 3.3 | 5.19 |
| v15 before | 15.2 | 6.0 | 3.2 | 7.27 |
| v15 candidate | 13.3 | 6.1 | 3.5 | 7.27 |
| v16 C1 | 226.2 | 5.5 | 3.2 | 7.95 |
| v16 candidate | 228.9 | 5.6 | 3.4 | 7.94 |
| TanStack implementation | 44.9 | 3.7 | 3.3 | 7.63 |
| TanStack alternative implementation | 41.2 | 3.7 | 3.1 | 7.63 |

These are complete application implementations, not isolated primitive benchmarks.
Factory time excludes seed generation; full-context totals include serialization.
Heap includes Angular, application data and fixture-service state. It is not a
measurement of library-owned bytes alone. Per-child quantiles are summarized,
never pooled. Medians of paired differences need not equal differences of medians.

The combined v16 factory difference at 10k rows has paired median −8.3 ms,
range −17.2 to +26.0 ms. That does not contradict the group medians above:
differences of medians and medians of matched differences are different statistics.
Ordinary startup remains expensive. v15 broad timing changes are mixed; its
history algorithm is not exercised heavily by this default-history application.
Repeated whole-context times are close. This sweep does not establish a broad
application speedup or a general rival-library ranking.

Keep the adverse observations. At 10k rows, the v15 interleaved trace takes longer
in four of five pairs, with paired median +43.7 ms (+5.6%). v16 repeated full-context
p95 rises by paired median 0.5 ms, with three adverse pairs. Staging 128 proposals
has mixed v16 changes: paired medians +3.0 ms at 1k and +7.2 ms at 10k. These phase
timers include asynchronous application work; they are not isolated kernel CPU.
At 10k, v16 pending-128 and settled-128 heap increments fall by paired medians
7,736 and 19,344 bytes, respectively, but each has one adverse pair. These are small
reductions beside roughly 1.5 MB increments. v15 ordinary heap is essentially
unchanged. The [expanded tables](APPLICATION-METRICS.md) retain both sizes,
settlement, throughput, destruction and matched ranges.

During the interleaved 180-command trace, queued-user-to-layout p95 medians at 10k
rows are 12.0 ms for v15, 11.6 ms for v16, 11.1 ms native and 10.5 ms NgRx. These include
fixture/service and scheduler work. Frame callback gaps are observations, not
dropped-frame counts; missing samples remain missing. Backend durability,
authentication, model reasoning, model latency and token cost are not measured.

This was a busy development host: child-start load averages ranged from 13.884
to 27.013 over one minute, and reported free memory ranged from about 29 MB to
4.36 GB. A separately recorded, post-cohort topology inspection identifies
10 logical CPUs and 32 GiB physical memory; it is not a historical pressure
measurement. CPU utilization, compression, swap and memory pressure were not
captured per child. Free-memory figures alone do not establish pressure or the
cause of any timing difference. Treat the paired results and same-build controls
as descriptive evidence from this host, not an exclusive-host ranking, a calibrated
device class, or proof that timing differences from earlier cohorts are causal.

## Native guarantees and capture costs

The ordinary peer application comparison does not assign v16's complete native
guarantees to other libraries. A separate exact-artifact workflow compares C1
and the final v16 candidate with active native coordination.

Both artifacts pass the unchanged public Node/full-AOT browser, real-loopback
HTTP and coordination-aging suites, including their planted controls. These
exercise late readers, independent versus dependent delivery, overlapping rollback
refusal, same-key retirement, observer reentry and recovery,128 pending inverses,
uncertain receipt handling and exact drain. HTTP uncertainty uses a post-effect
HTTP503 without an application receipt; it is not proof of a lost TCP connection.

The refreshed `7ab6cbcc7` native run completes all 10 workload controls,
12 functional children, 32 CPU children and 12 separate heap children. It keeps
an active collection Link and transaction tree alive across ten full replacements
or rollbacks, with fresh entity lifetimes each cycle. Every intermediate value,
pending owner and outbound payload is checked. Independent verification rejoins
the exact artifacts and recomputes the completed results below.

CPU columns are median seconds across three matched rounds, totaling the ten
cycles. The heap column is the single primary before/after whole-process sample
at cycle 10 after the cycle helper returns, in decimal MB; a separate baseline
repeat is retained. It is not a median or library-exclusive allocation figure.

| Rows / settlement | Population CPU, C1 → final seconds | Settlement including drain CPU, C1 → final seconds | Held-store heap, C1 → final MB |
| --- | ---: | ---: | ---: |
| 1,000 / confirm | 3.184 → 3.259 | 1.285 → 0.807 | 17.721 → 15.201 |
| 1,000 / rollback | 2.097 → 2.154 | 2.691 → 2.817 | 12.037 → 12.009 |
| 10,000 / confirm | 21.770 → 19.708 | 43.509 → 6.634 | 92.825 → 72.117 |
| 10,000 / rollback | 13.032 → 12.285 | 21.973 → 20.826 | 30.001 → 30.095 |

The large confirmed-settlement CPU reduction occurs in all three matched pairs.
At 1k rollback, population CPU rises in all three pairs by 42.8–294.4 ms, and
settlement CPU rises in two of three. At 10k rollback, both phases improve in
two pairs and worsen in the third. Same-build variation and all elapsed results
remain in the raw record. Construction and Link attachment are recorded separately;
the settlement column contains synchronous settlement and must not be added to
that subset. All 12 heap children observe tree collection after owner-helper
return, but the final process heap is higher for the candidate in each primary
profile, by about 48–274 KB. The sum of all recorded CPU stages falls from median
65.287 to 25.318 seconds for 10k confirmation, improving 57.7–67.7% in each pair.
That sum excludes Link disposal and its drain, pending/post-destroy flushes, input
generation and most outside-timer checks; it is not end-to-end CPU. The 1k rollback
recorded elapsed total is worse in all three pairs, by 17.7–134.0%. This is finite
lifecycle evidence, not a universal memory bound. The separate long-history H/I
studies must not be added to these
combined results as if their savings were independent.

The final 100-operation capture rerun completes 66 normal children and 16 named
controls against C1, the original dual-invalidation prototype and the final
combined tail candidate. All 2,200 checked post-edit operations and proof roles
agree. For 1,000 live rows, 19 warm captures have elapsed medians 7.670 → 0.118 ms;
mixed history is 2.371 → 0.097 ms, improving every pair. Homogeneous packed history
already has little selection work: its warm-capture medians are 0.189 → 0.064 ms.

First captures and edit transitions remain mixed. Across all 100 alternating
edit/capture operations, the candidate's CPU differences are +27.554, −3.209 and
+4.657 ms in the three pairs. The last 60 operations cost 0.602–2.272 ms more CPU
in every pair. Elapsed results and the first-20 window mix signs, with substantial
baseline A/A variation retained. There is no universal capture or heap win.
The separate heap cohort measures immediate and held/released capture checkpoints,
not post-100-operation or post-destroy heap. For example, no-history immediate
heap growth is much lower, but absolute post-GC released-capture heap is 7.9–24.9 KB
higher in all three pairs. That distinction prevents a temporary-heap reduction
from being presented as a retained-heap reduction. The final arm contains all
selected changes, so its differences do not isolate N's causal contribution.

## Costs developers can choose

| Choice already available | Cost boundary | Decision |
| --- | --- | --- |
| Enhancer/module use | Optional transaction/restoration behavior, imported code and retained responsibility are distinct from ordinary state. | Keep existing module choices. Do not describe omission as removal of every v16 core publication cost. |
| Diagnostic history retention | Retaining confirmed history requires storage and cleanup; zero retained history permits immediate discard when no other obligation owns it. | Bound cleanup work; preserve the configured semantics. |
| Point versus full-context reads | Acquiring writable row/field readers costs more than a bulk value context. | Use point readers where their reactivity/identity is needed and keyed bulk reads for full contexts. |
| Demanded projections and native captures | Projection order and native selection caches are created by demand and require invalidation. | Keep measured caches; do not charge an extra public configuration matrix for alternatives with mixed payoff. |

P's extra order array costs roughly80KB at10k rows when both projections are
demanded; direct comparisons show the no-extra-cache alternative gives back read
speed. Shared weak getter state saves heap on untouched wide handles but reverses
that saving for fully demanded fields and increases getter work. Lazy containers
reduce constructor counts without a consistent overall CPU/heap win. Direct Map
filling and fresh-admission shortcuts have adverse profiles. Metadata-only
rewrites have mixed results. These are measured rejections, not unimplemented
optimizations waiting for a flag. Blind clone removal and publication bypasses
remain rejected by ownership, getter and reentry counterexamples.

v16's justification is its coordination contract: retaining exact responsibility
across pending work, late readers, entity replacement and safe rollback refusal.
The ordinary application results do not establish a point at which its larger
construction cost is generally repaid. v15 remains the lower-cost SignalTree line
for applications that do not need that contract. The tested NgRx and native
implementations also remain credible ordinary-state choices; this comparison
does not price an implementation of the complete v16 contract on top of them.

These capabilities support applications in which agents and users work on shared
state, but they do not supply production authorization, durable backend recovery,
cross-tab policy or model judgment. The separate
[agent collaboration audit](../2026-11-11-agent-collaboration/README.md) records
the supported workflows and those application/service obligations. This sweep
improves their runtime economics without turning synthetic interaction latency
into a claim about real-user productivity or model quality.

## Qualification and delivered cost

| Exact runtime candidate | Normal release gates | Mutation registry | Rebuilt canonical payloads | Production demo/routes |
| --- | --- | --- | --- | --- |
| v15 `4d1142d61` | 90/91; bundle size only | 91/91, source restored | 5 packages /158 files | Strict build and146/146 routes pass |
| v16 `7ab6cbcc7` | 86/87; bundle size only | 87/87, source restored | 5 packages /193 files | Strict size failure; review build137/138 routes, sole failure is size |

Both lines pass packed bundler/node16 consumers, Angular AOT and facade/SSR checks.
All root dist output is removed after mutation testing, then packages rebuilt
before canonical prepare-only packing. Complete archive, integrity, extracted
payload, source/build and journal joins are verified. The generated facade's
unexported `dist/index.d.ts` shim is not part of its declared packed payload;
every shipped byte still matches the fresh build. Five omitted/mismatched
canonical-admission controls reject as intended.

The first combined point-work failure counted2000 visits against the unchanged
strict2000 ceiling. Folding selection invalidation into the existing point writer
removed its extra command-array entry. The original bound and40 focused checks
then pass; removing the clear fails all8 late-installation witnesses. Neither
the counter nor its ceiling changes.

Exact canonical bundle fixtures, in gzip bytes:

| Line/fixture | Before prod/dev | Candidate prod/dev | Change prod/dev |
| --- | ---: | ---: | ---: |
| v15 bare | 11011 /13159 | 11011 /13159 | 0 /0 |
| v15 entities | 25333 /28273 | 25333 /28273 | 0 /0 |
| v16 bare | 18409 /20785 | 18409 /20785 | 0 /0 |
| v16 entities | 45187 /48948 | 45244 /49014 | +57 /+66 |

The separate neutral native-workflow fixture grows from 393,333 to 394,479 raw
bytes and from 118,717 to 119,068 gzip bytes: +351 gzip bytes, about 0.30%.
It imports Link, transactions and the internal pending reader, with five small
workflow wrappers. These are not library-only or Angular-application sizes.
Its production defines include both `ngDevMode=false` and `NODE_ENV=production`;
the canonical checker defines only `ngDevMode=false`. Do not subtract one fixture
from the other to invent a marginal feature cost. The before/after graphs,
payload inventories and compressor settings are bound in the evidence.

Numerical failures remain failures. v15 entities exceed existing limits by40.2
production and113 development bytes. v16 retains its larger existing misses;
the strict demo reports 823.91 kB against 570 kB, and its main-file assertion measures
798,215 bytes against 570,000. The temporary review-build budget omission is recorded
and its configuration restored byte-for-byte. Separate passing-fixture
clean/grown/restored controls produce exits0/1/0, closing the detector-sensitivity
gap that an already-red baseline cannot prove by itself. No ceiling is raised.

The owner directs weighing budgets against benefit, cost and feasibility. Accept
these specific candidate costs for local preparation: the narrow v15 repair has
no delivered-byte increase, and v16 retains its guarantees while materially
reducing confirmed bulk work and long-history retention. The ordinary startup,
small rollback, edit-transition and representation costs above remain part of
that decision. This is an economic exception for the identified candidates,
not a numerical pass, a new budget, or an exception for future artifacts.
Merge, final version/tag qualification, publication and deployment remain separate
selected release actions.

## Evidence and interpretation limits

The [evidence index](EVIDENCE.json) binds 124,053 original/version
mappings and 33,695 unique payloads in 9 ordered archive parts
(804,932,468 compressed bytes). Reassembly is byte-identical. A fresh
extraction verifies the file-reference graph with original-file opens denied;
missing and corrupted payload controls reject, and restoration verifies.

The archive preserves source inputs as exact bytes without requalifying every
historical claim embedded in them. Consumed predecessor members remain required;
unrelated historical members do not. Exact rules distinguish deliberately invalid
test identities and in-memory value digests from files. Fresh qualification
results remain mandatory. The older v15 summary supplies archive identities;
its documented lost logs are not presented as recovered. Historical demo outputs
and overwritten positive fixtures were recovered only by full recorded hash match.

The [verification receipt](evidence-verification/result.json) records the controls
and their limits. This verifies supplied bytes and declared dependencies, not
authenticity, all Git history or universal reproducibility. Final report, index,
packaging receipts and documentation checks remain outside the archive's own
hash cycle. Readable companions are [application metrics](application-summary.json),
[native measurements](native-summary.json), [capture measurements](capture-analysis.json)
and the [runtime disposition](runtime-disposition.json).

Commands and original data reside in the frozen evidence packet. Principal
generators are `tools/optimization-sweep/application-prepare.mjs`,
`application/measure.mjs`, `application/analyze.mjs`, `native-final/prepare.mjs`,
`native-final/run.mjs`, `native-final/analyze.mjs`,
`native-final-capture-analyze.py`, `bundle-economics.py` and
`qualify-artifacts.py`, alongside the frozen N100 source3 generator. Node is24.15.0;
pnpm is10.17.0. Each command records its actual arguments and artifact identity.

First runtime, control and orchestration failures remain preserved. In particular,
the offline application admission test expected a later wrong-arm diagnostic;
the analyzer correctly rejected at the earlier exact-cohort assertion. Only that
expected string changed, and all12 final cases pass. The native setup's pnpm
dependency-resolution correction freezes the actual workflow Playwright and its
own dependencies; its missing optional-manifest counterexample is also retained.
No measured runtime or sample was changed to fix those tool checks.

Independent reviews cover premises, source changes, raw arithmetic, qualification
and interpretation. Authorship limits are explicit: the final application raw
reviewer authored the peer overlays, and the final N100 raw reviewer authored
the earlier method. Separate earlier method reviews remain part of the record.
Finite samples on one development host do not establish population significance,
universal boundedness or performance in every application.

No general v16-versus-v15 ordinary-store amortization crossover is established.
Repeated captures of unchanged inputs can amortize selection work; alternating
edits and captures retain their measured penalty. The peer applications match
observable application outcomes, not every native v16 guarantee or the total
engineering burden of implementing those guarantees in NgRx. A module-present
per-tree activation option also remains unpriced; rejecting D's module-absent
shortcut does not settle that distinct question.

No demo source or deployed site is changed by this sweep. The standing TODO to
review every demo's clarity and verify Vercel plus the live site on a demo update
remains in force. Merge, tag, npm publication and deployment are separate actions.
