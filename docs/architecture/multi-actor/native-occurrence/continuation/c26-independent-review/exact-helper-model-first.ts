// Generated isolated closed-requirement model; no C25 runtime imports.
import assert from 'node:assert/strict';
type Operation = unknown;
interface OwnerCell { readonly owner:number; readonly id:number; outcome:'pending'|'confirmed'|'rolled-back'|'abandoned'; readonly dependents:Set<Operation> }
type Frame = never;
type Requirement = NativeRequirement;
const sources = new Map<number,{cells:Map<number,OwnerCell>}>();
// Explicit model guard: all leaves must already have cached finalized proofs.
function effective(_frame:Frame):Proof { throw Error('Outside model: unresolved frame'); }
function frameInvalid(_frame:Frame):boolean { throw Error('Outside model: unresolved frame'); }
export type Proof={
 readonly owners:readonly OwnerCell[];
 /** D gates delivery; it is promoted to I only when a source input is consumed. */
 readonly destination?:readonly OwnerCell[];
 readonly input?:readonly OwnerCell[];
 readonly validation?:readonly OwnerCell[];
 readonly possible?:readonly OwnerCell[];
 /** Terminal role bits preserve rejected obligations without fake owner identities. */
 readonly terminalRejectedRoles?:number;
 /** Missing evidence for this exact input; consuming it acquires a new window. */
 readonly unavailableInput?:boolean;
 /** A fixed authorship window existed; terminal cleanup must not rebase it. */
 readonly historicalWindow?:boolean;
 readonly unknown:boolean;
 readonly invalid:boolean;
};

const uniqueOwners=(owners:readonly OwnerCell[]):readonly OwnerCell[]=>Object.freeze([...new Set(owners)]);
/** Combine reasons without normalizing inherited uncertainty against actual owners. */
export function combineProofs(parts:readonly (Readonly<Proof>|undefined)[]):Proof {
 return {owners:uniqueOwners(parts.flatMap(p=>p?.owners??[])),
  destination:uniqueOwners(parts.flatMap(p=>p?.destination??[])),
  input:uniqueOwners(parts.flatMap(p=>p?.input??[])),
  validation:uniqueOwners(parts.flatMap(p=>p?.validation??[])),
  possible:uniqueOwners(parts.flatMap(p=>p?.possible??[])),
  terminalRejectedRoles:parts.reduce((bits,p)=>bits|(p?.terminalRejectedRoles??0),0),
  unavailableInput:parts.some(p=>p?.unavailableInput===true),
  historicalWindow:parts.some(p=>p?.historicalWindow===true),
  unknown:parts.some(p=>!p||p.unknown),invalid:parts.some(p=>p?.invalid===true)};
}

export type NativeInput={readonly requirement:NativeRequirement;readonly owners:readonly OwnerCell[];readonly terminalRejectedRoles?:number};
export type NativeRequirement={
/** Preparation provenance, never inferred from a compacted unknown bit. */
readonly retirementOwnWindowOnly?: boolean;
readonly components?:readonly NativeRequirement[];proof?:Proof;inputs:readonly NativeInput[];frames:readonly Frame[];known:readonly OwnerCell[];unknown:boolean;possible:readonly OwnerCell[];captureWindow:boolean};

const unfinishedRequirements=new WeakSet<NativeRequirement>();
const unactivatedRequirements=new WeakSet<NativeRequirement>();
const requirementListeners=new WeakMap<NativeRequirement,Set<()=>void>>();
export function nativeRequirementReady(requirement:NativeRequirement):boolean {
 return !unfinishedRequirements.has(requirement)&&!unactivatedRequirements.has(requirement)&&(requirement.components??[]).every(nativeRequirementReady);
}
export function combineNativeRequirements(components:readonly NativeRequirement[]):NativeRequirement {
 const sources=Object.freeze([...new Set(components)]);
 return {components:sources,get proof(){return combineProofs(sources.map(nativeProof));},inputs:[],frames:[],known:[],unknown:false,possible:[],captureWindow:false};
}

export function nativeProof(requirement: NativeRequirement): Proof {
 const p=requirement.proof;if(p)return p;
 const inputs=requirement.inputs.map(input=>nativeProof(input.requirement));
 const validation=requirement.frames.map(effective);
 // Every actual source obligation, including its destination authorship,
 // becomes an input lower bound at this consumption boundary. W stays W.
 const input=uniqueOwners(requirement.inputs.flatMap(input=>input.owners));
 const declared=uniqueOwners(validation.flatMap(p=>p.owners));
 const ownWindow=requirement.captureWindow||requirement.frames.some(frameInvalid)
  ?requirement.possible:[];
 return {destination:requirement.known,input,validation:declared,
  owners:uniqueOwners([...requirement.known,...input,...declared]),
  possible:uniqueOwners([...ownWindow,...inputs.flatMap(p=>p.possible??[])]),
  // Authorship consumes unavailable input into this installation's fixed W.
  // Selecting/combining a contributor does not pass through this boundary.
  terminalRejectedRoles:requirement.inputs.some(input=>(input.terminalRejectedRoles??0)!==0)?2:0,
  unavailableInput:false,
  historicalWindow:requirement.captureWindow||inputs.some(p=>p.historicalWindow===true),
  unknown:requirement.unknown||ownWindow.length>0||inputs.some(p=>p.unknown)||validation.some(p=>p.unknown),
  invalid:inputs.some(p=>p.invalid)||validation.some(p=>p.invalid)};
}

export function ownerCellCanTransition(cell: OwnerCell): boolean {
 return cell.outcome === 'pending' && sources.get(cell.owner)?.cells.get(cell.id) === cell;
}

const lifecycle={nativeProof,nativeRequirementReady,ownerCellCanTransition};
function assess(root:NativeRequirement){
 const requirements=new Set([root]);
      const ready = [...requirements].every(lifecycle.nativeRequirementReady);
      const waiting = new Set<lifecycle.OwnerCell>();
      const releasable = (requirement: Requirement): boolean => {
        // A composite is eligible only when every constituent independently is.
        if (requirement.components) return requirement.components.every(releasable);
        const proof = lifecycle.nativeProof(requirement);
        if (proof.invalid || proof.unavailableInput || proof.terminalRejectedRoles ||
            proof.owners.length || (proof.destination?.length ?? 0) ||
            (proof.input?.length ?? 0) || (proof.validation?.length ?? 0)) return false;
        if (!proof.unknown && !(proof.possible?.length ?? 0)) return true;
        // Do not erase arbitrary unknown input/origin/validation. Only the
        // source's own window, classified before those facts could be cleared.
        if (!requirement.retirementOwnWindowOnly || !proof.historicalWindow) return false;
        for (const cell of proof.possible ?? []) {
          if (cell.outcome === 'confirmed' || cell.outcome === 'rolled-back') continue;
          if (!lifecycle.ownerCellCanTransition(cell)) return false;
          waiting.add(cell);
        }
        return true;
      };
      const canRelease = ready && [...requirements].every(releasable);
      const canRetire = canRelease && waiting.size === 0;

 return {ready,canRelease,canRetire,waiting:[...waiting].map(x=>`${x.owner}:${x.id}`),wouldSubscribe:canRelease&&waiting.size>0, subscriptionCells:canRelease?[...waiting]:[]};
}
function leaf(proof:Proof, provenance?:boolean):NativeRequirement {
 const result:NativeRequirement={proof,inputs:[],frames:[],known:[],unknown:false,possible:[],captureWindow:false};
 if(provenance!==undefined)Object.defineProperty(result,'retirementOwnWindowOnly',{value:provenance,enumerable:true});
 return result;
}
const clean=()=>leaf({owners:[],unknown:false,invalid:false});
function ownWindow(cell:OwnerCell){return leaf({owners:[],unknown:true,invalid:false,historicalWindow:true,possible:[cell]},true);}
const arbitrary=()=>leaf({owners:[],unknown:true,invalid:false},false);
function flatten(root:NativeRequirement):NativeRequirement {
 const result=leaf(nativeProof(root));
 if(Object.hasOwn(root,'retirementOwnWindowOnly'))Object.defineProperty(result,'retirementOwnWindowOnly',{value:root.retirementOwnWindowOnly,enumerable:true});
 assert.deepEqual(nativeProof(result),nativeProof(root));
 assert.equal(Object.hasOwn(result,'retirementOwnWindowOnly'),Object.hasOwn(root,'retirementOwnWindowOnly'));
 assert.equal(result.retirementOwnWindowOnly,root.retirementOwnWindowOnly);
 assert.equal(result.components,undefined);
 return result;
}
const cell:OwnerCell={owner:1,id:1,outcome:'confirmed',dependents:new Set()};
function compare(name:string,root:NativeRequirement,expectedOriginal:boolean,expectedFlat:boolean){
 const flat=flatten(root),original=assess(root),flattened=assess(flat);
 assert.equal(original.canRetire,expectedOriginal,name+' original');
 assert.equal(flattened.canRetire,expectedFlat,name+' flattened');
 assert.equal(original.ready,true);assert.equal(flattened.ready,true);
 console.log(JSON.stringify({case:name,original,flattened,rootProvenance:Object.hasOwn(root,'retirementOwnWindowOnly')?root.retirementOwnWindowOnly:'absent'}));
 return {flat,original,flattened};
}
compare('clean+clean',combineNativeRequirements([clean(),clean()]),true,true);
compare('own-window-confirmed+clean',combineNativeRequirements([ownWindow(cell),clean()]),true,false);
cell.outcome='rolled-back';
compare('own-window-rolled-back+clean',combineNativeRequirements([ownWindow(cell),clean()]),true,false);
compare('arbitrary-unknown+clean',combineNativeRequirements([arbitrary(),clean()]),false,false);
const mixed=combineNativeRequirements([ownWindow(cell),arbitrary()]);
const mixedResult=compare('own-window+arbitrary-unknown',mixed,false,false);
// Deliberately UNSAFE comparison: guessing true provenance from one component.
const unsafe=leaf(nativeProof(mixed),true);
assert.deepEqual(nativeProof(unsafe),nativeProof(mixed));
assert.equal(assess(unsafe).canRetire,true);
console.log(JSON.stringify({case:'unsafe-promoted-provenance',original:mixedResult.original,flattenedWithInventedTrue:assess(unsafe)}));
cell.outcome='pending';sources.set(cell.owner,{cells:new Map([[cell.id,cell]])});
const pendingLeaf=ownWindow(cell),pendingComposite=combineNativeRequirements([pendingLeaf,clean()]);
const pending=compare('own-window-pending-present+clean',pendingComposite,false,false);
assert.equal(pending.original.canRelease,true);assert.equal(pending.original.wouldSubscribe,true);
assert.deepEqual(pending.original.waiting,['1:1']);assert.equal(pending.flattened.canRelease,false);
const proofBefore=nativeProof(pendingLeaf),outcomeBefore=cell.outcome;
const before=assess(pendingLeaf);
// Exact source-disappearance effects used by abandonOwnerSource: clear/delete
// storage; no owner outcome transition. Wake/notification scheduling is omitted.
sources.get(cell.owner)!.cells.clear();sources.delete(cell.owner);
assert.equal(cell.outcome,outcomeBefore);assert.equal(nativeProof(pendingLeaf),proofBefore);
const after=assess(pendingLeaf);
assert.equal(before.canRelease,true);assert.equal(before.wouldSubscribe,true);
assert.equal(after.canRelease,false);assert.equal(after.wouldSubscribe,false);
console.log(JSON.stringify({case:'source-disappearance-same-leaf',before,after,outcomeUnchanged:cell.outcome,proofIdentityUnchanged:true}));
const missing=compare('own-window-pending-disappeared+clean',pendingComposite,false,false);
assert.equal(missing.original.canRelease,false);
console.log('PASS: 7 original/flattened comparisons plus unsafe-provenance and source-disappearance controls; predicate model only.');

/** Exact recursive retirement classification, separate from publication roles. */
export type FinalizedRetirement = Readonly<{ blocked:boolean; possible:readonly OwnerCell[] }>;
const finalizedRetirements=new WeakMap<NativeRequirement,FinalizedRetirement>();
const scalarComposites=new WeakSet<NativeRequirement>();
const normalizingScalars=new WeakSet<NativeRequirement>();
export function finalizedRetirement(requirement:NativeRequirement):FinalizedRetirement|undefined {
 return finalizedRetirements.get(requirement);
}
function retirementClassification(requirement:NativeRequirement):FinalizedRetirement {
 const saved=finalizedRetirements.get(requirement);if(saved)return saved;
 if(requirement.components){
  const parts=requirement.components.map(retirementClassification);
  return {blocked:parts.some(part=>part.blocked),possible:uniqueOwners(parts.flatMap(part=>part.possible))};
 }
 const p=nativeProof(requirement);
 if(p.invalid||p.unavailableInput||p.terminalRejectedRoles||p.owners.length||p.destination?.length||p.input?.length||p.validation?.length)return {blocked:true,possible:[]};
 if(!p.unknown&&!(p.possible?.length??0))return {blocked:false,possible:[]};
 if(!requirement.retirementOwnWindowOnly||!p.historicalWindow)return {blocked:true,possible:[]};
 return {blocked:false,possible:uniqueOwners(p.possible??[])};
}
function normalizeScalar(requirement:NativeRequirement):void {
 if(!scalarComposites.has(requirement)||!requirement.components||!nativeRequirementReady(requirement))return;
 // Compute both certificates while ancestry is intact. Preserve endpoint identity,
 // exact role cells, root provenance and live outcomes/source availability.
 const proof=nativeProof(requirement),retirement=retirementClassification(requirement);
 finalizedRetirements.set(requirement,Object.freeze(retirement));
 Object.defineProperty(requirement,'proof',{value:proof,writable:true,configurable:true,enumerable:true});
 Reflect.deleteProperty(requirement,'components');
}
/** Scalar-only construction; never installs listeners during preparation. */
export function combineScalarNativeRequirements(parts:readonly NativeRequirement[]):NativeRequirement {
 const requirement=combineNativeRequirements(parts);scalarComposites.add(requirement);
 normalizeScalar(requirement);return requirement;
}

// Independent finite B/Q summary discriminator; closed-proof model only.
type Summary = { blocked: boolean; qualifying: readonly OwnerCell[] };
function summarize(r:NativeRequirement):Summary {
 const before=nativeProof(r);
 const normalized=combineScalarNativeRequirements([r]);
 assert.deepEqual(nativeProof(normalized),before,'exact role proof preserved');
 assert.equal(normalized.components,undefined,'components removed');
 const descriptor=Object.getOwnPropertyDescriptor(normalized,'proof');
 assert.equal(descriptor?.get,undefined,'getter closure removed');
 const summary=finalizedRetirement(normalized)!;
 assert.ok(summary,'retirement classification present');
 return {blocked:summary.blocked,qualifying:summary.possible};
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
