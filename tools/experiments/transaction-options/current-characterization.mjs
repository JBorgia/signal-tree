// Source-library controls that require no invented canonical/disposition reader.
import {writeFileSync} from 'node:fs';
import {create} from './current.mjs';
import {runCases} from './runner.mjs';
import {assert,set,value,settled} from './assertions.mjs';
const cases=[];
const test=(id,run)=>cases.push({id,family:'current-public-behavior',profiles:['live'],run});
test('clean-single-rollback',c=>{const p=c.begin([set('x',1)]);c.flush();settled(c.reject(p));assert.equal(value(c.read(),'x'),0);});
test('R6-refused-rollback-retains-same-authority',c=>{
 const p=c.begin([set('x',1),{kind:'remove',ref:'original'}]);c.flush();
 c.write([{kind:'add',ref:'replacement',key:'A',fields:{name:'Replacement',priority:0}}],{context:'local'});c.flush();
 assert.equal(c.reject(p).status,'refused');assert.equal(value(c.read(),'x'),1);assert.equal(c.state(p).authority,true);
});
for(const order of [[0,1],[1,0]])for(const methods of [['accept','accept'],['accept','reject'],['reject','accept'],['reject','reject']]){
 const id=`R8-${order.join('')}-${methods.join('-')}`;
 test(id,c=>{
   const ps=[c.begin([set('x',1),set('y',1)])];c.flush();ps.push(c.begin([set('y',2),set('z',2)]));c.flush();
   const status=['pending','pending'];
   for(const index of order){settled(c[methods[index]](ps[index]));status[index]=methods[index];
     const survives=i=>status[i]!=='reject';
     assert.equal(value(c.read(),'x'),survives(0)?1:0);
     assert.equal(value(c.read(),'y'),survives(1)?2:survives(0)?1:0);
     assert.equal(value(c.read(),'z'),survives(1)?2:0);
   }
 });
}
for(const context of ['local','external'])for(const flush of [false,true])test(`same-tick-${context}-flush-${flush}`,c=>{
 const p=c.begin([set('x',1)]);c.flush();c.write([set('x',2)],{context});if(flush)c.flush();
 settled(c.reject(p));assert.equal(value(c.read(),'x'),2);
});
const report=await runCases(create,cases);console.log(JSON.stringify(report.totals));
const out=process.argv[2];if(out)writeFileSync(out,JSON.stringify(report,null,2)+'\n');
process.exitCode=report.totals.failed||report.totals.error||report.totals.unsupported?1:0;
