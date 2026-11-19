from pathlib import Path
import json,subprocess,os,hashlib,shutil
w=Path(__file__).resolve().parent;b=Path('/private/tmp/st-c28-r3-registration-lint-combined');c=b/'candidate';env=os.environ.copy();env['PATH']='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'];env.pop('NODE_OPTIONS',None);env.pop('NODE_PATH',None)
def run(label,args,cwd,extra={}):
 e=env|extra
 (w/(label+'-command.json')).write_text(json.dumps({'argv':args,'cwd':str(cwd),'env':extra},indent=2))
 with (w/(label+'.log')).open('w') as log:r=subprocess.run(args,cwd=cwd,env=e,stdout=log,stderr=subprocess.STDOUT,timeout=180)
 (w/(label+'-result.json')).write_text(json.dumps({'exit':r.returncode}));print(label,r.returncode,flush=True);return r.returncode
def depgraph(lock):return {k:{f:v.get(f) for f in ['name','version','resolved','integrity']} for k,v in lock['packages'].items() if k and not k.startswith('node_modules/@signal-tree/')}
peers=w/'peer-qualification';base=json.loads((peers/'package-lock.json').read_text());g=depgraph(base)
assert all(v['integrity'] for v in g.values())
# Direct peer SRI records must agree with the canonical pnpm lock.
yaml=(c/'pnpm-lock.yaml').read_text()
for n,v in json.loads((peers/'package.json').read_text())['dependencies'].items():
 needle=f"{n}@{v}"
 lines=yaml.splitlines();idx=next(i for i,l in enumerate(lines) if l.strip().rstrip(':').strip("'")==needle)
 assert g['node_modules/'+n]['integrity'] in lines[idx+1],n
for arm in ['cold-a','cold-b']:
 p=w/arm;p.mkdir();[shutil.copy2(peers/f,p/f) for f in ['package.json','package-lock.json']]
 cache={'npm_config_cache':str(w/(arm+'-cache')),'npm_config_fetch_retries':'0','npm_config_fetch_timeout':'20000'}
 assert run(arm+'-ci',['npm','ci','--ignore-scripts','--no-audit','--no-fund'],p,cache)==0
 tarballs=sorted((b/'tarballs').glob('*.tgz'))
 assert run(arm+'-install',['npm','install','--save-exact','--ignore-scripts','--no-audit','--no-fund',*[str(x) for x in tarballs]],p,cache)==0
 lock=json.loads((p/'package-lock.json').read_text());assert depgraph(lock)==g,'external dependency drift'
 for t in tarballs:
  import base64
  name=t.name.removeprefix('signal-tree-').split('-16.')[0];entry=lock['packages']['node_modules/@signal-tree/'+name]
  assert entry['integrity']=='sha512-'+base64.b64encode(hashlib.sha512(t.read_bytes()).digest()).decode()
 for f in ['cases.mjs','lifecycle.mjs','receipt-cases.ts']:shutil.copy2(c/'packages/kernel/tests/entity-registration'/f,p/f)
 for f in ['consumer.mjs','lifecycle-consumer.mjs','receipt-consumer.mjs','no-link.mjs','facade-imports.mjs']:shutil.copy2(c/'tools/experiments/entity-registration'/f,p/f)
 for f in ['consumer','lifecycle-consumer','receipt-consumer','no-link','facade-imports']:assert run(arm+'-'+f,['node',f+'.mjs'],p)==0
 assert run(arm+'-bundle',['node',str(c/'tools/experiments/entity-registration/build-consumers.mjs'),str(p)],c)==0
 for f in ['consumer','lifecycle-consumer','receipt-consumer','no-link']:assert run(arm+'-'+f+'-production',['node',f+'.production.mjs'],p)==0
p=w/'unavailable';p.mkdir();[shutil.copy2(peers/f,p/f) for f in ['package.json','package-lock.json']]
code=run('unavailable-ci',['npm','ci','--ignore-scripts','--no-audit','--no-fund','--offline'],p,{'npm_config_cache':str(w/'empty-cache')})
assert code!=0
(w/'QUALIFICATION.json').write_text(json.dumps({'setup':'passed','coldInstalls':2,'externalRecords':len(g),'directPeerIntegritiesMatchPnpm':True,'tarballIntegrityMatch':True,'manualProbes':'both modes both consumers passed','negative':{'exit':code,'classification':'setup-failure','semanticMutationKill':False}},indent=2)+'\n')
