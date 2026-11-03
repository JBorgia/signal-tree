import fs from 'node:fs';import {spawnSync} from 'node:child_process';import path from 'node:path';
const base=path.dirname(new URL(import.meta.url).pathname);
const arms={incumbent:'/private/tmp/st-new-key-cost-20261018/incumbent/dist/packages/kernel/dist',candidate:'/private/tmp/st-new-key-cost-20261018/shared/dist/packages/kernel/dist'};
const profiles=[['bare',0],['empty',0],['construction',100],['overlap',100],['refusal',100],['heap-empty',0]];
for(const n of [100,1000,10000])for(const kind of ['point','projection','churn','confirm','rollback','heap-populated','heap-pending'])profiles.push([kind,n]);
const preflight=process.argv.includes('--preflight'), output=path.join(base,preflight?'preflight-v2':'heap-v2');fs.mkdirSync(output,{recursive:true});
let failures=0;
for(const [kind,n] of profiles.filter(([kind])=>kind.startsWith('heap'))){let failed=false;
 const runs=preflight?[['incumbent','smoke'],['candidate','smoke']]:[['incumbent','aa0'],['incumbent','aa1'],...Array.from({length:5},(_,i)=>(i%2?['candidate','incumbent']:['incumbent','candidate']).map(a=>[a,'sample'+i])).flat()];
 for(const [arm,label] of runs){const file=path.join(output,`${kind}-${n}-${arm}-${label}`);if(fs.existsSync(file+'.json')||fs.existsSync(file+'.failure.txt'))throw Error('Refusing overwrite '+file);
 const p=spawnSync(process.execPath,['--expose-gc',path.join(base,'child-heap-v2.mjs'),arms[arm],kind,String(n)],{encoding:'utf8',timeout:180000});
 if(p.status!==0){fs.writeFileSync(file+'.failure.txt',JSON.stringify({status:p.status,error:p.error?.message,stdout:p.stdout,stderr:p.stderr},null,2));failures++;failed=true;console.log('FAIL',kind,n,arm,label);}
 else{fs.writeFileSync(file+'.json',p.stdout);if(p.stderr)fs.writeFileSync(file+'.stderr',p.stderr);}
 }
 console.log('DONE',kind,n,failed?'with failures':'');
}console.log('Failures',failures);process.exitCode=failures?1:0;
