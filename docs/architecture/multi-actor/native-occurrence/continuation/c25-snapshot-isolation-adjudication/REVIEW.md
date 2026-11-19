# Snapshot fixture: fresh physical certificate, not demonstrated recipient-domain failure

Classification: both executed cases expose failed fresh-current progress; neither demonstrates a saved-99 leak. The unchanged fixture remains useful. Source inspection identifies a concrete native-view maintenance omission on the ordinary-equal/physical-changed return, before later holder consumption. Do not weaken either progress or safety assertion. No runtime or test edits and no reviewer execution.

## Observed versus inferred

Preserved first.log lines 181–199: both direct and frame fail at line 80, `freshSent` expected `[7]`, actual `[]`. Earlier identity, values, conservative old receipt and `oldSent=[]` assertions were reached and passed. Fresh receipt, q inspection after drain, confirmation, final payload/settlement and duplicate assertions were blocked by the first failure. Thus this log does not establish later settlement or permanent deadlock. Reported two failures are semantic assertions, not the accompanying historical tsconfig-path warning.

IDENTITY.json records copied current C25 source hashes and first-log hash. Candidate top-level has no SNAPSHOT/FREEZE manifest at this inspection; these are observed source bytes, not a claim that an unrecorded run-time source manifest was verified. All original packet SNAPSHOT hashes were independently rechecked and remain unchanged. The C24-to-observed-C25 private.ts diff is preserved. No author verdict was used.

## Concrete source chain

1. `private.ts:144–148`: inspection 99 creates an unavailable NativeView. The ordinary preparer then returns for `!mutation.changed && !isValidating() && !branchInputs.length && !restoredScalarSelection(node)`. It does NOT check physicalChanged.
2. Direct return 99 to ordinary 7: `tree-scalar-slot-runtime.ts:311–352` has physical equality false, ordinary authority equality true from inspectionBaseline, hence semanticChanged false and physicalChanged true. `location-runtime.ts:482–491` forwards both via prepareUnchanged. Frame return computes exactly the same pair at `tree-scalar-slot-runtime.ts:205–228`. `intrinsic-mutation.ts:329–330` calls the native preparer in either route.
3. This fixture returns source to 7 outside any declaration/updater input/restoration. `lifecycle.ts:425` defines isValidating as nonempty declaration stack. All early-return conditions therefore hold. No native view record is installed; current physical 7 retains the unavailable inspection view. C25's later `mutation.physicalChanged` allocation check at private.ts:167 is not reached. This early return is also present in preserved C24: this run alone does not establish C25 introduced the omission.
4. `suppliedViews` at private.ts:107–125 prioritizes a supplied snapshot certificate. Both saved99 and fresh7 therefore capture the retained unavailable view. Public leaf identity and updater-input correspondence are grounded by opaque-terminal-snapshot.spec.ts:36–50. The holder updater supplies actual native inputs, not a hidden closure read.
5. The target's ordinary changed literal 0 to 7 is prepared under the declaration with branch input. `prepareNativeRequirement` (lifecycle.ts:182–208) recognizes unavailable input and captures the pending foreign q in its fixed possible window. That explains fresh delivery being held without invoking missing recipient coverage. This is a source-derived causal trace, not an instrumented dump of the run's native maps.

## Recipient coverage is a distinct issue

The original holder and target are different trees/registries. `beginBranchInput` (private.ts:171–182) enumerates only that holder registry's bindings; no holder Link was installed. The target channel is absent, and `prepareScalar` line 358 explicitly substitutes `{facts:[],recipientDomainUnknown:false}` for an absent channel. Target write is literal replace, with no origin/attribution error, so it also does not trigger uncapturedUpdaterInput. Its native branch evidence is still supplied separately. This is not the same path as an ancestor updater overlapping a descendant recipient in the same tree.

Moreover the observed C25 aggregate-installed-publication.spec.ts:126–136 retains an old “stays unknown” title but its actual corrected assertions require useful progress with surviving basis. recipient-progress-positive-counterparts.spec.ts distinguishes domain-only uncertainty from genuine native windows. Do not treat the historical title as authority to waive useful progress, or treat clean recipient coverage as permission to discard actual unavailable native inputs.

## Proposed own-root/stamp discriminator

The suggested `holder={input:leaf(snapshot),stamp:0}` plus Link(holder.$), matching declaration and root updater `current=>({input:current.input,stamp:1})` is source-supported and removes recipient-domain ambiguity:

- aggregate input at the same root has `within=[]`; beginBranchInput sets covered=true;
- same-root declaration supplies matching channel permission;
- stamp 0 to 1 is real authored value work, avoiding no-write/equal-only ambiguity;
- actual updater snapshot still recursively carries the saved object's certificate;
- existing aggregate-installed-publication root controls and the consumed-input contradiction case (around lines 76–89) establish aggregate authorship and preservation of real updater input obligations. Opaque-terminal identity is independently tested.

Expected exact objects, conditional on correct physical-view maintenance: old output withheld while q pending, then `[{input:{x:99},stamp:1}]`; fresh output `[{input:{x:7},stamp:1}]` before q settlement, unchanged afterward. Check exact current holder objects, callback identity/call count, pending q unchanged, settlement and no duplicate sends. These expectations combine existing contracts into a new discriminator, not an already executed root-stamp test.

However changing only the recipient route cannot fix the earlier fresh certificate omission. Source predicts the same fresh hold if plain return-to-7 setup is retained. Therefore root-stamp is a useful coverage-isolation companion, NOT grounds to discard the current failures or evidence that the fresh oracle was wrong.

Cheapest separate isolation companion: perform the direct/frame literal return to ordinary 7 inside a real public independent declaration, before opening q; then capture fresh7 and consume saved/fresh via own-root/stamp. A matching temporary source-root Link makes permission unambiguous; dispose it after draining before creating holders/q. This makes isValidating true during return, reaches C25's physicalChanged allocation, and distinguishes old-view immutability from the early-return omission. Keep literal return (not an updater consuming inspection99), preserve all original cases, and assert saved99 held / fresh7 progresses exactly. Do not claim this passes until run. No new fixture or execution was produced in this read-only adjudication.

No API change, new semantic owner hold, or internal proof injection is needed for either discriminator. Any runtime correction needs separate authorized review of preserving the existing ordinary endpoint on physical-only restoration, rather than treating inspection cleanup as arbitrary new authorship.
