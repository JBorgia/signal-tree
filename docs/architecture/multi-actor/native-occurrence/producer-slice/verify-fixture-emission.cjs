const fs=require('fs');const ts=require('/private/tmp/st-native-reviewed-successor/candidate/node_modules/typescript');
const root='/private/tmp/st-native-reviewed-successor/candidate/packages/kernel/src/lib/';
const emit=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const results=[];
let old=fs.readFileSync('/private/tmp/st-occurrence-successor/packages/kernel/src/lib/core-independent-review.spec.ts','utf8');
// Remove comments to compare type-only correction without added explanatory comments.
const clean=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,removeComments:true}}).outputText;
results.push({file:'core-independent-review.spec.ts',sameEmission:clean(old)===clean(fs.readFileSync(root+'core-independent-review.spec.ts','utf8'))});
for(const file of ['native-equal-inverse-diagnostic.spec.ts','native-netzero-diagnostic.spec.ts']){
 const after=fs.readFileSync(root+file,'utf8');const before=after.replace('link<() => ReturnType<typeof tree.$>>(tree.$','link(tree.$');
 results.push({file,sameEmission:emit(before)===emit(after)});
}
if(results.some(x=>!x.sameEmission))throw Error('fixture emitted changes');console.log(JSON.stringify(results,null,2));
