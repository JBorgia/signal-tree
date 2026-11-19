from pathlib import Path
import hashlib,json,shutil
out=Path(__file__).parent
paths={'base':Path('/private/tmp/st-native-combined-c16'),'left':Path('/private/tmp/st-c17-value-work-correction'),'right':Path('/private/tmp/st-equal-whole-c16-qualification'),'c18':Path('/private/tmp/st-native-combined-c18')}
manifest={'base':'SNAPSHOT-C16.json','left':'SNAPSHOT-VALUE-WORK.json','right':'SNAPSHOT-QUALIFICATION.json','c18':'SNAPSHOT-C18.json'}
h=lambda b:hashlib.sha256(b).hexdigest();ms={};report={'identities':{}}
for key,root in paths.items():
 raw=(root/manifest[key]).read_bytes();m=json.loads(raw);ms[key]=m
 for n,d in m.items():assert h((root/'candidate'/n).read_bytes())==d,(key,n)
 report['identities'][key]={'manifest':h(raw),'verifiedEntries':len(m)}
a,l,r,c=[ms[k] for k in ['base','left','right','c18']];expected={};conflicts=[]
for n in sorted(set(a)|set(l)|set(r)):
 x,y,z=a.get(n),l.get(n),r.get(n)
 if y==z:chosen=y
 elif y==x:chosen=z
 elif z==x:chosen=y
 else:conflicts.append(n);continue
 if chosen is not None:expected[n]=chosen
assert not conflicts,conflicts
exceptions={n:{'assembled':expected.get(n),'c18':c.get(n)} for n in set(expected)|set(c) if expected.get(n)!=c.get(n)}
w='packages/kernel/src/lib/'
assert set(exceptions)=={w+'whole-late-getter.spec.ts',w+'whole-mixed-trace.spec.ts',w+'value-work-handoff.spec.ts'},exceptions
arch=paths['c18']/'research-only'
for n in ['whole-late-getter.spec.ts','whole-mixed-trace.spec.ts']:
 assert (arch/n).read_bytes()==(paths['right']/'candidate'/w/n).read_bytes()
original=(paths['left']/'candidate'/w/'value-work-handoff.spec.ts').read_bytes();retained=(paths['c18']/'candidate'/w/'value-work-handoff.spec.ts').read_bytes();case=(arch/'private-reduction-reentry.case.txt').read_bytes()
assert (arch/'ORIGINAL-value-work-handoff.spec.ts').read_bytes()==original
assert retained+case==original,'Archived mutation case not exact suffix reconstruction'
assert c[w+'whole-bounded-qualification.spec.ts']==r[w+'whole-bounded-qualification.spec.ts']
for n in ['experimental-publication/private.ts','link.ts']:assert c[w+n]==l[w+n]
assert c[w+'entity-signal.ts']==r[w+'entity-signal.ts']
report['compositionExceptions']=exceptions;report['conflicts']=conflicts;report['archiveHashes']={n.name:h(n.read_bytes()) for n in arch.iterdir() if n.is_file()};report['checks']=['three-way union exact except three authorized routing paths','archive full files byte identical','active handoff plus archived suffix reconstruct original exact bytes','mixed rollback fixture whole file unchanged','runtime left/right files retained exact']
for n in ['ASSEMBLY.md','COMPOSITION.json','SNAPSHOT-C18.json']:shutil.copyfile(paths['c18']/n,out/n)
shutil.copytree(arch,out/'research-only',dirs_exist_ok=True)
(out/'AUDIT.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
