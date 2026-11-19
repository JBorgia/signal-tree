from pathlib import Path
import json,hashlib,difflib,shutil
out=Path('/private/tmp/st-occurrence-restoration-trace');base=Path('/private/tmp/st-occurrence-successor');cand=out/'candidate';control=out/'control';sha=lambda b:hashlib.sha256(b).hexdigest()
manifest=json.loads((out/'FROZEN-SOURCE-SHA256.json').read_text())
for name,digest in manifest.items():assert sha((base/name).read_bytes())==digest,name
for name,digest in manifest.items():assert sha((control/name).read_bytes())==digest,name
left=[json.loads(x) for x in (out/'candidate-observations.jsonl').read_text().splitlines()];right=[json.loads(x) for x in (out/'control-observations.jsonl').read_text().splitlines()];assert left==right
(out/'OBSERVATION-COMPARISON.json').write_text(json.dumps({'equal':True,'records':len(left),'modes':5,'frozenManifestVerifiedFiles':len(manifest),'controlRuntimeVerifiedFiles':len(manifest)},indent=2)+'\n')
events=[json.loads(x) for x in (out/'events.jsonl').read_text().splitlines()]
(out/'FIRST-UNIT.json').write_text(json.dumps([x for x in events if x['seq'] in [33,34,35,36,37,40,41,42,46,47]],indent=2)+'\n')
changes={};patch=[]
for p in sorted((cand/'packages/kernel/src/lib').rglob('*.ts')):
 name=str(p.relative_to(cand));old=(base/name).read_bytes() if (base/name).exists() else b'';new=p.read_bytes()
 if old==new:continue
 changes[name]=sha(new);dest=out/'source'/name;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(new)
 patch.extend(difflib.unified_diff(old.decode().splitlines(True),new.decode().splitlines(True),fromfile='a/'+name if old else '/dev/null',tofile='b/'+name))
(out/'instrumentation.patch').write_text(''.join(patch))
(out/'IDENTITY.json').write_text(json.dumps({'frozenCandidate':str(base),'frozenSourceManifestSha256':sha((out/'FROZEN-SOURCE-SHA256.json').read_bytes()),'instrumentedCopy':str(cand),'uninstrumentedControl':str(control),'instrumentationPatchSha256':sha((out/'instrumentation.patch').read_bytes()),'changedCopyFiles':changes,'status':'diagnostic only; no runtime repair; frozen candidate verified unchanged'},indent=2)+'\n')
(out/'REPORT.md').write_text('''# Restoration diagnostic — exact frozen source

**Finding:** the observed hold is not a missing completion or unfinished readiness. The native publication producer narrows a completed whole-row equal replacement to an empty field footprint. The recipient correctly retains the prior field requirement given that empty footprint. Membership adoption is clean but does not author descendant fields. This is source-grounded evidence of lost whole-row authorship, not evidence that the recipient should clear q on branch reappearance. Faraday retains independent oracle adjudication; no review verdict was requested or consulted.

Frozen candidate `/private/tmp/st-occurrence-successor` is unchanged, all 2918 manifest entries verified. Instrumentation is confined to `candidate/`; `control/` has identical frozen runtime with the diagnostic fixture only. IDENTITY.json and instrumentation.patch identify all changes. No repair, extra collection scan, delivery reseed or projection-read workaround was added.

## First unit and exact sequence

The final unchanged original test trace is `events.jsonl`, from `010-original-footprint-trace.log`. FIRST-UNIT.json extracts the decisive events. IDs below are local trace identities, not public transaction IDs.

1. The original rows.updateOne('a',{x:7}) creates native requirement 9. Its finalized proof is unknown with possible owner 10 (pending q), not destination ownership by q. Completion revision 37 installs slot `1:f:x` with requirement 9 and payload [{id:'a',x:7}]. Readiness is resolved; publication remains conservative due to the possible owner.
2. Independent omission completes membership revision 39 and hides this contribution. Output {other:1} progresses while the hidden slot remains available for recovery/reappearance.
3. Literal root restoration hydrates the marker before root membership activation. At seq33 the actual frame instruction is **replace-value**, subject1, supplied row {id:'a',x:7}; physical before/after and ordinary before/after are all this same value. The existing subject is reused; no add/remove/rekey or new lifetime is created.
4. **First support-footprint loss: seq34**, native entity packet. Physical, ordinary and step edits all carry `fields: []`. At seq35 the recipient prepares a collection unit (affected:true, changed:false), correct row payload, **supportEdits:[]**, and new requirement13. At seq36 `completeCollection` is called for revision40. This is an alias in instrumentation for completeSourceProjection -> completeScalar, not a separate production API.
5. At seq37 the same setAll operation sends PathNotifier **fields:null** (whole-row authorship). Thus two consumers of one completed native operation receive different footprints. This directly rules out the explanation that there was no native replacement event at all.
6. At seq40 prepareMembership restores branch. Its source `ordinary.after.value` is {rows:{all:[]}} while the branch is still absent. At seq41 completeMembership completes revision42. This is a separate payload-capture mismatch: ordinaryMemberSnapshot uses the absence-aware collection snapshot before branch activation, not the supplied complete row. It does not itself create a clean row certificate.
7. Reduction order is revision40 collection, revision41 scalar other=2, revision42 membership. Requirement13 is finalized clean; there are no contributor edits to replace slot `1:f:x`. While hidden, selected proof is clean. Membership requirement15 is finalized clean. setPresence re-exposes the retained group; the reducer overlays its retained collection payload over the empty membership snapshot. Final stored payload is the desired restored row with other=2, but selected proof again contains requirement9's pending possible q. Unresolved count remains **0** throughout. No completion was lost; delivery is held on old selected support.

`reducedSelection.payload` in the final trace is stored payload, before outgoing membership masking. It is not a claim that the hidden branch was delivered. The first console-only trace (002) logged masked payload; final instrumentation avoids computing any extra projection for logging. Source snapshots in diagnostic fixtures are read only after delivery observations.

## Exact source hooks (line numbers in frozen source)

- signal-tree.ts:974 recursiveUpdate; :1084 vicinity calls hydrateMarkerNode before final membership reconciliation. Literal input has no branch updater-consumption scope.
- markers/entity-map.ts:371 hydrate; :429 reads absence-aware all; :451 falls back to setAll. While omitted current all is empty, so supplied one-row literal takes the full setter route.
- entity-signal.ts:494 presentEntities returns [] when ancestor is absent; :4950 inStructuralWrite bypasses the standalone hidden-collection clear/re-add path. Thus this root whole-value operation updates the retained subject instead of creating a new entity lifetime.
- entity-signal.ts:4681 vicinity stages replace-value for each existing incoming row; :1189 maps replacement to before/after changes; :1324, :1325 and :1331 build native publication fields from value differences. :2037 publicationFields filters Object.is-equal fields when no explicit footprint is supplied. **This is the decisive native certificate boundary.**
- entity-signal.ts:4779 stagedUpdates notification carries null for non-derived replacement (:4790 vicinity), independently of equal values. Native packet production did not preserve that same intent.
- experimental-publication/entity.ts:115 derives keys from edit.fields; [] updates no field requirements. internals/entity-egress-projection.ts:210 transports only those field slots. link.ts:603 considers the packet affected and completes a receipt even with supportEdits [].
- internals/member-membership.ts:959 captures ordinary snapshot before activation; plain-branch-membership.ts:88 recursively snapshots children, and :113 calls unwrapBranchForWriteCapture. Entity marker snapshot calls all(), which is absence-aware.
- experimental-publication/private.ts:199 collection reduction applies exact contributor edits; :206 membership reduction; :210 setPresence; :217-219 overlays retained collection payload; :232-233 projects support/readiness. RecipientOccurrences.setPresence re-exposes cached counts; it does not invent or replace field authorship.

## Matched controls and verification

`candidate-observations.jsonl` and `control-observations.jsonl` contain ten records each, exactly equal after JSON parsing (OBSERVATION-COMPARISON.json). Both final diagnostic Nx runs pass five observational tests. These tests assert physical row results; they are not five acceptance assertions for disputed publication semantics.

| Operation while q pending | Before q confirmation | After confirmation |
| --- | --- | --- |
| Omit, then literal root restore x=7 | Only {other:1}; receipt conservative/unknown | Restored row sends |
| Omit, then literal root restore x=8 | Restored row sends immediately | No duplicate |
| Omit, restore x=7, then explicit updateOne({x:7}) in same independent declaration | Restored row sends immediately | No duplicate |
| Visible collection, equal setAll literal | No send; declaration no-write | Retained row sends |
| Visible root, equal collection literal plus other=2 | No send; receipt conservative/unknown | Complete root sends |

The issue therefore exists without omission. The explicit equal update supplies Object.keys(transformedChanges) at entity-signal.ts:3732; unlike setAll frame publication, that preserves x authorship.

Original unchanged suite: 001 uninstrumented and 002/009/010 instrumented each yield **4 passed, 1 same restoration assertion failed**. The original test file is unchanged. Initial diagnostic attempted updateOne while hidden and threw `Entity with id a not found`, identically in both copies (003/004). This is expected absent-row semantics, not a repair target; initial-diagnostic.spec.ts and first logs preserve it. The matched subsequent control explicitly restores membership before the row write. Successful-test console output was suppressed in 005/006, so 007/008 record observations directly to evidence files. No broad gates or acceptance claimed.

## Equality, adoption and bounded mechanism

Existing equal-support semantics are not 'all equal setters are new writes'. Plain scalar/branch publication tests distinguish equal value with changed support from equal value with unchanged support (aggregate-installed-publication.spec.ts:60 and :86). collection-contributor-core.spec.ts:101 explicitly requires equal authored x replacement to release a held collection without a public value event. Membership transitions themselves are presence-only, not EntityMap lifetime effects (plain-branch-membership.ts:48-68).

The existing semantic-transition-plan/README.md W2/W8 (:131/:137 and :142-144) distinguishes whole-row authorship from derived footprint and explicitly rejects inferring setAll's authored scope from equal row snapshots. This recorded contract and setAll's own null notification footprint support classifying the empty native footprint as a producer defect. They do not authorize blanket normalization of every restored descendant. Whether the exact new restoration oracle is accepted remains with independent review; the trace does not manufacture acceptance.

A bounded repair mechanism, **not implemented here**: carry the already-known authored footprint and participation on each prepared native replacement/step through the common frame result into both native publication and notification. Full literal row replacement carries null; explicit partial operations carry their exact keys; actual derived operations retain their approved consumed-input/footprint semantics. The native entity participant then replaces only those exact field slots with the newly finalized requirement; recipient reduction consumes those edits before membership re-exposes the occurrence. Equal value/equal support still collapses without value notification or duplicate delivery. Do not clear old q because membership changed, seed a whole collection clean, erase dependencies consumed into surviving y, or promote incidental fields from a later read.

The empty membership snapshot remains a separately exposed source-contract gap for atomic payload/support selection. It should not be repaired by an extra collection walk or projection reread; any successor must carry a source-issued prepared occurrence selection alongside the membership transition or reference the already-prepared exact child selection. This trace establishes the empty capture and successful overlay, but does not qualify hidden inspection/derived/rekey variants. A full selection unit alone cannot repair a packet that already discarded authored field scope.
''')
records={str(p.relative_to(out)):sha(p.read_bytes()) for p in out.rglob('*') if p.is_file() and not p.is_symlink() and str(p.relative_to(out)).split('/')[0] not in ['candidate','control'] and p.name!='EVIDENCE-SHA256.json'}
(out/'EVIDENCE-SHA256.json').write_text(json.dumps(records,sort_keys=True,indent=2)+'\n')
print('Frozen manifest verified; uninstrumented runtime verified; observations exactly match.')
print('instrumentation patch',sha((out/'instrumentation.patch').read_bytes()))
print('evidence manifest',sha((out/'EVIDENCE-SHA256.json').read_bytes()))
