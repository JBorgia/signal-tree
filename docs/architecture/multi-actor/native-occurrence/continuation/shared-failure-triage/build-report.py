from pathlib import Path
import json,hashlib,collections,re
r=Path('/private/tmp/st-native-broad-differential');o=Path('/private/tmp/st-native-shared-failure-triage');xs=json.loads((r/'SHARED-FAILURES.json').read_text());inv={x['file']:x for x in json.loads((o/'PRODUCTION-FIXTURE-INVENTORY.json').read_text())}
sets={
 'structural-refusal':{7,80},'refusal-reason':{3,4,5},'ordinary-membership-order':{8,9,24,25,60,61,62,63,64,81},'cross-tree-liveness':{65,66},'equal-row-admission':{28},'experimental-input-enrollment':set(range(10,16))|set(range(89,95)), 'experimental-retention-restoration':{35,36,79},'committed-capture-order':{59},'logical-work':{20,31,*range(82,89)},'private-membership-event':{33},'missing-id':{34},'public-handle-shape':{95}}
rows=[]
for i,pair in enumerate(xs):
 a=pair['after'];msg=a['failureMessages'][0];fam='occurrence-enrollment' if 'Native occurrence has no verified root/address' in msg else 'timeout' if 'STACK_TRACE_ERROR' in msg else next(k for k,v in sets.items() if i in v)
 p=inv[a['file']];rows.append({'ordinal':i,'family':fam,'identity':{k:a[k] for k in ['project','file','fullName','duplicateOrdinal']},'productionFixture':'identical' if p['identicalToProduction'] else 'changed' if p['productionExists'] else 'absent','beforeMessage':pair['before']['failureMessages'],'afterMessage':a['failureMessages']})
(o/'TRIAGE-107.json').write_text(json.dumps(rows,indent=2))
counts=collections.Counter(x['family'] for x in rows)
# These are proposed commands only, against a future verified disposable archive of exact production.
chosen=[(18,'P1','ordinary entity field Link enrollment'),(80,'P1','public external structural drift and sibling atomicity'),(24,'P1','inspection-only sibling contamination'),(60,'P1','collection omission/re-add payload'),(65,'P1','foreign transaction must not delay local publication'),(34,'P2','missing-id warning versus new throw'),(16,'P2','row settlement timeout, after field enrollment attribution'),(31,'P2','fixed point-update logical work, no timing claim')]
commands=[]
for i,priority,why in chosen:
 x=rows[i];assert x['productionFixture']=='identical';ident=x['identity'];commands.append({'priority':priority,'reason':why,'cwd':'<new disposable git archive of 87f6831fa60cafe87508f0ace84b7638698ca3b0>','identity':ident,'fixtureSha256':inv[ident['file']]['productionSha256'],'argv':['corepack','pnpm','nx','test',ident['project'],'--skip-nx-cache',Path(ident['file']).name,'--testNamePattern='+re.escape(ident['fullName']),'--reporter=verbose','--maxWorkers=1'],'environment':{'NX_DAEMON':'false','NX_ISOLATE_PLUGINS':'false','ST_OBSERVATIONS':'<unique output directory>/observations.jsonl'},'executed':False})
(o/'PROPOSED-87F-COMMANDS.json').write_text(json.dumps(commands,indent=2))
inputs=[r/'SHARED-FAILURES.json',r/'SHARED-FAILURE-GROUPS.json',r/'IDENTITIES.json',r/'SUMMARY.json']
(o/'INPUT-SHA256.json').write_text(json.dumps({str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in inputs},indent=2))
print(dict(counts));print('production inventory',collections.Counter(x['productionFixture'] for x in rows))
