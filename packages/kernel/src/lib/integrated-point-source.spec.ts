import { expect, it, vi } from 'vitest';
import '../index';
import {
  EntityPublicationSource,
  type EntityPublicationParticipant,
  type EntityPublicationPacket,
  type SourcePointPreparer,
} from './internals/entity-publication';
import {combineTerminalRecords,installTerminalRecord,type PreparedPublicationUnit} from './internals/intrinsic-mutation';

const packet=():EntityPublicationPacket=>({owner:0,id:{},meta:undefined,physical:[{subject:1,before:undefined,after:{x:0},fields:['x']}],ordinary:[{subject:1,before:undefined,after:{x:0},fields:['x']}]});
const apply=(source:EntityPublicationSource,unit:PreparedPublicationUnit|undefined)=>{
  if(!unit)throw new Error('Expected native unit');unit.finalize?.();unit.validate?.();installTerminalRecord(unit.record);source.complete(unit.completion);
};
const setup=()=>{
  let issue!:SourcePointPreparer;const source=new EntityPublicationSource(prepare=>{issue=prepare;});apply(source,source.prepare(packet()));
  const native=(source as unknown as {native?:EntityPublicationParticipant}).native;if(!native?.preparePoint)throw new Error('Missing native point preparation');
  return {source,native,issue:(v:number)=>issue({owner:0,id:{},meta:undefined,subject:1,fields:['x'],physicalBefore:{x:0},physicalAfter:{x:v},ordinaryBefore:{x:0},ordinaryAfter:{x:v}})};
};

it('authenticates point membership per source and rejects cloned or cross-source fast admission',()=>{
  const a=setup(),b=setup();let captured:EntityPublicationPacket|undefined;
  const off=a.source.subscribe({prepare(p){captured=p;return undefined;},complete(){ /* Capture-only participant returns no unit. */ }});
  try{
    apply(a.source,a.issue(1));off();if(!captured)throw new Error('Missing issued packet');
    const ap=vi.spyOn(a.native,'preparePoint'),bp=vi.spyOn(b.native,'preparePoint');
    try{
      apply(a.source,a.source.prepare({...captured}));expect(ap).not.toHaveBeenCalled();
      apply(b.source,b.source.prepare(captured));expect(bp).not.toHaveBeenCalled();
      apply(a.source,a.issue(2));expect(ap).toHaveBeenCalledTimes(1);
    }finally{ap.mockRestore();bp.mockRestore();}
  }finally{off();a.source.dispose();b.source.dispose();}
});

it('opaque native-only completion preserves receiver, repeated calls and thrown undefined',()=>{
  const {source,native,issue}=setup();const complete=native.complete;let calls=0;
  native.complete=function(value){expect(this).toBe(native);calls++;complete.call(this,value);throw undefined;};
  try{
    const unit=issue(1);if(!unit)throw new Error('Expected unit');unit.finalize?.();installTerminalRecord(unit.record);
    for(let i=0;i<2;i++){let caught=false;try{source.complete(unit.completion);}catch(error){caught=true;expect(error).toBeUndefined();}expect(caught).toBe(true);}
    expect(calls).toBe(2);
  }finally{native.complete=complete;source.dispose();}
});

it('native-only write specialization preserves composition-wide delete/write/add ordering',()=>{
  const {source,native}=setup();const original=native.prepare;const events:string[]=[];
  const record=(name:string)=>({deletes:[{map:{delete(){events.push(name+':delete');}},key:0}],writes:[{map:{set(){events.push(name+':write');}},key:0,value:0}],adds:[{set:{add(){events.push(name+':add');}},value:0}]});
  native.prepare=()=>({record:record('native'),completion:{}});
  try{
    const unit=source.prepare(packet());if(!unit)throw new Error('Expected unit');unit.finalize?.();
    installTerminalRecord(combineTerminalRecords(unit.record,record('other')));
    expect(events).toEqual(['native:delete','other:delete','native:write','other:write','native:add','other:add']);
  }finally{native.prepare=original;source.dispose();}
});
