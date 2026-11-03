import {expect,it} from 'vitest';
import '../index';
import {EntityPublicationSource,withEntityPointPublicationPreparation,entityPublicationOrdinary,type EntityPublicationEdit as Edit,type EntityPublicationPacket as Packet} from './internals/entity-publication';
import {installTerminalRecord,type PreparedPublicationUnit} from './internals/intrinsic-mutation';
import type {NativeFieldEndpoint} from './internals/native-field-selection';
import {initialRequirement,nativeProof,type NativeRequirement} from './experimental-publication/lifecycle';
const edit=(subject:number,x:number|undefined):Edit=>Object.freeze({subject,before:undefined,after:x===undefined?undefined:Object.freeze({x}),fields:Object.freeze(['x'])});
const removal=(subject:number):Edit=>Object.freeze({...edit(subject,undefined),structural:Object.freeze({kind:'remove' as const,subject})});
const packet=(ordinary:readonly Edit[],extra:Partial<Packet>={}):Packet=>Object.freeze({owner:1,id:{},meta:undefined,ordinary:Object.freeze([...ordinary]),physical:Object.freeze([...ordinary]),...extra});
const install=(s:EntityPublicationSource,p:Packet)=>{const u=s.prepare(p);if(!u)throw Error('missing native preparation');u.finalize?.();installTerminalRecord(u.record);s.complete(u.completion);return u;};
const before=(s:EntityPublicationSource,id=1):NativeFieldEndpoint=>{let result:NativeFieldEndpoint|undefined;install(s,packet([],{prepareResponsibility:selection=>{result=selection!.before(id,'x');return undefined;}}));if(!result)throw Error('missing endpoint');return result;};

it('ordered steps override fallback edits, duplicate subject uses last edit, responsibility installs atomically',()=>{
 const s=new EntityPublicationSource();const installed=new Map<unknown,unknown>();const a=edit(1,7),b=edit(2,3),c=edit(1,11);let calls=0;
 try{const p=packet([edit(1,99)],{physical:[a,b,c],steps:Object.freeze([{ordinal:0,ordinary:[a,b],physical:[a,b]},{ordinal:1,ordinary:[c],physical:[c]}]),prepareResponsibility:selection=>{calls++;expect(selection!.proposed(1,'x').value).toBe(11);expect(selection!.proposed(2,'x').value).toBe(3);expect(selection!.before(1,'x').present).toBe(false);expect(s.inspect().rows).toBe(0);return {writes:[{map:installed,key:'responsibility',value:11}],adds:[]};}});
 const u=s.prepare(p)!;expect(calls).toBe(1);expect(installed.size).toBe(0);expect(s.inspect().rows).toBe(0);u.finalize?.();installTerminalRecord(u.record);s.complete(u.completion);expect(installed.get('responsibility')).toBe(11);expect(before(s).value).toBe(11);expect(before(s,2).value).toBe(3);
 }finally{s.dispose();}
});

for(const duplicate of [false,true])it(`authored removal preserves last absent endpoint, duplicate=${duplicate}`,()=>{
 const s=new EntityPublicationSource();const a=edit(1,7),r=removal(1);let proposed:NativeFieldEndpoint|undefined;
 try{const p=packet([a],{physical:[a,r],steps:[{ordinal:0,ordinary:[a],physical:[a]},{ordinal:1,ordinary:duplicate?[r]:[],authoredRemoval:r,physical:[r]}],prepareResponsibility:selection=>{proposed=selection!.proposed(1,'x');return undefined;}});
 expect(entityPublicationOrdinary(p)).toEqual([a,r]);install(s,p);expect(proposed).toMatchObject({present:false,value:undefined});expect(s.inspect().negativePresence).toBe(1);expect(s.inspect().rows).toBe(0);
 }finally{s.dispose();}
});

it('remove followed by restored same subject preserves final endpoint and per-edit restoredFields precedence',()=>{
 const s=new EntityPublicationSource();const r=removal(1);const restored=Object.freeze({present:true,value:5,requirement:initialRequirement()});const selected=Object.freeze({present:true,value:8,requirement:initialRequirement()});
 const add:Edit=Object.freeze({...edit(1,11),structural:Object.freeze({kind:'add' as const,subject:1}),restoredFields:new Map([['x',restored]])});
 try{install(s,packet([r,add],{steps:[{ordinal:0,ordinary:[r],physical:[r]},{ordinal:1,ordinary:[add],physical:[add]}],prepareResponsibility:selection=>{expect(selection!.proposed(1,'x').value).toBe(11);selection!.choose(1,'x',selected);return undefined;}}));expect(before(s)).toBe(restored);expect(s.inspect().negativePresence).toBe(0);
 }finally{s.dispose();}
});

it('selection overrides proposal when no restored endpoint, including absent field',()=>{
 const s=new EntityPublicationSource();const endpoint=Object.freeze({present:false,value:undefined,requirement:initialRequirement()});
 try{install(s,packet([edit(1,7)],{prepareResponsibility:selection=>{expect(selection!.proposed(1,'x').value).toBe(7);selection!.choose(1,'x',endpoint);return undefined;}}));expect(before(s)).toBe(endpoint);}finally{s.dispose();}
});

it('separate source and packet invocations never reuse a subject lookup',()=>{
 const a=new EntityPublicationSource(),b=new EntityPublicationSource();try{install(a,packet([edit(1,7)]));install(b,packet([edit(1,99)]));install(a,packet([edit(1,11)]));expect(before(a).value).toBe(11);expect(before(b).value).toBe(99);}finally{a.dispose();b.dispose();}
});

it('throwing responsibility leaves no source or staged responsibility installation',()=>{
 const s=new EntityPublicationSource();try{install(s,packet([edit(1,2)]));const prior=s.evidence()!.field(1,'x','ordinary');expect(()=>s.prepare(packet([edit(1,7)],{prepareResponsibility:selection=>{expect(selection!.proposed(1,'x').value).toBe(7);throw Error('responsibility failed');}}))).toThrow('responsibility failed');expect(s.evidence()!.field(1,'x','ordinary')).toBe(prior);expect(before(s).value).toBe(2);}finally{s.dispose();}
});

it('responsibility reentry commits newer source and refuses outer preparation',()=>{
 const s=new EntityPublicationSource();try{install(s,packet([edit(1,2)]));expect(()=>s.prepare(packet([edit(1,7)],{prepareResponsibility:selection=>{expect(selection!.proposed(1,'x').value).toBe(7);install(s,packet([edit(1,99)]));return undefined;}}))).toThrow('source changed during preparation');expect(before(s).value).toBe(99);}finally{s.dispose();}
});

it('payload getter reentry before proposal returns cannot install stale outer packet',()=>{
 const s=new EntityPublicationSource();let fired=false;const after={get x(){if(!fired){fired=true;install(s,packet([edit(1,99)]));}return 7;}};
 try{expect(()=>s.prepare(packet([{...edit(1,7),after}]))).toThrow('source changed during preparation');expect(fired).toBe(true);expect(before(s).value).toBe(99);}finally{s.dispose();}
});

it('recipient prepares fail atomically after responsibility, preserving previous source facts',()=>{
 const s=new EntityPublicationSource();const installed=new Map<unknown,unknown>();let calls=0;let off=()=>{ /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ };
 try{install(s,packet([edit(1,2)]));const prior=s.evidence()!.field(1,'x','ordinary');off=s.subscribe({prepare(){throw Error('recipient failed');},complete(){throw Error('not completed');}});
 expect(()=>s.prepare(packet([edit(1,7)],{prepareResponsibility:selection=>{calls++;expect(selection!.proposed(1,'x').value).toBe(7);return {writes:[{map:installed,key:1,value:7}],adds:[]};}}))).toThrow('recipient failed');expect(calls).toBe(1);expect(installed.size).toBe(0);expect(s.evidence()!.field(1,'x','ordinary')).toBe(prior);
 }finally{off();s.dispose();}
});

it('empty steps override a nonempty ordinary fallback',()=>{
 const s=new EntityPublicationSource();try{expect(()=>s.prepare(packet([edit(1,7)],{steps:[],prepareResponsibility:selection=>{selection!.proposed(1,'x');return undefined;}}))).toThrow('Missing admitted field publication');expect(s.inspect().rows).toBe(0);}finally{s.dispose();}
});

it('array order wins over repeated/nonmonotonic ordinals and final partial edit still wins for omitted field',()=>{
 const s=new EntityPublicationSource();const a=edit(1,7),b:Edit={subject:1,before:{x:7},after:{y:11},fields:['y']};
 try{install(s,packet([a,b],{steps:[{ordinal:9,ordinary:[a],physical:[a]},{ordinal:0,ordinary:[a],physical:[a]},{ordinal:0,ordinary:[b],physical:[b]}],prepareResponsibility:selection=>{expect(selection!.proposed(1,'x')).toMatchObject({present:false,value:undefined});expect(selection!.proposed(1,'y')).toMatchObject({present:true,value:11});return undefined;}}));expect(before(s)).toMatchObject({present:false,value:undefined});}finally{s.dispose();}
});

it('rekey-last remains the last proposal instead of the last field-bearing edit',()=>{
 const s=new EntityPublicationSource();const a=edit(1,7),r:Edit={...edit(1,undefined),fields:[],structural:{kind:'rekey',subject:1,beforeKey:'a',afterKey:'b'}};
 try{install(s,packet([a,r],{prepareResponsibility:selection=>{expect(selection!.proposed(1,'x')).toMatchObject({present:false,value:undefined});return undefined;}}));expect(before(s)).toMatchObject({present:false,value:undefined});}finally{s.dispose();}
});

it('forEdit retains original identities and distinct restored support for duplicate-subject steps',()=>{
 const s=new EntityPublicationSource();const first=initialRequirement(),last=initialRequirement();const a:Edit={...edit(1,7),restoredFields:new Map([['x',{present:true,value:7,requirement:first}]])};const b:Edit={...edit(1,11),restoredFields:new Map([['x',{present:true,value:11,requirement:last}]])};let calls=0;
 const off=s.subscribe({prepare(p,native){calls++;expect(p.steps![0].ordinary[0]).toBe(a);const facts=(native as {facts:import('./internals/entity-publication').EntityPublicationEvidence}).facts;expect(facts.forEdit!(a).field(1,'x','ordinary')).toBe(first);expect(facts.forEdit!(b).field(1,'x','ordinary')).toBe(last);return undefined;},complete(){ /* This participant has no completion side effect. */ }});
 try{install(s,packet([a,b],{steps:[{ordinal:0,ordinary:[a],physical:[a]},{ordinal:1,ordinary:[b],physical:[b]}]}));expect(calls).toBe(1);}finally{off();s.dispose();}
});

for(const mutation of ['append','subject','kind'] as const)it(`admitted private metadata cannot change before installation: ${mutation}`,()=>{
 const s=new EntityPublicationSource();const a:Edit={...edit(1,7),structural:{kind:'add',subject:1}};const edits:Edit[]=[a];const installed=new Map<string,number>();let attempts=0;
 const p:Packet={owner:1,id:{},meta:undefined,ordinary:edits,physical:[a],prepareResponsibility:selection=>{
  attempts++;expect(selection!.proposed(1,'x').value).toBe(7);
  expect(Object.isFrozen(edits)).toBe(true);expect(Object.isFrozen(a)).toBe(true);expect(Object.isFrozen(a.structural)).toBe(true);
  const changed=mutation==='append'?Reflect.set(edits,1,edit(1,11)):mutation==='subject'?Reflect.set(a,'subject',2):Reflect.set(a.structural!,'kind','remove');
  expect(changed).toBe(false);expect(edits).toEqual([a]);expect(a.subject).toBe(1);expect(a.structural!.kind).toBe('add');
  expect(selection!.proposed(1,'x').value).toBe(7);
  return {writes:[{map:installed,key:'accepted',value:7}],adds:[]};
 }};
 try{const u=s.prepare(p)!;expect(attempts).toBe(1);expect(installed.size).toBe(0);expect(s.inspect().rows).toBe(0);u.finalize?.();installTerminalRecord(u.record);s.complete(u.completion);expect(installed.get('accepted')).toBe(7);expect(s.inspect().rows).toBe(1);expect(before(s).value).toBe(7);expect(before(s,2).present).toBe(false);}finally{s.dispose();}
});

it('recipient append attempt throws during prepare before responsibility or source installation',()=>{
 const s=new EntityPublicationSource();const installed=new Map<unknown,unknown>();const a=edit(1,7);const edits=[a];let attempted=0,completed=0;let mutationError:unknown,prepareError:unknown;
 const p:Packet={owner:1,id:{},meta:undefined,ordinary:edits,physical:[a],prepareResponsibility:()=>({writes:[{map:installed,key:1,value:7}],adds:[]})};
 const off=s.subscribe({prepare(){attempted++;try{edits.push(edit(1,11));}catch(error){mutationError=error;throw error;}throw Error('immutable append unexpectedly succeeded');},complete(){completed++;}});
 try{try{s.prepare(p);}catch(error){prepareError=error;}expect(attempted).toBe(1);expect(Object.isFrozen(edits)).toBe(true);expect(mutationError).toBeInstanceOf(TypeError);expect(prepareError).toBe(mutationError);expect(edits).toEqual([a]);expect(completed).toBe(0);expect(installed.size).toBe(0);expect(s.inspect().rows).toBe(0);}finally{off();s.dispose();}
});

it('original frozen-shell precedence input refuses before callbacks and preserves borrowed structural metadata',()=>{
 const s=new EntityPublicationSource();const r=removal(1),structural={kind:'add' as const,subject:1};const restored=Object.freeze({present:true,value:5,requirement:initialRequirement()});
 const add:Edit=Object.freeze({...edit(1,11),structural,restoredFields:new Map([['x',restored]])});const descriptors=Object.getOwnPropertyDescriptors(structural);let responsibility=0,recipients=0;
 const off=s.subscribe({prepare(){recipients++;return undefined;},complete(){throw Error('refusal cannot complete');}});
 try{expect(()=>s.prepare(packet([r,add],{steps:[{ordinal:0,ordinary:[r],physical:[r]},{ordinal:1,ordinary:[add],physical:[add]}],prepareResponsibility:()=>{responsibility++;return undefined;}}))).toThrow('Frozen entity publication edit contains mutable admission metadata');expect([responsibility,recipients]).toEqual([0,0]);expect(Object.getOwnPropertyDescriptors(structural)).toEqual(descriptors);expect(Object.isFrozen(structural)).toBe(false);expect(s.inspect().rows).toBe(0);expect(s.inspect().negativePresence).toBe(0);}finally{off();s.dispose();}
});

for(const separate of [false,true])it(`authored removal dedup is same-step only, separate=${separate}`,()=>{
 const s=new EntityPublicationSource();const first:Edit={...edit(1,9),structural:{kind:'remove',subject:1}},last=removal(1);let value:unknown='unread';
 const steps=separate?[{ordinal:0,ordinary:[first],physical:[first]},{ordinal:0,ordinary:[],physical:[last],authoredRemoval:last}]:[{ordinal:0,ordinary:[first],physical:[first],authoredRemoval:last}];
 try{install(s,packet([first],{steps,prepareResponsibility:selection=>{value=selection!.proposed(1,'x').value;return undefined;}}));expect(value).toBe(separate?undefined:9);expect(s.inspect().negativePresence).toBe(1);}finally{s.dispose();}
});

for(const fields of [null,[]] as const)it(`present undefined remains distinct from absent, fields=${String(fields)}`,()=>{
 const s=new EntityPublicationSource();const a:Edit={subject:1,before:undefined,after:{x:undefined},fields};let seen=false;
 try{install(s,packet([a],{prepareResponsibility:selection=>{expect(selection!.proposed(1,'x')).toMatchObject({present:true,value:undefined});expect(selection!.proposed(1,'missing')).toMatchObject({present:false,value:undefined});seen=true;return undefined;}}));expect(seen).toBe(true);expect(s.inspect().fields).toBe(fields===null?1:0);}finally{s.dispose();}
});

it('held support retains admitted subjects after retirement and denied private array mutation',()=>{
 const s=new EntityPublicationSource();const requirement=initialRequirement();requirement.proof={owners:[],unknown:true,invalid:false};
 const a:Edit={...edit(1,7),restoredFields:new Map([['x',{present:true,value:7,requirement}]])};const edits=[a];let support:(()=>object)|undefined;
 const off=s.subscribe({prepare(_p,native){support=(native as {support:()=>object}).support;return undefined;},complete(){ /* This participant has no completion side effect. */ }});
 try{install(s,{owner:1,id:{},meta:undefined,ordinary:edits,physical:[a]});expect(typeof support).toBe('function');expect(nativeProof(support!() as NativeRequirement).unknown).toBe(true);s.retire(1);expect(s.inspect().rows).toBe(0);expect(Object.isFrozen(edits)).toBe(true);expect(Reflect.set(edits,'length',0)).toBe(false);expect(edits).toEqual([a]);expect(nativeProof(support!() as NativeRequirement).unknown).toBe(true);}finally{off();s.dispose();}
});

it('deferred point aggregation indexes final packet once, including repeated ordinals',()=>{
 const s=new EntityPublicationSource();let first:PreparedPublicationUnit|undefined,second:PreparedPublicationUnit|undefined;let calls=0;
 const a=edit(1,7),b=edit(1,11);
 try{withEntityPointPublicationPreparation(()=>{
  first=s.preparePoint(packet([a],{steps:[{ordinal:0,ordinary:[a],physical:[a]}],prepareResponsibility:selection=>{calls++;expect(selection!.proposed(1,'x').value).toBe(11);return undefined;}}));
  second=s.preparePoint(packet([b],{steps:[{ordinal:0,ordinary:[b],physical:[b]}]}));
 });expect(calls).toBe(1);expect(s.inspect().rows).toBe(0);first!.finalize?.();second!.finalize?.();installTerminalRecord(first!.record);installTerminalRecord(second!.record);s.complete(first!.completion);s.complete(second!.completion);expect(before(s).value).toBe(11);
 }finally{s.dispose();}
});
