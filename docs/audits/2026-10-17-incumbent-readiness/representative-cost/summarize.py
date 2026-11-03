import pathlib,json,statistics,hashlib,sys
p=pathlib.Path(__file__).parent
folder=sys.argv[1] if len(sys.argv)>1 else 'campaign'
prefix='' if folder=='campaign' else folder+'-'
samples=[(f,json.loads(f.read_text())) for f in (p/folder).glob('*.json')]
keys=sorted({(d['kind'],d['n']) for _,d in samples})
out=[]
def stats(v):return {'samples':v,'median':statistics.median(v),'min':min(v),'max':max(v)}
for kind,n in keys:
 rows=[(f,d) for f,d in samples if (d['kind'],d['n'])==(kind,n)]
 metrics={'sync_us_per_checked_cycle':lambda d:d['timing']['syncMs']*1000/d['timing']['count'],'drain_ms_per_batch':lambda d:d['timing']['drainMs'],'cpu_us_per_checked_cycle':lambda d:sum(d['timing']['totalCpu'].values())/d['timing']['count']} if not kind.startswith('heap') else {'process_baseline_bytes':lambda d:d['memory']['baseline']['heapUsed'],'live_predrain_delta_bytes':lambda d:d['memory']['liveBeforeDrain']-d['memory']['baseline']['heapUsed'],'live_drained_delta_bytes':lambda d:d['memory']['live']['heapUsed']-d['memory']['baseline']['heapUsed'],'settled_drained_delta_bytes':lambda d:d['memory']['settled']['heapUsed']-d['memory']['baseline']['heapUsed'],'destroyed_drained_delta_bytes':lambda d:d['memory']['destroyed']['heapUsed']-d['memory']['baseline']['heapUsed']}
 if kind=='heap-pending':metrics.update({'enhanced_idle_primed_delta_bytes':lambda d:d['memory']['enhancedIdlePrimed']['heapUsed']-d['memory']['baseline']['heapUsed'],'pending_increment_drained_bytes':lambda d:d['memory']['live']['heapUsed']-d['memory']['enhancedIdlePrimed']['heapUsed']})
 for metric,fn in metrics.items():
  arms={a:stats([fn(d) for f,d in rows if '-'+a+'-sample' in f.name]) for a in ['incumbent','candidate']}
  aa=stats([fn(d) for f,d in rows if '-aa' in f.name]);a,b=arms['incumbent'],arms['candidate'];delta=b['median']-a['median']
  overlap=not(a['max']<b['min'] or b['max']<a['min'])
  out.append({'kind':kind,'n':n,'metric':metric,**arms,'aa':aa,'delta':delta,'percent':100*delta/a['median'] if a['median']>0 else None,'direction':'unresolved' if overlap or abs(delta)<=max(aa['max']-aa['min'],a['max']-a['min'],b['max']-b['min']) else ('candidate higher' if delta>0 else 'candidate lower')})
(p/(prefix+'summary.json')).write_text(json.dumps(out,indent=2)+'\n')
md=['# Measured distributions','', 'Five decision samples per arm; two extra incumbent A/A controls. Ranges are min–max, not confidence intervals. All timing includes checks. Deltas are candidate minus incumbent.','', '## Synchronous checked cycles','', '| Profile | Rows | Incumbent µs median [range] | Candidate µs median [range] | Delta µs | Delta % | Direction under preregistered rule |','|---|---:|---:|---:|---:|---:|---|']
for x in out:
 if x['metric']!='sync_us_per_checked_cycle':continue
 a,b=x['incumbent'],x['candidate'];md.append(f"| {x['kind']} | {x['n']} | {a['median']:.2f} [{a['min']:.2f}, {a['max']:.2f}] | {b['median']:.2f} [{b['min']:.2f}, {b['max']:.2f}] | {x['delta']:+.2f} | {x['percent']:+.1f}% | {x['direction']} |")
md+=['','## Whole-process heap deltas in bytes','', 'Empty controls hold 100 trees; populated/pending profiles hold 10 trees. Pending holds 10 owners per tree. No per-tree heap slope is assumed. Negative residuals can arise from process heap noise.','', '| Profile / checkpoint | Rows/tree | Incumbent median [range] | Candidate median [range] | Delta bytes | Direction |','|---|---:|---:|---:|---:|---|']
for x in out:
 if x['metric'] not in ['live_drained_delta_bytes','pending_increment_drained_bytes','destroyed_drained_delta_bytes','enhanced_idle_primed_delta_bytes']:continue
 a,b=x['incumbent'],x['candidate'];md.append(f"| {x['kind']} / {x['metric']} | {x['n']} | {a['median']:.0f} [{a['min']:.0f}, {a['max']:.0f}] | {b['median']:.0f} [{b['min']:.0f}, {b['max']:.0f}] | {x['delta']:+.0f} | {x['direction']} |")
md+=['','CPU, batch-drain, pre-drain, settled and baseline distributions and A/A samples are in summary.json. Raw records retain environment/load observations.']
(p/(prefix+'DISTRIBUTIONS.md')).write_text('\n'.join(md)+'\n')
print('Profiles',len(keys),'decision records',len(samples),'failures',len(list((p/folder).glob('*.failure.txt'))))
