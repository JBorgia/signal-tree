const fs=require('fs'),crypto=require('crypto');
const root='/private/tmp/st-c27-public-composition',base='/private/tmp/st-c26-scalar-finalized-role/candidate';
const ts=require(root+'/candidate/node_modules/typescript');
const options={target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,removeComments:true};
const results=[];
for(const rel of ['packages/kernel/src/lib/link.ts','packages/kernel/src/lib/experimental-publication/lifecycle.ts']){
 const before=ts.transpileModule(fs.readFileSync(base+'/'+rel,'utf8'),{compilerOptions:options}).outputText;
 const after=ts.transpileModule(fs.readFileSync(root+'/candidate/'+rel,'utf8'),{compilerOptions:options}).outputText;
 results.push({file:rel,equal:before===after,beforeSha256:crypto.createHash('sha256').update(before).digest('hex'),afterSha256:crypto.createHash('sha256').update(after).digest('hex')});
 if(before!==after)throw Error('Runtime emission changed: '+rel);
}
fs.writeFileSync(root+'/EMISSION-EQUALITY.json',JSON.stringify({compiler:ts.version,options,results,limit:'Single-file compiler emission comparison, not runtime test or package build. Barrel intentionally adds approved error value export.'},null,2)+'\n');
console.log('Both overlapping runtime modules emit identical JavaScript to C26');
