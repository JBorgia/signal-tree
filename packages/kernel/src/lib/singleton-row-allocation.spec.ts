import {appendFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {entityMap,signalTree} from '../index';
// Diagnostic constructor interception only; never a CPU/heap timing harness.
function countMaps(run:()=>void){
 const Original=globalThis.Map;let containers=0,entries=0;
 const Counted=new Proxy(Original,{construct(target,args,newTarget){containers++;const input=args[0] as Iterable<unknown>|undefined;
  const wrapped=input==null?input:{*[Symbol.iterator](){for(const pair of input){entries++;yield pair;}}};
  return Reflect.construct(target,[wrapped],newTarget);
 }});
 globalThis.Map=Counted;
 try{
  run();
  const measured={containers,entries};
  // Probe interception after the workload while the same patches remain active.
  // Seed via Original; synthetic probe counts are separate and never reported.
  const seed=new Original([[1,2],[3,4]]);
  const empty=new Map(),copied=new Map(seed);
  if(containers-measured.containers!==2||entries-measured.entries!==2
   ||empty.size!==0||copied.size!==2||copied.get(1)!==2||copied.get(3)!==4)
   throw new Error('Allocation interception failed its in-window positive probe');
  return measured;
 }finally{globalThis.Map=Original;}
}
it('constructor counter independently calibrates empty and copied containers',()=>{
 const source=new Map([[1,2],[3,4]]);let copied=0,empty=-1;expect(countMaps(()=>{copied=new Map(source).size;empty=new Map().size;})).toEqual({containers:2,entries:2});expect([copied,empty]).toEqual([2,0]);
});
it('detects workload removal of Map interception and restores the original global',()=>{
 const Original=globalThis.Map;
 expect(()=>countMaps(()=>{globalThis.Map=Original;})).toThrow('Allocation interception failed its in-window positive probe');
 expect(globalThis.Map).toBe(Original);
});
for(const width of [2,32])for(const size of [2000,20000])it(`populated point Map allocations width=${width} rows=${size}`,()=>{
 const t=signalTree({rows:entityMap<{id:number;v:number;[key:string]:number},number>({selectId:r=>r.id})});
 try{t.$.rows.setAll(Array.from({length:size},(_,id)=>{const r:{id:number;v:number;[key:string]:number}={id,v:0};for(let k=2;k<width;k++)r['f'+k]=k;return r;}));
 const measured=countMaps(()=>{for(let i=0;i<200;i++)t.$.rows.updateOne(i,{v:1});});
 for(let i=0;i<200;i++)expect(t.$.rows.byId(i)?.().v).toBe(1);expect(t.$.rows.byId(201)?.().v).toBe(0);for(const count of Object.values(measured)){expect(Number.isSafeInteger(count)).toBe(true);expect(count).toBeGreaterThanOrEqual(0);}
 const output=process.env.ST_SINGLETON_ALLOCATION_OUTPUT;
 if(output)appendFileSync(output,JSON.stringify({width,size,writes:200,...measured})+'\n');
 }finally{t.destroy();}
});
