from pathlib import Path
import subprocess,json
p=Path(__file__).parent
gates=[
 ('baseline-kernel-controls',['corepack','pnpm','nx','test','kernel','--skip-nx-cache','effective-presence-successor.spec.ts','effective-presence-reentry.spec.ts','effective-presence-install-reentry.spec.ts','--maxWorkers=1']),
 ('baseline-angular-install-reentry',['corepack','pnpm','nx','test','angular','--skip-nx-cache','effective-presence-install-reentry.spec.ts','--maxWorkers=1']),
 ('kernel-unchanged',['corepack','pnpm','nx','test','kernel','--skip-nx-cache','absent-collection.spec.ts','parent-snapshot-currentness.spec.ts','parent-freshness-focused.spec.ts','parent-freshness-entity.spec.ts','marker-snapshot-memo.spec.ts','snapshot-builder.spec.ts','--maxWorkers=1']),
 ('angular-unchanged',['corepack','pnpm','nx','test','angular','--skip-nx-cache','absent-collection.spec.ts','parent-snapshot-currentness.spec.ts','parent-freshness-focused.spec.ts','parent-freshness-entity.spec.ts','--maxWorkers=1']),
 ('react-absent',['corepack','pnpm','nx','test','react','--skip-nx-cache','absent-collection.spec.tsx','--maxWorkers=1']),
 ('solid-absent',['corepack','pnpm','nx','test','solid','--skip-nx-cache','absent-collection.spec.ts','--maxWorkers=1']),
 ('source-types',['corepack','pnpm','exec','tsc','--noEmit','--pretty','false','-p','tsconfig.typecheck-all.json']),
 ('spec-types',['node','tools/check-spec-types.mjs']),
]
r=[]
for name,argv in gates:
 (p/'STATUS.json').write_text(json.dumps({'running':name,'completed':r},indent=2)+'\n')
 result=subprocess.run(['python3',str(p/'gate.py'),name,*argv]);r.append({'name':name,'exit':result.returncode})
 if result.returncode and not name.startswith('baseline-'):
  print('Stopped for classification:',name,flush=True);break
(p/'STATUS.json').write_text(json.dumps({'running':None,'completed':r},indent=2)+'\n')
