from pathlib import Path
r=Path(__file__).resolve().parent
s=Path('/private/tmp/st-c28-r3-matched-memory/run.py').read_text()
s=s.replace("c=r/arm/'candidate';return [p for p,v in manifests[arm].items() if p!=test and h(c/p)!=v]", "c=r/arm/'candidate';expected={**manifests[arm],**json.loads((r/arm/'OVERLAY-MANIFEST.json').read_text())};return [p for p,v in expected.items() if p!=test and h(c/p)!=v]")
a=s.index('schedule=[');b=s.index(';results=[]',a)
s=s[:a]+"schedule=[('baseline',512,1),('indexed',512,1),('indexed',2048,1),('baseline',2048,1)]"+s[b:]
s=s.replace("memory[-1]['stage']=='restoration:after-final-drain'","memory[-1]['stage']=='restoration:after-destroy'")
s=s.replace("source=verify(arm);steep=False","source=verify(arm);steep=False")
s=s.replace("if arm in previous and n>previous[arm]['n'] and delta>64*1024**2 and delta>8*previous[arm]['delta']:steep=True", "# No inferred allocation slope stop: fixed boundary/absolute/no-progress caps remain.")
s=s.replace("'validTwoCasesAndFreshWorker':valid,", "'validTwoCasesAndFreshWorker':valid,'counterInvariantFailures':sum(x.get('counts',{}).get('invariant.failed',0)+x.get('counts',{}).get('invariant.invalidSize',0) for x in memory),")
s=s.replace('or not valid or steep or maxheap', "or not valid or result['counterInvariantFailures'] or steep or maxheap")
(r/'run.py').write_text(s)
