import { it, expect } from 'vitest';
import { writeDiagnostic } from '../../test/optional-diagnostic';
import { entityMap, signalTree, restoration, undoable } from '../index';
const diagnosticDirectory=process.env['ST_JOINT_PHASE_OUTPUT'];
const drain=async()=>{for(let i=0;i<32;i++)await Promise.resolve();};
it('public retained getter does not observe a partial two-collection inverse',async()=>{
 type Row={id:string;value:number;opaque:()=>void};
 const t=signalTree({left:entityMap<Row,string>(),right:entityMap<Row,string>()},{enhancers:[restoration()]});
 let armed=false;const reads:unknown[]=[];let partial=false;
 const row=(id:string):Row=>({id,get value(){if(armed){const left=[...t.$.left.ids()],right=[...t.$.right.ids()];if((left.length===0)!==(right.length===0)){partial=true;reads.push({id,left,right,stack:new Error().stack});}}return 1;},opaque:()=>{ /* Callable row data is deliberately inert in this getter probe. */ }});
 try{
 t.$.left.addOne(row('a'));t.$.right.addOne(row('b'));await drain();
 undoable(()=>{t.$.left.removeOne('a');t.$.right.removeOne('b');});await drain();
 expect(t.$.left.ids()).toEqual([]);expect(t.$.right.ids()).toEqual([]);
 armed=true;let error:unknown;try{t.undo();}catch(e){error=String(e);}armed=false;await drain();
 writeDiagnostic(diagnosticDirectory ? `${diagnosticDirectory}/getter.jsonl` : undefined,JSON.stringify({partial,reads,error,left:t.$.left.ids(),right:t.$.right.ids()})+'\n',true);
 expect(error).toBeUndefined();expect(partial).toBe(false);
 }finally{armed=false;t.destroy();}
});
