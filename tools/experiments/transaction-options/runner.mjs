import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
const errorText = e => String(e?.stack??e).replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g,'<frozen-source-bundle>');

export async function runCases(create,cases,{profile='live',diagnostics=false}={}) {
  const results=[];
  for(const test of cases) {
    if(!test.profiles.includes(profile)) {results.push({id:test.id,family:test.family,status:'profile-mismatch'});continue;}
    let c;let result={id:test.id,family:test.family,status:'passed'};
    const started=performance.now();
    try{c=await create({profile,diagnostics,...test.options});await test.run(c);}
    catch(e){result.status=e?.name==='Unsupported'?'unsupported':e?.code==='ERR_ASSERTION'?'failed':'error';result.message=errorText(e);}
    finally{if(c)try{await c.destroy();}catch(e){result.status='error';result.cleanupError=errorText(e);}}
    result.ms=performance.now()-started;results.push(result);
  }
  const totals={passed:0,failed:0,error:0,unsupported:0,'profile-mismatch':0};
  for(const r of results)totals[r.status]++;
  return {profile,totals,results};
}
export function exitFor(report,{allowUnsupported=false}={}) {return report.totals.error||report.totals.failed||(!allowUnsupported&&report.totals.unsupported)?1:0;}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const args=process.argv.slice(2),candidate=args[0];
  if(!candidate){console.error('node runner.mjs ./candidate.mjs [--profile=draft] [--out=/tmp/result.json] [--family=scalar]');process.exitCode=2;}
  else try{
    const {create}=await import(pathToFileURL(resolve(candidate)).href);
    let cases=(await Promise.all(['scalar','structural','composition'].map(n=>import(new URL(`./${n}-cases.mjs`,import.meta.url))))).flatMap(m=>m.cases);
    const family=args.find(a=>a.startsWith('--family='))?.slice(9);if(family)cases=cases.filter(t=>t.family===family);
    if(!cases.length)throw Error('No test cases selected');
    if(new Set(cases.map(c=>c.id)).size!==cases.length)throw Error('Duplicate test IDs');
    const report=await runCases(create,cases,{profile:args.find(a=>a.startsWith('--profile='))?.slice(10)??'live'});
    report.runtime={node:process.version,v8:process.versions.v8,platform:process.platform,arch:process.arch};
    const out=args.find(a=>a.startsWith('--out='))?.slice(6);if(out)writeFileSync(out,JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({candidate,profile:report.profile,totals:report.totals,out}));
    process.exitCode=exitFor(report);
  }catch(e){console.error(e);process.exitCode=2;}
}
