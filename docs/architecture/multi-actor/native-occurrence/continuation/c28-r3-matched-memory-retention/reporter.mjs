import {appendFileSync} from 'node:fs';
function emit(row){appendFileSync(process.env.ST_SUITE_EVENTS,JSON.stringify({at:Date.now(),...row})+'\n');}
function result(t){const r=t.result();return {file:t.module.moduleId,name:t.fullName,state:r.state,expectedFailure:t.options.fails===true,mode:t.options.mode,errors:r.errors?.map(e=>({name:e.name,message:e.message,stack:e.stack}))};}
export default class Reporter {
 onTestRunStart(){emit({kind:'run-start'});}
 onTestModuleStart(m){emit({kind:'module-start',file:m.moduleId});}
 onTestCaseReady(t){emit({kind:'case-start',file:t.module.moduleId,name:t.fullName});}
 onTestCaseResult(t){emit({kind:'case-result',...result(t)});}
 onTestModuleEnd(m){emit({kind:'module-end',file:m.moduleId,cases:[...m.children.allTests()].map(result)});}
 onTestRunEnd(modules,errors,reason){emit({kind:'run-end',reason,errors:errors?.map(e=>({name:e.name,message:e.message,stack:e.stack}))});}
}
