from pathlib import Path
import os,subprocess,json,tarfile,hashlib,tempfile,re,time
home=Path('/private/tmp/st-native-shared-failure-triage');root=Path(tempfile.mkdtemp(prefix='production-87f-',dir=home));base=root/'candidate';base.mkdir();commit='87f6831fa60cafe87508f0ace84b7638698ca3b0';repo=Path('/Users/jonathanborgia/code/signaltree')
(root/'archive-command.json').write_text(json.dumps({'argv':['git','archive','--format=tar',commit],'cwd':str(repo)},indent=2))
with (root/'source.tar').open('wb') as f:subprocess.run(['git','archive','--format=tar',commit],cwd=repo,stdout=f,check=True)
manifest={}
with tarfile.open(root/'source.tar') as tar:
 for entry in tar:
  if entry.isfile():manifest[entry.name]=hashlib.sha256(tar.extractfile(entry).read()).hexdigest()
 tar.extractall(base,filter='data')
for n,h in manifest.items():assert hashlib.sha256((base/n).read_bytes()).hexdigest()==h,n
mf=root/'SOURCE-SHA256.json';mf.write_text(json.dumps(manifest,indent=2,sort_keys=True));(base/'node_modules').symlink_to('/private/tmp/v16-transition-qualification/node_modules')
env=os.environ.copy();env.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false')
for k in ['ST_PERF','ST_PERF_OUTPUT_FILE','SEMANTICS_REPORT']:env.pop(k,None)
node=subprocess.check_output(['node','--version'],env=env,text=True).strip();pnpm=subprocess.check_output(['corepack','pnpm','--version'],env=env,cwd=base,text=True).strip();assert node=='v24.15.0' and pnpm=='10.17.0'
identity={'commit':commit,'sourceManifestSha256':hashlib.sha256(mf.read_bytes()).hexdigest(),'archiveSha256':hashlib.sha256((root/'source.tar').read_bytes()).hexdigest(),'node':node,'pnpm':pnpm,'sourceFiles':len(manifest),'dependencies':'/private/tmp/v16-transition-qualification/node_modules','versions':{n:json.loads((base/'node_modules'/n/'package.json').read_text())['version'] for n in ['nx','vitest','typescript','@angular/core','react','vue','solid-js']}}
(root/'IDENTITY.json').write_text(json.dumps(identity,indent=2));print(str(root),flush=True)
(home/'PRODUCTION-RUN-PATH.txt').write_text(str(root)+'\n')
proposed=json.loads((home/'PROPOSED-87F-COMMANDS.json').read_text());results=[]
for i,item in enumerate(proposed,1):
 out=root/('%02d'%i);out.mkdir();obs=out/'observations';obs.mkdir();pe=obs/'prepared';pe.mkdir();pu=obs/'public';pu.mkdir()
 runenv=env.copy();runenv.update(ST_OBSERVATIONS=str(obs/'native.jsonl'),ST_PREPARED_REVIEW_OUTPUT=str(pe),ST_PUBLIC_DIAGNOSTIC_OUTPUT=str(pu))
 assert manifest[item['identity']['file']]==item['fixtureSha256']
 # Equivalent exact-name regex: escape only regex syntax, not spaces/hyphens.
 pattern=re.sub(r'([.^$*+?{}\[\]\\|()])',r'\\\1',item['identity']['fullName'])
 cmd=[a if not a.startswith('--testNamePattern=') else '--testNamePattern='+pattern for a in item['argv']]
 (out/'COMMAND.json').write_text(json.dumps({'argv':cmd,'cwd':str(base),'identity':item['identity'],'fixtureSha256':item['fixtureSha256'],'environment':{k:runenv[k] for k in ['NX_DAEMON','NX_ISOLATE_PLUGINS','ST_OBSERVATIONS','ST_PREPARED_REVIEW_OUTPUT','ST_PUBLIC_DIAGNOSTIC_OUTPUT']},'filterNote':'Equivalent full-name regex; literal whitespace and hyphens need no escape. No fixture or timeout changes.'},indent=2))
 started=time.time()
 with (out/'first.log').open('w') as log:result=subprocess.run(cmd,cwd=base,env=runenv,stdout=log,stderr=subprocess.STDOUT)
 plain=re.sub(r'\x1b\[[0-9;]*m','',(out/'first.log').read_text());summary=[line.strip() for line in plain.splitlines() if re.match(r'\s*(Test Files|Tests)\s',line)]
 record={'number':i,'exit':result.returncode,'identity':item['identity'],'summary':summary,'elapsedSecondsForRunTrackingOnly':time.time()-started}
 (out/'RESULT.json').write_text(json.dumps(record,indent=2));results.append(record);(root/'RESULTS.json').write_text(json.dumps(results,indent=2));print(i,result.returncode,summary,flush=True)
for n,h in manifest.items():assert hashlib.sha256((base/n).read_bytes()).hexdigest()==h,n
(root/'SOURCE-UNCHANGED.json').write_text(json.dumps({'allArchivedFilesUnchanged':True,'files':len(manifest)},indent=2))
