import {it,expect} from 'vitest';
import {signalTree,entityMap,transactions} from '../index';
import {selectNativeOwnershipTransactions} from './internals/native-ownership-public-selection';
import {getNativeOwnershipPublicExperiment} from '../enhancers/transactions/native-ownership-public-experiment';
for(const B of [false,true]){
 const make=()=>signalTree({rows:entityMap<{id:string;n:number},string>(),x:0},{enhancers:[B?selectNativeOwnershipTransactions(transactions()):transactions()]});
 it('rekey independent later field B='+B,()=>{const t=make();try{t.$.rows.addOne({id:'A',n:1});const p=t.transact(()=>{t.$.x(1);t.$.rows.changeId('A','A2');});t.$.rows.updateOne('A2',{n:3});p.rollback();expect({ids:t.$.rows.ids(),rows:t.$.rows.all(),x:t.$.x()}).toEqual({ids:['A'],rows:[{id:'A',n:3}],x:0});}finally{t.destroy();}});
 it('removed appended anchor B='+B,()=>{const t=make();try{t.$.rows.setAll([{id:'z',n:0},{id:'a',n:1},{id:'c',n:3}]);const p=t.transact(()=>{t.$.rows.addOne({id:'x',n:1});t.$.rows.addOne({id:'y',n:1});t.$.rows.removeOne('c');});let error:unknown;try{p.rollback();}catch(e){error=e;}if(error){const e=error as {cause?:unknown};throw new Error(JSON.stringify({error:String(error),cause:String(e.cause),ids:t.$.rows.ids(),stats:getNativeOwnershipPublicExperiment(t)?.stats()}));}expect(t.$.rows.ids()).toEqual(['z','a','c']);}finally{t.destroy();}});
}
