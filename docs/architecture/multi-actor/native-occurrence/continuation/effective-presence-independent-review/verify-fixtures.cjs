const fs=require('fs'),path=require('path'),crypto=require('crypto');
const ts=require('./candidate/node_modules/typescript');
const author='/private/tmp/st-effective-presence-successor';
const freeze=JSON.parse(fs.readFileSync(author+'/FREEZE.json','utf8'));
const result={};
for(const name of freeze.newTests){
 const before=fs.readFileSync(path.join(author,'runs/spec-types/source',name),'utf8');
 const after=fs.readFileSync(path.join(author,'candidate',name),'utf8');
 const emit=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 const left=emit(before),right=emit(after);
 result[name]={identical:left===right,sha256:crypto.createHash('sha256').update(right).digest('hex')};
 if(left!==right)throw Error(name);
}
fs.writeFileSync(path.join(__dirname,'FIXTURE-REPAIR-VERIFIED.json'),JSON.stringify(result,null,2));
console.log('five author fixture JS outputs identical');
