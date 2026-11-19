import json,hashlib,pathlib
P=pathlib.Path
out=P('/private/tmp/st-native-combined-c6-independent')
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
inputs=[('c0','st-native-combined-c','SNAPSHOT-C0.json'),('c5','st-native-combined-c5','SNAPSHOT-C5.json'),('shared','st-shared-construction-successor','SOURCE-SHA256.json'),('c6','st-native-combined-c6','SNAPSHOT-C6.json')]
ms={}; result={}
for name,d,m in inputs:
 r=P('/private/tmp')/d; data=json.loads((r/m).read_text());ms[name]=data
 bad=[f for f,h in data.items() if not (r/'candidate'/f).is_file() or digest(r/'candidate'/f)!=h]
 result[name]={'manifestSha256':digest(r/m),'files':len(data),'mismatches':bad}
base,ours,theirs,actual=[ms[k] for k in ['c0','c5','shared','c6']]
expected=dict(ours);conflicts=[];changes=[]
for f in sorted(set(base)|set(theirs)):
 if base.get(f)==theirs.get(f):continue
 changes.append(f)
 if ours.get(f)!=base.get(f):conflicts.append(f)
 if f in theirs:expected[f]=theirs[f]
 else:expected.pop(f,None)
result['composition']={'sharedDelta':changes,'conflicts':conflicts,'expectedVsActual':[f for f in sorted(set(expected)|set(actual)) if expected.get(f)!=actual.get(f)],'c5Changes':[f for f in sorted(set(base)|set(ours)) if base.get(f)!=ours.get(f)],'c5Lost':[f for f in set(base)|set(ours) if base.get(f)!=ours.get(f) and ours.get(f)!=actual.get(f)]}
r=P('/private/tmp/st-native-combined-c6');freeze=json.loads((r/'FREEZE.json').read_text());result['freezeChecks']={k:digest(r/f)==freeze[k] for k,f in [('manifestSha256','SNAPSHOT-C6.json'),('patchSha256','FROM-C5.patch'),('reviewSha256','REVIEW.md')]}
(out/'VERIFICATION.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
