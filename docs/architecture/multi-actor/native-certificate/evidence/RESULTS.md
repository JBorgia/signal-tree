# Frozen native certificate successor: recurrence, not acceptance

Source baseline: `87ddcfdedcb5d91e700d812bd6cbee2f77038510`.
Implementation directory: `/private/tmp/st-projection-certificate-successor`.
See IDENTITY.json for patch and full tracked-source manifest hashes. The scratch directory is a git archive, not a checkout with a branch/HEAD. The preserved source checkout remains clean at the baseline revision.

## Implemented in this attempt

- Private native requirement readiness independent of proof presence; composite dependency references and finalization subscriptions.
- Requirement listeners notified after all requirements in the horizon finalize, before operation refresh/wake.
- Collection, scalar and membership enrollment preserve unfinished requirements and refresh cached proof contributions at finalization.
- Collection selection checks completed membership and outgoing payload domain; hidden collection units retain their own payload instead of blindly inserting a missing outgoing path.
- Membership completion attempts to restore retained collection payload alongside existing support.
- Exact connection ingress token in scalar and collection admission, with nested scope restoration.
- No package exports, activation switches or ceilings changed. No public type changes. Four runtime files changed; the entity-egress implementation itself was not changed.

## Executed results

Environment: Node 24.15.0, package-manager pin pnpm 10.17.0, NX_DAEMON=false, NX_ISOLATE_PLUGINS=false. Commands ran from the scratch directory, with Node's bin directory prepended to PATH. All Nx runs used --skip-nx-cache.

| Evidence | Command after environment setup | Outcome |
|---|---|---|
| 001-original.log | corepack pnpm nx test kernel --skip-nx-cache --testFiles=core-independent-review.spec.ts,collection-contributor-core.spec.ts | Harness failure: unsupported --testFiles; no runtime verdict |
| 002-original.log | corepack pnpm nx test kernel --skip-nx-cache core-independent-review.spec.ts collection-contributor-core.spec.ts | Unchanged baseline: 4 failed, 9 passed |
| 003-new-before.log | corepack pnpm nx test kernel --skip-nx-cache native-certificate-successor.spec.ts | Preimplementation: 5 failed; two require the new readiness API |
| 004-after-first.log | corepack pnpm nx test kernel --skip-nx-cache native-certificate-successor.spec.ts core-independent-review.spec.ts collection-contributor-core.spec.ts | 2 failed, 16 passed; covered omission recurrence |
| 005-source-types.log | corepack pnpm run typecheck:source | PASS, exit 0 |
| 006-focused-regression.log | corepack pnpm nx test kernel --skip-nx-cache link-nested-collection.spec.ts link-order-audit-regression.spec.ts link-root-source.spec.ts publication-uncertainty-provenance.spec.ts publication-proof-retirement.spec.ts publication-terminal-consumer-independent.spec.ts | 38 passed in 6 files |
| 007-spec-types.log | node tools/verify-gates.mjs --only=spec-types | FAIL; includes one new fixture optional-branch type error |
| 008-final-focused.log | Same three-file Nx command as 004 | 2 failed, 16 passed after fixture-only typing correction |
| 009-final-spec-types.log | node tools/verify-gates.mjs --only=spec-types | FAIL; new successor fixture has zero diagnostics; remaining errors described below |

The 54 passing runtime tests across the two final focused selections are not acceptance. The two failures remain active. No broad gate, release/demo build, installed qualification or actual independent implementation-review verdict is claimed.

## Preserved recurrence

1. Unchanged `core-independent-review.spec.ts`: independently omitting the ancestor of a q-held collection still leaves the receipt held and sends nothing instead of `{other:1}`.
2. New `native-certificate-successor.spec.ts`: omission fails before the restoration assertion can execute. Therefore this run establishes no restoration success.

Source inspection explains an implementation gap, not a refutation of the design: `registerCollectionProjection` (private.ts:337) registers collection support but does not index its ancestor path in slotTrie. `bindSource` (private.ts:377) stops at entity sources before the scalar path-indexing branch. `prepareMembership` (private.ts:208) skips the recipient when `slotNode(b,address)` is absent. Consequently completedPresence never acquires the omission; the collectionSelected filter sees its old payload path and retains its obligations. Filtering alone is insufficient when the membership transition never reaches the certificate.

Per the user/design recurrence rule, no further runtime patches followed 004. The candidate remains incomplete and is not eligible for integration. Missing occurrence registration must be reviewed as part of the complete transition mechanism, not concealed behind passing sibling tests.

## Typing and fixture preservation

All original review fixtures are byte-identical to 87ddcfde; hashes and copies are in IDENTITY.json and unchanged-fixtures/.

The new fixture initially mirrored the original optional EntityMap branch typing error. Its correction uses inferred construction shape and an explicit `as never` at the existing internal whole-branch omission boundary. No `any` was introduced and no assertions changed. The exact first fixture is preserved as new-falsifiers-first.ts.

Final spec-type failures:
- Two errors in unchanged core-independent-review.spec.ts: its optional branch/EntityMap source shape. These are inherited fixture source errors, not modified or suppressed. No separate baseline spec-type gate execution is claimed.
- One error in unchanged publication-terminal-consumer-independent.spec.ts: registerCollectionProjection now requires a fifth payload argument. This is an introduced private-call compatibility error, NOT inherited. Frozen with the runtime recurrence; not papered over by a test edit or public-type weakening.

## Limits requiring independent review

The implementation is not a complete realization of DESIGN.md. In particular, exact collection occurrence enrollment is incomplete (observed above). Tests for hidden mutation followed by replacement lifetime, peer registration reversal, nested acquiring callbacks, and recipient replacement/disposal before close have not been completed. The new cancellation test covers the private listener release, not full recipient replacement/disposal. The new parent-horizon test covers a composite with no recipient operation; it does not qualify every composite consumer.

Inspect watchFact carefully: it does not detach a replaced enrollment fact immediately. It refreshes an old fact and recomputes current summary at close rather than validating exact current slot occupancy. This does not meet the recorded replacement/release invariant and must not be described as completed. Collection entry replacement does check exact entry identity and release its listener; this is not proof of full lifecycle coverage.

A focused independent review packet is prepared in REVIEW-REQUEST.md for Main to assign. This host exposes no native subagent review tool; PR review tools do not apply to this isolated archive. No new user-owned chat was created to simulate a subagent. Review remains pending.
