from pathlib import Path
p=Path(__file__).parent/'candidate/packages'
s=r'''import {it,expect} from 'vitest';import {signalTree,entityMap,transactions} from '../index';
import {getLocationRuntime} from 'INTERNAL/location-runtime';import {getEntityPublicationBinding} from 'INTERNAL/entity-publication';
EXTRA
for(const sorted of [false,true])it(`entity wrapper early identity and subsequent dependencies sorted=${sorted}`,()=>{
 let comparisons=0;const t=signalTree({rows:entityMap<{id:number;n:number},number>({sortComparer:sorted?(a,b)=>{comparisons++;return a.n-b.n;}:undefined}),other:{n:1}},{enhancers:[transactions()]});const lr=getLocationRuntime(t.$)!;let off:(()=>void)|undefined;
 try{t.$.rows.addMany([{id:1,n:2},{id:2,n:1}]);const old=t.$();let runs=0;const held=DERIVED(()=>{runs++;return t.$();});held();let early:ReturnType<typeof t.$>|undefined;let inside:unknown;let calls=0;
 off=getEntityPublicationBinding(t.$.rows)!.source.subscribe({prepare(){return{record:{writes:[],adds:[]},completion:{}};},complete(){calls++;early=t.$();inside=held();expect(t.$()).toBe(early);}});
 lr.runInvalidationGroup(()=>{t.$.rows.addOne({id:3,n:0});});off();off=undefined;
 expect(calls).toBe(1);expect(inside).toBe(old);expect(early).toBeDefined();expect((early as unknown as {rows:{all:{id:number}[]}}).rows.all.map(x=>x.id)).toEqual(sorted?[3,2,1]:[1,2,3]);expect(t.$()).toBe(early);expect(held()).toBe(early);
 const prior=runs;t.$.rows.addOne({id:4,n:4});expect(held().rows.all).toHaveLength(4);expect(runs).toBeGreaterThan(prior);const stable=t.$();const comparisonCount=comparisons;for(let i=0;i<20;i++)expect(t.$()).toBe(stable);expect(comparisons).toBe(comparisonCount);
 }finally{off?.();t.destroy();}
});
'''
for fac in ['kernel','angular']:
 text=s.replace('INTERNAL','./internals' if fac=='kernel' else '../../../kernel/src/lib/internals').replace('EXTRA',"import {computed} from '@angular/core';" if fac=='angular' else '').replace('DERIVED','computed' if fac=='angular' else 'lr.createDerived').replace('let early:ReturnType<typeof t.$>|undefined','let early:unknown')
 (p/f'{fac}/src/lib/parent-freshness-entity.spec.ts').write_text(text)
