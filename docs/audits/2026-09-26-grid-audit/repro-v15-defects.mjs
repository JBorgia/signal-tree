#!/usr/bin/env node
// Reproduce two auditor-reported defects, at HEAD and at the v15.3.0 tag.
// Deterministic (no timing). Usage: node repro-v15-defects.mjs [REV]
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
const here=dirname(fileURLToPath(import.meta.url)); const root=resolve(here,'../../..');
const REV=process.argv[2]; const out=mkdtempSync(resolve(tmpdir(),'st-rd-'));
const b=await build({stdin:{contents:`export {signalTree} from './packages/kernel/src/index';
export {transactions} from './packages/kernel/src/enhancers/transactions/transactions';
export {link} from './packages/kernel/src/lib/link';
export {getPathNotifier} from './packages/kernel/src/lib/path-notifier';`,
  resolveDir:root,sourcefile:'rd.ts',loader:'ts'},absWorkingDir:root,bundle:true,write:false,
  platform:'node',format:'esm',target:'node24',
  plugins: REV?[{name:'rev',setup(bb){ bb.onLoad({filter:/\/packages\/kernel\/src\/.*\.ts$/},({path})=>({
    contents:execFileSync('git',['show',`${REV}:${relative(root,path)}`],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024}),
    loader:'ts',resolveDir:dirname(path)})); }}]:[]});
const p=resolve(out,'rd.mjs'); writeFileSync(p,b.outputFiles[0].text); const K=await import(p);
// v15.3.0 exposes transaction(); transact() is the later rename.
const tx=(t,fn)=>(t.transact??t.transaction).call(t,fn);
const flush=async n=>{n.flushSync();for(let i=0;i<20;i++)await Promise.resolve();};
const label=REV??'WORKTREE';

// DEFECT 1 -- endpoint left holding a rolled-back value.
{
  const n=K.getPathNotifier();
  const t=K.signalTree({x:0,z:0},{enhancers:[K.transactions()]});
  const sent=[]; const l=K.link(t.$.x,{set:v=>sent.push(v)});
  await flush(n); sent.length=0;
  const p1=tx(t,()=>t.$.x(1)); await flush(n);
  const p2=tx(t,()=>{ t.$.z(9); t.$.x(5); }); await flush(n);
  const afterOpen=[...sent];
  p1.confirm(); await flush(n);
  const afterP1=[...sent];
  let rb; try{ p2.rollback(); rb='settled'; }catch(e){ rb='refused'; }
  await flush(n);
  // settled() may never resolve here (it does not on v15.3.0), so bound the wait.
  const settledOk=await Promise.race([l.settled().then(()=>true,()=>true), new Promise(r=>setTimeout(()=>r(false),100))]);
  const last=sent.length?sent[sent.length-1]:'(none)';
  const bad = last!==t.$.x() && sent.includes(5);
  console.log(`[${label}] D1 link-after-rollback: sentWhileOpen=${JSON.stringify(afterOpen)} afterP1=${JSON.stringify(afterP1)} rollback=${rb} linkSettled=${settledOk} finalSent=${JSON.stringify(sent)} x=${t.$.x()} -> ${bad?'DEFECT: endpoint holds rolled-back 5':'ok'}`);
  l.dispose(); t.destroy();
}
// DEFECT 2 -- a throwing '**' subscriber during transact()'s post-callback flush.
{
  const n=K.getPathNotifier();
  const t=K.signalTree({x:0,y:0},{enhancers:[K.transactions()]});
  const sent=[]; const l=K.link(t.$.y,{set:v=>sent.push(v)});
  await flush(n); sent.length=0;
  let armed=true;
  const off=n.subscribe('**',()=>{ if(armed){ armed=false; throw new Error('subscriber boom'); } });
  let handle, threw=null;
  try{ handle=tx(t,()=>t.$.x(1)); }catch(e){ threw=String(e.message); }
  off(); await flush(n);
  // Afterwards: does an ordinary write on the tree still reach the Link?
  t.$.y(7); await flush(n); try{ await Promise.race([l.settled(), new Promise(r=>setTimeout(r,50))]); }catch{}
  console.log(`[${label}] D2 throwing-subscriber: transactThrew=${threw!==null} handle=${!!handle} x=${t.$.x()} laterLinkSent=${JSON.stringify(sent)} -> ${threw!==null && !sent.includes(7)?'DEFECT: tree stranded, Link silent':'ok'}`);
  l.dispose(); t.destroy();
}
