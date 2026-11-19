from pathlib import Path
import hashlib,json,shutil,subprocess
r=Path('/private/tmp/st-c26-finite-followup');b=Path('/private/tmp/st-c26-scalar-finalized-role');c=r/'candidate';c.mkdir()
p=b/'SNAPSHOT-C26.json';assert hashlib.sha256(p.read_bytes()).hexdigest()=='8055911bdd78c9df536bc8a7e1ea8bf3e74427c64675fbc8d0a566c0d91aa38f';m=json.loads(p.read_text())
for rel,h in m.items():
 s=b/'candidate'/rel;data=s.read_bytes();assert hashlib.sha256(data).hexdigest()==h;d=c/rel;d.parent.mkdir(parents=True,exist_ok=True);d.write_bytes(data);shutil.copymode(s,d)
(c/'node_modules').symlink_to('/Users/jonathanborgia/code/signaltree/node_modules',target_is_directory=True)
shutil.copy2(p,r/'BASE-MANIFEST.json');shutil.copy2(b/'research/first-gate-instrumentation.patch',r/'diagnostics.patch')
for name in ['run-focused.py','run-direct.py']:(r/name).write_text((b/name).read_text().replace(str(b),str(r)))
subprocess.run(['git','apply',str(r/'diagnostics.patch')],cwd=c,check=True)
p=c/'packages/kernel/src/lib/scalar-finalized-derived-roots.spec.ts';s=p.read_text();(r/'original-derived.spec.ts').write_text(s)
assert 'for(const n of [1,2,4])' in s;s=s.replace('for(const n of [1,2,4])','for(const n of [1,2,4,64,256])').replace('bounded diagnostic 1/2/4 only','bounded diagnostic through 64/256');p.write_text(s)
(r/'executed-derived.spec.ts').write_text(s)
(r/'PREPARE.json').write_text(json.dumps({'manifest':'8055911bdd78c9df536bc8a7e1ea8bf3e74427c64675fbc8d0a566c0d91aa38f','files':len(m),'changes':'Preserved diagnostic patch, workload checkpoints extend to64/256; terminal assertions unchanged'},indent=2)+'\n')
print('Prepared',len(m),'files')
