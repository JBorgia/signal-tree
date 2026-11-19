const fs=require('fs'),ts=require('/private/tmp/st-parent-freshness-implementation-independent/candidate/node_modules/typescript'),assert=require('assert/strict');
const emit=side=>ts.transpileModule(fs.readFileSync(__dirname+'/'+side+'/packages/kernel/src/lib/recipient-window-independent.spec.ts','utf8'),{compilerOptions:{removeComments:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
assert.equal(emit('predecessor'),emit('candidate'));console.log('recipient-window-independent emitted JavaScript identical; comment-only delta.');
