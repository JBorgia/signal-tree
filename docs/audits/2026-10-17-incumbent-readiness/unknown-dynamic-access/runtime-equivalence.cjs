const fs=require('fs'),cp=require('child_process'),crypto=require('crypto');
const ts=require('/private/tmp/st-unknown-access-candidate/node_modules/typescript');
const baseline='/Users/jonathanborgia/.codex/worktrees/v16-incumbent-readiness/signaltree';
const candidate='/private/tmp/st-unknown-access-candidate';
for(const file of ['packages/kernel/src/lib/types.ts','apps/demo/src/app/pages/whats-new-14/whats-new-14.component.ts']){
 const before=cp.execFileSync('git',['show','16f85b6d:'+file],{cwd:baseline,encoding:'utf8'});
 const after=fs.readFileSync(candidate+'/'+file,'utf8');
 const emit=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,removeComments:true,experimentalDecorators:true}}).outputText;
 const a=emit(before),b=emit(after); if(a!==b)throw Error('Runtime emitted change: '+file);
 console.log(file+' '+crypto.createHash('sha256').update(b).digest('hex')+' identical emitted JS');
}
