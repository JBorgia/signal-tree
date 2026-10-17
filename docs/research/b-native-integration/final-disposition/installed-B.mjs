import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const pkg=process.argv[2];
const load=path=>import(pathToFileURL(`${pkg}/dist/${path}.js`));
const {signalTree,entityMap,transactions}=await load('index');
const {installNativeOwnershipPublicExperiment:install}=await load('enhancers/transactions/native-ownership-public-experiment');
const {peekInternalTransactionRuntime:peek}=await load('enhancers/transactions/transactions');
const {withWriteContext}=await load('lib/write-context');
const results=[];
const make=()=>{const t=signalTree({n:0,rows:entityMap()},{enhancers:[Object.assign(t=>install(t),transactions())]});assert.equal(peek(t),undefined);return t;};
for(const count of [8,128]){
 const t=make();try {
 const held=[],subjects=[];
 for(let n=0;n<count;n++){t.$.rows.addOne({id:'A',n});held.push(t.$.rows.byIdOrFail('A'));subjects.push(t.$.rows.__acquireEntityHandleForTesting('A').subjectId);t.$.rows.removeOne('A');}
 await new Promise(r=>setTimeout(r,0));await new Promise(r=>setImmediate(r));
 assert.deepEqual(t.$.rows.__listSubjectReclamationCandidates(),[]);
 for(const s of subjects)assert.equal(t.$.rows.__inspectSubjectResources(s),undefined);
 t.$.rows.addOne({id:'A',n:999});assert.ok(held.every(r=>r()===undefined));assert.equal(t.$.rows.byIdOrFail('A')().n,999);
 results.push({case:'ordinary-held-churn',count,status:'pass'});
 }finally{t.destroy();}
}
{
 const t=make();try{const a=t.transact(()=>t.$.n(1)),b=t.transact(()=>t.$.n(2));a.rollback();assert.equal(t.$.n(),2);b.rollback();assert.equal(t.$.n(),0);results.push({case:'overlap',status:'pass'});}finally{t.destroy();}
}
{
 const t=make();try{const p=t.transact(()=>{t.$.rows.addOne({id:'A',n:0});withWriteContext({intent:'system',origin:'devtools',participation:'inspection'},()=>t.$.n(42));});p.rollback();const actual={n:t.$.n(),ids:t.$.rows.ids()};results.push({case:'inspection-participation',expected:{n:42,ids:[]},actual,status:actual.n===42?'pass':'fail'});}finally{t.destroy();}
}
console.log(JSON.stringify({pkg,activation:'B installer from installed package private module; incumbent absent; not a public export',results},null,2));
if(results.some(r=>r.status==='fail'))process.exitCode=1;
