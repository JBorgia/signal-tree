# Independent runtime review: evidence-scope successor

## Disposition and identity

**Do not accept this candidate. A new executed counterexample loses a native membership-input requirement and grants declared early publication.** It is inside the reviewed branch/scalar source inventory, not an unmigrated entity writer or an enrollment-oracle disagreement. Preserve the first result and apply the covered-recurrence stop; this review does not authorize repair.

Reviewed base `8212736242e1f85f7e3288dbb0ebda99a575e3b2`, four-file runtime diff in `/private/tmp/link-evidence-scope-successor`. I read the review contract, approved A0 at `4ed3b609`, aggregate proposal at `2782af63`, and evidence-scope design. I did not edit runtime or read other new reviewers' conclusions. Parent supplied run summaries and requested checks; conclusions below were checked against raw logs/source. I previously reviewed these contracts and rejected predecessors, but did not implement this candidate.

Initial full patch/source packet remains `FIRST-BEFORE`; `CANDIDATE-FIRST.log` remains **81/89 passing**. SECOND is **111/123 passing**. Neither is replaced by corrected-oracle results. My independent source copies/full tracked diff and tests are under `independent-omission-input/`. Runtime identity for my runs matches COMPOSITION BEFORE/AFTER:

| Runtime file | SHA256 |
| --- | --- |
| experimental-publication/lifecycle.ts | `24c2b6c847ad1feb643c9bd6c6985f3f1655d62728fed097757e6113e4bfb648` |
| experimental-publication/private.ts | `c5b32608354921f465b7a04fd511181a9e3cae315a63a0c610113ce59bad5761` |
| internals/intrinsic-mutation.ts | `fe3f6d58db7885c3effc17016aa4b2c867e1bd2f12e85aafa06db9033ce93304` |
| signal-tree.ts | `b5c636c660e391531e63c2d2da7ff1105e69d25c1202fa81fc45ae9940ac74c0` |

SECOND's private.ts hash is `2440a354b6ba6919de999700e62661cab554e89ead0216ef4a149852dc16c279`; the later non-null assertion correction is present in my snapshot. The raw first source-type error at private.ts:129 is preserved, not attributed to the later snapshot.

## 1. Blocking: omitted membership disappears from native updater input

At `private.ts:73–81`, `nativeInputs` walks `Object.keys(storage)`. Dormant children are nonenumerable (`member-membership.ts:58–59`). Walking retained membership paths of present children does not visit the omitted sibling's edge. The omission requirement exists in `nativeMembers`, but this traversal never collects it. `prepareScalar:185–196` uses the native requirement for common lower bounds; captured recipient facts no longer repair that omission.

Smallest discriminating sequence in `ISOLATED-PREREG.spec.ts`:

1. Pending foreign owner p; source pair initially `{x:7,y:0}`.
2. Under a valid dependent(p) declaration, omit x by replacing pair with `{y:0}`.
3. In a fresh valid independent declaration, replace y with 1. The absent x fact still requires p; y no longer does.
4. Dispose the source connection. Native source facts must remain available.
5. A target scalar connection declares independent, invokes the source's native branch updater, and sets target to `hasOwnProperty(input, 'x') ? 1 : 0`.

Actual first result: target becomes 0, **sent `[0]` while p remains pending**, receipt `{state:'started',basis:'declared'}`, no declaration error. The explicit dependent(p) variant passes and holds until confirmation. `ISOLATED-FIRST.log`: **1 failed / 1 passed**. Runtime BEFORE and ISOLATED-AFTER hashes match.

This violates A0's native updater known-input lower bound and the design's exact membership/absence input requirement. The updater directly receives and consumes the object's absence; it is not an application-hidden read. A fresh y write cannot clear the independent x-absence fact. No new public semantics are necessary to establish the oracle.

Counterargument tested: the initial simpler omission test passed **2/2** (`FIRST.log`, original `PREREG.spec.ts`). Its branch replacement also authored y under p, allowing p to be recovered incidentally through present y. That pass does not cover omission provenance. Both first artifacts remain unchanged. Isolating y's support exposed the missing requirement.

Prewritten hashes: initial `608ab9a49ed6a91f6485538aa3a7d576e45656d93b26e628eac3cfbe82ccd6e7`; isolated `f052ecf6a8afaf3007e538c3e70833260ee860c27f65789024373489fee2e6a7`. Each ran separately after obtaining the exclusive Nx slot, Node 24.15.0, with `COREPACK_ENABLE_NETWORK=0 NX_DAEMON=false NX_ISOLATE_PLUGINS=false corepack pnpm exec nx test kernel --testFile=packages/kernel/src/lib/publication-independent-[isolated-]omission-input.spec.ts --skip-nx-cache`. Exact expanded commands are in the two raw logs. No broader suite rerun by this reviewer.

## 2. Separate blocking compatibility regression: unmigrated unknown fallback

COMPOSITION-FIRST is **106/111 passing**. Its unchanged `link-native-address.spec.ts:135–155` copies a pending other-tree value directly into an entity field without a declaration. Expected no send until confirmation; actual `[7]` before confirmation.

The relevant delta is `private.ts:273`: `project()` previously retained pending-owner fallback blockers; it now always installs an empty blockers array. `admit:260–264` consequently delegates that unknown revision to the target's ordinary gate with no cross-tree blocker. The source comment explicitly calls this an unmigrated projection. Native updater provenance has not established a complete input proof for this path.

This direct application read is distinct from a native updater argument: source inspection cannot invent a precise p input certificate here. Nevertheless, removal of the unchanged default conservative protection is an actual regression, not permission to redefine that control. Passive-recipient fallback adjudication does not authorize weakening this safety case. I verified this spec is byte-identical to base. This finding uses the supplied raw native run; I did not rerun it.

## Oracle adjudication and other observed failures

- The original `aggregate-native-input-independent.spec.ts` now throws after-callback contradiction. That change follows the approved known-input rule: the native root updater receives pending x=7 and copies it into pair.x, while independent claims an empty complete set. A0 and aggregate proposal item 3 require contradiction, retained writes and no early send. Its previous conservative/unknown receipt expectation is not the correct oracle once this native requirement is available. The original is preserved unchanged; this is not a safety waiver.
- The corrected enrollment16 checks useful c1 progress and c2's `lifecycle.started` basis separately. Passive c2 sends use `surviving`, not an inherited declared grant. The original six passive-enrollment failures, four older equivalent failures and disputed wider-input fallback case remain visible. Their counts must not be conflated with the new omission failure or native known-input contradiction.
- Three composition controls fail before their payload assertions because permanent membership hook registration collides with their private registration port (`intrinsic-mutation.ts:341`). This is a concrete test/port compatibility problem; it does not establish failed membership atomicity because those assertions were never reached.
- The unchanged mixed-undo reentry control still ends with outgoing n=11 instead of callback-authored n=777. This is preserved broader selected-delivery failure, not evidence that this four-file patch newly caused it. It remains outside a passing complete successor claim.

## What the implementation does establish, and limits

Source-owned requirements are prepared once before recipient plans, combined into terminal data, and installed through existing terminal records. Recipient-only coverage is no longer broadcast into shared unknown frames. Actual declared/native owners still accumulate in executing enclosing frames; immutable assertions remain checked. Horizon completion freezes native proofs before dropping frame/input references. Disposal removes recipient registrations/bindings while weakly keyed source requirements remain. The native18, adjusted enrollment16, scope4, membership4 and scalar controls support these bounded routes in the raw runs.

These mechanisms do not establish complete input-domain coverage: finding 1 is precisely the missing structural input. Sparse native retention also does not by itself prove cleanup: live weak keys retain owner cells, which can retain live operations through reverse links; closed proof graphs must stay bounded by contributing source facts. The supplied 12-cycle diagnostics test passes, but is not a heap or dormant/recovery retention proof. Native preparation now remains armed without recipients, so cold-writer allocation/budget qualification is still required. No performance, build, broad type, release, default activation or full-writer-inventory acceptance is inferred from this review. Further runtime work requires the governing recurrence disposition, not merely another green subset.
