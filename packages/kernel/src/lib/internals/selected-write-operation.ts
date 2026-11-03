import { PublicationPreparation } from './publication-preparation';
import type {ClaimedFieldEndpoint,NativeFieldEndpoint} from './native-field-selection';
/** Intercepted semantic intent, before producer-owned ordinary composition. */
export interface SelectedRowIntent {
 readonly source:object; readonly subject:number; readonly key:string|number;
 readonly physicalBefore:unknown; readonly physicalAfter:unknown;
 readonly fields:readonly string[] | null;
 readonly selections:ReadonlyMap<string,NativeFieldEndpoint>;
 readonly prepare:(edits:readonly SelectedRowIntent[],publicationPhase?:PublicationPreparation)=>SelectedInstallation;
}
export interface SelectedRowEdit extends SelectedRowIntent {
 readonly ordinaryBefore:unknown; readonly ordinaryAfter:unknown;
}
export interface SelectedInstallation {install():void;invalidate():void;publish():void;complete():void}
export interface SelectedPreparation {
 stage(edit:SelectedRowIntent):void;
 defer(delivery:()=>void):void;
}
/** Dispatch owns this receipt; closed callbacks must not retain its error. */
export interface SelectedOutcome { failed:boolean; error?:unknown }
interface SelectedForwardingEdge { next?: (invocation:SelectedInvocation)=>void }
export interface SelectedInvocation {
 phase:'open'|'consumed'|'closed';
 request?:{value:unknown;selection:ClaimedFieldEndpoint};
 outcome?:SelectedOutcome;
 edges?:Set<SelectedForwardingEdge>;
}
export function openSelected(value:unknown,selection:ClaimedFieldEndpoint,outcome:SelectedOutcome):SelectedInvocation {
 return {phase:'open',request:{value,selection},outcome};
}
export function closeSelected(invocation:SelectedInvocation):void {
 invocation.phase='closed';
 for(const edge of invocation.edges??[])edge.next=undefined;
 invocation.edges?.clear();invocation.edges=undefined;
 invocation.request=undefined;invocation.outcome=undefined;
}
export function failSelected(invocation:SelectedInvocation,error:unknown):void {
 const outcome=invocation.outcome;
 if(outcome&&!outcome.failed){outcome.failed=true;outcome.error=error;}
 closeSelected(invocation);
}
export function consumeSelected(invocation:SelectedInvocation):{value:unknown;selection:ClaimedFieldEndpoint}{
 if(invocation.phase!=='open'||!invocation.request)throw new Error('Selected continuation is closed or consumed');
 const request=invocation.request;invocation.phase='consumed';invocation.request=undefined;return request;
}
/** Separate lexical scope: a saved wrapper retains only cleared edge/invocation records. */
function makeSelectedProceed(invocation:SelectedInvocation,edge:SelectedForwardingEdge):()=>void {
 return ()=>{
  if(invocation.phase!=='open'||!edge.next)throw new Error('Selected continuation cannot replay');
  const next=edge.next;edge.next=undefined;
  try{next(invocation);}catch(error){failSelected(invocation,error);throw error;}
 };
}
export function selectedProceed(invocation:SelectedInvocation,next:(invocation:SelectedInvocation)=>void):()=>void {
 if(invocation.phase!=='open'||!invocation.request)throw new Error('Selected continuation is closed or consumed');
 const edge:SelectedForwardingEdge={next};
 (invocation.edges??=new Set()).add(edge);
 return makeSelectedProceed(invocation,edge);
}
