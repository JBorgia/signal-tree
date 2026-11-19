from pathlib import Path
import json,hashlib,shutil,os
r=Path(__file__).resolve().parent;s=Path('/private/tmp/st-native-combined-c22');m=json.loads((s/'SNAPSHOT-C22.json').read_text());c=r/'candidate';c.mkdir(exist_ok=False);h=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
for p,v in m.items():
 a=s/'candidate'/p;assert h(a)==v,p;b=c/p;b.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(a,b);assert h(b)==v,p
link=os.readlink(s/'candidate/node_modules');assert link=='/Users/jonathanborgia/code/signaltree/node_modules';os.symlink(link,c/'node_modules')
assert not(c/'dist/packages').exists(),'unexpected initial package artifacts'
shutil.copyfile(s/'SNAPSHOT-C22.json',r/'BASE-MANIFEST.json');shutil.copyfile(s/'runs/packages/COMMAND.json',r/'MAIN-COMMAND.json')
pre=(s/'diagnostic-redirect.cjs').read_text();(r/'diagnostic-redirect.cjs').write_text(pre.replace(str(s/'recipient-traces.jsonl'),str(r/'recipient-traces.jsonl')))
previous=Path('/private/tmp/st-parent-freshness-implementation-independent/c22-react-build-discriminator')
shutil.copyfile(previous/'report-ready.cjs',r/'report-ready.cjs')
shutil.copyfile('/private/tmp/st-parent-freshness-implementation-independent/c21-recorder-validation/ownership.py',r/'ownership.py')
(r/'PREPARED.json').write_text(json.dumps({'manifest':h(r/'BASE-MANIFEST.json'),'sourceFiles':len(m),'nodeModulesLink':link,'resolvedLink':str((c/'node_modules').resolve()),'kernelWorkspaceLink':str((c/'node_modules/@signal-tree/kernel').resolve()),'initialPackageArtifacts':False,'preloadChange':'only diagnostic file output destination relocated to own scratch; interception behavior unchanged','mainPreloadSha256':h(s/'diagnostic-redirect.cjs'),'ownPreloadSha256':h(r/'diagnostic-redirect.cjs')},indent=2)+'\n')
print('prepared exact C22 and Main dependency linkage',flush=True)
