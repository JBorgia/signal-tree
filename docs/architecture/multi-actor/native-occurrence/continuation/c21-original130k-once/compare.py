from pathlib import Path
import json,hashlib,re,difflib,shutil
r=Path(__file__).resolve().parent;c=r/'candidate';base=Path('/private/tmp/st-native-combined-c19');h=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
a=json.loads((base/'SNAPSHOT-C19.json').read_text());b=json.loads((r/'SNAPSHOT-C21.json').read_text())
p='packages/kernel/src/lib/entity-large-batches.spec.ts';probe=Path('/private/tmp/st-c19-original130k-stage-trace/PROBE.spec.ts');original=(c/p).read_text();s=probe.read_text()
imports=lambda x:re.findall(r"import[^;]*?from\s+['\"]([^'\"]+)['\"]",x,re.S)
changes={k:{'C19':a.get(k),'C21':b.get(k)} for k in a.keys()|b.keys() if a.get(k)!=b.get(k)}
data={'C19manifest':h(base/'SNAPSHOT-C19.json'),'C21manifest':h(r/'SNAPSHOT-C21.json'),'C19toC21':changes,'originalSpecSha256':h(c/p),'sameOriginalC19':h(c/p)==a[p],'probeSha256':h(probe),'originalImports':imports(original),'probeImports':imports(s),'relativeImportsSame':[i for i in imports(original) if i.startswith('.')]==[i for i in imports(s) if i.startswith('.')],'sameReporterBytes':h(r/'progress-reporter.mjs')==h(Path('/private/tmp/st-native-combined-c21/progress-reporter.mjs'))}
# Preserve exact source/probe and difference; no transformation of candidate.
shutil.copyfile(c/p,r/'ORIGINAL.spec.ts.txt');shutil.copyfile(probe,r/'PROBE.spec.ts.txt')
(r/'PROBE-VS-ORIGINAL.diff').write_text(''.join(difflib.unified_diff(original.splitlines(True),s.splitlines(True),fromfile='unchanged original',tofile='instrumented probe')))
full=Path('/private/tmp/st-native-combined-c21/runs/full-kernel-watchdog')
shutil.copyfile(full/'progress.jsonl',r/'FULLRUN-progress.jsonl')
progress=[json.loads(x) for x in (full/'progress.jsonl').read_text().splitlines()]
data['fullrunModuleEnds']=sum(x.get('kind')=='module-end' for x in progress)
data['fullrunLastModules']=progress[-4:]
(r/'COMPARISON.json').write_text(json.dumps(data,indent=2)+'\n')
print(json.dumps(data,indent=2))
