import { sealedInput } from './sealed-input.mjs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));
const repository=resolve(here,'../../../..');
const require=createRequire(join(repository,'package.json'));
const work=resolve(process.argv[2]);
const parent=JSON.parse(readFileSync(join(work,'manifest.json'),'utf8'));
const sealed=await sealedInput(process.argv.slice(3));
if (Boolean(parent.sealedInput) !== Boolean(sealed) || (sealed && JSON.stringify(parent.sealedInput)!==JSON.stringify(sealed.input))) throw new Error('Explicit sealed inputs must match parent receipt');
const head='5727cd8fcf701128358674411400c019b137a5e4';
if((!sealed && parent.sourceHead!==head)||process.version!=='v24.15.0')throw new Error('Unexpected source or Node');
const source=sealed?.input.candidate ?? join(work,'source'), logs=join(work,'angular-logs'), packs=join(work,'angular-packs'), consumer=join(work,'angular-consumer');
for(const p of [logs,packs,consumer])mkdirSync(p,{recursive:true});
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
if(!sealed && sha(join(work,'source.tar'))!==parent.hashes['source.tar'])throw new Error('Source archive differs');
const manifest={sourceHead:sealed ? null : head,...(sealed ? {sealedInput:sealed.input} : {}),work,commands:[],hashes:sealed ? {} : {'source.tar':sha(join(work,'source.tar'))},results:{},toolVersions:{node:process.version,angular:require('@angular/core/package.json').version,compiler:require('@angular/compiler-cli/package.json').version,typescript:require('typescript/package.json').version}};
const save=()=>writeFileSync(join(work,'angular-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
function run(name,command,args,cwd,allow=false){const r=spawnSync(command,args,{cwd,encoding:'utf8',maxBuffer:64*1024*1024,env:{...process.env,NX_DAEMON:'false',NX_ISOLATE_PLUGINS:'false',npm_config_cache:join(work,'npm-cache')}});writeFileSync(join(logs,name+'.log'),(r.stdout??'')+(r.stderr??'')+(r.error?String(r.error):''));manifest.commands.push({name,command,args,cwd,exit:r.status});save();if(r.status!==0&&!allow)throw new Error(name+' failed; see '+logs);return r;}
const files=p=>readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(p,e.name)):[join(p,e.name)]);
try {
 if (!sealed) run('build-angular','pnpm',['nx','build','angular','--skip-nx-cache'],source);
 sealed?.verify();
 for(const name of ['kernel','angular']){
  const dist=join(source,'dist/packages',name);
  run('pack-'+name,'npm',['pack','--ignore-scripts','--json','--pack-destination',packs],dist);
  for(const p of files(dist))manifest.hashes[relative(work,p)]=sha(p);
 }
 for(const name of ['tslib','@angular/core','@angular/compiler','rxjs'])run('pack-'+name.replaceAll('/','-'),'npm',['pack','--ignore-scripts','--json','--pack-destination',packs],dirname(require.resolve(name+'/package.json')));
 const tarballs=files(packs).filter(p=>p.endsWith('.tgz'));for(const p of tarballs)manifest.hashes[relative(work,p)]=sha(p);
 writeFileSync(join(consumer,'package.json'),JSON.stringify({name:'st-angular-installed-reference',version:'0.0.0',private:true,type:'module'}));
 run('install','npm',['install','--offline','--ignore-scripts','--no-audit','--no-fund',...tarballs],consumer);
 manifest.hashes[relative(work,join(consumer,'package-lock.json'))]=sha(join(consumer,'package-lock.json'));
 const local=createRequire(join(consumer,'package.json'));
 for(const name of ['kernel','angular']){
  const installed=dirname(local.resolve('@signal-tree/'+name+'/package.json'));
  if(!realpathSync(installed).startsWith(consumer+'/'))throw new Error('Escaped consumer');
  for(const p of files(installed)){
   const original=join(source,'dist/packages',name,relative(installed,p));
   if(!existsSync(original)||sha(p)!==sha(original))throw new Error('Different installed bytes: '+p);
   manifest.hashes[relative(work,p)]=sha(p);
  }
 }
 for(const name of ['reference.component.ts','angular-runtime.mjs']){cpSync(join(here,name),join(consumer,name));manifest.hashes[relative(work,join(consumer,name))]=sha(join(consumer,name));}
 const options={target:'ES2022',module:'ESNext',moduleResolution:'bundler',strict:true,skipLibCheck:false,experimentalDecorators:true,useDefineForClassFields:false,outDir:'out',types:[],lib:['ES2022','DOM']};
 writeFileSync(join(consumer,'tsconfig.json'),JSON.stringify({compilerOptions:options,angularCompilerOptions:{strictTemplates:true,strictInjectionParameters:true,compilationMode:'full'},files:['reference.component.ts']},null,2));
 const ngc=join(dirname(require.resolve('@angular/compiler-cli/package.json')),'bundles/src/bin/ngc.js');
 run('aot',process.execPath,[ngc,'-p','tsconfig.json'],consumer);
 const compiled=join(consumer,'out/reference.component.js');manifest.hashes[relative(work,compiled)]=sha(compiled);
 if(!readFileSync(compiled,'utf8').includes('ɵɵdefineComponent'))throw new Error('Missing full AOT definition');
 run('component-runtime',process.execPath,['angular-runtime.mjs'],consumer,true);
 sealed?.verify();
 manifest.results.failedChecks=manifest.commands.filter(c=>c.exit!==0).map(c=>c.name);save();console.log(JSON.stringify({work,failedChecks:manifest.results.failedChecks},null,2));process.exitCode=manifest.results.failedChecks.length?1:0;
}catch(e){manifest.error=String(e);save();console.error(e);process.exitCode=1;}

finally {
 try { sealed?.verify(); } catch(e) { manifest.integrityError=String(e); save(); console.error(e); process.exitCode=1; }
}
