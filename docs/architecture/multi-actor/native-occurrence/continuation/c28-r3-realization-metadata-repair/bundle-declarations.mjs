import { rollup } from 'rollup';
import { dts } from 'rollup-plugin-dts';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root='/private/tmp/st-c28-r3-realization-metadata-repair';
const results={};
for(const arm of ['baseline','candidate']){
 results[arm]={};mkdirSync(`${root}/public-declarations/${arm}`,{recursive:true});
 for(const entry of ['index','adapter','internals']){
  const bundle=await rollup({input:`${root}/gate-declarations/${arm}/packages/kernel/src/${entry}.d.ts`,plugins:[dts()],external:id=>!id.startsWith('.')&&!id.startsWith('/'),onwarn(w){if(w.code!=='EMPTY_BUNDLE')process.stderr.write(w.message+'\n');}});
  await bundle.write({file:`${root}/public-declarations/${arm}/${entry}.d.ts`,format:'es'});await bundle.close();
  results[arm][entry]=createHash('sha256').update(readFileSync(`${root}/public-declarations/${arm}/${entry}.d.ts`)).digest('hex');
 }
}
results.equal=Object.keys(results.baseline).every(k=>results.baseline[k]===results.candidate[k]);
writeFileSync(`${root}/PUBLIC-BUNDLED-COMPARISON.json`,JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results));
