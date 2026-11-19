from pathlib import Path
import hashlib,json
r=Path('/private/tmp/st-c28-r3-disposition-index-review'); p=Path('/private/tmp/st-c28-r3-disposition-index'); b=Path('/private/tmp/st-c28-r3-work-attribution'); h=lambda p:hashlib.sha256(p.read_bytes()).hexdigest(); m=json.loads((p/'BASE-MANIFEST.json').read_text()); f='packages/kernel/src/lib/internals/causal-runtime/tree-realization-adapter.ts'
changes={k:h(p/'candidate'/k) for k,v in m.items() if h(p/'candidate'/k)!=v}; assert list(changes)==[f],changes
assert h(p/'original.ts')==m[f]
a=p/'candidate/packages/kernel/src/lib/restoration-scaling-slice-corrected.spec.ts';z=b/'candidate/packages/kernel/src/lib/restoration-scaling-slice-corrected.spec.ts';assert a.read_bytes()==z.read_bytes()
ident={'baseManifest':h(p/'BASE-MANIFEST.json'),'baseFiles':len(m),'changed':changes,'original':h(p/'original.ts'),'patch':h(p/'runtime.patch'),'counterFixtureEqualAcrossArms':h(a),'artifacts':{str(x):h(x) for x in [p/'IDENTITY.json',p/'REPORT.md',p/'prepared-counted/first.log',p/'prepared-counted/counts.jsonl',p/'semantics-first/first.log',p/'source-types/first.log',b/'slice-corrected/counts.jsonl',b/'restoration-sites-corrected/observations.jsonl',b/'restoration-sites-corrected/first.log']}}
(r/'IDENTITY.json').write_text(json.dumps(ident,indent=2)+'\n')
(r/'REVIEW.md').write_text('''# Prepared disposition index — bounded independent review

**No source-level blocker found for this native-plan optimization. Eligible for bounded composition qualification, not release/cost-gate acceptance.** No source edits or new test execution. I inspected actual source, diff, identities and raw results; numerical results below are packet runs, not independent replays. Existing inner-realization state failure remains open.

## Identity and equivalence

IDENTITY.json records independently computed hashes. All base-manifest files match except the one advertised adapter file; original.ts exactly matches its base entry. Corrected diagnostic fixture bytes match between baseline and candidate. The candidate patch groups ordinaryPlans changes before scalar/structural installation inside the existing heterogeneous preparation function.

Native entity-signal.ts:815–1078 builds a dense changes array of source-created plain records with numeric subject IDs, completes all pushes before returning, marks publication facts at1053, and returns changes at1061. install and complete do not append, replace or rewrite its subjects. `readonly` alone would not establish this: the actual returned array is not frozen, but its native producer/consumers establish the required stability. Private monkeypatches returning mutable/getter-backed plans are outside this demonstrated equivalence. No supported user payload getter is evaluated merely by reading the source-created change.subject; payload before/after references are not traversed by the new index.

For each owner and subject, insertion order into the group equals filter order, duplicates retained. Map's SameValueZero agrees with === for numeric IDs except NaN, explicitly skipped; +0/-0 agree. Native numeric-subject contract excludes malformed string/undefined subjects; the new typeof gate is not a general equivalence proof for fabricated private plans. Missing plan still returns unannotated fresh meta; existing plan with no match still receives selected-disposition annotation with fresh empty array. Each match uses slice, so mutations to one delivered grouping array cannot affect another call. Change record identities remain identical. withSelectedEntityDisposition/entity-value-transition keep existing source publication facts; indexing does not clone change records, fabricate units, change owner keys, or hoist ambient metadata capture out of publication.

## Preparation, errors, reentry and retention

The new grouping walk runs after native ordinary-plan preparation but before scalar prepareCommit, structural-unit preparation, phase seal/validation and any install. Existing physical-revision/stale-plan checks remain. Publication callbacks still execute at their original points; active write context is still read at each publicationMeta call. Reentry before/during invalidation cannot change this unit's native changes array. Values and entity payload accessors are untouched by grouping. No supported native error source is moved from after installation to before it: the removed filter only inspected native subject data; allocation failures or monkeypatched array/Map methods are not claimed equivalent. No arbitrary user-provided plan contract is inferred from the private method name.

The index adds O(C) references/arrays for C prepared changes to the existing unit closure. It is not global or keyed by historical owners, and shares existing change objects already retained by ordinaryPlans. It may live while a prepared unit is retained; this review does not claim immediate cleanup, lower heap, or GC proof. The original per-publication result arrays still exist; indexing intentionally trades temporary grouping storage for repeated scan work.

## Counter audit and observed results

Corrected counter charges slice result.length, rather than receiver.length. For dense native arrays, slice(50,51) copies one output element even when receiver length is100; full filter still visits its input. The calibration asserts1 and4 respectively. This fixes a metric artifact; it does not alter the production test or ceiling. The instrument still charges full receiver lengths for some early-exit methods and uses selected iterator/copy proxies; it is not an exact instruction/CPU/time counter, and sparse/custom array behavior is not calibrated. Descriptor restoration is in finally around the measured operation; supported built-in descriptors exist during setup.

At n32/64/128/256 baseline undo counts are14512/37168/107056/345136; candidate10547/21043/42035/84019. Redo15376/38896/110512/352048 becomes11411/22771/45491/90931. Initial/replacement counts are identical. This is real repeated full-plan filter elimination: old per-effect O(C) scans become one O(C) grouping plus matching-group copies. The index itself is counted through Map/array iteration and push, so no source evidence of counter evasion. No universal complexity or timing claim: repeated effects for one large group still require repeated copies.

prepared-counted raw:5/5, exit0. source-types raw:exit0. semantics-first raw:53pass/1fail across6files, exit1; failure remains inner realization B erased by outer rollback. Source packet's sentence saying the five diagnostic cases verify “Values” is too broad: they assert exact undo/redo ID arrays, not every row payload. Other semantic fixtures provide separate coverage; no invented payload assertion is credited here.

Baseline restoration-sites-corrected is **not all passing**:1pass/1fail, n64 hits Vitest5000ms timeout. RESULT timeout:false describes the external supervisor, not the failed test deadline. Its recorded attribution counts are observations despite failed qualification; do not call it a clean baseline or infer host/performance cause. The separate slice-corrected count workload supplies the matched completed four sizes.

## Remaining bounded falsifiers

Not independently run: equal-subject duplicate changes/order, multiple owners with same numeric subject, fresh array isolation and publication-unit identity under notifier reentry, plus payload round-trip assertions beyond IDs. These are useful focused composition checks, not demonstrated defects. Native producer inspection supports stability; a supported source path mutating changes/subject after prepare would invalidate this conclusion. Large130k, full-suite, bundle/demo, public Link composition and heap/retention gates remain outside this review. No adoption of the rejected whole-context state patch, no runtime repair, and no budget/oracle relaxation.
''')
print(json.dumps({'review':h(r/'REVIEW.md'),'identity':h(r/'IDENTITY.json'),'patch':ident['patch']}))
