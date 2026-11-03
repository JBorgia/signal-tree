import {expect,it} from 'vitest';
import {link,signalTree,transactions} from '../index';
import {getPathNotifier} from './path-notifier';
type C=ReturnType<typeof link>&{declare(input:unknown,work:()=>unknown):unknown};
it('actual parent declaration contradiction must not publish inherited scalar through late enrollment',async()=>{
 const tree=signalTree({pair:{x:0,y:0}},{enhancers:[transactions()]});const foreign=signalTree({z:0},{enhancers:[transactions()]});const parent=link(tree.$.pair,{set:()=>{/* Intentionally discard destination values in this proof fixture. */}}) as C;const sent:unknown[]=[];let child:C|undefined;const q=foreign.transact(()=>foreign.$.z(7));
 try{let failure:unknown;try{parent.declare({kind:'independent'},()=>{tree.$.pair.x(7);child=link(tree.$.pair,{set:v=>{sent.push(v);}}) as C;parent.declare({kind:'dependent',owners:[q]},()=>tree.$.pair.y(1));});}catch(error){failure=error;}
 expect(failure).toMatchObject({code:'SIGNALTREE_PUBLICATION_DECLARATION_INVALID',reason:'contradiction'});
 child!.declare({kind:'independent'},()=>tree.$.pair.y(8));getPathNotifier().flushSync();for(let i=0;i<120;i++)await Promise.resolve();
 expect(tree.$.pair()).toEqual({x:7,y:8});expect(foreign.$.z()).toBe(7);expect(sent).toEqual([]);
 }finally{child?.dispose();parent.dispose();q.confirm();tree.destroy();foreign.destroy();}
});
