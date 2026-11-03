import {appendFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {entityMap,signalTree} from '../index';
// Diagnostic constructor interception only; never a CPU/heap timing harness.
function countContainers(run:()=>void){
 const Original=globalThis.Map;let containers=0,entries=0,mapArrays=0,mapEntries=0;
 const originalMap=Array.prototype.map;
 Array.prototype.map=function<U>(this:unknown[],callback:(value:unknown,index:number,array:unknown[])=>U,thisArg?:unknown):U[]{const result:U[]=Reflect.apply(originalMap,this,[callback,thisArg]);mapArrays++;mapEntries+=result.length;return result;};
 const Counted=new Proxy(Original,{construct(target,args,newTarget){containers++;const input=args[0] as Iterable<unknown>|undefined;
  const wrapped=input==null?input:{*[Symbol.iterator](){for(const pair of input){entries++;yield pair;}}};
  return Reflect.construct(target,[wrapped],newTarget);
 }});
 globalThis.Map=Counted;
 try{run();return {containers,entries,mapArrays,mapEntries};}finally{globalThis.Map=Original;Array.prototype.map=originalMap;}
}
it('constructor counter independently calibrates empty and copied containers',()=>{
 const source=new Map([[1,2],[3,4]]);let copied=0,empty=-1;expect(countContainers(()=>{copied=new Map(source).size;empty=new Map().size;[1,2,3].map(x=>x+1);})).toEqual({containers:2,entries:2,mapArrays:1,mapEntries:3});expect([copied,empty]).toEqual([2,0]);
});
for(const width of [2,32])for(const size of [2000,20000])it(`populated point Map allocations width=${width} rows=${size}`,()=>{
 const t=signalTree({rows:entityMap<{id:number;v:number;[key:string]:number},number>({selectId:r=>r.id})});
 try{t.$.rows.setAll(Array.from({length:size},(_,id)=>{const r:{id:number;v:number;[key:string]:number}={id,v:0};for(let k=2;k<width;k++)r['f'+k]=k;return r;}));
 const measured=countContainers(()=>{for(let i=0;i<200;i++)t.$.rows.updateOne(i,{v:1});});
 for(let i=0;i<200;i++)expect(t.$.rows.byId(i)?.().v).toBe(1);expect(t.$.rows.byId(201)?.().v).toBe(0);expect(measured.containers).toBeGreaterThan(0);expect(measured.entries).toBeGreaterThan(0);
 const output=process.env.ST_POINT_ALLOCATION_OUTPUT;
 if(output)appendFileSync(output,JSON.stringify({width,size,writes:200,...measured})+'\n');
 }finally{t.destroy();}
});
