from pathlib import Path
import shutil,hashlib,json,difflib
r=Path('/private/tmp/st-c25-equal-owner');c=r/'candidate/packages/kernel/src';a=r/'research/uninstrumented';a.mkdir(parents=True)
rels=['lib/experimental-publication/private.ts','lib/experimental-publication/lifecycle.ts','lib/internals/native-scalar-selection.ts','enhancers/transactions/transactions.ts']
for rel in rels:
 p=a/rel;p.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(c/rel,p)
p=c/'lib/experimental-publication/private.ts';s=p.read_text();s+='''\n// C25 research-only structural roots; removed before runtime freeze.
export function __c25SourceRoots(node:object,snapshots:readonly object[]){return {endpoint:nativeValues.get(node),view:nativeViews.get(node),snapshots:snapshots.map(value=>snapshotViews.get(value)),bindings:[...bindings.values()]};}
export function __c25FactRoot(value:object){return factRequirements.get(value as Fact);}
''';p.write_text(s)
p=c/'lib/experimental-publication/lifecycle.ts';s=p.read_text();s+='''\n// C25 research-only structural roots; removed before runtime freeze.
export function __c25LifecycleRoots(){return {sources,pending,connections,stack,installedLast,unknownFrames,invalidFrames,queuedConnections};}
export function __c25LifecycleWeakRoots(value:object){return [requirementListeners.get(value as NativeRequirement),ownerTransitionObservers.get(value as OwnerCell)];}
''';p.write_text(s)
p=c/'lib/internals/native-scalar-selection.ts';s=p.read_text();s+='''\nconst __c25RegistryRoots=new WeakMap<object,()=>object>();
export function __c25RegisterRoots(registry:object,roots:()=>object):void{__c25RegistryRoots.set(registry,roots);}
export function __c25ReadRoots(registry:object):object|undefined{return __c25RegistryRoots.get(registry)?.();}
''';p.write_text(s)
p=c/'enhancers/transactions/transactions.ts';s=p.read_text().replace('import {registerScalarSelection}', 'import {registerScalarSelection,__c25RegisterRoots}',1);anchor='  const recordConfirmedBucket = (';s=s.replace(anchor,'  if(lifecycleRegistry)__c25RegisterRoots(lifecycleRegistry,()=>({installedOperations,pendingTransactions,expectedDispositions}));\n\n'+anchor,1);p.write_text(s)
patch=''
for rel in rels:patch+=''.join(difflib.unified_diff((a/rel).read_text().splitlines(True),(c/rel).read_text().splitlines(True),fromfile='a/packages/kernel/src/'+rel,tofile='b/packages/kernel/src/'+rel))
(r/'research/instrumentation.patch').write_text(patch);(r/'research/UNINSTRUMENTED.json').write_text(json.dumps({rel:hashlib.sha256((a/rel).read_bytes()).hexdigest() for rel in rels},indent=2)+'\n')
