import {Session} from 'node:inspector';
import {appendFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {createHash} from 'node:crypto';
let session,active,failed=false;
const scripts=new Map();
const params={samplingInterval:32768,includeObjectsCollectedByMajorGC:true,includeObjectsCollectedByMinorGC:true};
const output=()=>dirname(process.env.ST_MEMORY_OUTPUT);
const record=x=>appendFileSync(join(output(),'protocol.jsonl'),JSON.stringify({...x,at:Date.now(),pid:process.pid})+'\n');
function call(method,args){
 let done=false,error,result;
 session.post(method,args,(e,r)=>{done=true;error=e;result=r;});
 if(!done){failed=true;throw Error('Inspector callback not synchronous: '+method);}
 if(error){failed=true;throw error;}
 return result;
}
export function start(stage){
 if(active)throw Error('Overlapping sampling');
 if(!session){session=new Session();session.connect();}
 record({kind:'start-request',stage,method:'HeapProfiler.startSampling',params,depth:128,boundaryGC:true,node:process.version,v8:process.versions.v8});
 call('HeapProfiler.startSampling',params);active=stage;
}
export function stop(stage){
 if(active!==stage)throw Error('Wrong sampling stage');
 const {profile}=call('HeapProfiler.stopSampling',{});active=undefined;
 if(!profile?.head||!Array.isArray(profile.samples))throw Error('Missing sampling profile');
 const raw=JSON.stringify(profile);
 if(profile.samples.length>100000||Buffer.byteLength(raw)>32*1024**2){record({kind:'profile-cap-failure',stage,samples:profile.samples.length,bytes:Buffer.byteLength(raw)});throw Error('Profile containment cap');}
 writeFileSync(join(output(),stage+'.heapprofile.json'),raw);
 const visit=node=>{if(node.callFrame?.scriptId)scripts.set(node.callFrame.scriptId,node.callFrame.url);for(const child of node.children??[])visit(child);};visit(profile.head);
 record({kind:'stop-result',stage,method:'HeapProfiler.stopSampling',synchronous:true,startSynchronous:true,samples:profile.samples.length,bytes:Buffer.byteLength(raw),sha256:createHash('sha256').update(raw).digest('hex'),inspectorBoundaryGC:true});
}
export function close(){
 if(!session)return;
 try{
  if(active){record({kind:'cleanup-active-profile',stage:active});try{call('HeapProfiler.stopSampling',{});}catch(e){record({kind:'cleanup-error',error:String(e)});}active=undefined;}
  if(failed)return;
  const parsed=new Map();session.on('Debugger.scriptParsed',({params:p})=>parsed.set(p.scriptId,p));
  call('Debugger.enable',{});
  const dir=join(output(),'generated-sources');mkdirSync(dir,{recursive:true});let total=0;const index=[];
  for(const [id,url] of scripts){
   const meta=parsed.get(id);const entry={id,url,meta};index.push(entry);
   if(!url?.includes('/packages/kernel/')){entry.mapping='not-candidate-package';continue;}
   try{
    const {scriptSource}=call('Debugger.getScriptSource',{scriptId:id});const bytes=Buffer.byteLength(scriptSource);
    if(bytes>2*1024**2||total+bytes>32*1024**2){entry.mapping='source-cap';continue;}
    total+=bytes;writeFileSync(join(dir,id+'.js'),scriptSource);entry.mapping='generated-source-preserved';entry.sha256=createHash('sha256').update(scriptSource).digest('hex');entry.bytes=bytes;
   }catch(e){entry.mapping='unavailable';entry.error=String(e);}
  }
  writeFileSync(join(output(),'SCRIPT-INDEX.json'),JSON.stringify(index,null,2));
  record({kind:'mapping-complete',scripts:index.length,bytes:total});
 }catch(e){record({kind:'mapping-or-cleanup-error',error:String(e)});}
 finally{session.disconnect();session=undefined;}
}
