#!/usr/bin/env python3
import argparse,pathlib,shutil,subprocess,json,hashlib
p=argparse.ArgumentParser();p.add_argument('--evidence',required=True);p.add_argument('--repo',required=True);p.add_argument('--output',required=True);p.add_argument('--node',required=True);a=p.parse_args()
src=pathlib.Path(a.evidence).resolve();repo=pathlib.Path(a.repo).resolve();out=pathlib.Path(a.output).resolve()
if out.exists():raise SystemExit('Output must not exist')
manifest=pathlib.Path(__file__).parent/'files.json'
if manifest.exists():
 for name,sha in json.loads(manifest.read_text()).items():assert hashlib.sha256((src/name).read_bytes()).hexdigest()==sha,name
subprocess.run(['git','diff','--exit-code','8d220643e0d4e34cbdbc6e55e6ef692b25d5e023','--','packages/kernel/src','packages/angular/src','packages/react/src','packages/vue/src','packages/solid/src'],cwd=repo,check=True,stdout=subprocess.DEVNULL)
shutil.copytree(src,out/'work');work=out/'work';logs=out/'replay';logs.mkdir()
for f in [*work.rglob('*.mjs'),*work.rglob('*.ts'),*work.rglob('*.py')]:
 if f.name in ['native.mjs','order-native.mjs','baseline-order-native.mjs']:continue
 f.write_text(f.read_text().replace('/Users/jonathanborgia/.codex/worktrees/capture-point-owner/signaltree',str(repo)).replace('/Users/jonathanborgia/code/signaltree',str(repo)).replace('/private/tmp/st-production-bridge-r1-20261015',str(work)).replace('/private/tmp/st-production-bridge-r2-20261015',str(work)).replace('/private/tmp/st-production-bridge-r3-20261015',str(work)))
def run(name,script,args=(),expected=0):
 r=subprocess.run([a.node,str(work/script),*map(str,args)],cwd=repo,capture_output=True,text=True)
 (logs/(name+'.stdout')).write_text(r.stdout);(logs/(name+'.stderr')).write_text(r.stderr)
 assert r.returncode==expected,(name,r.returncode,r.stderr[-1600:]);print(name,r.returncode,flush=True)
run('build-order','build-order.mjs');run('build-baseline','build-baseline.mjs');run('build-scalar','build.mjs')
for name in ['order-unit','order-frameworks','order-prepare-reentry','r2-prepend-one','r2-prepend-preparation','r2-entity-controls','r2-entity-order-overlap','r2-entity-capture-fault','r2-entity-delivery-throw','r2-entity-frameworks','r2-entity-native-taps','append-work','append-semantics','checkpoint','native-recovery-shape','frameworks','native-group-close-failure','native-close-recovery','native-terminal-error']:
 run(name,'tests/'+name+'.mjs',[logs/(name+'.json')])
run('baseline-new-order-contract','tests/r2-prepend-one.mjs',[logs/'baseline-new-order-contract.json',work/'baseline-order-native.mjs'],1)
r=json.loads((logs/'baseline-new-order-contract.json').read_text());assert len(r)==24 and all(x['status']=='failed' for x in r)
for name in ['r3-cost-unchanged-workload','r3-lifetime-obligations','r3-maintenance-delivery','r3-maintenance-faults','r3-native-scan-guards','r3-ordering-faults','r3-point-stages','r3-retention-graphs','r3-structural-scan-guards','r3-active-membership-capture','r3-active-membership-scans','r3-active-membership-prepend']:
 run(name,'tests/'+name+'.mjs',[logs/(name+'.json')])
for name in ['entity-field-unrelated-vue','entity-structural-unrelated-vue','entity-lifetime','alternate-dependencies','maintenance-delivery-detail','maintenance-routes','membership-reentry-regression','membership-controls','fresh-prepend-facts']:
 run(name,'review/'+name+'.mjs')
run('preserved-membership-reentry-red','review/membership-reentry-regression.mjs',[work/'entity-settlement/bridge-before-membership-hold.mjs'],1)
run('differential-types','check-order-types.mjs');shutil.copyfile(work/'order-types.json',logs/'types.json')
print('Bounded R3 controls passed; preserved baseline ordering and membership reentry failures reproduced. Not production integration acceptance.')
