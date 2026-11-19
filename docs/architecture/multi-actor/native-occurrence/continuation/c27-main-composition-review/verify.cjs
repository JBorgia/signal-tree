const fs=require('fs'),crypto=require('crypto');
const ts=require('/Users/jonathanborgia/code/signaltree/node_modules/typescript');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const base='/private/tmp/st-c26-scalar-finalized-role', next='/private/tmp/st-c27-public-composition';
const result={typescript:ts.version,inputs:[],emission:[]};
for(const [root,file] of [[base,'SNAPSHOT-C26.json'],[next,'SNAPSHOT-C27.json']]){
 const raw=fs.readFileSync(root+'/'+file),m=JSON.parse(raw);const bad=Object.entries(m).filter(([p,h])=>hash(fs.readFileSync(root+'/candidate/'+p))!==h);
 if(bad.length)throw Error('source mismatch'); result.inputs.push({root,manifest:hash(raw),files:Object.keys(m).length,mismatches:0});
}
for(const file of ['packages/kernel/src/lib/link.ts','packages/kernel/src/lib/experimental-publication/lifecycle.ts']){
 const options={target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,removeComments:true};
 const a=ts.transpileModule(fs.readFileSync(base+'/candidate/'+file,'utf8'),{compilerOptions:options}).outputText;
 const b=ts.transpileModule(fs.readFileSync(next+'/candidate/'+file,'utf8'),{compilerOptions:options}).outputText;
 if(a!==b)throw Error('emission changed '+file);result.emission.push({file,sha256:hash(a),identical:true,options});
}
fs.writeFileSync('/private/tmp/st-c27-main-composition-review/RESULT.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
