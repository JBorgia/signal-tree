# B recovery passes; native integration remains rejected

Exact baseline: `8d220643e0d4e34cbdbc6e55e6ef692b25d5e023`.
Separate recovery correction: `32132c6b865b46f58d6ed2807e68bc494bc2b4ca`.
Branch: `codex/native-ownership-slice`. Original comparison, A, and the original
failure remain frozen separately on sparse-ownership-integration at `0936e62b`.

## Recovery correction

The owner explicitly approved existing v16 behavior: successful abort rethrows
the callback value exactly; failed abort throws SignalTreeRollbackError with
usable recovery.transaction and exact original recovery.callbackError.
[Recovery evidence](recovery/README.md) distinguishes the prior top-level-identity
assertion mismatch from the genuine occupied-property TypeError/access failure.
41 semantic, 14 adversarial and a reviewer-added destruction control pass.
Only two conflicting assertions changed; original source/results remain sealed.
No new public API or production error semantics were introduced.

## Native experiment

The internal driver exercises actual SignalTree scalar, member and restoration
installations. It does not install transactions() or retain incumbent compensation
as a second settlement engine. No package entry point exports the driver.
Native slots/descriptors own current truth; only pending locations retain hidden
base facts/contributions. An owner-to-location index limits settlement traversal.
This is a bounded production-path experiment, not full public transact integration.

Preparation hooks cover ordinary scalar commits, raw frames and existing-member
descriptor changes. Terminal contribution records are deleted. Owner invalidation
follows installation and owner retirement. Hooks add unconditional research cost;
no package/performance acceptance is claimed.

### Independent Nx replay: 11 pass / 2 fail

| Failure | Observation | Boundary |
| --- | --- | --- |
| Dynamic creation escapes responsibility | Rollback returns but the new present-undefined member remains | materializeMember directly defines accessor/backing descriptors, links child and updates index, bypassing setMemberPresence |
| Path delivery omitted | Direct read is1 after rollback; subscriber sees [3], not [3,1] | Raw frame commit plus owner invalidation does not perform path notification |

Dynamic materialization is an existing internal production route also exercised
by dynamic-member and Link tests. It differs from unknown keys on fixed-schema
public setters, which correctly emit ST2010 and discard the write. Marker snapshot
warnings remain in logs; the failing assertion reads the branch directly. Neither
final counterexample requires fault injection. The dynamic fixture uses an internal
marker processor, not a demonstrated ordinary public application trigger.

Passing controls cover restoration undo before later pending rollback, useful
overlap, newer ordinary truth, absence versus undefined, omission/reacquisition,
held-leaf same-value activation, preparation failure/retry, abort recovering an
earlier admitted operation, failed-abort recovery, owner-observer reentry and one
pending-undo reconciliation case.

The owner-observer assertion requires one coherent snapshot and surviving callback
write, but does not exclude all additional incoherent snapshots. Returned internal
responsibility closures mutate maps after native installation; general allocation-
failure atomicity is unproved. Full public lifecycle, inspection, tree destruction,
entities, Link semantics and four-framework integration are not established.

## First failures and review

Archive native-evidence.tar.xz retains first logs/source checkpoints:

- Initial pnpm launcher refused an unsafe shared node_modules operation: tests
  NOT EXECUTED; no dependency removal occurred.
- First executed Nx: 4 fail/1 pass; missing neutral-runtime binding was corrected.
- Second: 7 pass/1 fail; unknown fixed-schema creation expectation was a fixture
  mismatch, preserved and replaced with the actual unsupported-shape control.
- Initial whole-branch atomicity assertion was stronger than the existing contract.
  Its source remains preserved. Final control requires abort recovery of every
  admitted installation after a later preparation failure, without new grouping semantics.
- Third: 9 pass/1 fail; owner publication missing, corrected with existing marker
  after terminality. Fourth: 10 pass/1 fail, supported dynamic creation remains.
- Final: 11 pass/2 fail after adding path notification discriminator.

Independent review reran the unchanged final test: same11/2. Its first sandbox
attempt returned Operation not permitted before tests; approved escalation then
ran. Root verified source boundaries, raw outputs and all seven source hashes.
Review identified the assertion/closure limits above. No source/assertion changed
after independent replay. Evidence packaging itself initially encountered an
automatic approval-review timeout before execution, not a safety finding; the
same authorized save was retried once as explicitly permitted.

## Disposition and remaining work

Recovery stands; this native slice is rejected. B remains a leading hypothesis,
not an accepted engine. These are incomplete installation/publication boundaries,
not evidence that a permanent canonical mirror is required. A remains unchanged.
No merge, push, tag, publication, public API acceptance, v15 release or ceiling change.
Runtime changes remain isolated experimental source on this branch.

Broader kernel/framework suites, typecheck, spec-types, lint, package/demo builds
and CPU/heap/bundle comparisons were NOT RUN because focused semantics failed.
Any next revision must prepare creation descriptor/index/dependency facts before
installation and publish through both path and owner channels. Preserve the two
red assertions and useful controls; no post-hoc mirror or compensation fallback
has been established as a repair.

## Replay

Use Node24.15.0 and pnpm10.17.0 from the worktree root:

```sh
NX_DAEMON=false pnpm nx test kernel --testFile=src/lib/native-ownership-experiment.spec.ts --skip-nx-cache
```

Expected exit1: two preserved counterexamples. Exact launcher/environment are in
archived WORKER-RESULT.md. Recovery-only commands in recovery/README.md pass;
the preserved pre-destruction-fix probe intentionally fails. First failures and
unexecuted runs are separate evidence.
