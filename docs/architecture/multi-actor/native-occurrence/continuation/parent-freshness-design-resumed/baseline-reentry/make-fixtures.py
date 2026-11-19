from pathlib import Path
p=Path(__file__).parent
common=r'''import {expect,it} from 'vitest';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {signalTree,entityMap} from '../index';
import {registerMarkerProcessor} from 'MARKER_IMPORT';
const KIND=Symbol('bounded-baseline-reentry');
type Marker={ [KIND]:true; read:()=>unknown };
registerMarkerProcessor((x:unknown):x is Marker=>typeof x==='object'&&x!==null&&KIND in x,m=>({read:m.read}),{snapshot:n=>n.read()});
type Case='E1'|'E3'|'E4'|'E5-child'|'E5-self';
for(const seam of ['marker','sort'] as const)for(const scenario of ['E1','E3','E4','E5-child','E5-self'] as const)it(`${seam} ${scenario}: finite C7a characterization`,()=>{
 const sentinel=Error('original callback sentinel');const tripwire=Error('callback tripwire');
 const events:unknown[]=[];let calls=0;let action:(()=>void)|undefined;let sentinelReached=false;let nested:unknown;let afterWrite=false;
 const capture=(name:string,run:()=>unknown)=>{
  const start=calls;
  try {const value=run();const copied=value===undefined?null:JSON.parse(JSON.stringify(value));const r={name,kind:'return',value:copied,callsBefore:start,callsAfter:calls};events.push(r);return r;}
  catch(error){const r={name,kind:'throw',sameSentinel:error===sentinel,sameTripwire:error===tripwire,error:error instanceof Error?{name:error.name,message:error.message,stack:error.stack}:String(error),callsBefore:start,callsAfter:calls};events.push(r);return r;}
 };
 const callback=()=>{calls++;if(calls>40)throw tripwire;const run=action;action=undefined;if(run)run();};
 const t=seam==='marker'
  ?signalTree({child:{n:0},probe:{[KIND]:true,read:()=>{callback();return 'marker-output';}} as Marker})
  :signalTree({child:{n:0},rows:entityMap<{id:number;n:number},number>({sortComparer:(a,b)=>{callback();return a.n-b.n;}})});
 const setChild=(n:number)=>{WRITE_CHILD};
 const rows=seam==='sort'?(t.$ as unknown as {rows:{addMany(v:{id:number;n:number}[]):void;addOne(v:{id:number;n:number}):void;all():{id:number;n:number}[]}}).rows:undefined;
 try{
  if(rows)rows.addMany([{id:1,n:2},{id:2,n:1}]);
  const callsBeforeDemand=calls;
  action=()=>{
   events.push({name:'action-enter',calls});
   if(scenario!=='E1'){
    setChild(1);
    if(rows)rows.addOne({id:3,n:0});
    afterWrite=true;events.push({name:'write-returned',calls,child:t.$.child.n()});
   }
   if(scenario==='E5-child')nested=capture('nested-child',()=>t.$.child());
   if(scenario==='E5-self')nested=capture('nested-root',()=>t.$());
   if(scenario==='E1'||scenario==='E3'){sentinelReached=true;throw sentinel;}
  };
  const first=capture('first-root',()=>t.$());
  action=undefined;
  capture('immediate-root-1',()=>t.$());
  capture('immediate-root-2',()=>t.$());
  capture('installed-child',()=>t.$.child.n());
  capture('recovery-write',()=>{setChild(9);if(rows)rows.addOne({id:4,n:4});});
  capture('post-write-root-1',()=>t.$());
  capture('post-write-root-2',()=>t.$());
  if(rows)capture('post-write-all',()=>rows.all());
  const report={facade:'FACADE',seam,scenario,callsBeforeDemand,calls,afterWrite,sentinelReached,nested,events};
  writeFileSync(join(process.env.ST_PREPARED_REVIEW_OUTPUT!,`${seam}-${scenario}.json`),JSON.stringify(report,null,2));
  expect(calls).toBeGreaterThan(callsBeforeDemand);
  expect(events.some(e=>(e as {name?:string}).name==='action-enter')).toBe(true);
  expect(calls).toBeLessThanOrEqual(40);
  if(sentinelReached){expect(first.kind).toBe('throw');expect('sameSentinel'in first&&first.sameSentinel).toBe(true);}
 }finally{t.destroy();}
});
'''
for facade in ['kernel','angular']:
 text=common.replace('MARKER_IMPORT','./internals/materialize-markers' if facade=='kernel' else '../../../kernel/src/lib/internals/materialize-markers').replace('WRITE_CHILD','t.$.child.n(n);' if facade=='kernel' else 't.$.child.n.set(n);').replace('FACADE',facade)
 dest=p/'candidate'/f'packages/{facade}/src/lib/bounded-reentry-baseline.spec.ts';dest.write_text(text)
(p/'COMPOSITION-CONSTRAINT.md').write_text('User steering: later C8 includes R4 entity installedReadRevision/createVersionedProjection source-current mechanism. C7a characterization does not describe C8. Do not duplicate collection reader/epoch work. Main selects the later proof baseline; no C8 source imported here. Reported manifest prefix 3ad1… is not a verified full identity in this investigation.\n')
