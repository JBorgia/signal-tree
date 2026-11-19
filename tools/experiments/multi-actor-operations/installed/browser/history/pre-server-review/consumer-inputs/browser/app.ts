import { Component, signal, type OnDestroy } from '@angular/core';
import { external, signalTree, transactions, entityMap, type PendingTransaction } from '@signal-tree/angular';
import { transactionLifecycleReader, activeTransactionContext } from '@signal-tree/kernel/internals';
import { OperationCoordinator, type Review, type OperationState, type Command } from '../coordinator.mjs';
import { DispatchBackend, type DispatchProposal } from '../dispatch-fixture.mjs';
import { dispatchToolStream } from './ag-ui.mjs';

type Phase = 'idle'|'draft'|'reviewed'|'delivering'|'uncertain'|'succeeded'|'failed'|'rejected'|'local-pending'|'disposed';
type Current = {id:string;local:PendingTransaction;transactionId:number;binding?:Review<DispatchProposal>;terminal?:'confirmed'|'rolled-back';outcome?:OperationState<DispatchProposal>;withdrawn?:boolean};
@Component({selector:'operation-browser',standalone:true,template:`
 <h1>Dispatch operation review</h1>
 <p>Installed SignalTree Angular · AOT · in-browser test authority, not durable storage</p>
 <p>Outcome: <strong data-testid="phase">{{phase()}}</strong></p>
 <p>Server outcome: <span data-testid="server-outcome">{{serverOutcome()}}</span>; local settlement: <span data-testid="local-outcome">{{localOutcome()}}</span></p>
 <p data-testid="message">{{message()}}</p>
 @if (phase() !== 'disposed') {
  <p>Local route: <strong data-testid="route">{{tree.$.route()}}</strong></p>
  <p>Capacity: <span data-testid="capacity">{{tree.$.capacity()}}</span></p>
  <label>Independent note <input #note aria-label="Independent note" [value]="tree.$.note()" (input)="editNote(note.value)" /></label>
  <p data-testid="note">{{tree.$.note()}}</p>
 }
 <p>Native pending IDs: <span data-testid="pending">{{pendingIds()}}</span></p>
 <p>Executor attribution: <span data-testid="actor">{{actor()}}</span></p>
 <p>Reviewed proposal: <span data-testid="review">{{reviewText()}}</span></p>
 <button (click)="propose()" [disabled]="!canPropose()">Propose via AG-UI</button>
 <button (click)="review()" [disabled]="phase() !== 'draft'">Review</button>
 <button (click)="apply()" [disabled]="phase() !== 'reviewed'">Apply reviewed</button>
 <button (click)="reject()" [disabled]="phase() !== 'draft' && phase() !== 'reviewed'">Reject proposal</button>
 <button (click)="retry()" [disabled]="phase() !== 'uncertain'">Retry receipt</button>
 <button (click)="retryLocal()" [disabled]="phase() !== 'local-pending'">Retry local settlement</button>
 <button (click)="capacityAba()" [disabled]="busy() || phase() === 'disposed' || phase() === 'uncertain'">External capacity ABA</button>
 <button (click)="failNext()" [disabled]="busy() || phase() === 'disposed'">Fail next persistence</button>
 <button (click)="loseNext()" [disabled]="busy() || phase() === 'disposed'">Lose next acknowledgment</button>
 <button (click)="dispose()" [disabled]="phase() === 'disposed'">Dispose session</button>
 <p data-testid="destroyed">Tree cleanup callbacks: {{destroyed()}}</p>
 <fieldset><legend>Adversarial fixture controls (not business actions)</legend>
 <button (click)="addBlocker()" [disabled]="phase() !== 'reviewed' || hasBlocker()">Create overlapping route work</button>
 <button (click)="resolveBlocker()" [disabled]="!hasBlocker() || busy()">Resolve overlapping route work</button>
 <button (click)="armObserver()" [disabled]="!canPropose()">Arm rollback observer failure</button>
 <p data-testid="observer-armed">{{observerArmed()}}</p>
 <p>Transport calls: <span data-testid="deliveries">{{deliveries()}}</span></p>
 </fieldset>
 <hr/><h2>Test authority diagnostics (not a client receipt)</h2>
 <p>Committed route: <span data-testid="server-route">{{serverRoute()}}</span></p>
 <p>Capacity revision: <span data-testid="server-version">{{capacityVersion()}}</span></p>
 <p>Commits: <span data-testid="commits">{{commits()}}</span></p>
`})
export class BrowserReference implements OnDestroy {
 readonly tree=signalTree({route:'north',capacity:10,note:'',observerRows:entityMap<{id:string},string>()},{enhancers:[transactions()]});
 readonly phase=signal<Phase>('idle'); readonly message=signal('No proposal or approval');
 readonly reviewText=signal('none');readonly actor=signal('unknown');readonly pendingIds=signal('');
 readonly serverRoute=signal('north');readonly capacityVersion=signal(0);readonly commits=signal(0);readonly destroyed=signal(0);readonly busy=signal(false);
 readonly serverOutcome=signal('none');readonly localOutcome=signal('none');readonly deliveries=signal(0);readonly hasBlocker=signal(false);readonly observerArmed=signal(false);
 private blocker:PendingTransaction|undefined;
 private observerOff:(()=>void)|undefined;
 private readonly backend=new DispatchBackend();
 private lose=false;
 private readonly operations=new OperationCoordinator<DispatchProposal>({apply:(command:Command<DispatchProposal>)=>{
  this.deliveries.update(n=>n+1);
  const receipt=this.backend.apply(command);this.refreshAuthority();
  if(this.lose){this.lose=false;throw new Error('Acknowledgment lost; command outcome unknown to client');}
  return receipt;
 }});
 private readonly reader=transactionLifecycleReader(this.tree)!;
 private readonly off=this.reader.subscribe(e=>{
  this.pendingIds.set(e.snapshot.pending.map(p=>p.transactionId).join(','));
  if(this.current?.transactionId===e.transactionId && (e.kind==='confirmed'||e.kind==='rolled-back'))this.current.terminal=e.kind;
 });
 private current:Current|undefined;
 constructor(){this.tree.registerCleanup(()=>this.destroyed.update(n=>n+1));}
 canPropose():boolean{return !this.current && !this.hasBlocker() && !this.busy() && this.phase()!=='disposed';}
 private refreshAuthority():void{const s=this.backend.snapshot();this.serverRoute.set(s.values.route);this.capacityVersion.set(s.versions.capacity);this.commits.set(this.backend.commits);}
 private setError(error:unknown):void{this.message.set(error instanceof Error?error.message:String(error));}
 private proposal(patch:unknown,reads:readonly string[]|undefined,observed:ReturnType<DispatchBackend['snapshot']>):DispatchProposal{
  if(typeof patch!=='object'||patch===null||Array.isArray(patch)||!('route' in patch)||typeof patch.route!=='string'||Object.keys(patch).some(k=>k!=='route')||reads?.some(k=>k!=='capacity'))throw new Error('Unsupported dispatch proposal');
  return this.backend.proposal({route:patch.route},['capacity'],observed);
 }
 propose():void{
  if(!this.canPropose())return;
  const runId=crypto.randomUUID();const threadId='browser-session';const call='dispatch';
  const observed=this.backend.snapshot(); // Bind the packet before constructing the producer stream.
  const stream=dispatchToolStream({coordinator:this.operations,makeProposal:(patch,reads)=>this.proposal(patch,reads,observed)});
  try{
   stream.consume({type:'RUN_STARTED',threadId,runId});
   stream.consume({type:'TOOL_CALL_START',toolCallId:call,toolCallName:'propose_dispatch'});
   stream.consume({type:'TOOL_CALL_ARGS',toolCallId:call,delta:'{"patch":{"route":'});
   stream.consume({type:'TOOL_CALL_ARGS',toolCallId:call,delta:'"west"},"reads":["capacity"]}'});
   const operation=stream.consume({type:'TOOL_CALL_END',toolCallId:call});
   if(!operation||typeof operation.proposal.patch.route!=='string')throw new Error('No proposal');
   const route=operation.proposal.patch.route;
   let transactionId:number|undefined;
   const local=this.tree.transact(()=>{
    transactionId=activeTransactionContext()?.id;
    this.tree.$.route.set(route);
    if(this.observerArmed())this.tree.$.observerRows.addOne({id:operation.id});
   });
   if(transactionId===undefined)throw new Error('Missing native transaction identity');
   this.current={id:operation.id,local,transactionId};
   this.serverOutcome.set('none');this.localOutcome.set('pending');
   stream.consume({type:'RUN_FINISHED',threadId,runId});
   this.phase.set('draft');this.actor.set(operation.actor.kind);this.reviewText.set('none');this.message.set('Tool output is a draft; no approval or backend execution');
  }catch(e){this.setError(e);}finally{stream.dispose();}
 }
 review():void{if(!this.current||this.phase()!=='draft')return;this.current.binding=this.operations.review(this.current.id);this.reviewText.set(JSON.stringify(this.current.binding.proposal));this.phase.set('reviewed');this.message.set('Review captured; backend will revalidate declared versions');}
 async apply():Promise<void>{if(!this.current?.binding||this.phase()!=='reviewed')return;this.operations.approve(this.current.binding);await this.deliver();}
 async retry():Promise<void>{if(this.phase()==='uncertain')await this.deliver();}
 private async deliver():Promise<void>{
  const current=this.current;if(!current)return;
  this.phase.set('delivering');this.busy.set(true);
  try{const outcome=await this.operations.deliver(current.id);this.finish(current,outcome);}catch(e){this.setError(e);}finally{this.busy.set(false);this.refreshAuthority();}
 }
 private finish(current:Current,outcome:OperationState<DispatchProposal>):void{
  if(outcome.status==='uncertain'){this.serverOutcome.set('uncertain');this.phase.set('uncertain');this.message.set('Outcome uncertain; native transaction remains pending. Retry the same command.');return;}
  if(outcome.status!=='succeeded'&&outcome.status!=='failed')throw new Error('Nonterminal delivery response');
  current.outcome=outcome;
  this.serverOutcome.set(outcome.status==='succeeded'?'applied':'rejected');
  this.settleLocal(current);
 }
 // A terminal remote outcome is retained independently; this path never calls deliver().
 retryLocal():void{if(this.current&&this.phase()==='local-pending')this.settleLocal(this.current);}
 private settleLocal(current:Current):void{
  const accepted=current.outcome?.status==='succeeded';
  if(!current.withdrawn&&!current.outcome)throw new Error('No settlement decision');
  const expected=accepted?'confirmed':'rolled-back';
  let error:unknown;let threw=false;
  if(!current.terminal){
   try{if(accepted)current.local.confirm();else current.local.rollback();}
   catch(e){error=e;threw=true;}
  }
  const pending=this.reader.snapshot().pending.some(p=>p.transactionId===current.transactionId);
  // Absence alone is not evidence of which terminal disposition happened.
  if(pending||current.terminal!==expected){
   this.phase.set('local-pending');this.localOutcome.set(pending?'pending':'unverified');
   this.message.set(`Local settlement needs recovery; server outcome stays ${this.serverOutcome()}. ${threw?String(error):'Expected lifecycle transition not observed'}`);
   return;
  }
  this.localOutcome.set(expected);
  const phase=current.withdrawn?'rejected':accepted?'succeeded':'failed';
  this.phase.set(phase);
  const detail=current.withdrawn?'Unsent proposal rejected; no backend command':accepted?'Backend applied receipt received; native transaction confirmed':`Backend rejected: ${String(current.outcome?.receipt?.reason)}; local proposal rolled back`;
  this.message.set(detail+(threw?`; observer error after terminal ${expected}: ${String(error)}`:''));
  this.operations.forget(current.id);this.current=undefined;
  this.observerOff?.();this.observerOff=undefined;this.observerArmed.set(false);
 }
 reject():void{
  const current=this.current;if(!current||!['draft','reviewed'].includes(this.phase()))return;
  this.operations.reject(current.id);current.withdrawn=true;this.settleLocal(current);
 }
 addBlocker():void{
  if(this.phase()!=='reviewed'||this.blocker)return;
  this.blocker=this.tree.transact(()=>this.tree.$.route.set('east'));this.hasBlocker.set(true);
 }
 resolveBlocker():void{
  if(!this.blocker||this.busy())return;
  try{this.blocker.rollback();this.blocker=undefined;this.hasBlocker.set(false);}
  catch(e){this.setError(e);}
 }
 armObserver():void{
  if(!this.canPropose())return;
  this.observerOff?.();
  this.observerOff=this.tree.$.observerRows.tap({onRemove:()=>{throw new Error('adversarial removal observer');}});
  this.observerArmed.set(true);
 }
 editNote(value:string):void{if(this.phase()!=='disposed')this.tree.$.note.set(value);}
 async capacityAba():Promise<void>{
  if(this.busy()||['disposed','uncertain'].includes(this.phase()))return;
  this.busy.set(true);const service=new OperationCoordinator<DispatchProposal>(this.backend);
  try{for(const capacity of [5,10]){const id=crypto.randomUUID();service.create(id,this.backend.proposal({capacity}));service.approve(service.review(id));const result=await service.deliver(id);if(result.status!=='succeeded')throw new Error('Capacity service failed');external(()=>this.tree.$.capacity.set(capacity));service.forget(id);}this.message.set('Capacity returned to 10; authoritative revision advanced twice');}
  catch(e){this.setError(e);}finally{this.busy.set(false);service.dispose();this.refreshAuthority();}
 }
 failNext():void{this.backend.failNextPersistence();this.message.set('Next test-authority persistence rejects before installation');}
 loseNext():void{this.lose=true;this.message.set('Next acknowledgment will be lost after authority applies');}
 dispose():void{
  if(this.phase()==='disposed')return;
  if(this.busy()||this.phase()==='uncertain'||this.phase()==='local-pending'||this.hasBlocker()){this.message.set('Resolve in-flight, uncertain or local pending work before disposal; responsibility retained, cleanup not performed');return;}
  if(this.current){this.reject();if(this.current)return;}
  this.operations.dispose();this.observerOff?.();this.off();this.tree.destroy();this.phase.set('disposed');this.message.set('Session disposed; no pending native authority');
 }
// Unresolved destruction refuses cleanup; no durable transfer or navigation recovery is claimed.
 ngOnDestroy():void{this.dispose();}
}
