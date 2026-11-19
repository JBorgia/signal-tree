const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto'),path=require('node:path');
const root='/private/tmp/st-c28-r3-entity-artifact-gate-work', src=root+'/successor';
const code=fs.readFileSync(src+'/tools/verify-entity-registration-artifacts.mjs','utf8');
const classifier=code.slice(code.indexOf('const names ='),code.indexOf('const fixtureFiles ='))+code.slice(code.indexOf('function classify('),code.indexOf('const work ='))+'\n globalThis.classify=classify;parserTests();';
const context={assert};vm.createContext(context);vm.runInContext(classifier,context);
const accepted=JSON.parse(fs.readFileSync(root+'/evidence/registration-mutation.json'));const results=[];
for(const arm of accepted.arms)for(const mode of ['installed','production'])for(const entry of ['consumer','lifecycle-consumer','receipt-consumer']){
 const label=`${arm.label}-${mode}-${entry}`;const info=accepted.runs.find(r=>r.label===label);const stem=fs.readdirSync(accepted.work).find(f=>f.endsWith('-'+label+'.json')).slice(0,-5);
 const run={...info,stdout:fs.readFileSync(path.join(accepted.work,stem+'.stdout'),'utf8'),stderr:fs.readFileSync(path.join(accepted.work,stem+'.stderr'),'utf8')};
 const actual=context.classify(entry,run);assert.equal(JSON.stringify(actual),JSON.stringify(arm.modes[mode].find(r=>r.entry===entry)));results.push({label,kind:actual.kind});
}
const negative=JSON.parse(fs.readFileSync('/private/var/folders/rq/j_cb8q_538sbvjlg2bzwyts40000gn/T/st-entity-artifact-0ubW4B/result.json'));assert.equal(negative.passed,false);assert.equal(negative.arms.length,0);assert.equal(negative.mutation,undefined);assert(negative.error.includes('baseline-ci failed during setup/control'));
const registry=fs.readFileSync(src+'/tools/verify-gates.mjs','utf8');const ts=require(src+'/node_modules/typescript');const ast=ts.createSourceFile('registry.mjs',registry,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);let branch;function visit(n){if(ts.isIfStatement(n)&&n.expression.getText(ast)==='result.code !== 0')branch=n.getText(ast);ts.forEachChild(n,visit);}visit(ast);assert(branch);
const test={result:{code:1},results:[],gate:{name:'entity-registration-artifacts:self'},console:{log(){}},coverageOf(){return null}};vm.createContext(test);vm.runInContext(branch,test);assert.equal(test.results[0].state,'proven');
const out={parserSelfChecks:'pass',reclassifiedSavedRuns:results,outerRegistryCounterexample:{input:'saved empty-cache setup failure; tool catch maps failure to process.exitCode=1',toolPassed:negative.passed,runtimeArms:negative.arms.length,registryState:test.results[0].state,method:'executed exact registry IfStatement in isolated VM, no registry/build/install campaign'}};
fs.writeFileSync('/private/tmp/st-c28-r3-entity-artifact-gate-review/CHECKS.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out,null,2));
