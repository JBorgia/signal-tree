import assert from 'node:assert/strict';
import {writeHeapSnapshot} from 'node:v8';
import {writeFileSync} from 'node:fs';
import {quiesce} from '../lib/heap-quiescence.mjs';
const [mode,output]=process.argv.slice(2);
class DiagnosticLiveKey {}
class DiagnosticLiveValue {constructor(){this.payload=Array.from({length:8192},(_,i)=>i+1);}}
class DiagnosticLiveHolder {constructor(){this.key=new DiagnosticLiveKey();this.map=new WeakMap([[this.key,new DiagnosticLiveValue()]]);}}
class DiagnosticDeadKey {}
class DiagnosticDeadValue {constructor(){this.payload=Array.from({length:8192},(_,i)=>i+1);}}
class DiagnosticDeadHolder {constructor(){this.map=new WeakMap([[new DiagnosticDeadKey(),new DiagnosticDeadValue()]]);}}
class DiagnosticAliasKey {}
class DiagnosticAliasValue {constructor(){this.payload=Array.from({length:8192},(_,i)=>i+1);}}
class DiagnosticAliasHolder {constructor(){this.value=new DiagnosticAliasValue();this.map=new WeakMap([[new DiagnosticAliasKey(),this.value]]);}}
class DiagnosticWeakTarget {constructor(){this.payload=Array.from({length:8192},(_,i)=>i+1);}}
class DiagnosticWeakHolder {constructor(){this.ref=new WeakRef(new DiagnosticWeakTarget());}}
function build(){switch(mode){case'live':return new DiagnosticLiveHolder();case'dead':return new DiagnosticDeadHolder();case'liveValue':return new DiagnosticAliasHolder();case'weakRef':return new DiagnosticWeakHolder();default:throw new Error('Unknown control');}}
globalThis.__HEAP_CAL_ROOT__=build();
const memory=await quiesce({label:'actual weak control '+mode});
writeHeapSnapshot(output,{exposeInternals:true,exposeNumericValues:false});
if(mode==='live')assert.ok(globalThis.__HEAP_CAL_ROOT__.map.get(globalThis.__HEAP_CAL_ROOT__.key) instanceof DiagnosticLiveValue);
if(mode==='weakRef')assert.equal(globalThis.__HEAP_CAL_ROOT__.ref.deref(),undefined);
writeFileSync(output+'.json',JSON.stringify({node:process.version,mode,memory,output,envKeys:Object.keys(process.env).sort()})+'\n');
globalThis.__HEAP_CAL_ROOT__=undefined;
