import assert from 'node:assert/strict';import {computed,watchEffect,effect,stop as stopEffect} from 'vue';import {createVueObservationAdapter} from '@proof/packages/vue/src/lib/vue-observation.ts';
const mode=process.argv[2]; const a=createVueObservationAdapter(); const disposers=[];let result={mode};
function cell(initial){let value=initial;const x=a.createWritableCell(()=>value);return{read:x.cell,write(v){value=v;x.token.invalidate();}};}
try{
if(mode==='readonly'||mode==='primed'){
const x=cell(0),y=cell(0);const held=y.read.asReadonly();assert.equal(held(),0);const seen=[];
const untrackedPrime=a.createReadonlyCell(()=>y.read()*10);assert.equal(untrackedPrime(),0);
disposers.push(watchEffect(()=>{const value=x.read();if(value===1||mode==='readonly')seen.push([value,held(),untrackedPrime()]);},{flush:'sync'}));
a.runInvalidationGroup(()=>{x.write(1);y.write(1);assert.equal(held(),0);assert.equal(untrackedPrime(),0);});
assert.ok(seen.filter(x=>x[0]===1).every(x=>x[1]===1&&x[2]===10));result.seen=seen;
}
if(mode==='dynamic'){
const choose=cell(true),x=cell(1),y=cell(2);let calls=0;const selected=a.createReadonlyCell(()=>{calls++;return{v:choose.read()?x.read():y.read()};});const values=[];
disposers.push(watchEffect(()=>values.push(selected()),{flush:'sync'}));
a.runInvalidationGroup(()=>{choose.write(false);y.write(3);});const saved=selected(),before=calls,n=values.length;x.write(8);assert.equal(calls,before);assert.equal(values.length,n);assert.strictEqual(selected(),saved);y.write(4);assert.equal(selected().v,4);result={mode,calls,values};
}
if(mode==='errors'){
const x=a.createToken(),y=a.createToken();let xRuns=0,yRuns=0,armed=false;const marker=new Error('observer');const first=effect(()=>{x.observe();xRuns++;if(armed)throw marker;});const second=effect(()=>{y.observe();yRuns++;});disposers.push(()=>stopEffect(first),()=>stopEffect(second));armed=true;let caught;try{a.runInvalidationGroup(()=>{x.invalidate();y.invalidate();});}catch(e){caught=e;}assert.strictEqual(caught,marker);assert.equal(yRuns,2);armed=false;x.invalidate();y.invalidate();assert.equal(yRuns,3);result={mode,xRuns,yRuns};
}
if(mode==='writable-token'){let value=0;const binding=a.createWritableCell(()=>value);let runs=0;const e=effect(()=>{binding.token.observe();runs++;});disposers.push(()=>stopEffect(e));value=1;binding.token.invalidate();assert.equal(runs,2);result={mode,runs};}
if(mode==='body-error'){
const x=a.createToken(),y=a.createToken();let runs=[0,0];disposers.push(watchEffect(()=>{x.observe();runs[0]++;},{flush:'sync'}),watchEffect(()=>{y.observe();runs[1]++;},{flush:'sync'}));let threw=false;try{a.runInvalidationGroup(()=>{x.invalidate();y.invalidate();throw undefined;});}catch(e){threw=true;assert.strictEqual(e,undefined);}assert.ok(threw);assert.deepEqual(runs,[2,2]);result={mode,runs};
}
if(mode==='reentry'){
const x=cell(0),y=cell(0);const owned=a.createReadonlyCell(()=>y.read());owned();let nested=false,seen=[];
disposers.push(watchEffect(()=>{let n=x.read();if(n===1&&!nested){nested=true;const before=owned();a.runInvalidationGroup(()=>{x.write(2);y.write(2);assert.equal(owned(),before);});}},{flush:'sync'}));
disposers.push(watchEffect(()=>seen.push([x.read(),owned()]),{flush:'sync'}));a.runInvalidationGroup(()=>{x.write(1);y.write(1);});assert.ok(nested);assert.ok(seen.every(([x,y])=>x===y));assert.equal(owned(),2);result={mode,seen};
}
result.status='pass';
}catch(e){result={...result,status:'fail',error:e.stack};process.exitCode=1;}finally{for(const f of disposers)f();}console.log(JSON.stringify(result));
