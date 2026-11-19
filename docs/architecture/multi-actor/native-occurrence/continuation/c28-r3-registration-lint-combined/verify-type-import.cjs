const fs=require('fs'),ts=require('/Users/jonathanborgia/code/signaltree/node_modules/typescript'),crypto=require('crypto');
const root=__dirname, paths=['originals/entity-before-unused-type.ts','candidate/packages/kernel/src/lib/experimental-publication/entity.ts'];
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const options={target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,removeComments:true};
const rows=paths.map(path=>{const source=fs.readFileSync(root+'/'+path,'utf8');return {path,sourceSha256:hash(source),js:ts.transpileModule(source,{compilerOptions:options}).outputText};});
if(rows[0].js!==rows[1].js)throw Error('Type-only removal changed JS');
fs.writeFileSync(root+'/TYPE-IMPORT-EQUIVALENCE.json',JSON.stringify({emittedJavaScriptEqual:true,typescript:ts.version,options,inputs:rows.map(({js,...r})=>({...r,emittedSha256:hash(js)})),removed:'unused EntityPublicationPacket type import'},null,2));
