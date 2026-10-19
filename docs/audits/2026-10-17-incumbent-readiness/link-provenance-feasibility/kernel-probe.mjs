import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = process.env.SIGNALTREE_ROOT ?? '/Users/jonathanborgia/.codex/worktrees/v16-incumbent-readiness/signaltree';
const out = dirname(fileURLToPath(import.meta.url));
const { build } = createRequire(resolve(root,'package.json'))('esbuild');
const inputs={};
const code=`
import { signalTree, transactions, link } from './packages/kernel/src/index';
import { getPathNotifier } from './packages/kernel/src/lib/path-notifier';
import { acquireObservation } from './packages/kernel/src/lib/internals/observation-substrate';
import { getActiveWriteContext } from './packages/kernel/src/lib/write-context';
export async function run(mode) {
 const t=signalTree({x:0,y:0},{enhancers:[transactions()]});
 const events=[],sent=[],off=[]; let captured;
 const normalized=(meta)=>meta?Object.fromEntries(Object.entries(meta).map(([k,v])=>[k,k==='ownerId'?'tree':k==='transactionId'?'pending-owner':v])):null;
 for(const path of ['x','y']) {
  off.push(acquireObservation(t.$[path]));
  off.push(getPathNotifier().subscribe(path,(v,prev,p,_owner,_origin,_subjects,_positions,meta)=>{
    events.push({path:p,value:v,prev,meta:normalized(meta),active:normalized(getActiveWriteContext())});
    if(p==='x')captured=v;
  }));
 }
 const l=link(t.$.y,{set:v=>{sent.push(v);}});
 try {
  const p=t.transact(()=>t.$.x(7));
  // Both scenarios observe x; only one actually uses that value in the write.
  // Application code runs after an asynchronous scheduling boundary in both.
  const job=mode==='copy'?()=>t.$.y(captured):()=>t.$.y(7);
  await Promise.resolve(); job();
  for(let i=0;i<40;i++)await Promise.resolve();
  const pending={events:[...events],sent:[...sent],state:t.$(),active:normalized(getActiveWriteContext())};
  p.confirm();await l.settled();
  return {pending,afterConfirm:{sent:[...sent],state:t.$()}};
 } finally {l.dispose();for(const f of off.reverse())f();t.destroy();}
}
`;
const built=await build({stdin:{contents:code,resolveDir:root,loader:'ts'},bundle:true,write:false,platform:'node',format:'esm',target:'node24',plugins:[{name:'source-receipt',setup(b){b.onLoad({filter:/\/packages\/kernel\/src\/.*\.ts$/},({path})=>{const contents=readFileSync(path,'utf8');inputs[path.slice(root.length+1)]=createHash('sha256').update(contents).digest('hex');return {contents,loader:'ts'};});}}]});
const {run}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const direct=await run('direct'),copy=await run('copy');
writeFileSync(resolve(out,'kernel-probe.json'),JSON.stringify({inputs,direct,copy},null,2)+'\n');
// Owner numeric identity differs by construction, normalized above; all other
// delivery and active metadata remain raw. No runtime behavior is instrumented.
assert.deepEqual(direct,copy);
assert.deepEqual(direct.pending.sent,[]);
assert.equal(direct.pending.state.y,7);
assert.equal(direct.pending.events.find(e=>e.path==='y').meta.transactionId,undefined);
assert.equal(direct.pending.events.find(e=>e.path==='y').active,null);
assert.deepEqual(direct.afterConfirm.sent,[7]);
console.log(JSON.stringify({sameObservedTrace:true,direct,copy},null,2));
