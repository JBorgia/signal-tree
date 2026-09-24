import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {runCases} from './runner.mjs';
import {mutateFactory,mutationIds} from './mutations.mjs';
const [candidate,out]=process.argv.slice(2);
if(!candidate)throw Error('Pass candidate path and optional output JSON');
const {create}=await import(pathToFileURL(resolve(candidate)).href);
const cases=(await Promise.all(['scalar','structural','composition'].map(n=>import(new URL(`./${n}-cases.mjs`,import.meta.url))))).flatMap(m=>m.cases);
const baseline=await runCases(create,cases);
const passed=new Set(baseline.results.filter(r=>r.status==='passed').map(r=>r.id));
const results=[];
for(const mutation of mutationIds){
 const selected=cases.filter(c=>passed.has(c.id)&&(mutation==='M22'||!c.id.startsWith('R01')&&!c.id.startsWith('R02')));
 const report=await runCases(mutateFactory(create,mutation),selected);
 const killed=report.results.filter(r=>r.status==='failed');
 results.push({mutation,status:killed.length?'killed':'unproven',assertionKills:killed.map(r=>r.id),errors:report.totals.error,unsupported:report.totals.unsupported});
 console.log(`${mutation}: ${killed.length?'KILLED':'UNPROVEN'} assertionKills=${killed.length} errors=${report.totals.error}`);
}
const report={candidate,scope:'semantic-boundary mutations; not production source mutation proof',baseline:baseline.totals,results};
if(out)writeFileSync(out,JSON.stringify(report,null,2)+'\n');
process.exitCode=results.some(r=>r.status!=='killed'||r.errors)?1:0;
