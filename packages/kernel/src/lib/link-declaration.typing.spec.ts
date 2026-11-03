/** Public source typing controls; compiled, not executed. Installed-package qualification is separate. */
// eslint-disable-next-line @nx/enforce-module-boundaries -- This typing control deliberately checks the public package barrel.
import { signalTree, entityMap, leaf, type PendingTransaction } from '@signal-tree/kernel';
// eslint-disable-next-line @nx/enforce-module-boundaries -- This typing control deliberately checks the public package barrel.
import { link, SignalTreePublicationError, type PublicationReceipt, type PublicationState } from '@signal-tree/kernel';
declare const owner: PendingTransaction;
function examples() {
  const t = signalTree({x:0,pair:{x:0},atomic:leaf({x:0}),rows:entityMap<{id:string;x:number},string>()});
  const c = link(t.$.x,{set:value=>{const n:number=value;void n;}});
  c.declare({kind:'independent'},()=>t.$.x(1));
  c.declare({kind:'dependent',owners:[owner]},()=>t.$.x(2));
  c.declare({kind:'unknown'},()=>3); // returned value is discarded, not a second payload
  // @ts-expect-error ordinary Promise return is rejected
  c.declare({kind:'independent'},async()=>t.$.x(3));
  // @ts-expect-error a union that can return a Promise is also rejected
  c.declare({kind:'unknown'},():number|Promise<number>=>Math.random()?1:Promise.resolve(1));
  // @ts-expect-error missing owners
  c.declare({kind:'dependent'},()=>{ /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ });
  const receipt:PublicationReceipt=c.declare({kind:'independent'},()=>{ /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ });
  // @ts-expect-error receipt method is read-only
  receipt.read=()=>({state:'no-write'});
  // @ts-expect-error detached status snapshot is read-only
  receipt.read().state='disposed';
  link(t.$.atomic,{set:value=>{const n:number=value.x;void n;}});
  link(t.$.pair,{set:value=>{const n:number=value.x;void n;}});
  link(t.$.rows,{set:value=>{const rows:readonly {id:string;x:number}[]=value;void rows;}});
  link(t.$.rows.byIdOrFail('a'),{set:value=>{const n:number=value.x;void n;}});
  const plain=signalTree({x:0,pair:{x:0}});
  link(plain.$,{set:value=>{const n:number=value.pair.x;void n;}});
  // @ts-expect-error marker-bearing root admission remains excluded
  link(t.$,{set:()=>{ /* Destination values are intentionally discarded in this protocol fixture. */ }});
  // Existing structural ownership limit: type admission is not proof of a live tree registry.
  link(()=>1,{set:()=>{ /* Destination values are intentionally discarded in this protocol fixture. */ }}); // runtime link must reject; no new acceptance is proposed
  const erased:()=>void=async()=>{ /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ };
  c.declare({kind:'unknown'},erased); // TS void erasure: runtime thenable guard remains mandatory
  c.declare<unknown>({kind:'unknown'},async()=>{ /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ }); // explicit erasure cannot be statically policed
  const partialThenable=()=>({then:()=>{ /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ }});
  c.declare({kind:'unknown'},partialThenable); // not PromiseLike<T>, but runtime rejects callable then
  // @ts-expect-error branch containing EntityMap remains rejected
  link(signalTree({box:{rows:entityMap<{id:string},string>()}}).$.box,{set:()=>{ /* Destination values are intentionally discarded in this protocol fixture. */ }});
  // @ts-expect-error source rejection also applies to subscribe-only endpoints
  link(t.$,{subscribe:()=>()=>{ /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ }});
  const error = new SignalTreePublicationError('after-callback','async-callback',{cause:owner});
  const code:'SIGNALTREE_PUBLICATION_DECLARATION_INVALID'=error.code;void code;
  // @ts-expect-error unknown declaration error reason is not public contract
  new SignalTreePublicationError('before-callback','invented');
  // @ts-expect-error historical proposal state is not emitted
  const notEmitted:PublicationState={state:'eligible',basis:'surviving'};void notEmitted;
  // @ts-expect-error unavailable owner is an error, not a receipt state
  const notStatus:PublicationState={state:'conservative',reason:'unavailable-owner'};void notStatus;
  return [t,plain];
}
void examples;
