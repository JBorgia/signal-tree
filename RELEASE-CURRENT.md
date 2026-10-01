# Current release work

Updated October 1, 2026. This is the active controller for the public
`fix/v15-link-settlement-diagnostics` worktree, currently **15.4.0 unreleased**.
It does not describe every branch. Publication authority is recorded below.

## Owner priority and release authority

The owner authorized publishing v15 when ready, then continuing in this order:

1. Finish and verify the v15 release, then publish its exact verified artifacts.
2. Reconcile fixes and their tests together on a dedicated v16 integration branch.
3. Preserve v16 inspection, recovery and current-truth observation contracts.
4. Run the complete semantic matrix against that integrated baseline.
5. Evaluate remaining ownership-model changes against the stronger incumbent.
6. Measure v16 performance and size independently; v15 measurements and the
   approved v15 development ceiling do not transfer.

V14 remains paused until v15 is complete. Public release authority now includes
pushing the release branch, signing/tagging and dispatching the canonical npm
publisher after verification. It does not waive failed gates or authorize a
private Studio compatibility change. The latter decision remains pending.

The prepared version is already **15.4.0**. Do not invoke a next-version command
that would increment it again. Finalize this version's release metadata, commit
it, verify the exact candidate locally and on Linux, prepare its immutable
archives with `scripts/publish-candidate.mjs --prebuilt --prepare-only`, then use
the signed tag and canonical tagged CI publisher. Preserve the unrelated v14
audit edit; use a clean isolated checkout for release verification.

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
