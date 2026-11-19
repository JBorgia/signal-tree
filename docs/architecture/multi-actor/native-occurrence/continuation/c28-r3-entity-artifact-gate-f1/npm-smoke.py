from pathlib import Path
import subprocess,os,json,datetime
w=Path(__file__).resolve().parent;c=w/'candidate';e=os.environ.copy();e['PATH']=str(w/'npm-11.21.1/node_modules/.bin')+':/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+e['PATH'];e.update(npm_config_cache=str(w/'npm-11.21.1-smoke-cache'),npm_config_fetch_retries='0',npm_config_fetch_timeout='20000')
version=subprocess.check_output(['npm','--version'],cwd=c,env=e,text=True).strip();assert version=='11.21.1'
seal=subprocess.check_output(['node','--input-type=module','-e',"import {buildIntegrity} from './scripts/publish-artifact-integrity.mjs';import {RELEASE_PACKAGES} from './scripts/release-plan.mjs';console.log(buildIntegrity(process.cwd(),RELEASE_PACKAGES))"],cwd=c,env=e,text=True).strip()
argv=['node','tools/verify-gates.mjs','--only=entity-registration-artifacts','--artifact-integrity='+seal]
(w/'npm-11.21.1-smoke-command.json').write_text(json.dumps({'argv':argv,'cwd':str(c),'npm':version,'cache':e['npm_config_cache'],'scope':'one normal sealed artifact gate; no build or mutation rerun'},indent=2)+'\n')
with (w/'npm-11.21.1-smoke.log').open('w') as log:r=subprocess.run(argv,cwd=c,env=e,stdout=log,stderr=subprocess.STDOUT,timeout=240)
(w/'npm-11.21.1-smoke-result.json').write_text(json.dumps({'exit':r.returncode,'npm':version,'seal':seal,'dateUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()},indent=2)+'\n');print('publish-version gate smoke',r.returncode,flush=True)
