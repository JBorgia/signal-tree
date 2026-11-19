from pathlib import Path
import json,hashlib,shutil
p=Path(__file__).parent;s=p.parent/'c11-test-reconciliation/original';m=json.loads((p.parent/'c11-test-reconciliation/SNAPSHOT-C11-INPUT.json').read_text());h=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
for n,v in m.items():
 assert h(s/n)==v,n
 dest=p/'candidate'/n;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(s/n,dest)
(p/'candidate/node_modules').symlink_to('/private/tmp/st-parent-freshness-implementation-independent/candidate/node_modules',target_is_directory=True)
shutil.copy2(p.parent/'c11-test-reconciliation/run.py',p/'run.py');shutil.copy2(p.parent/'c11-test-reconciliation/SNAPSHOT-C11-INPUT.json',p/'INPUT.json');shutil.copy2('/private/tmp/st-c11-test-reconciliation-main-review/REVIEW.md',p/'MAIN-REVIEW.md')
f=p/'candidate/packages/kernel/src/lib/occupancy-successor-realization.spec.ts';s=f.read_text();s=s[s.index("it('sparse revival"):];s="import {it,expect} from 'vitest';\nimport {signalTree,entityMap,transactions} from '../index';\nimport {withWriteContext} from './write-context';\nconst drain=async()=>{for(let i=0;i<50;i++)await Promise.resolve();};\n"+s
start=s.index("  const {getOwnedPositionIds");end=s.index('  withWriteContext',start);s=s[:start]+s[end:]
start=s.index('  const adds:string[]');s=s[:start]+'''  const replacement=tree.transact(()=>{
   rows.addOne({id:'a',n:42});rows.addOne({id:'b',n:43});
  });
  const freshA=rows.byIdOrFail('a'),freshB=rows.byIdOrFail('b');
  expect(freshA).not.toBe(a);expect(freshB).not.toBe(b);
  withWriteContext({participation:'inspection'},()=>{rows.removeOne('a');rows.removeOne('b');});
  expect(rows.ids()).toEqual(['c','bb']);expect(rows.byIdOrFail('bb')).toBe(b);expect(b.n()).toBe(88);expect(a()).toBeUndefined();
'''+s[start:]
start=s.index('  const port=');end=s.index("  expect(rows.ids()).toEqual(['a','b','c'])",start);s=s[:start]+"  expect(()=>replacement.rollback()).not.toThrow();\n"+s[end:]
(p/'candidate/packages/kernel/src/lib/independent-occupancy-valid-inverse.spec.ts').write_text(s)
print('prepared')
