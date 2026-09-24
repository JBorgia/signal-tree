// SECOND preregistered batch: added after first model results exposed blind spots.
// Original batch/hashes and first results remain unchanged.
import {assert,set,value,entity,settled,snap} from './assertions.mjs';
export const cases=[
 {id:'E06-newer-correlated-accept-preserves-local-precedence',family:'authority',profiles:['live'],run(c){
   const p1=c.begin([set('x',1)]),p2=c.begin([set('x',2)]);
   settled(c.authority({ops:[set('x',20)],order:{kind:'versioned',revision:10},settlements:[{kind:'accepts',id:p2}]}));
   assert.equal(value(c.canonical(),'x'),20);assert.equal(c.state(p1).authority,true);assert.equal(c.state(p2).authority,false);
   assert.equal(value(c.read(),'x'),20,'accepted newer contribution must not reveal older pending truth');
   settled(c.accept(p1));assert.equal(value(c.read(),'x'),20,'older acceptance must not erase the authoritative result of newer work');
 }},
 {id:'E01-literal-path-versus-nested-through-settlement',family:'identity',profiles:['live'],run(c){
   settled(c.write([set(['a.b'],0),set(['a','b'],0)],{context:'local'}));
   const p=c.begin([set(['a.b'],1)]);
   settled(c.write([set(['a','b'],2)],{context:'local'}));
   settled(c.reject(p));assert.equal(value(c.read(),['a.b']),0);assert.equal(value(c.read(),['a','b']),2);
 }},
 {id:'E02-held-retired-lifetime-write-never-retargets',family:'identity',profiles:['live','draft'],run(c){
   settled(c.write([{kind:'remove',ref:'original'},{kind:'add',ref:'replacement',key:'A',fields:{name:'Replacement',priority:0}}],{context:'local'}));
   const before=snap(c.read());
   const result=c.write([{kind:'field',ref:'original',field:'name',value:'WRONG LIFETIME'}],{context:'local'});
   assert.ok(['settled','refused'].includes(result.status));assert.equal(snap(c.read()),before);assert.equal(entity(c.read(),'replacement').fields.name,'Replacement');
 }},
 {id:'E03-deferred-authorship-is-enqueue-not-flush',family:'context',profiles:['live'],run(c){
   settled(c.write([set('x',1)],{context:'local',defer:true}));
   settled(c.write([set('x',2)],{context:'local'}));c.flush();assert.equal(value(c.read(),'x'),2);
 }},
 {id:'E04-terminal-entity-churn-bounded',family:'retention',profiles:['live','draft'],run(c){
   const before=c.stats().retainedOperations;
   for(let i=0;i<128;i++){const ref=`churn-${i}`;settled(c.write([{kind:'add',ref,key:'temp',fields:{name:'payload',priority:1}}],{context:'local'}));settled(c.write([{kind:'remove',ref}],{context:'local'}));}
   assert.equal(c.stats().active,0);assert.ok(c.stats().retainedOperations<=before+8,'terminal entity correctness records grow without live obligation');
 }},
 {id:'E05-long-pending-successor-compaction',family:'retention',profiles:['live'],run(c){
   const before=c.stats().retainedOperations,p=c.begin([set('x',1)]);
   for(let i=2;i<=129;i++){const q=c.begin([set('x',i)]);settled(c.accept(q));}
   assert.ok(c.stats().retainedOperations<=before+8,'obsolete terminal successors retained behind one pending predecessor');
   settled(c.reject(p));assert.equal(value(c.read(),'x'),129);
 }},
];
