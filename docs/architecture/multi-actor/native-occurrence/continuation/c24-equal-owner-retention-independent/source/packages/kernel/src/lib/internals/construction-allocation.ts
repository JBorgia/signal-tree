import type {TerminalRecordPlan} from './intrinsic-mutation';
/** One member construction owns only its own provisional resources. */
export class ConstructionAllocation {
 private state: 'preparing'|'installed'|'canceled' = 'preparing';
 private attaches: Array<()=>void> = [];
 private cancels: Array<()=>void> = [];
 private checks: Array<()=>void> = [];
 get installed():boolean{return this.state==='installed';}
 add(attach:()=>void, cancel:()=>void = ()=>{}, validate:()=>void = ()=>{}):void {
  if(this.state!=='preparing')throw new Error('Closed member construction');
  this.attaches.push(attach);this.cancels.push(cancel);this.checks.push(validate);
 }
 validate():void {for(const check of this.checks)check();}
 install():void {
  if(this.state!=='preparing')throw new Error('Closed member construction');
  for(const attach of this.attaches)attach();
  this.state='installed';this.clear();
 }
 cancel():void {
  if(this.state!=='preparing')return;
  this.state='canceled';
  try{for(const cancel of this.cancels.reverse())cancel();}finally{this.clear();}
 }
 private clear():void{this.attaches=[];this.cancels=[];this.checks=[];}
}

/** Prepared by the source constructor; never reconstruct responsibility at install. */
export interface PreparedMemberConstruction {
 readonly child:object;
 readonly responsibility?:TerminalRecordPlan;
 readonly allocation:ConstructionAllocation;
}
