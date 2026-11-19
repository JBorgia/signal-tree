from pathlib import Path
import json,hashlib,subprocess,shutil
r=Path(__file__).resolve().parent;h=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
status=json.loads((r/'STATUS.json').read_text());assert len(status)==4
checks=[];rows=[]
for result in status:
 assert result['exit']==0 and result['validTwoCasesAndFreshWorker'] and not result['remainingOwned'] and not result['runtimeMismatches'] and result['counterInvariantFailures']==0
 arm=result['arm'];n=result['size'];d=r/'runs'/f'{arm}-{n}-r1';samples=[json.loads(l) for l in (d/'memory.jsonl').read_text().splitlines()]
 assert len(samples)==29,(len(samples),d)
 for x in samples:
  c=x['counts'];calls=c.get('packet.ordinary.calls',0)
  assert c.get('packet.physical.calls',0)==calls==c.get('packet.steps.calls',0)
  assert c.get('packet.stepsPresent',0)+c.get('packet.stepsAbsent',0)==calls
  assert c.get('packet.nativePresent',0)+c.get('packet.nativeAbsent',0)==calls
  assert c.get('native.prepare',0)==c.get('packet.nativePresent',0)==0
  assert not any(k.startswith(('target.','terminal.','native.')) for k in c)
  assert all(isinstance(v,int) and v>=0 for v in c.values())
  if x['phase'] in ['restoration:before-undo','restoration:before-redo']:
   assert c['adapter.planChanges.calls']==1 and c['adapter.planChanges.sum']==2*n
   assert c['adapter.metaCalls']==c['adapter.selected.calls']==c['adapter.selected.sum']==2*n
   assert c['adapter.selected.max']==1
   assert c['packet.ordinary.sum']==c['packet.physical.sum']==3*n
   if arm=='baseline':assert c['adapter.filterInput.sum']==4*n*n and c['adapter.filterInput.calls']==2*n
   else:assert c['adapter.groupVisits']==c['adapter.groupReferences']==c['adapter.groups']==2*n and c.get('adapter.nanSkipped',0)==0
   rows.append({'arm':arm,'N':n,'phase':x['phase'],'counts':c})
 checks.append({'arm':arm,'N':n,'phaseRows':len(samples),'flagsAndLengths':'pass'})
# Reverse exact patches in separate verification directory, never in candidates.
for arm in ['baseline','indexed']:
 c=r/arm/'candidate';v=r/'reverse-check'/arm;manifest=json.loads((r/arm/'MANIFEST.json').read_text())
 for patch in sorted((r/arm/'overlays').rglob('*.patch')):
  rel='packages/kernel/src/lib/'+str(patch.relative_to(r/arm/'overlays'))[:-6]
  p=v/rel;p.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(c/rel,p)
  out=subprocess.run(['patch','--batch','-R','-p1','-d',str(v),'-i',str(patch)],capture_output=True,text=True)
  assert out.returncode==0,(patch,out.stdout,out.stderr)
  assert h(p)==manifest[rel]
(r/'CHECKS.json').write_text(json.dumps({'phaseInvariants':checks,'allTenSourcePatchesReverseToFrozenHashes':True,'results':rows},indent=2)+'\n')
print(json.dumps(checks))
