import assert from 'node:assert/strict';
import {runCases,exitFor} from './runner.mjs';
let cleaned=0;
const tests=[
 {id:'pass',family:'infrastructure',profiles:['live'],run:()=>{}},
 {id:'assert',family:'infrastructure',profiles:['live'],run:()=>assert.equal(1,2)},
 {id:'throw',family:'infrastructure',profiles:['live'],run:()=>{throw Error('broken implementation');}},
 {id:'unsupported',family:'infrastructure',profiles:['live'],run:()=>{const e=Error('no canonical authority');e.name='Unsupported';throw e;}},
 {id:'mismatch',family:'infrastructure',profiles:['draft'],run:()=>{throw Error('must not run');}},
];
const report=await runCases(()=>({destroy(){cleaned++;}}),tests);
assert.deepEqual(report.totals,{passed:1,failed:1,error:1,unsupported:1,'profile-mismatch':1});
assert.equal(cleaned,4);assert.equal(exitFor(report),1);
const broken=await runCases(()=>{throw Error('constructor failed');},tests.slice(0,3));
assert.equal(broken.totals.error,3);assert.equal(exitFor(broken),1);
const cleanup=await runCases(()=>({destroy(){throw Error('cleanup failed');}}),tests.slice(0,1));
assert.equal(cleanup.totals.error,1);assert.equal(exitFor(cleanup),1);
const unknown=await runCases(()=>({destroy(){}}),tests.slice(3,4));
assert.equal(exitFor(unknown),1);assert.equal(exitFor(unknown,{allowUnsupported:true}),0);
console.log('runner-selftest: status separation, all-constructor-failure, cleanup failure, strict unsupported exit: PASS');
