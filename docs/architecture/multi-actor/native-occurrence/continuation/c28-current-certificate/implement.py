from pathlib import Path
r=Path('/private/tmp/st-c28-current-certificate');c=r/'candidate/packages/kernel/src/lib/experimental-publication'
def replace(s,a,b):
 assert s.count(a)==1,(a[:90],s.count(a));return s.replace(a,b)
p=c/'lifecycle.ts';s=p.read_text()
s=replace(s,'installedOwners:Set<OwnerCell>};','installedOwners:Set<OwnerCell>;protectedOwners:Set<OwnerCell>};')
s=replace(s,'export function combineScalarNativeRequirements(parts:readonly NativeRequirement[]):NativeRequirement {\n const requirement=combineNativeRequirements(parts);scalarComposites.add(requirement);', '''export function combineScalarNativeRequirements(parts:readonly NativeRequirement[],relevance?:CurrentRelevance):NativeRequirement {
 const requirement=combineNativeRequirements(parts);
 if(relevance?.size)Object.defineProperty(requirement,'proof',{get:()=>currentObligations(combineProofs(parts.map(nativeProof)),relevance),configurable:true,enumerable:true});
 scalarComposites.add(requirement);''')
anchor='/** Scalar-only construction; never installs listeners during preparation. */'
addition='''/** Admission-local confirmed history, never a settlement-time filter. */
export type CurrentRelevance=ReadonlySet<OwnerCell>;
export function currentRelevance(retained:NativeRequirement,invocation:NativeRequirement):CurrentRelevance {
 const protectedOwners=new Set(invocation.inputs.flatMap(input=>input.owners));
 for(const frame of invocation.frames)for(const cell of frame.protectedOwners)protectedOwners.add(cell);
 const parts=[nativeProof(retained),nativeProof(invocation)];
 return new Set(parts.flatMap(part=>[...(part.input??[]),...(part.validation??[])])
  .filter(cell=>cell.outcome==='confirmed'&&!protectedOwners.has(cell)));
}
export function currentObligations(proof:Readonly<Proof>,relevance:CurrentRelevance|undefined):Proof {
 if(!relevance?.size)return proof;
 const classified=new Set([...(proof.destination??[]),...(proof.input??[]),...(proof.validation??[])]);
 const protectedOwners=new Set([...(proof.destination??[]),...(proof.possible??[]),...proof.owners.filter(cell=>!classified.has(cell))]);
 const keep=(cell:OwnerCell)=>!relevance.has(cell)||protectedOwners.has(cell);
 const input=Object.freeze((proof.input??[]).filter(keep)),validation=Object.freeze((proof.validation??[]).filter(keep));
 return {...proof,input,validation,owners:Object.freeze(proof.owners.filter(keep))};
}
function reconcileCurrentDependencies(op:Operation,proof:Readonly<Proof>,relevance:CurrentRelevance|undefined):void {
 if(!relevance?.size)return;
 const retained=new Set([...proof.owners,...(proof.possible??[])]);
 for(const cell of op.dependencies)if(relevance.has(cell)&&cell.outcome==='confirmed'&&!retained.has(cell)){
  op.dependencies.delete(cell);cell.dependents.delete(op);
 }
}
'''
s=replace(s,anchor,addition+anchor)
s=replace(s,'for(const frame of active){\n  for(const owner of [...(evidence.input??[]),...(evidence.validation??[])])', 'for(const frame of active){\n  for(const owner of inputs.flatMap(input=>input.owners))adds.push({set:frame.protectedOwners,value:owner});\n  for(const owner of [...(evidence.input??[]),...(evidence.validation??[])])')
s=replace(s,'type Operation={declared:boolean;','type Operation={relevance?:CurrentRelevance;declared:boolean;')
s=replace(s,'invocation:NativeRequirement|undefined=native):TerminalRecordPlan', 'invocation:NativeRequirement|undefined=native,relevance?:CurrentRelevance):TerminalRecordPlan')
s=replace(s,'const op:Operation={declared:matches.length!==0,','const op:Operation={relevance,declared:matches.length!==0,')
s=replace(s,'op.proof=recipientProof(op,{...combineProofs(proofs),unknown:op.coverageUnknown||proofs.some(p=>p.unknown)});','op.proof=currentObligations(recipientProof(op,{...combineProofs(proofs),unknown:op.coverageUnknown||proofs.some(p=>p.unknown)}),op.relevance);\n  reconcileCurrentDependencies(op,op.proof,op.relevance);')
s=replace(s,'ops:new Set(),installedOwners:new Set()};','ops:new Set(),installedOwners:new Set(),protectedOwners:new Set()};')
s=replace(s,"frame.declaredOwners=kind==='unknown'?undefined:Object.freeze([...new Set(owners)]);","frame.declaredOwners=kind==='unknown'?undefined:Object.freeze([...new Set(owners)]);\n  for(const cell of owners)if(cell.outcome!=='confirmed')frame.protectedOwners.add(cell);")
s=replace(s,'const selected=recipientProof(op,proof);op.projectionPending=projectionPending;op.proof=selected;', 'const selected=currentObligations(recipientProof(op,proof),op.relevance);\n reconcileCurrentDependencies(op,selected,op.relevance);op.relevance=undefined;\n op.projectionPending=projectionPending;op.proof=selected;')
p.write_text(s)
p=c/'private.ts';s=p.read_text();s=replace(s,'type Unit={collection?:','type Unit={relevance?:lifecycle.CurrentRelevance;collection?:')
s=replace(s,'const requirement=exact?retained.requirement as lifecycle.NativeRequirement:admitted?prepared.requirement:lifecycle.combineScalarNativeRequirements([retained.requirement as lifecycle.NativeRequirement,prepared.requirement]);', '''const relevance=exact?undefined:lifecycle.currentRelevance(retained.requirement as lifecycle.NativeRequirement,prepared.requirement);
   const requirement=exact?retained.requirement as lifecycle.NativeRequirement:admitted&&!relevance?.size?prepared.requirement:lifecycle.combineScalarNativeRequirements(admitted?[prepared.requirement]:[retained.requirement as lifecycle.NativeRequirement,prepared.requirement],relevance);''')
s=replace(s,'const endpoint=exact||admitted?retained:Object.freeze({...retained,requirement});','const endpoint=requirement===retained.requirement?retained:Object.freeze({...retained,requirement});')
s=replace(s,'const view=mutation.changed||mutation.physicalChanged||!existingView?{requirement}:existingView;', 'const view=mutation.changed||mutation.physicalChanged||!existingView||existingView.requirement!==requirement?{requirement}:existingView;')
s=replace(s,',...(view===existingView&&existingView?[{map:{set:(_key:unknown,value:unknown)=>{existingView.requirement=value as lifecycle.NativeRequirement;}},key:node,value:requirement}]:[])','')
s=replace(s,'completion:{requirement,activation:prepared.requirement}', 'completion:{requirement,activation:prepared.requirement,relevance}')
s=replace(s,'const authoredRequirement=lifecycle.combineNativeRequirements([requirementOf(proof),...(unit.native?[unit.native]:[])]);','const authoredRequirement=lifecycle.combineNativeRequirements([requirementOf(lifecycle.currentObligations(proof,unit.relevance)),...(unit.native?[unit.native]:[])]);')
s=replace(s,'sameProof(prior,effective);','sameProof(prior&&lifecycle.currentObligations(prior,unit.relevance),lifecycle.currentObligations(effective,unit.relevance));')
s=replace(s,'const unit:Unit={native,invocation:', 'const relevance=(nativeUnit as {relevance?:lifecycle.CurrentRelevance}|undefined)?.relevance;\n const unit:Unit={relevance,native,invocation:')
s=replace(s,"(nativeUnit as {activation?:lifecycle.NativeRequirement}|undefined)?.activation??native);", "(nativeUnit as {activation?:lifecycle.NativeRequirement}|undefined)?.activation??native,relevance);")
p.write_text(s)
