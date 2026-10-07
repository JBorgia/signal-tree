# Active release takeover — October 7, 2026

The owner authorized this chat to take over and finish the existing v15 release,
including its inherited uncommitted repairs, then publish if verification passes.
This resumes the implementation/qualification hold below. Work remains on
`fix/v15-permanent-repairs`; the v16 research checkout is outside this task.
Inherited files and hashes are preserved at
`/private/tmp/st-v15-release-takeover/inherited-work.tar.gz` and
`inherited-work.json`. The published baseline remains v15.4.3.

Complete the existing repair scope and independent reviews, preserve first
failures, then qualify one exact committed candidate through the full registry,
mutation proofs, fresh packed consumers, demo/browser and Linux checks before
signed tagging and canonical CI publication. No budget or public-policy change
is authorized merely to get green. New release evidence belongs under
`/private/tmp/st-v15-release-takeover/` until recorded before candidate freeze.

Candidate preparation, October 7: isolated frozen install, independent source
review, transform fixtures and focused neutral/native reader probes completed.
Version metadata is 15.4.4. The owner subsequently approved bounded size
ceilings (bare 10.80/12.90 KB, entities 24.60/27.50 KB, production/development)
and further measured tolerance if needed to retain repairs and publish. The
demo initial warning/error limits are 600/625 kB after Linux measured 595.67 kB;
its previously lazy routes remain lazy. All other correctness and validation
requirements remain. Full qualification and publication remain pending;
record exact-candidate evidence externally under the takeover directory so the
qualified source remains unchanged. See the permanent-repairs audit for first
failures and corrected test premises.

---

# Active: 15.4.4 permanent repairs — October 6, 2026

The owner approved the audit's recommended durable solutions on October 6.
Work is isolated on `fix/v15-permanent-repairs`, based on combined implementation
`8e5be3dd02c2398e1c68542883b4e3ea68d2c595`. Other worktrees and their uncommitted
changes are preserved. The earlier controller below is historical.

## Research checkpoint — October 6

The owner requested external comparison of the recurring subsystem-boundary
failures before further implementation. Preserve current edits and first reds;
finish already-running verification only. This pauses implementation/qualification,
not the standing release authority once a candidate is actually ready.
See [external comparison](docs/audits/2026-10-06-external-architecture-comparison.md).
No replacement architecture or new public contract has been selected by this research.

## Scope and completion conditions

- [ ] Current explicit collection reads with grouped/coherent observer delivery,
  including previously captured projection functions; no tap-only workaround.
- [ ] Tree-scoped membership visibility caching, including the write path;
  partial capture proportional to supplied keys and scoped observer demand.
- [ ] Production instrumentation stripping preserves program control flow;
  executable transform fixtures and built-artifact verification.
- [ ] History reconstruction removes redundant row and location searches while
  preserving boundaries, hidden locations, rejection rebasing and immutable states.
- [ ] Remove address retention that has no consumer; preserve exact structured
  addresses and all active topology/late-observation requirements.
- [ ] Attribute transaction overhead with useful work counts and correct,
  lifecycle-clean measurements before selecting any provenance representation change.
- [ ] Independent review, focused mutation proofs and full required checks;
  current docs/llms/demo, then one exact candidate and fresh artifact qualification.
- [ ] Exact-candidate Linux validation, tag/publish and registry verification.

Owner decision, October 6: fresh reads cover SignalTree-provided readers,
including held projection cells. External native computed values and effects
retain framework timing; they need not refresh inside a grouped callback.
Synchronous observers must still receive coherent publication.

Do not change v15 automatic-abort/refusal semantics, public API, or budgets to
make these repairs pass. The prior read-only audit did not demonstrate abandoned
pre-handle authority on v15; specific exception-boundary probes must distinguish
that suspicion from v16's different recovery contract. Persistent history caches
and broad ownership-model replacements are not presumed necessary.

Order remains verified v15 publication, then the TruckTrax v3_alt update and
completion (GT Web first), then v16 integration and its own complete semantic,
performance and size verification. Existing publication authority remains valid.

Before/after diagnostics live under `/private/tmp/st-permanent-repairs/` until
checkpointed. Preserve first reds. Exact release evidence stays outside a frozen
candidate. Developer work-count/source probes are not release timing evidence.

---

# Current release work — v15 outcome provenance patch

Updated October 5, 2026 (15.4.3 preparation). Active branch `fix/v15-outcome-provenance`, based on
published v15.4.0 `4ceb24a2a62dc893bf28c50ad971a955190539a7`.
The historical controller below is retained as evidence, not current instructions.

## 15.4.3 published

`@signal-tree/*` 15.4.3 is on npm `latest` from signed tag `v15.4.3` at
`2a4b99716a0bc6f103eae5b12381dc1a23b2191a`. Local qualification, Linux Validate
[37342331087](https://github.com/JBorgia/signal-tree/actions/runs/37342331087),
the tag release and the publisher
[37346516120](https://github.com/JBorgia/signal-tree/actions/runs/37346516120)
each passed 88/88 gates and proofs. All five registry archives match the
qualified candidate byte for byte, with provenance. The installed npm kernel
passes the packed refusal gate and a probe of both fixed defects. Entities
production bundle: 22.59 of 22.6 KB, so the next kernel change needs a size
reduction or an owner decision on the ceiling. Receipt:
`docs/audits/2026-10-05-v15.4.3-release.json`.

Next, per the owner's order: update TruckTrax v3 to 15.4.3, then the demo
site if all goes well, then the v16 integration.

## Demo site on 15.4.3

signaltree.io (Vercel project `signaltree`) served `main` at `6ae860c8`
(16.0.0-dev) until 2026-10-05. With owner approval, the Vercel build of the
`v15.4.3` tag commit was promoted to production (`dpl_4nsfnpcCbJPapiRBDQYRLJZViguy`;
it serves `@signal-tree/kernel v15.4.3`), and the project's Ignored Build Step
now skips `main` so v16-dev pushes no longer replace the live site. Previous
production for rollback: `dpl_3dVrUc4xzHBLDskZLwr6ytcpokki`. See "Demo Site" in
RELEASE_PROCESS.md.

## 15.4.3 preparation

The owner authorized fixing and publishing two defects found after 15.4.2 in
plain-branch membership-only writes (a whole-branch write omitting an optional
field present in the initial state), both reproduced on published 15.4.2 and v16:

1. With `position-topology` (`transactions()`, `restoration()`), owners were
   never invalidated, so framework adapters were not told to re-read.
2. Without it, the removed leaf's own token was never published: direct reads in
   Angular, Vue and Solid, computed/derived consumers and leaf subscribers stayed
   at the retained value while the branch snapshot showed the field absent.

Both repairs are in `republishMembers` (plus one internal location-runtime
export). Carriers were written first: 23/54 and 48/108 kernel failures before,
all green after, with framework carriers in all four packages; four of five
mutations killed, one equivalent alternative survives. v15's settle-time
invalidation law is unchanged. Development budgets pass (entities production
22.59/22.6 KB, the closest margin so far). Evidence:
`/private/tmp/st-v15-ownerinv-evidence/` and `/private/tmp/st-v15-15.4.3-evidence/`.
Independent review and the full exact qualification precede the signed tag.

## 15.4.2 published

`@signal-tree/*` 15.4.2 is on npm `latest` from signed tag `v15.4.2` at
`012fd11db2aba7acf59b374b84880aaaa6b62360`. Exact local qualification, Linux
Validate [37321395870](https://github.com/JBorgia/signal-tree/actions/runs/37321395870),
the tag release [37324153821](https://github.com/JBorgia/signal-tree/actions/runs/37324153821)
and the publisher [37326890452](https://github.com/JBorgia/signal-tree/actions/runs/37326890452)
each passed 88/88 gates and 88/88 proofs. All five registry archives are
byte-identical to the qualified candidate and carry provenance; the registry
kernel passes the packed refusal gate against npm 15.3.0 (10/10). A first
publisher dispatch from `main` was refused by the workflow's tag guard before
publishing (run 37326803412). Receipt: `docs/audits/2026-10-05-v15-release.json`.
The demo deploy workflow runs only from `main` and has failed since 2026-09-22;
it was not run for this patch.

Next: carry 15.4.1 and 15.4.2 into the v16 integration with their tests, and
update TruckTrax v3 to 15.4.2.

## 15.4.2 scope extended before tagging

Candidate `5c22eac5` completed exact local qualification (88/88 gates, 88/88
proofs, packed consumers, AOT, 146 browser cases) and Linux Validate
[37036128088](https://github.com/JBorgia/signal-tree/actions/runs/37036128088).
It was never tagged. `main`'s `PROPOSAL-REJECTION-0` suite then ran on it: 12 of
16 pass, failing exactly the cases `main` fixed on 2026-09-22 (a pending add or
rekey whose subject settled later work removed still refused rollback and
stranded the turn's other values). The owner directed the port into 15.4.2:
15.4.2 is unpublished, so the version does not change.

The port restricts supersession to settled erasers, matching v15's scalar rule.
First red: 7 of 27 focused cases. After: 27 of 27, and three mutants (no
settled-only guard, always supersede, add only) are each killed. Independent
review found only minor test and wording gaps; both missing cases were added.
A characterization test pins a pre-existing limitation: undo of a later write
after a rejection can restore the rejected value (scalars before, pending-created
rows now). The packed refusal gate pinned the fixed case as a known limitation
and failed (87/88); with owner approval it now classifies it as fixed while
still pinning 15.3.0's refusal evidence. Evidence:
`/private/tmp/st-v15-structural-supersession-evidence/`. The new candidate needs
the full exact qualification and Linux validation again before the signed tag.

## Active 15.4.2 preparation

The external-baseline, whole-turn designation and inspection-order repair is
implemented. Independent source review demonstrated no additional blocker.
Fresh kernel validation reports 3389 passes, seven expected failures, thirteen
skips and one TODO. Full development-source release gates passed 88/88; mutation
proofs passed 88/88 with zero unproven, vacuous, blind or errored checks. Generated
output was deleted and all five packages rebuilt afterward.

The owner explicitly deferred additional comparative benchmarks on October 2.
The short external common-write comparison remains noisy development evidence,
not performance parity or a speedup claim. Required registered release gates
remain enforced. Scope now is v15 fixes, tests and release only.

Prepare 15.4.2 metadata, freeze the exact source, requalify and publish only
through tagged canonical CI. Evidence stays outside the frozen candidate at
`/private/tmp/st-v15-external-baseline-repair-evidence/` and the new candidate's
qualification directory. The superseded 15.4.1 tag must remain unchanged.

## Publication hold — new public-API counterexample

Candidate `14003fc26f5f97bc8f816c18ba8bb876a7b27e3d` completed local and Linux
88/88 gates and 88/88 proofs, strict archives/AOT and 146 browser cases. Signed
tag `v15.4.1` points to it. Before npm publication, a new public-API probe
reproduced this failure on both npm 15.4.0 and the qualified candidate:

```ts
external(() => tree.$.x(5));
undoable(() => tree.$.x(6));
// allow queued observation to finish
tree.undo(); // actual 0; expected external baseline 5
```

It reproduces with restoration alone, both transaction/restoration orders, and
batching installed. No internal fault injection is required. Independent
contract/history review supports 5: external realization must not become
authored history. Existing tests undoing an earlier entry are not this case.

The candidate is superseded. Tagged release run `36960642038` was cancelled;
the npm publisher was not dispatched. Preserve signed tag `v15.4.1` and all
prior green evidence. Do not rewrite or reuse the tag. Raw reproduction:
`/private/tmp/st-release-15-4-1-qualified/candidate-outcome-probe/external-baseline-result.json`.

Repair with a failing public regression while preserving compact historical
reconstruction and prior-entry supersession behavior. After review, prepare
**15.4.2**, freeze a new exact candidate and repeat full qualification. Version
manifests still say 15.4.1 until that preparation; none of the older instructions
below authorize publishing the superseded candidate.

## Authority and scope

The owner authorized completing and publishing verified v15 work before v16
integration, with no repeated permission for routine fixes or verification.
V15.4.0 is published: all five registry archives matched the qualified candidate;
local, Linux, tag and publisher gates/proofs passed 88/88, with strict consumers,
Angular AOT and registry regressions. Receipt: `024ce69c` on the prior worktree;
raw evidence: `/private/tmp/st-release-15-4-qualified/`.

A controlled reproduction on the actual 15.4.0 npm archive found that reusing an
observer error during a later validation failure can advance restoration history
without applying the operation. Internal validation fault injection is part of
that reproduction; no common application trigger is claimed. Evidence and
archive integrity: `/private/tmp/st-v15-published-outcome-probe/result.json`.

The patch replaces persistent error branding with an invocation-local receipt,
unwrapped at public exits to preserve original thrown values. The additional
repair keeps external realization out of a newly authored undo entry while
preserving historical reconstruction. No new public API,
refusal policy, ownership model, retention policy or budget is introduced. V16
recovery behavior must not leak into stable v15. Independent review is required.

## Verified repair checkpoint

Runtime and regressions: `48b8af0f`. Before/after focused results: 3/25 then
25/25. Full kernel: 3320 ordinary passes plus seven expected failures, thirteen
skips, one TODO; types/spec-types/lint pass. All five host builds and unchanged
bundle budgets pass. The same controlled published-artifact probe passes on the
repaired packed kernel; first failure and exact archive identities are preserved.
See [the repair record](docs/audits/2026-10-01-v15-outcome-provenance.md).

Version metadata still reflects superseded **15.4.1**. After the additional
repair, prepare **15.4.2** once. Exact-candidate logs stay outside the tracked tree.

## Execution

1. Preserve red tests against published source; focused repair and mutation proof.
2. Full kernel/static/build checks; test the repaired built archive against the
   same controlled reproduction and preserve published/control differences.
3. Prepare **15.4.2** metadata after the additional runtime checkpoint. The
   signed 15.4.1 candidate is superseded and its tag must not move.
4. Freeze an exact candidate; full local release gates and mutation proofs.
5. Destroy generated output, rebuild, inspect all five versions, verify strict
   packed consumers, Angular AOT, demo/browser, and clean checkout.
6. Exact-SHA Linux validation, signed tag and canonical tagged publisher; verify
   registry bytes and installed regression. No package-local publication.
7. Record release evidence outside the frozen candidate, then resume the v16
   selective integration at `65cf7b38`. V14 remains paused. Private Studio's
   minimum-version decision remains separate and pending.

Do not rerun failures until green without a diagnosis. Preserve first exits and
actual counts. All mutation work precedes final artifact rebuild. Existing
15.4.0 performance evidence is historical; no new speedup claim is made here.

## Historical 15.4.0 preparation record

The following entries describe the completed previous release. Their pending
wording and next steps do not reopen it or override the patch sequence above.

## Scope and checkpoints

- Public packages and their order: `scripts/release-plan.mjs`.
- The ledger records v15.3.1 published from `40e668036290b43f9e389e97a35341ea9e5fea7d`.
  That is historical release evidence, not a fresh registry query.
- Historical runtime checkpoint at audit entry: `8fe2664faecbb72c22b14100a41b7060177b1b39`.
  Interceptor/selector reentry now refuses stale outer topology staging; removal
  observation samples demand after callbacks. Kernel: 3,220 passed. This is not
  an RC freeze or a full-release verdict.
- Read-only kernel observation APIs and full Studio coverage are owner-authorized.
  Studio implementation stays in its separate private workspace. Authorization
  does not substitute for integration/packed-consumer evidence.
- The `fix/15.3.2-backport` worktree is a separate candidate. Do not infer that
  it contains all 15.4 changes or reuse a different candidate's verification.
- v16/product-architecture work and old 1.0 derivation phases are separate from
  this release. No new architecture is authorized merely by an old unchecked box.

## Current work and blockers

1. Final experimental archives pass one five-round CPU4 comparison with all
   correctness digests equal. At 50k rows, median per-round visible edit p95 is
   11.28ms candidate, 14.25ms released and 14.18ms A/A; ranges separate for this
   metric. Maximum candidate edit is still 22.88ms. Plain-candidate load/refetch/
   movement improve versus released;
   startup is not uniformly faster. Installed transactions/restoration still
   cost roughly 13.9×/9.1×/8.7× plain bulk load/refetch/movement. Avoided
   allocation is proven, but no material reduction of that installed-enhancer
   overhead is established. Preserve that limitation and the controlled
   workstation labels (launch Defender enterprise CPU 82.1% despite the earlier
   idle sample); do not call this continuously quiet or promote working-tree
   results to exact-RC evidence. A bounded diagnostic attributes most enhanced
   cost to notification-time capture, descriptors and repeated field diffing;
   the remaining pre-drain copy is only a small share. A broader capture
   refactor remains open and must preserve whole-turn designation semantics.
2. **Development entity ceiling approved October 1:** 25.50 KiB, measured
   25.37 KiB; production remains 22.60 KiB, measured 22.54 KiB. Safe reductions
   and diagnostic folding checks preceded the decision. Preserve the original
   25.25 KiB failure; the focused budget check now passes under the approved
   policy. This policy change is not a runtime optimization.
3. **Complete:** owner-approved guidance consolidation. Historical bodies and
   semantic constraints preserved; branch-specific facts, links, skills, live
   examples and production demo builds checked. See the guidance audit for the
   preserved sandbox/native-build failures and successful host controls.
4. Private Studio's reviewed acceptance-tooling repairs are applied; 14 focused
   tooling tests pass. Strict all-five packed consumers pass after correcting the shared declaration
   graph and opaque-leaf/carrier admission. Acceptance also exposed a shipped
   opaque-leaf replacement undo defect, now repaired and mutation-tested. Full
   kernel is 3,277 passed plus seven expected failures, thirteen skips and one
   TODO; all framework suites, clean packages and demo pass. Complete isolated private browser/native DevTools and packed-consumer
   acceptance now pass on the final experimental archives (kernel SHA-256
   `f29d0d3bcedbe2573879f2c064f54ec96260e1c8652742103659e10cfe3a68a9`).
   The first default public registry is preserved as 69/71: development size
   and a React reference-app runtime alias failure. The alias is now corrected;
   all 26 reference tests and its production build pass. No package runtime
   changed for that fix. The development-size policy was subsequently approved as recorded in item 2.
5. After source/artifact changes stop, select an exact candidate and run the full
   release registry and release-only mutation proofs. Rebuild after mutations;
   check strict packed consumers, Angular AOT, demo/browser behavior and clean
   checkout reproduction. Then obtain exact-SHA release-environment evidence.

No item here is waived by a smaller focused suite. Publication, tagging and push
are owner-authorized subject to the verification requirements above. A changed
candidate needs corresponding
fresh verification; do not commit verification prose into a frozen RC.

## Execute

Follow [AGENTS.md](AGENTS.md), [validation](.github/VALIDATION_GUIDE.md) and
[release tooling](RELEASE_PROCESS.md). Continue within the authorized phase after
focused validation, required relevant gates, diff review and a conceptual local
commit. Do not stop for routine permission or open a new product phase by inertia.
Record exact exits, totals, artifact identity, skipped coverage and remaining
blockers. Use external logs while a candidate is frozen.

## v14 performance audit

The owner requested a separate audit of transferable v15 optimizations while
v14 remains a simpler store. See [the v14 transfer audit](docs/audits/2026-10-01-v14-performance-transfer.md).
No v14 runtime changes or new semantic machinery are part of that audit.
Local checkpoint `e189fe36` includes the audit and a durable exact-14.1.4
clear-notification reproduction. Its failing clear and passing tap control were
executed; optimization speedups remain unmeasured.

## Evidence and preserved obligations

Human comprehension sessions remain unchecked; automated tests cannot close
them. Source-comment hygiene is still listed without a closure record. Repository
cleanup, scalar construction-density investigation, restoration lifetime profiling
and additional transaction/staged-editing demo components retain their existing
deferred or separately scheduled scope; this consolidation does not promote them
all to release blockers. Solid memory characterization is explicitly absent.
`KERNEL-TYPESCRIPT-PEER-POLICY-0` was implemented by the build-tool allowlist
in `2dd94c1555`; current kernel lint passes. `OWNERSHIP-CENSUS-GATE-0` remains
a historical unresolved obligation without a demonstrated closure. It is not
registered in current release gates; that does not waive its ownership invariant
or make its historical count a newly reproduced release failure. Earlier AI discoverability
and causal-representation queues have recorded closures; do not resurrect them.

- [October 1 takeover](docs/audits/2026-10-01-performance-takeover.md)
- [Guidance audit](docs/audits/2026-10-01-agent-guidance.md)
- [Decided outstanding work](TODO.md)
- [Original release ledger](RELEASE-1.0.md): old failures, commitments and
  checkpoints preserved at their original anchors. Its old “current phase” and
  “next” headings are historical. Relevant unresolved commitments are not deleted
  by this routing change; reconcile them before claiming release completion.
- [Contributor contracts](docs/contributor-contracts.md): current compatibility,
  framework ownership, product decisions and scoped architecture records.

## October 1 continuation checkpoints

Owner paused v14 implementation until v15 work is complete. No v14 source was
changed. Existing v14 audit evidence remains separate.

The following local checkpoints preserve the independently reviewed changes
already exercised by the full kernel/framework, typing, lint, packed-consumer
and private acceptance runs above; none is an exact-RC release verdict:

- `03deb906`: projection and capture allocation reductions with positive,
  lifecycle, promotion and retention controls.
- `2892b650`: terminal replacement restoration/rollback repair and kernel/Vue
  regressions; four targeted mutations were killed.
- `5f6c68ca`: shared declaration graph and observer admission, strict all-five
  packed consumers and declaration-documentation mutation repair.
- `2051e605`: unused private structural-store implementation removed; integrity
  checks remain in tests.
- `14a06051`: production diagnostic folding and corrected advisory claims.
- `7cfc864a`: React reference runtime alias; 26 tests and production build pass.

Independent source review found no additional blocker in terminal restoration,
tooling declaration identity, materialization eligibility, or the React alias.
The owner approved the development-only entity ceiling at 25.50 KiB. The
private Studio minimum-version decision remains pending; its manifests have not
been changed.

## Full working-tree verification, before the approved budget change

At HEAD `7cfc864a` plus recorded working-tree changes, the release registry
finished **84/86 passed, 2 failed, 0 known-red, exit 1**. The failures were the
old development ceiling and historical benchmark source staging: a committed
restoration dependency was not copied. An initial bounded staging repair
exposed another missing transitive dependency; that red is preserved too.
The benchmark produced no valid performance result. Repairing its committed
dependency graph does not change its workload or required verdict.

Logs: `/private/tmp/st-takeover-2026-10-01/resume-release-gates.log` and
`repaired-gates.log`. These are development results, not a frozen candidate.

The dependency staging repair now runs all six ownership arms (three samples
each) and retains the required INCONCLUSIVE smoke verdict. A wrong-owner
mutation fails on the ownership assertion; restoration is byte-identical.
This repairs executable evidence, not the historical performance conclusion.
The approved bundle ceiling also rejects its seeded oversized-artifact mutation
(1/1 proven; zero unproven, vacuous, blind or errored).

`4d3e066b` checkpoints unchanged-child capture: 49 focused tests, full workspace
test/type/lint gates, source-construction probe and revert mutation passed.
It does not close installed-enhancer bulk overhead.

The approved budget and coherent benchmark staging are local checkpoints
`ccac4ebd` and `d40aaa0f`. The updated demo production build first exited one
inside the sandbox without a compiler diagnostic; the unchanged-source verbose
host build exited zero. The cause of the sandbox exit was not established.
Fresh production browser smoke: **146/146 passed, exit zero**. Logs are under
`/private/tmp/st-takeover-2026-10-01/resume-demo-{build,build-host,smoke}.log`.
These checks do not replace final post-mutation package and demo verification.

`53834fda` checkpoints the reviewed consumer guidance and version-bound demo
links. Six focused documentation checks pass (five registered checks in the
first selection, then the correctly named `documented-examples` check); the
first selection misspelled that name and did not execute it. Both logs are
retained. The unrelated v14 audit edit remains outside these checkpoints.
Next verification covers the complete registry and its release-only mutation
proofs, followed by destruction/rebuild of generated artifacts.

## Completed local evidence before final release preparation

Full release registry at `63e28edcfd5ec218296ef7a81fcab09c6b505f4b`:
**86/86 passed, zero failed/known-red, exit 0**. Full release mutation proofs:
**86/86 proven (14 indirect), zero unproven/vacuous/blind/errored, exit 0**.
The only subsequent change through `0bb24f3486304f38bb5a79b513724cd816683a5d`
was this controller's evidence wording.

After all mutations, generated output was deleted and rebuilt at `0bb24f34`.
All five packages reported 15.4.0; tarball resolution, strict consumers,
Angular AOT, budget, production demo and **146/146 browser tests** passed.
An isolated clean-checkout rehearsal passed frozen install, build, fast gates
and publish dry-run; that rehearsal did not run the full release registry.
Complete private Studio acceptance passed against the supplied rebuilt public
archives: query 51, adapter 365, application 522 plus one existing expected
failure, browser/native DevTools and packed consumers. No registry publication
occurred in those checks.

Raw evidence: `/private/tmp/st-takeover-2026-10-01/completion-evidence.json`.
The final metadata commit needs exact-SHA verification; subsequent verification
logs stay outside the repository. Installed-enhancer bulk overhead remains a
measured limitation, not a claimed performance improvement. No new architecture
is part of this release finalization.

## Exact-candidate Linux blocker

`26cc7ffb196e9e665bd92fff59dad8ed66412dec` passed local full gates (86/86),
mutation proofs (86/86, zero unproven/vacuous/blind/errored), clean rebuild,
packed consumers, Angular AOT and 146 browser tests. Its clean clone remained
unchanged. The authorized release branch was pushed; no tag or npm publication
was performed.

Linux Validate [36939452876](https://github.com/JBorgia/signal-tree/actions/runs/36939452876)
failed **85/86, exit 1**, at `retired-subject-slope:node-reads`. This candidate
is NOT release-qualified. Preserve the first red and follow the
[preregistered diagnostic](docs/audits/2026-10-01-retired-node-release-check/README.md).
No threshold increase or rerun-to-green is an accepted resolution. V16 integration
continues to wait for v15 publication.

The 100-process characterization on `79b754cb` completed in Linux run
[36941924557](https://github.com/JBorgia/signal-tree/actions/runs/36941924557)
with all identities/postconditions valid. The small cleanup mutation overlaps
healthy total-heap measurements; 10,000 deliberately retained handles separate
strongly. Two independent reviews support separating direct entry-cleanup
correctness from gross-retention measurement. The proposed 40 MiB check is
**not promoted**: a frozen, interleaved 150-process Linux validation is required,
plus actual deletion and revision-resurrection mutation proofs. See the audit
record for raw samples, declared blind region and exact acceptance rules. The
old release failure remains unresolved until that evidence passes review.

A separate deterministic boundary probe found late first reads recreating an
activation entry after permanent removal. The narrow fix preserves tracking for
restoration-owned tombstones. Six focused tests produced 4 failures before and
6 passes after; three actual isolated-artifact mutations each produce 0/1/0
(control/mutant/restored). Independent source review found no blocker. The first
build was terminated after emitting output (exit 1); the host build then
completed successfully (exit 0). Neither result is release qualification.
The independent Linux validation now includes this runtime fix and all three
cleanup mutation proofs. Its 150-process plan and 40 MiB threshold are unchanged.

Pre-validation checks on the corrected working tree: kernel 335 files, 3,295
passed / 7 expected failures / 13 skipped / 1 todo, exit 0; typecheck, lint
budget, spec types and bundle budget 4/4, exit 0. The successfully rebuilt
artifact passes all three cleanup mutations at 0/1/0. Driver smoke completes
9/9 with zero execution, identity or cleanup failures, explicitly not heap
qualification. Logs remain under `/private/tmp/st-late-read-fix-proof/` and
`/private/tmp/st-retention-validation-driver-proof/validation-smoke-three-mutants/`.
Next: commit this frozen validation candidate, run its independent Linux batch,
and promote the replacement measurement only if the preregistered checks pass.

## Replacement measurement qualified

Validation candidate `6e5d9aef00beea455c3ad43a69c8e1c63bce2243` passed Linux run
[36948765496](https://github.com/JBorgia/signal-tree/actions/runs/36948765496):
150/150 fresh processes, unchanged 40 MiB threshold, no execution/identity or
expectation failures, and three actual cleanup mutations each 0/1/0. Independent
review checked raw outputs, interleaving, identities and failure mechanisms.
The gross ceiling does not detect the smaller cleanup mutation; the direct
cleanup gate does. This qualifies the replacement measurement, not the release.

The old slope estimator and its unsupported asymptotic claim are retired. The
new registry contains two gross-retention arms and their real-retention proof,
plus direct cleanup and its three-mutant proof. Historical records carry dated
corrections. Next: validate the new registry wiring, freeze a new exact candidate,
and repeat complete local/Linux release qualification before any tag/publication.

Promotion checks: 5/5 new checks pass, 5/5 registry proofs pass (3 indirect),
zero unproven/vacuous/blind/errored; all 5 documentation gates pass. Logs:
`/private/tmp/st-retention-promotion/`. No threshold adjustment followed the
validation batch. The next commit is the new exact release candidate. Keep
subsequent verification logs outside the tracked tree, rebuild after mutations,
and require full local and Linux qualification before publishing 15.4.0.
