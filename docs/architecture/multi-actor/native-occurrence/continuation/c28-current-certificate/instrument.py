from pathlib import Path
import json,hashlib,difflib,shutil
r=Path('/private/tmp/st-c28-current-certificate');c=r/'candidate';a=r/'research/uninstrumented';a.mkdir(parents=True)
rels=['packages/kernel/src/lib/experimental-publication/private.ts','packages/kernel/src/lib/experimental-publication/lifecycle.ts']
for rel in rels:
 dst=a/rel;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(c/rel,dst)
p=c/rels[0];s=p.read_text();s=s.replace('function nativeInputs(node:object,supplied?:unknown):lifecycle.NativeInput[]{','function nativeInputsOriginal(node:object,supplied?:unknown):lifecycle.NativeInput[]{');s+='''
// Test-only exact root and capture observations; removed before runtime freeze.
let __captureEnabled=false;
let __captures:{node:object;supplied:unknown;inputs:readonly lifecycle.NativeInput[]}[]=[];
function nativeInputs(node:object,supplied?:unknown):lifecycle.NativeInput[]{const inputs=nativeInputsOriginal(node,supplied);if(__captureEnabled)__captures.push({node,supplied,inputs});return inputs;}
export function __historyBeginCapture(){__captures=[];__captureEnabled=true;}
export function __historyEndCapture(){const result=__captures;__captures=[];__captureEnabled=false;return result;}
export function __historyRoots(node:object){return {endpoint:nativeValues.get(node),view:nativeViews.get(node),bindings:[...bindings.values()]};}
export function __historySnapshot(value:object){return snapshotViews.get(value);}
export function __historyFactRoot(value:object){return [factRequirements.get(value as Fact),proofs.get(value as Fact),ownProofs.get(value as Fact),noopPredecessors.get(value as Fact)];}
''';p.write_text(s)
p=c/rels[1];s=p.read_text()+'''
export function __historyWeakRoots(value:object){return [finalizedRetirements.get(value as NativeRequirement),requirementListeners.get(value as NativeRequirement),ownerTransitionObservers.get(value as OwnerCell)];}
export function __historyOperations(){return [...connections.values()].flatMap(connection=>[...connection.ops.values()]);}
''';p.write_text(s)
s=Path('/private/tmp/st-c27-owner-history/owner-history-independent.spec.ts').read_text();s=s.replace('__historyWeakRoots,nativeProof','__historyWeakRoots,__historyOperations,nativeProof')
s=s.replace('let components=0;','let components=0;const ownerCells=new Set<object>();')
s=s.replace("seen.add(value);","seen.add(value);if(Object.hasOwn(value,'outcome')&&Object.hasOwn(value,'dependents'))ownerCells.add(value);")
s=s.replace('return {objects:seen.size,requirements:requirements.size,components};','return {objects:seen.size,requirements:requirements.size,components,ownerCells:ownerCells.size};')
s=s.replace("const out=process.env['ST_HISTORY_OUTPUT'];", """const operations=__historyOperations();
   const selected=operations.filter(op=>roots.bindings.some(binding=>binding.current===op.revision));
   const describe=(cells:Iterable<{owner:number;id:number;outcome:string}>)=>[...cells].map(cell=>({owner:cell.owner,id:cell.id,outcome:cell.outcome}));
   const accounting={currentContributions:roots.bindings.map(binding=>Object.fromEntries((['owners','destination','input','validation','possible'] as const).map(role=>[role,describe(binding.index.proof()[role]??[])]))),selectedOperations:selected.map(op=>({dependencies:describe(op.dependencies),proof:op.proof&&Object.fromEntries((['owners','destination','input','validation','possible'] as const).map(role=>[role,describe(op.proof?.[role]??[])])),nativeOwners:op.native?describe(nativeProof(op.native).owners):[],relevanceSize:op.relevance?.size??0})),allOperationRoots:graph(operations)};
   const out=process.env['ST_HISTORY_OUTPUT'];""")
s=s.replace('roots:graph([roots]),registryDiagnosticOnly','roots:graph([roots,...operations]),accounting,registryDiagnosticOnly')
(r/'research/owner-history-current-certificate.spec.ts').write_text(s);(c/'packages/kernel/src/lib/owner-history-current-certificate.spec.ts').write_text(s)
(r/'research/instrumentation.patch').write_text(''.join(''.join(difflib.unified_diff((a/rel).read_text().splitlines(True),(c/rel).read_text().splitlines(True),fromfile='a/'+rel,tofile='b/'+rel)) for rel in rels))
(r/'research/UNINSTRUMENTED.json').write_text(json.dumps({rel:hashlib.sha256((a/rel).read_bytes()).hexdigest() for rel in rels},indent=2)+'\n')
