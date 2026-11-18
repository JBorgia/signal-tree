import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Session } from 'node:inspector/promises';
import { cpus, loadavg } from 'node:os';

const [packetArg,carrier,countArg,outArg,mode='timing'] = process.argv.slice(2);
const packetDir=resolve(packetArg),count=Number(countArg),out=resolve(outArg);
assert(!existsSync(out), 'Preserve prior attempts');
assert(['kernel', 'angular'].includes(carrier));
assert(['timing', 'profile'].includes(mode));
assert(Number.isSafeInteger(count) && count >= 4);
const packet=JSON.parse(readFileSync(join(packetDir,'packet.json'),'utf8'));
const sha=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
for(const [path,hash] of Object.entries(packet.bindings))assert.equal(sha(path),hash);
const {signalTree,entityMap,leaf,transactions,link}=await import(pathToFileURL(join(packetDir,carrier+'.mjs')));
const result={carrier,count,mode,node:process.version,cpu:cpus()[0]?.model,loadavg:loadavg(),command:process.argv,runnerSha256:sha(new URL(import.meta.url)),packetSha256:sha(join(packetDir,'packet.json')),artifacts:packet.artifacts,bundleSha256:sha(join(packetDir,carrier+'.mjs')),stages:[]};
const session=new Session();
if(mode==='profile'){session.connect();await session.post('Profiler.enable');await session.post('Profiler.setSamplingInterval',{interval:100});}
async function stage(name,body){
  if(mode==='profile')await session.post('Profiler.start');
  const begin=performance.now(),cpu=process.cpuUsage();
  const value=body();
  const wallMs=performance.now()-begin,used=process.cpuUsage(cpu);
  result.stages.push({name,wallMs,userUs:used.user,systemUs:used.system});
  if(mode==='profile'){const {profile}=await session.post('Profiler.stop');writeFileSync(out+'.'+name+'.cpuprofile',JSON.stringify(profile),{flag:'wx'});}
  return value;
}
let accepted,proposals,connection;
try{
  const rows=await stage('seed',()=>Array.from({length:count},(_,i)=>({id:`J-${i}`,instance:`initial-${i}`,title:`Inspect ${i%3===0?'pump':'valve'} ${i}`,owner:`Operator ${i%10}`,status:'queued',active:i%2===0,ownerRevision:10,statusRevision:10})));
  accepted=await stage('construct-accepted',()=>signalTree({jobs:entityMap({selectId:row=>row.id}),capacity:leaf({instance:'capacity-1',value:4,revision:10})}));
  await stage('populate',()=>accepted.$.jobs.setAll(rows.map(row=>({...row}))));
  // Verify useful complete population before first-demand timing. No .all()
  // here: count and explicit endpoint data are the declared prior demand.
  assert.equal(accepted.$.jobs.count(),count);
  assert.equal(accepted.$.jobs.byId(`J-${count-1}`)().owner,'Operator '+((count-1)%10));
  proposals=await stage('construct-proposals',()=>signalTree({commands:entityMap({selectId:row=>row.id})},{enhancers:[transactions()]}));
  const all=await stage('first-all',()=>accepted.$.jobs.all());
  assert.deepEqual(all,rows);
  await stage('point-update',()=>accepted.$.jobs.updateOne('J-0',{owner:'Changed'}));
  assert.equal(accepted.$.jobs.byId('J-0')().owner,'Changed');
  const sent=[];
  connection=await stage('late-link',()=>link(accepted.$.jobs,{set:value=>{sent.push(value);}}));
  await stage('post-link-update',()=>accepted.$.jobs.updateOne('J-0',{owner:'After link'}));
  for(let i=0;i<120;i++)await Promise.resolve();
  await connection.settled();
  assert.equal(sent.at(-1)?.length,count);
  assert.equal(sent.at(-1)?.[0].owner,'After link');
  await stage('destroy',()=>{connection.dispose();accepted.destroy();proposals.destroy();});
  result.passed=true;
}catch(error){result.passed=false;result.error=String(error.stack);process.exitCode=1;}
finally{connection?.dispose();accepted?.destroy();proposals?.destroy();if(mode==='profile')session.disconnect();writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});}
console.log(JSON.stringify(result));
