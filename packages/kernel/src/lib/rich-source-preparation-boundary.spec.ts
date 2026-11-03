import { it, expect } from 'vitest';
import { writeDiagnostic } from '../../test/optional-diagnostic';
import { entityMap, signalTree, restoration, undoable } from '../index';
import { getEntityPublicationBinding } from './internals/entity-publication';
const diagnosticDirectory=process.env['ST_JOINT_PHASE_OUTPUT'];
const drain=async()=>{for(let i=0;i<32;i++)await Promise.resolve();};
it('private source preparation after scalar installation cannot refuse a partial inverse',async()=>{
 const t=signalTree({n:0,left:entityMap<{id:string},string>(),right:entityMap<{id:string},string>()},{enhancers:[restoration()]});
 let armed=false;const seen:unknown[]=[];const release:Array<()=>void>=[];
 try{
 t.$.left.addOne({id:'a'});t.$.right.addOne({id:'b'});await drain();
 undoable(()=>{t.$.n(9);t.$.left.removeOne('a');});await drain();
 for(const node of [t.$.left,t.$.right])release.push(getEntityPublicationBinding(node)!.source.subscribe({prepare(){if(armed){const left=[...t.$.left.ids()],right=[...t.$.right.ids()];if(t.$.n()===0&&left.length===0){seen.push({n:t.$.n(),left,right,stack:new Error().stack});throw new Error('participant preparation refused');}}return undefined;},complete(){ /* This fixture observes preparation, not completion. */ }}));
 armed=true;let error:unknown;try{t.undo();}catch(e){error=String(e);}armed=false;
 writeDiagnostic(diagnosticDirectory ? `${diagnosticDirectory}/preparation-scalar.jsonl` : undefined,JSON.stringify({seen,error,n:t.$.n(),left:t.$.left.ids(),right:t.$.right.ids()})+'\n',true);
 expect(seen).toEqual([]);
 }finally{armed=false;for(const off of release)off();t.destroy();}
});
