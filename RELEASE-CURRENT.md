# Current work — v16 integration qualification (HOLD)

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
for routine corrections within them. New semantic changes,
activation, push, merge and publication are not authorized by this controller.
Stable v15 remains untouched; rejected B remains closed.

Owner subsequently accepted production/package size as a tradeoff and authorized
the recommended finite path: lint and benchmark hygiene; three bounded transient
work optimizations (preliminary proof, native-only composition, unique-subject row
snapshots); matched measurements; a representative application exercise; final
qualification. Numerical size gates remain reported failures, with owner disposition;
no ceilings are raised. Runtime cost and point-work obligations remain open.

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
| I1 | Select and seal one integration source | Durable runtime/tool checkpoint `95bae1fa`; source `ccf592c805de`; final documentation/evidence reconciliation is local only | Closed for review: five-package artifact seal and archive identities in final disposition; no release acceptance |
| I2 | Permanent regression quality | Successor11/11; cold dispatch-revert kills both cold cases; assertion/sink controls retained | Closed within documented scope and predecessor identity/equivalence bindings; no weakened assertions |
| I3 | Types, lint and installed consumers | Current source/spec types, approved API baselines, source controls, installed AOT, strict consumers, SSR and checker lint pass. Expanded lint passes0 errors / 11 warnings (nine projects), with the ratchet tightened from19; source/spec types pass | Lint closed: preserve initial247/177 and earlier246/173 results; scoped intentional finally exceptions retain error precedence. Fresh consumer qualification follows the runtime trials |
| I4 | Large replacement/restoration | All 13 original cases pass in disjoint partitions, including all four 130,000-row cases; four smaller screens are separate | Closed functionally on selected source. Preserve original 2 GiB operational stop and later 4 GiB/25% host-metric protocol; no memory-efficiency claim. Reuse unchanged partition in I7 |
| I5 | Point-work requirement | Tested size independence passes;13,000 counted iterations still fail `<2000` after the bounded trials | HOLD: meaningful reduction or explicit owner disposition required; no new threshold/SLO adopted |
| I6 | Artifact and populated costs | Fresh bare 17.84/20.16 KB and entities 43.04/46.64 KB fail all four ceilings; fresh demo805.15 kB exceeds570 kB. Representative cost 84 assertions pass, costs remain materially higher in tested ordinary-store workloads | Size has explicit owner disposition; unchanged numerical ceilings remain reported failures. Runtime-cost HOLD: fresh matched before/after measurements pending; no runtime-cost waiver |
| I7 | Full integration qualification | Current kernel7,184 ordinary / 5 expected / 12 skipped plus the same absolute-work failure; all four framework suites pass freshly. Demo175 pass / 4 skipped; construction-only timing hygiene7/7 pass with unchanged limits. Development browser 27 pass. All 16missing baselines receipted.84 selected gates proved;0 unproven/vacuous/blind/errors after scoped repair | HOLD: three failed baselines excluded from mutation proof. Fresh 193-file artifacts reproduce seal; final tarball/types/AOT pass. Historical stops/setup failures retained; no full-release pass |
| I8 | Consumer readiness and release disposition | Declaration/error API, native-reader migration, source/document dependency closure and developer workflow are durable; current installed consumers and development browser pass | Release HOLD. Production demo/browser and fresh artifact qualification are in progress; runtime costs and point work remain unresolved. Lint/timing are closed within their tested scope; size has owner disposition. No activation/push/merge/tag/publication |

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

- [Final disposition](docs/audits/2026-11-03-progress-and-workflow/completion/DISPOSITION.md)
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
