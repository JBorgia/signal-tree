from pathlib import Path
p=Path(__file__).parent;c=p/'candidate/packages/kernel/src/lib'
f=c/'packet-index-adversarial.spec.ts';s=f.read_text();s=s.replace("structural:{kind:'add',subject:1},restoredFields:new Map([['x',restored]])","structural:Object.freeze({kind:'add' as const,subject:1}),restoredFields:new Map([['x',restored]])",1)
start=s.index("for(const mutation of ['append','subject','kind']")
end=s.index("for(const separate of [false,true])",start)
s=s[:start]+'''for(const mutation of ['append','subject','kind'] as const)it(`admitted private metadata cannot change before installation: ${mutation}`,()=>{
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

'''+s[end:]
s=s.replace('held support uses captured admitted subjects after source retirement and later private array mutation','held support retains admitted subjects after retirement and denied private array mutation')
s=s.replace('s.retire(1);edits.length=0;expect(nativeProof(support!() as NativeRequirement).unknown).toBe(true);',"expect(typeof support).toBe('function');expect(nativeProof(support!() as NativeRequirement).unknown).toBe(true);s.retire(1);expect(s.inspect().rows).toBe(0);expect(Object.isFrozen(edits)).toBe(true);expect(Reflect.set(edits,'length',0)).toBe(false);expect(edits).toEqual([a]);expect(nativeProof(support!() as NativeRequirement).unknown).toBe(true);")
f.write_text(s)
f=c/'packet-index-review.spec.ts';s=f.read_text();start=s.index("it('recipient finalizer admission mutation");end=s.index("it('duplicate step",start)
s=s[:start]+'''it('recipient finalizer append throws before responsibility and source installation',()=>{
 const source=new EntityPublicationSource();const a=edit(7),edits=[a];const installed=new Map<string,number>();let attempts=0,completions=0;let mutationError:unknown,finalizeError:unknown;
 const packet:Packet={owner:1,id:{},meta:undefined,ordinary:edits,physical:[a],prepareResponsibility:()=>({writes:[{map:installed,key:'accepted',value:7}],adds:[]})};
 const off=source.subscribe({prepare(){return {record:{writes:[],adds:[]},completion:{},finalize(){attempts++;try{edits.push(edit(99));}catch(error){mutationError=error;throw error;}throw Error('immutable append unexpectedly succeeded');}};},complete(){completions++;}});
 try{const unit=source.prepare(packet)!;expect(attempts).toBe(0);try{unit.finalize?.();installTerminalRecord(unit.record);source.complete(unit.completion);}catch(error){finalizeError=error;}expect(attempts).toBe(1);expect(Object.isFrozen(edits)).toBe(true);expect(mutationError).toBeInstanceOf(TypeError);expect(finalizeError).toBe(mutationError);expect(edits).toEqual([a]);expect(completions).toBe(0);expect(installed.size).toBe(0);expect(source.inspect().rows).toBe(0);}finally{off();source.dispose();}
});
it('regression: denied finalizer append cannot pair changed packet with stale native endpoint',()=>{
 const source=new EntityPublicationSource();const a=edit(7),edits=[a];const installed=new Map<string,number>();let attempts=0,completions=0;
 const off=source.subscribe({prepare(){return {record:{writes:[],adds:[]},completion:{},finalize(){attempts++;expect(Object.isFrozen(edits)).toBe(true);expect(Reflect.set(edits,1,edit(99))).toBe(false);expect(edits).toEqual([a]);}};},complete(){completions++;}});
 try{const unit=source.prepare({owner:1,id:{},meta:undefined,ordinary:edits,physical:[a],prepareResponsibility:()=>({writes:[{map:installed,key:'accepted',value:7}],adds:[]})})!;expect(installed.size).toBe(0);expect(source.inspect().rows).toBe(0);unit.finalize?.();installTerminalRecord(unit.record);source.complete(unit.completion);expect([attempts,completions]).toEqual([1,1]);expect(edits.map(e=>e.after)).toEqual([{x:7}]);expect(installed.get('accepted')).toBe(7);off();let observed:unknown;source.prepare({owner:1,id:{},meta:undefined,ordinary:[],physical:[],prepareResponsibility:s=>{observed=s!.before(1,'x').value;return undefined;}});expect(observed).toBe(7);expect(source.inspect().rows).toBe(1);}finally{off();source.dispose();}
});

'''+s[end:];f.write_text(s)
