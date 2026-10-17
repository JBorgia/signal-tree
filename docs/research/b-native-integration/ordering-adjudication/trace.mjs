// Diagnostic wrappers only. Imports the unchanged rejected model.
import { OrderingModel } from '../ordering-model/model.mjs';
const keys = (state) => {
  const out=[];
  for(let id=state.head; id!==undefined; id=state.nodes.get(id).next)out.push(state.nodes.get(id).key);
  return out;
};
const model = new OrderingModel(['A','B','C']);
const log=[];
for(const name of ['apply','undo']) {
  const original=model[name];
  model[name]=function(state, input) {
    const before=keys(state); const result=original.call(this,state,input);
    log.push({method:name,phase:this.phase,kind:input?.kind,id:input?.id,before,after:keys(state)});
    return result;
  };
}
const owner=model.begin(); model.remove(model.id('B'),owner); model.front(model.id('C'));
const beforeFirst={keys:model.keys(),pending:[...model.pending],stats:model.stats()};
let firstError;
try {model.settle(owner,false);} catch(error) {firstError=error.message;}
const afterFirst={keys:model.keys(),pending:[...model.pending],stats:model.stats()};
model.front(model.id('A'));
const beforeRetry={keys:model.keys(),pending:[...model.pending],stats:model.stats()};
const offset=log.length;
model.settle(owner,false);
const afterRetry={keys:model.keys(),pending:[...model.pending],stats:model.stats()};
const churn = new OrderingModel(); const held=[];
for(let i=0;i<8;i++){const id=churn.append('same-key');held.push(churn.held(id));churn.remove(id);}
const retained={stats:churn.stats(),keys:churn.keys(),pending:[...churn.pending],events:churn.events.length,head:churn.state.head??null,tail:churn.state.tail??null,nodes:[...churn.state.nodes].map(([id,n])=>({id,...n})),heldReads:held.map(h=>churn.read(h)??null)};
// Exercise existing cleanup, without altering the model or claiming this is a remedy.
const emptyOwner=churn.begin();churn.settle(emptyOwner,true);
const afterExistingCleanup={stats:churn.stats(),heldReads:held.map(h=>churn.read(h)??null)};
const recovery=new OrderingModel(['A','B','C']);const p=recovery.begin();
recovery.exact(['C','A','B'].map(k=>recovery.id(k)),p);
recovery.exact(['B','C','A'].map(k=>recovery.id(k)));
const genuinelyRetained={stats:recovery.stats(),events:recovery.events.map(e=>({kind:e.kind,owner:e.owner??null,orderLive:e.orderLive,inverse:e.inverse})),dependencies:recovery.dependencies()};
recovery.settle(p,false);
console.log(JSON.stringify({beforeFirst,firstError,afterFirst,beforeRetry,retryTrace:log.slice(offset),afterRetry,retained,afterExistingCleanup,genuinelyRetained,recoveryAfter:{keys:recovery.keys(),stats:recovery.stats()}},null,2));
