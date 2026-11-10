from pathlib import Path
import json, subprocess, sys
packet=Path(sys.argv[1]).resolve();identity=sys.argv[2]
schedule=json.loads((packet/'SCHEDULE.json').read_text());rows=[row for row in schedule if row['id']==identity];assert len(rows)==1
row=rows[0];directory=packet/'children'/identity;directory.mkdir(parents=True,exist_ok=False)
env={'PATH':'/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:/usr/bin:/bin','TZ':'UTC','LANG':'C'}
(directory/'COMMAND.json').write_text(json.dumps(row,indent=2)+'\n')
with (directory/'stdout.log').open('x') as out,(directory/'stderr.log').open('x') as err:
 child=subprocess.Popen(row['argv'],env=env,stdout=out,stderr=err)
 (directory/'NODE-PROCESS.json').write_text(json.dumps({'pid':child.pid,'argv':row['argv'],'env':env})+'\n')
 rc=child.wait()
(directory/'EXIT').write_text(str(rc)+'\n');sys.exit(rc)
