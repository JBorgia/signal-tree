from pathlib import Path
import subprocess,os,json
w=Path(__file__).resolve().parent;c=w/'successor';env=os.environ.copy();env.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],npm_config_cache=str(w/'cold-a-cache'),npm_config_fetch_retries='0',npm_config_fetch_timeout='20000')
seal=subprocess.check_output(['node','--input-type=module','-e',"import {buildIntegrity} from './scripts/publish-artifact-integrity.mjs'; import {RELEASE_PACKAGES} from './scripts/release-plan.mjs'; console.log(buildIntegrity(process.cwd(),RELEASE_PACKAGES))"],cwd=c,env=env,text=True).strip()
def run(n,args,extra={}):
 with (w/(n+'.log')).open('w') as log:r=subprocess.run(args,cwd=c,env=env|extra,stdout=log,stderr=subprocess.STDOUT,timeout=240)
 print(n,r.returncode,flush=True);return r.returncode
assert run('registry-sealed',['node','tools/verify-gates.mjs','--only=entity-registration-artifacts','--artifact-integrity='+seal])==0
assert run('registry-wrong-seal',['node','tools/verify-gates.mjs','--only=entity-registration-artifacts','--artifact-integrity=sha256-'+'0'*64])!=0
assert run('tool-empty-cache',['node','tools/verify-entity-registration-artifacts.mjs','--self-test'],{'npm_config_cache':str(w/'tool-empty-cache'),'npm_config_offline':'true'})!=0
log=(w/'tool-empty-cache.log').read_text();p=Path(log.split('Entity artifact evidence: ')[1].splitlines()[0]);r=json.loads((p/'result.json').read_text());assert not r['passed'] and not r.get('mutation') and not r['arms'];assert 'baseline-ci failed during setup/control' in r['error']
(w/'EXTRA-CHECKS.json').write_text(json.dumps({'seal':seal,'sealedGate':'passed','wrongSeal':'rejected','emptyCache':'setup failure before any runtime/mutation','emptyCacheEvidence':str(p)},indent=2)+'\n')
