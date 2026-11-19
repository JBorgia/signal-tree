# Independent boundary and oracle adjudication

Recommendation: neither observation demonstrates a runtime blocker for the bounded parent-freshness proof. Correct the stated oracles within the limits below; preserve the original failures. No runtime or test edits were made for this adjudication. Main retains integration and archival authority.

## Input identities

These are frozen source identities, not claims about the current root checkout. The repository HEAD inspected was `628d302dadb082a48c58528651c9088234d0a777`; its dirty files were untouched.

- Parent proof SNAPSHOT-PROOF.json SHA256: `5cb0b3d5616b3f9d002625270ee4b6793f8ba0388f5d6327ba52fa213d789b7b`.
- Exact C8 SNAPSHOT-C8.json SHA256: `3ad1adb2de2936e52baf2ca06d630babc858d4186c2c4fed48818639056b388a`.
- C10 initial manifest SHA256: `77614b87f7be1657bf4e400a7628050e7ca57d8894a784f14f7059ec404e8dd3`.
- Counterpart snapshot SHA256: `fd91ba9e204fdec576215e5c60bc04b1723e4637a80a60c1b7ff58a7b1ec1e77`.

Manifest copies are in `identities/`. `EVIDENCE.json` gives original absolute paths and hashes of archived evidence. Seven inspected proof contract/source files were checked against the proof manifest; four inspected C10 files were checked against C10's initial manifest. All three counterpart tests were verified byte-identical between candidate and C8. The preceding implementation review verified all proof/C8 manifest files; this adjudication does not claim an independent full C10 composition audit.

## Private installed-completion reentry

The three exact fixtures install `a` through a whole-value assignment `{old,a}`. A privately registered membership-completion participant then performs `{...rows(),b}`. Candidate raw logs show only the normal-reentry final-image assertion failing: Vue line 102, Solid line 111, React line 110. Immediately after the nested assignment, soft assertions observe `{old,a,b}`; native consumers still retain prior delivery. Normal outer completion yields `{old,a}`. Throwing the sentinel retains `{old,a,b}`. C8 also fails the proposed preservation, with additional stale-read failures. These facts were independently checked in the archived tests and six final logs, not accepted solely from the producer's REVIEW.md.

**Interpretation:** this callback is after installation of member `a`, not after completion of the outer replacement. `proof-source/packages/kernel/src/lib/signal-tree.ts:1059` calls installPreparedMember inside the supplied-entry loop; `internals/materialize-markers.ts:872` completes that member's publication. The outer loop later reconciles omissions at signal-tree.ts:1306–1320. New `b` is absent from the outer supplied value and is not a stamped dormant-path reactivation. A thrown completion bypasses that remaining application work; there is no automatic rollback of the successful nested installation.

The checked-in consumer contract, `proof-source/packages/kernel/README.md:268`, says nested writes are ordinary writes, distinguishes protected absent-path reactivation, and states: “A member that is still present when written goes with the rest if that whole value then omits it, because a whole value applies its omissions after its own writes.” `internals/member-membership.ts:431–443,525–529` scopes the protection to re-add stamps. A new allocation is not that reactivation case. Extending the exception to every freshly constructed nested member is not entailed by approved reader freshness. The design example's immediate `{a,b}` result is not authority for a universal final-winner rule; the preregistered completion proof explicitly included a throwing sentinel.

**Public reachability:** registration through `registerMembershipPublication` is private source instrumentation, absent from the checked public barrels. Production has an internal membership participant in experimental-publication/private.ts, but these probes do not establish an application callback at this exact point. Do not infer impossibility either. Existing supported EntityMap tap controls do directly establish the relevant ordering for present writes versus dormant reactivation. Both were independently run and passed.

**Recommendation:** preserve original failing tests/logs. Distinguish immediate nested `{old,a,b}` from final normal `{old,a}` and final throwing `{old,a,b}`. Do not repair runtime omission behavior to enforce the unsupported blanket preservation premise. A public-route counterexample violating dormant reactivation or a separately authorized new-member precedence rule would reopen the boundary. No such counterexample was established here.

## C10 equality getter oracle

`c10-source/packages/kernel/src/lib/whole-value-new-keys.spec.ts:402–420` primes the root snapshot, then supplies `fresh:123` before `trigger:[{get x(){...}}]`. It asserts activity before mapping all observations to `[123,undefined]`. The comment explicitly permits a stale primed branch, contrary to the subsequently approved acquisition-independent fresh SignalTree reads.

**Installation order:** signal-tree.ts:972 captures top-level entries. `fresh` is a new primitive construction; `trigger` is an existing terminal array leaf. Preparation neither descends through that leaf nor invokes its nested `x` getter. The loop at :1048 installs `fresh` through installPreparedMember at :1063 before processing `trigger`. materialize-markers.ts:844–859 installs allocation, descriptors, evidence/presence and marks the snapshot before returning. The later trigger write reaches replaceLocation at signal-tree.ts:1213 and equality in tree-scalar-slot-runtime.ts:313–319. Consequently this getter is preinstallation for **trigger**, but postinstallation for **fresh**. Both reads of fresh must see 123.

**Recommendation:** change only the obsolete pair to `[123,123]` and explain installed-entry freshness in its comment. Retain the nonzero callback assertion, final value and rollback assertions. This is a direct approved expectation correction, not a license for arbitrary preparation getters to observe future values. A top-level getter evaluated by Object.entries or a diagnostic getter on a newly constructed value could run earlier; those are different fixtures.

The four inspected C10 files matched the initial manifest. The test SHA256 is `86cb44e83eb1641b2cb3eb5dd7c12bc524089ccaaf41ada5367fd7cec2bce606`. The external promoted C10 full log was unfinished when this question was adjudicated. `c10-full-run/` records its command and only a bounded failure excerpt; no final suite result or passing rollback assertion is inferred from that failed test.

## Exact execution and falsifier limits

Independently run from `/private/tmp/st-parent-freshness-implementation-independent/candidate` with Node 24.15.0 on PATH and package-pinned pnpm 10.17.0:

```sh
corepack pnpm nx test kernel absent-collection.spec.ts '--testNamePattern=a whole value that leaves an earlier omission alone|a present member the same whole value then omits goes with it' --skip-nx-cache --maxWorkers=1
```

Exact argv/environment: `own-run/COMMAND.json`; first raw output: `own-run/first.log`; result: `own-run/RESULT.json`, exit 0. Two tests passed; 90 were intentionally filtered out and provide no coverage. The positive tap-activity assertions prevent vacuous passes. The command was launched by `../run.py boundary-public-controls candidate kernel absent-collection.spec.ts` with that same testNamePattern argument.

Producer counterpart commands, preserved individually with cwd/environment in `counterparts/*-final-command.json`, were:

```sh
corepack pnpm nx test vue --skip-nx-cache parent-freshness-counterparts --maxWorkers=1
corepack pnpm nx test solid --skip-nx-cache parent-freshness-counterparts --maxWorkers=1
corepack pnpm nx test react --skip-nx-cache parent-freshness-counterparts --maxWorkers=1
```

Each ran in both producer candidate and C8 baseline. These were inspected, not independently rerun in this adjudication. Each candidate has two passes/one failure; each C8 arm three failures. Assertions blocked by the hard final-image failure are not counted as validated.

Identity collection command: `python3 /private/tmp/st-parent-freshness-implementation-independent/save-adjudication.py`. Its source is archived alongside this report. No full suite, corrected C10 test, new public new-member callback probe, or framework rerun was executed for this adjudication. No runtime, test, budget, root-checkout or frozen-input mutation occurred.
