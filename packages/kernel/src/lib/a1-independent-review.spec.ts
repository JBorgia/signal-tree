import { describe, expect, it } from 'vitest';
import { link, signalTree, transactions } from '../index';
import { getPathNotifier } from './path-notifier';
import { preparePublicationMutations } from './internals/intrinsic-mutation';
import { createTreeScalarLeafRuntime } from './internals/tree-scalar-leaf-runtime';
import { replaceLocation } from './internals/location-runtime';
type Receipt={read():{state:string}};
type Experimental=ReturnType<typeof link>&{declare(input:{kind:'independent'}|{kind:'dependent';owners:object[]},work:()=>unknown):Receipt};
const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<48;i++)await Promise.resolve();};
const make=()=>signalTree({x:0,y:0},{enhancers:[transactions()]});
describe('independent scalar installed-facts review',()=>{
 it('does not complete a prepared unit rejected before installation',()=>{
  const rt=createTreeScalarLeafRuntime(undefined), y=rt.createLeaf<number>(7,Object.is), x=rt.createLeaf<number>(0,Object.is);
  let complete=0;const records=new Map();const key={};
  const off=preparePublicationMutations(y,()=>{replaceLocation(x,9);return{record:{writes:[{map:records,key,value:8}],adds:[]},completion:{}};},()=>complete++)!;
  try{expect(()=>replaceLocation(y,8)).toThrow('Terminal preparation reentered physical installation');expect(y()).toBe(7);expect(x()).toBe(9);expect(records.size).toBe(0);expect(complete).toBe(0);}finally{off();}
 });
 it('support-only admission reports retained ordinary value when equality rejects a distinct input',()=>{
  const rt=createTreeScalarLeafRuntime(undefined), y=rt.createLeaf<number>(7,(a:number,b:number)=>a%2===b%2);
  const records=new Map();const key={};
  const off=preparePublicationMutations(y,m=>({record:{writes:[{map:records,key,value:m.after}],adds:[]},completion:{}}),()=>undefined)!;
  try{replaceLocation(y,9);expect(y()).toBe(7);expect(records.get(key)).toBe(7);}finally{off();}
 });
 it('coalesced equal setter does not erase the useful prior installed projection',async()=>{
  const t=make(),sent:number[]=[];const c=link(t.$.y,{set:v=>{sent.push(v);}}) as Experimental;
  const p=t.transact(()=>t.$.x(3));
  try{c.declare({kind:'independent'},()=>t.$.y(7));c.declare({kind:'independent'},()=>t.$.y(7));await flush();expect(t.$.y()).toBe(7);expect(sent).toEqual([7]);}finally{c.dispose();t.destroy();}
 });
 it('updater input proof survives a callback overwrite before outer publication preparation',async()=>{
  const t=make(),sent:number[]=[];const c=link(t.$.y,{set:v=>{sent.push(v);}}) as Experimental;
  const p=t.transact(()=>t.$.x(7));
  try{
   c.declare({kind:'dependent',owners:[p]},()=>t.$.y(t.$.x()));await flush();expect(sent).toEqual([]);
   let error:unknown;
   try{c.declare({kind:'independent'},()=>t.$.y(input=>{t.$.y(2);return input;}));}catch(e){error=e;}
   await flush();expect(t.$.y()).toBe(7);expect(t.$.x()).toBe(7);expect(sent).toEqual([]);
   expect(error).toMatchObject({stage:'after-callback',reason:'contradiction'});
  }finally{c.dispose();t.destroy();}
 });
});
