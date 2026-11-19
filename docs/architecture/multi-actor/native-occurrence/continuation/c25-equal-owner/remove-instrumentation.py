from pathlib import Path
import shutil,hashlib,json,difflib
r=Path('/private/tmp/st-c25-equal-owner');c=r/'candidate/packages/kernel/src';a=r/'research/instrumented-final';a.mkdir()
rels=['lib/experimental-publication/private.ts','lib/experimental-publication/lifecycle.ts','lib/internals/native-scalar-selection.ts','enhancers/transactions/transactions.ts']
for rel in rels:
 p=c/rel;q=a/rel;q.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,q);s=p.read_text()
 if rel.endswith('private.ts') or rel.endswith('lifecycle.ts'):s=s.split('\n// C25 research-only structural roots; removed before runtime freeze.')[0]+'\n'
 elif rel.endswith('native-scalar-selection.ts'):s=s.split('\nconst __c25RegistryRoots=')[0]+'\n'
 else:s=s.replace('registerScalarSelection,__c25RegisterRoots','registerScalarSelection').replace('  if(lifecycleRegistry)__c25RegisterRoots(lifecycleRegistry,()=>({installedOperations,pendingTransactions,expectedDispositions}));\n\n','')
 assert '__c25' not in s,rel;p.write_text(s)
patch=''
for rel in rels:patch+=''.join(difflib.unified_diff((c/rel).read_text().splitlines(True),(a/rel).read_text().splitlines(True),fromfile='a/packages/kernel/src/'+rel,tofile='b/packages/kernel/src/'+rel))
(r/'research/instrumentation-final.patch').write_text(patch)
p=c/'lib/equal-owner-all-roots.spec.ts';shutil.copy2(p,r/'research/equal-owner-all-roots-final.spec.ts');p.unlink()
(r/'research/RESTORED-SOURCE.json').write_text(json.dumps({rel:hashlib.sha256((c/rel).read_bytes()).hexdigest() for rel in rels},indent=2)+'\n')
# Native counterpart of the exact independent saved-view packet: imports and write syntax only.
s=(c/'lib/saved-inspection-snapshot-isolation.spec.ts').read_text().replace("import { withWriteContext } from './write-context';","import { realizeAs as withWriteContext } from '../../../kernel/src/transaction-realization-contract';")
for old,new in [('source.$.pair.x(7)','source.$.pair.x.set(7)'),('source.$.pair.x(99)','source.$.pair.x.set(99)'),('foreign.$.x(1)','foreign.$.x.set(1)'),('oldTarget.$.value(current.input.x)','oldTarget.$.value.set(current.input.x)'),('freshTarget.$.value(current.input.x)','freshTarget.$.value.set(current.input.x)')]:s=s.replace(old,new)
(r/'candidate/packages/solid/src/lib/saved-inspection-snapshot-isolation.spec.ts').write_text(s)
