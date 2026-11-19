from pathlib import Path
import json,hashlib,shutil,difflib
p=Path(__file__).parent;root=p/'candidate';h=lambda f:hashlib.sha256(f.read_bytes()).hexdigest();m=json.loads((p/'INPUT.json').read_text());bad=[n for n,v in m.items() if h(root/n)!=v];assert not bad,bad
(p/'VERIFICATION.json').write_text(json.dumps({'input_manifest_sha256':h(p/'INPUT.json'),'input_entries':len(m),'changed_original_entries':bad,'main_local_review_sha256':h(p/'MAIN-REVIEW.md')},indent=2)+'\n')
n='packages/kernel/src/lib/occupancy-successor-realization.spec.ts';original=(root/n).read_text();supported=(root/'packages/kernel/src/lib/independent-occupancy-supported-inverse.spec.ts').read_text();test=supported[supported.index("it('sparse revival"):]
proposal="import {getOwnedPositionIds,getOwnedSubjectIds} from './internals/owned-mutation';\nimport type {ReversalEffect} from './internals/causal-runtime/causal-types';\n"+original[:original.index("it('sparse revival")]+test
proposal=proposal.replace("  const replacement=tree.transact(()=>{", "  // Establish an authentic inverse: old a is removed; a fresh b displaces old b\n  // in ordinary membership while inspection retains old b physically at bb.\n  const replacement=tree.transact(()=>{")
f=p/'proposal'/n;f.parent.mkdir(parents=True,exist_ok=True);f.write_text(proposal)
(p/'OCCUPANCY-SETUP.patch').write_text(''.join(difflib.unified_diff(original.splitlines(True),proposal.splitlines(True),fromfile='a/'+n,tofile='b/'+n)))
for n in [n,'packages/kernel/src/lib/entity-signal.ts','packages/kernel/src/lib/internals/causal-runtime/target-transition.ts','packages/kernel/src/lib/internals/causal-runtime/tree-realization-adapter.ts','docs/review-contract.md']:
 dest=p/'evidence'/n;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(root/n,dest)
for f in (root/'packages/kernel/src/lib').glob('independent-occupancy-*.spec.ts'):
 dest=p/'evidence'/f.name;shutil.copy2(f,dest)
print('verified',len(m),'original entries; no changes')
