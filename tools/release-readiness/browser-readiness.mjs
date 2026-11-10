import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import os from 'node:os';
import {build} from 'esbuild';
import {chromium} from 'playwright';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),packet=resolve(process.argv[2]);
const out=resolve(packet,'browser-readiness');mkdirSync(out,{recursive:false});
const sha=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const app=resolve(root,'apps/react-reference/src/app/app.tsx');
const store=resolve(root,'apps/react-reference/src/app/reference-store.ts');
const entry=resolve(out,'entry.tsx');
writeFileSync(entry,`
import React from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import App from ${JSON.stringify(app)};
import {createReferenceStore,INITIAL_JOBS} from ${JSON.stringify(store)};
import ${JSON.stringify(resolve(root,'apps/react-reference/src/styles.css'))};
const rows=Array.from({length:1000},(_,i)=>({...INITIAL_JOBS[i%5],id:i<5?INITIAL_JOBS[i].id:'J-CAP-'+i}));
window.runReadiness=async()=>{
 const host=document.getElementById('root');const began=performance.now();
 const state=createReferenceStore(rows);const treeReady=performance.now();
 const view=createRoot(host);flushSync(()=>view.render(React.createElement(App,{store:state})));
 const layout=host.getBoundingClientRect();const ready=performance.now();
 const visible=document.querySelectorAll('article.job').length;
 if(visible!==600||!layout.height)throw Error('Actual reference view not realized');
 const interactions=[];
 for(let i=0;i<30;i++){
  const start=performance.now();flushSync(()=>state.setTeam(i%2?'North':'South'));
  await new Promise(resolve=>setTimeout(resolve,0));flushSync(()=>{});
  host.getBoundingClientRect();interactions.push(performance.now()-start);
  if(document.querySelectorAll('article.job').length!==(i%2?600:400))throw Error('Filter-only render stale');
 }
 flushSync(()=>view.unmount());state.destroy();
 return{stateMs:treeReady-began,usableViewMs:ready-began,interactions,visible};
};
`);
const inputs={[app]:sha(app),[store]:sha(store),[entry]:sha(entry)};
for(const arm of ['baseline','packed']){
 const outfile=resolve(out,arm+'.js');
 const built=await build({entryPoints:[entry],outfile,bundle:true,metafile:true,format:'iife',platform:'browser',minify:true,jsx:'automatic',nodePaths:[resolve(root,'node_modules')],define:{'process.env.NODE_ENV':'"production"',ngDevMode:'false'},plugins:[{name:'exact-candidate',setup(plugin){
  plugin.onResolve({filter:/^@signal-tree\/kernel(?:\/(?:adapter|internals))?$/},args=>({path:resolve(packet,arm+'-kernel/dist',args.path.split('/')[2]?args.path.split('/')[2]+'.js':'index.js')}));
  plugin.onResolve({filter:/^@signal-tree\/react$/},()=>({path:resolve(root,'packages/react/src/index.ts')}));
  plugin.onLoad({filter:/reference-store\.ts$/},()=>({contents:readFileSync(store,'utf8').replace('const INITIAL_JOBS:','export const INITIAL_JOBS:').replace('createReferenceStore = () =>','createReferenceStore = (benchmarkSeed?: Job[]) =>').replace('setAll(INITIAL_JOBS)','setAll(benchmarkSeed ?? INITIAL_JOBS)'),loader:'ts'}));
 }}]});inputs[outfile]=sha(outfile);inputs[outfile.replace(/\.js$/,'.css')]=sha(outfile.replace(/\.js$/,'.css'));
 for(const path of Object.keys(built.metafile.inputs)){const actual=resolve(root,path);inputs[actual]=sha(actual);}
}
const schedule=['baseline','baseline',...Array.from({length:5},(_,i)=>i%2?['packed','baseline']:['baseline','packed']).flat()];
writeFileSync(resolve(out,'plan.json'),JSON.stringify({createdUTC:new Date().toISOString(),inputs,schedule,rows:1000,viewport:{width:1280,height:900},startupEnvelopeMs:100,node:process.version,host:os.cpus()[0]?.model,platform:os.platform(),load:os.loadavg(),chromiumExecutable:chromium.executablePath(),cpuThrottling:false,scope:'Actual production React reference App/CSS/store; seed-capacity injection only. Fresh Chromium process each child; bundle/module load and payload generation excluded; measured create+render+forced layout, not first paint/network. All30 filter-only updates verify rendered rowcount. No fixed-device extrapolation.'},null,2));
const verifyInputs=()=>{for(const [path,digest] of Object.entries(inputs))assert.equal(sha(path),digest,`Input drift: ${path}`);};
const server=createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname==='/'){res.setHeader('content-type','text/html');res.end('<!doctype html><html><head><link rel="stylesheet" href="/'+new URL(req.url,'http://localhost').searchParams.get('arm')+'.css"></head><body><div id="root"></div><script src="/'+new URL(req.url,'http://localhost').searchParams.get('arm')+'.js"></script></body></html>');}
 else if(/^\/(baseline|packed)\.(js|css)$/.test(pathname)){res.setHeader('content-type',pathname.endsWith('.js')?'text/javascript':'text/css');res.end(readFileSync(resolve(out,pathname.slice(1))));}
 else {res.statusCode=404;res.end();}
});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
try{
 for(let i=0;i<schedule.length;i++){
  verifyInputs();const arm=schedule[i],loadBefore=os.loadavg(),browser=await chromium.launch({headless:true});
  try{const page=await browser.newPage({viewport:{width:1280,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:'+server.address().port+'/?arm='+arm);const result=await page.evaluate(()=>window.runReadiness());assert.deepEqual(errors,[]);
   verifyInputs();writeFileSync(resolve(out,i+'.json'),JSON.stringify({arm,...result,chromiumVersion:browser.version(),loadBefore,loadAfter:os.loadavg(),inputsUnchanged:true}));console.log(JSON.stringify({i,arm,stateMs:result.stateMs,usableViewMs:result.usableViewMs}));
  }catch(error){writeFileSync(resolve(out,i+'.failure.json'),JSON.stringify({arm,error:String(error),stack:error.stack}));throw error;}
  finally{await browser.close();}
 }
}finally{await new Promise(resolve=>server.close(resolve));}
