/** Compile-only examples. No runtime execution; no claim of installed-package qualification. */
import { signalTree, entityMap, leaf, type PendingTransaction } from '@signal-tree/kernel';
import { signalTree as angularTree } from '@signal-tree/angular';
import { signalTree as reactTree } from '@signal-tree/react';
import { signalTree as vueTree } from '@signal-tree/vue';
import { signalTree as solidTree } from '@signal-tree/solid';
import { proposedLink, type PublicationReceipt } from './API-SKETCH';
declare const owner: PendingTransaction;
function examples() {
  const t = signalTree({x:0,pair:{x:0},atomic:leaf({x:0}),rows:entityMap<{id:string;x:number},string>()});
  const c = proposedLink(t.$.x,{set:value=>{const n:number=value;void n;}});
  c.declare({kind:'independent'},()=>t.$.x(1));
  c.declare({kind:'dependent',owners:[owner]},()=>t.$.x(2));
  c.declare({kind:'unknown'},()=>3); // returned value is discarded, not a second payload
  // @ts-expect-error ordinary Promise return is rejected
  c.declare({kind:'independent'},async()=>t.$.x(3));
  // @ts-expect-error a union that can return a Promise is also rejected
  c.declare({kind:'unknown'},():number|Promise<number>=>Math.random()?1:Promise.resolve(1));
  // @ts-expect-error missing owners
  c.declare({kind:'dependent'},()=>{});
  const receipt:PublicationReceipt=c.declare({kind:'independent'},()=>{});
  // @ts-expect-error receipt method is read-only
  receipt.read=()=>({state:'no-write'});
  // @ts-expect-error detached status snapshot is read-only
  receipt.read().state='disposed';
  proposedLink(t.$.atomic,{set:value=>{const n:number=value.x;void n;}});
  proposedLink(t.$.pair,{set:value=>{const n:number=value.x;void n;}});
  proposedLink(t.$.rows,{set:value=>{const rows:readonly {id:string;x:number}[]=value;void rows;}});
  proposedLink(t.$.rows.byIdOrFail('a'),{set:value=>{const n:number=value.x;void n;}});
  const plain=signalTree({x:0,pair:{x:0}});
  proposedLink(plain.$,{set:value=>{const n:number=value.pair.x;void n;}});
  // @ts-expect-error marker-bearing root admission remains excluded
  proposedLink(t.$,{set:()=>{}});
  const ng=angularTree({x:0});proposedLink(ng.$.x,{set:()=>{}}).declare({kind:'independent'},()=>ng.$.x.set(1));
  const react=reactTree({x:0});proposedLink(react.$.x,{set:()=>{}}).declare({kind:'independent'},()=>react.$.x(1));
  const vue=vueTree({x:0});proposedLink(vue.$.x,{set:()=>{}}).declare({kind:'independent'},()=>{vue.$.x.value=1;});
  const solid=solidTree({x:0});proposedLink(solid.$.x,{set:()=>{}}).declare({kind:'independent'},()=>solid.$.x.set(1));
  // Existing structural ownership limit: type admission is not proof of a live tree registry.
  proposedLink(()=>1,{set:()=>{}}); // runtime link must reject; no new acceptance is proposed
  const erased:()=>void=async()=>{};
  c.declare({kind:'unknown'},erased); // TS void erasure: runtime thenable guard remains mandatory
  c.declare<unknown>({kind:'unknown'},async()=>{}); // explicit erasure cannot be statically policed
  const partialThenable=()=>({then:()=>{}});
  c.declare({kind:'unknown'},partialThenable); // not PromiseLike<T>, but runtime rejects callable then
  return [t,plain,ng,react,vue,solid];
}
void examples;
