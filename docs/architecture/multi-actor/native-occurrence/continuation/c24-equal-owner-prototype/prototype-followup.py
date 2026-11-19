from pathlib import Path
c=Path('/private/tmp/st-c24-equal-owner/candidate/packages/kernel/src')
p=c/'lib/experimental-publication/private.ts';s=p.read_text().replace('if(!mutation.changed&&!lifecycle.isValidating()&&!branchInputs.length)return;','if(!mutation.changed&&!lifecycle.isValidating()&&!branchInputs.length&&!restoredScalarSelection(node))return;').replace('const prepared=lifecycle.prepareNativeRequirement(authored.known','let prepared=lifecycle.prepareNativeRequirement(authored.known',1)
s=s.replace("const requirement=retained===proposed?prepared.requirement:lifecycle.combineNativeRequirements([retained.requirement as lifecycle.NativeRequirement,prepared.requirement]);\n   const endpoint=retained===proposed?proposed:Object.freeze({...retained,requirement});", """const admitted=retained.requirement===prepared.requirement;
   if(!admitted)prepared=lifecycle.prepareNativeRequirement([],authored.unknown,[...consumed,...branchInputs.flatMap(scope=>scope.native),...currentEntityPublicationInputs().flatMap(input=>(input as {native?:readonly lifecycle.NativeInput[]}).native??[])]);
   const requirement=restoration?restoration.requirement as lifecycle.NativeRequirement:admitted?prepared.requirement:lifecycle.combineNativeRequirements([retained.requirement as lifecycle.NativeRequirement,prepared.requirement]);
   const endpoint=admitted?retained:Object.freeze({...retained,requirement});""")
p.write_text(s)
p=c/'lib/internals/causal-runtime/tree-realization-adapter.ts';s=p.read_text();s="import {withScalarSelections} from '../native-scalar-selection';\n"+s
# carry exact per-effect selected facts through existing frame preparation
helper='''function prepareWithScalarSelections<T>(slots:NonNullable<ReturnType<typeof getTreeScalarSlotRuntime>>,effects:readonly ReversalEffect[],work:()=>T):T {
 const selections=new Map<object,import('../native-field-selection').NativeFieldEndpoint>();
 for(const effect of effects){if(effect.subjectId!==undefined)continue;const endpoint=fieldEndpoints(effect)?.after;const leaf=slots.resolveScalarLeaf(effect.owner);if(endpoint&&leaf)selections.set(leaf,endpoint);}
 return withScalarSelections(selections,work);
}
'''
s=helper+s if False else s
# insert helper after imports is legal top-level before function declaration using anchor
idx=s.index('function prepareSelectedOperation(');s=s[:idx]+helper+s[idx:]
s=s.replace('const installScalars=frame.prepareCommit({advanceRevision:false,publish:false,publicationPhase});','const installScalars=prepareWithScalarSelections(slots,scalarEffects,()=>frame.prepareCommit!({advanceRevision:false,publish:false,publicationPhase}));')
s=s.replace('const install = frame.prepareCommit?.({publish:false,publicationPhase:outerPhase});','const install = prepareWithScalarSelections(scalarSlotRuntime,effects,()=>frame.prepareCommit?.({publish:false,publicationPhase:outerPhase}));')
# other frame path with scalarEffects inspect later
old="if(!endpoint){body();return;}\n    const binding="
new="if(!endpoint){body();return;}\n    if(effect.subjectId===undefined){withScalarSelections(new Map([[target,endpoint]]),body);return;}\n    const binding="
assert old in s;s=s.replace(old,new);p.write_text(s)
