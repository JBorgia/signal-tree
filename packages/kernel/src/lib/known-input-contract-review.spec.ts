import {expect,it} from 'vitest';
import {link,signalTree,transactions} from '../index';
import {getPathNotifier} from './path-notifier';
type Experimental=ReturnType<typeof link>&{declare(input:{kind:'independent'},work:()=>unknown):unknown};
const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<60;i++)await Promise.resolve();};
for(const outcome of ['confirm','reject'] as const)it(`known input contradiction retains writes and authority through ${outcome}`,async()=>{
 const t=signalTree({x:0,pair:{x:0,y:0}},{enhancers:[transactions()]});const sent:unknown[]=[];
 const c=link(t.$.pair,{set:value=>{sent.push(value);}}) as Experimental;
 const p=t.transact(()=>t.$.x(7));
 try{await flush();const ownership=p.inspect();let error:unknown;let returned=false;
 try{c.declare({kind:'independent'},()=>t.$(input=>({...input,pair:{x:input.x,y:input.pair.y}})));returned=true;}catch(e){error=e;}
 expect(returned).toBe(false);expect(error).toMatchObject({code:'SIGNALTREE_PUBLICATION_DECLARATION_INVALID',stage:'after-callback',reason:'contradiction'});
 await flush();expect(t.$.pair()).toEqual({x:7,y:0});expect(t.$.x()).toBe(7);expect(p.inspect()).toEqual(ownership);expect(sent).toEqual([]);
 if(outcome==='confirm')p.confirm();else p.rollback();await flush();await c.settled();expect(sent).toEqual([{x:7,y:0}]);
 }finally{c.dispose();t.destroy();}
});
