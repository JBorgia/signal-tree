import * as api from '@signal-tree/kernel';
import {cases,runCase} from './cases.mjs';
const results=[];
for(const test of cases){const result=await runCase(api,test);results.push(result);console.log(JSON.stringify(result));}
console.log(JSON.stringify({summary:true,passed:results.filter(x=>x.pass).length,total:results.length}));
if(results.some(x=>!x.pass))process.exitCode=1;
