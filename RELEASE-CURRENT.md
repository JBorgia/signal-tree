# Current work — v16 integration qualification

Updated November 3, 2026. This controller is the single active acceptance ledger.
It supersedes historical next-step lists, not frozen semantics or first failures.

## Goal and authority

Implement the approved [multi-actor product plan](docs/architecture/multi-actor/PLAN.md):
accountable changes, truthful review, safe settlement/recovery and delivery through
supported framework-native APIs. Optional integration must not become a second
kernel authority. Backend authentication/durability and private Studio retain their
existing boundaries.

Owner authorized completing integration, qualification, documentation and workflow
cleanup. Existing semantic/API approvals remain valid. No new permission is needed
for routine corrections within them. Budget increases, new semantic changes,
activation, push, merge and publication are not authorized by this controller.
Stable v15 remains untouched; rejected B remains closed.

## One candidate, one heavy-job owner

- Selected input: frozen source manifest `0af649ba10c55e784d95ae323dcde8322ba018e465110c2a70a36ea2d4cb3949`;
  runtime manifest `812a3ad5`. These are source hashes, not Git commits.
- Selected integration source: durable local worktree
  `/Users/jonathanborgia/code/signaltree/.worktrees/v16-integration-candidate`,
  branch `codex/v16-integration-qualification`, honest parent `628d302d`.
  Original `/private/tmp/st-v16-integration-candidate` is frozen at source manifest
  `13d970efeaf113d9ab046f0495b863d0e69c159b5dab4f4e1fefd344f8fe892c`.
  Successor manifests/commands: `/private/tmp/st-v16-takeover-evidence/`.
  Current scoped corrections update approved API baselines, namespace reachability,
  eight unused internal helpers, demo declaration-error handling and document closure.
  The initial cleanup build matched all 193 artifacts. The current build has
  142/143 JavaScript files byte-identical to 13d; private.js differs only by
  the reviewed `let enabled=true` to `const enabled=true` binding. Six packaged
  documentation copies changed. Immutable manifests and an explicit equivalence
  bridge preserve predecessor evidence without calling its measurements fresh.
- Root `fix/d1-d2-forward-port` at `628d302d` holds coordination/product evidence;
  it is not the integration runtime. Retained production remains `87f6831f`.
- The fresh takeover chat owns the only heavy execution slot. Noether completed
  its final handoff and is idle, with no surviving owned processes. Independent
  reviewers remain read-only. No other execution queue is authorized.
- Preserve frozen predecessors. Each changed source invalidates only the dependent
  evidence until final exact-candidate qualification. Do not sum passes across
  candidates or report an infrastructure error as a runtime result.

## Finite acceptance table

| ID | Obligation | Current status | Next action / closure evidence |
| --- | --- | --- | --- |
| I1 | Select and seal one integration source | Durable successor selected from verified `13d970ef`; build output unchanged after scoped cleanup | Verify final source and preserve dependent qualification identities |
| I2 | Permanent regression quality | Successor 11/11 passes; cold-only dispatch-revert mutation fails both cold cases as intended | Preserve first outcomes and verify final mutation classification; no weakened assertions |
| I3 | Types, lint and installed consumers | Current source/spec types, exact approved API baselines, installed AOT, framework consumer closure, SSR and source controls pass. Full configured lint gate fails: 246 errors/173 warnings vs19, across seven projects | Keep first 247/177 result. Close lint with behavior-preserving cleanup and error-precedence validation; no warning-baseline increase. Final post-mutation consumers remain required |
| I4 | Large replacement/restoration | All 13 original cases pass in disjoint partitions, including all four 130,000-row cases; four smaller screens are separate | Closed functionally on selected source. Preserve original 2 GiB operational stop and later 4 GiB/25% host-metric protocol; no memory-efficiency claim. Reuse unchanged partition in I7 |
| I5 | Point-work requirement | Sampled size independence passes; `<2000` absolute proxy fails at 13,000 | Keep scaling/mutation controls; finite representative characterization completed, without a new numeric SLO. Absolute proxy rationale remains unresolved; no silent threshold change |
| I6 | Artifact and populated costs | Four package ceilings still fail. Matched pre-page/overlay demo builds are 683.40/805.14 kB against570 kB. Representative cost84 assertions pass but ordinary-store CPU/heap increases remain undisposed | Prior cost figures retain original artifact identity; constant-binding bridge is not new measurement. Final current demo build follows mutations. No ceilings changed |
| I7 | Full integration qualification | Kernel partition: 7,177 ordinary passes,5 expected failures,12 skips; absolute-work failure remains. Frameworks pass as preserved. Complete demo:173 pass/2 timing failures/4 skips. Development browser:27 pass. All16 missing canonical baselines now have receipted passes | First bounded-history watchdog census failure and first900s precheck-batch interruption remain preserved without full-pass credit. Finish outer mutation proofs on clean baselines, forced fresh artifacts and installed consumers; no full-release pass claim |
| I8 | Consumer readiness and release disposition | Approved declaration/error API, current-reader migration and demo guidance are composed; prior strict Bundler/Node16 guidance plus current installed AOT and development workflow pass | Final disposition is HOLD while costs, ceilings, absolute work, full-demo timing and lint remain unresolved. Mutation/artifact closure pending; no release authority granted |

All rows must close or receive an explicit authorized disposition. Unreachable
hypothetical paths are not extra gates without a supported-path counterexample.
Known policy failures remain failures until resolved; this is not a waiver.

## Cleanup rules for this execution

- TODO points here; do not duplicate this table in another active queue.
- Keep historical first failures and exact replay evidence. Consolidate test setup,
  fixtures and orchestration only when assertion coverage, lifecycle isolation and
  mutation sensitivity remain intact. Similar titles are not proof of redundancy.
- Separate graph/config setup from fresh workload processes. Test-result cache
  reuse cannot stand in for fresh verification. Record phase, source, command,
  status and owned-process cleanup; do not retry infrastructure failures silently.
- Review consequential mechanisms and interpretation independently. Routine
  equivalent edits need proportional checks, not another architecture process.
- Give bounded reviews a concrete question and closure condition. Parked research
  is not an automatic backlog. Reuse already granted authority.

## Evidence and preserved history

- [Current takeover and scoped corrections](docs/audits/2026-11-03-progress-and-workflow/TAKEOVER.md)
- [Audit and finite-path rationale](docs/audits/2026-11-03-progress-and-workflow/README.md)
- [C28 evidence index](docs/architecture/multi-actor/native-occurrence/continuation/C28-STATUS.md)
- [Product implementation](docs/architecture/multi-actor/IMPLEMENTATION.md)
- [Original controller](docs/archive/2026-11-03-active-queues/RELEASE-CURRENT.md.before.txt)
- [Original TODO](docs/archive/2026-11-03-active-queues/TODO.md.before.txt)
- [Archive hashes](docs/audits/2026-11-03-progress-and-workflow/QUEUE-ARCHIVE.json)

The original documents are byte-preserved; their relative links retain their old
root-document context. They are evidence, not instructions to execute old next lists.
The unrelated untracked `frontier` remains untouched.
