from pathlib import Path
import json,hashlib,shutil
p=Path(__file__).parent; out=p/'boundary-adjudication';out.mkdir(exist_ok=False)
other=Path('/private/tmp/st-parent-freshness-other-frameworks');c10=Path('/private/tmp/st-native-combined-c10');proof=Path('/private/tmp/st-parent-freshness-resumed/c8-proof');base=Path('/private/tmp/st-native-combined-c8');repo=Path('/Users/jonathanborgia/code/signaltree')
h=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
records=[]
def copy(src,rel,kind):
 dst=out/rel;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dst);records.append({'original':str(src),'archived':rel,'sha256':h(dst),'kind':kind});return dst
for label,src in [('proof',proof/'SNAPSHOT-PROOF.json'),('c8',base/'SNAPSHOT-C8.json'),('c10-initial',c10/'SNAPSHOT-C10-INITIAL.json'),('counterparts',other/'SNAPSHOT-COUNTERPARTS.json')]:copy(src,'identities/'+label+'.json','manifest')
for n in ['REVIEW.md','IDENTITY.json','TESTS.patch','EVIDENCE-SHA256.json']:
 copy(other/n,'counterparts/'+n,'producer evidence')
for facade in ['vue','solid','react']:
 for prefix in ['', 'c8-']:
  for suffix in ['.log','-command.json','-exit.json']:
   n=prefix+facade+'-final'+suffix;copy(other/n,'counterparts/'+n,'producer run; independently inspected, not rerun')
for n in ['COMMAND.json','RESULT.json','first.log']:
 copy(p/'runs/boundary-public-controls'/n,'own-run/'+n,'independently executed targeted controls')
source_names=['packages/kernel/README.md','packages/kernel/src/lib/signal-tree.ts','packages/kernel/src/lib/internals/materialize-markers.ts','packages/kernel/src/lib/internals/member-membership.ts','packages/kernel/src/lib/internals/intrinsic-mutation.ts','packages/kernel/src/lib/experimental-publication/private.ts','packages/kernel/src/lib/absent-collection.spec.ts']
m=json.loads((proof/'SNAPSHOT-PROOF.json').read_text())
for n in source_names:
 assert h(other/'candidate'/n)==m[n],n
 copy(other/'candidate'/n,'proof-source/'+n,'matches frozen proof manifest')
for n in ['packages/vue/src/lib/parent-freshness-counterparts.spec.ts','packages/solid/src/lib/parent-freshness-counterparts.spec.ts','packages/react/src/parent-freshness-counterparts.spec.tsx']:
 assert h(other/'candidate'/n)==h(other/'c8-baseline'/n),n
 copy(other/'candidate'/n,'counterpart-tests/'+n,'byte-identical test in proof and C8 arms')
m=json.loads((c10/'SNAPSHOT-C10-INITIAL.json').read_text())
for n in ['packages/kernel/src/lib/whole-value-new-keys.spec.ts','packages/kernel/src/lib/signal-tree.ts','packages/kernel/src/lib/internals/materialize-markers.ts','packages/kernel/src/lib/internals/tree-scalar-slot-runtime.ts']:
 assert h(c10/'candidate'/n)==m[n],n
 copy(c10/'candidate'/n,'c10-source/'+n,'matches C10 initial manifest')
for n in ['docs/review-contract.md','docs/architecture/multi-actor/framework-current-read/DECISION.md','docs/architecture/multi-actor/native-occurrence/continuation/parent-freshness-design-resumed/PROOF-PLAN.md','docs/architecture/multi-actor/native-occurrence/continuation/parent-freshness-design-resumed/DESIGN.md']:
 copy(repo/n,'contracts/'+n,'contract at adjudication archival time')
# Capture a bounded excerpt only: this full run had no RESULT.json when inspected.
run=Path('/private/tmp/st-native-combined-c10-promoted/runs/kernel-full')
copy(run/'COMMAND.json','c10-full-run/COMMAND.json','external in-progress command; not independently run')
lines=(run/'first.log').read_text().splitlines();excerpt='\n'.join(f'{i+1}: {line}' for i,line in enumerate(lines) if 'preserves entry order during equality' in line)+'\n'
(out/'c10-full-run/observed-failure-excerpt.txt').write_text(excerpt)
records.append({'original':str(run/'first.log'),'archived':'c10-full-run/observed-failure-excerpt.txt','sha256':h(out/'c10-full-run/observed-failure-excerpt.txt'),'kind':'bounded failure excerpt; no final full-suite disposition inferred'})
(out/'EVIDENCE.json').write_text(json.dumps({'repositoryHeadInspected':'628d302dadb082a48c58528651c9088234d0a777','records':records,'mutations':'Only review artifacts in independent directory; no runtime or test edits'},indent=2)+'\n')
print('Archived',len(records),'evidence files')
