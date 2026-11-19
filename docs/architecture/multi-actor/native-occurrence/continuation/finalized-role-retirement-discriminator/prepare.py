from pathlib import Path
import hashlib,json
out=Path(__file__).parent
root=Path('/private/tmp/st-c25-equal-owner/candidate/packages/kernel/src/lib/experimental-publication')
l=(root/'lifecycle.ts').read_text();e=(root/'entity.ts').read_text()
def between(s,a,b):
 start=s.index(a);return s[start:s.index(b,start)]
chunks={
 'proof-type':between(l,'export type Proof={','const uniqueOwners='),
 'combine-proof':between(l,'const uniqueOwners=','/** Source-owned facts.'),
 'requirement-types':between(l,'export type NativeInput=','// Readiness is independent'),
 'readiness-and-composite':between(l,'const unfinishedRequirements=','export function onNativeRequirementReady'),
 'native-proof':between(l,'export function nativeProof(','export function initialRequirement'),
 'owner-transition-check':between(l,'export function ownerCellCanTransition(','export function onOwnerCellTransition'),
 'retirement-predicate':between(e,'      const ready = [...requirements]','      return { ready, canRetire,'),
}
header="""// Generated isolated closed-requirement model; no C25 runtime imports.
import assert from 'node:assert/strict';
type Operation = unknown;
interface OwnerCell { readonly owner:number; readonly id:number; outcome:'pending'|'confirmed'|'rolled-back'|'abandoned'; readonly dependents:Set<Operation> }
type Frame = never;
type Requirement = NativeRequirement;
const sources = new Map<number,{cells:Map<number,OwnerCell>}>();
// Explicit model guard: all leaves must already have cached finalized proofs.
function effective(_frame:Frame):Proof { throw Error('Outside model: unresolved frame'); }
function frameInvalid(_frame:Frame):boolean { throw Error('Outside model: unresolved frame'); }
"""
body=header+'\n'.join(chunks[k] for k in chunks if k!='retirement-predicate')
body+='\nconst lifecycle={nativeProof,nativeRequirementReady,ownerCellCanTransition};\nfunction assess(root:NativeRequirement){\n const requirements=new Set([root]);\n'+chunks['retirement-predicate']+'\n return {ready,canRelease,canRetire,waiting:[...waiting].map(x=>`${x.owner}:${x.id}`),wouldSubscribe:canRelease&&waiting.size>0};\n}\n'
body+=(out/'cases.txt').read_text()
(out/'model.ts').write_text(body)
records={}
for name,s in [('lifecycle.ts',l),('entity.ts',e)]:
 (out/name).write_text(s);records[name]={'path':str(root/name),'sha256':hashlib.sha256(s.encode()).hexdigest()}
(out/'EXTRACTION.json').write_text(json.dumps({'sources':records,'chunks':{k:{'sha256':hashlib.sha256(v.encode()).hexdigest(),'startLine':(e if k=='retirement-predicate' else l)[:(e if k=='retirement-predicate' else l).index(v)].count('\n')+1} for k,v in chunks.items()}},indent=2)+'\n')
