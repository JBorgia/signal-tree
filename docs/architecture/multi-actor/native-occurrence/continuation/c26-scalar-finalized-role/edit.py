from pathlib import Path
r=Path('/private/tmp/st-c26-scalar-finalized-role');c=r/'candidate/packages/kernel/src/lib/experimental-publication'
p=c/'lifecycle.ts';s=p.read_text();anchor='export function onNativeRequirementReady(requirement:NativeRequirement,callback:()=>void):()=>void {'
addition='''/** Exact recursive retirement classification, separate from publication roles. */
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
/** Called only by installed scalar native completion. Outstanding synchronous
 * completion/horizon work owns this finite registration, not Link or owner life.
 * Register before activation, which may notify a throwing listener. */
export function completeScalarNativeRequirement(requirement:NativeRequirement|undefined,activation:NativeRequirement|undefined):void {
 let failed=false,first:unknown;
 try{
  if(requirement&&scalarComposites.has(requirement)&&requirement.components&&!normalizingScalars.has(requirement)){
   normalizingScalars.add(requirement);
   onNativeRequirementReady(requirement,()=>{
    normalizingScalars.delete(requirement);normalizeScalar(requirement);
   });
  }
 }catch(error){failed=true;first=error;}
 try{deliverNativeRequirementReady(activation);}catch(error){if(!failed){failed=true;first=error;}}
 if(failed)throw first;
}
'''
assert anchor in s;s=s.replace(anchor,addition+anchor);p.write_text(s)
p=c/'private.ts';s=p.read_text();s=s.replace('lifecycle.combineNativeRequirements([retained.requirement as lifecycle.NativeRequirement,prepared.requirement])','lifecycle.combineScalarNativeRequirements([retained.requirement as lifecycle.NativeRequirement,prepared.requirement])');old='  complete:(completion)=>{lifecycle.deliverNativeRequirementReady((completion as {activation?:lifecycle.NativeRequirement;requirement?:lifecycle.NativeRequirement}).activation??(completion as {requirement?:lifecycle.NativeRequirement}).requirement);},';new='  complete:(completion)=>{const unit=completion as {activation?:lifecycle.NativeRequirement;requirement?:lifecycle.NativeRequirement};lifecycle.completeScalarNativeRequirement(unit.requirement,unit.activation??unit.requirement);},';assert old in s;s=s.replace(old,new);p.write_text(s)
p=c/'entity.ts';s=p.read_text();anchor='''        // A composite is eligible only when every constituent independently is.
''';new='''        // Scalar-normalized aliases preserve the exact recursive classification.
        // Entity composites themselves remain unchanged and unenrolled.
        const finalized=lifecycle.finalizedRetirement(requirement);
        if(finalized){
          if(finalized.blocked)return false;
          for(const cell of finalized.possible){
            if(cell.outcome==='confirmed'||cell.outcome==='rolled-back')continue;
            if(!lifecycle.ownerCellCanTransition(cell))return false;
            waiting.add(cell);
          }
          return true;
        }
''';assert anchor in s;s=s.replace(anchor,new+anchor);p.write_text(s)
