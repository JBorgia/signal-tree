import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
const root=process.cwd(); const out=mkdtempSync(resolve(tmpdir(),'st-bis-'));
const REV=process.argv[2];
const bundled=await build({
  stdin:{contents:`export {signalTree} from './packages/kernel/src/index';
export {transactions} from './packages/kernel/src/enhancers/transactions/transactions';`,
    resolveDir:root,sourcefile:'b.ts',loader:'ts'},
  absWorkingDir:root,bundle:true,write:false,platform:'node',format:'esm',target:'node24',
  plugins:[{name:'rev',setup(b){ b.onLoad({filter:/\/packages\/kernel\/src\/.*\.ts$/},({path})=>({
    contents: execFileSync('git',['show',`${REV}:${relative(root,path)}`],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024}),
    loader:'ts', resolveDir: dirname(path) })); }}],
});
const p=resolve(out,'b.mjs'); writeFileSync(p,bundled.outputFiles[0].text);
const K=await import(p);
const N=150000, TRIALS=9, DISCARD=2;
const A={BASE:()=>K.signalTree({a:0}),DORM:()=>K.signalTree({a:0},{enhancers:[K.transactions()]})};
const t_=t=>{const s=process.hrtime.bigint();for(let i=0;i<N;i++)t.$.a(i);return Number(process.hrtime.bigint()-s)/1e6;};
for(let w=0;w<3;w++) for(const n of ['BASE','DORM']){const t=A[n]();for(let i=0;i<15000;i++)t.$.a(i);t.destroy();}
const r={BASE:[],DORM:[]};
for(let i=0;i<TRIALS;i++) for(const n of (i%2?['DORM','BASE']:['BASE','DORM'])){const t=A[n]();r[n].push(t_(t));t.destroy();}
const med=a=>{const s=[...a].sort((x,y)=>x-y);return s[Math.floor(s.length/2)];};
const b=med(r.BASE.slice(DISCARD)), d=med(r.DORM.slice(DISCARD));
console.log(`${REV.slice(0,10)}  base ${b.toFixed(1)}ms  dormant ${d.toFixed(1)}ms  +${((d-b)/b*100).toFixed(0)}%`);
