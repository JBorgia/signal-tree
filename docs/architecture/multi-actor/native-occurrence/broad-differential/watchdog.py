from pathlib import Path
import json,subprocess,time,os,signal
r=Path('/private/tmp/st-native-broad-differential');signaled=set();started=time.time()
while not (r/'SOURCE-UNCHANGED.json').exists() and time.time()-started<7200:
 for label in ['predecessor','successor']:
  out=r/label/'kernel';log=out/'first.log'
  if not log.exists() or (out/'RESULT.json').exists() or label in signaled:continue
  age=time.time()-log.stat().st_birthtime
  if age<1200:continue
  lines=subprocess.check_output(['ps','-axo','pid,ppid,etime,time,command'],text=True).splitlines();target=str(out/'vitest.json');matched=[]
  for line in lines:
   fields=line.strip().split(None,4)
   if len(fields)==5 and target in fields[4] and '/vitest/vitest.mjs run' in fields[4]:matched.append(int(fields[0]))
  (out/'WATCHDOG.json').write_text(json.dumps({'limitSeconds':1200,'elapsedSeconds':age,'classification':'incomplete watchdog interruption; not a test assertion verdict','signal':'SIGINT','coordinatorPids':matched,'processSnapshot':lines},indent=2))
  for pid in matched:os.kill(pid,signal.SIGINT)
  signaled.add(label)
 time.sleep(10)
