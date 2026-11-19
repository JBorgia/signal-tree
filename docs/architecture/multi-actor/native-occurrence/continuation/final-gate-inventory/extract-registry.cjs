// Read-only registry metadata extraction: no harness/import/command execution.
const fs=require('fs'),vm=require('vm'),crypto=require('crypto');
const root='/private/tmp/st-native-combined-c5/candidate';
const path=root+'/tools/verify-gates.mjs';const s=fs.readFileSync(path,'utf8');
const a=s.slice(s.indexOf('const GATES = [')+'const GATES = '.length,s.indexOf('\nconst args ='));
const gates=vm.runInNewContext(a,{BUILD_PROJECTS:'kernel,angular,react,vue,solid'});
const rows=gates.map((g,i)=>({index:i+1,name:g.name,covers:g.covers,cmd:g.cmd,env:g.env??{},slow:!!g.slow,releaseOnly:!!g.releaseOnly,needsBuild:!!g.needsBuild,provenBy:g.provenBy??null,hasMutation:!!g.mutation,knownFailing:g.knownFailing??null,line:s.slice(0,s.indexOf(`name: '${g.name}'`)).split('\n').length}));
fs.writeFileSync('/private/tmp/st-native-final-gate-inventory/REGISTRY.json',JSON.stringify({source:path,sha256:crypto.createHash('sha256').update(s).digest('hex'),count:rows.length,rows},null,2)+'\n');console.log(rows.length,rows.filter(g=>g.releaseOnly).length,rows.filter(g=>g.slow).length);
