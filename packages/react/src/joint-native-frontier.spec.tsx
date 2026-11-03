import {act,render,screen} from '@testing-library/react';
import {expect,it} from 'vitest';
import {signalTree,entityMap,restoration,undoable,useSignalTree} from './index';
const drain=async()=>{for(let i=0;i<32;i++)await Promise.resolve();};
it('React external-store selection observes the complete mixed inverse and newer source completion',async()=>{
 const t=signalTree({left:entityMap<{id:string;n:number},string>(),right:entityMap<{id:string;n:number},string>()},{enhancers:[restoration()]});
 let unmount=()=>{ /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ };
 try{t.$.left.addOne({id:'a',n:1});t.$.right.setAll([{id:'a',n:11},{id:'b',n:12}]);await drain();undoable(()=>{t.$.left.removeOne('a');t.$.right.byIdOrFail('a').n(50);t.$.right.byIdOrFail('b').n(60);});await drain();
 const reads:string[]=[];function View(){const value=useSignalTree(t,$=>JSON.stringify([$.left.all(),$.right.all()]));reads.push(value);return <output data-testid="joint">{value}</output>;}
 ({unmount}=render(<View/>));reads.length=0;await act(async()=>{t.undo();await drain();});const expected=JSON.stringify([[{id:'a',n:1}],[{id:'a',n:11},{id:'b',n:12}]]);expect(screen.getByTestId('joint').textContent).toBe(expected);expect(reads.length).toBeGreaterThan(0);expect(reads.every(value=>value===expected)).toBe(true);
 }finally{unmount();t.destroy();}
});
