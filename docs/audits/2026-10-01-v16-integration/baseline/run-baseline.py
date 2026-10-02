import os,json,hashlib,subprocess,time,pathlib
root=pathlib.Path('/private/tmp/signaltree-v16-integration');out=pathlib.Path('/private/tmp/st-v16-integration-evidence/baseline')
node='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node'
env=os.environ.copy();env.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:/Users/jonathanborgia/Library/pnpm:'+env['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',SEMANTICS_REPORT=str(out/'semantics-current-report.txt'))
def git(*args):return subprocess.check_output(['git',*args],cwd=root,text=True).strip()
def hashes():
 paths=list((root/'packages/kernel/src').rglob('*.ts'))+[root/x for x in ['tools/run-semantics-supplemental.mjs','tools/run-core-vitest.mjs','packages/kernel/vitest.config.ts','packages/kernel/project.json','nx.json','pnpm-lock.yaml','.nvmrc']]
 return {str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(paths)}
receipt={'sourceSHA':git('rev-parse','HEAD'),'cwd':str(root),'mode':'current','node':subprocess.check_output([node,'--version'],text=True).strip(),'statusBefore':git('status','--short'),'inputsBefore':hashes(),'runs':[]}
assert receipt['sourceSHA']=='628d302dadb082a48c58528651c9088234d0a777'
assert not (out/'receipt.json').exists()
(out/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
commands=[(suite,[node,'tools/run-semantics-supplemental.mjs','current',str(out/(suite+'.json'))]+([] if suite=='scalar' else [suite])) for suite in ['scalar','structural','composition','authority']]
commands.append(('semantics-current',['pnpm','nx','test','kernel','--skip-nx-cache','--testFile=src/enhancers/transactions/semantics-current.spec.ts','--reporter=json','--outputFile='+str(out/'semantics-current-vitest.json')]))
for name,cmd in commands:
 start=time.time()
 with (out/(name+'.stdout.log')).open('w') as stdout,(out/(name+'.stderr.log')).open('w') as stderr:
  result=subprocess.run(cmd,cwd=root,env=env,stdout=stdout,stderr=stderr)
 entry={'name':name,'command':cmd,'exitCode':result.returncode,'seconds':round(time.time()-start,3),'stdout':name+'.stdout.log','stderr':name+'.stderr.log'}
 p=out/(name+'.json')
 if p.exists():
  raw=json.loads(p.read_text());entry.update(totals=raw.get('totals'),cases=len(raw.get('rows',[])),changedInputs=raw.get('changedInputs'),recordedInputCount=len(raw.get('inputs',{})))
 receipt['runs'].append(entry);(out/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(entry),flush=True)
receipt.update(sourceSHAAfter=git('rev-parse','HEAD'),statusAfter=git('status','--short'),inputsAfter=hashes(),complete=True)
receipt['changedPreexistingInputs']=[p for p,h in receipt['inputsBefore'].items() if receipt['inputsAfter'].get(p)!=h]
receipt['addedInputs']=sorted(set(receipt['inputsAfter'])-set(receipt['inputsBefore']))
(out/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
