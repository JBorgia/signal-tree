from pathlib import Path
import json,hashlib,shutil,os,subprocess
out=Path(__file__).resolve().parent;base=Path('/private/tmp/st-collection-egress-successor');source=base/'predecessor';m=json.loads((base/'PREDECESSOR-SHA256.json').read_text());dest=out/'predecessor';dest.mkdir(exist_ok=False)
for p,h in m.items():
 src=source/p
 assert hashlib.sha256(src.read_bytes()).hexdigest()==h,p
 dst=dest/p;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dst)
(dest/'node_modules').symlink_to((base/'candidate/node_modules').resolve(),target_is_directory=True)
shutil.copy2(out/'independent-egress-negative.spec.ts',dest/'packages/kernel/src/lib/independent-egress-negative.spec.ts')
env=os.environ.copy();env.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_TUI='false')
a=['corepack','pnpm','nx','test','kernel','--skip-nx-cache','independent-egress-negative.spec.ts','--reporter=json','--outputFile='+str(out/'predecessor-negative-vitest.json'),'--maxWorkers=1'];(out/'PREDECESSOR-NEGATIVE-COMMAND.json').write_text(json.dumps({'cwd':str(dest),'argv':a},indent=2))
with(out/'predecessor-negative-first.log').open('w')as log:r=subprocess.run(a,cwd=dest,env=env,stdout=log,stderr=subprocess.STDOUT)
(out/'PREDECESSOR-NEGATIVE-RESULT.json').write_text(json.dumps({'exit':r.returncode}));print(r.returncode)
