import { expect, it } from 'vitest';
import { signalTree, transactions } from '../index';
import { withWriteContext } from './write-context';
import { registerMembershipPublication, type MembershipPublicationEdit } from './internals/intrinsic-mutation';
import { readOrdinaryMemberPresence } from './internals/member-membership';
const drain = async () => { for (let i = 0; i < 32; i++) await Promise.resolve(); };
const make = () => signalTree({a:{y:7,keep:9} as {y?:number;keep:number}},{enhancers:[transactions()]});
it('cold absent selected restoration supplies the native ordinary payload before membership installs',async()=>{
 const t=make();let release:()=>void=()=>undefined;
 try{
  const p=t.transact(()=>t.$.a({keep:9}));await drain();
  expect(t.$.a()).toEqual({keep:9});
  const seen:MembershipPublicationEdit[]=[];
  release=registerMembershipPublication(edit=>{seen.push(edit);return undefined;},()=>undefined);
  p.rollback();
  expect(t.$.a()).toEqual({y:7,keep:9});
  const entry=seen.find(edit=>edit.key==='y'&&edit.ordinary?.after.present);
  expect(entry?.ordinary).toEqual({before:{present:false},after:{present:true,value:7}});
  expect(Object.isFrozen(entry?.ordinary)).toBe(true);expect(Object.isFrozen(entry?.ordinary?.after)).toBe(true);
 }finally{release();t.destroy();}
});
it('prepared ordinary restoration payload failure installs no membership and useful retry remains possible',async()=>{
 const t=make();let release:()=>void=()=>undefined;
 try{
  const p=t.transact(()=>t.$.a({keep:9}));await drain();
  const failure=new Error('controlled ordinary payload consumer preparation');
  let captured:MembershipPublicationEdit|undefined;
  release=registerMembershipPublication(edit=>{if(edit.ordinary?.after.present){captured=edit;throw failure;}return undefined;},()=>undefined);
  expect(()=>p.rollback()).toThrow();
  expect(captured?.ordinary).toEqual({before:{present:false},after:{present:true,value:7}});
  expect(t.$.a()).toEqual({keep:9});expect(readOrdinaryMemberPresence(t.$.a,'y')).toBe(false);
  expect(()=>p.inspect()).not.toThrow();
  release();release=()=>undefined;p.rollback();expect(t.$.a()).toEqual({y:7,keep:9});
 }finally{release();t.destroy();}
});
it('ordinary equal retained reactivation supplies payload without inventing ordinary membership change',async()=>{
 const t=make();let release:()=>void=()=>undefined;
 try{
  const y=t.$.a.y!;
  withWriteContext({participation:'inspection'},()=>t.$.a({keep:9}));await drain();
  const seen:MembershipPublicationEdit[]=[];
  release=registerMembershipPublication(edit=>{seen.push(edit);return undefined;},()=>undefined);
  const p=t.transact(()=>y(7));
  expect(seen.find(edit=>edit.key==='y')?.ordinary).toEqual({before:{present:true,value:7},after:{present:true,value:7}});
  expect(p.inspect().changes).toEqual([]);p.rollback();expect(t.$.a()).toEqual({y:7,keep:9});
 }finally{release();t.destroy();}
});
