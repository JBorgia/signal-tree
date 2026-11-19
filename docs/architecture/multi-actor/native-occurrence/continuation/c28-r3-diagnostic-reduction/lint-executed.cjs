const {spawnSync}=require('node:child_process');
const path=require('node:path'),fs=require('node:fs');
function binary(pkg,key){const manifest=require.resolve(pkg+'/package.json');const p=JSON.parse(fs.readFileSync(manifest));return path.resolve(path.dirname(manifest),typeof p.bin==='string'?p.bin:p.bin[key]);}
const calls=[[binary('nx','nx'),'graph','--file='+path.join(process.env.TMPDIR,'project-graph.json')],[binary('eslint','eslint'),'packages/kernel/src/lib/entity-signal.ts','packages/kernel/src/lib/constants.ts','packages/kernel/src/lib/internals/predicate-churn-warning.ts','packages/kernel/src/lib/entity-diagnostic-folding.spec.ts']];
for(const args of calls){console.log('COMMAND',JSON.stringify([process.execPath,...args]));const r=spawnSync(process.execPath,args,{stdio:'inherit',env:process.env});if(r.error)throw r.error;if(r.status!==0)process.exit(r.status||1);}
