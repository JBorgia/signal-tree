import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const candidate=process.argv[2],profile=process.argv[3]??'live';
const {create}=await import(pathToFileURL(resolve(candidate)).href);
const c=await create({profile});
const set=(name,value)=>({kind:'set',path:[name],value});
const steps=[];
try{
 const record=(step,p,result)=>steps.push({step,result,live:c.read(),canonical:c.canonical(),review:p?(profile==='draft'?c.draft(p):c.read()):undefined,state:p?c.state(p):undefined});
 record('initial');
 const p=c.begin([set('x',3),set('y',1)]);record('agent proposes priority=3, assignee=Ada',p);
 c.write([set('y',2)],{context:'local'});record('human changes assignee to Grace',p);
 const result=c.accept(p);record('accept agent operation',undefined,result);
 steps.push({step:'final-handle',state:c.state(p)});
 console.log(JSON.stringify({candidate,profile,domain:{x:'priority',y:'assignee (0 none, 1 Ada, 2 Grace)',z:'unchanged'},steps},null,2));
}finally{c.destroy();}
