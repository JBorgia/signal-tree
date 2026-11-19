const fs=require('fs'),crypto=require('crypto'),ts=require('/private/tmp/st-parent-freshness-implementation-independent/candidate/node_modules/typescript');
const base='/private/tmp/st-native-combined-c18/candidate/packages/kernel/src/lib/';const after='/private/tmp/st-c18-lint-maintenance/candidate/packages/kernel/src/lib/';
const emit=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,removeComments:true}}).outputText;
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');const records={};
for(const f of ['native-authored-footprint.spec.ts','whole-bounded-qualification.spec.ts','value-work-handoff.spec.ts','entity-signal.ts']){
 const original=fs.readFileSync(base+f,'utf8'),candidate=fs.readFileSync(after+f,'utf8');let expected=original;
 if(f==='value-work-handoff.spec.ts')expected=original.replace('let entered=false;let c:C;\n c=link','let entered=false;\n const c=link');
 if(f==='entity-signal.ts')expected=original.replace('let snapshotIdentity: object | undefined;','let snapshotIdentity: object | undefined = undefined;');
 const a=emit(expected),b=emit(candidate);if(a!==b)throw Error('Unexpected emitted change: '+f);
 const assertions=s=>{const sf=ts.createSourceFile(f,s,ts.ScriptTarget.Latest,true);const out=[];function walk(n){if(ts.isCallExpression(n)&&ts.isIdentifier(n.expression)&&n.expression.text==='expect')out.push(n.parent.getText(sf));ts.forEachChild(n,walk);}walk(sf);return out;};
 if(JSON.stringify(assertions(original))!==JSON.stringify(assertions(candidate)))throw Error('Assertion changed: '+f);
 records[f]={commentsEmitIdentically:true,onlyApprovedNonCommentChange:f==='entity-signal.ts'?'explicit undefined initializer':f==='value-work-handoff.spec.ts'?'one-assignment fixture binding changed to const':'none',assertionsUnchanged:true,emittedSHA256:hash(b),baselineEmittedSHA256:hash(emit(original))};
}
fs.writeFileSync(__dirname+'/EMITTED-VERIFICATION.json',JSON.stringify(records,null,2)+'\n');console.log('Comment emission and assertion identity verified; only two approved binding edits differ.');
