# Occupancy success fixture: valid supported inverse found

Recommend the test-only setup in `proposal/packages/kernel/src/lib/occupancy-successor-realization.spec.ts` (`OCCUPANCY-SETUP.patch`) for Main's review and composition replay. The intended success is possible on exact C11 without changing runtime or admission policy. The standalone strengthened fixture passes every original success assertion and adds explicit ordinary-state pre/post checks. Original source and failure remain intact. This is not a refusal-only rewrite.

Main's host-local review of the preceding three-file reconciliation was read and copied to `MAIN-REVIEW.md`. It accepts those edits boundedly, with replay required. This resolves that packet's previously pending independent review via the authorized local route. External attempts/rejection remain in the preceding packet; no new external submission or permission request occurred.

## Legitimate setup

1. Seed original lifetimes a7,b8,c9 and hold a/b/c as before.
2. Begin a public transaction. Ordinarily remove a. Under the original fixture's inspection context, move old b to bb and present physical order c,bb with b88. Add a **fresh** b43 normally. Existing ordinary destination displacement removes old b from ordinary membership; it does not remove old b physically at bb.
3. Outside the transaction, inspection-remove the fresh b. Before attaching taps, physical state is exactly c,bb; held old a is absent, held old b is at bb with88. Old a and old b are ordinarily absent; fresh b remains ordinarily present despite its inspection-only physical removal.
4. Attach the original taps, then call the real transaction's `rollback()`. Its authentic inverse removes fresh b's ordinary contribution, revives old a, and transfers old b back to b.

The read-only `__validateOrdinaryStructure` probes assert ordinary absence/presence by checking whether a removal of each known lifetime would be admitted. They do not mutate, install, authorize, or fabricate the inverse. Before rollback: old a=false, old b=false, fresh b=true. After: old a=true, old b=true, fresh b=false. The transaction also has at least two recorded changes; the fresh handle differs from old b. This is not a vacuous empty transaction.

The inverse is the public transaction rollback path. Setup retains the existing test's private `withWriteContext({participation:'inspection'})` control; that control is not being claimed as a new root application export. No private writer, effect array, descriptor mutation or admission bypass creates success.

## Original useful behavior preserved

All original final assertions execute and pass:

- ids exactly a,b,c; original held a and b identities restored;
- a value7; physical b value88 retained;
- onAdd exactly a, onRemove empty, complete snapshot exactly a,b,c;
- later transaction adopting b88 rolls back to ordinary b8.

The ordinary-state assertions strengthen that behavior. Observers attach after setup exactly as in the original; they observe the inverse, not historical fixture construction. Omitting physical replacement removals before observer attachment would be a different observer-footprint workload.

The original setup was incompatible with **ordinary add admission** because it changed membership only through inspection: old a/b remained ordinarily present. That incompatibility does not make the intended inverse result impossible. A genuine authored transaction supplies ordinary absence and retained recipes, which the synthetic original effects lacked.

## Source basis and bounded failure

Exact C11 `packages/kernel/src/lib/entity-signal.ts`:

- 761–799: semantic admission uses ordinary presence; duplicate ordinary add refuses.
- 1120 onward, especially1201–1210: ordinary destination binding records removal of the displaced lifetime and installs its ordinary absence.
- 1180–1186: inspection changes preserve ordinary authority.
- 4350 onward: ordinary remove captures the lifetime value and neighboring subject recipe before staging the tombstone.

The successful fixture uses those existing rules, not a policy correction. Recipe/placement order still matters: the first attempt added replacements a then b and inspection-removed both. It reached the intended physical setup but rollback failed with `Collection structural target has no live placement anchor`. Exact source/log are preserved. Reversing replacement order also passed, but the recommended setup uses explicit ordinary removal of a and only one replacement. `target-transition.ts:905–938` checks retained live anchors; this task does not repair or broaden that policy, and the failing variant is not counted as passing evidence.

## Exact execution and identity

Input is C11 `SNAPSHOT-COUNTERPARTS.json`, SHA256 `dc21671bf92e2a74bd5798bfccfbc0b02d13e58dff4fe328758fd604d9f70148`. Copy made from the already verified exact C11 original in the preceding packet; all3045 manifest entries reverified unchanged after this work (`INPUT.json`, `VERIFICATION.json`). Only separately named diagnostic specs were added. Frozen inputs, root and original occupancy spec were not edited. Dependencies remain the isolated copied dependency tree. Node24.15.0/pnpm10.17.0, Nx with cache skipped, one worker, separate scratch cache/data; exact argv/env/cwd in each runs/*/COMMAND.json.

Runs through `run.py`:

| Run | Selected files | Result |
| --- | --- | --- |
| public-inverse-first | independent-occupancy-valid-inverse.spec.ts | 1 failed; missing live placement anchor, preserved |
| public-inverse-variants | independent-occupancy-reverse-inverse.spec.ts and independent-occupancy-remove-inverse.spec.ts | 2 passed |
| supported-inverse-and-original | independent-occupancy-supported-inverse.spec.ts and unchanged occupancy-successor-realization.spec.ts | 5 passed /1 failed: strengthened inverse passes, original four controls pass, original fabricated-add case remains red |
| spec-ratchet | node tools/check-spec-types.mjs | exit0; same three inherited improvements, no baseline update |

All stdout/stderr first failures and commands retained. Test commands are `corepack pnpm nx test kernel <selected filenames> --skip-nx-cache --maxWorkers=1`. No skips, broad suite, runtime fix, release qualification or C8a rerun. The proposed one-file patch combines the executed strengthened test body with the original four tests and imports; it has not been installed/replayed as that combined original filename here. Main must replay after composition, including the previously accepted three-file patch. Source-only patch application check passed on the untouched own copy; it does not substitute for composition execution.
