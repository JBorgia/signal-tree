from pathlib import Path
import sys,json,time,os
r=Path(sys.argv[1]);mode=sys.argv[2]
if mode=='case':
 row={'kind':'case-start','at':time.time()*1000,'file':'synthetic-deadline-control','name':'append-only start survives overwritten current'}
 with (r/'events.jsonl').open('a') as f:f.write(json.dumps(row)+'\n')
 (r/'progress.current.json').write_text(json.dumps({'kind':'unrelated-last-event'}))
while True:time.sleep(.1)
