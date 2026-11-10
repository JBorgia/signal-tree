# Current release decision — packed v16 NO-GO

Updated November 10, 2026. This is the single active acceptance ledger. Historical
first failures and sealed predecessors remain evidence, not competing queues.

## Current disposition — reject the packed candidate

The owner authorized application-based ordinary budgets, an equivalent
coordinated-workflow comparison, and a clear release decision. The
[completed acceptance audit](docs/audits/2026-11-10-release-economics/README.md)
rejects packed runtime `b6acda57552affb0fdcbc0b40f1996c4345ed5d8`, evaluated from
source checkpoint `1a6225a386825c12f60d799a59db34c6341cc1e2`, for general v16
production. This is a **NO-GO**, closing the current candidate decision rather
than maintaining an undecided HOLD.

The final 60 ordinary and 24 coordinated children preserve exact artifact
identity and all first failures. Warm ordinary operations and the specified
ordinary live-state heap fit the new budgets. Job-store first initialization
exceeds 25 ms in five of five comparison children. Equivalent coordinated
work passes its observable contract but the start stage exceeds 4 ms in five
of five children; eight pending sessions exceed the 32 MiB allocation in five
of five. Destroyed derived-state roots also remain retained, with an isolated
actual-app snapshot proving a strong finalizer path. Related retention exists
in v15; this is not attributed to packed field storage.

No budget or semantic requirement was weakened. The candidate is not approved
for activation, merge, tagging or publication. The previous size disposition
remains valid and is not a reason for this rejection. Full release promotion
gates are unnecessary to reject a candidate already failing mandatory
acceptance; focused witness, documentation and production-demo checks are
recorded separately, without claiming release-green.

A future candidate must address coordinated pending-state representation,
coordinated start preparation, destroyed derived-dependency retention, and
first-use construction under these same workloads and budgets, then complete
exact-artifact qualification. The bounded alternative demonstrates that the
measured costs are not an established unavoidable price of the exercised
guarantees. It does not implement every v16 contract or authorize an API/semantic
redesign. Stable release-line source is unchanged. No further micro-optimization
queue is opened by this disposition.

## Historical goal and authority

Implement the approved [multi-actor product plan](docs/architecture/multi-actor/PLAN.md)
through supported framework-native APIs and one kernel authority. Backend
authentication/durability and private Studio retain their existing boundaries.
Stable v15 remains untouched; rejected B remains closed.

The owner authorized integration, qualification, documentation/workflow cleanup,
then accepted production/package size and authorized the finite recommended path:
lint/benchmark hygiene, three bounded transient-work trials, matched measurements,
a representative application exercise and final qualification. That path is now
complete. Size has explicit owner disposition; numerical ceilings remain unchanged
and failed results remain reported. Runtime-cost acceptance and the absolute
point-work bound have no owner disposition. New semantics, activation, merge, tag and publication remain unauthorized.
The owner subsequently authorized pushing the work to a review branch:
`codex/v16-runtime-attribution` at9a9770a63 is now on origin. Sharing reviewed
work does not grant merge,activation or package-publication authority.

## Authorized attribution follow-up — complete

The owner subsequently supplied the qualification review and authorized its finite
runtime-responsibility attribution experiment. The measured candidate3eabc01dd
(runtimefe18) stayed frozen. A separate `codex/v16-runtime-attribution` worktree
reconciled all55paths/13,000visits and tested one detached-image reuse prototype.
It removed400visits but still failed the unchanged `<2000` bound at12,600. A late
consumer counterexample proves earlier history cannot simply be omitted; it does
not prove the remaining representation mandatory. Fresh84-child uninstrumented
measurements establish no wall/CPU/persistent-heap recovery under the registered
rule. The prototype is unadopted and runtime restored. General release HOLD
remains; no activation, push, merge or publication. No next execution queue opened.

[Attribution report, source review bundle and replay evidence](docs/audits/2026-11-03-runtime-responsibility-attribution/README.md)
preserve raw counts, first failures, exact artifacts, independent review and
separate cost dimensions. The earlier controlled-pilot assessment grants no
activation authority. Current outer mutation proof remains pending.

## Architectural alternatives — completed first admission screen

The owner supplied the architectural-alternatives review. A separate
`codex/v16-sparse-responsibility-0` worktree investigated the proposed first
contract-preserving family without selecting or implementing a replacement.
A new counter discriminator observes5000 of13000visits before native preparation.
A native-only field/window replacement with that prefix unchanged cannot clear
the existing `<2000` gate. At that checkpoint an integrated producer/value/topology/admission
mechanism remained unspecified; the subsequent bounded implementation is below.

Fresh integrity-verified npm15.4.4 measures800visits versus frozenv16's13000
on the shared originalcounter. A separate24-child ordinary baseline comparison
classifies v16 construction/point wall+CPU and populated live heap higher under
its registered descriptive rule. It does not establish capability parity or
unavoidable semantic cost. One copied build-receipt metadata defect is preserved
and corrected by a separate provenance sidecar; raw registrations/data are intact.

[Architectural admission evidence and limitations](docs/audits/2026-11-03-architectural-alternatives/README.md)
record the5000prefix,semantic baseline oracles,actual released artifacts,rawcosts
and independent reviews. Candidatefe18 stays frozen; no thresholds/semantics
changed and no architecture is promoted. Further code requires a concrete
integrated mechanism against the listed counterexamples,not another native-only
optimization or automatic84-child campaign. General release remains HOLD.

## INTEGRATED-POINT-0 — complete; rejected for advancement

The owner then said “proceed”. The [isolated integrated experiment](docs/audits/2026-11-03-integrated-point-runtime/README.md)
was specified, independently reviewed, implemented and measured. It passes the
unchanged original point-work bound at 1,800 visits for both 2,000/20,000 rows,
versus frozen fe18's 13,000. Fresh 48-child matched measurements classify point
synchronous CPU lower (180.387→55.417 ms), but populated live-minus-baseline heap
higher (17,757,072→19,956,008 bytes) and pending live-minus-idle heap higher
(1,032,976→1,086,040 bytes). Construction timing is unresolved. The registered
conjunctive advancement rule fails: CPU cannot compensate for heap regression.
No favorable retry or second representation experiment was run.

Final types/spec types, focused lint, scoped kernel witnesses and all four
framework suites pass. Five known-bad controls were killed at their recorded
source state. Original lint and Solid fault-calibration failures, corrected
fixture proof on original runtime, unchanged size failures and all raw receipts
are preserved. Public API/callable/barrel/import checks pass; full outer mutation
and full release qualification are not newly claimed.

The review branch `codex/v16-sparse-responsibility-0` retains the **unadopted
experimental runtime** for inspection. It is not restored runtime fe18 and is not
promoted into the frozen candidate. Measured source `6a0a70ecea51` binds the runtime
and fourteen replay-verified changed/new package files; final closure edits are
audit/controller-only. General production/release HOLD remains. No merge,
activation, tag or package publication. No second execution queue is opened.

## FAST-POINT-DUAL-MAP-0 — complete; necessary endpoints pass, cost HOLD

The owner supplied the eef7dfc0b review and selected the bounded dual-Map
experiment. [Candidate C and exact evidence](docs/audits/2026-11-04-fast-point-dual-map-runtime/README.md)
retain the point pipeline while restoring separate field Maps. The unchanged
point bound passes at 1,800 visits. A new 48-child matched screen classifies
point synchronous CPU lower (69.354→31.470 ms) and populated live-minus-baseline
heap lower by 32,144 bytes (17,757,224→17,725,080; −0.181%). Both pinned endpoints
clear their registered variability rule. The saving is small, not object attribution.

Overall runtime-cost HOLD remains: pending live-minus-idle heap rises 6.12%,
point drain time rises, and total point CPU/construction are unresolved. No gain
compensates for those results. The fused cohort was neither rerun nor pooled.
C is retained for further qualification, without promotion into frozen fe18,
merge, activation, tag or package publication. No new optimization queue is opened.

Final kernel: 7,205 ordinary passes, five expected failures, twelve skips across
658 files. Types/spec types, zero-warning focused lint, all four facades and
public API/callable/barrel/import checks pass. Two known-bad runtime controls
were killed and exact source restored before measurement. Initial missing-factory
fixture failures and eight obsolete positive-allocation diagnostic floors are
preserved. Stronger in-window calibration and patch-removal controls pass both
candidate and original runtime; no behavioral assertion or point ceiling is removed.
A fresh post-diagnostic build reproduces all 193 measured package bytes. Original
cost source c5aacad and qualified test source 51b1a4a remain separately bound.
Unchanged size failures retain the owner's disposition; outer mutation, installed
consumers and production-browser qualification are not newly claimed.

## V16-PENDING-DRAIN-ATTRIBUTION-0 — diagnostic complete; no repair selected

The owner supplied the Candidate C review and selected attribution before any
optimization, then complete qualification. [Registered diagnostics and results](docs/audits/2026-11-04-pending-drain-attribution/README.md)
complete82/82 scheduled children with no source/input drift or resource failure.
Covered point completions are synchronous, with no added direct scheduler queue;
pending callback counts match. The snapshot pending-increment difference is
chiefly code/VM metadata, with no growing preparation-context population. These
are bounded observations, not a historical drain-CPU explanation or exact owner
storage partition. Fresh diagnostic economics remain unresolved; prior cost
cohorts are neither replaced nor pooled. No safe runtime repair is demonstrated,
so C9aa and frozen fe18 remain unchanged. No owner-journal redesign is opened.

[C qualification record](docs/audits/2026-11-04-candidate-c-qualification/README.md)
is now recorded on `codex/v16-pending-drain-attribution-0`:86 normal passes plus
the owner-dispositioned numerical size failure; full kernel7205ordinary passes,
all four frameworks and both apps; outer runner87/87 proven with the baseline-red
size-control caveat. Restored-source clean build reproduces all193 original C
package bytes/modes. Final installed consumers/AOT pass. All9 production-browser
files execute:137passes, one accepted-size failure, no skips/flaky results.

Fresh24-child released npm15.4.4 versus C measurements all validate without drift.
Common ordinary construction sync CPU is101.742→767.993ms (7.55×); point total CPU
13.444→55.972ms (4.16×); populated live-minus-baseline heap4,725,192→17,724,528B
(3.75×). These classify C higher under the registered descriptive rule; drain is
unresolved. They compare shared outcomes, not capability parity or unavoidable
semantic cost. Earlier frozen/C cohorts remain separate. Passing the point-work
bound does not close the cheap-ordinary-state goal. Runtime-cost acceptance and
adoption remain ungranted. This finite qualification is complete; no further
execution queue, merge, activation, tag or publication is opened. Review-branch
push remains authorized. The default-worker resource stop and setup failures are
recorded. One-worker orchestration changes no runtime or test assertions.
The diagnostic archive is sealed. The temporary qualification payloads were
unavailable at closure, so qualification is backed by the surviving summaries,
manifests, distributions, and reviews. The audit proposes separate ordinary
and coordinated performance criteria. No new thresholds have been adopted.

## Candidate C construction and heap attribution

The [construction and heap audit](docs/audits/2026-11-10-candidate-c-construction-attribution/README.md)
locates the ordinary construction gap in EntityMap population, especially
general frame, topology, and publication preparation. The populated snapshot
identifies the ordinary and physical publication indexes as the largest storage
cost. The two hypotheses for a follow-up are less per-edit preparation for
unique fresh subjects and a compact representation of aligned current evidence.
Preserve late acquisition, independent publication, snapshot isolation,
bounded point work, and reclamation when testing either. Runtime source
remains at C and production remains HOLD.

## Frozen candidate and execution identity

- Selected durable worktree: `/Users/jonathanborgia/code/signaltree/.worktrees/v16-integration-candidate`,
  branch `codex/v16-integration-qualification`.
- Current runtime/tool checkpoint: `fe18a8e1c1f3da42727341d6c6fa30a407c1461e`.
  `d343e93d8` is the separately preserved first trial cohort; sealed pre-trial
  candidate `c2127a34` is the current before arm. Original gitless `13d970ef…`
  and retained production `87f6831f` remain frozen historical identities.
- Qualified source manifest: `ab8cb3731fe647d220d03e988793889dbbaac9b2faefeba10ef13e4ded36333d`.
  Final document/evidence edits are separately bound by the improvement source
  manifest/equivalence record; they change no runtime or packaged documentation.
- Fresh five-package artifacts: 193 files, seal
  `sha256-7892fe8daaff3c11fce09d3d5f2a4614ad5cadb45bdb0b8369ab94450a7940d9`.
  Deleting dist and rebuilding after all 24 companion controls reproduces the
  stage seal. Installed consumers and production-browser checks use these inputs.
- Root `fix/d1-d2-forward-port` at `628d302d` is coordination, not this runtime.
  Main retained the sole heavy slot. Execution is complete; the final owned
  PID/birth census reports no survivors. No other execution queue is authorized.

## Finite acceptance table

This table describes the frozenfe18 candidate. The rejected isolated prototype
above does not replace its runtime or acceptance status.

| ID | Obligation | Current status | Disposition / closure evidence |
| --- | --- | --- | --- |
| I1 | Select and seal one integration source | Current code fe18, source ab8c, 193-file seal7892; final docs separately bound | Closed for review; no release acceptance |
| I2 | Permanent regression quality | New focused trial witnesses17/18/41; current full kernel includes their seven added tests. Prior successor/mutation evidence remains under its original identity | Closed within documented scope; assertions and positive/negative controls retained |
| I3 | Types, lint and installed consumers | Current source/spec types pass. Expanded lint0 errors/11 warnings across1440 files in9 scopes, ratchet tightened from19. Tarball, strict bundler/Node16-resolution, facade identity/SSR and installed Angular production AOT pass | Closed within exercised scope. Original247/177 and246/173 lint failures remain preserved. Four deliberate finally throws retain exact-line rationale and error precedence |
| I4 | Large replacement/restoration | Original partition evidence retained; current complete kernel includes the large-batch suites, with no failure there | Closed functionally within tested cases. Preserve original2GiB stop, later4GiB/25% host protocol and current combined-invocation stop; no efficiency or universal memory bound claim |
| I5 | Point-work requirement | Current13,000 counted visits across200 updates at both2000/20000 rows; `<2000` still fails | HOLD: tested size independence passes. Reduce fixed work or obtain explicit owner disposition; no threshold changed |
| I6 | Artifact and populated costs | Fresh bare17.95/20.28KiB, entities43.22/46.83KiB and demo807.45kB retain numerical overages. Size is owner accepted. Final84-child before/after comparison supports lower bare wall time only; CPU/other timing mostly unresolved; persistent populated heap not recovered | Size disposition closed. Runtime-cost HOLD. Both cohorts/raw samples remain separate; no new SLO, per-trial attribution, fresh v15 comparison or runtime-cost waiver |
| I7 | Integration qualification | Current kernel7184 ordinary/5 expected/12 skipped plus point failure; all four frameworks, reference app and demo175/4skip pass. Fresh24 companion controls and62 normal baselines:85 pass, one accepted size failure. Production browser28 pass | Current scoped qualification complete. Full outer mutation proof is not claimed fresh; predecessor proof stays bound to its source. No full release-green or coverage-percentage claim |
| I8 | Consumer readiness and release disposition | Current packed consumers and production-built inventory/publication workflows pass; source/document/evidence closure is durable | Controlled-pilot candidate. General production/release HOLD for I5/I6 and final release proof. No activation/merge/tag/package publication; review-branch push authorized |

All obligations must close or receive an explicit authorized disposition before
release. Completing this finite phase does not silently accept runtime costs or
convert a failed numerical check into a pass. Future representation work needs a
bounded question and independent review; the completed trial list is not an
open-ended architecture search.

## Evidence and preserved history

- [Current improvement report and replay evidence](docs/audits/2026-11-03-progress-and-workflow/improvement/README.md)
- [Current handoff](docs/audits/2026-11-03-progress-and-workflow/HANDOFF.md)
- [Pre-trial sealed disposition](docs/audits/2026-11-03-progress-and-workflow/completion/DISPOSITION.md)
- [Prior takeover](docs/audits/2026-11-03-progress-and-workflow/TAKEOVER.md)
- [Original audit](docs/audits/2026-11-03-progress-and-workflow/README.md)
- [C28 index](docs/architecture/multi-actor/native-occurrence/continuation/C28-STATUS.md)
- [Product implementation](docs/architecture/multi-actor/IMPLEMENTATION.md)
- [Original controller](docs/archive/2026-11-03-active-queues/RELEASE-CURRENT.md.before.txt)
- [Original TODO](docs/archive/2026-11-03-active-queues/TODO.md.before.txt)
- [Archive hashes](docs/audits/2026-11-03-progress-and-workflow/QUEUE-ARCHIVE.json)

The unrelated root `.gitignore` edit and untracked `frontier` remain untouched.
