import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { countIteratedElements } from './original-counter.mjs';
globalThis.ngDevMode=false;
const [arm,entry]=process.argv.slice(2);
const {signalTree,entityMap}=await import(pathToFileURL(entry).href);
const rows=[];
for(const size of [2000,20000]){
 const tree=signalTree({rows:entityMap({selectId:r=>r.id})});
 try{
  tree.$.rows.setAll(Array.from({length:size},(_,id)=>({id,v:0})));
  const total=countIteratedElements(()=>{for(let i=0;i<200;i++)tree.$.rows.updateOne(i,{v:1});});
  for(let i=0;i<200;i++)assert.equal(tree.$.rows.byIdOrFail(i)().v,1);
  assert.equal(tree.$.rows.byIdOrFail(201)().v,0);
  const map=new Map(Array.from({length:size},(_,id)=>[id,id]));
  const widthControl=countIteratedElements(()=>Array.from(map.values()));assert.equal(widthControl,2*size);
  rows.push({size,total,originalBound:2000,passesOriginalBound:total<2000,widthControl});
 }finally{tree.destroy();}
}
const map=new Map([[1,1],[2,2]]),list=[1,2,3],push=Array.prototype.push;
assert.equal(countIteratedElements(()=>{Array.from(map.values());list.map(x=>x);}),7);
let caught=false;try{countIteratedElements(()=>{throw undefined;});}catch(e){caught=true;assert.equal(e,undefined);}assert.ok(caught);assert.equal(Array.prototype.push,push);
assert.equal(rows[0].total,rows[1].total);
process.stdout.write(JSON.stringify({arm,entry,node:process.version,pid:process.pid,productionDefine:false,ngDevMode:false,workload:'original200distinctupdates;2-field rows;originalcounterunchanged;all200endpoints+untouchedrowchecked',rows,plantedCharge:7,throwUndefinedPreserved:true})+'\n');
