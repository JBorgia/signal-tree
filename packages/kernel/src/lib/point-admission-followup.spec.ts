import {expect,it,vi} from 'vitest';
import '../index';
import {EntityPublicationSource,withEntityPointPublicationPreparation,type EntityPublicationPacket as Packet,type EntityPublicationEdit as Edit} from './internals/entity-publication';
import {installTerminalRecord,type PreparedPublicationUnit} from './internals/intrinsic-mutation';
const packet=(edit:Edit):Packet=>({owner:1,id:{},meta:undefined,ordinary:[edit],physical:[edit]});
const good=(subject:number,x:number):Edit=>({subject,before:undefined,after:{x},fields:['x']});
const bad=()=>packet(Object.freeze(good(9,99)));
const finish=(s:EntityPublicationSource,u:PreparedPublicationUnit)=>{u.finalize?.();installTerminalRecord(u.record);s.complete(u.completion);};
it('refused-only scope never aggregates an empty source and a later scope still installs useful work',()=>{
 const s=new EntityPublicationSource(),prepare=vi.spyOn(s,'prepare');let prepares=0,completions=0;const off=s.subscribe({prepare(){prepares++;return {record:{writes:[],adds:[]},completion:{}};},complete(){completions++;}});
 try{withEntityPointPublicationPreparation(()=>{expect(()=>s.preparePoint(bad())).toThrow('mutable admission metadata');});expect(prepare).not.toHaveBeenCalled();expect(prepares).toBe(0);expect(completions).toBe(0);let unit:PreparedPublicationUnit|undefined;withEntityPointPublicationPreparation(()=>{unit=s.preparePoint(packet(good(1,7)));});expect(prepare).toHaveBeenCalledTimes(1);expect(prepares).toBe(1);expect(s.inspect().rows).toBe(0);finish(s,unit!);expect(completions).toBe(1);expect(s.inspect().rows).toBe(1);}finally{prepare.mockRestore();off();s.dispose();}
});
it('caught refusal between valid fragments preserves the real group and completes it once',()=>{
 const s=new EntityPublicationSource();let prepares=0,completions=0;let accepted:Packet|undefined;const a=good(1,7),b=good(2,11);const off=s.subscribe({prepare(p){prepares++;accepted=p;return {record:{writes:[],adds:[]},completion:{}};},complete(){completions++;}});
 try{let first:PreparedPublicationUnit|undefined,second:PreparedPublicationUnit|undefined;withEntityPointPublicationPreparation(()=>{first=s.preparePoint(packet(a));expect(()=>s.preparePoint(bad())).toThrow('mutable admission metadata');second=s.preparePoint(packet(b));});expect(first).toBe(second);expect(prepares).toBe(1);expect(accepted!.ordinary).toEqual([a,b]);finish(s,first!);finish(s,second!);expect(completions).toBe(1);expect(s.inspect().rows).toBe(2);let values:unknown[]=[];s.prepare({...packet(good(3,0)),ordinary:[],physical:[],prepareResponsibility:f=>{values=[f!.before(1,'x').value,f!.before(2,'x').value];return undefined;}});expect(values).toEqual([7,11]);}finally{off();s.dispose();}
});
