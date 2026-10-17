#!/usr/bin/env python3
import pathlib,subprocess,sys,json,hashlib,platform,time
root=pathlib.Path(__file__).resolve().parents[5]
baseline=pathlib.Path(sys.argv[1]).resolve();out=pathlib.Path(sys.argv[2]).resolve();out.mkdir(parents=True,exist_ok=True)
node=sys.argv[3] if len(sys.argv)>3 else 'node';child=pathlib.Path(__file__).with_name('child.mjs')
manifest={}
for arm,repo in [('baseline',baseline),('B',root)]:
 manifest[arm]={'repo':str(repo),'head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip(),'dirty':subprocess.check_output(['git','status','--short'],cwd=repo,text=True),'files':{str(p.relative_to(repo)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((repo/'dist/packages').rglob('*')) if p.is_file()}}
(out/'artifact-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
scenarios=[('ordinary-scalar',2000,32),('ordinary-entity',1000,32),('rollback',500,32),('rollback',500,1024),('confirm',500,32),('refusal-recovery',200,32),('churn',500,32),('construct',200,32),('retention',100,8),('retention',1000,8)]
results=[];failures=[]
for scenario,count,size in scenarios:
 for sample in range(3):
  order=['baseline','AA','B'] if sample%2==0 else ['B','AA','baseline']
  for label in order:
   arm='B' if label=='B' else 'baseline';repo=root if arm=='B' else baseline
   name=f'{scenario}-{size}-{count}-{sample}-{label}';cmd=[node,'--expose-gc',str(child),str(repo),arm,scenario,str(count),str(size)]
   r=subprocess.run(cmd,text=True,capture_output=True);(out/(name+'.stdout')).write_text(r.stdout);(out/(name+'.stderr')).write_text(r.stderr)
   if r.returncode:
    failures.append({'name':name,'exit':r.returncode,'command':cmd});print('FAIL',name,flush=True);continue
   row=json.loads(r.stdout);row.update(label=label,sample=sample);results.append(row);print('PASS',name,flush=True)
(out/'samples.json').write_text(json.dumps(results,indent=2)+'\n');(out/'failures.json').write_text(json.dumps(failures,indent=2)+'\n')
# Capability-only probes deliberately do not contribute a throughput ranking.
for arm,repo in [('baseline',baseline),('B',root)]:
 r=subprocess.run([node,'--expose-gc',str(child),str(repo),arm,'overlap','5','8'],capture_output=True,text=True)
 (out/(arm+'-overlap.stdout')).write_text(r.stdout);(out/(arm+'-overlap.stderr')).write_text(r.stderr)
 (out/(arm+'-overlap.exit')).write_text(str(r.returncode)+'\n')
print('DONE',len(results),'qualified samples;',len(failures),'failed samples',flush=True)
