from pathlib import Path
import subprocess,json
p=Path(__file__).parent;results=[]
for name,args in [('forwarding-retention',['--only=forwarding-retention-gc']),('existing-retention',['--only=retention-gc']),('forwarding-mutant',['--self-test','--only=forwarding-retention-gc']),('existing-mutant',['--self-test','--only=retention-gc'])]:
 (p/'STATUS.json').write_text(json.dumps({'running':name,'completed':results},indent=2)+'\n')
 r=subprocess.run(['python3',str(p/'gate.py'),name,'/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node','tools/verify-gates.mjs',*args]);results.append({'name':name,'exit':r.returncode})
 if r.returncode:break
(p/'STATUS.json').write_text(json.dumps({'running':None,'completed':results},indent=2)+'\n')
