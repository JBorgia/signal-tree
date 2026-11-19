from pathlib import Path
import hashlib,json
p=Path(__file__).parent;s=Path('/private/tmp/st-parent-freshness-resumed/c8-proof');b=Path('/private/tmp/st-native-combined-c8');repo=Path('/Users/jonathanborgia/code/signaltree')
h=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
r={}
for label,manifest,root in [('frozenCandidate',s/'SNAPSHOT-PROOF.json',s/'candidate'),('frozenBase',b/'SNAPSHOT-C8.json',b/'candidate'),('reviewCandidate',s/'SNAPSHOT-PROOF.json',p/'candidate'),('reviewOracle',b/'SNAPSHOT-C8.json',p/'oracle')]:
 m=json.loads(manifest.read_text());bad=[n for n,v in m.items() if h(root/n)!=v];assert not bad,(label,bad);r[label]={'manifestSha256':h(manifest),'verifiedFiles':len(m),'mismatches':bad}
for side,n in [('angular',1),('oracle',0)]:
 d=json.loads((p/'runs'/('discriminators-'+side+'-final')/'observations/cold-error.json').read_text());assert d=={'backing':1,'native':0,'parent':{'n':n},'calls':1,'sameError':True}
r['coldErrorCrossArmAssertions']='passed'
contracts=['docs/review-contract.md','docs/contributor-contracts.md','docs/support-policy.md','.github/skills/adversarial-confirmation/references/protocol.md','docs/architecture/multi-actor/framework-current-read/DECISION.md','docs/architecture/multi-actor/native-occurrence/continuation/parent-freshness-design-resumed/REENTRY-CACHE-RULES.md','docs/architecture/multi-actor/native-occurrence/continuation/parent-freshness-design-resumed/HOOKS.md']
r['contracts']={n:h(repo/n) for n in contracts}
r['reviewArtifacts']={str(f.relative_to(p)):h(f) for f in [p/'REVIEW.md',p/'compare.py',p/'PAIRED-COMPARISONS.json',p/'candidate/packages/angular/src/lib/independent-parent-discriminators.spec.ts']}
(p/'FINAL-IDENTITY.json').write_text(json.dumps(r,indent=2));print(json.dumps({k:v for k,v in r.items() if k not in ['contracts','reviewArtifacts']},indent=2))
