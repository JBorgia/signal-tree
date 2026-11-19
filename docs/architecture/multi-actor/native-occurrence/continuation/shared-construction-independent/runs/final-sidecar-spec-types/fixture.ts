import {it,expect} from 'vitest';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {signalTree,transactions,link} from '../index';
import {registerMembershipPublication} from './internals/intrinsic-mutation';
it('diagnostic: ordinary completion read versus installed child before nested whole assignment',()=>{
 const t=signalTree({rows:{} as Record<string,{n:number}>},{enhancers:[transactions()]});const l=link(t.$.rows,{set:()=>{}});const error=Error('completion');let observed:unknown;let physical:unknown;let payload:unknown;let delivered=false;
 const off=registerMembershipPublication(edit=>edit.branch===t.$.rows&&edit.key==='a'&&edit.ordinary?.before.present===false?{record:{writes:[],adds:[]},completion:{}}:undefined,()=>{delivered=true;observed=t.$.rows();physical=t.$.rows.a.n();const next={...t.$.rows(),b:{n:2}};payload=next;t.$.rows(next);throw error;});
 try{expect(()=>t.$.rows({a:{n:1}})).toThrow(error);expect(delivered).toBe(true);writeFileSync(join(process.env.ST_PREPARED_REVIEW_OUTPUT!,'completion-snapshot.json'),JSON.stringify({observed,physical,payload,after:t.$.rows()},null,2));}
 finally{off();l.dispose();t.destroy();}
});
