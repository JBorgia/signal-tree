import {expect,it} from 'vitest';
import {entityMap,link,signalTree,transactions} from '../index';
import {getPathNotifier} from './path-notifier';
import {withWriteContext} from './write-context';
const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<64;i++)await Promise.resolve();};
const inspect=(work:()=>void)=>withWriteContext({participation:'inspection'},work);

for(const kind of ['same-reference','same-fields'] as const)it(`identity row derive ${kind} alone does not adopt`,async()=>{
 const tree=signalTree({rows:entityMap<{id:string;x:number},string>()},{enhancers:[transactions()]});
 tree.$.rows.addOne({id:'a',x:7});await flush();const row=tree.$.rows.byIdOrFail('a');
 const sent:unknown[]=[];const c=link(tree.$.rows,{set:value=>{sent.push(value);}});
 try{inspect(()=>row.x(99));await flush();const p=tree.transact(()=>row(v=>kind==='same-reference'?v:{...v}));
 expect(p.inspect().changes).toEqual([]);p.confirm();await flush();expect(sent).toEqual([]);expect(row.x()).toBe(99);
 // The no-op must not erase ordinary7: a later actual adoption rolls back to7.
 const adoption=tree.transact(()=>row(row()));expect(adoption.inspect().changes.length).toBeGreaterThan(0);adoption.rollback();await flush();expect(row.x()).toBe(7);
 expect(sent.some(v=>JSON.stringify(v).includes('99'))).toBe(false);
 }finally{c.dispose();tree.destroy();}
});
it('same-reference row replacement captures adoption, rolls back to ordinary7, then genuine equality is empty',async()=>{
 const tree=signalTree({rows:entityMap<{id:string;x:number},string>()},{enhancers:[transactions()]});tree.$.rows.addOne({id:'a',x:7});await flush();
 const row=tree.$.rows.byIdOrFail('a'),sent:unknown[]=[];const c=link(tree.$.rows,{set:v=>{sent.push(v);}});
 try{inspect(()=>row.x(99));const p=tree.transact(()=>row(row()));expect(p.inspect().changes.some(v=>v.path.endsWith('.x'))).toBe(true);await flush();expect(sent).toEqual([]);p.rollback();await flush();expect(row.x()).toBe(7);expect(sent.some(v=>JSON.stringify(v).includes('99'))).toBe(false);
 const noop=tree.transact(()=>row(row()));expect(noop.inspect().changes).toEqual([]);noop.confirm();
 }finally{c.dispose();tree.destroy();}
});
it('branch supplied-name adoption with omission rolls back both to ordinary baseline',async()=>{
 const tree=signalTree({profile:{name:'Ada',age:42} as {name:string;age?:number}},{enhancers:[transactions()]});
 const sent:unknown[]=[];const c=link(tree.$.profile,{set:v=>{sent.push(v);}});
 try{inspect(()=>tree.$.profile.name('Inspected'));const p=tree.transact(()=>tree.$.profile({name:'Inspected'}));
 expect(p.inspect().changes.some(v=>v.path.endsWith('.name'))).toBe(true);await flush();expect(sent).toEqual([]);p.rollback();await flush();expect(tree.$.profile()).toEqual({name:'Ada',age:42});expect(sent.some(v=>JSON.stringify(v).includes('Inspected'))).toBe(false);
 }finally{c.dispose();tree.destroy();}
});

const make=()=>signalTree({a:'a0',b:'b0'},{enhancers:[transactions()]});
for(const terminal of ['confirm','reject'] as const)for(const lateOwner of [false,true])it(`undeclared hold then fresh ${terminal} wake; later owner=${lateOwner}`,async()=>{
 const foreign=make(),target=make(),late=make();const sent:unknown[]=[];const foreignSent:Array<{a:string;b:string}>=[];
 const c=link(target.$,{set:v=>{sent.push(structuredClone(v));}}),fc=link(foreign.$,{set:v=>{foreignSent.push(structuredClone(v));}});
 try{await flush();sent.length=0;foreignSent.length=0;const p=foreign.transact(()=>foreign.$.a('THEIRS'));const before=p.inspect();target.$.a('MINE');
 // No flush between authorship and late owner: proves admission-time window.
 const q=lateOwner?late.transact(()=>late.$.a('LATE')):undefined;const qBefore=q?.inspect();
 await flush();expect(target.$.a()).toBe('MINE');expect(sent).toEqual([]);expect(foreignSent).toEqual([]);expect(p.inspect()).toEqual(before);
 let done=false;const wait=c.settled().then(()=>{done=true;});await flush();expect(done).toBe(false);
 if(terminal==='confirm')p.confirm();else p.rollback();await flush();
 expect(sent.length).toBeGreaterThan(0);expect(sent.at(-1)).toEqual({a:'MINE',b:'b0'});expect(target.$.a()).toBe('MINE');expect(done).toBe(true);await wait;
 if(terminal==='reject'){expect(foreign.$.a()).toBe('a0');expect(foreignSent.every(v=>v.a!=='THEIRS')).toBe(true);}else expect(foreignSent.at(-1)).toEqual({a:'THEIRS',b:'b0'});
 if(q){expect(q.inspect()).toEqual(qBefore);expect(late.$.a()).toBe('LATE');q.rollback();}
 }finally{c.dispose();fc.dispose();target.destroy();late.destroy();foreign.destroy();}
});
it('settling one of two captured owners cannot release; final rejection wakes useful surviving value',async()=>{
 const a=make(),b=make(),target=make();const sent:unknown[]=[];const c=link(target.$,{set:v=>{sent.push(structuredClone(v));}});
 try{await flush();sent.length=0;const p=a.transact(()=>a.$.a('P'));const q=b.transact(()=>b.$.a('Q'));target.$.a('MINE');await flush();expect(sent).toEqual([]);
 let done=false;const wait=c.settled().then(()=>{done=true;});p.confirm();await flush();expect(sent).toEqual([]);expect(done).toBe(false);expect(b.$.a()).toBe('Q');
 q.rollback();await flush();expect(b.$.a()).toBe('a0');expect(sent.length).toBeGreaterThan(0);expect(sent.at(-1)).toEqual({a:'MINE',b:'b0'});expect(done).toBe(true);await wait;
 }finally{c.dispose();target.destroy();b.destroy();a.destroy();}
});
