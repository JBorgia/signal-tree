import {readFileSync,writeFileSync} from 'node:fs';
import {validateRetentionMatrix} from '/private/tmp/st-c21-gc-routing-successor/candidate/tools/lib/forwarding-retention-matrix.mjs';
const root='/private/tmp/st-c21-gc-routing-successor';
const base=JSON.parse(readFileSync(root+'/matrix-falsifiers/valid.json')).rows;
const read=row=>JSON.parse(readFileSync(row.artifact));
const records=[];
for(const name of ['valid','missing-arm','duplicate-arm','swapped-artifacts','missing-artifact','failed-child-with-valid-artifact','malformed-round']){
 const rows=JSON.parse(readFileSync(`${root}/matrix-falsifiers/${name}.json`)).rows;
 const errors=validateRetentionMatrix(rows,read,process.version);
 if((errors.length===0)!==(name==='valid'))throw Error('unexpected outcome '+name);
 records.push({name,errors});
}
for(const [name,rows] of [['missing-matrix',undefined],['null-matrix',null],['empty-matrix',[]],['unknown-mode',base.map((x,i)=>i===0?{...x,name:'unregistered-mode'}:x)],['wrong-node',base]]){
 const errors=validateRetentionMatrix(rows,read,name==='wrong-node'?'v0.0.0':process.version);
 if(errors.length===0)throw Error('fail-open '+name);
 records.push({name,errors});
}
writeFileSync('/private/tmp/st-gc-routing-independent-review/MATRIX-REPLAY.json',JSON.stringify({node:process.version,records},null,2)+'\n');
console.log(`${records.length} matrix checks matched; no GC children launched`);
