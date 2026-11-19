from pathlib import Path
import json,statistics,csv,math
p=Path(__file__).resolve().parent;reg=json.loads((p/'PREREGISTRATION.json').read_text());status=json.loads((p/'STATUS.json').read_text());rows=[]
for r in status['results']:
 if not r['valid']:continue
 o=json.loads((p/'children'/r['id']/'stdout.json').read_text());values={}
 if 'timing' in o:
  t=o['timing'];values={'sync_ms':t['syncMs'],'drain_ms':t['drainMs'],'sync_cpu_ms':sum(t['syncCpu'].values())/1000,'total_cpu_ms':sum(t['totalCpu'].values())/1000,'sync_user_ms':t['syncCpu']['user']/1000,'sync_system_ms':t['syncCpu']['system']/1000}
 else:
  m=o['memory'];base=m['baseline']['heapUsed'];idle=m['enhancedIdlePrimed']['heapUsed'] if m['enhancedIdlePrimed'] else None
  for k in ['baseline','live','settled','destroyed']:
   values[k+'_heap_bytes']=m[k]['heapUsed'];values[k+'_rounds']=m[k]['rounds']
  values.update({'live_minus_baseline_bytes':m['live']['heapUsed']-base,'settled_minus_baseline_bytes':m['settled']['heapUsed']-base,'destroyed_minus_baseline_bytes':m['destroyed']['heapUsed']-base,'live_before_drain_minus_baseline_bytes':m['liveBeforeDrain']-base,'settled_before_drain_minus_baseline_bytes':m['settledBeforeDrain']-base,'weak_alive_count':m['weakAlive']})
  if idle is not None:values.update({'enhanced_idle_minus_baseline_bytes':idle-base,'pending_live_minus_idle_bytes':m['live']['heapUsed']-idle,'settled_minus_idle_bytes':m['settled']['heapUsed']-idle,'enhanced_idle_heap_bytes':idle,'enhanced_idle_rounds':m['enhancedIdlePrimed']['rounds']})
 for metric,value in values.items():rows.append({'profile':r['profile'],'size':r['size'],'arm':r['arm'],'label':r['label'],'pid':r['pid'],'metric':metric,'value':value})
with (p/'ALL-SCALAR-SAMPLES.csv').open('w') as f:
 writer=csv.DictWriter(f,fieldnames=['profile','size','arm','label','pid','metric','value']);writer.writeheader();writer.writerows(rows)
def summary(v):return {'n':len(v),'median':statistics.median(v),'min':min(v),'max':max(v),'range':max(v)-min(v),'values':v} if v else None
out=[]
for cell in reg['profiles']:
 kind=cell['kind'];local=[r for r in status['results'] if r['profile']==kind];complete=len(local)==12 and all(r['valid'] for r in local);metrics={}
 for metric in sorted({r['metric'] for r in rows if r['profile']==kind}):
  subset=[r for r in rows if r['profile']==kind and r['metric']==metric]
  groups={a:summary([r['value'] for r in subset if r['arm']==a and r['label'].startswith('sample')]) for a in ['retained','selected']};aa=summary([r['value'] for r in subset if r['label'].startswith('aa')]);m={'retained':groups['retained'],'selected':groups['selected'],'aa':aa,'completeCell':complete}
  a,b=groups['retained'],groups['selected']
  if complete and a and b and aa:
   delta=b['median']-a['median'];overlap=max(a['min'],b['min'])<=min(a['max'],b['max']);noise=max(a['range'],b['range'],aa['range']);relative=100*delta/a['median'] if a['median']>0 else None
   paired=[next(r['value'] for r in subset if r['arm']=='selected' and r['label']=='sample'+str(i))-next(r['value'] for r in subset if r['arm']=='retained' and r['label']=='sample'+str(i)) for i in range(5)]
   m.update({'absoluteMedianDelta':delta,'relativeMedianDeltaPercent':relative,'rangesOverlap':overlap,'observedSameArmVariability':noise,'direction':'unresolved' if overlap or abs(delta)<=noise else 'selected-higher' if delta>0 else 'selected-lower','pairedDeltas':summary(paired),'relativeDeltaLimitation':'undefined for nonpositive retained median; signed process heap changes are not owner storage'})
  metrics[metric]=m
 out.append({'profile':kind,'size':cell['size'],'complete':complete,'children':len(local),'metrics':metrics})
(p/'DISTRIBUTIONS.json').write_text(json.dumps(out,indent=2)+'\n')
for v in out:
 metric='sync_ms' if not v['profile'].startswith('heap') else 'live_minus_baseline_bytes' if v['profile']=='heap-populated' else 'pending_live_minus_idle_bytes';m=v['metrics'].get(metric,{});print(v['profile'],v['complete'],metric,json.dumps(m))
