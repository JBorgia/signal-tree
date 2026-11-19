from pathlib import Path
import hashlib,json,shutil,difflib
p=Path(__file__).parent;h=lambda f:hashlib.sha256(f.read_bytes()).hexdigest();checks={}
for side in ['candidate','oracle']:
 m=json.loads((p/(side+'-MANIFEST.json')).read_text());bad=[n for n,v in m.items() if h(p/side/n)!=v];assert not bad,(side,bad);checks[side]={'unchangedManifestFiles':len(m),'mismatches':bad}
names=['packages/kernel/src/lib/tree-error-public-contract.spec.ts','packages/kernel/src/lib/occurrence-successor.spec.ts','packages/kernel/src/lib/entity-tap-reads.spec.ts','packages/kernel/src/lib/link.ts','packages/kernel/src/lib/experimental-publication/lifecycle.ts','packages/kernel/src/lib/experimental-publication/recipient-occurrence.ts','packages/kernel/src/lib/internals/native-occurrence.ts','packages/kernel/src/lib/joint-readiness.spec.ts']
checks['sourceComparison']={n:{'c10':h(p/'candidate'/n),'c8a':h(p/'oracle'/n),'identical':h(p/'candidate'/n)==h(p/'oracle'/n)} for n in names}
for n in names:
 dest=p/'evidence-source'/n;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p/'candidate'/n,dest)
for n in ['independent-occurrence-completion.spec.ts','independent-public-readiness.spec.ts']:
 source=p/'candidate/packages/kernel/src/lib'/n;assert h(source)==h(p/'oracle/packages/kernel/src/lib'/n)
 dest=p/'diagnostics'/n;dest.parent.mkdir(exist_ok=True);shutil.copy2(source,dest)
a=p/'candidate/packages/kernel/src/lib/occurrence-successor.spec.ts';b=p/'diagnostics/independent-occurrence-completion.spec.ts'
(p/'diagnostics/completion-only.patch').write_text(''.join(difflib.unified_diff(a.read_text().splitlines(True),b.read_text().splitlines(True),fromfile='original occurrence-successor.spec.ts',tofile='diagnostic copy')))
for n in ['docs/review-contract.md','docs/architecture/multi-actor/PLAN.md','docs/architecture/multi-actor/framework-current-read/DECISION.md','docs/architecture/multi-actor/native-occurrence/evidence/DESIGN.md','docs/architecture/multi-actor/native-occurrence/continuation/occurrence-contract-alignment/DECISION.md']:
 source=Path('/Users/jonathanborgia/code/signaltree')/n;dest=p/'contracts'/n;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,dest)
main=Path('/private/tmp/st-native-combined-c10-promoted/runs/kernel-full');dst=p/'main-partial-evidence';dst.mkdir(exist_ok=True)
shutil.copy2(main/'COMMAND.json',dst/'COMMAND.json')
lines=(main/'first.log').read_text().splitlines();selected=[]
for i,line in enumerate(lines):
 if any(n in line for n in ['tree-error-public-contract.spec.ts','occurrence-successor.spec.ts','entity-tap-reads.spec.ts']):
  selected.extend(f'{j+1}: {lines[j]}' for j in range(i,min(i+5,len(lines))))
(dst/'selected-excerpts.txt').write_text('\n'.join(selected)+'\n')
checks['runResults']={f.parent.name:json.loads(f.read_text()) for f in (p/'runs').glob('*/RESULT.json')}
(p/'VERIFIED.json').write_text(json.dumps(checks,indent=2)+'\n');print(json.dumps(checks['runResults']))
