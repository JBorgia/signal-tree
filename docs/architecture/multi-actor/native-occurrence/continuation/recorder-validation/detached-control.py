from pathlib import Path
import subprocess,sys,os,time,json,signal
r=Path(sys.argv[1])
if len(sys.argv)>2:
 time.sleep(.3)
 with (r/'events.jsonl').open('a') as f:f.write(json.dumps({'kind':'case-start','at':time.time()*1000,'file':'synthetic-detached','name':'deadline reaches detached descendant'})+'\n')
 while True:time.sleep(.1)
child=subprocess.Popen([sys.executable,__file__,str(r),'child'],start_new_session=True)
(r/'DETACHED.json').write_text(json.dumps({'parentPid':os.getpid(),'childPid':child.pid,'childPgid':os.getpgid(child.pid)}))
def stop(*_):
 code=child.wait(timeout=3);(r/'DETACHED-EXIT.json').write_text(json.dumps({'childExit':code}));raise SystemExit(0)
signal.signal(signal.SIGTERM,stop)
while True:time.sleep(.1)
