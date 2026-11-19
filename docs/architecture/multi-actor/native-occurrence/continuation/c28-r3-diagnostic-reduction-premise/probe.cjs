const fs=require('node:fs'), vm=require('node:vm'), assert=require('node:assert/strict');
const root='/private/tmp/st-c28-r3-registration-lint-combined/candidate';
const ts=require(root+'/node_modules/typescript');
const src=fs.readFileSync(root+'/packages/kernel/src/lib/entity-signal.ts','utf8');
const transpile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const table=src.slice(src.indexOf('const WRONG_ENTITY_METHODS:'),src.indexOf('type EntityPositionIdAllocator'));
const proxy=src.slice(src.indexOf('  const warnedWrongMethods ='),src.indexOf('  // The materializer stamps'));
let results=[];
for(const mode of [undefined,true,false]){
 const warnings=[],api={byId:n=>['id',n]},sym=Symbol('probe');api[sym]=42;
 let reads=0;Object.defineProperty(api,'upsert',{get(){reads++;assert.equal(this,api);return 91}});
 const ctx={api,console:{warn:s=>warnings.push(s)}};if(mode!==undefined)ctx.ngDevMode=mode;
 vm.createContext(ctx);vm.runInContext(transpile(table+proxy+';globalThis.result=proxy;'),ctx);
 const p=ctx.result;
 for(const key of ['123','001','-2','1e2','',' ','Infinity']) assert.equal(p[key][1],Number(key));
 assert.equal(p[sym],42);assert.equal(p.upsert,91);assert.equal(reads,1);
 assert.equal(p.add,undefined);assert.equal(p.add,undefined);assert.equal(p.unrecognized,undefined);
 assert.equal(warnings.length,mode===false?0:1);
 results.push({probe:'original extracted proxy',ngDevMode:mode===undefined?'absent':mode,pass:true});
}
const constants=fs.readFileSync(root+'/packages/kernel/src/lib/constants.ts','utf8');
for(const mode of [undefined,true,false]) for(const env of [undefined,'development','production']){
 const ctx={exports:{}};if(mode!==undefined)ctx.ngDevMode=mode;if(env!==undefined)ctx.process={env:{NODE_ENV:env}};
 vm.createContext(ctx);vm.runInContext(transpile(constants),ctx);
 const m=ctx.exports.SIGNAL_TREE_MESSAGES;assert.equal(Object.isFrozen(m),true);
 assert.equal(JSON.stringify(m),JSON.stringify({NULL_OR_UNDEFINED:'null/undefined [ST1001]',TREE_DESTROYED:'destroyed [ST1012]',ENHANCER_CYCLE_DETECTED:'enhancer cycle [ST1024]'}));
}
results.push({probe:'original extracted constants, 3 flag states x 3 env states, exact strings and frozen object',pass:true});
console.log(JSON.stringify(results,null,2));
