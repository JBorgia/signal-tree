const fs=require('node:fs');const crypto=require('node:crypto');const ts=require('./candidate/node_modules/typescript');const esbuild=require('./candidate/node_modules/esbuild');
const before=fs.readFileSync(__dirname+'/before.spec.ts','utf8');const after=fs.readFileSync(__dirname+'/candidate/packages/kernel/src/lib/core-independent-review.spec.ts','utf8');
const output={};for(const [name,source] of [['before',before],['after',after]]){
 const tsc=ts.transpileModule(source,{fileName:'fixture.ts',compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,removeComments:true}}).outputText;
 const es=esbuild.transformSync(source,{loader:'ts',target:'es2022',format:'esm',legalComments:'none'}).code;
 fs.writeFileSync(__dirname+'/'+name+'.tsc.js',tsc);fs.writeFileSync(__dirname+'/'+name+'.esbuild.js',es);output[name]={tsc,es};
}
if(output.before.tsc!==output.after.tsc||output.before.es!==output.after.es)throw new Error('Emitted JavaScript differs');
const result={typescript:ts.version,esbuild:esbuild.version,tscIdentical:true,esbuildIdentical:true,tscSha256:crypto.createHash('sha256').update(output.after.tsc).digest('hex'),esbuildSha256:crypto.createHash('sha256').update(output.after.es).digest('hex')};
fs.writeFileSync(__dirname+'/emit-results.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
