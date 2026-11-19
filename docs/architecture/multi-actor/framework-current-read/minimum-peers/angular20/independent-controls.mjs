import {test} from 'node:test';
import assert from 'node:assert/strict';
import {signalTree,entityMap,transactions} from '@signal-tree/angular';
import {computed,signal} from '@angular/core';
const read=c=>c();
const write=(c,v)=>c.set(v);
const make=signal;

test('fresh native dependency error propagates exact sentinel and recovers inside real rollback tap',async()=>{
 const tree=signalTree({rows:entityMap()},{enhancers:[transactions()]});
 const rows=tree.$.rows;rows.setAll([{id:'A',n:1},{id:'C',n:3}]);
 const fault=make(false),sentinel=new Error('fresh dependency sentinel');
 const dependency=computed(()=>{if(read(fault))throw sentinel;return true;});
 let armed=false,calls=0;
 const stop=rows.tap({onRemove:id=>{if(!armed||id!=='D')return;calls++;
  const query=rows.where(()=>read(dependency));
  assert.equal(read(query).length,2);
  write(fault,true);assert.throws(()=>read(query),e=>e===sentinel);
  write(fault,false);assert.equal(read(query).length,2);
 }});
 try{const pending=tree.transact(()=>rows.addOne({id:'D',n:4}));await Promise.resolve();armed=true;pending.rollback();await Promise.resolve();assert.equal(calls,1);}finally{stop();tree.destroy();}
});

test('new native consumer born during callback ABA reaches final selection',async()=>{
 const tree=signalTree({rows:entityMap()},{enhancers:[transactions()]});
 const rows=tree.$.rows;rows.setAll([{id:'A',n:1},{id:'C',n:3}]);rows.setActiveId('A');
 let armed=false,calls=0,born;
 const stop=rows.tap({onRemove:id=>{if(!armed||id!=='D')return;calls++;
  const held=rows.activeId;
  assert.equal(read(held),'A');rows.setActiveId('C');assert.equal(read(held),'C');
  born=computed(()=>read(held));assert.equal(read(born),'C');
  rows.setActiveId('A');assert.equal(read(held),'A');
 }});
 try{const pending=tree.transact(()=>rows.addOne({id:'D',n:4}));await Promise.resolve();armed=true;pending.rollback();await Promise.resolve();assert.equal(calls,1);assert.ok(born);assert.equal(read(born),'A');}finally{stop();tree.destroy();}
});
