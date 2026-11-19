from pathlib import Path
import subprocess,os,json,concurrent.futures,hashlib
r=Path('/private/tmp/st-native-broad-differential');env=os.environ.copy();env.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false')
def run(label):
 out=r/label/'vue-hidden-focused';out.mkdir();b=r/label/'candidate';n='packages/vue/src/lib/absent-collection.spec.ts';m=json.loads((r/label/'SOURCE-SHA256.json').read_text());assert hashlib.sha256((b/n).read_bytes()).hexdigest()==m[n]
 cmd=['corepack','pnpm','nx','test','vue','--skip-nx-cache','absent-collection.spec.ts','--testNamePattern=a rollback writing hidden rows runs no effect that could see them','--reporter=json','--outputFile='+str(out/'vitest.json'),'--maxWorkers=1'];(out/'COMMAND.json').write_text(json.dumps({'argv':cmd,'cwd':str(b),'fixtureSha256':m[n]},indent=2))
 with (out/'first.log').open('w') as log:res=subprocess.run(cmd,cwd=b,env=env,stdout=log,stderr=subprocess.STDOUT)
 (out/'RESULT.json').write_text(json.dumps({'exit':res.returncode},indent=2));print(label,res.returncode,flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(run,['predecessor','successor']))
