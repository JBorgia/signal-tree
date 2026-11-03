import { expect, it } from 'vitest';
import { entityMap, link, signalTree, transactions, type TreeNode } from '../index';
import { getPathNotifier } from './path-notifier';

type Experimental=ReturnType<typeof link>&{declare(input:{kind:'independent'}|{kind:'dependent';owners:readonly object[]},work:()=>unknown):{read():unknown}};
const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<120;i++)await Promise.resolve();};

it('review seed created during open horizon retains later invalidation and its fixed window',async()=>{
 const tree=signalTree({rows:entityMap<{id:string;x:number;y:number},string>()},{enhancers:[transactions()]});
 const foreign=signalTree({x:0},{enhancers:[transactions()]});
 tree.$.rows.addOne({id:'a',x:0,y:0});await flush();
 const c0=link(tree.$.rows,{set:()=>undefined}) as Experimental;
 const sent:unknown[]=[];let c1:Experimental|undefined;
 const q=foreign.transact(()=>foreign.$.x(9));
 try{
  const sentinel=new Error('outer validation fails after enrollment');
  let failure:unknown;
  try{c0.declare({kind:'independent'},()=>{
   tree.$.rows.updateOne('a',{x:7});
   c1=link(tree.$.rows,{set:v=>{sent.push(v);}}) as Experimental;
   throw sentinel;
  });}catch(error){failure=error;}
  expect(failure).toBe(sentinel);expect(c1).toBeDefined();
  const receipt=c1!.declare({kind:'independent'},()=>tree.$.rows.updateOne('a',{y:8}));
  await flush();
  console.info('REVIEW-OPEN-SEED',JSON.stringify({sent,receipt:receipt.read(),rows:tree.$.rows.all(),pending:q.inspect()}));
  expect(tree.$.rows.all()).toEqual([{id:'a',x:7,y:8}]);
  expect(sent).toEqual([]);
  q.confirm();await flush();
  expect(sent).toEqual([[{id:'a',x:7,y:8}]]);
 }finally{c1?.dispose();c0.dispose();tree.destroy();foreign.destroy();}
});

it('review omitted ancestor removes nested collection contributors from outgoing support',async()=>{
 const initial={branch:{rows:entityMap<{id:string;x:number},string>()},other:0};
 const tree=signalTree(initial as {branch?:typeof initial.branch;other:number},{enhancers:[transactions()]});
 const foreign=signalTree({x:0},{enhancers:[transactions()]});
 // The supplied initial branch exists here; later omission is the behavior under test.
 const rows=(tree.$.branch as typeof tree.$.branch & TreeNode<typeof initial.branch>).rows;rows.addOne({id:'a',x:0});await flush();
 // Internal runtime regression: explicit snapshot-reader shape does not expand
 // public Link admission for collection-containing construction roots.
 const sent:unknown[]=[];const c=link<() => ReturnType<typeof tree.$>>(tree.$,{set:v=>{sent.push(v);}}) as Experimental;
 const q=foreign.transact(()=>foreign.$.x(7));
 try{
  c.declare({kind:'dependent',owners:[q]},()=>rows.updateOne('a',{x:7}));await flush();expect(sent).toEqual([]);
  const receipt=c.declare({kind:'independent'},()=>tree.$({other:1}));await flush();
  console.info('REVIEW-OMITTED-COLLECTION',JSON.stringify({sent,receipt:receipt.read(),value:tree.$()}));
  expect(tree.$()).toEqual({other:1});
  expect(sent).toEqual([{other:1}]);
 }finally{c.dispose();tree.destroy();foreign.destroy();}
});
