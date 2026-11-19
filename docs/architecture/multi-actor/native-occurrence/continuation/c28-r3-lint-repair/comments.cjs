const fs=require('fs'),ts=require('/Users/jonathanborgia/code/signaltree/node_modules/typescript');
const root='/private/tmp/st-c28-r3-lint-repair/candidate/';
const files={
'packages/kernel/src/lib/internals/native-tree-scalar-leaf-runtime.ts':'No cancellation work is registered for this scalar allocation.',
'packages/kernel/src/lib/internals/tree-scalar-leaf-runtime.ts':'No cancellation work is registered for this scalar allocation.',
'packages/kernel/src/lib/internals/plain-branch-membership.ts':'Membership validation needs no separate finalization work.',
'packages/kernel/src/lib/equal-owner-retention-diagnostic.spec.ts':'The retention fixture observes ownership separately from this callback.',
'packages/kernel/src/lib/scalar-responsibility-lifecycle.spec.ts':'This fixture tests attachment lifetime; no work is needed in this callback.',
'packages/react/src/branch-declaration-qualification.spec.tsx':'This fixture observes state and delivery separately; this callback intentionally does no work.'
};
let total=0;const evidence=[];
for(const [p,comment] of Object.entries(files)){
 let s=fs.readFileSync(root+p,'utf8'),a=ts.createSourceFile(p,s,ts.ScriptTarget.Latest,true),edits=[];
 function visit(n){if(ts.isFunctionLike(n)&&!ts.isConstructorDeclaration(n)&&n.body&&ts.isBlock(n.body)&&n.body.statements.length===0&&n.body.getText(a).replace(/\s/g,'')==='{}')edits.push(n.body.getStart(a)+1);ts.forEachChild(n,visit);}visit(a);
 const before=ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,removeComments:true},fileName:p}).outputText;
 for(const pos of edits.sort((a,b)=>b-a))s=s.slice(0,pos)+' /* '+comment+' */ '+s.slice(pos);
 const after=ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,removeComments:true},fileName:p}).outputText;
 if(before!==after)throw Error('emitted JS differs: '+p);fs.writeFileSync(root+p,s);total+=edits.length;evidence.push({path:p,comments:edits.length,emittedJavaScriptEqual:true});
}if(total!==18)throw Error('Unexpected empty functions '+total);fs.writeFileSync('/private/tmp/st-c28-r3-lint-repair/COMMENTS-EQUIVALENCE.json',JSON.stringify(evidence,null,2));
