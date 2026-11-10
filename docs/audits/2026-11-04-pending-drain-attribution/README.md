# SignalTree v16 — pending and drain attribution

Candidate C remains the leading experimental implementation. This diagnostic packet establishes no safe runtime repair and grants no production acceptance. Frozen fe18, rejected fused eef7, Candidate C9aa, stable v15 and all earlier cost cohorts remain unchanged.

The owner requested `V16-PENDING-DRAIN-ATTRIBUTION-0`: attribute pending retention and post-loop work before optimizing, then complete qualification. [Registered design](DESIGN.md) fixes the premises, probes, calibrated controls, finite schedule and limits. Runtime source is unchanged from `9aa20563b72ad73bc4a1ae736181ffebd73dc418`; only non-shipping tools and records are added.

## Executed diagnostic packet

Command: `python3 tools/pending-drain-attribution/campaign.py /private/tmp/st-v16-pending-drain-attribution-0`, using Node24.15.0. All82 registered children completed and validated:72 fresh workload children followed by10 offline snapshot analyses. Whole-source and input comparisons before/after report no mismatches; per-child critical input guards report none, no timeout/resource failure and no surviving owned processes. Sampled aggregate owned RSS ceiling4GiB and host-free floor25% were unchanged. The packet records actual telemetry and input identities, not dedicated-core isolation.

Preregistration SHA256 `0011af3c26521125523aabd1f95265381b39547e4f2a93af04aaf933616b4879`; per-child critical manifest SHA256 `9be85332727ff198889c15a537be01b33a77ede1a7860b10d8f5539fe47f7e47`. Original193-file artifacts and194-file copied trace artifacts have separate manifests. Launch environments contain only PATH/TZ/LANG; macOS additionally supplies `__CF_USER_TEXT_ENCODING` in the child. Inputs are synthetic.

## Observations and interpretation

The three anchor pending-minus-primed samples have medians1,034,936B frozen and1,096,576B C: descriptively+61,640B across ten trees/100owners. Controlled cells hold33 reader handles per tree even with zero owners. Pending increments at0/1/10/32owners per tree are approximately75/403/1040/3209KB frozen versus75/449/1104/3289KB C for distinct rows. Same-row populations also grow substantially. Owner count simultaneously changes handles, facts, histories and windows; these small descriptive samples do not establish a per-owner slope or asymptotic law.

Copied point traces record all2000 Source/native preparations and completions within synchronous writes, and zero callbacks at rewritten direct scheduler sites in both arms. Pending authorship schedules/executes100 path-notifier microtasks in each; rollback schedules/executes111 tasks in each (one path-notifier,100 lifecycle cell cleanup,10 transaction callbacks). No extra late native completion is observed. Promise/host scheduling is not completely rewritten. Queue counts identify boundaries, not mandatory work.

The fresh uninstrumented economics cohort has five alternating pairs plus two frozen A/A controls. Every registered endpoint is unresolved under the pinned nonoverlap/maximum observed variability rule. Two-immediate drain wall medians are0.237ms frozen and0.200ms C, but C has an8.146ms excursion with25.216ms CPU. The old4.33ms difference is neither consistently reproduced nor proved recovered. Twenty-two task turns include harness/JIT/GC and do not prove universal quiescence. Previous acceptance samples are not replaced or pooled.

Single-child sampled allocation totals are62,672,728/23,499,016B frozen/C for point,14,888,048/14,835,760B for pending authorship and14,125,128/13,939,984B for rollback. Point stacks shift away from generic preparation/Map/iterator activity toward specialized preparation. These are Poisson-sampled JS allocations, including collected objects and profiling effects; they are not exact allocation totals, retained ownership, native backing storage or timing acceptance.

One fresh snapshot per arm/checkpoint supports a separate additive self-size census. Candidate-minus-frozen totals are−15,688B primed,+44,128B pending,+49,968B rolled back,+52,488B confirmed,+24,976B destroyed. The difference of pending-minus-primed increments is+59,816B, including+56,120B code and+440B object self-size, with zero closure self-size difference. Cross-child IDs are not longitudinal identities. Code/metadata growth is a concrete contributor in these snapshots; it does not establish an exclusive byte-for-byte explanation of the process-heap distribution. Detailed retained-context review follows in the independent evidence.

No owner-journal redesign or runtime repair follows from these results. A repair requires a concrete unnecessary lifetime/operation and semantic falsifier. No such repair is demonstrated here. Candidate C therefore proceeds unchanged to the separately recorded full qualification; diagnostic completion does not close runtime-cost acceptance.

## Controls and preserved failure

Synthetic and actual Node24 heap controls pass, including strong/shared/cyclic/weak graphs and live/dead conditional WeakMap cases. Engine retained sizes remain qualified and nonadditive; shapes are overlapping candidates, not owner identities, and raw incoming edges are not ownership paths. Parser provenance, registry integrity, license and exact JavaScript/Wasm hashes are preserved.

The first allocation calibration failed: the intentionally disabled collected-object sampler still reported1080B, defeating a nonzero-only control. The initial source, runner, profiles and failure remain intact. The corrected multi-megabyte synthetic fixture requires at least1MiB sampled signal plus collection sentinels and kills the mutation. This is probe calibration, not a new library budget. Callback omission, scheduler execution omission, GC event omission, author/settle/point omission and zero-CPU controls are rejected before main data. Six scoped settlement witness suites pass43tests through Nx. No behavioral assertion, semantic role or point-work ceiling is weakened.

## Qualification and authority

Complete normal gates, outer seeded mutations, restored-source clean rebuild, installed consumers, production browser and fresh matched released-v15 ordinary costs are a separate acceptance obligation. Their results must not be inferred from this packet. Size retains the owner's existing disposition while ceilings/failures remain visible. Merge, activation, tags and package publication remain unauthorized.

Independent records: [premises](independent-diagnostic-premises.md), [protocol preflight](independent-protocol-review.md), [raw-result interpretation](independent-results-review.md), [timing/scaling limits](independent-diagnostic-interpretation.md), and [retained-context/source review](heap-cause-review.md). Context self-size exceeds frozen by1216B already at primed and at every later sampled endpoint, so its added pending increment is zero in those samples. The code/metadata census does not identify one exclusive source function.

[Qualification record](../2026-11-04-candidate-c-qualification/README.md) keeps the complete acceptance results separate. The sealed raw packet has2294payloads in3ordered chunks. Run `python3 docs/audits/2026-11-04-pending-drain-attribution/verify-evidence.py` to verify every chunk/file without extraction or execution. [Seal](EVIDENCE-SEAL.json) binds sizes and hashes. Original registered design/controller bytes remain alongside the platform-environment clarification.

The code-census gap is−41,344B at primed and+14,776B at pending, producing the+56,120B difference of increments. This is a phase-dependent VM footprint; it is not an exclusive source-function attribution or a direct partition of the repeated process-heap result.
