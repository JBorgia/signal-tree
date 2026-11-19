const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const ts=require('./candidate/node_modules/typescript');
const root=__dirname;
const baseline='/private/tmp/st-native-combined-c23/candidate';
const candidate=path.join(root,'candidate');
const output=path.join(root,'emission-evidence');fs.mkdirSync(output,{recursive:true});
const options={target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,removeComments:true,sourceMap:false,declaration:false};
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
function emit(file,base){const source=fs.readFileSync(path.join(base,file),'utf8');return ts.transpileModule(source,{fileName:file,compilerOptions:options,reportDiagnostics:true});}
const results=[];
for(const file of ['packages/kernel/src/lib/link.ts','packages/kernel/src/lib/experimental-publication/lifecycle.ts']){
 const a=emit(file,baseline),b=emit(file,candidate);
 for(const [label,value] of [['before',a],['after',b]])fs.writeFileSync(path.join(output,path.basename(file)+'.'+label+'.js'),value.outputText);
 results.push({file,equal:a.outputText===b.outputText,beforeSha256:sha(a.outputText),afterSha256:sha(b.outputText),diagnostics:[...(a.diagnostics||[]),...(b.diagnostics||[])].map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n'))});
}
const file='packages/kernel/src/lib/publication-declaration.ts';const emitted=emit(file,candidate);fs.writeFileSync(path.join(output,'publication-declaration.js'),emitted.outputText);
const record={compilerVersion:ts.version,method:'Installed TypeScript transpileModule; ES2022/ESNext, comments removed, no source maps. No code executed; not a bundle/build comparison.',options,results,newTypesModule:{file,emitted:emitted.outputText,onlyEmptyModuleMarker:emitted.outputText.trim()==='export {};'},exceptions:[{file:'packages/kernel/src/index.ts',description:'Intentional public value re-export of the existing SignalTreePublicationError class emits JavaScript. New type-only exports do not. The whole patch is NOT zero-JS.'}]};
fs.writeFileSync(path.join(output,'RESULT.json'),JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify(record,null,2));
if(results.some(x=>!x.equal||x.diagnostics.length)||!record.newTypesModule.onlyEmptyModuleMarker)process.exitCode=1;
