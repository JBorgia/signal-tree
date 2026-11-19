from pathlib import Path
c=Path('/private/tmp/st-c24-equal-owner/candidate/packages/kernel/src')
p=c/'lib/internals/native-scalar-selection.ts'
p.write_text('''import type { NativeFieldEndpoint } from './native-field-selection';
import type { IntrinsicMutation, TerminalRecordPlan } from './intrinsic-mutation';
export type ScalarSelection = { endpoint:NativeFieldEndpoint; record?:TerminalRecordPlan };
type Selector=(node:object,mutation:IntrinsicMutation<unknown>,before:NativeFieldEndpoint,proposed:NativeFieldEndpoint)=>ScalarSelection|undefined;
const selectors=new WeakMap<object,Selector>();
export function registerScalarSelection(registry:object,select:Selector):()=>void { selectors.set(registry,select);return ()=>{if(selectors.get(registry)===select)selectors.delete(registry);}; }
export function prepareScalarSelection(registry:object|undefined,node:object,mutation:IntrinsicMutation<unknown>,before:NativeFieldEndpoint,proposed:NativeFieldEndpoint):ScalarSelection|undefined{return registry?selectors.get(registry)?.(node,mutation,before,proposed):undefined;}
// Scoped selected compensation facts, not an ownership ledger.
let restored:ReadonlyMap<object,NativeFieldEndpoint>|undefined;
export function withScalarSelections<T>(selections:ReadonlyMap<object,NativeFieldEndpoint>,work:()=>T):T{const previous=restored;restored=selections;try{return work();}finally{restored=previous;}}
export function restoredScalarSelection(node:object):NativeFieldEndpoint|undefined{return restored?.get(node);}
''')
p=c/'lib/internals/intrinsic-mutation.ts';s=p.read_text();s=s.replace("const validate=()=>{if(source.publicationPreparer!==publicationPreparer)","const validate=()=>{nativeUnit?.validate?.();if(source.publicationPreparer!==publicationPreparer)");s += '''\n/** Shared frame path uses the same prepared scalar recorder as direct leaves. */
export function prepareScalarSourceTerminal(node:object,mutation:IntrinsicMutation<unknown>):TerminalRecordPlan|undefined{return SOURCES.get(node)?.terminalPreparer?.(mutation);}
''';print('source record fields', 'terminalPreparer' in s);p.write_text(s)
p=c/'lib/internals/tree-scalar-slot-runtime.ts';s=p.read_text().replace('prepareScalarSourcePublication, completeScalarSourcePublication, installTerminalRecord','prepareScalarSourcePublication, prepareScalarSourceTerminal, combineTerminalRecords, completeScalarSourcePublication, installTerminalRecord');old="const unit = prepareScalarSourcePublication(source, {intent:'replace', before, after:equal ? before : nextValue, changed:!equal, publicationPredecessors, deferPublicationFinalization:true});";new="""const mutation = {intent:'replace' as const, before, after:equal ? before : nextValue, changed:!equal, publicationPredecessors, deferPublicationFinalization:true};
        const terminal = !equal ? prepareScalarSourceTerminal(source,mutation) : undefined;
        const publication = prepareScalarSourcePublication(source,mutation);
        const unit = publication ? {...publication,record:combineTerminalRecords(terminal,publication.record)!} : terminal ? {record:terminal,completion:{}} : undefined;""";assert old in s;s=s.replace(old,new);p.write_text(s)
p=c/'lib/experimental-publication/private.ts';s=p.read_text();s="import {prepareScalarSelection,restoredScalarSelection} from '../internals/native-scalar-selection';\nimport type {NativeFieldEndpoint} from '../internals/native-field-selection';\n"+s;s=s.replace('const nativeValues=new WeakMap<object,lifecycle.NativeRequirement>();','const nativeValues=new WeakMap<object,NativeFieldEndpoint>();');s=s.replace('nativeValues.set(node,initial);','nativeValues.set(node,{present:true,value:undefined,requirement:initial});');start=s.index('   const authored=nativeAuthorship(node);',s.index('registerNativePublicationFactory'));end=s.index('\n  },\n  complete:',start)
s=s[:start]+'''   const predecessor=nativeValues.get(node)!;
   const existingView=nativeViews.get(node), physicalRequirement=existingView?.requirement;
   const authored=mutation.changed?nativeAuthorship(node):{known:[],unknown:false};
   const consumed=mutation.intent==='derive'?(input as {native?:readonly lifecycle.NativeInput[]}|undefined)?.native??[]:[];
   const prepared=lifecycle.prepareNativeRequirement(authored.known,authored.unknown,[...consumed,...branchInputs.flatMap(scope=>scope.native),...currentEntityPublicationInputs().flatMap(input=>(input as {native?:readonly lifecycle.NativeInput[]}).native??[])]);
   const proposed:NativeFieldEndpoint=Object.freeze({present:true,value:mutation.after,requirement:prepared.requirement});
   const restoration=restoredScalarSelection(node);
   const selection=restoration?{endpoint:restoration}:prepareScalarSelection(getPositionRegistry(node),node,mutation,predecessor,proposed);
   const retained=selection?.endpoint??(!mutation.changed&&predecessor.owner!==undefined?predecessor:proposed);
   // Selection is not consumption. Keep every role of the selected predecessor.
   const requirement=retained===proposed?prepared.requirement:lifecycle.combineNativeRequirements([retained.requirement as lifecycle.NativeRequirement,prepared.requirement]);
   const endpoint=retained===proposed?proposed:Object.freeze({...retained,requirement});
   const view=mutation.changed||!existingView?{requirement}:existingView;
   return {record:combineTerminalRecords(prepared.record,selection?.record,{writes:[{map:nativeValues,key:node,value:endpoint},{map:nativeViews,key:node,value:view},...(!mutation.changed&&existingView?[{map:{set:(_key:unknown,value:unknown)=>{existingView.requirement=value as lifecycle.NativeRequirement;}},key:node,value:requirement}]:[])],adds:[]})!,completion:{requirement:prepared.requirement},finalize:()=>lifecycle.finalizeNativeRequirement(prepared.requirement),validate:()=>{if(nativeValues.get(node)!==predecessor||nativeViews.get(node)!==existingView||existingView?.requirement!==physicalRequirement)throw new Error('Scalar publication selection changed before installation');}};''' + s[end:]
s=s.replace('nativeValues.get(candidate)??lifecycle.initialRequirement()','(nativeValues.get(candidate)?.requirement as lifecycle.NativeRequirement|undefined)??lifecycle.initialRequirement()').replace('nativeValues.get(source)??lifecycle.initialRequirement()','(nativeValues.get(source)?.requirement as lifecycle.NativeRequirement|undefined)??lifecycle.initialRequirement()');p.write_text(s)
# Admission enriches existing records; does not create another compensation record.
p=c/'enhancers/transactions/transactions.ts';s=p.read_text();s="import {registerScalarSelection} from '../../lib/internals/native-scalar-selection';\n"+s
anchor='  const recordConfirmedBucket = ('
idx=s.index(anchor)
code='''  const releaseScalarSelection=lifecycleRegistry?registerScalarSelection(lifecycleRegistry,(node,mutation,before,proposed)=>{
    const meta=getActiveWriteContext(),position=getOwnedPositionIds(node)?.[0];
    if(!mutation.changed)return {endpoint:before.owner!==undefined?before:proposed};
    if(isRestoring||meta?.origin==='restoration'||isInspectionWrite(meta)||getWriteParticipation(meta)==='realized'||meta?.transactionOwner!==transactionOwnerToken)return;
    const id=resolveTransactionId(meta);
    if(id===undefined||position===undefined)return;
    const slots=getTreeScalarSlotRuntime(tree)??getTreeScalarSlotRuntime(tree.$);
    if(slots?.resolveScalarSlot(position)===undefined)return;
    const bucket=getTransactionBucket(id);
    const path=lifecycleRegistry.addressFor(position)?.join('.')??'';
    const key=effectKey({kind:'set',position,path,ownerPath:path,before:mutation.before,after:mutation.after});
    const old=bucket.effects.get(key);
    const prior=old&&fieldEndpoints(old)?.before;
    const first=prior??Object.freeze({...before,value:mutation.before});
    const after=Object.freeze({...proposed,owner:id});
    const pair={before:first,after};
    const endpoint=Object.is(old?.kind==='set'?old.before:mutation.before,mutation.after)?first:after;
    return {endpoint,record:{writes:[{map:{set(){
      const effect=bucket.effects.get(key);
      if(!effect)throw new Error('Scalar selection has no installed admission');
      bindFieldEndpoints(effect,pair);
      const operation=installedOperations.get(id);
      for(const own of operation?.effects??[])if(own.position===position)bindFieldEndpoints(own,{before,after});
    }},key:undefined,value:undefined}],adds:[]}};
  }):undefined;

'''
s=s[:idx]+code+s[idx:];s=s.replace('      research.unregister(lifecycleRegistry?.id);','      releaseScalarSelection?.();\n      research.unregister(lifecycleRegistry?.id);');s=s.replace("      subjectIds?.length &&\n      installedOperations.get(recorded)?.owners.has(resolvedPositionIds[0])","      installedOperations.get(recorded)?.owners.has(resolvedPositionIds[0])");p.write_text(s)
