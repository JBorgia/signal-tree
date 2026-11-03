/** Private, source-issued ordinary field endpoint; ownership is bound by native admission. */
export interface NativeFieldEndpoint {
  readonly present:boolean;
  readonly value:unknown;
  readonly requirement:object;
  readonly owner?:number;
}
export interface NativeFieldSelections {
  before(subject:number,key:string):NativeFieldEndpoint;
  proposed(subject:number,key:string):NativeFieldEndpoint;
  choose(subject:number,key:string,endpoint:NativeFieldEndpoint):void;
}
const ENDPOINTS=Symbol('native-field-endpoints');
export interface NativeFieldPair {readonly before:NativeFieldEndpoint;readonly after:NativeFieldEndpoint}
type Paired = {[ENDPOINTS]?:NativeFieldPair};
export function fieldEndpoints(effect:object):NativeFieldPair|undefined{return (effect as Paired)[ENDPOINTS];}
export function bindFieldEndpoints<T extends object>(effect:T,pair:NativeFieldPair|undefined):T {
  if(pair)(effect as Paired)[ENDPOINTS]=pair;
  else delete (effect as Paired)[ENDPOINTS];
  return effect;
}

/** Match native baseline choice; missing either side clears the complete pair. */
export function composeFieldEndpoints(existing:object,incoming:object,replaceBaseline:boolean):void {
  const first=fieldEndpoints(existing),last=fieldEndpoints(incoming);
  const before=replaceBaseline?last?.before:first?.before;
  bindFieldEndpoints(existing,before&&last?{before,after:last.after}:undefined);
}

export interface ClaimedFieldEndpoint {readonly source:object;readonly subject:number;readonly field:string;readonly endpoint:NativeFieldEndpoint;readonly preparation?:import('./selected-write-operation').SelectedPreparation}
