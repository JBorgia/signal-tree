import { it, expect } from 'vitest';
import { writeDiagnostic } from '../../test/optional-diagnostic';
import { entityMap, signalTree, restoration, undoable } from '../index';
import { getEntityPublicationBinding } from './internals/entity-publication';
const diagnosticDirectory=process.env['ST_JOINT_PHASE_OUTPUT'];
const drain=async()=>{for(let i=0;i<32;i++)await Promise.resolve();};
it('private source preparation cannot expose a partially installed mixed inverse',async()=>{
 const t=signalTree({left:entityMap<{id:string},string>(),right:entityMap<{id:string},string>()},{enhancers:[restoration()]});
 let armed=false;const seen:unknown[]=[];const release:Array<()=>void>=[];
 try{
 t.$.left.addOne({id:'a'});t.$.right.addOne({id:'b'});await drain();
 undoable(()=>{t.$.left.removeOne('a');t.$.right.removeOne('b');});await drain();
 for(const node of [t.$.left,t.$.right])release.push(getEntityPublicationBinding(node)!.source.subscribe({prepare(){if(armed){const left=[...t.$.left.ids()],right=[...t.$.right.ids()];if((left.length===0)!==(right.length===0)){seen.push({left,right,stack:new Error().stack});throw new Error('participant preparation refused');}}return undefined;},complete(){ /* This fixture observes preparation, not completion. */ }}));
 armed=true;let error:unknown;try{t.undo();}catch(e){error=String(e);}armed=false;
 writeDiagnostic(diagnosticDirectory ? `${diagnosticDirectory}/participant.jsonl` : undefined,JSON.stringify({seen,error,left:t.$.left.ids(),right:t.$.right.ids()})+'\n',true);
 expect(seen).toEqual([]);
 }finally{armed=false;for(const off of release)off();t.destroy();}
});
