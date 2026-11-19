from pathlib import Path
import subprocess,json,hashlib,collections,pickle
p=Path('/private/tmp/st-c21-reproducibility-audit');root=Path('/Users/jonathanborgia/code/signaltree');m=json.loads((p/'TARGET.json').read_text());missing=json.loads((p/'PATCH-CLOSURE-MISSING.json').read_text())
# Conservatively include all non-document manifest files, including apps/assets/config.
def scope(k):return not (k.startswith(('docs/','.agents/','.claude/','.codex/')) or k.lower().endswith('.pdf') or (k.lower().endswith('.md') and not k.startswith(('packages/','tools/')) and k!='README.md'))
paths={k:v for k,v in m.items() if scope(k)}
ref='87f6831fa60cafe87508f0ace84b7638698ca3b0'
lines=subprocess.check_output(['git','ls-tree','-r','-z',ref],cwd=root).split(b'\0');base={};modes={}
proc=subprocess.Popen(['git','cat-file','--batch'],cwd=root,stdin=subprocess.PIPE,stdout=subprocess.PIPE)
for l in lines:
 if not l:continue
 info,path=l.split(b'\t');mode,typ,oid=info.split();k=path.decode()
 if typ!=b'blob':continue
 proc.stdin.write(oid+b'\n');proc.stdin.flush();n=int(proc.stdout.readline().split()[2]);b=proc.stdout.read(n);proc.stdout.read(1);base[k]=hashlib.sha256(b).hexdigest();modes[k]=mode.decode()
proc.stdin.close();proc.wait()
overlay={k:{'sha256':v,'bytes':(Path('/private/tmp/st-native-combined-c21/candidate')/k).stat().st_size,'baseSha256':base.get(k)} for k,v in paths.items() if base.get(k)!=v}
(p/'PORTABLE-OVERLAY-REQUIRED.json').write_text(json.dumps(overlay,indent=2)+'\n')
(p/'SCOPED-MANIFEST.json').write_text(json.dumps(paths,indent=2)+'\n')
(p/'SCOPED-UNRESOLVED.json').write_text(json.dumps({k:v for k,v in missing.items() if scope(k)},indent=2)+'\n')
summary={'base':ref,'scopeFiles':len(paths),'overlayFiles':len(overlay),'overlayUncompressedBytes':sum(v['bytes'] for v in overlay.values()),'unresolvedScoped':sum(scope(k) for k in missing),'nonTargetBaselinePaths':[k for k in base if k not in m]}
(p/'PLAN-SUMMARY.json').write_text(json.dumps(summary,indent=2)+'\n');print({k:v for k,v in summary.items() if k!='nonTargetBaselinePaths'})
