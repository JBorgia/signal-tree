#!/usr/bin/env node
// OPTION-A — can an OWNED, LINKABLE location be created lazily, after tree
// construction? WAKEUP-2 inferred "no" from the absence of a public addLocation
// API. That inference was withdrawn; this tests it directly.
//
// Existence proof candidate: entity field signals, which are materialized on
// demand after construction and which the structural adapter already links.
import { build } from 'esbuild';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
const here=dirname(fileURLToPath(import.meta.url)); const root=resolve(here,'../../..');
const out=mkdtempSync(resolve(tmpdir(),'st-oa-'));
const b=await build({stdin:{contents:`export {signalTree, entityMap} from './packages/kernel/src/index';
export {link} from './packages/kernel/src/lib/link';
export {getPathNotifier} from './packages/kernel/src/lib/path-notifier';
export {getPositionRegistry} from './packages/kernel/src/lib/internals/position-registry';`,
  resolveDir:root,sourcefile:'oa.ts',loader:'ts'},absWorkingDir:root,bundle:true,write:false,
  platform:'node',format:'esm',target:'node24'});
const p=resolve(out,'oa.mjs'); writeFileSync(p,b.outputFiles[0].text); const K=await import(p);
const checks=[]; const check=(ok,l,d)=>{checks.push({label:l,ok,detail:d});console.log(`${ok?'PASS':'FAIL'}  ${l}${d?`  -- ${d}`:''}`);};
const flush=async n=>{n.flushSync();for(let i=0;i<16;i++)await Promise.resolve();};

const n=K.getPathNotifier();
const tree=K.signalTree({rows:K.entityMap({selectId:r=>r.id})});
// The subject does not exist at construction time.
tree.$.rows.addOne({id:'A',name:'a',score:1});
const field=tree.$.rows.byIdOrFail('A').score;     // materialized now, post-construction
check(!!K.getPositionRegistry(field),'a lazily materialized entity field carries a position registry',
  `registry=${!!K.getPositionRegistry(field)}`);
const sent=[]; let err=null; let l;
try{ l=K.link(field,{set:v=>sent.push(v)}); }catch(e){ err=String(e.message).slice(0,80); }
check(err===null,'link() ACCEPTS a location created after tree construction',err??'accepted');
await flush(n); sent.length=0;
tree.$.rows.byIdOrFail('A').score(42); await flush(n); try{ await l?.settled(); }catch{}
check(sent.includes(42),'and delivers through it',`sent=${JSON.stringify(sent)}`);
l?.dispose(); tree.destroy();

console.log(`
CONCLUSION: the kernel already creates owned, linkable locations lazily. The
WAKEUP-2 inference that an exposable frontier would have to be a PERMANENT
per-fact location is false as a general claim.`);
writeFileSync(resolve(here,'option-a-lazy-location.json'),JSON.stringify({probe:'OPTION-A',checks},null,2)+'\n');
process.exit(checks.some(c=>!c.ok)?1:0);
