// Additional falsifier, registered separately after the first frozen batch.
// No pending work, undo or diagnostics: terminal entity lifetimes have no live
// correctness obligation. Counts are model instrumentation, not heap bytes.
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const {create}=await import(pathToFileURL(resolve(process.argv[2])).href);
const count=Number(process.argv[3]??1000),profile=process.argv[4]??'live',c=await create({profile});
try{
 const before=c.stats(),start=performance.now();
 for(let i=0;i<count;i++){
   const add={kind:'add',ref:`retired-${i}`,key:'temporary',fields:{name:`payload-${i}`,priority:i}};
   for(const op of [add,{kind:'remove',ref:add.ref}]){const r=c.write([op],{context:'local'});if(r.status!=='settled')throw Error(`churn ${r.status}`);}
 }
 const after=c.stats();console.log(JSON.stringify({candidate:process.argv[2],profile,count,ms:performance.now()-start,before,after,visibleEntities:c.read().entities.length,retainedGrowth:after.retainedOperations-before.retainedOperations}));
 process.exitCode=after.retainedOperations>before.retainedOperations+8?1:0;
}finally{c.destroy();}
