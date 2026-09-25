#!/usr/bin/env node
// Does gating EMISSION on "a transaction is live" -- the L19-DORMANT-GUARD
// spike's repair -- break other notifier consumers? The spike only checked
// rollback. link() subscribes to the same notifier.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
const here=dirname(fileURLToPath(import.meta.url)); const root=resolve(here,'../../..');
const out=mkdtempSync(resolve(tmpdir(),'st-gls-'));
const OM='packages/kernel/src/lib/internals/owned-mutation.ts';
const mk=async(name,guard)=>{
  const b=await build({stdin:{contents:`export {signalTree} from './packages/kernel/src/index';
export {transactions} from './packages/kernel/src/enhancers/transactions/transactions';
export {link} from './packages/kernel/src/lib/link';
export {getPathNotifier} from './packages/kernel/src/lib/path-notifier';`,
    resolveDir:root,sourcefile:`${name}.ts`,loader:'ts'},absWorkingDir:root,bundle:true,write:false,
    platform:'node',format:'esm',target:'node24',
    plugins: guard?[{name:'g',setup(bb){ bb.onLoad({filter:/owned-mutation\.ts$/},({path})=>{
      if(relative(root,path)!==OM) return null;
      const s=readFileSync(path,'utf8');
      return {contents:s.replace('  pathObservation().notify(',
        '  if ((globalThis as never as {__stCausalLive?: number}).__stCausalLive) pathObservation().notify('),
        loader:'ts',resolveDir:dirname(path)}; }); }}]:[]});
  const p=resolve(out,`${name}.mjs`); writeFileSync(p,b.outputFiles[0].text); return import(p); };
const flush=async n=>{n.flushSync();for(let i=0;i<16;i++)await Promise.resolve();};
for(const [name,guard] of [['UNGUARDED',false],['SPIKE-GUARD',true]]){
  const K=await mk(name,guard); const n=K.getPathNotifier();
  const tree=K.signalTree({x:0},{enhancers:[K.transactions()]});
  const sent=[]; const l=K.link(tree.$.x,{set:v=>sent.push(v)});
  await flush(n); sent.length=0;
  globalThis.__stCausalLive=0;       // dormant: no transaction open
  tree.$.x(7);                        // an ORDINARY write
  await flush(n); try{ await l.settled(); }catch{}
  console.log(`${name.padEnd(12)} ordinary write -> Link received ${JSON.stringify(sent)}`);
  l.dispose(); tree.destroy();
}
