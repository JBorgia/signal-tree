import {build} from 'esbuild';
import {gzipSync} from 'node:zlib';
import {writeFileSync,mkdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const [baseline,candidate,out]=process.argv.slice(2);mkdirSync(out,{recursive:true});
const results=[];
for(const [arm,repo] of [['baseline',baseline],['B',candidate]]){
 const core=`${repo}/dist/packages/kernel/dist/index.js`;
 const bInstall=`${repo}/dist/packages/kernel/dist/enhancers/transactions/native-ownership-public-experiment.js`;
 const fixtures={
 bare:`import { signalTree } from ${JSON.stringify(core)}; const t=signalTree({count:0,user:{name:'a'}});t.$.count(1);t.$.user.name('b');globalThis.__sink=[t.$.count(),t.$.user.name()];`,
 entities:`import { signalTree,entityMap } from ${JSON.stringify(core)}; const t=signalTree({count:0,users:entityMap()});t.$.users.addOne({id:1,name:'a'});t.$.users.updateOne(1,{name:'b'});globalThis.__sink=t.$.users.all();`,
 transaction:`import { signalTree,entityMap,transactions } from ${JSON.stringify(core)}; ${arm==='B'?`import {installNativeOwnershipPublicExperiment as install} from ${JSON.stringify(bInstall)};`:''} const enhancer=${arm==='B'?'Object.assign(t=>install(t),transactions())':'transactions()'};const t=signalTree({x:0,rows:entityMap()},{enhancers:[enhancer]});t.$.rows.addOne({id:'A',n:0});const p=t.transact(()=>{t.$.x(1);t.$.rows.updateOne('A',{n:1});});if(t.$.x()!==1||t.$.rows.byIdOrFail('A')().n!==1)throw Error('write');p.rollback();if(t.$.x()!==0||t.$.rows.byIdOrFail('A')().n!==0)throw Error('rollback');globalThis.__sink=p.inspect();t.destroy();`
 };
 for(const [kind,contents] of Object.entries(fixtures)){
  const r=await build({stdin:{contents,resolveDir:repo,sourcefile:`${kind}.js`},bundle:true,minify:true,format:'esm',platform:'browser',treeShaking:true,external:['@angular/*','rxjs','rxjs/*','tslib'],nodePaths:[repo+'/node_modules'],write:false,metafile:true,legalComments:'none',logLevel:'silent',define:{ngDevMode:'false'}});
  const file=`${out}/${arm}-${kind}.mjs`;writeFileSync(file,r.outputFiles[0].contents);writeFileSync(`${out}/${arm}-${kind}.meta.json`,JSON.stringify(r.metafile,null,2));await import(pathToFileURL(file));
  results.push({arm,kind,bytes:r.outputFiles[0].contents.length,gzip:gzipSync(r.outputFiles[0].contents,{level:9}).length,executed:true});
 }
}
writeFileSync(out+'/summary.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
