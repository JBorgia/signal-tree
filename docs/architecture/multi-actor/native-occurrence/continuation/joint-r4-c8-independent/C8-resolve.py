from pathlib import Path
import re,shutil,json,subprocess
root=Path(__file__).parent
ledger=json.loads((root/'COMPOSITION.json').read_text())
for rel in ledger['conflicts']:
 p=root/'candidate'/rel;e=root/'three-way'/rel
 result=subprocess.run(['git','merge-file','-p',str(e)+'.left',str(e)+'.base',str(e)+'.right'],capture_output=True)
 assert result.returncode==1
 s=result.stdout.decode()
 def resolve(m):
  left,right=m.group(1),m.group(2)
  if p.name=='private.ts':
   head=left[:left.index('function completeMembership')].replace('completion:{parts,enrollments}','completion:{parts,enrollments,native:native.requirement}')
   return head+'''function completeMembership(completion:object):void{
 const state=completion as {parts:{channel:object;unit:Unit}[];enrollments?:{activate():void}[];native:lifecycle.NativeRequirement};
 let failed=false,first:unknown;const run=(work:()=>void)=>{try{work();}catch(error){if(!failed){failed=true;first=error;}}};
 for(const enrollment of state.enrollments??[])run(()=>enrollment.activate());
 state.enrollments=undefined;
 run(()=>lifecycle.deliverNativeRequirementReady(state.native));
 for(const part of state.parts)run(()=>completeScalar(part));
 if(failed)throw first;
'''
  if p.name=='lifecycle.ts': return left.replace('unfinishedRequirements.add(requirement);','unfinishedRequirements.add(requirement);unactivatedRequirements.add(requirement);')
  return left+right
 s=re.sub(r'^<<<<<<< [^\n]*\n(.*?)^=======\n(.*?)^>>>>>>> [^\n]*\n',resolve,s,flags=re.M|re.S)
 assert '<<<<<<< ' not in s
 p.write_text(s)
for name in ['tree-scalar-leaf-runtime.ts','native-tree-scalar-leaf-runtime.ts']:
 p=root/'candidate/packages/kernel/src/lib/internals'/name;s=p.read_text();needle='const slot=kernel.createSlot(initialValue,equal,positionId);'
 assert s.count(needle)==1
 s=s.replace(needle,needle+'\n          kernel.bindPublicationSource(slot,prepared.leaf);');p.write_text(s)
shutil.copy('/private/tmp/st-native-combined-c7a/run-gate.py',root/'run-gate.py')
