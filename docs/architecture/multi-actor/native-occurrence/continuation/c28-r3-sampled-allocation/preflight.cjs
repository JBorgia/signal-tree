const {Session}=require('node:inspector');
const {writeFileSync}=require('node:fs');
const session=new Session();session.connect();const events=[];
const params={samplingInterval:32768,includeObjectsCollectedByMajorGC:true,includeObjectsCollectedByMinorGC:true};
function call(method,args){let done=false,error,result;session.post(method,args,(e,r)=>{done=true;error=e;result=r;});events.push({method,args,synchronous:done,error:error?.message});if(!done)throw Error('Non-synchronous '+method);if(error)throw error;return result;}
try{call('HeapProfiler.startSampling',params);const r=call('HeapProfiler.stopSampling',{});if(!r.profile?.head||!Array.isArray(r.profile.samples))throw Error('Invalid sampling profile');writeFileSync(__dirname+'/preflight-profile.json',JSON.stringify(r.profile));events.push({samples:r.profile.samples.length,node:process.version,v8:process.versions.v8,execArgv:process.execArgv,NODE_OPTIONS:process.env.NODE_OPTIONS??null,depth:128,depthSource:'pinned implementation',manualGC:false});}
finally{session.disconnect();writeFileSync(__dirname+'/PREFLIGHT.json',JSON.stringify(events,null,2)+'\n');}
