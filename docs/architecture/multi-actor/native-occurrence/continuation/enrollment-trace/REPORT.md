# Enrollment isolation: exact proof and admission trace

**Confirmed defect: channel-local unknown survives, but its possible-owner window does not.** The undeclared second connection does not receive the declared connection's receipt or an early `declared` grant. It reaches the ordinary scheduler with `unknown:true`, no possible owners, and no blockers, then starts with basis **surviving while the foreign owner remains pending**. The declaration's globally computed native window suppression has escaped its binding scope. No oracle waiver or runtime correction is proposed/applied here.

## Source and execution

SNAPSHOT-A manifest SHA256 `b226c1d39c85e49265446b2bf83d3e5bdb64c2dae1ade93a466baceac1641e0a`, 2,963 entries. Verified Main and isolated copy against every entry before/after: zero mismatches (`IDENTITY.json`). Isolated source: `/private/tmp/st-enrollment-isolation-trace/candidate`. Main source: `/private/tmp/st-native-combined-successor/candidate`. All source citations below refer to this exact snapshot.

Unmodified five-file union: **44 pass / 12 fail**, exit1, `unchanged-first.log`. The failures are the same ten second-recipient cases, one wider-input case, and one contradiction-versus-conservative case. All18 `a1-installed-publication` controls pass; this does not qualify second-recipient isolation absent from those18.

Trace fixture only: `candidate/packages/kernel/src/lib/enrollment-trace-review.spec.ts`. It imports original test modules unchanged, wraps exported existing functions with Vitest spies that call the original implementations, and snapshots plain proof fields/object IDs to JSON. No runtime source instrumentation, replacement returns, changed assertions, timing delays or policy mutation. `diagnostic-only.patch` adds only this fixture. `trace-first.spec.ts` and `trace-window.spec.ts` preserve earlier observer versions. Calls to nativeProof/pendingOwners read existing evidence; source inspection confirms those queries do not mutate authority.

- `trace-first.log`, `events.jsonl`: seven original failures plus one useful scalar positive, unchanged outcomes.
- `trace-final.log`, `events-final.jsonl`: **7 fail / 1 pass / 43 skipped**, exit1. Adds raw window/current pending owners and ordinary scheduler entry to the same observation; unchanged selected assertions.
- `validation-trace.log`, `events-validation.jsonl`: **1 fail / 51 skipped**, exit1, original known-input contradiction case.
- `trace-spec-types.log`: repository ratcheted spec gate exit0, no baseline update; not a zero-inherited-diagnostic claim.

Initial archived-doc tsconfig warnings remain in unchanged-first.log; tests actually executed. No run is represented as green.

Commands used pinned Node24.15.0 PATH, NX_DAEMON=false NX_ISOLATE_PLUGINS=false, cwd isolated candidate:

```sh
corepack pnpm nx test kernel --skip-nx-cache publication-enrollment-invariance.spec.ts aggregate-independent-input.spec.ts aggregate-installed-publication.spec.ts aggregate-native-input-independent.spec.ts a1-installed-publication.spec.ts --maxWorkers=1
corepack pnpm nx test kernel --skip-nx-cache enrollment-trace-review.spec.ts --testNamePattern='enrollment invariance (branch|root): (before-pending|during-pending|enroll-in-updater)|ancestor updater argument wider|publishes an independent existing value' --maxWorkers=1
corepack pnpm nx test kernel --skip-nx-cache enrollment-trace-review.spec.ts --testNamePattern='native ancestor updater cannot publish pending sibling' --maxWorkers=1
node tools/check-spec-types.mjs
```

For the window trace, `trace-window.spec.ts` is the exact observer source used; final fixture additionally imports the known-input test and writes its separate validation event file. Do not rerun over existing evidence files (observer uses append).

## Earliest authority mismatch

Use lifecycle = `packages/kernel/src/lib/experimental-publication/lifecycle.ts`, private = sibling `private.ts`.

1. **Source-native fact creation is subscriber-independent but window policy is not channel-neutral.** `private.ts:120–130` consumes actual native input evidence, including `branchInputs.native`, and calls `prepareNativeRequirement`. `lifecycle.ts:139–144` snapshots the entire execution stack and sets captureWindow=false when all active frames declare complete owners and inputs are available. It does not ask which recipient the declaration authorizes. This yields a shared source requirement whose validation comes from connection C.
2. **Actual pending owner is captured, then excluded from exported proof.** `lifecycle.ts:157–165` stores the fixed raw possible window after callback-capable preparation. The unrelated foreign owner is present. But `nativeProof:121–125` exports ownWindow only if captureWindow or frameInvalid is true. C's valid complete declaration makes both false; exported possible=[] despite rawPossible=[pending foreign owner]. Horizon finish (:269–286) freezes that projection. Actual D/I/V remains source-owned evidence; declaring C does not make its empty dependency assertion a universal grant.
3. **The undeclared operation is correctly recognized but lacks its own fixed window.** `prepareRevision:205–212` finds no matching frame for connection D and initializes unknown:true. It creates no recipient-specific possible-owner window. `private.ts:271` likewise assigns fact.blockers=[]; the only available native proof has already filtered out the foreign owner. Shared validation does not turn unknown false, and no evidence says D explicitly declared.
4. **Completion preserves unknown; admission mistakes absence of blockers for terminal availability.** `private.ts:191–198,235–236` combines the nonmatching operation proof with native support; `projectRevision` retains unknown:true/possible:[]. At `private.ts:390–408`, decision.early=false but decision.pending=false. `admit` invokes the original tree-local scheduler, whose tree has no open transaction. Its callback records a per-fact/channel surviving grant. `started` reports surviving. The foreign source is still pending. This is premature fallback due to lost binding-local window, not receipt aliasing or a direct grant-set copy.

Thus the earliest channel-sensitive loss is global native captureWindow suppression followed by **nonmatching prepareRevision's failure to retain a separate authorship window**. Final admission faithfully consumes incomplete evidence. Restoring a global scan at send time would not by itself preserve the approved fixed-window semantics, and is not justified by this review.

## Concrete event chain

`events-final.jsonl`, test `enrollment invariance root: enroll-in-updater` (census40; branch enroll-in-updater is37):

| Seq | Observation |
|---|---|
| 3–4 | Declaration channel77 begins; undeclared channel80 enrolls inside updater. Foreign owner cell79 remains pending. |
| 5–8 | Shared native requirement81 has frames=[77], declared=[], captureWindow=false. Channel80 revision87 starts unknown:true. Finalization stores rawPossible=[79], but nativeProof.possible=[] and unknown=false. |
| 17–20 | Same pattern for the last equal-support component requirement94. The owner is still pending; no settlement occurred. |
| 34–41 | Undeclared revisions project unknown:true, possible=[], all D/I/V lists empty. Unknown is not laundered into clean proof. |
| 42–43 | Channel80 current fact93 reaches admission with unknown:true, blockers=[], pendingNow=[79]. Ordinary scheduler is invoked. |
| 46 / 50 | Channel77 starts declared; channel80 starts surviving. Original otherSent=[] assertion fails with the root payload. |

All six branch/root enrollment variants show the same pattern (`TRACE-SUMMARY.json`). This includes census35–40; the unchanged union also reproduces aggregate-independent-input's four parallel cases.

**Notification fallback distinction:** each enrollment case has two `publication.project` calls, but both return undefined and create zero facts because pending native units exist (`private.ts:418`). The leaking fact is a prepared native recipient revision, not a new notification-fallback revision. My initial progress wording said “no call”; the precise recorded statement is **no fallback-created fact**. A patch that only stops the stale notification payload overwrite does not address this demonstrated window loss. A shared scalar-frame change might address it, but requires these unchanged controls; this trace does not assume equivalence.

## Wider input and validation are different questions

The wider-ancestor test (`aggregate-installed-publication.spec.ts:127–133`, census5) has a matching declaration but recipient coverageUnknown=true from `beginBranchInput:138–144` / `prepareScalar:266–269`. It also retains unknown through completion, has rawPossible=[foreign cell99] but effective possible=[], and starts surviving (event21). This is the same missing conservative-window consequence for incomplete recipient coverage, not a second-recipient grant copy. The source's actual supplied native input facts are clean in this test; no speculative read is falsely claimed observed.

The actual pending sibling-read test (census6) is different. `events-validation.jsonl` shows source destination cell3 consumed as **input** on requirement4 (event4). Installation contributes it to shared validation; later requirement8 contains input=[3], validation=[3], invalid=true (event7). The independent declaration throws contradiction, and the original test fails before its expected conservative receipt assertion. This demonstrates enforced known-input lower bounds, not the enrollment leak. No waiver or new throw/receipt policy is selected here. Shared invalidation and nested validation must remain intact in any correction.

## Approved policy check

`docs/audits/2026-10-17-incumbent-readiness/link-api-proposal/PROPOSAL.md:62–79` expressly says other connections, **even on the same scalar**, do not inherit a declaration; explicit nested declarations are needed, and both share a validation horizon. Other written locations also receive no permission from C. `RELEASE-CURRENT.md:715–724` records owner approval of that proposed scalar surface at247cfec7 for a bounded native experiment, not release. `link-declared-qualification/README.md:61–65` records prior connection-local permission and explicit-nesting controls.

The original proposal alone was not authority; the later approval record is why it is relevant. Later source-native evidence and aggregate experiments do not, in the reviewed records, authorize changing declaration scope to recipient-neutral publication permission. Subscriber-independent **actual** input/validation facts and binding-local permission can coexist; sharing validation obligations is not sharing a complete empty declaration. The unchanged aggregate/enrollment fixtures explicitly require that distinction. No superseding recipient-neutral permission decision was found. No public API activation follows from these experimental tests.

## Bounded next correction gate

Preserve useful C progress and authentic D/I/V/shared invalidation while retaining the exact authorship-time possible window for an undeclared or insufficiently covered recipient. Qualify both absence and presence of second enrollment, inside-updater enrollment, disposed variants, explicit nested declarations, genuine lower-bound contradiction, confirm/reject fresh wake, remaining captured owner and later-owner exclusion. Keep terminal surviving behavior after actual blockers terminate; do not fix this by permanently suppressing unknown, copying current global pending owners at delivery, weakening tests, or turning declarations into transaction ownership. This report supplies the failure boundary, not an implementation design or runtime change.
