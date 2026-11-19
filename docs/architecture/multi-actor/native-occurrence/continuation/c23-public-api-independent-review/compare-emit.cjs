const fs=require('node:fs'),crypto=require('node:crypto');
const ts=require('/Users/jonathanborgia/code/signaltree/node_modules/typescript');
const a='/private/tmp/st-native-combined-c23/candidate/', b='/private/tmp/st-c23-declare-public-successor/candidate/';
const paths=['packages/kernel/src/lib/link.ts','packages/kernel/src/lib/experimental-publication/lifecycle.ts'];
const result=paths.map(p=>{
 const emit=root=>ts.transpileModule(fs.readFileSync(root+p,'utf8'),{fileName:p,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,removeComments:true}}).outputText;
 const x=emit(a),y=emit(b);return {path:p,emittedJavaScriptIdentical:x===y,sha256:crypto.createHash('sha256').update(y).digest('hex')};
});
fs.writeFileSync('/private/tmp/st-c23-public-api-independent-review/EMIT-COMPARISON.json',JSON.stringify({typescript:ts.version,options:'ES2022/ESNext/removeComments; transpilation equivalence only, not typechecking or packed build',result},null,2)+'\n');
console.log(JSON.stringify(result));if(result.some(x=>!x.emittedJavaScriptIdentical))process.exitCode=1;
