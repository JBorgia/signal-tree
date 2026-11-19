from pathlib import Path
import json,hashlib,shutil,subprocess,difflib
p=Path(__file__).parent;h=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
a=json.loads((p/'candidate-MANIFEST.json').read_text());b=json.loads((p/'oracle-MANIFEST.json').read_text());ident=json.loads((p/'IDENTITY.json').read_text())
report={}
for side,m in [('candidate',a),('oracle',b)]:
 report[side]={}
 for label,root in [('scratch',p/side),('frozen',Path(ident[side]['source']))]:
  bad=[n for n,v in m.items() if not (root/n).is_file() or h(root/n)!=v]
  report[side][label]={'checked':len(m),'mismatches':bad}
  assert not bad,(side,label,bad)
(p/'FINAL-VERIFICATION.json').write_text(json.dumps(report,indent=2)+'\n')
changes={n:{'C8a':b.get(n),'C11':a.get(n)} for n in sorted(a.keys()|b.keys()) if a.get(n)!=b.get(n)}
(p/'C8a-to-C11-files.json').write_text(json.dumps(changes,indent=2)+'\n')
with (p/'C8a-to-C11-runtime.patch').open('w') as out:
 for n in changes:
  if n.startswith('packages/') and n.endswith('.ts') and '.spec.' not in n:
   old=(p/'oracle'/n).read_text() if (p/'oracle'/n).exists() else ''
   new=(p/'candidate'/n).read_text() if (p/'candidate'/n).exists() else ''
   out.writelines(difflib.unified_diff(old.splitlines(True),new.splitlines(True),fromfile='C8a/'+n,tofile='C11/'+n))
selected=['packages/kernel/src/index.ts','packages/kernel/src/lib/entity-signal.ts','packages/kernel/src/lib/internals/intercept-leaf-signals.ts','packages/kernel/src/lib/internals/scalar-publication-coverage.ts','packages/kernel/src/lib/internals/causal-runtime/tree-realization-adapter.ts','packages/kernel/src/lib/internals/intercept-leaf-signals.spec.ts','packages/kernel/src/lib/internals/causal-runtime/heterogeneous-live-subject.spec.ts','packages/kernel/src/lib/structural-admission-sequence.spec.ts','packages/kernel/src/lib/occupancy-successor-realization.spec.ts','packages/kernel/src/lib/complete-structural-sequence.spec.ts','packages/kernel/src/lib/structural-completeness.spec.ts','docs/review-contract.md','docs/contributor-contracts.md','RELEASE-CURRENT.md','package.json','.nvmrc','packages/kernel/vitest.config.ts','tools/run-core-vitest.mjs']
for side in ['candidate','oracle']:
 for n in selected:
  dest=p/'evidence'/side/n;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p/side/n,dest)
 for src in (p/side/'packages/kernel/src/lib').rglob('independent-*.spec.ts'):
  dest=p/'evidence'/side/src.relative_to(p/side);dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dest)
(p/'RELEVANT-IDENTITIES.json').write_text(json.dumps({n:{'C8a':b.get(n),'C11':a.get(n),'same':b.get(n)==a.get(n)} for n in selected},indent=2)+'\n')
root=Path('/Users/jonathanborgia/code/signaltree')
with (p/'ROOT-STATUS.log').open('w') as out:
 for args in [['git','rev-parse','HEAD'],['git','branch','--show-current'],['git','status','--short']]:
  out.write('$ '+' '.join(args)+'\n');out.flush();subprocess.run(args,cwd=root,stdout=out,stderr=subprocess.STDOUT)
log=Path('/private/tmp/st-native-combined-c10-promoted/runs/kernel-full/first.log')
shutil.copy2(log,p/'C10-full-first-observed.log')
(p/'C10-LOG-IDENTITY.json').write_text(json.dumps({'source':str(log),'sha256':h(p/'C10-full-first-observed.log'),'qualification':'observed copy; not a full-run completion claim'},indent=2))
print(json.dumps(report))
