from pathlib import Path
import json,hashlib,shutil,os
root=Path(__file__).resolve().parent;source=Path('/private/tmp/st-native-combined-c21');m=json.loads((source/'SNAPSHOT-C21.json').read_text());dest=root/'candidate';dest.mkdir(exist_ok=False)
h=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
for p,v in m.items():
 a=source/'candidate'/p;b=dest/p
 assert h(a)==v,p
 b.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(a,b);assert h(b)==v,p
(root/'SNAPSHOT-C21.json').write_bytes((source/'SNAPSHOT-C21.json').read_bytes())
# Separate already-copied dependency store; verify actual tool identities below.
deps=Path('/private/tmp/st-parent-freshness-implementation-independent/candidate/node_modules')
os.symlink(deps,dest/'node_modules')
tool={}
for pkg in ['nx','vitest','vite','typescript']:
 old=source/'candidate/node_modules'/pkg;new=deps/pkg
 op=json.loads((old/'package.json').read_text());np=json.loads((new/'package.json').read_text());assert op==np,pkg
 tool[pkg]={'version':np['version'],'originalResolved':str(old.resolve()),'copyResolved':str(new.resolve()),'packageJsonSha256':h(new/'package.json')}
(root/'TOOLS.json').write_text(json.dumps(tool,indent=2)+'\n')
shutil.copyfile(source/'progress-reporter.mjs',root/'progress-reporter.mjs')
pre=(source/'diagnostic-redirect.cjs').read_text();(root/'diagnostic-redirect.cjs').write_text(pre.replace(str(source/'recipient-traces.jsonl'),str(root/'recipient-traces.jsonl')))
for f in ['COMMAND.json','WATCHDOG.json','RESULT.json','PROCESS.json']:
 shutil.copyfile(source/'runs/full-kernel-watchdog'/f,root/('FULLRUN-'+f))
(root/'PREPARED.json').write_text(json.dumps({'manifest':h(root/'SNAPSHOT-C21.json'),'verifiedFiles':len(m),'reporter':h(root/'progress-reporter.mjs'),'preloadOnlyChange':'diagnostic destination relocated to own scratch','oldGroup60688':'ps inspection returned no members; initial sandbox ps denial, read-only escalation succeeded'},indent=2)+'\n')
print('PREPARED',len(m),flush=True)
