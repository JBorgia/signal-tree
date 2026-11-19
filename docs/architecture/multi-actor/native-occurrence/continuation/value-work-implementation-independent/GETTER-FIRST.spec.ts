import {expect,it} from 'vitest';
import {link,signalTree} from '../index';
import {getPathNotifier} from './path-notifier';
const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<120;i++)await Promise.resolve();};
it('branch input accessors normalize to data properties before later scalar reduction',async()=>{
 const stacks:string[]=[];let gets=0;
 const input={get a(){gets++;stacks.push(new Error().stack??'');return 0;},b:0};
 const t=signalTree(input);const sent:unknown[]=[];const c=link(t.$,{set(v){sent.push(v);}});
 try{expect(gets).toBeGreaterThan(0);expect(Object.getOwnPropertyDescriptor(t.$(),'a')?.get).toBeUndefined();const before=gets;t.$.b(3);await flush();expect(sent).toEqual([{a:0,b:3}]);expect(gets).toBe(before);expect(stacks.some(s=>/at ready\b/.test(s))).toBe(false);}
 finally{c.dispose();t.destroy();}
});
it('inbound branch accessors are read during source application rather than retained on reduced ancestor payload',async()=>{
 const t=signalTree({nested:{a:0,b:0}}),sent:unknown[]=[];let incoming:((v:{nested:{a:number;b:number}})=>void)|undefined;let gets=0;const stacks:string[]=[];
 const c=link(t.$,{set(v){sent.push(v);},subscribe(next){incoming=next;return()=>undefined;}});
 try{expect(incoming).toBeTypeOf('function');incoming!({nested:{get a(){gets++;stacks.push(new Error().stack??'');return 1;},b:0}});await flush();expect(gets).toBeGreaterThan(0);expect(t.$()).toEqual({nested:{a:1,b:0}});expect(Object.getOwnPropertyDescriptor(t.$().nested,'a')?.get).toBeUndefined();const before=gets;t.$.nested.b(3);await flush();expect(sent.at(-1)).toEqual({nested:{a:1,b:3}});expect(gets).toBe(before);expect(stacks.some(s=>/at ready\b/.test(s))).toBe(false);}
 finally{c.dispose();t.destroy();}
});
