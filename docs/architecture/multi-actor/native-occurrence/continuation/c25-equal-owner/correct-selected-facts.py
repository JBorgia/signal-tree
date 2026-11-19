from pathlib import Path
import shutil
r=Path('/private/tmp/st-c25-equal-owner');c=r/'candidate/packages/kernel/src';a=r/'before-reviewed-corrections';a.mkdir()
for rel in ['lib/experimental-publication/private.ts','lib/internals/native-scalar-selection.ts','enhancers/transactions/transactions.ts']:
 p=a/rel;p.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(c/rel,p)
p=c/'lib/experimental-publication/private.ts';s=p.read_text();old='   if(!mutation.changed&&!lifecycle.isValidating()&&!branchInputs.length&&!restoredScalarSelection(node))return;';new='''   if(!mutation.changed&&!lifecycle.isValidating()&&!branchInputs.length&&!restoredScalarSelection(node)){
    if(!mutation.physicalChanged)return;
    // Physical inspection return is not new ordinary authorship. Replace only
    // the current view; older snapshot certificates keep their old view object.
    const selected=nativeValues.get(node)!,priorView=nativeViews.get(node),priorRequirement=priorView?.requirement;
    return {record:{writes:[{map:nativeViews,key:node,value:{requirement:selected.requirement as lifecycle.NativeRequirement}}],adds:[]},completion:{requirement:selected.requirement},validate:()=>{if(nativeValues.get(node)!==selected||nativeViews.get(node)!==priorView||priorView?.requirement!==priorRequirement)throw new Error('Scalar physical view changed before installation');}};
   }''';assert old in s;s=s.replace(old,new)
old='   const restoration=restoredScalarSelection(node);\n   const selection=restoration?{endpoint:restoration}:prepareScalarSelection(getPositionRegistry(node),node,mutation,predecessor,proposed);'
new='''   const restoration=restoredScalarSelection(node);
   const literal=mutation.intent==='replace'&&branchInputs.length===0&&currentEntityPublicationInputs().length===0;
   const registry=getPositionRegistry(node);
   const priorProof=lifecycle.nativeProof(predecessor.requirement as lifecycle.NativeRequirement);
   // The endpoint binding identifies the selected claim. Its exact owner cell
   // supplies outcome; absence is not confirmation and W is never actual input.
   const boundOwner=predecessor.owner===undefined?undefined:priorProof.destination?.find(cell=>cell.owner===registry?.id&&cell.id===predecessor.owner);
   const allowConfirmedRefresh=!mutation.changed&&literal&&boundOwner?.outcome==='confirmed'&&priorProof.owners.every(cell=>cell.outcome==='confirmed')&&!(priorProof.terminalRejectedRoles??0);
   const selection=restoration?{endpoint:restoration}:prepareScalarSelection(registry,node,mutation,predecessor,proposed,allowConfirmedRefresh);''';assert old in s;s=s.replace(old,new);s=s.replace('const retained=selection?.endpoint??(!mutation.changed&&predecessor.owner!==undefined?predecessor:proposed);','const retained=selection?.endpoint??(!mutation.changed&&predecessor.owner!==undefined&&!allowConfirmedRefresh?predecessor:proposed);')
# Remove the duplicate declaration at its old location.
s=s.replace("   // Keep derived/branch/entity input evidence on the established admission path.\n   const literal=mutation.intent==='replace'&&branchInputs.length===0&&currentEntityPublicationInputs().length===0;","   // Keep derived/branch/entity input evidence on the established admission path.")
p.write_text(s)
p=c/'lib/internals/native-scalar-selection.ts';s=p.read_text();s=s.replace('proposed:NativeFieldEndpoint)=>ScalarSelection','proposed:NativeFieldEndpoint,allowConfirmedRefresh:boolean)=>ScalarSelection',1);s=s.replace('proposed:NativeFieldEndpoint):ScalarSelection|undefined{return registry?selectors.get(registry)?.(node,mutation,before,proposed):undefined;}','proposed:NativeFieldEndpoint,allowConfirmedRefresh=false):ScalarSelection|undefined{return registry?selectors.get(registry)?.(node,mutation,before,proposed,allowConfirmedRefresh):undefined;}');p.write_text(s)
p=c/'enhancers/transactions/transactions.ts';s=p.read_text().replace('(node,mutation,before,proposed)=>{','(node,mutation,before,proposed,allowConfirmedRefresh)=>{',1).replace("if(!mutation.changed)return {endpoint:before.owner!==undefined?before:proposed};","if(!mutation.changed)return {endpoint:before.owner!==undefined&&!allowConfirmedRefresh?before:proposed};",1);p.write_text(s)
# Research setup repair: reopen must author work before expecting a delivery.
p=r/'candidate/packages/kernel/src/lib/equal-owner-all-roots.spec.ts';shutil.copy2(p,r/'runs/roots-small-closed/DIAGNOSTIC.spec.ts');s=p.read_text().replace("if(!connected)c=link(t.$.pair,{set:v=>{sent.push(v);}}) as C;\n  p.confirm();", "if(!connected){c=link(t.$.pair,{set:v=>{sent.push(v);}}) as C;c.declare({kind:'independent'},()=>t.$.pair.y(1));c.declare({kind:'independent'},()=>t.$.pair.y(0));await drain();expect(sent).toEqual([]);}\n  p.confirm();");p.write_text(s)
