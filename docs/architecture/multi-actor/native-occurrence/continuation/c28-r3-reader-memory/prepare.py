from pathlib import Path
import json,hashlib,shutil,datetime
w=Path(__file__).resolve().parent;old=Path('/private/tmp/st-c28-r3-matched-memory');worker=Path('/private/tmp/st-c28-r3-cold-row-responsibility');sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
inputs={'baseline':(Path('/private/tmp/st-c28-r3-entity-artifact-gate-f1/candidate'),worker/'BASE-MANIFEST.json','8f902607f4e4f9fa31bda66c0b1c87ce3fe38a6c2b7a145c366498a5fc9d5333'),'reader':(worker/'candidate',worker/'CANDIDATE-FIRST-MANIFEST.json','812a3ad5d6843e95a791aaf001927d54f67738626360a50afb9f7871fdfcd302')}
excluded=['packages/kernel/src/lib/cold-row-responsibility.spec.ts','packages/kernel/src/lib/preparation-reader-comparison.spec.ts'];test='packages/kernel/src/lib/entity-large-batches.spec.ts';identity={}
for arm,(root,mp,expected) in inputs.items():
 assert sha(mp)==expected,(arm,sha(mp));m=json.loads(mp.read_text());bad=[k for k,h in m.items() if sha(root/k)!=h];assert not bad,bad
 selected={k:v for k,v in m.items() if k not in excluded};c=w/arm/'candidate';c.mkdir(parents=True,exist_ok=False)
 for k,h in selected.items():
  dst=c/k;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(root/k,dst);assert sha(dst)==h,k
 (c/'node_modules').symlink_to('/Users/jonathanborgia/code/signaltree/node_modules',target_is_directory=True)
 out=w/arm/'MANIFEST.json';out.write_text(json.dumps(selected,indent=2)+'\n');shutil.copy2(mp,w/(arm+'-FROZEN-MANIFEST.json'))
 identity[arm]={'frozenPath':str(root),'frozenManifest':expected,'frozenFiles':len(m),'measurementPath':str(c),'selectedFiles':len(selected),'selectedManifest':sha(out),'excluded':[k for k in excluded if k in m]}
 assert (root/test).read_bytes()==(old/'ORIGINAL.spec.ts').read_bytes(),arm
for name in ['ORIGINAL.spec.ts','INSTRUMENTED-TEMPLATE.spec.ts','instrumentation.patch']:shutil.copy2(old/name,w/name)
shutil.copy2('/private/tmp/st-r3-compatibility-inventory/full-reporter.mjs',w/'full-reporter.mjs')
template=(w/'INSTRUMENTED-TEMPLATE.spec.ts').read_text();original=(w/'ORIGINAL.spec.ts').read_text();tail=template.split('// END MEMORY-ONLY INSTRUMENTATION\n',1)[1];assert ''.join(l for l in tail.splitlines(True) if '// MEMORY-ONLY' not in l)==original
maps={a:json.loads((w/a/'MANIFEST.json').read_text()) for a in inputs};delta=[k for k in maps['reader'] if maps['reader'][k]!=maps['baseline'].get(k)]
assert set(delta)=={'packages/kernel/src/lib/entity-signal.ts','packages/kernel/src/lib/internals/entity-preparation-reader.ts','packages/kernel/src/lib/internals/causal-runtime/tree-realization-adapter.ts'}
schedule=[('baseline',128,1),('reader',128,1),('reader',512,1),('baseline',512,1),('baseline',2048,1),('reader',2048,1),('reader',512,2),('baseline',512,2)];commands=[]
for arm,n,rep in schedule:
 d=w/'runs'/f'{arm}-{n}-r{rep}';body=template.replace('const LARGE = 130_000;',f'const LARGE = {n};');assert body!=template
 argv=['corepack','pnpm','nx','test','kernel','src/lib/entity-large-batches.spec.ts','--testNamePattern=^entity batches larger than the argument limit','--skip-nx-cache','--maxWorkers=1','--reporter=default','--reporter='+str(w/'full-reporter.mjs')]
 commands.append({'arm':arm,'size':n,'replicate':rep,'cwd':str(w/arm/'candidate'),'argv':argv,'testSha256':hashlib.sha256(body.encode()).hexdigest(),'runDir':str(d)})
(w/'COMMANDS.json').write_text(json.dumps(commands,indent=2)+'\n');(w/'IDENTITY.json').write_text(json.dumps({'registeredAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'inputs':identity,'runtimeDelta':delta,'originalTest':sha(w/'ORIGINAL.spec.ts'),'instrumentedTemplate':sha(w/'INSTRUMENTED-TEMPLATE.spec.ts'),'inverseExact':True,'reporter':sha(w/'full-reporter.mjs'),'commands':sha(w/'COMMANDS.json'),'dependencySymlink':'/Users/jonathanborgia/code/signaltree/node_modules','measurementKind':'source Nx/Vitest with installed tools; no built package claim'},indent=2)+'\n')
# Preserve Main receipts without rerunning their checks.
prior={}
for name in ['main-angular-entities','main-react-entities','main-vue-entities','main-solid-entities','main-existing-realization','main-source-types']:
 d=worker/'runs'/name;prior[name]={'path':str(d),'exit':(d/'EXIT').read_text().strip(),'summaries':[l for p in d.glob('*.log') for l in p.read_text(errors='replace').splitlines() if 'Test Files ' in l or 'Tests ' in l]}
(w/'MAIN-PRIOR-RESULTS.json').write_text(json.dumps(prior,indent=2)+'\n')
print(json.dumps(identity,indent=2),flush=True)
