from pathlib import Path
import subprocess,json
r=Path(__file__).resolve().parent
for label,file in [('production8','consumer.production.mjs'),('production-lifecycle6','lifecycle-consumer.production.mjs'),('production-receipts6','receipt-consumer.production.mjs'),('production-no-link','no-link.production.mjs')]:
 print('START',label,flush=True)
 with (r/(label+'-supervisor.log')).open('x') as f:p=subprocess.run(['python3',str(r/'run-artifact.py'),label,'node',str(r/'consumer'/file)],stdout=f,stderr=subprocess.STDOUT)
 print('END',label,p.returncode,flush=True)
 if p.returncode:break
