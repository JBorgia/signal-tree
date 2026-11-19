import assert from 'node:assert/strict';
import * as Kernel from '@signal-tree/kernel';
import * as Angular from '@signal-tree/angular';
import * as React from '@signal-tree/react';
import * as Vue from '@signal-tree/vue';
import * as Solid from '@signal-tree/solid';
const results=[];
for(const [name,api] of Object.entries({Kernel,Angular,React,Vue,Solid})) {
 assert.equal(api.SignalTreePublicationError,Kernel.SignalTreePublicationError,`${name}: same class export`);
 const tree=api.signalTree({x:0});
 const connection=api.link(tree.$.x,{set:()=>{throw new Error('unexpected endpoint start');}});
 try {
  assert.deepEqual(Object.keys(connection).sort(),['declare','dispose','retrieve','settled']);
  const receipt=connection.declare({kind:'independent'},()=>{});
  assert.deepEqual(receipt.read(),{state:'no-write'});assert.ok(Object.isFrozen(receipt));assert.ok(Object.isFrozen(receipt.read()));
  connection.dispose();let called=false;let caught;
  try{connection.declare({kind:'independent'},()=>{called=true;});}catch(error){caught=error;}
  assert.equal(called,false);assert.ok(caught instanceof Kernel.SignalTreePublicationError);assert.equal(caught.constructor,api.SignalTreePublicationError);
  assert.equal(caught.code,'SIGNALTREE_PUBLICATION_DECLARATION_INVALID');assert.equal(caught.stage,'before-callback');assert.equal(caught.reason,'disposed');
  results.push({name,sharedClass:true,actualError:true,receipt:'no-write',keys:Object.keys(connection).sort()});
 } finally {connection.dispose();tree.destroy();}
}
console.log(JSON.stringify({scope:'Packed public surface and shared class identity only, not runtime safety qualification',results},null,2));
