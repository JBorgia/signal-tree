const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ts=require('/Users/jonathanborgia/code/signaltree/node_modules/typescript');
const base='/private/tmp/st-c28-r3-registration-lint-combined/candidate/packages/kernel/src/lib/constants.ts';
const candidate='/private/tmp/st-c28-r3-diagnostic-reduction/candidate/packages/kernel/src/lib/constants.ts';
const expected={NULL_OR_UNDEFINED:'null/undefined [ST1001]',TREE_DESTROYED:'destroyed [ST1012]',ENHANCER_CYCLE_DETECTED:'enhancer cycle [ST1024]'};
const results=[];
for(const [arm,file] of [['baseline',base],['candidate',candidate]]){
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 for(const mode of [undefined,false,true])for(const env of [undefined,'development','production']){
  const context={exports:{}};if(mode!==undefined)context.ngDevMode=mode;if(env!==undefined)context.process={env:{NODE_ENV:env}};
  vm.runInNewContext(code,context);const value=context.exports.SIGNAL_TREE_MESSAGES;
  assert.deepEqual(JSON.parse(JSON.stringify(value)),expected);assert(Object.isFrozen(value));results.push({arm,mode:String(mode),env:String(env),pass:true});
 }
 for(const key of ['process','ngDevMode']){
  let reads=0,thrown;const sentinel={boundary:key};const context={exports:{}};
  Object.defineProperty(context,key,{get(){reads++;throw sentinel;}});
  try{vm.runInNewContext(code,context);}catch(e){thrown=e;}
  if(arm==='candidate'){assert.equal(reads,0);assert.equal(thrown,undefined);assert.deepEqual(JSON.parse(JSON.stringify(context.exports.SIGNAL_TREE_MESSAGES)),expected);}else{assert(reads>0);assert.equal(thrown,sentinel);}
  results.push({arm,accessor:key,reads,threw:thrown===sentinel});
 }
}
fs.writeFileSync('/private/tmp/st-c28-r3-diagnostic-reduction-premise/ARTIFACT-message-parity-first.json',JSON.stringify(results,null,2)+'\n');console.log('18 value/freeze contexts match; four accessor observations preserve the intentional removed-read distinction.');
