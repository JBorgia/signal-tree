from pathlib import Path
import subprocess,json,os,signal
r=Path(__file__).resolve().parent;c=r/'candidate';env=os.environ.copy();env['PATH']='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'];env.pop('NODE_OPTIONS',None)
for k in list(env):
 if k.startswith('ST_'):env.pop(k)
for project in ['kernel','angular','react','vue','solid']:
 d=r/'discovery'/project;d.mkdir(parents=True,exist_ok=False);argv=['corepack','pnpm','exec','vitest','list','--filesOnly','--json','--config',f'packages/{project}/vitest.config.ts']
 if project=='kernel':argv+=['--root','packages/kernel']
 (d/'COMMAND.json').write_text(json.dumps({'cwd':str(c),'argv':argv,'mode':'file discovery only; no tests','PATH':env['PATH']},indent=2))
 with (d/'stdout.json').open('w') as out,(d/'stderr.log').open('w') as err:
  p=subprocess.Popen(argv,cwd=c,env=env,stdout=out,stderr=err,start_new_session=True)
  try:code=p.wait(timeout=60)
  except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGTERM);code=p.wait(timeout=10)
 (d/'RESULT.json').write_text(json.dumps({'exit':code,'pid':p.pid,'pgid':p.pid}))
 print(project,code,flush=True)
 if code:break
