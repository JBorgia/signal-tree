import pathlib,subprocess,os,json,time
root=pathlib.Path('/private/tmp/st-r4-review-resumed'); cwd=root/'candidate'; commands=json.loads((root/'COMMANDS.json').read_text());
names=commands['membership-regression'][6:-1]+['joint-membership-completion.spec.ts','joint-membership-phase.spec.ts','joint-membership-seal-independent.spec.ts','joint-mixed-seal.spec.ts','joint-install-boundary-independent.spec.ts','joint-install-validation.spec.ts','publication-membership-provenance.spec.ts','entity-membership-producer.spec.ts','entity-membership-view.spec.ts','entity-membership-view-v16-controls.spec.ts']
files=[]
for name in names:
 matches=list((cwd/'packages/kernel').rglob(name)); assert matches,name
 for p in matches:
  s=p.read_text(); assert 'appendFile' not in s and 'writeFile' not in s,(name,'external write inspection required');files.append(str(p.relative_to(cwd)))
env=os.environ.copy();env.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_NO_CLOUD='true',CI='true');
cmd=['corepack','pnpm','nx','test','kernel','--skip-nx-cache',*names,'--maxWorkers=1'];(root/'controls-retry-command.json').write_text(json.dumps({'command':cmd,'cwd':str(cwd),'env':{k:env[k] for k in ['PATH','NX_DAEMON','NX_ISOLATE_PLUGINS','NX_NO_CLOUD','CI']},'files':files},indent=2));
with (root/'controls-retry.log').open('w') as out:
 p=subprocess.run(cmd,cwd=cwd,env=env,stdout=out,stderr=subprocess.STDOUT)
(root/'controls-retry-exit.json').write_text(json.dumps({'exit':p.returncode}));print('exit',p.returncode);print((root/'controls-retry.log').read_text()[-5000:])
