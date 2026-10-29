// Private neutral-source capability, not a public selected operation.
import { expect, it } from 'vitest';
import { createLocationRuntime } from '../../kernel/src/lib/internals/location-runtime';
import { NEUTRAL_OBSERVATION_ADAPTER } from '../../kernel/src/lib/internals/observation-adapter';
it('existing neutral React backing exposes prepared raw selection without early publication', () => {
 const runtime=createLocationRuntime(NEUTRAL_OBSERVATION_ADAPTER); let raw='A';
 const binding=runtime.createWritable(()=>raw,value=>{if(Object.is(raw,value))return false;raw=value;return true;});
 const readonly=binding.location.asReadonly();
 expect(readonly()).toBe('A');
 const seen:string[]=[]; const stop=binding.location.subscribe(()=>seen.push(readonly()));
 try{
  raw='B'; const before={writable:binding.location(),readonly:readonly(),seen:[...seen]};
  runtime.publish([binding]); const after={writable:binding.location(),readonly:readonly(),seen:[...seen]};
  console.log('selection-capability-react-neutral',JSON.stringify({before,after}));
  expect(before).toEqual({writable:'B',readonly:'B',seen:[]});
  expect(after).toEqual({writable:'B',readonly:'B',seen:['B']});
 }finally{stop();}
});
