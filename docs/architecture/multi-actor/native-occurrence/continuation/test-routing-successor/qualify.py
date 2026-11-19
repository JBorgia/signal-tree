from pathlib import Path
import subprocess,json
p=Path(__file__).parent
node='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node'
gates=[
 ('kernel-discovery',[node,'node_modules/vitest/vitest.mjs','list','--root','packages/kernel','--config','vitest.config.ts','--filesOnly','--json']),
 ('root-discovery',[node,'node_modules/vitest/vitest.mjs','list','--config','vitest.config.ts','--filesOnly','--json']),
 ('replay-discovery',[node,'node_modules/vitest/vitest.mjs','list','--config','tools/experiments/native-publication-diagnostics/replay.config.ts','--filesOnly','--json']),
 ('registry',['node','tools/verify-gates.mjs','--list']),
 ('diagnostic-replay',['corepack','pnpm','nx','run','kernel:diagnostic-replay','--skip-nx-cache']),
 ('forwarding-retention',['node','tools/verify-gates.mjs','--only=forwarding-retention-gc']),
 ('existing-retention',['node','tools/verify-gates.mjs','--only=retention-gc']),
 ('forwarding-mutant',['node','tools/verify-gates.mjs','--self-test','--only=forwarding-retention-gc']),
 ('existing-mutant',['node','tools/verify-gates.mjs','--self-test','--only=retention-gc']),
 ('source-types',['corepack','pnpm','exec','tsc','--noEmit','--pretty','false','-p','tsconfig.typecheck-all.json']),
 ('spec-types',['node','tools/check-spec-types.mjs']),
]
results=[]
for name,argv in gates:
 (p/'STATUS.json').write_text(json.dumps({'running':name,'completed':results},indent=2)+'\n')
 r=subprocess.run(['python3',str(p/'gate.py'),name,*argv]);results.append({'name':name,'exit':r.returncode})
 if r.returncode:break
(p/'STATUS.json').write_text(json.dumps({'running':None,'completed':results},indent=2)+'\n')
