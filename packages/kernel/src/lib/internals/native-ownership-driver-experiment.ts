import { markOwnerInvalidatedFrom } from './owner-invalidation-port';
import { SignalTreeRollbackError } from '../types';
import { attachPreparation, detachPreparation, type Installation } from './native-ownership-experiment';
import { getTreeScalarSlotRuntime } from './tree-scalar-slot-port';
import { NODE_STORE_SYMBOL } from './node-shape';
import { setMemberPresence, republishMembers } from './member-membership';

type Fact = { value: unknown; order: number };
type Ledger = { base: Fact; contributions: Map<number,Fact> };
/** Bounded internal experiment; native values are the only committed store. */
export function nativeOwnershipExperiment(root: object) {
  const runtime = getTreeScalarSlotRuntime(root);
  if (!runtime) throw new Error('Missing native scalar runtime');
  const ledgers = new Map<string,Ledger>();
  const installs = new Map<string,(value:unknown)=>void>();
  const attached: object[]=[];
  let order=0, owner=0, active: number | undefined, settling=false;
  let fault: {error:unknown,after:number}|undefined;
  const owners=new Map<number,Set<string>>();
  const hook=(target:object,prefix:string,install:(key:number|string,value:unknown)=>void) => {
    attached.push(target);
    attachPreparation(target,(changes:readonly Installation[])=>{
      if(settling)return;
      if(fault && --fault.after<=0){const {error}=fault;fault=undefined;throw error;}
      const plans=changes.map(change=>{
        const key=prefix+change.key, old=ledgers.get(key);
        const next:Ledger=old?{base:old.base,contributions:new Map(old.contributions)}:{base:{value:change.before,order:0},contributions:new Map()};
        const fact={value:change.after,order:++order};
        if(active!==undefined)next.contributions.set(active,fact);else next.base=fact;
        return {key,next,write:(value:unknown)=>install(change.key,value)};
      });
      return ()=>{for(const p of plans){if(p.next.contributions.size){ledgers.set(p.key,p.next);installs.set(p.key,p.write);if(active!==undefined)owners.get(active)!.add(p.key);}else{ledgers.delete(p.key);installs.delete(p.key);}}};
    });
  };
  hook(runtime,'s:',(key,value)=>{const frame=runtime.beginFrame();frame.set(Number(key),value);frame.commit();});
  let branch=0;
  const walk=(node:object)=>{
    const id=++branch;
    const install=(key:number|string,value:unknown)=>{setMemberPresence(node,String(key),value?'active':'dormant');republishMembers(node,[String(key)]);};
    hook(node,`p${id}:`,install);
    const store=(node as Record<symbol,unknown>)[NODE_STORE_SYMBOL];
    if(store && typeof store==='object')hook(store,`p${id}:`,install);
    for(const key of Object.keys(node)){
      const member=(node as Record<string,unknown>)[key];
      if(typeof member==='function' && (member as unknown as Record<symbol,unknown>)[NODE_STORE_SYMBOL])walk(member);
    }
  };
  walk(root);
  const settle=(id:number,accept:boolean)=>{
    if(!owners.has(id))return;
    if(fault){const {error}=fault;fault=undefined;throw error;}
    const plans=[];
    for(const key of owners.get(id)!){
      const old=ledgers.get(key)!;
      const contribution=old.contributions.get(id);if(!contribution)continue;
      const next={base:accept && contribution.order>old.base.order?contribution:old.base,contributions:new Map(old.contributions)};
      next.contributions.delete(id);
      let visible=next.base;for(const c of next.contributions.values())if(c.order>visible.order)visible=c;
      plans.push({key,next,value:visible.value,write:installs.get(key)!});
    }
    runtime.runInvalidationGroup(()=>{
      settling=true;
      try {for(const p of plans)p.write(p.value);}finally{settling=false;}
      for(const p of plans){if(p.next.contributions.size)ledgers.set(p.key,p.next);else{ledgers.delete(p.key);installs.delete(p.key);}}
      owners.delete(id);
      if(plans.length)markOwnerInvalidatedFrom(root);
    });
  };
  return {
    begin(fn:()=>void){
      const id=++owner;owners.set(id,new Set());const previous=active;active=id;
      const handle={rollback:()=>settle(id,false),confirm:()=>settle(id,true),inspect:()=>({changes:[...(owners.get(id)??[])]})};
      try{fn();}catch(callbackError){
        active=previous;
        try{settle(id,false);}catch(cause){const error=new SignalTreeRollbackError(undefined,{cause});Object.defineProperty(error,'recovery',{value:{transaction:handle,callbackFailed:true,callbackError}});throw error;}
        throw callbackError;
      }finally{active=previous;}
      return handle;
    },
    fail(error:unknown,after=1){fault={error,after};},
    stats(){return {pending:owners.size,ledgers:ledgers.size};},
    destroy(){for(const target of attached)detachPreparation(target);owners.clear();ledgers.clear();installs.clear();},
  };
}
