import type { Actor, JsonValue, OperationCoordinator, OperationState } from '../coordinator.mjs';
export type ToolEvent =
 | {type:'RUN_STARTED'|'RUN_FINISHED';threadId:string;runId:string}
 | {type:'TOOL_CALL_START';toolCallId:string;toolCallName:string}
 | {type:'TOOL_CALL_ARGS';toolCallId:string;delta:string}
 | {type:'TOOL_CALL_END';toolCallId:string}
 | {type:'RUN_ERROR';message?:string};
export function dispatchToolStream<P extends JsonValue>(options:{
 coordinator:OperationCoordinator<P>;
 makeProposal:(patch:unknown,reads?:readonly string[])=>P;
 actor?:Actor;maxBytes?:number;maxCalls?:number;
}):{consume(event:ToolEvent):OperationState<P>|undefined;dispose():void};
