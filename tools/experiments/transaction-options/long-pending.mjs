import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const {create}=await import(pathToFileURL(resolve(process.argv[2])).href);
const count=Number(process.argv[3]??1000),c=await create({profile:'live'});
const set=n=>({kind:'set',path:['x'],value:n});
try{
 const p=c.begin([set(1)]),start=performance.now();
 for(let i=2;i<count+2;i++){const q=c.begin([set(i)]);const r=c.accept(q);if(r.status!=='settled')throw Error(`accept ${r.status}`);}
 const ms=performance.now()-start,open=c.stats(),visible=c.read();
 const startReject=performance.now(),result=c.reject(p),rejectMs=performance.now()-startReject;
 console.log(JSON.stringify({candidate:process.argv[2],count,ms,rejectMs,result,open,after:c.stats(),visible,final:c.read(),node:process.version,platform:process.platform,arch:process.arch}));
}finally{c.destroy();}
