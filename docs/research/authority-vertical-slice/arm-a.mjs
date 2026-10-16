// Bounded authoritative-state arm. Native projection has no write capability.
export function createStore() {
  const truth = new Map(), native = new Map(), owners = new Map(), observers = new Set();
  let revision=0, sequence=0, nextOwner=1, nextLife=1, current=null, dead=false;
  let faultSet=false, fault, faultAfter=0, queued=false, undoCommand=null, recording=null;
  const errors=[];
  let counters;
  const zero=()=>({visitedLocations:0,preparedCellCopies:0,preparedRecordCopies:0,indexNodes:0,namedModelObjects:0,nativeWrites:0,publications:0,snapshotEnumerations:0,installedUnits:0,observerDeliveries:0,resolutionVisits:0,currentStateCopies:0,readReturnedCopies:0});
  counters=zero();
  const alive=()=>{if(dead)throw new Error('Destroyed store');};
  const clone=(v,read=false)=> { if(v!==null && typeof v==='object') {const result=structuredClone(v), seen=new Set(), todo=[result];while(todo.length){const x=todo.pop();if(x===null||typeof x!=='object'||seen.has(x))continue;seen.add(x);if(read)counters.readReturnedCopies++;else{counters.preparedRecordCopies++;counters.namedModelObjects++;}for(const value of Object.values(x))todo.push(value);}return result;}return v;};
  const absent=()=>({present:false});
  const copy=s=>{counters.preparedCellCopies++;counters.namedModelObjects++;return s.present?{present:true,value:clone(s.value)}:absent();};
  const keyOf=k=>'c:'+k, entityKey=k=>'e:'+k;
  function effective(rec) {let best=rec.base;for(const c of rec.pending.values()){counters.resolutionVisits++;if(c.order>best.order)best=c;}return best.state;}
  function checkFault(prepared=0){if(faultSet&&prepared===faultAfter){const e=fault;faultSet=false;fault=undefined;throw e;}}
  function delivery(){queued=false;if(dead)return;const list=[...observers];for(const fn of list){if(!observers.has(fn))continue;try{counters.publications++;counters.observerDeliveries++;fn();}catch(e){errors.push(e);}}}
  function publish(){if(!queued && observers.size){queued=true;queueMicrotask(delivery);}}
  function stage(k,state,owner,order) {
    counters.visitedLocations++;
    const old=truth.get(k);
    const rec={base:old?.base??{order:0,state:absent()},pending:new Map(old?.pending)};
    counters.namedModelObjects+=old?2:4;counters.indexNodes+=rec.pending.size;
    const entry={order,state:copy(state)};counters.namedModelObjects++;
    if(owner){if(!rec.pending.has(owner.id))counters.indexNodes++;rec.pending.set(owner.id,entry);}else rec.base=entry;
    const projection=copy(effective(rec));counters.currentStateCopies++;
    return {k,rec,projection};
  }
  function install(stages,base,terminal){if(revision!==base)throw new Error('Preparation revision changed');
    for(const s of stages){if(!s.rec.base.state.present&&!s.rec.pending.size)truth.delete(s.k);else truth.set(s.k,s.rec);
      if(s.projection.present)native.set(s.k,s.projection);else native.delete(s.k);counters.nativeWrites++;}
    if(terminal)terminal();revision++;counters.installedUnits++;publish();
  }
  function writeState(k,state){alive();checkFault();const base=revision;
    const prior=recording&&!recording.has(k)?copy(native.get(k)??absent()):null;
    const order=sequence+1;const staged=stage(k,state,current,order);checkFault(1);
    install([staged],base,()=>{sequence=order;if(current)current.touched.add(k);if(prior)recording.set(k,prior);});
  }
  function settle(owner,accept){alive();if(owner.status!=='pending')return;checkFault();const base=revision,stages=[];
    for(const k of owner.touched){counters.visitedLocations++;const old=truth.get(k);if(!old)throw new Error('Missing authority');
      const rec={base:old.base,pending:new Map(old.pending)};counters.namedModelObjects+=2;counters.indexNodes+=rec.pending.size;
      const own=rec.pending.get(owner.id);if(!own)throw new Error('Missing contribution');
      rec.pending.delete(owner.id);if(accept&&own.order>rec.base.order)rec.base=own;
      const projection=copy(effective(rec));counters.currentStateCopies++;stages.push({k,rec,projection});checkFault(stages.length);}
    install(stages,base,()=>{owner.status=accept?'accepted':'rejected';owner.touched.clear();owners.delete(owner.id);});
  }
  const reference=(key,id)=>{counters.namedModelObjects++;return Object.freeze({id,read(){alive();const s=native.get(entityKey(key));return s?.present&&s.value.id===id?clone(s.value.value,true):undefined;},write(value){alive();const s=native.get(entityKey(key));if(!s?.present||s.value.id!==id)throw new Error('Retired entity reference');writeState(entityKey(key),{present:true,value:{id,value}});}});};
  const api={
    write(k,value){writeState(keyOf(k),{present:true,value});},remove(k){alive();if(!native.has(keyOf(k)))return;writeState(keyOf(k),absent());},
    read(k){alive();const s=native.get(keyOf(k));counters.readReturnedCopies++;return s?.present?{present:true,value:clone(s.value,true)}:absent();},
    begin(fn){alive();const owner={id:nextOwner++,status:'pending',touched:new Set()};counters.namedModelObjects+=3;owners.set(owner.id,owner);
      const handle=Object.freeze({accept:()=>settle(owner,true),reject:()=>settle(owner,false),state(){alive();return owner.status;}});
      const before=current;current=owner;let thrown=false,error;
      try{fn();}catch(e){thrown=true;error=e;}finally{current=before;}
      if(thrown){try{settle(owner,false);}catch(recoveryError){if(error instanceof Error&&Object.isExtensible(error)){Object.defineProperty(error,'recovery',{value:handle,configurable:true});Object.defineProperty(error,'recoveryError',{value:recoveryError,configurable:true});}}throw error;}return handle;
    },
    undoable(fn){alive();if(current)throw new Error('Undoable inside pending contribution unsupported');const previous=recording,command=new Map();recording=command;try{fn();}finally{recording=previous;undoCommand=command;}},
    undo(){alive();if(!undoCommand)return;if(owners.size)throw new Error('Undo while pending is refused');checkFault();const base=revision,stages=[];let order=sequence;
      for(const [k,state] of undoCommand){stages.push(stage(k,state,null,++order));checkFault(stages.length);}
      install(stages,base,()=>{sequence=order;undoCommand=null;});},
    add(key,value){alive();if(native.has(entityKey(key)))throw new Error('Duplicate live entity key');const id=nextLife++;writeState(entityKey(key),{present:true,value:{id,value}});return reference(key,id);},
    removeEntity(key){alive();if(!native.has(entityKey(key)))throw new Error('Entity not found');writeState(entityKey(key),absent());},get(key){alive();const s=native.get(entityKey(key));return s?.present?reference(key,s.value.id):undefined;},
    snapshot(){alive();const cells={},entities=[];for(const [k,s] of native){counters.snapshotEnumerations++;if(k.startsWith('c:'))Object.defineProperty(cells,k.slice(2),{value:clone(s.value,true),enumerable:true,writable:true,configurable:true});else entities.push({key:k.slice(2),id:s.value.id,value:clone(s.value.value,true)});}return {cells,entities};},
    observe(fn){alive();observers.add(fn);return ()=>observers.delete(fn);},async flush(){alive();for(let i=0;i<1000;i++){await Promise.resolve();if(!queued)return;}throw new Error('Observer delivery did not quiesce');},takeErrors(){return errors.splice(0);},
    failNextPreparation(error,options){alive();const after=options?.afterPrepared??0;if(!Number.isInteger(after)||after<0)throw new Error('Invalid prepared-location boundary');faultSet=true;fault=error;faultAfter=after;},
    stats(){let pendingContributions=0;for(const r of truth.values())pendingContributions+=r.pending.size;return {...counters,canonicalLocations:truth.size,nativeLocations:native.size,pendingOwners:owners.size,pendingContributions,undoFacts:undoCommand?.size??0};},resetStats(){counters=zero();},
    destroy(){if(dead)return;dead=true;truth.clear();native.clear();owners.clear();observers.clear();undoCommand=null;recording=null;current=null;fault=undefined;faultSet=false;errors.length=0;}
  };return api;
}
