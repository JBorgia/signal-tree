# R3 point-work: attribution and bounded options

The unchanged <2,000 gate remains a real qualification failure: 13,000 charged visits for each 200-update run (65/update), at both 2,000 and 20,000 rows. The complete two site histograms are identical. This demonstrates fixed overhead for this workload, not collection-size scaling, and does not excuse the absolute limit. Closing the strict bound requires at least 11,001 fewer charges. No small reduction below has evidence of achieving that.

Read-only source/artifact review; no runtime/test/budget edits, runs or profiling. Bulk restoration's repeated plan.changes.filter and its index prototype are distinct work, not a remedy for these point stacks.

## Identity and measurement meaning

Input: /private/tmp/st-c28-r3-work-attribution/{REPORT.md,original.spec.ts,instrumentation.patch,observations.jsonl,COMMAND.json,RESULT.json,IDENTITY.json,BASE-MANIFEST.json}. Instrumentation modifies only the original spec. Its manifest byte hash fa371d221f9904c4feec2d8f684360c73ccb7e30b98bf03a18d0dea5768bf791 differs from the R3 manifest file hash e0b64de42df330abff455d2ee1b981c99abee187a77269cd064f52f3b08505f3; comparing shared path/hash entries found zero differences. The original spec bytes match frozen R3. This is not a claim that differently serialized manifests have the same file hash. Reviewed runtime paths are verified separately in EVIDENCE.json.

Command preserved in COMMAND.json: pinned Node24.15.0/pnpm10.17.0, `corepack pnpm nx test kernel entity-granular-reactivity.spec.ts -t 'a single-entity update does not rebuild the collection' --skip-nx-cache --maxWorkers=1`, owned caches/temp. Exit1 is the unchanged absolute assertion. The observer excludes stack parsing/tally work using an attributing guard and emits only after prototype restoration. This packet records first source sites, not operator-specific or parent-call counts. Its positive calibration is AFTER the failed assertion and did not run. Exact total agreement and identical distributions are useful corroboration, not a new calibration pass.

The test imports entityMap from ../index and signalTree directly. index.ts exports link; link.ts:3 imports experimental-publication/entity for registration. This measured module graph has native entity preparation despite no transactions or Link instance. Do not call it an artifact of an installed Link, change imports to obtain green, or claim a production tree-shaken result without a fresh build artifact.

The counter charges yielded Map/Set/Array iterator elements; Map/Set forEach receiver size; Array methods their full RECEIVER length (including early-exit find and bounded slice); Object enumeration returned length; push argument count; Array.from result length in addition to any input iterator charge. Thus iterator+copy can count twice by design. It omits flatMap, indexed loops, direct property/Map/Set operations and much allocation. An empty Map allocates but contributes no yielded elements. Count is neither actual comparisons, allocation bytes, total instructions nor time. A syntax rewrite to an uncounted loop is not a reduction in actual work.

Setup/seeding, final value read and destruction are outside the measured 200 distinct updateOne(i,{v:1}) calls. Each row is {id,v}; field width, owner count, recipients and repeat writes to the same entity are not varied. The original test checks row5 value and two-population equality before the absolute assertion. No claim about all runtime complexity follows.

History: git commit ef1631b0e introduced this counter and <2000, replacing a <0.05ms/update check while retaining the no-collection-rebuild goal and adding size equality. Available C21 artifact /private/tmp/st-c21-point-work-attribution has original 13,800 failure plus a separate calibrated diagnostic (empty0, copy7, nested8, throw/restoration) reporting 69/update at both sizes. R3 has 65/update: the area difference is private native input capture 1,000→200, consistent with the current singleton-input specialization. Do not count that prior 800 saving again. No contemporaneous passing 800-count baseline log was established here; historical design references to it are not fresh R3 measurements.

## Current measured decomposition

| First source area | Visits/200 | Per update |
| --- | ---: | ---: |
| experimental-publication/entity.ts | 4,600 | 23 |
| internals/entity-publication.ts | 2,800 | 14 |
| entity-signal.ts | 2,600 | 13 |
| internals/intrinsic-mutation.ts | 1,200 | 6 |
| internals/utilities/deep-equal.ts | 800 | 4 |
| internals/location-runtime.ts | 600 | 3 |
| experimental-publication/private.ts | 200 | 1 |
| physical/entity-value-store.ts | 200 | 1 |
| Total | 13,000 | 65 |

Native entity support copies two-field maps at entity.ts:148,149,162,196 (400 each): staged ordinary row, staged physical view, per-edit physical snapshot, selected physical evidence snapshot. The other visits are singleton edit/field iterations and prepared-record assembly. These are field-width operations, not whole-collection scans. The separate physical and selected maps have different support meanings; the second snapshot rewrites selected field requirements. Their similar size alone does not prove redundant authority.

AdmissionMetadata.array (:76) costs800, edit field-list copies (:64)600. These freeze source-owned metadata without freezing user payload and preserve edit identities. entity-signal.ts:2600 and2601 map the SAME ordinary changes into separate equivalent edit-shell lists for packet and step; :2562 maps steps and slices their physical membership. These repeat representation work before the admission identity cache can recognize sharing.

combineTerminalRecords (:21) costs1200 filtering plan slots. Older calibrated stacks distinguish two 3-slot compositions: entity native participant, then source publication assembly. R3 first-site tally alone does not distinguish the parents; current source still has both calls. Merging edits and installing them has further uncounted work. Source revision-token writes and native proof finalization are useful behavior, not removable because recipients are empty.

Deep equality enumerates both two-field rows (800). Topology iterates changes, creates a group, pushes it into selected, then maps completion. location-runtime's three singleton grouping/publication visits (600) preserve invalidation/delivery; no duplicate notification was demonstrated. private.ts:122's remaining singleton supplied-view capture is200. The neutral version-cell derive captures native input even though createCell's writer ignores preparation callbacks. Existing old stacks identify the version carrier; the R3 first-site tally alone does not prove every caller is that carrier.

Source-visible allocations unquantified by this counter include numerous empty Maps/Sets in entity preparation (:130–147), closures for evidence/support, empty record arrays and plan wrappers. No heap/time saving can be assigned from these visit totals.

## Smallest credible reduction options

1. **Share immutable point edit membership before admission.** In commitExistingSubjectValue, compute the ordinary edit list once and use the same source-owned list for packet.ordinary and step.ordinary. Supply the identical physical singleton list as step.physical, instead of creating a one-element slice. This removes actual duplicate shells/list construction and lets AdmissionMetadata's identity marks avoid repeated freeze walks/copies. Keep field lists immutable or retain its defensive copy; never freeze a user-owned patch list in place. Conditional count opportunities: duplicate ordinary map200, duplicate array visit200, duplicate field copy200, physical slice200 and its repeated admission array visit200. These are hypotheses, not a booked 1,000 saving. Preserve ordinary/physical distinctions and the identity keys used by selectedAt/paired, authoredRemoval, duplicate-subject ordered steps and inspection adoption. This is the narrowest promising local representation change; no no-recipient shortcut.

2. **Avoid constructing/combining producer-certified empty terminal plans.** At native entity's composition, an absent responsibility and an empty native admission record need not force a new concatenated plan around the actual writes. Preserve finalization/readiness even if the installation record is empty; emptiness must include deletes and any meaningful attached metadata. Preserve global deletes-before-writes/adds semantics and first-error order. Do not merely replace filter with an indexed loop and book 1,200 savings. A real fast path must avoid a container/copy/composition, not conceal equivalent work. C12's source proposal predicts up to600 counter charges for one three-slot merge on its specific empty-record route; verify exact R3 emptiness before implementation. No blanket elimination of the outer source revision record.

3. **Private neutral version carrier construction.** The scoped design at /private/tmp/st-c23-private-counter-design/REVIEW.md still identifies a small real wasted capture: construction-time nonregistration ONLY for the proven private version cell of the exact neutral runtime, preserving custom/default public createCell and native machinery. Approximate remaining count opportunity200, not the already-removed800, and no deletion of600 notification visits. Needs provenance/overridden-constructor, late input/observer, callback order, liveness/disposal controls. More wiring than option1 for a smaller proxy benefit; not a budget-closure strategy.

4. **Conditional singleton evidence snapshot reuse.** A strict single ordinary edit + one physical edit with no later same-subject step could potentially transfer its final physical snapshot instead of cloning again. The selected snapshot may then be updated only before exposure, without changing installed physical views or old saved evidence. This is higher risk than1: selected versus physical requirement differences and mutable View aliases matter. Retained inspection snapshots, same-value owner refresh, reentry, rejected/held proof, multi-edit steps and late recipient acquisition must falsify it. No unconditional Map deletion and no stated numeric saving until alias ownership is demonstrated.

Optional empty topology completion memo elimination removes an allocation but no demonstrated counted visits. Deferring an unused nativeProof read when no validation frame exists may reduce uncounted work, but cannot justify skipping requirement creation/finalization or historic proof. Neither is a credible answer to this absolute gate alone.

## Finite qualification if an option is authorized later

Use one isolated option and exact unchanged original count test plus independently executed calibration/attribution; preserve first failure. Check point installed values, equality/no-op identity, physical versus ordinary inspection adoption, late native enrollment/input, held owner settle/rejection, retained evidence, callback failure/reentry, step/edit identity and source revision refusal. Add only the discriminator for the selected mechanism. Run source/spec types. No long timing/full suite or 130k workload is needed to establish a point delta.

No recommendation to raise <2000, suppress native support based on missing recipients, remove finalization, exploit counter blind spots, or fold the bulk index finding into this count. These local opportunities are concrete but insufficiently large to promise closure. The unresolved cost qualification remains explicit.
