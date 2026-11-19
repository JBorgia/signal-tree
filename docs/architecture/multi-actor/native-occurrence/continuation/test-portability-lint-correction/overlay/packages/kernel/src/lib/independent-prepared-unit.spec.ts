import {expect,it} from 'vitest';
import { writeDiagnostic } from '../../test/optional-diagnostic';
import {entityMap,signalTree,transactions} from '../index';
import {getEntityPublicationBinding} from './internals/entity-publication';
import {interceptLocationWrites} from './internals/location-runtime';
import {getPathNotifier} from './path-notifier';
import {withWriteContext} from './write-context';
import {link} from './link';
type Row={id:string;x:number;y:number;z:number};
const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<120;i++)await Promise.resolve();};
const record=(name:string,data:unknown)=>{const dir=process.env['ST_PREPARED_REVIEW_OUTPUT'];writeDiagnostic(dir ? `${dir}/${name}.json` : undefined,JSON.stringify(data,null,2));};
const make=async()=>{const tree=signalTree({plain:0,rows:entityMap<Row,string>()},{enhancers:[transactions()]});tree.$.rows.addOne({id:'a',x:0,y:0,z:4});await flush();const rows=tree.$.rows,row=rows.byIdOrFail('a'),b=getEntityPublicationBinding(row)!;const req=(k:string)=>b.source.evidence()!.field(b.subject!,k,'ordinary');const value=()=>({x:row.x(),y:row.y(),z:row.z()});return {tree,rows,row,req,value};};
for(const order of ['xy','yx'] as const)for(const followup of ['retry','confirm'] as const)it(`public second interceptor block is atomic; ${order}/${followup}`,async()=>{
 const {tree,rows,value}=await make();const q=tree.transact(()=>{for(const k of order)rows.updateOne('a',k==='x'?{x:7}:{y:11});});await flush();let calls=0;const seen:string[]=[];
 const off=rows.intercept({onUpdate(_id,changes,ctx){calls++;seen.push(Object.keys(changes).join(','));if(calls===2)ctx.block('second required inverse refused');}});
 try{let error:unknown;try{q.rollback();}catch(e){error=e;}const after=value();off();let followError:unknown;try{if(followup==='retry')q.rollback();else q.confirm();}catch(e){followError=e;}record(`public-${order}-${followup}`,{calls,seen,after,final:value(),error:String(error),followError:String(followError)});expect(calls).toBe(2);expect(error).toBeDefined();expect(after).toEqual({x:7,y:11,z:4});expect(followError).toBeUndefined();expect(value()).toEqual(followup==='retry'?{x:0,y:0,z:4}:{x:7,y:11,z:4});}finally{off();tree.destroy();}
});
for(const order of ['xy','yx'] as const)for(const transformedY of [0,99])it(`ordered transformed sibling support ${order}/${transformedY}`,async()=>{
 const {tree,rows,req,value}=await make();const base={x:req('x'),y:req('y'),z:req('z')};const q=tree.transact(()=>{for(const k of order)rows.updateOne('a',k==='x'?{x:7}:{y:11});});await flush();const calls:string[]=[];
 const off=rows.intercept({onUpdate(_id,changes,ctx){const field=Object.prototype.hasOwnProperty.call(changes,'x')?'x':'y';calls.push(field);if(field==='x')ctx.transform({x:0,y:transformedY});}});
 try{q.rollback();await flush();const xLast=calls.at(-1)==='x';record(`transform-${order}-${transformedY}`,{calls,value:value(),xBaseline:req('x')===base.x,yBaseline:req('y')===base.y,zBaseline:req('z')===base.z});expect(calls).toEqual([...order].reverse());expect(value()).toEqual({x:0,y:xLast?transformedY:0,z:4});expect(req('x')).toBe(base.x);expect(req('z')).toBe(base.z);if(xLast)expect(req('y')).not.toBe(base.y);else expect(req('y')).toBe(base.y);}finally{off();tree.destroy();}
});
it('independent callback write survives invalidated preparation; selected fields and authority remain',async()=>{
 const {tree,rows,req,value}=await make();const q=tree.transact(()=>{rows.updateOne('a',{x:7});rows.updateOne('a',{y:11});});await flush();const authored={x:req('x'),y:req('y')};let entered=false;let independent:object|undefined;
 const off=rows.intercept({onUpdate(_id,changes){if(!entered&&(changes.x===0||changes.y===0)){entered=true;rows.updateOne('a',{z:42});independent=req('z');}}});
 try{let error:unknown;try{q.rollback();}catch(e){error=e;}const after=value(),sameX=req('x')===authored.x,sameY=req('y')===authored.y,sameZ=req('z')===independent;off();let retryError:unknown;try{q.rollback();}catch(e){retryError=e;}record('reentry',{entered,after,sameX,sameY,sameZ,error:String(error),retryError:String(retryError),final:value()});expect(entered).toBe(true);expect(error).toBeDefined();expect(after).toEqual({x:7,y:11,z:42});expect(sameX&&sameY&&sameZ).toBe(true);expect(retryError).toBeUndefined();expect(value()).toEqual({x:0,y:0,z:42});expect(req('z')).toBe(independent);}finally{off();tree.destroy();}
});
for(const mode of ['success','throw','skip'] as const)it(`saved selected continuation is closed after ${mode}`,async()=>{
 const {tree,rows,row,req}=await make();const q=tree.transact(()=>rows.updateOne('a',{x:7}));await flush();let saved:(()=>void)|undefined;const off=interceptLocationWrites(row.x,(_op,proceed)=>{saved=proceed;if(mode==='throw')throw new Error('selected preflight refuses');if(mode==='success')proceed();});
 try{let error:unknown;try{q.rollback();}catch(e){error=e;}const first=row.x();off();expect(saved).toBeTypeOf('function');if(mode==='success'){expect(error).toBeUndefined();expect(first).toBe(0);}else{expect(error).toBeDefined();expect(first).toBe(7);q.rollback();expect(row.x()).toBe(0);}rows.updateOne('a',{x:13});await flush();const later=req('x');let lateError:unknown;try{saved!();}catch(e){lateError=e;}record(`saved-${mode}`,{first,error:String(error),lateError:String(lateError),value:row.x(),sameSupport:req('x')===later});expect(lateError).toBeDefined();expect(row.x()).toBe(13);expect(req('x')).toBe(later);}finally{off();tree.destroy();}
});
it('second selected proceed refuses before another preparation callback',async()=>{
 const {tree,rows,row}=await make();const q=tree.transact(()=>rows.updateOne('a',{x:7}));await flush();let calls=0,secondError:unknown,firstValue:unknown,secondValue:unknown;
 const offRows=rows.intercept({onUpdate(){calls++;}});const off=interceptLocationWrites(row.x,(_op,proceed)=>{proceed();firstValue=row.x();try{proceed();}catch(e){secondError=e;}secondValue=row.x();});
 try{let rollbackError:unknown;try{q.rollback();}catch(e){rollbackError=e;}record('double',{calls,firstValue,secondValue,secondError:String(secondError),rollbackError:String(rollbackError),value:row.x()});expect(calls).toBe(1);expect(secondError).toBeDefined();expect(firstValue).toBe(7);expect(secondValue).toBe(7);/* Whether caught misuse aborts an otherwise valid unit is deliberately not specified. */}finally{off();offRows();tree.destroy();}
});
it('mixed scalar/entity public refusal occurs before any selected install',async()=>{
 const {tree,rows,req,value}=await make();const q=tree.transact(()=>{tree.$.plain(3);rows.updateOne('a',{x:7});});await flush();const authored=req('x');let calls=0;const off=rows.intercept({onUpdate(_id,_changes,ctx){calls++;ctx.block('mixed selected refusal');}});
 try{let error:unknown;try{q.rollback();}catch(e){error=e;}const after={plain:tree.$.plain(),...value()},sameSupport=req('x')===authored;off();let retryError:unknown;try{q.rollback();}catch(e){retryError=e;}record('mixed-block',{calls,after,sameSupport,error:String(error),retryError:String(retryError),final:{plain:tree.$.plain(),...value()}});expect(calls).toBe(1);expect(error).toBeDefined();expect(after).toEqual({plain:3,x:7,y:0,z:4});expect(sameSupport).toBe(true);expect(retryError).toBeUndefined();expect(tree.$.plain()).toBe(0);expect(value()).toEqual({x:0,y:0,z:4});}finally{off();tree.destroy();}
});
it('mixed completed unit remains terminal after actual delivery throw',async()=>{
 const {tree,rows,req,value}=await make();const baseline=req('x');const q=tree.transact(()=>{tree.$.plain(3);rows.updateOne('a',{x:7});});await flush();const sentinel=new Error('post-install delivery failure');const deliveries:Array<{plain:number;x:number}>=[];const off=rows.tap({onUpdate(){deliveries.push({plain:tree.$.plain(),x:rows.byIdOrFail('a').x()});throw sentinel;}});
 try{let error:unknown;try{q.rollback();}catch(e){error=e;}const after={plain:tree.$.plain(),...value()},sameSupport=req('x')===baseline;off();let confirmError:unknown;try{q.confirm();}catch(e){confirmError=e;}const count=deliveries.length;q.rollback();record('mixed-delivery',{deliveries,after,sameSupport,error:String(error),exactError:error===sentinel,confirmError:String(confirmError)});expect(count).toBeGreaterThan(0);expect(deliveries.every(v=>v.plain===0&&v.x===0)).toBe(true);expect(after).toEqual({plain:0,x:0,y:0,z:4});expect(sameSupport).toBe(true);expect(confirmError).toBeDefined();expect(deliveries.length).toBe(count);/* Delivery error containment is recorded; no new propagation policy. */}finally{off();tree.destroy();}
});

for(const order of ['xy','yx'] as const)it(`inspection sibling retains ordinary baseline through composed rollback and equal-display adoption ${order}`,async()=>{
 const {tree,rows,row,req,value}=await make();
 rows.updateOne('a',{z:7});await flush();
 const binding=getEntityPublicationBinding(row)!;
 const physicalZ=()=>binding.source.evidence()!.field(binding.subject!,'z','physical');
 const baseline=req('z');
 const sent:unknown[]=[];
 const connection=link(rows,{set:(v)=>{sent.push(v);}});
 try{
  withWriteContext({participation:'inspection'},()=>rows.updateOne('a',{z:99}));await flush();await connection.settled();
  const inspectionSupport=physicalZ();
  const inspectionState={value:value(),ordinaryBaseline:req('z')===baseline,physicalDistinct:inspectionSupport!==baseline};
  const q=tree.transact(()=>{for(const k of order)rows.updateOne('a',k==='x'?{x:7}:{y:11});});await flush();
  const beforeDelivery=sent.length;
  q.rollback();await flush();await connection.settled();
  const rollbackState={value:value(),ordinaryBaseline:req('z')===baseline,physicalInspection:physicalZ()===inspectionSupport,deliveries:sent.slice(beforeDelivery)};
  const adoption=tree.transact(()=>rows.updateOne('a',{z:99}));await flush();
  const adoptionState={value:value(),ordinaryChanged:req('z')!==baseline};
  adoption.rollback();await flush();await connection.settled();
  const rejectionState={value:value(),ordinaryBaseline:req('z')===baseline,delivery:sent.at(-1)};
  record(`inspection-adoption-${order}`,{inspectionState,rollbackState,adoptionState,rejectionState});
  expect(inspectionState).toEqual({value:{x:0,y:0,z:99},ordinaryBaseline:true,physicalDistinct:true});
  expect(rollbackState.value).toEqual({x:0,y:0,z:99});
  expect(rollbackState.ordinaryBaseline).toBe(true);expect(rollbackState.physicalInspection).toBe(true);
  expect(rollbackState.deliveries.length).toBeGreaterThan(0);
  expect(rollbackState.deliveries.at(-1)).toEqual([{id:'a',x:0,y:0,z:7}]);
  expect(adoptionState).toEqual({value:{x:0,y:0,z:99},ordinaryChanged:true});
  expect(rejectionState).toEqual({value:{x:0,y:0,z:7},ordinaryBaseline:true,delivery:[{id:'a',x:0,y:0,z:7}]});
 }finally{connection.dispose();tree.destroy();}
});
