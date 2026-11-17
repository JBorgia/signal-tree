import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { cpSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import linker from '@angular/compiler-cli/linker/babel';
import assert from 'node:assert/strict';
import { browserChecks } from '../experiments/multi-actor-operations/installed/browser/checks.mjs';
const runner=fileURLToPath(import.meta.url), repository=resolve(dirname(runner),'../..');
const experiment=join(repository,'tools/experiments/multi-actor-operations'), installed=join(experiment,'installed'), here=join(installed,'browser');
const [configArg, outputArg]=process.argv.slice(2);
assert(configArg && outputArg, 'public-workflow.mjs CONFIG NEW_OUTPUT_DIRECTORY');
const configPath=resolve(configArg), config=JSON.parse(readFileSync(configPath,'utf8'));
const require=createRequire(join(repository,'package.json'));
const compilerRequire=createRequire(require.resolve('@angular/compiler-cli/package.json'));
const babel=compilerRequire('@babel/core');
const work=resolve(outputArg), consumer=join(work,'consumer'), packs=join(work,'packs'), logs=join(work,'logs');
mkdirSync(work); // Fail rather than overwrite any prior attempt.
for(const p of [consumer,packs,logs,join(consumer,'browser')])mkdirSync(p,{recursive:true});
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
cpSync(runner,join(work,'runner-source.mjs'));
const manifest={work,sourceHead:config.sourceRevision??null,commands:[],hashes:{},mode:'installed-artifact/full-AOT/production-browser-DOM/in-memory-authority',limits:config.limits,configuration:{path:configPath,sha256:hash(configPath)},runner:{path:runner,sha256:hash(runner)},toolVersions:{node:process.version,angular:require('@angular/core/package.json').version,typescript:require('typescript/package.json').version,playwright:require('playwright/package.json').version}};
const save=()=>writeFileSync(join(work,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
function run(name,command,args,cwd,allow=false){const r=spawnSync(command,args,{cwd,encoding:'utf8',maxBuffer:64*1024*1024,env:{...process.env,npm_config_cache:join(work,'cache')}});writeFileSync(join(logs,name+'.log'),(r.stdout??'')+(r.stderr??'')+(r.error?String(r.error):''));manifest.commands.push({name,command,args,cwd,exit:r.status});save();if(r.status!==0&&!allow)throw new Error(name+' failed: '+join(logs,name+'.log'));return r;}
const files=p=>readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(p,e.name)):[join(p,e.name)]);
console.log('Evidence directory: '+work);let server,browser;
try{
 assert.equal(hash(config.artifactPlan),config.artifactPlanSha256);
 const admittedPlan=JSON.parse(readFileSync(config.artifactPlan,'utf8'));
 manifest.artifacts=config.artifacts;
 for(const [name,artifact] of Object.entries(config.artifacts)){
  const admitted=Object.values(admittedPlan.artifacts).filter(value=>value.archive===artifact.archive&&value.integrity===artifact.integrity);
  assert.equal(admitted.length,1,'Configured archive must join one exact plan artifact');
  if(name==='kernel'){
   const identity=admitted[0].sourceCommit??admitted[0].sourceIdentity;
   assert(identity,'Missing admitted runtime source identity');
   assert.deepEqual(config.sourceRevision??config.sourceIdentity,identity,'Source label must match admitted runtime');
   manifest.sourceIdentity=identity;
  }
  assert.equal('sha512-'+createHash('sha512').update(readFileSync(artifact.archive)).digest('base64'),artifact.integrity,'Changed artifact '+name);
  cpSync(artifact.archive,join(packs,name+'.tgz'));
 }
 manifest.referenceSources={};
 for(const path of [join(here,'checks.mjs'),join(here,'app.ts'),join(here,'main.ts'),join(experiment,'coordinator.mjs'),join(experiment,'dispatch-fixture.mjs'),join(experiment,'protocol/ag-ui.mjs'),join(experiment,'authority/review-fixture.mjs')])manifest.referenceSources[path]=hash(path);
 for(const name of ['tslib','@angular/core','@angular/compiler','@angular/common','@angular/platform-browser','rxjs'])run('pack-'+name.replaceAll('/','-'),'npm',['pack','--ignore-scripts','--json','--pack-destination',packs],dirname(require.resolve(name+'/package.json')));
 const tarballs=files(packs).filter(p=>p.endsWith('.tgz'));for(const p of tarballs)manifest.hashes[relative(work,p)]=hash(p);
 writeFileSync(join(consumer,'package.json'),JSON.stringify({name:'st-browser-reference',version:'0.0.0',private:true,type:'module'}));
 run('install','npm',['install','--offline','--ignore-scripts','--no-audit','--no-fund',...tarballs],consumer);
 for(const name of ['coordinator.mjs','dispatch-fixture.mjs'])cpSync(join(experiment,name),join(consumer,name));
 const testSources=files(experiment).filter(path=>path.endsWith('.mjs') && (dirname(path)===experiment || ['authority','protocol','http'].some(part=>path.startsWith(join(experiment,part)+'/'))));
 const testPaths=[];
 for(const path of testSources){
  const destination=join(consumer,relative(experiment,path));mkdirSync(dirname(destination),{recursive:true});cpSync(path,destination);
  manifest.referenceSources[path]=hash(path);if(path.endsWith('.test.mjs'))testPaths.push(destination);
 }
 const httpSource=join(dirname(runner),'http-workflow.test.mjs');
 const httpDestination=join(consumer,'http-workflow.test.mjs');cpSync(httpSource,httpDestination);manifest.referenceSources[httpSource]=hash(httpSource);testPaths.push(httpDestination);
 for(const p of files(consumer).filter(p=>!p.includes('/node_modules/')))manifest.hashes[relative(work,p)]=hash(p);
 run('coordinator-protocol-http',process.execPath,['--test',...testPaths],consumer);
 for(const name of ['coordinator.d.mts','dispatch-fixture.d.mts'])cpSync(join(installed,name),join(consumer,name));
 for(const name of ['app.ts','main.ts','ag-ui.d.mts','review-fixture.d.mts'])cpSync(join(here,name),join(consumer,'browser',name));
 cpSync(join(experiment,'authority/review-fixture.mjs'),join(consumer,'browser/review-fixture.mjs'));
 cpSync(join(experiment,'protocol/ag-ui.mjs'),join(consumer,'browser/ag-ui.mjs'));
 for(const p of files(consumer).filter(p=>!p.includes('/node_modules/')))manifest.hashes[relative(work,p)]=hash(p);
 writeFileSync(join(consumer,'tsconfig.json'),JSON.stringify({compilerOptions:{target:'ES2022',module:'ESNext',moduleResolution:'bundler',strict:true,skipLibCheck:false,experimentalDecorators:true,useDefineForClassFields:false,outDir:'out',rootDir:'.',types:[],lib:['ES2022','DOM']},angularCompilerOptions:{strictTemplates:true,strictInjectionParameters:true,compilationMode:'full'},files:['browser/app.ts','browser/main.ts']},null,2));
 manifest.hashes['consumer/tsconfig.json']=hash(join(consumer,'tsconfig.json'));
 run('aot',process.execPath,[join(dirname(require.resolve('@angular/compiler-cli/package.json')),'bundles/src/bin/ngc.js'),'-p','tsconfig.json'],consumer);
 for(const name of ['coordinator.mjs','dispatch-fixture.mjs'])cpSync(join(consumer,name),join(consumer,'out',name));
 cpSync(join(consumer,'browser/review-fixture.mjs'),join(consumer,'out/browser/review-fixture.mjs'));
 cpSync(join(consumer,'browser/ag-ui.mjs'),join(consumer,'out/browser/ag-ui.mjs'));
 const dist=join(work,'site');mkdirSync(dist);
 const result=await build({entryPoints:[join(consumer,'out/browser/main.js')],outfile:join(dist,'app.js'),bundle:true,format:'esm',platform:'browser',target:'es2022',define:{ngDevMode:'false',__DEV__:'false','process.env.NODE_ENV':'"production"'},minify:true,metafile:true,plugins:[{name:'angular-aot-linker',setup(b){b.onLoad({filter:/node_modules\/.*\.m?js$/},async args=>{
  const code=readFileSync(args.path,'utf8');if(!code.includes('ɵɵngDeclare'))return;
  const output=await babel.transformAsync(code,{filename:args.path,configFile:false,babelrc:false,plugins:[[linker,{linkerJitMode:false}]]});return{contents:output.code,loader:'js'};
 });}}]});
 writeFileSync(join(work,'bundle-metafile.json'),JSON.stringify(result.metafile,null,2));
 if(Object.keys(result.metafile.inputs).some(p=>p.includes('worktrees/')||p.includes('/packages/kernel/src')||p.includes('/packages/angular/src')||p.includes('node_modules/@angular/compiler/')))throw new Error('Source alias or runtime compiler in browser bundle');
 writeFileSync(join(dist,'index.html'),'<!doctype html><html><head><meta charset="utf-8"><title>Dispatch reference</title><style>body{font:16px system-ui;max-width:900px;margin:32px auto}button,input{font:inherit;padding:8px;margin:5px}p{margin:10px}strong{color:#13573a}hr{margin-top:24px}</style></head><body><operation-browser></operation-browser><script type="module" src="/app.js"></script></body></html>');
 for(const p of files(dist))manifest.hashes[relative(work,p)]=hash(p);save();
 server=createServer((req,res)=>{const p=req.url==='/'?join(dist,'index.html'):req.url==='/app.js'?join(dist,'app.js'):undefined;if(!p){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':'text/html');res.end(readFileSync(p));});
 await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok);});
 const address=server.address();const url=`http://127.0.0.1:${address.port}`;manifest.url=url;
 browser=await chromium.launch({headless:true});manifest.chromium=await browser.version();
 const page=await browser.newPage({viewport:{width:1200,height:1000}});page.setDefaultTimeout(7000);
 const report=await browserChecks(page,url,work);writeFileSync(join(work,'browser-results.json'),JSON.stringify(report,null,2));manifest.results=report;save();
 console.log(JSON.stringify({work,results:report.results},null,2));process.exitCode=report.results.some(r=>r.outcome!=='PASS')?1:0;
}catch(error){manifest.error=String(error);save();console.error(error);process.exitCode=1;}
finally{if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
