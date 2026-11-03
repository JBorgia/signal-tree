import type { NativeFieldEndpoint } from './native-field-selection';
import type { IntrinsicMutation, TerminalRecordPlan } from './intrinsic-mutation';
export type ScalarSelection = { endpoint:NativeFieldEndpoint; record?:TerminalRecordPlan };
type Selector=(node:object,mutation:IntrinsicMutation<unknown>,before:NativeFieldEndpoint,proposed:NativeFieldEndpoint,allowConfirmedRefresh:boolean)=>ScalarSelection|undefined;
const selectors=new WeakMap<object,Selector>();
export function registerScalarSelection(registry:object,select:Selector):()=>void { selectors.set(registry,select);return ()=>{if(selectors.get(registry)===select)selectors.delete(registry);}; }
export function prepareScalarSelection(registry:object|undefined,node:object,mutation:IntrinsicMutation<unknown>,before:NativeFieldEndpoint,proposed:NativeFieldEndpoint,allowConfirmedRefresh=false):ScalarSelection|undefined{return registry?selectors.get(registry)?.(node,mutation,before,proposed,allowConfirmedRefresh):undefined;}
// Scoped selected compensation facts, not an ownership ledger.
let restored:ReadonlyMap<object,NativeFieldEndpoint>|undefined;
export function withScalarSelections<T>(selections:ReadonlyMap<object,NativeFieldEndpoint>,work:()=>T):T{const previous=restored;restored=selections;try{return work();}finally{restored=previous;}}
export function restoredScalarSelection(node:object):NativeFieldEndpoint|undefined{return restored?.get(node);}

