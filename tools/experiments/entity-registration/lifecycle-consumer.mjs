import * as api from '@signal-tree/kernel';
import {lifecycleCases,runLifecycle} from './lifecycle.mjs';
const results=[];for(const test of lifecycleCases){const result=await runLifecycle(api,test);results.push(result);console.log(JSON.stringify(result));}console.log(JSON.stringify({passed:results.filter(r=>r.pass).length,total:results.length}));if(results.some(r=>!r.pass))process.exitCode=1;
