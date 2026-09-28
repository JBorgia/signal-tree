# v15 round-four follow-up — 2026-09-28

Base: `d9e1dfff`, plus the seven-file uncommitted round-four delta supplied
in the handoff. Main remains separate at `bce98e53`.

## Work completed

- Added a reporting-record lifetime regression. Before the fix, destroying a
  tree left one record (expected zero). Release now occurs after cleanup
  callbacks, including callbacks that themselves report errors. Independent
  review then exposed late-report recreation; that microtask regression also
  failed before the correction. Budget owners are now registered only after
  successful construction, released after cleanup, and cannot be recreated by
  reporting. Late/unregistered reports share one window without storing IDs.
  Independent read-only review found no further blocker in this bounded delta.
- Kept the diagnostic counter and release helper out of public entrypoints.
- Narrowed report budgeting to rate limiting, not general loop termination.
  A clock-controlled test demonstrates continued reports across windows.
- Strengthened the throwing-callback compatibility fixture to assert final
  state. It preserves v15 behavior, including overwriting an observer's later
  row value; it is not a safety proof.
- Added two failing realization-refusal consistency tests (callback failure
  and capture-release failure). History retention is explicitly enabled, so
  a zero confirmed count cannot pass vacuously.

## Decision pending; no settlement implementation changed

Both new tests measure live x=1, one executed durable consequence, no open
commit scope, zero confirmed turns, and `opened -> rolled-back` lifecycle.
The tested candidate remedy is `opened -> staged -> confirmed` with a
confirmed record, matching the new later-write refusal path. Extending that
remedy to callback failures changes observable history/restoration after an
exception, contrary to the current compatibility promise. Owner decision was
requested before implementing it. A recovery API is not being added.

## Verification to date

- Original three focused suites: 56/56, exit 0.
- Reporting fix plus rate-window and state assertions: 58/58, exit 0.
- New settlement regressions: 2/2 fail at ledger/lifecycle assertion, exit 1.
- Production source and kernel typing passes: exit 0.
- Spec-type ratchet: exit 0; 223 known diagnostics unchanged, none added.
- Full kernel: 2418 passed, 2 failed (the new refusal regressions), 7 expected
  failures, 13 skipped, 1 TODO; exit 1. 283 files passed, 1 failed.
- Scoped ESLint: exit 0. `git diff --check`: exit 0.
- No release qualification, push, tag, publication, or forward-port performed.

Raw logs are local evidence in `/private/tmp/st-*-20260928.log`.
The original pending delta was preserved in
`/private/tmp/st-round4-before-20260928.patch`.

Full artifact verification and framework parity remain outstanding. The
framework delivery-error policy (notably Vue development/production behavior)
remains a compatibility question; it has not been silently changed.

## Subsequent verification / qualification

A full rerun after lifetime registration found two introduced construction
regressions: a tracked read of public `destroyed()` added an observation token,
and an enhancer replacement did not expose that method. Both were repaired by
using construction-owned untracked lifetime state through an internal activation
closure. The four focused suites then had 67 passed and only the two unresolved
settlement failures. Full final verification must be repeated after the policy
choice and settlement repair; no green full-suite claim is made.

Framework results before that last construction correction: Angular 152 passed /
3 skipped, React 9, Vue 33, Solid 7, all exit 0. The initial direct Angular run
failed 22 tests because it omitted the project's required `--expose-gc` flag;
the corrected command and original log are both preserved.

Product recommendation: failed rollback preserves pending authority and a
usable recovery handle; only explicit confirmation releases durable
consequences. For the existing v15 no-handle automatic-failure path, consistently
recording surviving writes as committed is a containment option, not that target
product contract. No owner choice has yet been applied to settlement code.

## Owner decision and implementation

The owner approved consistent committed-on-refusal containment for the v15
automatic-abort path and requested policy alignment. The support policy,
kernel README and unreleased changelog now distinguish this exception from
explicit pending-handle rollback and from the v16 recovery target.

Rollback input preparation no longer drains the capture. Successful compensation
retires it as rejected; refusal records the surviving capture as confirmed before
consequences are released and preserves its realization descriptors. Both initial
red regressions now pass, along with callback/release successful-compensation
controls and designated undo/redo controls (40/40 in the observer-failure suite).
This supersedes the earlier decision-pending status; main is not yet ported.

## Final review corrections and verification (September 28)

- Review found that refusal consequences ran before restoration received its
  terminal lifecycle. Both callback/release controls failed with `canUndo()`
  false inside the consequence. Ledger/lifecycle now finish before consequences.
- A throwing consequence could replace the original refusal. Two red controls
  now require the refusal to remain primary; secondary failure is reported.
- Mutation proofs all failed as required: omit confirmed recording (4 assertions),
  omit committed lifecycle (2), release consequences before lifecycle (2), omit
  reporting lifetime cleanup (1). Each source mutation was restored byte-for-byte
  before the fresh artifact build.
- A late report after destruction previously recreated a dead-tree record.
  Registration now follows successful construction; destruction removes the ID.
  Detached reports share one window without retaining dead IDs. The report
  budget is a rate limit, not a guarantee that slow feedback loops terminate.
- Policy review caught an incorrect claim that explicit-handle refusal defers
  consequences. Existing v15 code deliberately releases them on both refusal
  paths (`6aaf04348`). A new direct validation-refusal characterization proves
  unchanged x=1, confirmed count=0, consequence count=1, closed commit scope,
  followed by successful confirmation of the same handle. The policy now names
  this compatibility exception. The v16 pending-consequence target is NOT met
  by this v15 path; no explicit-rollback implementation change was made.
- A proposed direct `destroyedSig.peek()` cleanup passed neutral tests but failed
  the packed Angular facade: its native carrier lacks that method. Restored the
  existing `readWritableCell` fallback. Preserve this red in
  `/private/tmp/st-policy-final-consumer.log`; source typing alone did not catch it.

Source and artifact verification before the last compatibility characterization:
2424 kernel tests passed; Angular 152 passed/3 skipped; React 9; Vue 33; Solid 7.
Typing, source checking, the unchanged 223-diagnostic spec-type ratchet, lint,
error-code, release-state, API baseline, five-package builds and packed export
resolution passed. Packed public runtime controls passed 4/4 (two links,
observer containment, undo/redo delivery, automatic refusal preserving a later
writer). The packed type/facade check first passed, then caught the direct-peek
regression above. Final corrected results are recorded below, not inferred from
those earlier passes.

### Size gate — still blocking

The first fresh bundle result was bare production 10.26 KB against 10.25 KB.
Removing redundant registry checks/lookups and consolidating report windows
reduced redundant machinery but did not clear the gate. Every red is preserved
in `/private/tmp/st-*budget*.log`; none is a waived or superseded green.
No budget was raised. Runtime repair remains uncommitted until authoritative
checks, including this size gate, pass. This is not release qualification.

Final check outputs: `/private/tmp/st-final-approved-*.log` and
`/private/tmp/st-final-approved-results.json`. The packed runtime probe and
its tarball integrity are retained in `/private/tmp/st-policy-final-results.json`.

### Final corrected results

All final checks used the current worktree delta on `d9e1dfff`; it has not been
committed or version-bumped. The source remains labelled 15.3.0, so these local
candidate tarballs are NOT the published 15.3.0 artifact.

| Check | Result | Exit |
| --- | --- | --- |
| Kernel | 2425 passed; 7 expected failures, 13 skipped, 1 TODO | 0 |
| Angular / React / Vue / Solid | 152 (+3 skipped) / 9 / 33 / 7 passed | 0 |
| Source typecheck / spec-type ratchet / lint | passed; existing diagnostics unchanged | 0 |
| Fresh five-package build | passed | 0 |
| Packed facade identities + bundler/node16 consumer types | passed after restoring native-carrier fallback | 0 |
| Packed exports/subpath consumer | passed | 0 |
| Final packed public runtime controls | 4/4 passed | 0 |
| Bare production size | 10501 bytes; ceiling 10496 bytes (10.25 KiB) | 1 |

The five-byte excess remains a real red, not rounded into a pass. Entities and
both development budgets pass. No ceiling change or release waiver was made.
The source patch remains available for review, uncommitted pending the budget.

Final tarball integrity:
`sha512-2gi4EBbLJSzGTiib2jUPYoBPmg9ubNwrRq/UQl6Uw5yNT1gYFUt9rI5ZF8AXRUzT9EwZP9QRCPgM7+5a83gOAg==`.
Runtime consumer: `/private/tmp/st-final-policy-artifact-6335662g`.
Exact size diagnostic: `/private/tmp/st-final-size-precision.log` (the same
unchanged measurement, with additional decimal places).

Policy-only checkpoints on `fix/d1-d2-forward-port`: `77946530`, corrected by
`ae6f21a3` after the explicit-refusal characterization. That branch contains no
runtime forward-port from this follow-up. Independent review found no remaining
blocker within the reviewed settlement/reporting delta; it did not independently
execute the final tests and does not override the size failure.

## Owner-approved ceiling disposition

The owner explicitly accepted the five-byte excess and requested a ceiling
update. Bare production now allows 10.26 KiB (previously 10.25); all other
ceilings are unchanged. The final fresh artifact remains 10501 bytes. Running
`node tools/check-bundle-budget.mjs` passed all four budgets, exit 0; log:
`/private/tmp/st-approved-ceiling-20260928.log`.

This closes the size blocker identified above by an explicit budget decision,
not by changing the measurement or erasing the original failed results. Runtime
and tarball verification remain the final corrected checks recorded above; only
the budget and this evidence record changed afterward. The patch may now be
checkpointed locally. Release versioning, exact-candidate CI and publication
remain separate, incomplete work; no release is claimed here.
