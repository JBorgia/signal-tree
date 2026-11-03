import assert from 'node:assert/strict';
import {signalTree, transactions, link} from './packages/kernel/src/index';
// Application research glue. Explicit labels are assertions by its caller.
class Outbox {
  entries=new Map<string,{payload:unknown; owners:Array<{state:string}>}>();
  closed=false;
  constructor(readonly endpoint:(v:unknown)=>Promise<void>){ }
  enqueue(key:string,payload:unknown,owners:Array<{state:string}>){
    if(this.closed)throw new Error('disposed');
    this.entries.set(key,{payload:structuredClone(payload),owners:[...owners]});
  }
  async drain(){
    for(const [key,e] of [...this.entries]){
      if(this.closed)return;
      if(this.entries.get(key)!==e)continue;
      if(e.owners.some(o=>o.state==='rejected')){this.entries.delete(key);continue;}
      if(e.owners.some(o=>o.state!=='confirmed'))continue;
      await this.endpoint(e.payload); // failure retains exact entry for explicit retry
      if(this.entries.get(key)===e)this.entries.delete(key);
    }
  }
  destroy(){this.closed=true;this.entries.clear();}
}
const owner=(handle:any)=>({state:'pending',confirm(){handle.confirm();this.state='confirmed';},reject(){handle.rollback();this.state='rejected';}});
export async function run(){
 const results=[];
 async function check(name:string,fn:()=>Promise<void>){await fn();results.push({name,result:'pass'});}
 await check('O1 explicit independent progress, held multi-hop and rejection',async()=>{
  const t=signalTree({x:0,y:0,z:0},{enhancers:[transactions()]});const sent:unknown[]=[];const o=new Outbox(async v=>{sent.push(v);});
  try{const p=owner(t.transact(()=>t.$.x(7)));t.$.y(t.$.x());t.$.z(t.$.y());
   o.enqueue('derived',{z:t.$.z()},[p]);o.enqueue('independent',{status:'ready'},[]);
   await o.drain();assert.deepEqual(sent,[{status:'ready'}]);assert.equal(o.entries.size,1);
   p.reject();await o.drain();assert.equal(o.entries.size,0);assert.deepEqual(sent,[{status:'ready'}]);
  }finally{o.destroy();t.destroy();}
 });
 await check('O2 two owner inputs and complete payload confirmation',async()=>{
  const t=signalTree({x:0,y:0},{enhancers:[transactions()]});const sent:unknown[]=[];const o=new Outbox(async v=>{sent.push(v);});
  try{const p=owner(t.transact(()=>t.$.x(2)));const q=owner(t.transact(()=>t.$.y(3)));
   o.enqueue('pair',{x:t.$.x(),y:t.$.y()},[p,q]);p.confirm();await o.drain();assert.deepEqual(sent,[]);assert.equal(o.entries.size,1);
   q.confirm();await o.drain();assert.deepEqual(sent,[{x:2,y:3}]);assert.equal(o.entries.size,0);
  }finally{o.destroy();t.destroy();}
 });
 await check('O3 overwrite, deferred owner and explicitly unknown input',async()=>{
  const t=signalTree({x:0},{enhancers:[transactions()]});const sent:unknown[]=[];const o=new Outbox(async v=>{sent.push(v);});
  try{const p=owner(t.transact(()=>t.$.x(7)));o.enqueue('value',7,[p]);o.enqueue('value',42,[]);
   o.enqueue('unknown',7,[{state:'unknown'}]);const captured=t.$.x();await Promise.resolve();o.enqueue('later',captured,[p]);
   await o.drain();assert.deepEqual(sent,[42]);assert.equal(p.state,'pending');assert.equal(o.entries.size,2);
   p.reject();await o.drain();assert.deepEqual(sent,[42]);assert.equal(o.entries.size,1);assert.ok(o.entries.has('unknown'));
  }finally{o.destroy();t.destroy();}
 });
 await check('O4 explicit retry and destruction disposition',async()=>{
  let fail=true;const sent:unknown[]=[];const error=new Error('endpoint');const o=new Outbox(async v=>{if(fail)throw error;sent.push(v);});
  o.enqueue('a',{complete:true},[]);await assert.rejects(o.drain(),e=>e===error);assert.equal(o.entries.size,1);
  fail=false;await o.drain();assert.deepEqual(sent,[{complete:true}]);assert.equal(o.entries.size,0);
  o.enqueue('held',7,[{state:'pending'}]);o.destroy();await o.drain();assert.equal(o.entries.size,0);assert.throws(()=>o.enqueue('new',1,[]),/disposed/);
 });
 await check('D1 isolated review allows ordinary live Link progress',async()=>{
  const t=signalTree({x:0,y:0,status:'idle'});const sent:unknown[]=[];const l=link(t.$,{set:v=>{sent.push(structuredClone(v));}});
  try{let draft={x:7,y:0};draft.y=draft.x;const derived=draft.y+1;assert.equal(derived,8);
   t.$.status('ready');await l.settled();assert.deepEqual(sent,[{x:0,y:0,status:'ready'}]);
   draft={x:0,y:0};assert.equal(draft.x,0);assert.deepEqual(t.$(),{x:0,y:0,status:'ready'});
  }finally{l.dispose();t.destroy();}
 });
 await check('D2 one approved batch gives coherent root payload',async()=>{
  const t=signalTree({x:0,y:0},{enhancers:[transactions()]});const sent:unknown[]=[];const l=link(t.$,{set:v=>{sent.push(structuredClone(v));}});
  try{const draft={x:2,y:3};const p=t.transact(()=>{t.$.x(draft.x);t.$.y(draft.y);});
   assert.deepEqual(sent,[]);p.confirm();await l.settled();assert.deepEqual(sent,[{x:2,y:3}]);
  }finally{l.dispose();t.destroy();}
 });
 await check('D3 generation guard, and deliberate isolation violation witness',async()=>{
  const t=signalTree({x:0});const sent:unknown[]=[];const l=link(t.$.x,{set:v=>{sent.push(v);}});
  try{let generation=0;const draft={x:7};const revision=generation;const deferred=()=>{if(revision===generation)t.$.x(draft.x);};
   generation++;await Promise.resolve();deferred();await l.settled();assert.deepEqual(sent,[]);assert.equal(t.$.x(),0);
   // Negative control: ordinary Link cannot know the app violated isolation.
   t.$.x(draft.x);await l.settled();assert.deepEqual(sent,[7]);
  }finally{l.dispose();t.destroy();}
 });
 await check('O5 negative control: omitted owner permits speculative payload',async()=>{
  const t=signalTree({x:0},{enhancers:[transactions()]});const sent:unknown[]=[];const o=new Outbox(async v=>{sent.push(v);});
  try{const p=owner(t.transact(()=>t.$.x(7)));o.enqueue('misclassified',t.$.x(),[]);
   await o.drain();assert.deepEqual(sent,[7]);assert.equal(p.state,'pending');p.reject();
  }finally{o.destroy();t.destroy();}
 });
 return results;
}
