import json,statistics,pathlib,sys
p=pathlib.Path(sys.argv[1]);d=json.loads((p/'samples.json').read_text());out=[]
for key in dict.fromkeys((x['scenario'],x['size'],x['count']) for x in d):
 rows=[x for x in d if (x['scenario'],x['size'],x['count'])==key];groups={a:[x for x in rows if x['label']==a] for a in ['baseline','AA','B']};r={'scenario':key[0],'size':key[1],'count':key[2]}
 if key[0]!='retention':
  for metric in ['cpuUs','wallMs','drainedCpuUs','drainedWallMs']:
   if metric not in rows[0]:continue
   r[metric]={a:statistics.median(x[metric] for x in v) for a,v in groups.items()}
   for arm in ['AA','B']:
    ratios=[next(x for x in groups[arm] if x['sample']==i)[metric]/next(x for x in groups['baseline'] if x['sample']==i)[metric] for i in range(3)];r[metric][arm+'Ratios']={'median':statistics.median(ratios),'min':min(ratios),'max':max(ratios)}
 else:
  r['postDrainDelta']={a:[x['postDrainDelta'] for x in v] for a,v in groups.items()};r['retiredCandidates']={a:[x.get('retiredCandidates') for x in v] for a,v in groups.items()}
 out.append(r)
(p/'summary.json').write_text(json.dumps(out,indent=2)+'\n')
for r in out:
 if 'drainedCpuUs' in r:
  m=r['drainedCpuUs'];print(r['scenario'],r['size'],'B',m['BRatios'],'AA',m['AARatios'])
 else:print(r['scenario'],r.get('postDrainDelta'))
