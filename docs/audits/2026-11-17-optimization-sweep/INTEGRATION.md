# Integration and acceptance decision

The selected v16 runtime is `7ab6cbcc70bf5abe9c5070e38a51bd0229ed1830`; the
v15 correction is `4d1142d6166b2d5b2874715e38097665545864dc`. Their local
qualification and final comparisons are complete. Retain these improvements
with the costs below and the specific numerical-size exceptions in the
[final report](README.md). Unsuccessful experiments and first failures remain
unchanged. Evidence packaging and branch sharing close the phase.

## Selected improvements

| Candidate | Reason to integrate | Cost or limitation to retain |
| --- | --- | --- |
| A/B | Avoid populating an index that only replacement results consume, and avoid survivor-order work when fewer than two survivors are possible. Both are small local changes with actual work witnesses and preserved behavior. | Isolated and ABC timings are mixed. Select these as removal of provably unnecessary work, not a demonstrated broad startup speedup. Final construction is compared in the report and does not establish a broad ordinary-startup speedup. |
| L1/L2/L3 | Remove a discarded returned record copy, maintain the sorted retained suffix without repeated whole-ledger scans, and avoid constructing immediately discarded ordinary records when no obligation retains them. | L2 provides the clearest scaling benefit. L1/L3 are narrower simplifications; isolated gains cannot be added. Preserve clock, IDs, out-of-order settlement, fractional history and same-turn restoration promotion. |
| P | Demand-cache subject order for value-only projections, preserving exact row attribution and invalidation. Repeated broad projections improve consistently; the direct P/P0 comparison prices the alternative. | Both IDs and values demanded at10k rows cost about80KB more whole-process heap than the no-extra-cache alternative. This is demand-triggered state, not a charge for every empty store. No uniform heap win is claimed. |
| N tail | Reuse ordered native requirement selection across repeated whole-input captures; keep fresh capture wrappers/proofs/owner sampling. Use the simpler tail-only invalidation proven before later participant writes. | Earlier N100 comparisons price higher CPU for all100 alternating edit/capture operations. The final combined rerun has mixed total changes and an adverse last60 window in all three pairs. Tail versus dual speed advantage is unresolved. The selection pays for repeated capture use, with an explicit edit-transition cost and no new public configuration. |
| O | Remove capture-bucket owner-path bookkeeping with no consuming production caller. This narrows maintained state and emitted code. | The isolated CPU cohort does not prove a speedup and includes adverse profiles. Treat this as dead-state removal; the final combined optional-transaction path passes its workflow checks. |
| T | Skip direct-collection value preparation for exact empty retirement packets. This removes repeated whole-collection reads while retaining native publication and nested getter behavior. | The10k confirmed full-settlement CPU median falls22,768.578→3,347.480ms across ten replacements. Rollback population worsens in all three isolated pairs; combined population plus settlement worsens in two. No retained-heap win is established. |
| U | Represent confirmed removal facts with explicit placement absence in existing exact packed runs, retaining every requirement and owner identity. | Ten10k-row confirmed replacements save21,040,952B at the held-store checkpoint but add158–244ms full-settlement CPU. The1,024-distinct-owner countercase has no final heap saving, mixed CPU and a preserved+1,025,136B intermediate checkpoint. This is a workload-dependent representation benefit. |
| H | Keep notification memberships only while the selected owner is pending, queue the terminal wake before removing both indexes, and recheck the exact preselected owner at installation. Required proofs and operations remain independent. | At1,024 rollback episodes, whole-process held heap falls66,337,888→24,612,088B and four-phase CPU medians fall1,303.172→904.829ms. Short-history CPU is mixed, including increases in two32-episode pairs; confirmation is unresolved. The benefit is accumulated notification bookkeeping, not constant memory for all history. |
| I | Retire this reduction's completed noncurrent undeclared operations after rechecking the live recipient and fully drained queue. Preserve cached proofs, native evidence and issued inputs. | At1,024 rollbacks, held heap falls24,510,088→13,704,680B; all pairs save10.205–10.656MiB. CPU is mixed and ordinary32 complete lifecycle rises11–22% across all three pairs. Most heap benefit depends on an attached Link. Partial drains deliberately skip cleanup; no universal history bound. |

No new optional public mode is introduced. Existing module choices, diagnostic
history retention, selected versus whole-context reads, and lazy reader/projection
creation remain the useful cost choices. A new switch would add routing, stored
configuration and a compatibility matrix; the rejected mechanisms have not shown
enough benefit to justify that structure.

The module-absent D experiment does not price a module-present per-tree activation
option. That earlier opportunity remains underdetermined: no compatible mechanism
with a sufficient demonstrated saving has emerged, and D's result must not be used
as proof that every per-tree option loses. Reopening needs an eligibility/invalidation
mechanism that preserves late readers, cross-tree ownership and reentry, then a
matched cost comparison. No new flag is selected without that evidence.

The first combined native comparison passes10 controls,12 functional children,
32 CPU children and12 heap children. Its repeated full-store replacement cost
led to T and U above. Both have immutable isolated comparisons, baseline work
witnesses, useful mutation controls and independently checked raw results. The
fragmented U countercase passes all controls and workload oracles, preserving
1,024 separate proof owners without claiming a uniform memory saving. Retain T/U
after final combined evaluation: the large bulk gains justify these narrow changes
at their recorded adverse profiles. A new public switch or arbitrary packing
threshold has not demonstrated enough benefit to justify its own policy and
validation cost. The unexplained intermediate heap increase remains a limit,
not a dismissed measurement or a new heap bound.

Their integrated checkpoint `f3fa3418d` completes86/87 normal gates (bundle ceiling
only) and87/87 mutation checks with source restored. A further bounded candidate,
H, targets notification indexes whose terminal memberships grow across rollback
history. Its complete96-child cohort and independent interpretation support
integration; all40 normal heap children observe tree collection. The combined
H checkpoint is `2d92fcd3c`, with all957 build inputs equal to the immutable
prototype. Required proofs and registered operations remain untouched by H.
The subsequent I comparison and five useful mutation controls support bounded
operation retirement while preserving required proofs. Its initial insensitive
historical-proof oracle and the corrected all-facts control remain separate evidence.
The final integrated checkpoint is `7ab6cbcc7`; runtime bytes match the measured
I build, while one strengthened test differs. Fresh full qualification and exact
canonical/application/native comparisons complete against this checkpoint. The fresh
normal run completes86/87 gates, with only the numerical bundle miss and exact
source preservation. All87 mutation checks also complete with exact restoration;
the already-red size baseline retains its detector-sensitivity qualification.
Canonical artifact qualification, application/native/capture comparisons and
independent arithmetic review and portable evidence verification are complete. The separate
counter diagnostic observes no cleanup-list/helper activity in ordinary32; the
measured ordinary slowdown remains a cost with an unestablished cause.

## Not selected

- C and D add internal helpers/capabilities for mixed or narrowly beneficial
  timings. D's native-loaded wide-row regression remains explicit. The measured
  bare startup benefit does not presently repay a new eligibility/invalidation
  obligation on the common path. Its safe-control evidence is retained.
- P0 gives back the second projection-order cache but gives back repeated-read
  performance too. P's bounded demand cost is the selected tradeoff.
- M removes tuple work but direct Map filling is not uniformly faster. The
  corrected compact-manifest comparisons retain narrow loaded regressions on
  both lines. Keep the current Map implementation.
- K reduces temporary constructor counts but adds optional-container branches
  without a consistent overall CPU or retained-heap benefit. Do not add a mode.
- G saves heap for wide row handles with few demanded fields, but reverses that
  saving when fields are fully demanded and makes repeated getter acquisition
  more expensive. Keep the existing lazy-field representation.
- R's contributor-only numeric encoding leaves the other index owning the
  original strings and adds conversion work. No retained-byte saving is established.
- User-data clone removal, blind notification gating and the earlier aligned
  topology bypass remain rejected by concrete ownership/reentry counterexamples.

## v15 and application work

v15 already includes L1/L3 and the main L2 algorithms. Its remaining bounded
diagnostic-suffix scan correction completes combined qualification after
baseline-first work witnesses, compatibility and retention checks, a separate
immutable build, and the complete64-child CPU/14-control cohort. The retained
history profiles support the work reduction, but timings remain variable and
quiet/wide adverse samples are preserved. Those quiet paths bypass the changed
release method; no causal branch-tax claim follows. No wholesale v16 backport
is made.

Adopt existing keyed `asMap()` retrieval for full application contexts, retaining
granular point reads for UI and selected50-row contexts. Preserve optimistic
projection, caller key order, missing/duplicate keys, entity lifetime and held
snapshots. Sorted `ids()` plus `all()` zipping is not a general replacement.

The final application cohort uses the same strategy for before/after runtime
arms and gives all four pinned peer implementations a credible bulk context
path. In particular, NgRx reads its entity map without creating a point computed
for every context row. Native reuses its existing views; TanStack reuses direct
collection reads. These are context-value paths, not an identity-preserving
replacement for reactive point readers. All eight arms require pending,
revision, lifetime, ordering and teardown controls. The cohort is distinct from the
earlier point-versus-bulk strategy study. Full native coordination, late readers,
reentry, retirement and the original point-work bound remain separate obligations.

## Qualification and closure

The first full combined run completed 84/87 gates. It exposed a point-work
regression (2,000 visits against the unchanged strict 2,000 ceiling), three lint
errors, and the existing numerical bundle miss. The correction folds selection
invalidation into the existing point writer instead of appending a command-array
entry. The original counter and ceiling remain unchanged; all eight missing-clear
controls detect stale late-participant installation. The first failure is preserved.

Final v16 `7ab6cbcc7` completes 86/87 normal gates, with only the numerical bundle
miss, and all 87 mutation checks with exact source restoration. A fresh uncached
five-package build and canonical preparation verify 193 shipped payloads.
Installed bundler/node16 consumers, Angular AOT and facade/SSR checks pass.
The strict demo fails its unchanged size ceiling at 823.91 kB against 570 kB;
a separately recorded review build temporarily omits budgets and restores its
configuration exactly. All 137 behavioral checks pass; the remaining route
assertion is the 798,215-byte main bundle against 570,000. Those failures are
retained, not relabeled. The separate passing-fixture growth/restoration control
returns 0/1/0 and establishes detector discrimination despite the red candidate
baseline.

v15 `4d1142d61` completes 90/91 normal gates (its unchanged entity bundle ceiling
only), all 91 mutation checks with restored source, five canonical packages and
158 shipped payloads, installed consumers, Angular AOT, facade/SSR, strict demo
build and all 146 routes. Both lines' canonical validators check complete package
membership, journal, integrity, extracted payloads and source/build joins; five
incomplete or mismatched admission controls reject.

The final application cohort completes 176 children with the same bulk-context
strategy in each before/after pair. The native run completes 10 controls,
12 functional children, 32 CPU children and 12 heap children. Final N100 completes
66 normal children and 16 controls against C1, preserved dual and combined-tail
artifacts, including all 2,200 checked alternating operations. Independent reviews
recompute every group, matched difference and same-build comparison and preserve
adverse outcomes. Native sums of recorded stages exclude pending flush, Link
disposal/drain, post-destroy flush, input generation and most outside-timer checks;
they are not end-to-end CPU. The isolated H/I four-phase measurements do include
their explicit Link disposal and teardown drains.

The report accepts the identified candidates' costs under the owner's instruction
to weigh budgets against benefit, cost and feasibility. No public guarantee,
configuration, version or numerical ceiling changes. Final artifact/archive
verification is complete; documentation checks and authorized branch sharing close the record;
merge, tagging, publication and deployment remain separately selected actions.
