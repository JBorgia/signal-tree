from pathlib import Path
import os,subprocess,json,hashlib
w=Path(__file__).resolve().parent;c=w/'candidate';env=os.environ.copy();env.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_NO_CLOUD='true',npm_config_cache='/private/tmp/st-c28-r3-entity-artifact-gate-work/cold-a-cache',npm_config_fetch_retries='0',npm_config_fetch_timeout='20000');env.pop('NODE_OPTIONS',None);env.pop('NODE_PATH',None)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def run(label,args,extra={}):
 (w/(label+'-command.json')).write_text(json.dumps({'argv':args,'cwd':str(c),'env':extra},indent=2)+'\n')
 with (w/(label+'.log')).open('w') as log:
  r=subprocess.run(args,cwd=c,env=env|extra,stdout=log,stderr=subprocess.STDOUT,timeout=600)
 (w/(label+'-result.json')).write_text(json.dumps({'exit':r.returncode})+'\n');print(label,r.returncode,flush=True);return r.returncode
before=sha(c/'tools/verify-entity-registration-artifacts.mjs')
assert run('tmpdir-preflight',['node','tools/verify-entity-registration-artifacts.mjs','--self-test'],{'TMPDIR':str(c)})!=0
assert 'TMPDIR must be outside a workspace' in (w/'tmpdir-preflight.log').read_text()
selection='--only=entity-registration-artifacts,entity-registration-artifacts:self'
assert run('registry-offline-negative',['node','tools/verify-gates.mjs',selection,'--self-test'],{'npm_config_cache':str(w/'empty-npm-cache'),'npm_config_offline':'true'})!=0
negative=(w/'registry-offline-negative.log').read_text()
assert 'baseline-ci failed during setup/control' in negative,negative[-4000:]
assert '0/2 gates PROVEN' in negative and '2 errored' in negative,negative[-4000:]
assert sha(c/'tools/verify-entity-registration-artifacts.mjs')==before
assert run('registry-normal',['node','tools/verify-gates.mjs',selection])==0
assert run('registry-blindness-positive',['node','tools/verify-gates.mjs',selection,'--self-test'])==0
positive=(w/'registry-blindness-positive.log').read_text()
assert 'caught it (exit 42)' in positive and '2/2 gates PROVEN' in positive
assert sha(c/'tools/verify-entity-registration-artifacts.mjs')==before
(w/'FOCUSED-RESULTS.json').write_text(json.dumps({'tmpdirPreflight':'rejected before consumer creation','registryOfflineNegative':'0/2 proven, 2 errored; baseline-ci setup failure','registryNormal':'2/2 passed; clean baseline, behavioral mutation, clean recovery','registryBlindnessPositive':'2/2 proven, identified witness exit42','toolRestoredHash':before,'node':subprocess.check_output(['node','--version'],env=env,text=True).strip(),'npm':subprocess.check_output(['npm','--version'],env=env,text=True).strip()},indent=2)+'\n')
