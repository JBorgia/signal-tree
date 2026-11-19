# Independent C19 source/discovery disposition audit

**Bounded accept of source composition and test-disposition integrity. No runtime or assertion blocker demonstrated in this audit.** One nonblocking packet-documentation inconsistency is identified below. This is not a full-kernel result or release sign-off.

## Exact identity and runtime boundary

Verified all 3065 entries in each of C18, maintenance and C19:

- C18 `cdfdf039f8cac66c90de26ff47cec3850b5e33db00e4b5c335c51bc934facbee`.
- Reviewed maintenance `26d128655d1db2ff8472f3be4e83b45060b7d3126db1c9e2c60bf50c8d76e2d1`.
- C19 `b8eace4025ff735988dee88db512a2e9ceb5ac9e1302683d68d6900acea17576`.

Relative to C18, the ONLY runtime change is entity-signal.ts's explicit `snapshotIdentity = undefined` initializer and explanatory comment, exactly matching maintenance. The declaration remains before construction-time uses and the proxy assignment remains in place; no const/TDZ issue or new install behavior. Link and private/lifecycle handoff, permission, readiness and finally implementations remain exact C18 bytes. Public barrels, configs, budgets and selectors are unchanged.

Read Main's maintenance rationale and inspected all four-file maintenance edits. Independently ran the bounded TypeScript transpile/AST comparison: comment-only emissions identical; entity initializer and fixture let-to-const are the only approved noncomment differences; expectation expressions unchanged. The fixture supplies only set, so its callback runs after construction initializes const c. This is static verification, not another test run.

After maintenance, C19 has exactly four disposition-path differences: remove old enrollment invariance file; strengthen adjudicated enrollment cutoff; remove the one mixed case from whole-bounded-qualification; add whole-mixed-promises. No other changes.

## Exact archived evidence

- C19 research-only/publication-enrollment-invariance.spec.ts equals frozen C18's original 16-case file byte-for-byte.
- ORIGINAL-adjudicated-before-disposal-cutoff.spec.ts equals C18's adjudicated twin byte-for-byte.
- ORIGINAL-whole-bounded-qualification.spec.ts equals the maintenance version byte-for-byte. Deleting its single exact original-mixed-immediate-progress.case.txt byte sequence produces C19's live qualification file exactly. The extracted strong case is also a byte-exact contiguous body in C18; maintenance only changes comments elsewhere in that full file.
- New whole-mixed-promises.spec.ts equals the independently reviewed finalized counterpart byte-for-byte: `bbbc1db97df42d362bbef97a15afcc3562e4a19fe4fb3a4a0d83004cf1613bec`. Its cleanup guard is included; no assertions were changed during promotion.
- Earlier C18 archival artifacts remain intact in frozen C18/research-only. C19's research-only directory contains this generation's four additions rather than duplicating all ancestry. This audit copies both generations into its own packet for traceable archival; no body was silently lost.

Relative imports in archived specimens retain their original package context. They are recoverable research bodies, not standalone executable files at their archive paths. Replay requires restoring the original path in a disposable copy. No claim that archived failures passed.

## Live assertions against reviewed conditions

Enrollment: independently read st-enrollment-test-routing-review/REVIEW.md and compared source. The only strengthening consists of the new local count, capture immediately before dispose at live file line33, and defined/no-increase assertion after flush at line44. Removing those exact additions reproduces C18's live twin byte-for-byte. Both root/branch disposal cases retain <=1, matching payload, surviving-basis correlation, primary exactly-one delivery/declared receipt, and unchanged foreign owner inspection/value. A new endpoint call after disposal can no longer satisfy this pair. All16 parameterized variants remain live. Six live-secondary cases still require exactly one matching output, so their surviving-basis assertions are nonvacuous.

Mixed: independently read the premise review, concrete counterpart review and cleanup addendum. Both live parameterized cases retain original pre-rollback x endpoint identity, y evidence refresh/clean proof, local owner inspection, and absence of early delivery. After rollback they assert exact restored x0/y9 plus unchanged foreign owner inspection/value. The temporary <=1/current-only condition permits either safe early delivery or a hold; it does not accept stale truth or impose unnecessary holding.

The fresh-author case requires exactly one cumulative current output BEFORE foreign settlement under a new independent whole declaration. The passive case issues no new value write and requires exactly one current output after foreign confirmation. Both assert no duplicate and correct final state. Thus the permitted empty interim result cannot turn permanent loss into success. The cleanup foreignSettled guard avoids rollback-after-confirm and does not supply the tested progress.

This matches the reviewed condition: earlier declaration permission does not transfer to a new undeclared compensation revision. It does not assert that foreign r is a native inverse dependency or certify declarations wrapped around settlement. The archived unconditional immediate-output demand remains a documented stronger boundary. This audit accepts the authorized test disposition, not a new runtime policy.

## Discovery and packet consistency

Parsed actual kernel Vitest include/exclude arrays and matched files statically. The old enrollment file is absent; adjudicated enrollment, whole-bounded-qualification, whole-mixed-promises and active value-work-handoff remain included. Archived files are outside candidate. All runner/project/config bytes match the input manifests, so no broad exclusion, skip, xfail or special success route was introduced. The prior invalid getter/injected mutation/recording-only C18 dispositions remain as before.

**Nonblocking documentation finding:** /private/tmp/st-native-combined-c19/ENROLLMENT-DISPOSITION.md:7 still says the mixed immediate-progress assertion “remains live pending independent policy disposition.” That describes the intermediate stage, not final C19. MIXED-DISPOSITION.md and actual source correctly show it archived with reviewed counterparts live. Recommend marking that sentence superseded or linking the final mixed disposition in a packet addendum; no frozen source edit was made. COMPOSITION.json records the initial maintenance merge only; the two disposition documents plus manifest delta carry the later test routing. Neither document should be used alone as an exhaustive final diff.

## Executed checks and limits

Only read-only source hashing, byte reconstruction, AST/transpilation and static glob matching; no Nx, tests, build, typecheck, or dependency installation. No contention with Main's full kernel run. No production/author/frozen files edited.

```
python3 /private/tmp/st-parent-freshness-implementation-independent/c19-disposition-review/audit.py > /private/tmp/st-parent-freshness-implementation-independent/c19-disposition-review/audit.log
/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node /private/tmp/st-parent-freshness-implementation-independent/c19-disposition-review/verify-maintenance.cjs > /private/tmp/st-parent-freshness-implementation-independent/c19-disposition-review/maintenance.log
/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node /private/tmp/st-parent-freshness-implementation-independent/c19-disposition-review/discovery.cjs > /private/tmp/st-parent-freshness-implementation-independent/c19-disposition-review/discovery.log
```

AUDIT.json contains exact changed-file identities and archive hashes. disposal-check.log and mixed-original-check.log record exact reconstruction checks. EMITTED-VERIFICATION.json records maintenance verification. discovery.json records full static discovered paths. Input manifests/disposition documents and both archive generations are copied here. Main's reported109/109 and source-types pass are not claimed as independent executions; ongoing full-kernel progress was not inspected or interfered with.
