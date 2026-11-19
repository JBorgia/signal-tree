import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {validateRetentionMatrix} from './candidate/tools/lib/forwarding-retention-matrix.mjs';
const root=new URL('./',import.meta.url);
const names=readdirSync(new URL('./candidate/artifacts/forwarding-retention/',root));
if(names.length!==1)throw new Error('ambiguous baseline');
const result=JSON.parse(readFileSync(new URL(`./candidate/artifacts/forwarding-retention/${names[0]}/RESULT.json`,root)));
const out=new URL('./matrix-falsifiers/',root);mkdirSync(out);
const cases=[
 ['valid',false,()=>{}],
 ['missing-arm',true,rows=>rows.pop()],
 ['duplicate-arm',true,rows=>{rows[11]=structuredClone(rows[10]);}],
 ['swapped-artifacts',true,rows=>{[rows[9].artifact,rows[10].artifact]=[rows[10].artifact,rows[9].artifact];}],
 ['missing-artifact',true,rows=>{rows[11].artifact=new URL('./absent.json',out).pathname;}],
 ['failed-child-with-valid-artifact',true,rows=>{rows[0].processExit=1;}],
 ['malformed-round',true,rows=>{const sample=JSON.parse(readFileSync(rows[11].artifact));sample.held[0]={};const path=new URL('./malformed.json',out);writeFileSync(path,JSON.stringify(sample));rows[11].artifact=path.pathname;}],
];
const summary=[];
for(const [name,shouldFail,mutate] of cases){
 const rows=structuredClone(result.results);mutate(rows);
 const errors=validateRetentionMatrix(rows,row=>JSON.parse(readFileSync(row.artifact)),process.version);
 const actualExit=errors.length?1:0;const pass=Boolean(actualExit)===shouldFail;
 writeFileSync(new URL(`${name}.json`,out),JSON.stringify({name,expectedExit:shouldFail?1:0,actualExit,pass,errors,rows},null,2));
 summary.push({name,actualExit,pass,errors});
}
writeFileSync(new URL('RESULT.json',out),JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));if(summary.some(row=>!row.pass))process.exitCode=1;
