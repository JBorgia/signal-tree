import * as api from '@signal-tree/kernel';
import {receiptCases,runReceiptCase} from './receipt-cases.ts';
for(const test of receiptCases){await runReceiptCase(api,test);console.log(JSON.stringify({name:test.name,pass:true}));}
console.log(JSON.stringify({passed:receiptCases.length,total:receiptCases.length}));
