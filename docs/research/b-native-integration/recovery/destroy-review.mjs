import assert from 'node:assert/strict';
const {createStore}=await import(process.argv[2]??'./arm-b.mjs');
const s=createStore();const original=new Error('original');let thrown;
try{s.begin(()=>{s.write('x',1);s.destroy();throw original;});}catch(error){thrown=error;}
console.log(JSON.stringify({thrown:String(thrown),recovery:!!thrown?.recovery,owners:s.stats().retainedOwners}));
assert.equal(thrown?.recovery,undefined,'Destroyed tree must not offer unusable authority');
assert.equal(s.stats().retainedOwners,0);
