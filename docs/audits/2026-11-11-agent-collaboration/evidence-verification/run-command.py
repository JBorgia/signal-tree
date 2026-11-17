#!/usr/bin/env python3
import datetime, hashlib, json, os, pathlib, subprocess, sys, time
out=pathlib.Path(sys.argv[1]).resolve(); cwd=pathlib.Path(sys.argv[2]).resolve(); cmd=sys.argv[3:]
assert cmd and not out.exists(); out.mkdir(parents=True)
now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
receipt={'command':cmd,'cwd':str(cwd),'startedUTC':now(),'runner':str(pathlib.Path(__file__).resolve()),'runnerSha256':sha(pathlib.Path(__file__)),'environment':{k:os.environ[k] for k in ['PATH','NX_DAEMON','NX_ISOLATE_PLUGINS','CI','TMPDIR','ST_HISTORICAL_INPUTS_CONFIG'] if k in os.environ}}
(out/'plan.json').write_text(json.dumps(receipt,indent=2)+'\n')
start=time.monotonic(); log=out/'command.log'
with log.open('wb') as stream: result=subprocess.run(cmd,cwd=cwd,stdout=stream,stderr=subprocess.STDOUT)
receipt.update(finishedUTC=now(),seconds=time.monotonic()-start,exitCode=result.returncode,log=str(log),logSha256=sha(log))
(out/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({'command':cmd,'exitCode':result.returncode,'seconds':receipt['seconds'],'log':str(log)}),flush=True)
if result.returncode: print(log.read_text(errors='replace')[-6000:],flush=True)
sys.exit(result.returncode)
