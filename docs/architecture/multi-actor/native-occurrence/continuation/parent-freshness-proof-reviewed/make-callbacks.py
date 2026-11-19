from pathlib import Path
import shutil,json,hashlib,os
p=Path(__file__).parent
# Own unmodified C8 oracle: manifest-only source, shared ONLY own dependency copy.
o=p/'oracle';o.mkdir();m=json.loads((p/'BASE-SOURCE.json').read_text());base=Path('/private/tmp/st-native-combined-c8/candidate')
for n,h in m.items():
 b=(base/n).read_bytes();assert hashlib.sha256(b).hexdigest()==h;d=o/n;d.parent.mkdir(parents=True,exist_ok=True);d.write_bytes(b)
(o/'node_modules').symlink_to(p/'candidate/node_modules',target_is_directory=True)
common=r'''import {expect,it} from 'vitest';import {writeFileSync} from 'node:fs';import {join} from 'node:path';
import {signalTree,entityMap,transactions} from '../index';
import {getEntityPublicationBinding} from 'INTERNAL/entity-publication';
import {getLocationRuntime} from 'INTERNAL/location-runtime';
EXTRA
for(const fail of [false,true])it(`sorted collection completion and later dependency; fail=${fail}`,()=>{
 let comparisons=0;let armedError=false;const sentinel=Error('sorted original');
 const t=signalTree({rows:entityMap<{id:number;n:number},number>({sortComparer:(a,b)=>{comparisons++;if(armedError)throw sentinel;return a.n-b.n;}}),other:{n:7}},{enhancers:[transactions()]});const lr=getLocationRuntime(t.$)!;
 const events:unknown[]=[];const take=(name:string,fn:()=>unknown)=>{const start=comparisons;try{const value=fn();const r={name,kind:'return',value:value===undefined?null:JSON.parse(JSON.stringify(value)),start,end:comparisons};events.push(r);return r;}catch(e){const r={name,kind:'throw',sameSentinel:e===sentinel,message:e instanceof Error?e.message:String(e),start,end:comparisons};events.push(r);return r;}};
 let calls=0;let off:(()=>void)|undefined;
 try{t.$.rows.addMany([{id:1,n:2},{id:2,n:1}]);const heldAll=t.$.rows.all;let derivedRuns=0;const derived=DERIVED(()=>{derivedRuns++;return t.$();});take('warm-root',()=>derived());
 off=getEntityPublicationBinding(t.$.rows)!.source.subscribe({prepare(){return{record:{writes:[],adds:[]},completion:{}};},complete(){calls++;armedError=fail;take('completion-held-all',()=>heldAll());take('completion-root',()=>t.$());take('completion-derived',()=>derived());armedError=false;}});
 take('add',()=>t.$.rows.addOne({id:3,n:0}));off();off=undefined;
 take('post-root',()=>t.$());take('post-derived',()=>derived());take('repeat-root',()=>t.$());take('repeat-all',()=>heldAll());
 take('next-collection-write',()=>t.$.rows.addOne({id:4,n:4}));take('next-derived',()=>derived());
 writeFileSync(join(process.env.ST_PREPARED_REVIEW_OUTPUT!,`sorted-${fail}.json`),JSON.stringify({calls,comparisons,derivedRuns,events},null,2));expect(calls).toBe(1);expect(comparisons).toBeGreaterThan(0);
 if(fail){const e=events.find(e=>(e as {name:string}).name==='completion-held-all') as {sameSentinel?:boolean};expect(e.sameSentinel).toBe(true);}
 }finally{off?.();t.destroy();}
});
'''
for facade in ['kernel','angular']:
 internal='./internals' if facade=='kernel' else '../../../kernel/src/lib/internals';s=common.replace('INTERNAL',internal).replace('EXTRA',"import {computed} from '@angular/core';" if facade=='angular' else '').replace('DERIVED','computed' if facade=='angular' else 'lr.createDerived')
 for dst in [p/'candidate',o]:
  (dst/f'packages/{facade}/src/lib/parent-freshness-callbacks.spec.ts').write_text(s)
  # Same finite characterization fixtures as C7a, executed only selected cases.
  for kind in ['baseline','targeted']:
   src=p.parent/f'baseline-reentry/candidate/packages/{facade}/src/lib/bounded-reentry-{kind}.spec.ts';shutil.copyfile(src,dst/f'packages/{facade}/src/lib/bounded-reentry-{kind}.spec.ts')
# Runner variant for pristine oracle; all evidence still within successor directory.
s=(p/'run.py').read_text().replace("c=p/'candidate'","c=p/'oracle'").replace("str(p/'nx-cache')","str(p/'oracle-nx-cache')").replace("str(p/'nx-data')","str(p/'oracle-nx-data')")
(p/'run-oracle.py').write_text(s)
