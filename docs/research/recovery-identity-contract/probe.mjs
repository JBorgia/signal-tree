import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const repo=process.env.SIGNAL_TREE_CONTROL_REPO??'/private/tmp/st-sparse-integration-baseline-8d220643';
const root=`${repo}/dist/packages/kernel/dist`;
globalThis.ngDevMode=false;
const k=await import(pathToFileURL(`${root}/index.js`));
const {getTreeRealizationPort}=await import(pathToFileURL(`${root}/lib/internals/causal-runtime/tree-realization-adapter.js`));
const {transactionLifecycleReader}=await import(pathToFileURL(`${root}/internals.js`));
const values=()=>[
 ['occupied',Object.defineProperty(new Error('original'),'recovery',{value:'occupied',configurable:false})],
 ['frozen',Object.freeze(new Error('original'))],['undefined',undefined],['null',null],['string','original'],['number',7],['symbol',Symbol('original')]
];
const flush=async()=>{await Promise.resolve();await Promise.resolve();};
for(const [name,original] of values())for(const fail of [false,true]){
 const tree=k.signalTree({count:0,rows:k.entityMap({selectId:r=>r.id})},{enhancers:[k.transactions()]});
 tree.$.rows.addOne({id:'b',name:'Base'});await flush();
 const port=getTreeRealizationPort(tree.$);assert.equal(typeof port?.validateEffects,'function');
 const validate=port.validateEffects;
 if(fail)port.validateEffects=()=>({kind:'structural-drift'});
 let caught=false,thrown;
 try{tree.transact(()=>{tree.$.count(1);tree.$.rows.removeOne('b');throw original;});}catch(e){caught=true;thrown=e;}
 assert.ok(caught);const lifecycle=transactionLifecycleReader(tree);
 if(!fail){assert.ok(Object.is(thrown,original));assert.equal(tree.$.count(),0);assert.deepEqual(tree.$.rows.ids(),['b']);assert.equal(lifecycle.snapshot().pending.length,0);}
 else{
  assert.ok(thrown instanceof k.SignalTreeRollbackError);assert.notEqual(thrown,original);
  const recovery=thrown.recovery;assert.ok(recovery);assert.equal(recovery.callbackFailed,true);assert.ok(Object.is(recovery.callbackError,original));
  assert.equal(lifecycle.snapshot().pending.length,1);assert.equal(tree.$.count(),1);assert.deepEqual(tree.$.rows.ids(),[]);assert.ok(recovery.transaction.inspect().changes.length>0);
  for(let n=0;n<2;n++){assert.throws(()=>recovery.transaction.rollback(),k.SignalTreeRollbackError);assert.equal(lifecycle.snapshot().pending.length,1);assert.equal(tree.$.count(),1);}
  port.validateEffects=validate;recovery.transaction.rollback();assert.equal(tree.$.count(),0);assert.deepEqual(tree.$.rows.ids(),['b']);assert.equal(lifecycle.snapshot().pending.length,0);
  recovery.transaction.rollback();assert.equal(tree.$.count(),0);assert.equal(lifecycle.snapshot().pending.length,0);
 }
 console.log(JSON.stringify({target:'exact8d',name,abortFailed:fail,topLevelOriginal:Object.is(thrown,original),callbackEvidenceOriginal:fail?Object.is(thrown.recovery.callbackError,original):null,recoveryRetried:fail,result:'pass'}));
 port.validateEffects=validate;tree.destroy();
}
let modelFailures=0;
const models=process.env.SLICE_DIR??'/Users/jonathanborgia/.codex/worktrees/sparse-ownership-integration/signaltree/docs/research/authority-vertical-slice';
for(const arm of ['a','b'])for(const [name,original] of values()){
 const {createStore}=await import(pathToFileURL(`${models}/arm-${arm}.mjs`));const s=createStore();s.write('x',0);let thrown,caught=false;
 try{s.begin(()=>{s.write('x',1);s.failNextPreparation(new Error('abort'));throw original;});}catch(e){caught=true;thrown=e;}
 const handle=thrown?.recovery;const accessible=typeof handle?.reject==='function';
 const record={target:arm,name,caught,topLevelOriginal:Object.is(thrown,original),accessible,visible:s.read('x'),stats:s.stats(),thrown:String(thrown)};
 if(accessible){handle.reject();record.after=s.read('x');handle.reject();record.repeated=s.read('x');}
 try{assert.ok(Object.is(thrown,original),'Exact top-level callback identity');assert.ok(accessible,'Failed-abort recovery must be publicly accessible');assert.deepEqual(record.after,{present:true,value:0});assert.deepEqual(record.repeated,record.after);record.contract='pass';}catch(error){record.contract='fail';record.assertion=error.message;modelFailures++;}
 console.log(JSON.stringify(record));s.destroy();
}

process.exitCode=modelFailures?1:0;
