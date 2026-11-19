from pathlib import Path
import hashlib,json
r=Path('/private/tmp/st-finalized-role-retirement-discriminator');o=Path('/private/tmp/st-finalized-role-retirement-equivalence');original=(r/'model.ts').read_text();originalhash=hashlib.sha256(original.encode()).hexdigest()
# Preserve extracted helpers and original tests; add the exposed subscription identities to the local assessment result only.
s=original.replace('wouldSubscribe:canRelease&&waiting.size>0};','wouldSubscribe:canRelease&&waiting.size>0, subscriptionCells:canRelease?[...waiting]:[]};')
assert s!=original
s+='''
// Independent finite B/Q summary discriminator; closed-proof model only.
type Summary = { blocked: boolean; qualifying: readonly OwnerCell[] };
function summarize(r:NativeRequirement):Summary {
 if(r.components){const children=r.components.map(summarize);return {blocked:children.some(x=>x.blocked),qualifying:[...new Set(children.flatMap(x=>x.qualifying))]};}
 const p=nativeProof(r);
 const hard=!!(p.invalid||p.unavailableInput||p.terminalRejectedRoles||p.owners.length||(p.destination?.length??0)||(p.input?.length??0)||(p.validation?.length??0));
 if(hard)return {blocked:true,qualifying:[]};
 if(!p.unknown&&!(p.possible?.length??0))return {blocked:false,qualifying:[]};
 if(r.retirementOwnWindowOnly&&p.historicalWindow)return {blocked:false,qualifying:p.possible??[]};
 return {blocked:true,qualifying:[]};
}
function summaryAssess(r:NativeRequirement,s:Summary){
 const ready=nativeRequirementReady(r);
 const terminal=(c:OwnerCell)=>c.outcome==='confirmed'||c.outcome==='rolled-back';
 const canRelease=ready&&!s.blocked&&s.qualifying.every(c=>terminal(c)||ownerCellCanTransition(c));
 const subscriptionCells=canRelease?s.qualifying.filter(c=>!terminal(c)):[];
 return {ready,canRelease,canRetire:canRelease&&subscriptionCells.length===0,wouldSubscribe:canRelease&&subscriptionCells.length>0,subscriptionCells};
}
let comparisons=0;
function check(name:string,r:NativeRequirement,s=summarize(r)){
 const a=assess(r),b=summaryAssess(r,s);
 for(const key of ['ready','canRelease','canRetire','wouldSubscribe'] as const)assert.equal(b[key],a[key],name+':'+key);
 if(a.canRelease){assert.equal(b.subscriptionCells.length,a.subscriptionCells.length,name+':subscription length');for(let i=0;i<a.subscriptionCells.length;i++)assert.equal(b.subscriptionCells[i],a.subscriptionCells[i],name+':exact cell/order '+i);}
 comparisons++;
 console.log(JSON.stringify({summaryCase:name,ready:b.ready,canRelease:b.canRelease,canRetire:b.canRetire,wouldSubscribe:b.wouldSubscribe,subscriptions:b.canRelease?b.subscriptionCells.map(c=>`${c.owner}:${c.id}`):null}));
}
function mk(owner:number,id:number,outcome:OwnerCell['outcome']='pending'):OwnerCell{return {owner,id,outcome,dependents:new Set()};}
function register(c:OwnerCell){let source=sources.get(c.owner);if(!source)sources.set(c.owner,source={cells:new Map()});source.cells.set(c.id,c);}
const a=mk(101,1),b=mk(101,2);register(a);register(b);
check('clean+clean',combineNativeRequirements([clean(),clean()]));
check('empty-composite',combineNativeRequirements([]));
// Production predicate prioritizes components even if other fields conflict.
check('empty-composite-ignores-own-blocker',{...combineNativeRequirements([]),proof:{owners:[a],unknown:true,invalid:true},retirementOwnWindowOnly:false});
check('nested-empty',combineNativeRequirements([combineNativeRequirements([]),clean()]));
check('duplicate-cell-different-leaves',combineNativeRequirements([ownWindow(a),ownWindow(a),ownWindow(b)]));
const shared=ownWindow(a);check('duplicate-shared-leaf',combineNativeRequirements([shared,shared,combineNativeRequirements([shared,ownWindow(b)])]));
check('blocker-first',combineNativeRequirements([arbitrary(),ownWindow(a)]));
check('blocker-last',combineNativeRequirements([ownWindow(a),arbitrary()]));
check('nested-blocker-last',combineNativeRequirements([ownWindow(a),combineNativeRequirements([ownWindow(b),arbitrary()])]));
check('arbitrary-unknown-only',arbitrary());
check('own-window-empty',leaf({owners:[],unknown:true,invalid:false,historicalWindow:true,possible:[]},true));
check('missing-provenance',leaf({owners:[],unknown:true,invalid:false,historicalWindow:true,possible:[a]}));
check('missing-history',leaf({owners:[],unknown:true,invalid:false,possible:[a]},true));
for(const flag of ['invalid','unavailableInput'] as const)check('hard-'+flag,leaf({owners:[],unknown:false,invalid:false,[flag]:true},true));
for(const bits of [1,2,3])check('terminal-bits-'+bits,leaf({owners:[],unknown:false,invalid:false,terminalRejectedRoles:bits},true));
for(const role of ['owners','destination','input','validation'] as const)check('actual-role-'+role,leaf({owners:[],unknown:true,invalid:false,historicalWindow:true,possible:[a],[role]:[a]},true));
check('overlapping-actual-window',leaf({owners:[a],destination:[a],input:[a],validation:[a],possible:[a],unknown:true,invalid:false,historicalWindow:true},true));
for(const outcome of ['pending','confirmed','rolled-back','abandoned'] as const){
 for(const registry of ['present','missing','replacement'] as const){
  const c=mk(200,1,outcome);sources.delete(200);if(registry==='present')register(c);if(registry==='replacement')register(mk(200,1,outcome));
  check(outcome+'-'+registry,combineNativeRequirements([ownWindow(c),clean()]));
 }
}
const live=mk(301,1),confirmed=mk(302,1,'confirmed'),rolled=mk(303,1,'rolled-back'),abandoned=mk(304,1,'abandoned');register(live);register(abandoned);
check('mixed-live-confirmed-rolled',combineNativeRequirements([ownWindow(confirmed),ownWindow(live),ownWindow(rolled)]));
check('mixed-add-abandoned',combineNativeRequirements([ownWindow(confirmed),ownWindow(live),ownWindow(abandoned)]));
// Reuse ONE summary while registry identity/outcomes change. No snapshotting availability.
const changing=mk(400,1);register(changing);const root=combineNativeRequirements([ownWindow(changing),clean()]);const saved=summarize(root);
check('dynamic-present',root,saved);sources.delete(400);check('dynamic-disappeared-same-pending',root,saved);
register(mk(400,1));check('dynamic-replacement-same-key',root,saved);register(changing);check('dynamic-exact-restored',root,saved);
changing.outcome='confirmed';sources.delete(400);check('dynamic-confirmed-missing',root,saved);
// Readiness remains a separate input; this does not simulate activation scheduling.
const gated=ownWindow(a),gatedSummary=summarize(gated);unfinishedRequirements.add(gated);check('unfinished-gate',gated,gatedSummary);unfinishedRequirements.delete(gated);unactivatedRequirements.add(gated);check('unactivated-gate',gated,gatedSummary);unactivatedRequirements.delete(gated);check('both-gates-clear',gated,gatedSummary);
assert.equal(comparisons,45);
console.log(JSON.stringify({result:'PASS',summaryComparisons:comparisons,scope:'closed predicate plus readiness gating; no lifecycle scheduling simulation'}));
'''
(o/'summary-model.ts').write_text(s)
(o/'DISCRIMINATOR-IDENTITY.json').write_text(json.dumps({'originalPath':str(r/'model.ts'),'originalSha256':originalhash,'summarySha256':hashlib.sha256(s.encode()).hexdigest(),'originalUnchangedAfterPreparation':hashlib.sha256((r/'model.ts').read_bytes()).hexdigest()==originalhash},indent=2)+'\n')
